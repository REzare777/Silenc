/**
 * ============================================================================
 *  Оружие и снаряжение: модели, иконки, характеристики
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  До сих пор в руках можно было держать только рыбу. Долине нужны вещи,
 *  которыми бьют: с ними появляется смысл ходить в подземелье с чем-то
 *  кроме горящего бранда.
 *
 *  Как устроено
 *  ------------
 *  * `WEAPONS` — каталог: у каждого вида оружия урон, скорость удара,
 *    дальность, цена и то, как его берут в руки.
 *  * `weaponModel(id)` — процедурная 3D-модель для рук (надплечная сцена
 *    viewmodel: модель не проваливается в стены и не зависит от света
 *    локации).
 *  * `weaponIcon(spec, size)` — 2D-иконка для инвентаря и торговли.
 *
 *  Про урон и скорость
 *  -------------------
 *  Цифры взяты не из фэнтези, а из здравого смысла: кинжал бьёт быстро,
 *  но слабо; двуручный меч рубит по-настоящему, но замах требует времени,
 *  и это — его цена. Урон дан как диапазон «слабое / сильное попадание»,
 *  скорость — в секундах между ударами (меньше значит быстрее).
 *
 *  @module world/weapons
 */

import * as THREE from 'three';
import { box, cyl, cone, sphere, torus } from './geo.js';

/* ------------------------------------------------------------------
 *  Материалы
 * ------------------------------------------------------------------ */
const M = {
  // металл держим «серебристым», а не зеркальным: в оверлейной сцене нет
  // окружения, и сильный metalness превращает сталь в тёмную полосу
  steel: new THREE.MeshStandardMaterial({ color: 0xc2cbd4, roughness: 0.38, metalness: 0.22 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x6e757b, roughness: 0.5, metalness: 0.3 }),
  bladeEdge: new THREE.MeshStandardMaterial({ color: 0xe4ebf1, roughness: 0.25, metalness: 0.45 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7d5834, roughness: 0.9 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x4a331d, roughness: 0.92 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.95 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.36, metalness: 0.8 }),
  bow: new THREE.MeshStandardMaterial({ color: 0x9c7444, roughness: 0.88 }),
  string: new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 1 }),
  shaft: new THREE.MeshStandardMaterial({ color: 0x7a5c33, roughness: 0.9 }),
  arrow: new THREE.MeshStandardMaterial({ color: 0xb08e5c, roughness: 0.85 }),
  gem: new THREE.MeshStandardMaterial({
    color: 0x4f7fb5, roughness: 0.15, metalness: 0.1,
    emissive: 0x2b4f7a, emissiveIntensity: 0.55,
  }),
  gemWarm: new THREE.MeshStandardMaterial({
    color: 0x8f5fb5, roughness: 0.15, metalness: 0.1,
    emissive: 0x53306f, emissiveIntensity: 0.55,
  }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x6d5a44, roughness: 1 }),
};

/* ------------------------------------------------------------------
 *  Каталог
 * ------------------------------------------------------------------
 *
 *  `dmg` — урон [слабо, сильно]; `speed` — секунд между ударами;
 *  `reach` — рабочая дальность в метрах; `price` — цена в золотых;
 *  `hands` — 'one' или 'two'; `mana` — расход маны за удар (0 = нет).
 */
