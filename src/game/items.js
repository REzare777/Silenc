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
 *    • `material`— материалы кузнеца: смола и фитиль;
 *    • `gear`    — снаряжение: факел (его берут на пояс, как оружие);
 *    • `spell`   — заклинания: их покупают у трактирщика и колдуют с пояса.
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
 *  Снаряжение
 * ------------------------------------------------------------------ */

/**
 * Снаряжение — то, что берут на пояс и используют как оружие.
 *
 * Факел раньше был неотъемлемой частью подземелья: игрок входил — и бранд
 * уже горел в руке. Теперь это обычная вещь: её можно купить у кузнеца,
 * положить на пояс и взять в левую руку. Нет факела — идёшь в темноте.
 */
export const GEAR = [
  {
    id: 'torch',
    name: 'Факел',
    kind: 'gear',
    value: 14,
    buy: 16,
    sell: 6,
    weight: 0.7,
    stackable: false,
    desc: 'Обжигая палка с обмотанной пеньковой верёвкой. В подземелье это единственный круг света вокруг тебя.',
    tip: 'Нажми цифру слота пояса, где лежит факел: он окажется в левой руке. F — зажечь и погасить.',
  },
];

/* ------------------------------------------------------------------
 *  Заклинания
 * ------------------------------------------------------------------ */

/**
 * Заклинания — их покупают у трактирщика (Хорт знает старые слова) и
 * колдуют прямо с пояса: нажал цифру — свиток сработал.
 *
 * `spell` — что делает заклинание: `flash` (вспышка), `heal` (лечение),
 * `light` (живой огонь).
 */
export const SPELLS = [
  {
    id: 'spell_flash',
    name: 'Огненная вспышка',
    kind: 'spell',
    value: 24,
    buy: 28,
    sell: 11,
    weight: 0.1,
    stackable: false,
    mana: 25,
    spell: 'flash',
    desc: 'Короткий рывок огня по воздуху. Свет разом разбрасывает всех, кто подошёл слишком близко.',
    tip: 'Нажми цифру слота пояса со свитком. Требует 25 маны.',
  },
  {
    id: 'spell_heal',
    name: 'Лечебное слово',
    kind: 'spell',
    value: 20,
    buy: 24,
    sell: 9,
    weight: 0.1,
    stackable: false,
    mana: 20,
    spell: 'heal',
    desc: 'Старое слово, которому учат травниц. Стягивает раны и возвращает силы.',
    tip: 'Лечит 35 единиц здоровья. Требует 20 маны.',
  },
  {
    id: 'spell_light',
    name: 'Живой огонь',
    kind: 'spell',
    value: 16,
    buy: 20,
    sell: 8,
    weight: 0.1,
    stackable: false,
    mana: 15,
    spell: 'light',
    desc: 'Огонь, который не спрашивает разрешения у смолы: вспыхивает там, где нужен свет.',
    tip: 'Зажигает факел в руке и добавляет 60 топлива. Без факела — светит вокруг тебя минуту.',
  },
];

/* ------------------------------------------------------------------
 *  Добыча из подземелья
 * ------------------------------------------------------------------ */

/**
 * Редкость добычи — от серой до золотой.
 *
 * `color` — цвет иконки и подписи, `rank` — порядок (чем выше, тем ценнее).
 */
export const RARITY = {
  common: { id: 'common', name: 'обычное', rank: 0, color: '#c3c8cc' },
  uncommon: { id: 'uncommon', name: 'необычное', rank: 1, color: '#7fc776' },
  rare: { id: 'rare', name: 'редкое', rank: 2, color: '#5aa9e6' },
  epic: { id: 'epic', name: 'эпическое', rank: 3, color: '#b072e0' },
  legendary: { id: 'legendary', name: 'легендарное', rank: 4, color: '#e0a63a' },
};

