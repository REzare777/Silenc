/**
 * Раунд 67 — проверка опубликованного сайта.
 *
 * Запуск: cd /workspace/village && node dev/r67_live_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.argv[2] || 'https://rezare777.github.io/Silenc/';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const out = {};
  const home = (ctx.homes || [])[10];
  out.home = home ? { x: +home.x.toFixed(1), z: +home.z.toFixed(1) } : null;
  out.doorInteract = (ctx.interactables || []).some((i) => i.label === 'Войти в свой дом');
  out.sleepInteract = (ctx.interactables || []).some((i) => i.label === 'Лечь и поспать');
  out.cliffText = !!(ctx.M && ctx.M.cliff && ctx.M.cliff.map);
  out.trail = (ctx.roadTrails || []).some((t) => t.id === 'homeCliff');
  out.caveRoad = (ctx.roadTrails || []).some((t) => t.id === 'caveRoad');
  out.boardHome = ctx.boardHome;
  out.homeName = (d.homeLocs || [])[10] ? d.homeLocs[10].name : null;
  // вход в дом и сон
  d.setLocation('home10');
  out.inHome = ctx.loc;
  const sleep = (ctx.interactables || []).find((i) => i.label === 'Лечь и поспать');
  if (sleep) { sleep.act(); out.afterSleep = ctx.env.current; }
  d.setLocation('village');
  return out;
});

console.log('=== Опубликованный сайт:', URL, '===');
console.log(JSON.stringify(res, null, 2));

const checks = [
  ['дом игрока у скалы', !!res.home && Math.abs(res.home.x + 58.6) < 1 && Math.abs(res.home.z + 67.4) < 1],
  ['в свой дом можно войти', res.doorInteract],
  ['в доме есть кровать', res.sleepInteract],
  ['после сна наступает утро', res.afterSleep === 'morning' || res.afterSleep === 'dawn'],
  ['у скалы своя порода', res.cliffText],
  ['тропа к дому есть', res.trail],
  ['дорога к скале в сети дорог', res.caveRoad],
  ['доска у дома игрока', res.boardHome === 10],
  ['дом называется «Твой дом у скалы»', res.homeName === 'Твой дом у скалы'],
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) bad++;
}
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));
console.log(bad ? `ошибок: ${bad}` : 'ошибок: 0');
await browser.close();
process.exit(bad || errs.length ? 1 : 0);
