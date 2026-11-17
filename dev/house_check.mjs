/**
 * ============================================================================
 *  Проверка домов: все заперты (тема отложена) — входа нет ни в какое время
 * ============================================================================
 *
 *  Пока дома закрыты на ключ, у каждой двери есть подсказка «Запертая дверь
 *  дома», а попытка войти не меняет локацию. Проверяем это для всех домов
 *  и в любое время суток.
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
  const doors = d.ctx.interactables.filter((x) => x.label && x.label.includes('дверь дома'));
  const phases = ['morning', 'day', 'golden', 'dusk', 'night'];
  const rows = [];
  for (const door of doors) {
    let opened = 0;
    for (const ph of phases) {
      d.ctx.env.setTimeOfDay(ph, true);
      door.act();
      if (d.ctx.loc !== 'village') opened++;
      d.ctx.env.setTimeOfDay('day', true);
    }
    rows.push({ label: door.label, opened });
  }
  d.ctx.env.setTimeOfDay('day', true);
  return { rows, doors: doors.length, loc: d.ctx.loc };
});

let bad = 0;
for (const r of res.rows) {
  const ok = r.opened === 0;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} «${r.label}»: входов ${r.opened} из 5 (должно быть 0)`);
}
console.log(`\nдверей домов: ${res.doors} | проблемных: ${bad}`);
console.log(`ошибки: ${bad + errs.length}`, errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
