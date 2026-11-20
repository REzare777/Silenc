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
import { buildHomeInterior, HOME_NAMES } from '../world/homes.js';
import { buildChurchInterior, CHURCH_NAME } from '../world/church.js';
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
  sceneDungeon.fog = new THREE.FogExp2(0x0a1024, 0.016);
  const DUNGEON_BG = new THREE.Color(0x05070e);
  const dungeonLoc = buildDungeon(ctx.M, ctx.glowTex);
  sceneDungeon.add(dungeonLoc.group);
  sceneDungeon.background = DUNGEON_BG;
  const dungeonGatePoint = dungeonGate();
  // игрок стоит у подножия лестницы — на земле, перед входом в скалу
  ctx.doors.dungeon = {
    x: dungeonGatePoint.foot.x, z: dungeonGatePoint.foot.z, ry: dungeonGatePoint.ry,
  };

  /* ---------------- дома ----------------
   *
   * У каждого дома своя сцена, свой свет и своя мебель. В дом пускают только
   * утром и днём: ночью хозяева спят, а вечером дом уже заперт.
   */
  const homeLocs = [];
  for (let i = 0; i < HOME_NAMES.length; i++) {
    homeLocs.push(buildHomeInterior(ctx.M, ctx.glowTex, i));
  }
  // двери домов в деревне (чтобы вернуться к своей двери)
  ctx.doors.homes = ctx.doors.homes || [];

  /* ---------------- храм ----------------
   *
   * Внутри храма — своя сцена со своим светом: витражи дают холодный
   * отблеск, алтарь — тёплый. Снаружи это тот же неф, что и на холме.
   */
  const churchLoc = buildChurchInterior(ctx.M, ctx.glowTex);
  const sceneChurch = churchLoc.scene;
  const CHURCH_BG = new THREE.Color(0x14121a);

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
    // ночью уходит домой через заднюю дверь сзади стойки
    exit: tavernLoc.barExit,
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
  function setLocation(next, where = null) {
    if (current === next && !(next === 'church' && where === 'back')) return;
    const prev = current;
    current = next;
    ctx.loc = current;

    const inBarn = current === 'barn';
    const inTavern = current === 'tavern';
    const inDungeon = current === 'dungeon';
    const inChurch = current === 'church';
    const homeIdx = current.startsWith('home') ? parseInt(current.slice(4), 10) : -1;
    const inHome = homeIdx >= 0 && homeIdx < homeLocs.length;
    const L = inBarn ? barnLoc : inTavern ? tavernLoc : inDungeon ? dungeonLoc
      : inChurch ? churchLoc
        : inHome ? homeLocs[homeIdx] : null;

    ctx.renderPass.scene = inBarn ? sceneBarn
      : inTavern ? sceneTavern
        : inDungeon ? sceneDungeon
          : inChurch ? sceneChurch
            : inHome ? homeLocs[homeIdx].scene : ctx.scene;
    ctx.player.setColliders(L ? L.colliders.boxes : ctx.colliders.boxes,
      L ? L.colliders.circles : ctx.colliders.circles);
    ctx.player.setPlatforms(L ? L.platforms : ctx.platforms);
    ctx.player.setFloors(L ? (L.floors || []) : ctx.floors);
    ctx.player.setClimbs(L ? (L.climbs || []) : []);
    ctx.player.dynamicCircles = L ? [] : ctx.animalCircles;

    /* --- звуковое пространство подстраивается под локацию --- */
    // под землёй — гул и эхо, шаги по камню; в храме — по каменным плитам;
    // в комнатах — глухие доски; на улице — ветер, птицы и трава под ногами
    if (ctx.ambience) {
      ctx.ambience.setInterior(inDungeon ? 'dungeon' : (L ? 'room' : 'outdoor'));
      const surface = inDungeon ? 'stone'
        : inChurch ? 'stone'
          : L ? 'wood'
            : 'grass';
      ctx.ambience.setSurface(surface);
    }

    if (L) {
      // в храм можно войти с юга (через башню) и с севера (через заднюю дверь)
      const sp = (inChurch && where === 'back' && L.spawnBack) ? L.spawnBack : L.spawn;
      ctx.player.teleport(sp.x, sp.z, sp.yaw);
      ctx.player.y = 0; ctx.player.vy = 0; ctx.player.camY = null;
      ctx.ui.toast(inDungeon
        ? 'Подземелье. Холодный свет кристаллов и полная тишина. Вглубь — по лестнице в шахте.'
        : inTavern
          ? '«Уставший вепрь». Тепло, пахнет дымом и элем.'
          : inChurch
            ? `${CHURCH_NAME}. Холодный свет витражей, ладан и полная тишина.`
            : inHome
              ? `${homeLocs[homeIdx].name}. Внутри пахнет дымом и сушёными травами.`
              : 'Амбар. Тут пахнет сеном и зерном.', 2600);
    } else {
      // назад — к той двери, откуда вошли
      if (prev.startsWith('home')) {
        const idx = parseInt(prev.slice(4), 10);
        const door = (ctx.doors.homes || [])[idx];
        if (door) {
          ctx.player.teleport(door.x, door.z, door.ry);
        }
      } else if (prev === 'dungeon') {
        const gate = ctx.doors.dungeon;
        ctx.player.teleport(gate.x, gate.z, gate.ry);
      } else if (prev === 'church') {
        // выход через заднюю дверь нефа — в задний двор, иначе к башне
        const door = where === 'churchBack' && ctx.doors.churchBack
          ? ctx.doors.churchBack : ctx.doors.church;
        ctx.player.teleport(door.x, door.z, door.ry);
      } else if (prev === 'tavern') {
        // выход через сени — к задней двери таверны, иначе к фасаду
        const back = where === 'tavernBack' && ctx.doors.tavernBack;
        const door = back ? ctx.doors.tavernBack : ctx.doors.tavern;
        ctx.player.teleport(door.x, door.z, back ? door.ry : ctx.doors.tavernRy);
      } else {
        const barnExit = ctx.doors.barnExit;
        const rx = barnExit.x + (-5.4) * Math.sin(barnExit.ry);
        const rz = barnExit.z + (-5.4) * Math.cos(barnExit.ry);
        ctx.player.teleport(rx, rz, barnExit.ry);
      }
      ctx.player.y = 0; ctx.player.vy = 0; ctx.player.camY = null;
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
        ? 'Бармен задул свечу и ушёл домой через заднюю дверь за стойкой.'
        : 'Бармен вернулся через заднюю дверь: вытер стойку, зажёг свечу и ждёт гостей.', 3200);
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
  // продажа улова трактирщику: монеты капают в кошелёк
  add(new THREE.Vector3(4.9, 1.2, 2.2), 2.0, 'Продать рыбу', () => {
    const inv = ctx.inventory;
    const slot = inv.firstFilled();
    if (slot < 0) {
      ctx.ui.toast('Нечего продавать — в сумке пусто.', 2600);
      return;
    }
    const spec = inv.takeOne(slot);
    const price = spec.value || 0;
    ctx.stats.earnCoins(price);
    ctx.ui.renderInventory(inv);
    ctx.ui.toast(`Продал ${spec.name} за ${price} зол. В кошельке теперь ${ctx.stats.coins} зол.`, 3400);
  }, 'tavern');
  add(new THREE.Vector3(-7.0, 2.0, -3.4), 2.0, 'Взять лютню',
    () => ctx.ui.toast('Струны звонкие, но пыльные — их давно не играли.'), 'tavern');
  add(new THREE.Vector3(-2.6, 1.0, 2.0), 2.2, 'Сесть за стол',
    () => ctx.ui.toast('Дуб крепкий, скола на нём по кругу. Хорошее место.'), 'tavern');
  // задняя дверь за стойкой: её можно отворить и выйти в сени
  add(new THREE.Vector3(tavernLoc.barExit.x - 1.05, 1.4, tavernLoc.barExit.z), 2.2,
    'Открыть заднюю дверь', () => {
      if (tavernLoc.openBackDoor()) {
        ctx.ui.toast('Щеколда щёлкнула, створка отошла. За дверью — сени с бочками и дровами.', 3200);
      } else {
        ctx.ui.toast('Дверь уже открыта. В сенях пахнет дровами и пролитым элем.', 2600);
      }
    }, 'tavern');
  // выход из сеней на улицу — с задней стороны таверны
  add(new THREE.Vector3(tavernLoc.backExit.x - 0.5, 1.4, tavernLoc.backExit.z), 2.4,
    'Выйти на улицу', () => {
      ctx.ui.toast('Ты выходишь в задний двор таверны. За забором — тропа к мельнице.', 2800);
      setLocation('village', 'tavernBack');
    }, 'tavern');

  /* ---- дома: выход и детали ---- */
  homeLocs.forEach((loc, i) => {
    add(new THREE.Vector3(loc.exitDoor.x, 1.3, loc.exitDoor.z), 2.4,
      'Выйти из дома', () => setLocation('village'), `home${i}`);
    loc.spots.forEach((spot, k) => {
      add(spot[0], 2.1, spot[1], () => {
        ctx.ui.toast(loc.lines[k % loc.lines.length], 3600);
      }, `home${i}`);
    });
  });

  /* ---- храм: выход, колокол и детали ---- */
  add(new THREE.Vector3(churchLoc.exitDoor.x, 1.4, churchLoc.exitDoor.z), 2.6,
    'Выйти из храма', () => setLocation('village'), 'church');
  // задняя дверь нефа: рабочий выход в задний двор
  add(new THREE.Vector3(churchLoc.backExit.x, 1.4, churchLoc.backExit.z), 2.6,
    'Открыть тяжёлую дверь', () => {
      ctx.ui.toast('Засов откинут. За дверью — задний двор и тропа вниз, к долине.', 3200);
      setLocation('village', 'churchBack');
    }, 'church');
  // колокол — только наверху, в самой колокольне: с пола он недоступен
  const bellAct = add(churchLoc.bellPoint.clone(), 2.6, 'Ударить в колокол', () => {
    churchLoc.ringBell();
    if (ctx.ambience && ctx.ambience.bell) ctx.ambience.bell();
    ctx.ui.toast('Колокол над долиной — глухой и тёплый. Звук уходит далеко вниз.', 3200);
  }, 'church');
  bellAct.y = 4.6;          // на каком уровне ног срабатывает интеракт
  bellAct.yTol = 1.6;
  churchLoc.spots.forEach((spot, k) => {
    add(spot[0], 2.3, spot[1], () => {
      ctx.ui.toast(churchLoc.lines[k % churchLoc.lines.length], 3600);
    }, 'church');
  });

  /* ---- подземелье: вход и выход ---- */
  add(new THREE.Vector3(dungeonGatePoint.foot.x, 1.4, dungeonGatePoint.foot.z), 3.4,
    'Спуститься в подземелье', () => setLocation('dungeon'));

  add(new THREE.Vector3(dungeonLoc.exit.x, dungeonLoc.exit.y, dungeonLoc.exit.z), 3.0,
    'Подняться на поверхность', () => setLocation('village'), 'dungeon');

  const dungeonLines = [
    'Кристаллы растут прямо из камня и холодят ладонь. Таких в долине не водится.',
    'Врата в глубине: огромный синий самоцвет, в котором будто движется туман.',
    'Колонны из тёмного камня держат свод. Кто и зачем их поставил — неизвестно.',
    'У пола ползёт сизоватый туман. Звуки здесь гаснут, будто пещера слушает.',
    'Знаки на стене горят синим. Их рисуют чем-то жидким, а не высекают.',
    'Самоцвет лежит в пыли, будто его положили только что. Рядом никого.',
  ];
  const dungeonSpots = [
    [dungeonLoc.spots.crystal, 'Осмотреть кристалл'],
    [dungeonLoc.spots.gate, 'Осмотреть Врата'],
    [dungeonLoc.spots.pillar, 'Осмотреть колонну'],
    [dungeonLoc.spots.fog, 'Прислушаться к туману'],
    [dungeonLoc.spots.runes, 'Прочитать руны на стене'],
    [dungeonLoc.spots.gems[0], 'Осмотреть самоцвет'],
    [dungeonLoc.spots.gems[1], 'Осмотреть самоцвет'],
  ];
  dungeonSpots.forEach((spot, i) => {
    const v = spot[0];
    const label = spot[1];
    add(new THREE.Vector3(v.x, v.y, v.z), 2.6, label,
      () => {
        // кристаллы и самоцветы отзываются тонким звоном
        if (label.startsWith('Осмотреть кристалл') || label.startsWith('Осмотреть самоцвет')) {
          if (ctx.ambience) ctx.ambience.crystalChime();
        }
        ctx.ui.toast(dungeonLines[i % dungeonLines.length], 3600);
      }, 'dungeon');
  });

  // прикосновение к Вратам — самый мрачный момент локации
  add(new THREE.Vector3(dungeonLoc.gateHall.x, dungeonLoc.gateHall.y + 1.6, dungeonLoc.gateHall.z - 3.2), 3.0,
    'Прикоснуться к Вратам', () => {
      if (ctx.ambience) ctx.ambience.deepBoom();
      ctx.ui.toast('Самоцвет холодит ладонь, и на миг кажется, что из глубины '
        + 'кто-то дотронулся в ответ. Где-то внизу глухо ударило. Потом всё стихает.', 5200);
    }, 'dungeon');

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
    CHURCH_BG,
    barnLoc,
    tavernLoc,
    dungeonLoc,
    churchLoc,
    homeLocs,
    sceneBarn,
    sceneTavern,
    sceneDungeon,
    sceneChurch,
    /** Персонажи по идентификатору — их находит диалог. */
    npcs: { barkeep: barkeepNpc },
    /** Обновление персонажей (вызывается из игрового цикла). */
    updateNpc,
    /** Текущая локация. */
    get current() { return current; },
  };
}
