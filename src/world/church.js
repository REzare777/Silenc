/**
 * ============================================================================
 *  Храм: неф и звонарная на севере
 * ============================================================================
 *
 *  Снаружи церковь стоит на холме. Внутри — два помещения:
 *
 *   · неф — скамьи, витражи, алтарь; вход с южного фасада;
 *   · звонарная — отдельная каменная комната СЗАДИ храма, куда ведёт
 *     задняя дверь. В ней каменная лестница наверх и сам колокол:
 *     ударить в него можно только там, наверху.
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
const DOOR_W = 2.6;   // ширина арки из нефа в звонарную
const AISLE = 1.5;    // ширина центрального прохода
const NEZ = 2.0;      // центр нефа по z (звонарная — за северной стеной)

/* ---------------- звонарная (за северной стеной храма) ---------------- */
const TW = 9.0;       // внутренний размер звонарной (x и z) — по ширине нефа
const TZ = 14.7;      // центр звонарной по z: её южная стена примыкает к нефу
                       // (TW изменилось — центр сдвинулся, чтобы стена не заехала внутрь)
const TH = 8.0;       // высота стен
const BELL_Y = 4.2;   // высота площадки с колоколом
const LW = 1.4;       // ширина лестничного пролёта
const NAVE_DOOR_W = 1.7;  // ширина двери звонарной наружу (сзади храма)
const ARK_W = 0.9;        // ширина служебной двери из нефа в звонарную
const ARK_X = -3.95;      // дверь — в самом правом углу нефа, за колоннами:
//                         из молитвенной её не видно, а проход заперт

/** Название храма — показывается при входе. */
export const CHURCH_NAME = 'Храм Святого Покрова';

