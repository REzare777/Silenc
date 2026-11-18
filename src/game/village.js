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
  scatterGrass, scatterFlowers, wheatField, lantern, campfire, fence, gate, gardenBed,
  trough, signpost, makeGlow,
} from '../world/props.js';
import { denseForest } from '../world/forest.js';
import { Embers } from '../world/particles.js';
import { Builder, box, cyl, sphere, cone, mat } from '../world/geo.js';
import {
  LAYOUT, ryToFace, facadePos, tavernDoor, dungeonGate, dungeonTrail, distToDungeonTrail,
} from './layout.js';

/**
 * Поляны вокруг зданий: здесь деревья не растут.
 *
 * Без этого опушка леса подступала вплотную к церкви и мельнице (они стоят
 * как раз на опушке) — к стенам примыкали стволы, и вокруг здания нельзя было
 * пройти.
 *
 * @type {[number, number, number][]} [x, z, радиус]
 */
const BUILDING_CLEARINGS = [
  [LAYOUT.church.x, LAYOUT.church.z, 11],
  [LAYOUT.mill.x, LAYOUT.mill.z, 9],
  [LAYOUT.tavern.x, LAYOUT.tavern.z, 12],
  [LAYOUT.barn.x, LAYOUT.barn.z, 10],
  [LAYOUT.blacksmith.x, LAYOUT.blacksmith.z, 7],
  [LAYOUT.well.x, LAYOUT.well.z, 5],
];

/**
 * Дома закрыты на ключ.
 *
 * Пока эта тема отложена, все жилые дома в деревне заперты: створка
 * закрыта, за проёмом глухая дверь (коллайдер), а подсказка у двери
 * говорит, что хозяева не жалуют гостей. Вернуть дома открытыми —
 * достаточно переключить этот флаг в `false`.
 */
