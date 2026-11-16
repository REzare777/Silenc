/**
 * Сетка застреваний в нишах второго этажа таверны.
 *
 * Из каждой точки ниши игрок пытается шагнуть в четырёх направлениях.
 * Если он не прошёл — рядом преграда; определяем, какая это стена/предмет
 * и есть ли у неё видимая геометрия (то есть «стена настоящая» или «невидимая»).
 *
 * Запуск: cd dev && node niche_grid.mjs
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
await page.waitForTimeout(1000);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('tavern');
  const THREE = d.THREE;
  const group = d.tavernLoc.group;
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  group.updateMatrixWorld(true);
  const names = {};
  for (const [k, v] of Object.entries(d.M)) if (v && v.isMaterial) names[v.uuid] = k;
  const ray = new THREE.Raycaster();

  const p = d.player;
  const boxes = (d.tavernLoc.colliders.boxes || []).map((b, i) => ({ i, ...b }));
  const circles = (d.tavernLoc.colliders.circles || []).map((c, i) => ({ i, ...c }));

  /** Что видно в точке перед игроком: название материала и расстояние. */
  const look = (x, y, z, dx, dz) => {
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    ray.set(new THREE.Vector3(x, y, z), dir);
    ray.far = 2.5;
    const hits = ray.intersectObjects(meshes, false);
    if (!hits.length) return null;
    const m = hits[0].object.material;
    return { mat: names[m && m.uuid] || '?', d: +hits[0].distance.toFixed(2) };
  };

  const walk = (x0, z0, yaw, frames = 26) => {
    p.teleport(x0, z0, yaw);
    p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
    const s = { x: p.pos.x, z: p.pos.z };
    for (let i = 0; i < frames; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
    return { s, e: { x: p.pos.x, z: p.pos.z } };
  };

  const dirs = [
    { yaw: 0, dx: 0, dz: -1, label: 'назад (-z)' },
    { yaw: Math.PI, dx: 0, dz: 1, label: 'вперёд (+z)' },
    { yaw: Math.PI / 2, dx: -1, dz: 0, label: 'влево (-x)' },
    { yaw: -Math.PI / 2, dx: 1, dz: 0, label: 'вправо (+x)' },
  ];

  const out = [];
  const parts = [
    { name: 'ниша A (у окна)', x0: -3.5, x1: 0.1 },
    { name: 'ниша B (у лестницы)', x0: 0.1, x1: 3.4 },
    { name: 'ниша C (над баром)', x0: 3.4, x1: 6.7 },
  ];

  for (const part of parts) {
    for (let x = part.x0 + 0.45; x < part.x1 - 0.3; x += 0.55) {
      for (let z = 5.9; z <= 8.3; z += 0.6) {
        for (const dir of dirs) {
          const w = walk(x, z, dir.yaw);
          const moved = Math.hypot(w.e.x - w.s.x, w.e.z - w.s.z);
          if (moved > 0.12) continue;           // прошёл — не мешает
          // упёрся: что перед ним?
          const hit = look(w.e.x, 4.25 + 0.5, w.e.z, dir.dx, dir.dz);
          const near = boxes
            .filter((b) => Math.abs(b.cx - w.e.x) < b.hx + 0.5 && Math.abs(b.cz - w.e.z) < b.hz + 0.5
              && b.y1 > 3.4 && b.y0 < 5.2)
            .map((b) => `box#${b.i}(${b.cx.toFixed(2)},${b.cz.toFixed(2)} ${b.hx}×${b.hz})`);
          const nearC = circles
            .filter((c) => Math.hypot(c.x - w.e.x, c.z - w.e.z) < c.r + 0.5)
            .map((c) => `circle#${c.i}(${c.x.toFixed(2)},${c.z.toFixed(2)} r${c.r})`);
          out.push({
            part: part.name, from: `${x.toFixed(2)},${z.toFixed(2)}`, dir: dir.label,
            end: `${w.e.x.toFixed(2)},${w.e.z.toFixed(2)}`,
            visible: hit ? `${hit.mat}@${hit.d}` : 'ничего',
            near: near.concat(nearC).join(' '),
          });
        }
      }
    }
  }
  return out;
});

const byPart = {};
for (const r of res) (byPart[r.part] = byPart[r.part] || []).push(r);
for (const [part, list] of Object.entries(byPart)) {
  console.log(`\n=== ${part}: застреваний ${list.length} ===`);
  for (const r of list) {
    console.log(`  из ${r.from} ${r.dir} → ${r.end}  перед: ${r.visible}`);
    console.log(`      ${r.near || 'рядом коллайдеров нет'}`);
  }
}
console.log('\ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
