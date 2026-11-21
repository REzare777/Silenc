/**
 * Раунд 50: дороги — мягкие ленты вместо прямоугольных кусков.
 * Запуск: cd dev && node r50_road_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => { window.__dbg.env.setTimeOfDay('day', true); });
await page.waitForTimeout(600);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R50_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
const look = async (px, py, pz, tx, ty, tz) => {
  await page.evaluate(({ px, py, pz, tx, ty, tz }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(px, py, pz);
    d.camera.lookAt(tx, ty, tz);
    d.camera.updateMatrixWorld();
  }, { px, py, pz, tx, ty, tz });
  await page.waitForTimeout(400);
};
// площадь и перекрёсток улиц
await look(-17, 9, 19, 0, 0.4, -1);
await grab('plaza');
await look(0, 26, 0, 0, 0, -12);
await grab('plaza_top');
// главная улица с высоты
await look(-16, 14, 24, 2, 0, -6);
await grab('main_street');
// поворот тропинки к дому
await look(-16, 2.6, 4, -8, 1.2, 12);
await grab('trail_bend');
// дорога к амбару: длинный изгиб
await look(-4, 6, 74, -26, 1, 62);
await grab('barn_road');
// дорога вдоль поля
await look(-46, 8, 40, -28, 1, 52);
await grab('field_road');
await browser.close();
