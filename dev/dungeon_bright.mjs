/** Отладочный кадр: временно яркий свет, чтобы разглядеть геометрию. */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(900);

await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  const L = d.dungeonLoc;
  L.lights.ambient.intensity = 12;
  L.lights.hemi.intensity = 8;
  d.sceneDungeon.fog = null;
});
await page.waitForTimeout(1200);

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`/workspace/village/shots/BR_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

await shot('entry', [0, 1.7, -25], [0, 1.5, -6]);
await shot('hall', [0, 1.7, -14], [0, 1.7, 4]);
await shot('up', [0, 1.7, -22], [0, 8, -20]);
await browser.close();