export const WEAPONS = [
  {
    id: 'dagger',
    name: 'Кинжал',
    kind: 'weapon',
    subclass: 'blade',
    dmg: [7, 12],
    speed: 0.34,
    reach: 1.3,
    price: 25,
    weight: 0.6,
    sweep: 1,        // сколько зверей задевает удар
    crit: 0.15,      // шанс критического удара
    knock: 2.6,      // отбрасывание
    stun: 0.22,      // оглушение
    effort: 2,       // сколько силы уходит на удар
    hands: 'one',
    stackable: false,
    desc: 'Короткий клинок. Быстрый, слабый и незаметный — то, что берут первым.',
    tip: 'Бьёт чаще всех, но сносит мало.',
  },
  {
    id: 'shortsword',
    name: 'Короткий меч',
    kind: 'weapon',
    subclass: 'blade',
    dmg: [13, 19],
    speed: 0.58,
    reach: 1.6,
    price: 60,
    weight: 1.4,
    sweep: 1,
    crit: 0.12,
    knock: 3.6,
    stun: 0.3,
    effort: 4,
    hands: 'one',
    stackable: false,
    desc: 'Клинок в одну ладонь. Лёгкий, надёжный, ничего особенного.',
    tip: 'Универсальный клинок: достаточно быстрый, чтобы бить чаще.',
  },
  {
    id: 'longsword',
    name: 'Длинный меч',
    kind: 'weapon',
    subclass: 'blade',
    dmg: [19, 27],
    speed: 0.85,
    reach: 1.9,
    price: 120,
    weight: 2.6,
    sweep: 2,        // длинный клинок рубит по площади
    crit: 0.12,
    knock: 5.2,
    stun: 0.42,
    effort: 6,
    hands: 'one',
    stackable: false,
    desc: 'Стальная полоса с яблоком-противовесом. Рабочая лошадь любого ополченца.',
    tip: 'Бьёт заметно больнее кинжала, но замах дольше.',
  },
  {
    id: 'axe',
    name: 'Секира',
    kind: 'weapon',
    subclass: 'axe',
    dmg: [21, 31],
    speed: 1.05,
    reach: 1.7,
    price: 150,
    weight: 3.4,
    sweep: 2,
    crit: 0.18,      // тяжёлый удар секирой — самый шансливый
    knock: 6.8,
    stun: 0.58,
    effort: 8,
    hands: 'one',
    stackable: false,
    desc: 'Тяжёлое лезвие на дубовом топорище. Рубит и шкуры, и кости.',
    tip: 'Медленнее меча, но с одного удара выходит больше.',
  },
  {
    id: 'greatsword',
    name: 'Двуручный меч',
    kind: 'weapon',
    subclass: 'blade',
    dmg: [33, 49],
    speed: 1.55,
    reach: 2.4,
    price: 280,
    weight: 6.5,
    sweep: 3,        // двуручник сносит всю толпу
    crit: 0.2,
    knock: 9.2,
    stun: 0.82,
    effort: 12,
    hands: 'two',
    stackable: false,
    desc: 'Двухметровая полоса стали. Чтобы замахнуться, нужно разбежаться.',
    tip: 'Самый тяжёлый урон в игре — и самый долгий замах.',
  },
  {
    id: 'bow',
    name: 'Лук',
    kind: 'weapon',
    subclass: 'bow',
    dmg: [15, 23],
    speed: 1.0,
    reach: 40,
    price: 90,
    weight: 1.8,
    sweep: 1,
    crit: 0.15,
    knock: 1.8,
    stun: 0.26,
    effort: 3,
    hands: 'two',
    stackable: false,
    desc: 'Рог из оленьего рога на ясеневом луке. Тетива воет — и летит стрела.',
    tip: 'Единственное оружие, что достаёт врага издалека.',
  },
  {
    id: 'staff',
    name: 'Жезл',
    kind: 'weapon',
    subclass: 'magic',
    dmg: [10, 17],
    speed: 0.75,
    reach: 16,
    price: 180,
    weight: 2.2,
    sweep: 2,        // волна магии достаёт двоих
    crit: 0.1,
    knock: 3.4,
    stun: 0.5,
    effort: 5,
    hands: 'one',
    mana: 6,
    stackable: false,
    desc: 'Ольховый жезл с самоцветом в оправе. Тянет изнутри, а не снаружи.',
    tip: 'Бьёт по-колдовски: слабее сталь, но достаёт издалека и тратит ману.',
  },
];

/** Каталог по id — для быстрого поиска. */
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

/**
 * Найти оружие по id.
 *
 * @param {string} id идентификатор
 * @returns {object|null}
 */
