/**
 * ============================================================================
 *  Бранд: горящий факел в руке — и оружие, и источник света
 * ============================================================================
 *
 *  В подземелье игрок ходит с факелом: он освещает путь и одновременно
 *  служит оружием. Модель процедурная: древко, обмотка, угли и пламя.
 *  Пламя — два конуса из материала `ember`, которые подрагивают.
 *
 *  @module world/torch
 */

import * as THREE from 'three';
import { Builder, cyl, cone, sphere, mat } from './geo.js';

/**
 * Собрать бранд.
 *
 * @param {object} M набор материалов
 * @returns {object} { group, flame, setLit, update }
 */
export function brandModel(M, glowTex = null) {
  const B = new Builder();

  // древко: чуть неровное, чтобы не выглядело палкой из каталога
  B.add(cyl(0.020, 0.026, 0.60, 7), 'timber', mat(0, 0.30, 0, 0, 0, 0.06));
  // обмотка в верхней части. Раньше здесь была светлая ткань: при ярком
  // свете оверлея она выбеливалась и читалась как белый кубик.
  // Теперь — тёмное железное кольцо: и контрастно, и не выбеливается.
  for (let i = 0; i < 4; i++) {
    B.add(cyl(0.034, 0.034, 0.03, 7), 'iron',
      mat(0, 0.545 + i * 0.03, 0, 0, 0, 0.06));
  }
  // обугленный конец древка — тёмный, а не светящийся блок
  B.add(cyl(0.028, 0.024, 0.05, 7), 'timber', mat(0, 0.632, 0, 0, 0, 0.06));
  // угли: маленькие раскалённые комочки, а не сплошной «кубик»
  for (const [dx, dy, dz] of [[0, 0.658, 0], [0.020, 0.650, 0.012], [-0.017, 0.652, -0.013]]) {
    B.add(sphere(0.015, 6, 5), 'ember', mat(dx, dy, dz));
  }

  const group = B.build(M, null, { name: 'brand' });

  // пламя: два конуса, большой и поменьше, — «живой» огонь.
  // Внешний — тёплый оранжевый (полупрозрачный, аддитивный), внутренний —
  // маленькое ядро цвета пламени. Если ядро сделать слишком ярким, bloom
  // съедает форму и пламя читается как белый кубик.
  const flame = new THREE.Group();
  flame.name = 'brandFlame';
  // Пламя сделано из НЕосвещаемых материалов: оверлей сцены рук
  // наполнен ярким светом, и обычный материал выбеливался в белый конус.
  const f1 = new THREE.Mesh(cone(0.048, 0.19, 7), new THREE.MeshBasicMaterial({
    color: 0xff6a12, transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  f1.position.y = 0.72;
  const f2 = new THREE.Mesh(cone(0.022, 0.10, 6), new THREE.MeshBasicMaterial({
    color: 0xffb347, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  f2.position.y = 0.71;
  flame.add(f1, f2);
  // мягкое свечение вокруг пламени — тот же приём, что у фонарей
  if (glowTex) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa845, transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(0.44);
    glow.position.y = 0.70;
    flame.add(glow);
  }
  group.add(flame);

  let lit = true;

  /**
   * Зажечь или погасить пламя.
   *
   * @param {boolean} v горит ли
   */
  const setLit = (v) => {
    lit = !!v;
    flame.visible = lit;
  };

  /**
   * Анимация пламени.
   *
   * @param {number} t время
   */
  const update = (t) => {
    if (!lit) return;
    const s = 1 + Math.sin(t * 11.3) * 0.09 + Math.sin(t * 6.7) * 0.05;
    flame.scale.set(0.92 + Math.sin(t * 8.1) * 0.07, s, 0.92 + Math.cos(t * 9.4) * 0.07);
    flame.rotation.z = Math.sin(t * 5.2) * 0.06;
    flame.rotation.x = Math.cos(t * 4.4) * 0.05;
  };

  setLit(true);

  return { group, flame, setLit, update };
}
