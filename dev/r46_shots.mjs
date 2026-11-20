/**
 * Раунд 46: кадры — храм (закрытые двери, открытый проход в башню),
 * новая планировка западной части деревни и пёс у дома с табличкой.
 * Запуск: cd dev && node r46_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R46';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => { errs.push('PAGEERROR ' + e.message); console.log('PAGEERROR', e.message); });
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
  await page.waitForTimeout(400);
};

/* ---------- 1. храм снаружи: закрытый портал ---------- */
const C = { x: 3, z: 44 };
await look(C.x, 3.0, C.z - 17, C.x, 4.0, C.z);
await grab('ch_portal');
await look(C.x + 9, 5.5, C.z - 15, C.x - 1, 4.0, C.z);
await grab('ch_portal_side');

/* ---------- 2. храм внутри: неф, портал изнутри, проход в башню ---------- */
await page.evaluate(() => window.__dbg.setLocation('church'));
await page.waitForTimeout(1200);
await look(0, 2.2, -3.2, 0, 2.0, -6.0);
await grab('ch_nave_portal');
await look(0, 2.4, 2.0, -3.9, 1.6, 9.8);
await grab('ch_nave_passage');
await look(-1.0, 2.6, 11.2, 0, 6.0, 15.0);
await grab('ch_tower_base');

/* ---------- 3. планировка: амбар у леса, дом на месте амбара ---------- */
await page.evaluate(() => window.__dbg.setLocation('village'));
await page.waitForTimeout(1200);
await look(-30, 9, 24, -44, 2, 13);
await grab('vil_barn');
await look(-27, 6, 6, -40, 2, -8);
await grab('vil_house');
await look(-46, 16, 8, -30, 1, 24);
await grab('vil_emptyspot');
await look(-30, 30, -52, -12, 0, -28);
await grab('vil_west_aerial');

/* ---------- 4. пёс у дома с табличкой ---------- */
await look(-21, 2.2, -28.5, -17.5, 1.0, -31.5);
await grab('vil_dog');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
