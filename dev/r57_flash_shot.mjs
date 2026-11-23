/** Проверка «Огненной вспышки» в подземелье: кадры до и после. */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
const base = await page.evaluate(() => window.__frames || 0);
await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  d.player.teleport(0, -8, 0);
  for (let i = 0; i < 20; i++) d.player.update(0.05);
});
await page.waitForFunction((b) => (window.__frames || 0) > b, base, { timeout: 240000 });
await page.screenshot({ path: `${OUT}/R57_flash_before.jpg`, type: 'jpeg', quality: 88 });
console.log('до');
const base2 = await page.evaluate(() => window.__frames || 0);
await page.evaluate(() => {
  const d = window.__dbg;
  const spec = d.items.getItem('spell_flash');
  d.spells.cast(spec);
});
await page.waitForFunction((b) => (window.__frames || 0) > b, base2, { timeout: 240000 });
await page.screenshot({ path: `${OUT}/R57_flash_after.jpg`, type: 'jpeg', quality: 88 });
console.log('после');
await browser.close();
