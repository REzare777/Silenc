/**
 * ============================================================================
 *  ДЕЛА: КВЕСТЫ ХОРТА И ТОРНА
 * ============================================================================
 *
 *  В деревне есть два человека, у которых всегда есть работа:
 *
 *    * **Хорт**, бармен трактира «Уставший вепрь». Он знает старые слова
 *      (заклинания) и скучает без дел. Просит прибраться под холмом,
 *      принести грибов из пещеры и дойти до самых глубоких врат.
 *    * **Торн**, кузнец. Ему нужна сталь: он берёт камень из голема и
 *      честную кровь орка — и коварует из этого клинки.
 *
 *  Как устроено дело
 *  -----------------
 *  Дело проходит четыре стадии:
 *
 *      «?» жёлтый знак  →  взято  →  «?» зелёный знак  →  сдано
 *      (над головой)     (в журнале)   (над головой)      (в журнале)
 *
 *  То есть: поговорил с торговцем и взял дело → сделал → вернулся и сдал.
 *  Знак над головой показывает, что у NPC есть незакрытое дело:
 *  жёлтый «!» — можно взять, зелёный «?» — можно сдать.
 *
 *  Цели дел
 *  --------
 *  * `kill` — убить N зверей из группы (например, гоблинов);
 *  * `have` — иметь N предметов в сумке и сдать их (предметы забираются);
 *  * `seal` — открыть печать в подземелье (дойти до нужного зала).
 *
 *  Прогресс по целям `have` считается по сумке прямо сейчас, поэтому
 *  подсказка в журнале всегда честная: «3 из 5 грибов».
 *
 *  Награда
 *  -------
 *  Монеты и предметы. За сдачу дела бармен и кузнец платят отдельно от
 *  обычной торговли — и за настоящие заслуги дарят клинок.
 *
 *  @module game/quests
 */

import { getItem } from './items.js';
import { makeStack } from '../inventory.js';
import { questMarker } from '../world/questmark.js';

/**
 * Определения дел.
 *
 * `giver` — id персонажа (`barkeep` | `blacksmith`);
 * `requires` — какие дела надо закончить раньше, чтобы взять это;
 * `objectives` — цели; `rewards` — что отдают за сдачу.
 */
