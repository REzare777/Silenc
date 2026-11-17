/**
 * Кадры раунда 31: дома с интерьером + мельница с твёрдой жёлтой крышей.
 * Запуск: cd dev && node r31_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R31';
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
await page.waitForTimeout(1200);

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

// координаты перед фасадом дома (-11, 8)
const home = await page.evaluate(() => {
  const ryToFace = (fx, fz, tx, tz) => {
    const l = Math.hypot(tx - fx, tz - fz) || 1;
    return Math.atan2(-(tx - fx) / l, -(tz - fz) / l);
  };
  const ry = ryToFace(-11, 8, 0, 0);
  const dist = 5 / 2 + 3.4;
  return { x: -11 + Math.sin(ry) * dist, z: 8 + Math.cos(ry) * dist, ry };
});
console.log('точка перед фасадом:', home.x.toFixed(1), home.z.toFixed(1));

// дом: фасад с крыльцом и открытой дверью
await shot('house_door', [home.x, 1.9, home.z], [-11, 1.5, 8]);
// дом: общий план интерьера (из угла, сверху)
await shot('house_room', [-12.6, 2.5, 6.0], [-9.6, 0.6, 9.0]);
// дом: очаг и стол
await shot('house_hearth', [-9.6, 1.7, 9.4], [-12.4, 1.0, 6.8]);

// мельница: снаружи, на смотровой площадке, на жёлтой крыше
await shot('mill_out', [44, 3.0, -22], [34, 7.0, -33]);
await shot('mill_roof', [34.5, 13.4, -30.5], [34, 16.5, -33]);
await shot('mill_top', [34, 16.8, -33], [34, 11.6, -33]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