export function getWeapon(id) {
  return WEAPON_BY_ID[id] || null;
}

/* ------------------------------------------------------------------
 *  Модели
 * ------------------------------------------------------------------ */

function mesh(geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

/**
 * Клинок с рукоятью.
 *
 * @param {number} len длина клинка
 * @param {number} wide ширина клинка
 * @param {number} thick толщина
 * @param {object} matM материал клинка
 * @returns {THREE.Group}
 */
function blade(len, wide, thick, matM = M.steel) {
  const g = new THREE.Group();
  // клинок — слегка сужающийся к острию
  const body = box(wide, len, thick);
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) pos.setX(i, pos.getX(i) * 0.12);      // к острию
  }
  body.computeVertexNormals();
  g.add(mesh(body, matM, 0, len / 2, 0));
  // светлая полоса вдоль кромки — клинок читается как сталь, а не как палка
  g.add(mesh(box(wide * 0.16, len * 0.92, thick * 1.06), M.bladeEdge, wide * 0.40, len * 0.5, 0));
  // дол — короткий выступ над гардой
  g.add(mesh(box(wide * 0.9, 0.09, thick * 1.5), M.steelDark, 0, 0.03, 0));
  // гарда — поперечная перекладина
  g.add(mesh(box(wide * 2.4, 0.024, thick * 2.0), M.steelDark, 0, -0.012, 0));
  // рукоять
  g.add(mesh(cyl(0.022, 0.026, 0.16, 8), M.leather, 0, -0.09, 0));
  // навершие — капля
  g.add(mesh(sphere(0.03, 10, 8), M.brass, 0, -0.18, 0));
  g.add(mesh(cyl(0.012, 0.022, 0.03, 8), M.brass, 0, -0.155, 0));
  return g;
}

/**
 * Топор: древко и лезвие.
 *
 * @returns {THREE.Group}
 */
function axeModel() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.024, 0.030, 0.86, 8), M.wood, 0, 0.32, 0));

  /**
   * Пластина между двумя точками — так лезвие получается «полумесяцем».
   *
   * @param {THREE.Vector3} p0 начало
   * @param {THREE.Vector3} p1 конец
   * @param {number} w ширина (поперёк лезвия)
   * @param {number} th толщина
   * @param {THREE.Material} matM материал
   * @returns {THREE.Mesh} пластина
   */
  function plate(p0, p1, w, th, matM) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const m = new THREE.Mesh(box(th, len, w), matM);
    m.position.copy(p0).add(p1).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  }

  // лезвие — дуга из четырёх пластин
  const arc = [
    new THREE.Vector3(0.005, 0.53, 0.01),
    new THREE.Vector3(0.10, 0.57, 0.03),
    new THREE.Vector3(0.18, 0.68, 0.05),
    new THREE.Vector3(0.20, 0.82, 0.05),
    new THREE.Vector3(0.14, 0.92, 0.03),
  ];
  for (let i = 0; i < arc.length - 1; i++) {
    g.add(plate(arc[i], arc[i + 1], 0.085 - i * 0.008, 0.030, M.steel));
  }
  // светлая кромка по внешнему краю
  g.add(plate(new THREE.Vector3(0.19, 0.68, 0.05), new THREE.Vector3(0.21, 0.82, 0.05), 0.055, 0.034, M.bladeEdge));
  // обух
  g.add(mesh(box(0.055, 0.34, 0.075), M.steelDark, 0, 0.70, -0.015));
  // втулка древка
  g.add(mesh(cyl(0.040, 0.040, 0.10, 8), M.steelDark, 0, 0.53, 0));
  return g;
}

/**
 * Лук: две дуги и тетива.
 *
 * @returns {THREE.Group}
 */
