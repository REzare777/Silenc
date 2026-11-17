import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, gableEnds, hipRoof, roofShell, mat, plane } from './geo.js';

/* ------------------------------------------------------------------ *
 *  Здания долины
 * ------------------------------------------------------------------ */

/** Повёрнутый прямоугольник (OBB) — точная форма стены под любым углом. */
export function rotatedAABB(cx, cz, hw, hd, ry) {
  return { cx, cz, hx: hw, hz: hd, ang: ry };
}

/** Локальный прямоугольник (в системе постройки) -> повёрнутый прямоугольник. */
export function localBox(px, pz, ry, lx, lz, w, d, y = 0) {
  const wx = px + lx * Math.cos(ry) + lz * Math.sin(ry);
  const wz = pz - lx * Math.sin(ry) + lz * Math.cos(ry);
  return { cx: wx, cz: wz, hx: w / 2, hz: d / 2, ang: ry, y };
}

/** Локальный прямоугольник с собственным поворотом -> повёрнутый прямоугольник. */
export function localOriented(px, pz, ry, lx, lz, w, d, ang, y = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const wx = px + lx * c + lz * s;
  const wz = pz - lx * s + lz * c;
  return { cx: wx, cz: wz, hx: w / 2, hz: d / 2, ang: ry + ang, y };
}

/** Каркас из бруса на фасаде (-z). Раскосы — только в свободных местах. */
function timberFrame(B, w, h, d, matKey = 'timber', braceXs = null) {
  const t = 0.19, z = -d / 2 - 0.05;
  for (const sx of [-1, 1]) B.put(matKey, t, h, t, sx * (w / 2 - t / 2 - 0.02), h / 2, z);
  if (w > 5) B.put(matKey, t, h, t, 0, h / 2, z);
  B.put(matKey, w, t, t, 0, h - t / 2 - 0.02, z);
  B.put(matKey, w, t, t, 0, 0.18, z);
  // небольшие угловые раскосы под коньком — не пересекают окна
  for (const sx of [-1, 1]) {
    const g = box(t * 0.8, 0.95, t, 1);
    const m = mat(sx * (w / 2 - 0.42), h - 0.52, z);
    m.multiply(new THREE.Matrix4().makeRotationZ(sx * 0.78));
    B.add(g, matKey, m);
  }
  // раскосы в свободных проёмах фасада
  if (braceXs) {
    for (const bx of braceXs) {
      const g = box(t * 0.85, 2.0, t, 1);
      const m = mat(bx, h * 0.4, z);
      m.multiply(new THREE.Matrix4().makeRotationZ(bx > 0 ? -0.7 : 0.7));
      B.add(g, matKey, m);
    }
  }
}

/**
 * Окно с глубокой откосной рамой и утопленным стеклом.
 * Откос вынесен вперёд — стекло тонет в проёме, а не лежит на стене.
 */
function addWindow(B, x, y, z, w = 0.85, h = 1.0, facing = 'z', lit = true) {
  const frame = 'timber';
  const dp = 0.26;   // глубина откоса
  if (facing === 'z') {
    // Направление наружу: для северного фасада (z > 0) откос и стекло
    // зеркалятся. Раньше стекло всегда смотрело в −Z, и на северной стене
    // окно выглядело пустой рамой — сквозь него было видно пустоту.
    const north = z > 0;
    const s = north ? 1 : -1;
    // косяки (в глубину) и переплёты
    B.put(frame, 0.13, h + 0.26, dp, x - w / 2 - 0.065, y, z + s * (dp / 2 - 0.04));
    B.put(frame, 0.13, h + 0.26, dp, x + w / 2 + 0.065, y, z + s * (dp / 2 - 0.04));
    B.put(frame, w + 0.26, 0.13, dp, x, y + h / 2 + 0.065, z + s * (dp / 2 - 0.04));
    // подоконник шире и выступает
    B.put(frame, w + 0.4, 0.11, dp + 0.12, x, y - h / 2 - 0.09, z + s * (dp / 2 - 0.02));
    // стекло — в глубине откоса
    B.add(new THREE.PlaneGeometry(w, h), lit ? 'windowLit' : 'windowDark',
      mat(x, y, z + s * 0.055, north ? 0 : Math.PI));
  } else {
    const right = x > 0;
    const ry = right ? Math.PI / 2 : -Math.PI / 2;
    const off = right ? dp / 2 - 0.04 : -(dp / 2 - 0.04);
    B.put(frame, dp, h + 0.26, 0.13, x, y, z - w / 2 - 0.065);
    B.put(frame, dp, h + 0.26, 0.13, x, y, z + w / 2 + 0.065);
    B.put(frame, dp, 0.13, w + 0.26, x, y + h / 2 + 0.065, z);
    B.put(frame, dp + 0.12, 0.11, w + 0.4, x, y - h / 2 - 0.09, z);
    B.add(new THREE.PlaneGeometry(w, h), lit ? 'windowLit' : 'windowDark',
      mat(x + off, y, z, ry));
  }
}

/** Крыша + карниз + конёк. */
function addRoof(B, w, d, roofH, roofMat, wallMat, overhang = 0.4, ridge = true, baseY = 0) {
  const by = baseY - 0.03;             // чуть ниже стены — чтобы не было щели
  const th = roofMat === 'thatch' ? 0.36 : 0.2;   // толщина кровли
  const shell = roofShell(w, d, roofH, { overhang, thickness: th, scale: 1.7 });
  for (const g of shell.outer) B.add(g, roofMat, mat(0, by, 0));   // скаты снаружи
  for (const g of shell.inner) B.add(g, 'plank', mat(0, by, 0));   // дощатый потолок изнутри
  for (const g of shell.edges) B.add(g, roofMat, mat(0, by, 0));   // толщина по карнизам и фронтонам
  // фронтон — кровельный материал, по полной глубине крыши: торцы без щелей
  B.add(gableEnds(w + 0.16, d, roofH, 1.7, shell.D), roofMat, mat(0, by, 0));

  // стропильные выпуски под карнизом + карнизная доска
  const slope = Math.atan2(roofH, shell.D / 2);
  const nR = Math.max(3, Math.round(w / 0.85));
  for (const sz of [-1, 1]) {
    for (let i = 0; i <= nR; i++) {
      const x = -shell.W / 2 + 0.4 + (shell.W - 0.8) * (i / nR);
      B.add(box(0.11, 0.13, 0.62, 1), 'timber',
        mat(x, by - th - 0.03, sz * (shell.D / 2 - 0.2), 0, sz * slope, 0));
    }
    B.put('timber', shell.W + 0.02, 0.19, 0.09, 0, by - th - 0.11, sz * (shell.D / 2 - 0.02));
  }
  if (ridge) {
    B.put('timber', shell.W + 0.1, 0.2, 0.26, 0, by + roofH - 0.04, 0);
    if (roofMat === 'thatch') {
      // соломенный гребень: округлёный конёк поверх стропил
      B.add(cyl(0.17, 0.17, shell.W + 0.04, 8), 'thatch',
        mat(0, by + roofH + 0.05, 0, 0, 0, Math.PI / 2));
    }
  }
}

/** Печная труба. */
function addChimney(B, x, z, topY, baseY = 0) {
  const h = Math.max(0.8, topY - baseY);
  B.put('stone', 0.6, h, 0.6, x, baseY + h / 2, z, 0.9);
  B.put('stoneDark', 0.84, 0.2, 0.84, x, topY + 0.1, z);
}

/**
 * Стрельчатое окно с аркой, переплётом и подоконником.
 * side = +1 (стена смотрит в +x) или -1.
 */
function archWindow(B, x, y, z, side, ww = 1.0, wh = 2.3) {
  const wx = Math.abs(x);
  const ry = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  // стекло (чуть выступает из стены, иначе его не видно)
  B.add(new THREE.PlaneGeometry(ww, wh), 'windowLit', mat(side * (wx + 0.05), y, z, ry));
  // вертикальный и горизонтальный переплёт
  B.put('stoneDark', 0.12, wh, 0.09, side * (wx + 0.10), y, z, 1);
  B.put('stoneDark', 0.12, 0.09, ww, side * (wx + 0.10), y - wh * 0.18, z, 1);
  // косяки
  for (const sz of [-1, 1]) {
    B.put('stoneDark', 0.34, wh + 0.2, 0.18, side * (wx + 0.08), y, z + sz * (ww / 2 + 0.09), 1);
  }
  // арка: свод и стеклянный сегмент
  B.add(cyl(ww / 2 + 0.17, ww / 2 + 0.17, 0.36, 12, true), 'stoneDark',
    mat(side * (wx + 0.08), y + wh / 2, z, 0, 0, Math.PI / 2));
  B.add(new THREE.CircleGeometry(ww / 2, 12, 0, Math.PI), 'windowLit',
    mat(side * (wx + 0.05), y + wh / 2, z, ry));
  // замковый камень
  B.put('stoneDark', 0.36, 0.3, 0.3, side * (wx + 0.10), y + wh / 2 + ww / 2 + 0.12, z, 1);
  // подоконник
  B.put('stone', 0.5, 0.16, ww + 0.52, side * (wx + 0.14), y - wh / 2 - 0.1, z, 1);
}

