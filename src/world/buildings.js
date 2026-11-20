import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, gableEnds, hipRoof, roofShell, mat, plane } from './geo.js';
import { signMesh } from './props.js';

/* ------------------------------------------------------------------ *
 *  Здания долины
 * ------------------------------------------------------------------ */

/** Повёрнутый прямоугольник (OBB) — точная форма стены под любым углом. */
/** Уровень пола в жилых домах: перепад с землёй ≤ 0.46, чтобы в дом можно было войти без прыжка. */
const FLOOR_Y = 0.56;   // уровень пола в доме: цоколь выше — дом не «проседает»

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
function timberFrame(B, w, h, d, matKey = 'timber', braceXs = null, center = true, doorHalf = 0) {
  const t = 0.19, z = -d / 2 - 0.05;
  for (const sx of [-1, 1]) B.put(matKey, t, h, t, sx * (w / 2 - t / 2 - 0.02), h / 2, z);
  // центральная стойка делит фасад пополам и выглядит как балка посередине
  // дома — для жилых домов она не нужна: проём двери обрамляют косяки
  if (w > 5 && center) B.put(matKey, t, h, t, 0, h / 2, z);
  B.put(matKey, w, t, t, 0, h - t / 2 - 0.02, z);
  // Нижняя обвязка прерывается у дверного проёма: раньше брус шёл
  // поперёк двери и дом выглядел «поломанным».
  if (doorHalf > 0) {
    const seg = (w - doorHalf * 2) / 2;
    for (const sx of [-1, 1]) {
      B.put(matKey, seg, t, t, sx * (doorHalf + seg / 2), 0.18, z);
    }
  } else {
    B.put(matKey, w, t, t, 0, 0.18, z);
  }
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
  // Розетка из лепестков, а не спицы: восемь прямых спиц со ступицей
  // посередине читались как циферблат часов.
  const petals = ['stainedRed', 'stainedBlue', 'stainedGold', 'stainedGreen'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = x + Math.cos(a) * 0.46;
    const py = y + Math.sin(a) * 0.46;
    B.add(box(0.3, 0.42, 0.06, 1), petals[i % petals.length],
      mat(px, py, z - 0.1, 0, 0, a - Math.PI / 2));
    // каменный переплёт между лепестками
    B.put('stoneDark', 0.07, 0.46, 0.08, x + Math.cos(a + Math.PI / 8) * 0.5, y + Math.sin(a + Math.PI / 8) * 0.5, z - 0.11, 1, [0, 0, a + Math.PI / 8]);
  }
  // центральная медальон-окно
  B.add(new THREE.CircleGeometry(0.2, 12), 'stainedGold', mat(x, y, z - 0.1, Math.PI));
  B.add(torus(0.22, 0.05, 6, 12), 'stoneDark', mat(x, y, z - 0.12));
  // наружное кольцо
  B.add(torus(0.95, 0.16, 8, 18), 'stoneDark', mat(x, y, z - 0.14));
}


/* ---------------------------- домик ---------------------------- */
/**
 * Интерьер жилого дома: дощатый пол, очаг, стол с лавками, сундук,
 * полка с горшками и свеча. Ставится внутрь cottage — за стенами с
 * дверным проёмом, чтобы в дом можно было зайти, а не упираться в стену.
 *
 * @param {Builder} B билдер геометрии
 * @param {object} o размеры и вариации
 */
