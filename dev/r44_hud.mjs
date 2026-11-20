/**
 * Раунд 44: кадры HUD (полоски характеристик, монеты) и инвентаря.
 * Запуск: cd dev && node r44_hud.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R44HUD';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
console.log('старт:', await page.evaluate(() => document.getElementById('start').className));

const grab = async (name) => {
  // HUD — это DOM, поэтому снимок всей страницы, а не только canvas.
  // animations:disabled — досрочно завершает CSS-переходы (софт-рендер
  // рисует кадр по 25 секунд, и переходы просто не успевают отработать).
  await page.screenshot({ path: `${OUT}/${TAG}_${name}.jpg`, type: 'jpeg', quality: 88, animations: 'disabled' });
  console.log('снимок:', name);
};

// HUD: полоски в разном состоянии
await page.evaluate(() => {
  const d = window.__dbg;
  d.teleport(6, 20, 0.6);
  d.stats.hp = 42; d.stats.stamina = 17; d.stats.mana = 88;
  d.stats.coins = 137;
  d.ui.setVitals(d.stats);
  d.ui.setCoins(d.stats.coins);
});
await page.waitForTimeout(600);
await grab('hud');

// инвентарь с уловом и монетами
await page.evaluate(() => {
  const d = window.__dbg;
  const mk = (i) => {
    const spec = d.FISH[i];
    return { id: spec.id, spec, count: 1, best: { weight: spec.weightMax * 0.8, length: spec.lengthMax * 0.8 } };
  };
  [0, 1, 2, 5, 8, 12].forEach((i) => d.inventory.add(mk(i)));
  d.ui.renderInventory(d.inventory);
  d.ui.openInv();
});
await page.waitForTimeout(900);
await grab('inventory');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
