/**
 * Раунд 54: короткая пересъёмка — кузнец, двуручный меч, лук, подземелье.
 *
 * Запуск: cd dev && node r54_quick_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

/* --- кузнец --- */
const pos = await page.evaluate(() => {
  const d = window.__dbg;
  const s = d.npcs.blacksmith;
  d.ctx.player.enabled = false;
  const yaw = s.yaw || 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  d.camera.position.set(s.x + fx * 2.4, 1.45, s.z + fz * 2.4);
  d.camera.lookAt(s.x, 1.15, s.z);
  d.camera.updateMatrixWorld();
  // игрока ставим туда же, куда смотрит кузнец, — иначе он отвернётся
  d.ctx.player.pos.x = d.camera.position.x;
  d.ctx.player.pos.z = d.camera.position.z;
  return { x: +s.x.toFixed(2), z: +s.z.toFixed(2), yaw: +yaw.toFixed(2) };
});
console.log('кузнец:', JSON.stringify(pos));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/R54_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: smith');

/* --- двуручный меч --- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.player.enabled = false;
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'greatsword', spec: d.items.getItem('greatsword'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
  d.camera.position.set(0, 1.62, 0);
  d.camera.lookAt(0, 1.62, -10);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/R54_w_greatsword.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: greatsword');

/* --- лук --- */
await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'bow', spec: d.items.getItem('bow'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/R54_w_bow.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: bow');

/* --- подземелье: меч в правой руке, факел в левой --- */
const hit = await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'shortsword', spec: d.items.getItem('shortsword'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
  d.ctx.player.enabled = false;
  return { torch: !!d.viewmodel.torch, weapon: !!d.viewmodel.weapon };
});
console.log('подземелье:', JSON.stringify(hit));
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/R54_dungeon_sword.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dungeon');

await browser.close();
console.log('готово');
