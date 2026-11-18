/**
 * ============================================================================
 *  Храм: неф как самостоятельная локация
 * ============================================================================
 *
 *  Снаружи церковь стоит на холме, а внутри неё — настоящий неф: каменные
 *  стены с витражами, ряды скамьев, алтарь со свечами, курильница у входа.
 *  Свет внутри храма холодный от витражей и тёплый от алтаря — в отличие
 *  от улицы, здесь всегда своя атмосфера.
 *
 *  @module world/church
 */

import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, mat, plane } from './geo.js';
import { Motes } from './particles.js';

const W = 9;        // ширина нефа
const D = 17;       // длина нефа
const H = 6.5;      // высота стен
const T = 0.4;      // толщина стен
const DOOR_W = 2.6; // ширина портала
const AISLE = 1.5;  // ширина центрального прохода

/** Название храма — показывается при входе. */
export const CHURCH_NAME = 'Храм Святого Покрова';

/**
 * Собирает интерьер храма.
 *
 * @param {object} M набор материалов
 * @param {THREE.Texture} glowTex текстура свечения
 * @returns {object} локация храма
 */
export function buildChurchInterior(M, glowTex) {
  const B = new Builder();
  const colliders = { boxes: [], circles: [] };
  const platforms = [];
  const spots = [];

  /* ---------------- оболочка ---------------- */
  // пол — каменные плиты, по центру ковровая дорожка
  B.put('stone', W - T * 2, 0.14, D - T * 2, 0, -0.07, 0, 1.6);
  B.put('redCloth', AISLE, 0.04, D - T * 2 - 0.6, 0, 0.02, 0, 1.2);
  // стены
  B.put('stone', W, H, T, 0, H / 2, D / 2 - T / 2, 2.0);                    // северная, за алтарём
  B.put('stone', T, H, D - T * 2, -W / 2 + T / 2, H / 2, 0, 2.0);           // западная
  B.put('stone', T, H, D - T * 2, W / 2 - T / 2, H / 2, 0, 2.0);            // восточная
  // южная стена с проёмом портала
  {
    const sideW = (W - DOOR_W) / 2, sideX = DOOR_W / 2 + sideW / 2;
    B.put('stone', sideW, H, T, -sideX, H / 2, -D / 2 + T / 2, 2.0);
    B.put('stone', sideW, H, T, sideX, H / 2, -D / 2 + T / 2, 2.0);
    B.put('stone', DOOR_W, H - 3.8, T, 0, 3.8 + (H - 3.8) / 2, -D / 2 + T / 2, 2.0);
    // портал: две колонны и полуциркульная арка
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.6, 3.8, 0.6, sx * (DOOR_W / 2 + 0.3), 1.9, -D / 2 + 0.1, 1.2);
      B.put('stoneDark', 0.8, 0.3, 0.8, sx * (DOOR_W / 2 + 0.3), 0.15, -D / 2 + 0.1, 1.2);
    }
    B.add(cyl(DOOR_W / 2 + 0.3, DOOR_W / 2 + 0.3, 0.55, 14, true), 'stoneDark',
      mat(0, 3.8, -D / 2 + 0.1, 0, Math.PI / 2));
    B.put('stoneDark', DOOR_W + 1.4, 0.35, 0.7, 0, 4.25, -D / 2 + 0.1, 1.2);
    // распахнутые внутрь створки и тьма за проёмом
    B.put('dark', DOOR_W, 3.8, 0.3, 0, 1.9, -D / 2 + 0.42, 1.2);
    for (const sx of [-1, 1]) {
      const a = sx * 1.15;
      B.add(box(DOOR_W / 2, 3.4, 0.12, 1), 'oakDoor',
        mat(sx * (DOOR_W / 2 - 0.05) + Math.sin(a) * (DOOR_W / 4), 1.7,
          -D / 2 + 0.35 + (1 - Math.cos(a)) * (DOOR_W / 4), a));
    }
  }
  // свод и нервюры
  B.put('stoneDark', W - T * 2, 0.34, D - T * 2, 0, H - 0.17, 0, 1.6);
  for (let i = 0; i < 9; i++) {
    B.put('timber', W - T * 2, 0.2, 0.24, 0, H - 0.42, -D / 2 + 1.3 + i * 1.8, 1.2);
  }
  // ряд колонн вдоль нефа
  for (let i = 0; i < 6; i++) {
    for (const sx of [-1, 1]) {
      const z = -D / 2 + 2.6 + i * 2.4;
      B.add(cyl(0.22, 0.26, H - 0.5, 10), 'stone', mat(sx * (W / 2 - 0.85), (H - 0.5) / 2, z));
      B.put('stoneDark', 0.7, 0.22, 0.7, sx * (W / 2 - 0.85), H - 0.55, z, 1.2);
    }
  }

  /* ---------------- витражи ---------------- */
  const glassKinds = ['stainedRed', 'stainedBlue', 'stainedGold', 'stainedGreen'];
  for (let i = 0; i < 4; i++) {
    const z = -D / 2 + 3.2 + i * 3.6;
    for (const sx of [-1, 1]) {
      const kind = glassKinds[(i + (sx > 0 ? 1 : 0)) % glassKinds.length];
      // витраж выносим на внутреннюю сторону стены, иначе его закрывает кладка
      const wx = sx * (W / 2 - T - 0.06);
      B.put(kind, 0.08, 2.6, 1.7, wx, 3.1, z, 1.2);
      // каменный наличник и переплёт
      B.put('stoneDark', 0.2, 2.9, 0.22, wx - sx * 0.07, 3.1, z - 0.9, 1.2);
      B.put('stoneDark', 0.2, 2.9, 0.22, wx - sx * 0.07, 3.1, z + 0.9, 1.2);
      B.put('stoneDark', 0.24, 0.22, 2.0, wx - sx * 0.08, 4.5, z, 1.2);
      B.put('stoneDark', 0.24, 0.22, 2.0, wx - sx * 0.08, 1.7, z, 1.2);
      B.put('iron', 0.12, 2.6, 0.1, wx - sx * 0.12, 3.1, z, 1.2);
      B.put('iron', 0.12, 0.1, 1.7, wx - sx * 0.12, 3.1, z, 1.2);
      // подоконник
      B.put('stone', 0.42, 0.14, 2.0, wx - sx * 0.2, 1.58, z, 1.2);
    }
  }

  /* ---------------- скамьи ---------------- */
  const benchZ = [-4.2, -1.6, 1.0, 3.6];
  for (const bz of benchZ) {
    for (const sx of [-1, 1]) {
      const bx = sx * 2.55;
      B.put('timber', 2.0, 0.14, 0.5, bx, 0.55, bz, 1.2);          // сиденье
      B.put('timber', 2.0, 0.7, 0.12, bx, 0.95, bz - 0.24, 1.2);   // спинка
      for (const lx of [-0.85, 0.85]) {
        B.put('timber', 0.16, 0.55, 0.42, bx + lx, 0.28, bz, 1.2);
      }
      colliders.boxes.push({ cx: bx, cz: bz, hx: 1.0, hz: 0.3, ang: 0 });
    }
  }

  /* ---------------- алтарь ---------------- */
  {
    const az = D / 2 - 1.7;
    B.put('stone', 2.6, 0.9, 1.3, 0, 0.45, az, 1.4);                 // постамент
    B.put('stoneDark', 2.9, 0.18, 1.6, 0, 0.99, az, 1.4);            // столешница
    B.put('cloth', 2.5, 0.06, 1.3, 0, 1.1, az, 1.2);                 // покров
    // крест
    B.put('brass', 0.12, 1.5, 0.12, 0, 1.95, az - 0.35, 1.2);
    B.put('brass', 0.8, 0.12, 0.12, 0, 2.3, az - 0.35, 1.2);
    // две свечи в подсвечниках
    for (const sx of [-1, 1]) {
      B.add(cyl(0.16, 0.2, 0.1, 10), 'brass', mat(sx * 0.75, 1.18, az - 0.2));
      B.add(cyl(0.07, 0.08, 0.5, 8), 'bone', mat(sx * 0.75, 1.46, az - 0.2));
      B.add(sphere(0.07, 8, 6), 'lampGlass', mat(sx * 0.75, 1.76, az - 0.2));
    }
    colliders.boxes.push({ cx: 0, cz: az, hx: 1.45, hz: 0.8, ang: 0 });
    spots.push([new THREE.Vector3(0, 1.4, az - 1.6), 'На алтаре — серебряный кубок и свечи. Цветы сегодня старые, но свежие.']);
  }

  /* ---------------- курильница у входа ---------------- */
  {
    const cz = -D / 2 + 1.5;
    B.put('stoneDark', 0.7, 0.16, 0.7, -2.9, 0.08, cz, 1.2);
    B.add(cyl(0.26, 0.32, 0.5, 10), 'brass', mat(-2.9, 0.4, cz));
    B.add(torus(0.3, 0.03, 5, 12), 'brass', mat(-2.9, 0.66, cz, 0, Math.PI / 2));
    colliders.boxes.push({ cx: -2.9, cz, hx: 0.35, hz: 0.35, ang: 0 });
    spots.push([new THREE.Vector3(-2.9, 1.1, cz), 'Курильница дымит ладаном. Дым витками поднимается к своду.']);
  }

  /* ---------------- образы на стенах ---------------- */
  for (const sx of [-1, 1]) {
    for (const z of [-5.2, 0.4]) {
      const ix = sx * (W / 2 - T - 0.05);
      B.put('brass', 0.07, 1.3, 1.0, ix, 2.2, z, 1.2);         // золотая рама
      B.put('timber', 0.05, 1.1, 0.8, ix - sx * 0.05, 2.2, z, 1.2); // тёмный холст
      B.put('redCloth', 0.05, 0.42, 0.34, ix - sx * 0.08, 1.92, z, 1.2);
      B.put('bone', 0.05, 0.26, 0.26, ix - sx * 0.08, 2.45, z, 1.2);
    }
  }

  /* ---------------- коллайдеры стен ---------------- */
  colliders.boxes.push({ cx: 0, cz: D / 2 - T / 2, hx: W / 2, hz: T / 2, ang: 0 });
  colliders.boxes.push({ cx: -W / 2 + T / 2, cz: 0, hx: T / 2, hz: D / 2, ang: 0 });
  colliders.boxes.push({ cx: W / 2 - T / 2, cz: 0, hx: T / 2, hz: D / 2, ang: 0 });
  {
    const sideW = (W - DOOR_W) / 2, sideX = DOOR_W / 2 + sideW / 2;
    colliders.boxes.push({ cx: -sideX, cz: -D / 2 + T / 2, hx: sideW / 2, hz: T / 2, ang: 0 });
    colliders.boxes.push({ cx: sideX, cz: -D / 2 + T / 2, hx: sideW / 2, hz: T / 2, ang: 0 });
  }

  /* ---------------- свет ---------------- */
  const group = B.build(M, null, { name: 'churchInterior' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14121a);
  scene.fog = new THREE.Fog(0x14121a, 7, 30);
  scene.add(group);

  const altar = new THREE.PointLight(0xffb45a, 16, 22, 1.2);
  altar.position.set(0, 2.2, D / 2 - 2.2);
  scene.add(altar);
  const west = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  west.position.set(-W / 2 + 1.0, 3.1, -1.2);
  scene.add(west);
  const east = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  east.position.set(W / 2 - 1.0, 3.1, 1.2);
  scene.add(east);
  // холодный «дневной» свет, падающий сверху через витражи
  const sky = new THREE.DirectionalLight(0xa8c4e8, 1.2);
  sky.position.set(-6, 14, 4);
  scene.add(sky);
  scene.add(new THREE.AmbientLight(0x8a8296, 1.5));
  scene.add(new THREE.HemisphereLight(0x8fa8c8, 0x3a3228, 1.1));

  /* ---------------- живая жизнь ----------------
   *
   * Раньше храм был «заморожен»: свечи горели ровным пятном, в воздухе
   * не двигалось ничего. Теперь пламя мерцает, свет «дышит», а в лучах
   * от витражей медленно плывут пылинки.
   */
  const flames = [];
  group.traverse((o) => {
    if (o.isMesh && o.material === M.lampGlass) flames.push(o);
  });
  const motes = new Motes(scene, glowTex, 150, 7);

  const exitDoor = { x: 0, y: 1.4, z: -D / 2 + 0.8 };

  return {
    scene, group, colliders, platforms, floors: [], climbs: [],
    spawn: { x: 0, z: -D / 2 + 2.0, yaw: 0 },
    exitDoor,
    name: CHURCH_NAME,
    spots,
    lines: [
      'Под сводом пахнет ладаном и холодным камнем.',
      'В нефе тихо: слышно только собственные шаги и еле слышный звон в башне.',
    ],
    /**
     * Анимация локации: мерцание свечей, «дыхание» света, пылинки в лучах.
     *
     * @param {number} dt кадр в секундах
     * @param {number} t мировое время
     */
    update(dt, t) {
      const flick = 0.86 + Math.sin(t * 6.3) * 0.07 + Math.sin(t * 11.7) * 0.05
        + Math.sin(t * 17.1) * 0.03;
      altar.intensity = 16 * flick;
      west.intensity = 11 * (0.94 + Math.sin(t * 0.7 + 1.3) * 0.05);
      east.intensity = 11 * (0.94 + Math.sin(t * 0.6 + 2.1) * 0.05);
      sky.intensity = 1.2 * (0.97 + Math.sin(t * 0.35) * 0.03);
      for (let i = 0; i < flames.length; i++) {
        const f = flames[i];
        const k = 0.82 + Math.sin(t * (5.5 + i * 0.7) + i * 2.1) * 0.12
          + Math.sin(t * (13.3 + i)) * 0.06;
        f.scale.set(k * 0.9, k * 1.25, k * 0.9);
      }
      motes.update(dt, { x: 0, z: 0 });
    },
  };
}
