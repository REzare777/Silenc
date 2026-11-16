import * as THREE from 'three';
import { sphere, cone, cyl, box } from './geo.js';

/* ------------------------------------------------------------------
 *  Животные долины
 *  Всё строится процедурно в том же низкополигональном стиле, что и
 *  деревня: из примитивов и нескольких материалов, без внешних файлов.
 *  У каждого животного есть своя анимация (шаг, покорм, хвост).
 * ------------------------------------------------------------------ */

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.88, metalness: 0.0, ...opts,
});

const PALETTE = {
  henBody: [0xf2e7d2, 0xd9b48c, 0xb98a5e, 0x8d6a4c],
  henComb: 0xc0392b,
  henBeak: 0xe6a83c,
  henLeg: 0xd9a441,
  sheepWool: 0xe9e3d6,
  sheepSkin: 0x3b332b,
  duckBody: 0xd8d2c4,
  duckHead: 0x2f6b52,
  duckBill: 0xe0b13c,
  dogBody: 0x8d5a33,
  dogLight: 0xd8bb8d,
  dogDark: 0x2b211a,
  catBody: 0xb9783f,
  catLight: 0xe3c79b,
  catDark: 0x3a2a1e,
};

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function eyes(group, material, x, y, z, r = 0.014, dx = 0.05) {
  group.add(mesh(sphere(r, 8, 6), material, x - dx, y, z));
  group.add(mesh(sphere(r, 8, 6), material, x + dx, y, z));
}

/* ---------------------------------------------------------------- курица */
export function chicken(hue = 0) {
  const body = mat(PALETTE.henBody[hue % PALETTE.henBody.length]);
  const comb = mat(PALETTE.henComb);
  const beak = mat(PALETTE.henBeak);
  const leg = mat(PALETTE.henLeg);
  const dark = mat(0x241d18);

  const g = new THREE.Group();

  // туловище — слегка вытянутое яйцо
  const torso = mesh(sphere(0.155, 12, 9), body, 0, 0.245, 0);
  torso.scale.set(0.82, 0.86, 1.18);
  torso.rotation.x = -0.12;
  g.add(torso);

  // хвост — три пера веером
  const tail = new THREE.Group();
  tail.position.set(0, 0.30, -0.16);
  for (let i = -1; i <= 1; i++) {
    const f = mesh(cone(0.055, 0.20, 7), body, i * 0.045, 0.05, -0.03);
    f.rotation.x = -0.95 + Math.abs(i) * 0.12;
    f.rotation.z = i * 0.32;
    tail.add(f);
  }
  g.add(tail);

  // крылья
  for (const s of [-1, 1]) {
    const w = mesh(sphere(0.105, 10, 8), body, s * 0.115, 0.255, 0.005);
    w.scale.set(0.34, 0.72, 1.15);
    w.rotation.z = s * 0.12;
    g.add(w);
  }

  // шея и голова
  const head = new THREE.Group();
  head.position.set(0, 0.345, 0.115);
  const skull = mesh(sphere(0.082, 10, 8), body, 0, 0.055, 0.015);
  skull.scale.set(0.92, 1, 1.05);
  head.add(skull);
  const bill = mesh(cone(0.032, 0.095, 7), beak, 0, 0.035, 0.105);
  bill.rotation.x = Math.PI / 2;
  head.add(bill);
  // гребень
  for (let i = 0; i < 3; i++) {
    const c = mesh(cone(0.022, 0.055 - i * 0.008, 6), comb, 0, 0.135 - i * 0.004, 0.005 + i * 0.03);
    head.add(c);
  }
  // серёжки
  head.add(mesh(sphere(0.024, 7, 5), comb, 0, 0.005, 0.075));
  eyes(head, dark, 0, 0.075, 0.055, 0.013, 0.052);
  g.add(head);

  // лапы
  const legs = [];
  for (const s of [-1, 1]) {
    const l = new THREE.Group();
    l.position.set(s * 0.055, 0.115, 0.005);
    l.add(mesh(cyl(0.014, 0.016, 0.115, 6), leg, 0, -0.055, 0));
    const foot = mesh(box(0.045, 0.018, 0.085), leg, 0, -0.112, 0.018);
    l.add(foot);
    g.add(l);
    legs.push(l);
  }

  g.userData.update = (dt, t, moving) => {
    const sw = moving ? Math.sin(t * 9) : 0;
    legs[0].rotation.x = sw * 0.55;
    legs[1].rotation.x = -sw * 0.55;
    torso.position.y = 0.245 + (moving ? Math.abs(sw) * 0.012 : 0);
    head.rotation.x = -0.05 + Math.sin(t * 1.7 + hue) * 0.06;
    head.rotation.y = Math.sin(t * 0.9 + hue) * 0.14;
    tail.rotation.x = Math.sin(t * 2.3 + hue) * 0.06;
  };
  return g;
}

