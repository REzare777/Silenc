/**
 * ============================================================================
 *  Руки персонажа от первого лица
 * ============================================================================
 *
 *  Чтобы взять предмет, нужны руки. Раньше кисть была плоской «плиткой»
 *  с четырьмя отдельными кубиками-пальцами — в кадре это читалось как
 *  доска, а не как рука. Теперь кисть устроена как настоящая:
 *
 *  * объёмная ладонь со скруглёнными боками;
 *  * четыре пальца, у каждого два сустава (палец складывается в два
 *    сгиба, а не просто наклоняется);
 *  * костяшки, которые видны, когда кулак сжат;
 *  * большой палец с двумя фалангами — он прижимается к кулаку сверху.
 *
 *  Два состояния кисти:
 *
 *  | состояние | когда               | как выглядит            |
 *  |-----------|---------------------|-------------------------|
 *  | `fist`    | держим оружие       | кулак, пальцы сжаты     |
 *  | `open`    | показываем предмет   | ладонь раскрыта         |
 *
 *  Сжатие и раскрытие — плавные: `setFist()` задаёт цель, а `update()`
 *  подводит пальцы к ней за доли секунды.
 *
 *  Анатомия сгибов
 *  --------------
 *  У каждого пальца два настоящих сустава: пястной (у основания) и
 *  средний (между фалангами). В кулаке проксимальная фаланга уходит
 *  вниз-вперёд, а дистальная загибается ОБРАТНО к ладони — именно
 *  этот обратный сгиб отличает кулак от «ложки». Костяшка у основания
 *  остаётся на месте и образует верхний контур кулака.
 *
 *  Каноническая ориентация кисти (в пространстве камеры):
 *    −Z — вперёд (по направлению пальцев),  +Y — вверх (тыльная сторона
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
    skinLight: new THREE.MeshStandardMaterial({ color: 0xd2a07a, roughness: 0.78, metalness: 0.0, transparent: true }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x55533f, roughness: 0.98, metalness: 0.0, transparent: true }),
    cuff: new THREE.MeshStandardMaterial({ color: 0x3d3021, roughness: 0.95, metalness: 0.0, transparent: true }),
  };
}

/**
 * Один палец: две фаланги, два сустава, костяшка и подушечка.
 *
 *  Устройство:
 *    `base`  — пястной сустав (вращает проксимальную фалангу);
 *    `joint` — средний сустав (вращает дистальную фалангу).
 *  Костяшка (`knuckle`) лежит вне `base`, поэтому остаётся на месте
 *  при сгибе — как в настоящей руке.
 *
 * @param {object} mats материалы
 * @param {number} i номер пальца (0 — указательный, 3 — мизинец)
 * @returns {THREE.Group} группа пальца
 */
function buildFinger(mats, i) {
  const g = new THREE.Group();
  g.name = `finger${i}`;

  // бугорок основания — костяшка, остаётся на месте при сгибе
  const knuckle = new THREE.Mesh(sphere(0.0128, 8, 6), mats.skinLight);
  knuckle.name = 'knuckle';
  knuckle.position.set(0, 0.0085, -0.002);
  knuckle.scale.set(1.02, 0.80, 1.08);
  g.add(knuckle);

  // пястный сустав
  const base = new THREE.Group();
  g.add(base);

  // проксимальная фаланга — от основания вперёд
  const prox = new THREE.Mesh(box(0.0168, 0.0195, 0.026), mats.skin);
  prox.name = 'prox';
  prox.position.set(0, 0, -0.013);
  prox.castShadow = true;
  base.add(prox);

  // сухожилие на тыльной стороне — читается, когда палец согнут
  const tendon = new THREE.Mesh(box(0.0080, 0.0050, 0.016), mats.skinLight);
  tendon.name = 'tendon';
  tendon.position.set(0, 0.0085, -0.011);
  base.add(tendon);

  // средний сустав
  const joint = new THREE.Group();
  joint.position.set(0, 0, -0.026);
  base.add(joint);

  const dist = new THREE.Mesh(box(0.0150, 0.0172, 0.020), mats.skin);
  dist.name = 'dist';
  dist.position.set(0, 0, -0.010);
  dist.castShadow = true;
  joint.add(dist);

  // подушечка пальца
  const pad = new THREE.Mesh(sphere(0.0068, 7, 5), mats.skinLight);
  pad.name = 'pad';
  pad.position.set(0, -0.0058, -0.0195);
  pad.scale.set(1, 0.8, 1.1);
  joint.add(pad);

  const tip = new THREE.Mesh(sphere(0.0086, 7, 6), mats.skin);
  tip.name = 'tip';
  tip.position.set(0, 0, -0.021);
  tip.scale.set(0.9, 0.95, 1.1);
  joint.add(tip);

  g.userData.base = base;
  g.userData.joint = joint;
  g.userData.prox = prox;
  return g;
}