export const QUESTS = [
  /* ------------------------------- Хорт ------------------------------- */
  {
    id: 'hort_goblins',
    giver: 'barkeep',
    title: 'Гоблинья возня',
    desc: 'Снизу лезут гоблины: таскают припасы из погреба и грызут караваи. '
      + 'Пока их не перебьёте, в трактире никто спокойно не уснёт.',
    offer: 'Слышишь? Опять снизу скребутся. Уложи шестерых — остальные сами '
      + 'разбегутся. А я в долгу не останусь: кое-что для тебя припас.',
    objectives: [
      { kind: 'kill', group: 'goblin', count: 6, label: 'Убить гоблинов' },
    ],
    rewards: { coins: 40, items: [{ id: 'spell_light', count: 1 }] },
    rewardText: 'Хорт отсчитывает монеты и суёт вам свёрток: «Уговор есть уговор. '
      + 'Огонь, которому смола не нужна».',
  },
  {
    id: 'hort_mushrooms',
    giver: 'barkeep',
    title: 'Грибы для котла',
    desc: 'В пещере под холмом растут грибы — светящиеся, тёмные, всякие. '
      + 'Хорт задумал суп, а соли в деревне мало — грибы её заменят.',
    offer: 'Внизу грибы растут — знаю, сам пробовал. Принеси мне '
      + 'три шляпки, и я сварю такую похлёбку, что вся улица сбежится. '
      + 'Заплачу, да и сыра не пожалею.',
    objectives: [
      { kind: 'have', item: 'shroom_cap', count: 3, label: 'Принести шляпки грибов' },
    ],
    rewards: { coins: 25, items: [{ id: 'cheese', count: 2 }, { id: 'bread', count: 1 }] },
    rewardText: 'Хорт ссыпает шляпки в миску, а вам отсчитывает '
      + 'монеты: «Ну, котёл будет наваристый».',
  },
  {
    id: 'hort_deep',
    giver: 'barkeep',
    title: 'Слухи из глубины',
    desc: 'Хорт слышал: в самой глубине пещеры, за Вратами, что-то стучит. '
      + 'Нужно дойти до зала Врат и увидеть всё своими глазами.',
    offer: 'Уже третью ночь мне снится стук. Ты ведь вглубь собираешься? Дойди до '
      + 'Врат, где самоцвет, и вернись живым. А я научу тебя слову, которым '
      + 'травницы раны затягивают.',
    requires: ['hort_goblins'],
    objectives: [
      { kind: 'reach', zone: 'gate', count: 1, label: 'Дойти до зала Врат' },
    ],
    rewards: { coins: 70, items: [{ id: 'spell_heal', count: 1 }] },
    rewardText: 'Хорт слушает ваш рассказ и медленно кивает: '
      + '«Значит, не почудилось». Лечебное слово теперь ваше.',
  },

  /* ------------------------------- Торн ------------------------------- */
  {
    id: 'torn_core',
    giver: 'blacksmith',
    title: 'Ядро голема',
    desc: 'Голем держится на камне в груди. Торн вковывает такие камни '
      + 'в клинки — оттого они и звенят, и не тупятся.',
    offer: 'Принеси ядро каменного голема. Одно. Не два — одно. Из таких '
      + 'камней я кую сердце клинка, и клинок поёт. Заплачу честно, а то, что выкую, '
      + 'тебе всю жизнь прослужит.',
    objectives: [
      { kind: 'have', item: 'golem_core', count: 1, label: 'Принести ядро голема' },
    ],
    rewards: { coins: 45, items: [{ id: 'axe', count: 1 }] },
    rewardText: 'Торн берёт камень, разглядывает на просвет и молча уходит к '
      + 'горну. Через час кладёт на стол секиру: «Держи. Береги лезвие».',
  },
  {
    id: 'torn_boss',
    giver: 'blacksmith',
    title: 'Голова вожака',
    desc: 'Торну нужен самый прочный клинок, а такой куют только из '
      + 'стали орка-владыки. Придётся спуститься к Гримму — и вернуться живым.',
    offer: 'Ты уже знаешь, кто там внизу. Орк-владыка. Из его стали я '
      + 'выкую двуручник — да только сталь эту он добром не отдаст. '
      + 'Убей его — и двуручник твой.',
    requires: ['torn_core'],
    objectives: [
      { kind: 'kill', group: 'boss', count: 1, label: 'Убить орка-владыку Гримма' },
    ],
    rewards: { coins: 120, items: [{ id: 'greatsword', count: 1 }] },
    rewardText: 'Торн молча раздувает горн, а через час кладёт на стол двуручник: '
      + '«Держи. И не махай впустую».',
  },
];

/** Группы зверей: по ним считается прогресс целей `kill`. */
const KILL_GROUPS = {
  goblin: ['goblin_sword', 'goblin_bow', 'goblin_guard'],
  boss: ['orc_boss'],
};

/** Высота знака над головой персонажа (метры, локальная высота модели). */
const MARK_Y = 2.3;

/**
 * Зоны подземелья: где можно «дойти». Границы взяты из планировки
 * подземелья: зал Врат — нижний ярус, z от 16 до 34, y около −4.6.
 */
const REACH_ZONES = {
  gate: { x0: -13, x1: 13, z0: 15, z1: 35, yMax: -3.0 },
  crystal: { x0: -13, x1: 13, z0: -18, z1: 4, yMin: -1.0 },
};

  /**
   * Создать систему дел.
   *
   * @param {object} ctx контекст игры
   * @returns {object} система дел
   */
