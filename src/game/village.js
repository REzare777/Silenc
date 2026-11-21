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
  woodcuttersHut,
} from '../world/buildings.js';
import {
  scatterGrass, scatterFlowers, wheatField, lantern, campfire, fence, gate, gardenBed,
  trough, signpost, makeGlow, cart,
} from '../world/props.js';
import { denseForest } from '../world/forest.js';
import { noticeBoard } from '../world/board.js';
import { chickenCoop, sheepShelter } from '../world/farm.js';
import { woodcuttersYard } from '../world/woodcutters.js';
import { felledClearing } from '../world/clearing.js';
import { ribbonGeometry, smoothPolyline, resample } from './roadmesh.js';
import { Embers } from '../world/particles.js';
import { Builder, box, cyl, sphere, cone, mat } from '../world/geo.js';
import {
  LAYOUT, ryToFace, facadePos, tavernDoor, dungeonGate, dungeonTrail, distToDungeonTrail,
} from './layout.js';
import { distToTrails, TRAIL_W } from './roads.js';





/**
 * Овечье пастбище: огороженный луг на западе от деревни.
 *
 * Овцам нужна своя земля — отдельная от огородов и от луга у пруда.
 * Здесь они пасутся, сидят под навесом и жуют траву.
 */
const PASTURE = {
  x: -45, z: 31, w: 13, d: 11,
  gate: { x: -38.6, z: 31, ang: 0 },
  fence: [
    [[-51.5, 25.5], [-38.6, 25.5]],
    [[-38.6, 25.5], [-38.6, 36.5]],
    [[-38.6, 36.5], [-51.5, 36.5]],
    [[-51.5, 36.5], [-51.5, 25.5]],
  ],
  // места для животных внутри загона
  graze: [
    { x: -43, z: 29 }, { x: -47, z: 33 }, { x: -45, z: 28 },
  ],
  rest: { x: -49, z: 31 },
};

/**
 * Курятник: маленький загон между домами, на западной стороне улицы.
 *
 * Куры не должны шляться по площади, мельнице и пруду — у них свой закут.
 */
const HENYARD = {
  x: -16, z: 22, w: 6, d: 8,
  fence: [
    [[-19, 18], [-13, 18]],
    [[-13, 18], [-13, 26]],
    [[-13, 26], [-19, 26]],
    [[-19, 26], [-19, 18]],
  ],
  gate: { x: -13, z: 21.4, ang: Math.PI / 2 },
  coops: [[-17.4, 20.2], [-17.4, 23.6]],
};


/**
 * Поляны вокруг зданий: здесь деревья не растут.
 *
 * Без этого опушка леса подступала вплотную к церкви и мельнице (они стоят
 * как раз на опушке) — к стенам примыкали стволы, и вокруг здания нельзя было
 * пройти.
 *
 * @type {[number, number, number][]} [x, z, радиус]
 */
// Колокольня стоит за северным фасадом храма — ей нужна своя поляна,
// иначе лес зарастает её вплотную и подхода нет.
const CHURCH_RY = ryToFace([LAYOUT.church.x, LAYOUT.church.z], [0, 0]);
// Колокольня за нефом (внешняя): в локальных осях храма её центр
// на 13,4 м севернее. Проверкам дорог она нужна: без неё тропинка
// «проходит» сквозь башню.
const CHURCH_BELL_TOWER = {
  x: LAYOUT.church.x + 13.4 * Math.sin(CHURCH_RY),
  z: LAYOUT.church.z + 13.4 * Math.cos(CHURCH_RY),
};

const CHURCH_TOWER = {
  x: LAYOUT.church.x - 9.7 * Math.sin(CHURCH_RY),
  z: LAYOUT.church.z - 9.7 * Math.cos(CHURCH_RY),
};

/**
 * Лесная делянка на опушке: избушка лесоруба, поленница, чурбан.
 * Раньше здесь стоял амбар — большой красный сарай посреди леса, он
 * и читался «не в тему». Теперь это маленькая лесная работа.
 */
const WOODS = { x: -45, z: 13 };

const BUILDING_CLEARINGS = [
  [LAYOUT.church.x, LAYOUT.church.z, 12],
  [LAYOUT.church.x + 0.9, LAYOUT.church.z + 13.4, 15],   // колокольня
  [CHURCH_TOWER.x, CHURCH_TOWER.z, 11],
  [LAYOUT.mill.x, LAYOUT.mill.z, 14],
  [LAYOUT.tavern.x, LAYOUT.tavern.z, 14],
  // амбар: вырубка широкая — сараю нужно поле, а не частокол
  [LAYOUT.barn.x, LAYOUT.barn.z, 18],
  [LAYOUT.blacksmith.x, LAYOUT.blacksmith.z, 9],
  [LAYOUT.well.x, LAYOUT.well.z, 6],
  [PASTURE.x, PASTURE.z, 16],          // овечье пастбище — лес вырублен
  [WOODS.x, WOODS.z, 12],              // лесная делянка на опушке — лес вырублен
];

/**
 * Поля — лес не растёт ни на поле, ни по его кромке.
 *
 * Раньше в пшеницу western-поля и восточного поля упирались берёзы:
 * колосья стояли прямо в стволах. Список полей — тот же, что и
 * `ctx.fields`, чтобы правки не разъезжались.
 */
