/**
 * Раунд 54: кадры боя в подземелье — оружие в правой руке и факел в левой.
 *
 * Запуск: cd dev && node r54_dungeon_shots.mjs
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

await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

// в подземелье, с коротким мечом на поясе
await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  const inv = d.inventory;
  inv.slots.fill(null);
  inv.slots[27] = { id: 'shortsword', spec: d.items.getItem('shortsword'), count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/R54_dungeon_sword.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dungeon sword');

// удар оружием по тени
console.log('удар:', JSON.stringify(await page.evaluate(() => {
  const d = window.__dbg;
  const shadows = d.shadows;
  shadows.spawn();
  const list = shadows.list;
  const cam = d.camera;
  const dir = new d.THREE.Vector3();
  cam.getWorldDirection(dir);
  const org = new d.THREE.Vector3();
  cam.getWorldPosition(org);
  const s = list[0];
  s.x = org.x + dir.x * 1.3;
  s.z = org.z + dir.z * 1.3;
  const hpBefore = s.hp;
  const hit = d.combat.weaponStrike();
  return { hit, hpBefore, hpAfter: s.hp, weaponCd: d.combat.state.weaponCd };
})));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/R54_dungeon_hit.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: dungeon hit');

await browser.close();
console.log('готово');
