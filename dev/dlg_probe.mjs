/**
 * Диагностика диалогового окна: проверяем, что карточка реально видна.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__dbg && window.__dbg.player, null, { timeout: 120000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const d = document.getElementById('dialog');
  const card = document.querySelector('.dlgCard');
  const pic = document.getElementById('dlgPic');
  const cs = d ? getComputedStyle(d) : null;
  const cs2 = card ? getComputedStyle(card) : null;
  return {
    dialogExists: !!d,
    dialogClass: d ? d.className : null,
    dialogDisplay: cs ? cs.display : null,
    dialogOpacity: cs ? cs.opacity : null,
    dialogZ: cs ? cs.zIndex : null,
    cardRect: card ? card.getBoundingClientRect().toJSON() : null,
    cardBg: cs2 ? cs2.background.slice(0, 60) : null,
    picRect: pic ? pic.getBoundingClientRect().toJSON() : null,
    picChildren: pic ? pic.children.length : null,
    topics: document.getElementById('dlgTopics') ? document.getElementById('dlgTopics').children.length : null,
    name: document.getElementById('dlgName') ? document.getElementById('dlgName').textContent : null,
    text: document.getElementById('dlgText') ? document.getElementById('dlgText').textContent : null,
  };
});

console.log('до открытия:', JSON.stringify(info, null, 1));

const opened = await page.evaluate(() => {
  window.__dbg.dialog.open('barkeep');
  const d = document.getElementById('dialog');
  const card = document.querySelector('.dlgCard');
  return {
    class: d.className,
    display: getComputedStyle(d).display,
    card: card.getBoundingClientRect().toJSON(),
    topics: document.getElementById('dlgTopics').children.length,
    text: document.getElementById('dlgText').textContent,
    pic: document.getElementById('dlgPic').getBoundingClientRect().toJSON(),
    canvas: (() => { const c = document.querySelector('#dlgPic canvas'); return c ? { w: c.width, h: c.height, rect: c.getBoundingClientRect().toJSON() } : null; })(),
  };
});
console.log('после открытия:', JSON.stringify(opened, null, 1));
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/R25_dlg_window.png' });
console.log('ошибки в консоли:', errors.length, errors);
await browser.close();
