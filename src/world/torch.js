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
import { Builder, cyl, cone, mat } from './geo.js';

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
  // обмотка в верхней части
  for (let i = 0; i < 4; i++) {
    B.add(cyl(0.034, 0.034, 0.03, 7), 'cloth',
      mat(0, 0.545 + i * 0.03, 0, 0, 0, 0.06));
  }
  // угли на конце
  B.add(cyl(0.038, 0.028, 0.045, 7), 'ember', mat(0, 0.63, 0, 0, 0, 0.06));

  const group = B.build(M, null, { name: 'brand' });

  // пламя: два конуса, большой и поменьше, — «живой» огонь
  const flame = new THREE.Group();
  flame.name = 'brandFlame';
  const f1 = new THREE.Mesh(cone(0.032, 0.13, 6), new THREE.MeshStandardMaterial({
    color: 0xff8a2c, emissive: 0xff6a12, emissiveIntensity: 2.4, roughness: 0.7,
    transparent: true, opacity: 0.85, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  f1.position.y = 0.70;
  const f2 = new THREE.Mesh(cone(0.03, 0.12, 5), new THREE.MeshStandardMaterial({
    color: 0xfff0c8, emissive: 0xffd070, emissiveIntensity: 3.6, roughness: 0.6,
    transparent: true, opacity: 0.9,
  }));
  f2.position.y = 0.73;
  flame.add(f1, f2);
  // мягкое свечение вокруг пламени — тот же приём, что у фонарей
  if (glowTex) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffa845, transparent: true, opacity: 0.7,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.setScalar(0.52);
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
