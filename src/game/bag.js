/**
 * ============================================================================
 *  Инвентарь: открытие, закрытие, переключение
 * ============================================================================
 *
 *  Инвентарь занимает весь экран и полностью перехватывает курсор.
 *  Выход — только `Esc` или та же клавиша `I`, что его открыла.
 *
 *  @module game/bag
 */

import { Inventory } from '../inventory.js';

/**
 * Создаёт подсистему инвентаря.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система инвентаря
 */
export function createBag(ctx) {

  /** Модель инвентаря (слоты, предмет на курсоре). */
  const inventory = new Inventory();
  ctx.inventory = inventory;

  /** Открыть инвентарь. */
  function open() {
    if (ctx.mode === 'inv') return;
    if (ctx.mode === 'menu') ctx.ui.closeMenu();
    ctx.mode = 'inv';
    if (ctx.viewmodel) ctx.viewmodel.hideHands();   // в инвентаре руки не нужны
    ctx.ui.renderInventory(inventory);
    ctx.ui.openInv();
    // полный фокус курсора: мышь свободна, игра не принимает ввод
    ctx.player.acceptInput = false;
    ctx.player.enabled = false;
    ctx.player.keys.clear();
    if (document.pointerLockElement === ctx.renderer.domElement) document.exitPointerLock();
  }

  /** Закрыть инвентарь. */
  function close() {
    if (ctx.mode !== 'inv') return;
    if (ctx.inventory.held) ctx.inventory.dropHeld();     // предмет на курсоре — назад в слот
    ctx.ui.closeInv();
    ctx.mode = 'play';
    ctx.player.enabled = true;
    ctx.player.acceptInput = true;
    ctx.player.keys.clear();
    ctx.player.requestLock();
    // браузер может задержать захват мыши после Esc — пробуем ещё раз
    setTimeout(() => { if (ctx.mode === 'play' && !document.pointerLockElement) ctx.player.requestLock(); }, 350);
  }

  /** Открыть или закрыть инвентарь. */
  function toggle() {
    if (ctx.mode === 'inv') close();
    else open();
  }

  return { inventory, open, close, toggle };
}
