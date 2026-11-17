/**
 * Финальные кадры раунда 29: опушка леса, ступеньки, дороги + замер сцены.
 * Запуск: cd dev && node r29_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R29';
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
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1500);

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

// опушка леса с поляны
await shot('edge', [0, 1.7, 26], [0, 8.0, 60]);
// ступеньки дома (крыльцо на каменном цоколе)
await shot('porch', [-5.3, 1.5, 2.9], [-11, 1.1, 8]);
// дороги у площади
await shot('roads', [12, 3.0, 16], [0, 0.3, 0]);
// подлесок и тропа в лесу
await shot('undergrowth', [-34, 1.6, -26], [-46, 3.0, -38]);

// замер сцены
const stat = await page.evaluate(() => {
  const d = window.__dbg;
  let inst = 0, instCount = 0, meshes = 0;
  d.scene.traverse((o) => {
    if (o.isInstancedMesh) { inst++; instCount += o.count; }
    else if (o.isMesh) meshes++;
  });
  return {
    meshes, instancedMeshes: inst, instances: instCount,
    triangles: d.renderer.info.render.triangles,
    calls: d.renderer.info.render.calls,
  };
});
console.log('сцена:', JSON.stringify(stat));
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
