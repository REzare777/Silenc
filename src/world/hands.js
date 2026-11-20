/**
 * ============================================================================
 *  Руки персонажа от первого лица
 * ============================================================================
 *
 *  Чтобы взять предмет, нужны руки. Они не висели в кадре постоянно:
 *  модель появляется только тогда, когда игрок что-то держит, и исчезает,
 *  когда предмет убран.
 *
 *  Каноническая ориентация кисти (в пространстве камеры):
 *    −Z — вперёд (по направлению пальцев),  +Y — вверх (внутренняя сторона
 *    ладони),  +X — вправо. Предплечье уходит назад и вниз, поэтому рука
 *    входит в кадр снизу и не занимает пол-экрана.
 *
 *  Захваты (grip) — то, как именно предмет лежит в руках:
 *
 *  | захват  | что делают руки                              | для чего           |
 *  |---------|----------------------------------------------|--------------------|
 *  | `two`   | правая держит предмет, левая поддерживает    | рыба, две банки    |
 *  | `right` | только правая, пальцы сжаты                  | палка, нож         |
 *  | `left`  | только левая                                 | фонарь, кружка     |
 *  | `point` | правая вытянута вперёд, левая прижата к телу  | указание           |
 *
 *  Позы (pose) — как подняты руки:
 *  `present` (показать перед собой), `carry` (нести внизу),
 *  `reach` (тянуться вперёд).
 *
 *  Всё процедурное и низкополигональное, как и весь остальной мир.
 *
 *  @module world/hands
 */

import * as THREE from 'three';
import { Builder, box, cyl, sphere, mat } from './geo.js';

/**
 * Наклон предплечья: ось рукава повёрнута почти вертикально вниз
 * (и чуть назад), поэтому предплечье уходит за нижний край кадра,
 * а запястье спрятано под ладонью.
 */
const FOREARM_TILT = 2.77;

/**
 * Материалы рук: кожа, рубаха, кожаный манжет.
 *
 * @returns {object} набор материалов
 */
function handMaterials() {
  return {
    skin: new THREE.MeshStandardMaterial({ color: 0xc08d68, roughness: 0.8, metalness: 0.0, transparent: true }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x55533f, roughness: 0.98, metalness: 0.0, transparent: true }),
    cuff: new THREE.MeshStandardMaterial({ color: 0x3d3021, roughness: 0.95, metalness: 0.0, transparent: true }),
  };
}

/**
 * Одна рука: предплечье, кисть, пальцы.
 *
 * @param {object} mats материалы
 * @param {boolean} left левая ли рука
 * @returns {THREE.Group} группа руки
 */
function buildArm(mats, left) {
  const group = new THREE.Group();
  group.name = left ? 'armLeft' : 'armRight';
  const B = new Builder();
  const s = left ? -1 : 1;

  // ---- предплечье: уходит вниз (и чуть назад) ----
  const L = 0.40;
  const ax = Math.cos(FOREARM_TILT);   // вдоль оси рукава: вниз
  const az = Math.sin(FOREARM_TILT);   // и чуть назад
  B.add(cyl(0.036, 0.05, L, 8), 'sleeve', mat(0, ax * L / 2, az * L / 2, 0, FOREARM_TILT));
  // манжета у запястья
  B.add(cyl(0.04, 0.04, 0.028, 8), 'cuff',
    mat(0, ax * 0.03, az * 0.03, 0, FOREARM_TILT));

  // ---- кисть: ладонь лежит плашмя, внутренней стороной вверх ----
  B.add(box(0.084, 0.028, 0.095), 'skin', mat(0, 0, -0.05));
  // пальцы — идут вперёд (−Z) и загибаются вверх
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.0205;
    const curl = 0.34 + i * 0.07;
    B.add(box(0.0155, 0.0155, 0.062), 'skin',
      mat(x, 0.008, -0.122, 0, -curl, 0));
    B.add(sphere(0.0085, 5, 4), 'skin', mat(x, 0.03, -0.15));
  }
  // большой палец — сбоку, приоткрыт
  B.add(box(0.02, 0.018, 0.045), 'skin',
    mat(s * 0.045, 0.004, -0.05, 0, -0.3, s * 0.32));

  group.add(B.build(mats, null, { name: left ? 'handL' : 'handR' }));

  // точка захвата: предмет лежит на ладони
  const hold = new THREE.Group();
  hold.position.set(0, 0.016, -0.05);
  group.add(hold);
  group.userData.hold = hold;
  group.userData.side = left ? -1 : 1;
  return group;
}

