/**
 * ============================================================================
 *  Каталог предметов: единый язык для рыбы, оружия и товаров
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  Инвентарь был заточен под рыбу: у стака обязательно был «лучший
 *  экземпляр» с весом и длиной, иконка рисовалась только для рыбы.
 *  Теперь в сумке лежит всё: рыба, оружие, хлеб, свечи, — и всё это должно
 *  уметь отображаться одинаково аккуратно.
 *
 *  Как устроено
 *  ------------
 *  У каждого предмета есть `kind`:
 *    • `fish`    — рыба из `world/fish.js` (у неё свой вес и длина);
 *    • `weapon`  — оружие из `world/weapons.js` (урон, скорость, дальность);
 *    • `goods`   — товары: хлеб, эль, сыр, свеча, мёд;
 *    • `material`— материалы кузнеца: смола и фитиль.
 *
 *  Цены хранятся в одном месте, потому что от них зависит вся экономика:
 *  сколько платит трактирщик за улов, сколько стоит оружие, что выгодно
 *  перепродавать.
 *
 *  @module game/items
 */

import { FISH, fishIcon } from '../world/fish.js';
import { WEAPONS, weaponIcon } from '../world/weapons.js';

/* ------------------------------------------------------------------
 *  Товары
 * ------------------------------------------------------------------ */

/**
 * Товары, которые продаёт трактирщик.
 *
 * `buy` — цена, за сколько игрок покупает; `sell` — за сколько NPC берёт
 * обратно (всегда дешевле: перекупщик).
 */
export const GOODS = [
  {
    id: 'bread',
    name: 'Хлеб',
    kind: 'goods',
    value: 4,
    buy: 5,
    sell: 2,
    weight: 0.4,
    stackable: true,
    desc: 'Тёплый ржаной каравай. Держится день, но пахнет так, что забываешь про голод.',
  },
  {
    id: 'ale',
    name: 'Эль',
    kind: 'goods',
    value: 7,
    buy: 9,
    sell: 3,
    weight: 1.1,
    stackable: true,
    desc: 'Густой, тёмный, с корицей. Хорт наливает щедро.',
  },
  {
    id: 'cheese',
    name: 'Сыр',
    kind: 'goods',
    value: 9,
    buy: 12,
    sell: 4,
    weight: 0.6,
    stackable: true,
    desc: 'Крепкий, с резкой коркой. Отрезать нужно ножом, а не зубами.',
  },
  {
    id: 'candle',
    name: 'Свеча',
    kind: 'goods',
    value: 3,
    buy: 4,
    sell: 1,
    weight: 0.2,
    stackable: true,
    desc: 'Пчелиный воск, хлопковый фитиль. Хорошо горит в подземелье.',
  },
  {
    id: 'honey',
    name: 'Мёд',
    kind: 'goods',
    value: 12,
    buy: 16,
    sell: 6,
    weight: 0.8,
    stackable: true,
    desc: 'Тёмный, горький, пахнет дымом. В деревне его берут охотнее, чем соль.',
  },
  {
    id: 'salt',
    name: 'Соль',
    kind: 'goods',
    value: 5,
    buy: 7,
    sell: 2,
    weight: 0.5,
    stackable: true,
    desc: 'Грубый серый камень в мешке. Дороже, чем кажется: без неё мясо гниёт.',
  },
];

/**
 * Материалы кузнеца.
 *
 * «Смола и фитиль» — не предмет, а пополнение факела: в старом варианте
 * это была отдельная кнопка без записи в инвентарь. Теперь это обычный
 * покупаемый товар, который тратится на разжигание бранда.
 */
export const MATERIALS = [
  {
    id: 'pitch',
    name: 'Смола и фитиль',
    kind: 'material',
    value: 10,
    buy: 12,
    sell: 5,
    weight: 0.3,
    stackable: true,
    fuel: 100,
    desc: 'Смола в жестянке и моток пенькового фитиля. Хватит разжечь бранд на долго.',
    tip: 'Разжигает факел в подземелье: +100 топлива.',
  },
];

