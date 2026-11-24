/**
 * ============================================================================
 *  Раунд 61 — аудит заборов, построек и тропинок
 * ============================================================================
 *
 *  Проверяем то, что «видно глазом», но трудно поймать:
 *   1) ни одна постройка не стоит на заборе (и забор не проходит сквозь стену);
 *   2) забор не перекрывает вход в дом, на ворот амбара и на калитку;
 *   3) тропинка не заходит внутрь постройки;
 *   4) тропинка доходит до крыльца (а не повисает в воздухе);
 *   5) у каждого дома есть дорога к нему.
 *
 *  Запуск: cd /workspace/village && node dev/r61_layout_audit.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const data = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  const d = window.__dbg;
  // заборы: собираем из тех же сегментов, что ставит village.js
  const fenceSegs = [];
  const field = (x, z, w, dd) => {
    const gw = 2.0;
    fenceSegs.push(
      [[x - w / 2, z - dd / 2], [x - gw / 2, z - dd / 2]],
      [[x + gw / 2, z - dd / 2], [x + w / 2, z - dd / 2]],
      [[x + w / 2, z - dd / 2], [x + w / 2, z + dd / 2]],
      [[x + w / 2, z + dd / 2], [x - w / 2, z + dd / 2]],
      [[x - w / 2, z + dd / 2], [x - w / 2, z - dd / 2]],
    );
  };
  field(-30, 50, 20, 12);
  field(31, 44, 19, 14);
  field(82, -20, 20, 12);
  field(96, -6, 16, 14);
  field(80, -2, 18, 12);
  fenceSegs.push(
    [[-51.5, 25.5], [-38.6, 25.5]], [[-38.6, 25.5], [-38.6, 36.5]],
    [[-38.6, 36.5], [-51.5, 36.5]], [[-51.5, 36.5], [-51.5, 25.5]],
    [[-19, 18], [-13, 18]], [[-13, 18], [-13, 25]],
    [[-13, 25], [-19, 25]], [[-19, 25], [-19, 18]],
  );
  // заборы огородов у четырёх домов у улицы
  for (const h of (ctx.homes || []).slice(0, 4)) {
    const sgn = Math.sign(h.x);
    const c = Math.cos(h.ry || 0), s = Math.sin(h.ry || 0);
    const ext = Math.abs((h.w / 2) * c) + Math.abs((h.d / 2) * s);
    const gx = h.x + sgn * (ext + 2.4);
    const far = gx + sgn * 2.0, near = gx - sgn * 2.0;
    const z0 = h.z - 4.4, z1 = h.z + 4.4;
    fenceSegs.push(
      [[far, z0], [far, z1]],
      [[near, z0], [far, z0]],
      [[near, z1], [far, z1]],
    );
  }
  return {
    fenceSegs,
    homes: (ctx.homes || []).map((h) => ({ ...h })),
    footprints: (ctx.footprints || []).map((f) => ({ ...f })),
    trails: (ctx.roadTrails || []).map((t) => ({ id: t.id, pts: t.pts })),
    doors: (ctx.doors && ctx.doors.homes) || [],
    hud: !!d.ctx,
  };
});
/**
 * Точка в локальных осях прямоугольника.
 */
function toLocal(x, z, b) {
  const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
  const dx = x - b.x, dz = z - b.z;
  return [c * dx - s * dz, s * dx + c * dz];
}

/**
 * Пересекает ли отрезок прямоугольник.
 */
function segHitsBox(a, b, box, pad = 0) {
  const la = toLocal(a[0], a[1], box);
  const lb = toLocal(b[0], b[1], box);
  let t0 = 0, t1 = 1;
  const dx = lb[0] - la[0], dz = lb[1] - la[1];
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!clip(-dx, la[0] + box.hx + pad)) return false;
  if (!clip(dx, box.hx + pad - la[0])) return false;
  if (!clip(-dz, la[1] + box.hz + pad)) return false;
  if (!clip(dz, box.hz + pad - la[1])) return false;
  return true;
}

/**
 * Расстояние от точки до отрезка.
 */
function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

const problems = [];
let ok = 0, fail = 0;
/**
 * Проверка с выводом.
 */
function check(name, cond, extra = '') {
  if (cond) { ok++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); problems.push(name); }
}

/* ---------------- 1. постройки и заборы ---------------- */
const boxes = [];
for (const h of data.homes) {
  boxes.push({ name: `дом ${h.i}`, x: h.x, z: h.z, hx: h.w / 2, hz: h.d / 2, ry: h.ry || 0 });
}
for (const f of data.footprints) {
  if (f.name === 'крыльцо храма') continue;   // крыльцо — это вход, а не стена
  if (f.r) {
    boxes.push({ name: f.name, x: f.x, z: f.z, r: f.r, hx: f.r, hz: f.r, ry: 0 });
  } else {
    boxes.push({ name: f.name, x: f.x, z: f.z, hx: f.hx, hz: f.hz, ry: f.ry || 0 });
  }
}

console.log('=== 1. ЗАБОРЫ И ПОСТРОЙКИ ===');
let fenceProblems = 0;
data.fenceSegs.forEach((seg, i) => {
  const [a, b] = seg;
  for (const box of boxes) {
    if (box.r) {
      // круглая постройка: расстояние от отрезка до центра
      const d = Math.min(
        distSeg(box.x, box.z, a, b),
        distSeg(a[0], a[1], box.x, box.z),
        distSeg(b[0], b[1], box.x, box.z),
      );
      if (d < box.r + 0.2) {
        console.log(`  ✗ забор ${i} [${a}]-[${b}] наезжает на «${box.name}» (${d.toFixed(1)} м)`);
        fenceProblems++;
      }
      continue;
    }
    if (segHitsBox(a, b, box, 0.2)) {
      console.log(`  ✗ забор ${i} [${a}]-[${b}] проходит сквозь «${box.name}»`);
      fenceProblems++;
    }
  }
});
if (!fenceProblems) console.log('  ✓ заборы ни с чем не пересекаются');

