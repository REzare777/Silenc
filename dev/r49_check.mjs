/**
 * ============================================================================
 *  Проверки раунда 49: вырубка вокруг амбара и лес на полях
 * ============================================================================
 *
 *   1. Вокруг амбара лес отодвинут: ближайшее дерево — не ближе 15 м,
 *      то есть между стеной сарая и опушкой есть настоящее поле.
 *   2. На пшеничных полях деревьев нет: колосья не растут в стволах.
 *   3. Вырубка оформлена: по кромке поляны стоят пеньки и срубленные
 *      стволы, рядом с амбаром — телега.
 *   4. В остальных местах деревни (мельница, пастбище, опушка лесоруба)
 *      лес тоже не упирается в стены.
 *
 *  Запуск: cd dev && node r49_check.mjs
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
  const THREE = d.THREE;
  const out = {};

  // --- собираем все деревья из инстансов ---
  const trees = [];
  ctx.scene.traverse((o) => {
    if (!o.isInstancedMesh || !/forest/i.test(o.name)) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      trees.push({ x: p.x, z: p.z });
    }
  });
  out.treeCount = trees.length;

  // --- 1. вокруг амбара ---
  const barn = { x: -30, z: 64 };
  out.barn = barn;
  const nearBarn = trees
    .map((t) => ({ t, d: Math.hypot(t.x - barn.x, t.z - barn.z) }))
    .sort((a, b) => a.d - b.d);
  out.barnNearest = nearBarn.length ? +nearBarn[0].d.toFixed(1) : 999;
  // полуразмер амбара 6,15 × 4,15 — считаем по дальнему углу
  out.barnClearBy = +(out.barnNearest - Math.hypot(6.15, 4.15)).toFixed(1);

  // --- 2. поля ---
  out.fields = (ctx.fields || []).map((f) => {
    const inside = trees.filter((t) => Math.abs(t.x - f.x) < f.w / 2 && Math.abs(t.z - f.z) < f.d / 2);
    return {
      field: `${f.x},${f.z}`, inside: inside.length,
      nearest: +Math.min(...trees.map((t) => Math.hypot(t.x - f.x, t.z - f.z))).toFixed(1),
    };
  });

  // --- 3. оформление вырубки ---
  let clearing = null;
  ctx.scene.traverse((o) => {
    if (o.name === 'felledClearing') clearing = o;
  });
  out.clearingPresent = !!clearing;
  // меши слиты по материалам — считаем вершины, а не число объектов
  let verts = 0;
  if (clearing) {
    clearing.traverse((o) => {
      if (o.isMesh && o.geometry) verts += o.geometry.attributes.position.count;
    });
  }
  out.clearingMeshes = clearing ? clearing.children.length : 0;
  out.clearingVerts = verts;
  out.clearingPos = clearing ? [+clearing.position.x.toFixed(1), +clearing.position.z.toFixed(1)] : null;
  // телега у амбара
  let cartFound = false;
  ctx.scene.traverse((o) => {
    if (o.name && o.name.startsWith('cart')) {
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      if (Math.hypot(p.x - barn.x, p.z - barn.z) < 14) cartFound = true;
    }
  });
  out.cartNearBarn = cartFound;

  // --- 4. прочие постройки ---
  out.nearest = {};
  for (const [name, x, z] of [
    ['мельница', 34, -33],
    ['пастбище', -45, 31],
    ['лесоруб', -45, 13],
  ]) {
    let best = 999;
    for (const t of trees) best = Math.min(best, Math.hypot(t.x - x, t.z - z));
    out.nearest[name] = +best.toFixed(1);
  }
  return out;
});

const checks = [
  ['лес вокруг амбара отодвинут', res.barnNearest >= 15],
  ['до стен амбара — пустое поле', res.barnClearBy >= 7],
  ['на полях нет деревьев', res.fields.every((f) => f.inside === 0)],
  ['вырубка собрана', res.clearingPresent && res.clearingVerts > 500],
  ['вырубка стоит у амбара', !!res.clearingPos && Math.hypot(res.clearingPos[0] + 30, res.clearingPos[1] - 64) < 2],
  ['телега у амбара', res.cartNearBarn],
  ['у мельницы лес отодвинут', res.nearest['мельница'] >= 11],
  ['на пастбище лес отодвинут', res.nearest['пастбище'] >= 13],
  ['у опушки лес отодвинут', res.nearest['лесоруб'] >= 9],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
console.log('детали:', JSON.stringify(res));
console.log('ошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 200));
console.log('ошибок:', failed + (errs.length ? 1 : 0));
await browser.close();
process.exit(failed + (errs.length ? 1 : 0) ? 1 : 0);
