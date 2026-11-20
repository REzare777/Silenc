/**
 * Раунд 43: кадры деревни — костёр «за город» без светлой подстилки.
 * Запуск: cd dev && node r43_village.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R43V';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

const fire = await page.evaluate(() => window.__dbg.ctx.campfirePos);
console.log('костёр:', JSON.stringify(fire));

// костёр с разных сторон
await shot('fire_a', [fire.x - 7, 2.4, fire.z - 6], [fire.x, 0.6, fire.z]);
await shot('fire_b', [fire.x + 6, 1.9, fire.z + 5], [fire.x, 0.5, fire.z]);
// вид сверху: проверяем, что подстилки нет
await shot('fire_top', [fire.x, 26, fire.z + 0.01], [fire.x, 0, fire.z + 0.02]);
// общий план: костёр и пруд в одном кадре
await shot('fire_pond', [fire.x - 2, 8, fire.z + 14], [fire.x + 6, 0, fire.z - 12]);
// тропа от города к костру
await shot('trail', [50, 2.6, -29], [44, 0.6, -32]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
