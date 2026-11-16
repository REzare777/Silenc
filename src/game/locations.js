/**
 * ============================================================================
 *  Локации: деревня, амбар, таверна
 * ============================================================================
 *
 *  Мир разбит на три самостоятельные «сцены»:
 *
 *  | Локация   | Сцена            | Свет                         |
 *  |-----------|------------------|------------------------------|
 *  | `village` | главная улица    | зависит от времени суток     |
 *  | `barn`    | `sceneBarn`      | зависит от времени суток     |
 *  | `tavern`  | `sceneTavern`    | всегда тёплый и постоянный  |
 *
 *  При переходе меняются: сцена рендера, коллайдеры, платформы, зоны
 *  подъёма по лестницам и положение игрока. Внутри амбара и таверны
 *  коллайдеры животных не действуют — там им негде ходить.
 *
 *  @module game/locations
 */

import * as THREE from 'three';
import { buildBarnInterior } from '../world/barn.js';
import { buildTavernInterior } from '../world/tavern.js';
import { buildDungeon } from '../world/dungeon.js';
import { barkeep } from '../world/npc.js';
import { createNpc } from './npc.js';
import { tavernDoor, barnExitPoint, dungeonGate } from './layout.js';

/**
 * Создаёт подсистему локаций.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система локаций
 */
