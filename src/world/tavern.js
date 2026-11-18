import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, mat } from './geo.js';
import { makeGlow, signMesh } from './props.js';

/* ------------------------------------------------------------------
 *  «Уставший вепрь» — таверна: отдельная локация (интерьер)
 *
 *  Двухэтажный тёплый зал: большой каменный очаг с живым огнём,
 *  длинная стойка с бутылками и бочками, верхняя галерея с
 *  перилами, подвесные фонари, дубовые балки, столы со свечами.
 *
 *  Все окна завешены шторами, а свет внутри задан постоянно —
 *  поэтому атмосфера таверны не меняется вместе со временем суток
 *  на улице.
 * ------------------------------------------------------------------ */

const W = 15;         // ширина (x)
const D = 18;         // глубина (z)
const WALL = 0.36;    // толщина стены
const H1 = 4.2;       // высота первого этажа (до настила галереи)
const H2 = 3.0;       // высота верхнего этажа
const TOP = H1 + H2;  // верх стен

const BACK_DOOR_Z = -6.7;                 // задняя дверь: центр проёма в восточной стене
const BACK_DOOR_W = 1.2;                  // ширина проёма
const BACK_DOOR_H = 2.15;                 // высота проёма
const SEN_X = 7.5;                        // сени: от восточной стены наружу
const SEN_W = 2.8;                        // ширина сеней
const GAL_Z = 3.6;                       // край настила галереи
const NICH_Z = 5.6;                      // стена с дверями: вход в ниши-комнаты
const HATCH_X1 = -6.05;                  // край проёма (люка) в настиле
const HATCH_Z0 = 3.95, HATCH_Z1 = 5.05;  // проём под лестницу
const LAD_X = -6.95;                     // стойки лестницы (у западной стены)
const LAD_Z0 = 4.05, LAD_Z1 = 4.95;      // ширина лестницы по z
const CLIMB_X = -6.60, CLIMB_Z = 4.5;    // где висит игрок на лестнице

const FIRE_X = -6.55;   // очаг — у западной стены
const FIRE_Z = 0.0;     // очаг — в середине западной стены
const FIRE_OW = 1.0;    // половина ширины проёма очага
const FIRE_OH = 1.75;   // высота проёма очага до пят арки
const BAR_X = 5.5;      // стойка бара — у восточной стены

