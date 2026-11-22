/**
 * ============================================================================
 *  ПЕРСОНАЖ: кузнец Торн
 * ============================================================================
 *
 *  Второй торговец деревни. В отличие от бармена-Хорта, который держится
 *  за штуку хлеба и кружку эля, кузнец выглядит так, как и выглядит
 *  человек, который целый день бьёт молотом по металлу:
 *
 *  * широкие плечи и тяжёлая шея — силуэт «вкопанного» в землю;
 *  * кожаный фартук, закатанные рукава, перевязь через плечо;
 *  * широкий обширный череп, низкий лоб, мощные надбровные дуги;
 *  * маленькие глубоко посаженные глаза под сдвинутыми бровями;
 *  * шрам через левую бровь — «наследие» ремесла;
 *  * рыжая борода до груди, собранная в три клока;
 *  * в правой руке молот, в левой — клещи.
 *
 *  Стиль тот же низкополигональный, что и у остальной деревни: только
 *  примитивы, никаких внешних файлов.
 *
 *  @module world/blacksmith
 */

import * as THREE from 'three';
import { sphere, cone, cyl, box, torus } from './geo.js';

/* ------------------------------------------------------------------
 *  Палитра
 * ------------------------------------------------------------------ */
const PALETTE = {
  skin: 0xbd8256,
  skinShade: 0x98653f,
  skinLight: 0xe0aa80,
  hair: 0x3a2a1c,
  beard: 0x74481f,
  beardDark: 0x593415,
  shirt: 0x6d6a52,        // грубая холщовая рубаха
  shirtShade: 0x55533f,
  leather: 0x6b4526,      // фартук
  leatherDark: 0x4c3019,
  leatherLight: 0x8a5f37,
  trousers: 0x4a4034,
  boots: 0x2f251c,
  steel: 0x9aa0a6,
  steelDark: 0x5d6469,
  wood: 0x7a5636,
  eyeWhite: 0xe8e0d2,
  iris: 0x4a5f4a,
  dark: 0x1a120c,
};

/** Материал из палитры. */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.02, ...opts });
}

/** Меш с позицией и поворотом. */
function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Модель кузнеца.
 *
 * @returns {{group: THREE.Group, update: Function, hammer: THREE.Group}}
 */