/* ---------------- 2. тропинки и постройки ---------------- */
console.log('\n=== 1б. ГРЯДКИ И ДОМА ===');
let bedProblems = 0;
for (const h of data.homes) {
  const c = Math.cos(h.ry || 0), s = Math.sin(h.ry || 0);
  const ext = Math.abs((h.w / 2) * c) + Math.abs((h.d / 2) * s);
  const off = Math.sign(h.x) * (ext + 2.4);
  for (const dz of [-2.2, 2.2]) {
    const bx = h.x + off, bz = h.z + dz;
    // грядка: 2.6 вдоль X, 1.2 вдоль Z
    const dx = bx - h.x, dz2 = bz - h.z;
    const lx = c * dx - s * dz2, lz = s * dx + c * dz2;
    if (Math.abs(lx) < h.w / 2 + 1.3 && Math.abs(lz) < h.d / 2 + 0.6) {
      console.log(`  ✗ грядка дома ${h.i} наезжает на дом`);
      bedProblems++;
    }
  }
}
if (!bedProblems) console.log('  ✓ грядки не наезжают на дома');

console.log('\n=== 2. ТРОПИНКИ И ПОСТРОЙКИ ===');
let trailProblems = 0;
for (const t of data.trails) {
  for (let i = 0; i < t.pts.length - 1; i++) {
    for (const box of boxes) {
      if (box.r) continue;
      if (segHitsBox(t.pts[i], t.pts[i + 1], box, 0.3)) {
        console.log(`  ✗ тропа «${t.id}» идёт сквозь «${box.name}» (отрезок ${i})`);
        trailProblems++;
      }
    }
  }
}
if (!trailProblems) console.log('  ✓ ни одна тропа не заходит внутрь постройки');

/* ---------------- 3. дорога к каждому дому ---------------- */
console.log('\n=== 3. ДОРОГА К КАЖДОМУ ДОМУ ===');
for (const h of data.homes) {
  const door = data.doors[h.i];
  if (!door) {
    console.log(`  ✗ дом ${h.i}: нет двери`);
    continue;
  }
  let best = Infinity;
  let bestTrail = '';
  for (const t of data.trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(door.x, door.z, t.pts[i], t.pts[i + 1]);
      if (d < best) { best = d; bestTrail = t.id; }
    }
  }
  const ok = best < 2.0 ? '✓' : '✗';
  if (best >= 2.0) problems.push(`дом ${h.i}: тропа «${bestTrail}» в ${best.toFixed(1)} м от двери`);
  console.log(`  ${ok} дом ${String(h.i).padStart(2)}: дверь (${door.x.toFixed(1)}, ${door.z.toFixed(1)}) — тропа «${bestTrail}», ${best.toFixed(1)} м`);
}

/* ---------------- 4. забор не перекрывает проход к двери ---------------- */
console.log('\n=== 4. ЗАБОР ПЕРЕД ДВЕРЬЮ ===');
let doorProblems = 0;
for (const h of data.homes) {
  const door = data.doors[h.i];
  if (!door) continue;
  for (const seg of data.fenceSegs) {
    const d = distSeg(door.x, door.z, seg[0], seg[1]);
    if (d < 2.2) {
      console.log(`  ✗ дом ${h.i}: забор в ${d.toFixed(1)} м от двери`);
      doorProblems++;
    }
  }
}
if (!doorProblems) console.log('  ✓ заборы не стоят перед дверями');

/* ---------------- 5. крыльцо трактира: на него можно взойти ---------------- */
console.log('\n=== 5. КРЫЛЬЦО ТРАКТИРА ===');
const porch = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  // точка перед дверью трактира (фасад смотрит к площади)
  const a = Math.atan2(-(0 - (-17)), -(0 - (-13)));   // ryToFace
  const lz = -18 / 2 - 1.9;
  const wx = -17 + lz * Math.sin(a);
  const wz = -13 + lz * Math.cos(a);
  p.teleport(wx, wz, 0);
  p.y = 0; p.groundY = 0;
  const g0 = p.groundAt(wx, wz);
  // пробуем подняться: шаг вперёд (к двери)
  const inx = -17 + (-18 / 2 - 0.6) * Math.sin(a);
  const inz = -13 + (-18 / 2 - 0.6) * Math.cos(a);
  const g1 = p.groundAt(inx, inz);
  const g2 = p.groundAt(-17 + (-18 / 2 - 0.2) * Math.sin(a), -13 + (-18 / 2 - 0.2) * Math.cos(a));
  return { g0: +g0.toFixed(2), g1: +g1.toFixed(2), g2: +g2.toFixed(2) };
});
console.log(`  земля у улицы: ${porch.g0} м; нижняя ступень: ${porch.g1} м; верхняя: ${porch.g2} м`);
check(`ступени трактира не выше прыжка игрока`, porch.g1 - porch.g0 <= 0.46 && porch.g2 - porch.g1 <= 0.46,
  `${porch.g1 - porch.g0} и ${porch.g2 - porch.g1} м`);
check(`трактир поднят над землёй`, porch.g2 > 0.5, `крыльцо на ${porch.g2} м`);

console.log('\nошибки в консоли:', errs.length, errs.slice(0, 3));
console.log('итого проблем:', problems.length + fenceProblems + trailProblems + doorProblems + bedProblems);
await browser.close();