const FIELD_CLEARINGS = [
  [-30, 50, 20, 12], [31, 44, 19, 14],
  [82, -20, 20, 12], [96, -6, 16, 14], [80, -2, 18, 12],
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
    // Габариты построек и реестр уличных предметов: их используют
    // проверки планировки (дороги не идут сквозь стены, предметы не
    // стоят внутри дома).
    ctx.footprints = ctx.footprints || [];
    ctx.propSpots = ctx.propSpots || [];

    /* --- таверна «Уставший вепрь» --- */
    const t = tavern(ctx.M, {});
    const tavernRy = ryToFace([LAYOUT.tavern.x, LAYOUT.tavern.z], [0, 0]);
    const tPlaced = place(t, LAYOUT.tavern.x, LAYOUT.tavern.z, tavernRy);
    ctx.footprints.push({ name: 'таверна', x: LAYOUT.tavern.x, z: LAYOUT.tavern.z, hx: 7.5, hz: 9, ry: tavernRy });
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
    const bsRy = ryToFace([LAYOUT.blacksmith.x, LAYOUT.blacksmith.z], [0, -2]);
    place(bs, LAYOUT.blacksmith.x, LAYOUT.blacksmith.z, bsRy);
    ctx.footprints.push({ name: 'кузня', x: LAYOUT.blacksmith.x, z: LAYOUT.blacksmith.z, hx: 3, hz: 2.5, ry: bsRy });
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
    ctx.footprints.push({ name: 'храм', x: LAYOUT.church.x, z: LAYOUT.church.z, hx: 4.75, hz: 8.75, ry: chRy });
    // Колокольня за нефом и крыльцо-башня на южном фасаде — их тоже надо
    // знать проверкам: без них дорога может «пройти» сквозь башню.
    ctx.footprints.push({ name: 'колокольня', x: CHURCH_BELL_TOWER.x, z: CHURCH_BELL_TOWER.z, hx: 4.9, hz: 4.9, ry: chRy });
    ctx.footprints.push({ name: 'крыльцо храма', x: CHURCH_TOWER.x, z: CHURCH_TOWER.z, hx: 2.3, hz: 2.3, ry: chRy });
    // вход в храм — через башню-колокольню (южный фасад), как и прежде
    addInteract(
      facadePos(3, 44, chRy, 0, -12.4, 1.8), 2.6, 'Войти в храм',
      () => ctx.systems.locations.setLocation('church'),
    );
    // точка выхода из храма — перед ступенями башни, на земле
    {
      const out = facadePos(3, 44, chRy, 0, -14.2, 0);
      ctx.doors.church = { x: out.x, z: out.z, ry: chRy };
    }
    // сзади храма — рабочая дверь колокольни: через неё попадают в башню
    // Дверь колокольни — в северной стене башни (локально z = 18,3).
    // Раньше интеракт стоял на 4 м внутри башни: подойти к нему было
    // нельзя, и выход из звонарной выбрасывал игрока в камень.
    addInteract(
      facadePos(3, 44, chRy, 0, 19.6, 1.4), 2.8, 'Войти в колокольню',
      () => ctx.systems.locations.setLocation('church', 'back'),
    );
    {
      // точка выхода через колокольню — в заднем дворе у двери башни
      const back = facadePos(3, 44, chRy, 0, 19.6, 0);
      ctx.doors.churchBack = { x: back.x, z: back.z, ry: chRy };
    }
    // фонарь у двери башни — иначе её не видно
    {
      const lp = facadePos(3, 44, chRy, 2.7, 19.4, 0);
      const cl = lantern(ctx.M, ctx.glowTex, { x: lp.x, z: lp.z, height: 3.5, lit: true, intensity: 2.5, distance: 13 });
      ctx.scene.add(cl.group);
      cl.place(lp.x, lp.z);
      ctx.lanterns.push(cl);
      addInteract(cl.pos.clone(), 2.0, 'Погасить фонарь',
        () => { cl.setLit(!cl.lit); ctx.ui.toast(cl.lit ? 'Фонарь снова горит.' : 'Фонарь погашен.'); });
    }
    // Свет у задней двери: северный фасад в тени, и без подсветки
    // проём с дверью читался как чёрная дыра. Фонарь на кронштейне —
    // в buildings.js, здесь только источник света.
    {
      const lp = facadePos(3, 44, chRy, 0, 19.5, 0);
      const dl = new THREE.PointLight(0xffcf8a, 7, 8.5, 1.6);
      dl.position.set(lp.x, 3.0, lp.z);
      dl.castShadow = false;
      ctx.scene.add(dl);
    }

    /* --- амбар --- */
    const barnB = barn(ctx.M, {});
    const barnRy = ryToFace([LAYOUT.barn.x, LAYOUT.barn.z], [-10, -4]);
    place(barnB, LAYOUT.barn.x, LAYOUT.barn.z, barnRy);
    ctx.footprints.push({ name: 'амбар', x: LAYOUT.barn.x, z: LAYOUT.barn.z, hx: 6.15, hz: 4.15, ry: barnRy });
    // прогалина под амбаром: лес вырублен, но земля — зелёная, не лесная подстилка
    grassPatch(LAYOUT.barn.x + 1, LAYOUT.barn.z - 1, 16);
    addInteract(
      facadePos(LAYOUT.barn.x, LAYOUT.barn.z, barnRy, 0, -4.4, 1.6), 2.8, 'Войти в амбар',
      () => ctx.systems.locations.setLocation('barn'),
    );

    /* --- мельница --- */
    const mill = windmill(ctx.M, { r: 3.5, h: 11.6 });   // мельница выше
    ctx.mill.ref = mill;
    const millX = LAYOUT.mill.x, millZ = LAYOUT.mill.z, millRy = LAYOUT.mill.ry;
    place(mill, millX, millZ, millRy);
    ctx.footprints.push({ name: 'мельница', x: millX, z: millZ, r: 3.92, ry: millRy });
    ctx.mill.blades = mill.blades;
    ctx.mill.cap = mill.cap;
    ctx.mill.landingGeom = mill.landingGeom || null;   // стык перемычки и площадки
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
    ctx.footprints.push({ name: 'колодец', x: LAYOUT.well.x, z: LAYOUT.well.z, hx: 1.5, hz: 1.5, ry: 0 });
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
     *   D (-26, 29) / (26, 29)     — второй ряд у поля
     *   E (-29, -22) / (29, -22)   — южная окраина, в сторону пруда
     *   F (-19, -34) / (19, -34)   — дальний отшиб, у скалы
     */
    // Участки разнесены по-настоящему: между соседями 7-11 м свободного
    // места, двор от улицы 6+ м, а дом у пруда (пара E) стоит в 12 м от
    // воды и не заходит на лужайку.
    // Стены подняты на 25-35 см: раньше часть домов читалась «просевшей» —
    // цоколь почти тонул в земле, а стены выглядели короткими.
    const homes = [
      [-13, 14, { w: 6, d: 5, h: 3.45, roof: 'thatch', floors: 1 }],
      [13, 14, { w: 6, d: 5, h: 3.45, roof: 'thatch', floors: 1 }],
      [-13, 31, { w: 6, d: 5, h: 3.35, roof: 'tile', floors: 1 }],
      [13, 31, { w: 6, d: 5, h: 3.35, roof: 'tile', floors: 1 }],
      [-31, 14, { w: 7, d: 6, h: 3.7, roof: 'tile', floors: 2 }],
      [31, 14, { w: 7, d: 6, h: 3.7, roof: 'tile', floors: 2 }],
      [-26, 29, { w: 6, d: 5, h: 3.45, roof: 'thatch', floors: 1 }],
      [26, 29, { w: 6, d: 5, h: 3.45, roof: 'thatch', floors: 1 }],
      [-40, -8, { w: 6, d: 5, h: 3.35, roof: 'thatch', floors: 1 }],
      [29, -22, { w: 6, d: 5, h: 3.35, roof: 'thatch', floors: 1 }],
      [-19, -34, { w: 5.5, d: 4.6, h: 3.25, roof: 'thatch', floors: 1 }],
      [19, -34, { w: 5.5, d: 4.6, h: 3.25, roof: 'thatch', floors: 1 }],
    ];
    const wallKinds = ['plaster', 'plasterWarm', 'plasterGrey'];
    const houseLines = [
      'Дом у костра: свет в окнах горит до полуночи.',
      'Дом напротив костра. На крыльце — закопчённая грядка.',
      'Дом в глубине улицы. Дверь выкрашена в синий.',
      'Дом с большим огородом за ним.',
      'Двухэтажный дом: внизу печь, наверху сушатся травы.',
      'Двухэтажный дом с мастерской — слышно, как точат.',
      'Дом ближе к храму: отсюда слышен колокол.',
      'Дом у поля. Ветер пахнет скошенной травой.',
      'Дом на южной окраине, за трактиром. Тишина.',
      'Дом у дальнего пруда: слышно, как плещется вода.',
      'Дом на отшибе: забор, поле и тишина.',
      'Дом у мельницы: слышно, как скрипят жернова.',
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
      // фонарь у двери дома — источник в общем пуле, а не отдельная лампа
      if (placed.lampPos) {
        ctx.roomLights.push({ pos: placed.lampPos, lit: true, power: 1, flicker: i + 11, baseIntensity: 2.2, distance: 8 });
      }
      if (c.chimney) ctx.smokeSources.push({ pos: c.chimney.clone(), rate: 0.11 });
      // дверь дома запоминаем — отсюда игрок вернётся из локации
      const doorPos = facadePos(h[0], h[1], hry, 0, -h[2].d / 2 - 1.5);
      ctx.doors.homes = ctx.doors.homes || [];
      ctx.doors.homes[i] = { x: doorPos.x, z: doorPos.z, ry: hry };
      // список домов с габаритами — им пользуются проверки планировки
      ctx.homes = ctx.homes || [];
      ctx.footprints.push({
        name: `дом ${i}`, x: h[0], z: h[1], hx: h[2].w / 2 + 0.2, hz: h[2].d / 2 + 0.2, ry: hry,
      });
      ctx.homes[i] = {
        i, x: h[0], z: h[1], w: h[2].w, d: h[2].d, ry: hry,
        doorGeom: placed.doorGeom || null,     // метрики двери для проверок
      };
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
    // прилавки — у колодца и площади: один из них раньше стоял прямо
    // перед дверью трактира и закрывал подход к ней
    const stalls = [[5.6, 5.6, 'fabric'], [-5.8, 6.4, 'fabric2'], [6.4, -6.2, 'fabric2'], [-8.0, 0.0, 'fabric']];
    const stallLines = [
      'На прилавке — мед, репа и кусок сыра.',
      'Ткани, ленты и пряжа. Торговец здоровается кивком.',
      'Кувшин с квасом и свежие лепёшки.',
      'Здесь продают дичь, мёд и всё, что поймали за ночь.',
    ];
    stalls.forEach(([sx, sz, cl], i) => {
      const st = marketStall(ctx.M, { cloth: cl });
      place(st, sx, sz, ryToFace([sx, sz], [0, 0]) + Math.PI);
      ctx.propSpots.push({ name: 'прилавок', x: sx, z: sz, r: 1.2 });
      addInteract(
        new THREE.Vector3(sx, 1.2, sz), 2.0, 'Осмотреть прилавок',
        () => ctx.ui.toast(stallLines[i % stallLines.length]),
      );
    });

    /* --- стога сена --- */
    // Стоги перенесены за озеро, на поля: там, где в этом году собрали
    // зерно. В деревне они больше не стоят и не загораживают обход.
    const haystacks = [[75, -13], [88, -26], [99, -8], [69, 4]];
    for (const [hx, hz] of haystacks) {
      place(haystack(ctx.M, { r: 1.5, h: 2.6 }), hx, hz);
      ctx.propSpots.push({ name: 'стог', x: hx, z: hz, r: 1.5 });
      addInteract(
        new THREE.Vector3(hx, 1.4, hz), 2.1, 'Забраться на стог',
        () => ctx.ui.toast('Сено тёплое и шуршащее. Отсюда видно всю долину.'),
      );
    }
  }

  /* ================================================================
   *  ХОЗЯЙСТВО: пастбище и курятник
   * ================================================================ */

  /**
   * Зелёная лужайка поверх тёмной лесной подстилки.
   *
   * Под лесом земля тёмная — на пастбище и полях это смотрелось бы
   * странно: луг должен быть зелёным.
   *
   * @param {number} cx центр X
   * @param {number} cz центр Z
   * @param {number} r радиус
   */
  function grassPatch(cx, cz, r) {
    const m = ctx.M.grass.clone();
    if (m.map) {
      m.map = m.map.clone();
      m.map.needsUpdate = true;
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.repeat.set(r / 4, r / 4);
    }
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 44), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.02, cz);
    mesh.receiveShadow = true;
    mesh.name = 'grassPatch';
    ctx.scene.add(mesh);
  }

  /**
   * Вспаханная земля под поле — колосья растут из тёмной почвы.
   *
   * @param {number} cx центр X
   * @param {number} cz центр Z
   * @param {number} w ширина
   * @param {number} d глубина
   */
  function soilPatch(cx, cz, w, d) {
    const m = ctx.M.dirt.clone();
    if (m.map) {
      m.map = m.map.clone();
      m.map.needsUpdate = true;
      m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping;
      m.map.repeat.set(w / 4, d / 4);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.021, cz);
    mesh.receiveShadow = true;
    mesh.name = 'soilPatch';
    ctx.scene.add(mesh);
  }

  /** Поставить пастбище для овец и курятник для кур. */
  function buildFarm() {
    // лужайки: пастбище, поля за озером и двор курятника
    grassPatch(PASTURE.x, PASTURE.z, 11);
    grassPatch(88, -10, 33);
    grassPatch(HENYARD.x, HENYARD.z, 6.5);
    // вспаханная земля под полями за озером
    soilPatch(82, -20, 20, 12);
    soilPatch(96, -6, 16, 14);
    soilPatch(80, -2, 18, 12);

    /* --- овечье пастбище --- */
    {
      const shelter = sheepShelter(ctx.M, { w: 3.6, d: 2.6, h: 2.0 });
      shelter.position.set(PASTURE.rest.x + 0.6, 0, PASTURE.rest.z);
      shelter.rotation.y = Math.PI / 2;
      ctx.scene.add(shelter);
      ctx.colliders.boxes.push(localBox(PASTURE.rest.x + 0.6, PASTURE.rest.z, Math.PI / 2, 0, 0, 1.8, 1.4));

      // поилка у края загона
      ctx.scene.add(trough(ctx.M, { x: -42.4, z: 27.2, ry: 0.2 }));
      ctx.colliders.boxes.push(localBox(-42.4, 27.2, 0.2, 0, 0, 2.4, 0.9));

      // трава и цветы на выпасе
      ctx.scene.add(scatterGrass(ctx.M, [
        { x: -45, z: 31, r: 6.5 }, { x: -48, z: 34, r: 3.5 },
      ], 260));
      const fl = scatterFlowers(ctx.M, [{ x: -45, z: 31, r: 6 }], 26);
      ctx.scene.add(fl);
      ctx.scene.userData.flowers = fl;
      ctx.pasture = PASTURE;
    }

    /* --- курятник --- */
    {
      for (const [cx, cz] of HENYARD.coops) {
        const coop = chickenCoop(ctx.M, {});
        coop.position.set(cx, 0, cz);
        coop.rotation.y = Math.PI / 2 + (cz > 22 ? -0.25 : 0.2);
        ctx.scene.add(coop);
        ctx.colliders.boxes.push(localBox(cx, cz, coop.rotation.y, 0, 0, 1.1, 0.8));
        ctx.propSpots.push({ name: 'курятник', x: cx, z: cz, r: 1.2 });
      }
      // солома на земле
      ctx.scene.add(scatterGrass(ctx.M, [{ x: -16, z: 22, r: 3 }], 90));
      ctx.henyard = HENYARD;
    }
  }

  /* ================================================================
   *  ДОСКА ДЛЯ ЗАПИСКИ ЗАПИСКИ
   *
   *  У маленького домика на отшибе (того, что смотрит в сторону скалы)
   *  стоит доска. К ней можно подойти и ОДИН раз за игру что-то написать
   *  углём — надпись остаётся на доске навсегда.
   * ================================================================ */

  /** Поставить доску и включить взаимодействие с ней. */
  /**
   * Лесная делянка на опушке: избушка лесоруба, поленница, чурбан.
   *
   * Раньше здесь стоял амбар, и он читался «не в тему»: большой
   * красный сарай на тёмном лесном полу, без поля рядом и без дороги.
   * Теперь это маленькая лесная работа у опушки, а амбар стоит
   * у края village-поля.
   */
  /**
   * Вырубка вокруг амбара: пеньки и срубленные стволы по кромке поляны.
   *
   * Без них пустая поляна читается как «здесь просто нет деревьев».
   * С пеньками видно, что лес здесь намеренно отжали.
   */
  function buildBarnClearing() {
    const cl = felledClearing(ctx.M, {
      x: LAYOUT.barn.x, z: LAYOUT.barn.z,
      inner: 11, outer: 17,
      avoid: [
        // дорога к воротам и подход с юга
        { x: LAYOUT.barn.x + 1.5, z: LAYOUT.barn.z - 5.2, r: 5.5 },
        { x: LAYOUT.barn.x - 3, z: LAYOUT.barn.z - 9, r: 5 },
      ],
      seed: 21,
    });
    place(cl, LAYOUT.barn.x, LAYOUT.barn.z);
    // колода у края поляны — видно, откуда взялись брёвна
    ctx.propSpots.push({ name: 'пень', x: LAYOUT.barn.x + 12, z: LAYOUT.barn.z + 3, r: 0.5 });

    // телега у боковой стены: двор без дела выглядит пустым
    {
      const cx = LAYOUT.barn.x - 9.2, cz = LAYOUT.barn.z + 4.6;
      const c = cart(ctx.M, { x: cx, z: cz, ry: 0.9 });
      ctx.scene.add(c);
      ctx.colliders.circles.push({ x: cx, z: cz, r: 1.4 });
      ctx.propSpots.push({ name: 'телега', x: cx, z: cz, r: 1.5 });
    }
  }

  function buildWoodcuttersYard() {
    const yard = woodcuttersYard(ctx.M, {});
    const ry = ryToFace([WOODS.x, WOODS.z], [-38, 10]);
    place(yard, WOODS.x, WOODS.z, ry);
    ctx.footprints.push({ name: 'лесная делянка', x: WOODS.x, z: WOODS.z, hx: 2.6, hz: 2.2, ry });

    // зелёная прогалина: без неё делянка стоит на тёмном лесном подстилке
    grassPatch(WOODS.x - 0.5, WOODS.z - 0.5, 7.5);

    // фонарь у избушки — сбоку от крыльца, чтобы не стоял в дверях
    {
      const lx = WOODS.x + 3.4, lz = WOODS.z + 2.2;
      const l = lantern(ctx.M, ctx.glowTex, { height: 3.0, lit: true, intensity: 2.2, distance: 12 });
      l.place(lx, lz);
      ctx.scene.add(l.group);
      ctx.lanterns.push(l);
      ctx.propSpots.push({ name: 'фонарь', x: lx, z: lz, r: 0.25 });
      ctx.interactables.push({
        pos: l.pos.clone(), radius: 2.1,
        labelFn: () => (l.lit ? 'Погасить фонарь' : 'Зажечь фонарь'),
        act: () => { l.setLit(!l.lit); ctx.ui.toast(l.lit ? 'Фонарь снова горит.' : 'Фонарь погашен.'); },
      });
    }

    // поленница — с подсказкой
    addInteract(
      new THREE.Vector3(WOODS.x + 2.4, 1.0, WOODS.z - 1.2), 2.4, 'Осмотреть поленницу',
      () => ctx.ui.toast('Дрова сухие, хвойные. На зиму хватит — лесоруб складывал всю зиму.', 3800),
    );
  }

  function buildNoticeBoard() {
    const BX = -23.8, BZ = -29.2, BRY = 0.79;   // у дороги к скале, лицом к деревне
    const board = noticeBoard(ctx.M, { w: 1.9, h: 1.2, postH: 1.35 });
    board.group.position.set(BX, 0, BZ);
    board.group.rotation.y = BRY;
    ctx.scene.add(board.group);
    ctx.colliders.circles.push({ x: BX, z: BZ, r: 0.45 });
    ctx.propSpots.push({ name: 'доска', x: BX, z: BZ, r: 0.9 });

    // Дом, у которого стоит доска: пёс ждёт именно здесь. Ищем по
    // расстоянию от доски до крыльца, а не по зашитому номеру.
    ctx.boardHome = -1;
    let bestD = 1e9;
    for (const h of ctx.homes || []) {
      const door = (ctx.doors.homes || [])[h.i];
      if (!door) continue;
      const d = Math.hypot(door.x - BX, door.z - BZ);
      if (d < bestD) { bestD = d; ctx.boardHome = h.i; }
    }

    // сохранённая надпись (если игрок уже писал)
    let written = '';
    try {
      written = localStorage.getItem('wv.note') || '';
    } catch (e) { written = ''; }
    if (written) board.setText(written, 'написано углём');
    ctx.boardNote = written;

    const it = {
      pos: new THREE.Vector3(BX, 1.4, BZ),
      radius: 2.3,
      labelFn: () => (ctx.boardNote ? 'Прочитать записку' : 'Написать на доске'),
      act: () => {
        if (ctx.boardNote) {
          ctx.ui.toast(`На доске: «${ctx.boardNote}»`, 4200);
          return;
        }
        // открываем окно записи: игра встаёт на паузу, курсор доступен
        if (ctx.mode === 'inv') ctx.systems.bag.close();
        if (ctx.mode === 'menu') ctx.ui.closeMenu();
        ctx.mode = 'note';
        ctx.player.acceptInput = false;
        ctx.player.keys.clear();
        if (document.pointerLockElement === ctx.renderer.domElement) document.exitPointerLock();
        ctx.ui.onNoteCancel = () => {
          ctx.mode = 'play';
          ctx.player.acceptInput = true;
          ctx.player.enabled = true;
          ctx.player.keys.clear();
          ctx.player.requestLock();
        };
        ctx.ui.openNote('', (text) => {
          // окно закрылось — возвращаем управление игроку
          ctx.mode = 'play';
          ctx.player.acceptInput = true;
          ctx.player.enabled = true;
          ctx.player.keys.clear();
          ctx.player.requestLock();
          if (!text) { ctx.ui.toast('Пустая доска. Ладно, в следующий раз.', 2200); return; }
          ctx.boardNote = text;
          board.setText(text, 'написано углём');
          try { localStorage.setItem('wv.note', text); } catch (e) { /* без localStorage — просто не сохраняем */ }
          ctx.ui.toast('Уголь кончился. Больше написать не получится.', 3200);
        });
      },
    };
    ctx.interactables.push(it);
    ctx.boardInteract = it;
  }

  /* ================================================================
   *  Уличные пропсы
   * ================================================================ */

  /** Расставить фонари, костёр, заборы, растительность и лес. */
  function buildProps() {
    // Реестр уличных предметов: проверки планировки ищут здесь всё, что
    // стоит на улице, и смотрят, не залезло ли что-нибудь внутрь дома.
    ctx.propSpots = ctx.propSpots || [];
    /* --- фонари вдоль улицы --- */
    const lanternSpots = [
      [3.6, 3.6, true], [-3.8, 4.2, true], [3.8, -4.4, true], [-4.2, -3.6, true],
      [2.7, 12, true], [-2.9, 12, false], [2.9, -14, true], [-3.0, -18, false],
      [2.9, 24, false], [-3.0, 27, false], [-2.9, 34, false], [-3.0, 38, false],
      [-10.5, 6.5, false], [10.5, 6.5, false], [-7.6, -4.6, false], [11, -9, false],
    ];
    for (const [lx, lz, withLight] of lanternSpots) {
      const l = lantern(ctx.M, ctx.glowTex, {
        x: lx, z: lz, height: 3.1, lit: true,
        intensity: withLight ? 2.6 : 1.2, distance: withLight ? 16 : 9,
      });
      ctx.scene.add(l.group);
      l.place(lx, lz);
      ctx.lanterns.push(l);
      ctx.propSpots.push({ name: 'фонарь', x: lx, z: lz, r: 0.25 });
      if (withLight) {
        ctx.interactables.push({
          pos: l.pos.clone(), radius: 2.1,
          labelFn: () => (l.lit ? 'Погасить фонарь' : 'Зажечь фонарь'),
          act: () => { l.setLit(!l.lit); ctx.ui.toast(l.lit ? 'Фонарь снова горит.' : 'Фонарь погашен.'); },
        });
      }
    }

    /* --- костёр «за город»: поляна у пруда --- */
    // Костёр перенесён с площади за пределы деревни — на поляну у воды,
    // в стороне от домов. Это место для посиделок: брёвна, поленница,
    // фонари и вид на пруд. С площади он убран совсем.
    const FIRE = { x: 44, z: -32 };   // отодвинут от самого берега: 8,7 м до кромки воды
    ctx.campfirePos = { x: FIRE.x, z: FIRE.z };   // положение костра для проверок
    const fire = campfire(ctx.M, ctx.glowTex);
    fire.group.position.set(FIRE.x, 0, FIRE.z);
    ctx.scene.add(fire.group);
    ctx.emberSys = new Embers(ctx.scene, ctx.glowTex, new THREE.Vector3(FIRE.x, 0.6, FIRE.z));
    ctx.colliders.circles.push({ x: FIRE.x, z: FIRE.z, r: 1.0 });   // круг камней костра
    ctx.interactables.push({
      pos: new THREE.Vector3(FIRE.x, 1, FIRE.z), radius: 2.8, label: 'Подбросить дрова',
      act: () => { ctx.fireBoost = 12; ctx.ui.toast('Огонь разгорелся — тепло до ушей.'); },
    });
    ctx.animated.push((tt) => {
      const f = 0.75 + Math.sin(tt * 9.1) * 0.12 + Math.sin(tt * 21.7) * 0.07;
      fire.flame.scale.set(0.9 + f * 0.2, f * 1.35, 0.9 + f * 0.2);
      fire.flame.rotation.y = tt * 1.4;
      fire.light.intensity = (2.2 + f * 1.4) * (1 + ctx.fireBoost * 0.1);
      fire.glow.scale.setScalar(3.2 + f * 0.9 + ctx.fireBoost * 0.04);
    });

    /* --- поляна кострища: брёвна, поленница, фонари --- */
    {
      // Светлого пятна утрамбованной земли здесь больше нет: костёр стоит
      // прямо на лесной подстилке, без «круглой площадки» под ним.
      const GB = new Builder();
      // четыре бревна-скамейки кругом: сесть можно в любую сторону от огня
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.45;
        const bx = FIRE.x + Math.cos(a) * 3.1;
        const bz = FIRE.z + Math.sin(a) * 3.1;
        const ry = a - Math.PI / 2;            // бревно лежит поперёк радиуса
        // чурбан-сиденье
        GB.add(cyl(0.26, 0.24, 2.5, 8), 'bark', mat(bx, 0.44, bz, ry, 0, Math.PI / 2, 1));
        // кочерыги-опоры
        for (const s of [-1, 1]) {
          GB.add(cyl(0.11, 0.13, 0.42, 6), 'timber',
            mat(bx + Math.sin(a) * s * 0.95, 0.21, bz + Math.cos(a) * s * 0.95));
        }
        ctx.colliders.circles.push({ x: bx, z: bz, r: 0.9 });
      }
      // поленница у края поляны
      {
        const wx = FIRE.x + 3.9, wz = FIRE.z - 2.6;
        for (let i = 0; i < 9; i++) {
          const row = Math.floor(i / 3), col = i % 3;
          GB.add(cyl(0.12, 0.12, 1.2, 6), 'timber',
            mat(wx + (col - 1) * 0.26, 0.14 + row * 0.24, wz, 0, 0.3, Math.PI / 2, 1));
        }
        ctx.colliders.circles.push({ x: wx, z: wz, r: 0.75 });
      }
      // два валуна у костра — круг кострища
      for (const [ax, az, rr] of [[-2.2, 1.9, 0.46], [1.6, 2.4, 0.36]]) {
        GB.add(sphere(rr, 7, 5), 'stone',
          mat(FIRE.x + ax, rr * 0.45, FIRE.z + az, 0.4, 0.3, 0.2, 1));
      }
      ctx.scene.add(GB.build(ctx.M, null, { name: 'fireGlade' }));

      // фонари на столбах по краям поляны: вечером горит целый костёр
      for (const [ax, az] of [[-5.4, 1.2], [4.6, 3.6]]) {
        const l = lantern(ctx.M, ctx.glowTex, { height: 3.4, lit: true, intensity: 2.6, distance: 14 });
        l.place(FIRE.x + ax, FIRE.z + az);
        ctx.scene.add(l.group);
        ctx.lanterns.push(l);
        ctx.colliders.circles.push({ x: FIRE.x + ax, z: FIRE.z + az, r: 0.22 });
      }
    }

    // бочки, ящики, мешки и повозки убраны из деревни — теперь всё в амбаре (см. world/barn.js)
    // Поилка — у курятника, а не внутри дома: раньше она стояла в стенах
    // дома C и была видна только изнутри.
    ctx.scene.add(trough(ctx.M, { x: 16.2, z: 19.4, ry: 0.3 }));
    ctx.scene.add(signpost(ctx.M, { x: 3.2, z: 13.5, ry: -0.5 }));
    ctx.propSpots.push({ name: 'поилка', x: 16.2, z: 19.4, r: 1.2 });
    ctx.propSpots.push({ name: 'указатель', x: 3.2, z: 13.5, r: 0.3 });
    // поилка — по фактическому размеру
    ctx.colliders.boxes.push(localBox(16.2, 19.4, 0.3, 0, 0, 2.4, 0.9));
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
    field(-30, 50, 20, 12);   // поле отодвинуто от деревни: между ним и домами лес
    field(31, 44, 19, 14);
    // --- поля за озером: здесь идёт вся добыча зерна ---
    field(82, -20, 20, 12);
    field(96, -6, 16, 14);
    field(80, -2, 18, 12);
    // --- овечье пастбище (запад) и курятник (между домами) ---
    PASTURE.fence.forEach((s) => fenceSegs.push(s));
    PASTURE.fence.forEach((s) => {
      const [a, b] = s;
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
    });
    gates.push({ x: PASTURE.gate.x, z: PASTURE.gate.z, ang: PASTURE.gate.ang });
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
    ctx.scene.add(wheatField(ctx.M, -30, 50, 20, 12));
    ctx.scene.add(wheatField(ctx.M, 31, 44, 19, 14));
    // поля за озером — главная зерновая полоса долины
    ctx.scene.add(wheatField(ctx.M, 82, -20, 20, 12));
    ctx.scene.add(wheatField(ctx.M, 96, -6, 16, 14));
    ctx.scene.add(wheatField(ctx.M, 80, -2, 18, 12));
    // список полей — для проверок планировки
    ctx.fields = FIELD_CLEARINGS.map(([x, z, w, d]) => ({ x, z, w, d }));

    const spots = [
      { x: -12, z: 4, r: 5 }, { x: 12, z: 4, r: 5 }, { x: -18, z: -16, r: 5 },
      { x: 18, z: -15, r: 5 }, { x: -6, z: 22, r: 6 }, { x: 8, z: 25, r: 6 },
      { x: -20, z: 6, r: 6 }, { x: 21, z: 7, r: 6 }, { x: 0, z: 34, r: 7 },
      { x: 26, z: 24, r: 6 }, { x: -30, z: -28, r: 7 }, { x: 30, z: -26, r: 7 },
      { x: 38, z: 6, r: 6 }, { x: 74, z: -30, r: 6 }, { x: 92, z: -28, r: 5 },
      { x: 66, z: 6, r: 5 }, { x: 100, z: -16, r: 5 },
    ];
    ctx.scene.add(scatterGrass(ctx.M, spots, 1100));
    const flowers = scatterFlowers(ctx.M, spots, 70);
    ctx.scene.add(flowers);
    ctx.scene.userData.flowers = flowers;

    /* --- лес: плотное кольцо вокруг деревни --- */
    // Лес начинается в 44 м от центра и полностью закрывает дальний обзор:
    // скала с входом в подземелье (≈100 м) не видна с улицы.
    const { group: forestGroup, trees, chunks } = denseForest(ctx.M, ctx.rng, {
      center: [0, 0],
      inner: 44,
      keepClear: (x, z) => {
        if (Math.abs(x) < 9 && Math.abs(z) < 96) return true;      // главная дорога вдоль Z
        if (Math.abs(z) < 6 && x > -52 && x < 74) return true;     // поперечная дорога
        if (x > 36 && x < 73 && z > -35 && z < 7) return true;       // лужайка у пруда
        if (Math.hypot(x - LAYOUT.campfire.x, z - LAYOUT.campfire.z) < 11) return true; // поляна кострища
        if (distToDungeonTrail(x, z) < 3.4) return true;             // узкая тропа к пещере
        // у самой скалы — только площадка перед входом; дальше лес
        // подступает вплотную и полностью закрывает скалу от взгляда
        if (Math.hypot(x - LAYOUT.dungeon.x, z - LAYOUT.dungeon.z) < 11) return true;
        if (Math.abs(x) < 46 && Math.abs(z) < 46) return true;       // поля и огороды деревни
        // поля за озером — вырубка: здесь будет зерно
        if (x > 60 && x < 104 && z > -34 && z < 16) return true;
        // на полях и по их кромке лес не растёт
        for (const [fx, fz, fw, fd] of FIELD_CLEARINGS) {
          if (Math.abs(x - fx) < fw / 2 + 2.5 && Math.abs(z - fz) < fd / 2 + 2.5) return true;
        }
        // вдоль тропинок лес не растёт — дороги должны быть видны
        // (запас побольше: мягкий край полотна должен быть открытым)
        if (distToTrails(x, z) < TRAIL_W / 2 + 3.4) return true;
        // вокруг зданий — поляна: деревья не растут вплотную к стенам
        for (const b of BUILDING_CLEARINGS) {
          if (Math.hypot(x - b[0], z - b[1]) < b[2]) return true;
        }
        return false;
      },
    });
    ctx.scene.add(forestGroup);
    ctx.forestChunks = chunks;
    ctx.forestTrees = trees;      // чанки леса: дальние отключаются по расстоянию
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
    // сплошное полотно: одна мягкая лента со скруглёнными поворотами
    // (раньше здесь лежали отдельные прямоугольные куски, и в лесу тропа
    // читалась как набор разрозненных камней)
    {
      const line = resample(smoothPolyline(trailPts, 3), 1.2);
      const tex = ctx.T.dirt.clone();
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const matRoad = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.98,
        vertexColors: true, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6,
      });
      const road = new THREE.Mesh(
        ribbonGeometry(line, 3.0, 0.045, { uScale: 0.36, vScale: 0.2, feather: 0.24, taper: 1.4 }),
        matRoad,
      );
      road.receiveShadow = true;
      road.renderOrder = 2;
      trailGroup.add(road);
    }
    for (let i = 0; i < trailPts.length - 1; i++) {
      const [ax, az] = trailPts[i];
      const [bx, bz] = trailPts[i + 1];
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      const n = Math.max(2, Math.round(len / 1.5));
      const ang = Math.atan2(dx, dz);
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
    buildFarm();
    buildWoodcuttersYard();
    buildNoticeBoard();
    buildDungeonGate();
    buildAnimals();
  }

  return {
    build, buildBuildings, buildProps, buildFarm, buildWoodcuttersYard,
    buildBarnClearing, buildNoticeBoard, buildDungeonGate,
  };
}