/* ----------------------------------------------------------------- овца */
export function sheep() {
  const wool = mat(PALETTE.sheepWool);
  const skin = mat(PALETTE.sheepSkin);
  const dark = mat(0x1d1813);

  const g = new THREE.Group();

  // шерсть — гроздь шаров разного размера
  const puffs = [
    [0, 0.62, 0, 0.20], [0.14, 0.60, 0.07, 0.17], [-0.14, 0.60, 0.07, 0.17],
    [0.12, 0.63, -0.11, 0.16], [-0.12, 0.63, -0.11, 0.16],
    [0, 0.66, -0.17, 0.15], [0, 0.50, 0.02, 0.16], [0, 0.73, 0.02, 0.13],
  ];
  for (const [x, y, z, r] of puffs) {
    const p = mesh(sphere(r, 10, 8), wool, x, y, z);
    p.scale.set(1, 0.92, 1);
    g.add(p);
  }

  // голова
  const head = new THREE.Group();
  head.position.set(0, 0.66, 0.24);
  const skull = mesh(sphere(0.125, 10, 8), skin, 0, 0, 0.03);
  skull.scale.set(0.78, 0.85, 1.05);
  head.add(skull);
  const top = mesh(sphere(0.075, 8, 6), wool, 0, 0.10, 0.01);
  head.add(top);
  for (const s of [-1, 1]) {
    const ear = mesh(cone(0.05, 0.13, 6), skin, s * 0.115, 0.025, 0.0);
    ear.rotation.z = s * 1.25;
    ear.rotation.x = -0.2;
    head.add(ear);
  }
  eyes(head, dark, 0, 0.02, 0.115, 0.015, 0.055);
  g.add(head);

  // ноги
  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Group();
    l.position.set(sx * 0.115, 0.42, sz * 0.15);
    l.add(mesh(cyl(0.032, 0.038, 0.42, 6), skin, 0, -0.21, 0));
    const hoof = mesh(box(0.06, 0.05, 0.08), mat(0x241d18), 0, -0.41, 0.008);
    l.add(hoof);
    g.add(l);
    legs.push(l);
  }

  g.userData.update = (dt, t, moving) => {
    // щиплет траву — голова опускается и поднимается
    const graze = Math.pow(Math.max(0, Math.sin(t * 0.26 + 1.1)), 3);
    head.rotation.x = graze * 0.95;
    head.position.y = 0.66 - graze * 0.30;
    const sw = moving ? Math.sin(t * 5.5) : 0;
    legs[0].rotation.x = sw * 0.4; legs[1].rotation.x = -sw * 0.4;
    legs[2].rotation.x = -sw * 0.4; legs[3].rotation.x = sw * 0.4;
  };
  return g;
}

