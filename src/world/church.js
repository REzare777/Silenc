/**
 * ============================================================================
 *  Храм: неф и колокольня как самостоятельная локация
 * ============================================================================
 *
 *  Снаружи церковь стоит на холме, а внутри неё — настоящий храм:
 *  южная башня-колокольня (вход с улицы), П-образная лестница наверх,
 *  площадка с колоколом и северная часть — неф со скамьями, витражами
 *  и алтарём. Ударить в колокол можно только наверху, в самой башне.
 *
 *  Свет внутри храма холодный от витражей и тёплый от алтаря — в отличие
 *  от улицы, здесь всегда своя атмосфера.
 *
 *  @module world/church
 */

import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, mat, plane } from './geo.js';
import { Motes } from './particles.js';

/* ---------------- неф ---------------- */
const W = 9;          // ширина нефа
const D = 15.6;       // длина нефа
const H = 6.5;        // высота стен нефа
const T = 0.4;        // толщина стен
const DOOR_W = 2.6;   // ширина портала (арка в неф из башни)
const AISLE = 1.5;    // ширина центрального прохода
const NEZ = 3.2;      // центр нефа по z (башня занимает юг)

/* ---------------- башня-колокольня ---------------- */
const TW = 6.0;       // внутренний размер башни (x и z)
const TZ = -8.0;      // центр башни по z
const TH = 8.0;       // высота стен башни
const BELL_Y = 4.5;   // высота площадки с колоколом
const BACK_W = 2.0;   // ширина задней двери нефа

/** Название храма — показывается при входе. */
export const CHURCH_NAME = 'Храм Святого Покрова';

