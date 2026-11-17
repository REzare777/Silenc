/**
 * ============================================================================
 *  Проверка храма: вход, выход, проход по нефу без застреваний
 * ============================================================================
 *
 *  Храм — отдельная локация: за порталом настоящий неф со скамьями,
 *  витражами и алтарём. Проверяем вход, выход к фасаду и свободный
 *  проход по центральному проходу.
 *
 *  Запуск: cd dev && node church_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};

  const door = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  out.doorExists = !!door;
  door.act();
  out.inChurch = d.ctx.loc === 'church';
  out.spawn = { x: +d.player.pos.x.toFixed(2), z: +d.player.pos.z.toFixed(2) };

  // свободный проход по проходу: от портала к алтарю
  const p = d.player;
  p.teleport(0, -6.5, 0);
  p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
  p.yaw = Math.PI;                 // смотрим на север, к алтарю
  let reached = false;
  for (let i = 0; i < 420; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    if (p.pos.z > 5.4) { reached = true; break; }
  }
  p.keys.clear();
  out.reachedAltar = reached;
  out.endPos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };

  // выход из храма
  const exit = d.ctx.interactables.find((x) => x.where === 'church' && x.label === 'Выйти из храма');
  out.exitExists = !!exit;
  exit.act();
  out.backToVillage = d.ctx.loc === 'village';
  const doorPos = d.ctx.doors.church;
  out.exitDist = +Math.hypot(d.player.pos.x - doorPos.x, d.player.pos.z - doorPos.z).toFixed(2);
  return out;
});

const checks = [
  ['интеракт входа есть', res.doorExists],
  ['вход в локацию храма', res.inChurch],
  ['проход по нефу до алтаря', res.reachedAltar],
  ['интеракт выхода есть', res.exitExists],
  ['выход в деревню', res.backToVillage],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