function bowModel() {
  const g = new THREE.Group();

  /**
   * Отрезок трубки между двумя точками — так дуги получаются настоящими,
   * а не «палочками».
   *
   * @param {THREE.Vector3} p0 начало
   * @param {THREE.Vector3} p1 конец
   * @param {number} r0 радиус в начале
   * @param {number} r1 радиус в конце
   * @param {THREE.Material} matM материал
   * @returns {THREE.Mesh} трубка
   */
  function tube(p0, p1, r0, r1, matM) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const m = new THREE.Mesh(cyl(r1, r0, len, 7), matM);
    m.position.copy(p0).add(p1).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  }

  /* Геометрия лука.
   *
   * Плоскость лука — вертикальная (Y — вверх по плечам, Z — от стрелка к
   * цели). Прогиб плеч уходит к цели, а наконечники загибаются назад, к
   * стрелку: поэтому тетива получается прямой и стоит чуть позади рукояти,
   * как и на настоящем луке.
   */
  const LIMB = 0.72;      // длина плеча от рукояти до наконечника
  const BELLY = -0.19;    // прогиб к цели
  const TIP_Z = 0.07;     // наконечник загибается к стрелку

  const tips = [];
  for (const side of [-1, 1]) {
    const N = 10;
    let prev = new THREE.Vector3(0, side * 0.11, 0);
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const p = new THREE.Vector3(
        0,
        side * (0.11 + LIMB * t),
        BELLY * Math.sin(Math.PI * t) + TIP_Z * t,
      );
      const r0 = 0.030 - 0.017 * ((i - 1) / N);
      const r1 = 0.030 - 0.017 * (i / N);
      g.add(tube(prev, p, r0, r1, M.bow));
      prev = p;
    }
    tips.push(prev);
  }

  // рукоять: кожаная обмотка посредине
  g.add(mesh(cyl(0.036, 0.036, 0.28, 10), M.leather, 0, 0, 0.012));
  // рожки на наконечниках
  for (const t of tips) {
    g.add(mesh(cyl(0.019, 0.013, 0.08, 6), M.woodDark, t.x, t.y + Math.sign(t.y) * 0.03, t.z));
  }

  // тетива — прямая от рожка до рожка. Тонкая нитка на таком масштабе
  // просто исчезает, поэтому она заметно толще волоса, но тоньше плеч.
  g.add(tube(tips[0], tips[1], 0.012, 0.012, M.string));

  // стрела: древно вперёд, наконечник и оперение.
  // Хвостовик упирается в тетиву (z ≈ 0.07), остриё смотрит в цель.
  const shaft = mesh(cyl(0.013, 0.013, 0.80, 7), M.arrow, 0, 0, -0.30, Math.PI / 2, 0, 0);
  g.add(shaft);
  g.add(mesh(cone(0.026, 0.13, 8), M.steel, 0, 0, -0.73, Math.PI / 2, 0, 0));
  // оперение — три пера у хвостовика
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const f = mesh(box(0.007, 0.075, 0.16), M.cloth,
      Math.cos(a) * 0.017, Math.sin(a) * 0.017, 0.02,
      0, 0, a);
    g.add(f);
  }
  return g;
}

/**
 * Жезл: посох с самоцветом.
 *
 * @returns {THREE.Group}
 */
function staffModel() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.018, 0.024, 1.15, 8), M.shaft, 0, 0.42, 0));
  // намотка
  g.add(mesh(cyl(0.027, 0.027, 0.09, 8), M.leather, 0, 0.12, 0));
  g.add(mesh(cyl(0.027, 0.027, 0.09, 8), M.leather, 0, 0.24, 0));
  // оправа самоцвета
  g.add(mesh(torus(0.05, 0.013, 6, 12), M.brass, 0, 1.03, 0));
  g.add(mesh(sphere(0.042, 12, 10), M.gem, 0, 1.03, 0));
  // клинок-навершие
  g.add(mesh(cone(0.035, 0.12, 8), M.steel, 0, 1.13, 0));
  return g;
}

/**
 * Собрать 3D-модель оружия.
 *
 * @param {string} id идентификатор оружия
 * @returns {THREE.Group|null}
 */