/**
 * Роза-окно: круглый переплёт с гурями на фасаде, смотрит в -z.
 */
function roseWindow(B, x, y, z) {
  // стеклянный круг
  B.add(new THREE.CircleGeometry(0.86, 18), 'windowLit', mat(x, y, z - 0.02, Math.PI));
  // спицы-гуры
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    B.put('stoneDark', 0.09, 1.6, 0.1, x, y, z - 0.12, 1, [0, 0, a]);
  }
  // внутреннее кольцо и ступица
  B.add(torus(0.42, 0.06, 6, 14), 'stoneDark', mat(x, y, z - 0.12));
  B.add(cyl(0.13, 0.13, 0.16, 8), 'stoneDark', mat(x, y, z - 0.14, 0, Math.PI / 2));
  // наружное кольцо
  B.add(torus(0.95, 0.16, 8, 18), 'stoneDark', mat(x, y, z - 0.14));
}


/* ---------------------------- домик ---------------------------- */
export function cottage(M, opts = {}) {
  const {
    w = 6, d = 5, h = 3.1, roofH = 2.5, floors = 1, roof = 'thatch',
    wall = 'plaster', chimney = true, doorW = 1.05, porch = true, lit = true,
  } = opts;

  const B = new Builder();
  const roofMat = roof === 'thatch' ? 'thatch' : (roof === 'slate' ? 'tileSlate' : 'tile');

  B.put('stone', w + 0.24, 0.55, d + 0.24, 0, 0.275, 0, 1.1);
  const wallH = floors > 1 ? h * 1.74 : h;
  B.put(wall, w, wallH, d, 0, 0.5 + wallH / 2, 0, 2.2);

  timberFrame(B, w, wallH, d);
  for (const sx of [-1, 1]) {
    B.put('timber', 0.16, wallH, 0.19, sx * (w / 2 + 0.02), 0.5 + wallH / 2, -d / 2 + 0.3);
    B.put('timber', 0.16, wallH, 0.19, sx * (w / 2 + 0.02), 0.5 + wallH / 2, d / 2 - 0.3);
  }

  // дверь: косяки, перемычка, створка
  // дверь: косяки, перемычка, створка (по центру фасада — так окна симметричны)
  const dx = 0;
  B.put('timber', 0.16, 2.1, 0.24, dx - doorW / 2 - 0.08, 1.55, -d / 2 - 0.07);
  B.put('timber', 0.16, 2.1, 0.24, dx + doorW / 2 + 0.08, 1.55, -d / 2 - 0.07);
  B.put('timber', doorW + 0.32, 0.18, 0.24, dx, 2.6, -d / 2 - 0.07);
  B.put('plank', doorW, 1.95, 0.1, dx, 1.48, -d / 2 - 0.13);
  B.put('iron', 0.09, 0.09, 0.06, dx + doorW * 0.32, 1.35, -d / 2 - 0.19);
  B.put('stone', doorW + 0.5, 0.14, 0.7, dx, 0.55, -d / 2 - 0.3);

  // окна — строго симметрично относительно центра фасада и целиком внутри стены
  const winX = w * 0.33;
  const winY = 1.85;
  addWindow(B, winX, winY, -d / 2 - 0.02, 0.9, 1.05, 'z', lit);
  addWindow(B, -winX, winY, -d / 2 - 0.02, 0.9, 1.05, 'z', lit);
  for (const sx of [-1, 1]) {
    addWindow(B, sx * (w / 2 + 0.02), winY, d * 0.24, 0.8, 0.95, 'x', lit);
    addWindow(B, sx * (w / 2 + 0.02), winY, -d * 0.24, 0.8, 0.95, 'x', lit);
  }
  if (floors > 1) {
    const upY = 0.5 + wallH - 1.25;          // верхний ряд — под карнизом
    addWindow(B, winX, upY, -d / 2 - 0.02, 0.85, 1.0, 'z', lit);
    addWindow(B, -winX, upY, -d / 2 - 0.02, 0.85, 1.0, 'z', lit);
    for (const sx of [-1, 1]) {
      addWindow(B, sx * (w / 2 + 0.02), upY, d * 0.24, 0.7, 0.85, 'x', lit);
      addWindow(B, sx * (w / 2 + 0.02), upY, -d * 0.24, 0.7, 0.85, 'x', lit);
    }
  }

  const roofBase = 0.5 + wallH;
  addRoof(B, w, d, roofH, roofMat, wall, 0.4, true, roofBase);
  if (chimney) addChimney(B, w * 0.28, d * 0.16, roofBase + roofH + 1.1, roofBase);

  if (porch) {
    // Каменный цоколь: без него настил и ступень «висели» в воздухе.
    B.put('stone', doorW + 1.4, 0.36, 1.0, dx, 0.18, -d / 2 - 0.62);
    B.put('stone', doorW + 0.5, 0.14, 0.44, dx, 0.07, -d / 2 - 1.28);
    B.put('plank', doorW + 1.4, 0.12, 1.0, dx, 0.42, -d / 2 - 0.62);
    B.put('plank', doorW + 0.5, 0.14, 0.44, dx, 0.21, -d / 2 - 1.28);
    B.put('timber', 0.12, 2.28, 0.12, dx - (doorW + 1.0) / 2, 1.7, -d / 2 - 0.98);
    B.put('timber', 0.12, 2.28, 0.12, dx + (doorW + 1.0) / 2, 1.7, -d / 2 - 0.98);
    const ps = roofShell(doorW + 1.4, 1.5, 0.45, { overhang: 0.12, thickness: 0.14, scale: 1 });
    for (const g of ps.outer) B.add(g, roofMat, mat(dx, 2.82, -d / 2 - 0.55));
    for (const g of ps.inner) B.add(g, 'plank', mat(dx, 2.82, -d / 2 - 0.55));
    for (const g of ps.edges) B.add(g, roofMat, mat(dx, 2.82, -d / 2 - 0.55));
  }

  const group = B.build(M, null, { name: 'cottage' });
  const out = { group, colliders: [], platforms: [], windowLights: [], chimney: new THREE.Vector3() };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz);
    group.rotation.y = ry;
    group.updateMatrixWorld(true);
    out.colliders.push(rotatedAABB(px, pz, w / 2, d / 2, ry));
    if (porch) {
      out.platforms.push(localBox(px, pz, ry, dx, -d / 2 - 0.62, doorW + 1.4, 1.0, 0.48));
      out.platforms.push(localBox(px, pz, ry, dx, -d / 2 - 1.28, doorW + 0.5, 0.44, 0.28));
    }
    out.windowLights = [];
    group.traverse((o) => {
      if (o.isMesh && o.material === M.windowLit) {
        const p = new THREE.Vector3(); o.getWorldPosition(p);
        out.windowLights.push(p);
      }
    });
    out.chimney.set(w * 0.28, 0.5 + wallH + roofH + 0.85, d * 0.16).applyMatrix4(group.matrixWorld);
    return out;
  };
  return out;
}

/* ---------------------------- таверна ---------------------------- */
/**
 * Таверна: фасад снаружи и интерьер (см. `world/tavern.js`) — одно и то же
 * здание. Размеры и окна совпадают: 15 × 18 м, южный фасад с дверью
 * по центру и двумя окнами, три высоких окна на северной стороне
 * (по одному на каждую комнату-нишу) и одно высокое окно над баром.
 */
