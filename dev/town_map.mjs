/**
 * ============================================================================
 *  Карта деревни сверху: видно дороги, площадь и расстановку домов
 * ============================================================================
 *
 *  Запуск: cd dev && node town_map.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(900);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1200);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// вид сверху на всю деревню
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = false;
  d.camera.fov = 52; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 78, 0.01);
  d.camera.lookAt(0, 0, 0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R34_town_map');

// вид сверху на южную половину (трактир, мельница, дальние дома)
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 46; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 62, -20.01);
  d.camera.lookAt(0, 0, -20); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R34_town_map_south');

// вид с улицы: дома вдоль главной дороги
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 4.5, -6);
  d.camera.lookAt(0, 2.5, 20); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R34_town_street');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
