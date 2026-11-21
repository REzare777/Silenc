/**
 * ============================================================================
 *  Вырубка: следы лесосеки на краю поляны
 * ============================================================================
 *
 *  Когда лес под чистый луг убирают, от деревьев остаются пеньки, а
 *  срубленные стволы лежат у кромки. Без этого вырубка читается как
 *  «здесь просто нет деревьев» — как заплатка. Со пеньками и брёвнами
 *  видно, что поляну расчистили намеренно.
 *
 *  @module world/clearing
 */

import { Builder, cyl, box, mat } from './geo.js';

/**
 * Собрать вырубку по кромке поляны.
 *
 * @param {object} M набор материалов
 * @param {object} opts положение вырубки
 * @param {number} opts.x центр X
 * @param {number} opts.z центр Z
 * @param {number} [opts.inner] внутренний радиус (край поляны)
 * @param {number} [opts.outer] внешний радиус (край леса)
 * @param {Array<{x: number, z: number, r: number}>} [opts.avoid] места, где ничего не класть
 * @param {number} [opts.seed] зерно случайности
 * @returns {object} группа с методом place
 */
export function felledClearing(M, opts = {}) {
  const { x = 0, z = 0, inner = 9, outer = 13, avoid = [], seed = 7 } = opts;
  const B = new Builder();

  // простой генератор: без него каждый запуск давал бы разную вырубку
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const free = (px, pz) => {
    for (const a of avoid) {
      if (Math.hypot(px - a.x, pz - a.z) < a.r) return false;
    }
    return true;
  };

  /** @param {number} ang угол @param {number} r радиус */
  const spot = (ang, r) => ({ x: x + Math.cos(ang) * r, z: z + Math.sin(ang) * r });

  /* --- пеньки: спил светлый, ствол тёмный --- */
  const stumpN = 16;
  for (let i = 0; i < stumpN; i++) {
    const ang = (i / stumpN) * Math.PI * 2 + rnd() * 0.3;
    const r = inner + rnd() * (outer - inner);
    const p = spot(ang, r);
    if (!free(p.x, p.z)) continue;
    const h = 0.42 + rnd() * 0.55;
    const rad = 0.3 + rnd() * 0.26;
    B.add(cyl(rad * 0.92, rad, h, 9), 'bark', mat(p.x - x, h / 2, p.z - z));
    // светлый спил сверху
    B.add(cyl(rad * 0.88, rad * 0.88, 0.05, 9), 'oakDoor', mat(p.x - x, h + 0.01, p.z - z));
    // корни-осколки по бокам
    if (rnd() > 0.55) {
      B.add(cyl(0.07, 0.1, 0.34, 5), 'bark',
        mat(p.x - x + (rnd() - 0.5) * rad * 1.4, 0.12, p.z - z + (rnd() - 0.5) * rad * 1.4,
          rnd() * 0.5 - 0.25, rnd() * 6, rnd() * 0.5 - 0.25));
    }
  }

  /* --- срубленные стволы: лежат в траве у кромки --- */
  for (let i = 0; i < 5; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = inner + rnd() * (outer - inner) * 0.8;
    const p = spot(ang, r);
    if (!free(p.x, p.z)) continue;
    const len = 4.2 + rnd() * 3.4;
    const rad = 0.24 + rnd() * 0.14;
    const rot = rnd() * Math.PI * 2;
    // ствол — очищенная древесина, торцы светлее
    B.add(cyl(rad, rad * 0.86, len, 9), 'timber',
      mat(p.x - x, rad + 0.06, p.z - z, 0, rot, Math.PI / 2));
    // сучья-обломки
    for (let k = 0; k < 3; k++) {
      const off = (k - 1) * len * 0.22;
      B.add(cyl(0.055, 0.09, 0.5 + rnd() * 0.5, 5), 'timber',
        mat(p.x - x + Math.cos(rot) * off, rad + 0.3, p.z - z - Math.sin(rot) * off,
          rnd() * 0.9 - 0.45, rot, rnd() * 0.9 - 0.45));
    }
  }

  /* --- кучи веток: мелкий хворост, собранный в кучу --- */
  for (let k = 0; k < 3; k++) {
    const ang = rnd() * Math.PI * 2;
    const r = inner + rnd() * (outer - inner) * 0.7;
    const p = spot(ang, r);
    if (!free(p.x, p.z)) continue;
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * 0.85;
      B.add(box(0.1, 0.05, 0.7 + rnd() * 0.5, 1), 'bark',
        mat(p.x - x + Math.cos(a) * rr, 0.04 + rnd() * 0.16, p.z - z + Math.sin(a) * rr,
          0, rnd() * Math.PI * 2, 0));
    }
  }

  /* --- распиленные брёвна у края: их унесли в амбар --- */
  {
    const p = spot(rnd() * Math.PI * 2, inner - 2.4);
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        B.add(cyl(0.17, 0.17, 1.5, 9), 'timber',
          mat(p.x - x + (i - 1) * 0.38, 0.18 + row * 0.35, p.z - z, 0, 0.4, Math.PI / 2));
      }
    }
  }

  const group = B.build(M, null, { name: 'felledClearing' });
  const out = { group, colliders: [], circles: [] };

  /**
   * Поставить вырубку на место.
   *
   * @param {number} px мировая X
   * @param {number} pz мировая Z
   * @returns {object} сама вырубка
   */
  out.place = (px, pz) => {
    group.position.set(px, 0, pz);
    // пни и брёвна — небольшие препятствия, об них можно споткнуться
    for (let i = 0; i < stumpN; i++) {
      const ang = (i / stumpN) * Math.PI * 2;
      const r = inner + (outer - inner) * 0.5;
      const w = { x: px + Math.cos(ang) * r, z: pz + Math.sin(ang) * r };
      out.circles.push({ x: w.x, z: w.z, r: 0.42 });
    }
    return out;
  };

  return out;
}