/**
 * Позы: положение кистей в пространстве камеры.
 * pos — смещение от центра камеры, rot — поворот (X, Y, Z).
 */
const POSES = {
  two: {
    present: {
      right: { pos: [0.105, -0.095, -0.40], rot: [0.26, -0.26, 0.05] },
      left: { pos: [-0.145, -0.195, -0.43], rot: [0.28, 0.22, -0.05] },
    },
    carry: {
      right: { pos: [0.115, -0.215, -0.34], rot: [0.22, -0.22, 0.04] },
      left: { pos: [-0.135, -0.305, -0.35], rot: [0.24, 0.18, -0.04] },
    },
    reach: {
      right: { pos: [0.095, -0.135, -0.50], rot: [0.14, -0.22, 0.04] },
      left: { pos: [-0.135, -0.235, -0.51], rot: [0.16, 0.18, -0.04] },
    },
  },
  right: {
    present: {
      right: { pos: [0.085, -0.125, -0.40], rot: [0.10, -0.16, 0.04] },
    },
    carry: {
      right: { pos: [0.095, -0.245, -0.33], rot: [0.16, -0.14, 0.03] },
    },
    reach: {
      right: { pos: [0.075, -0.155, -0.54], rot: [0.30, -0.12, 0.02] },
    },
  },
  left: {
    present: {
      left: { pos: [-0.085, -0.125, -0.40], rot: [0.10, 0.16, -0.04] },
    },
    carry: {
      left: { pos: [-0.095, -0.245, -0.33], rot: [0.16, 0.14, -0.03] },
    },
    reach: {
      left: { pos: [-0.075, -0.155, -0.54], rot: [0.30, 0.12, -0.02] },
    },
  },
  point: {
    present: {
      right: { pos: [0.06, -0.115, -0.48], rot: [0.42, -0.10, 0.02] },
      left: { pos: [-0.125, -0.275, -0.32], rot: [0.02, 0.22, -0.06] },
    },
    carry: {
      right: { pos: [0.07, -0.225, -0.40], rot: [0.34, -0.10, 0.02] },
      left: { pos: [-0.125, -0.295, -0.30], rot: [0.02, 0.22, -0.06] },
    },
    reach: {
      right: { pos: [0.05, -0.135, -0.60], rot: [0.52, -0.06, 0.01] },
      left: { pos: [-0.125, -0.285, -0.30], rot: [0.02, 0.22, -0.06] },
    },
  },
};

/**
 * Собрать пару рук с разными захватами.
 *
 * @returns {object} { group, right, left, setPose }
 */
export function buildHands() {
  const mats = handMaterials();
  const group = new THREE.Group();
  group.name = 'viewHands';

  const right = buildArm(mats, false);
  const left = buildArm(mats, true);
  group.add(right, left);

  /**
   * Поставить руки в позу.
   *
   * @param {string} grip 'two' | 'right' | 'left' | 'point'
   * @param {string} [pose] 'present' | 'carry' | 'reach'
   */
  function setPose(grip = 'two', pose = 'present') {
    const g = POSES[grip] ? grip : 'two';
    const p = POSES[g][pose] ? pose : 'present';
    const spec = POSES[g][p];

    right.visible = !!spec.right;
    left.visible = !!spec.left;

    if (spec.right) {
      right.position.fromArray(spec.right.pos);
      right.rotation.set(spec.right.rot[0], spec.right.rot[1], spec.right.rot[2]);
    }
    if (spec.left) {
      left.position.fromArray(spec.left.pos);
      left.rotation.set(spec.left.rot[0], spec.left.rot[1], spec.left.rot[2]);
    }
  }

  setPose('two', 'present');
  return { group, right, left, setPose, mats };
}

/**
 * Положение удерживаемого предмета относительно точки захвата.
 *
 * @param {string} grip захват
 * @returns {{pos: number[], rot: number[]}} смещение и поворот
 */
export function holdTransform(grip) {
  switch (grip) {
    case 'right':
      // предмет зажат в кулаке, чуть выше ладони
      return { pos: [-0.01, 0.055, 0.0], rot: [0.15, 0.0, 1.02] };
    case 'left':
      return { pos: [0.01, 0.055, 0.0], rot: [0.15, 0.0, -1.02] };
    case 'point':
      return { pos: [0, 0.0, 0.03], rot: [0.1, 0, 0] };
    case 'two':
    default:
      // предмет лежит поперёк ладоней, головой вправо
      return { pos: [-0.115, 0.0, 0.0], rot: [0.04, 0.0, 0.04] };
  }
}
