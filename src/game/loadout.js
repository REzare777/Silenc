/**
 * ============================================================================
 *  Снаряжение: что в руках
 * ============================================================================
 *
 *  Пояс в инвентаре — это девять ячеек быстрого доступа. Клавиатура 1–9
 *  выбирает ячейку, и всё, что в ней лежит, оказывается в руках: оружие
 *  берётся в правую руку, остальное — как обычный предмет.
 *
 *  Зачем это нужно
 *  ---------------
 *  Оружие должно быть в руках всегда, когда оно есть, иначе придётся
 *  каждый раз открывать сумку. При этом оно остаётся обычным предметом:
 *  его можно продать, положить на пояс, поменять.
 *
 *  Как устроено
 *  ------------
 *  * `sync()` вызывается каждый кадр: сравнивает, какое оружие сейчас
 *    выбрано, и при смене ставит новую модель в руку.
 *  * Оружие лежит в инвентаре как стак; в руках оно просто отображается.
 *
 *  @module game/loadout
 */

import { BELT_START } from '../inventory.js';
import { weaponModel } from '../world/weapons.js';

/**
 * Создать систему снаряжения.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система снаряжения
 */
export function createLoadout(ctx) {
  const state = {
    /** id оружия, которое сейчас в руках (или null). */
    weaponId: null,
  };

  /**
   * Что лежит в выбранной ячейке пояса.
   *
   * @returns {object|null} стак
   */
  function beltItem() {
    const s = ctx.inventory.slots[BELT_START + (ctx.inventory.sel || 0)];
    return s || null;
  }

  /**
   * Оружие, выбранное сейчас.
   *
   * @returns {object|null} спецификация оружия
   */
  function currentWeapon() {
    const s = beltItem();
    if (!s || !s.spec || s.spec.kind !== 'weapon') return null;
    return s.spec;
  }

  /**
   * Синхронизировать руки с тем, что выбрано на поясе.
   */
  function sync() {
    const spec = currentWeapon();
    const id = spec ? spec.id : null;
    if (id === state.weaponId) return;
    state.weaponId = id;
    if (spec) {
      ctx.viewmodel.setWeapon(weaponModel(spec.id), spec);
    } else {
      ctx.viewmodel.clearWeapon();
    }
  }

  /**
   * Выбрать ячейку пояса.
   *
   * @param {number} i номер ячейки 0..8
   */
  function select(i) {
    const n = Math.max(0, Math.min(8, i | 0));
    ctx.inventory.sel = n;
    sync();
  }

  return {
    sync,
    select,
    currentWeapon,
    /** Что в руках прямо сейчас. */
    beltItem,
    /** id оружия в руках. */
    get weaponId() { return state.weaponId; },
    /** Есть ли оружие в руках. */
    get armed() { return !!state.weaponId; },
  };
}