export function createQuests(ctx) {
  /**
   * Состояние дел по id.
   *
   * `state` — 'new' (можно взять) | 'active' (взято) | 'done' (сдано);
   * `kills` — счётчики убийств по группе; `seals` — открытые печати.
   */
  const states = new Map();
  for (const q of QUESTS) {
    states.set(q.id, {
      id: q.id,
      state: 'new',
      kills: {},
      seals: {},
      reached: {},
      /** Сообщали ли, что дело можно сдать. */
      announced: false,
    });
  }

  /** Метки над персонажами: id NPC → метка. */
  const markers = new Map();

  /* ------------------------------------------------------------------ *
   *  Вспомогательное
   * ------------------------------------------------------------------ */

  /**
   * Сколько раз убито зверей из группы.
   *
   * @param {string} group группа
   * @returns {number}
   */
  function killCount(group) {
    let n = 0;
    for (const st of states.values()) n += st.kills[group] || 0;
    return n;
  }

  /**
   * Найти персонажа по id.
   *
   * @param {string} id id персонажа
   * @returns {object|null} NPC
   */
  function npcById(id) {
    const loc = ctx.systems && ctx.systems.locations;
    if (loc && loc.npcs && loc.npcs[id]) return loc.npcs[id];
    if (ctx.npcs && ctx.npcs[id]) return ctx.npcs[id];
    return null;
  }

  /**
   * Сколько предметов в сумке.
   *
   * @param {string} id id предмета
   * @returns {number}
   */
  function haveCount(id) {
    return ctx.inventory ? ctx.inventory.countOf(id) : 0;
  }

  /**
   * Прогресс одной цели.
   *
   * @param {object} quest дело
   * @param {object} obj цель
   * @returns {number} сколько выполнено
   */
  function objectiveProgress(quest, obj) {
    const st = states.get(quest.id);
    if (!st) return 0;
    if (obj.kind === 'kill') {
      // счётчик ведётся по квесту: чужие убийства не засчитываются
      const n = st.kills[obj.group] || 0;
      return Math.min(n, obj.count);
    }
    if (obj.kind === 'have') {
      return Math.min(haveCount(obj.item), obj.count);
    }
    if (obj.kind === 'seal') {
      return st.seals[obj.seal] ? 1 : 0;
    }
    if (obj.kind === 'reach') {
      return st.reached && st.reached[obj.zone] ? 1 : 0;
    }
    return 0;
  }

  /**
   * Выполнены ли все цели дела.
   *
   * @param {object} quest дело
   * @returns {boolean}
   */
  function isReady(quest) {
    return quest.objectives.every((o) => objectiveProgress(quest, o) >= o.count);
  }

  /**
   * Доступно ли дело к взятию (все предыдущие закончены).
   *
   * @param {object} quest дело
   * @returns {boolean}
   */
  function isOffered(quest) {
    const st = states.get(quest.id);
    if (!st || st.state !== 'new') return false;
    return (quest.requires || []).every((id) => {
      const other = states.get(id);
      return other && other.state === 'done';
    });
  }

  /**
   * Текст прогресса по цели — «3 из 6».
   *
   * @param {object} quest дело
   * @param {object} obj цель
   * @returns {string}
   */
  function progressText(quest, obj) {
    const n = objectiveProgress(quest, obj);
    return `${n} из ${obj.count}`;
  }

  /* ------------------------------------------------------------------ *
   *  Выдача и сдача
   * ------------------------------------------------------------------ */

  /**
   * Взять дело.
   *
   * @param {string} id id дела
   * @returns {boolean}
   */
  function accept(id) {
    const quest = QUESTS.find((q) => q.id === id);
    const st = states.get(id);
    if (!quest || !st || !isOffered(quest)) return false;
    st.state = 'active';
    st.announced = false;
    if (ctx.ui) ctx.ui.toast(`Новое дело: «${quest.title}».`, 3600);
    refresh();
    return true;
  }

  /**
   * Забрать предмет из сумки.
   *
   * @param {string} id id предмета
   * @param {number} n сколько
   * @returns {number} сколько забрали
   */
  function takeItems(id, n) {
    if (!ctx.inventory) return 0;
    let taken = 0;
    for (let i = 0; i < n; i++) {
      const idx = ctx.inventory.findById(id);
      if (idx < 0) break;
      ctx.inventory.takeOne(idx);
      taken++;
    }
    return taken;
  }

  /**
   * Сдать дело и получить награду.
   *
   * @param {string} id id дела
   * @returns {boolean}
   */
  function turnIn(id) {
    const quest = QUESTS.find((q) => q.id === id);
    const st = states.get(id);
    if (!quest || !st || st.state !== 'active') return false;
    if (!isReady(quest)) {
      if (ctx.ui) ctx.ui.toast('Дело ещё не закончено.', 2200);
      return false;
    }
    // предметные цели сдаются: отдаём что принесли
    for (const o of quest.objectives) {
      if (o.kind === 'have') takeItems(o.item, o.count);
    }
    st.state = 'done';

    const r = quest.rewards || {};
    if (r.coins && ctx.stats) ctx.stats.earnCoins(r.coins);
    const names = [];
    for (const it of r.items || []) {
      const spec = getItem(it.id);
      if (!spec) continue;
      const n = Math.max(1, it.count || 1);
      // оружие и свитки не складываются: каждая штука — отдельный предмет
      const stackable = spec.stackable !== false;
      const stack = makeStack(spec);
      if (stackable) stack.count = n;
      const res = ctx.inventory ? ctx.inventory.add(stack) : { ok: false };
      if (res && res.ok) names.push(stackable && n > 1 ? `${spec.name} ×${n}` : spec.name);
      else if (ctx.ui) {
        // сумка полна — награда не влезла, честно говорим
        ctx.ui.toast(`Сумка полна — награда не помещается: ${spec.name}.`, 3000);
      }
    }
    if (ctx.ui) {
      const gain = [];
      if (r.coins) gain.push(`${r.coins} зол.`);
      if (names.length) gain.push(names.join(', '));
      ctx.ui.toast(`Дело сдано: «${quest.title}».`
        + (gain.length ? ` Награда: ${gain.join(' и ')}.` : ''), 5200);
      if (quest.rewardText) ctx.ui.toast(quest.rewardText, 6000);
    }
    if (ctx.ui && ctx.inventory) ctx.ui.renderInventory(ctx.inventory);
    refresh();
    return true;
  }

  /* ------------------------------------------------------------------ *
   *  События мира
   * ------------------------------------------------------------------ */

  /**
   * Зверь убит — засчитать в прогресс.
   *
   * @param {object} spec описание зверя
   */
  function onKill(spec) {
    if (!spec || !spec.id) return;
    const before = new Map();
    for (const quest of QUESTS) {
      const st = states.get(quest.id);
      if (!st || st.state !== 'active') continue;
      for (const o of quest.objectives) {
        if (o.kind !== 'kill') continue;
        if (!KILL_GROUPS[o.group] || !KILL_GROUPS[o.group].includes(spec.id)) continue;
        const have = st.kills[o.group] || 0;
        if (have >= o.count) continue;
        st.kills[o.group] = have + 1;
        before.set(quest.id, true);
      }
    }
    if (before.size && ctx.ui) {
      for (const quest of QUESTS) {
        if (!before.has(quest.id)) continue;
        const st = states.get(quest.id);
        const o = quest.objectives.find((x) => x.kind === 'kill');
        if (!o) continue;
        const n = st.kills[o.group] || 0;
        if (n >= o.count) {
          if (!st.announced) {
            st.announced = true;
            ctx.ui.toast(`Цель выполнена: ${o.label}. Вернитесь к заказчику.`, 4200);
          }
        } else {
          ctx.ui.toast(`${o.label}: ${n} из ${o.count}`, 2000);
        }
      }
    }
    refresh();
  }

  /**
   * Печать в подземелье открыта — засчитать в прогресс.
   *
   * @param {string} id id печати
   */
  function onSeal(id) {
    if (!id) return;
    for (const quest of QUESTS) {
      const st = states.get(quest.id);
      if (!st || st.state !== 'active') continue;
      for (const o of quest.objectives) {
        if (o.kind === 'seal' && o.seal === id && !st.seals[id]) {
          st.seals[id] = true;
          if (ctx.ui) ctx.ui.toast(`Цель выполнена: ${o.label}. Вернитесь к заказчику.`, 4200);
        }
      }
    }
    refresh();
  }

  /* ------------------------------------------------------------------ *
   *  Знаки над персонажами и журнал
   * ------------------------------------------------------------------ */

  /**
   * Какой знак показать над персонажем.
   *
   * @param {string} giver id персонажа
   * @returns {string} 'off' | 'new' | 'ready'
   */
  function markerKind(giver) {
    // сначала «?» — дело готово, пора идти сдавать; потом «!» — можно взять новое
    let ready = false;
    let fresh = false;
    for (const quest of QUESTS) {
      if (quest.giver !== giver) continue;
      const st = states.get(quest.id);
      if (!st) continue;
      if (st.state === 'active' && isReady(quest)) ready = true;
      if (st.state === 'new' && isOffered(quest)) fresh = true;
    }
    if (ready) return 'ready';
    return fresh ? 'new' : 'off';
  }

  /**
   * Обновить знаки над персонажами.
   */
  function updateMarkers(dt = 0) {
    for (const [id, marker] of markers) {
      const npc = npcById(id);
      if (!npc) continue;
      const kind = markerKind(id);
      marker.set(kind);
      // метка — ребёнок модели персонажа, поэтому она ходит вместе с ним
      marker.update(dt, MARK_Y);
      // ночью персонаж ушёл — знак не висит в пустоте
      if (npc.away) marker.hide();
    }
  }

  /**
   * Данные для журнала дел.
   *
   * @returns {Array<object>}
   */
  function journal() {
    const out = [];
    for (const quest of QUESTS) {
      const st = states.get(quest.id);
      if (!st) continue;
      // сданное дело — в журнале остаётся навсегда, но с пометкой «сдано»
      if (st.state === 'done') {
        out.push({
          id: quest.id,
          title: quest.title,
          giver: quest.giver,
          giverName: giverName(quest.giver),
          status: 'done',
          statusText: 'Сдано',
          desc: quest.desc,
          objectives: quest.objectives.map((o) => ({
            label: o.label,
            text: `${o.count} из ${o.count}`,
            done: true,
          })),
          reward: rewardText(quest),
        });
        continue;
      }
      // взятое дело — с прогрессом
      if (st.state === 'active') {
        out.push({
          id: quest.id,
          title: quest.title,
          giver: quest.giver,
          giverName: giverName(quest.giver),
          status: 'active',
          statusText: isReady(quest) ? 'Готово к сдаче' : 'В работе',
          desc: quest.desc,
          objectives: quest.objectives.map((o) => ({
            label: o.label,
            text: progressText(quest, o),
            done: objectiveProgress(quest, o) >= o.count,
          })),
          reward: rewardText(quest),
        });
        continue;
      }
      // новое дело: либо можно взять сейчас, либо ждёт предыдущего
      const offered = isOffered(quest);
      out.push({
        id: quest.id,
        title: quest.title,
        giver: quest.giver,
        giverName: giverName(quest.giver),
        status: offered ? 'new' : 'locked',
        statusText: offered ? 'Можно взять' : 'Позже',
        desc: quest.desc,
        objectives: quest.objectives.map((o) => ({
          label: o.label,
          text: offered ? progressText(quest, o) : `— из ${o.count}`,
          done: false,
        })),
        reward: rewardText(quest),
      });
    }
    return out;
  }

  /**
   * Имя заказчика.
   *
   * @param {string} giver id персонажа
   * @returns {string}
   */
  function giverName(giver) {
    return giver === 'barkeep' ? 'Хорт' : 'Торн';
  }

  /**
   * Текст награды для журнала.
   *
   * @param {object} quest дело
   * @returns {string}
   */
  function rewardText(quest) {
    const r = quest.rewards || {};
    const parts = [];
    if (r.coins) parts.push(`${r.coins} зол.`);
    for (const it of r.items || []) {
      const spec = getItem(it.id);
      if (spec) parts.push(`${spec.name}${(it.count || 1) > 1 ? ` ×${it.count}` : ''}`);
    }
    return parts.join(', ');
  }

  /**
   * Обновить журнал и трекер в интерфейсе.
   */
  function refresh() {
    if (ctx.ui && ctx.ui.renderQuests) {
      ctx.ui.renderQuests(journal());
    }
    updateMarkers();
  }

  /* ------------------------------------------------------------------ *
   *  Темы для диалога
   * ------------------------------------------------------------------ */

  /**
   * Темы разговора о делах для персонажа.
   *
   * @param {string} id id персонажа
   * @returns {Array<object>} темы для окна диалога
   */
  function topicsFor(id) {
    const out = [];
    for (const quest of QUESTS) {
      if (quest.giver !== id) continue;
      const st = states.get(quest.id);
      if (!st) continue;
      if (st.state === 'new' && isOffered(quest)) {
        out.push({
          label: `Есть работа: «${quest.title}»`,
          text: quest.offer,
          act: () => {
            accept(quest.id);
            if (ctx.ui) ctx.ui.setDialogText(quest.desc);
          },
        });
        continue;
      }
      if (st.state === 'active') {
        if (isReady(quest)) {
          out.push({
            label: `Сдать дело: «${quest.title}»`,
            text: quest.rewardText || 'Всё сделано. Держи, как договаривались.',
            act: () => {
              turnIn(quest.id);
              if (ctx.ui) ctx.ui.setDialogText('Славно сработано. Спасибо.');
            },
          });
        } else {
          const lines = quest.objectives
            .map((o) => `${o.label} — ${progressText(quest, o)}`)
            .join('. ');
          out.push({
            label: `По делу: «${quest.title}»`,
            text: `${lines}. Как управишься — приходи, я подожду.`,
          });
        }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   *  Жизненный цикл
   * ------------------------------------------------------------------ */

  /**
   * Каждый кадр: знаки над персонажами и тихий пересчёт готовности.
   *
   * @param {number} dt кадр в секундах
   */
  function update(dt) {
    updateMarkers(dt);
    checkReach();
  }

  /**
   * Проверить, дошёл ли игрок до нужного зала подземелья.
   *
   * Цель «дойти» засчитывается по факту: игрок стоит в нужной зоне
   * подземелья (внизу, у Врат). Это честнее, чем «открылась печать»:
   * печать Врат падает как раз тогда, когда стража пала, а пройти
   * можно и раньше — через тропу в обход.
   */
  function checkReach() {
    if (!ctx.loc || ctx.loc !== 'dungeon') return;
    const p = ctx.player;
    if (!p || !p.pos) return;
    const feet = p.pos.y + (p.groundY || 0);
    for (const quest of QUESTS) {
      const st = states.get(quest.id);
      if (!st || st.state !== 'active') continue;
      for (const o of quest.objectives) {
        if (o.kind !== 'reach' || st.reached[o.zone]) continue;
        const z = REACH_ZONES[o.zone];
        if (!z) continue;
        if (p.pos.x < z.x0 || p.pos.x > z.x1) continue;
        if (p.pos.z < z.z0 || p.pos.z > z.z1) continue;
        if (z.yMax !== undefined && feet > z.yMax) continue;
        if (z.yMin !== undefined && feet < z.yMin) continue;
        st.reached[o.zone] = true;
        if (ctx.ui) ctx.ui.toast(`Цель выполнена: ${o.label}. Вернитесь к заказчику.`, 4200);
      }
    }
  }

  /**
   * Привязать знак к персонажу.
   *
   * @param {string} id id персонажа
   */
  function attach(id) {
    if (markers.has(id)) return;
    const npc = npcById(id);
    if (!npc || !npc.group) return;
    const marker = questMarker();
    npc.group.add(marker.sprite);
    marker.sprite.position.set(0, MARK_Y, 0);
    markers.set(id, marker);
  }

  /**
   * Привязать знаки ко всем персонажам с делами.
   */
  function attachAll() {
    for (const q of QUESTS) attach(q.giver);
  }

  /* ------------------------------------------------------------------ *
   *  Сохранение
   * ------------------------------------------------------------------ */

  /**
   * Снимок состояния дел — для сохранения.
   *
   * @returns {object}
   */
  function snapshot() {
    const list = {};
    for (const [id, st] of states) {
      list[id] = {
        state: st.state,
        kills: { ...st.kills },
        seals: { ...st.seals },
        reached: { ...st.reached },
      };
    }
    return list;
  }

  /**
   * Восстановить состояние дел из сохранения.
   *
   * @param {object} data снимок
   */
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    for (const id in data) {
      const st = states.get(id);
      const d = data[id];
      if (!st || !d) continue;
      if (d.state === 'active' || d.state === 'done' || d.state === 'new') st.state = d.state;
      if (d.kills && typeof d.kills === 'object') st.kills = { ...d.kills };
      if (d.seals && typeof d.seals === 'object') st.seals = { ...d.seals };
      if (d.reached && typeof d.reached === 'object') st.reached = { ...d.reached };
    }
    refresh();
  }

  /**
   * Сбросить все дела (новая игра).
   */
  function reset() {
    for (const q of QUESTS) {
      states.set(q.id, {
        id: q.id, state: 'new', kills: {}, seals: {}, reached: {}, announced: false,
      });
    }
    refresh();
  }

  attachAll();
  refresh();

  return {
    QUESTS,
    update,
    accept,
    turnIn,
    onKill,
    onSeal,
    topicsFor,
    journal,
    markerKind,
    refresh,
    attach,
    attachAll,
    snapshot,
    restore,
    reset,
    /** Счётчик убийств по группе (для проверок). */
    killCount,
    /** Состояние дел — для проверок и отладки. */
    states,
  };
}
