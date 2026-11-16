/**
 * Финальные кадры раунда 28: вход в пещеру и подземелье.
 * Запуск: cd dev && node dungeon_final_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'FIN';
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
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// вход снаружи
const foot = await page.evaluate(() => {
  const g = window.__dbg.ctx.doors.dungeon;
  return { x: g.x, z: g.z, ry: g.ry, fx: -Math.sin(g.ry), fz: -Math.cos(g.ry) };
});
await shot('gate', [foot.x + foot.fx * 7, 2.0, foot.z + foot.fz * 7],
  [foot.x - foot.fx * 4, 1.6, foot.z - foot.fz * 4]);

// подземелье
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(900);
await shot('entry', [0, 1.7, -25], [0, 1.5, -6]);
await shot('shaft', [0, 1.7, -1], [0, -2.2, 10]);
await shot('gate_hall', [0, -2.9, 16], [0, -2.6, 30]);
await shot('altar', [0, -2.6, 24], [0, -2.2, 31.5]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
