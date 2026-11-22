/**
 * Проверки парящего оружия (раунд 56).
 *
 * Тест быстрый: считает только геометрию и посадку, без браузера.
 *
 *   node dev/r56_check.mjs
 */
import * as THREE from 'three';
import { WEAPONS, weaponFloat, weaponModel } from '../src/world/weapons.js';

let okCount = 0;
let failCount = 0;

/**
 * Проверка с сообщением.
 *
 * @param {string} name что проверяем
 * @param {boolean} cond условие
 * @param {string} [extra] подробности при ошибке
 */
function ok(name, cond, extra = '') {
  if (cond) {
    okCount++;
    console.log(`✓ ${name}`);
  } else {
    failCount++;
    console.log(`✗ ${name} ${extra}`);
  }
}

/* ---- посадка ---- */
for (const spec of WEAPONS) {
  const f = weaponFloat(spec);
  const okPos = Array.isArray(f.pos) && f.pos.length === 3 && f.pos.every((v) => Number.isFinite(v));
  const okRot = Array.isArray(f.rot) && f.rot.length === 3 && f.rot.every((v) => Number.isFinite(v));
  const okScale = f.scale > 0.1 && f.scale < 1;
  ok(`«${spec.name}»: посадка задана`, okPos && okRot && okScale,
    `pos=${f.pos} rot=${f.rot} scale=${f.scale}`);
}

/* ---- оружие целиком помещается в кадр ---- */
const cam = new THREE.PerspectiveCamera(58, 800 / 500, 0.01, 12);
cam.position.set(0, 0, 0);
cam.lookAt(0, 0, -1);
cam.updateMatrixWorld(true);
cam.updateProjectionMatrix();

for (const spec of WEAPONS) {
  const model = weaponModel(spec.id);
  const f = weaponFloat(spec);
  model.scale.setScalar(f.scale);
  model.position.set(f.pos[0], f.pos[1], f.pos[2]);
  model.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
  model.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model);
  const corners = [];
  for (const x of [b.min.x, b.max.x]) {
    for (const y of [b.min.y, b.max.y]) {
      for (const z of [b.min.z, b.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).project(cam));
      }
    }
  }
  const inside = corners.every((c) => Math.abs(c.x) <= 1.06 && Math.abs(c.y) <= 1.06);
  const inFront = corners.every((c) => c.z > -1 && c.z < 1);
  ok(`«${spec.name}»: целиком в кадре`, inside && inFront,
    `x=${corners.map((c) => c.x.toFixed(2)).join(',')} y=${corners.map((c) => c.y.toFixed(2)).join(',')}`);
}

/* ---- оружие не перекрывает центр кадра ---- */
// центр кадра (0,0) должен остаться свободным от клинка
for (const spec of WEAPONS) {
  const f = weaponFloat(spec);
  // лук висит по центру — он «в руке», остальные смещены вбок
  const centerOk = spec.subclass === 'bow';
  ok(`«${spec.name}»: ${centerOk ? 'по центру' : 'смещено вбок от центра'}`,
    centerOk || f.pos[0] > 0.02, `x=${f.pos[0]}`);
}

/* ---- клинок смотрит вперёд, а не вверх ---- */
for (const spec of WEAPONS) {
  if (spec.subclass !== 'blade') continue;
  const f = weaponFloat(spec);
  const v = new THREE.Vector3(0, 1, 0)
    .applyEuler(new THREE.Euler(f.rot[0], f.rot[1], f.rot[2]));
  ok(`«${spec.name}»: клинок направлен вперёд`, v.z < -0.15,
    `z=${v.z.toFixed(2)}`);
}

/* ---- лук: настоящая дуга с тетивой и стрелой ---- */
{
  const bow = weaponModel('bow');
  let meshes = 0;
  bow.traverse((o) => { if (o.isMesh) meshes++; });
  const b = new THREE.Box3().setFromObject(bow);
  const h = b.max.y - b.min.y;
  const w = b.max.x - b.min.x;
  ok('«Лук»: модель собрана из многих частей', meshes >= 20, meshes);
  ok('«Лук»: высота дуги около 1,6 м', h > 1.4 && h < 2.0, h.toFixed(2));
  ok('«Лук»: плоскость лука вертикальна', w < 0.12, w.toFixed(3));
  ok('«Лук»: стрека уходит вперёд по −Z', b.min.z < -0.4, b.min.z.toFixed(2));
}

console.log(`\nr56_check: ${okCount} ok, ${failCount} fail`);
process.exit(failCount ? 1 : 0);
