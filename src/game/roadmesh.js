/**
 * ============================================================================
 *  Полотна дорог: мягкие ленты вместо прямоугольных кусков
 * ============================================================================
 *
 *  Раньше каждая тропинка рисовалась набором плоских прямоугольников — по
 *  одному на каждый отрезок ломаной. На поворотах и стыках видны были
 *  «квадраты»: углы, щели и наложения. Дорога читалась как набор заплаток,
 *  а не как дорога.
 *
 *  Теперь дорога строится как одна лента:
 *
 *   * повороты скругляются (Chaikin) — линия идёт плавно, без углов;
 *   * на стыках используются усреднённые нормали (митры) — лента не
 *     «рвётся» и не имеет щелей;
 *   * края ленты растушёваны по прозрачности — грунт плавно переходит в
 *     траву, без резкой кромки;
 *   * концы дорог тоже затухают — обрыв в воздухе не бросается в глаза.
 *
 *  @module game/roadmesh
 */

import * as THREE from 'three';

/**
 * Скруглить повороты ломаной (алгоритм Шайкина).
 *
 * @param {[number, number][]} pts ломаная
 * @param {number} [rounds] сколько раз срезать углы
 * @returns {[number, number][]} сглаженная ломаная
 */
export function smoothPolyline(pts, rounds = 3) {
  let cur = pts.map((p) => [p[0], p[1]]);
  for (let r = 0; r < rounds; r++) {
    if (cur.length < 3) break;
    const out = [cur[0]];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i], b = cur[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(cur[cur.length - 1]);
    cur = out;
  }
  return cur;
}

/**
 * Плотная передискретизация ломаной.
 *
 * @param {[number, number][]} pts ломаная
 * @param {number} step максимальный шаг между точками, м
 * @returns {[number, number][]} точки с равномерным шагом
 */
export function resample(pts, step = 1.2) {
  if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    let d = carry;
    while (d < len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = d - len;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > 1e-4) out.push([last[0], last[1]]);
  return out;
}

/**
 * Построить ленту дороги вдоль ломаной.
 *
 * @param {[number, number][]} points осевая линия
 * @param {number} width ширина полотна, м
 * @param {object} [opts] параметры
 * @param {number} [opts.y] высота над землёй
 * @param {number} [opts.feather] ширина растушёвки по краю (0..1)
 * @param {number} [opts.uScale] повтор текстуры поперёк, на метр
 * @param {number} [opts.vScale] повтор текстуры вдоль, на метр
 * @param {number} [opts.taper] длина затухания на концах, м
 * @returns {THREE.BufferGeometry} готовая геометрия
 */
export function ribbonGeometry(points, width, opts = {}) {
  const {
    y = 0.05, feather = 0.26, uScale = 0.34, vScale = 0.16, taper = 2.4,
  } = opts;
  const n = points.length;
  const half = width / 2;

  // касательные по каждой точке
  const tan = [];
  for (let i = 0; i < n; i++) {
    const p = points[Math.max(0, i - 1)];
    const q = points[Math.min(n - 1, i)];
    let tx = q[0] - p[0], tz = q[1] - p[1];
    const l = Math.hypot(tx, tz) || 1;
    tan.push([tx / l, tz / l]);
  }

  // митры: усреднённая нормаль соседних отрезков, с поправкой на угол
  const miter = [];
  for (let i = 0; i < n; i++) {
    const t0 = tan[Math.max(0, i - 1)];
    const t1 = tan[i];
    const n0 = [-t0[1], t0[0]];
    const n1 = [-t1[1], t1[0]];
    let mx = n0[0] + n1[0], mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-6) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
    const d = mx * n1[0] + mz * n1[1];
    const k = Math.min(2.4, 1 / Math.max(0.42, d));
    miter.push([mx * k, mz * k]);
  }

  // поперечные полосы: край — прозрачный, середина — плотная
  const lanes = [1, 1 - feather, 0, -(1 - feather), -1];
  const laneAlpha = [0, 0.92, 1, 0.92, 0];
  const cols = lanes.length;

  // длина вдоль — для UV и затухания на концах
  const dist = [0];
  for (let i = 1; i < n; i++) {
    dist.push(dist[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  const total = dist[n - 1] || 1;

  const pos = new Float32Array(n * cols * 3);
  const uv = new Float32Array(n * cols * 2);
  const col = new Float32Array(n * cols * 4);
  const idx = [];

  for (let i = 0; i < n; i++) {
    const [mx, mz] = miter[i];
    const px = points[i][0], pz = points[i][1];
    // затухание на концах: края дороги мягко уходят в траву
    let endFade = 1;
    if (taper > 0) {
      const dEnd = Math.min(dist[i], total - dist[i]);
      endFade = Math.min(1, Math.max(0, dEnd / taper));
      endFade = endFade * endFade * (3 - 2 * endFade);   // плавный S-образный переход
    }
    for (let j = 0; j < cols; j++) {
      const off = lanes[j] * half;
      const k = (i * cols + j) * 3;
      pos[k] = px + mx * off;
      pos[k + 1] = y;
      pos[k + 2] = pz + mz * off;
      const u = (i * cols + j) * 2;
      uv[u] = off * uScale;
      uv[u + 1] = dist[i] * vScale;
      const c = (i * cols + j) * 4;
      col[c] = 1; col[c + 1] = 1; col[c + 2] = 1;
      col[c + 3] = laneAlpha[j] * endFade;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Мягкая круглая площадь: та же лента-диск с растушёванным краем.
 *
 * @param {number} r радиус
 * @param {object} [opts] параметры
 * @param {number} [opts.y] высота над землёй
 * @param {number} [opts.feather] доля радиуса, уходящая в прозрачность
 * @param {number} [opts.scale] повтор текстуры, на метр
 * @returns {THREE.BufferGeometry} готовая геометрия
 */
export function discGeometry(r, opts = {}) {
  const { y = 0.09, feather = 0.3, scale = 0.22 } = opts;
  const rings = [0, r * 0.4, r * 0.68, r * (1 - feather * 0.55), r];
  const alphas = [1, 1, 0.96, 0.7, 0];
  const seg = 48;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];

  for (let ri = 0; ri < rings.length; ri++) {
    const rr = rings[ri];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, y, z);
      uv.push(x * scale, z * scale);
      col.push(1, 1, 1, alphas[ri]);
    }
  }
  const row = seg + 1;
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let i = 0; i < seg; i++) {
      const a = ri * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      // намотка именно такая: иначе нормали диска смотрят вниз,
      // площадь не освещается и выглядит чёрной
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
