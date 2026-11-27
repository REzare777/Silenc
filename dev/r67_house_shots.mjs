/**
 * Раунд 67 — снимки дома игрока на новом месте (у опушки, справа от дороги).
 *
 * Запуск: cd /workspace/village && node dev/r67_house_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/** Снять кадр с заданной камеры. */
async function shot(name, pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

/* дом с дороги — крыльцо и ступени */
await shot('R67c_house_road', [-14.6, 2.0, -26.2], [-9.8, 1.4, -33.0]);
/* дом с опушки (сзади) */
await shot('R67c_house_back', [-4.0, 2.4, -40.0], [-9.6, 1.6, -33.4]);
/* общий план: дорога, дом и опушка */
await shot('R67c_area', [-30, 12, -46], [-9.5, 0, -32]);
/* вид с той точки, где стоял игрок на скриншоте */
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.teleport(-10.91, -31.12, (-323.8 * Math.PI) / 180);
  d.player.pitch = (-18.4 * Math.PI) / 180;
});
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
const f2 = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
fs.writeFileSync(`${OUT}/R67c_from_spot.jpg`, Buffer.from(f2.split(',')[1], 'base64'));
console.log('снимок: R67c_from_spot');

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
