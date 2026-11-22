/** Кадры парящего оружия в игре (в мире). */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

/**
 * Дождаться кадра ПОСЛЕ правки: SwiftShader рисует кадр раз в 10–60 с.
 *
 * @param {number} base значение счётчика до правки
 */
async function waitFrame(base) {
  await page.waitForFunction((b) => (window.__frames || 0) > b, base, { timeout: 240000 });
}

const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['shortsword', 'greatsword', 'axe', 'bow', 'staff', 'dagger'];
for (const id of ids) {
  const base = await page.evaluate(() => window.__frames || 0);
  await page.evaluate((wid) => {
    const d = window.__dbg;
    const inv = d.inventory;
    inv.slots.fill(null);
    inv.slots[27] = { id: wid, spec: d.items.getItem(wid), count: 1, best: null };
    d.loadout.select(0);
    d.loadout.sync();
    for (let i = 0; i < 20; i++) d.viewmodel.update(1 / 60, d.camera, d.ctx.player);
    document.getElementById('hints').classList.add('hide');
    d.ctx.player.enabled = false;
    d.camera.position.set(0, 1.62, 0);
    d.camera.lookAt(0, 1.62, -10);
    d.camera.updateMatrixWorld();
  }, id);
  await waitFrame(base);
  await page.screenshot({ path: `${OUT}/R56_game_${id}.jpg`, type: 'jpeg', quality: 88 });
  console.log('снимок:', id);
}

// предмет в руках (рыба) — тоже парит перед камерой
const base2 = await page.evaluate(() => window.__frames || 0);
await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'shortsword', spec: d.items.getItem('shortsword'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
  d.holdFish(0, { grip: 'two', pose: 'present' });
  document.getElementById('hints').classList.add('hide');
  for (let i = 0; i < 20; i++) d.viewmodel.update(1 / 60, d.camera, d.ctx.player);
});
await waitFrame(base2);
await page.screenshot({ path: `${OUT}/R56_game_fish.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: fish');

await browser.close();
console.log('готово');
