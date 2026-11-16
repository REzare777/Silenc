/**
 * ============================================================================
 *  ПЕРСОНАЖИ: бармен трактира
 * ============================================================================
 *
 *  Всё строится процедурно, в том же низкополигональном стиле, что и
 *  деревня и животные: из примитивов и нескольких материалов, без
 *  внешних файлов (иначе однофайловая сборка станет тяжёлой, а стиль
 *  развалится).
 *
 *  Модель собрана как «марионетка»: у каждой части свой узел-«сустав»
 *  (бёдра, колени, плечи, локти, шея, голова), поэтому персонаж умеет
 *  шагать, дышать, моргать, пить из кружки и жестикулировать в разговоре.
 *
 *  @module world/npc
 */

import * as THREE from 'three';
import { sphere, cone, cyl, box, torus } from './geo.js';

/* ------------------------------------------------------------------
 *  Палитра бармена
 * ------------------------------------------------------------------ */
const PALETTE = {
  skin: 0xdda87a,
  skinShade: 0xc08a5f,
  skinLight: 0xf0c69d,
  hair: 0x4c3422,
  beard: 0xa2703d,
  beardDark: 0x7c5228,
  shirt: 0xdcd2b6,
  shirtShade: 0xb6aa8b,
  vest: 0x6e3b2f,
  vestDark: 0x4d2821,
  apron: 0xe5d8b8,
  apronShade: 0xbfab88,
  trousers: 0x4e4135,
  trousersShade: 0x3b3128,
  boots: 0x2b211a,
  hat: 0x3e382f,
  hatBand: 0x8e3b30,
  pewter: 0xa6a39c,
  eyeWhite: 0xf3ece0,
  iris: 0x4c6d63,
  dark: 0x231b15,
};

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.84, metalness: 0.02, ...opts,
});

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Бармен трактира: грузный другой мужик в фартуке, с бородой и колпаком.
 *
 * Возвращает группу и функцию анимации:
 *
 * ```js
 * const b = barkeep();
 * scene.add(b.group);
 * b.update(dt, t, { speed: 1, moving: true, talking: false });
 * ```
 *
 * @returns {{group: THREE.Group, update: Function}} модель бармена
 */
