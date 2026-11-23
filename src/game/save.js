/**
 * ============================================================================
 *  Сохранения: игра помнит, где игрок был и что у него было
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  Пока в игре нет сохранений, «Шёпот-Долина» — это прогулка. Зайдёшь,
 *  посмотришь, выйдешь — и всё пропало. Сохранение превращает прогулку
 *  в историю: улов остаётся уловом, монеты — монетами, а колокол в
 *  башне можно звонить снова и снова.
 *
 *  Как это устроено
 *  ----------------
 *  Всё состояние собирается в один плоский объект `snapshot` и пишется
 *  одним куском в `localStorage` под ключом `wv.save.v1`. Обратно:
 *  `load()` читает, проверяет версию и разносит значения по системам.
 *
 *  Версия формата
 *  --------------
 *  Поле `v` — номер формата. Если в будущем формат поменяется (например,
 *  появится новое поле), номер поднимется, а старые сохранения будут
 *  аккуратно отброшены, а не сломают игру. Это дешевле, чем чинить
 *  поломанные файлы у игрока.
 *
 *  Про Steam
 *  ---------
 *  Когда игру обернут в Electron/NW.js, `localStorage` живёт во временном
 *  профиле обёртки и стирается при переустановке. Поэтому модуль умеет
 *  работать и с файловым хранилищем: если обёртка подставит свой
 *  `fileStore`, сохранения поедут в папку данных приложения — туда же,
 *  куда смотрит Steam Auto-Cloud.
 *
 *  @module game/save
 */

/** Ключ в localStorage для «последнего сохранения». */
export const SAVE_KEY = 'wv.save.v1';

/** Ключ в localStorage для ручных слотов (1, 2, 3). */
export const SLOTS_KEY = 'wv.slots.v1';

/** Сколько ручных слотов у игрока. */
export const SLOT_COUNT = 3;

/** Номер формата сохранения. Повышается при несовместимых изменениях. */
export const SAVE_VERSION = 1;

/** Полный бак факела — столько топлива он вмещает (см. `COMBAT.fuelMax`). */
const COMBAT_MAX_FUEL = 100;

/**
 * Хранилище по умолчанию: localStorage.
 * В Electron/NW.js его подменяют на файловый (см. `setFileStore`).
 */
let fileStore = null;

/**
 * Подменить хранилище на файловый (для Steam-обёртки).
 *
 * @param {object|null} store объект с методами read() и write(text)
 */
export function setFileStore(store) {
  fileStore = store || null;
}

/**
 * Прочитать сохранение.
 *
 * @returns {object|null} разобранное сохранение или null
 */