export function createLocations(ctx) {
  /* ---------------- двери ---------------- */
  // Локация владеет своими дверями: точки входа и выхода считаются здесь,
  // по единой планировке (game/layout.js). Деревня читает ту же планировку,
  // поэтому двери гарантированно совпадают с фасадами зданий.
  const tavernEntry = tavernDoor();
  ctx.doors.tavern = tavernEntry.pos;
  ctx.doors.tavernRy = tavernEntry.ry;
  ctx.doors.barnExit = barnExitPoint();

  /* ---------------- амбар ---------------- */
  // Внутри амбара — своя сцена со своим освещением; часы берутся у основной локации.
  const sceneBarn = new THREE.Scene();
  sceneBarn.fog = new THREE.Fog(0x3a2a1c, 10, 60);
  const WARM_OUT = new THREE.Color(0x7a5230);      // цвет «двора» за воротами
  const barnLoc = buildBarnInterior(ctx.M, ctx.glowTex);
  sceneBarn.add(barnLoc.group);

  /* ---------------- таверна ---------------- */
  // Внутри таверны — своя сцена с ПОСТОЯННЫМ тёплым светом: атмосфера
  // внутри не зависит от времени суток на улице (окна завешены шторами).
  const sceneTavern = new THREE.Scene();
  sceneTavern.fog = new THREE.Fog(0x241408, 6, 40);
  const TAVERN_BG = new THREE.Color(0x1a0f07);
  const tavernLoc = buildTavernInterior(ctx.M, ctx.glowTex);
  sceneTavern.add(tavernLoc.group);
  sceneTavern.background = TAVERN_BG;

  /* ---------------- подземелье ----------------
   *
   * Пещера под долиной: своя сцена, свой мрачный свет, свои коллайдеры.
   * Свет не зависит от времени суток — под землёй всегда темно.
   */
  const sceneDungeon = new THREE.Scene();
  sceneDungeon.fog = new THREE.FogExp2(0x0a1024, 0.032);
  const DUNGEON_BG = new THREE.Color(0x05070e);
  const dungeonLoc = buildDungeon(ctx.M, ctx.glowTex);
  sceneDungeon.add(dungeonLoc.group);
  sceneDungeon.background = DUNGEON_BG;
  const dungeonGatePoint = dungeonGate();
  ctx.doors.dungeon = { x: dungeonGatePoint.x, z: dungeonGatePoint.z, ry: dungeonGatePoint.ry };

  /* ---------------- бармен ----------------
   *
   * Живёт за стойкой: ходит вдоль неё, протирает кружку, останавливается.
   * С закатом уходит домой — ночью в трактире его нет.
   */
  const barkeepModel = barkeep();
  sceneTavern.add(barkeepModel.group);
  const barkeepNpc = createNpc(ctx, {
    id: 'barkeep',
    name: 'Хорт',
    model: barkeepModel,
    // маршрут за стойкой (x ≈ 6,45 — между стойкой и восточной стеной)
    route: [
      { x: 6.28, z: 2.3 },
      { x: 6.28, z: -1.7 },
      { x: 6.28, z: 0.35 },
    ],
    speed: 0.85,
    wait: 2.6,
    face: -Math.PI / 2,      // стоя лицом к залу
  });

  /** Текущая локация: 'village' | 'barn' | 'tavern'. */
  let current = 'village';
  ctx.loc = current;

  /**
   * Переход между локациями.
   *
   * @param {string} next 'village' | 'barn' | 'tavern'
   */
  function setLocation(next) {
    if (current === next) return;
    const prev = current;
    current = next;
    ctx.loc = current;

    const inBarn = current === 'barn';
    const inTavern = current === 'tavern';
    const inDungeon = current === 'dungeon';
    const L = inBarn ? barnLoc : inTavern ? tavernLoc : inDungeon ? dungeonLoc : null;

    ctx.renderPass.scene = inBarn ? sceneBarn
      : inTavern ? sceneTavern
        : inDungeon ? sceneDungeon : ctx.scene;
    ctx.player.setColliders(L ? L.colliders.boxes : ctx.colliders.boxes,
      L ? L.colliders.circles : ctx.colliders.circles);
    ctx.player.setPlatforms(L ? L.platforms : ctx.platforms);
    ctx.player.setClimbs(L ? (L.climbs || []) : []);
    ctx.player.dynamicCircles = L ? [] : ctx.animalCircles;

    if (L) {
      ctx.player.teleport(L.spawn.x, L.spawn.z, L.spawn.yaw);
      ctx.player.y = 0.02; ctx.player.groundY = 0.02; ctx.player.vy = 0;
      ctx.ui.toast(inDungeon
        ? 'Подземелье. Холодный свет кристаллов и полная тишина.'
        : inTavern
          ? '«Уставший вепрь». Тепло, пахнет дымом и элем.'
          : 'Амбар. Тут пахнет сеном и зерном.', 2600);
    } else {
      // назад — к той двери, откуда вошли
      if (prev === 'dungeon') {
        const gate = ctx.doors.dungeon;
        ctx.player.teleport(gate.x, gate.z, gate.ry);
      } else if (prev === 'tavern') {
        const door = ctx.doors.tavern;
        ctx.player.teleport(door.x, door.z, ctx.doors.tavernRy);
      } else {
        const barnExit = ctx.doors.barnExit;
        const rx = barnExit.x + (-5.4) * Math.sin(barnExit.ry);
        const rz = barnExit.z + (-5.4) * Math.cos(barnExit.ry);
        ctx.player.teleport(rx, rz, barnExit.ry);
      }
      ctx.player.y = 0.02; ctx.player.groundY = 0.02; ctx.player.vy = 0;
      ctx.ui.toast('Вы вернулись в деревню.', 2200);
    }
    ctx.player.keys.clear();
  }

  /* ---------------- взаимодействия внутри локаций ---------------- */
  const add = ctx.systems.interactions.add;

  /* ---- бармен: поговорить ----
   * Интеракт ходит вместе с барменом, поэтому его позиция обновляется
   * каждый кадр (см. updateNpc).
   */
  const talkToBarkeep = add(new THREE.Vector3(barkeepNpc.x, 1.4, barkeepNpc.z), 2.9,
    'Поговорить с барменом', () => {
      if (barkeepNpc.away) {
        ctx.ui.toast('Трактир закрыт: бармен ушёл спать. Вернётся с рассветом.', 3000);
        return;
      }
      if (ctx.systems.dialog) ctx.systems.dialog.open('barkeep');
    }, 'tavern');

  /**
   * Обновление персонажей локации: бармен ходит за стойкой, смотрит на
   * игрока, а с наступлением ночи уходит домой.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t  мировое время
   */
  function updateNpc(dt, t) {
    const night = !!(ctx.env && ctx.env.target === 'night');
    const wasAway = barkeepNpc.away;
    barkeepNpc.setAway(night);
    if (night !== wasAway) {
      ctx.ui.toast(night
        ? 'Бармен задул свечу и ушёл домой. До рассвета трактир пуст.'
        : 'Бармен вернулся: вытер стойку, зажёг свечу и ждёт гостей.', 3200);
    }
    barkeepNpc.update(dt, t, ctx.player.pos);
    talkToBarkeep.pos.set(barkeepNpc.x, 1.4, barkeepNpc.z);
  }

  // амбар
  add(new THREE.Vector3(barnLoc.exitDoor.x, 1.4, barnLoc.exitDoor.z), 2.6,
    'Выйти из амбара', () => setLocation('village'), 'barn');

  const barnCartLines = [
    'Телега нагружена мешками: вчера привезли зерно с мельницы.',
    'Колёса крепкие, оглобли ровные. С такой телегой и до луга далеко не уедешь.',
  ];
  [{ x: -3.4, z: 2.6 }, { x: 4.6, z: 2.2 }].forEach((c, i) => {
    add(new THREE.Vector3(c.x, 1.1, c.z), 2.1, 'Осмотреть телегу',
      () => ctx.ui.toast(barnCartLines[i % barnCartLines.length]), 'barn');
  });
  add(new THREE.Vector3(2.6, 4.9, -3.4), 2.2, 'Осмотреть сено',
    () => ctx.ui.toast('Сено сухое, душистое. Зимой коровы не будут голодать.'), 'barn');
  add(new THREE.Vector3(5.0, 1.2, -3.4), 2.2, 'Осмотреть верстак',
    () => ctx.ui.toast('На верстаке — топор, колода и свежие опилки.'), 'barn');

  // таверна
  add(new THREE.Vector3(tavernLoc.exitDoor.x, 1.4, tavernLoc.exitDoor.z), 2.6,
    'Выйти из таверны', () => setLocation('village'), 'tavern');
  add(new THREE.Vector3(-6.5, 1.2, 0), 2.4, 'Погреться у очага',
    () => ctx.ui.toast('Очаг дышит жаром. Слышно, как потрескивают дрова.'), 'tavern');
  add(new THREE.Vector3(5.0, 1.5, -1.0), 2.4, 'Осмотреть стойку',
    () => ctx.ui.toast('Бутылки на полках — от тёмного эля до прозрачной водки.'), 'tavern');
  add(new THREE.Vector3(-7.0, 2.0, -3.4), 2.0, 'Взять лютню',
    () => ctx.ui.toast('Струны звонкие, но пыльные — их давно не играли.'), 'tavern');
  add(new THREE.Vector3(-2.6, 1.0, 2.0), 2.2, 'Сесть за стол',
    () => ctx.ui.toast('Дуб крепкий, скола на нём по кругу. Хорошее место.'), 'tavern');

  /* ---- подземелье: вход и выход ---- */
  add(new THREE.Vector3(dungeonGatePoint.x, 1.4, dungeonGatePoint.z), 3.2,
    'Спуститься в подземелье', () => setLocation('dungeon'));

  add(new THREE.Vector3(dungeonLoc.exit.x, dungeonLoc.exit.y, dungeonLoc.exit.z), 3.0,
    'Подняться на поверхность', () => setLocation('village'), 'dungeon');

  const dungeonLines = [
    'Кристаллы растут прямо из камня и холодят ладонь. Таких в долине не водится.',
    'Врата в глубине: огромный синий самоцвет, в котором будто движется туман.',
    'Колонны из тёмного камня держат свод. Кто и зачем их поставил — неизвестно.',
    'У пола ползёт сизоватый туман. Звуки здесь гаснут, будто пещера слушает.',
  ];
  const dungeonSpots = [
    [dungeonLoc.spots.crystal, 'Осмотреть кристалл'],
    [dungeonLoc.spots.gate, 'Осмотреть Врата'],
    [dungeonLoc.spots.pillar, 'Осмотреть колонну'],
    [dungeonLoc.spots.fog, 'Прислушаться к туману'],
  ];
  dungeonSpots.forEach(([v, label], i) => {
    add(new THREE.Vector3(v.x, v.y, v.z), 2.6, label,
      () => ctx.ui.toast(dungeonLines[i % dungeonLines.length], 3600), 'dungeon');
  });

  // ---- комнаты второго этажа: переночевать ----
  const nightLines = [
    'Вы устроились на ночь. Свеча догорела, за окном запел петух.',
    'Тёплая постель, и сон приходит сразу — как будто ждали.',
    'Вы засыпаете под тихое скрипание половиц. Утро начнётся с колокола.',
  ];
  (tavernLoc.rooms || []).forEach((room, i) => {
    add(new THREE.Vector3(room.bedX, room.bedY, room.bedZ), 1.7,
      `Переночевать — комната ${room.name}`,
      () => {
        // переночевать можно только на втором этаже.
        // pos.y у игрока всегда 0 — высота считается как пол + смещение
        if (ctx.player.groundY + ctx.player.y < 3.0) {
          ctx.ui.toast('Сначала поднимитесь на второй этаж — по лестнице у очага.');
          return;
        }
        ctx.ui.toast(nightLines[i % nightLines.length], 4200);
        // ночь сменяется утром — и в доме, и на улице
        if (ctx.env) {
          ctx.env.setTimeOfDay('morning', true);
          ctx.ui.setTime('morning');
        }
      }, 'tavern');
  });

  return {
    setLocation,
    WARM_OUT,
    TAVERN_BG,
    DUNGEON_BG,
    barnLoc,
    tavernLoc,
    dungeonLoc,
    sceneBarn,
    sceneTavern,
    sceneDungeon,
    /** Персонажи по идентификатору — их находит диалог. */
    npcs: { barkeep: barkeepNpc },
    /** Обновление персонажей (вызывается из игрового цикла). */
    updateNpc,
    /** Текущая локация. */
    get current() { return current; },
  };
}
