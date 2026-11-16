import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg, p = d.player;
  const MX = 34, MZ = -33, RY = 0.6, c = Math.cos(RY), s = Math.sin(RY);
  const toWorld = (lx, lz) => [MX + lx * c + lz * s, MZ - lx * s + lz * c];
  const toLocal = (wx, wz) => [(wx - MX) * c - (wz - MZ) * s, (wx - MX) * s + (wz - MZ) * c];

  // старт: у подножия лестницы
  const [sx, sz] = toWorld(0, -2.6);
  p.teleport(sx, sz, 0); p.y = 0; p.groundY = 0;

  const hs = [];
  let maxJump = 0, drops = 0, stuck = 0, maxAt = -1; const stuckIdx = [];
  let lastY = 0;
  for (let i = 0; i < 4000; i++) {
    const [lx, lz] = toLocal(p.pos.x, p.pos.z);
    const th = Math.atan2(lx, lz);
    // движение по касательной (спираль вверх)
    const tlx = Math.cos(th), tlz = -Math.sin(th);
    const wdx = tlx * c + tlz * s, wdz = -tlx * s + tlz * c;
    p.yaw = Math.atan2(-wdx, -wdz);
    p.keys.add('KeyW');
    p.update(1 / 60);
    const y = p.groundY;
    const d = y - lastY;
    if (d > maxJump) { maxJump = d; maxAt = i; }
    if (d < -0.001) drops++;
    if (Math.abs(d) < 0.0005) { stuck++; if (stuckIdx.length < 6) stuckIdx.push([i, +y.toFixed(2)]); }
    lastY = y;
    hs.push(y);
    if (y > 9.3) break;
  }
  const rising = hs.filter((v, i) => i && v > hs[i - 1]).length;
  return {
    finalY: +lastY.toFixed(2),
    frames: hs.length,
    maxJumpPerFrame: +maxJump.toFixed(3),
    drops,
    stuckFrames: stuck,
    risingFrames: rising,
    head: hs.slice(0, 12).map(v => +v.toFixed(2)),
    around: hs.slice(Math.max(0, maxAt - 4), maxAt + 5).map(v => +v.toFixed(3)),
    maxAt,
    stuckIdx,
    tail: hs.slice(-10).map(v => +v.toFixed(2)),
  };
});
console.log(JSON.stringify(res, null, 1));
console.log('ошибок:', errs.length, errs.slice(0, 3));
await browser.close();
