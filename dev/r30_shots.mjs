/**
 * Кадры раунда 30: церковь, амбар, трактир, мельница + переставленный домик.
 * Запуск: cd dev && node r30_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R30';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1500);

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// мельница: снаружи, сверху, изнутри башни
await shot('mill_out', [46, 3.0, -22], [34, 6.0, -33]);
await shot('mill_top', [40, 14.0, -29], [34, 11.6, -33]);
await shot('mill_in', [34, 1.7, -31.4], [34, 11.0, -33]);
// церковь: фасад с крыльцом и сбоку
await shot('church_front', [3, 2.4, 26], [3, 3.0, 36]);
await shot('church_side', [16, 2.4, 50], [3, 3.0, 44]);
// амбар
await shot('barn_out', [-29, 2.4, 2], [-40, 2.6, -8]);
// трактир: фасад и вид «за трактиром» (где раньше стоял домик)
await shot('tavern_front', [-1.5, 3.0, 1.5], [-9.5, 2.6, -7.2]);
await shot('house_moved', [0, 3.0, 2], [-30, 2.0, -21]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