function houseInterior(B, o) {
  const { w, d, floors = 1, variant = 0 } = o;
  const wallH = o.wallH || 3.1;
  const T = 0.3;
  const fy = FLOOR_Y;                              // уровень пола
  const iw = w - T * 2, id = d - T * 2;

  // дощатый пол
  B.put('plank', iw, 0.08, id, 0, fy - 0.04, 0, 1.1);

  // очаг у задней стены: каменный блок с топкой и тлеющи углями
  {
    const hx = -iw / 2 + 0.72, hz = id / 2 - 0.42;
    B.put('stone', 1.3, 1.45, 0.8, hx, fy + 0.72, hz, 1.2);
    B.put('stoneDark', 1.42, 0.18, 0.9, hx, fy + 1.5, hz, 1.2);
    B.put('stoneDark', 0.55, 0.62, 0.12, hx, fy + 0.62, hz - 0.42, 1.2);
    B.put('ember', 0.42, 0.1, 0.3, hx, fy + 0.36, hz - 0.3, 1.2);
    // дымоходная труба вверх
    B.put('stoneDark', 0.42, wallPipeH(o), 0.42, hx, fy + 1.6 + wallPipeH(o) / 2, hz, 1.2);
    // поленья и котелок
    B.put('timber', 0.5, 0.16, 0.22, hx + 0.1, fy + 0.26, hz - 0.5, 1.2);
    B.put('iron', 0.34, 0.26, 0.34, hx + 0.1, fy + 0.47, hz - 0.5, 1.2);
  }

  // стол и две лавки — у правой стены, чтобы проход к двери оставался свободным
  const tx = iw / 2 - 1.15, tz = 0.15;
  {
    B.put('timber', 1.15, 0.1, 0.85, tx, fy + 0.78, tz, 1.1);
    for (const sx of [-1, 1]) {
      B.put('timber', 0.11, 0.78, 0.11, tx + sx * 0.48, fy + 0.39, tz + 0.32, 1.1);
      B.put('timber', 0.11, 0.78, 0.11, tx + sx * 0.48, fy + 0.39, tz - 0.32, 1.1);
    }
    B.put('plank', 1.05, 0.09, 0.3, tx, fy + 0.44, tz + 0.72, 1.1);
    for (const sx of [-1, 1]) {
      B.put('timber', 0.09, 0.44, 0.09, tx + sx * 0.42, fy + 0.22, tz + 0.72, 1.1);
    }
    // миска и свеча на столе
    B.put('stone', 0.3, 0.12, 0.3, tx - 0.22, fy + 0.89, tz, 1.1);
    B.put('bone', 0.07, 0.2, 0.07, tx + 0.26, fy + 0.93, tz + 0.1, 1.1);
    B.put('ember', 0.045, 0.08, 0.045, tx + 0.26, fy + 1.06, tz + 0.1, 1.1);
  }

  // сундук у боковой стены
  {
    const cx = -iw / 2 + 0.42, cz = id / 2 - 1.6;
    B.put('timber', 0.8, 0.62, 0.5, cx, fy + 0.31, cz, 1.1);
    B.put('iron', 0.84, 0.08, 0.54, cx, fy + 0.46, cz, 1.1);
    B.put('iron', 0.12, 0.16, 0.08, cx, fy + 0.4, cz - 0.27, 1.1);
  }

  // полка с горшками и связками трав — над сундуком
  {
    const sx = -iw / 2 + 0.35, sz = id / 2 - 1.6;
    B.put('plank', 0.45, 0.08, 1.5, sx + 0.12, fy + 1.55, sz, 1.1);
    for (const dz of [-0.45, 0, 0.45]) {
      B.put(variant % 2 ? 'redCloth' : 'cloth', 0.22, 0.26, 0.22, sx + 0.16, fy + 1.72, sz + dz, 1.1);
      B.put('timber', 0.05, 0.42, 0.05, sx + 0.16, fy + 2.05, sz + dz, 1.1);
    }
  }

  // уют: половица-ковёр у очага
  B.put(variant % 2 ? 'redCloth' : 'greenCloth', 1.5, 0.04, 1.1,
    -iw / 2 + 1.0, fy + 0.02, id / 2 - 1.1, 1.1);

  // ---- второй этаж: антресоль и лестница у стены ----
  // Раньше проём в перекрытии шёл через всю комнату по середине — из
  // комнаты был вид «дыры» в потолке прямо над столом. Теперь перекрытие
  // сплошное, а люк для лестницы — в углу у левой стены.
  let mezz = null;
  if (floors > 1) {
    const mezzY = fy + wallH * 0.55;
    const holeW = 1.2;                          // ширина люка у стены
    const hx0 = -iw / 2, hx1 = hx0 + holeW;
    const z0 = -id / 2 + 0.85;                  // низ лестницы (передний угол)
    const z1 = z0 + (id / 2 - 0.85) * 0.8;     // верх лестницы
    // перекрытие: основная часть и две полосы у левой стены (до и после люка)
    B.put('plank', iw - holeW, 0.16, id, (hx1 + iw / 2) / 2, mezzY - 0.08, 0, 1.1);
    B.put('plank', holeW, 0.16, z0 + id / 2, (hx0 + hx1) / 2, mezzY - 0.08, (-id / 2 + z0) / 2, 1.1);
    B.put('plank', holeW, 0.16, id / 2 - z1, (hx0 + hx1) / 2, mezzY - 0.08, (z1 + id / 2) / 2, 1.1);
    // балка по краю люка и опора перекрытия
    B.put('timber', 0.16, 0.16, id / 2 - z1, hx1 + 0.08, mezzY - 0.16, (z1 + id / 2) / 2, 1.1);
    B.put('timber', holeW, 0.16, 0.16, (hx0 + hx1) / 2, mezzY - 0.16, z1, 1.1);
    for (const sz of [-1, 1]) {
      B.put('timber', 0.18, mezzY - fy, 0.18, hx1 + 0.1, (mezzY + fy) / 2, sz * (id / 2 - 0.35), 1.1);
    }
    // лестница: рампа вдоль левой стены, из переднего угла на антресоль
    const lx = (hx0 + hx1) / 2;
    const N = 8;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      const zc = z0 + (z1 - z0) * (t0 + t1) / 2;
      const y = fy + (mezzY - fy) * (t0 + t1) / 2;
      B.put('plank', 1.0, 0.1, Math.abs(z1 - z0) / N + 0.02, lx, y - 0.05, zc, 1.1);
    }
    // перила лестницы и ограждение люка
    B.put('timber', 0.1, 0.9, Math.abs(z1 - z0), lx - 0.5, fy + (mezzY - fy) / 2 + 0.5, (z0 + z1) / 2, 1.1);
    B.put('timber', 0.1, 0.85, Math.abs(z1 - z0), hx1 - 0.05, mezzY + 0.42, (z0 + z1) / 2, 1.1);
    // на антресоли — мешки и связки трав
    for (const dz of [-1.7, 1.7]) {
      B.put('cloth', 0.42, 0.5, 0.34, iw / 2 - 0.45, mezzY + 0.28, dz, 1.1);
      B.put('rope', 0.46, 0.07, 0.38, iw / 2 - 0.45, mezzY + 0.3, dz, 1.1);
    }
    B.put('timber', 0.08, 0.8, 0.08, iw / 2 - 0.22, mezzY + 0.45, 0, 1.1);
    for (let i = 0; i < 4; i++) {
      B.put('wheat', 0.07, 0.72, 0.05, iw / 2 - 0.3 + (i - 1.5) * 0.07, mezzY + 0.4, 0, 1.1);
    }
    mezz = {
      y: mezzY,
      holeW, hx0, hx1, z0, z1,
      ramp: { x0: lx, z0, x1: lx, z1, y0: fy, y1: mezzY, halfWidth: 0.55 },
    };
  }

  // где стоит свечь — вернём, чтобы дом можно было подсветить изнутри
  return { candle: [tx + 0.26, tz + 0.1], mezz };
}

/** Высота дымоходной трубы внутри дома (до уровня крыши). */
function wallPipeH(o) {
  return Math.max(0.6, (o.wallH || 3.1) - 0.4);
}

/**
 * Жилой дом: настоящие стены с дверным проёмом и интерьером.
 *
 * Раньше дом был сплошным объёмом: дверь была нарисована, но за ней стояла
 * стена, и игрок упирался в неё. Теперь в дом можно зайти.
 */