/**
 * Добыча: то, что выпадает из монстров.
 *
 * Сейчас лут только продаётся — но у каждого предмета есть поле `craft`
 * с тегами-подсказками, что из него можно сварить или сковать потом.
 * `value` — «честная» цена, `sell` — сколько даст торговец (вдвое меньше).
 */
export const LOOT = [
  {
    id: 'goblin_ear',
    name: 'Гоблинское ухо',
    kind: 'loot',
    rarity: 'common',
    value: 4,
    sell: 2,
    weight: 0.05,
    stackable: true,
    craft: { tags: ['trophy', 'alchemy'], hint: 'Крошить в зелье — что-то сварится' },
    desc: 'Отрезанное по самой складке ухо. Кто-то из деревни за это платил; кому-то оно сдалось ещё теплым.',
  },
  {
    id: 'goblin_tooth',
    name: 'Гоблийский клык',
    kind: 'loot',
    rarity: 'common',
    value: 5,
    sell: 3,
    weight: 0.05,
    stackable: true,
    craft: { tags: ['trophy', 'tool'], hint: 'Точится в клинок или грызёт что-то' },
    desc: 'Жёлтый клык с трещиной. Малые goblinы иногда носят такие на шее.',
  },
  {
    id: 'slime_jelly',
    name: 'Слизь',
    kind: 'loot',
    rarity: 'common',
    value: 6,
    sell: 4,
    weight: 0.2,
    stackable: true,
    craft: { tags: ['alchemy', 'glue'], hint: 'Клей, или основа для зелья' },
    desc: 'Холодная тягучая капля. Пахнет кислым молоком и подземельем.',
  },
  {
    id: 'spider_web',
    name: 'Паутина',
    kind: 'loot',
    rarity: 'common',
    value: 7,
    sell: 5,
    weight: 0.1,
    stackable: true,
    craft: { tags: ['alchemy', 'tool'], hint: 'Склеивает что угодно' },
    desc: 'Прядь, которая не рвётся, если её не резать ножом.',
  },
  {
    id: 'shroom_cap',
    name: 'Шляпка гриба',
    kind: 'loot',
    rarity: 'common',
    value: 8,
    sell: 6,
    weight: 0.15,
    stackable: true,
    craft: { tags: ['food', 'alchemy'], hint: 'В суп или в зелье' },
    desc: 'Шляпка с белыми крапинками. Пахнет так, что хочется есть её прямо в пещере.',
  },
  {
    id: 'ghost_dust',
    name: 'Призрачная пыль',
    kind: 'loot',
    rarity: 'uncommon',
    value: 18,
    sell: 9,
    weight: 0.1,
    stackable: true,
    craft: { tags: ['alchemy', 'ritual'], hint: 'Рассыпается в воздухе, если потрясти' },
    desc: 'Серебристый порошок, который не оседает на ладонь. Холодный и тихий.',
  },
  {
    id: 'snake_fang',
    name: 'Змеиный яд',
    kind: 'loot',
    rarity: 'uncommon',
    value: 22,
    sell: 12,
    weight: 0.1,
    stackable: true,
    craft: { tags: ['alchemy', 'poison'], hint: 'То, чем мажут клинок' },
    desc: 'Мутная капля в желудке змеи. Кузнец от такой отвернулся бы, но и выбросить жалко.',
  },
  {
    id: 'golem_core',
    name: 'Ядро голема',
    kind: 'loot',
    rarity: 'rare',
    value: 45,
    sell: 22,
    weight: 0.8,
    stackable: false,
    craft: { tags: ['magic', 'material'], hint: 'Вставляется в оружие — будет светиться' },
    desc: 'Тёплый камень, в котором ещё дышит огонь. Торн такие покупает, только молча.',
  },
  {
    id: 'guard_badge',
    name: 'Жетон стража',
    kind: 'loot',
    rarity: 'uncommon',
    value: 26,
    sell: 15,
    weight: 0.2,
    stackable: false,
    craft: { tags: ['trophy', 'quest'], hint: 'Кто-то из деревни его узнает' },
    desc: 'Кованый кругляш с грубой насечкой. Чей-то долг, который так и не вернули.',
  },
  {
    id: 'warden_seal',
    name: 'Печать надзирателя',
    kind: 'loot',
    rarity: 'epic',
    value: 90,
    sell: 45,
    weight: 0.4,
    stackable: false,
    craft: { tags: ['quest', 'magic'], hint: 'Печать мёртвого надзирателя' },
    desc: 'Сургучная печать с чужой подписью. Тот, кого она заменила, больше не выходит сюда.',
  },
  {
    id: 'orc_tusk',
    name: 'Клык орка',
    kind: 'loot',
    rarity: 'rare',
    value: 60,
    sell: 32,
    weight: 0.6,
    stackable: false,
    craft: { tags: ['trophy', 'material'], hint: 'Охотничий трофей' },
    desc: 'Жёлтый клык с печатью скола. Такие носят на шее, чтобы враги не смеялись.',
  },
  {
    id: 'grim_crown',
    name: 'Венец Гримма',
    kind: 'loot',
    rarity: 'legendary',
    value: 220,
    sell: 110,
    weight: 1.2,
    stackable: false,
    craft: { tags: ['trophy', 'legendary'], hint: 'Настоящая реликвия' },
    desc: 'Обруч из тёмного металла с семью зубцами. Тот, кто наденет его, узнает, зачем.',
  },
  {
    id: 'cave_rat_tail',
    name: 'Хвост пещерной крысы',
    kind: 'loot',
    rarity: 'common',
    value: 6,
    sell: 7,
    weight: 0.05,
    stackable: true,
    craft: { tags: ['trophy', 'alchemy'], hint: 'Сушат и крошат — выходит приманка' },
    desc: 'Жёсткий, как проволока, хвост. Прячется в темноте и умирает от голода.',
  },
  {
    id: 'moss_lump',
    name: 'Мох с камня',
    kind: 'loot',
    rarity: 'common',
    value: 5,
    sell: 8,
    weight: 0.15,
    stackable: true,
    craft: { tags: ['food', 'tool'], hint: 'Кладётся в зелье или в сад' },
    desc: 'Влажный сине-зелёный комок. Пахнет дождём, хотя внизу не бывает дождя.',
  },
  {
    id: 'glow_cap',
    name: 'Светящаяся шляпка',
    kind: 'loot',
    rarity: 'uncommon',
    value: 24,
    sell: 11,
    weight: 0.1,
    stackable: true,
    craft: { tags: ['alchemy', 'light'], hint: 'Светит в темноте — пока не засохнет' },
    desc: 'Гриб с бледно-голубой шляпкой. Светит ещё сутки после того, как его сорвали.',
  },
  {
    id: 'bat_wing',
    name: 'Крыло летучей мыши',
    kind: 'loot',
    rarity: 'uncommon',
    value: 20,
    sell: 10,
    weight: 0.05,
    stackable: true,
    craft: { tags: ['trophy', 'alchemy'], hint: 'Тонкая плёнка — идёт в перчатки' },
    desc: 'Перепонка тоньше бумаги, но прочнее, чем кажется.',
  },
  {
    id: 'spore_powder',
    name: 'Споровая пыль',
    kind: 'loot',
    rarity: 'uncommon',
    value: 28,
    sell: 14,
    weight: 0.05,
    stackable: true,
    craft: { tags: ['alchemy', 'poison'], hint: 'Рассыпается в воздухе — и кто-то засыпает' },
    desc: 'Рыжий порошок в мешочке из паучьей нити. Не открывать в жилой комнате.',
  },
  {
    id: 'obsidian_shard',
    name: 'Осколок обсидиана',
    kind: 'loot',
    rarity: 'rare',
    value: 55,
    sell: 28,
    weight: 0.7,
    stackable: false,
    craft: { tags: ['material', 'magic'], hint: 'Вставляется в клинок — будет резать как бритва' },
    desc: 'Стекло вулкана, острые грани. Торн берёт такие не глядя и платит не торгуясь.',
  },
];

