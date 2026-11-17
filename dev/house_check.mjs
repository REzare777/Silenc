/**
 * ============================================================================
 *  Проверка домов: у каждого есть дверь, вход работает днём и не работает ночью
 * ============================================================================
 *
 *  Дом — отдельная локация, поэтому «войти» = вызвать интеракт у двери.
 *  Проверяем: вход днём, отказ ночью и вечером, выход к своей двери.
 *
 *  Запуск: cd dev && node house_check.mjs
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
  const doors = d.ctx.interactables.filter((x) => x.label === 'Войти в дом');
  const rows = [];
  for (let i = 0; i < doors.length; i++) {
    const door = doors[i];
    const doorX = door.pos.x, doorZ = door.pos.z;
    // днём — вход
    d.ctx.env.setTimeOfDay('day', true);
    door.act();
    const inHome = d.ctx.loc === `home${i}`;
    const exit = d.ctx.interactables.find((x) => x.where === `home${i}` && x.label === 'Выйти из дома');
    exit.act();
    const back = d.ctx.loc === 'village';
    const dist = Math.hypot(d.player.pos.x - doorX, d.player.pos.z - doorZ);
    // ночью — не пускают
    d.ctx.env.setTimeOfDay('night', true);
    door.act();
    const nightBlocked = d.ctx.loc === 'village';
    // вечером — тоже
    d.ctx.env.setTimeOfDay('dusk', true);
    door.act();
    const duskBlocked = d.ctx.loc === 'village';
    d.ctx.env.setTimeOfDay('day', true);
    rows.push({ i, inHome, back, dist: +dist.toFixed(2), nightBlocked, duskBlocked });
  }
  return { rows, doors: doors.length };
});

let bad = 0;
for (const r of res.rows) {
  const ok = r.inHome && r.back && r.nightBlocked && r.duskBlocked && r.dist < 6;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} дом ${String(r.i).padStart(2)}: вошёл:${r.inHome ? 'да' : 'НЕТ'} `
    + `вышел:${r.back ? 'да' : 'НЕТ'} (у двери ${r.dist} м) ночь:${r.nightBlocked ? 'закрыт' : 'ОТКРЫТ'} `
    + `вечер:${r.duskBlocked ? 'закрыт' : 'ОТКРЫТ'}`);
}
console.log(`\nдверей домов: ${res.doors} | проблемных: ${bad}`);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