/**
 * Собирает интерьер храма: неф и звонарную с лестницей.
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

  /* ================= звонарная ================= */
  const TX0 = -TW / 2, TX1 = TW / 2;                 // внутренние границы по x
  const TZ0 = TZ - TW / 2, TZ1 = TZ + TW / 2;        // внутренние границы по z
  {
    // пол звонарной — каменные плиты, кое-где растрескавшиеся
    B.put('stone', TW, 0.16, TW, 0, -0.08, TZ, 1.6);
    // западная и восточная стены
    B.put('stone', T, TH, TW + T * 2, TX0 - T / 2, TH / 2, TZ, 1.6);
    B.put('stone', T, TH, TW + T * 2, TX1 + T / 2, TH / 2, TZ, 1.6);
    // южная стена звонарной — общая с нефом, в ней проём к запертой двери
    {
      const aL = ARK_X - ARK_W / 2, aR = ARK_X + ARK_W / 2;
      const leftW = aL - TX0;
      if (leftW > 0.02) {
        B.put('stone', leftW, TH, T, (TX0 + aL) / 2, TH / 2, TZ0 - T / 2, 1.6);
        colliders.boxes.push({ cx: (TX0 + aL) / 2, cz: TZ0 - T / 2, hx: leftW / 2, hz: T / 2, ang: 0 });
      }
      B.put('stone', TX1 - aR, TH, T, (aR + TX1) / 2, TH / 2, TZ0 - T / 2, 1.6);
      B.put('stone', ARK_W, TH - 3.2, T, ARK_X, 3.2 + (TH - 3.2) / 2, TZ0 - T / 2, 1.6);
      // арка над проходом
      for (const sx of [-1, 1]) {
        B.put('stoneDark', 0.4, 3.2, 0.5, ARK_X + sx * (ARK_W / 2 + 0.2), 1.6, TZ0 + 0.05, 1.2);
      }
      B.add(cyl(ARK_W / 2 + 0.2, ARK_W / 2 + 0.2, 0.45, 12, true), 'stoneDark',
        mat(ARK_X, 3.2, TZ0 + 0.05, 0, Math.PI / 2));
      colliders.boxes.push({ cx: (aR + TX1) / 2, cz: TZ0 - T / 2, hx: (TX1 - aR) / 2, hz: T / 2, ang: 0 });
    }
    // северная стена — с дверью наружу (вход с задней стороны храма)
    {
      const sideW = (TW + T * 2 - NAVE_DOOR_W) / 2;
      const sideX = NAVE_DOOR_W / 2 + sideW / 2;
      B.put('stone', sideW, TH, T, -sideX, TH / 2, TZ1 + T / 2, 1.6);
      B.put('stone', sideW, TH, T, sideX, TH / 2, TZ1 + T / 2, 1.6);
      B.put('stone', NAVE_DOOR_W, TH - 2.6, T, 0, 2.6 + (TH - 2.6) / 2, TZ1 + T / 2, 1.6);
      // каменный косяк с профилем
      B.put('stoneDark', 0.34, 2.7, 0.5, -NAVE_DOOR_W / 2 - 0.17, 1.35, TZ1 + 0.2, 1.2);
      B.put('stoneDark', 0.34, 2.7, 0.5, NAVE_DOOR_W / 2 + 0.17, 1.35, TZ1 + 0.2, 1.2);
      B.put('stoneDark', NAVE_DOOR_W + 0.9, 0.3, 0.56, 0, 2.78, TZ1 + 0.2, 1.2);
      // дубовая створка: вертикальные доски, накладки, петли и кольцо
      {
        const nb = 7, bw = NAVE_DOOR_W / nb;
        for (let i = 0; i < nb; i++) {
          const px = -NAVE_DOOR_W / 2 + (i + 0.5) * bw;
          B.add(box(bw - 0.025, 2.42, 0.09, 1), 'oakDoor', mat(px, 1.21, TZ1 + 0.12));
        }
        // три железные обвязки
        for (const by of [0.42, 1.24, 2.16]) {
          B.put('timber', NAVE_DOOR_W + 0.06, 0.15, 0.05, 0, by, TZ1 + 0.17, 1.1);
          for (let i = 0; i < 5; i++) {
            B.add(sphere(0.035, 6, 5), 'brass',
              mat(-NAVE_DOOR_W / 2 + 0.16 + i * ((NAVE_DOOR_W - 0.32) / 4), by, TZ1 + 0.2));
          }
        }
        // петли
        for (const by of [0.55, 1.95]) {
          B.put('iron', 0.22, 0.16, 0.06, -NAVE_DOOR_W / 2 + 0.1, by, TZ1 + 0.17, 1);
        }
      }
      B.put('timber', NAVE_DOOR_W + 0.1, 0.16, 0.18, 0, 1.55, TZ1 + 0.05, 1.1);
      B.add(torus(0.1, 0.025, 5, 10), 'iron', mat(0.5, 1.25, TZ1 + 0.02, 0, Math.PI / 2));
      B.put('iron', 0.16, 0.26, 0.06, 0.5, 1.25, TZ1 + 0.06, 1);
      colliders.boxes.push({ cx: -sideX, cz: TZ1 + T / 2, hx: sideW / 2, hz: T / 2, ang: 0 });
      colliders.boxes.push({ cx: sideX, cz: TZ1 + T / 2, hx: sideW / 2, hz: T / 2, ang: 0 });
      // проём закрыт сколоченной створкой: наружу — только через интеракт
      colliders.boxes.push({ cx: 0, cz: TZ1 + T / 2, hx: NAVE_DOOR_W / 2, hz: T / 2, ang: 0 });
    }
    // свод звонарной: дощатый настил с крестовыми балками
    B.put('plank', TW + T * 2, 0.2, TW + T * 2, 0, TH - 0.1, TZ, 1.2);
    for (const s2 of [-1, 1]) {
      B.put('timber', TW + T * 2, 0.26, 0.26, 0, TH - 0.32, TZ + s2 * (TW / 2 - 0.4), 1.2);
      B.put('timber', 0.26, 0.26, TW + T * 2, s2 * (TW / 2 - 0.4), TH - 0.32, TZ, 1.2);
    }
    // бойницы на восточной стене — свет из них падает прямо на колокол
    for (const bz of [12.9, 14.0]) {
      // каменная ниша-бойница: откосы и заглублённый проём
      B.put('stoneDark', 0.4, 1.8, 0.62, TX1 + 0.2, BELL_Y + 1.6, bz, 1.2);
      B.put('dark', 0.1, 1.45, 0.2, TX1 + 0.36, BELL_Y + 1.6, bz, 1.2);
      B.put('stoneDark', 0.26, 0.2, 0.3, TX1 + 0.34, BELL_Y + 0.82, bz, 1.2);
      B.put('stoneDark', 0.26, 0.2, 0.3, TX1 + 0.34, BELL_Y + 2.38, bz, 1.2);
    }
    // Доски сложены стопкой в северо-восточном углу — не мусор в проходе
    for (let i = 0; i < 4; i++) {
      B.add(box(1.5 - i * 0.06, 0.07, 0.26, 1), 'plank',
        mat(TX1 - 0.95 - i * 0.02, 0.04 + i * 0.075, TZ1 - 0.55 + i * 0.03, 0.06 * i));
    }
    // Метла и ведро у стены — звонарка убрана
    B.add(box(0.06, 1.35, 0.06, 1), 'timber', mat(TX1 - 0.35, 0.7, TZ1 - 0.5, 0.06));
    B.add(box(0.42, 0.16, 0.24, 1), 'timber', mat(TX1 - 0.38, 0.1, TZ1 - 0.56, 0.06));
    B.add(cyl(0.17, 0.13, 0.26, 10), 'oakDoor', mat(TX1 - 1.5, 0.13, TZ1 - 0.45));
    B.add(torus(0.16, 0.02, 5, 12), 'iron', mat(TX1 - 1.5, 0.24, TZ1 - 0.45, 0, Math.PI / 2));
    // Фонарь на крюке у входной двери
    B.put('iron', 0.07, 0.07, 0.3, TX1 - 0.2, 2.35, TZ1 - 1.1, 1.1);
    B.add(cyl(0.11, 0.15, 0.2, 8), 'iron', mat(TX1 - 0.36, 2.1, TZ1 - 1.1));
    B.add(cyl(0.08, 0.06, 0.12, 8), 'lampGlass', mat(TX1 - 0.36, 1.96, TZ1 - 1.1));
    // Связка свечей на стене
    B.put('iron', 0.14, 0.05, 0.1, TX1 - 0.1, 1.75, TZ1 - 1.9, 1.1);
    for (let i = 0; i < 3; i++) {
      B.add(cyl(0.045, 0.05, 0.26, 8), 'bone', mat(TX1 - 0.16 - i * 0.03, 1.82, TZ1 - 1.9 + i * 0.05));
    }
    // Тряпка/коврик у порога
    B.add(box(1.1, 0.04, 0.7, 1), 'redCloth', mat(0, 0.02, TZ1 - 0.9, 0.02));
    // паутина в углах
    for (const sx of [-1, 1]) {
      B.add(plane(0.9, 1.4), 'cloth', mat(sx * (TW / 2 - 0.5), 2.6, TZ0 + 0.55, sx * 0.9));
    }
  }

  /* ---------------- каменная лестница звонарной: три пролёта ---------------- */
  // Ступени ровные и уложенные, перила-балясины на месте: «заброшенность»
  // читается в мелочах (щепки, паутина, пыль), а не в развалинах в воздухе.
  const flight = (x0, z0, x1, z1, y0, y1, opts = {}) => {
    const dx = x1 - x0, dz = z1 - z0;
    const L = Math.hypot(dx, dz);
    const n = Math.max(6, Math.round(L / 0.3));
    const ang = Math.atan2(dx, dz);
    const ux = dx / L, uz = dz / L;              // вдоль пролёта
    const nx = -uz, nz2 = ux;                    // поперёк пролёта
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const y = y0 + (y1 - y0) * t;
      // ровная ступень; часть стёсана — старый камень
      const chip = i % 5 === 2 ? 0.03 : 0;
      B.add(box(LW, 0.16, L / n + 0.02, 1), 'stone',
        mat(x0 + dx * t, y - 0.08 - chip, z0 + dz * t, ang));
      // подступенок — кладка без щелей
      B.add(box(LW, (y1 - y0) / n + 0.16, 0.1, 1), 'stoneDark',
        mat(x0 + dx * t - ux * (L / n / 2), y - (y1 - y0) / n / 2 - 0.13,
          z0 + dz * t - uz * (L / n / 2), ang));
    }
    // Каменные опоры: у пристенных пролётов ступени входят в стену сами,
    // а поперечный пролёт держится на колоннах — никаких ступеней в воздухе.
    for (const sp of opts.pillars || []) {
      B.put('stone', 0.6, sp.y, 0.6, sp.x, sp.y / 2, sp.z, 1.4);
      B.put('stoneDark', 0.78, 0.26, 0.78, sp.x, 0.13, sp.z, 1.4);
      B.put('stoneDark', 0.72, 0.22, 0.72, sp.x, sp.y - 0.11, sp.z, 1.4);
    }
    // Каменный парапет по открытому краю галереи: зубцы идут по ступеням,
    // поэтому он повторяет наклон и не выглядит «столбиками в воздухе».
    if (opts.parapet) {
      const side = opts.parapet;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const y = y0 + (y1 - y0) * t;
        B.add(box(0.2, 0.9, L / n + 0.02, 1), 'stone',
          mat(x0 + dx * t + nx * side * (LW / 2 - 0.1), y + 0.37,
            z0 + dz * t + nz2 * side * (LW / 2 - 0.1), ang));
      }
    }
    return { x0, z0, x1, z1, y0, y1, ang, len: L };
  };

  // Лестница убрана в южную половину комнаты: вход с севера (дверь наружу)
  // встречает свободный пол, а не первую ступень.
  const flights = [
    // пролёт A — вдоль западной стены: ступени входят в кладку
    flight(TX0 + LW / 2, TZ1 - 1.0, TX0 + LW / 2, TZ1 - 4.7, 0, 1.4),
    // пролёт B — поперёк комнаты, держится на двух каменных колоннах
    flight(TX0 + LW / 2, TZ1 - 4.7, TX1 - LW / 2, TZ1 - 4.7, 1.4, 2.9, {
      parapet: 1,
      pillars: [
        { x: TX0 + 1.35, z: TZ1 - 4.7, y: 2.55 },
        { x: TX1 - 1.35, z: TZ1 - 4.7, y: 2.55 },
      ],
    }),
    // пролёт C — вдоль восточной стены, на север, к площадке с колоколом
    flight(TX1 - LW / 2, TZ1 - 4.7, TX1 - LW / 2, TZ1 - 2.8, 2.9, BELL_Y),
  ];
  // Каждый пролёт режется на короткие секции: игрок может подняться только
  // на 0.46 м выше того места, где стоит, — длинный наклон «терял» игрока.
  for (const f of flights) {
    const segs = Math.max(1, Math.ceil((f.y1 - f.y0) / 0.4));
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      platforms.push({
        ramp: {
          x0: f.x0 + (f.x1 - f.x0) * t0, z0: f.z0 + (f.z1 - f.z0) * t0,
          x1: f.x0 + (f.x1 - f.x0) * t1, z1: f.z0 + (f.z1 - f.z0) * t1,
          y0: f.y0 + (f.y1 - f.y0) * t0, y1: f.y0 + (f.y1 - f.y0) * t1,
          halfWidth: LW / 2 - 0.05,
        },
      });
    }
  }

  /* ---------------- площадки звонарной ---------------- */
  const landings = [
    { x: TX0 + LW / 2, z: TZ1 - 4.7, hx: LW / 2, hz: LW / 2, y: 1.4 },
    { x: TX1 - LW / 2, z: TZ1 - 4.7, hx: LW / 2, hz: LW / 2, y: 2.9 },
    { x: TX1 - LW / 2, z: TZ1 - 2.8, hx: LW / 2, hz: 0.8, y: BELL_Y },
  ];
  for (const p of landings) {
    // Настил площадки на 5 см ниже верхней ступени: при точном совпадении
    // верхних граней ступени и площадки на стыке шло мерцание (z-fighting).
    B.put('plank', p.hx * 2, 0.16, p.hz * 2, p.x, p.y - 0.13, p.z, 1.2);
    platforms.push({ cx: p.x, cz: p.z, hx: p.hx, hz: p.hz, ang: 0, y: p.y });
  }
  // перила на промежуточных площадках — по открытым краям
  for (const p of landings.slice(0, 2)) {
    const edge = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0;
      const L = Math.hypot(dx, dz);
      B.add(box(0.11, 0.11, L, 1), 'timber',
        mat((x0 + x1) / 2, p.y + 0.92, (z0 + z1) / 2, Math.atan2(dx, dz)));
      const nB = Math.max(2, Math.round(L / 0.5));
      for (let i = 0; i <= nB; i++) {
        const t = i / nB;
        B.add(box(0.07, 0.9, 0.07, 1), 'timber',
          mat(x0 + dx * t, p.y + 0.45, z0 + dz * t, 0));
      }
    };
    edge(p.x - p.hx, p.z + p.hz, p.x + p.hx, p.z + p.hz);
  }
  // ограждение площадки с колоколом: целые перила по трём сторонам
  {
    const p = landings[2];
    const rail = (x0, z0, x1, z1) => {
      const dx = x1 - x0, dz = z1 - z0;
      const L = Math.hypot(dx, dz);
      // поручень
      B.add(box(0.11, 0.11, L, 1), 'timber',
        mat((x0 + x1) / 2, p.y + 0.92, (z0 + z1) / 2, Math.atan2(dx, dz)));
      // балясины
      const nB = Math.max(2, Math.round(L / 0.5));
      for (let i = 0; i <= nB; i++) {
        const t = i / nB;
        B.add(box(0.07, 0.9, 0.07, 1), 'timber',
          mat(x0 + dx * t, p.y + 0.46, z0 + dz * t, 0));
      }
    };
    rail(p.x - p.hx, p.z - p.hz, p.x + p.hx, p.z - p.hz);          // юг
    rail(p.x - p.hx, p.z - p.hz, p.x - p.hx, p.z + p.hz);          // запад
    rail(p.x + p.hx, p.z - p.hz, p.x + p.hx, p.z + p.hz - 0.9);   // восток (вход с лестницы)
  }

  /* ---------------- колокол ---------------- */
  const BELL_X = landings[2].x, BELL_Z = landings[2].z;
  {
    // перекладина: балка от стены до стены — колокол висит под ней
    B.add(box(TW + 0.4, 0.3, 0.32, 1), 'timber', mat(0, BELL_Y + 2.1, BELL_Z));
    B.add(box(0.26, 0.26, 0.5, 1), 'timber', mat(-TW / 2 + 0.15, BELL_Y + 2.1, BELL_Z));
    B.add(box(0.26, 0.26, 0.5, 1), 'timber', mat(TW / 2 - 0.15, BELL_Y + 2.1, BELL_Z));
    // свеча на перилах площадки
    B.add(cyl(0.05, 0.06, 0.3, 8), 'bone', mat(BELL_X + 1.9, BELL_Y + 0.3, BELL_Z - 0.8));
    B.add(sphere(0.055, 8, 6), 'lampGlass', mat(BELL_X + 1.9, BELL_Y + 0.48, BELL_Z - 0.8));
    // подсвечник на стене нижнего яруса
    {
      const cx = TX1 - 0.16;
      B.put('iron', 0.16, 0.06, 0.16, cx, 1.55, TZ - 1.2, 1.2);
      B.add(cyl(0.05, 0.06, 0.28, 8), 'bone', mat(cx, 1.72, TZ - 1.2));
      B.add(sphere(0.055, 8, 6), 'lampGlass', mat(cx, 1.9, TZ - 1.2));
    }
  }

  /* ================= неф ================= */
  // пол — каменные плиты, по центру ковровая дорожка
  B.put('stone', W - T * 2, 0.14, D - T * 2, 0, -0.07, NEZ, 1.6);
  B.put('redCloth', AISLE, 0.04, D - T * 2 - 0.6, 0, 0.02, NEZ, 1.2);
  // западная и восточная стены
  B.put('stone', T, H, D - T * 2, -W / 2 + T / 2, H / 2, NEZ, 2.0);
  B.put('stone', T, H, D - T * 2, W / 2 - T / 2, H / 2, NEZ, 2.0);
  // южная стена нефа — вход с улицы (портал)
  {
    const sideW = (W - DOOR_W) / 2, sideX = DOOR_W / 2 + sideW / 2;
    B.put('stone', sideW, H, T, -sideX, H / 2, nz(-D / 2 + T / 2), 2.0);
    B.put('stone', sideW, H, T, sideX, H / 2, nz(-D / 2 + T / 2), 2.0);
    B.put('stone', DOOR_W, H - 3.8, T, 0, 3.8 + (H - 3.8) / 2, nz(-D / 2 + T / 2), 2.0);
    // портал: две колонны и полуциркульная арка
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.6, 3.8, 0.6, sx * (DOOR_W / 2 + 0.3), 1.9, nz(-D / 2 + 0.1), 1.2);
      B.put('stoneDark', 0.8, 0.3, 0.8, sx * (DOOR_W / 2 + 0.3), 0.15, nz(-D / 2 + 0.1), 1.2);
    }
    B.add(cyl(DOOR_W / 2 + 0.3, DOOR_W / 2 + 0.3, 0.55, 14, true), 'stoneDark',
      mat(0, 3.8, nz(-D / 2 + 0.1), 0, Math.PI / 2));
    B.put('stoneDark', DOOR_W + 1.4, 0.35, 0.7, 0, 4.25, nz(-D / 2 + 0.1), 1.2);
    // распахнутые внутрь створки
    B.put('dark', DOOR_W, 3.8, 0.3, 0, 1.9, nz(-D / 2 + 0.42), 1.2);
    for (const sx of [-1, 1]) {
      const a = sx * 1.15;
      B.add(box(DOOR_W / 2, 3.4, 0.12, 1), 'oakDoor',
        mat(sx * (DOOR_W / 2 - 0.05) + Math.sin(a) * (DOOR_W / 4), 1.7,
          nz(-D / 2 + 0.35) + (1 - Math.cos(a)) * (DOOR_W / 4), a));
    }
    colliders.boxes.push({ cx: -sideX, cz: nz(-D / 2 + T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
    colliders.boxes.push({ cx: sideX, cz: nz(-D / 2 + T / 2), hx: sideW / 2, hz: T / 2, ang: 0 });
    // портал снаружи закрыт: наружу игрок выходит только через интеракт
    colliders.boxes.push({ cx: 0, cz: nz(-D / 2 + T / 2), hx: DOOR_W / 2, hz: T / 2, ang: 0 });
  }
  // северная стена нефа — в правом углу дверь в звонарную, запертая на засов.
  // Раньше здесь был широкий открытый проём сбоку от алтаря: из молитвенной
  // были видны лестничный пролёт и чёрный провал. Теперь дверь переставлена
  // вправо, убрана в угол за колоннами и закрыта — из нефа её не видно,
  // а в звонарную ведёт ход с заднего двора храма.
  {
    const aL = ARK_X - ARK_W / 2, aR = ARK_X + ARK_W / 2;
    const wL = (aL - (-W / 2)), wR = (W / 2 - aR);
    B.put('stone', wL, H, T, (-W / 2 + aL) / 2, H / 2, nz(D / 2 - T / 2), 2.0);
    B.put('stone', wR, H, T, (aR + W / 2) / 2, H / 2, nz(D / 2 - T / 2), 2.0);
    B.put('stone', ARK_W, H - 3.2, T, ARK_X, 3.2 + (H - 3.2) / 2, nz(D / 2 - T / 2), 2.0);
    // каменный портал: косяки и полуциркульная перемычка
    for (const sx of [-1, 1]) {
      B.put('stoneDark', 0.4, 3.2, 0.5, ARK_X + sx * (ARK_W / 2 + 0.2), 1.6, nz(D / 2 - 0.05), 1.2);
    }
    B.add(cyl(ARK_W / 2 + 0.2, ARK_W / 2 + 0.2, 0.5, 12, true), 'stoneDark',
      mat(ARK_X, 3.2, nz(D / 2 - 0.05), 0, Math.PI / 2));
    // Глухая подложка во всю толщу стены: за закрытой дверью — камень,
    // а не чёрный провал в сторону лестницы.
    B.put('dark', ARK_W, 3.1, 0.86, ARK_X, 1.6, nz(D / 2 - 0.02), 1.2);
    // Свеча на стене рядом с дверью: без неё закрытая створка читалась
    // чёрной щелью, а не дверью.
    {
      const cx2 = ARK_X + ARK_W / 2 + 0.38;
      const cz2 = nz(D / 2 - T - 0.07);
      B.put('iron', 0.11, 0.05, 0.16, cx2, 1.5, cz2, 1.1);
      B.add(cyl(0.045, 0.05, 0.26, 8), 'bone', mat(cx2, 1.69, cz2));
      B.add(sphere(0.05, 8, 6), 'lampGlass', mat(cx2, 1.86, cz2));
    }
    // Закрытая дубовая дверь: цельное полотно, три обвязки, петли, кольцо
    // и железный засов — заперта наглухо.
    {
      const leafW = ARK_W + 0.1;                // полотно шире проёма — щели нет
      const leafH = 3.15;
      const dz = nz(D / 2 - T - 0.07);          // створка перед южной гранью стены
      // доски полотна
      const nb = 6, bw = leafW / nb;
      for (let i = 0; i < nb; i++) {
        const px = ARK_X - leafW / 2 + (i + 0.5) * bw;
        B.add(box(bw - 0.02, leafH, 0.1, 1), 'oakDoor', mat(px, leafH / 2, dz));
      }
      // три железные обвязки
      for (const by of [0.42, 1.45, 2.5]) {
        B.put('timber', leafW + 0.04, 0.14, 0.05, ARK_X, by, dz - 0.06, 1.1);
        for (let i = 0; i < 3; i++) {
          B.add(sphere(0.032, 6, 5), 'brass',
            mat(ARK_X - leafW / 2 + 0.16 + i * ((leafW - 0.32) / 2), by, dz - 0.08));
        }
      }
      // петли и кольцо
      for (const by of [0.55, 2.25]) {
        B.put('iron', 0.2, 0.15, 0.06, ARK_X - leafW / 2 + 0.1, by, dz - 0.05, 1);
      }
      B.add(torus(0.095, 0.024, 5, 12), 'iron', mat(ARK_X + leafW / 2 - 0.13, 1.3, dz - 0.08, 0, Math.PI / 2));
      // засов — дверь заперта изнутри
      B.put('iron', leafW + 0.1, 0.1, 0.07, ARK_X, 1.9, dz - 0.1, 1);
      B.put('iron', 0.12, 0.34, 0.12, ARK_X - leafW / 2 - 0.03, 1.9, dz - 0.1, 1);
    }
    colliders.boxes.push({ cx: (-W / 2 + aL) / 2, cz: nz(D / 2 - T / 2), hx: wL / 2, hz: T / 2, ang: 0 });
    colliders.boxes.push({ cx: (aR + W / 2) / 2, cz: nz(D / 2 - T / 2), hx: wR / 2, hz: T / 2, ang: 0 });
    // дверь закрыта — проход заперт
    colliders.boxes.push({ cx: ARK_X, cz: nz(D / 2 - T / 2), hx: ARK_W / 2, hz: T / 2, ang: 0 });
    spots.push([new THREE.Vector3(ARK_X + 0.9, 1.4, nz(D / 2 - 1.3)),
      'Дверь в звонарную заперта на засов. Сюда ведут из заднего двора храма.']);
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
      const wx = sx * (W / 2 - T - 0.06);
      B.put(kind, 0.08, 2.6, 1.7, wx, 3.1, z, 1.2);
      B.put('stoneDark', 0.2, 2.9, 0.22, wx - sx * 0.07, 3.1, z - 0.9, 1.2);
      B.put('stoneDark', 0.2, 2.9, 0.22, wx - sx * 0.07, 3.1, z + 0.9, 1.2);
      B.put('stoneDark', 0.24, 0.22, 2.0, wx - sx * 0.08, 4.5, z, 1.2);
      B.put('stoneDark', 0.24, 0.22, 2.0, wx - sx * 0.08, 1.7, z, 1.2);
      B.put('iron', 0.12, 2.6, 0.1, wx - sx * 0.12, 3.1, z, 1.2);
      B.put('iron', 0.12, 0.1, 1.7, wx - sx * 0.12, 3.1, z, 1.2);
      B.put('stone', 0.42, 0.14, 2.0, wx - sx * 0.2, 1.58, z, 1.2);
    }
  }

  /* ---------------- скамьи ---------------- */
  const benchZ = [-4.0, -1.4, 1.2].map(nz);
  for (const bz of benchZ) {
    for (const sx of [-1, 1]) {
      const bx = sx * 2.55;
      B.put('timber', 2.0, 0.14, 0.5, bx, 0.55, bz, 1.2);
      B.put('timber', 2.0, 0.7, 0.12, bx, 0.95, bz - 0.24, 1.2);
      for (const lx of [-0.85, 0.85]) {
        B.put('timber', 0.16, 0.55, 0.42, bx + lx, 0.28, bz, 1.2);
      }
      colliders.boxes.push({ cx: bx, cz: bz, hx: 1.0, hz: 0.3, ang: 0 });
    }
  }

  /* ---------------- алтарь ---------------- */
  const az = nz(D / 2 - 2.4);
  {
    B.put('stone', 2.6, 0.9, 1.3, 0, 0.45, az, 1.4);
    B.put('stoneDark', 2.9, 0.18, 1.6, 0, 0.99, az, 1.4);
    B.put('cloth', 2.5, 0.06, 1.3, 0, 1.1, az, 1.2);
    B.put('brass', 0.12, 1.5, 0.12, 0, 1.95, az - 0.35, 1.2);
    B.put('brass', 0.8, 0.12, 0.12, 0, 2.3, az - 0.35, 1.2);
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
      B.put('brass', 0.07, 1.3, 1.0, ix, 2.2, nz(z), 1.2);
      B.put('timber', 0.05, 1.1, 0.8, ix - sx * 0.05, 2.2, nz(z), 1.2);
      B.put('redCloth', 0.05, 0.42, 0.34, ix - sx * 0.08, 1.92, nz(z), 1.2);
      B.put('bone', 0.05, 0.26, 0.26, ix - sx * 0.08, 2.45, nz(z), 1.2);
    }
  }

  /* ---------------- коллайдеры стен нефа ---------------- */
  colliders.boxes.push({ cx: -W / 2 + T / 2, cz: NEZ, hx: T / 2, hz: D / 2, ang: 0 });
  colliders.boxes.push({ cx: W / 2 - T / 2, cz: NEZ, hx: T / 2, hz: D / 2, ang: 0 });
  // стены звонарной
  colliders.boxes.push({ cx: TX0 - T / 2, cz: TZ, hx: T / 2, hz: TW / 2, ang: 0 });
  colliders.boxes.push({ cx: TX1 + T / 2, cz: TZ, hx: T / 2, hz: TW / 2, ang: 0 });

  /* ---------------- свет ---------------- */
  const group = B.build(M, null, { name: 'churchInterior' });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14121a);
  scene.fog = new THREE.Fog(0x14121a, 7, 34);
  scene.add(group);

  // дневной свет сквозь щели заколоченной двери — видно, что снаружи день
  {
    const glow = new THREE.MeshBasicMaterial({ color: 0xbcd0e8, fog: true });
    for (const gx of [-0.19, 0.0, 0.19]) {
      const slat = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 2.2), glow);
      slat.position.set(gx, 1.25, TZ1 + 0.19);
      group.add(slat);
    }
  }

  const altar = new THREE.PointLight(0xffb45a, 16, 22, 1.2);
  altar.position.set(0, 2.2, az - 1.6);
  scene.add(altar);
  const west = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  west.position.set(-W / 2 + 1.0, 3.1, NEZ - 1.2);
  scene.add(west);
  const east = new THREE.PointLight(0x5f9ade, 11, 20, 1.2);
  east.position.set(W / 2 - 1.0, 3.1, NEZ + 1.2);
  scene.add(east);
  // тёплый огонёк свечи у запертой двери
  const doorCandle = new THREE.PointLight(0xffb45a, 2.6, 7, 1.8);
  doorCandle.position.set(ARK_X + ARK_W / 2 + 0.38, 1.9, nz(D / 2 - T - 0.25));
  scene.add(doorCandle);
  const sky = new THREE.DirectionalLight(0xa8c4e8, 1.2);
  sky.position.set(-6, 14, NEZ + 4);
  scene.add(sky);
  // свет в звонарной: холодный сверху и тёплый от свечи
  const towerLight = new THREE.PointLight(0xbcd4f0, 6, 16, 1.3);
  towerLight.position.set(1.55, BELL_Y + 1.5, TZ1 - 2.8);
  scene.add(towerLight);
  const shaft = new THREE.PointLight(0xa8c4e8, 2.6, 13, 1.6);
  shaft.position.set(2.35, BELL_Y + 1.75, TZ1 - 2.8);
  scene.add(shaft);
  const candle = new THREE.PointLight(0xffb45a, 2.2, 9, 1.9);
  candle.position.set(TX1 - 0.6, 1.95, TZ - 1.2);
  scene.add(candle);
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

  return {
    scene, group, colliders, platforms, floors: [], climbs: [],
    // Метрики лестницы: верх настила площадки на 5 см ниже верхней ступени —
    // плоскости не совпадают, поэтому на стыке нет мерцания.
    stairsGeom: { deckTop: landings[0].y - 0.05, stepTop: landings[0].y },
    // Дверь из нефа в звонарную: переставлена вправо и закрыта (раунд 42).
    naveDoor: { x: ARK_X, w: ARK_W, z: nz(D / 2 - T / 2), closed: true },
    /** Вход с улицы — южный портал нефа. */
    spawn: { x: 0, z: nz(-D / 2 + 1.2), yaw: Math.PI },
    /** Вход с задней стороны храма — звонарная, у двери наружу. */
    spawnBack: { x: 0, z: TZ1 - 1.1, yaw: Math.PI },
    exitDoor: { x: 0, y: 1.4, z: nz(-D / 2 + 0.9) },
    backExit: { x: 0, y: 1.4, z: TZ1 - 0.9 },
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
      candle.intensity = 2.2 * (0.85 + Math.sin(t * 7.1) * 0.09 + Math.sin(t * 12.3) * 0.05);
      doorCandle.intensity = 2.6 * (0.85 + Math.sin(t * 8.3 + 1.1) * 0.1 + Math.sin(t * 14.7) * 0.05);
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
