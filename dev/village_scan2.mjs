/**
 * ============================================================================
 *  Скан деревни: дыры в стенах + «левитирующие» площадки (v2)
 * ============================================================================
 *
 *  Критерий прохода внутрь считается в локальных координатах здания:
 *  игрок внутри, если |lx| < hx-0.35 и |lz| < hz-0.35.
 *
 *  Запуск: cd dev && node village_scan2.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 700, height: 440 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const out = [];
  const ryToFace = (fx, fz, tx, tz) => Math.atan2(-(tx - fx) / (Math.hypot(tx - fx, tz - fz) || 1), -(tz - fz) / (Math.hypot(tx - fx, tz - fz) || 1));

  const buildings = [
    { name: 'церковь', x: 3, z: 44, ry: ryToFace(3, 44, 0, 0), hx: 4.5, hz: 8.5 },
    { name: 'кузня', x: 14.5, z: -8, ry: ryToFace(14.5, -8, 0, -2), hx: 3.0, hz: 2.5 },
    { name: 'мельница', x: 34, z: -33, ry: 0.6, rad: 3.6 },
    { name: 'таверна', x: -17, z: -13, ry: ryToFace(-17, -13, 0, 0), hx: 6.5, hz: 6.0 },
    { name: 'амбар', x: -40, z: -8, ry: ryToFace(-40, -8, -10, -4), hx: 6.0, hz: 4.0 },
  ];

  const localOf = (b, wx, wz) => {
    const dx = wx - b.x, dz = wz - b.z, c = Math.cos(b.ry), s = Math.sin(b.ry);
    return { lx: dx * c - dz * s, lz: dx * s + dz * c };
  };
  const insideOf = (b, wx, wz) => {
    const { lx, lz } = localOf(b, wx, wz);
    if (b.rad) return Math.hypot(lx, lz) < b.rad - 0.35;
    return Math.abs(lx) < b.hx - 0.35 && Math.abs(lz) < b.hz - 0.35;
  };

  for (const b of buildings) {
    const R = b.rad || Math.max(b.hx, b.hz);
    const leaks = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sx = b.x + Math.cos(a) * (R + 1.4);
      const sz = b.z + Math.sin(a) * (R + 1.4);
      p.teleport(sx, sz, 0); p.y = 0; p.groundY = 0; p.vy = 0;
      const yaw = Math.atan2(-(b.x - sx), -(b.z - sz));
      let inside = false;
      for (let k = 0; k < 120; k++) {
        p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60);
        if (insideOf(b, p.pos.x, p.pos.z)) { inside = true; break; }
      }
      p.keys.clear();
      if (inside) {
        const { lx, lz } = localOf(b, p.pos.x, p.pos.z);
        leaks.push(`${Math.round(a * 180 / Math.PI)}° (лок. ${lx.toFixed(1)},${lz.toFixed(1)})`);
      }
    }
    out.push(`${leaks.length ? '✗ ПРОЛЕЗ' : '✓ цело'} ${b.name}: ${leaks.length ? leaks.join(' | ') : 'нигде'}`);
  }

  /* коллайдеры вокруг зданий */
  const boxes = d.ctx.colliders.boxes || [];
  for (const b of buildings) {
    const R = (b.rad || Math.max(b.hx, b.hz)) + 2.5;
    const near = boxes.filter((o) => Math.hypot(o.cx - b.x, o.cz - b.z) < R);
    out.push(`  ${b.name}: коллайдеров рядом ${near.length}`);
  }
  return out;
});

for (const l of res) console.log(l);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
