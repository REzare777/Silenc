/**
 * Раунд 46: дополнительные кадры — портал изнутри нефа, проход с открытой
 * дверью в башню, доска с запиской у дома пса.
 * Запуск: cd dev && node r46_shots2.mjs
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
  fs.writeFileSync(`${OUT}/R46_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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

// храм снаружи, портал целиком
const C = { x: 3, z: 44 };
await look(C.x, 3.4, C.z - 24, C.x, 4.0, C.z);
await grab('ch2_portal');

// неф: портал изнутри издалека
await page.evaluate(() => window.__dbg.setLocation('church'));
await page.waitForTimeout(1000);
await look(0, 2.8, 1.5, 0, 2.0, -6.0);
await grab('ch2_nave_portal');
// неф: проход в башню с открытой дверью
await look(-1.2, 2.2, 7.0, -3.9, 1.6, 9.8);
await grab('ch2_passage');
// из башни обратно в неф
await look(-3.6, 2.4, 11.6, -3.9, 1.6, 8.0);
await grab('ch2_passage_back');

// доска и пёс
await page.evaluate(() => window.__dbg.setLocation('village'));
await page.waitForTimeout(1000);
await look(-20.5, 2.4, -27.0, -24.5, 1.2, -29.5);
await grab('ch2_board');

await browser.close();
