/**
 * ============================================================================
 *  Раунд 53: смоук-тест живого пути игрока
 * ============================================================================
 *
 *  Проверяем то, чего не проверяет r53_check: настоящие клики по экрану.
 *
 *   1. Титульный экран → «Загрузить игру» → «Сохранить» в слот 1.
 *   2. Перезагрузка страницы → «Продолжить» → игра идёт, монеты на месте.
 *   3. Смерть → экран «Погиб» → «Загрузить» → окно слотов → «Загрузить» из
 *      слота 1 → игра снова идёт, здоровье восстановлено.
 *
 *  Запуск: cd dev && node r53_smoke.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

const out = {};
const click = (id) => page.evaluate((i) => {
  const el = document.getElementById(i);
  if (!el) throw new Error('нет кнопки ' + i);
  el.click();
}, id);

/* --- 1. титульный экран: сохранить в слот 1 --- */
await click('begin');                       // начать игру
await page.waitForTimeout(1200);
out.started = await page.evaluate(() => window.__dbg.ctx.player.enabled === true);

await page.evaluate(() => { window.__dbg.ctx.stats.coins = 77; });
await page.evaluate(() => window.__dbg.saveToSlot(1));
// и «последнее сохранение» — его показывает кнопка «Продолжить»
await page.evaluate(() => window.__dbg.saveGame(true));
out.slotSaved = await page.evaluate(() => {
  const s = window.__dbg.listSlots();
  return s[1].exists && s[1].coins === 77;
});

/* --- 2. перезагрузка → «Продолжить» --- */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.waitForTimeout(800);
out.continueVisible = await page.evaluate(() =>
  !document.getElementById('continue').classList.contains('hidden'));
out.continueLabel = await page.evaluate(() => document.getElementById('contDay').textContent);
await click('continue');
await page.waitForTimeout(1500);
out.afterContinue = await page.evaluate(() => ({
  playing: window.__dbg.ctx.player.enabled === true,
  coins: window.__dbg.ctx.stats.coins,
  date: document.getElementById('dateText').textContent,
}));

/* --- 3. смерть → «Загрузить» → слот 1 --- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.stats.hp = 100;
  d.ctx.systems.death.kill('Тень забрала вас в пещере. Тьма сомкнулась.');
  for (let i = 0; i < 130; i++) d.ctx.systems.death.update(1 / 60);
});
await page.waitForTimeout(700);
out.deathShown = await page.evaluate(() =>
  document.getElementById('death').classList.contains('on'));
out.deathMeta = await page.evaluate(() => document.getElementById('deathLastMeta').textContent);

await click('deathLoad');                  // «Загрузить» — выбор слота
await page.waitForTimeout(700);
out.slotsOpened = await page.evaluate(() =>
  document.getElementById('slots').classList.contains('on'));
// жмём «Загрузить» в строке слота 1
await page.evaluate(() => {
  const row = document.querySelector('#slotsList .slotRow[data-key="slot1"]');
  row.querySelector('button[data-act="load"]').click();
});
await page.waitForTimeout(1500);
out.afterSlotLoad = await page.evaluate(() => ({
  playing: window.__dbg.ctx.player.enabled === true,
  hp: window.__dbg.ctx.stats.hp,
  coins: window.__dbg.ctx.stats.coins,
  deathClosed: !document.getElementById('death').classList.contains('on'),
  slotsClosed: !document.getElementById('slots').classList.contains('on'),
}));

/* --- 4. «Загрузить последнее сохранение» --- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.death.kill('Тень забрала вас в пещере. Тьма сомкнулась.');
  for (let i = 0; i < 130; i++) d.ctx.systems.death.update(1 / 60);
});
await page.waitForTimeout(600);
await click('deathLast');
await page.waitForTimeout(1500);
out.afterLast = await page.evaluate(() => ({
  playing: window.__dbg.ctx.player.enabled === true,
  hp: window.__dbg.ctx.stats.hp,
  deathClosed: !document.getElementById('death').classList.contains('on'),
}));

console.log(JSON.stringify(out, null, 1));
console.log('ошибок в консоли:', errs.length, errs.slice(0, 3));

const bad = [];
if (!out.started) bad.push('игра не началась');
if (!out.slotSaved) bad.push('слот не сохранился');
if (!out.continueVisible) bad.push('кнопка «Продолжить» не появилась');
if (!out.afterContinue?.playing) bad.push('после «Продолжить» игра не идёт');
if (out.afterContinue?.coins !== 77) bad.push('после «Продолжить» монеты не восстановлены');
if (!out.deathShown) bad.push('экран «Погиб» не появился');
if (!out.slotsOpened) bad.push('окно слотов не открылось');
if (!out.afterSlotLoad?.playing) bad.push('после загрузки слота игра не идёт');
if (out.afterSlotLoad?.hp < 50) bad.push('здоровье не восстановилось');
if (!out.afterLast?.playing) bad.push('после «Загрузить последнее сохранение» игра не идёт');
console.log(bad.length ? 'ПРОБЛЕМЫ: ' + bad.join(', ') : 'живой путь пройден полностью');
await browser.close();
process.exit(bad.length || errs.length ? 1 : 0);
