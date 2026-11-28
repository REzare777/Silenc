/**
 * Раунд 70 — проверки разговора с трактирщиком и кузнецом.
 *
 * Что проверяем:
 *   1. Нажатие E рядом с Хортом открывает РАЗГОВОР, а не лавку.
 *      Раньше у стойки стояла отдельная точка «Торговать с трактирщиком»
 *      и она перехватывала нажатие: стоя перед Хортом, игрок попадал в
 *      магазин вместо разговора.
 *   2. В окне разговора есть кнопка «Торговать».
 *   3. Кнопка открывает торговлю, а после закрытия торговли разговор
 *      возвращается.
 *   4. То же самое с кузнецом Торном.
 *
 * Запуск: cd /workspace/village && node dev/r70_check.mjs [url]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = process.argv[2] || 'http://127.0.0.1:4205';

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) bad++;
};

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(SITE + '/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/* ------------------------------------------------------------------
 *  1–3. Хорт в трактире
 * ------------------------------------------------------------------ */

console.log('=== Хорт в трактире ===');
const near = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  d.setLocation('tavern');
  const npc = ctx.systems.locations.npcs.barkeep;
  // встаём прямо перед ним, с клиентской стороны стойки
  ctx.player.pos.x = npc.x - 1.4;
  ctx.player.pos.z = npc.z;
  const best = ctx.systems.interactions.nearest();
  const tavernLabels = (ctx.interactables || [])
    .filter((i) => (i.where || 'village') === 'tavern')
    .map((i) => i.label);
  return {
    nearest: best ? best.label : null,
    hasTradePoint: tavernLabels.some((l) => /Торговать с трактирщиком/.test(l)),
    labels: tavernLabels,
  };
});
ok('перед Хортом нажимается «Поговорить с трактирщиком»',
  near.nearest === 'Поговорить с трактирщиком', near.nearest);
ok('отдельной точки «Торговать с трактирщиком» больше нет', !near.hasTradePoint);

await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
const afterE = await page.evaluate(() => ({
  mode: window.__dbg.ctx.mode,
  dialog: document.getElementById('dialog').classList.contains('on'),
  trade: document.getElementById('trade').classList.contains('on'),
  btnHidden: document.getElementById('dlgTrade').hidden,
  btnText: document.getElementById('dlgTrade').textContent,
}));
ok('E открывает разговор, а не лавку',
  afterE.dialog && !afterE.trade && afterE.mode === 'dialog', afterE.mode);
ok('в разговоре есть кнопка «Торговать»',
  !afterE.btnHidden && /Торговать/i.test(afterE.btnText), afterE.btnText);

await page.evaluate(() => document.getElementById('dlgTrade').click());
await page.waitForTimeout(900);
const afterTrade = await page.evaluate(() => ({
  mode: window.__dbg.ctx.mode,
  dialog: document.getElementById('dialog').classList.contains('on'),
  trade: document.getElementById('trade').classList.contains('on'),
  name: document.querySelector('#trade .tradeName')?.textContent
    || document.querySelector('#trade b')?.textContent || '',
}));
ok('кнопка «Торговать» открывает торговлю',
  afterTrade.trade && !afterTrade.dialog, afterTrade.mode);

await page.evaluate(() => window.__dbg.ctx.systems.trade.close());
await page.waitForTimeout(900);
const afterClose = await page.evaluate(() => ({
  mode: window.__dbg.ctx.mode,
  dialog: document.getElementById('dialog').classList.contains('on'),
  trade: document.getElementById('trade').classList.contains('on'),
}));
ok('после закрытия торговли возвращается разговор',
  afterClose.dialog && !afterClose.trade && afterClose.mode === 'dialog', afterClose.mode);
await page.screenshot({ path: path.join(ROOT, 'shots', 'r70-barkeep.png') });
console.log('✓ снимок shots/r70-barkeep.png');

// тема «Покажи товар» тоже ведёт в торговлю
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#dlgTopics button')]
    .find((x) => x.textContent.trim() === 'Покажи товар');
  if (b) b.click();
});
await page.waitForTimeout(900);
const viaTopic = await page.evaluate(() => ({
  trade: document.getElementById('trade').classList.contains('on'),
  dialog: document.getElementById('dialog').classList.contains('on'),
}));
ok('тема «Покажи товар» открывает торговлю', viaTopic.trade && !viaTopic.dialog);

/* ------------------------------------------------------------------
 *  4. Кузнец Торн
 * ------------------------------------------------------------------ */

console.log('\n=== Кузнец Торн ===');
const smith = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  d.setLocation('village');
  const npc = ctx.npcs.blacksmith;
  ctx.player.pos.x = npc.x + 1.2;
  ctx.player.pos.z = npc.z + 1.2;
  const best = ctx.systems.interactions.nearest();
  return { nearest: best ? best.label : null };
});
ok('у кузнеца нажимается «Поговорить с кузнецом»',
  smith.nearest === 'Поговорить с кузнецом', smith.nearest);

await page.keyboard.press('KeyE');
await page.waitForTimeout(900);
const smithDlg = await page.evaluate(() => ({
  dialog: document.getElementById('dialog').classList.contains('on'),
  btnHidden: document.getElementById('dlgTrade').hidden,
  name: document.getElementById('dlgName').textContent,
}));
ok('E открывает разговор с кузнецом', smithDlg.dialog && smithDlg.name === 'Торн', smithDlg.name);
ok('у кузнеца тоже есть кнопка «Торговать»', !smithDlg.btnHidden);
await page.evaluate(() => document.getElementById('dlgTrade').click());
await page.waitForTimeout(900);
const smithTrade = await page.evaluate(() => ({
  trade: document.getElementById('trade').classList.contains('on'),
  hasWeapons: /Кинжал|Меч|Лук/.test(document.getElementById('tradeGoods')?.textContent || ''),
}));
ok('кнопка открывает торговлю кузнецом', smithTrade.trade);
ok('в лавке кузнеца есть оружие', smithTrade.hasWeapons);

console.log('\nошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));

await browser.close();
console.log(bad || errs.length ? `\nошибок: ${bad + errs.length}` : '\nошибок: 0');
process.exit(bad || errs.length ? 1 : 0);
