/**
 * Кадры подземелья и входа в него.
 * Запуск: cd dev && node dungeon_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import fs from 'fs';

const TAG = process.argv[2] || 'D1';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
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
// направление «лицом» скалы (наружу, к деревне)
const face = await page.evaluate(() => {
  const d = window.__dbg, g = d.ctx.doors.dungeon;
  return { x: -Math.sin(g.ry), z: -Math.cos(g.ry) };
});
await page.evaluate(() => window.__dbg.setLocation('village'));
await page.waitForTimeout(600);
await shot('gate_far', [gate.x + face.x * 16, 3.0, gate.z + face.z * 16], [gate.x, 2.2, gate.z]);
await shot('gate_near', [gate.x + face.x * 6.5, 1.8, gate.z + face.z * 6.5], [gate.x, 1.7, gate.z]);
await shot('gate_side', [gate.x + face.x * 8 - face.z * 8, 2.2, gate.z + face.z * 8 + face.x * 8], [gate.x, 2.0, gate.z]);

// --- пещера ---
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(800);
await shot('cave_portal', [0, 1.7, -14.5], [0, 1.5, 4]);
await shot('cave_hall', [0, 1.7, -4], [0, 1.7, 12]);
await shot('cave_gate', [0, 1.9, 8], [0, 3.2, 14.5]);
await shot('cave_crystals', [5.5, 1.6, -3], [-8, 2.6, 4]);
await shot('cave_pillar', [-4.5, 1.7, 5], [7, 1.8, 1]);
await shot('cave_low', [0, 0.55, 3], [0, 0.6, 13]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
