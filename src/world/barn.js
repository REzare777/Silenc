import * as THREE from 'three';
import { Builder, box, cyl, sphere, cone, torus, roofShell, mat } from './geo.js';
import { clutter, cart } from './props.js';

/* ------------------------------------------------------------------
 *  Амбар — отдельная локация (интерьер)
 *
 *  Настоящий деревенский амбар: оштукатуренные стены в фахверк,
 *  двускатная крыша, сеновал (второй этаж) во всю ширину амбара
 *  с люком и настоящей лестницей, внизу — бочки, ящики, мешки,
 *  повозки и сено.
 *
 *  Всё это — отдельная сцена: игрок попадает сюда по клавише E
 *  у ворот амбара в деревне и выходит обратно изнутри.
 *  Освещение интерьера живёт по часам основной локации: днём в
 *  щели и окна падает свет, вечером и ночью зажигаются фонари.
 * ------------------------------------------------------------------ */

const W = 13;        // ширина (x)
const D = 9;         // глубина (z)
const H1 = 4.3;      // высота первого этажа (до настила сеновала)
const H2 = 3.1;      // высота второго этажа (до конька)
const WALL = 0.32;   // толщина стены
const DOOR_W = 3.6;  // ширина ворот
const DOOR_H = 3.3;  // высота ворот
const BASE = 0.45;   // высота каменного цоколя