/**
 * Собирает интерьер храма: башню с лестницей и неф.
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

  /** Перевод локальной координаты нефа (от −D/2 до +D/2) в общую. */
  const nz = (z) => z + NEZ;

  /* ================= башня-колокольня ================= */
  const TX0 = -TW / 2, TX1 = TW / 2;                 // внутренние границы по x
  const TZ0 = TZ - TW / 2, TZ1 = TZ + TW / 2;        // внутренние границы по z
  {
    // пол башни — каменные плиты
    B.put('stone', TW, 0.16, TW, 0, -0.08, TZ, 1.6);
    // стены: западная, восточная и южная (с дверным проёмом)
    B.put('stone', T, TH, TW + T * 2, TX0 - T / 2, TH / 2, TZ, 1.6);
    B.put('stone', T, TH, TW + T * 2, TX1 + T / 2, TH / 2, TZ, 1.6);
    {
      // южная стена: проём 1.6 × 2.9 с дубовой створкой
      const PW = 1.6, PH = 2.9;
      const sideW = (TW + T * 2 - PW) / 2, sideX = PW / 2 + sideW / 2;
      B.put('stone', sideW, TH, T, -sideX, TH / 2, TZ0 - T / 2, 1.6);
      B.put('stone', sideW, TH, T, sideX, TH / 2, TZ0 - T / 2, 1.6);
      B.put('stone', PW, TH - PH, T, 0, PH + (TH - PH) / 2, TZ0 - T / 2, 1.6);
      // наличники и перемычка проёма
      for (const sx of [-1, 1]) {
        B.put('stoneDark', 0.3, PH + 0.3, 0.5, sx * (PW / 2 + 0.15), (PH + 0.3) / 2, TZ0 - 0.1, 1.2);
      }
      B.put('stoneDark', PW + 0.9, 0.34, 0.55, 0, PH + 0.17, TZ0 - 0.1, 1.2);
      // распахнутая внутрь дубовая створка с кольцом
      const a = 1.12;
      B.add(box(PW, PH - 0.1, 0.12, 1), 'oakDoor',
        mat(-PW / 2 + 0.06 + Math.sin(a) * (PW / 2 - 0.1), (PH - 0.1) / 2,
          TZ0 + 0.1 + (1 - Math.cos(a)) * (PW / 2 - 0.1), a));
      B.add(torus(0.08, 0.022, 5, 10), 'iron',
        mat(-PW / 2 + 0.06 + Math.sin(a) * (PW / 2 - 0.1) + Math.cos(a) * 0.1, 1.1,
          TZ0 + 0.1 + (1 - Math.cos(a)) * (PW / 2 - 0.1) - Math.sin(a) * 0.1, a));
      colliders.boxes.push({ cx: 0, cz: TZ0 - T / 2, hx: sideW / 2, hz: T / 2, ang: 0 });
    }
    colliders.boxes.push({ cx: TX0 - T / 2, cz: TZ, hx: T / 2, hz: TW / 2, ang: 0 });
    colliders.boxes.push({ cx: TX1 + T / 2, cz: TZ, hx: T / 2, hz: TW / 2, ang: 0 });

    // свод башни: дощатый настил с крестовыми балками
    B.put('plank', TW + T * 2, 0.2, TW + T * 2, 0, TH - 0.1, TZ, 1.2);
    for (const s2 of [-1, 1]) {
      B.put('timber', TW + T * 2, 0.26, 0.26, 0, TH - 0.32, TZ + s2 * (TW / 2 - 0.4), 1.2);
      B.put('timber', 0.26, 0.26, TW + T * 2, s2 * (TW / 2 - 0.4), TH - 0.32, TZ, 1.2);
    }
    // бойницы выше площадки — сквозь них идёт дневной свет
    for (const sx of [-1, 1]) {
      B.put('dark', 0.3, 1.5, 0.5, sx * (TW / 2 - 0.05), BELL_Y + 1.7, TZ - 1.6, 1.2);
      B.put('stoneDark', 0.24, 1.8, 0.24, sx * (TW / 2 - 0.05), BELL_Y + 1.7, TZ - 1.95, 1.2);
      B.put('stoneDark', 0.24, 1.8, 0.24, sx * (TW / 2 - 0.05), BELL_Y + 1.7, TZ - 1.25, 1.2);
    }
    B.put('dark', 1.2, 1.4, 0.3, 0, BELL_Y + 1.8, TZ0 + 0.05, 1.2);
    B.put('stoneDark', 0.3, 1.7, 0.5, -0.75, BELL_Y + 1.8, TZ0 + 0.05, 1.2);
    B.put('stoneDark', 0.3, 1.7, 0.5, 0.75, BELL_Y + 1.8, TZ0 + 0.05, 1.2);
  }

  /* ---------------- лестница башни: три пролёта ---------------- */
  const LW = 1.4;          // ширина пролёта
  const flight = (x0, z0, x1, z1, y0, y1) => {
    const dx = x1 - x0, dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    const n = Math.max(6, Math.round(L / 0.32));
    const ang = Math.atan2(dx, dz);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const y = y0 + (y1 - y0) * t;
      B.add(box(LW, 0.16, L / n + 0.03, 1), 'stone',
        mat(x0 + dx * t, y - 0.08, z0 + dz * t, ang));
    }
    // перила по краям пролёта: поручень и балясины
    const nx = -dz / L, nz2 = dx / L;
    for (const s of [-1, 1]) {
      const mx = x0 + dx / 2 + nx * s * (LW / 2 - 0.08);
      const mz = z0 + dz / 2 + nz2 * s * (LW / 2 - 0.08);
      // поручень
      B.add(box(0.1, 0.1, L, 1), 'timber', mat(mx, (y0 + y1) / 2 + 0.92, mz, ang));
      // балясины
      const nB = Math.max(2, Math.round(L / 0.55));
      for (let i = 0; i <= nB; i++) {
        const t = i / nB;
        B.add(box(0.07, 0.9, 0.07, 1), 'timber',
          mat(x0 + dx * t + nx * s * (LW / 2 - 0.08), (y0 + (y1 - y0) * t) / 2 + 0.47,
            z0 + dz * t + nz2 * s * (LW / 2 - 0.08)));
      }
    }
    return { x0, z0, x1, z1, y0, y1, ang, len: L };
  };

  const flights = [
    // пролёт A — вдоль западной стены, снизу вверх
    flight(TX0 + LW / 2, TZ0 + 0.4, TX0 + LW / 2, TZ0 + 4.4, 0, 1.5),
    // пролёт B — вдоль северной стены, на восток
    flight(TX0 + LW, TZ1 - LW / 2, TX1 - 0.4, TZ1 - LW / 2, 1.5, 3.0),
    // пролёт C — вдоль восточной стены, на юг
    flight(TX1 - LW / 2, TZ1 - LW, TX1 - LW / 2, TZ0 + 1.8, 3.0, BELL_Y),
  ];
  for (const f of flights) {
    platforms.push({
      ramp: {
        x0: f.x0, z0: f.z0, x1: f.x1, z1: f.z1,
        y0: f.y0, y1: f.y1, halfWidth: LW / 2 - 0.05,
      },
    });
  }

  /* ---------------- площадки башни ---------------- */
  const landings = [
    // промежуточная площадка A (северо-западный угол)
    { x: TX0 + LW / 2, z: TZ1 - LW / 2, hx: LW / 2, hz: LW / 2, y: 1.5 },
    // промежуточная площадка B (северо-восточный угол)
    { x: TX1 - LW / 2, z: TZ1 - LW / 2, hx: LW / 2, hz: LW / 2, y: 3.0 },
    // площадка с колоколом (юго-восточный угол)
    { x: (TX0 + 0.4 + TX1) / 2, z: TZ0 + 1.0, hx: (TX1 - TX0 - 0.8) / 2, hz: 1.0, y: BELL_Y },
  ];
  for (const p of landings) {
    B.put('plank', p.hx * 2, 0.16, p.hz * 2, p.x, p.y - 0.08, p.z, 1.2);
    platforms.push({ cx: p.x, cz: p.z, hx: p.hx, hz: p.hz, ang: 0, y: p.y });
  }
  // ограждение площадки с колоколом — кроме стороны лестницы
  {
    const p = landings[2];
    const rail = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0;
      const L = Math.hypot(dx, dz);
      B.add(box(0.12, 0.95, L, 1), 'timber',
        mat((x0 + x1) / 2, p.y + 0.5, (z0 + z1) / 2, Math.atan2(dx, dz)));
    };
    rail(p.x - p.hx, p.z - p.hz, p.x + p.hx, p.z - p.hz);      // южный край
    rail(p.x - p.hx, p.z - p.hz, p.x - p.hx, p.z + p.hz - 0.9); // западный угол
    rail(p.x + p.hx, p.z - p.hz, p.x + p.hx, p.z + p.hz - 0.9); // восточный угол
    // северный край открыт — там выход с лестницы
  }

  /* ---------------- колокол ---------------- */
  const BELL_X = landings[2].x, BELL_Z = landings[2].z;
  {
    // перекладина: балка от стены до стены — колокол висит под ней
    B.add(box(TW + 0.4, 0.3, 0.32, 1), 'timber', mat(0, BELL_Y + 2.1, BELL_Z));
    B.add(box(0.26, 0.26, 0.5, 1), 'timber', mat(-TW / 2 + 0.15, BELL_Y + 2.1, BELL_Z));
    B.add(box(0.26, 0.26, 0.5, 1), 'timber', mat(TW / 2 - 0.15, BELL_Y + 2.1, BELL_Z));
    // деревянный рычаг, которым бьют
    // свеча на перилах площадки
    B.add(cyl(0.05, 0.06, 0.3, 8), 'bone', mat(BELL_X + 1.9, BELL_Y + 0.3, BELL_Z - 0.8));
    B.add(sphere(0.055, 8, 6), 'lampGlass', mat(BELL_X + 1.9, BELL_Y + 0.48, BELL_Z - 0.8));
    // два подсвечника на стенах нижнего яруса башни
    for (const sx of [-1, 1]) {
      const cx = sx * (TW / 2 - 0.16);
      B.put('iron', 0.16, 0.06, 0.16, cx, 1.55, TZ + 1.2, 1.2);
      B.add(cyl(0.05, 0.06, 0.28, 8), 'bone', mat(cx, 1.72, TZ + 1.2));
      B.add(sphere(0.055, 8, 6), 'lampGlass', mat(cx, 1.9, TZ + 1.2));
    }
  }

  /* ================= неф ================= */
  // пол — каменные плиты, по центру ковровая дорожка
  B.put('stone', W - T * 2, 0.14, D - T * 2, 0, -0.07, NEZ, 1.6);
  B.put('redCloth', AISLE, 0.04, D - T * 2 - 0.6, 0, 0.02, NEZ, 1.2);
  // стены нефа
  B.put('stone', W, H, T, 0, H / 2, nz(D / 2 - T / 2), 2.0);                    // северная, за алтарём
  B.put('stone', T, H, D - T * 2, -W / 2 + T / 2, H / 2, NEZ, 2.0);             // западная
  B.put('stone', T, H, D - T * 2, W / 2 - T / 2, H / 2, NEZ, 2.0);              // восточная
  // южная стена нефа — общая с башней: с аркой-проходом
  {
    const sideW = (W - DOOR_W) / 2, sideX = DOOR_W / 2 + sideW / 2;
    B.put('stone', sideW, H, T, -sideX, H / 2, nz(-D / 2 + T / 2), 2.0);
    B.put('stone', sideW, H, T, sideX, H / 2, nz(-D / 2 + T / 2), 2.0);
    B.put('stone', DOOR_W, H - 3.4, T, 0, 3.4 + (H - 3.4) / 2, nz(-D / 2 + T / 2), 2.0);
    // арка над проходом из башни
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.5, 3.4, 0.5, sx * (DOOR_W / 2 + 0.25), 1.7, nz(-D / 2 + 0.1), 1.2);
    }
    B.add(cyl(DOOR_W / 2 + 0.25, DOOR_W / 2 + 0.25, 0.5, 12, true), 'stoneDark',
      mat(0, 3.4, nz(-D / 2 + 0.1), 0, Math.PI / 2));
    colliders.boxes.push({ cx: -sideX, cz: nz(-D / 2 + T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
    colliders.boxes.push({ cx: sideX, cz: nz(-D / 2 + T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
  }
  // свод и нервюры
  B.put('stoneDark', W - T * 2, 0.34, D - T * 2, 0, H - 0.17, NEZ, 1.6);
  for (let i = 0; i < 9; i++) {
    B.put('timber', W - T * 2, 0.2, 0.24, 0, H - 0.42, nz(-D / 2 + 1.3 + i * 1.7), 1.2);
  }
  // ряд колонн вдоль нефа
  for (let i = 0; i < 6; i++) {
    for (const sx of [-1, 1]) {
      const z = nz(-D / 2 + 2.4 + i * 2.2);
      B.add(cyl(0.22, 0.26, H - 0.5, 10), 'stone', mat(sx * (W / 2 - 0.85), (H - 0.5) / 2, z));
      B.put('stoneDark', 0.7, 0.22, 0.7, sx * (W / 2 - 0.85), H - 0.55, z, 1.2);
    }
  }

  /* ---------------- витражи ---------------- */
  const glassKinds = ['stainedRed', 'stainedBlue', 'stainedGold', 'stainedGreen'];
  for (let i = 0; i < 4; i++) {
    const z = nz(-D / 2 + 3.0 + i * 3.3);
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
  const benchZ = [-4.0, -1.4, 1.2, 3.8].map(nz);
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
  const az = nz(D / 2 - 1.7);
  {
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

  /* ---------------- задняя дверь нефа (на север) ---------------- */
  const backDoor = { x: 0, z: nz(D / 2 - T / 2) };
  {
    const sideW = (W - BACK_W) / 2, sideX = BACK_W / 2 + sideW / 2;
    // проём в северной стене
    B.put('stone', sideW, H, T, -sideX, H / 2, nz(D / 2 - T / 2), 2.0);
    B.put('stone', sideW, H, T, sideX, H / 2, nz(D / 2 - T / 2), 2.0);
    B.put('stone', BACK_W, H - 3.2, T, 0, 3.2 + (H - 3.2) / 2, nz(D / 2 - T / 2), 2.0);
    // портал: колонны, перемычка, тяжёлая створка с железными обвязками
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.5, 3.2, 0.55, sx * (BACK_W / 2 + 0.25), 1.6, nz(D / 2 - 0.05), 1.2);
    }
    B.put('stoneDark', BACK_W + 1.0, 0.4, 0.6, 0, 3.4, nz(D / 2 - 0.05), 1.2);
    for (const sy of [0.6, 1.7, 2.8]) {
      B.put('oakDoor', BACK_W - 0.06, 0.92, 0.14, 0, sy, nz(D / 2 - T / 2 - 0.04), 1.3);
      B.put('iron', BACK_W - 0.02, 0.14, 0.17, 0, sy, nz(D / 2 - T / 2 - 0.1), 1);
    }
    B.add(torus(0.12, 0.028, 5, 12), 'iron',
      mat(BACK_W / 2 - 0.3, 1.5, nz(D / 2 - T / 2 - 0.12), 0, Math.PI / 2));
    B.put('iron', 0.22, 0.3, 0.07, BACK_W / 2 - 0.3, 1.5, nz(D / 2 - T / 2 - 0.08), 1);
    // ступени к двери с внутренней стороны
    B.put('stone', BACK_W + 0.8, 0.16, 0.5, 0, 0.08, nz(D / 2 - 0.85), 1.2);
    colliders.boxes.push({ cx: -sideX, cz: nz(D / 2 - T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
    colliders.boxes.push({ cx: sideX, cz: nz(D / 2 - T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
    spots.push([new THREE.Vector3(0, 1.4, nz(D / 2 - 1.3)), 'Тяжёлая дверь на засовe: за ней задний двор и тропа к долине.']);
  }

  /* ---------------- курильница у входа в неф ---------------- */
  {
    const cz = nz(-D / 2 + 1.5);
    B.put('stoneDark', 0.7, 0.16, 0.7, -2.9, 0.08, cz, 1.2);
    B.add(cyl(0.26, 0.32, 0.5, 10), 'brass', mat(-2.9, 0.4, cz));
    B.add(torus(0.3, 0.03, 5, 12), 'brass', mat(-2.9, 0.66, cz, 0, Math.PI / 2));
    colliders.boxes.push({ cx: -2.9, cz, hx: 0.35, hz: 0.35, ang: 0 });
    spots.push([new THREE.Vector3(-2.9, 1.1, cz), 'Курильница дымит ладаном. Дым витками поднимается к своду.']);
  }

  /* ---------------- образы на стенах ---------------- */
  for (const sx of [-1, 1]) {
    for (const z of [-5.0, 0.4]) {
      const ix = sx * (W / 2 - T - 0.05);
      B.put('brass', 0.07, 1.3, 1.0, ix, 2.2, nz(z), 1.2);         // золотая рама
      B.put('timber', 0.05, 1.1, 0.8, ix - sx * 0.05, 2.2, nz(z), 1.2); // тёмный холст
      B.put('redCloth', 0.05, 0.42, 0.34, ix - sx * 0.08, 1.92, nz(z), 1.2);
      B.put('bone', 0.05, 0.26, 0.26, ix - sx * 0.08, 2.45, nz(z), 1.2);
    }
  }

  /* ---------------- коллайдеры стен нефа ---------------- */
  colliders.boxes.push({ cx: -W / 2 + T / 2, cz: NEZ, hx: T / 2, hz: D / 2, ang: 0 });
  colliders.boxes.push({ cx: W / 2 - T / 2, cz: NEZ, hx: T / 2, hz: D / 2, ang: 0 });

  /* ---------------- свет ---------------- */
  const group = B.build(M, null, { name: 'churchInterior' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14121a);
  scene.fog = new THREE.Fog(0x14121a, 7, 34);
  scene.add(group);

  const altar = new THREE.PointLight(0xffb45a, 16, 22, 1.2);
  altar.position.set(0, 2.2, az - 1.6);
  scene.add(altar);
  const west = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  west.position.set(-W / 2 + 1.0, 3.1, NEZ - 1.2);
  scene.add(west);
  const east = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  east.position.set(W / 2 - 1.0, 3.1, NEZ + 1.2);
  scene.add(east);
  // холодный «дневной» свет, падающий сверху через витражи
  const sky = new THREE.DirectionalLight(0xa8c4e8, 1.2);
  sky.position.set(-6, 14, NEZ + 4);
  scene.add(sky);
  // свет из башни — падает сверху на лестницу
  const towerLight = new THREE.PointLight(0xbcd4f0, 7, 16, 1.3);
  towerLight.position.set(0, BELL_Y + 1.4, TZ);
  scene.add(towerLight);
  // тёплый свет свечей в нижнем ярусе башни
  for (const sx of [-1, 1]) {
    const c = new THREE.PointLight(0xffb45a, 2.2, 9, 1.9);
    c.position.set(sx * (TW / 2 - 0.5), 1.95, TZ + 1.2);
    scene.add(c);
  }
  // холодный дневной свет из бойниц
  const shaft = new THREE.PointLight(0xa8c4e8, 2.6, 13, 1.6);
  shaft.position.set(0, BELL_Y + 1.7, TZ - 1.6);
  scene.add(shaft);
  scene.add(new THREE.AmbientLight(0x8a8296, 1.5));
  scene.add(new THREE.HemisphereLight(0x8fa8c8, 0x3a3228, 1.1));

  /* ---------------- колокол (отдельный меш — он качается) ---------------- */
  const bellPivot = new THREE.Group();
  bellPivot.position.set(BELL_X, BELL_Y + 1.95, BELL_Z - 0.05);
  const bellMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.5, 0.72, 12, 1, true), M.brass);
  bellMesh.material.side = THREE.DoubleSide;
  bellMesh.position.y = -0.5;
  bellPivot.add(bellMesh);
  const bellTop = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.brass);
  bellTop.position.y = -0.12;
  bellPivot.add(bellTop);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), M.iron);
  clapper.position.y = -0.85;
  bellPivot.add(clapper);
  // деревянный язык: стержень от колокола вниз к шарику
  const clapperRod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6), M.timber);
  clapperRod.position.y = -0.6;
  bellPivot.add(clapperRod);
  group.add(bellPivot);

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

  let ring = 0;          // сила удара — затухает со временем
  let swing = 0;         // текущий угол качания колокола

  /** Ударить в колокол: звук, толчок и раскачка. */
  function ringBell() {
    ring = 1;
  }

  const exitDoor = { x: 0, y: 1.4, z: TZ0 + 0.9 };
  const backExit = { x: backDoor.x, y: 1.4, z: nz(D / 2 - 1.4) };

  return {
    scene, group, colliders, platforms, floors: [], climbs: [],
    /** Точка появления у входа с улицы (нижний ярус башни). */
    spawn: { x: 0, z: TZ0 + 1.0, yaw: 0 },
    /** Точка появления при входе через заднюю дверь нефа. */
    spawnBack: { x: backDoor.x, z: nz(D / 2 - 1.6), yaw: Math.PI },
    exitDoor,
    backExit,
    /** Точка, где стоит колокол — только там его можно ударить. */
    bellPoint: new THREE.Vector3(BELL_X, BELL_Y + 1.1, BELL_Z),
    ringBell,
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
      // колокол: после удара раскачивается и постепенно затихает
      if (ring > 0.001) {
        ring *= Math.exp(-dt * 0.45);
        swing += dt * 7.5;
        bellPivot.rotation.x = Math.sin(swing) * 0.32 * ring;
        clapper.position.x = Math.sin(swing * 1.02 + 0.6) * 0.14 * ring;
      } else if (bellPivot.rotation.x !== 0) {
        bellPivot.rotation.x *= 0.85;
        clapper.position.x *= 0.85;
      }
      motes.update(dt, { x: 0, z: NEZ });
    },
  };
}
