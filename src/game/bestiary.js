/**
 * ============================================================================
 *  Зверинец: данные для справочника в игре
 * ============================================================================
 *
 *  Что это
 *  -------
 *  Игра показывает игроку «Зверинец» — список всех пород подземелья с
 *  полными характеристиками: здоровье, урон, скорость, дальность, стойкость,
 *  броня, щит, где водится, что с него падает и как с ним бороться.
 *
 *  Зачем отдельный модуль
 *  ----------------------
 *  Таблица пород живёт в `src/game/monsters.js` (там же — бой), названия
 *  предметов добычи — в `src/game/items.js`, а интерфейс — в `src/ui.js`.
 *  Этот модуль — тонкий слой между ними: собирает из разных таблиц готовые
 *  строки для интерфейса и следит, чтобы «Зверинец» и документ
 *  `docs/БАЛАНС-МОБЫ.md` говорили об одном и том же.
 *
 *  Порядок пород — по ступени силы (мелочь → обычные → стража → владыка),
 *  внутри ступени — по убыванию опасности.
 *
 *  @module game/bestiary
 */

import { MONSTERS, TIERS, ZONES, LOOT_TABLE } from './monsters.js';
import { LOOT } from './items.js';

/**
 * Название предмета по идентификатору.
 *
 * @param {string} id идентификатор предмета
 * @returns {string} название (или сам идентификатор, если предмета нет)
 */
function itemName(id) {
  const it = LOOT.find((x) => x.id === id);
  return it ? it.name : id;
}

/**
 * Собрать «Зверинец» — список пород, готовых к показу.
 *
 * @returns {object[]} породы по ступеням силы
 */
export function buildBestiary() {
  const tierById = new Map(TIERS.map((t) => [t.id, t]));
  return MONSTERS
    .map((spec) => {
      const tier = tierById.get(spec.tier) || TIERS[0];
      // где водится: все зоны этой ступени. Босс стоит отдельно —
      // в зале Врат, у самых Врат.
      const where = spec.boss
        ? ['Зал Врат']
        : ZONES.filter((z) => z.tier === spec.tier)
          .map((z) => z.name)
          .filter((n, i, arr) => arr.indexOf(n) === i);
      return {
        id: spec.id,
        name: spec.name,
        tier: spec.tier,
        tierName: tier.name,
        tierDesc: tier.desc,
        hp: spec.hp,
        dmg: spec.dmg,
        speed: spec.speed,
        aggro: spec.aggro,
        reach: spec.reach,
        cd: spec.cd,
        veil: spec.veil != null ? spec.veil : (spec.tier === 'boss' ? 6 : spec.tier === 'elite' ? 3 : 2),
        armor: spec.armor || 0,
        guard: spec.guard || 0,
        exp: spec.exp,
        sp: spec.sp,
        height: spec.height,
        ghost: !!spec.ghost,
        boss: !!spec.boss,
        where: where.join(' и '),
        desc: spec.desc || '',
        tip: spec.tip || '',
        drops: (LOOT_TABLE[spec.tier] || []).map((e) => itemName(e.id)),
      };
    })
    .sort((a, b) => {
      const ta = tierById.get(a.tier) || TIERS[0];
      const tb = tierById.get(b.tier) || TIERS[0];
      if (ta.order !== tb.order) return ta.order - tb.order;
      // внутри ступени — сначала самые опасные
      return (b.hp * b.dmg) - (a.hp * a.dmg);
    });
}

/**
 * Ступени силы для заголовков «Зверинца».
 *
 * @returns {object[]} ступени с описанием
 */
export function buildTiers() {
  return TIERS.slice().sort((a, b) => a.order - b.order);
}
