/**
 * ============================================================================
 *  Зверинец: десять пород, их повадки и добыча
 * ============================================================================
 *
 *  Что изменилось по сравнению с прежними «тенями»
 *  ---------------------------------------------
 *  Тень была одна: чёрный конус с двумя глазами, одна атака, одна стойкость.
 *  Теперь в пещере живёт десять пород, и у каждой — своя повадка:
 *
 *  | порода            | повадка                                   |
 *  |-------------------|-------------------------------------------|
 *  | гоблин с мечом    | быстрый, бьёт вблизи                     |
 *  | гоблин с луком    | держится вдали и стреляет                 |
 *  | гоблин-страж      | элитный: щит, больше урона, медленный     |
 *  | призрак           | проходит сквозь стены, парит              |
 *  | паук              | прыгает, очень быстрый                    |
 *  | слизень           | прыгает и оставляет ядовитую лужу         |
 *  | гриб              | плюётся спорами, замедляет                |
 *  | змея              | кусает внезапно, быстро                   |
 *  | каменный голем    | медленный, но крепкий и тяжёлый           |
 *  | орк-босс          | четыре атаки, своя полоска здоровья       |
 *
 *  Правила, которые остались от прежних теней
 *  -------------------------------------------
 *  • Пока горит факел, монстр держит дистанцию и не бросается.
 *  • Бранд («veil») гасит стойкость, оружие снимает здоровье.
 *  • Раненого (HP ≤ 25) не догоняют, но вблизи всё равно бьют.
 *  • Входной зал (z < −20) — зона безопасности.
 *
 *  Сложность
 *  ---------
 *  У каждой породы своя «ступень» (trash / normal / elite / boss) и свой
 *  коэффициент. Общая сложность игры (Легко / Обычно / Трудно / Кошмар)
 *  умножает здоровье, урон и скорость. Текущая сложность хранится в
 *  `localStorage['wv.difficulty']`.
 *
 *  @module game/monsters
 */

import * as THREE from 'three';
import { monsterModel, lootBagModel } from '../world/monsters.js';
import { makeStack } from '../inventory.js';

/* ------------------------------------------------------------------
 *  Сложность
 * ------------------------------------------------------------------ */

/**
 * Уровни сложности.
 *
 * `hp` — множитель здоровья, `dmg` — урона, `speed` — скорости,
 * `count` — сколько монстров живёт в пещере (больше = сложнее).
 */
export const DIFFICULTIES = [
  { id: 'easy', name: 'Легко', hp: 0.65, dmg: 0.6, speed: 0.85, count: 0.7, reward: 0.7 },
  { id: 'normal', name: 'Обычно', hp: 1, dmg: 1, speed: 1, count: 1, reward: 1 },
  { id: 'hard', name: 'Трудно', hp: 1.5, dmg: 1.45, speed: 1.12, count: 1.35, reward: 1.5 },
  { id: 'nightmare', name: 'Кошмар', hp: 2.2, dmg: 2, speed: 1.25, count: 1.7, reward: 2.3 },
];

/**
 * Текущая сложность (по умолчанию — «Обычно»).
 *
 * @returns {object} описание сложности
 */
