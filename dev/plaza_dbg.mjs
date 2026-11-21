import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
const info = await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = false;
  d.camera.position.set(0, 30, 0.01);
  d.camera.lookAt(0, 0, 0);
  d.camera.updateMatrixWorld();
  const out = [];
  d.scene.traverse((o) => {
    if (o.isMesh && o.geometry.attributes.position.count === 245) {
      o.material.color.set(0xff0000);
      out.push({ map: !!o.material.map, name: o.material.map && o.material.map.image && o.material.map.image.width,
        transparent: o.material.transparent, opacity: o.material.opacity, visible: o.visible, ro: o.renderOrder });
    }
  });
  return out;
});
console.log(JSON.stringify(info));
await page.waitForTimeout(400);
await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
const fs = await import('fs');
fs.writeFileSync('/workspace/village/shots/R50_plaza_red.jpg', Buffer.from(frame.split(',')[1], 'base64'));
await browser.close();