/**
 * Посадка парящего оружия: где оно висит перед камерой и какого размера.
 *
 * Оружия без руки: оно крупное, справа-снизу, целиком в кадре.
 */
const FLOATS = {
  blade: { pos: [0.175, -0.030, -0.500], rot: [-0.42, -0.16, 0.16], scale: 0.46 },
  axe: { pos: [0.175, -0.080, -0.470], rot: [-0.34, -0.14, 0.20], scale: 0.34 },
  bow: { pos: [-0.165, -0.060, -0.700], rot: [0.08, -0.26, 0.16], scale: 0.34 },
  magic: { pos: [0.125, -0.230, -0.520], rot: [0.0, -0.22, 0.06], scale: 0.30 },
};

/**
 * Посадка парящего оружия.
 *
 * @param {object} spec спецификация оружия
 * @returns {{pos: number[], rot: number[], scale: number}}
 */
export function weaponFloat(spec) {
  const base = FLOATS[(spec && spec.subclass) || 'blade'] || FLOATS.blade;
  let scale = base.scale;
  let pos = base.pos.slice();
  const id = spec && spec.id;
  if (id === 'dagger') { scale = 0.58; pos[1] -= 0.02; }
  else if (id === 'shortsword') scale = 0.46;
  else if (id === 'longsword') { scale = 0.36; pos[1] -= 0.05; pos[2] -= 0.10; }
  else if (id === 'greatsword') { scale = 0.30; pos[1] -= 0.05; pos[2] -= 0.20; }
  else if (id === 'axe') scale = 0.34;
  else if (id === 'bow') scale = 0.34;
  else if (id === 'staff') scale = 0.34;
  return { pos, rot: base.rot.slice(), scale };
}

/**
 * Модель оружия для рук.
 *
 * @param {string} id идентификатор оружия
 * @returns {THREE.Group|null}
 */
export function weaponModel(id) {
  const spec = getWeapon(id);
  if (!spec) return null;
  let g;
  switch (spec.subclass) {
    case 'axe': g = axeModel(); break;
    case 'bow': g = bowModel(); break;
    case 'magic': g = staffModel(); break;
    default: {
      // длина клинка по «reach»
      const len = spec.id === 'greatsword' ? 1.35
        : spec.id === 'longsword' ? 0.95
          : spec.id === 'shortsword' ? 0.7 : 0.34;
      const wide = spec.id === 'greatsword' ? 0.115 : spec.id === 'dagger' ? 0.042 : 0.078;
      g = blade(len, wide, spec.id === 'greatsword' ? 0.022 : 0.014);
    }
  }
  g.name = `weapon:${id}`;
  return g;
}

/* ------------------------------------------------------------------
 *  2D-иконки
 * ------------------------------------------------------------------ */

const iconCache = new Map();

/**
 * Нарисовать 2D-иконку оружия.
 *
 * @param {object} spec спецификация оружия
 * @param {number} size сторона квадрата в пикселях
 * @returns {HTMLCanvasElement|null}
 */
export function weaponIcon(spec, size = 96) {
  if (typeof document === 'undefined' || !spec) return null;
  const px = Math.max(16, Math.round(size || 96));
  const key = `${spec.id}|${px}`;
  const cached = iconCache.get(key);
  if (cached) return copyCanvas(cached);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  drawWeaponIcon(ctx, spec, px);
  iconCache.set(key, canvas);
  return copyCanvas(canvas);
}

function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

/** Фон иконки — тёмный квадрат с лёгкой виньеткой, как у рыбы. */
function iconBackdrop(ctx, px) {
  const g = ctx.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, '#2b2620');
  g.addColorStop(1, '#15120e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
}

