/**
 * ============================================================================
 *  ПОДЗЕМЕЛЬЕ: пещера под Шёпот-Долиной
 * ============================================================================
 *
 *  Отдельная сцена, как амбар и таверна: своя геометрия, свой свет,
 *  свои коллайдеры. Атмосфера — мрачная пещера в духе «Соло левеллинга»:
 *  почти чёрный камень, холодное синее свечение кристаллов, плотный
 *  туман у пола и огромный синий самоцвет в глубине, у «Врат».
 *
 *  Всё процедурное: стены собраны из скальных панелей, кристаллы —
 *  из конусов и призм, туман — из точек.
 *
 *  @module world/dungeon
 */

import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, mat } from './geo.js';
import { makeGlow } from './props.js';

/** Размеры зала пещеры. */
const W = 26;          // ширина (по X)
const D = 34;          // длина (по Z)
const H = 7.2;         // высота свода

/**
 * Собирает интерьер подземелья.
 *
 * @param {object} M материалы проекта
 * @param {THREE.Texture} glowTex мягкая текстура свечения
 * @returns {{group: THREE.Group, colliders: object, platforms: Array, lights: object,
 *   spawn: object, exit: object, update: Function}} готовая локация
 */
export function buildDungeon(M, glowTex) {
  const group = new THREE.Group();
  group.name = 'dungeon';

  /* ---------------- материалы пещеры ---------------- */
  const rock = new THREE.MeshStandardMaterial({
    map: M.stone.map, color: 0x7c7c8c, roughness: 1.0, metalness: 0.0,
  });
  const rockDark = new THREE.MeshStandardMaterial({
    map: M.stone.map, color: 0x54545f, roughness: 1.0,
  });
  const rockWarm = new THREE.MeshStandardMaterial({
    map: M.stone.map, color: 0x6a6180, roughness: 1.0,
  });
  const crystal = new THREE.MeshStandardMaterial({
    color: 0x2b58c8, emissive: 0x3f74ff, emissiveIntensity: 2.6, roughness: 0.22, metalness: 0.1,
  });
  const crystalViolet = new THREE.MeshStandardMaterial({
    color: 0x5a3fb0, emissive: 0x7a4fff, emissiveIntensity: 2.2, roughness: 0.25, metalness: 0.1,
  });

  const colliders = { boxes: [], circles: [] };
  const platforms = [];
  const lights = {};

  /* ---------------- простой генератор шума ---------------- */
  let seed = 918273;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const rr = (a, b) => a + (b - a) * rnd();

  /* ================================================================
   *  ПОЛ
   * ================================================================ */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D, 1, 1),
    new THREE.MeshStandardMaterial({ map: M.stone.map, color: 0x606070, roughness: 0.85, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // мелкие камни и бугры на полу
  const rubble = new Builder();
  for (let i = 0; i < 90; i++) {
    const x = rr(-W / 2 + 1, W / 2 - 1);
    const z = rr(-D / 2 + 1, D / 2 - 1);
    const s = rr(0.12, 0.5);
    rubble.add(sphere(s, 6, 4), rnd() > 0.5 ? 'rock' : 'rockDark', mat(x, s * 0.35, z));
  }
  // редкие «грибные» наросты и обломки
  for (let i = 0; i < 18; i++) {
    const x = rr(-W / 2 + 1.5, W / 2 - 1.5);
    const z = rr(-D / 2 + 1.5, D / 2 - 1.5);
    rubble.add(cone(rr(0.1, 0.22), rr(0.3, 0.7), 6), 'rockDark', mat(x, 0.25, z));
  }
  group.add(rubble.build({ rock: rock, rockDark: rockDark }, null, { name: 'dungeonRubble' }));

  /* ================================================================
   *  СКАЛЬНЫЕ СТЕНЫ
   *
   *  Стены собраны из панелей: каждая чуть повёрнута и смещена,
   *  поэтому поверхность получается неровной, как настоящий камень.
   * ================================================================ */
  const walls = new Builder();
  const wallH = H - 0.6;
  /** Одна панель стены с наклоном. */
  const panel = (x, y, z, w, h, d, ry, rz, key) => {
    const g = box(w, h, d, 1.2);
    const m = mat(x, y, z, ry, 0, rz);
    walls.add(g, key, m);
  };
  // северная и южная стены (по X)
  for (const sz of [-1, 1]) {
    const z = sz * (D / 2 - 0.4);
    for (let i = 0; i < 9; i++) {
      const x = -W / 2 + 1.6 + i * ((W - 3.2) / 8);
      panel(x, wallH / 2 + 0.1, z + rr(-0.25, 0.25), 3.1, wallH, 0.9, rr(-0.05, 0.05), rr(-0.04, 0.04),
        rnd() > 0.55 ? 'rockWarm' : 'rock');
    }
  }
  // западная и восточная стены (по Z)
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.4);
    for (let i = 0; i < 11; i++) {
      const z = -D / 2 + 1.6 + i * ((D - 3.2) / 10);
      panel(x + rr(-0.25, 0.25), wallH / 2 + 0.1, z, 0.9, wallH, 3.2, rr(-0.05, 0.05), rr(-0.04, 0.04),
        rnd() > 0.55 ? 'rockWarm' : 'rock');
    }
  }
  group.add(walls.build({ rock, rockDark, rockWarm }, null, { name: 'dungeonWalls' }));

  // коллайдеры стен
  colliders.boxes.push({ cx: 0, cz: -D / 2 + 0.2, hx: W / 2 + 1, hz: 0.7, ang: 0, y0: 0, y1: H });
  colliders.boxes.push({ cx: 0, cz: D / 2 - 0.2, hx: W / 2 + 1, hz: 0.7, ang: 0, y0: 0, y1: H });
  colliders.boxes.push({ cx: -W / 2 + 0.2, cz: 0, hx: 0.7, hz: D / 2 + 1, ang: 0, y0: 0, y1: H });
  colliders.boxes.push({ cx: W / 2 - 0.2, cz: 0, hx: 0.7, hz: D / 2 + 1, ang: 0, y0: 0, y1: H });

  /* ================================================================
   *  СВОД
   * ================================================================ */
  const ceil = new Builder();
  for (const sz of [-1, 1]) {
    // панель шире зала: наклон не оставляет щелей у стен
    const g = box(W + 6, 0.9, D / 2 + 3.4, 1.4);
    const m = mat(0, H + 1.55, sz * (D / 4), 0, sz * 0.55, 0);
    ceil.add(g, 'rockDark', m);
  }
  // тёмный конёк свода вдоль оси зала
  ceil.add(box(1.6, 1.0, D + 2, 1.4), 'rockDark', mat(0, H + 2.35, 0));
  group.add(ceil.build({ rockDark }, null, { name: 'dungeonCeiling' }));

  /* ================================================================
   *  КРИСТАЛЛЫ — холодное синее свечение
   * ================================================================ */
  const crystals = new Builder();
  const glowSprites = [];
  let lightBudget = 7;

  /**
   * Врастает кристалл в стену/пол: конус + призматический стержень.
   *
   * @param {number} x где
   * @param {number} y высота
   * @param {number} z где
   * @param {number} s размер
   * @param {number} ry поворот
   * @param {number} rz наклон
   * @param {boolean} violet фиолетовый ли
   * @param {boolean} lit даёт ли свет
   */
  const addCrystal = (x, y, z, s, ry, rz, violet, lit) => {
    const key = violet ? 'violet' : 'blue';
    // основной стержень
    crystals.add(cone(s, s * 3.1, 6), key, mat(x, y, z, ry, 0, rz));
    // боковые осколки
    for (let i = 0; i < 2; i++) {
      const m = mat(x, y, z, ry + rr(-0.4, 0.4), 0, rz + rr(-0.25, 0.25));
      m.multiply(new THREE.Matrix4().makeTranslation(rr(-0.1, 0.1), rr(-0.3, 0.3), rr(-0.1, 0.1)));
      crystals.add(cone(s * 0.45, s * 1.6, 5), key, m);
    }
    // мягкое свечение вокруг
    const g = makeGlow(glowTex, s * 4.2, violet ? 0x9a7fff : 0x7fb0ff, 0.32);
    g.position.set(x, y, z);
    group.add(g);
    glowSprites.push(g);
    if (lit && lightBudget > 0) {
      lightBudget--;
      const l = new THREE.PointLight(violet ? 0x7a5cff : 0x5c8cff, 2.1, 13, 1.9);
      l.position.set(x, y, z);
      group.add(l);
    }
  };

  // кристаллы по стенам
  for (let i = 0; i < 16; i++) {
    const side = Math.floor(rnd() * 4);
    const s = rr(0.16, 0.34);
    if (side === 0) addCrystal(rr(-W / 2 + 2, W / 2 - 2), rr(1.1, 3.6), -D / 2 + 0.75, s, 0, rr(-0.3, 0.3), rnd() > 0.7, true);
    else if (side === 1) addCrystal(rr(-W / 2 + 2, W / 2 - 2), rr(1.1, 3.6), D / 2 - 0.75, s, 0, rr(-0.3, 0.3), rnd() > 0.7, true);
    else if (side === 2) addCrystal(-W / 2 + 0.75, rr(1.1, 3.6), rr(-D / 2 + 2, D / 2 - 2), s, Math.PI / 2, rr(-0.3, 0.3), rnd() > 0.7, true);
    else addCrystal(W / 2 - 0.75, rr(1.1, 3.6), rr(-D / 2 + 2, D / 2 - 2), s, Math.PI / 2, rr(-0.3, 0.3), rnd() > 0.7, true);
  }
  // кристаллы на полу (вросшие) и под сводом (свисающие)
  for (let i = 0; i < 10; i++) {
    const x = rr(-W / 2 + 2, W / 2 - 2), z = rr(-D / 2 + 2, D / 2 - 2);
    const s = rr(0.18, 0.4);
    const m = mat(x, s * 1.4, z, rr(0, 6.28), 0, rr(-0.18, 0.18));
    crystals.add(cone(s, s * 3.2, 6), rnd() > 0.75 ? 'violet' : 'blue', m);
    const g = makeGlow(glowTex, s * 4, rnd() > 0.75 ? 0x9a7fff : 0x7fb0ff, 0.3);
    g.position.set(x, s * 1.6, z);
    group.add(g);
    glowSprites.push(g);
    if (lightBudget > 0 && i % 2 === 0) {
      lightBudget--;
      const l = new THREE.PointLight(0x5c8cff, 1.5, 11, 1.9);
      l.position.set(x, s * 1.8, z);
      group.add(l);
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = rr(-W / 2 + 2, W / 2 - 2), z = rr(-D / 2 + 2, D / 2 - 2);
    const s = rr(0.14, 0.3);
    crystals.add(cone(s, s * 2.6, 6), 'blue', mat(x, H + 0.4, z, rr(0, 6.28), Math.PI, rr(-0.15, 0.15)));
  }
  group.add(crystals.build({ blue: crystal, violet: crystalViolet }, null, { name: 'dungeonCrystals' }));

  /* ================================================================
   *  СТАЛАКТИТЫ И СТАЛАГМИТЫ
   * ================================================================ */
  const spikes = new Builder();
  for (let i = 0; i < 26; i++) {
    const x = rr(-W / 2 + 1.5, W / 2 - 1.5), z = rr(-D / 2 + 1.5, D / 2 - 1.5);
    const h = rr(0.8, 2.4);
    spikes.add(cone(rr(0.16, 0.34), h, 6), 'rock', mat(x, H - h / 2 + 0.2, z, 0, Math.PI, 0));
  }
  for (let i = 0; i < 18; i++) {
    const x = rr(-W / 2 + 1.5, W / 2 - 1.5), z = rr(-D / 2 + 1.5, D / 2 - 1.5);
    const h = rr(0.5, 1.8);
    spikes.add(cone(rr(0.2, 0.42), h, 6), 'rockDark', mat(x, h / 2, z));
    colliders.circles.push({ x, z, r: 0.4, y0: 0, y1: h });
  }
  group.add(spikes.build({ rock, rockDark }, null, { name: 'dungeonSpikes' }));

  /* ================================================================
   *  КОЛОННЫ И ОБВАЛЫ
   * ================================================================ */
  const pillars = new Builder();
  const pillarSpots = [[-6.5, -6], [6.5, -6], [-6.5, 2], [6.5, 2], [-7.5, 9], [7.5, 9]];
  for (const [px, pz] of pillarSpots) {
    const r = rr(0.75, 1.05);
    pillars.add(cyl(r * 0.9, r, 4.6, 7), 'rock', mat(px, 2.3, pz, rr(0, 3), rr(-0.04, 0.04), rr(-0.04, 0.04)));
    pillars.add(cyl(r * 1.25, r * 1.05, 0.4, 7), 'rockDark', mat(px, 4.75, pz));
    pillars.add(cyl(r * 1.2, r * 1.3, 0.5, 7), 'rockDark', mat(px, 0.25, pz));
    colliders.circles.push({ x: px, z: pz, r: r + 0.25, y0: 0, y1: 5 });
  }
  // обвалы у стен
  for (let i = 0; i < 10; i++) {
    const sx = rnd() > 0.5 ? 1 : -1;
    const px = sx * rr(W / 2 - 2.2, W / 2 - 0.9);
    const pz = rr(-D / 2 + 2, D / 2 - 2);
    const s = rr(0.7, 1.5);
    pillars.add(sphere(s, 7, 5), 'rockDark', mat(px, s * 0.55, pz));
    colliders.circles.push({ x: px, z: pz, r: s * 0.9, y0: 0, y1: s * 1.2 });
  }
  group.add(pillars.build({ rock, rockDark }, null, { name: 'dungeonPillars' }));

  /* ================================================================
   *  ВРАТА: алтарь с гигантским кристаллом в глубине
   * ================================================================ */
  const altar = new Builder();
  const az = D / 2 - 3.2;
  altar.add(cyl(3.4, 3.9, 0.6, 9), 'rockDark', mat(0, 0.3, az));
  altar.add(cyl(2.2, 2.6, 0.5, 9), 'rock', mat(0, 0.8, az));
  // скала-алтарь за кристаллом
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    altar.add(sphere(rr(1.3, 2.0), 7, 5), 'rockWarm',
      mat(Math.cos(a) * 3.2, rr(0.8, 1.6), az + Math.sin(a) * 2.2, rr(0, 3), rr(-0.2, 0.2), rr(-0.2, 0.2)));
  }
  group.add(altar.build({ rock, rockDark, rockWarm }, null, { name: 'dungeonAltar' }));
  // огромный кристалл Врат
  const gateCrystal = new THREE.Group();
  gateCrystal.position.set(0, 1.05, az);
  const gc = new THREE.Mesh(cone(1.5, 6.2, 7), crystalViolet);
  gc.position.y = 3.1;
  gateCrystal.add(gc);
  const gc2 = new THREE.Mesh(cone(0.7, 3.1, 6), crystal);
  gc2.position.set(1.5, 1.6, 0.4);
  gc2.rotation.z = -0.32;
  gateCrystal.add(gc2);
  const gc3 = new THREE.Mesh(cone(0.6, 2.6, 6), crystal);
  gc3.position.set(-1.6, 1.3, 0.3);
  gc3.rotation.z = 0.36;
  gateCrystal.add(gc3);
  group.add(gateCrystal);
  const gateGlow = makeGlow(glowTex, 11, 0x8a6cff, 0.5);
  gateGlow.position.set(0, 3.2, az);
  group.add(gateGlow);
  const gateLight = new THREE.PointLight(0x6a6aff, 6.0, 32, 1.6);
  gateLight.position.set(0, 3.4, az);
  group.add(gateLight);
  lights.gate = gateLight;
  // подсветка цоколя Врат
  const gateFoot = new THREE.PointLight(0x8a6cff, 2.4, 14, 1.8);
  gateFoot.position.set(0, 0.7, az - 1.4);
  group.add(gateFoot);

  // осколки кристалла вокруг алтаря
  const shards = new Builder();
  for (let i = 0; i < 22; i++) {
    const a = rr(0, 6.28), r = rr(1.6, 4.2);
    shards.add(cone(rr(0.08, 0.2), rr(0.4, 1.1), 5), rnd() > 0.5 ? 'blue' : 'violet',
      mat(Math.cos(a) * r, 0.3, az + Math.sin(a) * r * 0.7, rr(0, 6.28), rr(-1.4, 1.4), rr(-1.4, 1.4)));
  }
  group.add(shards.build({ blue: crystal, violet: crystalViolet }, null, { name: 'dungeonShards' }));

  // холодные «маяки» вдоль стен — чтобы камень читался
  for (const [mx, mz] of [[-9.5, -8], [9.5, -8], [-9.5, 6], [9.5, 6]]) {
    const l = new THREE.PointLight(0x4a72e0, 2.0, 17, 1.7);
    l.position.set(mx, 2.4, mz);
    group.add(l);
    const g = makeGlow(glowTex, 2.4, 0x6f96ff, 0.3);
    g.position.set(mx, 2.4, mz);
    group.add(g);
  }

  /* ================================================================
   *  ПОРТАЛ НАВЕРХ: лестница и светящаяся арка у входа
   * ================================================================ */
  const pz = -D / 2 + 1.6;
  const portal = new Builder();
  for (let i = 0; i < 6; i++) {
    portal.add(box(3.2, 0.3, 0.75), 'rockDark', mat(0, 0.15 + i * 0.3, pz - i * 0.62));
    platforms.push({ x: 0, z: pz - i * 0.62, y: 0.3 + i * 0.3, hw: 1.6, hd: 0.4 });
  }
  // арка-портал
  for (const sx of [-1, 1]) {
    portal.add(box(0.5, 3.2, 0.8), 'rock', mat(sx * 1.75, 1.6, pz - 3.6));
  }
  portal.add(box(4.2, 0.6, 0.9), 'rock', mat(0, 3.3, pz - 3.6));
  group.add(portal.build({ rock, rockDark }, null, { name: 'dungeonPortal' }));
  const portalGlow = makeGlow(glowTex, 4.6, 0xbcd8ff, 0.55);
  portalGlow.position.set(0, 1.9, pz - 3.6);
  group.add(portalGlow);
  const portalLight = new THREE.PointLight(0xa8c8ff, 2.2, 16, 1.8);
  portalLight.position.set(0, 2.2, pz - 3.4);
  group.add(portalLight);
  lights.portal = portalLight;
  colliders.boxes.push({ cx: 0, cz: pz - 3.9, hx: 2.3, hz: 0.5, ang: 0, y0: 0, y1: 3.6 });

  /* ================================================================
   *  ТУМАН У ПОЛА
   *
   *  Не «светящиеся шарики», а мягкая дымка: своя текстура с
   *  радиальным градиентом, обычное смешивание и низкая прозрачность.
   * ================================================================ */
  const smokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  })();

  const FOG_N = 620;
  const fogPos = new Float32Array(FOG_N * 3);
  const fogSeed = new Float32Array(FOG_N);
  for (let i = 0; i < FOG_N; i++) {
    fogPos[i * 3] = rr(-W / 2 + 1, W / 2 - 1);
    fogPos[i * 3 + 1] = rr(0.05, 1.05);
    fogPos[i * 3 + 2] = rr(-D / 2 + 1, D / 2 - 1);
    fogSeed[i] = rnd() * 100;
  }
  const fogGeo = new THREE.BufferGeometry();
  fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPos, 3));
  const fogMat = new THREE.PointsMaterial({
    map: smokeTex, color: 0x6f86c8, size: 3.4, sizeAttenuation: true,
    transparent: true, opacity: 0.05, depthWrite: false,
  });
  const fogPoints = new THREE.Points(fogGeo, fogMat);
  group.add(fogPoints);

  /* ================================================================
   *  ОСВЕЩЕНИЕ
   * ================================================================ */
  const amb = new THREE.AmbientLight(0x44538f, 2.3);
  group.add(amb);
  lights.ambient = amb;
  const hemi = new THREE.HemisphereLight(0x6a80c8, 0x1b2238, 1.6);
  group.add(hemi);
  lights.hemi = hemi;
  // холодный «отражённый» свет снизу — от кристаллов и мокрого камня
  // холодный «луч» сверху-сбоку — объём читается, тени не проваливаются
  const key = new THREE.DirectionalLight(0x8fa8ff, 0.75);
  key.position.set(-9, 14, 7);
  group.add(key);
  lights.key = key;
  const bounce = new THREE.PointLight(0x4a6bd8, 1.6, 34, 1.5);
  bounce.position.set(0, 0.9, 2);
  group.add(bounce);
  lights.bounce = bounce;

  /* ---------------- точки для осмотра ---------------- */
  const spots = {
    crystal: new THREE.Vector3(-W / 2 + 3.2, 1.6, -4.0),
    gate: new THREE.Vector3(0, 1.8, az - 2.2),
    pillar: new THREE.Vector3(6.5, 1.6, 2.0),
    fog: new THREE.Vector3(0, 1.4, 6.0),
  };

  /** Точка входа игрока в пещеру (у портала). */
  const spawn = { x: 0, z: pz - 2.2, yaw: 0 };
  /** Точка выхода — у лестницы наверх. */
  const exit = { x: 0, z: pz - 3.0, y: 2.1 };

  /**
   * Анимация локации: туман ползёт, кристаллы пульсируют.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t мировое время
   */
  function update(dt, t) {
    const pos = fogGeo.attributes.position;
    for (let i = 0; i < FOG_N; i++) {
      const s = fogSeed[i];
      let y = pos.getY(i) + dt * (0.06 + (i % 7) * 0.012);
      if (y > 1.15) y = 0.04;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.25 + s) * dt * 0.12);
      pos.setZ(i, pos.getZ(i) + Math.cos(t * 0.2 + s) * dt * 0.1);
    }
    pos.needsUpdate = true;
    const pulse = 2.1 + Math.sin(t * 0.9) * 0.35;
    gateLight.intensity = pulse;
    crystal.emissiveIntensity = 2.6 + Math.sin(t * 1.3) * 0.25;
    crystalViolet.emissiveIntensity = 2.2 + Math.cos(t * 1.1) * 0.25;
    gateCrystal.rotation.y = t * 0.12;
  }

  return {
    group,
    colliders,
    platforms,
    lights,
    spawn,
    exit,
    spots,
    update,
    W,
    D,
    H,
  };
}
