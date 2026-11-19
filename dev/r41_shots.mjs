/**
 * ============================================================================
 *  Раунд 41 — контрольные кадры: двери домов, костёр, звонарная
 * ============================================================================
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 140)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(600);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

const cam = (px, py, pz, lx, ly, lz) => page.evaluate(({ px, py, pz, lx, ly, lz }) => {
  const d = window.__dbg;
  d.player.enabled = false;          // иначе камеру перезаписывает игрок
  d.camera.fov = 55; d.camera.updateProjectionMatrix();
  d.camera.position.set(px, py, pz);
  d.camera.lookAt(lx, ly, lz); d.camera.updateMatrixWorld();
}, { px, py, pz, lx, ly, lz });

const toVillage = async () => {
  await page.evaluate(() => window.__dbg.ctx.systems.locations.setLocation('village'));
  await page.waitForTimeout(1000);
};

/* ---- 1. передняя дверь дома снаружи ---- */
const home = await page.evaluate(() => {
  const h = window.__dbg.ctx.homes[0];
  return h ? { x: h.x, z: h.z, ry: h.ry, w: h.w, d: h.d } : null;
});
console.log('дом 0:', JSON.stringify(home));
if (home) {
  const nx = -Math.sin(home.ry), nz = -Math.cos(home.ry);   // нормаль фасада
  // крупный план: за фасадом (d/2) + 2 м по нормали
  const out = home.d / 2 + 2.0;
  await cam(home.x + nx * out, 1.55, home.z + nz * out,
    home.x + nx * (home.d / 2 + 0.2), 1.2, home.z + nz * (home.d / 2 + 0.2));
  await page.waitForTimeout(1400);
  await grab('R41_house_front_door');
  // общий план фасада
  const out2 = home.d / 2 + 5.0;
  await cam(home.x + nx * out2, 2.3, home.z + nz * out2,
    home.x + nx * (home.d / 2 + 0.2), 1.5, home.z + nz * (home.d / 2 + 0.2));
  await page.waitForTimeout(1200);
  await grab('R41_house_front_door_wide');
}

/* ---- 2. дверь дома изнутри ---- */
await page.evaluate(() => window.__dbg.ctx.systems.locations.setLocation('home0'));
await page.waitForTimeout(1400);
await cam(1.7, 1.6, 1.0, 1.7, 1.15, -2.6);
await page.waitForTimeout(1400);
await grab('R41_house_inner_door');

/* ---- 3. костёр на площади ---- */
await toVillage();
await cam(-1.5, 2.2, -8.0, -6.5, 1.0, -3.5);
await page.waitForTimeout(1400);
await grab('R41_campfire');

/* ---- 4. лестница звонарной ---- */
await page.evaluate(() => window.__dbg.ctx.systems.locations.setLocation('church'));
await page.waitForTimeout(1600);
await cam(-1.6, 2.0, 15.0, -2.3, 2.6, 11.4);
await page.waitForTimeout(1400);
await grab('R41_belfry_stairs');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
