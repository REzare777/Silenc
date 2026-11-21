/**
 * ============================================================================
 *  Плотный лес вокруг деревни
 * ============================================================================
 *
 *  Лес — не «деревья на лужайке», а плотная стена зелени: он окружает
 *  деревню кольцом примерно с 46 метров и полностью закрывает дальний
 *  обзор, поэтому скала с входом в подземелье (около 100 м от центра)
 *  не видна с улицы.
 *
 *  Как это устроено:
 *   • точки деревьев раскладываются по зонам плотности (опушка → чаща →
 *     средний лес → дальний силуэт);
 *   • каждое дерево — это инстанс ствола и инстанс кроны, поэтому даже
 *     несколько тысяч деревьев рисуются за десяток draw-call-ов;
 *   • подлесок (кусты, папоротник, грибы, камни, пни, брёвна) рисуется
 *     так же — инстансами;
 *   • под деревьями лежит своя тёмная подстилка (кольцо с текстурой
 *     мха и прелой листвы), чтобы граница леса читалась.
 *
 *  Модуль ничего не знает про деревню: на вход подаётся генератор
 *  случайных чисел и список «дыр» в лесу (дороги, тропа к пещере).
 *
 *  @module world/forest
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cyl, sphere, cone, box } from './geo.js';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ *
 *  Зоны леса
 * ------------------------------------------------------------------ */

/**
 * Кольцо леса вокруг деревни.
 *
 * `from`/`to` — радиус от центра деревни в метрах, `step` — средняя
 * площадь на одно дерево (меньше → гуще), `h` — диапазон высоты деревьев.
 *
 * @type {{from:number,to:number,step:number,h:[number,number],mix:string[]}[]}
 */
export const FOREST_ZONES = [
  // опушка — редкие высокие деревья, граница поля и леса
  { from: 44, to: 58, step: 42, h: [9, 14], mix: ['oak', 'birch', 'aspen'] },
  // чаща — самая густая часть, именно она прячет скалу подземелья
  { from: 58, to: 104, step: 12, h: [11, 18], mix: ['pine', 'spruce', 'oak', 'birch'] },
  // средний лес
  { from: 104, to: 168, step: 42, h: [10, 16], mix: ['pine', 'spruce', 'oak', 'aspen'] },
  // дальние силуэты — лес уходит за горизонт
  { from: 168, to: 250, step: 150, h: [11, 17], mix: ['pine', 'spruce'] },
];

/* ------------------------------------------------------------------ *
 *  Геометрия пород
 * ------------------------------------------------------------------ */

/** Ствол с лёгким расширением книзу и парой сучков. */
function trunkGeo(rBot, rTop, h, seg = 7) {
  const parts = [];
  const t = cyl(rTop, rBot, h, seg);
  t.translate(0, h / 2, 0);
  parts.push(t);
  // обломки ветвей на стволе — тонкие, чтобы не читались как «шишки»
  for (let i = 0; i < 3; i++) {
    const y = h * (0.38 + i * 0.16);
    const br = cyl(rTop * 0.16, rTop * 0.26, h * 0.09, 4);
    br.rotateZ(Math.PI / 2 - 0.25);
    br.translate(rBot * 0.55, y, 0);
    parts.push(br);
  }
  return mergeGeometries(parts, false);
}

/** Крона из нескольких шаров — для дуба, берёзы и осины. */
function crownBlobGeo(blobs) {
  const parts = blobs.map(([x, y, z, r]) => {
    const g = sphere(r, 7, 5);
    // крона чуть шире геометрии-шара — чтобы в лесу не было просветов
    g.scale(1.24, 0.9, 1.16);
    g.translate(x, y, z);
    return g;
  });
  return mergeGeometries(parts, false);
}

