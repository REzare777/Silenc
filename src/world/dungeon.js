/**
 * ============================================================================
 *  ПОДЗЕМЕЛЬЕ: пещера под Шёпот-Долиной
 * ============================================================================
 *
 *  Отдельная сцена, как амбар и таверна: своя геометрия, свой свет,
 *  свои коллайдеры. Атмосфера — мрачная пещера в духе «Соло левелинг»:
 *  почти чёрный камень, холодное синее свечение кристаллов, плотный
 *  туман у пола и огромный синий самоцвет в глубине, у «Врат».
 *
 *  Планировка — два яруса, соединённые каменной лестницей в шахте:
 *
 *      ┌───────────────  Z = -34  (портал наружу, лестница наверх)
 *      │  A. Входной зал      24 × 14
 *      ├───────────────  Z = -20  (три проёма: центральный и два боковых)
 *      │  B. Кристальный зал  30 × 26
 *      │            ↓
 *      │  Ш. Шахта             9 × 8   (лестница вниз, y 0 → -4.6)
 *      ├───────────────  Z = 14
 *      │  C. Зал Врат          28 × 22  (y = -4.6)
 *      └───────────────  Z = 36
 *
 *  Всё процедурное: стены собраны из скальных панелей, кристаллы —
 *  из конусов и призм, туман — из точек.
 *
 *  @module world/dungeon
 */

import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, mat } from './geo.js';
import { makeGlow } from './props.js';

/* ---------------- уровни ---------------- */
const Y_TOP = 0;         // верхний ярус (входной и кристальный залы)
const Y_DEEP = -4.6;     // нижний ярус (зал Врат)

/* ---------------- размеры залов ---------------- */
const A = { x0: -12, x1: 12, z0: -34, z1: -20 };   // входной зал
const B = { x0: -15, x1: 15, z0: -20, z1: 6 };     // кристальный зал
const SH = { x0: -4.5, x1: 4.5, z0: 6, z1: 14 };  // шахта с лестницей
const C = { x0: -14, x1: 14, z0: 14, z1: 36 };    // зал Врат

const WALL_T = 0.9;      // толщина скальной стены
const H_TOP = 7.2;      // высота свода верхнего яруса
const H_DEEP = 7.0;     // высота свода нижнего яруса

/* проёмы */
const GATE_X = 2.3;                       // ширина портала наружу
const GAP_MAIN = [-2.9, 2.9];             // центральный проём A → B
const GAP_WEST = [-9.8, -6.4];            // боковой западный проём
const GAP_EAST = [6.4, 9.8];              // боковой восточный проём

/**
 * Собирает интерьер подземелья.
 *
 * @param {object} M материалы проекта
 * @param {THREE.Texture} glowTex мягкая текстура свечения
 * @returns {{group: THREE.Group, colliders: object, platforms: Array, climbs: Array,
 *   lights: object, spawn: object, exit: object, spots: object, update: Function,
 *   W: number, D: number, H: number}} готовая локация
 */
