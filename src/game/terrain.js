/**
 * ============================================================================
 *  Земля, дороги и пруд
 * ============================================================================
 *
 *  Модуль отвечает за «подстилающий» слой мира: рельеф, дороги, площадь,
 *  пруд с пирсом и удочками для рыбалки.
 *
 *  Зависимости передаются через контекст игры (`ctx`):
 *    ctx.scene, ctx.M, ctx.T — сцена и материалы;
 *    ctx.rng                      — генератор случайных чисел (мир всегда одинаковый);
 *    ctx.colliders, ctx.platforms — препятствия и поверхности;
 *    ctx.systems.fishing           — регистрация точек рыбалки.
 *
 *  @module game/terrain
 */

import * as THREE from 'three';
import { fishingRod, fishingLine } from '../world/props.js';

/**
 * Пруд: держим далеко от домов — на юго-восточной лужайке.
 * @type {{x: number, z: number, r: number}}
 */
export const POND = { x: 50, z: -14, r: 10.6 };

/**
 * Материал дорожки: клонируем текстуру и задаём повтор.
 *
 * @param {THREE.Texture} tex исходная текстура
 * @param {number} rx повтор по X
 * @param {number} ry повтор по Y
 * @param {number} [color] оттенок
 * @returns {THREE.MeshStandardMaterial} материал
 */
function pathMat(tex, rx, ry, color = 0xffffff) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color });
}

/**
 * Земля и холмы по краю карты.
 *
 * @param {object} ctx контекст игры
 */
export function addGround(ctx) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(460, 460, 1, 1), ctx.M.grass);
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  ctx.scene.add(g);

  const hills = new THREE.Group();
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + ctx.rng() * 0.22;
    const r = 160 + ctx.rng() * 75;
    const s = 26 + ctx.rng() * 36;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 8), ctx.M.grassFar);
    hill.position.set(Math.cos(a) * r, -s * 0.74, Math.sin(a) * r);
    hill.scale.set(1.5, 0.5 + ctx.rng() * 0.32, 1.4);
    hills.add(hill);
  }
  ctx.scene.add(hills);
}

/**
 * Дороги: главная, поперечная, мощёная площадь и тропинки к строениям.
 *
 * @param {object} ctx контекст игры
 */
export function addRoads(ctx) {
  const main = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 215), pathMat(ctx.T.dirt, 4, 92));
  main.rotation.x = -Math.PI / 2;
  main.position.set(0, 0.015, 0);
  main.receiveShadow = true;
  ctx.scene.add(main);

  const cross = new THREE.Mesh(new THREE.PlaneGeometry(175, 5.6), pathMat(ctx.T.dirt, 62, 3));
  cross.rotation.x = -Math.PI / 2;
  cross.position.set(0, 0.02, 0);
  cross.receiveShadow = true;
  ctx.scene.add(cross);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(11.5, 48), pathMat(ctx.T.cobble, 4.5, 4.5));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, 0.03, 0);
  plaza.receiveShadow = true;
  ctx.scene.add(plaza);

  const paths = [
    [[-17, -13], [-8, -7]], [[14.5, -8], [7, -4]], [[-11, 8], [-5, 4]],
    [[13, 9], [5, 4]], [[-16, 19], [-7, 8]], [[16, 20], [7, 9]],
    [[-25, -24], [-13, -12]], [[24, -22], [12, -11]], [[-27, 11], [-10, 6]],
    [[28, 13], [10, 6]], [[-10, 29], [-4, 13]], [[11, 30], [4, 13]],
    [[3, 44], [0, 14]], [[-40, -8], [-12, -4]], [[34, -33], [13, -14]],
    [[-9, 8.5], [-4, 4]], [[44, -2], [37.5, -4.5]],
  ];
  for (const [a, b] of paths) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.5, len), pathMat(ctx.T.dirt, 1, len / 6));
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = -Math.atan2(dx, dz);
    p.position.set((a[0] + b[0]) / 2, 0.025, (a[1] + b[1]) / 2);
    p.receiveShadow = true;
    ctx.scene.add(p);
  }
}

