/** Раунд 54: финальные кадры — торговля и диалог с кузнецом. */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.stats.coins = 320;
  d.inventory.slots.fill(null);
  d.inventory.slots[0] = { id: 'sudak', spec: d.items.getItem('sudak'), count: 2, best: { weight: 2.1, length: 44 } };
  d.inventory.slots[27] = { id: 'shortsword', spec: d.items.getItem('shortsword'), count: 1, best: null };
  d.ui.renderInventory(d.inventory);
  d.trade.open('blacksmith');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/R54_trade_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: trade smith');
await page.evaluate(() => {
  const d = window.__dbg;
  d.trade.close();
  d.ctx.systems.dialog.open('blacksmith');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/R54_dialog_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dialog smith');
await browser.close();
console.log('готово');
