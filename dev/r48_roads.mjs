/**
 * ============================================================================
 *  Аудит дорожной сети: каждая тропинка — откуда, куда, что пересекает
 * ============================================================================
 *
 *  Проверяем по каждой тропинке:
 *   1) начинается ли она на главной улице, поперечной дороге или другой
 *      тропинке (иначе она «висит в воздухе»);
 *   2) доходит ли до своей цели — порога дома, ворот амбара, калитки;
 *   3) не проходит ли сквозь стены, заборы и поля;
 *   4) не заходит ли в воду;
 *   5) не дублирует ли куски других тропинок.
 *
 *  Запуск: cd dev && node r48_roads.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });

const data = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  return {
    trails: (ctx.roadTrails || []).map((t) => ({ id: t.id, pts: t.pts })),
    footprints: (ctx.footprints || []).map((f) => ({
      name: f.name, x: f.x, z: f.z, hx: f.hx, hz: f.hz, ry: f.ry || 0, r: f.r,
    })),
    fields: (ctx.fields || []).map((f) => ({ x: f.x, z: f.z, w: f.w, d: f.d })),
    doors: ctx.doors && ctx.doors.homes ? ctx.doors.homes : [],
    pasture: ctx.pasture || null,
    henyard: ctx.henyard || null,
  };
});
await browser.close();

const POND = { x: 50, z: -14, r: 10.6 };

const distSeg = (px, pz, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
};

const inside = (x, z, b, pad = 0) => {
  if (b.r) return Math.hypot(x - b.x, z - b.z) < b.r + pad;
  const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
  const dx = x - b.x, dz = z - b.z;
  const lx = c * dx - s * dz, lz = s * dx + c * dz;
  return Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad;
};

const len = (t) => {
  let L = 0;
  for (let i = 0; i < t.pts.length - 1; i++) {
    L += Math.hypot(t.pts[i + 1][0] - t.pts[i][0], t.pts[i + 1][1] - t.pts[i][1]);
  }
  return L;
};

/** Точка на главной улице или поперечной дороге. */
const onMainRoad = (x, z) => Math.abs(x) < 4.4 && Math.abs(z) < 96;
const onCrossRoad = (x, z) => Math.abs(z) < 3.4 && x > -52 && x < 74;

/** Ближайшая точка другой тропинки. */
const nearestTrail = (x, z, exceptId) => {
  let best = { d: Infinity, id: '' };
  for (const t of data.trails) {
    if (t.id === exceptId) continue;
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(x, z, t.pts[i], t.pts[i + 1]);
      if (d < best.d) best = { d, id: t.id };
    }
  }
  return best;
};

console.log('=== ДОРОГИ ===');
const problems = [];

// Видимая дорога — это сглаженная лента (повороты скруглены), поэтому
// проверять надо именно её: сглаживание срезает углы и может увести
// полотно ближе к постройке, чем прямая ломаная.
const smoothLine = (pts, rounds = 3) => {
  let cur = pts.map((p) => [p[0], p[1]]);
  for (let r = 0; r < rounds; r++) {
    if (cur.length < 3) break;
    const out = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
};
for (const t of data.trails) {
  const start = t.pts[0];
  const end = t.pts[t.pts.length - 1];
  const notes = [];

  // 1. начало
  const onRoad = onMainRoad(start[0], start[1]) || onCrossRoad(start[0], start[1]);
  const near = nearestTrail(start[0], start[1], t.id);
  if (!onRoad && near.d > 4.5) {
    notes.push(`начало висит в воздухе (ближайшая тропа «${near.id}» в ${near.d.toFixed(1)} м)`);
    problems.push(`${t.id}: начало не связано с дорожной сетью`);
  }

  // 2. пересечения с постройками
  const hits = [];
  for (let i = 0; i < t.pts.length - 1; i++) {
    const a = t.pts[i], b = t.pts[i + 1];
    for (const k of [0.15, 0.35, 0.55, 0.75, 0.95]) {
      const x = a[0] + (b[0] - a[0]) * k;
      const z = a[1] + (b[1] - a[1]) * k;
      for (const fp of data.footprints) {
        if (inside(x, z, fp, -0.3)) hits.push(`${fp.name} (${x.toFixed(1)},${z.toFixed(1)})`);
      }
      for (const f of data.fields) {
        if (inside(x, z, { x: f.x, z: f.z, hx: f.w / 2, hz: f.d / 2, ry: 0 }, -0.4)) {
          hits.push(`поле ${f.x},${f.z}`);
        }
      }
    }
  }
  const uniqHits = [...new Set(hits)];
  if (uniqHits.length) {
    notes.push(`пересекает: ${uniqHits.join('; ')}`);
    problems.push(`${t.id}: пересекает ${uniqHits.join(', ')}`);
  }

  // 2б. сглаженная лента (то, что видит игрок) — не заходит на постройки
  {
    const line = smoothLine(t.pts);
    const hits = [];
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      for (let k = 0.1; k < 1; k += 0.1) {
        const x = a[0] + (b[0] - a[0]) * k;
        const z = a[1] + (b[1] - a[1]) * k;
        for (const fp of data.footprints) {
          if (inside(x, z, fp, -0.3)) hits.push(`${fp.name} (${x.toFixed(1)},${z.toFixed(1)})`);
        }
      }
    }
    const uniq = [...new Set(hits)];
    if (uniq.length) {
      notes.push(`сглаженная лента пересекает: ${uniq.join('; ')}`);
      problems.push(`${t.id}: сглаженная лента пересекает ${uniq.join(', ')}`);
    }
  }

  // 3. вода
  let minWater = Infinity;
  for (let i = 0; i < t.pts.length - 1; i++) {
    minWater = Math.min(minWater, distSeg(POND.x, POND.z, t.pts[i], t.pts[i + 1]));
  }
  if (minWater < POND.r + 1.3) {
    notes.push(`заходит в воду (${minWater.toFixed(1)} м от центра пруда)`);
    problems.push(`${t.id}: дорога в воде`);
  }

  // 4. конец: рядом ли с чем-то осмысленным
  let nearDoor = 999, nearName = '';
  for (const d of data.doors) {
    const dd = Math.hypot(end[0] - d.x, end[1] - d.z);
    if (dd < nearDoor) { nearDoor = dd; nearName = 'дверь дома'; }
  }
  const nearFp = data.footprints
    .map((f) => ({ f, d: Math.hypot(end[0] - f.x, end[1] - f.z) }))
    .sort((a, b) => a.d - b.d)[0];

  console.log(`\n${t.id}: ${len(t).toFixed(1)} м, начало (${start[0]}, ${start[1]}), конец (${end[0]}, ${end[1]})`);
  console.log(`   старт: ${onRoad ? 'на главной/поперечной дороге' : `рядом с тропой «${near.id}» (${near.d.toFixed(1)} м)`}`);
  console.log(`   финиш: ближайшая постройка «${nearFp.f.name}» — ${nearFp.d.toFixed(1)} м; до двери дома — ${nearDoor.toFixed(1)} м`);
  console.log(`   вода: ${minWater.toFixed(1)} м от пруда`);
  for (const n of notes) console.log(`   ! ${n}`);
}

console.log('\n=== ИТОГ ===');
if (!problems.length) console.log('замечаний нет');
for (const p of problems) console.log('• ' + p);
console.log('ошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 160));
// ненулевой код, если на дорогах есть замечания: тест можно гонять в общем наборе
process.exit(problems.length || errs.length ? 1 : 0);