/**
 * Большой палец: короткие фаланги, прижимается к кулаку сбоку.
 *
 * @param {object} mats материалы
 * @param {number} side −1 для левой руки, +1 для правой
 * @returns {THREE.Group} группа пальца
 */
function buildThumb(mats, side) {
  const g = new THREE.Group();
  g.name = 'thumb';

  // бугорок основания
  const knuckle = new THREE.Mesh(sphere(0.0108, 8, 6), mats.skinLight);
  knuckle.name = 'thumbKnuckle';
  knuckle.position.set(side * 0.002, 0.010, -0.002);
  knuckle.scale.set(1, 0.9, 1);
  g.add(knuckle);

  const base = new THREE.Group();
  g.add(base);

  const prox = new THREE.Mesh(box(0.017, 0.018, 0.030), mats.skin);
  prox.name = 'thumbProx';
  prox.position.set(0, 0, -0.015);
  prox.castShadow = true;
  base.add(prox);

  const joint = new THREE.Group();
  joint.position.set(0, 0, -0.030);
  base.add(joint);

  const dist = new THREE.Mesh(box(0.0152, 0.0152, 0.024), mats.skin);
  dist.name = 'thumbDist';
  dist.position.set(0, 0, -0.012);
  dist.castShadow = true;
  joint.add(dist);

  const pad = new THREE.Mesh(sphere(0.0072, 6, 5), mats.skinLight);
  pad.name = 'thumbPad';
  pad.position.set(0, -0.005, -0.024);
  pad.scale.set(1, 0.8, 1.05);
  joint.add(pad);

  const tip = new THREE.Mesh(sphere(0.0088, 7, 6), mats.skin);
  tip.name = 'thumbTip';
  tip.position.set(0, 0, -0.026);
  tip.scale.set(0.92, 0.95, 1.08);
  joint.add(tip);

  g.userData.base = base;
  g.userData.joint = joint;
  g.userData.side = side;
  return g;
}

/**
 * Одна рука: предплечье, кулак с пальцами, точка захвата.
 *
 * @param {object} mats материалы
 * @param {boolean} left левая ли рука
 * @returns {object} { group, setFist, update, wrist, fingers, thumb, hold }
 */