export function tavern(M, opts = {}) {
  const { w = 15, d = 18, h = 3.6, roofH = 3.4 } = opts;
  const B = new Builder();
  const wallH = h * 1.85;

  B.put('stone', w + 0.3, 0.6, d + 0.3, 0, 0.3, 0, 1.1);
  B.put('tavernWall', w, wallH, d, 0, 0.55 + wallH / 2, 0, 2.4);
  timberFrame(B, w, wallH, d, 'timber', [-w / 2 + 0.95, w / 2 - 0.95]);

  // второй этаж — overhang
  B.put('tavernWall', w + 0.3, 0.26, d + 0.3, 0, 0.55 + wallH - 0.13, 0, 2.4);
  B.put('timber', w + 0.36, 0.2, d + 0.36, 0, 0.55 + wallH - 0.32, 0);
  B.put('timber', w + 0.36, 0.2, d + 0.36, 0, 0.55 + wallH + 0.05, 0);

  // дверь — по центру южного фасада, как и дверь внутри
  const dx = 0;
  B.put('timber', 0.18, 2.3, 0.26, dx - 0.78, 1.7, -d / 2 - 0.08);
  B.put('timber', 0.18, 2.3, 0.26, dx + 0.78, 1.7, -d / 2 - 0.08);
  B.put('timber', 1.9, 0.2, 0.26, dx, 2.85, -d / 2 - 0.08);
  B.put('plank', 1.35, 2.15, 0.12, dx, 1.62, -d / 2 - 0.15);
  B.put('iron', 0.1, 0.1, 0.07, dx + 0.45, 1.45, -d / 2 - 0.22);
  B.put('iron', 0.1, 0.1, 0.07, dx + 0.45, 2.05, -d / 2 - 0.22);
  // порог и ступень — на каменном цоколе (иначе плита висела в воздухе)
  B.put('stone', 2.6, 0.47, 0.9, dx, 0.235, -d / 2 - 0.55);
  B.put('stone', 2.6, 0.24, 0.6, dx, 0.12, -d / 2 - 1.25);

  /* Окна фасада — те же места, что и окна внутри (см. world/tavern.js):
     • юг (вход):  x = ±3.5,  y = 1.5   — нижний ряд зала;
     • юг (галерея): x = -2.6 / 0 / 2.6, y = 5.09 — окна второго этажа;
     • север:      x = -1.15 / 2.25 / 5.5, y = 5.5 — по одному на каждую нишу;
     • восток:     z = -3.6, y = 5.2     — высокое окно над стойкой.
     На западной стене вместо окон — труба очага и труба кухонной печи. */
  const upY = 0.55 + wallH - 1.75;           // верхний ряд — под карнизом второго этажа
  for (const fx of [-3.5, 3.5]) addWindow(B, fx, 1.5, -d / 2 - 0.02, 1.3, 1.7, 'z', true);
  for (const fx of [-2.6, 0, 2.6]) addWindow(B, fx, upY, -d / 2 - 0.02, 0.95, 1.1, 'z', true);
  for (const fx of [-1.15, 2.25, 5.5]) addWindow(B, fx, 5.5, d / 2 + 0.02, 1.2, 1.5, 'z', true);
  addWindow(B, w / 2 + 0.02, 5.2, -3.6, 1.2, 1.5, 'x', true);

  // труба очага (западная стена) и кухонной печи (северная) — как в интерьере
  B.put('stoneDark', 1.5, 2.2, 1.1, -w / 2 + 0.42, 0.55 + wallH - 1.1, 0, 1.3);
  B.put('stoneDark', 1.7, 0.24, 1.3, -w / 2 + 0.42, 0.55 + wallH + 0.12, 0, 1.3);
  B.put('stoneDark', 1.1, 1.8, 1.0, -4.6, 0.55 + wallH - 0.9, d / 2 - 0.42, 1.3);
  B.put('stoneDark', 1.3, 0.24, 1.2, -4.6, 0.55 + wallH + 0.12, d / 2 - 0.42, 1.3);

  const roofBase = 0.55 + wallH;
  addRoof(B, w, d, roofH, 'tile', 'tavernWall', 0.5, true, roofBase);
  addChimney(B, w * 0.3, d * 0.2, roofBase + roofH + 2.0, roofBase);

  // вывеска на кронштейне — прямо над дверью, чтобы таверну было узнать
  const sx = dx;
  const signY = 3.72, signZ = -d / 2 - 1.3;
  // кронштейн: горизонтальная лафа + две косые консоли по краям
  B.put('iron', 0.1, 0.1, 1.45, sx, 4.52, -d / 2 - 0.85);
  for (const s of [-1, 1]) {
    const ax = sx + s * 0.86, ay = 4.5, az = -d / 2 - 1.48;
    const bx = sx + s * 0.86, by = 3.16, bz = -d / 2 - 0.14;
    const dxv = bx - ax, dyv = by - ay, dzv = bz - az;
    const len = Math.hypot(dxv, dyv, dzv);
    const g = cyl(0.042, 0.042, len, 5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dxv, dyv, dzv).normalize(),
    );
    m.compose(
      new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2),
      q, new THREE.Vector3(1, 1, 1),
    );
    B.add(g, 'iron', m);
  }
  // полотно вывески — доска в раме
  B.add(box(1.85, 1.25, 0.13, 1), 'plank', mat(sx, signY, signZ));
  for (const s of [-1, 1]) {
    B.add(box(0.11, 1.38, 0.17, 1), 'timber', mat(sx + s * 0.92, signY, signZ));
  }
  B.add(box(2.0, 0.11, 0.17, 1), 'timber', mat(sx, signY + 0.62, signZ));
  B.add(box(2.0, 0.11, 0.17, 1), 'timber', mat(sx, signY - 0.62, signZ));
  // эмблема на вывеске: кружка с пеной
  B.add(cyl(0.27, 0.23, 0.36, 12), 'brass', mat(sx, signY + 0.05, signZ - 0.14, Math.PI / 2));
  B.add(cyl(0.225, 0.225, 0.07, 12), 'cloth', mat(sx, signY + 0.29, signZ - 0.14, Math.PI / 2));
  B.add(torus(0.16, 0.03, 5, 10), 'brass', mat(sx + 0.3, signY + 0.05, signZ - 0.14, 0, Math.PI / 2));

  // бочка у входа — визуальный признак трактира
  const barrelX = dx + 1.35, barrelZ = -d / 2 - 0.62;
  B.add(cyl(0.32, 0.28, 0.82, 12), 'oakDoor', mat(barrelX, 0.41, barrelZ));
  for (const yy of [0.18, 0.62]) {
    B.add(cyl(0.335, 0.335, 0.06, 12), 'iron', mat(barrelX, yy, barrelZ));
  }
  B.add(cyl(0.3, 0.3, 0.05, 12), 'plank', mat(barrelX, 0.84, barrelZ));
  B.add(cyl(0.055, 0.055, 0.5, 6), 'iron', mat(barrelX + 0.1, 1.06, barrelZ, 0, 0, 0.35));

  // скамья у стены — в стороне от окон
  const benchX = w * 0.4;
  B.put('plank', 2.2, 0.14, 0.5, benchX, 0.62, -d / 2 - 0.5);
  B.put('timber', 0.16, 0.44, 0.42, benchX - 0.85, 0.22, -d / 2 - 0.5);
  B.put('timber', 0.16, 0.44, 0.42, benchX + 0.85, 0.22, -d / 2 - 0.5);
  B.put('plank', 2.2, 0.1, 0.9, benchX, 0.42, -d / 2 - 0.55);

  const group = B.build(M, null, { name: 'tavern' });
  const out = { group, colliders: [], circles: [], platforms: [], windowLights: [] };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    group.updateMatrixWorld(true);
    out.colliders.push(rotatedAABB(px, pz, w / 2, d / 2, ry));
    // бочка у входа — круглый коллайдер в мировых координатах
    {
      const c = Math.cos(ry), s = Math.sin(ry);
      out.circles.push({
        x: px + barrelX * c + barrelZ * s,
        z: pz - barrelX * s + barrelZ * c,
        r: 0.42,
      });
    }
    out.platforms.push(localBox(px, pz, ry, w * 0.05, -d / 2 - 0.55, 2.6, 0.9, 0.47));
    out.platforms.push(localBox(px, pz, ry, w * 0.05, -d / 2 - 1.25, 2.6, 0.6, 0.24));
    out.windowLights = [];
    group.traverse((o) => {
      if (o.isMesh && o.material === M.windowLit) {
        const p = new THREE.Vector3(); o.getWorldPosition(p); out.windowLights.push(p);
      }
    });
    return out;
  };
  return out;
}

