/**
 * Раунд 42 — контрольные кадры: костёр «за город», храм, звонарная
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
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('golden', true));
await page.waitForTimeout(700);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
const cam = (px, py, pz, lx, ly, lz, fov = 55) => page.evaluate(({ px, py, pz, lx, ly, lz, fov }) => {
  const d = window.__dbg;
  d.player.enabled = false;
  d.camera.fov = fov; d.camera.updateProjectionMatrix();
  d.camera.position.set(px, py, pz);
  d.camera.lookAt(lx, ly, lz); d.camera.updateMatrixWorld();
}, { px, py, pz, lx, ly, lz, fov });

const fire = await page.evaluate(() => window.__dbg.ctx.campfirePos);
console.log('костёр:', JSON.stringify(fire));

/* ---- 1. кострище «за город» ---- */
await cam(fire.x - 7.5, 2.4, fire.z + 7.0, fire.x, 0.9, fire.z, 58);
await page.waitForTimeout(1500);
await grab('R42_campfire_glade');
await cam(fire.x + 3.0, 1.6, fire.z - 5.0, fire.x, 0.7, fire.z, 58);
await page.waitForTimeout(1400);
await grab('R42_campfire_close');

/* ---- 2. неф: дверь в звонарную в правом углу ---- */
await page.evaluate(() => window.__dbg.ctx.systems.locations.setLocation('church'));
await page.waitForTimeout(1700);
await cam(0, 1.7, -4.6, 0, 1.5, 9.6, 60);
await page.waitForTimeout(1400);
await grab('R42_nave');
await cam(-0.6, 1.7, 5.4, -3.5, 1.6, 9.6, 60);
await page.waitForTimeout(1400);
await grab('R42_nave_door');

/* ---- 3. звонарная (стала шире) ---- */
await cam(0.5, 2.2, 17.2, -2.0, 2.4, 13.0, 60);
await page.waitForTimeout(1400);
await grab('R42_belfry');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