function buildArm(mats, left) {
  const group = new THREE.Group();
  group.name = left ? 'armLeft' : 'armRight';
  const s = left ? -1 : 1;

  /* ---- предплечье: уходит вниз (и чуть назад) ---- */
  const B = new Builder();
  const L = 0.40;
  const ax = Math.cos(FOREARM_TILT);   // вдоль оси рукава: вниз
  const az = Math.sin(FOREARM_TILT);   // и чуть назад
  B.add(cyl(0.036, 0.05, L, 8), 'sleeve', mat(0, ax * L / 2, az * L / 2, 0, FOREARM_TILT));
  B.add(cyl(0.04, 0.04, 0.028, 8), 'cuff', mat(0, ax * 0.03, az * 0.03, 0, FOREARM_TILT));
  group.add(B.build(mats, null, { name: left ? 'handL' : 'handR' }));

  /* ---- кисть ---- */
  const wrist = new THREE.Group();
  group.add(wrist);

  // запястье — округлое соединение с предплечьем (ниже костяшек, чтобы
  // верхний контур кулака читался, а не превращался в гладкий купол)
  const wristBall = new THREE.Mesh(sphere(0.032, 9, 7), mats.skin);
  wristBall.name = 'wristBall';
  wristBall.scale.set(1.02, 0.48, 0.95);
  wristBall.position.set(0, -0.004, 0.007);
  wrist.add(wristBall);

  // ладонь: мягкий объём из трёх «подушек» — без острых рёбер
  const palm = new THREE.Mesh(sphere(0.030, 10, 8), mats.skin);
  palm.name = 'palm';
  palm.scale.set(1.12, 0.58, 1.02);
  palm.position.set(0, -0.004, -0.024);
  palm.castShadow = true;
  wrist.add(palm);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(sphere(0.024, 9, 7), mats.skin);
    side.name = 'palmSide';
    side.scale.set(0.85, 0.60, 1.0);
    side.position.set(sx * 0.029, -0.004, -0.026);
    wrist.add(side);
  }
  // скругление ладони спереди
  const front = new THREE.Mesh(sphere(0.030, 9, 7), mats.skin);
  front.name = 'front';
  front.scale.set(1.0, 0.52, 0.55);
  front.position.set(0, -0.001, -0.040);
  wrist.add(front);
  // тыльная сторона ладони — плоская, чтобы костяшки читались на её фоне
  const back = new THREE.Mesh(sphere(0.028, 9, 7), mats.skin);
  back.name = 'back';
  back.scale.set(1.02, 0.40, 0.76);
  back.position.set(0, -0.003, -0.002);
  wrist.add(back);
  // бугорок у большого пальца (тенар)
  const thenar = new THREE.Mesh(sphere(0.019, 8, 6), mats.skin);
  thenar.name = 'thenar';
  thenar.scale.set(0.85, 1.0, 1.25);
  thenar.position.set(s * 0.030, 0.004, -0.018);
  wrist.add(thenar);

  /* ---- пальцы ---- */
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = buildFinger(mats, i);
    // мизинец чуть короче и ниже — рука не «плоская»
    const drop = i === 3 ? -0.004 : i === 0 ? 0.002 : 0;
    f.position.set((i - 1.5) * 0.0192, 0.006 + drop, -0.049);
    f.rotation.z = (i - 1.5) * 0.03;
    wrist.add(f);
    fingers.push(f);
  }

  /* ---- большой палец ---- */
  const thumb = buildThumb(mats, s);
  thumb.position.set(s * 0.033, 0.002, -0.013);
  wrist.add(thumb);

  /* ---- точка захвата: центр кулака, где проходит рукоять ----
     Смещён в сторону большого пальца: рукоять проходит именно там,
     где палец её зажимает, — так хват читается по-настоящему. */
  const hold = new THREE.Group();
  hold.position.set(s * 0.013, -0.008, -0.034);
  group.add(hold);
  group.userData.hold = hold;
  group.userData.side = left ? -1 : 1;

  /* ---- состояние сжатия ---- */
  const state = {
    a: 1,            // 1 — кулак, 0 — раскрытая ладонь
    target: 1,
  };

  // Углы сгиба: раскрытая ладонь / сжатый кулак.
  // Пястной сустав сгибается первым, потом подворачивается кончик:
  // в кулаке дистальная фаланга лежит ПОПЕРЁК ладони, а её кончик
  // упирается в ладонь — именно так устроен настоящий кулак.
  const OPEN_PROX = -0.22, FIST_PROX = -1.35;
  const OPEN_MID_ABS = -0.52, FIST_MID_ABS = 2.60;

  /**
   * Задать состояние кисти.
   *
   * @param {boolean} on true — сжать в кулак
   */
  function setFist(on) {
    state.target = on ? 1 : 0;
  }

  /**
   * Плавно подвести пальцы к нужному состоянию.
   *
   * @param {number} dt кадр в секундах
   */
  function update(dt) {
    if (Math.abs(state.a - state.target) < 0.001) {
      state.a = state.target;
    } else {
      state.a += (state.target - state.a) * Math.min(1, dt * 11);
    }
    const a = state.a;
    // сначала сгибается пястной сустав, потом подворачивается кончик
    const a1 = Math.min(1, a / 0.6);
    const a2 = Math.max(0, (a - 0.6) / 0.4);
    for (const f of fingers) {
      const base = OPEN_PROX + (FIST_PROX - OPEN_PROX) * a1;
      const mid = OPEN_MID_ABS + (FIST_MID_ABS - OPEN_MID_ABS) * a2;
      f.userData.base.rotation.x = base;
      f.userData.joint.rotation.x = mid - base;
      // сжатый кулак чуть поджимает пальцы к центру
      f.position.x = (f.position.x / 0.0192) * (0.0192 - 0.0022 * a);
    }
    // большой палец: отставлен или прижат к боку кулака
    thumb.userData.base.rotation.z = -s * (0.78 + 0.42 * a);
    thumb.userData.base.rotation.x = -0.12 - 0.02 * a;
    thumb.userData.joint.rotation.x = -0.30 + 0.25 * a;
  }

  update(0);

  // отладочные хуки: сколько сжата кисть и где её пальцы
  group.userData.fistAmount = () => state.a;
  group.userData.fingers = fingers;
  group.userData.thumb = thumb;

  return { group, setFist, update, wrist, fingers, thumb, hold };
}

