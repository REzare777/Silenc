/**
 * Раунд 63 — съёмка: окна трактира снаружи и внутри, широкая дверь храма.
 *
 * Запуск: cd /workspace/village && node dev/r63_shots.mjs
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

/* ---------- 1. фасад трактира: окна снаружи ---------- */
const f = await page.evaluate(() => {
  const d = window.__dbg;
  const t = d.ctx.footprints.find((x) => x.name === 'таверна');
  const c = Math.cos(t.ry), s = Math.sin(t.ry);
  const world = (lx, lz) => [t.x + lx * c + lz * s, t.z - lx * s + lz * c];
  return {
    ry: t.ry,
    front: world(-4.0, -15.0),
    frontLook: world(-3.5, -9.0),
    mid: world(0, -15.5),
    midLook: world(0, -9.0),
    north: world(-1.15, 15.0),
    northLook: world(-1.15, 9.0),
    east: world(15.0, -3.6),
    eastLook: world(7.5, -3.6),
  };
});
await cam(f.front[0], 2.4, f.front[1], f.frontLook[0], 2.3, f.frontLook[1]);
await grab('R63_tavern_front');

await cam(f.mid[0], 3.2, f.mid[1], f.midLook[0], 3.0, f.midLook[1]);
await grab('R63_tavern_front_mid');

await cam(f.north[0], 3.0, f.north[1], f.northLook[0], 4.2, f.northLook[1]);
await grab('R63_tavern_north');

await cam(f.east[0], 3.0, f.east[1], f.eastLook[0], 4.4, f.eastLook[1]);
await grab('R63_tavern_east');

/* ---------- 2. интерьер трактира ---------- */
await page.evaluate(() => window.__dbg.setLocation('tavern'));
await page.waitForTimeout(2000);
await cam(0.0, 1.7, -3.0, -3.5, 1.85, -8.9);
await grab('R63_tavern_hall_windows');

await cam(1.6, 1.7, -3.6, 7.4, 4.4, -3.6);
await grab('R63_tavern_bar_window');

/* ---------- 3. храм: широкая дверь в башню ---------- */
await page.evaluate(() => window.__dbg.setLocation('church'));
await page.waitForTimeout(2000);
await cam(-0.8, 1.7, 6.2, -3.0, 1.5, 9.4);
await grab('R63_church_door_nave');

await page.evaluate(() => window.__dbg.setLocation('church', 'tower'));
await page.waitForTimeout(2000);
await cam(-0.8, 1.7, 12.2, -3.0, 1.5, 10.2);
await grab('R63_church_door_tower');

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