/* ---------------------------- церковь ---------------------------- */
export function church(M, opts = {}) {
  const { w = 9, d = 17, h = 6.5, towerH = 13 } = opts;
  const B = new Builder();

  // неф
  B.put('stone', w + 0.5, 0.7, d + 0.5, 0, 0.35, 0, 1.2);
  B.put('stone', w, h, d, 0, 0.6 + h / 2, 0, 1.6);
  // крыша нефа: скаты + фронтоны + конёк и обшивка
  const RW = w + 1.0, RD = d + 1.0, RH = 3.2;
  const chs = roofShell(w + 0.06, d, RH, { overhang: (RW - w - 0.06) / 2, thickness: 0.22, scale: 1.6 });
  for (const g of chs.outer) B.add(g, 'tileSlate', mat(0, 0.6 + h - 0.03, 0));
  for (const g of chs.inner) B.add(g, 'tileSlate', mat(0, 0.6 + h - 0.03, 0));
  for (const g of chs.edges) B.add(g, 'tileSlate', mat(0, 0.6 + h - 0.03, 0));
  B.add(gableEnds(w + 0.12, d, RH, 1.6, chs.D), 'tileSlate', mat(0, 0.6 + h - 0.03, 0));

  B.put('stoneDark', RW + 0.12, 0.22, 0.3, 0, 0.6 + h + RH - 0.04, 0);        // конёк
  for (const sz of [-1, 1]) {
    B.put('timber', RW + 0.14, 0.2, 0.16, 0, 0.6 + h + 0.04, sz * (RD / 2 - 0.07)); // обшивка
  }
  // водосточные трубы по углам нефа
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put('iron', 0.12, 0.6 + h - 0.2, 0.12, sx * (w / 2 - 0.15), (0.6 + h - 0.2) / 2 + 0.7, sz * (d / 2 - 0.9));
  }

  // окна нефа — стрельчатые, с аркой, переплётом и подоконником
  for (let i = 0; i < 4; i++) {
    const z = -d / 2 + 3.4 + i * 3.5;
    for (const sx of [-1, 1]) {
      archWindow(B, sx * (w / 2), 3.1, z, sx > 0 ? 1 : -1, 1.0, 2.3);
      // контрфорс
      B.put('stone', 0.7, 3.4, 0.7, sx * (w / 2 + 0.35), 2.3, z, 1.2);
    }
  }
  // портал
  B.put('stoneDark', 3.1, 3.6, 0.4, 0, 2.3, -d / 2 - 0.1, 1.2);
  B.add(cyl(1.5, 1.5, 0.4, 10, true), 'stoneDark', mat(0, 4.15, -d / 2 - 0.1, 0, Math.PI / 2, 0));
  B.put('stoneDark', 3.3, 0.26, 0.55, 0, 5.05, -d / 2 - 0.1, 1.2);
  B.put('plank', 2.2, 3.0, 0.16, 0, 2.1, -d / 2 - 0.22);
  B.put('iron', 0.12, 3.0, 0.2, 0, 2.1, -d / 2 - 0.3);
  B.put('stone', 4.0, 0.72, 1.2, 0, 0.36, -d / 2 - 0.6);
  B.put('stone', 3.2, 0.36, 0.6, 0, 0.18, -d / 2 - 1.5);

  // ------- задняя дверь нефа: большая дубовая створка с металлом -------
  const backDoor = { w: 2.5, h: 3.3 };
  {
    const bz = d / 2;                    // задняя стена
    const dw = backDoor.w, dh = backDoor.h;
    const fy = 0.6;                      // уровень пола нефа
    // каменный портал
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.55, dh + 0.5, 0.62, sx * (dw / 2 + 0.27), fy + (dh + 0.5) / 2 - 0.25, bz + 0.06, 1.2);
    }
    B.put('stoneDark', dw + 1.1, 0.5, 0.66, 0, fy + dh + 0.22, bz + 0.06, 1.2);
    B.put('stoneDark', dw + 1.5, 0.22, 0.85, 0, fy + dh + 0.55, bz + 0.12, 1.2);
    // створка: вертикальные доски из светлого дуба
    const planks = 7;
    for (let i = 0; i < planks; i++) {
      const px = -dw / 2 + (i + 0.5) * (dw / planks);
      B.put('oakDoor', dw / planks - 0.03, dh, 0.14, px, fy + dh / 2, bz + 0.02);
    }
    // металлические вставки: три обвязки, гвозди, петли, кольцо
    for (const by of [fy + 0.35, fy + dh * 0.5, fy + dh - 0.3]) {
      B.put('brass', dw + 0.04, 0.17, 0.19, 0, by, bz - 0.06);
      for (let i = 0; i < 6; i++) {
        B.add(sphere(0.055, 6, 5), 'brass', mat(-dw / 2 + 0.25 + i * ((dw - 0.5) / 5), by, bz - 0.15));
      }
    }
    for (const hy of [fy + 0.8, fy + dh - 0.75]) {
      B.put('iron', 0.42, 0.2, 0.2, -dw / 2 + 0.22, hy, bz - 0.05);
    }
    // кольцо-ручка и накладка
    B.add(torus(0.17, 0.035, 5, 12), 'iron', mat(dw / 2 - 0.34, fy + 1.5, bz - 0.16, 0, Math.PI / 2, 0));
    B.put('iron', 0.3, 0.42, 0.08, dw / 2 - 0.34, fy + 1.5, bz - 0.1);
    // ступени к двери
    B.put('stone', dw + 1.2, 0.2, 0.9, 0, fy - 0.5, bz + 0.55, 1.2);
    B.put('stone', dw + 0.9, 0.2, 0.6, 0, fy - 0.3, bz + 0.4, 1.2);
    B.put('stone', dw + 0.6, 0.2, 0.4, 0, fy - 0.1, bz + 0.25, 1.2);
  }

  // башня
  const tz = -d / 2 - 1.2;
  B.put('stone', 5.2, 0.9, 5.2, 0, 0.45, tz, 1.2);
  B.put('stone', 4.6, towerH, 4.6, 0, 0.9 + towerH / 2, tz, 1.6);
  // угловые пилястры
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put('stoneDark', 0.7, towerH, 0.7, sx * 2.3, 0.9 + towerH / 2, tz + sz * 2.3, 1.2);
  }
  // проёмы колокольни с лучковой аркой
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const nx = Math.sin(a) * 2.32, nz = Math.cos(a) * 2.32;
    B.put('stoneDark', 1.7, 2.2, 0.4, nx * 0.72, towerH - 0.4, tz + nz * 0.72, 1.2);
    B.add(cyl(0.85, 0.85, 0.44, 10, true), 'stoneDark',
      mat(nx * 0.72, towerH + 0.7, tz + nz * 0.72, a, Math.PI / 2, 0));
    B.add(plane(1.4, 1.9), 'dark', mat(nx * 0.82, towerH - 0.4, tz + nz * 0.82, 0, a));
    // колокол
    B.add(cyl(0.22, 0.42, 0.7, 8), 'brass', mat(nx * 0.78, towerH - 0.9, tz + nz * 0.78));
  }
  // карниз и шпиль
  B.put('stoneDark', 5.5, 0.36, 5.5, 0, 0.9 + towerH + 0.18, tz, 1.2);
  B.put('stoneDark', 5.9, 0.16, 5.9, 0, 0.9 + towerH + 0.42, tz, 1.2);
  B.add(cone(3.15, 5.8, 8), 'tileSlate', mat(0, 0.9 + towerH + 0.5 + 2.9, tz));
  // флюгер и крест
  B.put('brass', 0.1, 1.6, 0.1, 0, 0.9 + towerH + 9.3, tz);
  B.add(sphere(0.24, 8, 6), 'brass', mat(0, 0.9 + towerH + 10.1, tz));
  B.add(torus(0.4, 0.06, 6, 12), 'brass', mat(0, 0.9 + towerH + 9.6, tz, 0, Math.PI / 2));

  // роза-окно на фасаде башни: круглый переплёт с гурями
  roseWindow(B, 0, 7.2, tz - 2.32);

  const group = B.build(M, null, { name: 'church' });
  const out = { group, colliders: [], platforms: [], windowLights: [] };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    out.colliders.push(rotatedAABB(px, pz, w / 2, d / 2, ry));
    // Раньше перед фасадом стоял невидимый коллайдер 4,6 × 4,6 м: игрок
    // упирался в пустоту рядом с крыльцом и не мог обойти церковь.
    // Крыльцо низкое (0,72 м) — это площадка, а не стена, поэтому
    // здесь достаточно платформ ступеней.
    out.platforms.push(localBox(px, pz, ry, 0, -(d / 2 + 0.6), 4.0, 1.2, 0.72));
    out.platforms.push(localBox(px, pz, ry, 0, -(d / 2 + 1.5), 3.2, 0.6, 0.36));
    // ступени к задней двери
    out.platforms.push(localBox(px, pz, ry, 0, d / 2 + 0.55, backDoor.w / 2 + 0.6, 0.45, 0.1));
    out.platforms.push(localBox(px, pz, ry, 0, d / 2 + 0.25, backDoor.w / 2 + 0.3, 0.2, 0.3));
    out.platforms.push(localBox(px, pz, ry, 0, d / 2 + 0.1, backDoor.w / 2 + 0.2, 0.2, 0.5));
    return out;
  };
  return out;
}

/* ---------------------------- амбар ---------------------------- */
export function barn(M, opts = {}) {
  const { w = 12, d = 8, h = 5 } = opts;
  const B = new Builder();
  B.put('stone', w + 0.3, 0.5, d + 0.3, 0, 0.25, 0, 1.1);
  B.put('redCloth', w, h, d, 0, 0.5 + h / 2, 0, 2.2);
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 0.6 + i * (w - 1.2) / 6;
    B.put('timber', 0.26, h, 0.24, x, 0.5 + h / 2, -d / 2 - 0.02);
  }
  B.put('timber', w, 0.28, 0.26, 0, 0.5 + h - 0.16, -d / 2 - 0.02);
  B.put('timber', w, 0.24, 0.26, 0, 0.5 + 0.12, -d / 2 - 0.02);
  // раскосы
  for (const sx of [-1, 1]) {
    const g = box(0.2, 3.4, 0.2, 1);
    const m = mat(sx * 2.2, 2.6, -d / 2 - 0.04);
    m.multiply(new THREE.Matrix4().makeRotationZ(sx * 0.7));
    B.add(g, 'timber', m);
  }
  // ворота
  B.put('plank', 4.2, 3.6, 0.2, 0, 2.3, -d / 2 - 0.1);
  B.put('timber', 0.24, 3.6, 0.26, 0, 2.3, -d / 2 - 0.18);
  B.put('iron', 4.3, 0.18, 0.28, 0, 3.9, -d / 2 - 0.18);
  B.put('iron', 4.3, 0.18, 0.28, 0, 1.0, -d / 2 - 0.18);
  addWindow(B, -w * 0.36, 3.6, -d / 2 - 0.02, 0.7, 0.7, 'z', false);
  addWindow(B, w * 0.36, 3.6, -d / 2 - 0.02, 0.7, 0.7, 'z', false);
  addRoof(B, w, d, 3.4, 'thatch', 'redCloth', 0.55, true, 0.5 + h);
  const group = B.build(M, null, { name: 'barn' });
  const out = { group, colliders: [] };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    out.colliders.push(rotatedAABB(px, pz, w / 2, d / 2, ry));
    return out;
  };
  return out;
}