export function buildTavernInterior(M, glowTex) {
  const group = new THREE.Group();
  group.name = 'tavernInterior';
  const B = new Builder();
  const colliders = { boxes: [], circles: [] };
  const platforms = [];
  const climbs = [];

  const hw = W / 2, hd = D / 2;

  /* ---- собственные материалы: чтобы свет внутри не зависел от улицы ---- */
  const paneMat = new THREE.MeshStandardMaterial({ color: 0x1d2531, roughness: 0.32, metalness: 0.08 });
  const lampGlass = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffb45a, emissiveIntensity: 2.4, roughness: 0.3,
    transparent: true, opacity: 0.95,
  });
  const bottleMats = [
    new THREE.MeshStandardMaterial({ color: 0x3f6b3c, roughness: 0.22, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0x8a5a1e, roughness: 0.22, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0x63222a, roughness: 0.24, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0x9fb0b8, roughness: 0.16, metalness: 0.1, transparent: true, opacity: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0xb9a67e, roughness: 0.5, metalness: 0.05 }),
  ];
  // оттенки ткани для складок: чередование светлой и тёмной даёт
  // читаемый объём — при плоском свете полотно само по себе «плоское»
  const clothMats = {
    curtainA: new THREE.MeshStandardMaterial({ color: 0xd2c0a0, roughness: 1 }),
    curtainB: new THREE.MeshStandardMaterial({ color: 0xb59c7c, roughness: 1 }),
    greenA: new THREE.MeshStandardMaterial({ color: 0x5c7245, roughness: 1 }),
    greenB: new THREE.MeshStandardMaterial({ color: 0x495a37, roughness: 1 }),
  };
  const MT = {
    ...M, pane: paneMat, lampGlass, ...clothMats,
    // стены трактира — тот же тёплый оттенок, что и на фасаде
    tavernWall: M.tavernWall,
    ...bottleMats.reduce((o, m, i) => (o['bottle' + i] = m, o), {}),
  };

  /* ================================================================
   *  ПОЛ
   * ================================================================ */
  B.put('plank', W, 0.18, D, 0, -0.09, 0, 1.8);
  // каменная вытяжка перед очагом
  // каменная площадка перед очагом утоплена в пол: её нижняя грань
  // не должна лежать в сантиметре от плоскости пола
  B.put('cobble', 3.0, 0.1, 3.6, -5.9, 0.03, FIRE_Z, 1.6);
  B.put('stone', 3.2, 0.14, 3.8, -5.9, 0.04, FIRE_Z, 1.6);

  /* ================================================================
   *  СТЕНЫ: каменный цоколь, штукатурка, фахверк
   * ================================================================ */
  const wallKey = 'tavernWall';
  const frameKey = 'timber';

  // ---- южная стена (-z): дверь, два окна зала и три окна галереи ----
  // Проёмы режут стену по сетке: сначала по X, потом по Y — так окна
  // второго этажа могут стоять над окнами первого и над дверью.
  {
    const z = -hd + WALL / 2;
    const DW = 0.85, DH = 2.6;                     // половина ширины двери, высота двери
    const wins = [
      { x: -3.5, w: 1.3, h: 1.7, y: 1.5 },        // нижний ряд зала
      { x: 3.5, w: 1.3, h: 1.7, y: 1.5 },
      { x: -2.6, w: 0.95, h: 1.1, y: 5.09 },      // окна галереи (второй этаж)
      { x: 0, w: 0.95, h: 1.1, y: 5.09 },
      { x: 2.6, w: 0.95, h: 1.1, y: 5.09 },
    ];
    // проёмы: дверь и все окна
    const holes = [
      { x0: -DW, x1: DW, y0: 0, y1: DH, door: true },
      ...wins.map((w) => ({
        x0: w.x - w.w / 2, x1: w.x + w.w / 2,
        y0: w.y - w.h / 2, y1: w.y + w.h / 2,
      })),
    ];
    const panel = (x0, x1, y0, y1) => {
      if (x1 - x0 <= 0.02 || y1 - y0 <= 0.02) return;
      B.put(wallKey, x1 - x0, y1 - y0, WALL, (x0 + x1) / 2, (y0 + y1) / 2, z, 1.9);
    };
    // стена по сетке: вертикальные полосы между отверстиями,
    // в каждой полосе — вырезы по высоте
    const edges = new Set([-hw, hw]);
    for (const h of holes) { edges.add(h.x0); edges.add(h.x1); }
    const xs = [...edges].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1];
      const cx = (x0 + x1) / 2;
      const cuts = holes
        .filter((h) => cx > h.x0 && cx < h.x1)
        .sort((a, b) => a.y0 - b.y0);
      let y = 0;
      for (const c of cuts) {
        panel(x0, x1, y, c.y0);
        y = Math.max(y, c.y1);
      }
      panel(x0, x1, y, TOP);
    }
    // рамы и стёкла окон
    for (const w of wins) {
      const wy0 = w.y - w.h / 2, wy1 = w.y + w.h / 2;
      B.put(frameKey, w.w + 0.24, 0.16, WALL + 0.1, w.x, wy1 + 0.06, z, 1.2);
      B.put(frameKey, w.w + 0.24, 0.16, WALL + 0.1, w.x, wy0 - 0.06, z, 1.2);
      for (const s of [-1, 1]) {
        B.put(frameKey, 0.16, w.h, WALL + 0.1, w.x + s * (w.w / 2 + 0.06), w.y, z, 1.2);
      }
      B.put('pane', w.w, w.h, 0.06, w.x, w.y, z + 0.02, 1.4);
    }
    // косяки двери
    B.put(frameKey, DW * 2 + 0.3, 0.22, WALL + 0.14, 0, DH + 0.11, z, 1.2);
    for (const s of [-1, 1]) {
      B.put(frameKey, 0.2, DH, WALL + 0.14, s * (DW + 0.1), DH / 2, z, 1.2);
    }
    // дверное полотно (закрыто) — чтобы из зала не было видно пустоты
    B.put('oakDoor', DW * 2 - 0.06, DH - 0.08, 0.1, 0, (DH - 0.08) / 2, z + 0.06, 1.1);
    B.put('oakDoor', DW * 2 - 0.16, 0.16, 0.05, 0, DH * 0.25, z + 0.12, 1.1);
    B.put('oakDoor', DW * 2 - 0.16, 0.16, 0.05, 0, DH * 0.78, z + 0.12, 1.1);
    for (const yy of [DH * 0.25, DH * 0.78]) {
      B.put('iron', DW * 2 - 0.3, 0.1, 0.05, 0, yy, z + 0.14, 1);
    }
    B.add(torus(0.08, 0.016, 5, 10), 'iron', mat(0.42, DH * 0.5, z + 0.16, Math.PI / 2));
  }

  // ---- северная стена (+z): три высоких окна — по одному в каждой нише ----
  // Окна сдвинуты к восточному краю ниш: так они не закрываются кроватью
  // и стоят как раз над свободным проходом к стене.
  {
    const z = hd - WALL / 2;
    const wins = [
      { x: -1.15, w: 1.2, h: 1.5, y: 5.5 },
      { x: 2.25, w: 1.2, h: 1.5, y: 5.5 },
      { x: 5.5, w: 1.2, h: 1.5, y: 5.5 },
    ];
    const seg = (x0, x1, y0, y1) => B.put(wallKey, x1 - x0, y1 - y0, WALL,
      (x0 + x1) / 2, (y0 + y1) / 2, z, 1.9);
    let cursor = -hw;
    for (const w of wins) {
      seg(cursor, w.x - w.w / 2, 0, TOP);
      seg(w.x - w.w / 2, w.x + w.w / 2, 0, w.y - w.h / 2);
      seg(w.x - w.w / 2, w.x + w.w / 2, w.y + w.h / 2, TOP);
      cursor = w.x + w.w / 2;
      B.put(frameKey, w.w + 0.24, 0.16, WALL + 0.1, w.x, w.y + w.h / 2 + 0.06, z, 1.2);
      B.put(frameKey, w.w + 0.24, 0.16, WALL + 0.1, w.x, w.y - w.h / 2 - 0.06, z, 1.2);
      for (const s of [-1, 1]) {
        B.put(frameKey, 0.16, w.h, WALL + 0.1, w.x + s * (w.w / 2 + 0.06), w.y, z, 1.2);
      }
      B.put('pane', w.w, w.h, 0.06, w.x, w.y, z - 0.02, 1.4);
    }
    seg(cursor, hw, 0, TOP);
  }

  // ---- западная стена (-x): очаг с аркой ----
  {
    const x = -hw + WALL / 2;
    const OW = FIRE_OW, OH = FIRE_OH;
    const seg = (z0, z1, y0, y1) => B.put(wallKey, WALL, y1 - y0, z1 - z0,
      x, (y0 + y1) / 2, (z0 + z1) / 2, 1.9);
    seg(-hd, FIRE_Z - OW, 0, TOP);
    seg(FIRE_Z + OW, hd, 0, TOP);
    seg(FIRE_Z - OW, FIRE_Z + OW, 0, OH);
    // арка над проёмом (кладка по кругу)
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a = (i + 0.5) / N * Math.PI;
      const zz = FIRE_Z - Math.cos(a) * OW;
      const yy = OH + Math.sin(a) * OW;
      B.add(box(WALL + 0.06, 0.42, 0.5, 1.2), 'stone',
        mat(x, yy, zz, 0, a - Math.PI / 2));
    }
    seg(FIRE_Z - OW, FIRE_Z + OW, OH + OW, TOP);
  }

  // ---- восточная стена (+x): полка за баром, окно высоко, проём сеней ----
  {
    const x = hw - WALL / 2;
    const w = { z: -3.6, w: 1.2, h: 1.5, y: 5.2 };
    const seg = (z0, z1, y0, y1) => B.put(wallKey, WALL, y1 - y0, z1 - z0,
      x, (y0 + y1) / 2, (z0 + z1) / 2, 1.9);
    // проём хозяйственной двери (в сени) — настоящий passage
    const bz0 = BACK_DOOR_Z - BACK_DOOR_W / 2, bz1 = BACK_DOOR_Z + BACK_DOOR_W / 2;
    seg(-hd, bz0, 0, TOP);
    seg(bz1, w.z - w.w / 2, 0, TOP);
    seg(w.z + w.w / 2, hd, 0, TOP);
    seg(bz0, bz1, BACK_DOOR_H, TOP);            // перемычка над проёмом
    seg(w.z - w.w / 2, w.z + w.w / 2, 0, w.y - w.h / 2);
    seg(w.z - w.w / 2, w.z + w.w / 2, w.y + w.h / 2, TOP);
    B.put(frameKey, WALL + 0.1, 0.16, w.w + 0.24, x, w.y + w.h / 2 + 0.06, w.z, 1.2);
    B.put(frameKey, WALL + 0.1, 0.16, w.w + 0.24, x, w.y - w.h / 2 - 0.06, w.z, 1.2);
    for (const s of [-1, 1]) {
      B.put(frameKey, WALL + 0.1, w.h, 0.16, x, w.y, w.z + s * (w.w / 2 + 0.06), 1.2);
    }
    B.put('pane', 0.06, w.h, w.w, x - 0.02, w.y, w.z, 1.4);
  }

  /* ---------------- фахверк: стойки, балки, раскосы ----------------
   * Стойки — не только украшение: каждая из них препятствие.
   * Раньше сквозь них можно было пройти. Стойка ровно напротив дверного
   * проёма не ставится — вход должен остаться проходом.
   */
  const post = 0.26;
  const inset = WALL / 2 + post / 2;
  const DOOR_HALF = 0.85;                 // половина ширины дверного проёма
  for (const px of [-hw + inset, -3.7, 0, 3.7, hw - inset]) {
    for (const pz of [-hd + inset, hd - inset]) {
      const inDoor = pz < 0 && Math.abs(px) < DOOR_HALF;
      if (inDoor) continue;               // проём двери остаётся свободным
      B.put(frameKey, post, TOP, post, px, TOP / 2, pz, 1.2);
      colliders.boxes.push({
        cx: px, cz: pz, hx: post / 2 + 0.02, hz: post / 2 + 0.02,
        ang: 0, y0: 0, y1: TOP,
      });
    }
  }
  for (const pz of [-hd + inset, 0, hd - inset]) {
    for (const px of [-hw + inset, hw - inset]) {
      B.put(frameKey, post, TOP, post, px, TOP / 2, pz, 1.2);
      colliders.boxes.push({
        cx: px, cz: pz, hx: post / 2 + 0.02, hz: post / 2 + 0.02,
        ang: 0, y0: 0, y1: TOP,
      });
    }
  }
  for (const y of [0.13, H1 - 0.13, TOP - 0.13]) {
    for (const pz of [-hd + inset, hd - inset]) {
      B.put(frameKey, W - WALL - post, 0.26, 0.2, 0, y, pz, 1.2);
    }
    for (const px of [-hw + inset, hw - inset]) {
      B.put(frameKey, 0.2, 0.26, D - WALL - post, px, y, 0, 1.2);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = box(0.17, 2.6, 0.17, 1);
      const m = mat(sx * (hw - 1.05), 1.35, sz * (hd - 0.34));
      m.multiply(new THREE.Matrix4().makeRotationZ(sx * 0.72));
      B.add(g, frameKey, m);
    }
  }

  /* ---------------- обшивка стен, плинтус, накладки ----------------
   * Оштукатуренная стена с голым низом выглядит недоделанно. Деревянная
   * обшивка до пояса, плинтус и накладки на стойках делают зал
   * настоящим деревянным помещением.
   */
  {
    const SK = 0.95;                 // высота обшивки
    const bw = 0.27, bt = 0.05;
    const yc = SK / 2;
    const runX = (x0, x1, z, dir, y0 = 0, y1 = SK) => {
      const n = Math.max(1, Math.round((x1 - x0) / (bw + 0.02)));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const x = x0 + step * (i + 0.5);
        // задняя грань уходит в стену на 1,5 см — иначе она почти совпадала
        // с гранью стены и обе поверхности «спорили» за пиксели
        B.put('oakDoor', step - 0.02, y1 - y0, bt, x, (y0 + y1) / 2, z + dir * (bt / 2 - 0.015), 1.4);
      }
    };
    const runZ = (z0, z1, x, dir) => {
      const n = Math.max(1, Math.round((z1 - z0) / (bw + 0.02)));
      const step = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const z = z0 + step * (i + 0.5);
        B.put('oakDoor', bt, SK, step - 0.02, x + dir * (bt / 2 - 0.015), yc, z, 1.4);
      }
    };
    // Внутренние грани стен: обшивка должна прилегать к стене СНАРУЖИ
    // (внутри зала). Раньше брался центр стены — обшивка уходила внутрь
    // стены: её не было видно, а её задняя грань в 1 см от внешней грани
    // стены давала лишние совпадающие плоскости.
    const zS = -hd + WALL, zN = hd - WALL;
    const xW = -hw + WALL, xE = hw - WALL;
    // южная стена — обшивка по обе стороны от двери и без участков под окнами
    // сдвиг всегда ВНУТРЬ зала, иначе обшивка уходит в стену
    const winGap = 0.66;                      // половина проёма окна + рама
    const sill = 0.62;                        // низ окна: выше обшивка не идёт
    // нижний ярус — непрерывно, кроме двери
    runX(-hw + WALL, -DOOR_HALF, zS, 1, 0, sill);
    runX(DOOR_HALF, hw - WALL, zS, 1, 0, sill);
    // верхний ярус — только между окнами
    runX(-hw + WALL, -3.5 - winGap, zS, 1, sill, SK);
    runX(-3.5 + winGap, -DOOR_HALF, zS, 1, sill, SK);
    runX(DOOR_HALF, 3.5 - winGap, zS, 1, sill, SK);
    runX(3.5 + winGap, hw - WALL, zS, 1, sill, SK);
    // северная, восточная
    runX(-hw + WALL, hw - WALL, zN, -1);
    runZ(-hd + WALL, hd - WALL, xE, -1);
    // западная — с проёмом очага
    runZ(-hd + WALL, FIRE_Z - FIRE_OW, xW, 1);
    runZ(FIRE_Z + FIRE_OW, hd - WALL, xW, 1);
    // плинтус по всему периметру
    B.put('timber', W - WALL, 0.15, 0.16, 0, 0.075, zS + 0.05, 1.2);
    B.put('timber', W - WALL, 0.15, 0.16, 0, 0.075, zN - 0.05, 1.2);
    B.put('timber', 0.16, 0.15, D - WALL, xE - 0.05, 0.075, 0, 1.2);
    B.put('timber', 0.16, 0.15, D - WALL, xW + 0.05, 0.075, 0, 1.2);
    // верхняя обвязка обшивки
    B.put('timber', W - WALL, 0.08, 0.12, 0, SK + 0.04, zS + 0.03, 1.2);
    B.put('timber', W - WALL, 0.08, 0.12, 0, SK + 0.04, zN - 0.03, 1.2);
    B.put('timber', 0.12, 0.08, D - WALL, xE - 0.03, SK + 0.04, 0, 1.2);
    B.put('timber', 0.12, 0.08, D - WALL, xW + 0.03, SK + 0.04, 0, 1.2);

    // накладки на стойки с заклёпками — стойка читается как настоящая балка
    const faces = [];
    for (const px of [-hw + inset, -3.7, 0, 3.7, hw - inset]) {
      for (const pz of [-hd + inset, hd - inset]) faces.push([px, pz, 'z']);
    }
    for (const pz of [-hd + inset, 0, hd - inset]) {
      for (const px of [-hw + inset, hw - inset]) faces.push([px, pz, 'x']);
    }
    for (const [px, pz, axis] of faces) {
      const inDoor = pz < 0 && Math.abs(px) < DOOR_HALF && axis === 'z';
      if (inDoor) continue;
      if (axis === 'z') {
        // накладка лежит на поверхности стойки, а не внутри неё
        const out = pz < 0 ? 1 : -1;
        B.put('timber', post + 0.1, TOP - 0.1, 0.06, px, TOP / 2, pz + out * (post / 2 + 0.03), 1.2);
        for (let y = 0.5; y < TOP - 0.3; y += 1.6) {
          B.add(cyl(0.032, 0.032, 0.05, 6), 'iron',
            mat(px, y, pz + out * (post / 2 + 0.06), Math.PI / 2, 0, 0));
          B.add(cyl(0.032, 0.032, 0.05, 6), 'iron',
            mat(px, y, pz - out * (post / 2 + 0.06), Math.PI / 2, 0, 0));
        }
      } else {
        const out = px < 0 ? 1 : -1;
        B.put('timber', 0.06, TOP - 0.1, post + 0.1, px + out * (post / 2 + 0.03), TOP / 2, pz, 1.2);
        for (let y = 0.5; y < TOP - 0.3; y += 1.6) {
          B.add(cyl(0.032, 0.032, 0.05, 6), 'iron',
            mat(px + out * (post / 2 + 0.06), y, pz, 0, 0, Math.PI / 2));
          B.add(cyl(0.032, 0.032, 0.05, 6), 'iron',
            mat(px - out * (post / 2 + 0.06), y, pz, 0, 0, Math.PI / 2));
        }
      }
    }
  }

  /* ================================================================
   *  ПОТОЛОК И БАЛКИ
   * ================================================================ */
  B.put('plank', W, 0.16, D, 0, TOP + 0.08, 0, 1.8);
  for (let z = -hd + 1.1; z < hd - 0.6; z += 1.9) {
    B.put(frameKey, W - WALL, 0.34, 0.26, 0, TOP - 0.17, z, 1.2);
  }
  // главная балка вдоль зала
  B.put(frameKey, 0.36, 0.44, D - WALL, 0, TOP - 0.24, 0, 1.2);
  for (const z of [-4.2, -1.4, 1.4, 4.2]) {
    B.put(frameKey, 0.3, 0.3, 0.3, 0, TOP - 0.42, z, 1.2);
  }

  /* ================================================================
   *  ОЧАГ: каменная ниша, огонь, котёл, дрова
   * ================================================================ */
  {
    const OW = FIRE_OW, OH = FIRE_OH;
    const NX = FIRE_X - 0.28;                 // глубина ниши: здесь горит огонь

    B.put('stoneDark', 0.12, OH + OW, 2.1, FIRE_X - 0.54, (OH + OW) / 2, FIRE_Z, 1.4);
    for (const s of [-1, 1]) {
      B.put('stone', 0.9, OH + OW, 0.28, FIRE_X - 0.2, (OH + OW) / 2, FIRE_Z + s * (OW + 0.14), 1.4);
    }
    B.put('stone', 1.0, 0.3, 2.6, FIRE_X - 0.25, OH + OW + 0.15, FIRE_Z, 1.4);
    // каминная доска (мантел)
    B.put(frameKey, 1.3, 0.16, 2.9, FIRE_X - 0.1, OH + OW + 0.38, FIRE_Z, 1.2);
    for (const s of [-1, 1]) {
      B.put(frameKey, 0.16, 0.5, 0.16, FIRE_X - 0.1, OH + OW + 0.16, FIRE_Z + s * 1.25, 1.2);
    }
    // поленница — у северной стенки ниши
    for (let i = 0; i < 7; i++) {
      const row = Math.floor(i / 3), col = i % 3;
      B.add(cyl(0.11, 0.11, 0.95, 7), 'timber',
        mat(FIRE_X + 0.05, 0.12 + row * 0.23, FIRE_Z + 1.7 + (col - 1) * 0.25, 0, 0, Math.PI / 2));
    }
    // костёр: поленья уложены крест-накрест на дне ниши (лежат, а не торчат)
    for (let i = 0; i < 3; i++) {
      const a = i * 1.05 + 0.25;
      B.add(cyl(0.1, 0.1, 1.15, 7), 'timber',
        mat(NX, 0.13 + i * 0.02, FIRE_Z, a, 0, Math.PI / 2));
    }
    // два бревна поперёк, сверху — «шатёр» костра
    B.add(cyl(0.085, 0.085, 1.0, 7), 'timber', mat(NX, 0.34, FIRE_Z, 0.1, 0, Math.PI / 2 + 0.95));
    B.add(cyl(0.085, 0.085, 1.0, 7), 'timber', mat(NX, 0.34, FIRE_Z, -0.1, 0, Math.PI / 2 - 0.95));
    // угли под дровами — мелкие тлеющие куски, а не плита
    for (let i = 0; i < 7; i++) {
      const a = i * 1.9;
      B.add(box(0.16 + (i % 3) * 0.05, 0.07, 0.14), 'ember',
        mat(NX + Math.cos(a) * 0.22, 0.05, FIRE_Z + Math.sin(a) * 0.26, a));
    }
    // треножник с котлом — сбоку от оси камина, чтобы огонь был виден
    const PX = FIRE_X + 0.45, PZ = FIRE_Z - 1.65;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      B.add(cyl(0.04, 0.045, 0.72, 5), 'iron',
        mat(PX + Math.cos(a) * 0.19, 0.34, PZ + Math.sin(a) * 0.19,
          0, Math.sin(a) * 0.26, Math.cos(a) * 0.26));
    }
    // обод под котлом
    B.add(torus(0.24, 0.022, 5, 12), 'iron', mat(PX, 0.66, PZ, 0, Math.PI / 2));
    B.add(cyl(0.36, 0.3, 0.42, 12), 'iron', mat(PX, 0.5, PZ));
    B.add(torus(0.35, 0.028, 5, 12), 'iron', mat(PX, 0.7, PZ, 0, Math.PI / 2));
    // дужка котла
    for (const s of [-1, 1]) {
      B.add(cyl(0.018, 0.018, 0.3, 5), 'iron', mat(PX + s * 0.17, 0.83, PZ));
    }
    B.add(cyl(0.018, 0.018, 0.38, 5), 'iron', mat(PX, 0.98, PZ, 0, 0, Math.PI / 2));
    B.add(cyl(0.025, 0.025, 0.3, 5), 'iron', mat(PX, 0.98, PZ));
    // свечи на мантеле
    for (let i = 0; i < 3; i++) {
      const cz = FIRE_Z - 0.8 + i * 0.8;
      B.add(cyl(0.045, 0.05, 0.22, 7), 'cloth', mat(FIRE_X - 0.1, OH + OW + 0.56, cz));
    }
    // кочерга: крюк на длинной рукояти, прислонена к стене
    {
      const kx = FIRE_X + 0.42, kz = FIRE_Z + 2.3;
      B.add(cyl(0.026, 0.03, 1.35, 6), 'iron', mat(kx, 0.68, kz, 0, 0, 0.1));
      B.add(cyl(0.018, 0.018, 0.3, 5), 'iron', mat(kx + 0.06, 1.36, kz, 0, 0, 0.9));
      B.add(cyl(0.018, 0.018, 0.14, 5), 'iron', mat(kx + 0.16, 1.28, kz, 0, 0, 0.9));
    }
  }

  /* ================================================================
   *  БАР: массивная стойка, полки с бутылками, бочки, табуреты
   *
   *  Стойка сделана объёмной: каменный цоколь, корпус с филёнками
   *  в рамах, фигурные торцы, карниз под столешницей и выступающий
   *  «нос» столешницы. Живые детали — ряд бутылок на столешнице,
   *  медная кайма, костёр для монет, свеча, тарелка с закусками.
   * ================================================================ */
  {
    const z0 = -3.15, z1 = 2.9;
    const cz = (z0 + z1) / 2, len = z1 - z0;
    const CX = BAR_X;                  // центр стойки
    const bodyW = 0.98;                // ширина корпуса
    const bodyH = 1.0;                 // высота корпуса над цоколем
    const topY = 1.16;                 // высота столешницы

    // ---- каменный цоколь: стойка стоит, а не висит в воздухе ----
    B.put('cobble', bodyW + 0.14, 0.16, len + 0.06, CX, 0.08, cz, 1.6);
    // ---- корпус ----
    B.put('oakDoor', bodyW, bodyH, len, CX, 0.16 + bodyH / 2, cz, 1.4);
    // ---- филёнки в рамах на лицевой стороне (сторона зала) ----
    const panels = 7;
    const pw = (len - 0.3) / panels;
    for (let i = 0; i < panels; i++) {
      const pz = z0 + 0.15 + (i + 0.5) * pw;
      const fx = CX - bodyW / 2;       // плоскость фасада
      // рама
      B.put(frameKey, 0.07, 0.66, 0.1, fx - 0.03, 0.64, pz - pw / 2 + 0.05, 1.2);
      B.put(frameKey, 0.07, 0.66, 0.1, fx - 0.03, 0.64, pz + pw / 2 - 0.05, 1.2);
      B.put(frameKey, 0.07, 0.1, pw - 0.1, fx - 0.03, 0.64 + 0.28, pz, 1.2);
      B.put(frameKey, 0.07, 0.1, pw - 0.1, fx - 0.03, 0.64 - 0.28, pz, 1.2);
      // сама филёнка — чуть глубже рамы
      B.put('timber', 0.05, 0.52, pw - 0.2, fx + 0.01, 0.64, pz, 1.2);
    }
    // ---- фигурные торцы: рама, филёнка и «башмак» ----
    for (const tz of [z0 + 0.09, z1 - 0.09]) {
      const sgn = tz < cz ? -1 : 1;
      B.put(frameKey, bodyW - 0.16, 0.62, 0.08, CX, 0.62, tz + sgn * 0.05, 1.2);
      B.put('timber', bodyW - 0.28, 0.48, 0.05, CX, 0.62, tz + sgn * 0.02, 1.2);
      B.put('oakDoor', bodyW + 0.1, 0.12, 0.16, CX, 0.2, tz, 1.4);
    }
    // ---- карниз под столешницей + столешница с выступом ----
    B.put(frameKey, bodyW + 0.16, 0.12, len + 0.12, CX, topY - 0.16, cz, 1.2);
    B.put('plank', bodyW + 0.34, 0.13, len + 0.22, CX - 0.08, topY - 0.05, cz, 1.6);
    // медная кайма по краю столешницы
    B.add(cyl(0.022, 0.022, len + 0.2, 8), 'brass', mat(CX - 0.25, topY + 0.01, cz, 0, Math.PI / 2));
    // ---- медный подножник (foot rail) для ног ----
    B.add(cyl(0.035, 0.035, len - 0.2, 8), 'brass', mat(CX - 0.62, 0.2, cz, 0, Math.PI / 2));
    for (const pz of [z0 + 0.45, cz, z1 - 0.45]) {
      B.add(cyl(0.03, 0.03, 0.22, 6), 'brass', mat(CX - 0.62, 0.1, pz));
      B.add(cyl(0.028, 0.028, 0.2, 6), 'brass', mat(CX - 0.54, 0.1, pz, 0, 0, Math.PI / 2));
    }

    // ---- полки за стойкой ----
    for (const sy of [1.55, 2.05, 2.55]) {
      B.put('plank', 0.55, 0.08, len + 0.6, hw - 0.55, sy, cz, 1.6);
      for (const pz of [z0 + 0.4, cz, z1 - 0.4]) {
        B.put(frameKey, 0.12, 0.5, 0.12, hw - 0.55, sy - 0.28, pz, 1.2);
      }
    }
    // ---- бутылки на полках ----
    const bottleKeys = ['bottle0', 'bottle1', 'bottle2', 'bottle3', 'bottle4'];
    let bi = 0;
    for (const sy of [1.55, 2.05, 2.55]) {
      for (let z = z0 + 0.35; z < z1 + 0.3; z += 0.29) {
        const h = 0.26 + (bi % 3) * 0.06;
        const r = 0.055 + (bi % 2) * 0.015;
        B.add(cyl(r, r, h, 7), bottleKeys[bi % 5], mat(hw - 0.55, sy + 0.04 + h / 2, z));
        B.add(cyl(r * 0.42, r * 0.5, 0.11, 6), bottleKeys[bi % 5], mat(hw - 0.55, sy + 0.04 + h + 0.05, z));
        bi++;
      }
    }

    // ---- живая столешница: ряд бутылок, кружки, костёр, свеча, закуски ----
    // ряд бутылок у края столешницы
    for (let i = 0; i < 7; i++) {
      const bz = z0 + 0.55 + i * 0.62;
      const h = 0.28 + (i % 3) * 0.05;
      const r = 0.05 + (i % 2) * 0.012;
      B.add(cyl(r, r, h, 7), bottleKeys[i % 5], mat(CX - 0.18, topY + 0.07 + h / 2, bz));
      B.add(cyl(r * 0.42, r * 0.5, 0.1, 6), bottleKeys[i % 5], mat(CX - 0.18, topY + 0.07 + h + 0.045, bz));
    }
    // костёр — касса для монет
    B.put('oakDoor', 0.34, 0.16, 0.26, CX - 0.12, topY + 0.13, z1 - 0.55, 1.2);
    B.put('brass', 0.06, 0.1, 0.2, CX - 0.29, topY + 0.14, z1 - 0.55, 1);
    // свеча в подсвечнике
    B.add(cyl(0.06, 0.08, 0.05, 9), 'brass', mat(CX - 0.12, topY + 0.08, z1 - 1.05));
    B.add(cyl(0.035, 0.04, 0.16, 8), 'cloth', mat(CX - 0.12, topY + 0.18, z1 - 1.05));
    // тарелка с закусками: сыр, хлеб, окорок
    B.add(cyl(0.16, 0.16, 0.025, 12), 'plank', mat(CX - 0.12, topY + 0.08, z0 + 0.75));
    B.add(box(0.14, 0.08, 0.12), 'cloth', mat(CX - 0.12, topY + 0.13, z0 + 0.75));
    B.add(box(0.12, 0.07, 0.1), 'fabric2', mat(CX - 0.06, topY + 0.12, z0 + 0.82));
    // свёрнутое полотенце и свиток
    B.put('cloth', 0.16, 0.05, 0.22, CX - 0.2, topY + 0.09, z0 + 1.25, 1.2);
    B.add(cyl(0.035, 0.035, 0.24, 7), 'cloth', mat(CX - 0.14, topY + 0.11, z0 + 1.25, 0, 0, Math.PI / 2));

    // ---- кувшины и кружки на стойке ----
    for (let i = 0; i < 4; i++) {
      const pz = z0 + 1.6 + i * 1.5;
      B.add(cyl(0.09, 0.11, 0.2, 8), 'bottle1', mat(CX - 0.2, topY + 0.16, pz));
      B.add(cyl(0.05, 0.055, 0.13, 8), 'bottle4', mat(CX - 0.1, topY + 0.14, pz + 0.3));
    }
    // ---- бочки за баром (южная часть занята витриной и калдой) ----
    for (const [bz, br] of [[z1 + 0.9, 0.36]]) {
      B.add(cyl(br, br * 0.9, 0.85, 12), 'plank', mat(hw - 0.75, 0.43, bz));
      B.add(cyl(br * 0.94, br * 0.94, 0.07, 12), 'iron', mat(hw - 0.75, 0.2, bz));
      B.add(cyl(br * 0.92, br * 0.92, 0.07, 12), 'iron', mat(hw - 0.75, 0.68, bz));
      B.add(cyl(br * 0.88, br * 0.88, 0.05, 12), 'plank', mat(hw - 0.75, 0.87, bz));
      colliders.circles.push({ x: hw - 0.75, z: bz, r: br + 0.05, y0: 0, y1: 1.0 });
    }
    // ---- табуреты у стойки ----
    for (let i = 0; i < 4; i++) {
      const pz = z0 + 0.9 + i * 1.5;
      const sx = CX - 1.35;
      B.add(cyl(0.19, 0.17, 0.1, 10), 'plank', mat(sx, 0.72, pz));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        B.add(cyl(0.035, 0.04, 0.72, 6), 'timber',
          mat(sx + Math.cos(a) * 0.12, 0.36, pz + Math.sin(a) * 0.12, 0, Math.sin(a) * 0.14, Math.cos(a) * 0.14));
      }
      colliders.circles.push({ x: sx, z: pz, r: 0.26, y0: 0, y1: 0.85 });
    }
    colliders.boxes.push({ cx: CX, cz, hx: bodyW / 2 + 0.12, hz: len / 2, ang: 0, y0: 0, y1: topY + 0.08 });
  }

  /* ================================================================
   *  ВНУТРИ БАРА (южная часть): витрина, калда, картина
   *
   *  За южным торцом стойки было пустое место — теперь здесь
   *  рабочий закуток бармена: шкаф-витрина с бутылками, бочка-калда
   *  с краном, ящик с припасами и картина на стене.
   * ================================================================ */
  let barExit = null;                // точка перед задней дверью (за стойкой)
  let backExit = null;               // выход из сеней на улицу
  let backDoorLeaf = null;           // створка задней двери (её можно отворить)
  let backDoorCollider = null;       // коллайдер закрытой двери
  {
    const VX = hw - 0.42;             // у восточной стены, за стойкой
    const VZ = -4.25;                // южная часть бара

    // ---- шкаф-витрина: открытый каркас с полками и бутылками ----
    // Раньше это был сплошной ящик: бутылки оказывались внутри стенки и
    // их не было видно. Теперь — задняя стенка, боковины и полки.
    B.put('oakDoor', 0.06, 1.75, 1.34, VX + 0.28, 0.88, VZ, 1.4);      // задняя стенка
    for (const s2 of [-1, 1]) {
      B.put('oakDoor', 0.56, 1.75, 0.08, VX, 0.88, VZ + s2 * 0.63, 1.4); // боковины
    }
    B.put('plank', 0.66, 0.09, 1.4, VX, 1.81, VZ, 1.6);                  // верхняя плита
    B.put('timber', 0.6, 0.1, 1.32, VX, 0.07, VZ, 1.2);                 // цоколь
    // средник с дверцей в левой части
    B.put('timber', 0.52, 0.06, 1.2, VX, 0.92, VZ, 1.2);
    // полки с бутылками — у переднего края, чтобы их было видно
    for (const sy of [0.48, 1.0, 1.5]) {
      B.put('plank', 0.5, 0.05, 1.16, VX - 0.02, sy, VZ, 1.5);
      for (let i = 0; i < 4; i++) {
        const bz = VZ - 0.45 + i * 0.3;
        const h = 0.24 + (i % 2) * 0.06;
        B.add(cyl(0.05, 0.05, h, 7), 'bottle' + (i % 5), mat(VX - 0.14, sy + 0.03 + h / 2, bz));
        B.add(cyl(0.022, 0.026, 0.1, 6), 'bottle' + (i % 5), mat(VX - 0.14, sy + 0.03 + h + 0.04, bz));
      }
    }
    // дверца, прислонённая сбоку, с медной ручкой
    B.put('timber', 0.05, 1.3, 0.46, VX - 0.33, 0.72, VZ - 0.42, 1.2);
    B.add(sphere(0.045, 8, 6), 'brass', mat(VX - 0.37, 0.78, VZ - 0.22));
    colliders.boxes.push({ cx: VX, cz: VZ, hx: 0.36, hz: 0.7, ang: 0, y0: 0, y1: 1.85 });

    // ---- калда: бочка с краном и кружка под ним ----
    {
      const bx = VX - 0.62, bz = VZ + 1.15;
      B.add(cyl(0.34, 0.3, 0.78, 12), 'plank', mat(bx, 0.39, bz));
      B.add(cyl(0.33, 0.33, 0.06, 12), 'iron', mat(bx, 0.18, bz));
      B.add(cyl(0.31, 0.31, 0.06, 12), 'iron', mat(bx, 0.58, bz));
      B.add(cyl(0.3, 0.3, 0.05, 12), 'plank', mat(bx, 0.77, bz));
      B.add(cyl(0.03, 0.03, 0.16, 6), 'brass', mat(bx - 0.3, 0.2, bz, 0, 0, Math.PI / 2));
      B.add(cyl(0.025, 0.025, 0.06, 6), 'brass', mat(bx - 0.37, 0.15, bz));
      B.add(cyl(0.08, 0.09, 0.16, 10), 'cloth', mat(bx - 0.42, 0.08, bz));
      colliders.circles.push({ x: bx, z: bz, r: 0.38, y0: 0, y1: 0.9 });
    }

    // ---- ящик с припасами: сыр, окорок, свёртки ----
    {
      const cx2 = VX - 0.7, cz2 = VZ - 0.95;
      B.put('oakDoor', 0.5, 0.44, 0.62, cx2, 0.22, cz2, 1.4);
      B.put('timber', 0.54, 0.07, 0.66, cx2, 0.45, cz2, 1.2);
      B.put('iron', 0.06, 0.42, 0.64, cx2, 0.22, cz2, 1);
      B.add(box(0.18, 0.12, 0.2), 'cloth', mat(cx2 - 0.04, 0.55, cz2 - 0.1));
      B.add(box(0.16, 0.1, 0.18), 'fabric2', mat(cx2 + 0.06, 0.53, cz2 + 0.12));
      colliders.boxes.push({ cx: cx2, cz: cz2, hx: 0.28, hz: 0.34, ang: 0, y0: 0, y1: 0.5 });
    }

    // ---- задняя дверь и сени: бармен уходит домой, игрок выходит сзади ----
    // Раньше бармен просто исчезал на ночь. Теперь сзади стойки есть
    // настоящая дверь в хозяйственные сени, а из сеней — ход на улицу.
    const DOOR_Z = BACK_DOOR_Z;
    {
      const dx = hw - WALL - 0.04;
      // проём-наличники и перемычка
      for (const s2 of [-1, 1]) {
        B.put('timber', 0.22, BACK_DOOR_H + 0.3, 0.2, dx - 0.02,
          (BACK_DOOR_H + 0.3) / 2, DOOR_Z + s2 * (BACK_DOOR_W / 2 + 0.1), 1.2);
      }
      B.put('timber', 0.22, 0.22, BACK_DOOR_W + 0.4, dx - 0.02, BACK_DOOR_H + 0.11, DOOR_Z, 1.2);
      // дубовая щеколда на косяке
      B.put('iron', 0.16, 0.13, 0.46, dx - 0.14, 1.02, DOOR_Z + BACK_DOOR_W / 2 + 0.04, 1);
      // кольцо на створке
      B.add(torus(0.09, 0.025, 5, 10), 'iron', mat(dx - 0.12, 1.02, DOOR_Z + 0.38, 0, Math.PI / 2));
      // половик и крючок с плащом
      B.put('cloth', 0.5, 0.03, 0.8, dx - 0.62, 0.02, DOOR_Z, 1.2);
      B.add(box(0.16, 0.6, 0.3), 'redCloth', mat(dx - 0.16, 1.55, DOOR_Z - 0.75, 0, 0, 0.2));
      // ведро и круглая щётка у двери
      B.add(cyl(0.17, 0.2, 0.28, 10), 'plank', mat(dx - 0.75, 0.14, DOOR_Z + 0.75));
      B.add(cyl(0.02, 0.02, 0.7, 6), 'timber', mat(dx - 0.75, 0.6, DOOR_Z + 0.75, 0.4, 0, 0.2));
      // створка — отдельная группа: её можно отворить интерактом
      backDoorLeaf = new THREE.Group();
      backDoorLeaf.position.set(hw - WALL - 0.03, 0, DOOR_Z - BACK_DOOR_W / 2 + 0.05);
      {
        const lb = new Builder();
        lb.put('oakDoor', 0.09, 2.05, BACK_DOOR_W - 0.12, 0, 1.03, (BACK_DOOR_W - 0.12) / 2, 1.4);
        for (const by of [0.35, 1.7]) {
          lb.put('iron', 0.05, 0.12, BACK_DOOR_W - 0.16, -0.05, by, (BACK_DOOR_W - 0.12) / 2, 1);
        }
        lb.add(torus(0.09, 0.025, 5, 10), 'iron',
          mat(-0.07, 1.02, BACK_DOOR_W - 0.34, 0, Math.PI / 2));
        backDoorLeaf.add(lb.build(MT, null, { name: 'tavernBackDoor' }));
      }
      group.add(backDoorLeaf);
      // коллайдер закрытой створки — при открытии он опускается
      backDoorCollider = {
        cx: hw - WALL / 2, cz: DOOR_Z, hx: WALL / 2, hz: BACK_DOOR_W / 2,
        ang: 0, y0: 0, y1: BACK_DOOR_H,
      };
      colliders.boxes.push(backDoorCollider);
      // табличка над задней дверью: «для персонала»
      {
        const sign = signMesh('ДЛЯ ПЕРСОНАЛА', 1.35, 0.34);
        if (sign) {
          sign.position.set(hw - WALL - 0.06, 2.48, DOOR_Z);
          sign.rotation.y = -Math.PI / 2;
          group.add(sign);
        }
      }
      // настенная свеча у задней двери — без неё этот угол тонул в темноте
      {
        const bx = dx - 0.24, bz = DOOR_Z - 0.52;
        B.put('iron', 0.18, 0.05, 0.1, bx, 1.92, bz, 1);
        B.add(cyl(0.03, 0.035, 0.14, 8), 'cloth', mat(bx, 2.03, bz));
        B.add(cyl(0.018, 0.022, 0.07, 6), 'lampGlass', mat(bx, 2.13, bz));
        const glow = new THREE.PointLight(0xffb066, 1.15, 8.5, 2);
        glow.position.set(bx, 2.13, bz);
        group.add(glow);
        // слабый отсвет на самом полотне двери
        const doorGlow = new THREE.PointLight(0xffc890, 0.5, 4.4, 2);
        doorGlow.position.set(dx - 0.42, 1.15, DOOR_Z);
        group.add(doorGlow);
      }
    }
    // ---- сени за восточной стеной: отсюда — выход на улицу ----
    {
      const sz0 = DOOR_Z - 1.9, sz1 = DOOR_Z + 1.7;
      const scx = hw + SEN_W / 2, scz = (sz0 + sz1) / 2;
      // пол и низкий навес
      B.put('stone', SEN_W, 0.16, sz1 - sz0, scx, -0.08, scz, 1.6);
      B.put('plank', SEN_W, 0.14, sz1 - sz0, scx, 2.32, scz, 1.2);
      // южная и северная стенки сеней
      B.put('stone', SEN_W, 2.4, 0.3, scx, 1.2, sz0 - 0.15, 1.6);
      B.put('stone', SEN_W, 2.4, 0.3, scx, 1.2, sz1 + 0.15, 1.6);
      // восточная стена сеней — с проёмом наружу
      const ox = hw + SEN_W + 0.15;
      const oz0 = DOOR_Z - 0.6, oz1 = DOOR_Z + 0.6;
      B.put('stone', 0.3, 2.4, oz0 - sz0, ox, 1.2, (sz0 + oz0) / 2, 1.6);
      B.put('stone', 0.3, 2.4, sz1 - oz1, ox, 1.2, (oz1 + sz1) / 2, 1.6);
      B.put('stone', 0.3, 2.4 - 2.05, oz1 - oz0, ox, 2.05 + (2.4 - 2.05) / 2, DOOR_Z, 1.6);
      // косяки и створка наружу
      for (const s2 of [-1, 1]) {
        B.put('timber', 0.26, 2.2, 0.18, ox, 1.05, DOOR_Z + s2 * 0.66, 1.2);
      }
      B.put('timber', 0.26, 0.18, 1.5, ox, 2.16, DOOR_Z, 1.2);
      B.put('plank', 0.08, 2.0, 1.06, ox + 0.14, 1.0, DOOR_Z, 1.3);
      B.add(torus(0.08, 0.022, 5, 10), 'iron', mat(ox + 0.2, 1.0, DOOR_Z + 0.38, 0, Math.PI / 2));
      // ступень наружу
      B.put('stone', 0.7, 0.18, 1.6, ox + 0.45, 0.09, DOOR_Z, 1.2);
      // бочки, дрова и полка в сенях
      B.add(cyl(0.36, 0.4, 0.78, 12), 'plank', mat(hw + 0.75, 0.39, sz0 + 0.7));
      B.add(torus(0.37, 0.035, 5, 14), 'iron', mat(hw + 0.75, 0.5, sz0 + 0.7, 0, Math.PI / 2));
      B.add(cyl(0.34, 0.38, 0.72, 12), 'plank', mat(hw + 0.8, 0.36, sz0 + 1.65));
      for (let i = 0; i < 5; i++) {
        B.add(cyl(0.09, 0.09, 0.7, 6), 'timber',
          mat(hw + 0.55 + (i % 2) * 0.2, 0.14 + Math.floor(i / 2) * 0.18, sz1 - 0.7, 0, 0, Math.PI / 2));
      }
      B.put('plank', 0.34, 0.08, 1.4, hw + 0.25, 1.55, scz, 1.2);
      for (let i = 0; i < 3; i++) {
        B.add(cyl(0.09, 0.1, 0.24, 8), 'greenCloth',
          mat(hw + 0.25, 1.71, scz - 0.45 + i * 0.45));
      }
      // коллайдеры сеней
      colliders.boxes.push({ cx: scx, cz: sz0 - 0.15, hx: SEN_W / 2, hz: 0.15, ang: 0 });
      colliders.boxes.push({ cx: scx, cz: sz1 + 0.15, hx: SEN_W / 2, hz: 0.15, ang: 0 });
      colliders.boxes.push({ cx: ox, cz: (sz0 + oz0) / 2, hx: 0.15, hz: (oz0 - sz0) / 2, ang: 0 });
      colliders.boxes.push({ cx: ox, cz: (oz1 + sz1) / 2, hx: 0.15, hz: (sz1 - oz1) / 2, ang: 0 });
      colliders.boxes.push({ cx: hw + 0.75, cz: sz0 + 0.7, hx: 0.4, hz: 0.4, ang: 0 });
      // свет в сенях — тёплый, от фонаря над дверью
      const senLight = new THREE.PointLight(0xffb066, 1.15, 8.0, 1.9);
      senLight.position.set(hw + 0.6, 2.1, DOOR_Z);
      group.add(senLight);
      // точка выхода на улицу (за сенями)
      backExit = { x: hw + SEN_W + 0.9, z: DOOR_Z };
    }
    barExit = { x: hw + 0.85, z: DOOR_Z };

    // ---- картина на восточной стене: «Уставший вепрь» ----
    {
      const wx = hw - WALL - 0.02;
      const py = 2.45, pz = VZ + 0.15;
      B.put('oakDoor', 0.07, 0.86, 1.06, wx, py, pz, 1.2);
      B.put('fabric', 0.04, 0.74, 0.94, wx - 0.02, py, pz, 1.3);
      // силуэт вепря на полотне: туша, голова с клыком, ноги и хвост
      const bx = wx - 0.045;
      B.add(sphere(0.17, 12, 8).scale(0.26, 0.72, 1.2), 'dark', mat(bx, py - 0.02, pz + 0.02));
      B.add(sphere(0.1, 12, 8).scale(0.3, 0.78, 1.1), 'dark', mat(bx, py + 0.05, pz - 0.24));
      B.add(cone(0.022, 0.07, 5), 'cloth', mat(bx - 0.01, py - 0.02, pz - 0.33, 0, Math.PI / 2));
      for (const s2 of [-1, 1]) {
        for (const s3 of [-1, 1]) {
          B.add(box(0.03, 0.11, 0.05), 'dark',
            mat(bx, py - 0.16, pz + 0.02 + s2 * 0.1 + s3 * 0.05));
        }
      }
      B.add(cyl(0.018, 0.028, 0.15, 6), 'dark', mat(bx, py - 0.03, pz + 0.2, 0, 0.55));
      B.add(cyl(0.02, 0.02, 0.14, 5), 'brass', mat(bx, py + 0.22, pz - 0.22, 0, 0, Math.PI / 2));
      // латунная табличка
      B.put('brass', 0.03, 0.1, 0.3, wx - 0.05, py - 0.38, pz, 1);
    }
  }

  /* ================================================================
   *  ВТОРОЙ ЭТАЖ: расширенный настил, комнаты, лестница
   *
   *  Настил идёт буквой «Г»:
   *    · северная полоса (z от GAL_Z до северной стены) — здесь комнаты;
   *    · восточное крыло (x от WING_X0 до восточной стены) — балкон
   *      над стойкой бара, со столиками.
   *
   *  Комнаты открытые: между ними перегородки с широким проёмом,
   *  так что из коридора видно все комнаты, а перегородки при этом
   *  остаются настоящими стенами — сквозь них не пройти.
   *
   *  В настиле проём (люк), сквозь который проходит вертикальная
   *  лестница: игрок подходит снизу, смотрит вверх и жмёт W —
   *  цепляется и поднимается на второй этаж.
   * ================================================================ */
  const rooms = [];
  {
    const gx0 = -hw + WALL, gx1 = hw - WALL;
    const gz0 = GAL_Z, gz1 = hd - WALL;     // северная полоса — комнаты
    const WX0 = 4.0, WZ0 = -1.7;           // восточное крыло (балкон над баром)

    // ---- настил: северная полоса с проёмом под лестницу + крыло ----
    const segs = [
      [gx0, gx1, gz0, HATCH_Z0],
      [gx0, gx1, HATCH_Z1, gz1],
      [HATCH_X1, gx1, HATCH_Z0, HATCH_Z1],
      [WX0, gx1, WZ0, gz0],
    ];
    for (const [x0, x1, z0, z1] of segs) {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      B.put('plank', x1 - x0, 0.16, z1 - z0, cx, H1 - 0.08, cz, 1.7);
      platforms.push({ cx, cz, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, ang: 0, y: H1, only: true });
    }
    // балки под настилом
    for (let x = gx0 + 0.8; x < gx1; x += 1.7) {
      if (x > HATCH_X1 - 0.6 && x < HATCH_X1 + 0.6) {
        B.put(frameKey, 0.2, 0.22, HATCH_Z1 - HATCH_Z0, x, H1 - 0.27, (HATCH_Z0 + HATCH_Z1) / 2, 1.2);
      } else {
        B.put(frameKey, 0.2, 0.22, gz1 - gz0, x, H1 - 0.27, (gz0 + gz1) / 2, 1.2);
      }
    }
    // продольные балки крыла
    for (let z = WZ0 + 0.9; z < gz0; z += 1.7) {
      B.put(frameKey, 0.2, 0.22, gx1 - WX0, (WX0 + gx1) / 2, H1 - 0.27, z, 1.2);
    }
    // обвязка проёма
    B.put(frameKey, 0.2, 0.24, HATCH_Z1 - HATCH_Z0 + 0.2, HATCH_X1, H1 - 0.24, (HATCH_Z0 + HATCH_Z1) / 2, 1.2);
    B.put(frameKey, 0.2, 0.24, HATCH_Z1 - HATCH_Z0 + 0.2, LAD_X + 0.16, H1 - 0.24, (HATCH_Z0 + HATCH_Z1) / 2, 1.2);

    // ---- опоры настила: настоящие деревянные колонны ----
    // Раньше на этих местах были только невидимые коллайдеры: игрок
    // упирался в пустоту. Теперь здесь каменный базис, ствол, капитель
    // и раскосы — настил стоит на настоящих столбах.
    // У западной стены опоры нет: там лестница и зона подъёма, столб
    // сбивал бы игрока. Несущие стойки — в перегородках комнат.
    for (const px of [-3.4, 0, 3.4, hw - 0.7]) {
      const pz = GAL_Z + 0.12;
      // каменный базис
      B.put('cobble', 0.42, 0.16, 0.42, px, 0.08, pz, 1.6);
      // ствол
      B.put(frameKey, 0.26, H1 - 0.5, 0.26, px, 0.16 + (H1 - 0.5) / 2, pz, 1.2);
      // капитель под настилом
      B.put(frameKey, 0.4, 0.18, 0.4, px, H1 - 0.17, pz, 1.2);
      B.put('oakDoor', 0.34, 0.12, 0.34, px, H1 - 0.05, pz, 1.2);
      // раскосы к настилу
      for (const s2 of [-1, 1]) {
        const g = box(0.12, 0.9, 0.12, 1);
        const m = mat(px + s2 * 0.22, H1 - 0.52, pz);
        m.multiply(new THREE.Matrix4().makeRotationZ(-s2 * 0.5));
        B.add(g, frameKey, m);
      }
      colliders.boxes.push({ cx: px, cz: pz, hx: 0.16, hz: 0.16, ang: 0, y0: 0, y1: H1 });
    }
    // кронштейны-раскосы от стен к краю настила
    for (const sx of [-1, 1]) {
      for (const z of [GAL_Z + 0.5, 2.0]) {
        const g = box(0.14, 1.5, 0.14, 1);
        const m = mat(sx * (hw - 0.55), H1 - 0.75, z);
        m.multiply(new THREE.Matrix4().makeRotationZ(sx * 0.62));
        B.add(g, frameKey, m);
      }
    }
    // опоры крыла: столбы у края
    for (const z of [WZ0 + 0.5, 0.4]) {
      B.put(frameKey, 0.26, H1, 0.26, WX0 + 0.16, H1 / 2, z, 1.2);
      colliders.boxes.push({ cx: WX0 + 0.16, cz: z, hx: 0.16, hz: 0.16, ang: 0, y0: 0, y1: H1 });
    }

    /* ---- перила по краю настила ----
     *
     * Раньше перила были решёткой из балясин, а коллайдер — сплошной.
     * Игрок упирался в пустоту между балясинами: получалась «невидимая
     * стена» прямо на выходе из лестницы. Теперь низ перил — сплошной
     * парапет, и он совпадает с коллайдером: упёршись, игрок видит дерево.
     */
    const rail = (x0, x1, z0, z1) => {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const w = Math.max(0.12, x1 - x0), d = Math.max(0.12, z1 - z0);
      const along = w >= d;
      // сплошной парапет — нижняя половина перил
      B.put('oakDoor', w, 0.46, d, cx, H1 + 0.23, cz, 1.3);
      // балясины
      for (let t = 0.1; t <= 0.9; t += 0.2) {
        const px = along ? x0 + w * t : cx;
        const pz = along ? cz : z0 + d * t;
        B.put(frameKey, 0.08, 0.5, 0.08, px, H1 + 0.72, pz, 1.2);
      }
      // поручень
      B.put(frameKey, w, 0.1, d, cx, H1 + 1.0, cz, 1.2);
      colliders.boxes.push({
        cx, cz, hx: Math.max(0.06, w / 2), hz: Math.max(0.06, d / 2),
        ang: 0, y0: H1, y1: H1 + 1.0,
      });
    };
    rail(gx0, WX0, GAL_Z, GAL_Z + 0.12);       // передний край северной полосы
    rail(WX0, WX0 + 0.12, WZ0, GAL_Z);        // стык полосы и крыла
    rail(WX0, gx1, WZ0, WZ0 + 0.12);          // южный край крыла
    rail(gx0, gx0 + 0.12, GAL_Z, gz1);        // у западной стены
    // сбоку от проёма — перила с разрывом напротив лестницы
    rail(HATCH_X1 - 0.12, HATCH_X1, HATCH_Z0, CLIMB_Z - 0.45);
    rail(HATCH_X1 - 0.12, HATCH_X1, CLIMB_Z + 0.45, HATCH_Z1);

    /* ---- вертикальная лестница на второй этаж ---- */
    for (const lz of [LAD_Z0, LAD_Z1]) {
      B.put(frameKey, 0.14, H1 + 0.4, 0.14, LAD_X, (H1 + 0.4) / 2, lz, 1.2);
    }
    const rungs = 14;
    for (let i = 0; i < rungs; i++) {
      const y = 0.22 + i * ((H1 + 0.05) / rungs);
      B.add(cyl(0.045, 0.045, LAD_Z1 - LAD_Z0, 7), 'timber',
        mat(LAD_X + 0.14, y, (LAD_Z0 + LAD_Z1) / 2, 0, Math.PI / 2));
    }
    // крюки в стену
    for (const y of [0.7, 2.0, 3.3]) {
      B.put('iron', 0.28, 0.08, 0.08, LAD_X - 0.16, y, (LAD_Z0 + LAD_Z1) / 2, 1);
    }
    // зона подъёма
    climbs.push({
      x: CLIMB_X, z: CLIMB_Z, r: 1.05,
      y0: 0, y1: H1,
      exitX: HATCH_X1 + 0.42, exitZ: CLIMB_Z,
    });

    /* ================================================================
     *  КОМНАТЫ-НИШИ: уходят вглубь, дверь — в стене
     *
     *  Три ниши вмурованы в северную часть здания: их входные стенки —
     *  одна общая стена (z = NICH_Z) с тремя дверными проёмами. Перед
     *  ними — общий зал второго этажа со столиками.
     *
     *  Боковые перегородки ниш глухие: из зала в нишу попасть можно
     *  только через дверь.
     * ================================================================ */
    const RH = 2.8;                       // высота перегородок (до потолка)
    const RZ0 = NICH_Z, RZ1 = gz1;        // глубина ниш
    const parts = [
      { x0: -3.5, x1: -0.2, name: 'у окна' },
      { x0: -0.2, x1: 3.1, name: 'у лестницы' },
      { x0: 3.1, x1: 6.7, name: 'над баром' },
    ];
    const DOOR_W = 1.1;                   // ширина дверного проёма
    const KW = 1.75, KL = 1.0;            // размер кровати

    /**
     * Дверь в стене ниши: косяки, портьера над проёмом, две створки,
     * открытые внутрь ниши, медный щиток и настенный подсвечник.
     *
     * Проём остаётся свободным: створки прижаты к косякам, портьера
     * висит над головой — как в средневековой таверне.
     *
     * @param {number} cx центр проёма (по x)
     * @param {number} num номер комнаты
     */
    const nicheDoor = (cx, num) => {
      const g0 = cx - DOOR_W / 2, g1 = cx + DOOR_W / 2;
      const cz = NICH_Z;
      const leafH = 2.05;
      const topY = H1 + RH - 0.16;
      // портьера и створки — перед стойками проёма, иначе стойка протыкает ткань.
      // Портьера вынесена ещё дальше в зал: полотно и складки разошлись на
      // несколько сантиметров, иначе ткань мерцала на сгибах.
      const pz = cz - 0.31;

      // ---- косяки проёма ----
      // Косяки вынесены перед стеной ниши: иначе они стояли ровно в той же
      // точке, что и стойки проёма, — две почти совпадающие поверхности.
      const jambZ = cz - 0.14;
      for (const gx of [g0, g1]) {
        B.put(frameKey, 0.16, leafH + 0.1, 0.22, gx, H1 + (leafH + 0.1) / 2, jambZ, 1.2);
      }
      B.put('oakDoor', DOOR_W + 0.3, 0.16, 0.22, cx, topY - 0.08, jambZ, 1.2);

      // ---- портьера над проёмом ----
      const rodY = topY - 0.07;
      B.add(cyl(0.026, 0.026, DOOR_W + 0.38, 8), 'iron', mat(cx, rodY, pz, 0, Math.PI / 2));
      for (const s of [-1, 1]) {
        B.add(sphere(0.05, 8, 6), 'iron', mat(cx + s * (DOOR_W / 2 + 0.18), rodY, pz));
      }
      const ph = 0.68;
      B.add(new THREE.PlaneGeometry(DOOR_W + 0.12, ph), 'curtainB',
        mat(cx, rodY - ph / 2 - 0.04, pz, 0));
      const folds = Math.max(7, Math.round((DOOR_W + 0.12) / 0.16));
      const fstep = (DOOR_W + 0.12) / folds;
      for (let i = 0; i < folds; i++) {
        const t = (i - (folds - 1) / 2) * fstep;
        const wave = 0.03 + 0.028 * (0.5 + 0.5 * Math.sin(i * 2.1));
        B.put(i % 2 ? 'curtainA' : 'curtainB', fstep * 0.94, ph - 0.04, 0.04,
          cx + t, rodY - ph / 2 - 0.04, pz - wave - 0.02, 1);
      }

      // ---- створки, открытые внутрь ниши (+z) ----
      const leafW = DOOR_W / 2 - 0.05;
      for (const side of [0, 1]) {
        const hx = side === 0 ? g0 + 0.2 : g1 - 0.2;     // петли, за стойками
        const lz = cz + 0.34;
        B.put('oakDoor', 0.07, leafH, leafW, hx, H1 + leafH / 2, lz, 1.1);
        for (const t of [-0.26, 0.26]) {
          B.put('timber', 0.09, leafH - 0.12, 0.08, hx, H1 + leafH / 2, lz + t * leafW * 0.9, 1.1);
        }
        for (const hy of [0.45, leafH - 0.45]) {
          B.put('iron', 0.1, 0.1, 0.16, hx, H1 + hy, cz + 0.14, 1);
        }
        B.add(torus(0.06, 0.014, 5, 9), 'iron',
          mat(hx + (side === 0 ? 0.05 : -0.05), H1 + 1.02, lz + (side === 0 ? leafW / 2 - 0.1 : -leafW / 2 + 0.1), Math.PI / 2));
      }

      // ---- медный щиток с номером на косяке ----
      B.put('brass', 0.16, 0.2, 0.04, g1 - 0.02, H1 + 1.75, cz - 0.1, 1);
      B.put('iron', 0.03, 0.03, 0.05, g1 - 0.02, H1 + 1.75, cz - 0.1, 1);

      // ---- настенный подсвечник рядом с дверью ----
      {
        const bx = g1 - 0.05, bz = cz - 0.14;
        B.put('iron', 0.2, 0.05, 0.1, bx, H1 + 1.95, bz, 1);
        B.add(cyl(0.035, 0.045, 0.05, 8), 'iron', mat(bx, H1 + 1.99, bz - 0.07));
        B.add(cyl(0.03, 0.035, 0.15, 8), 'cloth', mat(bx, H1 + 2.09, bz - 0.07));
        B.add(cyl(0.018, 0.022, 0.07, 6), 'lampGlass', mat(bx, H1 + 2.2, bz - 0.07));
        const glow = new THREE.PointLight(0xffb066, 0.6, 4.6, 2);
        glow.position.set(bx, H1 + 2.2, bz - 0.07);
        group.add(glow);
      }
    };

    /**
     * Стена ниш с дверными проёмами: доски на стойках, обвязка сверху.
     * Проёмы остаются проходами, глухие участки — препятствия.
     */
    const nicheWall = () => {
      const x0 = parts[0].x0, x1 = parts[parts.length - 1].x1;
      const doors = parts.map((part) => (part.x0 + part.x1) / 2);
      // доски между проёмами
      let cursor = x0;
      for (const cx of doors) {
        const g0 = cx - DOOR_W / 2, g1 = cx + DOOR_W / 2;
        const n = Math.max(1, Math.round((g0 - cursor) / 0.3));
        const step = (g0 - cursor) / n;
        for (let i = 0; i < n; i++) {
          const x = cursor + step * (i + 0.5);
          B.put('oakDoor', step - 0.03, RH - 0.2, 0.09, x, H1 + (RH - 0.2) / 2 + 0.1, NICH_Z, 1.3);
        }
        // коллайдер глухого участка
        colliders.boxes.push({
          cx: (cursor + g0) / 2, cz: NICH_Z, hx: (g0 - cursor) / 2, hz: 0.06,
          ang: 0, y0: H1, y1: H1 + RH,
        });
        cursor = g1;
      }
      // участок после последней двери
      {
        const n = Math.max(1, Math.round((x1 - cursor) / 0.3));
        const step = (x1 - cursor) / n;
        for (let i = 0; i < n; i++) {
          const x = cursor + step * (i + 0.5);
          B.put('oakDoor', step - 0.03, RH - 0.2, 0.09, x, H1 + (RH - 0.2) / 2 + 0.1, NICH_Z, 1.3);
        }
        colliders.boxes.push({
          cx: (cursor + x1) / 2, cz: NICH_Z, hx: (x1 - cursor) / 2, hz: 0.06,
          ang: 0, y0: H1, y1: H1 + RH,
        });
      }
      // стойки по краям проёмов и по углам ниш
      const posts = [x0 + 0.08];
      for (const cx of doors) { posts.push(cx - DOOR_W / 2, cx + DOOR_W / 2); }
      posts.push(x1 - 0.08);
      for (const px of posts) {
        B.put(frameKey, 0.17, H1 + RH, 0.17, px, (H1 + RH) / 2, NICH_Z, 1.2);
        B.put(frameKey, 0.24, 0.18, 0.24, px, H1 - 0.09, NICH_Z, 1.2);
        colliders.boxes.push({ cx: px, cz: NICH_Z, hx: 0.09, hz: 0.09, ang: 0, y0: 0, y1: H1 + RH });
      }
      // обвязка сверху по всей длине стены
      B.put('oakDoor', x1 - x0 + 0.16, 0.14, 0.18, (x0 + x1) / 2, H1 + RH + 0.06, NICH_Z, 1.2);
    };

    /**
     * Боковая перегородка ниши — глухая, от входа до северной стены.
     *
     * @param {number} x где стоит перегородка
     */
    const sideWall = (x) => {
      const n = Math.max(1, Math.round((RZ1 - RZ0) / 0.3));
      const step = (RZ1 - RZ0) / n;
      for (let i = 0; i < n; i++) {
        const z = RZ0 + step * (i + 0.5);
        B.put('oakDoor', 0.09, RH - 0.2, step - 0.03, x, H1 + (RH - 0.2) / 2 + 0.1, z, 1.3);
      }
      // стойки: у входа и у северной стены
      for (const z of [RZ0 + 0.08, RZ1 - 0.08]) {
        B.put(frameKey, 0.17, H1 + RH, 0.17, x, (H1 + RH) / 2, z, 1.2);
        B.put(frameKey, 0.24, 0.18, 0.24, x, H1 - 0.09, z, 1.2);
        colliders.boxes.push({ cx: x, cz: z, hx: 0.09, hz: 0.09, ang: 0, y0: 0, y1: H1 + RH });
      }
      // обвязка сверху
      B.put('oakDoor', 0.16, 0.14, RZ1 - RZ0, x, H1 + RH + 0.06, (RZ0 + RZ1) / 2, 1.2);
      // глухая перегородка — препятствие
      colliders.boxes.push({
        cx: x, cz: (RZ0 + RZ1) / 2, hx: 0.06, hz: (RZ1 - RZ0) / 2,
        ang: 0, y0: H1, y1: H1 + RH,
      });
    };

    // стена с дверями и боковые перегородки ниш
    nicheWall();
    sideWall(-3.5);
    sideWall(-0.2);
    sideWall(3.1);
    // двери — по центру каждой ниши
    for (const [i, part] of parts.entries()) {
      nicheDoor((part.x0 + part.x1) / 2, i + 1);
    }

    /* ================================================================
     *  МЕБЕЛЬ В КАЖДОЙ НИШЕ
     *
     *  Кровать стоит ВДОЛЬ западной перегородки (головой к стене), стол —
     *  у восточной перегородки у входа, сундук — в западном углу.
     *  Между кроватью и столом остаётся свободная полоса больше метра:
     *  до окна можно дойти, ничем не зажатый. Раньше кровать стояла
     *  поперёк ниши и смыкалась со столом — прохода не было вовсе, и
     *  комната выглядела заколоченной.
     * ================================================================ */
    for (const part of parts) {
      const bw = part.x1 - part.x0;
      const bz = RZ1 - 0.12 - KW / 2;             // кровать у северной стены
      const bx = part.x0 + 0.08 + KL / 2;          // кровать у западной перегородки

      // ---- кровать: рама на ножках, матрас, простыня, одеяло, подушка ----
      // Каждая деталь лежит на предыдущей: борта (0,22…0,40) — матрас
      // (0,40…0,60) — простыня (0,60…0,65) — одеяло (0,60…0,70), подушка
      // на простыне (0,65…0,79). Раньше подушка висела в воздухе над
      // матрасом, а одеяло было плоской коробкой — кровать выглядела
      // разобранной.
      {
        // ---- каркас: четыре борта и четыре ножки ----
        for (const sx of [-1, 1]) {
          B.put('timber', 0.08, 0.18, KW, bx + sx * (KL / 2 - 0.04), H1 + 0.31, bz, 1.2);
        }
        for (const sz of [-1, 1]) {
          B.put('timber', KL - 0.08, 0.18, 0.08, bx, H1 + 0.31, bz + sz * (KW / 2 - 0.04), 1.2);
        }
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            B.put('timber', 0.14, 0.55, 0.14,
              bx + sx * (KL / 2 - 0.09), H1 + 0.27, bz + sz * (KW / 2 - 0.07), 1.2);
          }
        }
        // ---- изголовье у западной перегородки: доска и карниз сверху ----
        B.put('oakDoor', 0.12, 0.9, KW + 0.06, bx - KL / 2 + 0.06, H1 + 0.72, bz, 1.2);
        B.put('timber', 0.16, 0.1, KW + 0.12, bx - KL / 2 + 0.06, H1 + 1.22, bz, 1.2);
        // ---- матрас ----
        B.put('cloth', KL - 0.24, 0.18, KW - 0.16, bx, H1 + 0.49, bz, 1.4);
        // ---- простыня: верхняя половина, натянута на матрас ----
        B.put('greenCloth', KL - 0.28, 0.035, 0.78, bx, H1 + 0.597, bz + 0.42, 1.4);
        // ---- одеяло: нижняя половина, с загнутым краем ----
        B.put('redCloth', KL - 0.28, 0.08, 0.8, bx, H1 + 0.615, bz - 0.44, 1.4);
        B.put('redCloth', KL - 0.28, 0.055, 0.12, bx, H1 + 0.677, bz - 0.8, 1.4);
        // ---- подушка у изголовья — лежит на простыне ----
        B.put('cloth', 0.42, 0.13, 0.62, bx - KL / 2 + 0.33, H1 + 0.68, bz, 1.4);
        // ---- сложенное полотенце в ногах — на одеяле ----
        B.put('cloth', 0.6, 0.07, 0.26, bx, H1 + 0.695, bz - 0.55, 1.4);
        colliders.boxes.push({
          cx: bx, cz: bz, hx: KL / 2 + 0.02, hz: KW / 2 + 0.02, ang: 0, y0: H1, y1: H1 + 0.75,
        });
      }

      // ---- маленький столик со свечой, кружкой и свитком ----
      // У восточной перегородки, в привходовой части: проход к окну
      // остаётся свободным.
      const tx = part.x1 - 0.36, tz = RZ0 + 0.55;
      {
        B.put('plank', 0.5, 0.07, 0.42, tx, H1 + 0.62, tz, 1.4);
        for (const s of [-1, 1]) {
          B.put('timber', 0.07, 0.6, 0.07, tx + s * 0.18, H1 + 0.31, tz, 1.2);
          B.put('timber', 0.07, 0.6, 0.07, tx, H1 + 0.31, tz + s * 0.15, 1.2);
        }
        B.add(cyl(0.045, 0.05, 0.18, 8), 'cloth', mat(tx - 0.12, H1 + 0.74, tz));
        B.add(cyl(0.085, 0.1, 0.045, 10), 'brass', mat(tx - 0.12, H1 + 0.65, tz));
        B.add(cyl(0.05, 0.055, 0.12, 8), 'bottle1', mat(tx + 0.13, H1 + 0.71, tz - 0.04));
        B.put('cloth', 0.18, 0.03, 0.22, tx + 0.06, H1 + 0.66, tz + 0.1, 1.2);
        colliders.boxes.push({ cx: tx, cz: tz, hx: 0.26, hz: 0.22, ang: 0, y0: H1, y1: H1 + 0.68 });
      }

      // ---- табурет у кровати и сундук у входа ----
      {
        // табурет — у окна, у восточной перегородки: от двери к окну
        // остаётся ровная линия, ни за что не зажатая
        const sx = part.x1 - 0.32, sz = RZ1 - 0.55;
        B.add(cyl(0.19, 0.17, 0.09, 10), 'plank', mat(sx, H1 + 0.5, sz));
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.5;
          B.add(cyl(0.035, 0.04, 0.48, 6), 'timber',
            mat(sx + Math.cos(a) * 0.11, H1 + 0.24, sz + Math.sin(a) * 0.11, 0, Math.sin(a) * 0.14, Math.cos(a) * 0.14));
        }
        colliders.circles.push({ x: sx, z: sz, r: 0.19, y0: H1, y1: H1 + 0.6 });

        // сундук в западном углу у входа — проём не перекрывает
        const chx = part.x0 + 0.55, chz = RZ0 + 0.42;
        B.put('oakDoor', 0.8, 0.42, 0.52, chx, H1 + 0.21, chz, 1.4);
        B.put('timber', 0.84, 0.07, 0.56, chx, H1 + 0.45, chz, 1.2);
        B.put('iron', 0.1, 0.42, 0.56, chx, H1 + 0.21, chz, 1);
        colliders.boxes.push({ cx: chx, cz: chz, hx: 0.4, hz: 0.26, ang: 0, y0: H1, y1: H1 + 0.5 });
      }

      // ---- коврик перед кроватью ----
      // Раньше это была плоскость в 12 мм над настилом: на досках и на
      // ткани она «проявлялась» по-разному — мерцание текстуры.
      // Теперь ковёр — объёмная плита, нижняя грань утоплена в настил.
      B.put('fabric2', 0.62, 0.035, 1.4, bx + 0.85, H1 + 0.007, bz - 0.3, 1.4);

      // ---- ночник на стойке у кровати ----
      {
        const nx = bx + 0.3, nz = bz - KW / 2 - 0.28;
        B.put('timber', 0.1, 1.25, 0.1, nx, H1 + 0.62, nz, 1.2);
        B.put('iron', 0.16, 0.06, 0.16, nx, H1 + 1.28, nz, 1);
        B.add(cyl(0.035, 0.04, 0.14, 7), 'cloth', mat(nx, H1 + 1.38, nz));
        B.add(cyl(0.018, 0.022, 0.07, 6), 'lampGlass', mat(nx, H1 + 1.5, nz));
        colliders.circles.push({ x: nx, z: nz, r: 0.12, y0: H1, y1: H1 + 1.5 });
        // тёплый огонёк ночника: ниша не должна быть тёмной комнатой
        const glow = new THREE.PointLight(0xffb066, 0.85, 5.2, 2);
        glow.position.set(nx, H1 + 1.52, nz);
        group.add(glow);
      }

      rooms.push({
        x: (part.x0 + part.x1) / 2, z: (RZ0 + RZ1) / 2,
        w: bw, d: RZ1 - RZ0, name: part.name,
        bedX: bx, bedZ: bz, bedY: H1 + 0.6,     // где стоит кровать
        doorX: (part.x0 + part.x1) / 2, doorZ: RZ0,   // где дверь в нишу
      });
    }

    /* ================================================================
     *  ЗАЛ ПЕРЕД НИШАМИ: свободный проход
     *
     *  Столики перед комнатами убраны: от ниш к лестнице и балкону
     *  должен идти свободный проход. Вдоль стены остались только
     *  сундуки и подсвечники — мебели посреди зала нет.
     * ================================================================ */
    {
      // сундуки у стены ниш, в промежутках между дверями
      for (const [cx, cz] of [[0.0, 5.32], [3.4, 5.32]]) {
        B.put('oakDoor', 0.86, 0.44, 0.52, cx, H1 + 0.22, cz, 1.4);
        B.put('timber', 0.9, 0.07, 0.56, cx, H1 + 0.47, cz, 1.2);
        B.put('iron', 0.1, 0.44, 0.56, cx, H1 + 0.22, cz, 1);
        B.add(cyl(0.09, 0.1, 0.14, 9), 'cloth', mat(cx + 0.2, H1 + 0.55, cz - 0.05));
        B.add(cyl(0.05, 0.055, 0.13, 8), 'bottle1', mat(cx - 0.18, H1 + 0.55, cz + 0.06));
        colliders.boxes.push({
          cx, cz, hx: 0.46, hz: 0.3, ang: 0, y0: H1, y1: H1 + 0.52,
        });
      }
    }

    /* ================================================================
     *  СТОЛИКИ НА БАЛКОНЕ (крыло над стойкой бара)
     * ================================================================ */
    const wingTables = [
      { x: 5.5, z: -0.6, w: 1.5, d: 1.0 },
      { x: 5.5, z: 1.5, w: 1.5, d: 1.0 },
    ];
    for (const t of wingTables) {
      B.put('plank', t.w, 0.1, t.d, t.x, H1 + 0.78, t.z, 1.6);
      for (const sx of [-1, 1]) {
        B.put(frameKey, 0.16, 0.74, t.d - 0.2, t.x + sx * (t.w / 2 - 0.18), H1 + 0.37, t.z, 1.2);
      }
      B.put(frameKey, t.w - 0.4, 0.12, 0.14, t.x, H1 + 0.42, t.z, 1.2);
      colliders.boxes.push({ cx: t.x, cz: t.z, hx: t.w / 2, hz: t.d / 2, ang: 0, y0: H1, y1: H1 + 0.85 });
      // лавки
      for (const sz of [-1, 1]) {
        B.put('plank', t.w - 0.2, 0.1, 0.36, t.x, H1 + 0.46, t.z + sz * (t.d / 2 + 0.4), 1.6);
        for (const sx of [-1, 1]) {
          B.put(frameKey, 0.12, 0.44, 0.28, t.x + sx * (t.w / 2 - 0.3), H1 + 0.22, t.z + sz * (t.d / 2 + 0.4), 1.2);
        }
        colliders.boxes.push({
          cx: t.x, cz: t.z + sz * (t.d / 2 + 0.4), hx: (t.w - 0.2) / 2, hz: 0.18,
          ang: 0, y0: H1, y1: H1 + 0.5,
        });
      }
      // свеча и кружка
      B.add(cyl(0.05, 0.055, 0.2, 8), 'cloth', mat(t.x, H1 + 0.93, t.z));
      B.add(cyl(0.09, 0.11, 0.05, 10), 'brass', mat(t.x, H1 + 0.83, t.z));
      B.add(cyl(0.05, 0.055, 0.13, 8), 'bottle1', mat(t.x + 0.32, H1 + 0.89, t.z + 0.12));
    }

    /* ================================================================
     *  ДЕКОР ЗАПАДНОЙ СТЕНЫ ВТОРОГО ЭТАЖА
     *  Стена была пустой — повесили картины и поставили полку с кружками.
     * ================================================================ */
    {
      const wx = -hw + WALL / 2 + 0.09;      // вплотную к западной стене, внутри
      const paintings = [
        { z: -1.9, key: 'greenCloth', w: 0.95, h: 0.72 },
        { z: -0.2, key: 'redCloth', w: 0.8, h: 0.62 },
        { z: 1.5, key: 'cloth', w: 0.9, h: 0.68 },
      ];
      for (const pa of paintings) {
        const py = H1 + 1.45;
        // рама
        B.put('oakDoor', 0.07, pa.h + 0.12, 0.09, wx, py, pa.z - pa.w / 2 - 0.04, 1.2);
        B.put('oakDoor', 0.07, pa.h + 0.12, 0.09, wx, py, pa.z + pa.w / 2 + 0.04, 1.2);
        B.put('oakDoor', 0.07, 0.09, pa.w + 0.16, wx, py + pa.h / 2 + 0.04, pa.z, 1.2);
        B.put('oakDoor', 0.07, 0.09, pa.w + 0.16, wx, py - pa.h / 2 - 0.04, pa.z, 1.2);
        // холст и «сюжет» на нём: тёмный силуэт на цветном фоне
        B.put(pa.key, 0.04, pa.h, pa.w, wx + 0.01, py, pa.z, 1.3);
        B.put('dark', 0.03, pa.h * 0.46, pa.w * 0.34, wx + 0.03, py - pa.h * 0.12, pa.z, 1.3);
        B.add(cyl(0.09, 0.09, 0.03, 10), 'brass', mat(wx + 0.04, py + pa.h * 0.26, pa.z, 0, 0, Math.PI / 2));
      }
      // полка с кружками и свечой
      {
        const sz = 2.9, sy = H1 + 0.95;
        B.put('plank', 0.32, 0.07, 1.5, wx + 0.16, sy, sz, 1.5);
        for (const oz of [-0.6, 0.6]) {
          B.put(frameKey, 0.1, 0.3, 0.1, wx + 0.02, sy - 0.16, sz + oz, 1.2);
        }
        const mugs = [
          { z: sz - 0.5, key: 'cloth' }, { z: sz - 0.22, key: 'redCloth' },
          { z: sz + 0.06, key: 'greenCloth' }, { z: sz + 0.34, key: 'cloth' },
        ];
        for (const m of mugs) {
          B.add(cyl(0.085, 0.075, 0.17, 10), m.key, mat(wx + 0.16, sy + 0.12, m.z));
          B.add(cyl(0.07, 0.07, 0.02, 10), 'brass', mat(wx + 0.16, sy + 0.21, m.z));
        }
        B.add(cyl(0.045, 0.05, 0.18, 8), 'cloth', mat(wx + 0.18, sy + 0.13, sz + 0.58));
        colliders.boxes.push({ cx: wx + 0.16, cz: sz, hx: 0.16, hz: 0.75, ang: 0, y0: sy, y1: sy + 0.25 });
      }
    }
  }

  /* ================================================================
   *  СТОЛЫ, ЛАВКИ, СВЕЧИ
   * ================================================================ */
  const tables = [
    { x: -1.6, z: -1.4, w: 2.6, d: 1.0 },
    { x: 2.2, z: -1.0, w: 2.2, d: 0.95 },
    { x: -2.6, z: 2.0, w: 1.7, d: 1.7, round: true },
  ];
  for (const t of tables) {
    if (t.round) {
      B.add(cyl(t.w / 2, t.w / 2, 0.1, 16), 'plank', mat(t.x, 0.78, t.z));
      B.add(cyl(0.16, 0.22, 0.76, 10), 'timber', mat(t.x, 0.38, t.z));
      B.add(cyl(0.42, 0.42, 0.1, 12), 'timber', mat(t.x, 0.05, t.z));
      colliders.circles.push({ x: t.x, z: t.z, r: t.w / 2 + 0.05, y0: 0, y1: 0.9 });
      // табуреты
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.6;
        const sx = t.x + Math.cos(a) * (t.w / 2 + 0.55);
        const sz = t.z + Math.sin(a) * (t.w / 2 + 0.55);
        B.add(cyl(0.19, 0.17, 0.1, 10), 'plank', mat(sx, 0.46, sz));
        for (let k = 0; k < 3; k++) {
          const a2 = (k / 3) * Math.PI * 2 + 0.5;
          B.add(cyl(0.035, 0.04, 0.46, 6), 'timber',
            mat(sx + Math.cos(a2) * 0.11, 0.23, sz + Math.sin(a2) * 0.11, 0, Math.sin(a2) * 0.14, Math.cos(a2) * 0.14));
        }
        colliders.circles.push({ x: sx, z: sz, r: 0.24, y0: 0, y1: 0.55 });
      }
    } else {
      B.put('plank', t.w, 0.1, t.d, t.x, 0.78, t.z, 1.6);
      for (const sx of [-1, 1]) {
        B.put(frameKey, 0.16, 0.74, t.d - 0.2, t.x + sx * (t.w / 2 - 0.2), 0.37, t.z, 1.2);
        B.put(frameKey, 0.14, 0.5, 0.14, t.x + sx * (t.w / 2 - 0.2), 0.25, t.z + t.d / 2 - 0.25, 1.2);
      }
      B.put(frameKey, t.w - 0.4, 0.12, 0.14, t.x, 0.42, t.z, 1.2);
      colliders.boxes.push({ cx: t.x, cz: t.z, hx: t.w / 2, hz: t.d / 2, ang: 0, y0: 0, y1: 0.85 });
      // лавки
      for (const sz of [-1, 1]) {
        B.put('plank', t.w - 0.3, 0.1, 0.4, t.x, 0.46, t.z + sz * (t.d / 2 + 0.45), 1.6);
        for (const sx of [-1, 1]) {
          B.put(frameKey, 0.14, 0.44, 0.32, t.x + sx * (t.w / 2 - 0.35), 0.22, t.z + sz * (t.d / 2 + 0.45), 1.2);
        }
        colliders.boxes.push({
          cx: t.x, cz: t.z + sz * (t.d / 2 + 0.45), hx: (t.w - 0.3) / 2, hz: 0.2, ang: 0, y0: 0, y1: 0.5,
        });
      }
    }
    // свеча на столе
    B.add(cyl(0.05, 0.055, 0.2, 8), 'cloth', mat(t.x, 0.93, t.z));
    B.add(cyl(0.09, 0.11, 0.05, 10), 'brass', mat(t.x, 0.83, t.z));
    // миска и кружка
    B.add(cyl(0.12, 0.08, 0.06, 10), 'bottle4', mat(t.x + 0.35, 0.86, t.z + 0.15));
    B.add(cyl(0.05, 0.055, 0.13, 8), 'bottle1', mat(t.x - 0.35, 0.89, t.z - 0.1));
  }

  /* ================================================================
   *  МЕЛКИЕ ДЕТАЛИ: ковёр, мешки, ящики, лютня, цветы
   * ================================================================ */
  {
    // ковёр в центре зала: объёмные плиты, утопленные в пол.
    // Плоскости над досками мерцали — теперь нижние грани внутри пола.
    B.put('fabric2', 4.2, 0.03, 3.0, 0.2, 0.005, -0.6, 1.5);
    B.put('redCloth', 3.4, 0.03, 2.2, 0.2, 0.028, -0.6, 1.5);
    // мешки и ящики у восточной стены
    for (let i = 0; i < 3; i++) {
      B.add(sphere(0.3, 8, 6), 'cloth', mat(hw - 1.1, 0.28, -4.6 + i * 0.62, i * 0.9));
      B.add(cyl(0.12, 0.16, 0.16, 7), 'cloth', mat(hw - 1.1, 0.55, -4.6 + i * 0.62, i * 0.9));
      colliders.circles.push({ x: hw - 1.1, z: -4.6 + i * 0.62, r: 0.34, y0: 0, y1: 0.65 });
    }
    for (let i = 0; i < 2; i++) {
      const s = 0.62;
      B.add(box(s, s, s, 1), 'plank', mat(hw - 1.0, s / 2 + i * s, -5.1, 0.08 * i));
      B.add(box(s + 0.03, 0.07, s + 0.03), 'timber', mat(hw - 1.0, 0.16 + i * s, -5.1, 0.08 * i));
      B.add(box(s + 0.03, 0.07, s + 0.03), 'timber', mat(hw - 1.0, s * 0.8 + i * s, -5.1, 0.08 * i));
      colliders.boxes.push({ cx: hw - 1.0, cz: -5.1, hx: 0.36, hz: 0.36, ang: 0, y0: 0, y1: 1.3 });
    }
    // лютня на стене
    {
      const lx = -hw + 0.35, lz = -3.4;
      // корпус — «лодочка»: сплюснутая по толщине (x), вытянутая по z
      B.add(sphere(0.25, 12, 8).scale(0.55, 1.0, 1.15), 'oakDoor',
        mat(lx + 0.14, 1.82, lz, 0, 0, 0, 1));
      B.add(sphere(0.16, 12, 8).scale(0.55, 1.0, 1.0), 'oakDoor',
        mat(lx + 0.14, 2.02, lz, 0, 0, 0, 1));
      // розетка
      B.add(cyl(0.075, 0.075, 0.03, 10), 'timber', mat(lx + 0.16, 1.9, lz, 0, 0, Math.PI / 2));
      // гриф с наковальней
      B.add(cyl(0.03, 0.05, 0.82, 8), 'oakDoor', mat(lx + 0.14, 2.46, lz));
      B.add(box(0.05, 0.11, 0.17), 'timber', mat(lx + 0.14, 2.9, lz));
      B.put('timber', 0.06, 0.09, 0.32, lx + 0.14, 2.85, lz, 1.2);
      // колышки
      for (let i = 0; i < 3; i++) {
        B.add(cyl(0.012, 0.012, 0.12, 4), 'timber',
          mat(lx + 0.18, 2.74 - i * 0.09, lz - 0.05 + i * 0.05, 0, 0, Math.PI / 2));
      }
      // струны
      for (let i = 0; i < 4; i++) {
        B.add(cyl(0.006, 0.006, 0.84, 4), 'cloth',
          mat(lx + 0.2, 2.34, lz - 0.045 + i * 0.03, 0, 0, 0));
      }
      // крюк на стене
      B.add(cyl(0.02, 0.02, 0.16, 5), 'iron', mat(lx + 0.08, 2.22, lz, 0, 0, Math.PI / 2));
    }
    // связки трав и лук на стене
    for (const [hz, hy] of [[-5.2, 2.3], [3.4, 2.5]]) {
      B.add(cyl(0.16, 0.1, 0.6, 7), 'hay', mat(hw - 0.45, hy, hz, 0, 0, 0.1));
      B.add(cyl(0.03, 0.03, 0.22, 5), 'rope', mat(hw - 0.45, hy + 0.36, hz));
    }
    // цветы в горшках на столе у бара
    B.add(cyl(0.11, 0.14, 0.2, 9), 'bottle1', mat(BAR_X - 0.15, 1.28, 1.2));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      B.add(sphere(0.055, 6, 5), 'flowerYellow', mat(BAR_X - 0.15 + Math.cos(a) * 0.09, 1.44, 1.2 + Math.sin(a) * 0.09));
    }
    B.add(cyl(0.012, 0.016, 0.2, 4), 'leaf', mat(BAR_X - 0.15, 1.4, 1.2));
  }

  /* ================================================================
   *  КУХНЯ ТАВЕРНЫ (северная часть первого этажа)
   *
   *  Когда здание стало глубже, за баром появилась хозяйственная зона:
   *  печь с котлом, рабочий стол, стеллажи с утварью, бочки и мешки.
   *  Сюда выходит повар, и отсюда идёт жар от очага.
   * ================================================================ */
  {
    const KZ = hd - WALL;                       // внутренняя грань северной стены
    const STOVE_X = -4.6, STOVE_Z = KZ - 0.75;  // печь у северной стены

    // ---- печь-плита с котлом ----
    B.put('stone', 2.2, 1.1, 1.3, STOVE_X, 0.55, STOVE_Z, 1.6);
    B.put('stone', 2.4, 0.18, 1.5, STOVE_X, 1.18, STOVE_Z, 1.6);
    B.put('cobble', 1.0, 0.14, 0.9, STOVE_X, 1.32, STOVE_Z, 1.6);
    // топка с огнём
    B.put('dark', 0.9, 0.7, 0.12, STOVE_X, 0.42, STOVE_Z - 0.62, 1);
    for (let i = 0; i < 4; i++) {
      B.add(cone(0.14, 0.42, 5), 'ember', mat(STOVE_X - 0.3 + i * 0.2, 0.5, STOVE_Z - 0.6));
    }
    const stoveGlow = new THREE.PointLight(0xff8a30, 1.7, 8, 1.9);
    stoveGlow.position.set(STOVE_X, 0.8, STOVE_Z - 0.5);
    group.add(stoveGlow);
    // котёл над огнём
    B.add(cyl(0.42, 0.34, 0.5, 14), 'iron', mat(STOVE_X, 1.62, STOVE_Z));
    B.add(cyl(0.44, 0.44, 0.05, 14), 'iron', mat(STOVE_X, 1.88, STOVE_Z));
    B.add(cyl(0.025, 0.025, 1.2, 5), 'iron', mat(STOVE_X, 2.5, STOVE_Z));
    colliders.boxes.push({
      cx: STOVE_X, cz: STOVE_Z, hx: 1.15, hz: 0.7, ang: 0, y0: 0, y1: 1.3,
    });

    // ---- рабочий стол повара ----
    {
      const tx = 0.6, tz = 7.0;
      B.put('plank', 2.4, 0.12, 0.9, tx, 0.86, tz, 1.7);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          B.put('timber', 0.16, 0.8, 0.16, tx + sx * 1.0, 0.4, tz + sz * 0.32, 1.2);
        }
      }
      B.put('timber', 2.0, 0.1, 0.12, tx, 0.32, tz, 1.2);
      // хлеб, миска, нож
      B.add(cyl(0.16, 0.18, 0.14, 9), 'hay', mat(tx - 0.6, 0.99, tz - 0.1));
      B.add(cyl(0.17, 0.13, 0.09, 12), 'cloth', mat(tx + 0.3, 0.97, tz + 0.1));
      B.put('iron', 0.3, 0.02, 0.06, tx + 0.75, 0.93, tz - 0.12, 1);
      colliders.boxes.push({ cx: tx, cz: tz, hx: 1.24, hz: 0.48, ang: 0, y0: 0, y1: 0.92 });
    }

    // ---- стеллаж с утварью у северной стены ----
    for (let r = 0; r < 2; r++) {
      const y = 1.25 + r * 0.62;
      B.put('plank', 3.4, 0.07, 0.42, 1.6, y, KZ - 0.28, 1.6);
      for (const sx of [-1, 1]) {
        B.put(frameKey, 0.12, 1.9, 0.3, 1.6 + sx * 1.6, 0.95, KZ - 0.28, 1.2);
      }
      // посуда на полке
      for (let i = 0; i < 7; i++) {
        const x = 0.2 + i * 0.45;
        if (r === 0) {
          B.add(cyl(0.1, 0.08, 0.14, 10), 'cloth', mat(x, y + 0.1, KZ - 0.28));
        } else {
          B.add(cyl(0.05, 0.055, 0.24, 8), i % 2 ? 'bottle1' : 'bottle2', mat(x, y + 0.15, KZ - 0.28));
        }
      }
    }
    colliders.boxes.push({ cx: 1.6, cz: KZ - 0.28, hx: 1.75, hz: 0.3, ang: 0, y0: 0, y1: 1.9 });

    // ---- бочки и мешки у восточной стены ----
    for (const [bx, bz, r] of [[5.6, 6.6, 0.42], [5.6, 7.6, 0.42], [6.4, 7.1, 0.36]]) {
      B.add(cyl(r, r * 0.92, 0.86, 14), 'oakDoor', mat(bx, 0.43, bz));
      B.add(cyl(r + 0.03, r + 0.03, 0.08, 14), 'iron', mat(bx, 0.3, bz));
      B.add(cyl(r + 0.03, r + 0.03, 0.08, 14), 'iron', mat(bx, 0.6, bz));
      colliders.circles.push({ x: bx, z: bz, r: r + 0.05, y0: 0, y1: 0.95 });
    }
    for (const [sx, sz] of [[-2.6, 6.6], [-2.0, 7.2]]) {
      B.add(sphere(0.34, 10, 8).scale(1.0, 0.78, 1.1), 'cloth', mat(sx, 0.26, sz));
      colliders.circles.push({ x: sx, z: sz, r: 0.34, y0: 0, y1: 0.6 });
    }

    // ---- подвесные крюки с посудой над столом ----
    for (let i = 0; i < 5; i++) {
      const x = -0.5 + i * 0.55;
      B.add(cyl(0.015, 0.015, 0.22, 5), 'iron', mat(x, 2.35, 7.0));
      B.add(cyl(0.09, 0.07, 0.12, 9), 'iron', mat(x, 2.2, 7.0));
    }
    B.put('timber', 3.0, 0.1, 0.12, 0.6, 2.47, 7.0, 1.2);

    // ---- общий стол трактира в середине зала ----
    {
      const tx = -0.6, tz = 4.4;
      B.put('plank', 2.6, 0.14, 1.0, tx, 0.8, tz, 1.7);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          B.put('timber', 0.18, 0.74, 0.18, tx + sx * 1.1, 0.37, tz + sz * 0.36, 1.2);
        }
      }
      B.put('timber', 2.2, 0.12, 0.16, tx, 0.3, tz, 1.2);
      // лавки вдоль стола
      for (const sz of [-1, 1]) {
        const bz = tz + sz * 0.92;
        B.put('plank', 2.6, 0.12, 0.42, tx, 0.46, bz, 1.7);
        for (const sx of [-1, 1]) {
          B.put('timber', 0.14, 0.44, 0.3, tx + sx * 1.1, 0.22, bz, 1.2);
        }
        colliders.boxes.push({
          cx: tx, cz: bz, hx: 1.3, hz: 0.22, ang: 0, y0: 0, y1: 0.52,
        });
      }
      colliders.boxes.push({ cx: tx, cz: tz, hx: 1.32, hz: 0.52, ang: 0, y0: 0, y1: 0.87 });
      // на столе: миска, хлеб, кружки и свеча
      B.add(cyl(0.22, 0.18, 0.1, 12), 'cloth', mat(tx - 0.7, 0.92, tz - 0.1));
      B.add(cyl(0.17, 0.14, 0.08, 10), 'hay', mat(tx + 0.15, 0.91, tz + 0.12));
      for (const mx of [-0.2, 0.6]) {
        B.add(cyl(0.09, 0.08, 0.14, 9), 'cloth', mat(tx + mx, 0.94, tz - 0.22));
      }
      B.add(cyl(0.05, 0.055, 0.22, 8), 'cloth', mat(tx + 0.95, 0.98, tz + 0.05));
      B.add(cyl(0.09, 0.11, 0.05, 10), 'brass', mat(tx + 0.95, 0.87, tz + 0.05));
    }

    // ---- бочки у западной стены в глубине зала ----
    for (const [bx, bz, r] of [[-6.2, 5.0, 0.42], [-6.2, 6.0, 0.42], [-5.4, 5.5, 0.36]]) {
      B.add(cyl(r, r * 0.92, 0.86, 14), 'oakDoor', mat(bx, 0.43, bz));
      B.add(cyl(r + 0.03, r + 0.03, 0.08, 14), 'iron', mat(bx, 0.3, bz));
      B.add(cyl(r + 0.03, r + 0.03, 0.08, 14), 'iron', mat(bx, 0.6, bz));
      colliders.circles.push({ x: bx, z: bz, r: r + 0.05, y0: 0, y1: 0.95 });
    }

    // ---- свет над кухней ----
    const kitchenLight = new THREE.PointLight(0xffc07a, 1.15, 11, 1.8);
    kitchenLight.position.set(0.4, 2.5, 7.2);
    group.add(kitchenLight);
  }

  /* ================================================================
   *  ШТОРЫ НА ОКНАХ
   *
   *  Тяжёлые тканевые полотнища: карниз с кольцами, ламбрекен и само
   *  полотно. Раньше полотно собиралось из пяти плоскостей в одной
   *  плоскости — они друг в друга «впивались» (z-fighting, мерцание),
   *  тёмные «швы» из дерева выглядели палками, а кольца на карнизе
   *  висели шире полотна, то есть в воздухе.
   *
   *  Теперь полотно — одна цельная плоскость, а складки — объёмные
   *  валики перед ней. Плоскостей в одной плоскости больше нет,
   *  поэтому мерцать нечему.
   * ================================================================ */
  {
    /**
     * Штора на окне.
     *   axis — 'x' (стена смотрит на ±z, карниз вдоль X) или 'z' (стена на ±x).
     *   ry   — поворот полотна (куда смотрит нормаль).
     */
    const curtain = (x, y, z, w, h, ry, key, axis) => {
      const PW = w + 0.34;              // полотно чуть шире проёма
      const PH = h + 0.3;               // и чуть выше — щелей не видно
      const rodY = y + PH / 2 + 0.05;   // карниз над полотном
      // направление «вперёд» (внутрь помещения) и вдоль стены
      const fx = Math.sin(ry), fz = Math.cos(ry);
      const ax = Math.cos(ry), az = -Math.sin(ry);   // вдоль стены

      // ---- карниз: труба вдоль стены, наконечники по краям полотна ----
      const rodLen = PW + 0.5;
      const rod = axis === 'z'
        ? mat(x, rodY, z, 0, Math.PI / 2)
        : mat(x, rodY, z, 0, 0, Math.PI / 2);
      B.add(cyl(0.032, 0.032, rodLen, 8), 'iron', rod);
      for (const s of [-1, 1]) {
        const t = s * (rodLen / 2 - 0.02);
        B.add(sphere(0.06, 8, 6), 'iron', mat(x + ax * t, rodY, z + az * t));
      }
      // кронштейны карниза к стене
      for (const s of [-1, 1]) {
        const t = s * (PW / 2 - 0.08);
        B.put('iron', 0.05, 0.05, 0.16, x + ax * t, rodY + 0.06, z + az * t, 1);
      }

      // ---- подложка: ткань позади шторы, чтобы проём был закрыт наглухо ----
      // Раньше сквозь полотно было видно оконную раму и переплёт.
      // подложка должна быть ПЕРЕД оконной рамой, иначе сквозь штору
      // видно переплёт и раму
      B.add(new THREE.PlaneGeometry(PW + 0.16, PH + 0.14),
        key === 'fabric2' ? 'greenB' : 'curtainB',
        mat(x + fx * 0.02, y, z + fz * 0.02, ry));

      // ---- складки: узкие полосы ткани, чередующиеся оттенками ----
      // Плоское полотно при плоском свете выглядело как бумага, поэтому
      // ткань собрана в складки: полосы двух оттенков дают объём.
      const folds = Math.max(8, Math.round(PW / 0.15));
      const step = PW / folds;
      const green = key === 'fabric2';
      for (let i = 0; i < folds; i++) {
        const t = (i - (folds - 1) / 2) * step;
        // глубина складки волнообразная — ткань «лежит» волной
        const wave = 0.028 + 0.05 * (0.5 + 0.5 * Math.sin(i * 1.9));
        const px = x + ax * t + fx * (0.05 + wave);
        const pz = z + az * t + fz * (0.05 + wave);
        const foldKey = green
          ? (i % 2 ? 'greenA' : 'greenB')
          : (i % 2 ? 'curtainA' : 'curtainB');
        B.put(foldKey, step * 0.99, PH - 0.08, 0.055, px, y, pz, 1,
          axis === 'z' ? [0, Math.PI / 2, 0] : null);
      }
      // тёмная подшивка по низу полотна
      B.put('timber', axis === 'z' ? 0.06 : PW + 0.02, 0.1, axis === 'z' ? PW + 0.02 : 0.06,
        x + fx * 0.05, y - PH / 2 + 0.03, z + fz * 0.05, 1.2);

      // ---- ламбрекен: объёмная планка с оборкой, выступает вперёд ----
      B.put(green ? 'greenB' : 'curtainB',
        axis === 'z' ? 0.16 : PW + 0.12, 0.42, axis === 'z' ? PW + 0.12 : 0.16,
        x + fx * 0.12, y + PH / 2 - 0.16, z + fz * 0.12, 1.4);
      B.put('timber', axis === 'z' ? 0.19 : PW + 0.22, 0.08, axis === 'z' ? PW + 0.22 : 0.19,
        x + fx * 0.13, y + PH / 2 + 0.08, z + fz * 0.13, 1.2);

      // ---- кольца на карнизе: ровно по ширине полотна ----
      // кольца висят на карнизе: их плоскость перпендикулярна карнизу,
      // иначе кольцо «лежит плашмя» и выглядит тёмной запятой
      const rings = 7;
      for (let i = 0; i < rings; i++) {
        const t = (i / (rings - 1) - 0.5) * (PW - 0.16);
        const ry = axis === 'z' ? 0 : Math.PI / 2;
        B.add(torus(0.05, 0.013, 5, 10), 'iron',
          mat(x + ax * t, rodY - 0.06, z + az * t, ry));
      }
    };
    const southZ = -hd + WALL + 0.09;      // внутренняя плоскость южной стены
    const northZ = hd - WALL - 0.09;
    const eastX = hw - WALL - 0.09;
    // южные окна (стена -z)
    curtain(-3.5, 1.5, southZ, 1.3, 1.7, 0, 'fabric', 'x');
    curtain(3.5, 1.5, southZ, 1.3, 1.7, 0, 'fabric2', 'x');
    // окна галереи — те же проёмы, что и на фасаде
    curtain(-2.6, 5.09, southZ, 0.95, 1.1, 0, 'fabric2', 'x');
    curtain(0, 5.09, southZ, 0.95, 1.1, 0, 'fabric', 'x');
    curtain(2.6, 5.09, southZ, 0.95, 1.1, 0, 'fabric2', 'x');
    // северные окна (стена +z) — по одному в каждой нише-комнате
    curtain(-1.15, 5.5, northZ, 1.2, 1.5, Math.PI, 'fabric2', 'x');
    curtain(2.25, 5.5, northZ, 1.2, 1.5, Math.PI, 'fabric', 'x');
    curtain(5.5, 5.5, northZ, 1.2, 1.5, Math.PI, 'fabric2', 'x');
    // восточное окно (стена +x)
    curtain(eastX, 5.2, -3.6, 1.2, 1.5, -Math.PI / 2, 'fabric', 'z');
  }

  /* ================================================================
   *  СТЕНЫ И ПРЕПЯТСТВИЯ
   * ================================================================ */
  colliders.boxes.push({ cx: 0, cz: -hd + WALL / 2, hx: hw, hz: WALL / 2, ang: 0, y0: 0, y1: TOP });
  colliders.boxes.push({ cx: 0, cz: hd - WALL / 2, hx: hw, hz: WALL / 2, ang: 0, y0: 0, y1: TOP });
  colliders.boxes.push({ cx: -hw + WALL / 2, cz: 0, hx: WALL / 2, hz: hd, ang: 0, y0: 0, y1: TOP });
  // восточная стена — с проёмом хозяйственной двери
  {
    const bz0 = BACK_DOOR_Z - BACK_DOOR_W / 2, bz1 = BACK_DOOR_Z + BACK_DOOR_W / 2;
    colliders.boxes.push({ cx: hw - WALL / 2, cz: (-hd + bz0) / 2, hx: WALL / 2, hz: (bz0 + hd) / 2, ang: 0, y0: 0, y1: TOP });
    colliders.boxes.push({ cx: hw - WALL / 2, cz: (bz1 + hd) / 2, hx: WALL / 2, hz: (hd - bz1) / 2, ang: 0, y0: 0, y1: TOP });
  }
  // очаг
  colliders.boxes.push({ cx: FIRE_X - 0.2, cz: FIRE_Z, hx: 0.62, hz: 1.25, ang: 0, y0: 0, y1: 2.4 });
  // лестница — препятствие снизу, но не мешает подъёму (подъём идёт мимо resolve)
  colliders.boxes.push({ cx: LAD_X + 0.1, cz: (LAD_Z0 + LAD_Z1) / 2, hx: 0.12, hz: 0.5, ang: 0, y0: 0, y1: 1.2 });
  // Опоры галереи получили настоящие колонны выше — здесь только
  // у западной стены коллайдера не было (там лестница и зона подъёма).

  /* ================================================================
   *  СВЕТ — постоянный, тёплый, не зависит от времени суток
   * ================================================================ */
  const lights = {};
  lights.hemi = new THREE.HemisphereLight(0x6b4a2c, 0x241609, 0.55);
  group.add(lights.hemi);
  lights.ambient = new THREE.AmbientLight(0xffd7a8, 0.38);
  group.add(lights.ambient);

  // огонь в очаге
  const fireLight = new THREE.PointLight(0xff7a28, 3.4, 17, 1.8);
  fireLight.position.set(FIRE_X - 0.18, 0.55, FIRE_Z);
  group.add(fireLight);
  lights.fire = fireLight;

  // «живой» огонь: несколько языков пламени
  const flames = new THREE.Group();
  flames.position.set(FIRE_X - 0.28, 0.06, FIRE_Z);
  group.add(flames);
  const flameMeshes = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const m = new THREE.Mesh(cone(0.2, 0.72, 6), M.ember);
    m.position.set(Math.cos(a) * 0.2, 0.34, Math.sin(a) * 0.2);
    m.userData.ph = i * 1.7;
    flames.add(m);
    flameMeshes.push(m);
  }
  const fireGlow = makeGlow(glowTex, 3.4, 0xff8a30, 0.75);
  fireGlow.position.set(FIRE_X - 0.28, 0.42, FIRE_Z);
  group.add(fireGlow);

  // подвесные фонари: первый этаж и второй (комнаты и балкон)
  const lamps = [];
  const lampSpots = [
    // [x, z, высота, сила, дальность]
    [-3.4, -2.6, 2.85, 2.0, 13],
    [1.2, -2.2, 2.85, 2.0, 13],
    [-1.4, 1.2, 2.85, 2.0, 13],
    [3.6, 1.6, 2.85, 2.0, 13],
    // фонарь над рабочим местом бармена
    [6.35, 2.75, -0.35, 1.3, 10],
    [-4.6, 4.4, 2.85, 2.0, 13],
    [1.6, 4.6, 2.85, 2.0, 13],
    // кухня в глубине зала
    [0.4, 7.2, 2.6, 1.4, 10],
    [-4.6, 7.4, 2.5, 1.2, 9],
    // второй этаж: по фонарю в каждой нише, фонарь в зале и на балконе
    [-0.9, 7.6, H1 + 2.05, 2.0, 11],
    [2.6, 7.6, H1 + 2.05, 2.0, 11],
    [5.8, 7.6, H1 + 2.05, 2.0, 11],
    [0.0, 4.6, H1 + 2.15, 1.6, 11],
    [5.6, 0.9, H1 + 2.05, 1.6, 9],
    [-6.2, 4.6, H1 + 1.9, 1.2, 8],
  ];
  for (const [lx, lz, ly, base, dist] of lampSpots) {
    const l = new THREE.PointLight(0xffb45a, base, dist, 1.9);
    l.position.set(lx, ly, lz);
    group.add(l);
    const glow = makeGlow(glowTex, 1.9, 0xffd9a0, 0.5);
    glow.position.set(lx, ly, lz);
    group.add(glow);
    // подвес
    const hang = new Builder();
    hang.add(cyl(0.016, 0.016, TOP - ly - 0.3, 5), 'iron', mat(lx, (TOP + ly + 0.3) / 2 - 0.15, lz));
    hang.add(cyl(0.17, 0.22, 0.24, 8), 'iron', mat(lx, ly + 0.26, lz));
    hang.add(cyl(0.2, 0.13, 0.16, 8), 'iron', mat(lx, ly - 0.16, lz));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      hang.add(cyl(0.016, 0.016, 0.42, 4), 'iron',
        mat(lx + Math.cos(a) * 0.15, ly, lz + Math.sin(a) * 0.15));
    }
    group.add(hang.build(MT, null, { name: 'tavernLamp' }));
    // стекло
    const glass = new THREE.Mesh(box(0.26, 0.4, 0.26, 1), lampGlass);
    glass.position.set(lx, ly, lz);
    group.add(glass);
    lamps.push({ l, glow, base, flicker: Math.random() * 10 });
  }
  lights.lamps = lamps;

  // тёплый отсок от пола в центре зала
  lights.bounce = new THREE.PointLight(0xffc987, 0.9, 15, 1.8);
  lights.bounce.position.set(0.2, 1.1, -0.4);
  group.add(lights.bounce);
  // подсветка бара
  lights.bar = new THREE.PointLight(0xffbe74, 1.5, 11, 1.9);
  lights.bar.position.set(BAR_X - 0.7, 2.3, 0);
  group.add(lights.bar);
  // подсветка галереи
  lights.gallery = new THREE.PointLight(0xffd0a0, 1.1, 12, 1.9);
  lights.gallery.position.set(-2.0, H1 + 1.4, 4.6);
  group.add(lights.gallery);
  // мягкая подсветка второго этажа: зал перед нишами, ниши и балкон
  lights.rooms = new THREE.PointLight(0xffc98d, 1.25, 16, 1.8);
  lights.rooms.position.set(1.0, H1 + 1.7, 4.6);
  group.add(lights.rooms);
  lights.niches = new THREE.PointLight(0xffc98d, 1.2, 16, 1.8);
  lights.niches.position.set(1.7, H1 + 1.6, 7.4);
  group.add(lights.niches);
  lights.balcony = new THREE.PointLight(0xffc98d, 0.9, 11, 1.8);
  lights.balcony.position.set(5.6, H1 + 1.6, 0.8);
  group.add(lights.balcony);

  group.add(B.build(MT, null, { name: 'tavernShell' }));

  /* ---------------- точки входа/выхода ---------------- */
  const spawn = { x: 0, z: -hd + 3.8, yaw: Math.PI };   // в глубине зала, лицом в зал
  const exitDoor = { x: 0, z: -hd + 0.62 };              // у самого дверного полотна

  return {
    group, colliders, platforms, climbs, lights, spawn, exitDoor,
    /**
     * Задняя дверь за стойкой: через неё бармен уходит домой на ночь.
     * @type {{x: number, z: number}}
     */
    barExit,
    /**
     * Выход из сеней на улицу с задней стороны таверны.
     * @type {{x: number, z: number}}
     */
    backExit,
    /**
     * Отворить заднюю дверь: створка отходит, коллайдер опускается.
     * @returns {boolean} true, если дверь была открыта
     */
    openBackDoor() {
      if (!backDoorLeaf) return false;
      if (backDoorLeaf.rotation.y !== 0) return false;
      backDoorLeaf.rotation.y = 1.25;
      if (backDoorCollider) backDoorCollider.y1 = -1;
      return true;
    },
    /** Открыта ли задняя дверь. */
    isBackDoorOpen() {
      return !!backDoorLeaf && backDoorLeaf.rotation.y !== 0;
    },
    /**
     * Комнаты второго этажа: центр, размер и название.
     * Используются, чтобы поставить в каждой интеракт «переночевать».
     * @type {{x: number, z: number, w: number, d: number, name: string}[]}
     */
    rooms,
    /**
     * Освещение таверны постоянно: своя палитра и своя «погода» внутри.
     * env (часы основной локации) здесь не участвует.
     */
    update(dt, t) {
      const f = 0.86 + Math.sin(t * 6.1) * 0.08 + Math.sin(t * 17.3) * 0.05;
      fireLight.intensity = 3.1 * f + Math.sin(t * 23.7) * 0.22;
      fireGlow.material.opacity = 0.6 * f;
      fireGlow.scale.setScalar(3.0 + f * 0.7);
      for (const m of flameMeshes) {
        const ph = m.userData.ph;
        const s = 0.8 + Math.sin(t * 7.3 + ph) * 0.18 + Math.sin(t * 15.1 + ph * 2) * 0.1;
        m.scale.set(s * 0.9, s * 1.15, s * 0.9);
        m.position.y = 0.34 * s;
        m.rotation.z = Math.sin(t * 3.7 + ph) * 0.14;
      }
      for (const lamp of lamps) {
        const lf = 0.88 + Math.sin(t * 5.9 + lamp.flicker) * 0.07 + Math.sin(t * 14.3 + lamp.flicker) * 0.04;
        lamp.l.intensity = lamp.base * lf;
        lamp.glow.material.opacity = 0.42 * lf;
        lamp.glow.scale.setScalar(1.7 + lf * 0.4);
      }
      lights.bounce.intensity = 0.85 + Math.sin(t * 1.7) * 0.06;
    },
  };
}

export const TAVERN_SIZE = { W, D, H1, H2 };
