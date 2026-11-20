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
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

  /* ---------------- материалы пещеры ----------------
   *
   *  Текстура скалы тёмная сама по себе, поэтому цвет материала задан
   *  с коэффициентом больше единицы: так камень читается и вблизи, и
   *  в полумраке, и не превращается в чёрный силуэт.
   */
  const rock = new THREE.MeshStandardMaterial({
    map: M.caveWall.map, roughness: 1.0, metalness: 0.0,
  });
  rock.color.setRGB(1.52, 1.48, 1.68);
  const rockDark = new THREE.MeshStandardMaterial({
    map: M.caveWall.map, roughness: 1.0,
  });
  rockDark.color.setRGB(1.0, 0.99, 1.16);
  const rockWarm = new THREE.MeshStandardMaterial({
    map: M.caveWall.map, roughness: 1.0,
  });
  rockWarm.color.setRGB(1.42, 1.28, 1.34);
  const rockDeep = new THREE.MeshStandardMaterial({
    map: M.caveWall.map, roughness: 1.0,
  });
  rockDeep.color.setRGB(0.9, 0.95, 1.16);
  // гранёный камень: обломки породы, плиты пола
  const flagstone = new THREE.MeshStandardMaterial({
    map: M.caveWall.map, roughness: 0.92, metalness: 0.04,
  });
  flagstone.color.setRGB(0.44, 0.44, 0.55);
  // Самоцвет — матовый камень с собственным свечением. Металл и гладкая
  // поверхность давали белый блик, и кристалл выглядел картонным.
  const crystal = new THREE.MeshStandardMaterial({
    color: 0x14266a, emissive: 0x3a6bf0, emissiveIntensity: 0.24, roughness: 0.42, metalness: 0.0,
    flatShading: true,
  });
  const crystalViolet = new THREE.MeshStandardMaterial({
    color: 0x261c60, emissive: 0x6a46e8, emissiveIntensity: 0.22, roughness: 0.44, metalness: 0.0,
    flatShading: true,
  });
  const rune = new THREE.MeshStandardMaterial({
    color: 0x4a86b8, emissive: 0x3f7fc0, emissiveIntensity: 1.1, roughness: 0.45,
  });
  // гнилая древесина из старых лесов — ящики, бочки, козлы
  const rotWood = new THREE.MeshStandardMaterial({
    map: M.timber.map, roughness: 1.0,
  });
  rotWood.color.setRGB(0.4, 0.35, 0.31);
  const rotIron = new THREE.MeshStandardMaterial({
    color: 0x4a443d, roughness: 0.68, metalness: 0.35,
  });
  const boneMat = new THREE.MeshStandardMaterial({
    map: M.bone.map, color: 0xc9c0a4, roughness: 0.82,
  });
  const ragCloth = new THREE.MeshStandardMaterial({
    color: 0x4b3b39, roughness: 1, side: THREE.DoubleSide,
  });
  // огонь факела — отдельный материал, чтобы анимировать общий для всех
  const torchFlame = new THREE.MeshStandardMaterial({
    color: 0xffb04a, emissive: 0xff8a28, emissiveIntensity: 3.4, roughness: 0.9,
  });
  const torchCore = new THREE.MeshStandardMaterial({
    color: 0xfff0c0, emissive: 0xffd070, emissiveIntensity: 4.2, roughness: 0.9,
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

  /**
   * Гранёный самоцвет: шестигранная призма с пирамидальной вершиной.
   *
   * Один конус читался как плоский треугольник. Призма с вершиной
   * выглядит настоящим кристаллом: видны грани, их блики и тень.
   *
   * @param {number} r радиус основания
   * @param {number} h полная высота
   * @returns {THREE.BufferGeometry} геометрия
   */
  const shardGeo = (r, h) => {
    const body = h * 0.72;
    const g = cyl(r * 0.88, r, body, 6);
    const tip = cone(r * 0.88, h - body, 6);
    tip.translate(0, body / 2 + (h - body) / 2, 0);
    const merged = mergeGeometries([g, tip], false);
    return merged || g;
  };

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
   * Архитектурный порядок стены: цоколь, пилястры, тяга и карниз.
   *
   * Без них стена выглядит плитой, вырубленной в скале. Цоколь и тяга
   * дают горизонтальные линии, пилястры — вертикальные, и зал наконец
   * выглядит построенным, а не выдолбленным.
   *
   * @param {'x'|'z'} axis вдоль какой оси лежит стена
   * @param {number} coord координата стены по другой оси
   * @param {number} from начало стены вдоль оси
   * @param {number} to конец стены вдоль оси
   * @param {number[][]} gaps проёмы, их порядок обходит
   * @param {number} base отметка пола
   * @param {number} spring высота, на которой начинается свод
   * @param {number} inward куда смотрит «внутрь»: +1 или -1 по другой оси
   */
  const wallOrder = (axis, coord, from, to, gaps, base, spring, inward) => {
    // куски стены без проёмов
    const pieces = [];
    let cur = from;
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [g0, g1] of sorted) {
      if (g0 > cur) pieces.push([cur, g0]);
      cur = Math.max(cur, g1);
    }
    if (cur < to) pieces.push([cur, to]);

    /**
     * Кладка одного пояса вдоль стены.
     *
     * @param {number} a0 начало по оси стены
     * @param {number} a1 конец по оси стены
     * @param {number} y высота пояса
     * @param {number} h высота пояса
     * @param {number} depth глубина выступа внутрь
     * @param {string} key материал
     */
    const band = (a0, a1, y, h, depth, key) => {
      const len = a1 - a0;
      if (len < 0.3) return;
      const mid = (a0 + a1) / 2;
      const c = coord + inward * depth * 0.42;
      if (axis === 'x') walls.add(box(len, h, depth, 1.2), key, mat(mid, y, c));
      else walls.add(box(depth, h, len, 1.2), key, mat(c, y, mid));
    };

    for (const [p0, p1] of pieces) {
      // цоколь — широкий, чуть выступает
      band(p0, p1, base + 0.42, 0.84, 1.5, 'rockDark');
      // тяга на уровне груди
      band(p0, p1, base + 3.3, 0.26, 1.22, 'rockDark');
      // карниз под сводом
      band(p0, p1, spring - 0.26, 0.52, 1.75, 'rockDark');

      // пилястры: вертикальные пилоны с базой и капителью
      const span = p1 - p0;
      const n = Math.max(1, Math.round(span / 4.2));
      for (let i = 0; i <= n; i++) {
        const a = p0 + (span * i) / n;
        if (i === 0) continue;                       // у самого края не ставим
        const w = 0.78;
        if (a + w / 2 > p1 - 0.1) continue;
        const h = spring - base - 0.9;
        const c = coord + inward * 0.42;
        if (axis === 'x') {
          walls.add(box(w, h, 1.34, 1.2), 'rock', mat(a, base + 0.84 + h / 2, c, 0, 0, 0));
          walls.add(box(w + 0.22, 0.3, 1.6, 1.2), 'rockDark', mat(a, base + 0.98, c));
          walls.add(box(w + 0.16, 0.34, 1.56, 1.2), 'rockDark', mat(a, spring - 0.72, c));
        } else {
          walls.add(box(1.34, h, w, 1.2), 'rock', mat(c, base + 0.84 + h / 2, a, 0, 0, 0));
          walls.add(box(1.6, 0.3, w + 0.22, 1.2), 'rockDark', mat(c, base + 0.98, a));
          walls.add(box(1.56, 0.34, w + 0.16, 1.2), 'rockDark', mat(c, spring - 0.72, a));
        }
      }
    }
  };

  /**
   * Бочковый свод: сегменты дуги плюс рёбра на границах пролётов.
   *
   * Плоская плита потолка выглядела как фанера над залом. Дуга свода
   * ловит свет по всей поверхности — зал читается объёмным.
   *
   * @param {number} x0 левый край пролёта
   * @param {number} x1 правый край пролёта
   * @param {number} z0 ближний край (по Z)
   * @param {number} z1 дальний край
   * @param {number} springY высота, с которой начинается свод
   * @param {number} rise подъём свода вверх
   * @param {number} bays число пролётов вдоль Z
   * @param {number} segs число сегментов в пролёте
   */
  const vault = (x0, x1, z0, z1, springY, rise, bays, segs) => {
    const cx = (x0 + x1) / 2;
    const a = (x1 - x0) / 2;           // полупролёт
    const b = rise;                    // подъём
    const bayLen = (z1 - z0) / bays;
    const th = 0.55;

    /**
     * Сегмент дуги.
     *
     * @param {number} t0 угол начала
     * @param {number} t1 угол конца
     * @param {number} z0 начало по Z
     * @param {number} z1 конец по Z
     * @param {number} thickness толщина
     * @param {number} drop насколько опустить (для рёбер)
     * @param {string} key материал
     */
    const seg = (t0, t1, z0, z1, thickness, drop, key) => {
      const tm = (t0 + t1) / 2;
      const px = cx + a * Math.sin(tm);
      const py = springY + b * Math.cos(tm);
      const dx = a * Math.cos(tm), dy = -b * Math.sin(tm);
      const L = Math.hypot(dx, dy) || 1;
      const theta = Math.atan2(dy, dx);          // наклон сегмента
      const upX = (b * Math.sin(tm)) / L;         // локальная «верх» сегмента
      const upY = (a * Math.cos(tm)) / L;
      const chord = Math.hypot(a * (Math.sin(t1) - Math.sin(t0)), b * (Math.cos(t1) - Math.cos(t0)));
      const len = chord * 1.08 + 0.04;
      const ox = px + upX * (thickness / 2 - drop);
      const oy = py + upY * (thickness / 2 - drop);
      ceil.add(box(len, thickness, z1 - z0, 1.3), key,
        mat(ox, oy, (z0 + z1) / 2, 0, 0, theta));
    };

    for (let bi = 0; bi < bays; bi++) {
      const bz0 = z0 + bayLen * bi;
      const bz1 = bz0 + bayLen;
      for (let i = 0; i < segs; i++) {
        const t0 = -Math.PI / 2 + (Math.PI * i) / segs;
        const t1 = -Math.PI / 2 + (Math.PI * (i + 1)) / segs;
        seg(t0, t1, bz0, bz1, th, 0, 'rockDark');
      }
      // ребро на стыке пролётов — оно выходит из свода вниз
      if (bi > 0) {
        const rz = bz0;
        for (let i = 0; i < segs; i++) {
          const t0 = -Math.PI / 2 + (Math.PI * i) / segs;
          const t1 = -Math.PI / 2 + (Math.PI * (i + 1)) / segs;
          seg(t0, t1, rz - 0.24, rz + 0.24, th + 0.28, 0.24, 'rock');
        }
      }
    }
    // конёк свода вдоль оси — тонкая балка поверх дуги
    ceil.add(box(1.5, 0.5, z1 - z0, 1.3), 'rockDark',
      mat(cx, springY + b + 0.35, (z0 + z1) / 2));
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
  // углы между залами: без этих стен оставалась щель в 3 м, куда можно
  // было зайти с кристального зала
  wall('x', B.z0, B.x0, A.x0, [], H_TOP + 1.4, Y_TOP);
  wall('x', B.z0, A.x1, B.x1, [], H_TOP + 1.4, Y_TOP);
  // северная стена зала Врат — по бокам от шахты. В проёме между стенами
  // спуск на лестницу, по краям — сплошная порода
  wall('x', C.z0, C.x0, SH.x0, [], H_DEEP + 1.4, Y_DEEP);
  wall('x', C.z0, SH.x1, C.x1, [], H_DEEP + 1.4, Y_DEEP);
  // южные стены зала Врат
  wall('x', C.z1, C.x0, C.x1, [], H_DEEP + 1.4, Y_DEEP);
  wall('z', C.x0, C.z0, C.z1, [], H_DEEP + 1.4, Y_DEEP);
  wall('z', C.x1, C.z0, C.z1, [], H_DEEP + 1.4, Y_DEEP);

  /* --- архитектурный порядок: цоколь, пилястры, тяга, карниз --- */
  const SPRING_TOP = 5.4;                 // высота, с которой начинается свод
  const SPRING_DEEP = Y_DEEP + 5.2;
  wallOrder('x', A.z0, A.x0, A.x1, [[-GATE_X, GATE_X]], Y_TOP, SPRING_TOP, 1);
  wallOrder('z', A.x0, A.z0, A.z1, [], Y_TOP, SPRING_TOP, 1);
  wallOrder('z', A.x1, A.z0, A.z1, [], Y_TOP, SPRING_TOP, -1);
  // перегородка оформлена с обеих сторон
  wallOrder('x', A.z1, A.x0, A.x1, [GAP_MAIN, GAP_WEST, GAP_EAST], Y_TOP, SPRING_TOP, -1);
  wallOrder('x', A.z1, A.x0, A.x1, [GAP_MAIN, GAP_WEST, GAP_EAST], Y_TOP, SPRING_TOP, 1);
  wallOrder('z', B.x0, B.z0, B.z1, [], Y_TOP, SPRING_TOP, 1);
  wallOrder('z', B.x1, B.z0, B.z1, [], Y_TOP, SPRING_TOP, -1);
  wallOrder('x', B.z1, B.x0, SH.x0, [], Y_TOP, SPRING_TOP, -1);
  wallOrder('x', B.z1, SH.x1, B.x1, [], Y_TOP, SPRING_TOP, -1);
  wallOrder('x', B.z0, B.x0, A.x0, [], Y_TOP, SPRING_TOP, 1);
  wallOrder('x', B.z0, A.x1, B.x1, [], Y_TOP, SPRING_TOP, 1);
  wallOrder('x', C.z0, C.x0, SH.x0, [], Y_DEEP, SPRING_DEEP, -1);
  wallOrder('x', C.z0, SH.x1, C.x1, [], Y_DEEP, SPRING_DEEP, -1);
  wallOrder('x', C.z1, C.x0, C.x1, [], Y_DEEP, SPRING_DEEP, -1);
  wallOrder('z', C.x0, C.z0, C.z1, [], Y_DEEP, SPRING_DEEP, 1);
  wallOrder('z', C.x1, C.z0, C.z1, [], Y_DEEP, SPRING_DEEP, -1);

  group.add(walls.build({ rock, rockDark, rockWarm }, null, { name: 'dungeonWalls' }));

  /* ================================================================
   *  СВОДЫ
   * ================================================================ */
  const ceil = new Builder();
  // Свод бочковый: сегменты дуги и рёбра на стыках пролётов.
  vault(A.x0 + 0.45, A.x1 - 0.45, A.z0 + 0.45, A.z1 + 0.45, SPRING_TOP, 2.1, 3, 10);
  vault(B.x0 + 0.45, B.x1 - 0.45, A.z1 + 0.45, B.z1 - 0.45, SPRING_TOP, 2.4, 5, 12);
  vault(C.x0 + 0.45, C.x1 - 0.45, C.z0 + 0.45, C.z1 - 0.45, SPRING_DEEP, 2.2, 4, 12);
  // каменная «крышка» над шахтой: за ней — глухая порода, а не пустота сцены
  ceil.add(box(B.x1 - B.x0 + 2, 1.2, SH.z1 - B.z1 + 1.4, 1.3), 'rockDark',
    mat(0, SPRING_TOP + 2.4, (B.z1 + SH.z1) / 2));
  for (let z = B.z1 + 1.2; z < SH.z1; z += 2.6) {
    ceil.add(box(B.x1 - B.x0 + 1.4, 0.6, 0.9, 1.3), 'rockDark', mat(0, SPRING_TOP + 1.9, z));
  }
  // порода над сводами — страховка от щелей по краям
  ceil.add(box(B.x1 - B.x0 + 2, 1.2, B.z1 - A.z0 + 2, 1.3), 'rockDark',
    mat(0, SPRING_TOP + 3.4, (A.z0 + B.z1) / 2));
  ceil.add(box(C.x1 - C.x0 + 2, 1.2, C.z1 - C.z0 + 2, 1.3), 'rockDark',
    mat(0, SPRING_DEEP + 3.4, (C.z0 + C.z1) / 2));
  group.add(ceil.build({ rockDark, rock }, null, { name: 'dungeonCeiling' }));

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

  // наверху шахты — кристаллы и мягкий синий свет: проём вниз должен
  // читаться как спуск, а не как чёрный прямоугольник
  for (const [sx, sz] of [[-3.4, 7.2], [3.4, 7.2], [0, 12.6]]) {
    const m = new THREE.Mesh(shardGeo(0.26, 1.5), crystal);
    m.position.set(sx, Y_TOP - 0.35, sz);
    m.rotation.z = sx === 0 ? Math.PI : sx > 0 ? -0.3 : 0.3;
    group.add(m);
  }
  const shaftLight = new THREE.PointLight(0x5f8cff, 1.5, 16, 1.5);
  shaftLight.position.set(0, Y_TOP - 0.6, 8.5);
  group.add(shaftLight);
  const shaftGlow = makeGlow(glowTex, 5.0, 0x6f9dff, 0.2);
  shaftGlow.position.set(0, Y_TOP - 0.4, 8.5);
  group.add(shaftGlow);

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

  // Свет на колоннах убран: каждый точечный источник дорого стоит во
  // фрагментном шейдере, а тёплые факелы и так дают объём. Синеву
  // зала держат кристаллы и маяки.

  /* ================================================================
   *  ФАКЕЛЫ И ЖАРОВНИ — тёплый свет в холодной пещере
   *
   *  Раньше в пещере был только синий свет кристаллов, и камень читался
   *  только там, где его касался холод. Факелы дают тёплый контраст:
   *  рядом с ними стена видна, а вдали снова темно. Именно этот контраст
   *  делает зал объёмным.
   * ================================================================ */
  const props = new Builder();
  const flames = [];          // живые огни (для анимации)
  const torchLights = [];     // источники света факелов

  /**
   * Факел на кронштейне: железное крепление, древко, живой огонь.
   *
   * @param {number} x где по X
   * @param {number} y высота
   * @param {number} z где по Z
   * @param {number} ry поворот к стене
   */
  const torch = (x, y, z, ry) => {
    const dir = Math.cos(ry);                 // наружу от стены
    props.add(box(0.1, 0.34, 0.1, 1), 'iron', mat(x, y, z, 0, 0, 0));
    props.add(box(0.08, 0.08, 0.42, 1), 'iron',
      mat(x + dir * 0.16, y + 0.14, z + Math.sin(ry) * 0.16, ry));
    // древко, наклонённое от стены
    const hx = x + dir * 0.34, hz = z + Math.sin(ry) * 0.34;
    props.add(cyl(0.05, 0.07, 0.62, 5), 'wood', mat(hx, y + 0.4, hz, 0, 0, -0.34 * dir));
    // огонь
    const f = new THREE.Group();
    f.position.set(hx + dir * 0.12, y + 0.72, hz + Math.sin(ry) * 0.12);
    const c1 = new THREE.Mesh(cone(0.16, 0.46, 6), torchFlame);
    c1.position.y = 0.18;
    const c2 = new THREE.Mesh(cone(0.09, 0.28, 5), torchCore);
    c2.position.y = 0.14;
    f.add(c1, c2);
    group.add(f);
    flames.push(f);
    const glow = makeGlow(glowTex, 1.9, 0xffa254, 0.5);
    glow.position.copy(f.position);
    group.add(glow);
    const l = new THREE.PointLight(0xff8a3c, 2.9, 15, 1.6);
    l.position.set(f.position.x, f.position.y + 0.2, f.position.z);
    l.userData.base = 2.9;
    group.add(l);
    torchLights.push(l);
  };

  /**
   * Напольная жаровня: треногая чаша с углями.
   *
   * @param {number} x где по X
   * @param {number} y отметка пола
   * @param {number} z где по Z
   */
  const brazier = (x, y, z) => {
    props.add(cyl(0.42, 0.3, 0.34, 9), 'iron', mat(x, y + 0.92, z));
    props.add(cyl(0.46, 0.42, 0.09, 9), 'iron', mat(x, y + 1.11, z));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      props.add(box(0.09, 0.95, 0.09, 1), 'iron',
        mat(x + Math.cos(a) * 0.24, y + 0.47, z + Math.sin(a) * 0.24,
          0, 0, Math.cos(a) * 0.16));
    }
    props.add(cyl(0.3, 0.34, 0.1, 9), 'rockDark', mat(x, y + 1.0, z));
    const f = new THREE.Group();
    f.position.set(x, y + 1.16, z);
    const c1 = new THREE.Mesh(cone(0.24, 0.5, 6), torchFlame);
    c1.position.y = 0.2;
    const c2 = new THREE.Mesh(cone(0.13, 0.3, 5), torchCore);
    c2.position.y = 0.16;
    f.add(c1, c2);
    group.add(f);
    flames.push(f);
    const glow = makeGlow(glowTex, 2.6, 0xff9a48, 0.46);
    glow.position.copy(f.position);
    group.add(glow);
    const l = new THREE.PointLight(0xff7f30, 3.4, 19, 1.65);
    l.position.set(x, y + 1.4, z);
    l.userData.base = 3.4;
    group.add(l);
    torchLights.push(l);
    colliders.circles.push({ x, z, r: 0.55, y0: y, y1: y + 1.2 });
  };

  // факелы на стенах — по ходу движения: входной зал → кристальный → шахта
  for (const [tx, ty, tz, try_] of [
    [-11.1, 2.5, -30.5, Math.PI / 2], [11.1, 2.5, -30.5, -Math.PI / 2],
    [-14.1, 2.6, -19.0, Math.PI / 2], [14.1, 2.6, -19.0, -Math.PI / 2],
    [-14.1, 2.6, -6.0, Math.PI / 2], [14.1, 2.6, -6.0, -Math.PI / 2],
    [-13.1, Y_DEEP + 2.6, 20.5, Math.PI / 2], [13.1, Y_DEEP + 2.6, 20.5, -Math.PI / 2],
  ]) torch(tx, ty, tz, try_);

  // жаровни на пути к Вратам
  brazier(-5.6, Y_TOP, -17.2);
  brazier(5.6, Y_TOP, -4.5);
  brazier(-5.6, Y_DEEP, 20.5);

  /* ================================================================
   *  РЕКВИЗИТ — то, что делает пещеру местом, а не пустым залом
   * ================================================================ */

  // ящики, бочки, козлы у стен: складчие старых лесов
  const crates = [
    [-12.4, -25.6, 0.5], [-11.4, -25.2, -0.3], [12.6, -24.0, 1.1],
    [-13.0, -8.0, 0.2], [12.2, -6.4, -0.6], [-12.6, 2.6, 0.9],
    [12.4, 1.8, 0.4], [-11.8, Y_DEEP, 24.2, 0.7], [11.4, Y_DEEP, 25.6, -0.4],
  ];
  for (const [cx, cz, cry] of crates) {
    const base = cz > 13 ? Y_DEEP : Y_TOP;
    const s = 0.62 + (cx % 3) * 0.06;
    props.add(box(s * 1.5, s * 1.5, s * 1.5, 1), 'wood',
      mat(cx, base + s * 0.75, cz, cry, 0, 0));
    props.add(box(s * 1.56, s * 0.16, s * 1.56, 1), 'wood',
      mat(cx, base + s * 0.75, cz, cry, 0, 0));
    // обломок рядом
    props.add(box(s * 0.7, s * 0.22, s * 0.5, 1), 'wood',
      mat(cx + Math.cos(cry) * 1.1, base + 0.11, cz + Math.sin(cry) * 1.1, cry + 0.6, 0, 0.1));
    colliders.circles.push({ x: cx, z: cz, r: s * 0.95, y0: base, y1: base + s * 1.5 });
  }

  // бочка на боку, будто её волоком
  props.add(cyl(0.34, 0.34, 0.86, 10), 'wood',
    mat(10.8, 0.34, -13.2, 0, 0, Math.PI / 2));
  props.add(cyl(0.37, 0.37, 0.1, 10), 'iron',
    mat(10.55, 0.34, -13.2, 0, 0, Math.PI / 2));
  colliders.circles.push({ x: 10.8, z: -13.2, r: 0.5, y0: 0, y1: 0.7 });

  // цепи, свисающие со свода
  for (const [lx, lz, len, lbase] of [
    [-8.2, -21.8, 2.4, Y_TOP], [7.4, -19.4, 3.1, Y_TOP], [-3.4, -3.2, 2.0, Y_TOP],
    [9.6, 3.0, 2.7, Y_TOP], [-7.2, 21.0, 2.2, Y_DEEP], [6.8, 30.4, 3.0, Y_DEEP],
  ]) {
    const links = Math.floor(len / 0.26);
    for (let i = 0; i < links; i++) {
      props.add(box(0.07, 0.2, 0.07, 1), 'iron',
        mat(lx + (i % 2 ? 0.05 : -0.05), lbase + SPRING_TOP - 0.4 - i * 0.26, lz,
          i % 2 ? Math.PI / 2 : 0, 0, 0));
    }
    // крюк внизу
    props.add(cyl(0.05, 0.05, 0.34, 5), 'iron',
      mat(lx, lbase + SPRING_TOP - 0.4 - links * 0.26 - 0.12, lz, 0, 0, 0));
  }

  // кости у Врат — кто-то добрался сюда раньше
  for (let i = 0; i < 11; i++) {
    const a = rr(0, 6.28), r = rr(2.2, 6.2);
    const bx = Math.cos(a) * r, bz = C.z1 - 5.4 + Math.sin(a) * r * 0.7;
    props.add(cyl(0.06, 0.07, rr(0.3, 0.62), 5), 'bone',
      mat(bx, Y_DEEP + 0.08, bz, rr(0, 3), 0, Math.PI / 2 + rr(-0.2, 0.2)));
  }
  for (let i = 0; i < 3; i++) {
    const a = rr(0, 6.28), r = rr(2.6, 5.4);
    props.add(sphere(0.13, 7, 5), 'bone',
      mat(Math.cos(a) * r, Y_DEEP + 0.12, C.z1 - 5.4 + Math.sin(a) * r * 0.7, rr(0, 3)));
  }

  // рваные знамёна на стенах зала Врат
  for (const [px, py, pz, pry] of [
    [-13.2, Y_DEEP + 3.4, 23.5, Math.PI / 2], [13.2, Y_DEEP + 3.4, 23.5, -Math.PI / 2],
    [0, Y_DEEP + 3.9, C.z1 - 0.55, 0],
  ]) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), ragCloth);
    cl.position.set(px, py, pz);
    cl.rotation.y = pry;
    cl.rotation.z = rr(-0.08, 0.08);
    group.add(cl);
    props.add(box(1.6, 0.1, 0.1, 1), 'iron', mat(px, py + 1.32, pz, pry));
  }

  group.add(props.build({ wood: rotWood, iron: rotIron, bone: boneMat }, null,
    { name: 'dungeonProps' }));

  /* --- лужи: тёмная вода в углублениях пола --- */
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x141c2c, roughness: 0.12, metalness: 0.5,
    transparent: true, opacity: 0.86,
  });
  for (const [px, pz, pr, pbase] of [
    [-9.8, -21.6, 1.5, Y_TOP], [8.6, -5.2, 1.2, Y_TOP], [-2.6, -9.4, 1.0, Y_TOP],
    [-7.4, 25.6, 1.6, Y_DEEP], [6.2, 29.4, 1.3, Y_DEEP], [1.8, 17.2, 1.1, Y_DEEP],
  ]) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(pr, 14), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(px, pbase + 0.03, pz);
    p.scale.set(1, 0.72, 1);
    group.add(p);
  }

  /* --- истоптанная тропа от портала к Вратам: плиты по линии пути --- */
  const pathPts = [
    [0, -26.5, Y_TOP], [0, -20.0, Y_TOP], [0, -12.0, Y_TOP], [0, -4.0, Y_TOP],
    [0, 3.0, Y_TOP], [0, 8.5, Y_TOP], [0, 12.0, Y_TOP], [0, 16.0, Y_DEEP],
    [0, 22.0, Y_DEEP], [0, 27.0, Y_DEEP], [0, 30.4, Y_DEEP],
  ];
  for (let i = 0; i < pathPts.length - 1; i++) {
    const [x0, z0, y0] = pathPts[i];
    const [x1, z1, y1] = pathPts[i + 1];
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.15));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      const y = y0 + (y1 - y0) * t;
      const w = rr(1.7, 2.3);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, rr(1.15, 1.6)), flagstone);
      f.rotation.x = -Math.PI / 2;
      f.rotation.z = rr(-0.1, 0.1);
      f.position.set(px + rr(-0.3, 0.3), y + 0.012, pz + rr(-0.25, 0.25));
      group.add(f);
    }
  }

  /* ================================================================
   *  КРИСТАЛЛЫ — холодное синее свечение
   * ================================================================ */
  const crystals = new Builder();
  let lightBudget = 3;

  /**
   * Врастает кристалл в стену или пол: пучок граней с боковыми осколками.
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
    // кристалл растёт пучком: главный стержень + несколько отростков.
    // Одинокая игла читалась как белый треугольник — пучок читается как
    // живой самоцвет.
    crystals.add(shardGeo(s, s * 3.4), key, mat(x, y, z, ry, 0, rz));
    const shards = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < shards; i++) {
      const ss = s * (0.3 + rnd() * 0.34);
      const m = mat(x, y, z, ry + rr(-1.2, 1.2), 0, rz + rr(-0.55, 0.55));
      m.multiply(new THREE.Matrix4().makeTranslation(
        rr(-0.16, 0.16) * s * 3, rr(-0.5, 0.5) * s * 2, rr(-0.16, 0.16) * s * 3));
      crystals.add(shardGeo(ss, ss * 2.7), key, m);
    }
    // щепки у основания
    for (let i = 0; i < 3; i++) {
      const ss = s * (0.14 + rnd() * 0.16);
      crystals.add(shardGeo(ss, ss * 1.8), key,
        mat(x + rr(-0.4, 0.4), y + ss * 0.8, z + rr(-0.4, 0.4), rr(0, 3), 0, rr(-0.5, 0.5)));
    }
    if (s > 0.28) {                       // ореол — только у крупных кристаллов
      const g = makeGlow(glowTex, s * 2.8, violet ? 0x7a5fff : 0x4f86ff, 0.16);
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
  // кристаллы на полу верхнего яруса. Крупным — свой источник внутри:
  // грани светятся изнутри, и самоцвет перестаёт быть плоским пятном.
  let floorGlows = 2;
  for (let i = 0; i < 9; i++) {
    const x = rr(B.x0 + 2, B.x1 - 2), z = rr(A.z0 + 2, B.z1 - 2);
    const s = rr(0.18, 0.42);
    const violet = rnd() > 0.75;
    addCrystal(x, s * 1.2, z, s, rr(0, 6.28), rr(-0.18, 0.18), violet, false);
    if (s > 0.34 && floorGlows > 0) {
      floorGlows--;
      const l = new THREE.PointLight(violet ? 0x7a55e8 : 0x4a7cff, 1.7, 10, 1.4);
      l.position.set(x, s * 1.9 + 1.15, z);
      group.add(l);
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
  // свисающие кристаллы под сводом: сосульки, а не иглы
  for (let i = 0; i < 16; i++) {
    const x = rr(B.x0 + 2, B.x1 - 2), z = rr(A.z0 + 2, B.z1 - 2);
    const s = rr(0.13, 0.26);
    crystals.add(shardGeo(s, s * 2.8), 'blue',
      mat(x, H_TOP + 0.4, z, rr(0, 6.28), Math.PI, rr(-0.15, 0.15)));
    crystals.add(shardGeo(s * 0.55, s * 1.9), 'blue',
      mat(x + rr(-0.3, 0.3), H_TOP + 0.3, z + rr(-0.3, 0.3), rr(0, 6.28), Math.PI, rr(-0.2, 0.2)));
  }
  for (let i = 0; i < 12; i++) {
    const x = rr(C.x0 + 2, C.x1 - 2), z = rr(C.z0 + 2, C.z1 - 2);
    const s = rr(0.13, 0.28);
    crystals.add(cone(s, s * 2.8, 5), rnd() > 0.6 ? 'violet' : 'blue',
      mat(x, Y_DEEP + H_DEEP + 0.4, z, rr(0, 6.28), Math.PI, rr(-0.15, 0.15)));
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
  // мелкий щебень, разбросанный по полу: пол перестаёт быть пустой заливкой
  for (let i = 0; i < 46; i++) {
    const deep = i % 3 === 0;
    const px = rr(deep ? C.x0 + 1.2 : B.x0 + 1.2, deep ? C.x1 - 1.2 : B.x1 - 1.2);
    const pz = rr(deep ? C.z0 + 1.2 : A.z0 + 1.2, deep ? C.z1 - 1.2 : B.z1 - 1.2);
    const base = deep ? Y_DEEP : Y_TOP;
    const r = rr(0.08, 0.26);
    spikes.add(sphere(r, 5, 4), rnd() > 0.5 ? 'rock' : 'rockDark',
      mat(px, base + r * 0.42, pz, rr(0, 3), rr(0, 3), rr(0, 3)));
  }
  group.add(spikes.build({ rock, rockDark }, null, { name: 'dungeonSpikes' }));

  /* ================================================================
   *  ВРАТА: алтарь с гигантским кристаллом в глубине
   * ================================================================ */
  const altar = new Builder();
  const az = C.z1 - 4.2;
  altar.add(cyl(3.4, 3.9, 0.6, 9), 'rockDark', mat(0, Y_DEEP + 0.3, az));
  altar.add(cyl(2.2, 2.6, 0.5, 9), 'rock', mat(0, Y_DEEP + 0.8, az));
  // скала-алтарь за кристаллом: гранёные плиты, поставленные друг на друга.
  // Раньше здесь были гладкие шары — они читались как куча валунов.
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rr(-0.2, 0.2);
    const r = 3.0 + rr(-0.4, 0.7);
    const w = rr(1.1, 2.2), h = rr(0.9, 1.8), d = rr(0.7, 1.4);
    altar.add(box(w, h, d, 1.2), i % 3 === 0 ? 'rock' : 'rockWarm',
      mat(Math.cos(a) * r, Y_DEEP + 0.4 + h / 2, az + Math.sin(a) * r * 0.7,
        rr(0, 3), rr(-0.22, 0.22), rr(-0.22, 0.22)));
  }
  // выступ породы за алтарём — стена, из которой растёт самоцвет
  for (let i = 0; i < 6; i++) {
    const w = rr(1.6, 3.0), h = rr(1.4, 2.6);
    altar.add(box(w, h, 1.2, 1.2), 'rockDark',
      mat(rr(-3.2, 3.2), Y_DEEP + 1.2 + h / 2, az + 2.6 + rr(-0.3, 0.3),
        rr(-0.3, 0.3), rr(-0.16, 0.16), rr(-0.16, 0.16)));
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

  // огромный кристалл Врат — гранёная связка, а не одиночная игла
  const gateCrystal = new THREE.Group();
  gateCrystal.position.set(0, Y_DEEP + 1.05, az);
  const gateShards = new Builder();
  // центральный стержень
  gateShards.add(shardGeo(0.95, 6.6), 'violet', mat(0, 3.3, 0, 0.2));
  // боковые иглы разной высоты — силуэт перестаёт быть «плоским»
  const gateSpikes = [
    [1.25, 0.35, 3.8, -0.26], [-1.35, 0.3, 3.4, 0.3], [0.6, 1.15, 2.6, -0.16],
    [-0.75, -1.05, 2.3, 0.2], [1.6, -0.85, 2.0, -0.34], [-1.8, 0.9, 1.8, 0.4],
    [0.2, -1.5, 1.5, 0.12], [-2.3, -0.5, 1.4, 0.5],
  ];
  for (const [sx, sz, h, tilt] of gateSpikes) {
    const key = rnd() > 0.45 ? 'violet' : 'blue';
    gateShards.add(shardGeo(0.34 + rnd() * 0.26, h), key,
      mat(sx, h / 2, sz, rr(0, 6.28), 0, tilt));
  }
  const gateMesh = gateShards.build({ blue: crystal, violet: crystalViolet }, null,
    { name: 'dungeonGateCrystal' });
  gateCrystal.add(gateMesh);
  group.add(gateCrystal);
  const gateGlow = makeGlow(glowTex, 11, 0x8a6cff, 0.42);
  gateGlow.position.set(0, Y_DEEP + 3.2, az);
  group.add(gateGlow);
  const gateLight = new THREE.PointLight(0x7a78ff, 3.4, 32, 1.55);
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
    shards.add(shardGeo(rr(0.08, 0.2), rr(0.4, 1.1)), rnd() > 0.5 ? 'blue' : 'violet',
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
    // знак — три вертикальных насечки со «сходящимися» отростками
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 0.42;
      const len = 0.62 + (i === 1 ? 0.28 : 0);
      const g = box(0.07, len, 0.07, 1);
      if (axis === 'z') runes.add(g, 'rune', mat(rx, ry + (i === 1 ? 0.1 : 0), rz + off, 0, 0, rr(-0.12, 0.12)));
      else runes.add(g, 'rune', mat(rx + off, ry + (i === 1 ? 0.1 : 0), rz, 0, 0, rr(-0.12, 0.12)));
      // короткий отросток к средней насечке
      const tick = box(0.06, 0.06, 0.3, 1);
      if (axis === 'z') runes.add(tick, 'rune', mat(rx, ry + 0.22, rz + off + 0.14, 0, 0, rr(-0.3, 0.3)));
      else runes.add(tick, 'rune', mat(rx + off + 0.14, ry + 0.22, rz, 0, 0, rr(-0.3, 0.3)));
    }
    const gl = makeGlow(glowTex, 1.5, 0x5fa8ff, 0.13);
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

  // «улица» за порталом: раньше в проёме была чёрная пустота сцены.
  // Теперь там светлый прямоугольник дневного света — проём читается
  // как выход наверх, а не как дыра в стене.
  const outsideMat = new THREE.MeshBasicMaterial({
    color: 0x7d8fa8, transparent: true, opacity: 0.95, fog: false,
  });
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(GATE_X * 2 - 0.2, 3.4), outsideMat);
  outside.position.set(0, 1.75, A.z0 + 0.05);
  group.add(outside);
  // мягкое свечение по краю проёма
  const outsideGlow = makeGlow(glowTex, 5.6, 0x9fb8d8, 0.4);
  outsideGlow.position.set(0, 1.9, A.z0 + 0.5);
  group.add(outsideGlow);

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
   *  По стенам растут голубые грибы: раньше каждый давал свой источник
   *  света, и их было больше тридцати — шейдеры раздувались, а картинка
   *  всё равно оставалась тёмной. Теперь грибы светятся материалом, а
   *  реальный свет дают лишь четыре самых крупных.
   * ================================================================ */
  for (const [mx, my, mz] of [
    [-9.5, 1.5, -27], [10, Y_DEEP + 1.5, 21],
  ]) {
    const l = new THREE.PointLight(0x5a83ea, 4.2, 34, 1.45);
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
  // Грибы светятся материалом: свой точечный источник у каждого был
  // дорог, а света всё равно почти не давал.
  for (const [mx, base, mz] of mushSpots) {
    const h = rr(0.16, 0.3);
    mush.add(cyl(0.05, 0.08, h, 5), 'rockDark', mat(mx, base + h / 2, mz));
    mush.add(sphere(h * 0.7, 6, 4), 'glow', mat(mx, base + h + h * 0.2, mz));
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
   *
   *  Пещера читается, если свет трёхуровневый: холодная заливка сверху
   *  (небо свода), тёплые факелы у пола и мягкий свет вокруг игрока.
   *  Без последнего камень рядом остаётся чёрным, а зал — пустым.
   * ================================================================ */
  const amb = new THREE.AmbientLight(0x54608a, 4.8);
  group.add(amb);
  lights.ambient = amb;
  const hemi = new THREE.HemisphereLight(0x7e91c8, 0x3a445c, 3.1);
  group.add(hemi);
  lights.hemi = hemi;
  const key = new THREE.DirectionalLight(0x9fb6ff, 1.15);
  key.position.set(-9, 14, -7);
  group.add(key);
  lights.key = key;
  // «отражённый» снизу луч: подсвечивает свод, иначе верх зала чёрный
  const roof = new THREE.DirectionalLight(0x7f95d8, 0.55);
  roof.position.set(2, -12, -3);
  group.add(roof);
  lights.roof = roof;
  const bounce = new THREE.PointLight(0x5a7ce0, 3.4, 52, 1.4);
  bounce.position.set(0, 1.1, -6);
  group.add(bounce);
  lights.bounce = bounce;
  const bounceEntry = new THREE.PointLight(0x5a7ce0, 2.6, 40, 1.4);
  bounceEntry.position.set(0, 1.1, -27);
  group.add(bounceEntry);
  lights.bounceEntry = bounceEntry;
  const bounceDeep = new THREE.PointLight(0x5a7ce0, 2.8, 52, 1.4);
  bounceDeep.position.set(0, Y_DEEP + 1.1, 24);
  group.add(bounceDeep);
  lights.bounceDeep = bounceDeep;

  /* --- фонарь игрока: тёплый круг света вокруг камеры --- */
  const lantern = new THREE.PointLight(0xffc487, 2.0, 16, 1.3);
  const lanternDir = new THREE.Vector3();
  lantern.position.set(0, 1.4, -26.5);
  group.add(lantern);
  lights.lantern = lantern;

  /* --- пылинки в воздухе: они ловят свет факелов и создают объём --- */
  const DUST_N = 260;
  const dustPos = new Float32Array(DUST_N * 3);
  const dustSeed = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    const deep = rnd() > 0.55;
    dustPos[i * 3] = rr(deep ? C.x0 + 1 : B.x0 + 1, deep ? C.x1 - 1 : B.x1 - 1);
    dustPos[i * 3 + 1] = rr(deep ? Y_DEEP + 0.4 : Y_TOP + 0.4, deep ? Y_DEEP + 4 : Y_TOP + 4);
    dustPos[i * 3 + 2] = rr(deep ? C.z0 + 1 : A.z0 + 1, deep ? C.z1 - 1 : B.z1 - 1);
    dustSeed[i] = rnd() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    map: smokeTex, color: 0xbcd0ff, size: 0.07, sizeAttenuation: true,
    transparent: true, opacity: 0.5, depthWrite: false,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  group.add(dustPoints);

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
   * Анимация локации: туман ползёт, кристаллы пульсируют, огни горят.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t мировое время
   * @param {THREE.Vector3} [eye] положение камеры — за ним идёт фонарь
   */
  function update(dt, t, eye) {
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
    crystal.emissiveIntensity = 1.15 + Math.sin(t * 1.3) * 0.14;
    crystalViolet.emissiveIntensity = 1.05 + Math.cos(t * 1.1) * 0.14;
    gateCrystal.rotation.y = t * 0.12;
    for (let i = 0; i < glowSprites.length; i++) {
      const g = glowSprites[i];
      if (g.material) g.material.opacity = g.material.opacity; // ореолы не мигают
    }

    // огни факелов и жаровень живут: пламя подрагивает, свет пульсирует
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const ph = i * 2.7;
      const k = 0.86 + Math.sin(t * 8.3 + ph) * 0.09 + Math.sin(t * 19.7 + ph * 1.7) * 0.05;
      f.scale.set(0.9 + k * 0.16, k, 0.9 + k * 0.16);
      f.rotation.y = Math.sin(t * 1.6 + ph) * 0.22;
    }
    const flick = 0.88 + Math.sin(t * 7.1) * 0.08 + Math.sin(t * 17.3) * 0.05;
    torchFlame.emissiveIntensity = 3.4 * flick;
    torchCore.emissiveIntensity = 4.2 * flick;
    for (let i = 0; i < torchLights.length; i++) {
      const l = torchLights[i];
      const ph = i * 1.9;
      l.intensity = l.userData.base * (0.82 + Math.sin(t * 9.2 + ph) * 0.12 + Math.sin(t * 21.1 + ph) * 0.06);
    }

    // пылинки медленно плывут в потоке
    const dp = dustGeo.attributes.position;
    for (let i = 0; i < DUST_N; i++) {
      const s = dustSeed[i];
      dp.setX(i, dp.getX(i) + Math.sin(t * 0.22 + s) * dt * 0.09);
      dp.setZ(i, dp.getZ(i) + Math.cos(t * 0.17 + s * 1.3) * dt * 0.07);
      dp.setY(i, dp.getY(i) + Math.sin(t * 0.3 + s * 0.7) * dt * 0.05);
    }
    dp.needsUpdate = true;

    // Фонарь игрока идёт чуть впереди камеры: стоя на ступенях, он
    // светит в пол под ногами и выжигает белое пятно.
    if (eye) {
      if (eye.isCamera && eye.getWorldDirection) {
        eye.getWorldDirection(lanternDir);
        lantern.position.set(
          eye.position.x + lanternDir.x * 0.7,
          eye.position.y - 0.35 + lanternDir.y * 0.7,
          eye.position.z + lanternDir.z * 0.7,
        );
      } else {
        lantern.position.set(eye.x, eye.y - 0.5, eye.z);
      }
      lantern.intensity = 2.0 + Math.sin(t * 5.3) * 0.1;
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