export function buildBarnInterior(M, glowTex) {
  const group = new THREE.Group();
  group.name = 'barnInterior';
  const B = new Builder();
  const colliders = { boxes: [], circles: [] };
  const platforms = [];
  const climbs = [];

  const hw = W / 2, hd = D / 2;
  const TOP = H1 + H2;            // верх стен

  /* ---------------- пол первого этажа ---------------- */
  B.put('cobble', W, 0.12, D, 0, 0.06, 0, 1.6);

  /* ---------------- каменный цоколь ---------------- */
  // сплошной по трём сторонам, а у ворот — разрыв (там порог)
  B.put('stoneDark', W + 0.16, BASE, WALL + 0.16, 0, BASE / 2, hd - WALL / 2, 1.2);
  for (const sx of [-1, 1]) {
    B.put('stoneDark', WALL + 0.16, BASE, D + 0.16, sx * (hw - WALL / 2), BASE / 2, 0, 1.2);
  }
  for (const sx of [-1, 1]) {
    const w = hw - DOOR_W / 2;
    B.put('stoneDark', w, BASE, WALL + 0.16, sx * (DOOR_W / 2 + w / 2), BASE / 2, -hd + WALL / 2, 1.2);
  }
  // порог у ворот
  B.put('stone', DOOR_W, 0.14, WALL + 0.3, 0, 0.07, -hd + WALL / 2, 1.3);

  /* ================================================================
   *  СТЕНЫ: штукатурка + фахверк (как в деревне)
   * ================================================================ */
  const wallKey = 'plasterWarm';
  const frameKey = 'timber';

  // ---- задняя стена (+z): большое окно по центру ----
  {
    const z = hd - WALL / 2, wy = 2.9, wh = 1.4, ww = 2.2;
    const seg = (x0, x1, y0, y1) => B.put(wallKey, x1 - x0, y1 - y0, WALL,
      (x0 + x1) / 2, (y0 + y1) / 2, z, 1.7);
    seg(-hw, -ww / 2, BASE, TOP);
    seg(ww / 2, hw, BASE, TOP);
    seg(-ww / 2, ww / 2, BASE, wy - wh / 2);
    seg(-ww / 2, ww / 2, wy + wh / 2, TOP);
    // проём: рама + тёмная «стеклянная» вставка (не видно насквозь)
    B.put(frameKey, ww + 0.24, 0.16, WALL + 0.1, 0, wy + wh / 2 + 0.06, z, 1.2);
    B.put(frameKey, ww + 0.24, 0.16, WALL + 0.1, 0, wy - wh / 2 - 0.06, z, 1.2);
    for (const sx of [-1, 1]) {
      B.put(frameKey, 0.16, wh + 0.24, WALL + 0.1, sx * (ww / 2 + 0.06), wy, z, 1.2);
    }
    B.put(frameKey, 0.1, wh, 0.1, 0, wy, z + 0.06, 1.2);
    B.put('windowDark', ww, wh, 0.06, 0, wy, z + 0.02, 1.4);
  }

  // ---- передняя стена (-z): ворота + окошко над ними ----
  {
    const z = -hd + WALL / 2, wy = 5.0, wh = 0.7, ww = 0.9;
    const seg = (x0, x1, y0, y1) => B.put(wallKey, x1 - x0, y1 - y0, WALL,
      (x0 + x1) / 2, (y0 + y1) / 2, z, 1.7);
    seg(-hw, -DOOR_W / 2, BASE, TOP);
    seg(DOOR_W / 2, hw, BASE, TOP);
    seg(-DOOR_W / 2, DOOR_W / 2, DOOR_H, wy - wh / 2);
    seg(-DOOR_W / 2, DOOR_W / 2, wy + wh / 2, TOP);
    seg(-DOOR_W / 2, -ww / 2, wy - wh / 2, wy + wh / 2);
    seg(ww / 2, DOOR_W / 2, wy - wh / 2, wy + wh / 2);
    // косяки ворот
    for (const sx of [-1, 1]) {
      B.put(frameKey, 0.2, DOOR_H + 0.2, WALL + 0.12, sx * (DOOR_W / 2 + 0.1), (DOOR_H + 0.2) / 2, z, 1.2);
    }
    B.put(frameKey, DOOR_W + 0.4, 0.22, WALL + 0.12, 0, DOOR_H + 0.11, z, 1.2);
    // окошко над воротами
    B.put(frameKey, ww + 0.2, 0.13, WALL + 0.1, 0, wy + wh / 2 + 0.05, z, 1.2);
    B.put(frameKey, ww + 0.2, 0.13, WALL + 0.1, 0, wy - wh / 2 - 0.05, z, 1.2);
    for (const sx of [-1, 1]) {
      B.put(frameKey, 0.13, wh, WALL + 0.1, sx * (ww / 2 + 0.05), wy, z, 1.2);
    }
    B.put('windowDark', ww, wh, 0.06, 0, wy, z - 0.02, 1.4);
  }

  // ---- боковые стены (±x): по два окна ----
  for (const sx of [-1, 1]) {
    const x = sx * (hw - WALL / 2);
    const wins = [{ z: -1.7, w: 1.1 }, { z: 1.9, w: 1.1 }];
    const wy = 2.85, wh = 1.25;
    const seg = (z0, z1, y0, y1) => B.put(wallKey, WALL, y1 - y0, z1 - z0,
      x, (y0 + y1) / 2, (z0 + z1) / 2, 1.7);
    // вертикальные куски между окнами и краями
    const cuts = [-hd, ...wins.flatMap(w => [w.z - w.w / 2, w.z + w.w / 2]), hd];
    for (let i = 0; i < cuts.length; i += 2) seg(cuts[i], cuts[i + 1], BASE, TOP);
    for (const w of wins) {
      seg(w.z - w.w / 2, w.z + w.w / 2, BASE, wy - wh / 2);
      seg(w.z - w.w / 2, w.z + w.w / 2, wy + wh / 2, TOP);
      // рама и стекло
      B.put(frameKey, WALL + 0.1, 0.14, w.w + 0.2, x, wy + wh / 2 + 0.05, w.z, 1.2);
      B.put(frameKey, WALL + 0.1, 0.14, w.w + 0.2, x, wy - wh / 2 - 0.05, w.z, 1.2);
      for (const s2 of [-1, 1]) {
        B.put(frameKey, WALL + 0.1, wh, 0.14, x, wy, w.z + s2 * (w.w / 2 + 0.05), 1.2);
      }
      B.put(frameKey, 0.1, wh, 0.1, x - sx * 0.05, wy, w.z, 1.2);
      B.put('windowDark', 0.06, wh, w.w, x - sx * 0.02, wy, w.z, 1.4);
    }
  }

  /* ---------------- фахверк: стойки, обвязка, раскосы ---------------- */
  const post = 0.26;
  const inset = WALL / 2 + post / 2;
  // угловые и промежуточные стойки
  const postXs = [-hw + inset, -4.3, 0, 4.3, hw - inset];
  for (const px of postXs) {
    for (const pz of [-hd + inset, hd - inset]) {
      B.put(frameKey, post, TOP - BASE, post, px, (TOP + BASE) / 2, pz, 1.2);
    }
  }
  const postZs = [-hd + inset, 0, hd - inset];
  for (const pz of postZs) {
    for (const px of [-hw + inset, hw - inset]) {
      B.put(frameKey, post, TOP - BASE, post, px, (TOP + BASE) / 2, pz, 1.2);
    }
  }
  // обвязка: низ, верх и перевод на уровне настила
  for (const y of [BASE + 0.13, H1 - 0.13, TOP - 0.13]) {
    for (const pz of [-hd + inset, hd - inset]) {
      B.put(frameKey, W - WALL - post, 0.26, 0.2, 0, y, pz, 1.2);
    }
    for (const px of [-hw + inset, hw - inset]) {
      B.put(frameKey, 0.2, 0.26, D - WALL - post, px, y, 0, 1.2);
    }
  }
  // раскосы в углах (по диагонали)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = box(0.17, 2.6, 0.17, 1);
      const m = mat(sx * (hw - 1.05), BASE + 1.35, sz * (hd - 0.34));
      m.multiply(new THREE.Matrix4().makeRotationZ(sx * 0.72));
      B.add(g, frameKey, m);
    }
  }

  /* ================================================================
   *  ВТОРОЙ ЭТАЖ: ЗАКЛЕИВАЕМ ВСЕ ЩЕЛИ
   *
   *  Раньше со сеновала было видно наружу: в штукатурке стен
   *  оставались вертикальные просветы (у фахверковых стоек), а на
   *  торцах здания зияли открытые треугольники под скатами крыши.
   *  Теперь весь периметр второго этажа зашит вагонкой, окно над
   *  воротами заколочено, торцы закрыты дощатыми фронтонами.
   * ================================================================ */
  {
    const sy0 = H1 + 0.03;             // низ обшивки (над настилом)
    const sy1 = TOP - 0.03;            // верх
    const sH = sy1 - sy0;
    const bt = 0.05;                   // толщина обшивки
    const bw = 0.26;                   // ширина доски
    // внутренние грани фахверковых стоек: обшивка идёт перед ними
    const fx = hw - inset - post / 2;  // 6.08 — боковые стены
    const fz = hd - inset - post / 2;  // 4.21 — торцевые стены
    // проём окна над воротами (его заколотим)
    const winX = 0.45, winY0 = 4.62, winY1 = 5.38;

    // --- вагонка вдоль x (торцевые стены) ---
    const runX = (z, dir) => {
      const x0 = -fx, x1 = fx;
      const n = Math.max(1, Math.round((x1 - x0) / (bw + 0.02)));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const cx = x0 + step * (i + 0.5);
        const w = step + 0.012;    // внахлёст: сквозь щель не видно наружу
        const zz = z - dir * (bt / 2 + 0.01);
        if (Math.abs(cx) < winX) {
          // доска разрезана окном: часть снизу и часть сверху
          B.put('oakDoor', w, winY0 - sy0, bt, cx, (sy0 + winY0) / 2, zz, 1.4);
          B.put('oakDoor', w, sy1 - winY1, bt, cx, (winY1 + sy1) / 2, zz, 1.4);
        } else {
          B.put('oakDoor', w, sH, bt, cx, (sy0 + sy1) / 2, zz, 1.4);
        }
      }
    };
    // --- вагонка вдоль z (боковые стены) ---
    const runZ = (x, dir) => {
      const z0 = -fz, z1 = fz;
      const n = Math.max(1, Math.round((z1 - z0) / (bw + 0.02)));
      const step = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const cz = z0 + step * (i + 0.5);
        B.put('oakDoor', bt, sH, step + 0.012, x + dir * (bt / 2 + 0.01), (sy0 + sy1) / 2, cz, 1.4);
      }
    };
    runX(-fz, 1);          // передняя стена (ворота) — с проёмом под окно
    runX(fz, -1);          // задняя стена
    runZ(-fx, 1);          // западная стена
    runZ(fx, -1);          // восточная стена

    // --- окно над воротами: заколочено крест-накрест ---
    {
      const z = -fz + 0.02;
      for (const a of [0.72, -0.72]) {
        const b = box(1.28, 0.16, 0.05, 1.4);
        const m = mat(0, (winY0 + winY1) / 2, z, 0, 0, a);
        B.add(b, 'timber', m);
      }
      // гвозди по периметру щипка
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        B.add(cyl(0.022, 0.022, 0.05, 6), 'iron',
          mat(sx * 0.5, (winY0 + winY1) / 2 + sy * 0.26, z + 0.04, Math.PI / 2));
      }
    }

    // --- декоративный фахверк поверх обшивки (вид сохраняется) ---
    for (const px of postXs) {
      for (const pz of [-hd + inset, hd - inset]) {
        const zz = pz > 0 ? fz - 0.06 : -(fz - 0.06);
        B.put('timber', 0.12, sH, 0.1, px, (sy0 + sy1) / 2, zz, 1.2);
      }
    }
    for (const pz of postZs) {
      for (const px of [-hw + inset, hw - inset]) {
        const xx = px > 0 ? fx - 0.06 : -(fx - 0.06);
        B.put('timber', 0.1, sH, 0.12, xx, (sy0 + sy1) / 2, pz, 1.2);
      }
    }
    // обвязка по верху и низу обшивки
    for (const y of [sy0 + 0.08, sy1 - 0.08]) {
      for (const zz of [-fz + 0.04, fz - 0.04]) {
        B.put('timber', fx * 2, 0.16, 0.12, 0, y, zz, 1.2);
      }
      for (const xx of [-fx + 0.04, fx - 0.04]) {
        B.put('timber', 0.12, 0.16, fz * 2, xx, y, 0, 1.2);
      }
    }

    /* --- ФРОНТОНЫ на торцах: закрываем треугольники под скатами --- */
    const ridgeY = TOP - 0.03 + 2.5;     // конёк
    const eaveY = TOP - 0.03;            // низ ската у свеса
    const slope = (ridgeY - eaveY) / (hd + 0.55);
    const fBase = eaveY + slope * hd;   // высота ската над стеной
    const tri = (x, flip) => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array([
        x, fBase - 0.12, -hd, x, fBase - 0.12, hd, x, ridgeY, 0,
      ]);
      const n = flip ? -1 : 1;
      const nor = new Float32Array([n, 0, 0, n, 0, 0, n, 0, 0]);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2));
      g.setIndex(flip ? [0, 2, 1] : [0, 1, 2]);
      return g;
    };
    for (const sx of [-1, 1]) {
      const x = sx * (hw - WALL / 2);
      B.add(tri(x, sx > 0), 'plank');
      // стойка фронтона и раскосы
      B.put('timber', 0.2, ridgeY - (fBase - 0.12), 0.2, x + sx * 0.12, (fBase - 0.12 + ridgeY) / 2, 0, 1.2);
      for (const sz of [-1, 1]) {
        const g = box(0.14, 2.3, 0.14, 1);
        const m = mat(x + sx * 0.12, fBase + 0.9, sz * 1.25);
        m.multiply(new THREE.Matrix4().makeRotationX(sz * 0.5));
        B.add(g, 'timber', m);
      }
      // горизонтальная перекладина под коньком
      B.put('timber', 0.16, 0.16, hd * 2, x + sx * 0.1, fBase + 0.9, 0, 1.2);
    }
  }

  /* ================================================================
   *  СЕНОВАЛ: настил, вертикальная лестница, люк для сена
   *
   *  Настил идёт во всю ширину амбара. У западной стены в нём
   *  вырезан ПРОЁМ (люк), сквозь который проходит ВЕРТИКАЛЬНАЯ
   *  лестница: игрок подходит к ней снизу, смотрит вверх и жмёт W —
   *  цепляется и поднимается; наверху перелезает на настил.
   *  Спуститься можно тем же способом: встать у края люка,
   *  посмотреть вниз и нажать S.
   *
   *  По центру настила — второй люк, для сена.
   * ================================================================ */
  const loftY = H1;
  const lx0 = -hw + 0.36, lx1 = hw - 0.36;
  const lz0 = -hd + 0.4, lz1 = hd - 0.4;

  // ---- вертикальная лестница у западной стены ----
  const LAD_X = -6.10;                    // стойки лестницы (у самой стены)
  const LAD_HANG = -5.75;                 // где висит игрок
  const LAD_Z0 = -2.65, LAD_Z1 = -1.55;   // ширина лестницы по z
  const LAD_ZC = (LAD_Z0 + LAD_Z1) / 2;
  const HATCH_X1 = -5.30;                 // восточный край люка в настиле
  const HATCH_Z0 = -2.65, HATCH_Z1 = -1.55;

  // ---- люк для сена по центру настила ----
  const HX = 1.5, HZ = -0.2, HW2 = 1.7;

  const segs = [
    // западная полоса настила: до люка под лестницу и после него
    [lx0, HATCH_X1, lz0, HATCH_Z0],
    [lx0, HATCH_X1, HATCH_Z1, lz1],
    // основной настил с люком для сена
    [HATCH_X1, HX - HW2 / 2, lz0, lz1],
    [HX + HW2 / 2, lx1, lz0, lz1],
    [HX - HW2 / 2, HX + HW2 / 2, lz0, HZ - HW2 / 2],
    [HX - HW2 / 2, HX + HW2 / 2, HZ + HW2 / 2, lz1],
  ];
  for (const [x0, x1, z0, z1] of segs) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.put('plank', x1 - x0, 0.16, z1 - z0, cx, loftY - 0.08, cz, 1.7);
    platforms.push({ cx, cz, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, ang: 0, y: loftY, only: true });
  }
  // балки под настилом (в проёме под лестницу их нет)
  for (let z = lz0 + 0.6; z < lz1; z += 1.45) {
    if (z > HATCH_Z0 && z < HATCH_Z1) {
      B.put(frameKey, lx1 - HATCH_X1, 0.2, 0.18, (HATCH_X1 + lx1) / 2, loftY - 0.26, z, 1.2);
    } else {
      B.put(frameKey, lx1 - lx0, 0.2, 0.18, (lx0 + lx1) / 2, loftY - 0.26, z, 1.2);
    }
  }
  // обвязка проёма: две балки поперёк и одна вдоль края
  B.put(frameKey, HATCH_X1 - lx0 + 0.2, 0.22, 0.2, (lx0 + HATCH_X1) / 2, loftY - 0.24, HATCH_Z0, 1.2);
  B.put(frameKey, HATCH_X1 - lx0 + 0.2, 0.22, 0.2, (lx0 + HATCH_X1) / 2, loftY - 0.24, HATCH_Z1, 1.2);
  B.put(frameKey, 0.2, 0.22, HATCH_Z1 - HATCH_Z0 + 0.2, HATCH_X1, loftY - 0.24, LAD_ZC, 1.2);

  // ---- перила: край люка под лестницу и люк для сена ----
  const railRun = (ax0, ax1, az0, az1) => {
    const cx = (ax0 + ax1) / 2, cz = (az0 + az1) / 2;
    const w = Math.max(0.12, ax1 - ax0), d = Math.max(0.12, az1 - az0);
    B.put(frameKey, w, 0.1, d, cx, loftY + 0.95, cz, 1.2);
    B.put(frameKey, w, 0.1, d, cx, loftY + 0.5, cz, 1.2);
    for (const t of [0.14, 0.5, 0.86]) {
      const px = ax0 + (ax1 - ax0) * t, pz = az0 + (az1 - az0) * t;
      B.put(frameKey, 0.12, 1.0, 0.12, px, loftY + 0.5, pz, 1.2);
    }
    colliders.boxes.push({
      cx, cz, hx: Math.max(0.07, (ax1 - ax0) / 2), hz: Math.max(0.07, (az1 - az0) / 2),
      ang: 0, y0: loftY, y1: loftY + 1.0,
    });
  };
  // перила вдоль проёма: с двух сторон по z (середина — место лестницы)
  railRun(lx0, HATCH_X1, HATCH_Z0 - 0.1, HATCH_Z0);
  railRun(lx0, HATCH_X1, HATCH_Z1, HATCH_Z1 + 0.1);
  // восточный край проёма: перила с разрывом напротив лестницы
  railRun(HATCH_X1 - 0.1, HATCH_X1, HATCH_Z0, LAD_ZC - 0.45);
  railRun(HATCH_X1 - 0.1, HATCH_X1, LAD_ZC + 0.45, HATCH_Z1);
  // люк для сена: перила с четырёх сторон
  railRun(HX - HW2 / 2, HX + HW2 / 2, HZ - HW2 / 2, HZ - HW2 / 2 + 0.1);
  railRun(HX - HW2 / 2, HX + HW2 / 2, HZ + HW2 / 2 - 0.1, HZ + HW2 / 2);
  railRun(HX - HW2 / 2, HX - HW2 / 2 + 0.1, HZ - HW2 / 2, HZ + HW2 / 2);
  railRun(HX + HW2 / 2 - 0.1, HX + HW2 / 2, HZ - HW2 / 2, HZ + HW2 / 2);

  /* ================================================================
   *  ВЕРТИКАЛЬНАЯ ЛЕСТНИЦА НА СЕНОВАЛ
   *
   *  Стоит у западной стены: две стойки, перекладины между ними,
   *  крюки в стену. Игрок подходит снизу, смотрит вверх и жмёт W —
   *  цепляется и поднимается; наверху перелезает на настил.
   * ================================================================ */
  {
    // стойки
    for (const lz of [LAD_Z0, LAD_Z1]) {
      B.put(frameKey, 0.14, loftY + 0.55, 0.16, LAD_X, (loftY + 0.55) / 2, lz, 1.2);
    }
    // перекладины
    const rungs = 15;
    for (let i = 0; i < rungs; i++) {
      const y = 0.22 + i * ((loftY + 0.15) / rungs);
      B.add(cyl(0.045, 0.045, LAD_Z1 - LAD_Z0, 7), 'timber',
        mat(LAD_X + 0.14, y, LAD_ZC, 0, Math.PI / 2));
    }
    // крюки в стену
    for (const y of [0.7, 2.0, 3.5]) {
      B.put('iron', 0.3, 0.09, 0.09, LAD_X - 0.2, y, LAD_ZC, 1);
      B.put('iron', 0.09, 0.09, LAD_Z1 - LAD_Z0 + 0.3, LAD_X - 0.34, y, LAD_ZC, 1);
    }
    // подставка у нижней стойки
    B.put(frameKey, 0.5, 0.14, LAD_Z1 - LAD_Z0 + 0.3, LAD_X + 0.22, 0.07, LAD_ZC, 1.2);
    // лестница — препятствие: пройти сквозь стойки нельзя
    colliders.boxes.push({
      cx: LAD_X + 0.02, cz: LAD_ZC, hx: 0.1, hz: (LAD_Z1 - LAD_Z0) / 2,
      ang: 0, y0: 0, y1: 1.0,
    });
    // зона подъёма
    climbs.push({
      x: LAD_HANG, z: LAD_ZC, r: 1.05,
      y0: 0, y1: loftY,
      exitX: HATCH_X1 + 0.42, exitZ: LAD_ZC,
    });
  }

  /* ---------------- ворота: закрытые створки ---------------- */
  // глухая зашивка за створками — чтобы не было видно белого света
  B.put('oakDoor', DOOR_W, DOOR_H, 0.08, 0, DOOR_H / 2, -hd + WALL / 2 + 0.16, 1.1);
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    const lb = new Builder();
    const lw = DOOR_W / 2 - 0.04, lh = DOOR_H - 0.12;
    lb.put('oakDoor', lw, lh, 0.13, s * lw / 2, lh / 2, 0, 1.1);
    // поперечные доски и обвязка
    lb.put('oakDoor', lw - 0.05, 0.14, 0.05, s * lw / 2, lh * 0.25, 0.075, 1.1);
    lb.put('oakDoor', lw - 0.05, 0.14, 0.05, s * lw / 2, lh * 0.75, 0.075, 1.1);
    // железные полосы
    for (const yy of [lh * 0.22, lh * 0.78]) {
      lb.put('iron', lw - 0.08, 0.12, 0.05, s * lw / 2, yy, 0.09, 1);
    }
    // петли
    for (const yy of [0.35, lh - 0.35]) {
      lb.put('iron', 0.1, 0.22, 0.09, s * 0.08, yy, 0.09, 1);
    }
    // кольцо-ручка
    lb.add(torus(0.09, 0.018, 5, 10), 'iron', mat(s * (lw - 0.12), lh * 0.5, 0.12, Math.PI / 2));
    const g = lb.build(M, null, { name: 'barnDoor' });
    leaf.add(g);
    leaf.position.set(s * (DOOR_W / 4), 0, -hd + WALL / 2);
    group.add(leaf);
    colliders.boxes.push({
      cx: s * (DOOR_W / 4), cz: -hd + WALL / 2, hx: DOOR_W / 4 - 0.03, hz: 0.12,
      ang: 0, y0: 0, y1: DOOR_H,
    });
  }
  // засов на створках
  B.put('iron', DOOR_W - 0.3, 0.1, 0.1, 0, DOOR_H - 0.55, -hd + WALL / 2 + 0.12, 1);

  /* ---------------- стены как препятствия ---------------- */
  colliders.boxes.push({ cx: 0, cz: hd - WALL / 2, hx: hw, hz: WALL / 2, ang: 0, y0: 0, y1: TOP });
  for (const sx of [-1, 1]) {
    colliders.boxes.push({
      cx: sx * (hw - WALL / 2), cz: 0, hx: WALL / 2, hz: hd, ang: 0, y0: 0, y1: TOP,
    });
  }
  for (const sx of [-1, 1]) {
    const w = (hw - DOOR_W / 2) / 2;
    colliders.boxes.push({
      cx: sx * (DOOR_W / 2 + w), cz: -hd + WALL / 2, hx: w, hz: WALL / 2, ang: 0, y0: 0, y1: TOP,
    });
  }

  /* ---------------- несущие стойки — тоже препятствия ----------------
   * Раньше сквозь стойки фахверка можно было пройти: они выглядели
   * как стены, а физически их не было. Теперь каждая стойка — коллайдер.
   * Стойка ровно посередине ворот не ставится: проём должен остаться
   * проходом, а не стеной.
   */
  for (const px of postXs) {
    for (const pz of [-hd + inset, hd - inset]) {
      const inGate = pz < 0 && Math.abs(px) < DOOR_W / 2;
      if (inGate) continue;
      colliders.boxes.push({
        cx: px, cz: pz, hx: post / 2 + 0.02, hz: post / 2 + 0.02,
        ang: 0, y0: BASE, y1: TOP,
      });
    }
  }
  for (const pz of postZs) {
    for (const px of [-hw + inset, hw - inset]) {
      colliders.boxes.push({
        cx: px, cz: pz, hx: post / 2 + 0.02, hz: post / 2 + 0.02,
        ang: 0, y0: BASE, y1: TOP,
      });
    }
  }

  /* ---------------- обшивка стен: вагонка и плинтус ----------------
   * Оштукатуренная стена с голым низом выглядит «бумажной». Деревянная
   * обшивка до уровня груди, плинтус и накладки на стойках превращают
   * амбар в настоящее хозяйственное помещение.
   */
  {
    const SK = 1.25;                 // высота обшивки от цоколя
    const bw = 0.26;                 // ширина доски
    const bt = 0.05;                 // толщина обшивки
    const yc = BASE + SK / 2;
    // южная стена (кроме ворот) и северная
    const runX = (x0, x1, z, dir) => {
      const n = Math.max(1, Math.round((x1 - x0) / (bw + 0.02)));
      const step = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const x = x0 + step * (i + 0.5);
        B.put('oakDoor', step - 0.02, SK, bt, x, yc, z + dir * (bt / 2 + 0.01), 1.4);
      }
    };
    const runZ = (z0, z1, x, dir) => {
      const n = Math.max(1, Math.round((z1 - z0) / (bw + 0.02)));
      const step = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const z = z0 + step * (i + 0.5);
        B.put('oakDoor', bt, SK, step - 0.02, x + dir * (bt / 2 + 0.01), yc, z, 1.4);
      }
    };
    // сдвиг всегда ВНУТРЬ помещения, иначе обшивка уходит в стену
    runX(-hw + WALL, -DOOR_W / 2, -hd + WALL / 2, 1);
    runX(DOOR_W / 2, hw - WALL, -hd + WALL / 2, 1);
    runX(-hw + WALL, hw - WALL, hd - WALL / 2, -1);
    runZ(-hd + WALL, hd - WALL, -hw + WALL / 2, 1);
    runZ(-hd + WALL, hd - WALL, hw - WALL / 2, -1);
    // плинтус по периметру
    B.put('timber', W - WALL, 0.14, 0.12, 0, BASE + 0.07, -hd + WALL / 2 + 0.06, 1.2);
    B.put('timber', W - WALL, 0.14, 0.12, 0, BASE + 0.07, hd - WALL / 2 - 0.06, 1.2);
    for (const sx of [-1, 1]) {
      B.put('timber', 0.12, 0.14, D - WALL, sx * (hw - WALL / 2 - sx * 0.06), BASE + 0.07, 0, 1.2);
    }
    // верхняя обвязка обшивки — тонкая доска поверх шва
    for (const [x, z, w, d] of [
      [0, -hd + WALL / 2 + 0.04, W - WALL, 0.1], [0, hd - WALL / 2 - 0.04, W - WALL, 0.1],
      [-hw + WALL / 2 + 0.04, 0, 0.1, D - WALL], [hw - WALL / 2 - 0.04, 0, 0.1, D - WALL],
    ]) {
      B.put('timber', w, 0.09, d, x, BASE + SK + 0.04, z, 1.2);
    }
  }

  /* ---------------- накладки на стойки и заклёпки ---------------- */
  {
    // накладка на лицевой стороне стойки: стойка выглядит как настоящая балка
    const faces = [];
    for (const px of postXs) for (const pz of [-hd + inset, hd - inset]) faces.push([px, pz, 'z']);
    for (const pz of postZs) for (const px of [-hw + inset, hw - inset]) faces.push([px, pz, 'x']);
    for (const [px, pz, axis] of faces) {
      const inGate = pz < 0 && Math.abs(px) < DOOR_W / 2 && axis === 'z';
      const h = TOP - BASE;
      const y0 = BASE;
      if (axis === 'z') {
        B.put('timber', post + 0.1, h, 0.06, px, y0 + h / 2, pz, 1.2);
      } else {
        B.put('timber', 0.06, h, post + 0.1, px, y0 + h / 2, pz, 1.2);
      }
      // заклёпки-скобы через равные промежутки
      for (let y = y0 + 0.45; y < y0 + h - 0.2; y += 1.55) {
        if (axis === 'z') {
          B.add(cyl(0.035, 0.035, 0.05, 6), 'iron',
            mat(px, y, pz + post / 2 + 0.09, Math.PI / 2, 0, 0));
          B.add(cyl(0.035, 0.035, 0.05, 6), 'iron',
            mat(px, y, pz - post / 2 - 0.09, Math.PI / 2, 0, 0));
        } else {
          B.add(cyl(0.035, 0.035, 0.05, 6), 'iron',
            mat(px + post / 2 + 0.09, y, pz, 0, 0, Math.PI / 2));
          B.add(cyl(0.035, 0.035, 0.05, 6), 'iron',
            mat(px - post / 2 - 0.09, y, pz, 0, 0, Math.PI / 2));
        }
      }
    }
  }

  /* ---------------- загон для скота ----------------
   * Отдельная перегородка в углу: стенки из досок на стойках, проём
   * для входа и кормушка внутри. Это настоящая преграда — сквозь
   * стенку загона пройти нельзя, только через проём.
   */
  {
    const X0 = 1.3, X1 = 4.1, Z0 = 0.5, Z1 = 3.1;
    const PH = 1.45;                       // высота перегородки
    const GATE_X0 = 2.35, GATE_X1 = 3.25;  // проём для входа

    // доски перегородки с зазором между ними
    const plankRun = (x0, x1, z, axis) => {
      const len = x1 - x0;
      const n = Math.max(1, Math.round(len / 0.28));
      const step = len / n;
      for (let i = 0; i < n; i++) {
        const c = x0 + step * (i + 0.5);
        if (axis === 'x') {
          B.put('plank', step - 0.06, PH - 0.18, 0.07, c, PH / 2, z, 1.3);
        } else {
          B.put('plank', 0.07, PH - 0.18, step - 0.06, z, PH / 2, c, 1.3);
        }
      }
    };
    // западная стенка загона (сплошная)
    plankRun(Z0, Z1, X0, 'z');
    // северная стенка (сплошная)
    plankRun(X0, X1, Z1, 'x');
    // южная стенка — с проёмом
    plankRun(X0, GATE_X0, Z0, 'x');
    plankRun(GATE_X1, X1, Z0, 'x');
    // стойки перегородки
    const stanchions = [
      [X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1], [GATE_X0, Z0], [GATE_X1, Z0],
    ];
    for (const [sx, sz] of stanchions) {
      B.put(frameKey, 0.16, PH + 0.12, 0.16, sx, (PH + 0.12) / 2, sz, 1.2);
    }
    // верхняя обвязка перегородок + средний брусок
    B.put(frameKey, X1 - X0 + 0.16, 0.14, 0.16, (X0 + X1) / 2, PH + 0.06, Z0, 1.2);
    B.put(frameKey, 0.16, 0.14, Z1 - Z0, X0, PH + 0.06, (Z0 + Z1) / 2, 1.2);
    B.put(frameKey, X1 - X0 + 0.16, 0.14, 0.16, (X0 + X1) / 2, PH + 0.06, Z1, 1.2);
    B.put('timber', X1 - X0 + 0.16, 0.11, 0.13, (X0 + X1) / 2, PH * 0.52, Z0, 1.2);
    B.put('timber', 0.13, 0.11, Z1 - Z0, X0, PH * 0.52, (Z0 + Z1) / 2, 1.2);
    // солома на полу загона — видно, что это стойло для скота
    B.put('hay', X1 - X0 - 0.3, 0.07, Z1 - Z0 - 0.3, (X0 + X1) / 2, 0.06, (Z0 + Z1) / 2, 1.6);
    // проём: косяки и перекладина
    for (const gx of [GATE_X0, GATE_X1]) {
      B.put(frameKey, 0.14, PH, 0.2, gx, PH / 2, Z0, 1.2);
    }
    B.put(frameKey, GATE_X1 - GATE_X0 + 0.14, 0.14, 0.2, (GATE_X0 + GATE_X1) / 2, PH - 0.07, Z0, 1.2);
    // коллайдеры перегородок (проём остаётся проходом)
    colliders.boxes.push({ cx: X0, cz: (Z0 + Z1) / 2, hx: 0.1, hz: (Z1 - Z0) / 2, ang: 0, y0: 0, y1: PH });
    colliders.boxes.push({ cx: (X0 + X1) / 2, cz: Z1, hx: (X1 - X0) / 2, hz: 0.1, ang: 0, y0: 0, y1: PH });
    colliders.boxes.push({
      cx: (X0 + GATE_X0) / 2, cz: Z0, hx: (GATE_X0 - X0) / 2, hz: 0.1, ang: 0, y0: 0, y1: PH,
    });
    colliders.boxes.push({
      cx: (GATE_X1 + X1) / 2, cz: Z0, hx: (X1 - GATE_X1) / 2, hz: 0.1, ang: 0, y0: 0, y1: PH,
    });
    // кормушка и поилка внутри загона
    B.put('oakDoor', 1.6, 0.42, 0.5, (X0 + X1) / 2 - 0.2, 0.5, Z1 - 0.42, 1.4);
    B.put('timber', 1.7, 0.1, 0.6, (X0 + X1) / 2 - 0.2, 0.26, Z1 - 0.42, 1.2);
    B.add(cyl(0.34, 0.28, 0.3, 12), 'oakDoor', mat(X1 - 0.55, 0.15, Z0 + 0.65));
    B.add(cyl(0.3, 0.3, 0.05, 12), 'hay', mat(X1 - 0.55, 0.3, Z0 + 0.65));
    colliders.boxes.push({
      cx: (X0 + X1) / 2 - 0.2, cz: Z1 - 0.42, hx: 0.85, hz: 0.3, ang: 0, y0: 0, y1: 0.75,
    });
    colliders.circles.push({ x: X1 - 0.55, z: Z0 + 0.65, r: 0.36, y0: 0, y1: 0.6 });
  }

  /* ---------------- крыша ---------------- */
  const shell = roofShell(W, D, 2.5, { overhang: 0.55, thickness: 0.24, scale: 1.8 });
  for (const g of shell.outer) B.add(g, 'thatch', mat(0, TOP - 0.03, 0));
  for (const g of shell.inner) B.add(g, 'plank', mat(0, TOP - 0.03, 0));
  for (const g of shell.edges) B.add(g, 'thatch', mat(0, TOP - 0.03, 0));
  B.put(frameKey, W + 1.2, 0.22, 0.26, 0, TOP + 2.42, 0, 1.2);

  /* ---------------- верстак и инструмент ---------------- */
  const bx = hw - 1.5, bz = -hd + 1.0;
  B.put(frameKey, 2.0, 0.14, 0.8, bx, 0.92, bz, 1.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put(frameKey, 0.14, 0.9, 0.14, bx + sx * 0.85, 0.45, bz + sz * 0.3, 1);
  }
  // верстак — настоящее препятствие
  colliders.boxes.push({ cx: bx, cz: bz, hx: 1.05, hz: 0.45, ang: 0, y0: 0, y1: 1.0 });
  // вилы на стене
  for (const [tx, tz, rot] of [[hw - 0.25, 1.2, 0.12], [hw - 0.25, 2.1, -0.08], [hw - 0.25, 3.0, 0.05]]) {
    B.add(cyl(0.035, 0.035, 1.7, 6), frameKey, mat(tx, 1.6, tz, 0, 0, rot));
    for (let i = -1; i <= 1; i++) {
      B.add(cyl(0.018, 0.018, 0.34, 5), 'iron',
        mat(tx - 0.1 * Math.cos(rot) + i * 0.09, 2.42, tz + i * 0.09 * Math.sin(rot), 0, 0, rot));
    }
  }
  // лопата
  B.add(cyl(0.035, 0.035, 1.5, 6), frameKey, mat(-hw + 0.3, 1.5, 3.2, 0, 0, 0.1));
  B.add(box(0.3, 0.36, 0.05), 'iron', mat(-hw + 0.3, 0.55, 3.22));
  // метла у стены
  B.add(cyl(0.03, 0.03, 1.4, 6), frameKey, mat(-hw + 0.3, 1.4, 3.6, 0, 0, -0.08));
  B.add(box(0.28, 0.22, 0.09), 'hay', mat(-hw + 0.3, 0.62, 3.66));

  group.add(B.build(M, null, { name: 'barnShell' }));

  /* ---------------- хлам и повозки внутри ---------------- */
  const items = [];
  const rng = (() => { let s = 20250112; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const push = (t, x, z, ry = rng() * Math.PI * 2, sc = 0.9 + rng() * 0.25) => {
    items.push({ t, x, z, ry, s: sc });
    colliders.circles.push({ x, z, r: ({ barrel: 0.44, crate: 0.46, logs: 0.62, sack: 0.34, bucket: 0.24 }[t] || 0.4) * sc, y0: 0, y1: 1.2 });
  };
  // бочки — только у восточной стены: проход к лестнице у западной стены
  // должен быть совершенно свободным
  for (let i = 0; i < 4; i++) push('barrel', 2.9 + i * 0.85, -hd + 0.95, rng() * 3);
  for (let i = 0; i < 2; i++) push('barrel', hw - 0.95, -2.4 + i * 0.9, rng() * 3);
  // ящики у задней стены
  for (let i = 0; i < 4; i++) push('crate', -2.4 + (i % 2) * 0.78, hd - 1.05 - Math.floor(i / 2) * 0.78, 0.05 + rng() * 0.15);
  for (let i = 0; i < 3; i++) push('crate', 1.2 + (i % 2) * 0.78, hd - 1.05 - Math.floor(i / 2) * 0.78, -0.05 + rng() * 0.1);
  // мешки у правой стены
  for (let i = 0; i < 5; i++) push('sack', hw - 1.05, 1.3 + Math.floor(i / 2) * 0.6, rng() * 3);
  // поленья в дальнем правом углу (лестница слева должна остаться свободной)
  for (let i = 0; i < 3; i++) push('logs', hw - 1.15, hd - 1.05 - i * 0.62, 0.2 + rng() * 0.3);
  // вёдра у ворот
  for (let i = 0; i < 3; i++) push('bucket', -1.9 + i * 0.55, -hd + 0.75, rng() * 3);
  group.add(clutter(M, items));

  // рулоны сена на сеновале
  const hay = new Builder();
  for (let i = 0; i < 5; i++) {
    const hx = 2.6 + (i % 3) * 1.05, hy = loftY + 0.44 + Math.floor(i / 3) * 0.84;
    const hz = -hd + 1.1 + (i % 2) * 1.2;
    hay.add(box(1.5, 0.8, 0.9, 1), 'hay', mat(hx, hy, hz, 0.04 * i));
    hay.add(box(1.55, 0.06, 0.95, 1), 'rope', mat(hx, hy, hz, 0.04 * i));
  }
  group.add(hay.build(M, null, { name: 'barnHay' }));
  for (let i = 0; i < 5; i++) {
    colliders.circles.push({
      x: 2.6 + (i % 3) * 1.05, z: -hd + 1.1 + (i % 2) * 1.2,
      r: 0.62, y0: loftY, y1: loftY + 1.7,
    });
  }

  // повозки — теперь стоят внутри, у дальней стены
  const cartPos = [{ x: -2.9, z: 2.7, ry: 0.35 }, { x: 4.4, z: 2.5, ry: -0.8 }];
  for (const c of cartPos) {
    group.add(cart(M, c));
    colliders.circles.push({ x: c.x, z: c.z, r: 1.3, y0: 0, y1: 1.6 });
  }

  /* ================================================================
   *  СВЕТ
   * ================================================================ */
  const lights = {};
  lights.hemi = new THREE.HemisphereLight(0xbfd4e8, 0x6a5038, 0.85);
  group.add(lights.hemi);
  lights.ambient = new THREE.AmbientLight(0xffffff, 0.45);
  group.add(lights.ambient);
  // солнечный луч через большое окно задней стены
  lights.sun = new THREE.DirectionalLight(0xffe3b4, 1.4);
  lights.sun.position.set(0, 8, 11);
  lights.sun.target.position.set(0, 0.4, 0);
  group.add(lights.sun, lights.sun.target);
  // луч через люк сеновала
  lights.shaft = new THREE.DirectionalLight(0xffe8c4, 0.8);
  lights.shaft.position.set(3, 9, -2);
  lights.shaft.target.position.set(HX, 0, HZ);
  group.add(lights.shaft, lights.shaft.target);
  // мягкая заливка от проёмов
  lights.fill = new THREE.PointLight(0xcfe0ff, 0.8, 16, 1.6);
  lights.fill.position.set(0, 2.4, hd - 1.2);
  group.add(lights.fill);
  // тёплый отскок от пола
  lights.bounce = new THREE.PointLight(0xffd6a2, 0.5, 15, 1.8);
  lights.bounce.position.set(-0.4, 0.85, 0.8);
  group.add(lights.bounce);
  // холодный отсвет от боковых окон
  lights.back = new THREE.PointLight(0xbcd4f0, 0.35, 13, 1.8);
  lights.back.position.set(-hw + 1.2, 2.9, 0.2);
  group.add(lights.back);
  // фонари под потолком
  lights.lamps = [];
  for (const [lx, lz] of [[-2.6, -2.2], [2.6, 1.6], [-2.2, 2.4], [3.2, -2.4]]) {
    const l = new THREE.PointLight(0xffb45a, 0, 17, 1.9);
    l.position.set(lx, loftY - 0.55, lz);
    group.add(l);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false,
    }));
    glow.scale.set(1.5, 1.5, 1);
    glow.position.copy(l.position);
    group.add(glow);
    // подвес
    const hang = new Builder();
    hang.add(cyl(0.018, 0.018, 0.5, 5), 'iron', mat(lx, loftY - 0.25, lz));
    hang.add(cyl(0.15, 0.19, 0.22, 8), 'iron', mat(lx, loftY - 0.62, lz));
    group.add(hang.build(M, null, { name: 'barnLamp' }));
    lights.lamps.push({ l, glow, base: 4.6, flicker: Math.random() * 10 });
  }

  // световые столбы (полупрозрачные, с мягким затуханием)
  const shaftCanvas = document.createElement('canvas');
  shaftCanvas.width = 32; shaftCanvas.height = 128;
  const sc2 = shaftCanvas.getContext('2d');
  const sgrd = sc2.createLinearGradient(0, 0, 0, 128);
  sgrd.addColorStop(0, '#ffffff');
  sgrd.addColorStop(0.45, '#6a6a6a');
  sgrd.addColorStop(1, '#000000');
  sc2.fillStyle = sgrd; sc2.fillRect(0, 0, 32, 128);
  const shaftTex = new THREE.CanvasTexture(shaftCanvas);
  const shaftMat = new THREE.MeshBasicMaterial({
    color: 0xffe6bd, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide,
    alphaMap: shaftTex, blending: THREE.AdditiveBlending,
  });
  lights.shafts = [];
  {
    // луч из люка сеновала на пол
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.6), shaftMat);
    g.position.set(HX + 0.1, loftY - 1.7, HZ - 0.1);
    g.rotation.y = 0.35;
    g.rotation.z = 0.28;
    group.add(g);
    lights.shafts.push(g);
  }

  /* ---------------- точки входа/выхода ---------------- */
  const spawn = { x: 0, z: -hd + 1.6, yaw: Math.PI };       // внутри у ворот
  const exitDoor = { x: 0, z: -hd + 1.2 };                    // дверь для выхода

  return {
    group, colliders, platforms, climbs, lights,
    spawn, exitDoor,
    /** Освещение интерьера — по часам основной локации (env). */
    update(dt, env, t) {
      const lamps = env.lampBoost ?? 0.3;
      const sun = env.sunIntensity ?? 2;
      const night = env.stars ?? 0;
      const col = env.sun ? env.sun.color.getHex() : 0xffe3b4;
      lights.sun.color.setHex(col);
      lights.sun.intensity = 0.4 + sun * 0.9;
      lights.shaft.color.setHex(col);
      lights.shaft.intensity = 0.25 + sun * 0.55;
      if (env.ambient) lights.ambient.color.copy(env.ambient.color);
      lights.ambient.intensity = 0.5 + (env.ambientIntensity ?? 0.3) * 0.9;
      lights.hemi.intensity = 0.62 + (env.hemiIntensity ?? 1) * 0.55;
      lights.fill.intensity = 0.4 + sun * 0.3 + (1 - night) * 0.5;
      lights.bounce.intensity = 0.25 + sun * 0.3 + (1 - night) * 0.22;
      lights.bounce.color.setHex(col);
      lights.back.intensity = 0.15 + sun * 0.22 + (1 - night) * 0.2;
      for (const lamp of lights.lamps) {
        const f = 0.86 + Math.sin(t * 7.3 + lamp.flicker) * 0.08 + Math.sin(t * 19.7 + lamp.flicker) * 0.05;
        lamp.l.intensity = lamps * lamp.base * f;
        lamp.glow.material.opacity = 0.42 * f * Math.min(1, lamps * 1.1);
        lamp.glow.scale.setScalar(1.2 + f * 0.4);
      }
      for (const s of lights.shafts) {
        s.material.opacity = 0.035 + Math.max(0, 0.1 - night * 0.1) * (0.35 + sun * 0.22);
        s.material.color.setHex(col);
      }
    },
  };
}

export const BARN_SIZE = { W, D, H1, H2 };
