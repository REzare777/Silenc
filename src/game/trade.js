/**
 * ============================================================================
 *  Торговля: покупка и продажа
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  Раньше у трактирщика был один интеракт — «Продать рыбу»: он молча брал
 *  первый предмет из сумки и платил за него. Это не торговля, а лотерея.
 *  Теперь у деревенских торговцев есть полки: трактирщик продаёт съестное
 *  и скупает улов, кузнец торгует оружием.
 *
 *  Как устроено
 *  ------------
 *  * `TRADERS` — кто чем торгует: какие виды предметов покупает, что
 *    продаёт, какой у него наценки.
 *  * `open(id)` — открывает окно торговли: слева вещи игрока, справа
 *    товары торговца. Игра встаёт на паузу, курсор свободен.
 *  * Цены считает `game/items.js`: `sellPrice()` — сколько дадут игроку,
 *    `buyPrice()` — сколько придётся заплатить.
 *
 *  Про наценку
 *  -----------
 *  Торговец покупает дешевле, чем продаёт, — иначе он не earns на жизнь.
 *  Улов при этом трактирщик берёт по полной цене: в деревне свежая рыба
 *  всегда в цене, и иначе игрок не стал бы носить её через пол-деревни.
 *  Оружие кузнец берёт за половину — верёвки, клеймо, бумага, работа.
 *
 *  @module game/trade
 */

import { GOODS, MATERIALS, SPELLS, GEAR, sellPrice, buyPrice, itemIcon, getItem } from './items.js';
import { MONSTERS } from './monsters.js';
import { entryPrice } from './bestiary.js';
import { WEAPONS } from '../world/weapons.js';
import { BELT_START, TOTAL_SLOTS } from '../inventory.js';

/**
 * Торговцы.
 *
 * `buys` — какие виды предметов (kind) скупает; `sells` — что продаёт;
 * `margin` — во сколько раз цена продажи больше закупочной.
 */
export const TRADERS = {
  barkeep: {
    id: 'barkeep',
    name: 'Хорт',
    title: 'трактирщик «Уставшего вепря»',
    buys: ['fish', 'goods', 'spell', 'loot'],
    // Хорт торгует съестным и «старыми словами»: заклинания он знает
    // от прежней хозяйки, а продаёт их от её имени
    sells: GOODS.concat(SPELLS),
    margin: 1.0,
    greet: 'Эль, хлеб, сыр — цены я назначаю сам, не обессудь. А за улов дам сполна: в деревне рыба нарасхват. Свитки с заклинаниями — разговор особый.',
    stock: null,       // товары не кончаются
  },
  blacksmith: {
    id: 'blacksmith',
    name: 'Торн',
    title: 'кузнец',
    buys: ['weapon', 'gear', 'loot'],
    // оружие, снаряжение и материалы кузнеца: «смола и фитиль» — то же,
    // чем он набивает факел, поэтому её можно и купить, и сразу заправить
    sells: WEAPONS.concat(MATERIALS).concat(GEAR),
    margin: 1.0,
    greet: 'Мне нужен металл, тебе — оружие. Сговоримся. Только с двуручником поосторожней: он и правда тяжёлый. Факел тоже найдётся — крепкий, туго обмотанный.',
    stock: null,
  },
};

/**
 * Создать подсистему торговли.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система торговли
 */
