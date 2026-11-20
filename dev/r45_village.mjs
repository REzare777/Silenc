/**
 * Раунд 45: кадры деревни — дороги, поля за озером, пастбище, курятник,
 * доска для записки и новые животные.
 *
 * Запуск: cd dev && node r45_village.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R45V';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => { errs.push('PAGEERROR ' + e.message); console.log('PAGEERROR', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:4205/?tod=day&v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
// дневной свет — иначе кадры выходят сумеречными
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1500);

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
  await page.waitForTimeout(600);
};

/* --- 1. улица: дороги и поднятые дома --- */
await look(0, 3.4, -16, 0, 3.0, 12);
await grab('street');

/* --- 2. площадь и трактир --- */
await look(4, 4.0, -4, -14, 3.0, -12);
await grab('tavern');

/* --- 3. поля за озером и стоги сена --- */
await look(64, 9.0, 4, 88, 1.0, -12);
await grab('fields');
await look(78, 3.2, -6, 88, 1.5, -20);
await grab('haystacks');

/* --- 4. пастбище с овцами --- */
await look(-38, 4.0, 24, -46, 0.8, 31);
await grab('pasture');
await look(-41.5, 1.6, 28.5, -45, 0.7, 30);
await grab('sheep_close');
// баран — второй: у него рога
await look(-44.4, 1.5, 31.6, -47, 0.7, 33);
await grab('ram_close');

/* --- 5. курятник --- */
await look(-9, 3.0, 22, -16.5, 0.8, 21.5);
await grab('henyard');

/* --- 6. доска для записки у дороги к скале --- */
await look(-20.6, 2.4, -26.8, -23.8, 1.4, -29.2);
await grab('board');

/* --- 7. кот на крыльце --- */
await look(-21, 2.4, 24, -23.3, 0.8, 26.8);
await grab('cat');

/* --- 8. пёс у трактира --- */
await look(-4, 2.4, -2, -8, 0.7, -5);
await grab('dog');

/* --- 9. общий вид с высоты --- */
await look(-10, 46, -40, 10, 0, 10);
await grab('aerial');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
