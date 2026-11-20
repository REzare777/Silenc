/**
 * ============================================================================
 *  Лесная делянка на опушке: избушка лесоруба, поленница, чурбан с топором
 * ============================================================================
 *
 *  На этом месте раньше стоял амбар — большой красный сарай посреди леса.
 *  Он и читался «не в тему»: ни поля рядом, ни дороги, только тёмный
 *  лесной пол под ногами. Теперь здесь маленькая лесная работа:
 *  сруб в пять венцов, поленница у стены, чурбан с воткнутым топором
 *  и лавка, на которой лесоруб отдыхает.
 *
 *  @module world/woodcutters
 */

import { Builder, box, cyl, sphere, torus, mat } from './geo.js';
import { woodcuttersHut } from './buildings.js';

/**
 * Собрать лесную делянку.
 *
 * Все пропсы строятся в локальных координатах: избушка — в начале,
 * поленница и чурбан — справа и слева от её крыльца.
 *
 * @param {object} M набор материалов
 * @param {object} [opts] положение делянки
 * @param {number} [opts.x] мировая X
 * @param {number} [opts.z] мировая Z
 * @param {number} [opts.ry] поворот (лицом к деревне)
 * @returns {object} делянка с методом place
 */
export function woodcuttersYard(M, opts = {}) {
  const { x = 0, z = 0, ry = 0 } = opts;
  const hut = woodcuttersHut(M, { w: 5, d: 4.2, h: 2.5 });
  const B = new Builder();

  /* --- поленница: три ряда брёвен у правой стены --- */
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4 - (row > 1 ? 1 : 0); i++) {
      const lx = 2.35 - i * 0.52;
      const lz = -1.5 + row * 0.28;
      B.add(cyl(0.145, 0.145, 1.35, 7), 'timber',
        mat(lx, 0.17 + row * 0.29, lz, 0, 0, Math.PI / 2));
    }
  }
  // два оставшихся бревна лежат рядом
  for (let i = 0; i < 2; i++) {
    B.add(cyl(0.145, 0.145, 1.35, 7), 'timber',
      mat(2.6, 0.17, -2.35 - i * 0.32, 0, 0, Math.PI / 2));
  }
  // колодка, на которой колют дрова
  B.add(cyl(0.42, 0.44, 0.62, 12), 'timber', mat(-2.5, 0.31, -1.35));
  B.add(cyl(0.40, 0.40, 0.04, 12), 'oakDoor', mat(-2.5, 0.63, -1.35));
  // топор, воткнутый в колодку
  B.add(cyl(0.035, 0.04, 0.85, 6), 'timber', mat(-2.5, 0.95, -1.35, 0.22, 0, 0.16));
  B.add(box(0.07, 0.19, 0.26, 1), 'iron', mat(-2.42, 1.33, -1.42, 0.22, 0, 0.16));
  // чурбан у стены и щепки на земле
  B.add(cyl(0.34, 0.36, 0.5, 11), 'timber', mat(-1.1, 0.25, -2.6));
  B.add(cyl(0.32, 0.34, 0.44, 11), 'timber', mat(-0.35, 0.22, -2.85, 0, 0, 0.4));
  for (const [sx, sz, ry2] of [[-0.8, -3.3, 0.6], [-0.2, -3.5, 1.4], [0.35, -3.1, 2.2]]) {
    B.add(box(0.16, 0.05, 0.26, 1), 'timber', mat(sx, 0.03, sz, ry2));
  }
  // лавка у стены: чурбан на кольях
  B.add(cyl(0.22, 0.24, 2.1, 9), 'timber', mat(3.3, 0.48, 0.5, 0, 0, Math.PI / 2));
  B.add(cyl(0.1, 0.1, 0.48, 7), 'timber', mat(2.45, 0.24, 0.5));
  B.add(cyl(0.1, 0.1, 0.48, 7), 'timber', mat(4.15, 0.24, 0.5));
  // ведро у порога
  B.add(cyl(0.2, 0.16, 0.3, 9), 'plank', mat(0.95, 0.15, -2.25));
  B.add(torus(0.2, 0.02, 5, 10), 'iron', mat(0.95, 0.3, -2.25, 0, 0, Math.PI / 2));

  const group = B.build(M, null, { name: 'woodcuttersYard' });
  // избушка — часть группы делянки, поэтому поворачивается вместе с ней
  hut.place(0, 0, 0);
  group.add(hut.group);
  const out = { group, hut, colliders: [], circles: [] };

  /**
   * Поставить делянку на место.
   *
   * @param {number} px мировая X
   * @param {number} pz мировая Z
   * @param {number} [pry] поворот
   * @returns {object} сама делянка
   */
  out.place = (px, pz, pry = 0) => {
    group.position.set(px, 0, pz);
    group.rotation.y = pry;
    // стены избушки
    out.colliders.push({ cx: px, cz: pz, hx: 2.5, hz: 2.1, ang: pry });
    // поленница, чурбан и колодка — цилиндрические препятствия
    const c = Math.cos(pry), s = Math.sin(pry);
    const toWorld = (lx, lz) => ({ x: px + lx * c + lz * s, z: pz - lx * s + lz * c });
    for (const [lx, lz, r] of [[2.2, -1.5, 0.9], [-2.5, -1.35, 0.5], [-1.1, -2.6, 0.4], [3.3, 0.5, 0.4]]) {
      const w = toWorld(lx, lz);
      out.circles.push({ x: w.x, z: w.z, r });
    }
    return out;
  };

  return out;
}