export function blacksmith() {
  const M = {
    skin: mat(PALETTE.skin),
    skinShade: mat(PALETTE.skinShade),
    skinLight: mat(PALETTE.skinLight),
    hair: mat(PALETTE.hair),
    beard: mat(PALETTE.beard),
    beardDark: mat(PALETTE.beardDark),
    shirt: mat(PALETTE.shirt),
    shirtShade: mat(PALETTE.shirtShade),
    leather: mat(PALETTE.leather),
    leatherDark: mat(PALETTE.leatherDark),
    leatherLight: mat(PALETTE.leatherLight),
    trousers: mat(PALETTE.trousers),
    boots: mat(PALETTE.boots),
    steel: mat(PALETTE.steel, { metalness: 0.72, roughness: 0.34 }),
    steelDark: mat(PALETTE.steelDark, { metalness: 0.6, roughness: 0.45 }),
    wood: mat(PALETTE.wood),
    eyeWhite: mat(PALETTE.eyeWhite, { roughness: 0.6 }),
    iris: mat(PALETTE.iris, { roughness: 0.5 }),
    dark: mat(PALETTE.dark, { roughness: 0.9 }),
  };

  const root = new THREE.Group();
  root.name = 'blacksmith';

  /* ================================================================
   *  ТАЗ И НОГИ
   * ================================================================ */
  const hips = new THREE.Group();
  hips.position.y = 0.84;
  root.add(hips);
  hips.add(mesh(box(0.38, 0.22, 0.27), M.trousers, 0, 0.02, 0));

  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.125, 0, 0);
    hips.add(leg);
    leg.add(mesh(cyl(0.115, 0.1, 0.4, 10), M.trousers, 0, -0.2, 0));
    const knee = new THREE.Group();
    knee.position.set(0, -0.4, 0);
    leg.add(knee);
    knee.add(mesh(cyl(0.1, 0.082, 0.36, 10), M.trousers, 0, -0.18, 0));
    knee.add(mesh(cyl(0.088, 0.084, 0.05, 10), M.leatherDark, 0, -0.34, 0));
    const boot = new THREE.Group();
    boot.position.set(0, -0.38, 0);
    knee.add(boot);
    boot.add(mesh(cyl(0.104, 0.1, 0.2, 10), M.boots, 0, 0.05, 0));
    boot.add(mesh(box(0.185, 0.11, 0.3), M.boots, 0, -0.05, 0.045));
    boot.add(mesh(box(0.2, 0.035, 0.32), M.dark, 0, -0.105, 0.05));
    leg.userData.knee = knee;
    leg.userData.boot = boot;
    legs.push(leg);
  }

  /* ================================================================
   *  ТОРС — широкий, разворачивает плечи
   * ================================================================ */
  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);
  hips.add(torso);

  const belly = mesh(cyl(0.27, 0.235, 0.26, 12), M.shirt, 0, 0.12, 0);
  belly.scale.set(1, 1, 0.62);
  torso.add(belly);

  const chest = new THREE.Group();
  chest.position.set(0, 0.25, 0);
  torso.add(chest);

  chest.add(mesh(box(0.58, 0.34, 0.31), M.shirt, 0, 0.16, 0));
  const shoulders = [];
  for (const sx of [-1, 1]) {
    const sh = mesh(sphere(0.15, 12, 9), M.shirt, sx * 0.29, 0.27, 0);
    sh.scale.set(0.92, 0.62, 0.85);
    chest.add(sh);
    shoulders.push(sh);
  }
  chest.add(mesh(box(0.66, 0.09, 0.33), M.shirtShade, 0, 0.29, 0.005));
  // толстая шея
  chest.add(mesh(cyl(0.115, 0.13, 0.09, 12), M.shirtShade, 0, 0.33, 0.005));

  /* ---------------- кожаный фартук ---------------- */
  const apron = new THREE.Group();
  apron.position.set(0, 0.04, 0);
  torso.add(apron);
  const bib = mesh(box(0.31, 0.32, 0.04), M.leather, 0, 0.32, 0.165);
  apron.add(bib);
  // заклёпки по краю фартука
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      apron.add(mesh(sphere(0.013, 6, 5), M.steelDark, sx * 0.135, 0.2 + i * 0.1, 0.187));
    }
  }
  const skirt = mesh(box(0.58, 0.5, 0.04), M.leather, 0, -0.05, 0.185);
  skirt.rotation.x = -0.05;
  apron.add(skirt);
  apron.add(mesh(box(0.6, 0.07, 0.05), M.leatherDark, 0, -0.29, 0.185));
  // пояс с пряжкой
  apron.add(mesh(box(0.62, 0.08, 0.38), M.leatherDark, 0, 0.12, 0.13));
  apron.add(mesh(box(0.1, 0.1, 0.055), M.steelDark, 0.17, 0.12, 0.2));
  // перевязь через правое плечо
  const strap = mesh(box(0.075, 0.62, 0.04), M.leatherDark, 0.16, 0.34, 0.02);
  strap.rotation.z = -0.34;
  apron.add(strap);
  const strapBack = mesh(box(0.075, 0.62, 0.04), M.leatherDark, 0.16, 0.34, -0.14);
  strapBack.rotation.z = -0.34;
  apron.add(strapBack);
  // кожаный фартук с заклёпкой — там, где раньше была латунная табличка
  apron.add(mesh(box(0.085, 0.035, 0.014), M.steelDark, 0, 0.36, 0.187));

  /* ================================================================
   *  РУКИ — закатанные рукава, голые предплечья
   * ================================================================ */
  const arms = [];
  const hands = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.275, 0.25, 0);
    chest.add(arm);
    // рукав до середины бицепса
    arm.add(mesh(cyl(0.105, 0.095, 0.2, 10), M.shirt, 0, -0.1, 0));
    // валик закатанного рукава
    const cuff = mesh(cyl(0.108, 0.108, 0.06, 10), M.shirtShade, 0, -0.2, 0);
    arm.add(cuff);
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.22, 0);
    arm.add(elbow);
    // голое предплечье — закатанные рукава
    elbow.add(mesh(cyl(0.082, 0.07, 0.24, 10), M.skin, 0, -0.12, 0));
    // волосы на предплечье
    const hairPatch = mesh(box(0.1, 0.05, 0.09), M.hair, 0, -0.13, 0.012);
    elbow.add(hairPatch);
    const hand = new THREE.Group();
    hand.position.set(0, -0.27, 0);
    elbow.add(hand);
    const palm = mesh(sphere(0.058, 10, 8), M.skin, 0, -0.03, 0);
    palm.scale.set(1, 1.05, 0.8);
    hand.add(palm);
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * 0.023;
      const finger = mesh(cyl(0.012, 0.01, 0.058, 6), M.skin, fx, -0.078, 0.006);
      finger.rotation.x = -0.5;
      hand.add(finger);
    }
    const thumb = mesh(cyl(0.013, 0.011, 0.052, 6), M.skin, sx * 0.046, -0.048, 0.014);
    thumb.rotation.z = sx * 0.7;
    thumb.rotation.x = -0.3;
    hand.add(thumb);
    arm.userData.elbow = elbow;
    arm.userData.hand = hand;
    arms.push(arm);
    hands.push(hand);
  }

  /* ---------------- молот в правой руке ---------------- */
  const hammer = new THREE.Group();
  hammer.position.set(0, -0.075, 0.02);
  hammer.rotation.x = -0.5;
  hands[1].add(hammer);
  // рукоять
  hammer.add(mesh(cyl(0.019, 0.022, 0.34, 8), M.wood, 0, 0.02, 0));
  // набалдашник-наковальня
  const hammerHead = mesh(box(0.15, 0.075, 0.075), M.steelDark, 0, 0.2, 0);
  hammerHead.rotation.y = 0.2;
  hammer.add(hammerHead);
  hammer.add(mesh(box(0.05, 0.05, 0.05), M.steel, 0.085, 0.2, 0));

  /* ---------------- клещи в левой руке ---------------- */
  const tongs = new THREE.Group();
  tongs.position.set(0, -0.06, 0.02);
  tongs.rotation.x = -0.35;
  hands[0].add(tongs);
  for (const sx of [-1, 1]) {
    const armT = mesh(box(0.022, 0.26, 0.022), M.steelDark, sx * 0.018, 0.02, 0);
    armT.rotation.z = sx * 0.09;
    tongs.add(armT);
  }
  tongs.add(mesh(cyl(0.024, 0.024, 0.03, 8), M.steel, 0, 0.15, 0));

  /* ================================================================
   *  ГОЛОВА — широкий череп, тяжёлая челюсть, сдвинутые брови
   * ================================================================ */
  const neck = new THREE.Group();
  neck.position.set(0, 0.33, 0.005);
  chest.add(neck);
  neck.add(mesh(cyl(0.1, 0.115, 0.12, 12), M.skin, 0, 0.015, 0));

  const head = new THREE.Group();
  head.position.set(0, 0.11, 0.005);
  neck.add(head);

  // череп — широкий и низкий, «вбитый в плечи»
  const skull = mesh(sphere(0.152, 16, 12), M.skin, 0, 0.105, 0);
  skull.scale.set(1.1, 0.94, 0.96);
  head.add(skull);
  const back = mesh(sphere(0.126, 12, 9), M.skin, 0, 0.08, -0.052);
  back.scale.set(1, 0.9, 0.85);
  head.add(back);
  // челюсть — тяжёлая, широкая
  const jaw = mesh(sphere(0.115, 12, 9), M.skin, 0, 0.032, 0.042);
  jaw.scale.set(1.06, 0.76, 0.95);
  head.add(jaw);
  // широкий нос
  const noseBridge = mesh(cone(0.044, 0.12, 8), M.skin, 0, 0.115, 0.12);
  noseBridge.rotation.x = Math.PI / 2;
  noseBridge.scale.set(1, 1, 0.92);
  head.add(noseBridge);
  const noseTip = mesh(sphere(0.036, 10, 8), M.skinLight, 0, 0.092, 0.15);
  noseTip.scale.set(1.15, 0.9, 1);
  head.add(noseTip);
  // уши
  for (const sx of [-1, 1]) {
    const ear = mesh(sphere(0.04, 10, 8), M.skin, sx * 0.16, 0.085, -0.012);
    ear.scale.set(0.34, 1.0, 0.72);
    head.add(ear);
  }
  // надбровные дуги — тяжёлые кости
  for (const sx of [-1, 1]) {
    const ridge = mesh(box(0.13, 0.05, 0.07), M.skinShade, sx * 0.062, 0.168, 0.1);
    ridge.rotation.z = sx * 0.2;
    head.add(ridge);
  }
  // глаза — маленькие, глубоко посаженные
  const eyes = [];
  for (const sx of [-1, 1]) {
    const white = mesh(sphere(0.036, 12, 10), M.eyeWhite, sx * 0.055, 0.125, 0.1);
    white.scale.set(1, 0.88, 0.7);
    head.add(white);
    const iris = mesh(sphere(0.019, 10, 8), M.iris, sx * 0.055, 0.123, 0.116);
    iris.scale.set(1, 1, 0.55);
    head.add(iris);
    const pupil = mesh(sphere(0.009, 8, 6), M.dark, sx * 0.055, 0.123, 0.123);
    pupil.scale.set(1, 1, 0.5);
    head.add(pupil);
    // веко
    const lid = mesh(sphere(0.038, 12, 10), M.skin, sx * 0.055, 0.152, 0.1);
    lid.scale.set(1, 0.3, 0.72);
    head.add(lid);
    eyes.push(lid);
    // брови — сдвинуты к переносице: сердитый прищур
    const brow = mesh(box(0.095, 0.03, 0.038), M.hair, sx * 0.052, 0.178, 0.118);
    brow.rotation.z = sx * -0.28;
    head.add(brow);
  }
  // шрам через левую бровь
  const scar = mesh(box(0.016, 0.085, 0.02), M.skinLight, -0.078, 0.152, 0.113);
  scar.rotation.z = 0.5;
  head.add(scar);

  /* ---------------- борода ---------------- */
  // подбородок и челюсть
  const chin = mesh(sphere(0.096, 14, 11), M.beard, 0, 0.0, 0.045);
  chin.scale.set(0.9, 0.58, 0.72);
  head.add(chin);
  // боковые пряди
  for (const sx of [-1, 1]) {
    const side = mesh(sphere(0.06, 10, 8), M.beard, sx * 0.078, 0.03, 0.05);
    side.scale.set(0.8, 0.92, 0.78);
    head.add(side);
  }
  // три клока борды, свисающих на грудь
  const tufts = new THREE.Group();
  tufts.position.set(0, -0.02, 0.07);
  head.add(tufts);
  const tuftDefs = [
    { x: 0, y: -0.05, len: 0.2, r: 0.045, col: M.beard },
    { x: -0.05, y: -0.045, len: 0.17, r: 0.038, col: M.beardDark },
    { x: 0.05, y: -0.04, len: 0.16, r: 0.036, col: M.beard },
  ];
  for (const td of tuftDefs) {
    const t = mesh(cone(td.r, td.len, 7), td.col, td.x, td.y - td.len / 2, 0);
    t.rotation.x = 0.12;
    tufts.add(t);
  }
  // усы — широкие, опущенные
  for (const sx of [-1, 1]) {
    const moustache = mesh(box(0.07, 0.026, 0.034), M.beardDark, sx * 0.042, 0.096, 0.142);
    moustache.rotation.y = sx * 0.4;
    moustache.rotation.z = sx * 0.24;
    head.add(moustache);
  }
  // сжатая в кулак челюсть — рот почти не виден
  const mouth = mesh(box(0.07, 0.014, 0.022), M.dark, 0, 0.062, 0.128);
  head.add(mouth);
  const lip = mesh(box(0.086, 0.014, 0.018), M.skinShade, 0, 0.048, 0.126);
  head.add(lip);

  /* ================================================================
   *  АНИМАЦИЯ
   * ================================================================ */
  let phase = 0;
  let breath = 0;
  let blinkTimer = 1.2 + Math.random() * 3;
  let blink = 0;
  let sway = 0;

  /**
   * Анимация кузнеца.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t мировое время
   * @param {object} st состояние { speed, moving, talking, lookYaw }
   */
  function update(dt, t, st = {}) {
    const moving = !!st.moving;
    const speed = st.speed || 0;
    const talking = !!st.talking;

    phase += dt * (moving ? speed * 2.6 : 1.1);
    breath += dt * 1.6;

    // дыхание
    const bs = 1 + Math.sin(breath) * 0.012;
    chest.scale.set(bs, 1 + Math.sin(breath) * 0.008, bs);
    head.position.y = 0.11 + Math.sin(breath + 1) * 0.006;

    // шаг
    const sw = Math.sin(phase);
    if (moving) {
      legs[0].rotation.x = sw * 0.55 * Math.min(1, speed);
      legs[1].rotation.x = -sw * 0.55 * Math.min(1, speed);
      legs[0].userData.knee.rotation.x = Math.max(0, -sw) * 0.5;
      legs[1].userData.knee.rotation.x = Math.max(0, sw) * 0.5;
      arms[0].rotation.x = -sw * 0.32;
      arms[1].rotation.x = sw * 0.2;
    } else {
      for (const l of legs) {
        l.rotation.x *= 0.86;
        l.userData.knee.rotation.x *= 0.86;
      }
      arms[0].rotation.x *= 0.86;
      arms[1].rotation.x *= 0.86;
    }

    // покачивание молота: кузнец вечно готов вернуться к наковальне
    sway += dt * 0.9;
    hammer.rotation.z = Math.sin(sway) * 0.12;
    hammer.rotation.x = -0.5 + Math.sin(sway * 1.3) * 0.08;
    tongs.rotation.z = Math.sin(sway + 1.4) * 0.09;

    // разговор: жест рукой
    if (talking) {
      arms[1].rotation.x = -0.55 + Math.sin(t * 5.5) * 0.16;
      arms[1].rotation.z = 0.18 + Math.sin(t * 4.1) * 0.1;
      head.rotation.y = Math.sin(t * 1.7) * 0.12;
    } else {
      arms[1].rotation.z *= 0.9;
      head.rotation.y *= 0.92;
    }
    // взгляд на игрока
    if (typeof st.lookYaw === 'number') {
      head.rotation.y = Math.max(-0.6, Math.min(0.6, st.lookYaw * 0.5));
    }

    // моргание
    blinkTimer -= dt;
    if (blinkTimer <= 0) { blink = 0.16; blinkTimer = 2.2 + Math.random() * 3.4; }
    if (blink > 0) {
      blink -= dt;
      const k = Math.max(0.06, Math.abs(Math.sin((blink / 0.16) * Math.PI)) * 0.32);
      for (const lid of eyes) lid.scale.y = k;
    } else {
      for (const lid of eyes) lid.scale.y = 0.3;
    }
  }

  return { group: root, update, hammer, head };
}

