/**
 * ============================================================================
 *  Зверинец подземелья: десять моделей врагов
 * ============================================================================
 *
 *  Каждый монстр собран из примитивов — ни одной внешней модели, поэтому
 *  никаких вопросов о лицензиях. Но «простота» здесь не значит «серый
 *  конус»: у каждого зверя свой силуэт, своя походка и своя анимация боя.
 *
 *  Что важно для игрока
 *  --------------------
 *  1. **Читаемость.** По силуэту видно, кто идёт: гоблин — меч в правой
 *     руке, гоблин-лучник — лук, элитный — щит, паук — много ног, слизень —
 *     ком, змея — ни одной ноги, голем — камень, орк — вдвое выше игрока.
 *  2. **Телеграф.** Атака всегда видна: замах → удар → отходка. Никто не
 *     бьёт «из ниоткуда».
 *  3. **Возраст.** Призраки — высокие (2,7 м) и широкие: тень, которая
 *     нависает, должна нависать.
 *
 *  Контракт с системой боя (`src/game/monsters.js`):
 *    • модель возвращает `{ group, update(t, dt, m) }`;
 *    • `m.state` — 'idle' | 'walk' | 'windup' | 'attack' | 'hurt' | 'dead';
 *    • `m.phase` — фаза шага (накапливается по пройденному пути);
 *    • `m.stateT` — время в текущем состоянии (секунды);
 *    • `m.hitFlash` — 0…1, вспышка при попадании.
 *
 *  @module world/monsters
 */

import * as THREE from 'three';
import { box, cyl, sphere, cone, torus } from './geo.js';

/* ------------------------------------------------------------------
 *  Мелкие помощники
 * ------------------------------------------------------------------ */

/**
 * Стандартный материал.
 *
 * @param {number} color цвет
 * @param {object} [opts] дополнительные параметры
 * @returns {THREE.MeshStandardMaterial} материал
 */
function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0, ...opts,
  });
}

/**
 * Светящийся материал (без источника света — только эмиссия).
 *
 * @param {number} color цвет
 * @param {number} [opacity] прозрачность
 * @returns {THREE.MeshBasicMaterial} материал
 */
function glow(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, toneMapped: false,
    transparent: opacity < 1, opacity,
  });
}

/**
 * Пустая группа-«сустав»: к ней крепится часть тела, чтобы её можно было
 * вращать при анимации.
 *
 * @param {THREE.Object3D} parent родитель
 * @param {number} x смещение
 * @param {number} y смещение
 * @param {number} z смещение
 * @returns {THREE.Group} сустав
 */