/* ---------------------------- мельница ---------------------------- */
/**
 * Мельница: полая каменная башня с проёмом-входом, винтовой лестницей внутри,
 * верхней галереей и площадкой на крыше.
 */
export function windmill(M, opts = {}) {
  const { r = 3.2, h = 9.6 } = opts;
  const B = new Builder();
  const RB = r * 1.12;        // радиус в основании
  const RT = r * 0.82;        // радиус вверху
  const WALL = 0.34;          // толщина стены
  const rOut = (y) => RB + (RT - RB) * (y / h);
  const rIn = (y) => rOut(y) - WALL;
  const SEG = 14;             // сегментов в круге
  const GAP = (2 * Math.PI) / SEG;
  const BACK = Math.PI;       // проёмы смотрят назад (-z)
  /** угол рядом с проёмом (выход с настила) — там забор прерывается */
  const nearDoor = (a) => {
    let da = a - BACK;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    return Math.abs(da) <= 0.34;
  };

  // ---------- стена башни: пояса, нижний и верхний с проёмами ----------
  const bands = [
    { y0: 0, y1: 2.7, gap: true },
    { y0: 2.7, y1: 5.0, gap: false },
    { y0: 5.0, y1: 7.2, gap: false },
    { y0: 7.2, y1: h - 2.2, gap: false },
    { y0: h - 2.2, y1: h, gap: true },
  ];
  for (const b of bands) {
    const r0 = rOut(b.y0), r1 = rOut(b.y1);
    // сетка вершин у всех поясов одна и та же — иначе видны щели
    const seg = b.gap ? SEG - 1 : SEG;
    const th = b.gap ? (SEG - 1) * (2 * Math.PI / SEG) : 2 * Math.PI;
    // общая сетка вершин для всех поясов: без неё видны щели
    const st = b.gap ? BACK + GAP / 2 : GAP / 2;
    B.add(new THREE.CylinderGeometry(r1, r0, b.y1 - b.y0, seg, 1, true, st, th),
      'stone', mat(0, (b.y0 + b.y1) / 2, 0));
    // внутренняя стена (нормали внутрь)
    const ig = new THREE.CylinderGeometry(r1 - WALL, r0 - WALL, b.y1 - b.y0, seg, 1, true, st, th);
    const im = new THREE.Matrix4().makeScale(-1, 1, 1);
    im.setPosition(0, (b.y0 + b.y1) / 2, 0);
    B.add(ig, 'stoneDark', im);
  }
  // цоколь и каменный пол
  B.add(new THREE.CylinderGeometry(RB, RB * 1.06, 0.6, SEG, 1, true), 'stoneDark', mat(0, 0.3, 0));
  B.add(cyl(rIn(0.15), rIn(0.15), 0.07, SEG), 'stone', mat(0, 0.035, 0));
  // венчающий карниз цоколя
  B.add(new THREE.CylinderGeometry(RB * 1.02, RB * 1.02, 0.16, SEG, 1, true), 'stone', mat(0, 0.66, 0));
  // пояс-карниз на уровне второго пояса
  B.add(new THREE.CylinderGeometry(rOut(5.0) + 0.07, rOut(5.0) + 0.07, 0.22, SEG, 1, true), 'stone', mat(0, 5.0, 0));

  // ---------- мельничный камень ----------
  // Жернов стоит на первом этаже у передней стены, чтобы лестница его не резала.
  {
    const mx = 0, mz = 1.55;
    B.add(cyl(1.08, 1.12, 0.2, 18), 'stoneDark', mat(mx, 0.42, mz));   // нижний камень (чаша)
    B.add(cyl(1.0, 1.02, 0.22, 18), 'stone', mat(mx, 0.62, mz));       // верхний жернов
    B.add(cyl(0.14, 0.14, 0.55, 8), 'timber', mat(mx, 0.98, mz));     // стержень
    B.add(box(1.15, 0.15, 0.17, 1), 'timber', mat(mx - 0.55, 0.82, mz, 0.12));
    B.add(cyl(0.4, 0.17, 0.6, 9), 'plank', mat(mx, 1.5, mz));         // воронка для зерна
    B.add(cyl(0.44, 0.44, 0.08, 9), 'timber', mat(mx, 1.82, mz));
    // мешки с зерном рядом
    for (const [sx, sz] of [[-1.5, 1.9], [-1.15, 2.5], [1.6, 2.1]]) {
      B.add(sphere(0.3, 9, 7), 'cloth', mat(sx, 0.28, sz));
      B.add(cyl(0.12, 0.16, 0.16, 7), 'cloth', mat(sx, 0.55, sz));
    }
  }

  // ---------- дверь ----------
  const dr = rOut(1.35);
  const jx = Math.sin(GAP / 2) * dr;
  const jz = -Math.cos(GAP / 2) * dr;
  for (const sx of [-1, 1]) B.put('timber', 0.2, 2.75, 0.62, sx * jx, 1.37, jz);
  B.put('timber', jx * 2 + 0.2, 0.26, 0.62, 0, 2.74, jz);
  B.put('stone', jx * 2 + 0.8, 0.16, 1.1, 0, 0.08, jz - 0.5);
  // небольшой навес над дверью на двух кронштейнах
  {
    const cy = 2.95, cd = 1.15;
    B.put('tile', jx * 2 + 1.3, 0.12, cd, 0, cy, jz - cd / 2 + 0.28, 1.35);
    B.put('timber', jx * 2 + 1.2, 0.14, 0.16, 0, cy - 0.1, jz - cd + 0.3, 1.35);
    for (const sx of [-1, 1]) {
      const g = box(0.12, 0.9, 0.12, 1);
      const m = mat(sx * (jx + 0.42), cy - 0.42, jz - 0.42);
      m.multiply(new THREE.Matrix4().makeRotationX(0.7));
      B.add(g, 'timber', m);
    }
  }
  // створка распахнута наружу
  const openA = 1.875;
  const ddx = Math.cos(openA), ddz = -Math.sin(openA);
  B.add(box(1.3, 2.15, 0.1, 1), 'plank',
    mat(jx + ddx * 0.66, 1.12, jz + ddz * 0.66, openA));
  for (const hy of [0.6, 1.72]) {
    B.add(box(0.18, 0.14, 0.12, 1), 'iron',
      mat(jx + ddx * 0.09, hy, jz + ddz * 0.09, openA));
  }

  // ---------- винтовая лестница ----------
  // Ровно TURNS витков: ступени идут с шагом в 1/N долю витка, а физика —
  // непрерывная винтовая поверхность (спираль в player.js), а не стопка коробок.
  // приводной вал в центре башни — вокруг него идёт винтовая лестница
  B.add(cyl(0.32, 0.32, h - 0.1, 12), 'timber', mat(0, h / 2 + 0.05, 0));
  for (let y = 1.2; y < h - 0.6; y += 1.9) {
    B.add(cyl(0.36, 0.36, 0.16, 12), 'iron', mat(0, y, 0));
  }
  // шкив на валу и кожаный привод к жернову
  B.add(cyl(0.42, 0.42, 0.14, 14), 'timber', mat(0, 2.45, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    B.add(box(0.06, 0.72, 0.08, 1), 'timber',
      mat(Math.cos(a) * 0.2, 2.45, Math.sin(a) * 0.2, -a));
  }
  B.add(box(0.05, 2.1, 0.1, 1), 'cloth', mat(0.42, 1.5, 0.9, -0.45));
  const TURNS = 3, NSTEP = Math.max(24, Math.round(h / 0.29));
  const DTH = Math.PI * 2 * TURNS / NSTEP;
  const RISE = h / NSTEP;
  const steps = [];
  for (let i = 0; i < NSTEP; i++) {
    const y = (i + 1) * RISE;                       // верх ступени
    const theta = BACK + (i + 0.5) * DTH;            // середина ступени
    const ro = rIn(y) - 0.06;
    const rm = (0.45 + ro) / 2;
    const half = rm * DTH / 2;
    const sx = Math.sin(theta), cz = Math.cos(theta);
    B.add(box(half * 2.06, 0.14, ro - 0.45, 1), 'plank', mat(sx * rm, y - 0.07, cz * rm, theta));
    B.add(box(half * 2, RISE, 0.07, 1), 'plank', mat(sx * (ro - 0.035), y - RISE / 2 - 0.07, cz * (ro - 0.035), theta));
    B.add(box(0.09, 1.0, 0.09, 1), 'timber', mat(sx * (ro - 0.12), y + 0.5, cz * (ro - 0.12), theta));
    B.add(box(half * 2, 0.09, 0.09, 1), 'timber', mat(sx * (ro - 0.12), y + 0.95, cz * (ro - 0.12), theta));
    steps.push({ theta, y, rm, half, ro });
  }

  // ---------- верх: пола убран — только смотровая площадка ----------
  // Лестница выходит на площадку сразу (последняя ступень = h), отдельного
  // настила и мостика в башне больше нет.
  const exitA = steps[NSTEP - 1].theta;
  // верхняя площадка лестницы: перемыкает зазор между последней ступенью
  // и смотровой площадкой, чтобы переход был сплошным
  const landR2 = 2.05, landW2 = 1.5, landD2 = 1.35;
  B.add(box(landW2, 0.14, landD2, 1), 'plank',
    mat(Math.sin(exitA) * landR2, h - 0.07, Math.cos(exitA) * landR2, exitA));

  // ---------- настил верха башни ----------
  // Крыша мельницы твёрдая: круглый настил закрывает верх башни, чтобы
  // с площадки нельзя было провалиться внутрь. Он же — «пол» под
  // последним витком лестницы. Физика «только сверху» (only: true) —
  // поднимающийся игрок в него не упирается и не подбрасывается.
  {
    const RTOP = rIn(h) - 0.03;
    // доски по кругу
    B.add(cyl(RTOP, RTOP, 0.1, SEG), 'plank', mat(0, h - 0.05, 0));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      B.add(box(RTOP * 2 * 0.98, 0.06, 0.1, 1), 'timber',
        mat(0, h + 0.02, 0, a));
    }
    // круглое ограждение по краю настила (кроме проёма лестницы)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - exitA), Math.cos(a - exitA))) < 0.5) continue;
      B.add(box(0.12, 1.0, 0.12, 1), 'timber',
        mat(Math.sin(a) * (RTOP - 0.08), h + 0.5, Math.cos(a) * (RTOP - 0.08), a));
    }
  }

  // ---------- смотровая площадка с забором (сзади, где не ходят крылья) ----------
  const galIn = rIn(h) - 0.01, galOut = rOut(h) + 1.55;
  const gA0 = 1.745, gA1 = 4.538, gN = 11;
  for (let i = 0; i < gN; i++) {
    const a = gA0 + (gA1 - gA0) * (i + 0.5) / gN;
    const rm = (galIn + galOut) / 2;
    const chord = 2 * galOut * Math.sin((gA1 - gA0) / gN / 2) * 1.08;
    B.add(box(chord, 0.14, galOut - galIn, 1), 'plank', mat(Math.sin(a) * rm, h - 0.07, Math.cos(a) * rm, a));
  }
  // забор: столбы и две продольные перекладины (проход у двери оставляем)
  const fr = galOut - 0.14, fN = 15;
  for (let i = 0; i <= fN; i++) {
    const a = gA0 + (gA1 - gA0) * (i / fN);
    if (nearDoor(a)) continue;
    B.add(box(0.14, 1.2, 0.14, 1), 'timber', mat(Math.sin(a) * fr, h + 0.6, Math.cos(a) * fr, a));
  }
  for (const railY of [h + 0.52, h + 0.98]) {
    for (let i = 0; i < fN; i++) {
      const am = gA0 + (gA1 - gA0) * ((i + 0.5) / fN);
      if (nearDoor(am)) continue;
      const seg = 2 * fr * Math.sin((gA1 - gA0) / fN / 2) * 1.14;
      B.add(box(seg, 0.1, 0.1, 1), 'timber', mat(Math.sin(am) * fr, railY, Math.cos(am) * fr, am));
    }
  }

  // ---------- шапка (колпак) с крыльями ----------
  // Шапка стоит на башне и поворачивается по ветру; вместе с ней вращаются
  // крылья, а их ступица крепится к самой шапке — всё вращающееся живёт
  // на здании, ничего не висит рядом отдельной палкой.
  const CAP_H = 3.4, CAP_R = RT + 0.12, CAP_T = 0.3;
  const HATCH = 0.52;                       // половина раствора люка (рад)
  const capSt = BACK + HATCH, capLen = 2 * Math.PI - 2 * HATCH;
  const CB = new Builder();
  // внешний конус
  CB.add(new THREE.CylinderGeometry(0.06, CAP_R, CAP_H, SEG, 1, true, capSt, capLen),
    'thatch', mat(0, CAP_H / 2, 0));
  // внутренний конус (толщина соломы) — видно изнутри башни
  CB.add(new THREE.CylinderGeometry(0.05, CAP_R - CAP_T, CAP_H - CAP_T, SEG, 1, true, capSt, capLen),
    'thatch', mat(0, (CAP_H - CAP_T) / 2 + 0.12, 0));
  // макушка
  CB.add(cyl(0.16, 0.2, 0.26, 8), 'timber', mat(0, CAP_H + 0.04, 0));
  CB.add(sphere(0.13, 10, 8), 'iron', mat(0, CAP_H + 0.22, 0));
  // деревянный обод, по которому шапка ходит по башне
  CB.add(new THREE.CylinderGeometry(CAP_R + 0.08, CAP_R + 0.08, 0.26, SEG, 1, true, capSt, capLen),
    'timber', mat(0, 0.05, 0));
  // закрепки обода
  for (let i = 0; i < SEG; i++) {
    const a = capSt + capLen * ((i + 0.5) / SEG);
    const px = Math.sin(a) * (CAP_R - 0.04), pz = Math.cos(a) * (CAP_R - 0.04);
    CB.add(box(0.2, 0.22, 0.24, 1), 'timber', mat(px, 0.02, pz, a));
  }
  // кромки люка: два бруса вдоль среза
  for (const sgn of [-1, 1]) {
    const a = BACK + sgn * HATCH;
    const bx = Math.sin(a) * (CAP_R - 0.05), bz = Math.cos(a) * (CAP_R - 0.05);
    const apex = new THREE.Vector3(0, CAP_H - 0.12, 0);
    const p0 = new THREE.Vector3(bx, 0.05, bz);
    const dir = new THREE.Vector3().subVectors(apex, p0);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(p0, apex).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    CB.add(box(0.14, len, 0.2, 1), 'timber', m);
  }
  // кронштейны под площадкой (остаются на башне, не на шапке):
  // диагональ от стены внизу — к краю настила вверху, прижаты к башне
  {
    const strut = (p0, p1, w) => {
      const dir = new THREE.Vector3().subVectors(p1, p0);
      const len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
      B.add(box(w, len, w, 1), 'timber', m);
    };
    for (let i = 0; i < 8; i++) {
      const a = gA0 + (gA1 - gA0) * (i + 0.5) / 8;
      const sx = Math.sin(a), cz = Math.cos(a);
      // точка на стене башни и точка на краю настила
      const wallR = rIn(h) - 0.06, edgeR = galOut - 0.22;
      strut(new THREE.Vector3(sx * wallR, h - 1.35, cz * wallR),
        new THREE.Vector3(sx * edgeR, h - 0.16, cz * edgeR), 0.15);
      // горизонтальная связь-распорка у края
      strut(new THREE.Vector3(sx * wallR, h - 0.34, cz * wallR),
        new THREE.Vector3(sx * edgeR, h - 0.34, cz * edgeR), 0.12);
    }
  }

  // ---------- крылья (крепятся к шапке) ----------
  const group = B.build(M, null, { name: 'windmill' });
  const out = { group, colliders: [], platforms: [], circles: [], blades: null, cap: null };
  const capGroup = new THREE.Group();
  capGroup.position.set(0, h, 0);
  group.add(capGroup);
  capGroup.add(CB.build(M, null, { name: 'millCap' }));

  const hub = new THREE.Group();
  // ступица вынесена вперёд от башни: крылья вращаются перед зданием,
  // по своей плоскости, и внутрь башни не заходят
  const HUB_Z = CAP_R + 0.9, HUB_Y = 1.35;
  hub.position.set(0, HUB_Y, HUB_Z);
  // приводной вал: от ступицы — в подшипник щита (вперёд не торчит)
  const shaft = new THREE.Mesh(cyl(0.17, 0.17, 1.95, 8), M.timber);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.82; shaft.castShadow = true;
  hub.add(shaft);
  // железная муфта на валу — у самой ступицы
  const coupling = new THREE.Mesh(cyl(0.24, 0.24, 0.18, 10), M.iron);
  coupling.rotation.x = Math.PI / 2; coupling.position.z = -0.28; coupling.castShadow = true;
  hub.add(coupling);
  // крестовина — венец крепления крыльев
  const cross = new THREE.Mesh(cyl(0.46, 0.46, 0.26, 10), M.timber);
  cross.rotation.x = Math.PI / 2; cross.position.z = 0.05; cross.castShadow = true;
  hub.add(cross);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    // короткий кронштейн у ступицы — длинной мачты нет, крылья держатся
    // прямо на крестовине, как у настоящей мельницы
    const stub = new THREE.Mesh(box(0.34, 0.7, 0.26, 1), M.timber);
    stub.position.y = 0.3; stub.castShadow = true;
    arm.add(stub);
    // парус: каркас из брусков + полотнище, начинается у самой крестовины
    for (let s = 0; s < 7; s++) {
      const y0 = 0.62 + s * 0.92;
      const sailG = new THREE.Group();
      for (const off of [0.08, 1.62]) {
        const rail = new THREE.Mesh(box(0.07, 0.9, 0.07, 1), M.timber);
        rail.position.set(off, y0, 0.03);
        sailG.add(rail);
      }
      for (let b = 0; b < 4; b++) {
        const bat = new THREE.Mesh(box(1.62, 0.06, 0.06, 1), M.timber);
        bat.position.set(0.85, y0 - 0.38 + b * 0.25, 0.03);
        sailG.add(bat);
      }
      const cloth = new THREE.Mesh(box(1.48, 0.82, 0.03, 1), M.cloth);
      cloth.position.set(0.85, y0, -0.03);
      cloth.castShadow = true;
      sailG.add(cloth);
      sailG.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      arm.add(sailG);
    }
    hub.add(arm);
  }
  capGroup.add(hub);
  out.blades = hub;
  out.cap = capGroup;

  // щит с подшипником — на фронте шапки, вал уходит в него
  {
    const HB = new Builder();
    // щит с подшипником — на фронте шапки, вал уходит в него
    const coneR = CAP_R + (0.06 - CAP_R) * (HUB_Y / CAP_H);
    const zShield = coneR - 0.04;
    // доска щита прилегает к коносу шапки
    HB.add(box(1.3, 1.25, 0.18, 1), 'timber', mat(0, HUB_Y, zShield + 0.06));
    // обвязка щита
    for (const sy of [-1, 1]) {
      HB.add(box(0.13, 1.35, 0.26, 1), 'timber', mat(sy * 0.6, HUB_Y, zShield + 0.1));
    }
    HB.add(box(1.34, 0.14, 0.26, 1), 'timber', mat(0, HUB_Y + 0.62, zShield + 0.1));
    HB.add(box(1.34, 0.14, 0.26, 1), 'timber', mat(0, HUB_Y - 0.62, zShield + 0.1));
    // железное кольцо-подшипник в щите
    HB.add(cyl(0.34, 0.34, 0.22, 12), 'iron', mat(0, HUB_Y, zShield + 0.24, 0, Math.PI / 2, 0));
    // консоль-подкос под вал: от низа щита к валу (внутри силуэта шапки)
    {
      const a0 = new THREE.Vector3(0, HUB_Y - 0.6, zShield + 0.16);
      const a1 = new THREE.Vector3(0, HUB_Y - 0.1, HUB_Z - 0.55);
      const dir2 = new THREE.Vector3().subVectors(a1, a0);
      const len2 = dir2.length();
      const q2 = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), dir2.clone().normalize());
      const m2 = new THREE.Matrix4().compose(
        new THREE.Vector3().addVectors(a0, a1).multiplyScalar(0.5), q2, new THREE.Vector3(1, 1, 1));
      HB.add(box(0.16, len2, 0.16, 1), 'timber', m2);
    }
    capGroup.add(HB.build(M, null, { name: 'millShield' }));
  }

  // ---- постоянный свет внутри башни: фонарь у жернова и лампа наверху ----
  {
    const lamp = new THREE.Group();
    const body = new THREE.Mesh(cyl(0.1, 0.13, 0.26, 7), M.iron);
    const glass = new THREE.Mesh(box(0.15, 0.2, 0.15), M.lampGlass);
    glass.position.y = -0.16;
    lamp.add(body, glass);
    lamp.position.set(1.15, 2.05, 1.2);
    group.add(lamp);
    const l1 = new THREE.PointLight(0xffb45a, 2.6, 10, 1.8);
    l1.position.set(1.15, 1.85, 1.2);
    group.add(l1);
    const l2 = new THREE.PointLight(0xffc074, 1.9, 12, 1.9);
    l2.position.set(0, 7.4, 0);
    group.add(l2);
    const l3 = new THREE.PointLight(0xffc074, 1.6, 11, 1.9);
    l3.position.set(0, 10.2, 0);
    group.add(l3);
  }

  // подшипник и вал крепятся к вращающейся шапке (выше), а не висят в воздухе

  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    group.updateMatrixWorld(true);
    out.colliders = []; out.platforms = []; out.circles = [];

    // стена — кольца препятствий по поясам, с проёмами
    for (const b of bands) {
      const rm = rOut((b.y0 + b.y1) / 2) - WALL / 2;
      const n = b.gap ? SEG - 1 : SEG;
      const span = b.gap ? (SEG - 1) * (2 * Math.PI / SEG) : 2 * Math.PI;
      const st = b.gap ? BACK + GAP / 2 : GAP / 2;
      for (let i = 0; i < n; i++) {
        const a = st + span * (i + 0.5) / n;
        const chord = 2 * rm * Math.sin((span / n) / 2) * 1.12;
        const bx = localOriented(px, pz, ry, Math.sin(a) * rm, Math.cos(a) * rm, chord, WALL, a);
        bx.y0 = b.y0; bx.y1 = b.y1;
        out.colliders.push(bx);
      }
    }
    // центральная стойка
    out.circles.push({ x: px, z: pz, r: 0.4 });

    // лестница — одна непрерывная винтовая поверхность
    out.platforms.push({
      sp: {
        cx: px, cz: pz,
        rIn: 0.45,
        rOut0: rIn(0) - 0.06,
        rOut1: rIn(h) - 0.06,
        a0: BACK + ry,
        turns: TURNS, steps: NSTEP,
        y0: 0, y1: h,
        m: 0,
      },
    });
    // настила в башне нет — лестница выходит прямо на смотровую площадку
    // верхняя площадка лестницы (перемыкает стык со смотровой площадкой)
    const lp2 = localOriented(px, pz, ry,
      Math.sin(exitA) * landR2, Math.cos(exitA) * landR2, landW2, landD2, exitA, h);
    out.platforms.push(lp2);
    // КРЫША МЕЛЬНИЦЫ — твёрдая: настил верха башни.
    // Три перекрывающихся прямоугольника («звезда») закрывают круг целиком,
    // а флаг only: true пропускает игрока снизу — поднимающийся по лестнице
    // не упирается в крышу и не подбрасывается ею.
    {
      const RTOP = rIn(h) - 0.03;
      const arm = RTOP * 0.66, half = RTOP * 0.72;
      out.platforms.push({ cx: px, cz: pz, hx: RTOP, hz: arm, ang: 0, y: h, only: true });
      out.platforms.push({ cx: px, cz: pz, hx: arm, hz: RTOP, ang: 0, y: h, only: true });
      out.platforms.push({ cx: px, cz: pz, hx: half, hz: arm, ang: Math.PI / 4, y: h, only: true });
      out.platforms.push({ cx: px, cz: pz, hx: half, hz: arm, ang: -Math.PI / 4, y: h, only: true });
    }
    // смотровая площадка
    for (let i = 0; i < gN; i++) {
      const a = gA0 + (gA1 - gA0) * (i + 0.5) / gN;
      const rm = (galIn + galOut) / 2;
      const chord = 2 * galOut * Math.sin((gA1 - gA0) / gN / 2) * 1.08;
      out.platforms.push(localOriented(px, pz, ry,
        Math.sin(a) * rm, Math.cos(a) * rm, chord, galOut - galIn, a, h));
    }
    // забор площадки: столбы + перекладины
    const fr = galOut - 0.14, fN = 15;
    for (let i = 0; i <= fN; i++) {
      const a = gA0 + (gA1 - gA0) * (i / fN);
      if (nearDoor(a)) continue;
      out.circles.push({
        x: px + Math.sin(a) * fr * Math.cos(ry) + Math.cos(a) * fr * Math.sin(ry),
        z: pz - Math.sin(a) * fr * Math.sin(ry) + Math.cos(a) * fr * Math.cos(ry),
        r: 0.13, y0: h, y1: h + 1.2,
      });
    }
    for (let i = 0; i < fN; i++) {
      const am = gA0 + (gA1 - gA0) * ((i + 0.5) / fN);
      if (nearDoor(am)) continue;
      const seg = 2 * fr * Math.sin((gA1 - gA0) / fN / 2) * 1.14;
      const bx = localOriented(px, pz, ry, Math.sin(am) * fr, Math.cos(am) * fr, seg, 0.14, am);
      bx.y0 = h + 0.4; bx.y1 = h + 1.05;
      out.colliders.push(bx);
    }
    return out;
  };
  return out;
}

