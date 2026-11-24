/**
 * Раунд 61 — съёмка зверинца: каждая порода крупным планом и босс.
 *
 * Запуск: cd /workspace/village && node dev/r61_monster_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

// в подземелье
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
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 120000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

const types = [
  'goblin_sword', 'goblin_bow', 'goblin_guard', 'ghost',
  'spider', 'slime_green', 'slime_blue', 'slime_red',
  'shroom', 'snake', 'golem_small', 'orc_boss',
];

for (const type of types) {
  const info = await page.evaluate((t) => {
    const d = window.__dbg;
    const m = d.monsters.list.find((s) => s.spec.id === t);
    if (!m) return null;
    // остальных зверьков убираем в дальний угол, чтобы порода была видна
    d.monsters.list.forEach((o) => {
      if (o === m) return;
      o.x = -13.5; o.z = -32.5; o.y = 0;
      o.group.position.set(o.x, o.y, o.z);
      o.group.visible = false;
    });
    // ставим монстра в удобное место и включаем «свет»: он и так в пещере
    m.group.visible = true;
    m.x = 0; m.z = -26; m.y = 0;
    m.group.position.set(0, 0, -26);
    m.state = 'idle';
    m.stateT = 0;
    m.group.rotation.y = 0;      // повернуть мордой к камере
    m.dir = 0;
    d.player.enabled = false;
    const dist = t === 'orc_boss' ? 5.2 : t === 'ghost' ? 4.0 : 2.6;
    const h = t === 'orc_boss' ? 2.6 : t === 'ghost' ? 2.2 : 1.2;
    d.camera.position.set(0, h, -26 + dist);
    d.camera.lookAt(0, h * 0.55, -26);
    d.camera.updateMatrixWorld();
    // немного света, чтобы зверь был виден
    if (!d.__lamp) {
      const l = new d.THREE.PointLight(0xffd9a0, 40, 26, 1.6);
      l.position.set(0, 3.4, -23);
      d.scene.add(l);
      d.__lamp = l;
    }
    d.__lamp.position.set(0, 3.4, -23);
    d.__lamp.intensity = 40;
    return { x: m.x, z: m.z };
  }, type);
  if (!info) { console.log('нет породы:', type); continue; }
  await page.waitForTimeout(700);
  await grab(`R61_mon_${type}`);
}

console.log('ошибки:', errs.length, errs.slice(0, 4));
await browser.close();