export function currentDifficulty() {
  let id = 'normal';
  try {
    const v = localStorage.getItem('wv.difficulty');
    if (v && DIFFICULTIES.some((d) => d.id === v)) id = v;
  } catch (e) { /* localStorage может быть недоступен */ }
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

/* ------------------------------------------------------------------
 *  Реестр пород
 * ------------------------------------------------------------------ */

/**
 * Все породы подземелья.
 *
 * `tier` — ступень сложности породы; `attack` — тип атаки;
 * `sp` — «стая» (сколько особей этого вида появляется).
 */
export const MONSTERS = [
  {
    id: 'goblin_sword', name: 'Гоблин с мечом', tier: 'trash',
    hp: 34, dmg: 7, speed: 2.0, aggro: 16, reach: 1.5, cd: 1.5,
    attack: 'melee', windup: 0.42, active: 0.18, radius: 0.42, height: 1.5,
    sp: 4, scale: 1, exp: 6,
  },
  {
    id: 'goblin_bow', name: 'Гоблин-лучник', tier: 'trash',
    hp: 26, dmg: 9, speed: 1.8, aggro: 20, reach: 13, cd: 2.4,
    attack: 'ranged', windup: 0.75, active: 0.2, radius: 0.4, height: 1.45,
    sp: 3, scale: 1, exp: 7,
  },
  {
    id: 'goblin_guard', name: 'Гоблин-страж', tier: 'elite',
    hp: 78, dmg: 13, speed: 1.45, aggro: 15, reach: 1.8, cd: 1.9,
    attack: 'melee', windup: 0.6, active: 0.2, radius: 0.5, height: 1.75,
    sp: 2, scale: 1, exp: 18, guard: 0.35,
  },
  {
    id: 'ghost', name: 'Призрак', tier: 'normal',
    hp: 46, dmg: 12, speed: 1.75, aggro: 19, reach: 1.7, cd: 2.1,
    attack: 'melee', windup: 0.7, active: 0.22, radius: 0.55, height: 2.7,
    sp: 3, scale: 1, exp: 12, ghost: true,
  },
  {
    id: 'spider', name: 'Паук', tier: 'trash',
    hp: 24, dmg: 8, speed: 3.0, aggro: 18, reach: 1.5, cd: 1.4,
    attack: 'leap', windup: 0.45, active: 0.25, radius: 0.45, height: 0.9,
    sp: 3, scale: 1, exp: 8,
  },
  {
    id: 'slime_green', name: 'Зелёный слизень', tier: 'trash',
    hp: 30, dmg: 5, speed: 1.55, aggro: 14, reach: 1.6, cd: 2.0,
    attack: 'splash', windup: 0.6, active: 0.2, radius: 0.5, height: 0.9,
    sp: 3, scale: 1, exp: 7, color: 0x6fbf4a,
  },
  {
    id: 'slime_blue', name: 'Синий слизень', tier: 'trash',
    hp: 38, dmg: 6, speed: 1.35, aggro: 14, reach: 1.6, cd: 2.2,
    attack: 'splash', windup: 0.65, active: 0.2, radius: 0.55, height: 1.0,
    sp: 2, scale: 1, exp: 9, color: 0x4a9fbf,
  },
  {
    id: 'slime_red', name: 'Красный слизень', tier: 'normal',
    hp: 52, dmg: 11, speed: 1.65, aggro: 15, reach: 1.6, cd: 2.0,
    attack: 'splash', windup: 0.55, active: 0.2, radius: 0.55, height: 1.05,
    sp: 2, scale: 1, exp: 13, color: 0xc25a4a,
  },
  {
    id: 'shroom', name: 'Живой гриб', tier: 'trash',
    hp: 28, dmg: 4, speed: 1.1, aggro: 15, reach: 10, cd: 2.8,
    attack: 'spore', windup: 0.8, active: 0.2, radius: 0.45, height: 1.25,
    sp: 3, scale: 1, exp: 7,
  },
  {
    id: 'snake', name: 'Змея', tier: 'trash',
    hp: 22, dmg: 10, speed: 2.4, aggro: 15, reach: 1.4, cd: 1.6,
    attack: 'bite', windup: 0.38, active: 0.16, radius: 0.35, height: 0.5,
    sp: 3, scale: 1, exp: 8,
  },
  {
    id: 'golem_small', name: 'Каменный голем', tier: 'normal',
    hp: 96, dmg: 16, speed: 1.2, aggro: 14, reach: 1.9, cd: 2.3,
    attack: 'slam', windup: 0.85, active: 0.24, radius: 0.6, height: 1.25,
    sp: 2, scale: 0.72, exp: 16,
  },
  {
    id: 'orc_boss', name: 'Орк-владыка Гримм', tier: 'boss',
    hp: 420, dmg: 22, speed: 2.1, aggro: 26, reach: 2.6, cd: 1.6,
    attack: 'boss', windup: 0.7, active: 0.26, radius: 0.85, height: 3.2,
    engage: 9,          // босс начинает атаку издалека: наскок и рёв
    sp: 1, scale: 1, exp: 90, boss: true,
  },
];

/**
 * Порода по идентификатору.
 *
 * @param {string} id идентификатор
 * @returns {object|null} описание породы
 */
export function monsterSpec(id) {
  return MONSTERS.find((m) => m.id === id) || null;
}

/* ------------------------------------------------------------------
 *  Точки появления
 * ------------------------------------------------------------------ */

/**
 * Зоны пещеры, где водятся монстры.
 *
 * `tier` — какие породы там живут; `y` — высота пола.
 */
const ZONES = [
  { id: 'hall', x0: -11, x1: 11, z0: -32, z1: -21, y: 0, tier: 'trash', weight: 2 },
  { id: 'crystal', x0: -13, x1: 13, z0: -18, z1: 4, y: 0, tier: 'normal', weight: 3 },
  { id: 'gate', x0: -12, x1: 12, z0: 16, z1: 34, y: -4.6, tier: 'normal', weight: 3 },
  { id: 'gateElite', x0: -12, x1: 12, z0: 16, z1: 34, y: -4.6, tier: 'elite', weight: 1.4 },
];

/** Где стоит босс. */
const BOSS_SPOT = { x: 0, y: -4.6, z: 30 };

/* ------------------------------------------------------------------
 *  Система
 * ------------------------------------------------------------------ */

/**
 * Создать систему монстров.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система монстров
 */
export function createMonsters(ctx) {
  /** @type {object[]} */
  const list = [];
  /** @type {object[]} */
  const projectiles = [];
  /** @type {object[]} */
  const bags = [];
  /** @type {object[]} */
  const puddles = [];
  let root = null;
  let playerInvuln = 0;
  let playerStun = 0;
  let paused = false;
  let boss = null;
  let difficulty = currentDifficulty();
  let lootBagId = 0;

  const _v = new THREE.Vector3();

  /* ---------------- геометрия пещеры ---------------- */

  /**
   * Коллайдеры подземелья.
   *
   * @returns {object[]} прямоугольники
   */
  function dungeonBoxes() {
    const loc = ctx.systems.locations;
    if (!loc || !loc.dungeonLoc || !loc.dungeonLoc.colliders) return [];
    return loc.dungeonLoc.colliders.boxes || [];
  }

  /**
   * Границы пещеры: за них монстр не выходит (даже призрак, который
   * проходит сквозь стены).
   */
  const BOUNDS = { x0: -15, x1: 15, z0: -34.5, z1: 36.5 };

  /**
   * Зажать точку в пределах пещеры.
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @returns {number[]} [x, z]
   */
  function clampToBounds(x, z) {
    return [
      Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, x)),
      Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, z)),
    ];
  }

  /**
   * Свободна ли точка (по коллайдерам пещеры).
   *
   * Высота коллайдера важна: у стен пещеры есть надземные части (`y0`/`y1`),
   * под которыми игрок спокойно проходит. Если высоту не учитывать, звери
   * упираются в стену, которой на их пути нет, и половина пещеры остаётся
   * для них отрезанной.
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @param {number} r радиус
   * @param {number} y высота пола под точкой
   * @param {number} h рост зверя
   * @returns {boolean} свободно ли
   */
  function freeSpot(x, z, r = 0.45, y = 0, h = 1.6) {
    const feet = y;
    const head = y + h;
    for (const b of dungeonBoxes()) {
      // та же логика, что у игрока (`player.blocksAt`): стена выше головы
      // или ниже ног — не помеха
      if (b.y0 !== undefined || b.y1 !== undefined) {
        const blocks = (b.y1 === undefined || feet < b.y1) && (b.y0 === undefined || head > b.y0);
        if (!blocks) continue;
      }
      const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
      const dx = x - b.cx, dz = z - b.cz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      if (Math.hypot(lx - qx, lz - qz) < r + 0.15) return false;
    }
    return true;
  }

  /**
   * Высота зверя с учётом масштаба породы.
   *
   * @param {object} m монстр
   * @returns {number} рост в метрах
   */
  function beastHeight(m) {
    return (m.spec.height || 1.6) * (m.baseScale || 1);
  }

  /**
   * Направление движения, в котором не упрёшься в стену.
   *
   * @param {object} m монстр
   * @param {number} dir желаемое направление
   * @param {number} ahead как далеко проверять
   * @returns {number} угол
   */
  function pickDir(m, dir, ahead = 0.9) {
    const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, Math.PI];
    for (const o of offs) {
      const a = dir + o;
      const nx = m.x + Math.cos(a) * ahead;
      const nz = m.z + Math.sin(a) * ahead;
      if (freeSpot(nx, nz, m.spec.radius, m.y, beastHeight(m))) return a;
    }
    return dir + Math.PI;
  }

  /* ---------------- создание ---------------- */

  /**
   * Создать монстра.
   *
   * @param {object} spec порода
   * @param {number} x координата X
   * @param {number} y высота пола
   * @param {number} z координата Z
   * @returns {object} монстр
   */
  function makeMonster(spec, x, y, z) {
    const model = monsterModel(spec.id);
    const hp = Math.round(spec.hp * difficulty.hp);
    const m = {
      spec,
      model,
      group: model.group,
      x, y, z,
      home: { x, z },
      hp,
      maxHp: hp,
      veil: spec.tier === 'boss' ? 6 : spec.tier === 'elite' ? 3 : 2,
      maxVeil: spec.tier === 'boss' ? 6 : spec.tier === 'elite' ? 3 : 2,
      dmg: Math.round(spec.dmg * difficulty.dmg),
      state: 'sleep',
      stateT: 0,
      stun: 0,
      hitFlash: 0,
      phase: Math.random() * 6,
      moveSpeed: 0,
      dir: Math.random() * Math.PI * 2,
      windup: spec.windup,
      active: spec.active,
      cd: Math.random() * spec.cd,
      attackName: null,
      vx: 0, vz: 0,
      dying: 0,
      dyingT: 0,
      isGuard: spec.id === 'goblin_guard',
      boss: !!spec.boss,
      slow: 0,
    };
    // базовый масштаб породы (мелкие звери — меньше)
    m.baseScale = spec.scale || 1;
    m.group.scale.setScalar(m.baseScale);
    m.group.position.set(x, y, z);
    if (root) root.add(m.group);
    list.push(m);
    if (m.boss) {
      boss = m;
      // полосу босса показываем, когда он проснётся (в update), а не сразу при спавне
    }
    return m;
  }

  /**
   * Случайная свободная точка в зоне.
   *
   * @param {object} zone зона
   * @param {number} r радиус
   * @returns {object|null} {x, y, z} или null
   */
  function randomSpot(zone, r = 0.5) {
    for (let i = 0; i < 60; i++) {
      const x = zone.x0 + Math.random() * (zone.x1 - zone.x0);
      const z = zone.z0 + Math.random() * (zone.z1 - zone.z0);
      if (!freeSpot(x, z, r, zone.y, 1.6)) continue;
      return { x, y: zone.y, z };
    }
    return null;
  }

  /**
   * Породы, которые водятся в зоне.
   *
   * @param {string} tier ступень
   * @returns {object[]} породы
   */
  function typesFor(tier) {
    return MONSTERS.filter((s) => s.tier === tier && !s.boss);
  }

  /**
   * Расставить монстров по пещере.
   */
  function spawn() {
    clear();
    difficulty = currentDifficulty();
    const loc = ctx.systems.locations;
    if (!loc || !loc.dungeonLoc) return;
    // старая группа могла остаться в сцене — убираем, чтобы не копить мусор
    if (root && root.parent) root.parent.remove(root);
    root = new THREE.Group();
    root.name = 'monsters';
    loc.sceneDungeon.add(root);

    // Сначала — по одному представителю каждой породы.
    //
    // Раньше породы выпадали случайно, и за одно посещение пещеры игрок
    // мог не встретить и половины зверинца. Теперь гарантировано: каждая
    // порода есть в пещере хотя бы раз, а остальные — добором по весам.
    const byTier = { trash: [], normal: [], elite: [] };
    for (const spec of MONSTERS) {
      if (spec.boss) continue;
      (byTier[spec.tier] || byTier.trash).push(spec);
    }
    for (const tier of ['trash', 'normal', 'elite']) {
      const zone = ZONES.find((z) => z.tier === tier) || ZONES[0];
      for (const spec of byTier[tier]) {
        const spot = randomSpot(zone, spec.radius + 0.25);
        if (!spot) continue;
        makeMonster(spec, spot.x, spot.y, spot.z);
      }
    }

    // добор: сколько ещё зверья на этой «этаже» пещеры
    for (const zone of ZONES) {
      const pool = typesFor(zone.tier);
      if (!pool.length) continue;
      const total = pool.reduce((s, p) => s + p.sp, 0);
      let count = Math.round(total * zone.weight * 0.34 * difficulty.count);
      count = Math.max(1, Math.min(9, count));
      for (let i = 0; i < count; i++) {
        // порода выбирается взвешенно по sp
        let roll = Math.random() * total;
        let pick = pool[0];
        for (const p of pool) {
          roll -= p.sp;
          if (roll <= 0) { pick = p; break; }
        }
        const spot = randomSpot(zone, pick.radius + 0.2);
        if (!spot) continue;
        makeMonster(pick, spot.x, spot.y, spot.z);
      }
    }

    // босс — в зале Врат
    const bossSpec = monsterSpec('orc_boss');
    if (bossSpec) {
      const b = makeMonster(bossSpec, BOSS_SPOT.x, BOSS_SPOT.y, BOSS_SPOT.z);
      b.state = 'sleep';
    }
  }

  /**
   * Убрать всех монстров, снаряды и мешки.
   */
  function clear() {
    for (const m of list) {
      if (m.group.parent) m.group.parent.remove(m.group);
    }
    list.length = 0;
    for (const p of projectiles) {
      if (p.group.parent) p.group.parent.remove(p.group);
    }
    projectiles.length = 0;
    for (const b of bags) {
      if (b.group.parent) b.group.parent.remove(b.group);
      if (b.interact) {
        const i = ctx.interactables.indexOf(b.interact);
        if (i >= 0) ctx.interactables.splice(i, 1);
      }
    }
    bags.length = 0;
    for (const p of puddles) {
      if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
    }
    puddles.length = 0;
    boss = null;
    if (ctx.ui && ctx.ui.setBoss) ctx.ui.setBoss(null, 0);
  }

  /* ---------------- лут ---------------- */

  /**
   * Таблица добычи по породам.
   *
   * Сейчас лут только для продажи, но у каждого предмета есть
   * `craft` — заготовка под будущий крафт.
   */
  const LOOT_TABLE = {
    trash: [
      { id: 'goblin_ear', rarity: 'common', weight: 5 },
      { id: 'goblin_tooth', rarity: 'common', weight: 4 },
      { id: 'slime_jelly', rarity: 'common', weight: 4 },
      { id: 'spider_web', rarity: 'common', weight: 3 },
      { id: 'shroom_cap', rarity: 'common', weight: 3 },
    ],
    normal: [
      { id: 'goblin_ear', rarity: 'common', weight: 3 },
      { id: 'slime_jelly', rarity: 'common', weight: 2 },
      { id: 'shroom_cap', rarity: 'common', weight: 2 },
      { id: 'ghost_dust', rarity: 'uncommon', weight: 3 },
      { id: 'snake_fang', rarity: 'uncommon', weight: 3 },
      { id: 'golem_core', rarity: 'rare', weight: 2 },
    ],
    elite: [
      { id: 'guard_badge', rarity: 'uncommon', weight: 3 },
      { id: 'ghost_dust', rarity: 'uncommon', weight: 2 },
      { id: 'golem_core', rarity: 'rare', weight: 3 },
      { id: 'warden_seal', rarity: 'epic', weight: 1 },
    ],
    boss: [
      { id: 'orc_tusk', rarity: 'rare', weight: 4 },
      { id: 'warden_seal', rarity: 'epic', weight: 3 },
      { id: 'grim_crown', rarity: 'legendary', weight: 2 },
    ],
  };

  /**
   * Выбрать предмет добычи по ступени.
   *
   * @param {string} tier ступень
   * @returns {object|null} предмет
   */
  function rollLoot(tier) {
    const table = LOOT_TABLE[tier] || LOOT_TABLE.trash;
    let total = 0;
    for (const e of table) total += e.weight;
    let roll = Math.random() * total;
    for (const e of table) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return table[0];
  }

  /**
   * Выбросить мешок с добычей.
   *
   * @param {object} m убитый монстр
   */
  function dropLoot(m) {
    const tier = m.spec.tier;
    const count = m.boss ? 3 : (Math.random() < 0.55 ? 2 : 1);
    const items = [];
    for (let i = 0; i < count; i++) {
      const e = rollLoot(tier);
      if (e) items.push(e);
    }
    if (!items.length) return;

    const rarity = items.reduce((best, it) => {
      const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      return order.indexOf(it.rarity) > order.indexOf(best) ? it.rarity : best;
    }, 'common');

    const model = lootBagModel(rarity);
    const gx = m.x + (Math.random() - 0.5) * 0.5;
    const gz = m.z + (Math.random() - 0.5) * 0.5;
    model.group.position.set(gx, m.y, gz);
    if (root) root.add(model.group);

    const bag = {
      id: `bag${++lootBagId}`,
      model,
      group: model.group,
      x: gx, y: m.y, z: gz,
      items,
      rarity,
      interact: null,
    };

    const pos = new THREE.Vector3(gx, m.y + 0.4, gz);
    const label = `Подобрать добычу (${items.length})`;
    bag.interact = ctx.systems.interactions.add(pos, 2.4, label, () => pickUp(bag), 'dungeon');
    bags.push(bag);
  }

  /**
   * Подобрать мешок.
   *
   * @param {object} bag мешок
   * @returns {boolean} получилось ли
   */
  function pickUp(bag) {
    const inv = ctx.inventory;
    if (!inv) return false;
    const names = [];
    const left = [];
    for (const e of bag.items) {
      const spec = ctx.itemById ? ctx.itemById(e.id) : null;
      if (!spec) continue;
      const ok = inv.add(makeStack(spec));
      if (ok && ok.ok) names.push(spec.name);
      else left.push(e);      // не влезло — остаётся в мешке
    }
    if (!names.length) {
      if (ctx.ui) ctx.ui.toast('Сумка полна — некуда положить добычу.', 2600);
      return false;
    }
    // если что-то не влезло — мешок остаётся на полу с остатком (раньше
    // добыча пропадала молча)
    if (left.length) {
      bag.items = left;
      if (bag.interact) bag.interact.label = `Подобрать добычу (${left.length})`;
      if (ctx.ui) {
        ctx.ui.toast(`Добыча: ${names.join(', ')}. Осталось в мешке: ${left.length}.`, 3200);
        ctx.ui.renderInventory(ctx.inventory);
      }
      return true;
    }
    const i = ctx.interactables.indexOf(bag.interact);
    if (i >= 0) ctx.interactables.splice(i, 1);
    if (bag.group.parent) bag.group.parent.remove(bag.group);
    const bi = bags.indexOf(bag);
    if (bi >= 0) bags.splice(bi, 1);
    if (ctx.ui) {
      ctx.ui.toast(`Добыча: ${names.join(', ')}.`, 3000);
      ctx.ui.renderInventory(ctx.inventory);
    }
    return true;
  }

  /* ---------------- снаряды ---------------- */

  /**
   * Выстрелить снарядом.
   *
   * @param {object} m стрелок
   * @param {string} kind 'arrow' | 'spore'
   */
  function shoot(m, kind) {
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    const py = ctx.player.pos.y + ctx.player.groundY + 1.2;
    const dx = px - m.x, dz = pz - m.z;
    const d = Math.hypot(dx, dz) || 1;
    const speed = kind === 'arrow' ? 16 : 9;
    const g = new THREE.Group();
    let mesh;
    if (kind === 'arrow') {
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.62, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.8 }),
      );
      shaft.rotation.x = Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.045, 0.14, 5),
        new THREE.MeshStandardMaterial({ color: 0xc3cad2, roughness: 0.35, metalness: 0.2 }),
      );
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.36;
      g.add(shaft, tip);
    } else {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xc8d8a0, transparent: true, opacity: 0.75,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }),
      );
      g.add(puff);
    }
    g.position.set(m.x, m.y + 0.9, m.z);
    g.lookAt(px, py, pz);
    if (root) root.add(g);
    projectiles.push({
      kind, group: g,
      x: m.x, y: m.y + 0.9, z: m.z,
      vx: (dx / d) * speed, vy: kind === 'arrow' ? 0.4 : 0.9, vz: (dz / d) * speed,
      dmg: Math.round(m.dmg * (kind === 'arrow' ? 1 : 0.7)),
      life: 4,
    });
    if (ctx.ambience && ctx.ambience.shoot) ctx.ambience.shoot();
  }

  /* ---------------- урон игроку ---------------- */

  /**
   * Монстр ударил игрока.
   *
   * @param {object} m монстр
   * @param {number} [dmg] урон (по умолчанию — урон монстра)
   */
  function hitPlayer(m, dmg) {
    if (playerInvuln > 0) return false;
    const amount = dmg ?? m.dmg;
    const stats = ctx.stats;
    stats.damage(amount);
    if (stats.hp <= 0) {
      stats.hp = 0;
      if (ctx.systems && ctx.systems.death) {
        ctx.systems.death.kill(`${m.spec.name} забрала вас в пещере. Тьма сомкнулась.`);
      }
      return true;
    }
    playerInvuln = 0.8;
    playerStun = m.boss ? 0.5 : 0.32;
    const dx = ctx.player.pos.x - m.x, dz = ctx.player.pos.z - m.z;
    const d = Math.hypot(dx, dz) || 1;
    ctx.player.pos.x += (dx / d) * (m.boss ? 1.2 : 0.7);
    ctx.player.pos.z += (dz / d) * (m.boss ? 1.2 : 0.7);
    if (ctx.ambience) ctx.ambience.hurt();
    if (ctx.ui && ctx.ui.flashDamage) ctx.ui.flashDamage();
    return true;
  }

  /* ---------------- атаки игрока по монстрам ---------------- */

  /**
   * Монстр под прицелом (для подсказки HUD).
   *
   * @param {THREE.Vector3} org начало луча
   * @param {THREE.Vector3} dir направление
   * @param {number} range дальность
   * @param {number} cone половина угла
   * @returns {object|null} монстр
   */
  function aimTarget(org, dir, range, cone) {
    let best = null, bestD = Infinity;
    for (const m of list) {
      if (m.hp <= 0 || m.dying > 0) continue;
      const dx = m.x - org.x, dz = m.z - org.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1e-3) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot < Math.cos(cone)) continue;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  /**
   * Удар брандом: гасит стойкость монстра.
   *
   * @param {THREE.Vector3} org начало луча
   * @param {THREE.Vector3} dir направление
   * @param {number} range дальность
   * @param {number} cone половина угла
   * @returns {boolean} попали ли
   */
  function strike(org, dir, range, cone) {
    const best = aimTarget(org, dir, range, cone);
    if (!best) {
      makeNoise(org, 12);
      return false;
    }
    best.veil -= 1;
    best.stun = 0.9;
    best.state = 'recoil';
    best.stateT = 0;
    const dx = best.x - org.x, dz = best.z - org.z;
    const d = Math.hypot(dx, dz) || 1;
    best.vx = (dx / d) * 7.5;
    best.vz = (dz / d) * 7.5;
    if (best.veil <= 0) kill(best);
    else if (ctx.ambience) ctx.ambience.hiss();
    makeNoise(org, 8);
    return true;
  }

  /**
   * Удар оружием: снимает здоровье.
   *
   * @param {THREE.Vector3} org начало луча
   * @param {THREE.Vector3} dir направление
   * @param {number} range дальность
   * @param {number} cone половина угла
   * @param {number} dmg урон
   * @returns {{hit: boolean, killed: boolean}} результат
   */
  function hit(org, dir, range, cone, dmg) {
    const best = aimTarget(org, dir, range, cone);
    if (!best) {
      makeNoise(org, 10);
      return { hit: false, killed: false };
    }
    let amount = dmg;
    // щит элитного гасит часть урона
    if (best.spec.guard) amount = Math.max(1, Math.round(amount * (1 - best.spec.guard)));
    best.hp -= amount;
    best.hitFlash = 1;
    best.stun = 0.35;
    if (best.state !== 'dead') best.state = 'recoil';
    best.stateT = 0;
    const dx = best.x - org.x, dz = best.z - org.z;
    const d = Math.hypot(dx, dz) || 1;
    best.vx = (dx / d) * 4.5;
    best.vz = (dz / d) * 4.5;
    let killed = false;
    if (best.hp <= 0) {
      killed = true;
      kill(best);
    } else if (ctx.ambience) {
      ctx.ambience.hiss();
    }
    makeNoise(org, 6);
    return { hit: true, killed };
  }

  /**
   * Убить монстра.
   *
   * @param {object} m монстр
   */
  function kill(m) {
    if (m.dying > 0) return;
    m.dying = 0.75;
    m.dyingT = 0;
    m.veil = 0;
    m.hp = 0;
    m.state = 'dead';
    if (m.boss) {
      if (ctx.ui && ctx.ui.setBoss) ctx.ui.setBoss(null, 0);
      if (ctx.ui) ctx.ui.toast('Орк-владыка Гримм падает. Пещера затихает.', 4200);
    }
    dropLoot(m);
    if (ctx.ambience) ctx.ambience.dissolve();
  }

  /**
   * Вспышка заклинания: отбрасывает ближних.
   *
   * @param {THREE.Vector3} pos центр
   * @param {number} radius радиус
   * @param {number} knock сила
   * @param {number} stun оглушение
   * @param {number} noise радиус шума
   */
  function flare(pos, radius, knock, stun, noise) {
    for (const m of list) {
      if (m.dying > 0) continue;
      const dx = m.x - pos.x, dz = m.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      m.stun = stun;
      m.state = 'recoil';
      m.stateT = 0;
      const l = d || 1;
      m.vx = (dx / l) * knock * 3;
      m.vz = (dz / l) * knock * 3;
    }
    makeNoise(pos, noise);
  }

  /**
   * Шум: поднять монстров рядом.
   *
   * @param {THREE.Vector3} pos где шум
   * @param {number} radius радиус
   */
  function makeNoise(pos, radius) {
    for (const m of list) {
      if (m.dying > 0) continue;
      if (Math.hypot(m.x - pos.x, m.z - pos.z) > radius) continue;
      if (m.state === 'sleep') m.state = 'stalk';
    }
  }

  /* ---------------- ИИ ---------------- */

  /**
   * Начать атаку.
   *
   * @param {object} m монстр
   */
  function beginAttack(m) {
    const spec = m.spec;
    m.attackName = spec.attack;
    m.state = 'windup';
    m.stateT = 0;
    if (spec.attack === 'boss') {
      // босс выбирает атаку по ситуации
      const dist = Math.hypot(ctx.player.pos.x - m.x, ctx.player.pos.z - m.z);
      const roll = Math.random();
      if (dist > 7 && roll < 0.5) m.attackName = 'charge';
      else if (roll < 0.28) m.attackName = 'roar';
      else if (roll < 0.55) m.attackName = 'slam';
      else m.attackName = 'swing';
      m.windup = m.attackName === 'charge' ? 0.85
        : m.attackName === 'roar' ? 1.0
          : m.attackName === 'slam' ? 0.95 : 0.55;
    }
  }

  /**
   * Момент удара: применить урон.
   *
   * @param {object} m монстр
   */
  function applyAttack(m) {
    const spec = m.spec;
    // важно: ветвиться по выбранной атаке (`m.attackName`), а не по `spec.attack`:
    // у босса spec.attack === 'boss', а конкретную атаку он выбирает в момент
    // замаха (swing / slam / roar / charge)
    const kind = m.attackName || spec.attack;
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    const dx = px - m.x, dz = pz - m.z;
    const dist = Math.hypot(dx, dz);

    if (kind === 'ranged') {
      shoot(m, 'arrow');
      return;
    }
    if (kind === 'spore') {
      shoot(m, 'spore');
      return;
    }
    if (kind === 'splash') {
      if (dist <= spec.reach) hitPlayer(m);
      // ядовитая лужа под монстром — её должно быть видно на полу
      spawnPuddle(m, 2.2, 9, Math.max(1, Math.round(m.dmg * 0.35)));
      return;
    }
    if (kind === 'charge') {
      // наскок: урон наносится на пути (в ветке 'attack'), здесь — волна
      spawnShock(m, 0x9fd8ff);
      return;
    }
    if (kind === 'slam') {
      // удар оземь: радиус вокруг монстра
      if (dist <= spec.reach + 0.9) hitPlayer(m, Math.round(m.dmg * 1.15));
      spawnShock(m);
      return;
    }
    if (kind === 'roar') {
      // рёв: призывает подмогу и отталкивает
      const dxp = px - m.x, dzp = pz - m.z;
      const d = Math.hypot(dxp, dzp) || 1;
      ctx.player.pos.x += (dxp / d) * 1.4;
      ctx.player.pos.z += (dzp / d) * 1.4;
      summon(m, 2);
      if (ctx.ui) ctx.ui.toast('Орк ревёт — из темноты лезут гоблины!', 2600);
      return;
    }
    // обычная ближняя атака (в том числе прыжок паука и укус змеи)
    if (dist <= spec.reach) hitPlayer(m);
  }

  /**
   * Ядовитая лужа на полу: зелёное пятно, видимое и в темноте.
   *
   * @param {object} m монстр-источник
   * @param {number} r радиус
   * @param {number} life сколько живёт
   * @param {number} dmg урон в тик
   */
  function spawnPuddle(m, r, life, dmg) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({
        color: 0x74d94f, transparent: true, opacity: 0.42,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(m.x, m.y + 0.06, m.z);
    if (root) root.add(mesh);
    puddles.push({ x: m.x, z: m.z, r, life, dmg, mesh, dmgT: 0 });
  }

  /**
   * Кольцо ударной волны (для « slam » и « charge »).
   *
   * @param {object} m монстр
   * @param {number} color цвет кольца
   */
  function spawnShock(m, color = 0xffd08a) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    g.position.set(m.x, m.y + 0.12, m.z);
    if (root) root.add(g);
    const shock = { group: g, ring, t: 0 };
    (m.shocks || (m.shocks = [])).push(shock);
  }

  /**
   * Призвать подмогу (босс).
   *
   * @param {object} m босс
   * @param {number} n сколько
   */
  function summon(m, n) {
    for (let i = 0; i < n; i++) {
      const spec = monsterSpec(Math.random() < 0.5 ? 'goblin_sword' : 'goblin_bow');
      const a = Math.random() * Math.PI * 2;
      const x = m.x + Math.cos(a) * 4.5;
      const z = m.z + Math.sin(a) * 4.5;
      if (!freeSpot(x, z, spec.radius + 0.2, m.y, 1.6)) continue;
      const s = makeMonster(spec, x, m.y, z);
      s.state = 'stalk';
    }
  }

  /**
   * Обновление одного монстра.
   *
   * @param {object} m монстр
   * @param {number} dt кадр
   * @param {number} t время
   * @param {boolean} lit горит ли факел
   * @param {number} aggro радиус агро
   */
  function updateMonster(m, dt, t, lit, aggro) {
    const spec = m.spec;
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    const dx = px - m.x, dz = pz - m.z;
    const dist = Math.hypot(dx, dz);
    const wounded = ctx.stats.hp <= 25;

    m.hitFlash = Math.max(0, m.hitFlash - dt * 3.2);
    m.slow = Math.max(0, m.slow - dt);
    m.cd = Math.max(0, m.cd - dt);

    // смерть
    if (m.dying > 0) {
      m.dying -= dt;
      m.dyingT += dt;
      const k = Math.max(0, m.dying / 0.75);
      m.group.scale.set(m.baseScale, Math.max(0.05, k) * m.baseScale, m.baseScale);
      m.group.rotation.z = (1 - k) * 1.4;
      m.group.position.set(m.x, m.y - (1 - k) * 0.4, m.z);
      m.model.update(t, dt, m);
      if (m.dying <= 0) {
        m.group.visible = false;
        m.group.scale.setScalar(m.baseScale);
        m.group.rotation.z = 0;
      }
      return;
    }

    // состояния
    m.stateT += dt;
    if (m.stun > 0) {
      m.stun -= dt;
      if (m.stun <= 0 && m.state === 'recoil') m.state = 'stalk';
    }

    if (m.state === 'recoil') {
      const decay = Math.pow(0.02, dt);
      m.vx *= decay;
      m.vz *= decay;
      const nx = m.x + m.vx * dt;
      const nz = m.z + m.vz * dt;
      // отброс не должен втолкнуть монстра в стену: если там глухо,
      // гасим скорость и останавливаемся
      if (m.spec.ghost || freeSpot(nx, nz, m.spec.radius, m.y, beastHeight(m))) {
        m.x = nx;
        m.z = nz;
      } else {
        m.vx = 0;
        m.vz = 0;
      }
      const [cx, cz] = clampToBounds(m.x, m.z);
      m.x = cx;
      m.z = cz;
      m.moveSpeed = 0;
      if (m.stun <= 0) {
        m.state = 'stalk';
        m.stateT = 0;
      }
    } else if (m.state === 'sleep') {
      if (dist < aggro) {
        m.state = 'stalk';
        m.stateT = 0;
      } else {
        // дрейф вокруг логовища
        m.dir += (Math.random() - 0.5) * dt * 1.6;
        const toHome = Math.hypot(m.x - m.home.x, m.z - m.home.z);
        if (toHome > 12) {
          moveToward(m, m.home.x, m.home.z, 0.7 * dt);
        } else {
          // дрейф тоже проверяем: раньше спящие звери уползали в стены
          const nx = m.x + Math.cos(m.dir) * 0.25 * dt;
          const nz = m.z + Math.sin(m.dir) * 0.25 * dt;
          if (m.spec.ghost || freeSpot(nx, nz, m.spec.radius, m.y, beastHeight(m))) {
            m.x = nx;
            m.z = nz;
          } else {
            m.dir += Math.PI * 0.7;   // упёрся — разворачиваем
          }
        }
        m.moveSpeed = 0.25;
      }
    } else if (m.state === 'stalk') {
      const reach = spec.reach;
      const wantRange = spec.attack === 'ranged' || spec.attack === 'spore'
        ? Math.max(5, reach * 0.65)
        : spec.attack === 'melee' || spec.attack === 'leap' || spec.attack === 'bite'
          ? reach * 0.75
          : reach * 0.9;
      const sp = spec.speed * difficulty.speed * (m.slow > 0 ? 0.45 : 1) * (wounded ? 0.8 : 1);
      // горящий факел отпугивает: зверь не подходит ближе, чем на 3 м
      // (призраки и стрелки факела не боятся)
      const standoff = (lit && !spec.ghost && spec.attack !== 'ranged' && spec.attack !== 'spore')
        ? 3.0 : 0;

      if (spec.attack === 'ranged' || spec.attack === 'spore') {
        // держать дистанцию
        if (dist < wantRange * 0.7) {
          // отступать
          const ang = Math.atan2(m.z - pz, m.x - px);
          moveToward(m, m.x + Math.cos(ang) * 3, m.z + Math.sin(ang) * 3, sp * dt);
        } else if (dist > wantRange * 1.15) {
          moveToward(m, px, pz, sp * dt);
        } else {
          m.moveSpeed = 0;
        }
      } else if (dist > wantRange && dist > standoff) {
        moveToward(m, px, pz, sp * dt);
      } else {
        m.moveSpeed = 0;
      }

      // не подходим вплотную при горящем факеле (кроме призраков — они идут)
      if (standoff && dist < standoff) m.moveSpeed = 0;

      // с какого расстояния зверь решается атаковать. У босса это больше:
      // его «наскок» и «рёв» бьют издалека
      const engage = spec.engage || (reach + 0.6);
      if (m.cd <= 0 && dist <= engage && dist > 0.3) {
        beginAttack(m);
      } else if (m.cd <= 0 && (spec.attack === 'ranged' || spec.attack === 'spore')
        && dist > reach + 0.6 && dist < reach * 1.5) {
        beginAttack(m);
      }

      // если игрок убежал далеко — откатиться в сон
      if (dist > aggro * 1.5) {
        m.state = 'sleep';
        m.stateT = 0;
      }
    } else if (m.state === 'windup') {
      m.moveSpeed = 0;
      // следим за игроком в конце замаха
      if (m.stateT > m.windup * 0.6 && m.stateT < m.windup) {
        const want = Math.atan2(px - m.x, pz - m.z);
        let d = want - m.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        m.group.rotation.y += d * Math.min(1, dt * 5);
      }
      if (m.stateT >= m.windup) {
        m.state = 'attack';
        m.stateT = 0;
      }
    } else if (m.state === 'attack') {
      const sp = spec.speed * difficulty.speed;
      if (m.attackName === 'charge') {
        // наскок: орк несётся вперёд и ранит на пути
        const ang = Math.atan2(pz - m.z, px - m.x);
        const step = sp * 2.6 * dt;
        const nx = m.x + Math.cos(ang) * step;
        const nz = m.z + Math.sin(ang) * step;
        // орк тяжёлый: мелкие камни его не остановят
        if (freeSpot(nx, nz, spec.radius * 0.6, m.y, beastHeight(m))) {
          m.x = nx;
          m.z = nz;
        } else {
          const sx = m.x + Math.cos(ang + Math.PI / 2) * step;
          const sz = m.z + Math.sin(ang + Math.PI / 2) * step;
          if (freeSpot(sx, sz, spec.radius * 0.6, m.y, beastHeight(m))) { m.x = sx; m.z = sz; }
        }
        m.moveSpeed = sp * 2.6;
        // наскок ранит того, кого задевает
        if (Math.hypot(px - m.x, pz - m.z) <= spec.reach + 0.8) {
          hitPlayer(m, Math.round(m.dmg * 1.2));
        }
      } else if (m.attackName === 'leap') {
        // паук прыгает к игроку
        const ang = Math.atan2(pz - m.z, px - m.x);
        const nx = m.x + Math.cos(ang) * sp * 2.2 * dt;
        const nz = m.z + Math.sin(ang) * sp * 2.2 * dt;
        if (freeSpot(nx, nz, spec.radius, m.y, beastHeight(m))) { m.x = nx; m.z = nz; }
        m.moveSpeed = sp * 2.2;
      } else {
        m.moveSpeed = 0;
      }
      if (m.stateT >= m.active) {
        applyAttack(m);
        m.state = 'recoil';
        m.stateT = 0;
        m.cd = spec.cd / Math.max(0.5, difficulty.speed);
        m.stun = 0.35;
        const dxp = px - m.x, dzp = pz - m.z;
        const d = Math.hypot(dxp, dzp) || 1;
        m.vx = (dxp / d) * 3;
        m.vz = (dzp / d) * 3;
      }
    }

    // разворот к игроку
    if (m.state === 'stalk' || m.state === 'windup') {
      const want = Math.atan2(px - m.x, pz - m.z);
      let d = want - m.group.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      m.group.rotation.y += d * Math.min(1, dt * (m.spec.ghost ? 2.5 : 5));
    }

    // фаза шага растёт с пройденным путём
    m.phase += m.moveSpeed * dt * 1.6;

    // монстр не выходит за пределы пещеры
    const [clx, clz] = clampToBounds(m.x, m.z);
    m.x = clx;
    m.z = clz;

    m.group.position.set(m.x, m.y, m.z);

    // кольца ударной волны
    if (m.shocks) {
      for (let i = m.shocks.length - 1; i >= 0; i--) {
        const s = m.shocks[i];
        s.t += dt;
        const k = Math.min(1, s.t / 0.6);
        s.ring.scale.setScalar(1 + k * 6);
        s.ring.material.opacity = 0.8 * (1 - k);
        if (k >= 1) {
          if (s.group.parent) s.group.parent.remove(s.group);
          m.shocks.splice(i, 1);
        }
      }
    }

    m.model.update(t, dt, m);
  }

  /**
   * Двигать монстра к точке с учётом стен.
   *
   * @param {object} m монстр
   * @param {number} tx цель X
   * @param {number} tz цель Z
   * @param {number} step шаг
   */
  function moveToward(m, tx, tz, step) {
    // призрак идёт сквозь стены — ему стены не помеха
    if (m.spec.ghost) {
      const ang = Math.atan2(tz - m.z, tx - m.x);
      m.x += Math.cos(ang) * step;
      m.z += Math.sin(ang) * step;
      m.moveSpeed = m.spec.speed * difficulty.speed;
      return;
    }
    const ang = Math.atan2(tz - m.z, tx - m.x);
    const dir = pickDir(m, ang, 0.9);
    const nx = m.x + Math.cos(dir) * step;
    const nz = m.z + Math.sin(dir) * step;
    if (freeSpot(nx, nz, m.spec.radius, m.y, beastHeight(m))) {
      m.x = nx;
      m.z = nz;
      m.moveSpeed = m.spec.speed * difficulty.speed;
    } else {
      const slide = pickDir(m, ang + Math.PI / 2, 0.9);
      const sx = m.x + Math.cos(slide) * step;
      const sz = m.z + Math.sin(slide) * step;
      if (freeSpot(sx, sz, m.spec.radius, m.y, beastHeight(m))) {
        m.x = sx;
        m.z = sz;
        m.moveSpeed = m.spec.speed * difficulty.speed;
      } else {
        m.moveSpeed = 0;
      }
    }
  }

  /**
   * Обновление всех монстров.
   *
   * @param {number} dt кадр
   * @param {number} t время
   */
  function update(dt, t) {
    if (paused) return;
    if (!list.length && !projectiles.length) return;
    playerInvuln = Math.max(0, playerInvuln - dt);
    playerStun = Math.max(0, playerStun - dt);

    const combat = ctx.systems.combat;
    const lit = combat ? combat.state.lit : false;
    const aggroBase = 18;
    const aggro = lit ? aggroBase : aggroBase * 1.3;
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    let threat = 0;

    for (const m of list) {
      // призраки проходят сквозь стены — не проверяем для них коллайдеры
      updateMonster(m, dt, t, lit, aggro * (m.boss ? 1.5 : 1));

      if (m.dying > 0) continue;
      if (m.state === 'stalk' || m.state === 'windup' || m.state === 'attack') {
        const d = Math.hypot(px - m.x, pz - m.z);
        threat = Math.max(threat, 1 - Math.min(1, d / 12));
        if (d < 9 && Math.random() < 0.004 && ctx.ambience) {
          ctx.ambience.whisper(0.7 + (1 - d / 9) * 0.5);
        }
      }
    }

    // полоса босса: только пока босс жив и проснулся (спойлером она тоже не должна быть)
    if (boss && ctx.ui && ctx.ui.setBoss) {
      const alive = boss.hp > 0 && boss.dying <= 0;
      const awake = boss.state !== 'sleep' && boss.state !== 'dead';
      if (alive && awake) ctx.ui.setBoss(boss.spec.name, Math.max(0, boss.hp / boss.maxHp));
      else ctx.ui.setBoss(null, 0);
    }

    // снаряды
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= (p.kind === 'arrow' ? 2.2 : 1.2) * dt;
      p.group.position.set(p.x, p.y, p.z);
      if (p.kind === 'arrow') p.group.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      // попадание
      const dx = px - p.x, dz = pz - p.z;
      if (Math.hypot(dx, dz) < 0.7 && Math.abs(p.y - (ctx.player.pos.y + ctx.player.groundY + 1.0)) < 1.6) {
        hitPlayer({ spec: { name: 'Стрела' }, dmg: p.dmg, x: p.x, z: p.z, boss: false }, p.dmg);
        if (p.kind === 'spore') ctx.player.slow = 2.5;
        p.life = 0;
      }
      if (p.life <= 0 || p.y < -6.5) {
        if (p.group.parent) p.group.parent.remove(p.group);
        projectiles.splice(i, 1);
      }
    }

    // ядовитые лужи
    for (let i = puddles.length - 1; i >= 0; i--) {
      const p = puddles[i];
      p.life -= dt;
      if (Math.hypot(px - p.x, pz - p.z) < p.r) {
        p.dmgT = (p.dmgT || 0) - dt;
        if (p.dmgT <= 0) {
          p.dmgT = 1.0;
          hitPlayer({ spec: { name: 'Слизь' }, dmg: p.dmg, x: p.x, z: p.z, boss: false }, p.dmg);
        }
      }
      if (p.life <= 0) {
        if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
        puddles.splice(i, 1);
      }
    }

    // мешки
    for (const b of bags) b.model.update(t, dt);

    ctx.shadowThreat = threat;
    ctx.playerStunned = playerStun;
  }

  /**
   * Расставлены ли стражи (элитные гоблины) — на этом условии открывается
   * путь дальше по сюжету.
   *
   * @returns {boolean} да
   */
  function guardsCleared() {
    const guards = list.filter((m) => m.isGuard);
    return guards.length > 0 && guards.every((m) => m.dying > 0 || m.hp <= 0);
  }

  /**
   * Сколько стражей ещё целы.
   *
   * @returns {number} число
   */
  function guardsLeft() {
    return list.filter((m) => m.isGuard && m.dying <= 0 && m.hp > 0).length;
  }

  /**
   * Живой ли босс (нужно для HUD).
   *
   * @returns {object|null} босс
   */
  function getBoss() {
    return boss && boss.dying <= 0 && boss.hp > 0 ? boss : null;
  }

  return {
    list, bags, spawn, clear, update, strike, hit, flare, makeNoise, aimTarget,
    guardsCleared, guardsLeft, getBoss,
    /** Сколько снарядов в полёте (для проверок). */
    __projCount() { return projectiles.length; },
    /** Сколько ядовитых луж на полу (для проверок). */
    __puddleCount() { return puddles.length; },
    /** Сколько мешков с добычей лежит (для проверок). */
    __bagCount() { return bags.length; },
    /** Заморозить монстров (игрок погиб). */
    pause() { paused = true; },
    /** Разбудить монстров. */
    resume() { paused = false; },
    /** Пересоздать монстров с новой сложностью. */
    respawn() { spawn(); },
    get playerInvuln() { return playerInvuln; },
    get playerStun() { return playerStun; },
    get difficulty() { return difficulty; },
  };
}