function joint(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Меш в группе.
 *
 * @param {THREE.Object3D} parent родитель
 * @param {THREE.BufferGeometry} geo геометрия
 * @param {THREE.Material} mat материал
 * @param {number[]} [pos] позиция
 * @param {number[]} [rot] поворот
 * @returns {THREE.Mesh} меш
 */
function mesh(parent, geo, mat, pos, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Плавное значение с шагом к цели.
 *
 * @param {number} cur текущее
 * @param {number} target цель
 * @param {number} k коэффициент (0…1 за кадр)
 * @returns {number} новое значение
 */
function approach(cur, target, k) {
  return cur + (target - cur) * k;
}

/**
 * Вспышка при попадании: подсветить все материалы существа.
 *
 * @param {THREE.Object3D} root корень модели
 * @param {number} flash 0…1
 */
function flashMaterials(root, flash) {
  root.traverse((o) => {
    const m = o.material;
    if (!m || !m.isMeshStandardMaterial) return;
    if (!m.userData.baseEmissive) {
      m.userData.baseEmissive = m.emissive ? m.emissive.getHex() : 0;
    }
    if (!m.emissive) return;
    if (flash <= 0.001) {
      m.emissive.setHex(m.userData.baseEmissive);
    } else {
      const b = m.userData.baseEmissive;
      m.emissive.setRGB(
        (b >> 16 & 255) / 255 + flash * 0.6,
        (b >> 8 & 255) / 255 + flash * 0.12,
        (b & 255) / 255 + flash * 0.08,
      );
    }
  });
}

/**
 * Общая «тряска» от удара: короткое отклонение корпуса.
 *
 * @param {object} m состояние монстра
 * @returns {number} угол наклона
 */
function shake(m) {
  if (m.hitFlash <= 0) return 0;
  return Math.sin(m.stateT * 47) * 0.16 * m.hitFlash;
}

/* ------------------------------------------------------------------
 *  1–3. Гоблины
 * ------------------------------------------------------------------ */

/**
 * Тело гоблина — общее для трёх видов.
 *
 * @param {object} o параметры
 * @returns {object} модель
 */
function goblinBody(o = {}) {
  const scale = o.scale || 1;
  const skinCol = o.skin ?? 0x63793f;
  const clothCol = o.cloth ?? 0x6a4a2c;
  const g = new THREE.Group();
  g.name = o.name || 'goblin';

  const skinM = std(skinCol);
  const clothM = std(clothCol);
  const darkM = std(0x3b3b42);

  // ноги
  const legL = joint(g, -0.13, 0.6, 0);
  const legR = joint(g, 0.13, 0.6, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, cyl(0.085, 0.065, 0.6, 7), skinM, [0, -0.3, 0]);
    mesh(leg, box(0.2, 0.09, 0.3), darkM, [0, -0.58, 0.05]);
  }

  // корпус
  const body = joint(g, 0, 0.6, 0);
  mesh(body, box(0.46, 0.5, 0.3), skinM, [0, 0.3, 0]);
  mesh(body, box(0.5, 0.28, 0.34), clothM, [0, 0.12, 0]);      // туника
  mesh(body, box(0.48, 0.06, 0.33), darkM, [0, 0.06, 0]);      // ремень
  mesh(body, box(0.12, 0.1, 0.06), std(0x8a6a35), [0, 0.06, 0.17]); // пряжка

  // голова
  const head = joint(body, 0, 0.62, 0);
  mesh(head, sphere(0.19, 10, 8), skinM, [0, 0.1, 0]);
  mesh(head, box(0.2, 0.11, 0.16), skinM, [0, 0.0, 0.11]);     // челюсть
  mesh(head, box(0.22, 0.03, 0.03), std(0xd8d2c0), [0, 0.02, 0.19]); // зубы
  // уши
  mesh(head, cone(0.07, 0.24, 6), skinM, [-0.17, 0.16, -0.02], [0, 0, 1.15]);
  mesh(head, cone(0.07, 0.24, 6), skinM, [0.17, 0.16, -0.02], [0, 0, -1.15]);
  // глаза
  const eyeM = glow(o.eyeColor ?? 0xffd34d);
  mesh(head, sphere(0.035, 6, 5), eyeM, [-0.07, 0.14, 0.15]);
  mesh(head, sphere(0.035, 6, 5), eyeM, [0.07, 0.14, 0.15]);
  // брови
  mesh(head, box(0.1, 0.02, 0.02), darkM, [-0.07, 0.19, 0.16], [0, 0, 0.22]);
  mesh(head, box(0.1, 0.02, 0.02), darkM, [0.07, 0.19, 0.16], [0, 0, -0.22]);

  // руки
  const armL = joint(body, -0.27, 0.46, 0);
  const armR = joint(body, 0.27, 0.46, 0);
  for (const arm of [armL, armR]) {
    mesh(arm, cyl(0.07, 0.055, 0.42, 7), skinM, [0, -0.21, 0]);
    mesh(arm, sphere(0.075, 7, 6), skinM, [0, -0.44, 0]);
  }

  g.scale.setScalar(scale);
  return { group: g, legL, legR, body, head, armL, armR, skinM, clothM, darkM };
}

/**
 * Гоблин с мечом.
 *
 * @returns {object} модель
 */
function goblinSword() {
  const p = goblinBody({ name: 'goblinSword' });
  const steel = std(0xa8b2bd, { roughness: 0.45, metalness: 0.2 });
  const wood = std(0x5d4028);
  const sword = new THREE.Group();
  mesh(sword, box(0.06, 0.78, 0.02), steel, [0, 0.39, 0]);
  mesh(sword, box(0.02, 0.6, 0.012), std(0xd8dee6, { roughness: 0.3 }), [0, 0.42, 0.012]);
  mesh(sword, box(0.22, 0.04, 0.05), std(0x6a5233), [0, 0.02, 0]);
  mesh(sword, cyl(0.026, 0.026, 0.18, 6), wood, [0, -0.09, 0]);
  sword.position.set(0.06, -0.46, 0.06);
  sword.rotation.set(-0.5, 0, 0.22);
  p.armR.add(sword);

  const b = p;
  return {
    group: b.group,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 2);
      const sw = Math.sin(m.phase * 6);
      b.legL.rotation.x = sw * 0.7 * walk;
      b.legR.rotation.x = -sw * 0.7 * walk;
      b.body.position.y = 0.6 + Math.abs(Math.sin(m.phase * 6)) * 0.05 * walk;
      b.body.rotation.z = shake(m);
      b.head.rotation.y = Math.sin(t * 1.7 + m.phase) * 0.16;
      // руки: в покое чуть вперёд, при ударе — замах и удар
      let armR = -0.25 + sw * 0.1 * walk;
      let armL = 0.25 - sw * 0.1 * walk;
      if (m.state === 'windup') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        armR = -0.25 - k * 1.5;
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        armR = -1.75 + k * 2.6;
        armL = 0.25 + k * 0.5;
      } else if (m.state === 'hurt') {
        armR = -0.9; armL = 0.7;
      }
      b.armR.rotation.x = armR;
      b.armL.rotation.x = armL;
      b.armR.rotation.z = m.state === 'attack' ? -0.25 : -0.08;
      flashMaterials(b.group, m.hitFlash);
    },
  };
}

/**
 * Гоблин с луком.
 *
 * @returns {object} модель
 */
function goblinBow() {
  const p = goblinBody({ name: 'goblinBow', cloth: 0x4a5b3a, scale: 0.96 });
  const wood = std(0x6b4a2c);
  const bow = new THREE.Group();
  // дуга из двух отрезков
  mesh(bow, cyl(0.022, 0.022, 0.62, 6), wood, [0, 0.16, 0], [0.22, 0, 0]);
  mesh(bow, cyl(0.022, 0.022, 0.62, 6), wood, [0, -0.16, 0], [-0.22, 0, 0]);
  mesh(bow, cyl(0.012, 0.012, 0.7, 5), std(0xd8cdb0), [0, 0, 0.09]); // тетива
  bow.position.set(0, -0.42, 0.06);
  bow.rotation.set(0, 0, 0.1);
  p.armL.add(bow);

  // стрела (при натяжении уходит назад)
  const arrow = new THREE.Group();
  mesh(arrow, cyl(0.014, 0.014, 0.62, 5), wood, [0, 0, 0], [Math.PI / 2, 0, 0]);
  mesh(arrow, cone(0.04, 0.12, 5), std(0xb9c0c8), [0, 0, 0.36], [Math.PI / 2, 0, 0]);
  arrow.position.set(0, -0.42, 0.06);
  p.armL.add(arrow);

  const b = p;
  return {
    group: b.group,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 2);
      const sw = Math.sin(m.phase * 6);
      b.legL.rotation.x = sw * 0.7 * walk;
      b.legR.rotation.x = -sw * 0.7 * walk;
      b.body.position.y = 0.6 + Math.abs(Math.sin(m.phase * 6)) * 0.05 * walk;
      b.body.rotation.z = shake(m);
      b.head.rotation.y = Math.sin(t * 1.7 + m.phase) * 0.16;
      let armL = 0.2 - sw * 0.1 * walk;
      let armR = -0.35 + sw * 0.1 * walk;
      let draw = 0;
      if (m.state === 'windup') {
        draw = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        armL = 0.2 - draw * 0.1;
        armR = -0.35 - draw * 0.35;
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        draw = 1 - k;
        armL = 0.1;
        armR = -0.7 + k * 0.75;
      }
      b.armL.rotation.x = armL;
      b.armR.rotation.x = armR;
      // тетива натягивается: стрела уходит назад
      arrow.position.z = 0.06 - draw * 0.26;
      bow.children[2].scale.z = 1 + draw * 0.1;
      flashMaterials(b.group, m.hitFlash);
    },
  };
}