/* ----------------------------------------------------------------- утка */
export function duck() {
  const body = mat(PALETTE.duckBody);
  const headM = mat(PALETTE.duckHead);
  const bill = mat(PALETTE.duckBill);
  const dark = mat(0x1d1813);
  const wingM = mat(PALETTE.duckBody).clone();
  wingM.color = new THREE.Color(PALETTE.duckBody).multiplyScalar(0.88);
  const footM = mat(0xd08a3a);

  const g = new THREE.Group();

  /* ---- тело: грудь, спина, хвост ---- */
  const torso = new THREE.Group();
  g.add(torso);
  const bodyM = mesh(sphere(0.125, 14, 10), body, 0, 0.10, 0);
  bodyM.scale.set(0.82, 0.72, 1.32);
  torso.add(bodyM);
  // спинка чуть темнее — создаёт объём
  const backM = mesh(sphere(0.1, 12, 8), wingM, 0, 0.135, -0.02);
  backM.scale.set(0.78, 0.5, 1.15);
  torso.add(backM);
  // грудь
  const chestM = mesh(sphere(0.088, 12, 9), body, 0, 0.085, 0.075);
  chestM.scale.set(0.82, 0.8, 0.9);
  torso.add(chestM);

  /* ---- крылья: сложены вдоль тела, могут взмахивать ---- */
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group();
    w.position.set(s * 0.085, 0.135, -0.005);
    const wm = mesh(sphere(0.09, 10, 8), wingM, s * 0.012, 0, -0.01);
    wm.scale.set(0.44, 0.66, 1.22);
    w.add(wm);
    // маховое перо на конце
    const tip = mesh(cone(0.035, 0.1, 5), wingM, s * 0.02, -0.01, -0.1);
    tip.rotation.x = 1.35;
    w.add(tip);
    g.add(w);
    wings.push(w);
  }

  /* ---- ноги (лапы под водой) ---- */
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(s * 0.045, 0.045, 0.01);
    f.add(mesh(cyl(0.014, 0.014, 0.09, 5), footM, 0, -0.02, 0));
    const web = mesh(box(0.075, 0.014, 0.095), footM, 0, -0.062, 0.018);
    web.rotation.x = 0.2;
    f.add(web);
    g.add(f);
    feet.push(f);
  }

  /* ---- шея и голова ---- */
  const neck = new THREE.Group();
  neck.position.set(0, 0.135, 0.085);
  const neckM = mesh(cyl(0.042, 0.052, 0.11, 8), headM, 0, 0.04, 0);
  neckM.scale.set(1, 1, 0.88);
  neck.add(neckM);
  const head = new THREE.Group();
  head.position.set(0, 0.108, 0.012);
  const skull = mesh(sphere(0.062, 12, 9), headM, 0, 0, 0);
  skull.scale.set(0.92, 0.95, 1.05);
  head.add(skull);
  // клюв: верхняя и нижняя половины
  const beakU = mesh(box(0.062, 0.022, 0.105), bill, 0, 0.008, 0.072);
  beakU.rotation.x = -0.12;
  head.add(beakU);
  const beakL = mesh(box(0.052, 0.016, 0.085), bill, 0, -0.016, 0.062);
  beakL.rotation.x = 0.16;
  head.add(beakL);
  // «улыбка» — тёмная полоска между половинками клюва
  head.add(mesh(box(0.056, 0.006, 0.09), dark, 0, -0.005, 0.068));
  eyes(head, dark, 0, 0.022, 0.045, 0.011, 0.04);
  neck.add(head);
  g.add(neck);

  /* ---- хвост ---- */
  const tail = new THREE.Group();
  tail.position.set(0, 0.135, -0.135);
  const tailM = mesh(cone(0.055, 0.13, 6), body, 0, 0.045, -0.03);
  tailM.rotation.x = 1.05;
  tail.add(tailM);
  tail.add(mesh(box(0.09, 0.03, 0.06), wingM, 0, 0.012, -0.045));
  g.add(tail);

  /* ---- состояния ---- */
  const st = {
    baseY: null,
    look: 0, lookTarget: 0, nextLook: 2,
    bob: 0, nextBob: 1.4,
    preen: 0, nextPreen: 9,
    flap: 0, nextFlap: 22,
    speed: 0,
  };

  /**
   * update(dt, t, speed, near)
   *  speed — скорость плывущей утки (0 — стоит),
   *  near  — рядом ли игрок (утка настороженно замирает).
   */
  g.userData.update = (dt, t, speed = 0, near = false) => {
    if (st.baseY === null) st.baseY = g.position.y;
    st.speed += (speed - st.speed) * Math.min(1, dt * 2.5);

    // покачивание на воде: корпус чуть перекатывается
    const wave = Math.sin(t * 1.7) * 0.5 + Math.sin(t * 2.9 + 1.1) * 0.25;
    g.position.y = st.baseY + wave * 0.022;
    torso.rotation.z = wave * 0.07;
    torso.rotation.x = Math.sin(t * 1.15) * 0.05;

    // взгляд по сторонам
    st.nextLook -= dt;
    if (st.nextLook <= 0) {
      st.nextLook = 2.4 + Math.random() * 4.5;
      st.lookTarget = (Math.random() - 0.5) * 1.5;
    }
    st.look += (st.lookTarget - st.look) * Math.min(1, dt * 2.2);

    // вылизывание перьев
    st.nextPreen -= dt;
    if (st.preen <= 0 && st.nextPreen <= 0) {
      st.preen = 2.4 + Math.random() * 1.8;
      st.nextPreen = 12 + Math.random() * 16;
    }

    // взмах крыльев (когда плывёт быстро или испугалась)
    st.nextFlap -= dt;
    if (st.flap <= 0 && (st.nextFlap <= 0 || (near && Math.random() < 0.02))) {
      st.flap = 0.9;
      st.nextFlap = 14 + Math.random() * 20;
    }

    if (st.preen > 0) {
      st.preen -= dt;
      const k = Math.min(1, st.preen / 1.2);
      // голова поворачивается назад к крылу и клюёт перо
      neck.rotation.y = 1.5 * k + st.look * (1 - k);
      neck.rotation.x = -0.25 + 0.9 * k;
      head.rotation.y = 0.9 * k;
      head.rotation.x = 0.55 * k + Math.sin(t * 9) * 0.12 * k;
      neck.position.z = 0.095 - 0.03 * k;
      for (const w of wings) w.rotation.z = 0;
    } else {
      // обычное плавание: шея слегка вытягивается вперёд и качается
      const bob = Math.sin(t * 1.9) * 0.5 + 0.5;
      neck.rotation.y = st.look * 0.8;
      neck.rotation.x = -0.06 + Math.sin(t * 2.4) * 0.05;
      neck.position.z = 0.095 + bob * 0.012;
      head.rotation.y = st.look * 0.4;
      head.rotation.x = Math.sin(t * 1.9) * 0.07;
    }

    // взмахи крыльев
    if (st.flap > 0) {
      st.flap -= dt;
      const k = Math.sin(Math.PI * Math.min(1, st.flap / 0.9));
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1;
        wings[i].rotation.z = s * (0.15 + k * 1.05);
        wings[i].rotation.x = -k * 0.25;
      }
      g.position.y += k * 0.05;
    } else {
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? -1 : 1;
        wings[i].rotation.z += (s * 0.1 - wings[i].rotation.z) * Math.min(1, dt * 4);
        wings[i].rotation.x += (0 - wings[i].rotation.x) * Math.min(1, dt * 4);
      }
    }

    // лапы: гребут под водой (быстрее — чаще)
    const paddle = Math.sin(t * (2.2 + st.speed * 3.4));
    feet[0].rotation.x = paddle * 0.5;
    feet[1].rotation.x = -paddle * 0.5;

    // хвост чуть покачивается
    tail.rotation.y = Math.sin(t * 1.6) * 0.09;
  };
  return g;
}

