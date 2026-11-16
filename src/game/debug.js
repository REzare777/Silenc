/**
 * ============================================================================
 *  Отладочная визуализация границ столкновений
 * ============================================================================
 *
 *  Клавиша `C` показывает и скрывает «карту невидимых стен»:
 *   * синие проволочные прямоугольники — боковые коллайдеры;
 *   * оранжевые цилиндры — круглые коллайдеры (столбы, деревья, животные);
 *   * зелёные плиты — поверхности, на которые можно встать (крыльца, настилы).
 *
 *  Нужен, когда хочется проверить, что мир проходим, а «невидимых стенок»
 *  действительно нет.
 *
 *  @module game/debug
 */

import * as THREE from 'three';

/**
 * Создаёт переключатель отладки столкновений.
 *
 * @param {object} ctx контекст игры
 * @returns {{toggle: Function}} отладочный переключатель
 */
export function createColliderDebug(ctx) {

  /** @type {THREE.Group|null} */
  let debugGroup = null;

  /**
   * Показать или скрыть границы столкновений.
   */
  function toggle() {
    if (debugGroup) {
      ctx.scene.remove(debugGroup);
      debugGroup.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      debugGroup = null;
      ctx.ui.toast('Границы столкновений скрыты.');
      return;
    }
    debugGroup = new THREE.Group();
    debugGroup.name = 'colliderDebug';

    const boxMat = new THREE.MeshBasicMaterial({ color: 0x4fd6ff, wireframe: true, transparent: true, opacity: 0.55 });
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const b of ctx.colliders.boxes) {
      const m = new THREE.Mesh(boxGeo, boxMat);
      m.scale.set(b.hx * 2, 0.6, b.hz * 2);
      m.position.set(b.cx, 0.3, b.cz);
      m.rotation.y = b.ang || 0;
      debugGroup.add(m);
    }

    const circMat = new THREE.MeshBasicMaterial({ color: 0xffb347, wireframe: true, transparent: true, opacity: 0.5 });
    const circGeo = new THREE.CylinderGeometry(1, 1, 0.5, 14, 1, true);
    for (const c of ctx.colliders.circles) {
      const m = new THREE.Mesh(circGeo, circMat);
      m.scale.set(c.r, 1, c.r);
      m.position.set(c.x, 0.25, c.z);
      debugGroup.add(m);
    }

    const platMat = new THREE.MeshBasicMaterial({ color: 0x8dff8a, transparent: true, opacity: 0.18 });
    const platGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const p of ctx.platforms) {
      const m = new THREE.Mesh(platGeo, platMat);
      m.scale.set(p.hx * 2, 0.02, p.hz * 2);
      m.position.set(p.cx, p.y, p.cz);
      m.rotation.y = p.ang || 0;
      debugGroup.add(m);
    }

    ctx.scene.add(debugGroup);
    ctx.ui.toast('Границы столкновений показаны (C — скрыть).');
  }

  return { toggle };
}