/* ------------------------------------------------------------------
 *  Портрет для диалога
 * ------------------------------------------------------------------ */

/**
 * Портрет кузнеца для окна диалога.
 *
 * @param {number} px сторона квадрата
 * @returns {HTMLCanvasElement|null}
 */
export function blacksmithIcon(px = 96) {
  if (typeof document === 'undefined') return null;
  const size = Math.max(24, Math.round(px || 96));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  const u = size / 96;

  // фон — холодный свет от горна
  const bg = c.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#3a2a20');
  bg.addColorStop(1, '#160f0b');
  c.fillStyle = bg;
  c.fillRect(0, 0, size, size);
  const glow = c.createRadialGradient(size * 0.62, size * 0.78, 2, size * 0.55, size * 0.55, size * 0.8);
  glow.addColorStop(0, 'rgba(255,120,40,.26)');
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, size, size);

  /* ---- плечи: грубая рубаха и кожаный фартук ---- */
  c.fillStyle = '#6d6a52';
  c.beginPath();
  c.moveTo(6 * u, size);
  c.quadraticCurveTo(12 * u, 60 * u, 48 * u, 58 * u);
  c.quadraticCurveTo(84 * u, 60 * u, 90 * u, size);
  c.closePath();
  c.fill();
  // фартук
  c.fillStyle = '#6b4526';
  c.beginPath();
  c.moveTo(32 * u, size);
  c.quadraticCurveTo(34 * u, 66 * u, 48 * u, 65 * u);
  c.quadraticCurveTo(62 * u, 66 * u, 64 * u, size);
  c.closePath();
  c.fill();
  // перевязь
  c.strokeStyle = '#4c3019';
  c.lineWidth = 7 * u;
  c.beginPath();
  c.moveTo(66 * u, 58 * u);
  c.lineTo(44 * u, size);
  c.stroke();
  // заклёпка
  c.fillStyle = '#5d6469';
  c.beginPath();
  c.arc(48 * u, 72 * u, 3 * u, 0, Math.PI * 2);
  c.fill();

  /* ---- шея ---- */
  c.fillStyle = '#a46f47';
  c.fillRect(40 * u, 50 * u, 16 * u, 12 * u);

  /* ---- голова: широкая, тяжёлая ---- */
  c.fillStyle = '#c98f63';
  c.beginPath();
  c.ellipse(48 * u, 36 * u, 21 * u, 23 * u, 0, 0, Math.PI * 2);
  c.fill();
  // тень под скулами
  c.fillStyle = 'rgba(140,90,58,.24)';
  c.beginPath();
  c.ellipse(29 * u, 39 * u, 7 * u, 13 * u, 0.2, 0, Math.PI * 2);
  c.ellipse(67 * u, 39 * u, 7 * u, 13 * u, -0.2, 0, Math.PI * 2);
  c.fill();
  // надбровные дуги
  c.fillStyle = 'rgba(150,100,66,.5)';
  c.beginPath();
  c.ellipse(41 * u, 27 * u, 9 * u, 4.5 * u, 0.2, 0, Math.PI * 2);
  c.ellipse(55 * u, 27 * u, 9 * u, 4.5 * u, -0.2, 0, Math.PI * 2);
  c.fill();

  /* ---- уши ---- */
  c.fillStyle = '#a46f47';
  c.beginPath();
  c.ellipse(27 * u, 37 * u, 4 * u, 6 * u, 0, 0, Math.PI * 2);
  c.ellipse(69 * u, 37 * u, 4 * u, 6 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- брови: сдвинуты внутрь ---- */
  c.strokeStyle = '#2f2116';
  c.lineWidth = 4 * u;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(34 * u, 29 * u);
  c.lineTo(44 * u, 31 * u);
  c.moveTo(52 * u, 31 * u);
  c.lineTo(62 * u, 29 * u);
  c.stroke();

  /* ---- глаза ---- */
  c.fillStyle = '#e8e0d2';
  c.beginPath();
  c.ellipse(41 * u, 37 * u, 4.4 * u, 3.4 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37 * u, 4.4 * u, 3.4 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4a5f4a';
  c.beginPath();
  c.ellipse(41 * u, 37.2 * u, 2.2 * u, 2.3 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37.2 * u, 2.2 * u, 2.3 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#14100c';
  c.beginPath();
  c.ellipse(41 * u, 37.2 * u, 1.1 * u, 1.3 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37.2 * u, 1.1 * u, 1.3 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- шрам ---- */
  c.strokeStyle = '#e0aa80';
  c.lineWidth = 1.8 * u;
  c.beginPath();
  c.moveTo(31 * u, 24 * u);
  c.lineTo(35 * u, 34 * u);
  c.stroke();

  /* ---- нос широкий ---- */
  c.fillStyle = '#b87f57';
  c.beginPath();
  c.ellipse(48 * u, 42 * u, 5 * u, 3.6 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- борода: массивная, рыжая, клочьями ---- */
  c.fillStyle = '#8a5a2c';
  c.beginPath();
  c.moveTo(30 * u, 42 * u);
  c.quadraticCurveTo(31 * u, 54 * u, 48 * u, 56 * u);
  c.quadraticCurveTo(65 * u, 54 * u, 66 * u, 42 * u);
  c.quadraticCurveTo(60 * u, 46 * u, 48 * u, 46 * u);
  c.quadraticCurveTo(36 * u, 46 * u, 30 * u, 42 * u);
  c.closePath();
  c.fill();
  // клочья
  c.fillStyle = '#6b4320';
  c.beginPath();
  c.moveTo(40 * u, 54 * u);
  c.lineTo(44 * u, 54 * u);
  c.lineTo(41 * u, 74 * u);
  c.closePath();
  c.fill();
  c.fillStyle = '#8a5a2c';
  c.beginPath();
  c.moveTo(50 * u, 55 * u);
  c.lineTo(55 * u, 54 * u);
  c.lineTo(54 * u, 72 * u);
  c.closePath();
  c.fill();
  // усы
  c.fillStyle = '#6b4320';
  c.beginPath();
  c.ellipse(40 * u, 45 * u, 8 * u, 2.6 * u, 0.25, 0, Math.PI * 2);
  c.ellipse(56 * u, 45 * u, 8 * u, 2.6 * u, -0.25, 0, Math.PI * 2);
  c.fill();
  // рот — узкая, сжатая
  c.fillStyle = '#3a2418';
  c.fillRect(44 * u, 49 * u, 8 * u, 2 * u);

  return canvas;
}
