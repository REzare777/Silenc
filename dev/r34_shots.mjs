import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 120)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(900);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1000);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// пара домов у улицы + двор между ними
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 55; d.camera.updateProjectionMatrix();
  d.camera.position.set(19, 7.5, 2);
  d.camera.lookAt(-8, 1.6, 15); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(800);
await grab('R34_houses_pair');
// южная окраина: трактир и дальние дома
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.position.set(4, 9, -14);
  d.camera.lookAt(-26, 1.5, -28); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(800);
await grab('R34_south_houses');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
