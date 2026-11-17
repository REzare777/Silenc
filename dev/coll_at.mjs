import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const b = await chromium.launch(LAUNCH);
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
p.setDefaultTimeout(120000);
await p.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__villageReady === true, null, { timeout: 120000 });
await p.evaluate(() => document.getElementById('begin').click());
await p.waitForTimeout(1000);
const r = await p.evaluate(() => {
  const d = window.__dbg;
  const pts = [[-35.1, -15.2], [-33.2, -15.0]];
  const out = {};
  for (const [x, z] of pts) {
    const hits = [];
    for (const o of (d.ctx.colliders.boxes || [])) {
      const c = Math.cos(o.ang || 0), s = Math.sin(o.ang || 0);
      const dx = x - o.cx, dz = z - o.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) <= o.hx + 0.3 && Math.abs(lz) <= o.hz + 0.3) {
        hits.push({ box: [+o.cx.toFixed(1), +o.cz.toFixed(1), +o.hx.toFixed(1), +o.hz.toFixed(1), +(o.ang || 0).toFixed(2)], y0: o.y0, y1: o.y1 });
      }
    }
    for (const o of (d.ctx.colliders.circles || [])) {
      if (Math.hypot(x - o.x, z - o.z) <= o.r + 0.3) hits.push({ circle: [+o.x.toFixed(1), +o.z.toFixed(1), o.r, o.y0, o.y1] });
    }
    out[`${x},${z}`] = hits;
  }
  return out;
});
console.log(JSON.stringify(r, null, 2));
await b.close();
