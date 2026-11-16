/**
 * Навигация по карте: равномерная сетка с A* — чтобы пёс (и другие «ходячие»)
 * обходили дома и заборы по настоящему маршруту, а не упирались в стены.
 */

const SQRT2 = Math.SQRT2;

export class NavGrid {
  /**
   * @param {object} opts
   * @param {number} opts.minX  левая граница мира
   * @param {number} opts.minZ  верхняя граница мира
   * @param {number} opts.size  сторона мира в метрах
   * @param {number} opts.cell  размер клетки, м
   * @param {number} opts.radius  запас вокруг препятствия (радиус «тела»)
   */
  constructor({ minX = -80, minZ = -80, size = 170, cell = 1.0, radius = 0.45 } = {}) {
    this.minX = minX; this.minZ = minZ; this.cell = cell; this.radius = radius;
    this.n = Math.ceil(size / cell);
    this.blocks = new Uint8Array(this.n * this.n);
  }

  idx(cx, cz) { return cz * this.n + cx; }
  toCell(x, z) {
    return [
      Math.max(0, Math.min(this.n - 1, Math.floor((x - this.minX) / this.cell))),
      Math.max(0, Math.min(this.n - 1, Math.floor((z - this.minZ) / this.cell))),
    ];
  }
  toWorld(cx, cz) {
    return [this.minX + (cx + 0.5) * this.cell, this.minZ + (cz + 0.5) * this.cell];
  }

  /** Прямоугольник-препятствие (повёрнутый) в мировых координатах. */
  addBox(cx, cz, hx, hz, ang = 0) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const reach = Math.hypot(hx, hz) + this.radius + this.cell;
    const [x0, z0] = this.toCell(cx - reach, cz - reach);
    const [x1, z1] = this.toCell(cx + reach, cz + reach);
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const [wx, wz] = this.toWorld(gx, gz);
        const dx = wx - cx, dz = wz - cz;
        const lx = c * dx - s * dz, lz = s * dx + c * dz;
        const qx = Math.max(-hx, Math.min(lx, hx));
        const qz = Math.max(-hz, Math.min(lz, hz));
        if (Math.hypot(lx - qx, lz - qz) < this.radius) this.blocks[this.idx(gx, gz)] = 1;
      }
    }
  }

  /** Круглое препятствие. */
  addCircle(x, z, r) {
    const rr = r + this.radius;
    const [x0, z0] = this.toCell(x - rr - this.cell, z - rr - this.cell);
    const [x1, z1] = this.toCell(x + rr + this.cell, z + rr + this.cell);
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const [wx, wz] = this.toWorld(gx, gz);
        if (Math.hypot(wx - x, wz - z) < rr) this.blocks[this.idx(gx, gz)] = 1;
      }
    }
  }

  /** Свободна ли клетка (по мировым координатам). */
  free(x, z) {
    const [cx, cz] = this.toCell(x, z);
    return !this.blocks[this.idx(cx, cz)];
  }

  /** Ближайшая свободная клетка к точке (если сама занята — ищем по спирали). */
  nearestFree(x, z) {
    if (this.free(x, z)) return [x, z];
    const [cx, cz] = this.toCell(x, z);
    for (let r = 1; r <= 12; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const gx = cx + dx, gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= this.n || gz >= this.n) continue;
          if (!this.blocks[this.idx(gx, gz)]) {
            const [wx, wz] = this.toWorld(gx, gz);
            return [wx, wz];
          }
        }
      }
    }
    return null;
  }

  /**
   * A*: путь от (sx,sz) к (tx,tz). Возвращает массив точек {x,z}
   * (от начала к цели) либо null, если пути нет.
   */
  findPath(sx, sz, tx, tz) {
    const s = this.nearestFree(sx, sz);
    const t = this.nearestFree(tx, tz);
    if (!s || !t) return null;
    const [scx, scz] = this.toCell(s[0], s[1]);
    const [tcx, tcz] = this.toCell(t[0], t[1]);
    const start = this.idx(scx, scz), goal = this.idx(tcx, tcz);
    if (start === goal) return [{ x: tx, z: tz }];

    const n = this.n;
    const gScore = new Float32Array(n * n).fill(Infinity);
    const came = new Int32Array(n * n).fill(-1);
    const closed = new Uint8Array(n * n);
    gScore[start] = 0;

    // простая бинарная куча
    const heap = [];
    const push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        const tmp = heap[p]; heap[p] = heap[k]; heap[k] = tmp; k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          const tmp = heap[m]; heap[m] = heap[k]; heap[k] = tmp; k = m;
        }
      }
      return top;
    };
    const h = (i) => {
      const cx = i % n, cz = (i / n) | 0;
      const dx = Math.abs(cx - tcx), dz = Math.abs(cz - tcz);
      return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
    };

    push(start, h(start));
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < 60000) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) { found = true; break; }
      const cx = cur % n, cz = (cur / n) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
          const ni = this.idx(nx, nz);
          if (this.blocks[ni] || closed[ni]) continue;
          // диагональ — только если оба ортогональных соседа свободны
          if (dx && dz) {
            if (this.blocks[this.idx(cx + dx, cz)] || this.blocks[this.idx(cx, cz + dz)]) continue;
          }
          const step = (dx && dz) ? SQRT2 : 1;
          const ng = gScore[cur] + step;
          if (ng < gScore[ni]) {
            gScore[ni] = ng;
            came[ni] = cur;
            push(ni, ng + h(ni));
          }
        }
      }
    }
    if (!found) return null;

    const cells = [];
    let cur = goal;
    while (cur !== -1) { cells.push(cur); cur = came[cur]; }
    cells.reverse();
    const pts = cells.map((i) => {
      const cx = i % n, cz = (i / n) | 0;
      const [wx, wz] = this.toWorld(cx, cz);
      return { x: wx, z: wz };
    });
    // сглаживание: убираем точки, если прямая между соседями свободна
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineFree(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    out.push(pts[pts.length - 1]);
    out.push({ x: tx, z: tz });
    return out;
  }

  /** Прямая между двумя точками свободна? */
  lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(2, Math.ceil(d / (this.cell * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
}