export function createTrade(ctx) {
  let openId = null;
  /** Что сделать после закрытия окна торговли. */
  let onClose = null;

  /**
   * Открыть торговлю с торговцем.
   *
   * @param {string} id идентификатор торговца
   * @returns {boolean}
   */
  function open(id, opts = {}) {
    const t = TRADERS[id];
    if (!t) return false;
    openId = id;
    // что сделать после закрытия торговли (например — вернуться в разговор)
    onClose = opts.onClose || null;

    // игра встаёт на паузу
    ctx.mode = 'trade';
    ctx.player.acceptInput = false;
    ctx.player.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();

    ctx.ui.openTrade({
      name: t.name,
      title: t.title,
      greet: t.greet,
      goods: goodsOf(t),
    });
    refresh();
    return true;
  }

  /**
   * Купить запись о породе в зверинце.
   *
   * Запись открывает породу навсегда: она попадает в сохранение и
   * переживает загрузку. Повторно купить нельзя — запись уже есть.
   *
   * @param {string} id идентификатор товара (`codex_<порода>`)
   * @returns {boolean} получилось ли
   */
  function buyCodex(id) {
    const sys = ctx.systems && ctx.systems.bestiary;
    if (!sys) return false;
    const speciesId = id.slice('codex_'.length);
    const spec = MONSTERS.find((m) => m.id === speciesId);
    if (!spec || sys.has(speciesId)) return false;
    const price = entryPrice(spec);
    if (!ctx.stats.spendCoins(price)) {
      ctx.ui.toast('Не хватает монет.', 2600);
      return false;
    }
    sys.unlock(speciesId);
    ctx.ui.toast(`Куплена запись о породе «${spec.name}» за ${price} зол. `
      + 'Теперь она изучена.', 3600);
    refresh();
    return true;
  }

  /** Закрыть торговлю и вернуть управление. */
  function close() {
    if (!openId) return;
    openId = null;
    ctx.ui.closeTrade();
    ctx.mode = 'play';
    ctx.player.acceptInput = true;
    ctx.player.keys.clear();
    ctx.player.requestLock();
    // после торговли — вернуться в разговор, если просили
    if (onClose) {
      const cb = onClose;
      onClose = null;
      cb();
    }
  }

  /**
   * Перерисовать окно: слева — вещи игрока, справа — товары торговца.
   */
  function refresh() {
    if (!openId) return;
    const t = TRADERS[openId];
    const inv = ctx.inventory;
    // сгруппированные вещи игрока, которые торговец вообще берёт
    const mine = [];
    const seen = new Set();
    for (const s of inv.slots) {
      if (!s) continue;
      if (!t.buys.includes(s.spec.kind)) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const count = inv.countOf(s.id);
      mine.push({ id: s.id, spec: s.spec, count, price: sellPrice(s.spec) });
    }
    ctx.ui.renderTrade({ mine, goods: goodsOf(t) });
  }

  /**
   * Товары торговца.
   *
   * К обычному товару у Хорта добавляются «записи в зверинце» — записи
   * о породах, которых игрок ещё не изучил. Цена записи зависит от силы
   * породы: чем злее зверь, тем дороже его запись.
   *
   * @param {object} t торговец
   * @returns {object[]} товары с ценами
   */
  function goodsOf(t) {
    const goods = t.sells.map((s) => ({ ...s, price: buyPrice(s) }));
    if (t.id === 'barkeep' && ctx.systems && ctx.systems.bestiary) {
      for (const g of ctx.systems.bestiary.forSale()) goods.push(g);
    }
    return goods;
  }

  /**
   * Продать предмет торговцу.
   *
   * @param {string} id идентификатор предмета
   * @returns {boolean}
   */
  function sell(id) {
    const t = TRADERS[openId];
    if (!t) return false;
    const spec = getItem(id);
    if (!spec || !t.buys.includes(spec.kind)) return false;
    const slot = ctx.inventory.findById(id);
    if (slot < 0) return false;
    const price = sellPrice(spec);
    // забираем одну штуку
    const taken = ctx.inventory.takeOne(slot);
    if (!taken) return false;
    ctx.stats.earnCoins(price);
    ctx.ui.renderInventory(ctx.inventory);
    refresh();
    ctx.ui.toast(`Продано: ${spec.name} за ${price} зол. В кошельке теперь ${ctx.stats.coins} зол.`, 3200);
    return true;
  }

  /**
   * Купить предмет у торговца.
   *
   * @param {string} id идентификатор предмета
   * @returns {boolean}
   */
  function buy(id) {
    const t = TRADERS[openId];
    if (!t) return false;
    // запись в зверинце: покупаем знание, а не вещь — в сумку она не идёт
    if (id.startsWith('codex_')) return buyCodex(id);
    const spec = t.sells.find((s) => s.id === id);
    if (!spec) return false;
    const price = buyPrice(spec);
    if (!ctx.stats.spendCoins(price)) {
      ctx.ui.toast('Не хватает монет.', 2600);
      return false;
    }
    const stack = { id: spec.id, spec: { ...spec, kind: spec.kind || 'goods' }, count: 1, best: null };
    // оружие, факел и свитки сразу идут на пояс — иначе пришлось бы искать
    // их в сумке
    const quick = spec.kind === 'weapon' || spec.kind === 'gear' || spec.kind === 'spell';
    let beltSlot = -1;
    if (quick) {
      for (let k = BELT_START; k < TOTAL_SLOTS; k++) {
        if (!ctx.inventory.slots[k]) { beltSlot = k; break; }
      }
    }
    let res;
    if (beltSlot >= 0) {
      ctx.inventory.slots[beltSlot] = stack;
      ctx.inventory.touch();
      res = { ok: true, slot: beltSlot };
    } else {
      res = ctx.inventory.add(stack);
    }
    if (!res.ok) {
      ctx.stats.earnCoins(price);   // сумка полна — возвращаем деньги
      ctx.ui.toast('Сумка полна — некуда положить.', 2600);
      return false;
    }
    // оружие — сразу в руку
    if (beltSlot >= 0 && ctx.systems.loadout && spec.kind === 'weapon') {
      ctx.systems.loadout.select(beltSlot - BELT_START);
    }
    ctx.ui.renderInventory(ctx.inventory);
    refresh();
    let msg = `Куплено: ${spec.name} за ${price} зол.`;
    if (spec.kind === 'weapon') {
      msg = beltSlot >= 0
        ? `Куплено: ${spec.name} за ${price} зол. Взять в руки — клавиша ${beltSlot - BELT_START + 1}.`
        : `Куплено: ${spec.name} за ${price} зол. Пояс занят — оружие в сумке. Освободите ячейку пояса, перенесите его туда (Shift+ЛКМ) и нажмите цифру.`;
    } else if (spec.kind === 'spell') {
      msg = beltSlot >= 0
        ? `Куплено: ${spec.name} за ${price} зол. Колдовать — клавиша ${beltSlot - BELT_START + 1}.`
        : `Куплено: ${spec.name} за ${price} зол. Пояс занят — свиток в сумке. Освободите ячейку пояса и перенесите его туда (Shift+ЛКМ).`;
    } else if (spec.kind === 'gear') {
      msg = beltSlot >= 0
        ? `Куплено: ${spec.name} за ${price} зол. Взять в руку — клавиша ${beltSlot - BELT_START + 1}.`
        : `Куплено: ${spec.name} за ${price} зол. Пояс занят — вещь в сумке. Освободите ячейку пояса и перенесите её туда (Shift+ЛКМ).`;
    }
    ctx.ui.toast(msg, 3600);
    return true;
  }

  ctx.ui.onTradeSell = (id) => sell(id);
  ctx.ui.onTradeBuy = (id) => buy(id);
  ctx.ui.onTradeClose = () => close();

  return {
    open,
    close,
    refresh,
    /** Продать предмет торговцу. */
    sell,
    /** Купить предмет у торговца. */
    buy,
    /** Открыта ли торговля. */
    get isOpen() { return !!openId; },
    /** Кто торгует. */
    get who() { return openId; },
    /** Материалы кузнеца — смола и фитиль. */
    materials: MATERIALS,
  };
}