/* ------------------------------------------------------------------
 *  Реестр
 * ------------------------------------------------------------------ */

/** Все предметы по id: рыба + оружие + товары + материалы. */
export const ITEMS = (() => {
  const map = new Map();
  for (const f of FISH) map.set(f.id, { ...f, kind: 'fish' });
  for (const w of WEAPONS) map.set(w.id, { ...w, kind: 'weapon' });
  for (const g of GOODS) map.set(g.id, { ...g });
  for (const m of MATERIALS) map.set(m.id, { ...m });
  return map;
})();

/**
 * Найти предмет по id.
 *
 * @param {string} id идентификатор
 * @returns {object|null}
 */
export function getItem(id) {
  return ITEMS.get(id) || null;
}

/**
 * Это оружие? (нужно для боя и для «взять в руки»)
 *
 * @param {object} spec предмет
 * @returns {boolean}
 */
export function isWeapon(spec) {
  return !!spec && spec.kind === 'weapon';
}

/**
 * Можно ли складывать в стак.
 *
 * @param {object} spec предмет
 * @returns {boolean}
 */
export function isStackable(spec) {
  if (!spec) return false;
  if (spec.stackable !== undefined) return !!spec.stackable;
  return spec.kind === 'fish' || spec.kind === 'goods' || spec.kind === 'material';
}

/* ------------------------------------------------------------------
 *  Цены — здесь живёт экономика
 * ------------------------------------------------------------------ */

/**
 * За сколько NPC готов купить предмет у игрока.
 *
 * @param {object} spec предмет
 * @returns {number} цена в золотых
 */
export function sellPrice(spec) {
  if (!spec) return 0;
  if (spec.kind === 'fish') return spec.value || 0;      // улов продаётся за полную цену
  if (spec.kind === 'weapon') return Math.round((spec.price || 0) * 0.45);  // кузнец берёт оружие за полсотни
  return spec.sell ?? Math.max(1, Math.round((spec.value || 0) * 0.4));
}

/**
 * За сколько NPC продаст предмет игроку.
 *
 * @param {object} spec предмет
 * @returns {number} цена в золотых
 */
export function buyPrice(spec) {
  if (!spec) return 0;
  return spec.buy ?? spec.price ?? spec.value ?? 0;
}

/**
 * Короткая подпись для слота инвентаря.
 *
 * У рыбы — вес, у оружия — урон, у товара — ничего (там достаточно иконки).
 *
 * @param {object} spec предмет
 * @param {object} stack стак в инвентаре
 * @returns {string}
 */
export function itemBadge(spec, stack) {
  if (!spec) return '';
  if (spec.kind === 'fish') {
    const w = stack && stack.best ? stack.best.weight : spec.weightMin;
    return `${(w ?? 0).toFixed(2)}кг`;
  }
  if (spec.kind === 'weapon') {
    return `${spec.dmg[0]}–${spec.dmg[1]}`;
  }
  return '';
}

/**
 * Подробное описание для подсказки.
 *
 * @param {object} spec предмет
 * @param {object} stack стак
 * @returns {{name:string,rows:Array<[string,string]>,desc:string,tip:string}}
 */
export function itemDesc(spec, stack) {
  if (!spec) return { name: '', rows: [], desc: '', tip: '' };
  const rows = [];
  if (spec.kind === 'fish') {
    const w = stack && stack.best ? stack.best.weight : spec.weightMin;
    const l = stack && stack.best ? stack.best.length : spec.lengthMin;
    rows.push(['Вес', `${(w ?? 0).toFixed(2)} кг`]);
    rows.push(['Длина', `${l ?? 0} см`]);
  } else if (spec.kind === 'weapon') {
    rows.push(['Урон', `${spec.dmg[0]}–${spec.dmg[1]}`]);
    rows.push(['Замах', `${spec.speed.toFixed(2)} с`]);
    rows.push(['Дальность', `${spec.reach} м`]);
    rows.push(['Руки', spec.hands === 'two' ? 'две' : 'одна']);
    if (spec.mana) rows.push(['Мана', `${spec.mana} за удар`]);
  } else {
    rows.push(['Вес', `${spec.weight ?? 0} кг`]);
  }
  rows.push(['Цена', `${spec.value ?? spec.price ?? 0} зол.`]);
  return { name: spec.name, rows, desc: spec.desc || '', tip: spec.tip || '' };
}

