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
  barn: { x: -40, z: -8 },                // амбар
  mill: { x: 34, z: -33, ry: 0.6 },       // мельница
  church: { x: 3, z: 44 },                // церковь
  blacksmith: { x: 14.5, z: -8 },         // кузня
  well: { x: 0, z: 0 },                   // колодец на площади
  campfire: { x: -9, z: 8.5 },            // костёр
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
 * Дверь таверны на фасаде (левее центра) и поворот её фасада.
 *
 * @returns {{pos: import('three').Vector3, ry: number}} точка и поворот
 */
export function tavernDoor() {
  const { x, z } = LAYOUT.tavern;
  const ry = ryToFace([x, z], [0, 0]);
  // локальные координаты фасада таверны: x = -w*0.3, z = -d/2 - 0.5
  // (w = 13, d = 12 — как в buildings.js, функция tavern)
  return { pos: facadePos(x, z, ry, -13 * 0.3, -12 / 2 - 0.5, 1.4), ry };
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
