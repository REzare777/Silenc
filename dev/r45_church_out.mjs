/**
 * Раунд 45: кадры храма снаружи (фасад с юга и с севера).
 * Запуск: cd dev && node r45_church_out.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R45OUT';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => { errs.push('PAGEERROR ' + e.message); console.log('PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:4205/?tod=day&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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
  await page.waitForTimeout(500);
};

// храм стоит в (3, 44)
const C = { x: 3, z: 44 };
// фасад с юга (перед храмом)
await look(C.x, 3.2, C.z - 30, C.x, 6.5, C.z);
await grab('front');
await look(C.x + 20, 11.0, C.z - 22, C.x, 7.0, C.z);
await grab('front_side');
// колокольня с севера (задняя сторона)
await look(C.x + 1, 5.0, C.z + 30, C.x, 9.0, C.z + 13);
await grab('back');
await look(C.x + 22, 10.0, C.z + 26, C.x, 9.0, C.z + 13);
await grab('back_side');
// сверху
await look(C.x + 2, 34, C.z + 6, C.x, 0, C.z + 12);
await grab('top');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
