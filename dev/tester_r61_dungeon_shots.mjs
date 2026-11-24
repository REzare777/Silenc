/**
 * ============================================================================
 *  Раунд 61 — тест-агент: снимки подземелья (босс, полоса, мешок, звери)
 * ============================================================================
 *
 *  Снимки делаются через page.screenshot, чтобы был виден и интерфейс
 *  (в частности — полоска здоровья босса).
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_dungeon_shots.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.player.pos.set(-9, 0, -17);
  d.player.groundY = 0;
  d.player.y = 0;
  d.setLocation('dungeon');
});
await page.waitForTimeout(1500);

/**
 * Снять кадр.
 *
 * @param {string} name имя файла
 */
async function grab(name) {
  const before = await page.evaluate(() => window.__frames || 0);
  await page.waitForFunction((b) => (window.__frames || 0) > b + 1, before, { timeout: 300000 });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
  const size = fs.statSync(`${OUT}/${name}.jpg`).size;
  console.log(`снимок ${name}.jpg (${Math.round(size / 1024)} КБ)`);
}

/**
 * Поставить камеру.
 *
 * @param {number[]} pos позиция
 * @param {number[]} look куда смотреть
 */
async function cam(pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
}

/* --- 1. босс и его полоска --- */
await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  if (!b) return;
  b.hp = Math.round(b.maxHp * 0.62);
  b.state = 'stalk';
  d.player.pos.set(b.x, b.y, b.z + 9);
  d.player.groundY = b.y;
  d.player.y = 0;
  // немного света, чтобы орка было видно
  if (!d.__lamp) {
    const l = new d.THREE.PointLight(0xffd9a0, 45, 30, 1.5);
    d.scene.add(l);
    d.__lamp = l;
  }
  d.__lamp.position.set(b.x, b.y + 4, b.z + 5);
  d.__lamp.intensity = 45;
});
await cam([0, -2.0, 24], [0, -3.2, 30]);
await page.waitForTimeout(800);
await grab('TEST61_boss_bar');

await cam([0, -1.6, 25.5], [0, -3.4, 30]);
await page.waitForTimeout(800);
await grab('TEST61_boss_close');

/* --- 2. ударная волна (slam) --- */
const slam = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  if (!b) return { err: 'нет босса' };
  const realRandom = Math.random;
  Math.random = () => 0.4;                 // «slam»
  d.player.pos.set(b.x + 2, b.y, b.z);
  d.player.groundY = b.y;
  for (let i = 0; i < 40; i++) {
    Math.random = () => 0.4;
    b.hp = b.maxHp; b.stun = 0; b.cd = 0;
    if (b.state !== 'windup' && b.state !== 'attack') b.state = 'stalk';
    d.monsters.update(1 / 30, 100 + i / 30);
    if (b.shocks && b.shocks.length) break;
  }
  Math.random = realRandom;
  return { shocks: b.shocks ? b.shocks.length : 0, attack: b.attackName };
});
console.log('ударная волна босса:', JSON.stringify(slam));
await cam([0, -2.6, 25], [0, -4.4, 30]);
await page.waitForTimeout(700);
await grab('TEST61_boss_shock');

/* --- 3. мешок с добычей --- */
await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const t = m.list.find((s) => s.spec.id === 'goblin_sword' && s.hp > 0);
  if (!t) return;
  const iso = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === t) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const org = new d.THREE.Vector3(t.x, t.y + 1.2, t.z + 2);
  m.hit(org, new d.THREE.Vector3(0, 0, -1), 3, 0.8, 999);
  const bag = m.bags[m.bags.length - 1];
  if (bag) {
    d.player.pos.set(bag.x, bag.y, bag.z + 1.4);
    d.player.groundY = bag.y; d.player.y = 0;
    d.__lamp.position.set(bag.x, bag.y + 2.4, bag.z + 1.6);
    d.__lamp.intensity = 35;
  }
  for (const s of iso) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.group.position.set(s.x, s.y, s.z); }
});
await page.waitForTimeout(700);
await grab('TEST61_loot_bag');

/* --- 4. портреты зверей: призрак, страж, голем, паук, слизень, гриб, змея --- */
const kinds = ['ghost', 'goblin_guard', 'golem_small', 'spider', 'slime_red', 'shroom', 'snake', 'goblin_bow'];
for (const kind of kinds) {
  const info = await page.evaluate((k) => {
    const d = window.__dbg;
    const m = d.monsters;
    const t = m.list.find((s) => s.spec.id === k);
    if (!t) return null;
    for (const o of m.list) {
      if (o === t) continue;
      o.x = -13.5; o.z = -33.5; o.y = 0; o.state = 'sleep';
      o.group.visible = false;
      o.group.position.set(o.x, o.y, o.z);
    }
    t.group.visible = true;
    t.x = 0; t.z = -26; t.y = 0;
    t.group.position.set(0, 0, -26);
    t.group.rotation.y = 0;            // мордой к камере (+Z)
    t.state = 'idle';
    t.stateT = 0;
    d.player.enabled = false;
    if (!d.__lamp2) {
      const l = new d.THREE.PointLight(0xffe0b0, 42, 24, 1.6);
      d.scene.add(l);
      d.__lamp2 = l;
    }
    d.__lamp2.position.set(0, 3.0, -22);
    d.__lamp2.intensity = 42;
    return { id: k };
  }, kind);
  if (!info) { console.log('нет породы:', kind); continue; }
  const h = kind === 'ghost' ? 2.0 : kind === 'goblin_guard' ? 1.4 : 1.0;
  await cam([0, h, -26 + 3.0], [0, h * 0.6, -26]);
  await page.waitForTimeout(700);
  await grab(`TEST61_mon_${kind}`);
}

console.log('ошибки:', errs.length, errs.slice(0, 4));
await browser.close();