/**
 * Позы: положение кистей в пространстве камеры.
 * pos — смещение от центра камеры, rot — поворот (X, Y, Z),
 * fist — сжат ли кулак.
 */
const POSES = {
  two: {
    present: {
      right: { pos: [0.105, -0.095, -0.40], rot: [0.26, -0.26, 0.05], fist: false },
      left: { pos: [-0.145, -0.195, -0.43], rot: [0.28, 0.22, -0.05], fist: false },
    },
    carry: {
      right: { pos: [0.115, -0.215, -0.34], rot: [0.22, -0.22, 0.04], fist: false },
      left: { pos: [-0.135, -0.305, -0.35], rot: [0.24, 0.18, -0.04], fist: false },
    },
    reach: {
      right: { pos: [0.095, -0.135, -0.50], rot: [0.14, -0.22, 0.04], fist: false },
      left: { pos: [-0.135, -0.235, -0.51], rot: [0.16, 0.18, -0.04], fist: false },
    },
  },
  right: {
    present: {
      right: { pos: [0.085, -0.125, -0.40], rot: [0.10, -0.16, 0.04], fist: true },
    },
    carry: {
      right: { pos: [0.095, -0.245, -0.33], rot: [0.16, -0.14, 0.03], fist: true },
    },
    reach: {
      right: { pos: [0.075, -0.155, -0.54], rot: [0.30, -0.12, 0.02], fist: true },
    },
  },
  left: {
    present: {
      left: { pos: [-0.085, -0.125, -0.40], rot: [0.10, 0.16, -0.04], fist: true },
    },
    carry: {
      left: { pos: [-0.095, -0.245, -0.33], rot: [0.16, 0.14, -0.03], fist: true },
    },
    reach: {
      left: { pos: [-0.075, -0.155, -0.54], rot: [0.30, 0.12, -0.02], fist: true },
    },
  },
  point: {
    present: {
      right: { pos: [0.06, -0.115, -0.48], rot: [0.42, -0.10, 0.02], fist: false },
      left: { pos: [-0.125, -0.275, -0.32], rot: [0.02, 0.22, -0.06], fist: true },
    },
    carry: {
      right: { pos: [0.07, -0.225, -0.40], rot: [0.34, -0.10, 0.02], fist: false },
      left: { pos: [-0.125, -0.295, -0.30], rot: [0.02, 0.22, -0.06], fist: true },
    },
    reach: {
      right: { pos: [0.05, -0.135, -0.60], rot: [0.52, -0.06, 0.01], fist: false },
      left: { pos: [-0.125, -0.285, -0.30], rot: [0.02, 0.22, -0.06], fist: true },
    },
  },
};

/**
 * Позы для оружия: обе руки заданы явно, потому что у оружия свой хват.
 *
 * Ключ — вид оружия: одноручный клинок, двуручный, лук, посох. Отдельно
 * описан хват «факел в левой руке» — так в подземелье игрок держит в правой
 * руке меч, а в левой горящий бранд.
 */
