/**
 * Раунд 67 — визуальная проверка изменённых надписей.
 *
 * Снимает те экраны, где видны тексты, которые поменял пользователь:
 *   1) меню — подсказка про «Сохранить» и «Слоты…»;
 *   2) окно слотов — подпись про автосохранение;
 *   3) окно команд пса — заголовок и подсказка «щёлкните по земле»;
 *   4) доска для записки — подпись про «написать можно только раз»;
 *   5) фасад трактира — подсказка «Войти в трактир «Уставший вепрь»».
 *
 * Запуск: cd /workspace/village && node dev/r67_text_shots.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const OUT = path.resolve('shots/r67text');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('✓ снимок', name);
};

/* ---- 1. меню ---- */
await page.keyboard.press('KeyO');
await shot('1-меню');
const menuHint = await page.evaluate(() => {
  const el = document.querySelector('.mHint');
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : null;
});
console.log('  подсказка в меню:', menuHint);

/* ---- 2. окно слотов ---- */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Слоты/.test(x.textContent));
  if (b) b.click();
});
await shot('2-слоты');
const slotsFoot = await page.evaluate(() => {
  const el = document.querySelector('.slotsFoot');
  return el ? el.innerText.trim() : null;
});
console.log('  подпись слотов:', slotsFoot);
await page.evaluate(() => { const b = document.getElementById('slotsClose'); if (b) b.click(); });
await page.keyboard.press('KeyO');
await page.waitForTimeout(400);

/* ---- 3. окно команд пса ---- */
const dogOk = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const it = (ctx.interactables || []).find((x) => /Дать команду псу/.test(x.label || ''));
  if (!it) return false;
  it.act();
  return true;
});
await shot('3-пёс');
const dogTitle = await page.evaluate(() => {
  const el = document.querySelector('#dogCmd h2');
  const sub = document.querySelector('#dogCmd .dogBtns button[data-cmd="goto"] i');
  return { h2: el ? el.innerText.trim() : null, goto: sub ? sub.innerText.trim() : null };
});
console.log('  окно пса:', JSON.stringify(dogTitle), '(интеракт найден:', dogOk, ')');
await page.evaluate(() => { window.__dbg.ctx.ui?.closeDogMenu?.(); });

/* ---- 4. доска для записки ---- */
const noteOk = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const it = (ctx.interactables || []).find((x) => /записк|доск/i.test(x.label || ''));
  if (!it) return null;
  it.act();
  return it.label;
});
await shot('4-доска');
const noteSub = await page.evaluate(() => {
  const el = document.querySelector('#note .noteSub');
  return el ? el.innerText.trim() : null;
});
console.log('  подпись доски:', noteSub, '(интеракт:', noteOk, ')');

/* ---- 5. фасад трактира ---- */
const tavLabel = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const it = (ctx.interactables || []).find((x) => /Войти в трактир/.test(x.label || ''));
  return it ? it.label : null;
});
console.log('  подсказка трактира:', tavLabel);

console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));
await browser.close();
