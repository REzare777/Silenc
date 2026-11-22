/** Кадры новой кисти: кулак на рукояти, открытая ладонь, все виды оружия. */
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
 * Дождаться кадра ПОСЛЕ правки: SwiftShader рисует кадр раз в 10–60 с,
 * поэтому ждём увеличения счётчика кадров.
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
    // «прокручиваем» сжатие пальцев и появление модели
    for (let i = 0; i < 45; i++) d.viewmodel.update(1 / 60, d.camera, d.ctx.player);
    document.getElementById('hints').classList.add('hide');
    d.ctx.player.enabled = false;
    d.camera.position.set(0, 1.62, 0);
    d.camera.lookAt(0, 1.62, -10);
    d.camera.updateMatrixWorld();
  }, id);
  await waitFrame(base);
  await page.screenshot({ path: `${OUT}/R55_hand_${id}.jpg`, type: 'jpeg', quality: 88 });
  console.log('снимок:', id);
}

// открытая ладонь с рыбой (предмет «в руках»)
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
  for (let i = 0; i < 45; i++) d.viewmodel.update(1 / 60, d.camera, d.ctx.player);
});
console.log('диагностика рыбы:', JSON.stringify(await page.evaluate(() => {
  const d = window.__dbg;
  const vm = d.viewmodel;
  return {
    visible: vm.visible,
    fade: +vm._fade.toFixed(2),
    item: vm.itemName,
    itemVis: vm.item ? vm.item.visible : null,
    itemPos: vm.item
      ? vm.item.getWorldPosition(new d.THREE.Vector3()).toArray().map((v) => +v.toFixed(3))
      : null,
    weapon: !!vm.weapon,
    rightVis: vm.hands.right.visible,
    leftVis: vm.hands.left.visible,
    pose: vm.pose,
    grip: vm.grip,
  };
})));
await waitFrame(base2);
await page.screenshot({ path: `${OUT}/R55_hand_fish.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: fish');

await browser.close();
console.log('готово');