/* ---------------------------------------------------------------- собака */
export function dog() {
  const fur = mat(PALETTE.dogBody);
  const light = mat(PALETTE.dogLight);
  const dark = mat(PALETTE.dogDark);

  const g = new THREE.Group();
  const torso = mesh(sphere(0.26, 12, 9), fur, 0, 0.46, 0);
  torso.scale.set(0.68, 0.72, 1.25);
  g.add(torso);
  const chest = mesh(sphere(0.17, 10, 8), light, 0, 0.42, 0.16);
  chest.scale.set(0.85, 0.9, 0.9);
  g.add(chest);

  const head = new THREE.Group();
  head.position.set(0, 0.60, 0.30);
  const skull = mesh(sphere(0.135, 12, 9), fur, 0, 0, 0);
  skull.scale.set(0.9, 0.92, 0.95);
  head.add(skull);
  const muzzle = mesh(sphere(0.085, 10, 8), light, 0, -0.025, 0.135);
  muzzle.scale.set(0.8, 0.75, 1.15);
  head.add(muzzle);
  const nose = mesh(sphere(0.028, 8, 6), dark, 0, -0.015, 0.215);
  head.add(nose);
  for (const s of [-1, 1]) {
    const ear = mesh(sphere(0.075, 8, 6), fur, s * 0.115, -0.02, -0.02);
    ear.scale.set(0.42, 1.15, 0.72);
    ear.rotation.z = s * 0.25;
    head.add(ear);
  }
  eyes(head, dark, 0, 0.045, 0.105, 0.017, 0.062);
  g.add(head);

  const legs = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Group();
    l.position.set(sx * 0.115, 0.40, sz * 0.185);
    l.add(mesh(cyl(0.035, 0.042, 0.40, 6), fur, 0, -0.20, 0));
    const paw = mesh(box(0.07, 0.055, 0.09), light, 0, -0.395, 0.012);
    l.add(paw);
    g.add(l);
    legs.push(l);
  }

  // хвост
  const tail = new THREE.Group();
  tail.position.set(0, 0.52, -0.28);
  tail.add(mesh(cyl(0.028, 0.038, 0.26, 6), fur, 0, 0.10, -0.06));
  const tuft = mesh(sphere(0.045, 8, 6), light, 0, 0.21, -0.11);
  tail.add(tuft);
  tail.rotation.x = -0.9;
  g.add(tail);

  const legBase = legs.map((l) => l.position.y);
  const headBase = head.position.y;
  const tailBase = tail.position.y;

  /**
   * jump — фаза прыжка 0..1 (0 — стоит).
   * Пёс подпрыгивает, поджимает лапы, уши и хвост улетают вверх.
   */
  g.userData.update = (dt, t, moving, look, jump = 0) => {
    const wag = Math.sin(t * (look ? 11 : 5));
    tail.rotation.y = wag * (look ? 0.55 : 0.28);
    tail.rotation.x = -0.9 + wag * 0.12;
    head.rotation.y = look ? Math.sin(t * 1.1) * 0.35 : Math.sin(t * 0.6) * 0.12;
    head.rotation.x = Math.sin(t * 0.8) * 0.07;
    const sw = moving ? Math.sin(t * 7.5) : 0;
    legs[0].rotation.x = sw * 0.5; legs[1].rotation.x = -sw * 0.5;
    legs[2].rotation.x = -sw * 0.5; legs[3].rotation.x = sw * 0.5;
    torso.position.y = 0.46 + (moving ? Math.abs(sw) * 0.015 : 0);

    if (jump > 0) {
      const j = Math.sin(Math.PI * Math.min(1, jump));    // 0..1..0
      g.position.y = j * 0.44;                            // весь пёс взлетает
      torso.position.y = 0.46 + j * 0.05;                 // корпус слегка вытягивается
      head.position.y = headBase + j * 0.06;
      tail.position.y = tailBase + j * 0.10;
      tail.rotation.x = -0.9 - j * 0.55;
      // передние лапы поджаты, задние выпрямлены — как в прыжке
      legs[0].rotation.x = -0.55 - j * 0.75;
      legs[1].rotation.x = -0.55 - j * 0.75;
      legs[2].rotation.x = j * 0.45;
      legs[3].rotation.x = j * 0.45;
      for (let i = 0; i < 4; i++) legs[i].position.y = legBase[i] + (i < 2 ? j * 0.05 : 0);
      torso.rotation.x = -j * 0.22;
    } else {
      g.position.y = 0;
      head.position.y = headBase;
      tail.position.y = tailBase;
      torso.rotation.x = 0;
      for (let i = 0; i < 4; i++) legs[i].position.y = legBase[i];
    }
  };
  return g;
}