/** Хвойная крона — ярусы конусов. */
function crownConeGeo(tiers) {
  const parts = [];
  for (const [r, h, y] of tiers) {
    const g = cone(r, h, 8);
    g.translate(0, y + h / 2, 0);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

/**
 * Набор геометрий породы: ствол, крона и материалы.
 *
 * @param {string} type порода
 * @returns {{trunk:THREE.BufferGeometry, crown:THREE.BufferGeometry, trunkMat:string, crownMat:string}}
 */
export function speciesGeometry(type) {
  switch (type) {
    case 'pine': {
      // высокая прямая сосна: ярусы конусов сильно перекрываются,
      // иначе крона выглядит «лесенкой»
      const trunk = trunkGeo(0.42, 0.16, 9.5);
      const crown = crownConeGeo([
        [2.5, 3.6, 2.6], [2.25, 3.6, 4.6], [1.95, 3.5, 6.5],
        [1.6, 3.4, 8.4], [1.2, 3.2, 10.2], [0.75, 2.8, 12.0], [0.35, 2.2, 13.6],
      ]);
      return { trunk, crown, trunkMat: 'bark', crownMat: 'leafPine' };
    }
    case 'spruce': {
      // ель: ровный конус, ярусы плотнее
      const trunk = trunkGeo(0.34, 0.12, 7.0);
      const crown = crownConeGeo([
        [2.1, 3.0, 1.8], [2.35, 3.1, 3.7], [2.2, 3.1, 5.6], [1.95, 3.0, 7.4],
        [1.6, 2.9, 9.1], [1.2, 2.7, 10.7], [0.78, 2.4, 12.2], [0.4, 1.9, 13.5],
      ]);
      return { trunk, crown, trunkMat: 'bark', crownMat: 'leafPine' };
    }
    case 'oak': {
      // дуб: коренастый ствол, раскидистая крона из крупных и мелких шаров
      const trunk = trunkGeo(0.5, 0.26, 5.2);
      const crown = crownBlobGeo([
        [0, 6.2, 0, 2.4], [1.7, 5.2, 0.6, 1.6], [-1.6, 5.4, -0.5, 1.65],
        [0.6, 7.4, -0.4, 1.4], [-0.5, 4.4, 1.4, 1.3], [1.0, 4.2, -1.5, 1.2],
        [2.1, 6.4, 1.1, 0.95], [-2.2, 6.1, -0.9, 0.9], [0.2, 8.3, 0.9, 0.85],
        [-1.1, 7.9, 1.3, 0.8], [1.6, 8.0, -1.2, 0.75], [-0.4, 5.6, 2.1, 0.8],
      ]);
      return { trunk, crown, trunkMat: 'bark', crownMat: 'leaf' };
    }
    case 'birch': {
      // берёза: тонкий светлый ствол, крона выше и легче
      const trunk = trunkGeo(0.26, 0.16, 8.0);
      const crown = crownBlobGeo([
        [0, 9.0, 0, 1.85], [1.05, 8.1, 0.4, 1.2], [-0.95, 8.3, -0.35, 1.15],
        [0.2, 10.2, -0.2, 1.05], [-0.3, 7.2, 0.9, 0.95],
        [1.5, 9.4, -0.8, 0.7], [-1.4, 9.8, 0.6, 0.68], [0.5, 11.0, 0.4, 0.6],
      ]);
      return { trunk, crown, trunkMat: 'barkBirch', crownMat: 'leaf' };
    }
    default: {
      // осина: ровный высокий ствол и светлая крона
      const trunk = trunkGeo(0.32, 0.18, 7.6);
      const crown = crownBlobGeo([
        [0, 8.6, 0, 1.7], [0.95, 7.8, 0.35, 1.15], [-0.9, 8.0, -0.3, 1.1], [0.15, 9.8, -0.15, 1.0],
        [1.4, 9.2, 0.8, 0.65], [-1.3, 9.4, -0.6, 0.62], [0.2, 10.6, 0.3, 0.58],
      ]);
      return { trunk, crown, trunkMat: 'bark', crownMat: 'leaf' };
    }
  }
}

/* ------------------------------------------------------------------ *
 *  Инстансы
 * ------------------------------------------------------------------ */

/**
 * Размер чанка леса в метрах.
 *
 * Лес — это почти шестнадцать тысяч инстансов. Если держать их в нескольких
 * огромных мешах, каждый кадр рисуется весь лес целиком — дважды (ещё и в
 * карту теней). Поэтому лес режется на чанки: дальние отсекаются камерой,
 * а совсем дальние — ещё и по расстоянию (в тумане их не видно).
 */
const CHUNK = 72;

/**
 * Создаёт InstancedMesh по списку записей {x,z,s,r,tilt}.
 *
 * Записи раскладываются по чанкам: на каждый — свой InstancedMesh с
 * посчитанными габаритами, поэтому frustumCulled работает по-настоящему.
 *
 * @param {THREE.BufferGeometry} geo геометрия
 * @param {THREE.Material} material материал
 * @param {object[]} list список записей
 * @param {string} name имя меша
 * @param {THREE.Group} group куда добавлять чанки
 * @param {{x:number,z:number}[]} [chunks] список чанков для отсечения по расстоянию
 */
function instanced(geo, material, list, name, group, chunks, out) {
  const buckets = new Map();
  for (const t of list) {
    const key = `${Math.floor(t.x / CHUNK)},${Math.floor(t.z / CHUNK)}`;
    let b = buckets.get(key);
    if (!b) { b = []; buckets.set(key, b); }
    b.push(t);
  }
  const dummy = new THREE.Object3D();
  for (const [key, items] of buckets) {
    const im = new THREE.InstancedMesh(geo, material, items.length);
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      dummy.position.set(t.x, t.y || 0, t.z);
      dummy.rotation.set(t.tiltX || 0, t.r || 0, t.tiltZ || 0);
      dummy.scale.set(t.sx || t.s, t.sy || t.s, t.sz || t.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = `${name}#${key}`;
    im.frustumCulled = true;
    im.computeBoundingSphere();       // габариты — по матрицам инстансов
    group.add(im);
    if (out) out.push(im);            // ссылка на меш — для подмены материала
    if (chunks) {
      let cx = 0, cz = 0;
      for (const t of items) { cx += t.x; cz += t.z; }
      chunks.push({ mesh: im, x: cx / items.length, z: cz / items.length });
    }
  }
}

/**
 * Отключает чанки леса, которые всё равно не видно (туман, расстояние).
 *
 * @param {{mesh:THREE.Object3D,x:number,z:number}[]} chunks чанки
 * @param {{x:number,z:number}} pos где стоит игрок
 * @param {number} maxDist до скольких метров тянуть лес
 */
export function setForestRange(chunks, pos, maxDist = 185) {
  if (!chunks) return;
  for (const c of chunks) {
    const dx = c.x - pos.x, dz = c.z - pos.z;
    c.mesh.visible = dx * dx + dz * dz < maxDist * maxDist;
  }
}

/* ------------------------------------------------------------------ *
 *  Главный построитель леса
 * ------------------------------------------------------------------ */

/**
 * Строит плотный лес.
 *
 * @param {object} M набор материалов
 * @param {() => number} rng генератор случайных чисел
 * @param {object} [opts] настройки
 * @param {[number,number]} [opts.center] центр деревни
 * @param {number} [opts.inner] внутренний радиус леса
 * @param {(x:number,z:number)=>boolean} [opts.keepClear] функция «здесь нельзя сажать»
 * @returns {{group:THREE.Group, trees:object[], bushes:number}} группа и список деревьев
 */
export function denseForest(M, rng, opts = {}) {
  const { center = [0, 0], inner = 44, keepClear = null } = opts;
  const [cx, cz] = center;
  const group = new THREE.Group();
  group.name = 'forest';

  /* --- точки деревьев --- */
  const trees = [];
  const species = { pine: [], spruce: [], oak: [], birch: [], aspen: [] };

  for (const zone of FOREST_ZONES) {
    const from = Math.max(zone.from, inner);
    const area = Math.PI * (zone.to * zone.to - from * from);
    const count = Math.max(12, Math.round(area / zone.step));
    for (let i = 0; i < count; i++) {
      // равномерное распределение по кольцу (равномерно по площади)
      const a = rng() * TAU;
      const r = Math.sqrt(lerpN(from * from, zone.to * zone.to, rng()));
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (keepClear && keepClear(x, z)) continue;

      const type = zone.mix[Math.floor(rng() * zone.mix.length)];
      const h = lerpN(zone.h[0], zone.h[1], rng());
      const s = h / 13;                       // масштаб от «взрослого» дерева
      const tilt = (rng() - 0.5) * 0.09;
      const t = {
        x, z, type, s, r: rng() * TAU,
        tiltX: tilt, tiltZ: (rng() - 0.5) * 0.09,
        // осенью желтеет только листва — хвоя всегда зелёная
        autumn: (type === 'oak' || type === 'birch' || type === 'aspen') && rng() > 0.82,
      };
      trees.push(t);
      species[type].push(t);
    }
  }

  /* --- стволы и кроны --- */
  const chunks = [];
  // Кроны лиственных пород и хвои держатся отдельно: по сезону календарь
  // меняет их материал (зелёная листва → осенняя → зимняя), а хвоя
  // остаётся зелёной круглый год.
  const deciduousFoliage = [];
  const pineCrowns = [];
  for (const [type, list] of Object.entries(species)) {
    if (!list.length) continue;
    const g = speciesGeometry(type);
    const trunkKey = g.trunkMat;
    const isPine = g.crownMat === 'leafPine';

    const crownMeshes = [];
    instanced(g.trunk, M[trunkKey], list, `forestTrunk_${type}`, group, chunks);
    instanced(g.crown, M[g.crownMat], list, `forestCrown_${type}`, group, chunks, crownMeshes);
    if (isPine) pineCrowns.push(...crownMeshes);
    else deciduousFoliage.push(...crownMeshes);
  }

  /* --- подлесок: кусты --- */
  const bushes = [];
  for (let i = 0; i < 3200; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(lerpN(inner * inner, 190 * 190, rng()));
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (keepClear && keepClear(x, z)) continue;
    bushes.push({ x, z, s: 0.7 + rng() * 1.1, r: rng() * TAU, y: 0 });
  }
  const bushGeo = crownBlobGeo([
    [0, 0.62, 0, 0.72], [0.5, 0.45, 0.2, 0.5], [-0.45, 0.48, -0.25, 0.46], [0.05, 0.95, -0.1, 0.4],
  ]);
  const bushMeshes = [];
  instanced(bushGeo, M.leaf, bushes, 'forestBushes', group, chunks, bushMeshes);
  deciduousFoliage.push(...bushMeshes);

  /* --- подлесок: папоротник и трава --- */
  const ferns = [];
  for (let i = 0; i < 2600; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(lerpN(inner * inner, 170 * 170, rng()));
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (keepClear && keepClear(x, z)) continue;
    ferns.push({ x, z, s: 1.2 + rng() * 1.6, r: rng() * TAU, y: 0 });
  }
  const fernGeo = (() => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      // низкий плоский лист у земли, а не «звезда» на палочке
      const leaf = cone(0.2, 0.62, 4);
      leaf.scale(1.5, 0.42, 1);
      leaf.rotateX(1.32);
      leaf.rotateY(a);
      leaf.translate(Math.cos(a) * 0.22, 0.16, Math.sin(a) * 0.22);
      parts.push(leaf);
    }
    return mergeGeometries(parts, false);
  })();
  const fernMeshes = [];
  instanced(fernGeo, M.leaf, ferns, 'forestFerns', group, chunks, fernMeshes);
  deciduousFoliage.push(...fernMeshes);

  /* --- подлесок: мшистые камни --- */
  const rocks = [];
  for (let i = 0; i < 520; i++) {
    const a = rng() * TAU;
    const r = Math.sqrt(lerpN(inner * inner, 210 * 210, rng()));
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (keepClear && keepClear(x, z)) continue;
    rocks.push({ x, z, s: 0.5 + rng() * 1.5, r: rng() * TAU, y: 0.05 });
  }
  const rockGeo = (() => {
    const g = sphere(0.5, 6, 4);
    g.scale(1.25, 0.62, 1.05);
    g.translate(0, 0.1, 0);
    return g;
  })();
  instanced(rockGeo, M.stoneDark, rocks, 'forestRocks', group, chunks);

  /* --- подлесок: пни и упавшие стволы --- */
  const stumps = new THREE.Group();
  stumps.name = 'forestStumps';
  for (let i = 0; i < 70; i++) {
    const a = rng() * TAU;
    const r = inner + 6 + rng() * 120;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (keepClear && keepClear(x, z)) continue;
    const h = 0.5 + rng() * 1.1, rad = 0.24 + rng() * 0.18;
    const g = cyl(rad * 0.9, rad, h, 7);
    g.translate(x, h / 2, z);
    const m = new THREE.Mesh(g, M.bark);
    m.castShadow = true; m.receiveShadow = true;
    stumps.add(m);
  }
  for (let i = 0; i < 46; i++) {
    const a = rng() * TAU;
    const r = inner + 10 + rng() * 120;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (keepClear && keepClear(x, z)) continue;
    const len = 3 + rng() * 6, rad = 0.22 + rng() * 0.2;
    const g = cyl(rad, rad * 0.8, len, 7);
    g.rotateZ(Math.PI / 2);
    g.translate(x, rad * 0.9, z);
    const m = new THREE.Mesh(g, M.bark);
    m.rotation.y = rng() * TAU;
    m.castShadow = true; m.receiveShadow = true;
    stumps.add(m);
  }
  group.add(stumps);

  /* --- подлесок: грибы у берёз --- */
  const mushrooms = [];
  for (const t of species.birch.concat(species.oak)) {
    if (rng() > 0.22) continue;
    const a = rng() * TAU, rr = 0.7 + rng() * 2.2;
    mushrooms.push({ x: t.x + Math.cos(a) * rr, z: t.z + Math.sin(a) * rr, s: 0.7 + rng() * 0.9, r: rng() * TAU, y: 0 });
  }
  if (mushrooms.length) {
    const mushGeo = (() => {
      const cap = sphere(0.24, 7, 4);
      cap.scale(1, 0.62, 1);
      cap.translate(0, 0.26, 0);
      const stem = cyl(0.07, 0.09, 0.3, 6);
      stem.translate(0, 0.15, 0);
      return mergeGeometries([cap, stem], false);
    })();
    instanced(mushGeo, M.fabric, mushrooms, 'forestMushrooms', group, chunks);
  }

  /* --- подстилка: тёмное кольцо под лесом --- */
  const floor = new THREE.Mesh(
    new THREE.RingGeometry(inner - 1.5, 252, 96, 6),
    M.forestFloor,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0.012, cz);
  floor.receiveShadow = true;
  floor.name = 'forestFloor';
  group.add(floor);

  return {
    group, trees, bushes: bushes.length, chunks,
    /** Лиственная зелень (кроны, кусты, папоротник) — материал меняется по сезону. */
    deciduousFoliage,
    /** Кроны хвои — всегда зелёные. */
    pineCrowns,
  };
}

/** Линейная интерполяция. */
function lerpN(a, b, t) { return a + (b - a) * t; }