/* ------------------------------------------------------------------
 *  Реестр
 * ------------------------------------------------------------------ */

/**
 * Откаты заклинаний (секунды) — единая таблица, чтобы и подсказка в
 * инвентаре, и сама система колдовства считали одинаково.
 */
export const SPELL_COOLDOWN = {
  flash: 6,
  heal: 12,
  light: 10,
};

/** Все предметы по id: рыба + оружие + товары + материалы + снаряжение + заклинания. */
export const ITEMS = (() => {
  const map = new Map();
  for (const f of FISH) map.set(f.id, { ...f, kind: 'fish' });
  for (const w of WEAPONS) map.set(w.id, { ...w, kind: 'weapon' });
  for (const g of GOODS) map.set(g.id, { ...g });
  for (const m of MATERIALS) map.set(m.id, { ...m });
  for (const g of GEAR) map.set(g.id, { ...g });
  for (const s of SPELLS) map.set(s.id, { ...s });
  for (const l of LOOT) map.set(l.id, { ...l });
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
  return spec.kind === 'fish' || spec.kind === 'goods'
    || spec.kind === 'material' || spec.kind === 'loot';
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
  if (spec.kind === 'loot') return spec.sell ?? Math.max(1, Math.round((spec.value || 0) * 0.5));
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
  if (spec.kind === 'spell') {
    return `${spec.mana} маны`;
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
    // урон в секунду: ради него и выбирают оружие — без него цифры
    // урона сами по себе мало что говорят
    const dps = Math.round(((spec.dmg[0] + spec.dmg[1]) / 2) / Math.max(0.05, spec.speed));
    rows.push(['В секунду', `${dps}`]);
    rows.push(['Дальность', `${spec.reach} м`]);
    rows.push(['Достаёт', `${spec.sweep ?? 1}`]);
    rows.push(['Сил', `${spec.effort ?? 4}`]);
    rows.push(['Руки', spec.hands === 'two' ? 'две' : 'одна']);
    if (spec.mana) rows.push(['Мана', `${spec.mana} за удар`]);
  } else if (spec.kind === 'spell') {
    rows.push(['Мана', `${spec.mana}`]);
    rows.push(['Откат', `${SPELL_COOLDOWN[spec.spell] ?? 6} с`]);
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
  if (spec.kind === 'gear') drawTorchIcon(canvas.getContext('2d'), spec, px);
  else if (spec.kind === 'loot') drawLootIcon(canvas.getContext('2d'), spec, px);
  else if (spec.kind === 'spell') drawSpellIcon(canvas.getContext('2d'), spec, px);
  else drawGoodsIcon(canvas.getContext('2d'), spec, px);
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
 * Рисунок иконки факела: палка с обмоткой и живой огонь.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec предмет
 * @param {number} px сторона квадрата
 */
function drawTorchIcon(ctx, spec, px) {
  const g = ctx.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, '#2b2620');
  g.addColorStop(1, '#15120e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  const c = px / 2;
  // палка
  ctx.strokeStyle = '#7a5c33';
  ctx.lineWidth = px * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c, px * 0.82);
  ctx.lineTo(c, px * 0.42);
  ctx.stroke();
  // обмотка
  ctx.strokeStyle = '#3a2a18';
  ctx.lineWidth = px * 0.035;
  for (let i = 0; i < 3; i++) {
    const y = px * (0.44 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(c - px * 0.07, y);
    ctx.lineTo(c + px * 0.07, y - px * 0.02);
    ctx.stroke();
  }
  // пламя
  const fl = ctx.createRadialGradient(c, px * 0.3, px * 0.01, c, px * 0.3, px * 0.22);
  fl.addColorStop(0, '#fff3c4');
  fl.addColorStop(0.45, '#f6a83c');
  fl.addColorStop(1, 'rgba(200,80,20,0)');
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.moveTo(c, px * 0.08);
  ctx.bezierCurveTo(c + px * 0.16, px * 0.22, c + px * 0.12, px * 0.4, c, px * 0.46);
  ctx.bezierCurveTo(c - px * 0.12, px * 0.4, c - px * 0.16, px * 0.22, c, px * 0.08);
  ctx.fill();
}

/**
 * Рисунок иконки заклинания: свиток со знаком.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec предмет
 * @param {number} px сторона квадрата
 */
function drawSpellIcon(ctx, spec, px) {
  const g = ctx.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, '#2b2620');
  g.addColorStop(1, '#15120e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  const c = px / 2;
  // свиток
  ctx.fillStyle = '#d8c9a6';
  ctx.beginPath();
  ctx.roundRect(c - px * 0.2, px * 0.16, px * 0.4, px * 0.68, px * 0.03);
  ctx.fill();
  ctx.fillStyle = '#b9a880';
  ctx.fillRect(c - px * 0.2, px * 0.14, px * 0.4, px * 0.07);
  ctx.fillRect(c - px * 0.2, px * 0.79, px * 0.4, px * 0.07);
  // знак: цвет заклинания
  const colors = { flash: '#e8843c', heal: '#63b86a', light: '#e8c14a' };
  ctx.strokeStyle = colors[spec.spell] || '#9a7fd0';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = px * 0.035;
  ctx.lineCap = 'round';
  if (spec.spell === 'flash') {
    // молния
    ctx.beginPath();
    ctx.moveTo(c + px * 0.06, px * 0.28);
    ctx.lineTo(c - px * 0.07, px * 0.5);
    ctx.lineTo(c + px * 0.02, px * 0.5);
    ctx.lineTo(c - px * 0.05, px * 0.72);
    ctx.stroke();
  } else if (spec.spell === 'heal') {
    // крест
    ctx.beginPath();
    ctx.moveTo(c, px * 0.3); ctx.lineTo(c, px * 0.68);
    ctx.moveTo(c - px * 0.1, px * 0.49); ctx.lineTo(c + px * 0.1, px * 0.49);
    ctx.stroke();
  } else {
    // свеча с огнём
    ctx.beginPath();
    ctx.moveTo(c, px * 0.34);
    ctx.bezierCurveTo(c + px * 0.09, px * 0.44, c + px * 0.06, px * 0.54, c, px * 0.58);
    ctx.bezierCurveTo(c - px * 0.06, px * 0.54, c - px * 0.09, px * 0.44, c, px * 0.34);
    ctx.fill();
    ctx.fillRect(c - px * 0.035, px * 0.6, px * 0.07, px * 0.12);
  }
}

/**
 * Рисунок иконки товара.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec предмет
 * @param {number} px сторона
 */
/**
 * Иконка добычи: у каждой редкости свой цвет рамки, у каждого предмета —
 * своя нарисованная форма.
 *
 * @param {CanvasRenderingContext2D} ctx контекст
 * @param {object} spec предмет
 * @param {number} px сторона квадрата
 */
function drawLootIcon(ctx, spec, px) {
  const g = ctx.createLinearGradient(0, 0, px, px);
  g.addColorStop(0, '#241f1c');
  g.addColorStop(1, '#14110f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, px, px);
  const c = px / 2;
  const rar = RARITY[spec.rarity] || RARITY.common;

  // рамка редкости
  ctx.strokeStyle = rar.color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, px * 0.022);
  ctx.strokeRect(px * 0.05, px * 0.05, px * 0.9, px * 0.9);
  ctx.globalAlpha = 1;

  switch (spec.id) {
    case 'goblin_ear': {
      ctx.fillStyle = '#6b8442';
      ctx.beginPath();
      ctx.ellipse(c, c, px * 0.2, px * 0.28, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a5c2e';
      ctx.lineWidth = px * 0.03;
      ctx.beginPath();
      ctx.moveTo(c + px * 0.06, c + px * 0.2);
      ctx.quadraticCurveTo(c + px * 0.16, c, c + px * 0.04, c - px * 0.2);
      ctx.stroke();
      break;
    }
    case 'goblin_tooth': {
      ctx.fillStyle = '#e4dcc2';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.1, c - px * 0.28);
      ctx.quadraticCurveTo(c + px * 0.16, c + px * 0.04, c, c + px * 0.3);
      ctx.quadraticCurveTo(c - px * 0.2, c + px * 0.02, c - px * 0.1, c - px * 0.28);
      ctx.fill();
      break;
    }
    case 'slime_jelly': {
      ctx.fillStyle = 'rgba(120,200,110,0.85)';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.24, c + px * 0.24);
      ctx.quadraticCurveTo(c - px * 0.2, c - px * 0.12, c, c - px * 0.1);
      ctx.quadraticCurveTo(c + px * 0.22, c - px * 0.12, c + px * 0.24, c + px * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(c - px * 0.07, c + px * 0.08, px * 0.05, px * 0.08, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spider_web': {
      ctx.strokeStyle = '#d8dde2';
      ctx.lineWidth = px * 0.02;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(a) * px * 0.3, c + Math.sin(a) * px * 0.3);
        ctx.stroke();
      }
      for (let r = 0.12; r < 0.32; r += 0.1) {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const x = c + Math.cos(a) * px * r;
          const y = c + Math.sin(a) * px * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case 'shroom_cap': {
      ctx.fillStyle = '#c04a34';
      ctx.beginPath();
      ctx.ellipse(c, c + px * 0.04, px * 0.3, px * 0.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(c - px * 0.07, c + px * 0.02, px * 0.14, px * 0.22);
      ctx.fillStyle = '#f0e6d4';
      for (const [dx, dy] of [[-0.14, 0.1], [0.08, 0.06], [0.16, 0.12]]) {
        ctx.beginPath();
        ctx.arc(c + px * dx, c + px * dy, px * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'ghost_dust': {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        const r = px * (0.1 + 0.2 * ((i * 37) % 10) / 10);
        ctx.fillStyle = `rgba(200,220,255,${0.25 + ((i * 13) % 7) / 12})`;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, px * 0.022, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'snake_fang': {
      ctx.fillStyle = 'rgba(140,190,90,0.9)';
      ctx.beginPath();
      ctx.ellipse(c, c + px * 0.02, px * 0.16, px * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e2c8';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.05, c - px * 0.08);
      ctx.lineTo(c, c - px * 0.3);
      ctx.lineTo(c + px * 0.05, c - px * 0.08);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'golem_core': {
      ctx.fillStyle = '#6d6a63';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.22, c + px * 0.22);
      ctx.lineTo(c - px * 0.16, c - px * 0.12);
      ctx.lineTo(c, c - px * 0.26);
      ctx.lineTo(c + px * 0.18, c - px * 0.1);
      ctx.lineTo(c + px * 0.22, c + px * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(c, c + px * 0.04, px * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'guard_badge': {
      ctx.fillStyle = '#8f98a4';
      ctx.beginPath();
      ctx.arc(c, c, px * 0.24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3f47';
      ctx.beginPath();
      ctx.arc(c, c, px * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9d0d8';
      ctx.lineWidth = px * 0.03;
      ctx.beginPath();
      ctx.arc(c, c, px * 0.19, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'warden_seal': {
      ctx.fillStyle = '#8a2f2a';
      ctx.beginPath();
      ctx.arc(c, c, px * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(c - px * 0.06, c - px * 0.06, px * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d8c49a';
      ctx.lineWidth = px * 0.025;
      ctx.beginPath();
      ctx.arc(c, c, px * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'orc_tusk': {
      ctx.fillStyle = '#e8e0c4';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.12, c + px * 0.26);
      ctx.quadraticCurveTo(c - px * 0.18, c - px * 0.1, c + px * 0.02, c - px * 0.28);
      ctx.quadraticCurveTo(c + px * 0.1, c - px * 0.02, c + px * 0.06, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'grim_crown': {
      ctx.strokeStyle = '#e0a63a';
      ctx.lineWidth = px * 0.06;
      ctx.beginPath();
      ctx.arc(c, c + px * 0.06, px * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e0a63a';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * px * 0.24, c + px * 0.06 + Math.sin(a) * px * 0.24);
        ctx.lineTo(c + Math.cos(a) * px * 0.3, c + px * 0.06 + Math.sin(a) * px * 0.3 - px * 0.1);
        ctx.lineTo(c + Math.cos(a) * px * 0.18, c + px * 0.06 + Math.sin(a) * px * 0.18);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'cave_rat_tail': {
      ctx.strokeStyle = '#6d5a48';
      ctx.lineWidth = px * 0.07;
      ctx.beginPath();
      ctx.moveTo(c - px * 0.24, c - px * 0.18);
      ctx.quadraticCurveTo(c + px * 0.1, c, c - px * 0.12, c + px * 0.2);
      ctx.stroke();
      ctx.strokeStyle = '#8a7461';
      ctx.lineWidth = px * 0.03;
      ctx.beginPath();
      ctx.moveTo(c - px * 0.24, c - px * 0.18);
      ctx.quadraticCurveTo(c + px * 0.1, c, c - px * 0.12, c + px * 0.2);
      ctx.stroke();
      break;
    }
    case 'moss_lump': {
      ctx.fillStyle = '#4d7a56';
      ctx.beginPath();
      ctx.ellipse(c, c + px * 0.04, px * 0.26, px * 0.2, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6fa172';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * px * 0.13, c + px * 0.04 + Math.sin(a) * px * 0.1, px * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'glow_cap': {
      ctx.fillStyle = '#7fd8e8';
      ctx.beginPath();
      ctx.ellipse(c, c + px * 0.02, px * 0.26, px * 0.18, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#d8f4f8';
      ctx.beginPath();
      ctx.ellipse(c - px * 0.08, c - px * 0.02, px * 0.1, px * 0.06, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8f6d0';
      ctx.fillRect(c - px * 0.05, c + px * 0.02, px * 0.1, px * 0.24);
      break;
    }
    case 'bat_wing': {
      ctx.fillStyle = '#5c4a63';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.26, c - px * 0.18);
      ctx.quadraticCurveTo(c + px * 0.18, c - px * 0.3, c + px * 0.26, c + px * 0.16);
      ctx.quadraticCurveTo(c + px * 0.02, c + px * 0.02, c - px * 0.26, c - px * 0.18);
      ctx.fill();
      ctx.strokeStyle = '#7b6484';
      ctx.lineWidth = px * 0.025;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(c - px * 0.2, c - px * 0.12);
        ctx.lineTo(c - px * 0.2 + i * px * 0.14, c + px * 0.12);
        ctx.stroke();
      }
      break;
    }
    case 'spore_powder': {
      ctx.fillStyle = '#c08a3e';
      ctx.beginPath();
      ctx.ellipse(c, c, px * 0.2, px * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,214,140,0.85)';
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * px * 0.14, c + Math.sin(a) * px * 0.15, px * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'obsidian_shard': {
      ctx.fillStyle = '#2a2438';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.16, c + px * 0.28);
      ctx.lineTo(c + px * 0.02, c - px * 0.3);
      ctx.lineTo(c + px * 0.2, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6d5f8c';
      ctx.beginPath();
      ctx.moveTo(c + px * 0.02, c - px * 0.3);
      ctx.lineTo(c + px * 0.09, c + px * 0.12);
      ctx.lineTo(c + px * 0.2, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = rar.color;
      ctx.beginPath();
      ctx.arc(c, c, px * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

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
    case 'candle': {
      // свеча: белое тело, фитиль, пламя
      ctx.fillStyle = '#e8e0cc';
      ctx.fillRect(c - px * 0.07, c - px * 0.06, px * 0.14, px * 0.3);
      ctx.fillStyle = '#c9bfa4';
      ctx.fillRect(c - px * 0.09, c + px * 0.2, px * 0.18, px * 0.05);
      ctx.fillStyle = '#ffb454';
      ctx.beginPath();
      ctx.moveTo(c, c - px * 0.26);
      ctx.bezierCurveTo(c + px * 0.1, c - px * 0.16, c + px * 0.07, c - px * 0.08, c, c - px * 0.05);
      ctx.bezierCurveTo(c - px * 0.07, c - px * 0.08, c - px * 0.1, c - px * 0.16, c, c - px * 0.26);
      ctx.fill();
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = px * 0.025;
      ctx.beginPath();
      ctx.moveTo(c, c - px * 0.06);
      ctx.lineTo(c, c - px * 0.02);
      ctx.stroke();
      break;
    }
    case 'honey': {
      // горшок мёда: тёмный янтарь и медовая капля
      ctx.fillStyle = '#8a5f2a';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.18, c - px * 0.12);
      ctx.lineTo(c + px * 0.18, c - px * 0.12);
      ctx.lineTo(c + px * 0.13, c + px * 0.26);
      ctx.lineTo(c - px * 0.13, c + px * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c98b32';
      ctx.fillRect(c - px * 0.2, c - px * 0.19, px * 0.4, px * 0.08);
      ctx.fillStyle = '#e0a63c';
      ctx.beginPath();
      ctx.moveTo(c, c - px * 0.22);
      ctx.bezierCurveTo(c + px * 0.11, c - px * 0.1, c + px * 0.07, c + px * 0.02, c, c + px * 0.04);
      ctx.bezierCurveTo(c - px * 0.07, c + px * 0.02, c - px * 0.11, c - px * 0.1, c, c - px * 0.22);
      ctx.fill();
      break;
    }
    case 'salt': {
      // мешочек соли: белая ткань, хвостик, соль сверху
      ctx.fillStyle = '#cfc6b2';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.16, c - px * 0.1);
      ctx.bezierCurveTo(c - px * 0.2, c + px * 0.16, c - px * 0.1, c + px * 0.28, c, c + px * 0.28);
      ctx.bezierCurveTo(c + px * 0.1, c + px * 0.28, c + px * 0.2, c + px * 0.16, c + px * 0.16, c - px * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8f8570';
      ctx.fillRect(c - px * 0.12, c - px * 0.16, px * 0.24, px * 0.07);
      ctx.fillStyle = '#f2efe4';
      ctx.beginPath();
      ctx.arc(c, c - px * 0.14, px * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pitch': {
      // жестянка смолы с фитилём
      ctx.fillStyle = '#5c6068';
      ctx.beginPath();
      ctx.moveTo(c - px * 0.2, c - px * 0.08);
      ctx.lineTo(c + px * 0.2, c - px * 0.08);
      ctx.lineTo(c + px * 0.17, c + px * 0.24);
      ctx.lineTo(c - px * 0.17, c + px * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#787d86';
      ctx.fillRect(c - px * 0.21, c - px * 0.14, px * 0.42, px * 0.07);
      // чёрная смола внутри
      ctx.fillStyle = '#2a2118';
      ctx.beginPath();
      ctx.ellipse(c, c - px * 0.105, px * 0.14, px * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      // фитиль
      ctx.strokeStyle = '#cdb98c';
      ctx.lineWidth = px * 0.035;
      ctx.beginPath();
      ctx.moveTo(c + px * 0.04, c - px * 0.12);
      ctx.quadraticCurveTo(c + px * 0.16, c - px * 0.26, c + px * 0.1, c - px * 0.3);
      ctx.stroke();
      break;
    }
    default: {
      // прочий товар — простой «мешочек/банка»
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

