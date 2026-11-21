/**
 * ============================================================================
 *  Проверки раунда 50: дороги — цельные мягкие ленты
 * ============================================================================
 *
 *   1. Каждая тропинка — одно полотно (лента), а не набор прямоугольных
 *      кусков: в сцене столько дорог, сколько тропинок, плюс главная,
 *      поперечная и площадь.
 *   2. У полотен мягкий край: прозрачность приходит из цвета вершин,
 *      поэтому грунт плавно переходит в траву.
 *   3. Повороты скруглены: в ленте больше точек, чем в ломаной.
 *   4. Мощёная площадь — круглая, с растушёванным краем.
 *   5. Полотна лежат выше земли и не мерцают (полигонный оффсет).
 *
 *  Запуск: cd dev && node r50_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const out = {};

  // все полотна дорог: прозрачные, с цветом вершин
  const roads = [];
  ctx.scene.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.transparent) return;
    if (!o.material.vertexColors) return;
    const g = o.geometry;
    const col = g.attributes.color;
    const pos = g.attributes.position;
    // у полотна дороги цвет вершин с альфа-каналом (RGBA); у воды, например,
    // он трёхкомпонентный — её в дороги не считаем
    if (!col || !pos || col.itemSize !== 4) return;
    // у полотна дороги есть альфа-канал в цвете вершин
    let hasAlpha = false, minA = 1, maxA = 0;
    for (let i = 0; i < col.count; i++) {
      const a = col.getW ? col.getW(i) : col.array[i * col.itemSize + 3];
      minA = Math.min(minA, a); maxA = Math.max(maxA, a);
      if (a < 0.99) hasAlpha = true;
    }
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let i = 0; i < pos.count; i++) {
      minx = Math.min(minx, pos.getX(i)); maxx = Math.max(maxx, pos.getX(i));
      minz = Math.min(minz, pos.getZ(i)); maxz = Math.max(maxz, pos.getZ(i));
    }
    roads.push({
      verts: pos.count, hasAlpha, minA: +minA.toFixed(2), maxA: +maxA.toFixed(2),
      box: [+minx.toFixed(1), +maxx.toFixed(1), +minz.toFixed(1), +maxz.toFixed(1)],
      offset: !!o.material.polygonOffset,
    });
  });
  out.roads = roads;
  out.trailCount = (ctx.roadTrails || []).length;
  out.roadCount = roads.length;

  // площадь: круглая и широкая
  const plaza = roads.find((r) => Math.abs(r.box[0] + 11.5) < 0.6 && Math.abs(r.box[1] - 11.5) < 0.6);
  out.plaza = !!plaza;
  out.plazaVerts = plaza ? plaza.verts : 0;

  // повороты скруглены: у ленты точек больше, чем у ломаной
  const trailPts = ctx.roadTrails.map((t) => t.pts.length);
  const maxPts = Math.max(...trailPts);
  const longest = roads
    .filter((r) => r.verts > 0)
    .map((r) => r.verts)
    .sort((a, b) => b - a)[0];
  out.maxPts = maxPts;
  out.longestVerts = longest;
  return out;
});

const checks = [
  // тропинки + главная улица + поперечная + площадь + дорога к скале
  ['дорог ровно столько, сколько тропинок, + главная, поперечная, площадь и тропа к скале',
    res.roadCount === res.trailCount + 4],
  ['у каждого полотна мягкий край (прозрачность в цвете вершин)',
    res.roads.length > 0 && res.roads.every((r) => r.hasAlpha && r.minA === 0)],
  ['полотна приподняты над землёй (полигонный оффсет)',
    res.roads.every((r) => r.offset)],
  ['мощёная площадь круглая, с растушёванным краем',
    res.plaza && res.plazaVerts > 200],
  ['повороты скруглены: лента плотнее ломаной',
    res.longestVerts > res.maxPts * 4],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
console.log('детали:', JSON.stringify({
  roadCount: res.roadCount, trailCount: res.trailCount,
  plazaVerts: res.plazaVerts, maxPts: res.maxPts, longestVerts: res.longestVerts,
  soft: res.roads.filter((r) => r.hasAlpha).length,
}));
console.log('ошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 200));
console.log('ошибок:', failed + (errs.length ? 1 : 0));
await browser.close();
process.exit(failed + (errs.length ? 1 : 0) ? 1 : 0);
