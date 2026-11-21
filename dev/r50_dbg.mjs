import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
const list = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  const out = [];
  ctx.scene.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.transparent || !o.material.vertexColors) return;
    const col = o.geometry.attributes.color;
    let minA = 1, maxA = 0;
    for (let i = 0; i < col.count; i++) {
      const a = col.array[i * col.itemSize + 3];
      minA = Math.min(minA, a); maxA = Math.max(maxA, a);
    }
    out.push({ verts: o.geometry.attributes.position.count, minA: +minA.toFixed(2), maxA: +maxA.toFixed(2),
      offset: !!o.material.polygonOffset, ro: o.renderOrder });
  });
  return out;
});
console.log(JSON.stringify(list, null, 0).replace(/},/g, '},\n'));
await browser.close();