/* ------------------------------------------------------------------ кот */
/**
 * Процедурная текстура шерсти: базовый тон, полосы-табби и короткий ворс.
 * Рисуется на canvas — внешних файлов не нужно.
 */
function furTexture(base, stripe, opts = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 256, 256);
  // мягкие пятна по тону
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(0,0,0,${0.03 + Math.random() * 0.05})`;
    x.beginPath();
    x.ellipse(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 40, 12 + Math.random() * 26, Math.random() * 3, 0, 7);
    x.fill();
  }
  // полосы
  x.strokeStyle = stripe;
  x.lineCap = 'round';
  x.globalAlpha = 0.85;
  const n = opts.stripes ?? 14;
  for (let i = 0; i < n; i++) {
    x.lineWidth = 3 + Math.random() * 6;
    const y = (i / n) * 256 + Math.random() * 10;
    x.beginPath();
    x.moveTo(-8, y);
    x.bezierCurveTo(50, y - 14, 130, y + 16, 264, y - 6);
    x.stroke();
  }
  x.globalAlpha = 1;
  // ворс
  for (let i = 0; i < 5200; i++) {
    const v = Math.random();
    x.fillStyle = v > 0.5 ? `rgba(255,240,220,${0.03 + Math.random() * 0.07})`
      : `rgba(0,0,0,${0.02 + Math.random() * 0.07})`;
    const px = Math.random() * 256, py = Math.random() * 256;
    x.fillRect(px, py, 1, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Домашний кот: полосатый, с усами, когтями-пальчиками и живой мимикой.
 * Сидит на крыльце, следит за хозяином, моргает, вылизывает лапу,
 * иногда потягивается и потряхивает ушами.
 */
export function cat() {
  const furTex = furTexture('#b07a45', '#6d4526', { stripes: 16 });
  const fur = mat(0xffffff, { map: furTex, roughness: 0.95 });
  const light = mat(0xe8cfa6, { roughness: 0.95 });
  const cream = mat(0xf2e2c4, { roughness: 0.96 });
  const dark = mat(0x2b211a, { roughness: 0.6 });
  const pink = mat(0xd98d94, { roughness: 0.7 });
  const eyeCol = mat(0x8fbf52, { roughness: 0.25, emissive: 0x2c4a12, emissiveIntensity: 0.5 });
  const iris = new THREE.MeshStandardMaterial({
    color: 0x6fae3a, roughness: 0.2, emissive: 0x1d3d0c, emissiveIntensity: 0.55,
  });

  const g = new THREE.Group();

  /* ---- туловище сидящей кошки: грудь, спина, бёдра ---- */
  const torso = new THREE.Group();
  g.add(torso);
  const chest = mesh(sphere(0.128, 14, 10), fur, 0, 0.20, 0.042);
  chest.scale.set(0.76, 1.16, 0.7);
  torso.add(chest);
  const belly = mesh(sphere(0.078, 12, 9), cream, 0, 0.135, 0.098);
  belly.scale.set(0.8, 1.08, 0.58);
  torso.add(belly);
  const back = mesh(sphere(0.118, 14, 10), fur, 0, 0.245, -0.042);
  back.scale.set(0.84, 0.98, 1.0);
  torso.add(back);
  // бёдра
  for (const s of [-1, 1]) {
    const h = mesh(sphere(0.096, 12, 9), fur, s * 0.072, 0.085, -0.035);
    h.scale.set(0.86, 0.82, 1.22);
    torso.add(h);
  }
  // задние лапы (вытянуты вперёд)
  for (const s of [-1, 1]) {
    const paw = mesh(sphere(0.042, 10, 8), cream, s * 0.056, 0.028, 0.082);
    paw.scale.set(0.86, 0.58, 1.5);
    torso.add(paw);
  }

  /* ---- передние лапы ---- */
  const frontLegs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.055, 0.16, 0.125);
    leg.add(mesh(cyl(0.026, 0.03, 0.17, 8), cream, 0, -0.08, 0));
    const paw = mesh(sphere(0.036, 10, 8), cream, 0, -0.16, 0.012);
    paw.scale.set(0.95, 0.6, 1.25);
    leg.add(paw);
    // пальчики
    for (let i = -1; i <= 1; i++) {
      leg.add(mesh(sphere(0.011, 6, 5), pink, i * 0.017, -0.172, 0.038));
    }
    g.add(leg);
    frontLegs.push(leg);
  }

  /* ---- шея и голова ---- */
  const head = new THREE.Group();
  head.position.set(0, 0.345, 0.045);
  g.add(head);
  const skull = mesh(sphere(0.095, 16, 12), fur, 0, 0, 0);
  skull.scale.set(0.96, 0.9, 0.95);
  head.add(skull);
  // щёки
  for (const s of [-1, 1]) {
    const ch = mesh(sphere(0.052, 10, 8), fur, s * 0.048, -0.018, 0.052);
    ch.scale.set(0.85, 0.78, 0.85);
    head.add(ch);
  }
  // мордочка
  const muzzle = mesh(sphere(0.055, 12, 9), cream, 0, -0.035, 0.075);
  muzzle.scale.set(0.92, 0.72, 0.86);
  head.add(muzzle);
  const chin = mesh(sphere(0.032, 8, 6), cream, 0, -0.062, 0.058);
  chin.scale.set(0.9, 0.6, 0.75);
  head.add(chin);
  // нос
  const nose = mesh(sphere(0.017, 8, 6), pink, 0, -0.012, 0.115);
  nose.scale.set(1.1, 0.8, 0.75);
  head.add(nose);
  // глазницы и глаза
  const eyes = [];
  for (const s of [-1, 1]) {
    const socket = mesh(sphere(0.028, 10, 8), dark, s * 0.042, 0.012, 0.072);
    socket.scale.set(1, 0.9, 0.55);
    head.add(socket);
    const eye = mesh(sphere(0.024, 12, 9), iris, s * 0.042, 0.012, 0.079);
    eye.scale.set(1, 1, 0.72);
    head.add(eye);
    const pupil = mesh(sphere(0.0125, 10, 8), dark, s * 0.042, 0.012, 0.092);
    pupil.scale.set(0.55, 1.25, 0.5);
    head.add(pupil);
    const shine = mesh(sphere(0.006, 6, 5), mat(0xffffff, { roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.8 }),
      s * 0.05, 0.022, 0.095);
    head.add(shine);
    eyes.push({ eye, pupil });
    // веко — для моргания
    const lid = mesh(sphere(0.027, 10, 8), fur, s * 0.042, 0.014, 0.077);
    lid.scale.set(1.02, 0.92, 0.7);
    lid.visible = false;
    head.add(lid);
    eyes[eyes.length - 1].lid = lid;
  }
  // уши
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.058, 0.082, -0.004);
    const outer = mesh(cone(0.046, 0.078, 8), fur, 0, 0.038, 0);
    outer.scale.set(1, 1, 0.55);
    ear.add(outer);
    const inner = mesh(cone(0.020, 0.048, 6), pink, 0, 0.032, 0.010);
    inner.scale.set(1, 1, 0.42);
    ear.add(inner);
    ear.rotation.z = s * 0.2;
    head.add(ear);
    ears.push(ear);
  }
  // усы
  const whiskerMat = mat(0xf3ece0, { roughness: 0.5 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const w = mesh(cyl(0.0013, 0.0013, 0.145, 4), whiskerMat,
        s * 0.032, -0.03 + i * 0.011, 0.092);
      w.rotation.z = s * (1.32 + i * 0.07);
      w.rotation.y = s * (-0.3 + i * 0.14);
      w.position.x = s * 0.028;
      head.add(w);
    }
  }

  /* ---- хвост: цепочка сегментов, обёрнут вокруг тела ---- */
  const tail = new THREE.Group();
  tail.position.set(0.085, 0.045, -0.075);
  g.add(tail);
  const segs = [];
  let parent = tail;
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Group();
    const r0 = 0.026 - i * 0.0018, r1 = 0.024 - i * 0.0018;
    const len = 0.075 - i * 0.003;
    const m = mesh(cyl(r0, r1, len, 7), fur, 0, len / 2, 0);
    seg.add(m);
    if (i % 2 === 1) {
      const band = mesh(cyl(r0 * 1.06, r1 * 1.06, len * 0.34, 7), dark, 0, len * 0.62, 0);
      seg.add(band);
    }
    parent.add(seg);
    seg.position.set(0, i === 0 ? 0 : 0.068 - i * 0.002, i === 0 ? 0 : -0.012);
    seg.rotation.z = i === 0 ? -0.9 : 0.42;
    segs.push(seg);
    parent = seg;
  }

  /* ---- состояния поведения ---- */
  const st = {
    baseY: null, blink: 0, nextBlink: 1.5 + Math.random() * 3,
    groom: 0, nextGroom: 9 + Math.random() * 9, stretch: 0, nextStretch: 16 + Math.random() * 12,
    look: 0, mood: 0, pet: 0,
  };

  /** Погладить кота: он задирает голову, прищуривается и быстрее машет хвостом. */
  g.userData.pet = () => { st.pet = 2.2; st.groom = 0; st.stretch = 0; return true; };

  g.userData.update = (dt, t, moving, look) => {
    if (st.baseY === null) st.baseY = g.position.y;
    st.look += ((look ? 1 : 0) - st.look) * Math.min(1, dt * 3);

    // дыхание
    const breath = Math.sin(t * 1.6) * 0.5 + 0.5;
    chest.scale.set(1.0 + breath * 0.035, 1.25 + breath * 0.045, 0.86 + breath * 0.03);

    // хвост: спокойное помахивание + подёргивание кончиком
    const happy = st.pet > 0 ? 1 : 0;
    const flick = Math.sin(t * 0.7) * 0.12 + (Math.random() < 0.006 ? 0.45 : 0);
    tail.rotation.y = Math.sin(t * (happy ? 3.4 : 0.9)) * (happy ? 0.3 : 0.10) + flick * 0.4;
    tail.rotation.x = 0.15 + Math.sin(t * 0.55) * 0.05;
    for (let i = 0; i < segs.length; i++) {
      const k = i / segs.length;
      segs[i].rotation.y = Math.sin(t * (happy ? 3.4 : 1.3) + i * 0.5) * (happy ? 0.3 : 0.10) * k + flick * k * 0.5;
      segs[i].rotation.x = i === 0 ? -0.9 : 0.42 + Math.sin(t * 1.1 + i * 0.4) * 0.06 * k;
    }

    // уши поворачиваются к хозяину
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      ears[i].rotation.z = s * (0.2 - st.look * 0.12) + Math.sin(t * 1.7 + i) * 0.05;
      ears[i].rotation.x = -0.12 + st.look * 0.1 + Math.sin(t * 2.3 + i * 2) * 0.04;
    }

    // моргание
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) { st.blink = 0.18; st.nextBlink = 1.8 + Math.random() * 4.2; }
    if (st.blink > 0) {
      st.blink -= dt;
      const k = Math.max(0, st.blink / 0.18);
      for (const e of eyes) e.lid.visible = k > 0.25;
      for (const e of eyes) e.eye.scale.y = 1 - k * 0.75;
      for (const e of eyes) e.pupil.scale.y = 1.25 - k * 1.1;
    } else {
      for (const e of eyes) { e.lid.visible = false; e.eye.scale.y = 1; e.pupil.scale.y = 1.25; }
    }

    // вылизывание лапы
    st.nextGroom -= dt;
    if (st.pet > 0) {
      // кот в восторге от ласки
      st.pet -= dt;
      const k = Math.min(1, st.pet / 2.2);
      const p = Math.sin(Math.PI * Math.min(1, (2.2 - st.pet) / 2.2)) * 0.9 + 0.1;      head.rotation.x = -0.55 * p;
      head.rotation.y = Math.sin(t * 2.2) * 0.12;
      head.position.y = 0.355 + 0.055 * p;
      torso.rotation.x = -0.08 * p;
      for (const e of eyes) { e.lid.visible = true; e.eye.scale.y = 0.45; e.pupil.scale.y = 0.5; }
      chest.scale.set(1.0 + breath * 0.035, 1.25 + breath * 0.045 + p * 0.02, 0.86 + breath * 0.03);
    } else if (st.groom > 0) {
      st.groom -= dt;
      const k = Math.min(1, st.groom);
      frontLegs[0].rotation.x = -1.5 * k;
      frontLegs[0].rotation.z = 0.35 * k;
      head.rotation.x = 0.55 * k;
      head.rotation.y = 0.3 * k;
      head.position.y = 0.355 - 0.075 * k;
      if (st.groom <= 0) {
        frontLegs[0].rotation.x = 0; frontLegs[0].rotation.z = 0;
        st.nextGroom = 11 + Math.random() * 12;
      }
    } else {
      // потягивание
      st.nextStretch -= dt;
      if (st.nextStretch <= 0) { st.stretch = 1.6; st.nextStretch = 18 + Math.random() * 14; }
      if (st.stretch > 0) {
        st.stretch -= dt;
        const k = Math.sin(Math.PI * Math.min(1, st.stretch / 1.6));
        frontLegs[0].rotation.x = -0.9 * k;
        frontLegs[1].rotation.x = -0.9 * k;
        torso.rotation.x = 0.16 * k;
        head.rotation.x = -0.4 * k;
        head.position.y = 0.355 + 0.03 * k;
        chest.scale.z = 0.86 + k * 0.1;
      } else {
        // следим за хозяином
        head.rotation.x = Math.sin(t * 0.6) * 0.05;
        head.rotation.y = st.look * Math.sin(t * 0.9) * 0.45 + Math.sin(t * 0.35) * 0.12;
        head.position.y = 0.355;
        torso.rotation.x = 0;
      }
    }
    g.position.y = st.baseY + Math.sin(t * 1.25) * 0.004;
  };
  return g;
}
