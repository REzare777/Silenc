/**
 * Диагностика прохода в нише: где именно игрок останавливается.
 * Запуск: cd dev && node niche_debug.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('tavern');
  const p = d.player;
  const r = d.tavernLoc.rooms[0];              // ниша A
  const x1 = r.x + r.w / 2;
  const startX = x1 - 1.0;
  p.teleport(startX, r.doorZ + 0.35, Math.PI);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  const trace = [];
  for (let i = 0; i < 200; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    if (i % 10 === 0) {
      trace.push({
        i, x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2),
        y: +(p.groundY + p.y).toFixed(2), grounded: p.grounded,
      });
    }
  }
  p.keys.clear();
  // что рядом с финальной точкой
  const ex = p.pos.x, ez = p.pos.z, ey = p.groundY + p.y;
  const near = [];
  for (const b of d.tavernLoc.colliders.boxes) {
    if (Math.abs(b.cx - ex) < b.hx + 0.8 && Math.abs(b.cz - ez) < b.hz + 0.8 &&
        b.y1 > ey - 0.5 && b.y0 < ey + 1.8) {
      near.push(`box(${b.cx.toFixed(2)},${b.cz.toFixed(2)} ${b.hx}×${b.hz} y ${b.y0}..${b.y1})`);
    }
  }
  for (const c of d.tavernLoc.colliders.circles) {
    if (Math.hypot(c.x - ex, c.z - ez) < c.r + 0.8 &&
        (c.y1 === undefined || ey < c.y1)) {
      near.push(`circle(${c.x.toFixed(2)},${c.z.toFixed(2)} r${c.r} y ${c.y0 ?? '-'}..${c.y1 ?? '-'})`);
    }
  }
  // платформы под точкой
  const plats = d.tavernLoc.platforms
    .filter((pf) => Math.abs(pf.cx - ex) < pf.hx + 0.5 && Math.abs(pf.cz - ez) < pf.hz + 0.5)
    .map((pf) => `plat(${pf.cx.toFixed(2)},${pf.cz.toFixed(2)} ${pf.hx}×${pf.hz} y${pf.y} only:${pf.only})`);
  return { room: r, x1, startX, trace, near, plats, end: { x: +ex.toFixed(2), z: +ez.toFixed(2), y: +ey.toFixed(2) } };
});

console.log('ниша:', res.room.name, 'x1 =', res.x1.toFixed(2), 'старт x =', res.startX.toFixed(2));
console.log('след:', res.trace.map((t) => `${t.i}:${t.x},${t.z}(y${t.y}${t.grounded ? '' : '!'})`).join(' '));
console.log('конец:', res.end);
console.log('рядом:\n ', res.near.join('\n  '));
console.log('платформы:\n ', res.plats.join('\n  '));
await browser.close();
