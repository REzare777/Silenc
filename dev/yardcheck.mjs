import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
const r = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  let hut = null, yard = null, meshes = 0;
  ctx.scene.traverse((o) => {
    if (o.name === 'woodcuttersHut') { hut = { x: o.position.x, z: o.position.z, ry: o.rotation.y, children: o.children.length }; }
    if (o.name === 'woodcuttersYard') { yard = { x: o.position.x, z: o.position.z, ry: o.rotation.y, children: o.children.length }; }
  });
  return { hut, yard, fps: ctx.footprints.map((f) => f.name + ':' + f.x + ',' + f.z) };
});
console.log(JSON.stringify(r, null, 1));
console.log('ошибки:', errs);
await browser.close();
