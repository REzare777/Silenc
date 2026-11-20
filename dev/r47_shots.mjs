/**
 * Раунд 47: кадры нового амбара у поля и лесной делянки на опушке.
 * Запуск: cd dev && node r47_shots.mjs
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
  fs.writeFileSync(`${OUT}/R47_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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

// амбар у поля: от храма
await look(6, 6, 26, -11, 2, 38);
await grab('barn_new');
// амбар с востока
await look(3, 7, 33, -11, 2.5, 39);
await grab('barn_front');
// амбар и поле вместе
await look(-6, 9, 30, -24, 2, 44);
await grab('barn_field');
// общий вид севера
await look(-30, 26, 20, -6, 2, 42);
await grab('north_village');

// лесная делянка
await look(-37, 4.5, 6, -45, 1.5, 13);
await grab('woods');
await look(-52, 6, 4, -45, 1.5, 13);
await grab('woods_side');
await look(-40, 2.4, 7.5, -45.5, 1.2, 13);
await grab('woods_close');

await browser.close();