export function buildDungeon(M, glowTex) {
  const group = new THREE.Group();
  group.name = 'dungeon';

  /* ---------------- материалы пещеры ---------------- */
  const rock = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x9a9ab2, roughness: 1.0, metalness: 0.0,
  });
  const rockDark = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x6c6c7e, roughness: 1.0,
  });
  const rockWarm = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x8a80a4, roughness: 1.0,
  });
  const rockDeep = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x5a6076, roughness: 1.0,
  });
  const crystal = new THREE.MeshStandardMaterial({
    color: 0x2b58c8, emissive: 0x3f74ff, emissiveIntensity: 2.6, roughness: 0.22, metalness: 0.1,
  });
  const crystalViolet = new THREE.MeshStandardMaterial({
    color: 0x5a3fb0, emissive: 0x7a4fff, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.1,
  });
  const rune = new THREE.MeshStandardMaterial({
    color: 0x9fd8ff, emissive: 0x5fa8ff, emissiveIntensity: 2.4, roughness: 0.4,
  });

  const colliders = { boxes: [], circles: [] };
  const platforms = [];
  const climbs = [];
  const lights = {};
  const glowSprites = [];

  /* ---------------- простой генератор шума ---------------- */
  let seed = 918273;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  /* ================================================================
   *  КАРКАС: стены с проёмами
   *
   *  Каждая стена — это цепочка скальных панелей: они чуть повёрнуты
   *  и смещены, поэтому поверхность получается неровной. Коллайдер
   *  ставится ровно по видимому участку стены, без «невидимых стенок».
   * ================================================================ */
  const walls = new Builder();

  /**
   * Стена с проёмами.
   *
   * @param {'x'|'z'} axis вдоль какой оси лежит стена
   * @param {number} coord координата стены по другой оси
   * @param {number} from начало стены вдоль оси
   * @param {number} to конец стены вдоль оси
   * @param {number[][]} gaps проёмы [от, до] вдоль оси
   * @param {number} h высота стены
   * @param {number} base отметка пола у стены
   * @param {object} opts дополнительно: {lit: boolean}
   */
  const wall = (axis, coord, from, to, gaps, h, base = Y_TOP, opts = {}) => {
    // режем отрезок на куски, обходя проёмы
    const pieces = [];
    let cur = from;
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of sorted) {
      if (g0 > cur) pieces.push([cur, g0]);
      cur = Math.max(cur, g1);
    }
    if (cur < to) pieces.push([cur, to]);

    for (const [p0, p1] of pieces) {
      const len = p1 - p0;
      if (len < 0.2) continue;
      // панели по 3 метра, каждая со своим наклоном
      const n = Math.max(1, Math.round(len / 3));
      const step = len / n;
      for (let i = 0; i < n; i++) {
        const mid = p0 + step * (i + 0.5);
        const jx = axis === 'x' ? rr(-0.22, 0.22) : 0;
        const jz = axis === 'x' ? 0 : rr(-0.22, 0.22);
        const rot = rr(-0.045, 0.045);
        const key = rnd() > 0.55 ? 'rockWarm' : 'rock';
        if (axis === 'x') {
          walls.add(box(step + 0.08, h, WALL_T, 1.2), key,
            mat(mid + jx, base + h / 2, coord + jz, rot, 0, rr(-0.035, 0.035)));
        } else {
          walls.add(box(WALL_T, h, step + 0.08, 1.2), key,
            mat(coord + jx, base + h / 2, mid + jz, rot, 0, rr(-0.035, 0.035)));
        }
      }
      // коллайдер — ровно по этому участку стены
      if (axis === 'x') {
        colliders.boxes.push({
          cx: (p0 + p1) / 2, cz: coord, hx: len / 2 + 0.1, hz: WALL_T / 2,
          ang: 0, y0: base, y1: base + h,
        });
      } else {
        colliders.boxes.push({
          cx: coord, cz: (p0 + p1) / 2, hx: WALL_T / 2, hz: len / 2 + 0.1,
          ang: 0, y0: base, y1: base + h,
        });
      }
    }

    // карниз над стеной — чтобы верх не выглядел срезанным
    if (opts.cap !== false) {
      for (const [p0, p1] of pieces) {
        const len = p1 - p0;
        if (len < 0.2) continue;
        const mid = (p0 + p1) / 2;
        if (axis === 'x') {
          walls.add(box(len, 0.5, WALL_T + 0.5, 1.2), 'rockDark',
            mat(mid, base + h + 0.2, coord, 0, 0, rr(-0.03, 0.03)));
        } else {
          walls.add(box(WALL_T + 0.5, 0.5, len, 1.2), 'rockDark',
            mat(coord, base + h + 0.2, mid, 0, 0, rr(-0.03, 0.03)));
        }
      }
    }
  };

  /**
   * Арка-проём: каменные стойки и перемычка, оформляющие проём.
   *
   * @param {number} x где по X
   * @param {number} z где по Z
   * @param {number} width ширина проёма
   * @param {number} height высота проёма
   * @param {'x'|'z'} axis вдоль какой оси проём
   * @param {number} base отметка пола
   */
  const arch = (x, z, width, height, axis, base = Y_TOP) => {
    const half = width / 2;
    const thick = 0.5;
    if (axis === 'x') {
      for (const sx of [-1, 1]) {
        walls.add(box(thick, height, WALL_T + 0.3, 1.2), 'rockDark',
          mat(x + sx * (half + thick / 2), base + height / 2, z, 0, 0, rr(-0.02, 0.02)));
        colliders.boxes.push({
          cx: x + sx * (half + thick / 2), cz: z, hx: thick / 2, hz: WALL_T / 2 + 0.15,
          ang: 0, y0: base, y1: base + height,
        });
      }
      // перемычка с клиньями
      walls.add(box(width + thick * 2, 0.55, WALL_T + 0.3, 1.2), 'rockDark',
        mat(x, base + height + 0.25, z, 0, 0, 0));
      for (const sx of [-1, 1]) {
        walls.add(box(0.5, 0.7, WALL_T + 0.2, 1.2), 'rock',
          mat(x + sx * (half - 0.3), base + height - 0.25, z, 0, 0, sx * 0.16));
      }
    } else {
      for (const sz of [-1, 1]) {
        walls.add(box(WALL_T + 0.3, height, thick, 1.2), 'rockDark',
          mat(x, base + height / 2, z + sz * (half + thick / 2), 0, 0, rr(-0.02, 0.02)));
        colliders.boxes.push({
          cx: x, cz: z + sz * (half + thick / 2), hx: WALL_T / 2 + 0.15, hz: thick / 2,
          ang: 0, y0: base, y1: base + height,
        });
      }
      walls.add(box(WALL_T + 0.3, 0.55, width + thick * 2, 1.2), 'rockDark',
        mat(x, base + height + 0.25, z, 0, 0, 0));
      for (const sz of [-1, 1]) {
        walls.add(box(WALL_T + 0.2, 0.7, 0.5, 1.2), 'rock',
          mat(x, base + height - 0.25, z + sz * (half - 0.3), 0, 0, sz * 0.16));
      }
    }
  };

  /**
   * Колонна из тёмного камня.
   *
   * @param {number} x где по X
   * @param {number} z где по Z
   * @param {number} r радиус
   * @param {number} h высота
   * @param {number} base отметка пола
   */
  const pillar = (x, z, r, h, base = Y_TOP) => {
    walls.add(cyl(r * 0.88, r, h, 8), 'rock', mat(x, base + h / 2, z, rr(0, 3), 0, 0));
    walls.add(cyl(r * 1.18, r * 1.02, 0.42, 8), 'rockDark', mat(x, base + h + 0.15, z));
    walls.add(cyl(r * 1.14, r * 1.26, 0.5, 8), 'rockDark', mat(x, base + 0.22, z));
    colliders.circles.push({ x, z, r: r + 0.18, y0: base, y1: base + h });
  };

  /* ================================================================
   *  ПОЛЫ
   * ================================================================ */
  const floorMat = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x82829c, roughness: 0.85, metalness: 0.05,
  });
  const floorDeepMat = new THREE.MeshStandardMaterial({
    map: M.cave.map, color: 0x6a7088, roughness: 0.88, metalness: 0.05,
  });

  /** Пол прямоугольного участка. */
  const floor = (x0, x1, z0, z1, y, m) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    f.receiveShadow = true;
    group.add(f);
    return f;
  };
  floor(B.x0, B.x1, A.z0, B.z1, Y_TOP, floorMat);          // верхние залы
  floor(C.x0, C.x1, SH.z0, C.z1, Y_DEEP, floorDeepMat);     // зал Врат и дно шахты

  /* ================================================================
   *  СТЕНЫ ЛОКАЦИИ
   * ================================================================ */
  // северная стена входного зала — с порталом наружу.
  // Проём не выше 3.6 м: выше — сплошная стена, иначе в зал «вытекает»
  // пустота сцены.
  wall('x', A.z0, A.x0, A.x1, [[-GATE_X, GATE_X]], 3.6, Y_TOP);
  wall('x', A.z0, A.x0, A.x1, [], H_TOP + 1.4 - 3.6, Y_TOP + 3.6);
  arch(0, A.z0, GATE_X * 2, 3.6, 'x');
  // западная и восточная стены входного зала
  wall('z', A.x0, A.z0, A.z1, [], H_TOP + 1.4, Y_TOP);
  wall('z', A.x1, A.z0, A.z1, [], H_TOP + 1.4, Y_TOP);
  // перегородка между залами A и B — три проёма-арки, выше сплошная стена
  wall('x', A.z1, A.x0, A.x1, [GAP_MAIN, GAP_WEST, GAP_EAST], 3.8, Y_TOP);
  wall('x', A.z1, A.x0, A.x1, [], H_TOP + 1.4 - 3.8, Y_TOP + 3.8);
  arch(0, A.z1, GAP_MAIN[1] - GAP_MAIN[0], 3.8, 'x');
  arch((GAP_WEST[0] + GAP_WEST[1]) / 2, A.z1, GAP_WEST[1] - GAP_WEST[0], 3.2, 'x');
  arch((GAP_EAST[0] + GAP_EAST[1]) / 2, A.z1, GAP_EAST[1] - GAP_EAST[0], 3.2, 'x');
  // западная и восточная стены кристального зала
  wall('z', B.x0, B.z0, B.z1, [], H_TOP + 1.4, Y_TOP);
  wall('z', B.x1, B.z0, B.z1, [], H_TOP + 1.4, Y_TOP);
  // перегородка перед шахтой: по бокам — камень, в центре — широкий проём,
  // через который игрок попадает на лестницу вниз
  wall('x', B.z1, B.x0, SH.x0, [], H_TOP + 1.4, Y_TOP);
  wall('x', B.z1, SH.x1, B.x1, [], H_TOP + 1.4, Y_TOP);
  wall('x', B.z1, SH.x0, SH.x1, [], H_TOP + 1.4 - 4.6, Y_TOP + 4.6);
  arch(0, B.z1, SH.x1 - SH.x0, 4.6, 'x');
  // боковые стенки шахты (скальные откосы)
  wall('z', SH.x0, SH.z0, SH.z1, [], -Y_DEEP, Y_DEEP, { cap: false });
  wall('z', SH.x1, SH.z0, SH.z1, [], -Y_DEEP, Y_DEEP, { cap: false });
  // южные стены зала Врат
  wall('x', C.z1, C.x0, C.x1, [], H_DEEP + 1.4, Y_DEEP);
  wall('z', C.x0, C.z0, C.z1, [], H_DEEP + 1.4, Y_DEEP);
  wall('z', C.x1, C.z0, C.z1, [], H_DEEP + 1.4, Y_DEEP);

  group.add(walls.build({ rock, rockDark, rockWarm }, null, { name: 'dungeonWalls' }));

  /* ================================================================
   *  СВОДЫ
   * ================================================================ */
  const ceil = new Builder();
  // Свод плоский и надёжный: наклонные скаты разъезжались и оставляли
  // просвет, сквозь который был видно пустое небо сцены.
  const ceilTop = (x0, x1, z0, z1, y) => {
    ceil.add(box(x1 - x0 + 12, 1.0, z1 - z0 + 12, 1.4), 'rockDark',
      mat((x0 + x1) / 2, y, (z0 + z1) / 2));
    // конёк-балка вдоль зала
    ceil.add(box(2.2, 1.3, z1 - z0 + 10, 1.4), 'rockDark', mat((x0 + x1) / 2, y + 0.9, (z0 + z1) / 2));
    // поперечные рёбра — свод не выглядит плитой
    for (let z = z0 + 3; z < z1; z += 7) {
      ceil.add(box(x1 - x0 + 10, 0.8, 1.1, 1.4), 'rockDark', mat((x0 + x1) / 2, y - 0.7, z));
    }
  };
  ceilTop(B.x0, B.x1, A.z0, B.z1, H_TOP + 0.5);
  ceilTop(C.x0, C.x1, SH.z0, C.z1, Y_DEEP + H_DEEP + 0.5);
  group.add(ceil.build({ rockDark }, null, { name: 'dungeonCeiling' }));

  /* ================================================================
   *  ЛЕСТНИЦА В ШАХТЕ — спуск на нижний ярус
   *
   *  Каменные ступени идут вдоль оси Z: от верхнего края (y = 0)
   *  ко дну шахты (y = -4.6). Шаг ступени — 0.38 м, поэтому на них
   *  можно и спуститься, и подняться пешком.
   * ================================================================ */
  const STEPS = 13;
  const stepY = (Y_TOP - Y_DEEP) / STEPS;
  const stepZ = (SH.z1 - SH.z0 - 1.2) / STEPS;
  const stair = new Builder();
  for (let i = 0; i < STEPS; i++) {
    const y = Y_TOP - stepY * (i + 1);
    // верхняя ступень перекрывает сам край обрыва — иначе на границе
    // уровней пола получается щель, в которую игрок проваливается
    const z = SH.z0 - 0.35 + stepZ * (i + 0.5);
    stair.add(box(SH.x1 - SH.x0 - 0.6, 0.34, stepZ + 0.1, 1.2), 'rockDark', mat(0, y + 0.17, z));
    stair.add(box(SH.x1 - SH.x0 - 0.6, 0.12, 0.2, 1.2), 'rock', mat(0, y + 0.36, z - stepZ * 0.42));
    // площадка-ступень: ровно под этим камнем
    platforms.push({
      cx: 0, cz: z, hx: (SH.x1 - SH.x0 - 0.6) / 2, hz: stepZ / 2 + 0.12,
      ang: 0, y: y + 0.34,
    });
  }
  // перила вдоль лестницы — видно, куда идти, и не свалиться вбок
  for (const sx of [-1, 1]) {
    for (let i = 0; i < STEPS; i++) {
      const y = Y_TOP - stepY * (i + 1);
      const z = SH.z0 - 0.35 + stepZ * (i + 0.5);
      stair.add(box(0.22, 1.0, 0.22, 1.2), 'rock', mat(sx * (SH.x1 - 0.35), y + 0.8, z));
    }
    const rx = sx * (SH.x1 - 0.35);
    stair.add(box(0.16, 0.16, (SH.z1 - SH.z0 - 1.0), 1.2), 'rockDark',
      mat(rx, Y_DEEP + 1.3, (SH.z0 + SH.z1) / 2, 0, -0.3, 0));
    colliders.boxes.push({
      cx: rx, cz: (SH.z0 + SH.z1) / 2, hx: 0.16, hz: (SH.z1 - SH.z0 - 1.0) / 2,
      ang: 0, y0: Y_DEEP, y1: Y_TOP,
    });
  }
  group.add(stair.build({ rock, rockDark }, null, { name: 'dungeonStairs' }));

  // перила по краю шахты в верхнем зале — чтобы не упасть мимо лестницы
  const rails = new Builder();
  for (const sx of [-1, 1]) {
    // западная секция: от западной стены зала до края шахты; восточная — наоборот
    const x0 = sx < 0 ? B.x0 : SH.x1 + 0.3;
    const x1 = sx < 0 ? SH.x0 - 0.3 : B.x1;
    const cx = (x0 + x1) / 2;
    const w = x1 - x0;
    rails.add(box(w, 0.16, 0.18, 1.2), 'rockDark', mat(cx, Y_TOP + 0.95, B.z1 - 0.2));
    rails.add(box(w, 0.12, 0.14, 1.2), 'rockDark', mat(cx, Y_TOP + 0.5, B.z1 - 0.2));
    for (let i = 0; i <= 4; i++) {
      const px = x0 + (w * i) / 4;
      rails.add(box(0.14, 1.0, 0.14, 1.2), 'rock', mat(px, Y_TOP + 0.5, B.z1 - 0.2));
    }
    colliders.boxes.push({
      cx, cz: B.z1 - 0.2, hx: w / 2, hz: 0.12, ang: 0, y0: Y_TOP, y1: Y_TOP + 1.0,
    });
  }
  group.add(rails.build({ rock, rockDark }, null, { name: 'dungeonRails' }));

  /* ================================================================
   *  КОЛОННЫ
   * ================================================================ */
  const pillars = new Builder();
  const pillarSpots = [
    // входной зал
    [-8.6, -30, Y_TOP], [8.6, -30, Y_TOP], [-8.6, -23.4, Y_TOP], [8.6, -23.4, Y_TOP],
    // кристальный зал
    [-11.6, -16.4, Y_TOP], [11.6, -16.4, Y_TOP], [-11.6, -6.8, Y_TOP], [11.6, -6.8, Y_TOP],
    [-11.6, 2.4, Y_TOP], [11.6, 2.4, Y_TOP], [-5.2, -16.4, Y_TOP], [5.2, -16.4, Y_TOP],
    // зал Врат
    [-9.4, 19.5, Y_DEEP], [9.4, 19.5, Y_DEEP], [-9.4, 27, Y_DEEP], [9.4, 27, Y_DEEP],
    [-5.4, 23.2, Y_DEEP], [5.4, 23.2, Y_DEEP],
  ];
  for (const [px, pz, base] of pillarSpots) {
    const r = rr(0.72, 1.0);
    pillars.add(cyl(r * 0.88, r, (base === Y_TOP ? H_TOP : H_DEEP) - 0.6, 8),
      'rock', mat(px, base + ((base === Y_TOP ? H_TOP : H_DEEP) - 0.6) / 2, pz, rr(0, 3)));
    pillars.add(cyl(r * 1.22, r * 1.02, 0.4, 8), 'rockDark',
      mat(px, base + (base === Y_TOP ? H_TOP : H_DEEP) - 0.42, pz));
    pillars.add(cyl(r * 1.16, r * 1.28, 0.5, 8), 'rockDark', mat(px, base + 0.22, pz));
    colliders.circles.push({
      x: px, z: pz, r: r + 0.16, y0: base, y1: base + (base === Y_TOP ? H_TOP : H_DEEP) - 0.6,
    });
  }
  group.add(pillars.build({ rock, rockDark }, null, { name: 'dungeonPillars' }));

  // кристаллические светильники на колоннах — зал читается по контуру
  for (const [px, pz, base] of pillarSpots) {
    if (px < -6 || px > 6) continue;         // только колонны вдоль центрального ряда
    const l = new THREE.PointLight(0x6f96ff, 1.5, 17, 1.6);
    l.position.set(px, base + 3.4, pz);
    group.add(l);
  }

  /* ================================================================
   *  КРИСТАЛЛЫ — холодное синее свечение
   * ================================================================ */
  const crystals = new Builder();
  let lightBudget = 9;

  /**
   * Врастает кристалл в стену или пол: конус с боковыми осколками.
   *
   * @param {number} x где
   * @param {number} y высота
   * @param {number} z где
   * @param {number} s размер
   * @param {number} ry поворот
   * @param {number} rz наклон
   * @param {boolean} violet фиолетовый ли
   * @param {boolean} lit даёт ли свет
   */
  const addCrystal = (x, y, z, s, ry, rz, violet, lit) => {
    const key = violet ? 'violet' : 'blue';
    crystals.add(cone(s, s * 3.1, 6), key, mat(x, y, z, ry, 0, rz));
    for (let i = 0; i < 2; i++) {
      const m = mat(x, y, z, ry + rr(-0.4, 0.4), 0, rz + rr(-0.25, 0.25));
      m.multiply(new THREE.Matrix4().makeTranslation(rr(-0.1, 0.1), rr(-0.3, 0.3), rr(-0.1, 0.1)));
      crystals.add(cone(s * 0.45, s * 1.6, 5), key, m);
    }
    if (s > 0.28) {                       // ореол — только у крупных кристаллов
      const g = makeGlow(glowTex, s * 2.6, violet ? 0x9a7fff : 0x7fb0ff, 0.16);
      g.position.set(x, y, z);
      group.add(g);
      glowSprites.push(g);
    }
    if (lit && lightBudget > 0) {
      lightBudget--;
      const l = new THREE.PointLight(violet ? 0x8a6cff : 0x6c9cff, 3.0, 20, 1.7);
      l.position.set(x, y, z);
      group.add(l);
    }
  };

  // кристаллы на стенах верхних залов
  for (let i = 0; i < 22; i++) {
    const s = rr(0.16, 0.34);
    const side = Math.floor(rnd() * 4);
    const violet = rnd() > 0.72;
    if (side === 0) addCrystal(rr(B.x0 + 2, B.x1 - 2), rr(1.1, 3.4), B.z0 + 0.55, s, 0, rr(-0.3, 0.3), violet, true);
    else if (side === 1) addCrystal(rr(B.x0 + 2, B.x1 - 2), rr(1.1, 3.4), A.z0 + 0.55, s, 0, rr(-0.3, 0.3), violet, true);
    else if (side === 2) addCrystal(B.x0 + 0.55, rr(1.1, 3.4), rr(A.z0 + 2, B.z1 - 2), s, Math.PI / 2, rr(-0.3, 0.3), violet, true);
    else addCrystal(B.x1 - 0.55, rr(1.1, 3.4), rr(A.z0 + 2, B.z1 - 2), s, Math.PI / 2, rr(-0.3, 0.3), violet, true);
  }
  // кристаллы на полу верхнего яруса
  for (let i = 0; i < 12; i++) {
    const x = rr(B.x0 + 2, B.x1 - 2), z = rr(A.z0 + 2, B.z1 - 2);
    const s = rr(0.18, 0.42);
    crystals.add(cone(s, s * 3.2, 6), rnd() > 0.75 ? 'violet' : 'blue',
      mat(x, s * 1.4, z, rr(0, 6.28), 0, rr(-0.18, 0.18)));
    if (s > 0.3) {
      const g = makeGlow(glowTex, s * 2.4, rnd() > 0.75 ? 0x9a7fff : 0x7fb0ff, 0.14);
      g.position.set(x, s * 1.6, z);
      group.add(g);
      glowSprites.push(g);
    }
  }
  // кристаллы на стенах зала Врат
  for (let i = 0; i < 18; i++) {
    const s = rr(0.18, 0.4);
    const side = Math.floor(rnd() * 3);
    const violet = rnd() > 0.68;
    if (side === 0) addCrystal(rr(C.x0 + 2, C.x1 - 2), rr(Y_DEEP + 1, Y_DEEP + 3.2), C.z1 - 0.55, s, 0, rr(-0.3, 0.3), violet, true);
    else if (side === 1) addCrystal(C.x0 + 0.55, rr(Y_DEEP + 1, Y_DEEP + 3.2), rr(C.z0 + 2, C.z1 - 2), s, Math.PI / 2, rr(-0.3, 0.3), violet, true);
    else addCrystal(C.x1 - 0.55, rr(Y_DEEP + 1, Y_DEEP + 3.2), rr(C.z0 + 2, C.z1 - 2), s, Math.PI / 2, rr(-0.3, 0.3), violet, true);
  }
  // свисающие кристаллы под сводом
  for (let i = 0; i < 16; i++) {
    const x = rr(B.x0 + 2, B.x1 - 2), z = rr(A.z0 + 2, B.z1 - 2);
    const s = rr(0.14, 0.3);
    crystals.add(cone(s, s * 2.6, 6), 'blue', mat(x, H_TOP + 0.3, z, rr(0, 6.28), Math.PI, rr(-0.15, 0.15)));
  }
  for (let i = 0; i < 12; i++) {
    const x = rr(C.x0 + 2, C.x1 - 2), z = rr(C.z0 + 2, C.z1 - 2);
    const s = rr(0.14, 0.32);
    crystals.add(cone(s, s * 2.8, 6), rnd() > 0.6 ? 'violet' : 'blue',
      mat(x, Y_DEEP + H_DEEP + 0.3, z, rr(0, 6.28), Math.PI, rr(-0.15, 0.15)));
  }
  group.add(crystals.build({ blue: crystal, violet: crystalViolet }, null, { name: 'dungeonCrystals' }));

  /* ================================================================
   *  СТАЛАКТИТЫ, СТАЛАГМИТЫ И ОБВАЛЫ
   * ================================================================ */
  const spikes = new Builder();
  for (let i = 0; i < 26; i++) {
    const x = rr(B.x0 + 1.5, B.x1 - 1.5), z = rr(A.z0 + 1.5, B.z1 - 1.5);
    const h = rr(0.8, 2.4);
    spikes.add(cone(rr(0.16, 0.34), h, 6), 'rock', mat(x, H_TOP - h / 2 + 0.2, z, 0, Math.PI, 0));
  }
  for (let i = 0; i < 16; i++) {
    const x = rr(C.x0 + 1.5, C.x1 - 1.5), z = rr(C.z0 + 1.5, C.z1 - 1.5);
    const h = rr(0.6, 2.0);
    spikes.add(cone(rr(0.2, 0.42), h, 6), 'rockDark', mat(x, Y_DEEP + h / 2, z));
    colliders.circles.push({ x, z, r: 0.38, y0: Y_DEEP, y1: Y_DEEP + h });
  }
  // обвалы у стен (в арках проёмов их нет — иначе перекрывают проход)
  for (let i = 0; i < 12; i++) {
    const inDeep = i % 2 === 0;
    const sx = rnd() > 0.5 ? 1 : -1;
    const base = inDeep ? Y_DEEP : Y_TOP;
    const lim = inDeep ? C : B;
    const zr = inDeep ? [C.z0 + 2, C.z1 - 2] : [A.z0 + 2, B.z1 - 2];
    const px = sx * rr(lim.x0 + 1.2, lim.x1 - 1.2);
    let pz = rr(zr[0], zr[1]);
    // проёмы и лестница остаются чистыми
    const nearGap = Math.abs(pz - A.z1) < 3.5 || Math.abs(pz - A.z0) < 3.5
      || Math.abs(pz - B.z1) < 3.5 || Math.abs(pz - SH.z0) < 3.5;
    if (nearGap) pz += pz > (A.z1 + B.z1) / 2 ? 5.5 : -5.5;
    const s = rr(0.7, 1.5);
    spikes.add(sphere(s, 7, 5), 'rockDark', mat(px, base + s * 0.55, pz));
    colliders.circles.push({ x: px, z: pz, r: s * 0.9, y0: base, y1: base + s * 1.2 });
  }
  group.add(spikes.build({ rock, rockDark }, null, { name: 'dungeonSpikes' }));

  /* ================================================================
   *  ВРАТА: алтарь с гигантским кристаллом в глубине
   * ================================================================ */
  const altar = new Builder();
  const az = C.z1 - 4.2;
  altar.add(cyl(3.4, 3.9, 0.6, 9), 'rockDark', mat(0, Y_DEEP + 0.3, az));
  altar.add(cyl(2.2, 2.6, 0.5, 9), 'rock', mat(0, Y_DEEP + 0.8, az));
  // скала-алтарь за кристаллом
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    altar.add(sphere(rr(1.3, 2.0), 7, 5), 'rockWarm',
      mat(Math.cos(a) * 3.2, Y_DEEP + rr(0.8, 1.6), az + Math.sin(a) * 2.2,
        rr(0, 3), rr(-0.2, 0.2), rr(-0.2, 0.2)));
  }
  // две каменные фигуры — стражи у Врат
  for (const sx of [-1, 1]) {
    const fx = sx * 5.6;
    altar.add(box(1.1, 2.6, 0.9, 1.2), 'rockDark', mat(fx, Y_DEEP + 1.3, az - 0.4, sx * 0.14));
    altar.add(sphere(0.42, 8, 6), 'rockDark', mat(fx, Y_DEEP + 2.9, az - 0.4));
    altar.add(cone(0.55, 1.5, 6), 'rock', mat(fx, Y_DEEP + 3.6, az - 0.4, 0, 0, sx * 0.1));
    colliders.circles.push({ x: fx, z: az - 0.4, r: 0.62, y0: Y_DEEP, y1: Y_DEEP + 3.2 });
  }
  group.add(altar.build({ rock, rockDark, rockWarm }, null, { name: 'dungeonAltar' }));

  // огромный кристалл Врат
  const gateCrystal = new THREE.Group();
  gateCrystal.position.set(0, Y_DEEP + 1.05, az);
  const gc = new THREE.Mesh(cone(1.5, 6.2, 7), crystalViolet);
  gc.position.y = 3.1;
  gateCrystal.add(gc);
  const gc2 = new THREE.Mesh(cone(0.7, 3.1, 6), crystal);
  gc2.position.set(1.5, 1.6, 0.4);
  gc2.rotation.z = -0.32;
  gateCrystal.add(gc2);
  const gc3 = new THREE.Mesh(cone(0.6, 2.6, 6), crystal);
  gc3.position.set(-1.6, 1.3, 0.3);
  gc3.rotation.z = 0.36;
  gateCrystal.add(gc3);
  group.add(gateCrystal);
  const gateGlow = makeGlow(glowTex, 11, 0x8a6cff, 0.5);
  gateGlow.position.set(0, Y_DEEP + 3.2, az);
  group.add(gateGlow);
  const gateLight = new THREE.PointLight(0x6a6aff, 6.0, 34, 1.6);
  gateLight.position.set(0, Y_DEEP + 3.4, az);
  group.add(gateLight);
  lights.gate = gateLight;
  const gateFoot = new THREE.PointLight(0x8a6cff, 2.6, 16, 1.8);
  gateFoot.position.set(0, Y_DEEP + 0.7, az - 1.6);
  group.add(gateFoot);
  lights.gateFoot = gateFoot;

  // осколки кристалла вокруг алтаря
  const shards = new Builder();
  for (let i = 0; i < 24; i++) {
    const a = rr(0, 6.28), r = rr(1.6, 4.4);
    shards.add(cone(rr(0.08, 0.2), rr(0.4, 1.1), 5), rnd() > 0.5 ? 'blue' : 'violet',
      mat(Math.cos(a) * r, Y_DEEP + 0.3, az + Math.sin(a) * r * 0.7,
        rr(0, 6.28), rr(-1.4, 1.4), rr(-1.4, 1.4)));
  }
  group.add(shards.build({ blue: crystal, violet: crystalViolet }, null, { name: 'dungeonShards' }));

  /* ================================================================
   *  РУНЫ НА СТЕНАХ — светящиеся знаки
   * ================================================================ */
  const runes = new Builder();
  const runeSpots = [
    [B.x0 + 0.62, 2.2, -12.5, 'z'], [B.x1 - 0.62, 2.4, -2.2, 'z'],
    [C.x0 + 0.62, Y_DEEP + 2.2, 22.5, 'z'], [C.x1 - 0.62, Y_DEEP + 2.4, 29.5, 'z'],
    [-6.5, 2.3, A.z0 + 0.62, 'x'], [6.5, 2.3, A.z0 + 0.62, 'x'],
  ];
  for (const [rx, ry, rz, axis] of runeSpots) {
    for (let i = 0; i < 4; i++) {
      const off = (i - 1.5) * 0.55;
      const g = box(0.12, 0.9, 0.12, 1);
      if (axis === 'z') runes.add(g, 'rune', mat(rx, ry, rz + off, 0, 0, rr(-0.2, 0.2)));
      else runes.add(g, 'rune', mat(rx + off, ry, rz, 0, 0, rr(-0.2, 0.2)));
    }
    const gl = makeGlow(glowTex, 2.0, 0x7fc4ff, 0.2);
    gl.position.set(rx, ry, rz);
    group.add(gl);
    glowSprites.push(gl);
  }
  group.add(runes.build({ rune }, null, { name: 'dungeonRunes' }));

  /* ================================================================
   *  ПОРТАЛ НАВЕРХ: лестница и светящаяся арка у входа
   *
   *  Каменные ступени ведут к арке в северной стене; на верхней
   *  площадке — выход на поверхность.
   * ================================================================ */
  const PZ = A.z0 + 0.9;
  const portal = new Builder();
  const PORTAL_STEPS = 5;
  const PORTAL_Y = 1.65;
  // ступени идут с пола входного зала к площадке портала — без разрывов
  for (let i = 0; i < PORTAL_STEPS; i++) {
    const y = (PORTAL_Y / PORTAL_STEPS) * (i + 1);
    const z = -28.0 - i * 0.8;
    portal.add(box(3.4, y + 0.2, 0.92, 1.2), 'rockDark', mat(0, (y + 0.2) / 2 - 0.1, z));
    portal.add(box(3.6, 0.14, 0.24, 1.2), 'rock', mat(0, y + 0.04, z + 0.34));
    platforms.push({ cx: 0, cz: z, hx: 1.7, hz: 0.5, ang: 0, y });
  }
  // верхняя площадка перед порталом
  const EXIT_Z = -28.0 - (PORTAL_STEPS - 1) * 0.8 - 0.75;
  portal.add(box(4.2, 0.5, 2.0, 1.2), 'rockDark', mat(0, PORTAL_Y - 0.25, EXIT_Z));
  platforms.push({ cx: 0, cz: EXIT_Z, hx: 2.1, hz: 1.0, ang: 0, y: PORTAL_Y });
  // перила площадки
  for (const sx of [-1, 1]) {
    portal.add(box(0.24, 1.0, 2.0, 1.2), 'rock', mat(sx * 2.0, PORTAL_Y + 0.5, EXIT_Z));
    colliders.boxes.push({
      cx: sx * 2.0, cz: EXIT_Z, hx: 0.14, hz: 1.0, ang: 0, y0: PORTAL_Y, y1: PORTAL_Y + 1.0,
    });
  }
  // светящаяся арка-портал
  for (const sx of [-1, 1]) {
    portal.add(box(0.5, 3.4, 0.9, 1.2), 'rock', mat(sx * 1.9, 1.7, A.z0 + 0.3));
  }
  portal.add(box(4.4, 0.7, 1.0, 1.2), 'rock', mat(0, 3.55, A.z0 + 0.3));
  group.add(portal.build({ rock, rockDark }, null, { name: 'dungeonPortal' }));
  const portalGlow = makeGlow(glowTex, 3.8, 0xbcd8ff, 0.4);
  portalGlow.position.set(0, 2.1, A.z0 + 0.4);
  group.add(portalGlow);
  const portalLight = new THREE.PointLight(0xa8c8ff, 3.0, 24, 1.7);
  portalLight.position.set(0, 2.3, A.z0 + 0.6);
  group.add(portalLight);
  lights.portal = portalLight;

  /* ================================================================
   *  МАЯКИ И СВЕТЯЩИЕСЯ ГРИБЫ
   *
   *  Маяки стоят низко — так свет ложится на стены, а не только на пол.
   *  По стенам растут голубые грибы: каждый даёт маленький локальный
   *  источник, и камень читается по всему периметру зала.
   * ================================================================ */
  for (const [mx, my, mz] of [
    [-9.5, 1.5, -27], [9.5, 1.5, -27], [-9.5, 1.5, -12], [9.5, 1.5, -12],
    [-12.5, 1.5, 0], [12.5, 1.5, 0],
    [-10, Y_DEEP + 1.5, 21], [10, Y_DEEP + 1.5, 21],
    [0, Y_DEEP + 1.4, 8.5],
  ]) {
    const l = new THREE.PointLight(0x5a83ea, 4.2, 38, 1.45);
    l.position.set(mx, my, mz);
    group.add(l);
  }

  // голубые грибы вдоль стен — своя маленькая лампочка у каждого
  const mushroom = new THREE.MeshStandardMaterial({
    color: 0x7fd0ff, emissive: 0x49a8ff, emissiveIntensity: 2.4, roughness: 0.5,
  });
  const mush = new Builder();
  const mushSpots = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const z = A.z0 + 3 + i * 4.4;
      mushSpots.push([sx * (B.x0 + 0.75), Y_TOP, z]);
    }
    for (let i = 0; i < 7; i++) {
      const z = C.z0 + 3 + i * 3.6;
      mushSpots.push([sx * (C.x0 + 0.75), Y_DEEP, z]);
    }
  }
  for (const [mx, base, mz] of mushSpots) {
    const h = rr(0.16, 0.3);
    mush.add(cyl(0.05, 0.08, h, 5), 'rockDark', mat(mx, base + h / 2, mz));
    mush.add(sphere(h * 0.7, 6, 4), 'glow', mat(mx, base + h + h * 0.2, mz));
    const l = new THREE.PointLight(0x64b4ff, 1.05, 11, 1.55);
    l.position.set(mx, base + h + 0.2, mz);
    group.add(l);
  }
  group.add(mush.build({ rockDark, glow: mushroom }, null, { name: 'dungeonMushrooms' }));

  /* ================================================================
   *  ТУМАН У ПОЛА
   * ================================================================ */
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  })();

  const FOG_N = 720;
  const fogPos = new Float32Array(FOG_N * 3);
  const fogSeed = new Float32Array(FOG_N);
  const fogDeep = [];
  for (let i = 0; i < FOG_N; i++) {
    const deep = rnd() > 0.45;
    fogDeep.push(deep);
    if (deep) {
      fogPos[i * 3] = rr(C.x0 + 1, C.x1 - 1);
      fogPos[i * 3 + 1] = rr(Y_DEEP + 0.05, Y_DEEP + 1.05);
      fogPos[i * 3 + 2] = rr(SH.z0 + 1, C.z1 - 1);
    } else {
      fogPos[i * 3] = rr(B.x0 + 1, B.x1 - 1);
      fogPos[i * 3 + 1] = rr(Y_TOP + 0.05, Y_TOP + 1.05);
      fogPos[i * 3 + 2] = rr(A.z0 + 1, B.z1 - 1);
    }
    fogSeed[i] = rnd() * 100;
  }
  const fogGeo = new THREE.BufferGeometry();
  fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
  const fogMat = new THREE.PointsMaterial({
    map: smokeTex, color: 0x8ba0d8, size: 1.5, sizeAttenuation: true,
    transparent: true, opacity: 0.016, depthWrite: false,
  });
  const fogPoints = new THREE.Points(fogGeo, fogMat);
  group.add(fogPoints);

  /* ================================================================
   *  ОСВЕЩЕНИЕ
   * ================================================================ */
  const amb = new THREE.AmbientLight(0x6a7ec2, 4.2);
  group.add(amb);
  lights.ambient = amb;
  const hemi = new THREE.HemisphereLight(0x9db2f0, 0x4a5578, 3.6);
  group.add(hemi);
  lights.hemi = hemi;
  const key = new THREE.DirectionalLight(0x9fb6ff, 1.25);
  key.position.set(-9, 14, -7);
  group.add(key);
  lights.key = key;
  // «отражённый» снизу луч: подсвечивает свод, иначе верх зала чёрный
  const roof = new THREE.DirectionalLight(0x7f95d8, 0.9);
  roof.position.set(2, -12, -3);
  group.add(roof);
  lights.roof = roof;
  const bounce = new THREE.PointLight(0x5a7ce0, 2.8, 52, 1.4);
  bounce.position.set(0, 1.1, -6);
  group.add(bounce);
  lights.bounce = bounce;
  const bounceDeep = new THREE.PointLight(0x5a7ce0, 2.8, 52, 1.4);
  bounceDeep.position.set(0, Y_DEEP + 1.1, 24);
  group.add(bounceDeep);
  lights.bounceDeep = bounceDeep;

  /* ================================================================
   *  ТОЧКИ ДЛЯ ОСМОТРА
   * ================================================================ */
  const spots = {
    crystal: new THREE.Vector3(11.6, 1.5, -6.8),        // кристаллы у колонны
    gate: new THREE.Vector3(0, Y_DEEP + 1.8, az - 2.6),   // Врата
    pillar: new THREE.Vector3(-11.6, 1.5, -6.8),        // колонна
    fog: new THREE.Vector3(0, Y_DEEP + 1.2, 9.6),        // туман в шахте
    runes: new THREE.Vector3(-14.3, Y_DEEP + 2.2, 22.5), // руны
    gems: [
      new THREE.Vector3(-9.4, Y_DEEP + 1.0, 27),         // самоцвет у стража
      new THREE.Vector3(9.4, Y_DEEP + 1.0, 27),
    ],
  };

  /** Точка входа игрока в пещеру — у портала, лицом вглубь. */
  const spawn = { x: 0, z: -26.5, yaw: Math.PI };
  /** Точка выхода — верхняя площадка портала. */
  const exit = { x: 0, z: EXIT_Z, y: PORTAL_Y };

  /**
   * Анимация локации: туман ползёт, кристаллы пульсируют.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t мировое время
   */
  function update(dt, t) {
    const pos = fogGeo.attributes.position;
    for (let i = 0; i < FOG_N; i++) {
      const s = fogSeed[i];
      const top = fogDeep[i] ? Y_DEEP + 1.15 : Y_TOP + 1.15;
      const low = fogDeep[i] ? Y_DEEP + 0.04 : Y_TOP + 0.04;
      let y = pos.getY(i) + dt * (0.06 + (i % 7) * 0.012);
      if (y > top) y = low;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.25 + s) * dt * 0.12);
      pos.setZ(i, pos.getZ(i) + Math.cos(t * 0.2 + s) * dt * 0.1);
    }
    pos.needsUpdate = true;
    const pulse = 2.1 + Math.sin(t * 0.9) * 0.35;
    gateLight.intensity = pulse;
    crystal.emissiveIntensity = 2.6 + Math.sin(t * 1.3) * 0.25;
    crystalViolet.emissiveIntensity = 2.2 + Math.cos(t * 1.1) * 0.25;
    gateCrystal.rotation.y = t * 0.12;
    for (let i = 0; i < glowSprites.length; i++) {
      const g = glowSprites[i];
      if (g.material) g.material.opacity = g.material.opacity; // ореолы не мигают
    }
  }

  return {
    group,
    colliders,
    platforms,
    climbs,
    /** Уровни пола: верхний ярус и зал Врат ниже на 4.6 м. */
    floors: [
      { x0: B.x0, x1: B.x1, z0: A.z0, z1: SH.z0, y: Y_TOP },
      { x0: C.x0, x1: C.x1, z0: SH.z0, z1: C.z1, y: Y_DEEP },
    ],
    lights,
    spawn,
    exit,
    spots,
    update,
    /** Габариты локации — для диагностики и тестов. */
    rooms: {
      entry: { x: (A.x0 + A.x1) / 2, z: (A.z0 + A.z1) / 2, w: A.x1 - A.x0, d: A.z1 - A.z0, y: Y_TOP },
      crystal: { x: (B.x0 + B.x1) / 2, z: (B.z0 + B.z1) / 2, w: B.x1 - B.x0, d: B.z1 - B.z0, y: Y_TOP },
      shaft: { x: (SH.x0 + SH.x1) / 2, z: (SH.z0 + SH.z1) / 2, w: SH.x1 - SH.x0, d: SH.z1 - SH.z0, y: Y_DEEP },
      gate: { x: (C.x0 + C.x1) / 2, z: (C.z0 + C.z1) / 2, w: C.x1 - C.x0, d: C.z1 - C.z0, y: Y_DEEP },
    },
    /** Точка входа в зал Врат (нижний ярус). */
    gateHall: { x: 0, z: az },
    W: B.x1 - B.x0,
    D: C.z1 - A.z0,
    H: H_TOP,
  };
}