/**
 * Элитный гоблин: доспех, меч и щит.
 *
 * @returns {object} модель
 */
function goblinGuard() {
  const p = goblinBody({ name: 'goblinGuard', scale: 1.14, skin: 0x54703a, cloth: 0x3d4756 });
  const iron = std(0x8f98a4, { roughness: 0.42, metalness: 0.22 });
  const dark = std(0x3a3f47);

  // шлем с забралом
  mesh(p.head, box(0.36, 0.26, 0.34), iron, [0, 0.13, 0]);
  mesh(p.head, box(0.38, 0.05, 0.36), iron, [0, 0.26, 0]);
  mesh(p.head, box(0.3, 0.05, 0.02), dark, [0, 0.15, 0.17]);
  // плюмаж
  mesh(p.head, box(0.06, 0.16, 0.06), std(0x8c2f2f), [0, 0.35, -0.02]);
  // наплечники
  mesh(p.body, sphere(0.16, 8, 6), iron, [-0.28, 0.46, 0]);
  mesh(p.body, sphere(0.16, 8, 6), iron, [0.28, 0.46, 0]);
  // нагрудник
  mesh(p.body, box(0.42, 0.34, 0.1), iron, [0, 0.32, 0.16]);
  mesh(p.body, box(0.1, 0.1, 0.03), std(0xb08a3c, { metalness: 0.35 }), [0, 0.34, 0.22]);

  // меч в правой руке
  const steel = std(0xbcc4cd, { roughness: 0.35, metalness: 0.22 });
  const sword = new THREE.Group();
  mesh(sword, box(0.08, 0.92, 0.025), steel, [0, 0.46, 0]);
  mesh(sword, box(0.03, 0.72, 0.014), std(0xe2e8ef, { roughness: 0.25 }), [0, 0.5, 0.016]);
  mesh(sword, box(0.28, 0.05, 0.06), std(0x7a5f38), [0, 0.03, 0]);
  mesh(sword, cyl(0.03, 0.03, 0.2, 6), std(0x4a3320), [0, -0.1, 0]);
  sword.position.set(0.06, -0.46, 0.08);
  sword.rotation.set(-0.45, 0, 0.18);
  p.armR.add(sword);

  // щит в левой руке
  const shield = new THREE.Group();
  mesh(shield, box(0.44, 0.62, 0.07), std(0x6b5638, { roughness: 0.7 }), [0, -0.18, 0]);
  mesh(shield, box(0.46, 0.08, 0.085), iron, [0, -0.18, 0]);
  mesh(shield, box(0.08, 0.64, 0.085), iron, [0, -0.18, 0]);
  mesh(shield, sphere(0.09, 8, 6), std(0x9aa2ac, { metalness: 0.4 }), [0, -0.18, 0.06]);
  shield.position.set(0, -0.34, 0.12);
  p.armL.add(shield);

  const b = p;
  return {
    group: b.group,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 2);
      const sw = Math.sin(m.phase * 5);
      b.legL.rotation.x = sw * 0.55 * walk;
      b.legR.rotation.x = -sw * 0.55 * walk;
      b.body.position.y = 0.6 + Math.abs(Math.sin(m.phase * 5)) * 0.035 * walk;
      b.body.rotation.z = shake(m);
      b.head.rotation.y = Math.sin(t * 1.3 + m.phase) * 0.12;
      let armR = -0.3 + sw * 0.08 * walk;
      let armL = 0.3 - sw * 0.08 * walk;
      if (m.state === 'windup') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        armR = -0.3 - k * 1.6;
        armL = 0.3 - k * 0.5;              // щит прикрывается
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        armR = -1.9 + k * 2.8;
        armL = 0.3 + k * 0.35;
      } else if (m.state === 'hurt') {
        armR = -0.8; armL = 0.9;
      }
      b.armR.rotation.x = armR;
      b.armL.rotation.x = armL;
      b.armR.rotation.z = m.state === 'attack' ? -0.3 : -0.1;
      // щит всегда смотрит наружу
      b.armL.rotation.z = 0.16;
      flashMaterials(b.group, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  4. Призрак — высокий и широкий
 * ------------------------------------------------------------------ */

/**
 * Призрак: парящая фигура без ног.
 *
 * @returns {object} модель
 */
function ghost() {
  const g = new THREE.Group();
  g.name = 'ghost';
  const shroud = std(0x9fb4d8, {
    transparent: true, opacity: 0.44, roughness: 1,
    emissive: 0x1b2740, side: THREE.DoubleSide, depthWrite: false,
  });
  const shroudDeep = std(0x6f86ad, {
    transparent: true, opacity: 0.3, roughness: 1,
    emissive: 0x131c2e, depthWrite: false,
  });

  // торс — перевёрнутый конус: широкий книзу, узкий к плечам
  const body = joint(g, 0, 1.55, 0);
  mesh(body, cone(0.92, 1.7, 14), shroud, [0, -0.05, 0]);
  // «плечи» — покатые, чтобы фигура читалась объёмной, а не плоской
  mesh(body, sphere(0.66, 14, 10), shroud, [0, 0.62, 0]);
  mesh(body, sphere(0.5, 12, 9), shroud, [0, 0.86, -0.06]);
  // капюшон: округлый купол, чуть сдвинутый вперёд
  mesh(body, sphere(0.44, 14, 11), shroud, [0, 1.02, 0.04]);
  mesh(body, cone(0.4, 0.52, 12), shroud, [0, 1.16, 0.02]);
  // «хвост» — четыре языка пламени, что колышутся
  const wisps = [];
  for (let i = 0; i < 4; i++) {
    const w = joint(body, (i - 1.5) * 0.3, -0.62, (i % 2) * 0.14 - 0.07);
    mesh(w, cone(0.22, 1.15, 7), shroudDeep, [0, -0.55, 0]);
    wisps.push(w);
  }
  // глаза — две яркие точки в глубине капюшона
  const eyeM = glow(0xd6ecff);
  mesh(body, sphere(0.085, 8, 7), eyeM, [-0.14, 0.92, 0.4]);
  mesh(body, sphere(0.085, 8, 7), eyeM, [0.14, 0.92, 0.4]);
  // тёмная «пустота» под капюшоном — оттуда смотрят глаза
  mesh(body, sphere(0.26, 12, 10), std(0x121a2c, {
    transparent: true, opacity: 0.72, roughness: 1, depthWrite: false,
  }), [0, 0.92, 0.16]);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0x7fb0ee, transparent: true, opacity: 0.1,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.set(0, 0.92, 0.36);
  body.add(halo);

  // руки — длинные, свисают вниз
  const armL = joint(body, -0.52, 0.72, 0.06);
  const armR = joint(body, 0.52, 0.72, 0.06);
  for (const arm of [armL, armR]) {
    mesh(arm, cyl(0.12, 0.05, 1.05, 7), shroud, [0, -0.5, 0]);
    mesh(arm, sphere(0.1, 7, 6), std(0xcfe0ff, {
      transparent: true, opacity: 0.5, emissive: 0x33507a, depthWrite: false,
    }), [0, -1.02, 0]);
  }

  g.scale.setScalar(1.18);   // «больше» — по просьбе

  return {
    group: g,
    update(t, dt, m) {
      const float = Math.sin(t * 1.6 + m.phase * 2) * 0.16;
      g.position.y = float;
      g.rotation.z = shake(m) * 0.6;
      // языки пламени колышутся
      for (let i = 0; i < wisps.length; i++) {
        wisps[i].rotation.z = Math.sin(t * 2.4 + i * 1.7) * 0.28;
        wisps[i].rotation.x = Math.cos(t * 1.9 + i) * 0.18;
      }
      // руки: при атаке тянутся вперёд
      const reach = m.state === 'windup' ? Math.min(1, m.stateT / Math.max(0.001, m.windup)) * 0.8
        : m.state === 'attack' ? 0.8 + Math.min(1, m.stateT / Math.max(0.001, m.active)) * 0.6 : 0;
      armL.rotation.x = -reach * 1.5;
      armR.rotation.x = -reach * 1.5;
      armL.rotation.z = 0.2 + Math.sin(t * 1.3) * 0.08;
      armR.rotation.z = -0.2 - Math.sin(t * 1.3) * 0.08;
      flashMaterials(g, m.hitFlash * 0.5);
    },
  };
}

/* ------------------------------------------------------------------
 *  5. Паук
 * ------------------------------------------------------------------ */

/**
 * Паук: восемь ног, которые переступают волной.
 *
 * @returns {object} модель
 */
function spider() {
  const g = new THREE.Group();
  g.name = 'spider';
  const chitin = std(0x2c2029, { roughness: 0.6 });
  const belly = std(0x6d3a3a, { roughness: 0.7 });
  const eyeM = glow(0xff4a3a);

  const body = joint(g, 0, 0.52, -0.12);
  mesh(body, sphere(0.38, 12, 10), chitin, [0, 0, 0]);
  mesh(body, sphere(0.28, 10, 8), belly, [0, -0.08, -0.18]);
  // «паутина» на спине
  mesh(body, sphere(0.09, 6, 5), glow(0xd8d0c0), [0, 0.32, -0.1]);

  const head = joint(body, 0, 0.02, 0.3);
  mesh(head, sphere(0.22, 10, 8), chitin, [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    mesh(head, sphere(0.028, 5, 4), eyeM, [-0.09 + i * 0.06, 0.09, 0.17]);
  }
  // жвалы
  mesh(head, cone(0.05, 0.16, 5), chitin, [-0.07, -0.06, 0.2], [1.3, 0, 0]);
  mesh(head, cone(0.05, 0.16, 5), chitin, [0.07, -0.06, 0.2], [1.3, 0, 0]);

  // восемь ног: по четыре с каждой стороны
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const hip = joint(body, side * 0.22, 0.02, 0.22 - k * 0.22);
    const upper = cyl(0.045, 0.03, 0.62, 5);
    mesh(hip, upper, chitin, [side * 0.24, 0.16, 0], [0, 0, side * -1.05]);
    const knee = joint(hip, side * 0.5, 0.3, 0);
    mesh(knee, cyl(0.032, 0.018, 0.78, 5), chitin, [0, -0.38, 0], [0, 0, side * 0.35]);
    legs.push({ hip, knee, side, phase: k * 1.3 + (side < 0 ? 0 : 1.6) });
  }

  return {
    group: g,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 2.6);
      for (const L of legs) {
        const s = Math.sin(m.phase * 7 + L.phase);
        L.hip.rotation.z = L.side * (-1.05 + s * 0.32 * walk);
        L.knee.rotation.z = L.side * (0.35 + Math.cos(m.phase * 7 + L.phase) * 0.4 * walk);
      }
      body.position.y = 0.52 + Math.abs(Math.sin(m.phase * 7)) * 0.05 * walk;
      body.rotation.z = shake(m);
      // перед атакой паук приседает, потом прыгает
      let crouch = 0;
      if (m.state === 'windup') crouch = Math.min(1, m.stateT / Math.max(0.001, m.windup));
      else if (m.state === 'attack') crouch = -Math.min(1, m.stateT / Math.max(0.001, m.active));
      body.position.y -= crouch * 0.16;
      body.rotation.x = -crouch * 0.3;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  6. Слизень
 * ------------------------------------------------------------------ */

/**
 * Слизень: прыгающий ком, который мнётся при ударе.
 *
 * @param {number} colorHex цвет
 * @returns {object} модель
 */
function slime(colorHex) {
  const g = new THREE.Group();
  g.name = 'slime';
  const jelly = std(colorHex, {
    transparent: true, opacity: 0.78, roughness: 0.22,
    emissive: new THREE.Color(colorHex).multiplyScalar(0.16).getHex(),
  });
  const core = std(new THREE.Color(colorHex).multiplyScalar(0.55).getHex());
  const body = joint(g, 0, 0.36, 0);
  const shell = mesh(body, sphere(0.46, 14, 11), jelly, [0, 0, 0]);
  shell.scale.set(1, 0.82, 1);
  mesh(body, sphere(0.18, 9, 7), core, [0, -0.06, 0]);
  // глаза
  const eyeM = glow(0x14181e);
  mesh(body, sphere(0.055, 6, 5), eyeM, [-0.14, 0.14, 0.36]);
  mesh(body, sphere(0.055, 6, 5), eyeM, [0.14, 0.14, 0.36]);
  // рот
  mesh(body, box(0.14, 0.03, 0.02), eyeM, [0, 0.03, 0.42]);

  return {
    group: g,
    update(t, dt, m) {
      // сжатие-растяжение: в прыжке вытягивается, при приземлении сплющивается
      let sx = 1, sy = 0.82;
      if (m.state === 'windup') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        sx = 1 + k * 0.3; sy = 0.82 - k * 0.3;
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        sx = 1.3 - k * 0.45; sy = 0.52 + k * 0.55;
      } else if (m.state === 'hurt') {
        sx = 1.18; sy = 0.7;
      } else {
        const b = Math.sin(t * 3 + m.phase * 2) * 0.04;
        sx = 1 + b; sy = 0.82 - b;
      }
      body.scale.set(sx, sy / 0.82, sx);
      body.position.y = 0.36 * sy / 0.82 + Math.abs(Math.sin(m.phase * 5)) * 0.04;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  7. Живой гриб
 * ------------------------------------------------------------------ */

/**
 * Мухомор-тварь: ножка, шляпка, споры.
 *
 * @returns {object} модель
 */
function shroom() {
  const g = new THREE.Group();
  g.name = 'shroom';
  const stalkM = std(0xd8cdb4);
  const capM = std(0xb8452f, { roughness: 0.7 });
  const spotM = glow(0xf3e6d0);

  const body = joint(g, 0, 0.0, 0);
  // ножка
  mesh(body, cyl(0.16, 0.22, 0.72, 10), stalkM, [0, 0.36, 0]);
  // шляпка
  const cap = mesh(body, sphere(0.44, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM, [0, 0.72, 0]);
  cap.scale.set(1, 0.72, 1);
  // пятна
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    mesh(body, sphere(0.06, 6, 5), spotM, [Math.cos(a) * 0.24, 0.83, Math.sin(a) * 0.24], null);
  }
  // глаза на ножке
  const eyeM = glow(0x1a1d22);
  mesh(body, sphere(0.045, 6, 5), eyeM, [-0.09, 0.5, 0.16]);
  mesh(body, sphere(0.045, 6, 5), eyeM, [0.09, 0.5, 0.16]);
  mesh(body, box(0.1, 0.025, 0.02), eyeM, [0, 0.42, 0.17]);
  // маленькие руки
  const armL = joint(body, -0.2, 0.5, 0);
  const armR = joint(body, 0.2, 0.5, 0);
  for (const arm of [armL, armR]) {
    mesh(arm, cyl(0.05, 0.03, 0.3, 6), stalkM, [0, -0.14, 0]);
  }

  return {
    group: g,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 1.4);
      const sw = Math.sin(m.phase * 5);
      body.position.y = Math.abs(sw) * 0.07 * walk;
      body.rotation.z = shake(m);
      // шляпка покачивается
      cap.rotation.z = Math.sin(t * 1.8 + m.phase) * 0.08;
      let armRX = -0.2 + sw * 0.2 * walk;
      let armLX = 0.2 - sw * 0.2 * walk;
      if (m.state === 'windup') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        armRX = -0.2 - k * 1.2;
        armLX = 0.2 + k * 0.5;
        body.rotation.x = -k * 0.22;
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        armRX = -1.4 + k * 1.5;
        armLX = 0.7 - k * 0.6;
        body.rotation.x = -0.22 + k * 0.4;
      }
      armR.rotation.x = armRX;
      armL.rotation.x = armLX;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  8. Змея
 * ------------------------------------------------------------------ */

/**
 * Змея: тело из сегментов, которые ползут волной.
 *
 * @returns {object} модель
 */
function snake() {
  const g = new THREE.Group();
  g.name = 'snake';
  const scaleM = std(0x4d6b3a, { roughness: 0.7 });
  const bellyM = std(0xc7c08a);
  const N = 10;
  const segs = [];
  for (let i = 0; i < N; i++) {
    const r = 0.17 - i * 0.011;
    const m = mesh(g, sphere(r, 8, 6), scaleM, [0, 0.22, -i * 0.24]);
    m.scale.set(1, 0.85, 1.25);
    segs.push(m);
  }
  // брюхо
  const head = joint(g, 0, 0.24, 0.08);
  mesh(head, sphere(0.19, 9, 7), scaleM, [0, 0, 0]);
  mesh(head, box(0.22, 0.06, 0.2), bellyM, [0, -0.1, 0.03]);
  const eyeM = glow(0xe8c33a);
  mesh(head, sphere(0.035, 6, 5), eyeM, [-0.1, 0.06, 0.08]);
  mesh(head, sphere(0.035, 6, 5), eyeM, [0.1, 0.06, 0.08]);
  // язык
  const tongue = mesh(head, box(0.02, 0.02, 0.16), glow(0xc0384a), [0, -0.02, 0.2]);

  return {
    group: g,
    update(t, dt, m) {
      // волна по телу
      for (let i = 0; i < N; i++) {
        const w = Math.sin(m.phase * 6 - i * 0.75) * 0.16;
        segs[i].position.x = w;
        segs[i].position.y = 0.22 + Math.cos(m.phase * 6 - i * 0.75) * 0.03;
      }
      head.position.x = Math.sin(m.phase * 6 + 0.4) * 0.12;
      head.position.y = 0.24;
      // при укусе язык высовывается
      const bite = m.state === 'attack' ? Math.min(1, m.stateT / Math.max(0.001, m.active)) : 0;
      tongue.scale.z = 1 + bite * 2.2;
      tongue.visible = m.state !== 'idle' || Math.sin(t * 2) > 0.6;
      // при подготовке к броску змея поднимается
      const raise = m.state === 'windup' ? Math.min(1, m.stateT / Math.max(0.001, m.windup)) : 0;
      head.position.y = 0.24 + raise * 0.2;
      head.rotation.x = -raise * 0.5 + bite * 0.6;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  9. Каменный голем
 * ------------------------------------------------------------------ */

/**
 * Маленький каменный голем: три груды камня и светящиеся трещины.
 *
 * @returns {object} модель
 */
function golemSmall() {
  const g = new THREE.Group();
  g.name = 'golemSmall';
  const stoneM = std(0x6d6a63, { roughness: 0.95 });
  const darkM = std(0x4a4842, { roughness: 1 });
  const crackM = glow(0xff9a3c);

  const body = joint(g, 0, 0, 0);
  // корпус — три сдвинутых блока
  mesh(body, box(0.78, 0.62, 0.64), stoneM, [0, 0.9, 0]);
  mesh(body, box(0.6, 0.4, 0.54), stoneM, [0.08, 1.3, -0.03], [0.1, 0.3, 0.06]);
  mesh(body, box(0.4, 0.32, 0.36), darkM, [-0.1, 1.54, 0.04], [0, -0.2, 0.1]);
  // трещины
  mesh(body, box(0.06, 0.52, 0.03), crackM, [0.15, 0.9, 0.33]);
  mesh(body, box(0.36, 0.05, 0.03), crackM, [-0.12, 0.72, 0.33]);
  // голова
  const head = joint(body, 0, 1.7, 0.02);
  mesh(head, box(0.38, 0.32, 0.34), stoneM, [0, 0, 0]);
  mesh(head, box(0.3, 0.05, 0.03), crackM, [0, 0.03, 0.18]);
  mesh(head, box(0.1, 0.1, 0.06), darkM, [0, -0.12, 0.18]);
  // руки — тяжёлые блоки, вынесены наружу, чтобы их было видно
  const armL = joint(body, -0.52, 1.08, 0.02);
  const armR = joint(body, 0.52, 1.08, 0.02);
  for (const arm of [armL, armR]) {
    mesh(arm, box(0.3, 0.66, 0.3), stoneM, [0, -0.33, 0]);
    mesh(arm, box(0.36, 0.3, 0.34), darkM, [0, -0.74, 0.02]);
    mesh(arm, box(0.08, 0.3, 0.03), crackM, [0, -0.36, 0.16]);
  }
  // ноги
  const legL = joint(body, -0.22, 0.64, 0);
  const legR = joint(body, 0.22, 0.64, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, box(0.3, 0.64, 0.32), stoneM, [0, -0.32, 0]);
    mesh(leg, box(0.34, 0.14, 0.42), darkM, [0, -0.6, 0.06]);
  }

  return {
    group: g,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 1.2);
      const sw = Math.sin(m.phase * 3.6);
      legL.rotation.x = sw * 0.42 * walk;
      legR.rotation.x = -sw * 0.42 * walk;
      body.position.y = Math.abs(sw) * 0.06 * walk;
      body.rotation.z = shake(m);
      // при ударе обе руки поднимаются вверх
      let aL = sw * 0.2 * walk, aR = -sw * 0.2 * walk;
      if (m.state === 'windup') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
        aL = -k * 2.2; aR = -k * 2.2;
      } else if (m.state === 'attack') {
        const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
        aL = -2.2 + k * 3.0; aR = -2.2 + k * 3.0;
      }
      armL.rotation.x = aL;
      armR.rotation.x = aR;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  10. Орк-босс
 * ------------------------------------------------------------------ */

/**
 * Орк: три метра ростом, двуручная секира и боевой замах.
 *
 * @returns {object} модель
 */
function orcBoss() {
  const g = new THREE.Group();
  g.name = 'orcBoss';
  const skinM = std(0x5c7a45, { roughness: 0.78 });
  const clothM = std(0x5a2d24, { roughness: 0.9 });
  const ironM = std(0x8d949c, { roughness: 0.4, metalness: 0.25 });
  const darkM = std(0x35322f);

  const legL = joint(g, -0.36, 1.05, 0);
  const legR = joint(g, 0.36, 1.05, 0);
  for (const leg of [legL, legR]) {
    mesh(leg, cyl(0.28, 0.22, 1.0, 9), skinM, [0, -0.5, 0]);
    mesh(leg, sphere(0.24, 8, 7), skinM, [0, -0.92, 0]);
    mesh(leg, box(0.46, 0.2, 0.66), darkM, [0, -1.0, 0.1]);
  }

  const body = joint(g, 0, 1.05, 0);
  // торс — широкий, коренастый: орк должен нависать
  mesh(body, box(1.34, 1.0, 0.78), skinM, [0, 0.5, 0]);
  mesh(body, box(1.42, 0.62, 0.86), clothM, [0, 0.12, 0]);      // накидка
  mesh(body, box(1.36, 0.16, 0.84), darkM, [0, 0.42, 0]);       // ремень
  mesh(body, box(0.62, 0.66, 0.16), ironM, [0, 0.62, 0.4]);     // нагрудник
  mesh(body, box(0.2, 0.2, 0.06), std(0xb08a3c, { metalness: 0.35 }), [0, 0.62, 0.5]);
  // наплечники — широкие, приплюснутые: тяжёлая броня
  for (const sx of [-1, 1]) {
    const pad = mesh(body, sphere(0.46, 10, 8), ironM, [sx * 0.76, 0.86, 0]);
    pad.scale.set(1.15, 0.72, 1.05);
    mesh(body, cone(0.13, 0.42, 6), ironM, [sx * 0.92, 1.1, 0], [0, 0, sx * 0.5]);
  }
  // шейные шпоры
  mesh(body, cone(0.12, 0.36, 6), ironM, [-0.56, 1.12, 0.12], [0, 0, 0.6]);
  mesh(body, cone(0.12, 0.36, 6), ironM, [0.56, 1.12, 0.12], [0, 0, -0.6]);

  const head = joint(body, 0, 1.08, 0.02);
  mesh(head, sphere(0.44, 14, 11), skinM, [0, 0.16, 0]);
  mesh(head, box(0.52, 0.2, 0.42), skinM, [0, -0.1, 0.12]);     // челюсть
  // клыки — торчат из нижней челюсти
  mesh(head, cone(0.085, 0.34, 5), glow(0xe6dfc8), [-0.15, -0.16, 0.3], [Math.PI, 0, 0]);
  mesh(head, cone(0.085, 0.34, 5), glow(0xe6dfc8), [0.15, -0.16, 0.3], [Math.PI, 0, 0]);
  mesh(head, cone(0.05, 0.18, 5), glow(0xe6dfc8), [-0.29, -0.15, 0.22], [Math.PI, 0, 0]);
  mesh(head, cone(0.05, 0.18, 5), glow(0xe6dfc8), [0.29, -0.15, 0.22], [Math.PI, 0, 0]);
  // глаза
  const eyeM = glow(0xffb03a);
  mesh(head, sphere(0.075, 7, 6), eyeM, [-0.15, 0.2, 0.34]);
  mesh(head, sphere(0.075, 7, 6), eyeM, [0.15, 0.2, 0.34]);
  // рожки — крупные, загнутые наружу
  const hornM = std(0x3b2f26, { roughness: 0.85 });
  for (const sx of [-1, 1]) {
    const horn = mesh(head, cone(0.14, 0.72, 7), hornM,
      [sx * 0.34, 0.46, -0.04], [0, 0, sx * 0.85]);
    horn.scale.set(1, 1, 0.85);
    mesh(head, cone(0.06, 0.26, 5), hornM, [sx * 0.56, 0.74, -0.06], [0, 0, sx * 1.25]);
  }
  // грива — то, что отличает босса от обычного гоблина
  const maneM = std(0x2e2018, { roughness: 0.95 });
  for (let i = 0; i < 7; i++) {
    const a = -1.15 + i * 0.38;
    mesh(head, cone(0.11, 0.46, 5), maneM,
      [Math.sin(a) * 0.36, 0.34, -Math.cos(a) * 0.3 - 0.12], [-0.62, a, 0]);
  }
  mesh(head, box(0.5, 0.34, 0.12), maneM, [0, 0.3, -0.34]);    // загривок

  const armL = joint(body, -0.78, 0.76, 0);
  const armR = joint(body, 0.78, 0.76, 0);
  for (const arm of [armL, armR]) {
    mesh(arm, cyl(0.21, 0.17, 0.8, 9), skinM, [0, -0.4, 0]);
    mesh(arm, sphere(0.22, 9, 8), skinM, [0, -0.84, 0]);
  }

  // двуручная секира — за плечом, как у настоящего босса
  const axe = new THREE.Group();
  const woodM = std(0x4e3524, { roughness: 0.9 });
  const steelM = std(0xaeb7c1, { roughness: 0.3, metalness: 0.25 });
  const edgeM = std(0xdfe6ee, { roughness: 0.22, metalness: 0.3 });
  mesh(axe, cyl(0.07, 0.07, 2.1, 8), woodM, [0, 0.7, 0]);
  // лезвие — ступенчато расширяется наружу, чтобы читалось полумесяцем
  mesh(axe, box(0.16, 1.0, 0.08), steelM, [0.17, 1.62, 0]);
  mesh(axe, box(0.26, 0.52, 0.07), steelM, [0.34, 1.42, 0]);
  mesh(axe, box(0.26, 0.44, 0.07), steelM, [0.56, 1.6, 0]);
  mesh(axe, box(0.24, 0.32, 0.07), steelM, [0.74, 1.78, 0]);
  mesh(axe, box(0.07, 0.3, 0.08), edgeM, [0.84, 1.86, 0]);
  mesh(axe, cone(0.09, 0.34, 5), steelM, [0.1, 1.18, 0], [0, 0, -1.9]);   // обратный клык
  mesh(axe, box(0.1, 0.3, 0.1), std(0x2f2a26), [0.03, 1.78, 0]);
  mesh(axe, box(0.1, 0.1, 0.1), std(0xb08a3c, { metalness: 0.3 }), [0.03, 1.78, 0.08]);
  axe.position.set(0.06, -0.62, 0.1);
  axe.rotation.set(0.22, 0.34, 0.2);
  armR.add(axe);

  return {
    group: g,
    update(t, dt, m) {
      const walk = Math.min(1, m.moveSpeed / 2.6);
      const sw = Math.sin(m.phase * 4);
      legL.rotation.x = sw * 0.6 * walk;
      legR.rotation.x = -sw * 0.6 * walk;
      body.position.y = 1.15 + Math.abs(sw) * 0.09 * walk;
      body.rotation.z = shake(m);
      head.rotation.y = Math.sin(t * 1.1) * 0.14;

      let armRX = -0.35 + sw * 0.12 * walk;
      let armLX = 0.3 - sw * 0.12 * walk;
      let az = 0;
      if (m.attackName === 'slam') {
        // удар оземь: обе руки вверх, потом вниз
        if (m.state === 'windup') {
          const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
          armLX = -k * 2.6; armRX = -k * 2.6;
          body.rotation.x = -k * 0.25;
        } else if (m.state === 'attack') {
          const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
          armLX = -2.6 + k * 3.4; armRX = -2.6 + k * 3.4;
          body.rotation.x = -0.25 + k * 0.7;
        }
      } else if (m.attackName === 'charge') {
        // наскок: наклон вперёд
        if (m.state === 'windup') {
          const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
          body.rotation.x = -k * 0.35;
          armLX = 0.8; armRX = -1.2;
        } else if (m.state === 'attack') {
          body.rotation.x = -0.4;
          armLX = 1.1; armRX = -1.6;
        }
      } else if (m.attackName === 'roar') {
        // рёв: голова вверх, руки в стороны
        if (m.state === 'windup' || m.state === 'attack') {
          const k = m.state === 'windup'
            ? Math.min(1, m.stateT / Math.max(0.001, m.windup))
            : 1;
          head.rotation.x = -k * 0.55;
          armLX = 0.9 * k; armRX = -0.9 * k;
          body.rotation.x = -k * 0.12;
        }
      } else {
        // обычный рубящий удар
        if (m.state === 'windup') {
          const k = Math.min(1, m.stateT / Math.max(0.001, m.windup));
          armRX = -0.35 - k * 2.1;
          armLX = 0.3 + k * 0.5;
          body.rotation.x = -k * 0.2;
        } else if (m.state === 'attack') {
          const k = Math.min(1, m.stateT / Math.max(0.001, m.active));
          armRX = -2.45 + k * 3.3;
          armLX = 0.8 - k * 0.7;
          body.rotation.x = -0.2 + k * 0.45;
          az = -0.3 + k * 0.7;
        }
      }
      armR.rotation.x = armRX;
      armL.rotation.x = armLX;
      armR.rotation.z = az;
      flashMaterials(g, m.hitFlash);
    },
  };
}

/* ------------------------------------------------------------------
 *  Реестр
 * ------------------------------------------------------------------ */

/**
 * Построить модель монстра по его типу.
 *
 * @param {string} type тип монстра
 * @returns {object} модель { group, update }
 */
export function monsterModel(type) {
  switch (type) {
    case 'goblin_sword': return goblinSword();
    case 'goblin_bow': return goblinBow();
    case 'goblin_guard': return goblinGuard();
    case 'ghost': return ghost();
    case 'spider': return spider();
    case 'slime_green': return slime(0x6fbf4a);
    case 'slime_blue': return slime(0x4a9fbf);
    case 'slime_red': return slime(0xc25a4a);
    case 'shroom': return shroom();
    case 'snake': return snake();
    case 'golem_small': return golemSmall();
    case 'orc_boss': return orcBoss();
    default: return goblinSword();
  }
}

/* ------------------------------------------------------------------
 *  Мешок с добычей
 * ------------------------------------------------------------------ */

/**
 * Цвет свечения по редкости.
 */
export const RARITY_COLORS = {
  common: 0xbfc6cc,
  uncommon: 0x74c06a,
  rare: 0x5aa9e6,
  epic: 0xb072e0,
  legendary: 0xe0a63a,
};

/**
 * Мешок добычи: ткань, перевязь и свечение редкости.
 *
 * @param {string} rarity редкость
 * @returns {object} модель
 */
export function lootBagModel(rarity = 'common') {
  const g = new THREE.Group();
  g.name = 'lootBag';
  const clothM = std(0x8a7550, { roughness: 0.95 });
  const tieM = std(0x4b3a26);
  const glowCol = RARITY_COLORS[rarity] ?? RARITY_COLORS.common;

  const sack = mesh(g, sphere(0.24, 10, 8), clothM, [0, 0.2, 0]);
  sack.scale.set(1, 0.9, 0.85);
  mesh(g, cyl(0.09, 0.14, 0.14, 8), clothM, [0, 0.4, 0]);
  mesh(g, torus(0.1, 0.028, 5, 10), tieM, [0, 0.42, 0], [Math.PI / 2, 0, 0]);

  // мягкий ореол редкости
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 10, 8),
    new THREE.MeshBasicMaterial({
      color: glowCol, transparent: true, opacity: 0.13,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.y = 0.2;
  g.add(halo);
  // редкий «искорки» над мешком
  const spark = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.06),
    new THREE.MeshBasicMaterial({ color: glowCol, toneMapped: false }),
  );
  spark.position.y = 0.58;
  g.add(spark);

  return {
    group: g,
    update(t) {
      spark.rotation.y = t * 1.6;
      spark.position.y = 0.58 + Math.sin(t * 2.2) * 0.05;
      halo.scale.setScalar(1 + Math.sin(t * 2.6) * 0.07);
    },
  };
}
