/* ------------------------------------------------------------------ *
 *  Инвентарь: слоты, стаки и перетаскивание — по образцу Minecraft
 *
 *  Раскладка как в игре:
 *    0..26  — основное хранилище (9 × 3)
 *    27..35 — пояс (9 × 1), быстрый доступ
 * ------------------------------------------------------------------ */

export const MAIN_SLOTS = 27;
export const BELT_SLOTS = 9;
export const TOTAL_SLOTS = MAIN_SLOTS + BELT_SLOTS;
export const MAX_STACK = 64;
export const BELT_START = MAIN_SLOTS;

/** Стак одного вида рыбы. */
export function makeStack(spec, meta = {}) {
  const weight = meta.weight ?? spec.weightMin;
  const length = meta.length ?? spec.lengthMin;
  return {
    id: spec.id,
    spec,
    count: 1,
    best: { weight, length },   // лучший экземпляр в стаке
  };
}

function copyStack(s) {
  return { id: s.id, spec: s.spec, count: s.count, best: { weight: s.best.weight, length: s.best.length } };
}

export class Inventory {
  constructor() {
    this.slots = new Array(TOTAL_SLOTS).fill(null);
    this.held = null;      // стак «на курсоре»
    this.heldFrom = -1;    // слот, из которого его подняли
    this.sel = 0;          // выбранный слот пояса (0..8)
    this.onChange = null;  // callback после любого изменения
  }

  touch() { if (this.onChange) this.onChange(); }

  /** Положить стак в инвентарь: сперва в существующий такой же, потом в пустой слот. */
  add(stack) {
    let rest = stack;
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const s = this.slots[i];
      if (!s || s.id !== rest.id || s.count >= MAX_STACK) continue;
      const room = MAX_STACK - s.count;
      const take = Math.min(room, rest.count);
      s.count += take;
      if (rest.best.weight > s.best.weight) s.best = { weight: rest.best.weight, length: rest.best.length };
      rest = { ...rest, count: rest.count - take };
      if (rest.count <= 0) { this.touch(); return { ok: true, slot: i, merged: true }; }
    }
    for (let i = 0; i < TOTAL_SLOTS; i++) {
      if (!this.slots[i]) {
        this.slots[i] = rest;
        this.touch();
        return { ok: true, slot: i };
      }
    }
    return { ok: false };   // всё занято
  }

  /** Общее число предметов и число разных видов. */
  stats() {
    let total = 0; const kinds = new Map();
    for (const s of this.slots) {
      if (!s) continue;
      total += s.count;
      kinds.set(s.id, (kinds.get(s.id) || 0) + s.count);
    }
    return { total, kinds: kinds.size, lines: kinds.size };
  }

  /** Перенести стак в соседнюю секцию (основное ↔ пояс). */
  quickMove(i) {
    const s = this.slots[i];
    if (!s) return;
    const toBelt = i < BELT_START;
    const range = toBelt ? [BELT_START, TOTAL_SLOTS] : [0, BELT_START];
    // сперва — в стак того же вида
    for (let k = range[0]; k < range[1]; k++) {
      const t = this.slots[k];
      if (t && t.id === s.id && t.count < MAX_STACK) {
        const room = MAX_STACK - t.count;
        const take = Math.min(room, s.count);
        t.count += take;
        if (s.best.weight > t.best.weight) t.best = { weight: s.best.weight, length: s.best.length };
        s.count -= take;
        if (s.count <= 0) this.slots[i] = null;
        this.touch();
        return;
      }
    }
    // иначе — в первый пустой слот секции
    for (let k = range[0]; k < range[1]; k++) {
      if (!this.slots[k]) {
        this.slots[k] = s;
        this.slots[i] = null;
        this.touch();
        return;
      }
    }
  }

  /** Положить стак, который «висит на курсоре», обратно в инвентарь. */
  dropHeld() {
    if (!this.held) return;
    const s = this.held;
    this.held = null;
    this.heldFrom = -1;
    if (s.count > 0) this.add(s);
    else this.touch();
  }
}

/**
 * Клик по слоту.
 *  ЛКМ: взять стак / положить / объединить / поменять местами
 *  ПКМ: взять половину / положить одну штуку
 *  Shift+ЛКМ: быстрое перемещение между основным хранилищем и поясом
 */
export function clickSlot(inv, i, button = 0, shift = false) {
  const slot = inv.slots[i];

  if (button === 2) {
    if (!inv.held) {
      if (!slot) return;
      const take = Math.ceil(slot.count / 2);
      inv.held = { ...copyStack(slot), count: take };
      slot.count -= take;
      if (slot.count <= 0) inv.slots[i] = null;
      inv.heldFrom = i;
    } else if (!slot) {
      inv.slots[i] = { ...copyStack(inv.held), count: 1 };
      inv.held.count -= 1;
      if (inv.held.count <= 0) inv.held = null;
    } else if (slot.id === inv.held.id && slot.count < MAX_STACK) {
      slot.count += 1;
      inv.held.count -= 1;
      if (inv.held.count <= 0) inv.held = null;
    }
    inv.touch();
    return;
  }

  if (shift) { inv.quickMove(i); return; }

  if (!inv.held) {
    if (!slot) return;
    inv.held = slot;
    inv.slots[i] = null;
    inv.heldFrom = i;
  } else if (!slot) {
    inv.slots[i] = inv.held;
    inv.held = null;
    inv.heldFrom = -1;
  } else if (slot.id === inv.held.id && slot.count < MAX_STACK) {
    const take = Math.min(MAX_STACK - slot.count, inv.held.count);
    slot.count += take;
    if (inv.held.best.weight > slot.best.weight) slot.best = { weight: inv.held.best.weight, length: inv.held.best.length };
    inv.held.count -= take;
    if (inv.held.count <= 0) { inv.held = null; inv.heldFrom = -1; }
  } else {
    inv.slots[i] = inv.held;
    inv.held = slot;
  }
  inv.touch();
}