const WEAPON_POSES = {
  sword: {
    // одноручный хват: правая сжата в кулак, левая свободно у бедра
    right: { pos: [0.155, -0.115, -0.290], rot: [0.10, -0.22, 0.08], fist: true },
    left: { pos: [-0.185, -0.300, -0.26], rot: [0.22, 0.28, -0.06], fist: false },
  },
  sword2: {
    // двуручный хват: правая у навершия, левая — впереди по рукояти
    right: { pos: [0.135, -0.075, -0.300], rot: [0.12, -0.26, 0.10], fist: true },
    left: { pos: [0.105, -0.093, -0.350], rot: [0.12, -0.26, 0.10], fist: true },
  },
  bow: {
    // лук: левая вытянута вперёд и держит лук, правая у плеча натягивает тетиву
    right: { pos: [0.170, -0.125, -0.320], rot: [0.22, -0.32, 0.14], fist: true },
    left: { pos: [-0.150, -0.235, -0.420], rot: [0.0, 0.05, 0.03], fist: true },
  },
  staff: {
    // посох: правая сжата на древке, левая поддерживает ниже
    right: { pos: [0.125, -0.165, -0.38], rot: [0.14, -0.18, 0.06], fist: true },
    left: { pos: [-0.135, -0.295, -0.33], rot: [0.26, 0.20, -0.05], fist: true },
  },
  torchLeft: {
    // факел в левой руке: ладонь раскрыта, горит вверх
    left: { pos: [-0.135, -0.165, -0.42], rot: [0.36, 0.14, -0.12], fist: false },
  },
  torchRight: {
    // факел в правой руке (как раньше, когда оружия нет)
    right: { pos: [0.105, -0.145, -0.40], rot: [0.20, -0.18, 0.05], fist: true },
  },
};

/**
 * Собрать пару рук с разными захватами.
 *
 * @returns {object} { group, right, left, setPose, setArms, update }
 */
export function buildHands() {
  const mats = handMaterials();
  const group = new THREE.Group();
  group.name = 'viewHands';

  const right = buildArm(mats, false);
  const left = buildArm(mats, true);
  group.add(right.group, left.group);
  // доступ к сжатию кисти снаружи (тесты, отладка)
  right.group.userData.setFist = right.setFist;
  left.group.userData.setFist = left.setFist;

  /**
   * Поставить руки в позу предмета.
   *
   * @param {string} grip 'two' | 'right' | 'left' | 'point'
   * @param {string} [pose] 'present' | 'carry' | 'reach'
   */
  function setPose(grip = 'two', pose = 'present') {
    const g = POSES[grip] ? grip : 'two';
    const p = POSES[g][pose] ? pose : 'present';
    const spec = POSES[g][p];

    right.group.visible = !!spec.right;
    left.group.visible = !!spec.left;

    if (spec.right) {
      right.group.position.fromArray(spec.right.pos);
      right.group.rotation.set(spec.right.rot[0], spec.right.rot[1], spec.right.rot[2]);
      right.setFist(!!spec.right.fist);
    }
    if (spec.left) {
      left.group.position.fromArray(spec.left.pos);
      left.group.rotation.set(spec.left.rot[0], spec.left.rot[1], spec.left.rot[2]);
      left.setFist(!!spec.left.fist);
    }
  }

  /**
   * Поставить руки в позу оружия.
   *
   * @param {string} name имя позы из WEAPON_POSES
   * @param {string} [leftName] поза для левой руки (например, факел)
   */
  function setArms(name, leftName) {
    const spec = WEAPON_POSES[name] || null;
    const leftSpec = leftName
      ? ((WEAPON_POSES[leftName] || {}).left || null)
      : (spec ? spec.left : null);
    right.group.visible = !!(spec && spec.right);
    left.group.visible = !!leftSpec;
    if (spec && spec.right) {
      right.group.position.fromArray(spec.right.pos);
      right.group.rotation.set(spec.right.rot[0], spec.right.rot[1], spec.right.rot[2]);
      right.setFist(!!spec.right.fist);
    }
    if (leftSpec) {
      left.group.position.fromArray(leftSpec.pos);
      left.group.rotation.set(leftSpec.rot[0], leftSpec.rot[1], leftSpec.rot[2]);
      left.setFist(!!leftSpec.fist);
    }
  }

  /**
   * Плавная доводка пальцев.
   *
   * @param {number} dt кадр в секундах
   */
  function update(dt) {
    right.update(dt);
    left.update(dt);
  }

  setPose('two', 'present');
  return { group, right: right.group, left: left.group, setPose, setArms, update, mats };
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
      return { pos: [-0.01, 0.05, 0.0], rot: [0.15, 0.0, 1.02] };
    case 'left':
      return { pos: [0.01, 0.05, 0.0], rot: [0.15, 0.0, -1.02] };
    case 'point':
      return { pos: [0, 0.0, 0.03], rot: [0.1, 0, 0] };
    case 'two':
    default:
      // предмет лежит поперёк ладоней, головой влево
      return { pos: [-0.008, -0.018, 0.0], rot: [0.06, 0.0, 0.03] };
  }
}
