/**
 * ============================================================================
 *  Скан «невидимых стенок»: есть ли под коллайдером видимая геометрия
 * ============================================================================
 *
 *  Идея: игрок упирается в невидимую стену там, где есть коллайдер, но рядом
 *  нет ни одного меша. Для каждого коллайдера считаем его AABB и ищем меши,
 *  чей мировой AABB пересекается с ним. Пересечений нет — коллайдер «висячий».
 *
 *  Лес и подлесок исключены (16 000 инстансов) — они не являются стенками.
 *
 *  Запуск: cd dev && node wall_scan.mjs
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
  const THREE = d.THREE;
  const boxes = d.ctx.colliders.boxes || [];
  const circles = d.ctx.colliders.circles || [];

  // меши с мировыми габаритами (лес и подлесок пропускаем)
  const items = [];
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const n = (o.name || '').toLowerCase();
    if (n.includes('forest') || n.includes('undergrowth') || n.includes('foliage')) return;
    if (o.isInstancedMesh && o.count > 400) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return;
    items.push({ b, mat: (o.material && o.material.name) || '?', name: o.name || '' });
  });

  const colBox = (cx, cz, hx, hz, ang, y0, y1) => {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
    const ex = hx * c + hz * s, ez = hx * s + hz * c;
    return new THREE.Box3(
      new THREE.Vector3(cx - ex, y0, cz - ez),
      new THREE.Vector3(cx + ex, y1, cz + ez));
  };

  const ghosts = [];
  const seen = [];
  for (const b of boxes) {
    const y0 = b.y0 !== undefined ? b.y0 : 0, y1 = b.y1 !== undefined ? b.y1 : 2.4;
    const cb = colBox(b.cx, b.cz, b.hx, b.hz, b.ang || 0, y0, y1);
    let n = 0;
    for (const it of items) if (it.b.intersectsBox(cb)) { n++; if (n === 1) seen.push(it); }
    if (!n) {
      ghosts.push({
        t: 'box', x: +b.cx.toFixed(1), z: +b.cz.toFixed(1),
        w: +(b.hx * 2).toFixed(2), d: +(b.hz * 2).toFixed(2),
        a: +(b.ang || 0).toFixed(2), y: `${(+y0.toFixed(1))}..${(+y1.toFixed(1))}`,
      });
    }
  }
  for (const c of circles) {
    const y0 = c.y0 || 0, y1 = c.y1 || 2.2;
    const cb = colBox(c.x, c.z, c.r, c.r, 0, y0, y1);
    let n = 0;
    for (const it of items) if (it.b.intersectsBox(cb)) { n++; if (n === 1) seen.push(it); }
    if (!n) ghosts.push({ t: 'circle', x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: c.r, y: `${(+y0.toFixed(1))}..${(+y1.toFixed(1))}` });
  }
  return { boxes: boxes.length, circles: circles.length, ghosts, meshes: items.length };
});

console.log(`мешей учтено: ${res.meshes} | коллайдеров: ${res.boxes} боксов + ${res.circles} кругов`);
console.log(`«висячих» (видимой геометрии нет): ${res.ghosts.length}\n`);
const byZone = {};
for (const g of res.ghosts) {
  const key = `${Math.round(g.x / 5) * 5},${Math.round(g.z / 5) * 5}`;
  (byZone[key] = byZone[key] || []).push(g);
}
for (const [k, list] of Object.entries(byZone).sort()) {
  console.log(`— зона ${k} (${list.length}) —`);
  for (const g of list.slice(0, 10)) console.log('   ', JSON.stringify(g));
  if (list.length > 10) console.log(`    … ещё ${list.length - 10}`);
}
console.log('\nошибки:', errs.length, errs.slice(0, 3));
await browser.close();
