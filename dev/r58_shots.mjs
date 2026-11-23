/**
 * Кадры раунда 58: меню, факел, витражи, портал подземелья, кузня, лук.
 *
 * В песочнице кадр в SwiftShader идёт 10–60 секунд, поэтому ждём роста
 * счётчика window.__frames, а не фиксированную паузу.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(`http://127.0.0.1:4205/?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(600);

/**
 * Дождаться, пока движок нарисует новый кадр.
 *
 * @param {number} [n] сколько кадров ждать
 */
async function frames(n = 1) {
  const start = await page.evaluate(() => window.__frames || 0);
  await page.waitForFunction(
    (target) => (window.__frames || 0) >= target,
    start + n,
    { timeout: 240000 },
  );
}

/* ---------- меню паузы ---------- */
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/R58_menu.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_menu');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

/* ---------- подземелье: факел в руке и портал наружу ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('dungeon');
  D.player.teleport(0, -8, 0);
  for (let i = 0; i < 20; i++) D.player.update(0.05);
  // факел по-настоящему: предмет в сумке, в левой руке и горит
  D.inventory.slots[27] = { id: 'torch', spec: D.items.getItem('torch'), count: 1, best: null };
  D.loadout.setTorchEquipped(true);
  D.combat.addFuel(100);
  D.combat.lightNow();
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_dungeon_torch.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_dungeon_torch');

/* ---------- подземелье: портал наружу ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  D.player.teleport(0, -26, 0);
  for (let i = 0; i < 20; i++) D.player.update(0.05);
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_dungeon_portal.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_dungeon_portal');

/* ---------- храм: витражи ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('church');
  D.player.teleport(0, -2, -Math.PI / 2);
  for (let i = 0; i < 20; i++) D.player.update(0.05);
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_church.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_church');

/* ---------- кузня с улицы ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('village');
  // стоим напротив кузни и смотрим на её проём
  D.player.teleport(9.0, -5.7, 0);
  D.player.yaw = -1.18;
  for (let i = 0; i < 20; i++) D.player.update(0.05);
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_blacksmith.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_blacksmith');

/* ---------- лук в руках ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  const inv = D.inventory;
  const bow = D.items.getItem('bow');
  inv.slots[27] = { id: 'bow', spec: bow, count: 1, best: null };
  D.loadout.select(0);
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_bow.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_bow');

/* ---------- трава на площади ---------- */
await page.evaluate(() => {
  const D = window.__dbg;
  D.player.teleport(0, 20, 0);
  for (let i = 0; i < 20; i++) D.player.update(0.05);
});
await frames(2);
await page.screenshot({ path: `${OUT}/R58_square.jpg`, type: 'jpeg', quality: 90 });
console.log('снимок: R58_square');

await browser.close();
console.log('готово');
