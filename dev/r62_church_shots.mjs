/**
 * Раунд 62 — съёмка храма: фасад, неф, дверь в башню, настил с колоколом.
 *
 * Запуск: cd /workspace/village && node dev/r62_church_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/**
 * Снять кадр.
 *
 * @param {string} name имя файла
 */
async function grab(name) {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

/** Поставить камеру. */
async function cam(px, py, pz, tx, ty, tz) {
  await page.evaluate(([px, py, pz, tx, ty, tz]) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(px, py, pz);
    d.camera.lookAt(tx, ty, tz);
    d.camera.updateMatrixWorld();
  }, [px, py, pz, tx, ty, tz]);
  await page.waitForTimeout(2500);
}

/* ---------- 1. фасад: дверь и ступени ---------- */
// крыльцо снаружи (южный фасад храма)
const front = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.footprints.find((f) => f.name === 'храм');
  const ry = ch.ry;
  const lx = 0, lz = -14.5;
  const x = ch.x + lx * Math.cos(ry) + lz * Math.sin(ry);
  const z = ch.z - lx * Math.sin(ry) + lz * Math.cos(ry);
  return { x, z, ry, cx: ch.x, cz: ch.z };
});
await cam(front.x - 3.2, 2.6, front.z - 3.2, front.cx - 0.2, 2.6, front.cz + 2.0);
await grab('R62_church_front');

/* ---------- 2. неф: стены без колонн, образы видны ---------- */
await page.evaluate(() => window.__dbg.setLocation('church'));
await page.waitForTimeout(2000);
await cam(2.6, 1.68, -2.0, -4.1, 2.2, 1.5);
await grab('R62_nave_icons');

/* ---------- 3. дверь в башню ---------- */
await cam(-1.2, 1.7, 7.2, -3.0, 1.5, 9.4);
await grab('R62_tower_door');

/* ---------- 4. настил с колоколом ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('church', 'tower');
});
await page.waitForTimeout(2000);
await cam(-1.2, 11.9, 13.4, 0, 11.0, 17.0);
await grab('R62_bell_deck');

/* ---------- 5. колокол сбоку ---------- */
await cam(-3.4, 10.9, 18.2, 0, 11.5, 17.0);
await grab('R62_bell_side');

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
