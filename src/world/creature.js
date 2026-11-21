/**
 * ============================================================================
 *  Тень: то, что тянется из темноты
 * ============================================================================
 *
 *  Существо подземелья. Модель намеренно простая: тёмный «капюшон» без
 *  лица и два горящих глаза. Никаких источников света — только эмиссия,
 *  чтобы не тратить бюджет рендера пещеры (там уже 26 ламп).
 *
 *  @module world/creature
 */

import * as THREE from 'three';
import { Builder, cone, sphere, mat } from './geo.js';

/**
 * Собрать тень.
 *
 * @param {object} M набор материалов
 * @returns {object} { group, update }
 */
export function shadowModel(M) {
  const B = new Builder();

  // «капюшон»: конус, расширяющийся книзу — силуэт, у которого нет ни лица,
  // ни рук: читается как кусок тьмы, а не как зверь
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x14101c, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.94,
  });
  const body = new THREE.Mesh(cone(0.42, 1.5, 7), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  const group = new THREE.Group();
  group.name = 'shadowBody';
  group.add(body);

  // плечи: чуть шире, чтобы силуэт не был «конусом на ножке»
  const shoulders = new THREE.Mesh(cone(0.5, 0.36, 7), bodyMat);
  shoulders.position.y = 0.34;
  group.add(shoulders);

  // глаза: две горящие точки
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xcfe4ff, toneMapped: false });
  const eyeL = new THREE.Mesh(sphere(0.045, 6, 5), eyeMat);
  eyeL.position.set(-0.1, 1.16, 0.24);
  const eyeR = new THREE.Mesh(sphere(0.045, 6, 5), eyeMat);
  eyeR.position.set(0.1, 1.16, 0.24);
  group.add(eyeL, eyeR);

  // ореол вокруг глаз — мягкое свечение без источника света
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({
      color: 0x7ea6ff, transparent: true, opacity: 0.22,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.set(0, 1.16, 0.26);
  group.add(halo);

  let t0 = 0;

  /**
   * Анимация: покачивание и пульс глаз.
   *
   * @param {number} t время
   * @param {number} [dt] кадр
   */
  const update = (t, dt = 0.016) => {
    t0 += dt;
    body.position.y = 0.75 + Math.sin(t0 * 1.6) * 0.035;
    body.rotation.y = Math.sin(t0 * 0.7) * 0.12;
    shoulders.rotation.y = body.rotation.y;
    const pulse = 0.85 + Math.sin(t0 * 4.2) * 0.15;
    eyeMat.color.setRGB(0.81 * pulse, 0.89 * pulse, 1.0);
    halo.scale.setScalar(0.9 + pulse * 0.2);
  };

  return { group, update, body, eyes: [eyeL, eyeR] };
}