/** Клинок иконки: стальная полоса с бликом. */
function drawBladeIcon(ctx, px, len, wide, angle) {
  ctx.save();
  ctx.translate(px / 2, px / 2);
  ctx.rotate(angle);
  const h = px * len;
  const w = Math.max(2, px * wide);
  const grd = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  grd.addColorStop(0, '#7d848c');
  grd.addColorStop(0.45, '#e3e9ee');
  grd.addColorStop(1, '#666d75');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2);
  ctx.lineTo(w / 2, -h / 2 + h * 0.12);
  ctx.lineTo(w / 2, h / 2);
  ctx.lineTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h / 2 + h * 0.12);
  ctx.closePath();
  ctx.fill();
  // рукоять
  ctx.fillStyle = '#7a4f2c';
  ctx.fillRect(-w * 0.6, h / 2, w * 1.2, px * 0.14);
  ctx.fillStyle = '#b08a3e';
  ctx.fillRect(-w * 0.9, h / 2 + px * 0.14, w * 1.8, px * 0.035);
  ctx.restore();
}

/**
 * Рисунок иконки по классу оружия.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec спецификация
 * @param {number} px сторона
 */
function drawWeaponIcon(ctx, spec, px) {
  iconBackdrop(ctx, px);
  switch (spec.subclass) {
    case 'axe': {
      // древко по диагонали
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#6b4a2c';
      ctx.fillRect(-px * 0.035, -px * 0.42, px * 0.07, px * 0.84);
      // лезвие
      const grd = ctx.createLinearGradient(-px * 0.2, 0, px * 0.2, 0);
      grd.addColorStop(0, '#6b7278');
      grd.addColorStop(0.5, '#dfe6ec');
      grd.addColorStop(1, '#5e656b');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-px * 0.02, -px * 0.4);
      ctx.lineTo(px * 0.26, -px * 0.3);
      ctx.quadraticCurveTo(px * 0.3, -px * 0.05, px * 0.02, -px * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'bow': {
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.strokeStyle = '#8a6238';
      ctx.lineWidth = px * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(px * 0.08, 0, px * 0.34, -1.15, 1.15);
      ctx.stroke();
      ctx.strokeStyle = '#d9cfb4';
      ctx.lineWidth = px * 0.018;
      ctx.beginPath();
      ctx.moveTo(px * 0.08 + Math.cos(-1.15) * px * 0.34, Math.sin(-1.15) * px * 0.34);
      ctx.lineTo(px * 0.08 + Math.cos(1.15) * px * 0.34, Math.sin(1.15) * px * 0.34);
      ctx.stroke();
      // стрела
      ctx.strokeStyle = '#5c4526';
      ctx.lineWidth = px * 0.028;
      ctx.beginPath();
      ctx.moveTo(px * 0.02, px * 0.3);
      ctx.lineTo(px * 0.02, -px * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#c9d2d9';
      ctx.beginPath();
      ctx.moveTo(px * 0.02, -px * 0.36);
      ctx.lineTo(px * 0.08, -px * 0.26);
      ctx.lineTo(-px * 0.04, -px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'magic': {
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.strokeStyle = '#5c4526';
      ctx.lineWidth = px * 0.06;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, px * 0.42);
      ctx.lineTo(0, -px * 0.16);
      ctx.stroke();
      // оправа
      ctx.strokeStyle = '#b08a3e';
      ctx.lineWidth = px * 0.028;
      ctx.beginPath();
      ctx.arc(0, -px * 0.24, px * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      // самоцвет
      const grd = ctx.createRadialGradient(-px * 0.03, -px * 0.28, 0, 0, -px * 0.24, px * 0.11);
      grd.addColorStop(0, '#a8d4ff');
      grd.addColorStop(1, '#3a6ea5');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, -px * 0.24, px * 0.072, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    default: {
      const len = spec.id === 'greatsword' ? 0.78 : spec.id === 'longsword' ? 0.66
        : spec.id === 'shortsword' ? 0.56 : 0.4;
      const wide = spec.id === 'greatsword' ? 0.1 : spec.id === 'dagger' ? 0.05 : 0.075;
      drawBladeIcon(ctx, px, len, wide, -0.35);
    }
  }
}
