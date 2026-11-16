/**
 * Кадры подземелья и входа в него.
 * Запуск: cd dev && node dungeon_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'D2';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// --- вход в подземелье в деревне ---
const gate = await page.evaluate(() => window.__dbg.ctx.doors.dungeon);
const face = await page.evaluate(() => {
  const d = window.__dbg, g = d.ctx.doors.dungeon;
  return { x: -Math.sin(g.ry), z: -Math.cos(g.ry) };
});
await page.evaluate(() => window.__dbg.setLocation('village'));
await page.waitForTimeout(600);
// подножие лестницы — точка, куда игрока ставит выход из подземелья
const foot = await page.evaluate(() => {
  const d = window.__dbg, g = d.ctx.doors.dungeon;
  return { x: g.x, z: g.z, ry: g.ry };
});
await shot('gate_foot', [foot.x + face.x * 7, 2.0, foot.z + face.z * 7], [foot.x - face.x * 4, 1.6, foot.z - face.z * 4]);
await shot('gate_stairs', [foot.x + face.x * 5.2, 1.8, foot.z + face.z * 5.2 - 2.4], [foot.x - face.x * 2, 1.4, foot.z - face.z * 2]);
// дорога от деревни
await shot('trail_far', [-24, 2.6, -16], [-50, 1.5, -38]);
await shot('trail_mid', [-38, 2.4, -34], [-60, 1.6, -50]);

// --- пещера ---
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(800);
await shot('cave_entry', [0, 1.7, -25], [0, 1.5, -6]);          // входной зал, вид на проёмы
await shot('cave_portal', [0, 1.9, -29], [0, 2.2, -34]);       // портал наружу
await shot('cave_hall', [0, 1.7, -14], [0, 1.7, 4]);           // кристальный зал
await shot('cave_shaft', [0, 1.7, 1.5], [0, -1.5, 10]);        // шахта и лестница вниз
await shot('cave_deep', [0, -2.9, 18], [0, -3.2, 30]);         // зал Врат
await shot('cave_crystals', [7.5, 1.6, -3], [-9, 2.6, 2]);      // кристаллы у колонн
await shot('cave_gate', [0, -3.1, 22], [0, -2.4, 31.5]);       // алтарь Врат
await shot('cave_pillar', [-8, 1.7, -6], [4, 1.8, -2]);        // колоннада

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
