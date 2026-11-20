/**
 * Раунд 47: разбор планировки — ищем свободное место под амбар (12×8)
 * внутри деревни. Печатает список занятых прямоугольников и свободных
 * «карманов» со стороной от 14 м.
 * Запуск: cd dev && node r47_spots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });

const data = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  return {
    footprints: (ctx.footprints || []).map((f) => ({
      name: f.name, x: +f.x.toFixed(1), z: +f.z.toFixed(1),
      hx: f.hx, hz: f.hz, ry: +(f.ry || 0).toFixed(2),
    })),
    fields: ctx.fields || [],
    pasture: ctx.pasture || null,
    henyard: ctx.henyard || null,
    trails: (ctx.roadTrails || []).map((t) => ({ id: t.id, pts: t.pts })),
    props: (ctx.propSpots || []).map((p) => ({ name: p.name, x: p.x, z: p.z, r: p.r })),
  };
});
await browser.close();

/** Углы повёрнутого прямоугольника. */
function corners(x, z, hx, hz, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([ox, oz]) => ({
    x: x + ox * c + oz * s, z: z - ox * s + oz * c,
  }));
}

const obstacles = [];
for (const f of data.footprints) {
  obstacles.push({ name: f.name, pts: corners(f.x, f.z, f.hx + 1.5, f.hz + 1.5, f.ry) });
}
for (const f of data.fields) {
  obstacles.push({ name: 'поле', pts: corners(f.x, f.z, f.w / 2 + 1.5, f.d / 2 + 1.5, 0) });
}
if (data.pasture) {
  const p = data.pasture;
  obstacles.push({ name: 'пастбище', pts: corners(p.x, p.z, p.w / 2 + 1, p.d / 2 + 1, 0) });
}
if (data.henyard) {
  const p = data.henyard;
  obstacles.push({ name: 'курятник', pts: corners(p.x, p.z, p.w / 2 + 1, p.d / 2 + 1, 0) });
}
// дороги — коридоры шириной 2,5 м
for (const t of data.trails) {
  for (let i = 0; i < t.pts.length - 1; i++) {
    const a = t.pts[i], b = t.pts[i + 1];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    obstacles.push({ name: `дорога ${t.id}`, pts: corners(mx, mz, len + 1.5, 2.5, -ang) });
  }
}

const inside = (x, z, pts) => {
  // точка внутри выпуклого многоугольника (все прямоугольники)
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const cross = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
};

/** Свободно ли место: все углы и центр вне препятствий. */
function free(x, z, hx, hz, ry) {
  const pts = corners(x, z, hx, hz, ry);
  for (const o of obstacles) {
    for (const q of pts.concat([{ x, z }])) {
      if (inside(q.x, q.z, o.pts)) return o.name;
    }
  }
  return null;
}

console.log('=== занято ===');
for (const f of data.footprints) console.log(`  ${f.name}: (${f.x}, ${f.z}) ${(f.hx * 2).toFixed(1)}×${(f.hz * 2).toFixed(1)}`);
console.log('поля:', data.fields.map((f) => `${f.x},${f.z}`).join(' | '));

console.log('\n=== свободные места под амбар 12×8 (с зазором) ===');
const HX = 6, HZ = 4;
const found = [];
for (let x = -44; x <= 44; x += 2) {
  for (let z = -44; z <= 44; z += 2) {
    const ry = 0;
    const hit = free(x, z, HX, HZ, ry);
    if (!hit) found.push([x, z]);
  }
}
// печатаем центры «карманов» (убираем соседние)
const cells = [];
for (const [x, z] of found) {
  if (cells.some((c) => Math.abs(c[0] - x) <= 3 && Math.abs(c[1] - z) <= 3)) continue;
  cells.push([x, z]);
}
for (const [x, z] of cells) console.log(`  (${x}, ${z})`);