export function cottage(M, opts = {}) {
  const {
    w = 6, d = 5, h = 3.1, roofH = 2.5, floors = 1, roof = 'thatch',
    wall = 'plaster', chimney = true, doorW = 1.05, porch = true, lit = true,
    doorOpen = true,
  } = opts;

  const B = new Builder();
  const roofMat = roof === 'thatch' ? 'thatch' : (roof === 'slate' ? 'tileSlate' : 'tile');

  // каменный цоколь — кольцом по периметру: сплошной плитой он закрывал
  // собой дощатый пол внутри дома
  B.put('stone', w + 0.24, FLOOR_Y, 0.24, 0, FLOOR_Y / 2, -d / 2 - 0.12, 1.1);
  B.put('stone', w + 0.24, FLOOR_Y, 0.24, 0, FLOOR_Y / 2, d / 2 + 0.12, 1.1);
  B.put('stone', 0.24, FLOOR_Y, d + 0.24, -w / 2 - 0.12, FLOOR_Y / 2, 0, 1.1);
  B.put('stone', 0.24, FLOOR_Y, d + 0.24, w / 2 + 0.12, FLOOR_Y / 2, 0, 1.1);
  const wallH = floors > 1 ? h * 1.74 : h;
  // Стены по периметру, а не сплошной объём: в фасаде (-z) оставлен
  // настоящий дверной проём, в который можно войти.
  const T = 0.3;
  const cy = FLOOR_Y + wallH / 2;
  B.put(wall, w, wallH, T, 0, cy, d / 2 - T / 2, 2.2);                       // задняя
  B.put(wall, T, wallH, d - T * 2, -w / 2 + T / 2, cy, 0, 2.2);            // левая
  B.put(wall, T, wallH, d - T * 2, w / 2 - T / 2, cy, 0, 2.2);             // правая
  const sideW = (w - doorW) / 2, sideX = doorW / 2 + sideW / 2;
  B.put(wall, sideW, wallH, T, -sideX, cy, -d / 2 + T / 2, 2.2);           // фасад слева
  B.put(wall, sideW, wallH, T, sideX, cy, -d / 2 + T / 2, 2.2);            // фасад справа
  // стена над дверным проёмом. Раньше её не было вовсе: над дверью зияла
  // вертикальная щель во всю высоту дома — «пустое пространство посередине».
  const doorTop = FLOOR_Y + 2.1;
  const aboveH = Math.max(0.12, FLOOR_Y + wallH - doorTop);
  B.put(wall, doorW, aboveH, T, 0, doorTop + aboveH / 2, -d / 2 + T / 2, 2.2);
  B.put(wall, doorW, 0.5, T, 0, FLOOR_Y + wallH - 0.25, -d / 2 + T / 2, 2.2);  // перемычка
  // интерьер: пол, очаг, стол, сундук, полка
  const interior = houseInterior(B, { w, d, wallH, floors, variant: opts.variant || 0 });

  timberFrame(B, w, wallH, d, 'timber', null, false, doorW / 2 + 0.28);
  for (const sx of [-1, 1]) {
    B.put('timber', 0.16, wallH, 0.19, sx * (w / 2 + 0.02), 0.5 + wallH / 2, -d / 2 + 0.3);
    B.put('timber', 0.16, wallH, 0.19, sx * (w / 2 + 0.02), 0.5 + wallH / 2, d / 2 - 0.3);
  }

  // дверь: косяки, перемычка, распахнутая внутрь створка (проём свободен)
  const dx = 0;
  // Метрики двери для проверок: плоскости створки и косяков не должны
  // совпадать — иначе дверь «фризит» (z-fighting).
  const doorGeom = {
    jambZ: -d / 2 - 0.07, jambHalf: doorW / 2,          // край проёма
    leafZ: -d / 2 - 0.02, leafHalf: (doorW - 0.024) / 2, // створка на 1,2 см уже
  };
  B.put('timber', 0.16, 2.1, 0.24, dx - doorW / 2 - 0.08, FLOOR_Y + 1.05, -d / 2 - 0.07);
  B.put('timber', 0.16, 2.1, 0.24, dx + doorW / 2 + 0.08, FLOOR_Y + 1.05, -d / 2 - 0.07);
  B.put('timber', doorW + 0.32, 0.18, 0.24, dx, FLOOR_Y + 2.1, -d / 2 - 0.07);
  {
    if (doorOpen) {
      const openA = 1.98;                     // створка открыта внутрь дома
      const hx0 = dx - doorW / 2 + 0.04;
      const cxD = hx0 + Math.cos(openA) * doorW / 2;
      const czD = -d / 2 + 0.04 + Math.sin(openA) * doorW / 2;
      B.add(box(doorW, 1.95, 0.1, 1), 'plank', mat(cxD, FLOOR_Y + 0.98, czD, openA));
      B.add(box(0.1, 0.1, 0.07, 1), 'iron',
        mat(cxD + Math.cos(openA) * (doorW / 2 - 0.13), FLOOR_Y + 0.85, czD + Math.sin(openA) * (doorW / 2 - 0.13), openA));
      for (const hy of [0.62, 2.3].map((v) => v + FLOOR_Y)) {
        B.add(box(0.07, 0.18, 0.12, 1), 'iron', mat(hx0, hy, -d / 2 + 0.02));
      }
    } else {
      // закрытая дверь: створка в проёме, замок и кольцо (без грубых перевязей)
      // Створка уже проёма на 1,2 см и стоит на 5 см ближе к наблюдателю,
      // чем плоскость косяков: грани не совпадают (нет z-fighting), а щель
      // слишком узкая, чтобы просвечивать светлой полосой.
      const leafW = doorW - 0.024;
      const leafZ = -d / 2 - 0.02;
      // тьма за щелями: подложка шире и выше проёма, чтобы узкий зазор
      // между створкой и косяками не просвечивал светлой полосой,
      // а над створкой не было чёрного провала
      B.add(box(doorW + 0.12, 2.1, 0.04, 1), 'timber', mat(dx, FLOOR_Y + 1.05, -d / 2 + 0.03));
      // цельная створка: между досками не должно быть просветов,
      // которые читались светлыми полосами
      B.add(box(leafW, 1.98, 0.08, 1), 'oakDoor', mat(dx, FLOOR_Y + 1.0, leafZ));
      // накладные тёмные доски — классическая дощатая дверь
      for (const ox of [-leafW / 2 + 0.13, 0, leafW / 2 - 0.13]) {
        B.add(box(0.19, 1.84, 0.04, 1), 'timber', mat(dx + ox, FLOOR_Y + 1.0, leafZ - 0.055));
      }
      // обвязки
      for (const by of [FLOOR_Y + 0.45, FLOOR_Y + 1.62]) {
        B.add(box(leafW, 0.12, 0.05, 1), 'timber', mat(dx, by, leafZ + 0.06));
      }
      // петли
      for (const by of [FLOOR_Y + 0.45, FLOOR_Y + 1.62]) {
        B.add(box(0.07, 0.16, 0.06, 1), 'iron', mat(dx - leafW / 2 + 0.04, by, leafZ - 0.02));
      }
      // засов и кольцо
      B.add(box(0.3, 0.1, 0.06, 1), 'iron', mat(dx + leafW / 2 - 0.22, FLOOR_Y + 1.05, leafZ + 0.05));
      B.add(torus(0.1, 0.026, 5, 10), 'iron',
        mat(dx + leafW / 2 - 0.3, FLOOR_Y + 0.92, leafZ + 0.03, 0, Math.PI / 2));
    }
  }
  B.put('stone', doorW + 0.5, 0.14, 0.7, dx, FLOOR_Y + 0.05, -d / 2 - 0.3);

  // окна — строго симметрично относительно центра фасада и целиком внутри стены
  const winX = w * 0.33;
  const winY = FLOOR_Y + 1.35;
  addWindow(B, winX, winY, -d / 2 - 0.02, 0.9, 1.05, 'z', lit);
  addWindow(B, -winX, winY, -d / 2 - 0.02, 0.9, 1.05, 'z', lit);
  for (const sx of [-1, 1]) {
    addWindow(B, sx * (w / 2 + 0.02), winY, d * 0.24, 0.8, 0.95, 'x', lit);
    addWindow(B, sx * (w / 2 + 0.02), winY, -d * 0.24, 0.8, 0.95, 'x', lit);
  }
  if (floors > 1) {
    const upY = FLOOR_Y + wallH - 1.25;          // верхний ряд — под карнизом
    addWindow(B, winX, upY, -d / 2 - 0.02, 0.85, 1.0, 'z', lit);
    addWindow(B, -winX, upY, -d / 2 - 0.02, 0.85, 1.0, 'z', lit);
    for (const sx of [-1, 1]) {
      addWindow(B, sx * (w / 2 + 0.02), upY, d * 0.24, 0.7, 0.85, 'x', lit);
      addWindow(B, sx * (w / 2 + 0.02), upY, -d * 0.24, 0.7, 0.85, 'x', lit);
    }
  }

  const roofBase = FLOOR_Y + wallH;
  addRoof(B, w, d, roofH, roofMat, wall, 0.4, true, roofBase);
  if (chimney) addChimney(B, w * 0.28, d * 0.16, roofBase + roofH + 1.1, roofBase);

  if (porch) {
    // Каменный цоколь: без него настил и ступень «висели» в воздухе.
    B.put('stone', doorW + 1.4, 0.42, 1.0, dx, 0.21, -d / 2 - 0.62);
    B.put('stone', doorW + 0.5, 0.14, 0.44, dx, 0.07, -d / 2 - 1.28);
    B.put('plank', doorW + 1.4, 0.12, 1.0, dx, FLOOR_Y, -d / 2 - 0.62);
    B.put('plank', doorW + 0.5, 0.14, 0.44, dx, 0.24, -d / 2 - 1.28);
    B.put('timber', 0.12, 2.28, 0.12, dx - (doorW + 1.0) / 2, FLOOR_Y + 1.2, -d / 2 - 0.98);
    B.put('timber', 0.12, 2.28, 0.12, dx + (doorW + 1.0) / 2, FLOOR_Y + 1.2, -d / 2 - 0.98);
    const ps = roofShell(doorW + 1.4, 1.5, 0.45, { overhang: 0.12, thickness: 0.14, scale: 1 });
    for (const g of ps.outer) B.add(g, roofMat, mat(dx, FLOOR_Y + 2.32, -d / 2 - 0.55));
    for (const g of ps.inner) B.add(g, 'plank', mat(dx, FLOOR_Y + 2.32, -d / 2 - 0.55));
    for (const g of ps.edges) B.add(g, roofMat, mat(dx, FLOOR_Y + 2.32, -d / 2 - 0.55));
  }

  // фонарь над входом: подсвечивает створку и косяки, чтобы дверь
  // не читалась чёрным провалом на затенённом фасаде
  let doorLampPos = null;
  if (!doorOpen) {
    const lx = dx + doorW / 2 + 0.26, ly = FLOOR_Y + 1.98, lz = -d / 2 - 0.26;
    B.add(box(0.05, 0.05, 0.3, 1), 'iron', mat(lx - 0.13, ly + 0.16, lz + 0.12));
    B.add(box(0.2, 0.24, 0.2, 1), 'iron', mat(lx, ly, lz));
    B.add(box(0.14, 0.16, 0.14, 1), 'windowLit', mat(lx, ly, lz - 0.01));
    doorLampPos = new THREE.Vector3(lx, ly, lz - 0.22);
  }

  const group = B.build(M, null, { name: 'cottage' });
  // Света у дома намеренно нет: двадцать четыре точечных источника в сцене
  // деревни стоили дороже всего остального. Фонарь у двери и окна подсвечивает
  // общий пул источников (см. main.js) — он берёт ближайшие лампы.
  const out = {
    group, colliders: [], platforms: [], windowLights: [], chimney: new THREE.Vector3(),
    doorGeom, lampPos: doorLampPos,
  };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz);
    group.rotation.y = ry;
    group.updateMatrixWorld(true);
    // Стены — отдельными коллайдерами, между ними проём двери.
    // Раньше был один сплошной прямоугольник на весь дом: игрок упирался
    // в «стенку из воздуха» прямо на нарисованной двери.
    out.colliders.push(localBox(px, pz, ry, 0, d / 2 - T / 2, w, T));
    out.colliders.push(localBox(px, pz, ry, -w / 2 + T / 2, 0, T, d - T * 2));
    out.colliders.push(localBox(px, pz, ry, w / 2 - T / 2, 0, T, d - T * 2));
    out.colliders.push(localBox(px, pz, ry, -sideX, -d / 2 + T / 2, sideW, T));
    out.colliders.push(localBox(px, pz, ry, sideX, -d / 2 + T / 2, sideW, T));
    // закрытая дверь перекрывает проём: за ней глухая створка, а не пустота
    if (!doorOpen) out.colliders.push(localBox(px, pz, ry, dx, -d / 2 + T / 2, doorW, T));
    // пол внутри дома
    out.platforms.push(localBox(px, pz, ry, 0, 0, w - T * 2, d - T * 2, FLOOR_Y));
    // антресоль второго этажа и лестница наверх
    if (interior.mezz) {
      const m = interior.mezz;
      const iw = w - T * 2, id = d - T * 2;
      // перекрытие сплошное; люк для лестницы — в углу у левой стены
      const { holeW, hx0, hx1, z0, z1 } = m;
      out.platforms.push(localBox(px, pz, ry, (hx1 + iw / 2) / 2, 0, iw - holeW, id, m.y));
      out.platforms.push(localBox(px, pz, ry, (hx0 + hx1) / 2, (-id / 2 + z0) / 2, holeW, z0 + id / 2, m.y));
      out.platforms.push(localBox(px, pz, ry, (hx0 + hx1) / 2, (z1 + id / 2) / 2, holeW, id / 2 - z1, m.y));
      const r = m.ramp;
      const p0 = new THREE.Vector3(r.x0, r.y0, r.z0).applyMatrix4(group.matrixWorld);
      const p1 = new THREE.Vector3(r.x1, r.y1, r.z1).applyMatrix4(group.matrixWorld);
      out.platforms.push({
        ramp: {
          x0: p0.x, z0: p0.z, x1: p1.x, z1: p1.z,
          y0: r.y0, y1: r.y1, halfWidth: r.halfWidth,
        },
      });
    }
    if (porch) {
      out.platforms.push(localBox(px, pz, ry, dx, -d / 2 - 0.62, doorW + 1.4, 1.0, FLOOR_Y));
      out.platforms.push(localBox(px, pz, ry, dx, -d / 2 - 1.28, doorW + 0.5, 0.44, 0.3));
    }
    out.windowLights = [];
    group.traverse((o) => {
      if (o.isMesh && o.material === M.windowLit) {
        const p = new THREE.Vector3(); o.getWorldPosition(p);
        out.windowLights.push(p);
      }
    });
    out.chimney.set(w * 0.28, FLOOR_Y + wallH + roofH + 0.85, d * 0.16).applyMatrix4(group.matrixWorld);
    // тёплый свет от свечи внутри дома (гаснет вместе с остальным светом)
    out.interiorLight = new THREE.Vector3(interior.candle[0], 1.7, interior.candle[1])
      .applyMatrix4(group.matrixWorld);
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
  const { w = 15, d = 18, h = 4.0, roofH = 3.6 } = opts;
  const B = new Builder();
  const wallH = h * 1.85;
  // Низкий каменный цоколь: пол зала и улица — на одном уровне, иначе
  // трактир будто «утоплен» в землю, а игрок выходит из бара в ступень.
  const BASE = 0.38;

  B.put('stone', w + 0.3, BASE, d + 0.3, 0, BASE / 2, 0, 1.1);
  B.put('tavernWall', w, wallH, d, 0, BASE + wallH / 2, 0, 2.4);
  timberFrame(B, w, wallH, d, 'timber', [-w / 2 + 0.95, w / 2 - 0.95]);

  // второй этаж — overhang
  B.put('tavernWall', w + 0.3, 0.26, d + 0.3, 0, BASE + wallH - 0.13, 0, 2.4);
  B.put('timber', w + 0.36, 0.2, d + 0.36, 0, BASE + wallH - 0.32, 0);
  B.put('timber', w + 0.36, 0.2, d + 0.36, 0, BASE + wallH + 0.05, 0);

  // дверь — по центру южного фасада, как и дверь внутри
  const dx = 0;
  B.put('timber', 0.18, 2.3, 0.26, dx - 0.78, BASE + 1.15, -d / 2 - 0.08);
  B.put('timber', 0.18, 2.3, 0.26, dx + 0.78, BASE + 1.15, -d / 2 - 0.08);
  B.put('timber', 1.9, 0.2, 0.26, dx, BASE + 2.3, -d / 2 - 0.08);
  B.put('plank', 1.35, 2.15, 0.12, dx, BASE + 1.075, -d / 2 - 0.15);
  B.put('iron', 0.1, 0.1, 0.07, dx + 0.45, BASE + 0.9, -d / 2 - 0.22);
  B.put('iron', 0.1, 0.1, 0.07, dx + 0.45, BASE + 1.5, -d / 2 - 0.22);
  // крыльцо: одна низкая ступень перед дверью (пол зала и улица — вровень)
  B.put('stone', 2.6, BASE, 0.9, dx, BASE / 2, -d / 2 - 0.55);
  B.put('stone', 2.6, 0.1, 0.6, dx, 0.05, -d / 2 - 1.25);

  /* Окна фасада — те же места, что и окна внутри (см. world/tavern.js):
     • юг (вход):  x = ±3.5,  y = 1.5   — нижний ряд зала;
     • юг (галерея): x = -2.6 / 0 / 2.6, y = 5.09 — окна второго этажа;
     • север:      x = -1.15 / 2.25 / 5.5, y = 5.5 — по одному на каждую нишу;
     • восток:     z = -3.6, y = 5.2     — высокое окно над стойкой.
     На западной стене вместо окон — труба очага и труба кухонной печи. */
  const upY = BASE + wallH - 1.75;           // верхний ряд — под карнизом второго этажа
  for (const fx of [-3.5, 3.5]) addWindow(B, fx, 1.5, -d / 2 - 0.02, 1.3, 1.7, 'z', true);
  for (const fx of [-2.6, 0, 2.6]) addWindow(B, fx, upY, -d / 2 - 0.02, 0.95, 1.1, 'z', true);
  for (const fx of [-1.15, 2.25, 5.5]) addWindow(B, fx, 5.5, d / 2 + 0.02, 1.2, 1.5, 'z', true);
  addWindow(B, w / 2 + 0.02, 5.2, -3.6, 1.2, 1.5, 'x', true);

  // труба очага (западная стена) и кухонной печи (северная) — как в интерьере
  B.put('stoneDark', 1.5, 2.2, 1.1, -w / 2 + 0.42, BASE + wallH - 1.1, 0, 1.3);
  B.put('stoneDark', 1.7, 0.24, 1.3, -w / 2 + 0.42, BASE + wallH + 0.12, 0, 1.3);
  B.put('stoneDark', 1.1, 1.8, 1.0, -4.6, BASE + wallH - 0.9, d / 2 - 0.42, 1.3);
  B.put('stoneDark', 1.3, 0.24, 1.2, -4.6, BASE + wallH + 0.12, d / 2 - 0.42, 1.3);

  const roofBase = BASE + wallH;
  addRoof(B, w, d, roofH, 'tile', 'tavernWall', 0.5, true, roofBase);
  addChimney(B, w * 0.3, d * 0.2, roofBase + roofH + 2.0, roofBase);

  // вывеска на кронштейне — прямо над дверью, чтобы таверну было узнать
  const sx = dx;
  const signY = BASE + 3.17, signZ = -d / 2 - 1.3;
  // кронштейн: горизонтальная лафа + две косые консоли по краям
  B.put('iron', 0.1, 0.1, 1.45, sx, BASE + 3.97, -d / 2 - 0.85);
  for (const s of [-1, 1]) {
    const ax = sx + s * 0.86, ay = BASE + 3.95, az = -d / 2 - 1.48;
    const bx = sx + s * 0.86, by = BASE + 2.61, bz = -d / 2 - 0.14;
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

  // ---- задняя дверь сбоку (восточная стена) ----
  // Через неё хозяйство выходит на улицу: из зала — в сени, из сеней — наружу.
  {
    const bz = -6.7, bx = w / 2;
    // косяки и перемычка
    for (const s2 of [-1, 1]) {
      B.put('timber', 0.26, 2.3, 0.2, bx + 0.04, BASE + 1.15, bz + s2 * 0.78, 1.2);
    }
    B.put('timber', 0.26, 0.22, 1.76, bx + 0.04, BASE + 2.3, bz, 1.2);
    // створка с досками и кольцом
    B.put('plank', 0.12, 2.15, 1.38, bx + 0.12, BASE + 1.15, bz, 1.3);
    for (const by of [BASE + 0.35, BASE + 1.9]) {
      B.put('timber', 0.16, 0.14, 1.36, bx + 0.17, by, bz, 1.2);
    }
    B.add(torus(0.11, 0.028, 5, 12), 'iron', mat(bx + 0.2, BASE + 1.15, bz - 0.5, 0, Math.PI / 2));
    B.put('iron', 0.2, 0.3, 0.07, bx + 0.16, BASE + 1.15, bz - 0.5, 1);
    // козырёк над дверью на кронштейнах (поднят — чтобы под ним висела табличка)
    B.put('tile', 1.15, 0.16, 1.95, bx + 0.52, BASE + 2.86, bz, 1.2);
    for (const s2 of [-1, 1]) {
      B.add(box(0.12, 0.55, 0.12, 1), 'timber', mat(bx + 0.42, BASE + 2.56, bz + s2 * 0.8));
    }
    // ступень и бочки у входа
    B.put('stone', 0.9, 0.2, 1.9, bx + 0.55, 0.1, bz, 1.2);
    B.add(cyl(0.3, 0.27, 0.78, 12), 'oakDoor', mat(bx + 0.75, 0.39, bz + 1.35));
    for (const yy of [0.18, 0.6]) {
      B.add(cyl(0.315, 0.315, 0.06, 12), 'iron', mat(bx + 0.75, yy, bz + 1.35));
    }
    B.add(cyl(0.27, 0.27, 0.05, 12), 'plank', mat(bx + 0.75, 0.8, bz + 1.35));
    // фонарь на кронштейне
    B.put('iron', 0.1, 0.1, 0.5, bx + 0.25, BASE + 2.33, bz - 0.95, 1);
    B.add(cyl(0.15, 0.19, 0.22, 8), 'iron', mat(bx + 0.45, BASE + 2.18, bz - 0.95));
    B.add(cyl(0.12, 0.08, 0.14, 8), 'lampGlass', mat(bx + 0.45, BASE + 2.01, bz - 0.95));
  }

  const group = B.build(M, null, { name: 'tavern' });
  {
    // табличка над задней дверью: «для персонала»
    const sign = signMesh('ДЛЯ ПЕРСОНАЛА', 1.3, 0.28);
    if (sign) {
      sign.position.set(w / 2 + 0.2, BASE + 2.54, -6.7);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);
    }
  }
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
    out.platforms.push(localBox(px, pz, ry, w * 0.05, -d / 2 - 0.55, 2.6, 0.9, 0.22));
    out.platforms.push(localBox(px, pz, ry, w * 0.05, -d / 2 - 1.25, 2.6, 0.6, 0.1));
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

  // неф — сплошной каменный объём; вход в храм сделан в башне-колокольне
  // (там, где он и должен быть), внутри храма — отдельная локация с нефом.
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
  // портал: обрамление проёма — две колонны, полуциркульная арка и карниз
  // Крыльца перед нефом нет: перед южным фасадом стоит башня-колокольня,
  // и ступени крыльца пересекались с её основанием (мелькающие грани).
  // тьма за проёмом и распахнутые внутрь дубовые створки — вход в неф
  {
    const pw = 2.6, ph = 3.6;
    B.put('dark', pw, ph, 0.3, 0, ph / 2, -d / 2 - 0.04, 1.2);
    for (const sx of [-1, 1]) {
      const a = sx * 1.1;
      B.add(box(pw / 2, ph - 0.2, 0.14, 1), 'oakDoor',
        mat(sx * (pw / 4) + Math.sin(a) * (pw / 4), (ph - 0.2) / 2,
          -d / 2 - 0.14 + (1 - Math.cos(a)) * (pw / 4), a));
      for (const hy of [0.7, ph - 0.7]) {
        B.put('iron', pw / 2 - 0.12, 0.14, 0.16, sx * (pw / 4), hy, -d / 2 - 0.09);
      }
    }
  }

  // Крыльцо перед южным фасадом: невысокая каменная башня с двускатной
  // крышей. Проём — на южной стороне, через него входят в храм.
  // Настоящая колокольня стоит сзади, за нефом (см. ниже).
  const tz = -d / 2 - 1.2;
  const BT = 0.7;                     // толщина стен крыльца
  const TPD_W = 2.0, TPD_H = 2.9;    // дверной проём
  const PORCH_H = 7.4;                // высота стен крыльца
  B.put('stone', 5.2, 0.9, 5.2, 0, 0.45, tz, 1.2);
  // четыре стены крыльца: северная сплошная, южная — с проёмом
  B.put('stone', 4.6, PORCH_H, BT, 0, 0.9 + PORCH_H / 2, tz + 2.3 - BT / 2, 1.6);
  B.put('stone', BT, PORCH_H, 4.6 - BT * 2, -2.3 + BT / 2, 0.9 + PORCH_H / 2, tz, 1.6);
  B.put('stone', BT, PORCH_H, 4.6 - BT * 2, 2.3 - BT / 2, 0.9 + PORCH_H / 2, tz, 1.6);
  {
    const sideW = (4.6 - TPD_W) / 2, sideX = TPD_W / 2 + sideW / 2;
    const fz = tz - 2.3 + BT / 2;
    B.put('stone', sideW, PORCH_H, BT, -sideX, 0.9 + PORCH_H / 2, fz, 1.6);
    B.put('stone', sideW, PORCH_H, BT, sideX, 0.9 + PORCH_H / 2, fz, 1.6);
    B.put('stone', TPD_W, PORCH_H - TPD_H, BT, 0, 0.9 + TPD_H + (PORCH_H - TPD_H) / 2, fz, 1.6);
    // тьма за проёмом — видно, что это вход, а не кладка
    B.put('dark', TPD_W, TPD_H, 0.3, 0, TPD_H / 2, tz - 2.3 + BT + 0.16, 1.2);
    // Двустворчатая дубовая дверь: филёнки, три обвязки, петли и кольцо.
    for (const sx of [-1, 1]) {
      const cxp = sx * (TPD_W / 4);
      // полотно
      B.put('oakDoor', TPD_W / 2 - 0.04, TPD_H - 0.2, 0.12, cxp, (TPD_H - 0.2) / 2, tz - 2.3 - 0.02);
      // вертикальные доски-филёнки
      for (let i = 0; i < 3; i++) {
        const px = cxp + (i - 1) * (TPD_W / 6);
        B.put('timber', 0.1, TPD_H - 0.55, 0.03, px, (TPD_H - 0.2) / 2, tz - 2.3 - 0.09);
      }
      // обвязки
      for (const hy of [0.6, TPD_H - 0.6]) {
        B.put('iron', TPD_W / 2 - 0.1, 0.14, 0.16, cxp, hy, tz - 2.3 - 0.09);
      }
      // петли
      B.put('iron', 0.2, 0.12, 0.07, sx * (TPD_W / 2 - 0.12), 1.25, tz - 2.3 - 0.09, 1);
    }
    B.add(torus(0.16, 0.035, 5, 12), 'iron', mat(0.12, 1.45, tz - 2.3 - 0.1, 0, Math.PI / 2));
    B.put('iron', 0.26, 0.36, 0.07, 0.12, 1.45, tz - 2.3 - 0.06);
    // два фонаря по сторонам от двери — вход читается даже в сумерках
    for (const sx of [-1, 1]) {
      B.put('iron', 0.09, 0.09, 0.42, sx * (TPD_W / 2 + 0.24), 2.6, tz - 2.3 - 0.14, 1);
      B.add(cyl(0.13, 0.17, 0.2, 8), 'iron', mat(sx * (TPD_W / 2 + 0.42), 2.45, tz - 2.3 - 0.14));
      B.add(cyl(0.1, 0.07, 0.13, 8), 'lampGlass', mat(sx * (TPD_W / 2 + 0.42), 2.3, tz - 2.3 - 0.14));
    }
    // обрамление проёма
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.4, TPD_H + 0.5, 0.5, sx * (TPD_W / 2 + 0.2), (TPD_H + 0.5) / 2 - 0.25, tz - 2.3 - 0.05, 1.2);
    }
    B.put('stoneDark', TPD_W + 1.2, 0.36, 0.6, 0, TPD_H + 0.45, tz - 2.3 - 0.05, 1.2);
    // ступени перед крыльцом
    B.put('stone', 3.4, 0.45, 0.9, 0, 0.225, tz - 3.1, 1.2);
    B.put('stone', 2.6, 0.22, 0.5, 0, 0.11, tz - 3.6, 1.2);
  }
  // угловые пилястры
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put('stoneDark', 0.7, PORCH_H, 0.7, sx * 2.3, 0.9 + PORCH_H / 2, tz + sz * 2.3, 1.2);
  }
  // двускатная крыша крыльца — вместо шпиля: это вход, а не колокольня
  {
    const RH = 2.6;
    const chs = roofShell(4.8, 4.8, RH, { overhang: 0.45, thickness: 0.22, scale: 1.6 });
    for (const g of chs.outer) B.add(g, 'tileSlate', mat(0, 0.9 + PORCH_H - 0.03, tz));
    for (const g of chs.inner) B.add(g, 'tileSlate', mat(0, 0.9 + PORCH_H - 0.03, tz));
    for (const g of chs.edges) B.add(g, 'tileSlate', mat(0, 0.9 + PORCH_H - 0.03, tz));
    B.add(gableEnds(4.86, 4.8, RH, 1.6, chs.D), 'tileSlate', mat(0, 0.9 + PORCH_H - 0.03, tz));
    B.put('stoneDark', 5.1, 0.2, 0.26, 0, 0.9 + PORCH_H + RH - 0.06, tz, 1.2);
  }
  // роза-окно на южном фасаде крыльца
  roseWindow(B, 0, 5.4, tz - 2.32);

  // ------- КОЛОКОЛЬНЯ ЗА СЕВЕРНЫМ ФАСАДОМ -------
  // За нефом стоит высокая каменная башня: внутри неё винтовая лестница
  // и галерея с колоколом (локация храма). Снаружи она должна выглядеть
  // так же — массивный объём, бойницы, карниз, шпиль и крест.
  const BTW = w + 0.8;             // ширина башни (стены 0,4 + запас)
  const BTD = 9.8;                 // глубина башни
  const BTZ = d / 2 + BTD / 2;     // центр башни по z
  const BTH = 13.8;                // высота стен башни
  const BTWALL = 0.45;
  {
    // цоколь
    B.put('stone', BTW + 0.5, 0.6, BTD + 0.5, 0, 0.3, BTZ, 1.2);
    // стены: западная, восточная и северная
    B.put('stone', BTWALL, BTH, BTD, -BTW / 2 + BTWALL / 2, BTH / 2, BTZ, 1.6);
    B.put('stone', BTWALL, BTH, BTD, BTW / 2 - BTWALL / 2, BTH / 2, BTZ, 1.6);
    B.put('stone', BTW, BTH, BTWALL, 0, BTH / 2, BTZ + BTD / 2 - BTWALL / 2, 1.6);
    // угловые пилястры — башня читается как башня
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      B.put('stoneDark', 0.75, BTH - 0.4, 0.75,
        sx * (BTW / 2 - 0.3), (BTH - 0.4) / 2, BTZ + sz * (BTD / 2 - 0.3), 1.2);
    }
    // окна башни: узкие щели-бойницы
    for (let i = 0; i < 3; i++) {
      const wy = 4.4 + i * 3.2;
      for (const sx of [-1, 1]) {
        B.put('dark', 0.16, 1.5, 0.5, sx * (BTW / 2 - 0.05), wy, BTZ - 2.4 + i * 2.4, 1.2);
        B.put('stoneDark', 0.3, 1.8, 0.2, sx * (BTW / 2 + 0.02), wy, BTZ - 2.4 + i * 2.4, 1.2);
        B.put('stoneDark', 0.3, 0.22, 0.8, sx * (BTW / 2 + 0.02), wy + 0.9, BTZ - 2.4 + i * 2.4, 1.2);
        B.put('stoneDark', 0.3, 0.22, 0.8, sx * (BTW / 2 + 0.02), wy - 0.9, BTZ - 2.4 + i * 2.4, 1.2);
      }
    }
    // большие проёмы звонницы под карнизом — внутри виден колокол
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const nx = Math.sin(a) * (BTW / 2 - 0.05), nz2 = Math.cos(a) * (BTD / 2 - 0.05);
      const ox = nx * 0.0, oz = nz2 * 0.0;
      B.put('dark', 2.0, 2.6, 0.3, ox + nx, BTH - 1.6, BTZ + oz + nz2, 1.2);
      B.put('stoneDark', 0.3, 2.9, 0.36, ox + nx * 1.06, BTH - 1.6, BTZ + oz + nz2 * 1.06, 1.2);
      // колокол в проёме
      B.add(cyl(0.26, 0.5, 0.8, 10), 'brass', mat(ox + nx * 0.55, BTH - 2.1, BTZ + oz + nz2 * 0.55));
    }
    // карниз и шпиль
    B.put('stoneDark', BTW + 0.7, 0.4, BTD + 0.7, 0, BTH + 0.2, BTZ, 1.2);
    B.put('stoneDark', BTW + 1.1, 0.2, BTD + 1.1, 0, BTH + 0.48, BTZ, 1.2);
    B.add(cone(BTW * 0.72, 6.4, 4), 'tileSlate', mat(0, BTH + 0.6 + 3.2, BTZ, Math.PI / 4));
    // крест на шпиле
    B.put('brass', 0.12, 1.8, 0.12, 0, BTH + 8.0, BTZ);
    B.put('brass', 0.9, 0.12, 0.12, 0, BTH + 8.3, BTZ);
    B.add(sphere(0.22, 8, 6), 'brass', mat(0, BTH + 9.0, BTZ));
  }
  // рабочая дверь в колокольню — с северной стороны, с порогом и ступенями
  const TOWER_DOOR_W = 1.7;
  {
    const dw = TOWER_DOOR_W, dh = 2.6;
    const dz = BTZ + BTD / 2 + 0.02;
    B.put('dark', dw, dh, 0.24, 0, dh / 2, dz + 0.14, 1.2);
    B.put('stoneDark', 0.34, dh + 0.4, 0.44, -dw / 2 - 0.17, (dh + 0.4) / 2, dz + 0.1, 1.2);
    B.put('stoneDark', 0.34, dh + 0.4, 0.44, dw / 2 + 0.17, (dh + 0.4) / 2, dz + 0.1, 1.2);
    B.put('stoneDark', dw + 0.9, 0.3, 0.5, 0, dh + 0.35, dz + 0.1, 1.2);
    // створка: доски, обвязки, петли
    for (let i = 0; i < 7; i++) {
      const px = -dw / 2 + (i + 0.5) * (dw / 7);
      B.add(box(dw / 7 - 0.025, dh - 0.16, 0.09, 1), 'oakDoor', mat(px, (dh - 0.16) / 2, dz + 0.24));
    }
    for (const by of [0.42, 1.2, 2.1]) {
      B.put('timber', dw + 0.06, 0.14, 0.05, 0, by, dz + 0.3, 1.1);
    }
    B.put('iron', 0.2, 0.15, 0.06, -dw / 2 + 0.1, 1.2, dz + 0.3, 1);
    B.add(torus(0.1, 0.025, 5, 10), 'iron', mat(dw / 2 - 0.14, 1.25, dz + 0.31, 0, Math.PI / 2));
    // ступени и фонарь у двери
    B.put('stone', dw + 1.2, 0.22, 0.9, 0, 0.11, dz + 0.75, 1.2);
    B.put('stone', dw + 0.9, 0.22, 0.6, 0, 0.32, dz + 0.42, 1.2);
    B.put('iron', 0.09, 0.09, 0.44, dw / 2 + 0.35, dh + 0.55, dz + 0.2, 1);
    B.add(cyl(0.14, 0.18, 0.2, 8), 'iron', mat(dw / 2 + 0.55, dh + 0.42, dz + 0.2));
    B.add(cyl(0.1, 0.07, 0.13, 8), 'lampGlass', mat(dw / 2 + 0.55, dh + 0.28, dz + 0.2));
  }


  const group = B.build(M, null, { name: 'church' });
  const out = { group, colliders: [], platforms: [], windowLights: [] };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz); group.rotation.y = ry;
    out.colliders.push(rotatedAABB(px, pz, w / 2, d / 2, ry));
    // Крыльцо — отдельные стены: его дверь закрыта, поэтому игрок
    // не должен проваливаться внутрь.
    out.colliders.push(localBox(px, pz, ry, 0, tz + 2.3 - BT / 2, 4.6, BT));
    out.colliders.push(localBox(px, pz, ry, -2.3 + BT / 2, tz, BT, 4.6));
    out.colliders.push(localBox(px, pz, ry, 2.3 - BT / 2, tz, BT, 4.6));
    out.colliders.push(localBox(px, pz, ry, 0, tz - 2.3 + BT / 2, 4.6, BT));
    // Колокольня за нефом: массивный объём, внутрь игрок не попадает —
    // туда ведёт только дверь с заднего двора.
    out.colliders.push(localBox(px, pz, ry, -BTW / 2 + BTWALL / 2, BTZ, BTWALL, BTD));
    out.colliders.push(localBox(px, pz, ry, BTW / 2 - BTWALL / 2, BTZ, BTWALL, BTD));
    out.colliders.push(localBox(px, pz, ry, 0, BTZ + BTD / 2 - BTWALL / 2, BTW, BTWALL));
    // ступени перед дверью крыльца
    out.platforms.push(localBox(px, pz, ry, 0, tz - 3.1, 3.4, 0.9, 0.45));
    out.platforms.push(localBox(px, pz, ry, 0, tz - 3.6, 2.6, 0.5, 0.22));
    // Раньше перед фасадом стоял невидимый коллайдер 4,6 × 4,6 м: игрок
    // упирался в пустоту рядом с крыльцом и не мог обойти церковь.
    // Крыльцо низкое (0,72 м) — это площадка, а не стена, поэтому
    // здесь достаточно платформ ступеней.
    // ступени к задней двери нефа
    out.platforms.push(localBox(px, pz, ry, 0, d / 2 + 0.4, 1.7, 0.3, 0.2));
    out.platforms.push(localBox(px, pz, ry, 0, d / 2 + 0.55, 1.85, 0.45, 0.1));
    // ступени к двери колокольни (северная сторона)
    out.platforms.push(localBox(px, pz, ry, 0, BTZ + BTD / 2 + 0.75, TOWER_DOOR_W + 1.2, 0.9, 0.22));
    out.platforms.push(localBox(px, pz, ry, 0, BTZ + BTD / 2 + 0.42, TOWER_DOOR_W + 0.9, 0.6, 0.32));
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
  const TURNS = 3, NSTEP = Math.max(30, Math.round(h / 0.24));
  const DTH = Math.PI * 2 * TURNS / NSTEP;
  const RISE = h / NSTEP;
  const STAIR_IN = 0.9;        // лестница идёт дальше от вала: вал стал физическим
  const steps = [];
  for (let i = 0; i < NSTEP; i++) {
    const y = (i + 1) * RISE;                       // верх ступени
    const theta = BACK + (i + 0.5) * DTH;            // середина ступени
    const ro = rIn(y) - 0.06;
    const rm = (STAIR_IN + ro) / 2;
    const half = rm * DTH / 2;
    const sx = Math.sin(theta), cz = Math.cos(theta);
    // Ступень шире шага по окружности: иначе между ступенями остаётся
    // щель, в которую игрок проваливается.
    const stepW = Math.max(ro * DTH * 1.12, half * 2.2);
    B.add(box(stepW, 0.14, ro - STAIR_IN, 1), 'plank', mat(sx * rm, y - 0.07, cz * rm, theta));
    B.add(box(stepW, RISE, 0.07, 1), 'plank', mat(sx * (ro - 0.035), y - RISE / 2 - 0.07, cz * (ro - 0.035), theta));
    B.add(box(0.09, 1.0, 0.09, 1), 'timber', mat(sx * (ro - 0.12), y + 0.5, cz * (ro - 0.12), theta));
    B.add(box(stepW * 0.9, 0.09, 0.09, 1), 'timber', mat(sx * (ro - 0.12), y + 0.95, cz * (ro - 0.12), theta));
    steps.push({ theta, y, rm, half, ro });
  }

  // ---------- верх: пола убран — только смотровая площадка ----------
  // Лестница выходит на площадку сразу (последняя ступень = h), отдельного
  // настила и мостика в башне больше нет.
  const exitA = steps[NSTEP - 1].theta;
  // верхняя площадка лестницы: перемыкает зазор между последней ступенью
  // и смотровой площадкой, чтобы переход был сплошным
  // Перемычка на 14 см ниже площадки: иначе верхние грани совпадали
  // и на стыке смотрелось мерцание.
  const galIn0 = rIn(h) - 0.01;
  const landD2 = 1.15, landW2 = 1.25;
  const landR2 = galIn0 - landD2 / 2;
  B.add(box(landW2, 0.14, landD2, 1), 'plank',
    mat(Math.sin(exitA) * landR2, h - 0.21, Math.cos(exitA) * landR2, exitA));

  // ---------- край башни: круглое ограждение ----------
  // Настила нет, поэтому край башни огорожен: иначе игрок на смотровой
  // площадке проваливался бы внутрь башни. Проём лестницы остаётся открытым.
  {
    const RTOP = rIn(h) - 0.08;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - exitA), Math.cos(a - exitA))) < 0.42) continue;
      B.add(box(0.13, 1.0, 0.13, 1), 'timber',
        mat(Math.sin(a) * RTOP, h + 0.5, Math.cos(a) * RTOP, a));
    }
  }

  // ---------- верха башни: настила нет ----------
  // Раньше здесь был круглый деревянный пол. Он перехватывал игрока при
  // подъёме по винтовой лестнице (последний виток упирался в пол) — поэтому
  // пол убрали. Твёрдой остаётся только жёлтая соломенная шапка: по ней
  // можно подняться снаружи башни, как по ступеням.

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
  // Метрика стыка перемычки и смотровой площадки: верхние грани не должны
  // совпадать — иначе на стыке шло мерцание.
  const landingGeom = { bridgeTop: h - 0.14, deckTop: h };
  const group = B.build(M, null, { name: 'windmill' });
  const out = {
    group, colliders: [], platforms: [], circles: [], blades: null, cap: null, landingGeom,
  };
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
    // центральная стойка (приводной вал) — физическая: сквозь него
    // больше не провалишься внутрь башни
    out.circles.push({ x: px, z: pz, r: 0.36, y0: 0.25, y1: h - 0.15 });
    // перила винтовой лестницы — тоже препятствия: на них не провалишься
    for (const st of steps) {
      const sx = Math.sin(st.theta), cz = Math.cos(st.theta);
      out.circles.push({
        x: px + sx * (st.ro - 0.12) * Math.cos(ry) + cz * (st.ro - 0.12) * Math.sin(ry),
        z: pz - sx * (st.ro - 0.12) * Math.sin(ry) + cz * (st.ro - 0.12) * Math.cos(ry),
        r: 0.11, y0: st.y, y1: st.y + 0.95,
      });
    }

    // лестница — одна непрерывная винтовая поверхность
    out.platforms.push({
      sp: {
        cx: px, cz: pz,
        rIn: STAIR_IN,
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
    // ограждение по краю башни: без него игрок проваливался бы внутрь
    {
      const RTOP = rIn(h) - 0.08;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a - exitA), Math.cos(a - exitA))) < 0.42) continue;
        const wx = px + Math.sin(a) * RTOP * Math.cos(ry) + Math.cos(a) * RTOP * Math.sin(ry);
        const wz = pz - Math.sin(a) * RTOP * Math.sin(ry) + Math.cos(a) * RTOP * Math.cos(ry);
        out.circles.push({ x: wx, z: wz, r: 0.13, y0: h, y1: h + 1.0 });
      }
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
