/** Раунд 56: парящее оружие и факел в подземелье. */
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
await page.waitForTimeout(1200);

// в подземелье: меч на поясе, факел горит
const base = await page.evaluate(() => window.__frames || 0);
await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'shortsword', spec: d.items.getItem('shortsword'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
  // разжигаем факел напрямую: без смолы и фитиля его не поджечь
  d.combat.state.lit = true;
  d.combat.brand.setLit(true);
  document.getElementById('hints').classList.add('hide');
  for (let i = 0; i < 20; i++) d.viewmodel.update(1 / 60, d.camera, d.ctx.player);
});
await page.waitForFunction((b) => (window.__frames || 0) > b, base, { timeout: 240000 });
await page.screenshot({ path: `${OUT}/R56_dungeon.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dungeon');

await browser.close();
console.log('готово');