/* ---------------------------- кузница ---------------------------- */
export function blacksmith(M, opts = {}) {
  const { w = 6, d = 5 } = opts;
  const B = new Builder();
  // каменные стены с открытым фасадом
  B.put('stone', 0.6, 3.0, d, -w / 2 + 0.3, 1.5, 0, 1.2);
  B.put('stone', w, 3.0, 0.6, 0, 1.5, d / 2 - 0.3, 1.2);
  B.put('stone', 0.6, 3.0, d, w / 2 - 0.3, 1.5, 0, 1.2);
  // столбы
  for (const sx of [-1, 1]) {
    B.put('timber', 0.32, 3.2, 0.32, sx * (w / 2 - 0.35), 1.6, -d / 2 + 0.35);
  }
  // навес
  const BD = d + 0.8;
  const bs2 = roofShell(w + 0.05, d, 1.7, { overhang: (BD - d) / 2 + 0.45, thickness: 0.18, scale: 1.6 });
  for (const g of bs2.outer) B.add(g, 'tile', mat(0, 3.0 - 0.03, 0));
  for (const g of bs2.inner) B.add(g, 'plank', mat(0, 3.0 - 0.03, 0));
  for (const g of bs2.edges) B.add(g, 'tile', mat(0, 3.0 - 0.03, 0));
  B.add(gableEnds(w + 0.12, d, 1.7, 1.6, bs2.D), 'tile', mat(0, 3.0 - 0.03, 0));
  B.put('timber', w + 1.1, 0.2, 0.2, 0, 3.05, -(d + 0.8) / 2 + 0.1);
  B.put('timber', w + 1.1, 0.2, 0.2, 0, 3.05, (d + 0.8) / 2 - 0.1);

  // горн
  B.put('stone', 2.0, 1.1, 1.8, -w / 2 + 1.2, 0.55, d / 2 - 1.4, 1.1);
  B.put('stoneDark', 1.6, 0.3, 1.4, -w / 2 + 1.2, 1.2, d / 2 - 1.4);
  B.put('ember', 1.2, 0.12, 1.0, -w / 2 + 1.2, 1.3, d / 2 - 1.4);
  // дымоход
  B.put('stone', 0.8, 3.4, 0.8, -w / 2 + 1.2, 3.2, d / 2 - 1.4, 1);
  B.put('stoneDark', 1.05, 0.22, 1.05, -w / 2 + 1.2, 4.95, d / 2 - 1.4);
  // наковальня
  B.put('timber', 0.55, 0.6, 0.55, 0.4, 0.3, -0.4);
  B.put('iron', 1.1, 0.28, 0.45, 0.4, 0.75, -0.4);
  B.put('iron', 0.45, 0.2, 0.3, 0.4, 0.95, -0.4);
  // бочки и инструменты
  B.add(cyl(0.42, 0.42, 0.9, 12), 'plank', mat(w / 2 - 1.1, 0.45, 0.9));
  B.put('iron', 0.08, 1.1, 0.08, w / 2 - 1.6, 0.55, 1.6, 1, [0.2, 0, 0.1]);

  const group = B.build(M, null, { name: 'blacksmith' });
  const out = { group, colliders: [], forge: new THREE.Vector3() };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    out.colliders.push(localBox(px, pz, ry, -w / 2 + 0.3, 0, 0.6, d));
    out.colliders.push(localBox(px, pz, ry, w / 2 - 0.3, 0, 0.6, d));
    out.colliders.push(localBox(px, pz, ry, 0, d / 2 - 0.3, w, 0.6));
    // горн и наковальня — настоящие препятствия
    out.colliders.push(localBox(px, pz, ry, -w / 2 + 1.2, d / 2 - 1.4, 2.1, 1.9));
    out.colliders.push(localBox(px, pz, ry, 0.4, -0.4, 1.25, 0.75));
    const local = new THREE.Vector3(-w / 2 + 1.2, 1.5, d / 2 - 1.4);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    out.forge.set(px + local.x, local.y, pz + local.z);
    return out;
  };
  return out;
}

