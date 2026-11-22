/**
 * Раунд 54: кадры кузнеца, торговых окон и оружия в руках.
 *
 * Запуск: cd dev && node r54_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

// начинаем игру
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/* ---------------- 1. кузнец у кузни ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const smith = d.npcs.blacksmith;
  // игрок выключен — камеру ставим руками, иначе её перезапишет игрок
  d.ctx.player.enabled = false;
  d.ctx.player.pos.x = smith.x + 2.6;
  d.ctx.player.pos.z = smith.z + 2.4;
  // встаём там, куда смотрит кузнец
  const yaw = smith.yaw || 0;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  d.camera.position.set(smith.x + fx * 2.6, 1.5, smith.z + fz * 2.6);
  d.camera.lookAt(smith.x, 1.15, smith.z);
  d.camera.updateMatrixWorld();
  console.log('кузнец:', smith.x.toFixed(1), smith.z.toFixed(1), 'yaw', yaw.toFixed(2));
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/R54_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: smith');

/* ---------------- 2. торговое окно кузнеца ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.stats.coins = 400;
  d.trade.open('blacksmith');
});
await page.waitForTimeout(1200);
console.log('иконки в торговле:', JSON.stringify(await page.evaluate(() => {
  const cs = [...document.querySelectorAll('#tradeGoods canvas')];
  return {
    count: cs.length,
    sizes: cs.slice(0, 3).map((c) => `${c.width}x${c.height}`),
    box: cs[0] ? cs[0].getBoundingClientRect().width : null,
  };
})));
await page.screenshot({ path: `${OUT}/R54_trade_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: trade smith');

/* ---------------- 3. покупка оружия — оно сразу в руках ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.trade.buy('longsword');
  d.trade.close();          // окно закрываем — нужен вид на руки
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/R54_sword_hands.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: sword in hands');

/* ---------------- 4. торговое окно трактирщика ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.trade.close();
  d.trade.open('barkeep');
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/R54_trade_barkeep.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: trade barkeep');

/* ---------------- 5. все виды оружия в руках ---------------- */
const ids = ['dagger', 'shortsword', 'axe', 'greatsword', 'bow', 'staff'];
for (const id of ids) {
  await page.evaluate((wid) => {
    const d = window.__dbg;
    d.trade.close();
    const spec = d.items.getItem(wid);
    d.inventory.slots.fill(null);
    d.inventory.slots[27] = { id: wid, spec, count: 1, best: null };
    d.loadout.select(0);
    d.loadout.sync();
    d.ctx.stats.coins = 500;
  }, id);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/R54_w_${id}.jpg`, type: 'jpeg', quality: 88 });
  console.log('снимок: weapon', id);
}

/* ---------------- 6. инвентарь с оружием и товарами ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  inv.slots.fill(null);
  const put = (slot, id) => {
    const spec = d.items.getItem(id);
    inv.slots[slot] = { id, spec, count: 1, best: spec.kind === 'fish' ? { weight: spec.weightMin, length: spec.lengthMin } : null };
  };
  put(0, 'longsword'); put(1, 'dagger'); put(2, 'bow');
  put(3, 'bread'); put(4, 'ale'); put(5, 'candle');
  put(6, 'pitch'); put(7, 'axe');
  put(27, 'shortsword');
  inv.sel = 0;
  d.ui.renderInventory(inv);
  d.ui.openInv();
});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/R54_inventory.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: inventory');

/* ---------------- 7. диалог с кузнецом ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ui.closeInv();
  d.ctx.systems.dialog.open('blacksmith');
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/R54_dialog_smith.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dialog smith');

await browser.close();
console.log('готово');
