/**
 * ============================================================================
 *  Диагностика деревни: «левитирующие» площадки и дыры в стенах зданий
 * ============================================================================
 *
 *  1) Площадки (platforms): ищем те, что висят в воздухе — под ними нет
 *     ни земли, ни опоры. Обычно это остатки от старых крылец.
 *  2) Здания: проверяем, может ли игрок пройти внутрь сквозь стену.
 *     Телепортируем игрока к каждой стороне здания и пробуем пройти
 *     к центру: если он оказался внутри — в стене дыра.
 *
 *  Запуск: cd dev && node village_scan.mjs
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

  /* ---------- 1. площадки в воздухе ---------- */
  const plats = d.ctx.platforms || [];
  const byPos = new Map();
  const simple = plats.filter((pl) => pl && Number.isFinite(pl.cx) && Number.isFinite(pl.cz));
  // опора: под площадкой должна быть либо земля (y ≈ 0), либо другая площадка/коллайдер
  const supportUnder = (x, z, y) => {
    if (y <= 0.22) return 'земля';
    for (const pl of simple) {
      const dx = Math.abs(x - pl.cx) - pl.hx;
      const dz = Math.abs(z - pl.cz) - pl.hz;
      if (dx < 0.4 && dz < 0.4 && pl.y < y - 0.15 && pl.y > 0) return 'площадка';
    }
    for (const b of (d.ctx.colliders.boxes || [])) {
      const dx = Math.abs(x - b.cx) - b.hx;
      const dz = Math.abs(z - b.cz) - b.hz;
      if (dx < 0.4 && dz < 0.4 && b.y0 < y - 0.2) return 'коллайдер';
    }
    return null;
  };
  const floating = [];
  for (const pl of simple) {
    if (pl.y <= 0.22) continue;
    const sup = supportUnder(pl.cx, pl.cz, pl.y);
    if (!sup) floating.push({ x: +pl.cx.toFixed(2), z: +pl.cz.toFixed(2), y: +pl.y.toFixed(2), hx: pl.hx, hz: pl.hz });
  }
  out.push(`площадок всего: ${plats.length} (из них простых: ${simple.length}), висящих: ${floating.length}`);
  for (const f of floating.slice(0, 30)) {
    out.push(`  ✗ висящая площадка (${f.x}, ${f.z}) y=${f.y} ${f.hx}×${f.hz}`);
  }

  /* ---------- 2. дыры в стенах зданий ---------- */
  const buildings = [
    ['церковь', 3, 44, 9, 15],
    ['кузня', 14.5, -8, 8, 9],
    ['мельница', 34, -33, 7, 7],
    ['таверна', -17, -13, 7, 7],
    ['амбар', -40, -8, 7.5, 5.5],
  ];
  const tryEnter = (cx, cz, r) => {
    // 8 точек вокруг здания; идём к центру и смотрим, не попали ли внутрь
    const holes = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sx = cx + Math.cos(a) * (r + 1.6);
      const sz = cz + Math.sin(a) * (r + 1.6);
      p.teleport(sx, sz, 0);
      p.y = 0; p.groundY = 0; p.vy = 0;
      const yaw = Math.atan2(-(cx - sx), -(cz - sz));
      let inside = false;
      for (let k = 0; k < 90; k++) {
        p.yaw = yaw;
        p.keys.add('KeyW');
        p.update(1 / 60);
        const dist = Math.hypot(p.pos.x - cx, p.pos.z - cz);
        if (dist < r - 0.8) { inside = true; break; }
      }
      p.keys.clear();
      if (inside) holes.push(Math.round(a * 180 / Math.PI));
    }
    return holes;
  };
  for (const [name, cx, cz, hx, hz] of buildings) {
    const r = Math.max(hx, hz);
    const holes = tryEnter(cx, cz, r);
    out.push(`${holes.length ? '✗' : '✓'} ${name}: пролез ${holes.length ? 'в ' + holes.join(', ') + '°' : 'нигде'}`);
  }
  return out;
});

for (const l of res) console.log(l);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
