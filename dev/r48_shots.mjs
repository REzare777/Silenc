/**
 * Раунд 48: кадры нового амбара за полем, дороги к нему и обзор дорог.
 * Запуск: cd dev && node r48_shots.mjs
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
await page.goto('http://127.0.0.1:4205/?tod=day&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R48_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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

// амбар в вырубке: от ворот
await look(-22, 4.5, 55, -30, 2, 63);
await grab('barn_yard');
// амбар и поле вместе — с юго-востока
await look(-12, 12, 44, -32, 2, 62);
await grab('barn_field');
// дорога к амбару: с развилки у колокольни
await look(3, 3.4, 65.5, -20, 1.5, 63);
await grab('road_to_barn');
// с дороги вдаль: амбар за полем
await look(-16, 2.2, 63, -30, 2, 63);
await grab('road_view');
// поле и калитка
await look(-24, 6, 38, -32, 1, 50);
await grab('field');
// обзор: вся северная часть деревни с амбаром
await look(6, 26, 24, -24, 2, 58);
await grab('north_all');
// северная сторона храма: как выглядит дорога, идущая мимо него
await look(-14, 11, 66, 2, 5, 52);
await grab('church_north');

await browser.close();