/* ---------------------------- колодец ---------------------------- */
export function well(M, opts = {}) {
  const B = new Builder();
  B.add(cyl(1.35, 1.5, 1.0, 14), 'stone', mat(0, 0.5, 0));
  B.add(cyl(1.15, 1.15, 0.14, 14), 'dark', mat(0, 0.98, 0));
  for (const sx of [-1, 1]) {
    B.put('timber', 0.22, 2.5, 0.22, sx * 1.15, 1.25, 0);
  }
  B.put('timber', 2.8, 0.22, 0.22, 0, 2.5, 0);
  B.add(cyl(0.16, 0.16, 2.2, 8), 'timber', mat(0, 2.05, 0, 0, 0, Math.PI / 2));
  const ws = roofShell(3.0, 1.9, 1.0, { overhang: 0.15, thickness: 0.22, scale: 1.4 });
  for (const g of ws.outer) B.add(g, 'thatch', mat(0, 2.6, 0));
  for (const g of ws.inner) B.add(g, 'plank', mat(0, 2.6, 0));
  for (const g of ws.edges) B.add(g, 'thatch', mat(0, 2.6, 0));
  B.add(gableEnds(3.06, 1.9, 1.0, 1.4, ws.D), 'thatch', mat(0, 2.6, 0));
  // верёвка и ведро
  B.put('rope', 0.05, 1.1, 0.05, 0, 1.5, 0);
  B.add(cyl(0.24, 0.2, 0.3, 10), 'plank', mat(0, 0.85, 0));
  B.put('iron', 0.42, 0.05, 0.05, 0, 1.0, 0);
  // лавка
  B.put('plank', 1.6, 0.12, 0.45, 2.0, 0.55, 0);
  B.put('timber', 0.16, 0.55, 0.4, 1.4, 0.28, 0);
  B.put('timber', 0.16, 0.55, 0.4, 2.6, 0.28, 0);

  const group = B.build(M, null, { name: 'well' });
  const out = { group, colliders: [] };
  out.place = (px, pz) => {
    group.position.set(px, 0, pz);
    out.circles = out.circles || [];
    out.circles.push({ x: px, z: pz, r: 1.5 });
    out.colliders.push(localBox(px, pz, 0, 2.0, 0, 1.6, 0.45));
    return out;
  };
  return out;
}