export function addPond(ctx) {
  const pond = new THREE.Group();
  const R = POND.r;

  // --- песчаный берег ---
  const sandMat = ctx.M.dirt.clone();
  sandMat.color = new THREE.Color(0xcbb389);
  const bank = new THREE.Mesh(new THREE.RingGeometry(R - 0.35, R + 2.9, 56, 1), sandMat);
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.012;
  bank.receiveShadow = true;
  pond.add(bank);

  // --- дно: тёмный ил, чтобы вода читалась как глубина, а не трава ---
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x4a4430, roughness: 1 });
  const bed = new THREE.Mesh(new THREE.CircleGeometry(R + 0.05, 40), mudMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 0.015;
  pond.add(bed);

  // --- вода: цвет вершины зависит от глубины (центр — темнее) ---
  const waterGeo = new THREE.CircleGeometry(R, 56);
  {
    const pos = waterGeo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const deep = new THREE.Color(0x2f7186);
    const shallow = new THREE.Color(0x9ad8e2);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const rr = Math.min(1, Math.hypot(pos.getX(i), pos.getY(i)) / R);
      c.copy(deep).lerp(shallow, Math.pow(rr, 1.7));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    waterGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const waterMat = ctx.M.water.clone();
  waterMat.vertexColors = true;
  waterMat.color = new THREE.Color(0xffffff);
  waterMat.roughness = 0.22;
  waterMat.metalness = 0.06;
  waterMat.opacity = 0.86;
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.05;
  pond.add(water);

  // --- камни по кромке воды ---
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + ctx.rng() * 0.12;
    const s = 0.22 + ctx.rng() * 0.34;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), ctx.M.stone);
    rock.position.set(Math.cos(a) * (R + 0.15 + ctx.rng() * 0.5), 0.04, Math.sin(a) * (R + 0.15 + ctx.rng() * 0.5));
    rock.rotation.set(ctx.rng() * 3, ctx.rng() * 3, ctx.rng() * 3);
    rock.scale.y = 0.6 + ctx.rng() * 0.3;
    rock.castShadow = true; rock.receiveShadow = true;
    pond.add(rock);
  }
  // редкие валуны на берегу
  for (let i = 0; i < 7; i++) {
    const a = ctx.rng() * Math.PI * 2;
    const s = 0.7 + ctx.rng() * 0.8;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), ctx.M.stone);
    rock.position.set(Math.cos(a) * (R + 1.6 + ctx.rng() * 1.4), s * 0.35, Math.sin(a) * (R + 1.6 + ctx.rng() * 1.4));
    rock.rotation.set(ctx.rng() * 3, ctx.rng() * 3, ctx.rng() * 3);
    rock.scale.y = 0.7;
    rock.castShadow = true; rock.receiveShadow = true;
    pond.add(rock);
  }

  // --- камыш у воды ---
  const reedMat = new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 1 });
  const reedTip = new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: 1 });
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + ctx.rng() * 0.18;
    const rad = R + 0.9 + ctx.rng() * 1.9;
    const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad;
    const clump = new THREE.Group();
    clump.position.set(bx, 0, bz);
    const n = 4 + Math.floor(ctx.rng() * 4);
    for (let k = 0; k < n; k++) {
      const h = 0.8 + ctx.rng() * 0.9;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, h, 4), reedMat);
      stalk.position.set((ctx.rng() - 0.5) * 0.4, h / 2, (ctx.rng() - 0.5) * 0.4);
      stalk.rotation.set((ctx.rng() - 0.5) * 0.3, ctx.rng() * 3, (ctx.rng() - 0.5) * 0.3);
      stalk.castShadow = true;
      clump.add(stalk);
      if (ctx.rng() > 0.6) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 5), reedTip);
        tip.position.set(stalk.position.x, h + 0.05, stalk.position.z);
        clump.add(tip);
      }
    }
    pond.add(clump);
  }

  // --- кувшинки ---
  const lilyMat = new THREE.MeshStandardMaterial({ color: 0x4d7d3c, roughness: 0.9 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf2e6ef, roughness: 0.8 });
  for (let i = 0; i < 9; i++) {
    const a = ctx.rng() * Math.PI * 2;
    const rad = 2.5 + ctx.rng() * (R - 3.5);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.32 + ctx.rng() * 0.26, 10), lilyMat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = ctx.rng() * 3;
    pad.position.set(Math.cos(a) * rad, 0.075, Math.sin(a) * rad);
    pad.receiveShadow = true;
    pond.add(pad);
    if (ctx.rng() > 0.55) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), flowerMat);
      fl.position.set(pad.position.x + 0.06, 0.11, pad.position.z);
      fl.scale.y = 0.6;
      pond.add(fl);
    }
  }

  // --- пирс: настил на сваях, перила, площадка в конце и удочка ---
  const pier = new THREE.Group();
  const deckY = 0.44;
  const len = 9.2, halfW = 0.95;
  // продольные балки
  for (const sx of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, len), ctx.M.timber);
    beam.position.set(sx * (halfW - 0.12), deckY - 0.17, -len / 2);
    beam.castShadow = true;
    pier.add(beam);
  }
  // доски настила
  const nPlank = 13;
  for (let i = 0; i < nPlank; i++) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.1, len / nPlank - 0.07), ctx.M.plank);
    pl.position.set(0, deckY, -0.25 - (i + 0.5) * (len / nPlank));
    pl.rotation.y = (ctx.rng() - 0.5) * 0.012;
    pl.castShadow = true; pl.receiveShadow = true;
    pier.add(pl);
  }
  // сваи, уходящие в воду
  for (let i = 0; i < 5; i++) {
    const z = -0.9 - i * 2.1;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.6, 8), ctx.M.timber);
      post.position.set(sx * (halfW - 0.1), deckY - 1.3, z);
      post.castShadow = true;
      pier.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 8), ctx.M.timber);
      cap.position.set(sx * (halfW - 0.1), deckY + 0.04, z);
      pier.add(cap);
    }
  }
  // перила с одной стороны
  for (let i = 0; i < 5; i++) {
    const z = -1.0 - i * 2.0;
    const rp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.11), ctx.M.timber);
    rp.position.set(-halfW + 0.1, deckY + 0.5, z);
    rp.castShadow = true;
    pier.add(rp);
  }
  for (const ry2 of [0.85, 0.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, len - 1.2), ctx.M.timber);
    rail.position.set(-halfW + 0.1, deckY + ry2, -len / 2 - 0.4);
    rail.castShadow = true;
    pier.add(rail);
  }
  // площадка на конце
  const plat = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.7, 0.12, 2.2), ctx.M.plank);
  plat.position.set(0, deckY, -len - 0.6);
  plat.castShadow = true; plat.receiveShadow = true;
  pier.add(plat);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.6, 8), ctx.M.timber);
    post.position.set(sx * (halfW + 0.2), deckY - 1.3, -len - 1.4);
    post.castShadow = true;
    pier.add(post);
  }
  // удочка на конце пирса — точка рыбалки
  const pierRod = fishingRod(ctx.M, { len: 2.7, lineLen: 1.5 });
  pierRod.position.set(0.62, deckY + 0.06, -len - 0.55);
  pierRod.rotation.set(-0.26, 0.3, -0.1);
  pier.add(pierRod);
  // пирс выходит от западного берега к центру озера
  pier.position.set(-10.6, 0, 0);
  pier.rotation.y = -Math.PI / 2;
  pond.add(pier);

  pond.position.set(POND.x, 0, POND.z);
  ctx.scene.add(pond);
  // вода — «мягкая» преграда: на пирсе игрок проходит над ней
  ctx.colliders.circles.push({
    x: POND.x, z: POND.z, r: 11.7, soft: true,
    gap: { minX: POND.x - 13.5, maxX: POND.x + 1.5, minZ: POND.z - 1.0, maxZ: POND.z + 1.0 }, // проём к пирсу
  });
  // настил пирса — по нему можно пройти к воде (мировые координаты)
  const px0 = POND.x - 10.6, pz0 = POND.z;
  ctx.platforms.push({
    cx: px0 + len / 2 + 0.65, cz: pz0,
    hx: len / 2 + 1.05, hz: halfW + 0.1, ang: 0, y: deckY,
  });
  // бортики пирса, чтобы не свалиться в воду
  for (const sz of [-1, 1]) {
    ctx.colliders.boxes.push({
      cx: px0 + len / 2 + 0.2, cz: pz0 + sz * (halfW + 0.12),
      hx: (len + 1.4) / 2, hz: 0.1, ang: 0,
    });
  }
  ctx.colliders.boxes.push({
    cx: px0 + len + 1.7, cz: pz0, hx: 0.12, hz: halfW + 0.2, ang: 0,
  });
  // удочка на берегу — второе место для рыбалки
  {
    const shoreRod = fishingRod(ctx.M, { len: 2.5, lineLen: 1.4 });
    // левая (северная) часть берега — дальше от пирса
    shoreRod.position.set(POND.x - 10.8, 0, POND.z - 6.2);
    shoreRod.rotation.set(0.06, -0.9, -0.24);
    ctx.scene.add(shoreRod);
    // колышек, чтобы удочка стояла, а не висела в воздухе
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 6), ctx.M.timber);
    stake.position.set(POND.x - 10.75, 0.12, POND.z - 6.25);
    stake.rotation.z = 0.12;
    stake.castShadow = true;
    ctx.scene.add(stake);
    // точки рыбалки регистрируем, когда вся сцена уже встала на место
    const pSpot = ctx.systems.fishing.registerCastSpot(pierRod, 'удочка на причале');
    const sSpot = ctx.systems.fishing.registerCastSpot(shoreRod, 'удочка на берегу');
    // лески свисают с кончиков вертикально
    ctx.scene.add(fishingLine(ctx.M, pSpot.tip, 1.5));
    ctx.scene.add(fishingLine(ctx.M, sSpot.tip, 1.2));
  }
}


/**
 * Строит весь подстилающий слой мира.
 *
 * @param {object} ctx контекст игры
 */
export function buildTerrain(ctx) {
  addGround(ctx);
  addRoads(ctx);
  addPond(ctx);
}