/* ------------------------------------------------------------------
 *  Иконки
 * ------------------------------------------------------------------ */

const iconCache = new Map();

/**
 * Универсальная иконка предмета.
 *
 * @param {object} spec предмет
 * @param {number} size сторона квадрата
 * @returns {HTMLCanvasElement|null}
 */
export function itemIcon(spec, size = 96) {
  if (typeof document === 'undefined' || !spec) return null;
  if (spec.kind === 'fish') return fishIcon(spec, size);
  if (spec.kind === 'weapon') return weaponIcon(spec, size);
  const px = Math.max(16, Math.round(size || 96));
  const key = `${spec.id}|${px}`;
  const cached = iconCache.get(key);
  if (cached) return copyCanvas(cached);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  drawGoodsIcon(canvas.getContext('2d'), spec, px);
  iconCache.set(key, canvas);
  return copyCanvas(canvas);
}

function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

/**
 * Рисунок иконки товара.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec предмет
 * @param {number} px сторона
 */
function drawGoodsIcon(ctx, spec, px) {
  const g = ctx.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, '#2b2620');
  g.addColorStop(1, '#15120e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  const c = px / 2;
  switch (spec.id) {
    case 'bread': {
      ctx.fillStyle = '#b98343';
      ctx.beginPath();
      ctx.ellipse(c, c, px * 0.32, px * 0.24, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a5c2c';
      ctx.lineWidth = px * 0.03;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(c - px * 0.16, c + i * px * 0.09);
        ctx.lineTo(c + px * 0.16, c + i * px * 0.09 - px * 0.05);
        ctx.stroke();
      }
      break;
    }
    case 'ale': {
      ctx.fillStyle = '#8f9499';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.2, c - px * 0.2);
      ctx.lineTo(c + px * 0.2, c - px * 0.2);
      ctx.lineTo(c + px * 0.14, c + px * 0.26);
      ctx.lineTo(c - px * 0.14, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4b2c14';
      ctx.fillRect(c - px * 0.17, c - px * 0.15, px * 0.34, px * 0.12);
      ctx.strokeStyle = '#8f9499';
      ctx.lineWidth = px * 0.05;
      ctx.beginPath();
      ctx.arc(c + px * 0.24, c - px * 0.04, px * 0.08, -1.2, 1.2);
      ctx.stroke();
      break;
    }
    case 'cheese': {
      // круглый сыр с дырочками
      ctx.fillStyle = '#d9b45c';
      ctx.beginPath();
      ctx.ellipse(c, c + px * 0.04, px * 0.28, px * 0.24, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b08f42';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.26, c + px * 0.04);
      ctx.lineTo(c, c + px * 0.04);
      ctx.lineTo(c, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a6c2f';
      for (const [dx, dy, r] of [[-0.08, -0.06, 0.045], [0.06, 0.02, 0.035], [-0.02, 0.12, 0.03]]) {
        ctx.beginPath();
        ctx.arc(c + px * dx, c + px * dy, px * r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default: {
      // свеча, мёд, соль, смола — простой «мешочек/банка»
      ctx.fillStyle = '#8a7a5c';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.16, c - px * 0.14);
      ctx.lineTo(c + px * 0.16, c - px * 0.14);
      ctx.lineTo(c + px * 0.19, c + px * 0.26);
      ctx.lineTo(c - px * 0.19, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5f5238';
      ctx.fillRect(c - px * 0.1, c - px * 0.22, px * 0.2, px * 0.09);
    }
  }
}

