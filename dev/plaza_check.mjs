import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__dbg.env.setTimeOfDay('day', true); });
const info = await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = false;
  d.camera.position.set(0, 34, 0.01);
  d.camera.lookAt(0, 0, 0);
  d.camera.updateMatrixWorld();
  const list = [];
  d.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.transparent && o.material.vertexColors) {
      const g = o.geometry;
      const pos = g.attributes.position;
      let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
      for (let i = 0; i < pos.count; i++) {
        minx = Math.min(minx, pos.getX(i)); maxx = Math.max(maxx, pos.getX(i));
        minz = Math.min(minz, pos.getZ(i)); maxz = Math.max(maxz, pos.getZ(i));
      }
      list.push({ verts: pos.count, box: [minx.toFixed(1), maxx.toFixed(1), minz.toFixed(1), maxz.toFixed(1)], ro: o.renderOrder, y: o.position.y });
    }
  });
  return list;
});
console.log('прозрачные полотна:', info.length);
for (const i of info.slice(0, 8)) console.log(' ', JSON.stringify(i));
await page.waitForTimeout(400);
await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
const fs = await import('fs');
fs.writeFileSync('/workspace/village/shots/R50_plaza_down.jpg', Buffer.from(frame.split(',')[1], 'base64'));
console.log('снимок сделан');
await browser.close();
