/**
 * ============================================================================
 *  Раунд 61 — тест-агент: геометрия деревни (только проверки, без снимков)
 * ============================================================================
 *
 *  Отдельный быстрый скрипт: проверяет заборы и тропинки с ПРАВИЛЬНЫМ
 *  отсечением Лянна–Барски (в игровом game/roads.js в clip() перепутаны
 *  ветви p > 0 и p < 0 — из-за этого «проверки дорог» дают ложные
 *  срабатывания; здесь используется корректный вариант).
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_village_geom.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const geo = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const boxes = [];
  for (const h of (ctx.homes || [])) {
    boxes.push({
      name: `дом ${h.i}`, x: h.x, z: h.z, hx: h.w / 2, hz: h.d / 2, ry: h.ry || 0,
      door: (ctx.doors && ctx.doors.homes && ctx.doors.homes[h.i]) || null,
    });
  }
  for (const f of (ctx.footprints || [])) {
    if (f.name === 'крыльцо храма') continue;
    if (/^дом /.test(f.name)) continue;
    boxes.push({
      name: f.name, x: f.x, z: f.z,
      hx: f.r ? f.r : f.hx, hz: f.r ? f.r : f.hz, ry: f.ry || 0, round: !!f.r,
    });
  }
  const posts = (ctx.colliders.circles || []).filter((c) => Math.abs(c.r - 0.26) < 0.001);
  const x = -17, z = -13;
  const ry = Math.atan2(-(0 - x), -(0 - z));
  const lz = -18 / 2 - 0.5;
  return {
    boxes,
    posts: posts.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })),
    trails: (ctx.roadTrails || []).map((t) => ({ id: t.id, pts: t.pts })),
    tavernDoor: { x: +(x + lz * Math.sin(ry)).toFixed(2), z: +(z + lz * Math.cos(ry)).toFixed(2) },
  };
});

/** Точка в локальных осях прямоугольника. */
function toLocal(x, z, b) {
  const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
  const dx = x - b.x, dz = z - b.z;
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Пересекает ли отрезок прямоугольник (корректное отсечение Лянна–Барски). */
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

/** Расстояние от точки до отрезка. */
function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

let ok = 0, fail = 0;
const results = [];
/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} extra подробность
 */
function check(name, cond, extra = '') {
  if (cond) { ok++; results.push(`✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; results.push(`✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

/* --- заборы --- */
const postProblems = [];
for (const p of geo.posts) {
  for (const b of geo.boxes) {
    const [lx, lz] = toLocal(p.x, p.z, b);
    const inside = b.round
      ? Math.hypot(lx, lz) < b.hx + 0.2
      : Math.abs(lx) < b.hx + 0.2 && Math.abs(lz) < b.hz + 0.2;
    if (inside) { postProblems.push(`столб (${p.x}, ${p.z}) в «${b.name}»`); break; }
  }
}
check('заборы не проходят сквозь стены домов и трактира', postProblems.length === 0,
  postProblems.length ? postProblems.slice(0, 6).join('; ') : `столбов забора: ${geo.posts.length}`);

const doorBlocked = [];
for (const b of geo.boxes) {
  if (!b.door) continue;
  for (const p of geo.posts) {
    const d = Math.hypot(p.x - b.door.x, p.z - b.door.z);
    if (d < 2.0) { doorBlocked.push(`«${b.name}»: столб в ${d.toFixed(1)} м от двери`); break; }
  }
}
check('забор не перекрывает вход в дом', doorBlocked.length === 0,
  doorBlocked.length ? doorBlocked.join('; ') : 'все двери свободны');

/* --- тропинки --- */
const trailProblems = [];
for (const t of geo.trails) {
  for (let i = 0; i < t.pts.length - 1; i++) {
    for (const b of geo.boxes) {
      if (b.round) continue;
      if (segHitsBox(t.pts[i], t.pts[i + 1], b, 0.25)) {
        trailProblems.push(`тропа «${t.id}» (отрезок ${i}) идёт сквозь «${b.name}»`);
      }
    }
  }
}
check('тропинки не идут сквозь постройки', trailProblems.length === 0,
  trailProblems.length ? trailProblems.slice(0, 8).join('; ') : `тропинок проверено: ${geo.trails.length}`);

const reach = [];
for (const b of geo.boxes) {
  if (!b.door) continue;
  let best = Infinity, bestId = '';
  for (const t of geo.trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(b.door.x, b.door.z, t.pts[i], t.pts[i + 1]);
      if (d < best) { best = d; bestId = t.id; }
    }
  }
  reach.push({ name: b.name, d: +best.toFixed(2), trail: bestId });
}
const farDoors = reach.filter((r) => r.d > 2.0);
check('до каждого дома доходит тропинка до крыльца', farDoors.length === 0,
  farDoors.length ? farDoors.map((r) => `${r.name}: ${r.d} м`).join('; ')
    : reach.map((r) => `${r.name}: ${r.d} м`).join(', '));

{
  let best = Infinity, bestId = '';
  for (const t of geo.trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(geo.tavernDoor.x, geo.tavernDoor.z, t.pts[i], t.pts[i + 1]);
      if (d < best) { best = d; bestId = t.id; }
    }
  }
  check('до трактира доходит тропинка', best < 2.0,
    `дверь трактира (${geo.tavernDoor.x}, ${geo.tavernDoor.z}), тропа «${bestId}» — ${best.toFixed(2)} м`);
}

/* --- грядки у домов не наезжают на стены --- */
const bedProblems = [];
const beds = await page.evaluate(() => {
  const d = window.__dbg;
  return (d.ctx.homes || []).map((h) => ({ i: h.i, x: h.x, z: h.z, w: h.w, d: h.d, ry: h.ry || 0 }));
});
for (const h of beds) {
  const c = Math.cos(h.ry || 0), s = Math.sin(h.ry || 0);
  const ext = Math.abs((h.w / 2) * c) + Math.abs((h.d / 2) * s);
  const off = Math.sign(h.x) * (ext + 2.4);
  for (const dz of [-2.2, 2.2]) {
    const bx = h.x + off, bz = h.z + dz;
    const dx = bx - h.x, dz2 = bz - h.z;
    const lx = c * dx - s * dz2, lz = s * dx + c * dz2;
    if (Math.abs(lx) < h.w / 2 + 1.3 && Math.abs(lz) < h.d / 2 + 0.6) {
      bedProblems.push(`грядка дома ${h.i} наезжает на дом`);
    }
  }
}
check('грядки у домов не наезжают на стены', bedProblems.length === 0,
  bedProblems.length ? bedProblems.join('; ') : `домов проверено: ${beds.length}`);

console.log(results.join('\n'));
console.log(`\ntester_r61_village_geom: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 6).join('\n'));
await browser.close();
if (fail) process.exit(1);
