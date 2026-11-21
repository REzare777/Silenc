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

/** Ключ в localStorage. */
export const SAVE_KEY = 'wv.save.v1';

/** Номер формата сохранения. Повышается при несовместимых изменениях. */
export const SAVE_VERSION = 1;

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
  return {
    day: ctx.calendar ? ctx.calendar.day : 1,
    season: ctx.calendar ? ctx.calendar.season : 'spring',
    year: ctx.calendar ? ctx.calendar.year : 1,
    tod: ctx.env ? ctx.env.current : 'morning',
    hp: ctx.stats ? ctx.stats.hp : 100,
    stamina: ctx.stats ? ctx.stats.stamina : 100,
    mana: ctx.stats ? ctx.stats.mana : 100,
    coins: ctx.stats ? ctx.stats.coins : 30,
    pos: p ? { x: p.pos.x, z: p.pos.z, yaw: p.yaw } : { x: 0, z: 16, yaw: 0 },
    loc: ctx.loc || 'village',
    inv: slots,
    invSel: inv ? inv.sel : 0,
    caught: ctx.caught ? { ...ctx.caught } : {},
    flags: ctx.flags ? { ...ctx.flags } : {},
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

  // характеристики
  if (ctx.stats) {
    const st = ctx.stats;
    if (typeof data.hp === 'number') st.hp = Math.max(0, Math.min(st.maxHp, data.hp));
    if (typeof data.stamina === 'number') st.stamina = Math.max(0, Math.min(st.maxStamina, data.stamina));
    if (typeof data.mana === 'number') st.mana = Math.max(0, Math.min(st.maxMana, data.mana));
    if (typeof data.coins === 'number') st.coins = Math.max(0, Math.round(data.coins));
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

  // улов (для коллекции пород) и флаги
  if (ctx.caught && data.caught) Object.assign(ctx.caught, data.caught);
  if (ctx.flags && data.flags) Object.assign(ctx.flags, data.flags);

  // позиция — только в деревне: в локациях игрок появляется у входа
  if (ctx.player && data.pos && !ctx.systems?.locations?.isInside?.()) {
    ctx.player.teleport(data.pos.x, data.pos.z, data.pos.yaw ?? 0);
  }

  return true;
}