export function barkeep() {
  const M = {
    skin: mat(PALETTE.skin),
    skinShade: mat(PALETTE.skinShade),
    skinLight: mat(PALETTE.skinLight),
    hair: mat(PALETTE.hair),
    beard: mat(PALETTE.beard),
    beardDark: mat(PALETTE.beardDark),
    shirt: mat(PALETTE.shirt),
    shirtShade: mat(PALETTE.shirtShade),
    vest: mat(PALETTE.vest),
    vestDark: mat(PALETTE.vestDark),
    apron: mat(PALETTE.apron),
    apronShade: mat(PALETTE.apronShade),
    trousers: mat(PALETTE.trousers),
    trousersShade: mat(PALETTE.trousersShade),
    boots: mat(PALETTE.boots),
    hat: mat(PALETTE.hat),
    hatBand: mat(PALETTE.hatBand),
    pewter: mat(PALETTE.pewter, { metalness: 0.4, roughness: 0.45 }),
    eyeWhite: mat(PALETTE.eyeWhite, { roughness: 0.6 }),
    iris: mat(PALETTE.iris, { roughness: 0.5 }),
    dark: mat(PALETTE.dark, { roughness: 0.9 }),
  };

  const root = new THREE.Group();
  root.name = 'barkeep';

  /* ================================================================
   *  ТАЗ И НОГИ
   * ================================================================ */
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  // таз — чуть шире штанины сверху
  hips.add(mesh(box(0.34, 0.2, 0.25), M.trousers, 0, 0.02, 0));

  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.115, 0, 0);
    hips.add(leg);
    // бедро
    leg.add(mesh(cyl(0.105, 0.095, 0.4, 10), M.trousers, 0, -0.2, 0));
    // колено
    const knee = new THREE.Group();
    knee.position.set(0, -0.4, 0);
    leg.add(knee);
    // голень
    knee.add(mesh(cyl(0.094, 0.076, 0.36, 10), M.trousers, 0, -0.18, 0));
    // манжета штанов
    knee.add(mesh(cyl(0.082, 0.078, 0.05, 10), M.trousersShade, 0, -0.34, 0));
    // сапог
    const boot = new THREE.Group();
    boot.position.set(0, -0.38, 0);
    knee.add(boot);
    boot.add(mesh(cyl(0.098, 0.094, 0.19, 10), M.boots, 0, 0.05, 0));        // голенище
    boot.add(mesh(box(0.17, 0.1, 0.28), M.boots, 0, -0.05, 0.04));          // стопа
    boot.add(mesh(box(0.185, 0.03, 0.3), M.dark, 0, -0.1, 0.045));          // подошва
    boot.add(mesh(box(0.155, 0.035, 0.1), M.boots, 0, 0.0, 0.16));          // носок
    leg.userData.knee = knee;
    leg.userData.boot = boot;
    legs.push(leg);
  }

  /* ================================================================
   *  ТОРС
   * ================================================================ */
  const torso = new THREE.Group();
  torso.position.set(0, 0.1, 0);      // талия, абс ≈ 0,96
  hips.add(torso);

  // живот: книзу шире, чем грудь — «яблоко» грузного мужика
  const belly = mesh(cyl(0.26, 0.225, 0.28, 12), M.shirt, 0, 0.13, 0);
  belly.scale.set(1, 1, 0.6);
  torso.add(belly);

  const chest = new THREE.Group();
  chest.position.set(0, 0.26, 0);     // абс ≈ 1,22
  torso.add(chest);

  // рёбра + широкие покатые плечи
  chest.add(mesh(box(0.5, 0.32, 0.29), M.shirt, 0, 0.15, 0));
  const shoulders = [];
  for (const sx of [-1, 1]) {
    const sh = mesh(sphere(0.128, 12, 9), M.shirt, sx * 0.25, 0.258, 0);
    sh.scale.set(0.86, 0.6, 0.8);
    chest.add(sh);
    shoulders.push(sh);
  }
  // плечи рубахи (покрой)
  chest.add(mesh(box(0.55, 0.08, 0.31), M.shirtShade, 0, 0.27, 0.005));
  // воротник рубахи
  chest.add(mesh(cyl(0.105, 0.12, 0.075, 12), M.shirtShade, 0, 0.315, 0.005));
  chest.add(mesh(box(0.22, 0.055, 0.17), M.shirtShade, 0, 0.335, 0.085));

  /* ---------------- жилет ---------------- */
  const vest = new THREE.Group();
  chest.add(vest);
  // полы спереди — расходятся к талии
  const lapL = mesh(box(0.115, 0.44, 0.05), M.vest, -0.165, 0.13, 0.145);
  lapL.rotation.z = 0.08;
  vest.add(lapL);
  const lapR = mesh(box(0.115, 0.44, 0.05), M.vest, 0.165, 0.13, 0.145);
  lapR.rotation.z = -0.08;
  vest.add(lapR);
  // спинка
  vest.add(mesh(box(0.47, 0.4, 0.05), M.vestDark, 0, 0.15, -0.135));
  // лацканы
  vest.add(mesh(box(0.13, 0.11, 0.055), M.vestDark, -0.15, 0.33, 0.142));
  vest.add(mesh(box(0.13, 0.11, 0.055), M.vestDark, 0.15, 0.33, 0.142));
  // пуговицы в одну колонку на правой полке
  for (let i = 0; i < 3; i++) {
    vest.add(mesh(sphere(0.017, 8, 6), M.pewter, 0.115, 0.27 - i * 0.115, 0.178));
  }
  // ремешок сбоку
  vest.add(mesh(box(0.04, 0.3, 0.055), M.vestDark, 0.225, 0.16, 0.1));

  /* ---------------- фартук ---------------- */
  const apron = new THREE.Group();
  apron.position.set(0, 0.04, 0);
  torso.add(apron);
  // передник с лёгким наклоном от талии
  const bib = mesh(box(0.27, 0.28, 0.035), M.apron, 0, 0.3, 0.16);
  apron.add(bib);
  // латунная табличка на фартуке
  apron.add(mesh(box(0.075, 0.03, 0.012), M.pewter, 0, 0.34, 0.181));
  const skirt = mesh(box(0.52, 0.48, 0.035), M.apron, 0, -0.04, 0.18);
  skirt.rotation.x = -0.06;
  apron.add(skirt);
  // оборка снизу
  const hem = mesh(box(0.53, 0.06, 0.045), M.apronShade, 0, -0.27, 0.18);
  apron.add(hem);
  // пояс
  apron.add(mesh(box(0.54, 0.07, 0.36), M.apronShade, 0, 0.11, 0.12));
  apron.add(mesh(box(0.09, 0.09, 0.05), M.apronShade, 0.16, 0.11, 0.19));   // пряжка
  // завязки через плечи
  for (const sx of [-1, 1]) {
    const strap = mesh(box(0.06, 0.42, 0.035), M.apron, sx * 0.15, 0.42, 0.03);
    strap.rotation.z = sx * 0.12;
    apron.add(strap);
    const back = mesh(box(0.06, 0.42, 0.035), M.apron, sx * 0.15, 0.42, -0.13);
    back.rotation.z = sx * 0.12;
    apron.add(back);
  }
  // карман с салфетками
  apron.add(mesh(box(0.17, 0.13, 0.03), M.apronShade, -0.1, -0.06, 0.196));
  apron.add(mesh(box(0.1, 0.06, 0.025), M.shirt, -0.1, 0.01, 0.2));

  /* ================================================================
   *  РУКИ
   * ================================================================ */
  const arms = [];
  const hands = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.235, 0.24, 0);
    chest.add(arm);
    // рукав до локтя
    arm.add(mesh(cyl(0.09, 0.08, 0.26, 10), M.shirt, 0, -0.13, 0));
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.26, 0);
    arm.add(elbow);
    // предплечье
    elbow.add(mesh(cyl(0.079, 0.068, 0.24, 10), M.shirt, 0, -0.12, 0));
    // манжета
    elbow.add(mesh(cyl(0.085, 0.082, 0.055, 10), M.shirtShade, 0, -0.235, 0));
    // кисть
    const hand = new THREE.Group();
    hand.position.set(0, -0.27, 0);
    elbow.add(hand);
    const palm = mesh(sphere(0.052, 10, 8), M.skin, 0, -0.03, 0);
    palm.scale.set(1, 1.05, 0.78);
    hand.add(palm);
    // пальцы
    for (let f = 0; f < 4; f++) {
      const fx = (f - 1.5) * 0.021;
      const finger = mesh(cyl(0.011, 0.009, 0.055, 6), M.skin, fx, -0.075, 0.005);
      finger.rotation.x = -0.5;
      hand.add(finger);
    }
    // большой палец
    const thumb = mesh(cyl(0.012, 0.01, 0.05, 6), M.skin, sx * 0.042, -0.045, 0.012);
    thumb.rotation.z = sx * 0.7;
    thumb.rotation.x = -0.3;
    hand.add(thumb);
    arm.userData.elbow = elbow;
    arm.userData.hand = hand;
    arms.push(arm);
    hands.push(hand);
  }

  /* ---------------- кружка в правой руке ---------------- */
  const mug = new THREE.Group();
  mug.position.set(0, -0.07, 0.03);
  hands[1].add(mug);
  mug.add(mesh(cyl(0.05, 0.043, 0.115, 12), M.pewter, 0, 0, 0));
  const foam = mesh(cyl(0.042, 0.042, 0.02, 12), mat(0xe8d9b6), 0, 0.05, 0);
  mug.add(foam);
  const handle = mesh(torus(0.032, 0.008, 6, 12), M.pewter, 0.052, 0, 0);
  handle.rotation.y = Math.PI / 2;
  mug.add(handle);

  /* ================================================================
   *  ГОЛОВА
   * ================================================================ */
  const neck = new THREE.Group();
  neck.position.set(0, 0.32, 0.005);
  chest.add(neck);
  neck.add(mesh(cyl(0.088, 0.1, 0.115, 12), M.skin, 0, 0.01, 0));

  const head = new THREE.Group();
  head.position.set(0, 0.1, 0.005);
  neck.add(head);

  // череп — широкий, низковатый: так лицо читается как лицо, а не как капля
  const skull = mesh(sphere(0.142, 16, 12), M.skin, 0, 0.1, 0);
  skull.scale.set(1.05, 0.96, 0.93);
  head.add(skull);
  // затылок
  const back = mesh(sphere(0.118, 12, 9), M.skin, 0, 0.075, -0.05);
  back.scale.set(0.98, 0.9, 0.85);
  head.add(back);
  // челюсть — вплавлена в череп, шире вперёд
  const jaw = mesh(sphere(0.108, 12, 9), M.skin, 0, 0.035, 0.04);
  jaw.scale.set(1.02, 0.74, 0.92);
  head.add(jaw)
  // нос
  const noseBridge = mesh(cone(0.038, 0.11, 8), M.skin, 0, 0.115, 0.115);
  noseBridge.rotation.x = Math.PI / 2;
  noseBridge.scale.set(0.9, 1, 1);
  head.add(noseBridge);
  const noseTip = mesh(sphere(0.032, 10, 8), M.skinLight, 0, 0.095, 0.145);
  noseTip.scale.set(1.1, 0.9, 1);
  head.add(noseTip);
  // уши — плоские, прижаты к голове
  for (const sx of [-1, 1]) {
    const ear = mesh(sphere(0.038, 10, 8), M.skin, sx * 0.148, 0.085, -0.01);
    ear.scale.set(0.34, 1.0, 0.72);
    head.add(ear);
    const inner = mesh(sphere(0.02, 8, 6), M.skinShade, sx * 0.155, 0.082, -0.006);
    inner.scale.set(0.4, 0.9, 0.6);
    head.add(inner);
  }
  // глаза
  const eyes = [];
  for (const sx of [-1, 1]) {
    const white = mesh(sphere(0.043, 12, 10), M.eyeWhite, sx * 0.058, 0.13, 0.096);
    white.scale.set(1, 0.95, 0.7);
    head.add(white);
    const iris = mesh(sphere(0.023, 10, 8), M.iris, sx * 0.058, 0.128, 0.118);
    iris.scale.set(1, 1, 0.55);
    head.add(iris);
    const pupil = mesh(sphere(0.011, 8, 6), M.dark, sx * 0.058, 0.128, 0.126);
    pupil.scale.set(1, 1, 0.5);
    head.add(pupil);
    const shine = mesh(sphere(0.007, 6, 5), mat(0xffffff, { roughness: 0.2 }), sx * 0.049, 0.142, 0.128);
    head.add(shine);
    // веко (моргание)
    const lid = mesh(sphere(0.045, 12, 10), M.skin, sx * 0.058, 0.163, 0.098);
    lid.scale.set(1, 0.3, 0.72);
    head.add(lid);
    eyes.push(lid);
    // бровь
    const brow = mesh(box(0.085, 0.024, 0.035), M.hair, sx * 0.058, 0.185, 0.115);
    brow.rotation.z = sx * 0.16;
    head.add(brow);
  }
  // борода: подбородок, боковые пряди, усы
  const chin = mesh(sphere(0.088, 14, 11), M.beard, 0, 0.002, 0.042);
  chin.scale.set(0.86, 0.56, 0.68);
  head.add(chin);
  for (const sx of [-1, 1]) {
    const side = mesh(sphere(0.055, 10, 8), M.beard, sx * 0.07, 0.034, 0.046);
    side.scale.set(0.78, 0.9, 0.76);
    head.add(side);
    // усы-«козлики» с опущенными кончиками
    const moustache = mesh(box(0.058, 0.022, 0.03), M.beard, sx * 0.036, 0.099, 0.141);
    moustache.rotation.y = sx * 0.42;
    moustache.rotation.z = sx * 0.16;
    head.add(moustache);
  }
  // рот — добродушная ухмылка
  const mouth = mesh(box(0.062, 0.016, 0.022), M.dark, 0, 0.066, 0.128);
  head.add(mouth);
  for (const sx of [-1, 1]) {
    const corner = mesh(box(0.022, 0.016, 0.02), M.dark, sx * 0.036, 0.071, 0.126);
    corner.rotation.z = sx * 0.4;
    head.add(corner);
  }
  const lip = mesh(box(0.08, 0.012, 0.016), M.skinShade, 0, 0.05, 0.126);
  head.add(lip);

  /* ---------------- колпак ---------------- */
  const hat = new THREE.Group();
  hat.position.set(0, 0.2, -0.005);
  hat.rotation.z = 0.09;          // сбит набок — видно, что человек живой
  head.add(hat);
  hat.add(mesh(cyl(0.168, 0.162, 0.026, 14), M.hat, 0, 0.012, 0));      // козырёк
  hat.add(mesh(torus(0.15, 0.016, 6, 14), M.hat, 0, 0.028, 0));         // валик козырька
  hat.add(mesh(cyl(0.146, 0.146, 0.036, 14), M.hatBand, 0, 0.04, 0));   // лента
  hat.add(mesh(cyl(0.134, 0.118, 0.085, 14), M.hat, 0, 0.088, 0));      // тулья
  const tip = mesh(sphere(0.055, 10, 8), M.hat, 0, 0.138, 0);
  tip.scale.set(1, 0.8, 1);
  hat.add(tip);

  /* ================================================================
   *  АНИМАЦИЯ
   * ================================================================ */
  let phase = 0;
  let breath = 0;
  let blinkTimer = 1.5 + Math.random() * 3;
  let blink = 0;
  let sipTimer = 5 + Math.random() * 5;
  let sip = 0;

  /**
   * Анимация персонажа.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t мировое время
   * @param {object} st состояние: { speed, moving, talking, lookYaw }
   */
  function update(dt, t, st = {}) {
    const moving = !!st.moving;
    const speed = st.speed || 0;
    const talking = !!st.talking;

    if (moving) phase += dt * (5.0 + speed * 1.5);
    breath += dt;

    const sw = moving ? Math.min(1, speed / 1.0) : 0;
    const s = Math.sin(phase);
    const c = Math.cos(phase);

    /* ---------- ноги ---------- */
    legs[0].rotation.x = s * 0.55 * sw;
    legs[1].rotation.x = -s * 0.55 * sw;
    // колено сгибается только назад
    legs[0].userData.knee.rotation.x = Math.max(0, -s) * 0.75 * sw;
    legs[1].userData.knee.rotation.x = Math.max(0, s) * 0.75 * sw;
    // стопа стоит ровно
    legs[0].userData.boot.rotation.x = -legs[0].rotation.x - legs[0].userData.knee.rotation.x;
    legs[1].userData.boot.rotation.x = -legs[1].rotation.x - legs[1].userData.knee.rotation.x;

    /* ---------- корпус ---------- */
    hips.position.y = 0.86 + (moving ? Math.abs(c) * 0.03 * sw : 0);
    torso.rotation.z = moving ? s * 0.035 * sw : 0;
    // дыхание грудной клеткой
    chest.scale.set(1, 1 + Math.sin(breath * 1.6) * 0.016, 1);
    // в разговоре — чуть подаётся вперёд
    torso.rotation.x = talking ? 0.05 + Math.sin(t * 1.7) * 0.015 : (moving ? 0.04 * sw : 0);

    /* ---------- руки ---------- */
    // по умолчанию: правая с кружкой согнута, левая свободно висит
    let armSwing = 0;
    if (moving) armSwing = -s * 0.35 * sw;

    // моргание
    blinkTimer -= dt;
    if (blinkTimer <= 0) { blinkTimer = 2.4 + Math.random() * 4; blink = 0.14; }
    if (blink > 0) {
      blink -= dt;
      const k = Math.min(1, blink / 0.07);
      for (const lid of eyes) { lid.scale.y = 0.3 + k * 0.78; lid.position.y = 0.163 - k * 0.03; }
    } else {
      for (const lid of eyes) { lid.scale.y = 0.3; lid.position.y = 0.163; }
    }

    // питьё из кружки — периодически, когда стоит
    if (!moving && !talking) {
      sipTimer -= dt;
      if (sipTimer <= 0) { sipTimer = 7 + Math.random() * 5; sip = 2.4; }
    }
    if (sip > 0) {
      sip -= dt;
      const k = Math.sin(Math.min(1, (2.4 - sip) / 2.4) * Math.PI);   // 0 → 1 → 0
      arms[1].rotation.x = -1.15 * k;
      arms[1].rotation.z = -0.3 * k;
      arms[1].userData.elbow.rotation.x = -1.1 * k;
      head.rotation.x = 0.16 * k;
      arms[0].rotation.x = armSwing * 0.3;
      arms[0].rotation.z = 0.05;
      arms[0].userData.elbow.rotation.x = -0.15;
    } else if (talking) {
      // жестулирует: поднимает кружку и кивает
      const g = Math.sin(t * 2.2);
      arms[1].rotation.x = -0.45 + g * 0.22;
      arms[1].rotation.z = -0.18;
      arms[1].userData.elbow.rotation.x = -0.85 + g * 0.15;
      arms[0].rotation.x = armSwing + Math.sin(t * 2.6) * 0.16;
      arms[0].rotation.z = 0.16;
      arms[0].userData.elbow.rotation.x = -0.35 - Math.sin(t * 2.6) * 0.12;
    } else {
      arms[1].rotation.x = armSwing - 0.12;
      arms[1].rotation.z = -0.06;
      arms[1].userData.elbow.rotation.x = -0.55;
      arms[0].rotation.x = armSwing;
      arms[0].rotation.z = 0.05;
      arms[0].userData.elbow.rotation.x = -0.2;
    }

    // кружка чуть покачивается
    mug.rotation.z = moving ? s * 0.1 * sw : Math.sin(breath * 1.4) * 0.02;

    /* ---------- голова ---------- */
    head.rotation.y = st.lookYaw || 0;
    if (sip <= 0) {
      head.rotation.x = talking
        ? Math.sin(t * 3.2) * 0.05
        : (moving ? -0.03 * sw : Math.sin(breath * 0.7) * 0.02);
    }
    // лёгкое покачивание головой при разговоре
    head.rotation.z = talking ? Math.sin(t * 1.3) * 0.035 : 0;
  }

  return { group: root, update };
}

