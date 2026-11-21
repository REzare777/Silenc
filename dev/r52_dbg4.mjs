import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(300000);
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 300000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`/workspace/village/shots/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
};
const shot = async (season, day) => {
  await page.evaluate(({ season, day }) => {
    const d = window.__dbg;
    d.ctx.calendar.restore(day, season, 1);
    for (let i = 0; i < 120; i++) { d.snow.updateCover(1/60); d.snow.update(1/60, {x:0,y:0,z:0}, true); }
    d.player.enabled = false;
    d.env.setTimeOfDay('day', true);
    // смотрим на опушку леса с запада — там дубы и берёзы
    d.camera.position.set(-30, 3.4, 40);
    d.camera.lookAt(-38, 6.0, 62);
    d.camera.updateMatrixWorld();
  }, { season, day });
  await page.waitForTimeout(1400);
  await grab(`R52_trees_${season}`);
};
await shot('summer', 7);
await shot('autumn', 12);
await shot('winter', 17);
console.log('готово');
await browser.close();
