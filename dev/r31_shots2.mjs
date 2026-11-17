import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 150)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1200);
const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg; d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]); d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R31_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
const home = await page.evaluate(() => {
  const ryToFace = (fx, fz, tx, tz) => { const l = Math.hypot(tx - fx, tz - fz) || 1; return Math.atan2(-(tx - fx) / l, -(tz - fz) / l); };
  const ry = ryToFace(-11, 8, 0, 0); const dist = 5 / 2 + 3.6;
  return { x: -11 + Math.sin(ry) * dist, z: 8 + Math.cos(ry) * dist };
});
await shot('house_door', [home.x, 1.8, home.z], [-11, 1.4, 8]);
await shot('mill_roof', [36.5, 13.2, -30.0], [34, 15.2, -33]);
await shot('mill_top', [34, 16.6, -30.5], [34, 11.0, -33]);
await browser.close();
