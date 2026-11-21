/**
 * Раунд 49: вырубка вокруг амбара — пеньки, брёвна, поле без деревьев.
 * Запуск: cd dev && node r49_barn_shot.mjs
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
  fs.writeFileSync(`${OUT}/R49_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
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
// вид с дороги на амбар
await look(-16, 2.2, 60, -30, 2.5, 63);
await grab('barn_from_road');
// сверху: линия леса и прогалина
await look(-30, 40, 80, -30, 0, 58);
await grab('barn_top');
// с юга: пни и брёвна по кромке
await look(-30, 2.0, 80, -30, 1.5, 64);
await grab('barn_clearing');
// поле: деревья не должны расти в пшенице
await look(-30, 10, 34, -30, 1, 50);
await grab('field');
await browser.close();
