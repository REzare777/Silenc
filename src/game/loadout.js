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
 *  Что лежит на поясе
 *  ------------------
 *  * оружие  — занимает правую руку (большая парящая модель);
 *  * факел   — занимает левую руку и горит по команде (клавиша F);
 *  * свиток с заклинанием — по нажатию цифры колдуется, а рука с оружием
 *    остаётся на месте.
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
    /** Взят ли факел в левую руку. */
    torchEquipped: false,
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
   * Есть ли у игрока факел — в сумке или на поясе.
   *
   * @returns {boolean}
   */
  function ownsTorch() {
    if (!ctx.inventory) return false;
    return ctx.inventory.findById('torch') >= 0;
  }

  /**
   * Взять факел в левую руку или убрать его.
   *
   * @returns {boolean} взят ли он теперь
   */
  function toggleTorch() {
    if (!ownsTorch()) {
      if (ctx.ui) ctx.ui.toast('Факела нет. Его продаёт кузнец Торн.', 2800);
      return false;
    }
    state.torchEquipped = !state.torchEquipped;
    sync();
    if (ctx.ui) {
      ctx.ui.toast(state.torchEquipped
        ? 'Факел в левой руке. F — зажечь.'
        : 'Факел убран.', 2200);
    }
    return state.torchEquipped;
  }

  /**
   * Синхронизировать руки с тем, что выбрано на поясе.
   *
   * Важное правило: пустая ячейка пояса НЕ отнимает оружие из руки.
   * Иначе пришлось бы каждый раз переодевать топор, нажимая на пустую
   * ячейку. Оружие уходит из руки только когда его больше нет в сумке
   * (продали, выбросили) — и тогда рука остаётся пустой.
   */
  function sync() {
    // оружие в правой руке
    const spec = currentWeapon();
    if (spec) {
      if (spec.id !== state.weaponId) {
        state.weaponId = spec.id;
        ctx.viewmodel.setWeapon(weaponModel(spec.id), spec);
      }
    } else if (state.weaponId && ctx.inventory.findById(state.weaponId) < 0) {
      // оружие пропало из сумки — убираем его из руки
      state.weaponId = null;
      ctx.viewmodel.clearWeapon();
    }
    // факел в левой руке
    const combat = ctx.systems && ctx.systems.combat;
    if (combat) {
      // факел могли продать или выбросить — тогда он исчезает из руки
      if (state.torchEquipped && !ownsTorch()) state.torchEquipped = false;
      combat.setTorchEquipped(state.torchEquipped);
    }
  }

  /**
   * Заправить факел смолой и фитилём.
   *
   * Материал тратится по нажатию цифры его слота: факел наполняется,
   * одна порция смолы сгорает.
   *
   * @param {number} n номер ячейки пояса
   * @param {object} stack стак материала
   * @returns {boolean} удалось ли
   */
  function usePitch(n, stack) {
    const combat = ctx.systems && ctx.systems.combat;
    if (!combat) return false;
    combat.addFuel(100);
    stack.count -= 1;
    if (stack.count <= 0) ctx.inventory.slots[BELT_START + n] = null;
    ctx.inventory.touch();
    if (ctx.ui) {
      ctx.ui.toast(`Смола и фитиль: факел заправлен (${Math.round(combat.state.fuel)} из ${100}).`, 2600);
      ctx.ui.renderInventory(ctx.inventory);
    }
    return true;
  }

  /**
   * Выбрать ячейку пояса.
   *
   * Обычная ячейка — взять предмет в руку. Свиток — колдовать сразу.
   * Факел — взять или убрать из левой руки. Смола — заправить факел.
   * В двух последних случаях выбор ячейки не меняется: оружие в правой
   * руке остаётся на месте.
   *
   * @param {number} i номер ячейки 0..8
   */
  function select(i) {
    const n = Math.max(0, Math.min(8, i | 0));
    const stack = ctx.inventory.slots[BELT_START + n];
    const spec = stack ? stack.spec : null;
    if (spec && spec.kind === 'spell') {
      const spells = ctx.systems && ctx.systems.spells;
      if (spells) spells.cast(spec);
      else if (ctx.ui) ctx.ui.toast('Здесь заклинания не действуют.', 2000);
      return;
    }
    if (spec && spec.kind === 'gear' && spec.id === 'torch') {
      toggleTorch();
      return;
    }
    if (spec && spec.kind === 'material' && spec.id === 'pitch') {
      usePitch(n, stack);
      return;
    }
    ctx.inventory.sel = n;
    sync();
  }

  return {
    sync,
    select,
    currentWeapon,
    /** Что в руках прямо сейчас. */
    beltItem,
    /** Взять или убрать факел. */
    toggleTorch,
    /** Взять или убрать факел (без сообщений — для загрузки сохранения). */
    setTorchEquipped(on) {
      state.torchEquipped = !!on && ownsTorch();
      sync();
    },
    /** Есть ли у игрока факел. */
    ownsTorch,
    /** id оружия в руках. */
    get weaponId() { return state.weaponId; },
    /** Есть ли оружие в руках. */
    get armed() { return !!state.weaponId; },
    /** Взят ли факел в левую руку. */
    get torchEquipped() { return state.torchEquipped; },
  };
}