/* ------------------------------------------------------------------
 *  Портрет для диалогового окна
 * ------------------------------------------------------------------ */

/**
 * Рисует портрет бармена на canvas — как рыбы в инвентаре.
 *
 * @param {number} px сторона картинки в пикселях
 * @returns {HTMLCanvasElement|null} портрет или null вне браузера
 */
export function barkeepIcon(px = 96) {
  if (typeof document === 'undefined') return null;
  const size = Math.max(24, Math.round(px || 96));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d');
  const u = size / 96;

  // фон — тёплая рамка со светом сверху
  const bg = c.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#4a3524');
  bg.addColorStop(1, '#1d150e');
  c.fillStyle = bg;
  c.fillRect(0, 0, size, size);
  const glow = c.createRadialGradient(size * 0.5, size * 0.22, 2, size * 0.5, size * 0.3, size * 0.7);
  glow.addColorStop(0, 'rgba(255,190,110,.28)');
  glow.addColorStop(1, 'rgba(255,190,110,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, size, size);

  /* ---- плечи: рубаха, жилет, фартук ---- */
  c.fillStyle = '#dcd2b6';
  c.beginPath();
  c.moveTo(10 * u, size);
  c.quadraticCurveTo(16 * u, 62 * u, 48 * u, 60 * u);
  c.quadraticCurveTo(80 * u, 62 * u, 86 * u, size);
  c.closePath();
  c.fill();
  // жилет
  c.fillStyle = '#6e3b2f';
  c.beginPath();
  c.moveTo(24 * u, size);
  c.quadraticCurveTo(28 * u, 64 * u, 48 * u, 63 * u);
  c.quadraticCurveTo(68 * u, 64 * u, 72 * u, size);
  c.closePath();
  c.fill();
  // фартук
  c.fillStyle = '#e5d8b8';
  c.beginPath();
  c.moveTo(37 * u, size);
  c.quadraticCurveTo(39 * u, 70 * u, 48 * u, 69 * u);
  c.quadraticCurveTo(57 * u, 70 * u, 59 * u, size);
  c.closePath();
  c.fill();
  c.fillStyle = '#bfab88';
  c.fillRect(37 * u, 92 * u, 22 * u, 4 * u);

  /* ---- шея ---- */
  c.fillStyle = '#c08a5f';
  c.fillRect(41 * u, 52 * u, 14 * u, 10 * u);

  /* ---- голова ---- */
  c.fillStyle = '#dda87a';
  c.beginPath();
  c.ellipse(48 * u, 38 * u, 19 * u, 22 * u, 0, 0, Math.PI * 2);
  c.fill();
  // тень под скулами
  c.fillStyle = 'rgba(160,105,70,.22)';
  c.beginPath();
  c.ellipse(30 * u, 40 * u, 6 * u, 12 * u, 0.2, 0, Math.PI * 2);
  c.ellipse(66 * u, 40 * u, 6 * u, 12 * u, -0.2, 0, Math.PI * 2);
  c.fill();

  /* ---- уши ---- */
  c.fillStyle = '#c08a5f';
  c.beginPath();
  c.ellipse(29 * u, 38 * u, 4 * u, 6 * u, 0, 0, Math.PI * 2);
  c.ellipse(67 * u, 38 * u, 4 * u, 6 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- колпак ---- */
  c.fillStyle = '#3e382f';
  c.beginPath();
  c.ellipse(48 * u, 22 * u, 23 * u, 8 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(29 * u, 24 * u);
  c.lineTo(31 * u, 2 * u);
  c.quadraticCurveTo(48 * u, -3 * u, 65 * u, 2 * u);
  c.lineTo(67 * u, 24 * u);
  c.closePath();
  c.fill();
  c.fillStyle = '#8e3b30';
  c.fillRect(30 * u, 18 * u, 36 * u, 6 * u);
  // блик на тулье
  c.fillStyle = 'rgba(255,255,255,.10)';
  c.beginPath();
  c.ellipse(39 * u, 8 * u, 6 * u, 4 * u, -0.4, 0, Math.PI * 2);
  c.fill();

  /* ---- брови ---- */
  c.strokeStyle = '#4c3422';
  c.lineWidth = 3.2 * u;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(36 * u, 31 * u);
  c.lineTo(45 * u, 29 * u);
  c.moveTo(51 * u, 29 * u);
  c.lineTo(60 * u, 31 * u);
  c.stroke();

  /* ---- глаза ---- */
  c.fillStyle = '#f3ece0';
  c.beginPath();
  c.ellipse(41 * u, 37 * u, 5.2 * u, 4.4 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37 * u, 5.2 * u, 4.4 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#4c6d63';
  c.beginPath();
  c.ellipse(41 * u, 37.4 * u, 2.6 * u, 2.8 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37.4 * u, 2.6 * u, 2.8 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#231b15';
  c.beginPath();
  c.ellipse(41 * u, 37.4 * u, 1.3 * u, 1.6 * u, 0, 0, Math.PI * 2);
  c.ellipse(55 * u, 37.4 * u, 1.3 * u, 1.6 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.ellipse(39.8 * u, 35.8 * u, 1.1 * u, 1.1 * u, 0, 0, Math.PI * 2);
  c.ellipse(53.8 * u, 35.8 * u, 1.1 * u, 1.1 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- нос ---- */
  c.fillStyle = '#c08a5f';
  c.beginPath();
  c.ellipse(48 * u, 43 * u, 3.6 * u, 4.4 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(120,70,40,.25)';
  c.beginPath();
  c.ellipse(48 * u, 46 * u, 3 * u, 1.6 * u, 0, 0, Math.PI * 2);
  c.fill();

  /* ---- борода и усы ---- */
  c.fillStyle = '#8d5c31';
  c.beginPath();
  c.ellipse(48 * u, 57 * u, 15 * u, 10 * u, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#6b4321';
  c.beginPath();
  c.ellipse(48 * u, 60 * u, 12 * u, 7 * u, 0, 0, Math.PI * 2);
  c.fill();
  // усы
  c.fillStyle = '#6b4321';
  c.beginPath();
  c.moveTo(48 * u, 46 * u);
  c.quadraticCurveTo(40 * u, 43 * u, 36 * u, 47 * u);
  c.quadraticCurveTo(43 * u, 48 * u, 48 * u, 47 * u);
  c.quadraticCurveTo(53 * u, 48 * u, 60 * u, 47 * u);
  c.quadraticCurveTo(56 * u, 43 * u, 48 * u, 46 * u);
  c.fill();
  // рот
  c.strokeStyle = '#231b15';
  c.lineWidth = 1.6 * u;
  c.beginPath();
  c.moveTo(43 * u, 50 * u);
  c.quadraticCurveTo(48 * u, 52.5 * u, 53 * u, 50 * u);
  c.stroke();

  return canvas;
}