export function readSave() {
  let raw = null;
  try {
    if (fileStore) {
      raw = fileStore.read();
    } else {
      raw = globalThis.localStorage ? localStorage.getItem(SAVE_KEY) : null;
    }
  } catch (e) {
    return null;   // приватный режим, переполненное хранилище — просто без сохранений
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.v !== SAVE_VERSION) return null;   // формат изменился — начинаем заново
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Записать сохранение.
 *
 * @param {object} data объект состояния
 * @returns {boolean} true, если запись удалась
 */
export function writeSave(data) {
  if (!data || typeof data !== 'object') return false;
  const payload = { ...data, v: SAVE_VERSION, at: Date.now() };
  let raw;
  try {
    raw = JSON.stringify(payload);
  } catch (e) {
    return false;
  }
  try {
    if (fileStore) {
      fileStore.write(raw);
    } else {
      if (!globalThis.localStorage) return false;
      localStorage.setItem(SAVE_KEY, raw);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Удалить сохранение.
 *
 * @returns {boolean} true, если удалилось
 */
export function clearSave() {
  try {
    if (fileStore) {
      fileStore.write('');
    } else if (globalThis.localStorage) {
      localStorage.removeItem(SAVE_KEY);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Есть ли сохранение.
 *
 * @returns {boolean}
 */
export function hasSave() {
  return !!readSave();
}

/* ============================================================================
 *  Слоты
 *  =========================================================================
 *
 *  «Последнее сохранение» — один слот, который перезаписывается автосейвом
 *  и кнопкой «Сохранить игру». А ручные слоты — три места, куда игрок
 *  кладёт состояние сам: они не перетираются, и в них можно вернуться
 *  после смерти.
 */

/**
 * Ключ слота в localStorage.
 *
 * @param {number} i номер слота (1..SLOT_COUNT)
 * @returns {string}
 */
function slotKey(i) {
  return `${SLOTS_KEY}.${i}`;
}

/**
 * Прочитать ручной слот.
 *
 * @param {number} i номер слота (1..SLOT_COUNT)
 * @returns {object|null} сохранение или null
 */
export function readSlot(i) {
  if (!Number.isInteger(i) || i < 1 || i > SLOT_COUNT) return null;
  let raw = null;
  try {
    if (fileStore) {
      raw = fileStore.readSlot ? fileStore.readSlot(i) : null;
    } else {
      raw = globalThis.localStorage ? localStorage.getItem(slotKey(i)) : null;
    }
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.v !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

/**
 * Записать ручной слот.
 *
 * @param {number} i номер слота (1..SLOT_COUNT)
 * @param {object} data объект состояния
 * @returns {boolean} удалось ли
 */
export function writeSlot(i, data) {
  if (!Number.isInteger(i) || i < 1 || i > SLOT_COUNT) return false;
  if (!data || typeof data !== 'object') return false;
  const payload = { ...data, v: SAVE_VERSION, at: Date.now() };
  let raw;
  try {
    raw = JSON.stringify(payload);
  } catch (e) {
    return false;
  }
  try {
    if (fileStore) {
      if (fileStore.writeSlot) return !!fileStore.writeSlot(i, raw);
      return false;
    }
    if (!globalThis.localStorage) return false;
    localStorage.setItem(slotKey(i), raw);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Очистить ручной слот.
 *
 * @param {number} i номер слота
 * @returns {boolean}
 */
export function clearSlot(i) {
  if (!Number.isInteger(i) || i < 1 || i > SLOT_COUNT) return false;
  try {
    if (fileStore) {
      if (fileStore.clearSlot) return !!fileStore.clearSlot(i);
      return false;
    }
    if (globalThis.localStorage) localStorage.removeItem(slotKey(i));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Список слотов с краткими данными — для меню загрузки.
 *
 * Первый элемент — «последнее сохранение», дальше ручные слоты.
 *
 * @returns {{key:string,index:number,title:string,exists:boolean,day:number,
 *   season:string,year:number,coins:number,tod:string,at:number}[]}
 */
export function listSlots() {
  const out = [];
  const last = readSave();
  out.push({
    key: 'last',
    index: 0,
    title: 'Последнее сохранение',
    exists: !!last,
    day: last ? last.day : 0,
    season: last ? last.season : '',
    year: last ? last.year : 1,
    coins: last ? last.coins : 0,
    tod: last ? last.tod : '',
    at: last ? last.at : 0,
  });
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const s = readSlot(i);
    out.push({
      key: `slot${i}`,
      index: i,
      title: `Слот ${i}`,
      exists: !!s,
      day: s ? s.day : 0,
      season: s ? s.season : '',
      year: s ? s.year : 1,
      coins: s ? s.coins : 0,
      tod: s ? s.tod : '',
      at: s ? s.at : 0,
    });
  }
  return out;
}

/**
 * Собрать снимок состояния игры.
 *
 * Здесь перечислено всё, что имеет смысл помнить. Всё остальное —
 * декорации и чистые функции — восстанавливается само.
 *
 * @param {object} ctx контекст игры
 * @returns {object} плоский объект состояния
 */
export function snapshot(ctx) {
  const inv = ctx.inventory;
  const slots = [];
  if (inv) {
    for (const s of inv.slots) {
      // предметы описываются ссылкой на справочник (spec) — сохраняем только id
      slots.push(s ? { id: s.id, count: s.count, best: s.best ? { ...s.best } : null } : null);
    }
  }
  const p = ctx.player;
  const combat = ctx.systems && ctx.systems.combat;
  const loadout = ctx.systems && ctx.systems.loadout;
  return {
    day: ctx.calendar ? ctx.calendar.day : 1,
    season: ctx.calendar ? ctx.calendar.season : 'spring',
    year: ctx.calendar ? ctx.calendar.year : 1,
    tod: ctx.env ? ctx.env.current : 'morning',
    hp: ctx.stats ? ctx.stats.hp : 100,
    stamina: ctx.stats ? ctx.stats.stamina : 100,
    mana: ctx.stats ? ctx.stats.mana : 100,
    coins: ctx.stats ? ctx.stats.coins : 30,
    pos: p ? { x: p.pos.x, y: p.y, z: p.pos.z, yaw: p.yaw } : { x: 0, y: 0, z: 16, yaw: 0 },
    loc: ctx.loc || 'village',
    inv: slots,
    invSel: inv ? inv.sel : 0,
    caught: ctx.caught ? { ...ctx.caught } : {},
    flags: ctx.flags ? { ...ctx.flags } : {},
    // факел: сколько топлива осталось, горит ли он и взят ли в руку
    torch: combat ? {
      fuel: combat.state.fuel,
      lit: combat.state.lit,
      equipped: loadout ? loadout.torchEquipped : false,
    } : null,
  };
}

/**
 * Разнести сохранение по системам.
 *
 * @param {object} ctx контекст игры
 * @param {object} data сохранение
 * @returns {boolean} true, если состояние применено
 */
export function applySnapshot(ctx, data) {
  if (!data) return false;

  // календарь
  if (ctx.calendar && typeof ctx.calendar.restore === 'function') {
    ctx.calendar.restore(data.day, data.season, data.year);
  }

  // время суток
  if (ctx.env && data.tod) {
    ctx.env.setTimeOfDay(data.tod, true);
    if (ctx.ui) ctx.ui.setTime(data.tod);
  }

  // характеристики — принимаем только конечные числа: битое сохранение
  // не должно превращать здоровье в NaN
  if (ctx.stats) {
    const st = ctx.stats;
    const hp = finite(data.hp);
    const stam = finite(data.stamina);
    const mana = finite(data.mana);
    const coins = finite(data.coins);
    if (hp !== null) st.hp = Math.max(0, Math.min(st.maxHp, hp));
    if (stam !== null) st.stamina = Math.max(0, Math.min(st.maxStamina, stam));
    if (mana !== null) st.mana = Math.max(0, Math.min(st.maxMana, mana));
    if (coins !== null) st.coins = Math.max(0, Math.round(coins));
    st._changed();
  }

  // инвентарь
  if (ctx.inventory && Array.isArray(data.inv)) {
    const inv = ctx.inventory;
    inv.slots.fill(null);
    for (let i = 0; i < data.inv.length && i < inv.slots.length; i++) {
      const s = data.inv[i];
      if (!s || !s.id) continue;
      // восстанавливаем предмет из справочника по id
      const spec = ctx.itemById ? ctx.itemById(s.id) : null;
      if (!spec) continue;
      inv.slots[i] = {
        id: s.id,
        spec,
        count: Math.max(1, s.count | 0),
        best: s.best ? { ...s.best } : { weight: spec.weightMin ?? 0, length: spec.lengthMin ?? 0 },
      };
    }
    inv.held = null;
    inv.heldFrom = -1;
    inv.sel = typeof data.invSel === 'number' ? data.invSel : 0;
    inv.touch();
    if (ctx.ui) ctx.ui.renderInventory(inv);
  }

  // улов (для коллекции пород) и флаги — только из настоящих объектов
  if (ctx.caught && isPlain(data.caught)) Object.assign(ctx.caught, data.caught);
  if (ctx.flags && isPlain(data.flags)) Object.assign(ctx.flags, data.flags);

  // факел: топливо, горение и то, взят ли он в руку
  if (data.torch) {
    const combat = ctx.systems && ctx.systems.combat;
    const loadout = ctx.systems && ctx.systems.loadout;
    if (combat) {
      if (typeof data.torch.fuel === 'number') {
        combat.state.fuel = Math.max(0, Math.min(COMBAT_MAX_FUEL, data.torch.fuel));
      }
    }
    // сначала экипировка: гореть может только то, что в руке
    if (loadout) loadout.setTorchEquipped(!!data.torch.equipped);
    if (combat) {
      combat.state.lit = !!data.torch.lit && combat.state.fuel > 0 && combat.state.torchEquipped;
      combat.brand.setLit(combat.state.lit);
    }
  }

  // локация и позиция
  // ------------------
  // Сохранение всегда восстанавливает и МЕСТО, и ТОЧКУ. Раньше локация
  // не читалась вовсе: игрок оказывался в координатах интерьера, но в
  // сцене деревни (или наоборот — в стене таверны).
  const loc = typeof data.loc === 'string' ? data.loc : 'village';
  const locSys = ctx.systems && ctx.systems.locations;
  if (locSys && typeof locSys.setLocation === 'function' && ctx.loc !== loc && isKnownLoc(loc)) {
    // во время загрузки автосохранение не нужно — иначе загрузка
    // тут же перезапишет сама себя
    const wasLoading = ctx.loading;
    ctx.loading = true;
    try {
      locSys.setLocation(loc);
    } finally {
      ctx.loading = wasLoading;
    }
  }
  if (ctx.player && data.pos) {
    const px = finite(data.pos.x);
    const pz = finite(data.pos.z);
    // координаты из битого сохранения игнорируем: иначе игрок окажется
    // в NaN-координатах и провалится сквозь мир
    if (px !== null && pz !== null) {
      const yaw = finite(data.pos.yaw);
      ctx.player.teleport(px, pz, yaw === null ? 0 : yaw);
      // высота: в подземелье два яруса, и игрок мог стоять на нижнем
      const py = finite(data.pos.y);
      if (py !== null) ctx.player.y = py;
      ctx.player.vy = 0;
      ctx.player.camY = null;
      // пол под ногами — тот, на котором игрок стоял при сохранении
      if (typeof ctx.player.groundAt === 'function') {
        ctx.player.groundY = ctx.player.groundAt(px, pz, ctx.player.y, 0.6);
      }
    }
  }

  return true;
}

/**
 * Конечное число или null.
 *
 * @param {*} v значение из сохранения
 * @returns {number|null}
 */
function finite(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Обычный объект (не массив, не null).
 *
 * @param {*} v значение из сохранения
 * @returns {boolean}
 */
function isPlain(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Известные локации: village, barn, tavern, dungeon, church, home1..home12.
 *
 * @param {string} loc идентификатор локации
 * @returns {boolean}
 */
function isKnownLoc(loc) {
  if (loc === 'village' || loc === 'barn' || loc === 'tavern'
    || loc === 'dungeon' || loc === 'church') return true;
  const m = /^home(\d+)$/.exec(loc);
  return !!m && Number(m[1]) >= 1 && Number(m[1]) <= 12;
}
