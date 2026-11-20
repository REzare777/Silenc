/**
 * Раунд 48: обзор дорог — смотрим каждую трассу глазами.
 * Запуск: cd dev && node r48_roads_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?tod=day&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R48R_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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

// развилка главной дороги: отход к амбару
await look(10, 8, 68, -8, 1.5, 64);
await grab('junction');
// главная улица вдоль, с севера (западнее храма)
await look(-6, 3.5, 26, -6, 3, 48);
await grab('main_road');
// дорога за озером к полям
await look(40, 8, 5, 62, 1, -14);
await grab('fields_road');
// дорога к кострищу
await look(20, 6, -3, 40, 1, -26);
await grab('campfire_road');
// дорога к мельнице
await look(12, 6, -14, 28, 4, -30);
await grab('mill_road');
// тропа к полю от пастбища
await look(-36, 5, 36, -31, 1, 46);
await grab('field_road');

await browser.close();
