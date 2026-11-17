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
  const d = window.__dbg, pl = d.player;
  const ry = Math.atan2(-(0 - 3) / Math.hypot(3, 44), -(0 - 44) / Math.hypot(3, 44));
  const c = Math.cos(ry), s = Math.sin(ry);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const pts = [];
  for (let ci = 0; ci < 4; ci++) {
    const [ax, az] = corners[ci], [b2, b2z] = corners[(ci + 1) % 4];
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const lx = (ax + (b2 - ax) * t) * (4.5 + 1.8);
      const lz = (az + (b2z - az) * t) * (8.5 + 1.8);
      pts.push([3 + lx * c + lz * s, 44 - lx * s + lz * c]);
    }
  }
  pl.teleport(pts[0][0], pts[0][1], 0); pl.y = 0; pl.groundY = 0; pl.vy = 0;
  const log = [];
  const [tx, tz] = pts[1];
  const yaw = Math.atan2(-(tx - pl.pos.x), -(tz - pl.pos.z));
  pl.yaw = yaw;
  pl.keys.add('KeyW');
  for (let k = 0; k < 140; k++) {
    pl.update(1 / 60);
    if (k % 20 === 0) log.push([k, +pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2), +pl.groundY.toFixed(2)]);
  }
  pl.keys.clear();
  return {
    start: [+pts[0][0].toFixed(2), +pts[0][1].toFixed(2)],
    target: [+tx.toFixed(2), +tz.toFixed(2)],
    yaw: +yaw.toFixed(3), log,
    end: [+pl.pos.x.toFixed(2), +pl.pos.z.toFixed(2)],
    left: +Math.hypot(pl.pos.x - tx, pl.pos.z - tz).toFixed(2),
  };
});
console.log(JSON.stringify(r, null, 2));
await b.close();
