/**
 * ============================================================================
 *  Деревня: здания и уличные пропсы
 * ============================================================================
 *
 *  Здесь собирается всё, что видно на улице:
 *
 *   * **Здания** — таверна, кузня, церковь, амбар, мельница, колодец,
 *     двенадцать фахверковых домов, торговые прилавки и стога сена;
 *   * **Пропсы** — фонари, костёр, скамейки, поилка, указатель, заборы
 *     с калитками, пшеничные поля, трава, цветы, лес и кусты;
 *   * **Животные** — расставляются последними (см. `game/animals.js`).
 *
 *  Каждое здание возвращает свои коллайдеры и платформы, а `place()`
 *   складывает их в общий реестр контекста.
 *
 *  @module game/village
 */

import * as THREE from 'three';
import {
  cottage, tavern, church, barn, windmill, blacksmith, well, marketStall, haystack, localBox,
} from '../world/buildings.js';
import {
  forest, scatterGrass, scatterFlowers, wheatField, lantern, campfire, fence, gate,
  trough, signpost, makeGlow,
} from '../world/props.js';
import { Embers } from '../world/particles.js';
import { LAYOUT, ryToFace, facadePos, tavernDoor } from './layout.js';

/**
 * Создаёт систему деревни.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система деревни
 */
export function createVillage(ctx) {
  // Все поля читаются из ctx прямо по месту использования:
  // так система не зависит от того, в каком порядке её создали.

  /* ================================================================
   *  Мелкие помощники
   * ================================================================ */

  /**
   * Поставить здание в мир: добавить в сцену и забрать его коллайдеры.
   *
   * @param {object} obj объект здания из `world/buildings.js`
   * @param {number} x мировая X
   * @param {number} z мировая Z
   * @param {number} ry поворот
   * @returns {object} тот же объект
   */
  function place(obj, x, z, ry) {
    obj.place(x, z, ry);
    ctx.scene.add(obj.group);
    ctx.colliders.boxes.push(...obj.colliders);
    if (obj.circles) ctx.colliders.circles.push(...obj.circles);
    if (obj.platforms) ctx.platforms.push(...obj.platforms);
    return obj;
  }

  /**
   * Добавить действие по нажатию E.
   *
   * @param {THREE.Vector3} pos точка
   * @param {number} radius радиус
   * @param {string} label подпись
   * @param {Function} act действие
   * @param {string} [where] локация
   */
  function addInteract(pos, radius, label, act, where = 'village') {
    ctx.interactables.push({ pos, radius, label, act, where });
  }

  /**
   * Подвесной фонарь: цепь, колпак, тёплое стекло и ореол.
   *
   * @param {number} x мировая X
   * @param {number} y высота подвеса
   * @param {number} z мировая Z
   */
  function hangLamp(x, y, z) {
    const g = new THREE.Group();
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), ctx.M.iron);
    chain.position.y = 0.28;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.15, 6), ctx.M.iron);
    cap.position.y = 0.07;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), ctx.M.lampGlass);
    glass.position.y = -0.16;
    g.add(chain, cap, glass);
    const glow = makeGlow(ctx.glowTex, 1.6, 0xffd9a0, 0.5);
    glow.position.y = -0.16;
    g.add(glow);
    g.position.set(x, y, z);
    ctx.scene.add(g);
    ctx.lanterns.push({
      group: g, glow, glass, lit: true, baseIntensity: 3.4, distance: 14,
      flicker: Math.random() * 10, power: 1,
      pos: new THREE.Vector3(x, y - 0.16, z),
    });
  }

  /* ================================================================
   *  Здания
   * ================================================================ */

  /** Расставить все здания деревни. */
  function buildBuildings() {
    /* --- таверна «Уставший вепрь» --- */
    const t = tavern(ctx.M, {});
    const tavernRy = ryToFace([LAYOUT.tavern.x, LAYOUT.tavern.z], [0, 0]);
    const tPlaced = place(t, LAYOUT.tavern.x, LAYOUT.tavern.z, tavernRy);
    for (const p of (tPlaced.windowLights || [])) {
      ctx.roomLights.push({ pos: p, lit: true, power: 1, flicker: 3, baseIntensity: 1.6, distance: 8 });
    }
    // дверь таверны — на фасаде, левее центра (локальные x = -w*0.3, z = -d/2)
    addInteract(
      tavernDoor().pos.clone(), 2.6, 'Войти в таверну «Уставший вепрь»',
      () => ctx.systems.locations.setLocation('tavern'),
    );

    /* --- кузня --- */
    const bs = blacksmith(ctx.M, {});
    place(bs, LAYOUT.blacksmith.x, LAYOUT.blacksmith.z,
      ryToFace([LAYOUT.blacksmith.x, LAYOUT.blacksmith.z], [0, -2]));
    const forgeLight = new THREE.PointLight(0xff7a28, 2.6, 12, 2);
    forgeLight.position.copy(bs.forge);
    forgeLight.position.y += 0.9;
    ctx.scene.add(forgeLight);
    ctx.animated.push((tt) => {
      forgeLight.intensity = 2.1 + Math.sin(tt * 11.3) * 0.35 + Math.sin(tt * 27.1) * 0.2;
    });
    ctx.interactables.push({
      pos: bs.forge.clone(), radius: 2.8, label: 'Подуть на горн',
      act: () => { forgeLight.intensity = 6.5; ctx.ui.toast('Горн разгорелся — жар пошёл!'); },
    });

    /* --- церковь --- */
    const ch = church(ctx.M, {});
    const chRy = ryToFace([LAYOUT.church.x, LAYOUT.church.z], [0, 0]);
    place(ch, LAYOUT.church.x, LAYOUT.church.z, chRy);
    ctx.interactables.push({
      pos: new THREE.Vector3(3, 2, 44 - 9.5), radius: 3.6, label: 'Позвонить в колокол',
      act: () => { ctx.ambience.bell(); ctx.ui.toast('Колокол над долиной — глухой и тёплый.'); },
    });
    addInteract(
      facadePos(3, 44, chRy, 0, -8.9, 1.6), 2.4, 'Войти в церковь',
      () => ctx.ui.toast('Внутри пахнет ладаном и старым деревом. Свечи не зажигали давно.'),
    );
    addInteract(
      facadePos(3, 44, chRy, 0, 8.9, 1.6), 2.4, 'Открыть тяжёлую дверь',
      () => ctx.ui.toast('Створка тяжёлая, с железными обвязками. За ней — кладовая и темнота.'),
    );
    // фонарь у задней двери — иначе створку не видно
    {
      const lp = facadePos(3, 44, chRy, 2.35, 8.95, 0);
      const cl = lantern(ctx.M, ctx.glowTex, { x: lp.x, z: lp.z, height: 3.5, lit: true, intensity: 2.5, distance: 13 });
      ctx.scene.add(cl.group);
      cl.place(lp.x, lp.z);
      ctx.lanterns.push(cl);
      addInteract(cl.pos.clone(), 2.0, 'Погасить фонарь',
        () => { cl.setLit(!cl.lit); ctx.ui.toast(cl.lit ? 'Фонарь снова горит.' : 'Фонарь погашен.'); });
    }

    /* --- амбар --- */
    const barnB = barn(ctx.M, {});
    const barnRy = ryToFace([LAYOUT.barn.x, LAYOUT.barn.z], [-10, -4]);
    place(barnB, LAYOUT.barn.x, LAYOUT.barn.z, barnRy);
    addInteract(
      facadePos(-40, -8, barnRy, 0, -4.4, 1.6), 2.8, 'Войти в амбар',
      () => ctx.systems.locations.setLocation('barn'),
    );

    /* --- мельница --- */
    const mill = windmill(ctx.M, { r: 3.5, h: 11.6 });   // мельница выше
    ctx.mill.ref = mill;
    const millX = LAYOUT.mill.x, millZ = LAYOUT.mill.z, millRy = LAYOUT.mill.ry;
    place(mill, millX, millZ, millRy);
    ctx.mill.blades = mill.blades;
    ctx.mill.cap = mill.cap;
    // подвесные фонари внутри башни
    for (const [lx, ly, lz] of [[0.7, 2.4, -1.8], [2.0, 6.2, 0.4], [-1.9, 9.4, 0.6], [0.4, 10.9, 1.7]]) {
      const wx = millX + lx * Math.cos(millRy) + lz * Math.sin(millRy);
      const wz = millZ - lx * Math.sin(millRy) + lz * Math.cos(millRy);
      hangLamp(wx, ly, wz);
    }
    // вход в мельницу
    const doorW = millX + 0 * Math.cos(millRy) + (-3.9) * Math.sin(millRy);
    const doorH = millZ - 0 * Math.sin(millRy) + (-3.9) * Math.cos(millRy);
    ctx.interactables.push({
      pos: new THREE.Vector3(doorW, 1.4, doorH), radius: 2.2, label: 'Войти в мельницу',
      act: () => ctx.ui.toast('Внутри винтовая лестница — наверх, к площадке на крыше.'),
    });

    /* --- колодец --- */
    const wl = well(ctx.M, {});
    place(wl, LAYOUT.well.x, LAYOUT.well.z);
    ctx.interactables.push({
      pos: new THREE.Vector3(0, 1.2, 0), radius: 2.8, label: 'Набрать воды',
      act: () => ctx.ui.toast('Вода из колодца — ледяная и чистая. Ведро полно.'),
    });

    /* --- дома --- */
    const homes = [
      [-11, 8, { w: 6, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [13, 9, { w: 6.5, d: 5, h: 3.2, roof: 'thatch', floors: 1 }],
      [-16, 19, { w: 7, d: 5.5, h: 3.2, roof: 'thatch', floors: 1 }],
      [16, 20, { w: 6, d: 5, h: 3.1, roof: 'tile', floors: 1 }],
      [-25, -24, { w: 6.5, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [24, -22, { w: 6, d: 5.4, h: 3.2, roof: 'thatch', floors: 1 }],
      [-27, 11, { w: 6, d: 5, h: 3.0, roof: 'tile', floors: 1 }],
      [28, 13, { w: 8, d: 6, h: 3.4, roof: 'tile', floors: 2 }],
      [-10, 29, { w: 6, d: 5, h: 3.0, roof: 'thatch', floors: 1 }],
      [11, 30, { w: 7, d: 5.5, h: 3.2, roof: 'thatch', floors: 2 }],
      [24, -33, { w: 5.5, d: 4.6, h: 2.9, roof: 'thatch', floors: 1 }],
      [-30, 27, { w: 6, d: 5, h: 3.0, roof: 'thatch', floors: 1 }],
    ];
    const wallKinds = ['plaster', 'plasterWarm', 'plasterGrey'];
    const houseLines = [
      'Из-за двери слышно, как потрескивает очаг.',
      'Дом тих — хозяева уже спят. Или ещё не пришли.',
      'Кто-то задул свечу. Запах хлеба.',
      'Дверь покосилась, но держится. Кто-то скоро починит.',
      'В доме пахнет дымом и сушёными травами.',
      'Старая дверь, крепкие доски. Ступенька просела.',
      'За дверью слышно, как дитя свистит в свистульку.',
      'Двухэтажный дом: внизу печь, наверху сушатся травы.',
      'Дверь выкрашена в синий — к счастью, как в сказке.',
      'Крыльцо просело, дверь открывается с нажимом.',
      'Маленький дом у дороги. Тихо и уютно.',
      'Дом на отшибе: забор, поле, и тишина.',
    ];
    homes.forEach((h, i) => {
      const hry = ryToFace([h[0], h[1]], [0, 0]);
      const c = cottage(ctx.M, { ...h[2], wall: wallKinds[i % 3], lit: true });
      const placed = place(c, h[0], h[1], hry);
      // свет из окон внутрь дома
      for (const p of (placed.windowLights || [])) {
        ctx.roomLights.push({ pos: p, lit: true, power: 1, flicker: i, baseIntensity: 1.5, distance: 7 });
      }
      if (c.chimney) ctx.smokeSources.push({ pos: c.chimney.clone(), rate: 0.11 });
      addInteract(
        facadePos(h[0], h[1], hry, 0, -h[2].d / 2 - 0.4),
        1.9, 'Постучать в дверь',
        () => ctx.ui.toast(houseLines[i % houseLines.length]),
      );
    });

    /* --- прилавки --- */
    const stalls = [[5.6, 5.6, 'fabric'], [-5.8, 6.4, 'fabric2'], [6.4, -6.2, 'fabric2'], [-6.6, -5.6, 'fabric']];
    const stallLines = [
      'На прилавке — мед, репа и кусок сыра.',
      'Ткани, ленты и пряжа. Торговец здоровается кивком.',
      'Кувшин с квасом и свежие лепёшки.',
      'Здесь продают дичь, мёд и всё, что поймали за ночь.',
    ];
    stalls.forEach(([sx, sz, cl], i) => {
      const st = marketStall(ctx.M, { cloth: cl });
      place(st, sx, sz, ryToFace([sx, sz], [0, 0]) + Math.PI);
      addInteract(
        new THREE.Vector3(sx, 1.2, sz), 2.0, 'Осмотреть прилавок',
        () => ctx.ui.toast(stallLines[i % stallLines.length]),
      );
    });

    /* --- стога сена --- */
    const haystacks = [[-34, -14], [-36.5, -15.5], [-33, -18.5], [30, 40]];
    for (const [hx, hz] of haystacks) {
      place(haystack(ctx.M, { r: 1.5, h: 2.6 }), hx, hz);
      addInteract(
        new THREE.Vector3(hx, 1.4, hz), 2.1, 'Забраться на стог',
        () => ctx.ui.toast('Сено тёплое и шуршащее. Отсюда видно всю долину.'),
      );
    }
  }

  /* ================================================================
   *  Уличные пропсы
   * ================================================================ */

  /** Расставить фонари, костёр, заборы, растительность и лес. */
  function buildProps() {
    /* --- фонари вдоль улицы --- */
    const lanternSpots = [
      [3.6, 3.6, true], [-3.8, 4.2, true], [3.8, -4.4, true], [-4.2, -3.6, true],
      [2.7, 12, true], [-2.9, 12, false], [2.9, -14, true], [-3.0, -18, false],
      [2.9, 24, false], [-3.0, 27, false], [2.9, 34, false], [-3.0, 38, false],
      [-10.5, 6.5, false], [10.5, 6.5, false], [-11, -9, false], [11, -9, false],
    ];
    for (const [lx, lz, withLight] of lanternSpots) {
      const l = lantern(ctx.M, ctx.glowTex, {
        x: lx, z: lz, height: 3.1, lit: true,
        intensity: withLight ? 2.6 : 1.2, distance: withLight ? 16 : 9,
      });
      ctx.scene.add(l.group);
      l.place(lx, lz);
      ctx.lanterns.push(l);
      if (withLight) {
        ctx.interactables.push({
          pos: l.pos.clone(), radius: 2.1,
          labelFn: () => (l.lit ? 'Погасить фонарь' : 'Зажечь фонарь'),
          act: () => { l.setLit(!l.lit); ctx.ui.toast(l.lit ? 'Фонарь снова горит.' : 'Фонарь погашен.'); },
        });
      }
    }

    /* --- костёр --- */
    const fire = campfire(ctx.M, ctx.glowTex);
    fire.group.position.set(-9, 0, 8.5);
    ctx.scene.add(fire.group);
    ctx.emberSys = new Embers(ctx.scene, ctx.glowTex, new THREE.Vector3(-9, 0.6, 8.5));
    ctx.colliders.circles.push({ x: -9, z: 8.5, r: 1.0 });   // круг камней костра
    ctx.interactables.push({
      pos: new THREE.Vector3(-9, 1, 8.5), radius: 2.8, label: 'Подбросить дрова',
      act: () => { ctx.fireBoost = 12; ctx.ui.toast('Огонь разгорелся — тепло до ушей.'); },
    });
    ctx.animated.push((tt) => {
      const f = 0.75 + Math.sin(tt * 9.1) * 0.12 + Math.sin(tt * 21.7) * 0.07;
      fire.flame.scale.set(0.9 + f * 0.2, f * 1.35, 0.9 + f * 0.2);
      fire.flame.rotation.y = tt * 1.4;
      fire.light.intensity = (2.2 + f * 1.4) * (1 + ctx.fireBoost * 0.1);
      fire.glow.scale.setScalar(3.2 + f * 0.9 + ctx.fireBoost * 0.04);
    });

    /* --- скамейки у костра --- */
    const seat = new THREE.Group();
    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.45), ctx.M.plank);
    seatMesh.position.y = 0.45; seatMesh.castShadow = true; seatMesh.receiveShadow = true;
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.45, 0.4), ctx.M.timber);
    leg1.position.set(-0.9, 0.22, 0);
    const leg2 = leg1.clone(); leg2.position.x = 0.9;
    seat.add(seatMesh, leg1, leg2);
    seat.position.set(-9, 0, 11.4);
    ctx.scene.add(seat);
    const seat2 = seat.clone(); seat2.rotation.y = Math.PI / 2;
    seat2.position.set(-12.4, 0, 8.5);
    ctx.scene.add(seat2);

    // бочки, ящики, мешки и повозки убраны из деревни — теперь всё в амбаре (см. world/barn.js)
    ctx.scene.add(trough(ctx.M, { x: -30.2, z: 13.4, ry: 0.3 }));
    ctx.scene.add(signpost(ctx.M, { x: 3.2, z: 13.5, ry: -0.5 }));
    // поилка — по фактическому размеру
    ctx.colliders.boxes.push(localBox(-30.2, 13.4, 0.3, 0, 0, 2.4, 0.9));
    ctx.colliders.circles.push({ x: 3.2, z: 13.5, r: 0.22 });

    /* --- заборы и калитки --- */
    const fenceSegs = [];
    const gates = [];
    const field = (x, z, w, d) => {
      const gw = 2.0;                       // проём для калитки
      fenceSegs.push(
        [[x - w / 2, z - d / 2], [x - gw / 2, z - d / 2]],   // юг — с калиткой
        [[x + gw / 2, z - d / 2], [x + w / 2, z - d / 2]],
        [[x + w / 2, z - d / 2], [x + w / 2, z + d / 2]],
        [[x + w / 2, z + d / 2], [x - w / 2, z + d / 2]],
        [[x - w / 2, z + d / 2], [x - w / 2, z - d / 2]],
      );
      gates.push({ x: x - gw / 2, z: z - d / 2, ang: 0 });
    };
    field(-27, 37, 22, 15);
    field(31, 44, 19, 14);
    field(-44, 16, 14, 12);
    fenceSegs.push([[-13, -6], [-13, 1]], [[13, -6], [13, 1]]);
    ctx.scene.add(fence(ctx.M, fenceSegs));
    for (const g of gates) ctx.scene.add(gate(ctx.M, g));
    // заборы — реальные препятствия
    for (const seg of fenceSegs) {
      const [a, b] = seg;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(len / 0.6));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        ctx.colliders.circles.push({
          x: a[0] + (b[0] - a[0]) * t,
          z: a[1] + (b[1] - a[1]) * t,
          r: 0.26,
        });
      }
    }

    /* --- поля, трава, цветы --- */
    ctx.scene.add(wheatField(ctx.M, -27, 37, 22, 15));
    ctx.scene.add(wheatField(ctx.M, 31, 44, 19, 14));

    const spots = [
      { x: -12, z: 4, r: 5 }, { x: 12, z: 4, r: 5 }, { x: -18, z: -16, r: 5 },
      { x: 18, z: -15, r: 5 }, { x: -6, z: 22, r: 6 }, { x: 8, z: 25, r: 6 },
      { x: -20, z: 6, r: 6 }, { x: 21, z: 7, r: 6 }, { x: 0, z: 34, r: 7 },
      { x: 26, z: 24, r: 6 }, { x: -30, z: -28, r: 7 }, { x: 30, z: -26, r: 7 },
      { x: 38, z: 6, r: 6 },
    ];
    ctx.scene.add(scatterGrass(ctx.M, spots, 1100));
    const flowers = scatterFlowers(ctx.M, spots, 70);
    ctx.scene.add(flowers);
    ctx.scene.userData.flowers = flowers;

    /* --- лес --- */
    const trees = [
      { x: -14, z: 14, type: 'oak', s: 1.35 },
      { x: 15, z: 16, type: 'oak', s: 1.15 },
      { x: -33, z: 24, type: 'birch', s: 1.1 },
    ];
    for (let i = 0; i < 340; i++) {
      const a = ctx.rng() * Math.PI * 2;
      const r = 46 + Math.pow(ctx.rng(), 0.7) * 80;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 9 && Math.abs(z) < 95) continue;
      if (x > 32 && x < 70 && z > -32 && z < 4) continue;   // лужайка у пруда
      const type = ctx.rng() > 0.45 ? 'pine' : (ctx.rng() > 0.6 ? 'birch' : 'oak');
      trees.push({ x, z, type, s: 0.8 + ctx.rng() * 0.75, autumn: ctx.rng() > 0.86 });
    }
    ctx.scene.add(forest(ctx.M, trees));
    for (const t of trees) {
      if (Math.hypot(t.x, t.z) < 72) ctx.colliders.circles.push({ x: t.x, z: t.z, r: 0.3 * (t.s || 1) });
    }
  }

  /**
   * Собрать деревню целиком: здания, пропсы и животных.
   *
   * @param {Function} buildAnimals функция расстановки животных
   */
  function build(buildAnimals) {
    buildBuildings();
    buildProps();
    buildAnimals();
  }

  return { build, buildBuildings, buildProps };
}
