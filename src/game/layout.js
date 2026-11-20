import * as THREE from 'three';

/**
 * ============================================================================
 *  Планировка деревни: где что стоит
 * ============================================================================
 *
 *  Единый источник правды о размещении зданий. Его читают и `village.js`
 *  (кто ставит здания), и `locations.js` (где стоят двери таверны и амбара,
 *  куда возвращать игрока) — благодаря этому обе стороны не могут
 *  разойтись в координатах.
 *
 *  Здесь же живут две чисто математические функции: поворот фасада
 *  и перевод локальной точки фасада в мировые координаты.
 *
 *  @module game/layout
 */

/**
 * Мировые координаты ключевых зданий.
 *
 * @type {Record<string, {x: number, z: number, ry?: number}>}
 */
export const LAYOUT = {
  tavern: { x: -17, z: -13 },             // «Уставший вепрь»
  barn: { x: -44, z: 13 },                // амбар — у опушки, рядом с пастбищем
  mill: { x: 34, z: -33, ry: 0.6 },       // мельница
  church: { x: 3, z: 44 },                // церковь
  blacksmith: { x: 14.5, z: -8 },         // кузня
  well: { x: 0, z: 0 },                   // колодец на площади
  campfire: { x: 44, z: -32 },             // костёр «за город» — поляна у пруда
  // вход в подземелье — примерно в ста метрах от деревни, на северо-западе
  dungeon: { x: -72, z: -66 },
};

/**
 * Поворот здания фасадом к точке.
 *
 * @param {number[]} from откуда смотрим
 * @param {number[]} to куда смотрим
 * @returns {number} угол в радианах
 */
export function ryToFace(from, to) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const l = Math.hypot(dx, dz) || 1;
  return Math.atan2(-dx / l, -dz / l);
}

/**
 * Точка на фасаде здания в мировых координатах.
 *
 * @param {number} px мировая X центра здания
 * @param {number} pz мировая Z центра здания
 * @param {number} ry поворот здания
 * @param {number} lx локальная X на фасаде
 * @param {number} lz локальная Z на фасаде
 * @param {number} [y] высота
 * @returns {import('three').Vector3} мировая точка
 */
export function facadePos(px, pz, ry, lx, lz, y = 1.35) {
  return new THREE.Vector3(
    px + lx * Math.cos(ry) + lz * Math.sin(ry),
    y,
    pz - lx * Math.sin(ry) + lz * Math.cos(ry),
  );
}

/**
 * Дверь таверны на фасаде (по центру) и поворот её фасада.
 *
 * @returns {{pos: import('three').Vector3, ry: number}} точка и поворот
 */
export function tavernDoor() {
  const { x, z } = LAYOUT.tavern;
  const ry = ryToFace([x, z], [0, 0]);
  // локальные координаты фасада таверны: x = 0, z = -d/2 - 0.5
  // (w = 15, d = 18 — как в buildings.js, функция tavern)
  return { pos: facadePos(x, z, ry, 0, -18 / 2 - 0.5, 1.4), ry };
}

/**
 * Точка входа в подземелье: тёмный проём в скале.
 *
 * Локальные оси скалы: `+Z` — вглубь скалы, `−Z` — наружу, к деревне.
 * `foot` — подножие каменной лестницы, где стоит игрок перед входом.
 *
 * @returns {{x: number, z: number, ry: number, foot: {x: number, z: number}}} точка, поворот и подножие
 */
export function dungeonGate() {
  const { x, z } = LAYOUT.dungeon;
  // скала стоит фасадом к деревне — так вход видно с дороги
  const ry = ryToFace([x, z], [0, 0]);
  const foot = facadePos(x, z, ry, 0, -5.6, 0);
  return { x, z, ry, foot: { x: foot.x, z: foot.z } };
}

/**
 * Дорога от деревни к скале. Идёт по северо-западной стороне села,
 * обходя трактир и амбар, — а не напролом через строения.
 */
export const DUNGEON_TRAIL = [
  [-2.5, -14], [-5, -21], [-12, -28], [-20, -33], [-28, -38],
  [-36, -41], [-44, -46], [-51, -52], [-56, -58], [-62, -60], [-67, -63],
];

/**
 * Полная дорога к скале — от площади до подножия лестницы.
 *
 * @returns {number[][]} точки дороги в мировых координатах
 */
export function dungeonTrail() {
  const gate = dungeonGate();
  return [...DUNGEON_TRAIL, [gate.foot.x, gate.foot.z]];
}

/**
 * Расстояние от точки до дороги к скале.
 *
 * @param {number} x мировая X
 * @param {number} z мировая Z
 * @returns {number} расстояние в метрах
 */
export function distToDungeonTrail(x, z) {
  const pts = dungeonTrail();
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

/**
 * Точка выхода из амбара наружу (перед воротами).
 *
 * @returns {{x: number, z: number, ry: number}} точка и поворот
 */
export function barnExitPoint() {
  const { x, z } = LAYOUT.barn;
  return { x, z, ry: ryToFace([x, z], [-10, -4]) };
}