/* ---------------------------- прилавок ---------------------------- */
export function marketStall(M, opts = {}) {
  const { w = 3.4, d = 2.2, cloth = 'fabric' } = opts;
  const B = new Builder();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put('timber', 0.14, 2.35, 0.14, sx * (w / 2 - 0.12), 1.18, sz * (d / 2 - 0.12));
  }
  // прилавок
  B.put('plank', w, 0.14, d * 0.55, 0, 1.0, -d * 0.18);
  B.put(cloth, w - 0.1, 0.9, 0.05, 0, 0.52, -d * 0.18 - d * 0.28 + 0.01);
  // навес — двускатный, полосатый
  const ss = roofShell(w + 0.7, d + 0.7, 0.8, { overhang: 0.1, thickness: 0.1, scale: 1 });
  for (const g of ss.outer) B.add(g, cloth, mat(0, 2.42, 0));
  for (const g of ss.inner) B.add(g, cloth, mat(0, 2.42, 0));
  for (const g of ss.edges) B.add(g, cloth, mat(0, 2.42, 0));
  B.add(gableEnds(w + 0.76, d + 0.76, 0.8, 1, ss.D), cloth, mat(0, 2.42, 0));
  B.put('timber', w + 0.95, 0.1, 0.12, 0, 2.38, -(d + 0.9) / 2);
  B.put('timber', w + 0.95, 0.1, 0.12, 0, 2.38, (d + 0.9) / 2);
  // подзор
  B.add(box(w + 0.9, 0.16, 0.06, 1), cloth, mat(0, 2.36, -(d + 0.9) / 2));
  // товары
  const goods = ['redCloth', 'greenCloth', 'hay', 'plank'];
  for (let i = 0; i < 7; i++) {
    const gx = -w / 2 + 0.35 + i * ((w - 0.7) / 6);
    B.add(sphere(0.16 + (i % 3) * 0.03, 8, 6), goods[i % goods.length],
      mat(gx, 1.17, -d * 0.18 + ((i % 2) - 0.5) * 0.4));
  }
  // ящики
  B.put('plank', 0.8, 0.6, 0.6, w / 2 - 0.6, 0.3, d / 2 - 0.5);
  B.put('plank', 0.7, 0.5, 0.55, -w / 2 + 0.5, 0.25, d / 2 - 0.4);

  const group = B.build(M, null, { name: 'stall' });
  const out = { group, colliders: [] };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    out.colliders.push(localBox(px, pz, ry, 0, -d * 0.18, w, d * 0.55));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = sx * (w / 2 - 0.12), lz = sz * (d / 2 - 0.12);
      const wx = px + lx * Math.cos(ry) + lz * Math.sin(ry);
      const wz = pz - lx * Math.sin(ry) + lz * Math.cos(ry);
      out.circles = out.circles || [];
      out.circles.push({ x: wx, z: wz, r: 0.16 });
    }
    return out;
  };
  return out;
}

/* ---------------------------- кузница-стог ---------------------------- */
export function haystack(M, opts = {}) {
  const { r = 1.5, h = 2.6 } = opts;
  const B = new Builder();
  B.add(cyl(r * 0.9, r, h * 0.72, 12), 'hay', mat(0, h * 0.36, 0));
  B.add(cone(r * 0.92, h * 0.45, 12), 'hay', mat(0, h * 0.72 + h * 0.22, 0));
  B.put('rope', 0.06, h * 0.75, 0.06, 0, h * 0.36, r * 0.95);
  const group = B.build(M, null, { name: 'haystack' });
  const out = { group, colliders: [] };
  out.place = (px, pz) => {
    group.position.set(px, 0, pz);
    out.circles = out.circles || [];
    out.circles.push({ x: px, z: pz, r: r * 0.9 });
    return out;
  };
  return out;
}
