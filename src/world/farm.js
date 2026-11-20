/**
 * ============================================================================
 *  Хозяйственные постройки: курятники и загон для овец
 * ============================================================================
 *
 *  Животным нужны свои места:
 *
 *   * **Курятники** — небольшие деревянные будки на сваях с трамплином.
 *     Стоят у дома, в стороне от мельницы и пруда;
 *   * **Загон (пастбище)** — огороженный луг с навесом, поилкой и
 *     кустами. Там овцы пасутся и сидят.
 *
 *  @module world/farm
 */

import * as THREE from 'three';
import { Builder, box, cyl, cone, mat } from './geo.js';

/**
 * Курятник: будка на сваях, трамплин, жердочка и гнездо.
 *
 * @param {object} M материалы мира
 * @param {{w?: number, d?: number, legH?: number}} [opts] параметры
 * @returns {THREE.Group} группа модели
 */
export function chickenCoop(M, opts = {}) {
  const { w = 1.7, d = 1.25, legH = 0.85 } = opts;
  const B = new Builder();

  // сваи
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.add(cyl(0.075, 0.09, legH, 6), 'timber',
      mat(sx * (w / 2 - 0.18), legH / 2, sz * (d / 2 - 0.16)));
  }
  // настил
  B.put('plank', w, 0.08, d, 0, legH, 0);

  // стенки будки (передняя — с проёмом)
  const bh = 0.95;
  const t = 0.08;
  B.put('plank', w, bh, t, 0, legH + 0.04 + bh / 2, -d / 2 + t / 2);         // задняя
  B.put('plank', t, bh, d, -w / 2 + t / 2, legH + 0.04 + bh / 2, 0);         // левая
  B.put('plank', t, bh, d, w / 2 - t /  2, legH + 0.04 + bh / 2, 0);         // правая
  // передняя стенка с дверцей
  const doorW = 0.5, doorH = 0.55;
  const sideW = (w - doorW) / 2;
  B.put('plank', sideW, bh, t, -(doorW / 2 + sideW / 2), legH + 0.04 + bh / 2, d / 2 - t / 2);
  B.put('plank', sideW, bh, t, doorW / 2 + sideW / 2, legH + 0.04 + bh / 2, d / 2 - t / 2);
  B.put('plank', doorW, bh - doorH, t, 0, legH + 0.04 + doorH + (bh - doorH) / 2, d / 2 - t / 2);
  // тьма в проёме
  B.put('timber', doorW - 0.04, doorH - 0.04, 0.03, 0, legH + 0.04 + doorH / 2, d / 2 - t - 0.01);

  // двускатная крыша
  const roofH = 0.42, roofD = d + 0.34, roofW = w + 0.3;
  for (const s of [-1, 1]) {
    const slope = box(roofW, 0.07, roofD / 2 * 1.42);
    const m = new THREE.Matrix4().makeRotationX(s * 0.62);
    m.setPosition(0, legH + 0.04 + bh + roofH / 2 - 0.04, s * roofD / 4);
    B.add(slope, 'tileSlate', m);
  }
  // конёк
  B.add(box(roofW, 0.08, 0.16, 1), 'timber', mat(0, legH + 0.04 + bh + roofH - 0.04, 0));

  // трамплин от земли к дверце
  const rampLen = 1.15;
  const ramp = box(0.52, 0.06, rampLen);
  const rm = new THREE.Matrix4().makeRotationX(-0.72);
  rm.setPosition(0, legH / 2 + 0.08, d / 2 + rampLen / 2 - 0.18);
  B.add(ramp, 'plank', rm);
  // поперечные планки-ступеньки на трамплине
  for (let i = 0; i < 4; i++) {
    const t2 = i / 3;
    const y = 0.1 + t2 * (legH - 0.06);
    const z = d / 2 + rampLen * (1 - t2) - 0.1;
    B.add(box(0.5, 0.045, 0.07, 1), 'timber', mat(0, y, z));
  }
  // жердочка под крышей
  B.add(cyl(0.035, 0.035, w - 0.2, 6), 'timber', mat(0, legH + 0.04 + bh - 0.16, -d / 2 + 0.2, 0, 0, Math.PI / 2));

  // гнездо сбоку
  B.put('plank', 0.62, 0.42, 0.5, w / 2 + 0.3, legH + 0.3, -d / 2 + 0.25);
  B.put('plank', 0.66, 0.06, 0.54, w / 2 + 0.3, legH + 0.52, -d / 2 + 0.25);

  // камень под углом будки, чтобы она не «висела» в воздухе
  B.add(cyl(0.18, 0.24, 0.22, 7), 'stone', mat(-w / 2 - 0.05, 0.11, -d / 2 - 0.05));

  const group = B.build(M, null, { name: 'chickenCoop' });
  return group;
}

/**
 * Навес для овец: три столба, двускатная крыша и соломенный стог
 * у стены — под ним овцы прячутся от дождя.
 *
 * @param {object} M материалы мира
 * @param {{w?: number, d?: number, h?: number}} [opts] параметры
 * @returns {THREE.Group} группа модели
 */
export function sheepShelter(M, opts = {}) {
  const { w = 3.4, d = 2.4, h = 1.9 } = opts;
  const B = new Builder();

  // задняя стенка — из жердей
  for (let i = 0; i < 5; i++) {
    B.add(box(w, 0.1, 0.1, 1), 'timber', mat(0, 0.22 + i * 0.36, -d / 2 + 0.05));
  }
  // столбы
  for (const sx of [-1, 1]) {
    B.add(cyl(0.09, 0.11, h, 7), 'timber', mat(sx * (w / 2 - 0.2), h / 2, -d / 2 + 0.12));
    B.add(cyl(0.08, 0.1, h - 0.2, 7), 'timber', mat(sx * (w / 2 - 0.2), (h - 0.2) / 2, d / 2 - 0.12));
  }
  // поперечина
  B.add(box(w, 0.12, 0.12, 1), 'timber', mat(0, h - 0.18, -d / 2 + 0.12));
  // крыша из жердей и соломы
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.2 + (i / 8) * (w - 0.4);
    const beam = box(0.09, 0.09, d + 0.5);
    const m = new THREE.Matrix4().makeRotationX(0.18);
    m.setPosition(x, h - 0.02, 0);
    B.add(beam, 'timber', m);
  }
  for (const s of [-1, 1]) {
    const slope = box(w + 0.2, 0.14, (d + 0.6) / 2 * 1.5);
    const m = new THREE.Matrix4().makeRotationX(s * 0.42);
    m.setPosition(0, h + 0.12, s * (d + 0.6) / 4);
    B.add(slope, 'thatch', m);
  }
  // соломенный стог у задней стены
  B.add(cyl(0.45, 0.55, 0.9, 9), 'thatch', mat(-w / 2 + 0.7, 0.45, -d / 2 + 0.45));
  B.add(cone(0.42, 0.5, 9), 'thatch', mat(-w / 2 + 0.7, 1.12, -d / 2 + 0.45));

  const group = B.build(M, null, { name: 'sheepShelter' });
  return group;
}