const HOUSES_LOCKED = true;

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
    // выход через заднюю дверь таверны (сбоку, у восточной стены)
    {
      const back = facadePos(LAYOUT.tavern.x, LAYOUT.tavern.z, tavernRy, 8.5, -6.7, 0);
      ctx.doors.tavernBack = { x: back.x, z: back.z, ry: tavernRy };
    }
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
    // вход в храм — у двери колокольни (южный фасад)
    addInteract(
      facadePos(3, 44, chRy, 0, -11.9, 1.6), 2.6, 'Войти в храм',
      () => ctx.systems.locations.setLocation('church'),
    );
    // точка выхода из храма — перед дверью колокольни, на земле
    {
      const out = facadePos(3, 44, chRy, 0, -13.4, 0);
      ctx.doors.church = { x: out.x, z: out.z, ry: chRy };
    }
    // задняя дверь нефа — рабочая: через неё можно войти в храм
    addInteract(
      facadePos(3, 44, chRy, 0, 8.9, 1.6), 2.6, 'Войти через заднюю дверь',
      () => ctx.systems.locations.setLocation('church', 'back'),
    );
    {
      // точка выхода через заднюю дверь — в заднем дворе у северного фасада
      const back = facadePos(3, 44, chRy, 0, 10.1, 0);
      ctx.doors.churchBack = { x: back.x, z: back.z, ry: chRy };
    }
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

    /* --- дома ---
     *
     * Раскладка по-настоящему: главная улица идёт вдоль Z, и каждый дом
     * имеет зеркальную пару на другой стороне. Между соседними домами —
     * двор и огород (10–12 м), как в настоящей деревне: заходить за
     * забор соседа можно, но это уже другой участок.
     *
     *   A (-13, 14) / (13, 14)     — ближний ряд к площади
     *   B (-13, 31) / (13, 31)     — тот же ряд, ближе к храму
     *   C (-31, 14) / (31, 14)     — второй ряд, за огородами (два этажа)
     *   D (-29, 32) / (29, 32)     — второй ряд у поля
     *   E (-33, -20) / (33, -20)   — южная окраина, за трактиром
     *   F (-21, -32) / (21, -32)   — дальний отшиб, у скалы
     */
    const homes = [
      [-13, 14, { w: 6, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [13, 14, { w: 6, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [-13, 31, { w: 6, d: 5, h: 3.0, roof: 'tile', floors: 1 }],
      [13, 31, { w: 6, d: 5, h: 3.0, roof: 'tile', floors: 1 }],
      [-31, 14, { w: 7, d: 6, h: 3.4, roof: 'tile', floors: 2 }],
      [31, 14, { w: 7, d: 6, h: 3.4, roof: 'tile', floors: 2 }],
      [-29, 32, { w: 6, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [29, 32, { w: 6, d: 5, h: 3.1, roof: 'thatch', floors: 1 }],
      [-33, -20, { w: 6, d: 5, h: 3.0, roof: 'thatch', floors: 1 }],
      [33, -20, { w: 6, d: 5, h: 3.0, roof: 'thatch', floors: 1 }],
      [-21, -32, { w: 5.5, d: 4.6, h: 2.9, roof: 'thatch', floors: 1 }],
      [21, -32, { w: 5.5, d: 4.6, h: 2.9, roof: 'thatch', floors: 1 }],
    ];
    const wallKinds = ['plaster', 'plasterWarm', 'plasterGrey'];
    const houseLines = [
      'Дом у костра: свет в окнах горит до полуночи.',
      'Дом напротив костра. На крыльце — закопчённая грядка.',
      'Дом в глубине улицы. Дверь выкрашена в синий.',
      'Дом с большим огородом за ним.',
      'Дом ближе к храму: отсюда слышен колокол.',
      'Дом у поля. Ветер пахнет скошенной травой.',
      'Двухэтажный дом: внизу печь, наверху сушатся травы.',
      'Двухэтажный дом с мастерской — слышно, как точат.',
      'Дом на южной окраине, за трактиром. Тишина.',
      'Дом у мельницы: слышно, как скрипят жернова.',
      'Дом на отшибе: забор, поле и тишина.',
      'Последний дом в долине: дальше только лес и тропа в скалу.',
    ];
    homes.forEach((h, i) => {
      const hry = ryToFace([h[0], h[1]], [0, 0]);
      const c = cottage(ctx.M, {
        ...h[2], wall: wallKinds[i % 3], lit: true, variant: i,
        doorOpen: !HOUSES_LOCKED,
      });
      const placed = place(c, h[0], h[1], hry);
      // свет из окон внутрь дома
      for (const p of (placed.windowLights || [])) {
        ctx.roomLights.push({ pos: p, lit: true, power: 1, flicker: i, baseIntensity: 1.5, distance: 7 });
      }
      // свет от свечи внутри дома
      if (placed.interiorLight) {
        ctx.roomLights.push({ pos: placed.interiorLight, lit: true, power: 1, flicker: i + 7, baseIntensity: 1.9, distance: 8 });
      }
      if (c.chimney) ctx.smokeSources.push({ pos: c.chimney.clone(), rate: 0.11 });
      // дверь дома запоминаем — отсюда игрок вернётся из локации
      const doorPos = facadePos(h[0], h[1], hry, 0, -h[2].d / 2 - 1.5);
      ctx.doors.homes = ctx.doors.homes || [];
      ctx.doors.homes[i] = { x: doorPos.x, z: doorPos.z, ry: hry };
      // список домов с габаритами — им пользуются проверки планировки
      ctx.homes = ctx.homes || [];
      ctx.homes[i] = { i, x: h[0], z: h[1], w: h[2].w, d: h[2].d, ry: hry };
      addInteract(
        facadePos(h[0], h[1], hry, 0, -h[2].d / 2 - 0.4),
        2.0,
        HOUSES_LOCKED ? 'Запертая дверь дома' : 'Войти в дом',
        () => {
          if (HOUSES_LOCKED) {
            ctx.ui.toast('Дом заперт на ключ: хозяева не жалуют гостей.', 3600);
            return;
          }
          // в дом пускают только утром и днём
          const phase = ctx.env ? (ctx.env.target || ctx.env.current) : 'day';
          if (phase === 'morning' || phase === 'day') {
            ctx.systems.locations.setLocation(`home${i}`);
            return;
          }
          ctx.ui.toast(phase === 'night'
            ? 'Дверь заперта: хозяева спят. В дом пускают утром и днём.'
            : 'Дом уже заперт на ночь. Заходите утром или днём.', 3600);
        },
      );
    });

    /* --- огороды ---
     *
     * За каждым домом — две грядки: пустое место между участками должно
     * выглядеть огородом, а не вытоптанным лугом. Грядки не мешают
     * проходу (низкие, без препятствий).
     */
    for (const h of ctx.homes || []) {
      const off = Math.sign(h.x) * (h.w / 2 + 1.5);
      for (const dz of [-2, 2]) {
        const bed = gardenBed(ctx.M, { w: 1.2, d: 2.6 });
        bed.position.set(h.x + off, 0, h.z + dz);
        bed.rotation.y = Math.PI / 2;
        ctx.scene.add(bed);
      }
    }

    /* --- прилавки --- */
    // прилавки: последний отодвинут от входа трактира, чтобы не загораживал дверь
    const stalls = [[5.6, 5.6, 'fabric'], [-5.8, 6.4, 'fabric2'], [6.4, -6.2, 'fabric2'], [-9.2, -2.6, 'fabric']];
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
    // Раньше три стога стояли впритык за амбаром и загораживали обход
    // вокруг него. Теперь они — у полей и на лугах, как и должно быть.
    const haystacks = [[-40, 28], [-53, 13], [28, 38], [21, 16]];
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
    field(-30, 44, 20, 12);   // поле отодвинуто от домов: между ними проход
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
    ctx.scene.add(wheatField(ctx.M, -30, 44, 20, 12));
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

    /* --- лес: плотное кольцо вокруг деревни --- */
    // Лес начинается в 44 м от центра и полностью закрывает дальний обзор:
    // скала с входом в подземелье (≈100 м) не видна с улицы.
    const { group: forestGroup, trees } = denseForest(ctx.M, ctx.rng, {
      center: [0, 0],
      inner: 44,
      keepClear: (x, z) => {
        if (Math.abs(x) < 8 && Math.abs(z) < 100) return true;      // главная дорога вдоль Z
        if (x > 29 && x < 73 && z > -35 && z < 7) return true;       // лужайка у пруда
        if (distToDungeonTrail(x, z) < 3.4) return true;             // узкая тропа к пещере
        // у самой скалы — только площадка перед входом; дальше лес
        // подступает вплотную и полностью закрывает скалу от взгляда
        if (Math.hypot(x - LAYOUT.dungeon.x, z - LAYOUT.dungeon.z) < 11) return true;
        if (Math.abs(x) < 46 && Math.abs(z) < 46) return true;       // поля и огороды деревни
        // вокруг зданий — поляна: деревья не растут вплотную к стенам
        for (const b of BUILDING_CLEARINGS) {
          if (Math.hypot(x - b[0], z - b[1]) < b[2]) return true;
        }
        return false;
      },
    });
    ctx.scene.add(forestGroup);
    // коллайдеры — только у ближних деревьев (дальние не мешают прогулке)
    for (const t of trees) {
      if (Math.hypot(t.x, t.z) < 80) ctx.colliders.circles.push({ x: t.x, z: t.z, r: 0.34 * t.s });
    }
  }

  /* ================================================================
   *  ВХОД В ПОДЗЕМЕЛЬЕ
   *
   *  Примерно в ста метрах от деревни, на северо-западе: скала с тёмным
   *  проёмом, ступени вниз, факелы по сторонам и каменная тропа от села.
   * ================================================================ */
  function buildDungeonGate() {
    const gate = dungeonGate();
    const B = new Builder();
    const M = ctx.M;

    /* ================================================================
     *  СКАЛА С ПРОЁМОМ
     *
     *  Локальные оси скалы: `+Z` — вглубь глыбы, `−Z` — наружу, к
     *  деревне. Проём выходит на фасад, то есть прямо на дорогу.
     *  За проёмом — короткий тоннель вглубь скалы.
     * ================================================================ */
    const PROEM_HW = 1.55;          // половина ширины проёма
    const PROEM_H = 3.1;            // высота проёма

    /** Валун в скале. */
    const boulder = (x, y, z, r, key) => {
      B.add(sphere(r, 7, 5), key, mat(x, y, z, ctx.rng() * 3, ctx.rng(), ctx.rng()));
    };

    // «тело» глыбы — сплошной массив за проёмом: на нём стоят верхние
    // валуны, поэтому скала не выглядит набором висящих камней
    B.put('cave', 10.5, 6.4, 3.4, 0, 3.2, 3.3, 1.2);
    B.put('caveDark', 7.0, 7.0, 2.6, 0, 3.4, 4.4, 1.2);
    B.put('caveDark', 7.8, 5.4, 2.2, 0, 2.6, 5.4, 1.2);
    // перемычка над проёмом — на неё опирается арка
    B.put('caveDark', 4.4, 1.5, 2.1, 0, 3.55, 0.6, 1.2);

    // боковые «столбы» скалы по краям проёма
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        boulder(sx * (PROEM_HW + 0.7 + ctx.rng() * 1.3), 0.8 + i * 1.05,
          0.9 + ctx.rng() * 1.4, 0.95 + ctx.rng() * 0.7,
          ctx.rng() > 0.5 ? 'cave' : 'caveDark');
      }
    }
    // арка над проёмом
    for (let i = 0; i < 7; i++) {
      const t = (i / 6 - 0.5) * 2 * (PROEM_HW + 0.5);
      boulder(t, PROEM_H + 0.35 + Math.cos(t * 0.9) * 0.55, 0.5 + ctx.rng() * 0.5,
        0.8 + ctx.rng() * 0.35, ctx.rng() > 0.5 ? 'cave' : 'caveDark');
    }
    // массив скалы сверху и по бокам — валуны лежат на теле глыбы
    for (let i = 0; i < 22; i++) {
      const a = ctx.rng() * Math.PI * 2;
      const rr = 3.2 + ctx.rng() * 2.8;
      const bx = Math.cos(a) * rr;
      const by = 4.6 + ctx.rng() * 3.0;
      if (Math.abs(bx) < PROEM_HW + 0.8 && by < PROEM_H + 1.4) continue;   // не заваливать вход
      boulder(bx, by, 2.4 + Math.sin(a) * rr * 0.4,
        0.9 + ctx.rng() * 1.1, ctx.rng() > 0.5 ? 'cave' : 'caveDark');
    }
    // цоколь скалы — чтобы глыба не «висела» над землёй (проём остаётся чистым)
    for (let i = 0; i < 14; i++) {
      const a = ctx.rng() * Math.PI * 2;
      const rr = 2.2 + ctx.rng() * 2.8;
      const bx = Math.cos(a) * rr, bz = 0.7 + Math.sin(a) * rr * 0.5;
      if (Math.abs(bx) < PROEM_HW + 0.2 && bz < 0.8) continue;            // не заваливать вход
      boulder(bx, 0.45 + ctx.rng() * 0.5, bz, 0.75 + ctx.rng() * 0.6, 'caveDark');
    }

    /* ================================================================
     *  ТОННЕЛЬ ЗА ПРОЁМОМ — уходит вглубь скалы
     * ================================================================ */
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        boulder(sx * (PROEM_HW + 0.25), 0.9 + i * 1.0, 1.6 + i * 0.9,
          0.72 + ctx.rng() * 0.2, 'caveDark');
      }
    }
    // свод тоннеля
    for (let i = 0; i < 4; i++) {
      boulder((ctx.rng() - 0.5) * 1.6, PROEM_H + 0.5, 1.4 + i * 0.8,
        0.68 + ctx.rng() * 0.18, 'caveDark');
    }
    // ступени, уходящие вниз в темноту
    for (let i = 0; i < 4; i++) {
      B.put('stone', 2.6, 0.26, 0.7, 0, 0.13 - i * 0.26, 1.2 + i * 0.62, 1.2);
    }

    /* ================================================================
     *  КАМЕННАЯ ЛЕСТНИЦА К ПРОЁМУ
     *
     *  Ступени стоят на земле и ведут от подножия к порогу (y = 1.6).
     *  Ничего не висит в воздухе: каждая ступень — камень на земле.
     * ================================================================ */
    const STEPS = 6;
    const STEP_Y = 1.6 / STEPS;
    const STEP_Z = 0.78;
    for (let i = 0; i < STEPS; i++) {
      const y = STEP_Y * (i + 1);
      const lz = -5.0 + i * STEP_Z;
      B.put('stone', 3.2, y + 0.16, STEP_Z + 0.14, 0, (y + 0.16) / 2 - 0.08, lz, 1.2);
      // подступенок — ступенька видна сбоку
      B.put('stoneDark', 3.2, 0.16, 0.22, 0, 0.08, lz + STEP_Z / 2, 1.2);
      const w = facadePos(gate.x, gate.z, gate.ry, 0, lz, y);
      ctx.platforms.push({ cx: w.x, cz: w.z, hx: 1.6, hz: STEP_Z / 2 + 0.14, ang: gate.ry, y });
    }
    // парапеты по бокам лестницы
    for (const sx of [-1, 1]) {
      for (let i = 0; i < STEPS; i++) {
        const y = STEP_Y * (i + 1);
        const lz = -5.0 + i * STEP_Z;
        B.put('stoneDark', 0.34, 0.9, STEP_Z + 0.1, sx * 1.72, y + 0.45, lz, 1.2);
        const w = facadePos(gate.x, gate.z, gate.ry, sx * 1.72, lz, y + 0.45);
        ctx.colliders.boxes.push({
          cx: w.x, cz: w.z, hx: 0.17, hz: STEP_Z / 2 + 0.05,
          ang: gate.ry, y0: y, y1: y + 0.9,
        });
      }
    }
    // площадка перед проёмом
    {
      const lz = -0.35;
      B.put('stoneDark', 3.6, 0.4, 1.8, 0, 1.4, lz, 1.2);
      const w = facadePos(gate.x, gate.z, gate.ry, 0, lz, 1.6);
      ctx.platforms.push({ cx: w.x, cz: w.z, hx: 1.8, hz: 0.9, ang: gate.ry, y: 1.6 });
      for (const sx of [-1, 1]) {
        B.put('stone', 0.3, 1.0, 1.8, sx * 1.75, 2.1, lz, 1.2);
        const r = facadePos(gate.x, gate.z, gate.ry, sx * 1.75, lz, 2.1);
        ctx.colliders.boxes.push({
          cx: r.x, cz: r.z, hx: 0.15, hz: 0.9, ang: gate.ry, y0: 1.6, y1: 2.6,
        });
      }
    }
    // косяки проёма
    for (const sx of [-1, 1]) {
      B.put('timber', 0.34, PROEM_H + 0.2, 0.5, sx * (PROEM_HW + 0.1), (PROEM_H + 0.2) / 2, 0.1, 1.2);
    }
    B.put('timber', PROEM_HW * 2 + 0.9, 0.36, 0.5, 0, PROEM_H + 0.2, 0.1, 1.2);

    /* ================================================================
     *  ЩИТ С ПРЕДУПРЕЖДЕНИЕМ У ПОДНОЖИЯ
     *
     *  На доске — костяная эмблема: оленьей череп с рогами.
     * ================================================================ */
    B.put('timber', 0.2, 1.7, 0.2, -2.9, 0.85, -4.9, 1.2);
    B.put('plank', 1.7, 1.0, 0.12, -2.9, 1.5, -4.9, 1.2);
    B.put('iron', 0.6, 0.13, 0.07, -2.9, 1.74, -4.97, 1.2);
    B.put('iron', 1.35, 0.08, 0.07, -2.9, 1.3, -4.97, 1.2);
    // рога
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        B.add(cone(0.075, 0.42, 5), 'bone',
          mat(-2.9 + sx * (0.42 + i * 0.09), 1.72 + i * 0.17, -4.98,
            0, 0, sx * (0.55 + i * 0.16)));
      }
    }
    // череп
    B.add(sphere(0.24, 8, 6), 'bone', mat(-2.9, 1.6, -4.99));
    B.add(sphere(0.15, 7, 5), 'bone', mat(-2.9, 1.42, -5.02));
    // глазницы
    for (const sx of [-1, 1]) {
      B.add(sphere(0.075, 6, 4), 'iron', mat(-2.9 + sx * 0.09, 1.63, -5.16));
    }

    // скала — из той же породы, что и стены пещеры
    const caveDark = new THREE.MeshStandardMaterial({
      map: M.cave.map, color: 0x9a9ab2, roughness: 1.0, metalness: 0.0,
    });
    const group = B.build({ ...M, cave: M.cave, caveDark }, null, { name: 'dungeonGate' });
    group.position.set(gate.x, 0, gate.z);
    group.rotation.y = gate.ry;
    ctx.scene.add(group);

    /* ---------------- фонари по сторонам лестницы ---------------- */
    for (const sx of [-1, 1]) {
      const l = lantern(M, ctx.glowTex, {
        height: 2.6, lit: true, intensity: 2.6, distance: 15,
      });
      const p = facadePos(gate.x, gate.z, gate.ry, sx * 2.35, -4.4, 0);
      ctx.scene.add(l.group);
      l.place(p.x, p.z, gate.ry);
      ctx.lanterns.push(l);
    }

    /* ---------------- из проёма светит холодным светом пещеры ---------------- */
    {
      const p = facadePos(gate.x, gate.z, gate.ry, 0, 0.9, 1.7);
      const glow = makeGlow(ctx.glowTex, 4.2, 0x6f9bff, 0.55);
      glow.position.copy(p);
      ctx.scene.add(glow);
      const l = new THREE.PointLight(0x5c8cff, 2.6, 13, 1.8);
      l.position.copy(p);
      ctx.scene.add(l);
    }

    /* ================================================================
     *  ДОРОГА ОТ ДЕРЕВНИ К СКАЛЕ
     *
     *  Идёт по северо-западной стороне села — обходя трактир и амбар,
     *  — и приходит к подножию лестницы.
     * ================================================================ */
    const trailPts = dungeonTrail();
    const trail = new Builder();
    const trailGroup = new THREE.Group();
    trailGroup.name = 'dungeonTrail';
    const stones = [];
    for (let i = 0; i < trailPts.length - 1; i++) {
      const [ax, az] = trailPts[i];
      const [bx, bz] = trailPts[i + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      const n = Math.max(2, Math.round(len / 1.5));
      const ang = Math.atan2(dx, dz);
      // сплошное полотно дороги: раньше здесь лежали отдельные плиты,
      // и в лесу тропа читалась как набор разрозненных камней
      {
        const tex = ctx.T.dirt.clone();
        tex.needsUpdate = true;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1.6, len / 3.2);
        const matRoad = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.98,
          polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
        });
        const road = new THREE.Mesh(new THREE.PlaneGeometry(3.0, len), matRoad);
        road.rotation.x = -Math.PI / 2;
        road.rotation.z = -ang;
        road.position.set((ax + bx) / 2, 0.045, (az + bz) / 2);
        road.receiveShadow = true;
        trailGroup.add(road);
      }
      // редкие плоские камни, утопленные в полотно (не лежат поверх)
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const px = ax + dx * t + (ctx.rng() - 0.5) * 0.5;
        const pz = az + dz * t + (ctx.rng() - 0.5) * 0.5;
        trail.add(box(0.85 + ctx.rng() * 0.5, 0.06, 0.6 + ctx.rng() * 0.3), 'stoneDark',
          mat(px, 0.038, pz, ang + (ctx.rng() - 0.5) * 0.3));
        stones.push([px, pz]);
      }
      // бордюр по краям дороги
      for (let k = 0; k <= n; k += 2) {
        const t = k / n;
        const px = ax + dx * t, pz = az + dz * t;
        const nx = -dz / len, nz = dx / len;
        for (const s of [-1, 1]) {
          trail.add(box(0.5, 0.22, 0.5), 'stone',
            mat(px + nx * s * 1.5, 0.1, pz + nz * s * 1.5, ang));
        }
      }
    }
    // пни-указатели вдоль дороги — с доской, смотрящей в сторону скалы
    for (let i = 1; i < trailPts.length - 1; i += 2) {
      const [px, pz] = trailPts[i];
      const side = ctx.rng() > 0.5 ? 1 : -1;
      const ox = px + 2.1 * side, oz = pz + 0.8;
      trail.add(cyl(0.24, 0.28, 1.05, 6), 'timber', mat(ox, 0.52, oz));
      const [nx, nz] = trailPts[i + 1] || trailPts[i];
      const a = Math.atan2(nx - px, nz - pz);
      trail.add(box(0.12, 0.44, 0.56), 'plank', mat(ox, 1.02, oz, a));
    }
    ctx.scene.add(trail.build(M, null, { name: 'dungeonTrailStones' }));
    ctx.scene.add(trailGroup);

    // указатель на выезде из села — «в скалу» показывает на северо-запад
    {
      const a = trailPts[1], b = trailPts[2];
      const ry = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
      ctx.scene.add(signpost(M, { x: -4.8, z: -14.2, ry }));
    }

    /* ================================================================
     *  КОЛЛАЙДЕРЫ СКАЛЫ
     *
     *  Угол прямоугольников — `gate.ry`: локальная ось X прямоугольника
     *  должна совпадать с локальной осью X скалы.
     * ================================================================ */
    const toWorld = (lx, lz) => facadePos(gate.x, gate.z, gate.ry, lx, lz, 0);
    for (const lx of [-(PROEM_HW + 1.5), PROEM_HW + 1.5]) {
      const w = toWorld(lx, 1.2);
      ctx.colliders.boxes.push({
        cx: w.x, cz: w.z, hx: 1.5, hz: 1.9, ang: gate.ry, y0: 0, y1: 4.8,
      });
    }
    const back = toWorld(0, 4.4);
    ctx.colliders.boxes.push({
      cx: back.x, cz: back.z, hx: 2.6, hz: 1.1, ang: gate.ry, y0: 0, y1: 3.8,
    });
  }

  /**
   * Собрать деревню целиком: здания, пропсы и животных.
   *
   * @param {Function} buildAnimals функция расстановки животных
   */
  function build(buildAnimals) {
    buildBuildings();
    buildProps();
    buildDungeonGate();
    buildAnimals();
  }

  return { build, buildBuildings, buildProps, buildDungeonGate };
}
