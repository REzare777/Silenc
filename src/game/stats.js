/**
 * ============================================================================
 *  Характеристики игрока: здоровье, силы, мана и монеты
 * ============================================================================
 *
 *  Четыре величины, из которых растут все будущие боевые системы:
 *
 *  | величина  | зачем                                   | как тратится      |
 *  |-----------|-----------------------------------------|-------------------|
 *  | Здоровье  | сколько можно получить урона           | урон             |
 *  | Силы      | физические удары, рывок, тяжёлая работа  | атаки, бег       |
 *  | Мана      | магия: кристаллы, огонь, лечение        | магические удары |
 *  | Монеты    | покупки и продажа улова                | торговля         |
 *
 *  Правила восстановления:
 *  - силы возвращаются быстро, но после рывка есть короткая задержка;
 *  - мана возвращается медленно и всегда;
 *  - здоровье само не восстанавливается — только лечение (зелья, отдых).
 *
 *  @module game/stats
 */

/**
 * Класс характеристик игрока.
 */
export class PlayerStats {
  constructor(opts = {}) {
    /** Максимум здоровья. */
    this.maxHp = opts.maxHp ?? 100;
    /** Текущее здоровье. */
    this.hp = this.maxHp;
    /** Максимум сил. */
    this.maxStamina = opts.maxStamina ?? 100;
    /** Текущие силы. */
    this.stamina = this.maxStamina;
    /** Максимум маны. */
    this.maxMana = opts.maxMana ?? 100;
    /** Текущая мана. */
    this.mana = this.maxMana;
    /** Монеты в кошельке. */
    this.coins = opts.coins ?? 30;
    /** Задержка перед восстановлением сил (после рывка). */
    this._staminaLock = 0;
    /** Флаг: игрок выдохся (силы на нуле). */
    this.exhausted = false;
    /** Колбэк на любое изменение — HUD перерисовывает полоски. */
    this.onChange = null;
  }

  /* ---------------- доли для полосок ---------------- */

  /** @returns {number} доля здоровья 0…1 */
  get hpRatio() { return this.maxHp ? this.hp / this.maxHp : 0; }

  /** @returns {number} доля сил 0…1 */
  get staminaRatio() { return this.maxStamina ? this.stamina / this.maxStamina : 0; }

  /** @returns {number} доля маны 0…1 */
  get manaRatio() { return this.maxMana ? this.mana / this.maxMana : 0; }

  /** @returns {boolean} здоровье на нуле */
  get dead() { return this.hp <= 0; }

  /** Сообщить подписчикам об изменении. */
  _changed() { if (this.onChange) this.onChange(this); }

  /* ---------------- траты ---------------- */

  /**
   * Потратить силы.
   *
   * @param {number} n сколько
   * @returns {boolean} true, если сил хватило
   */
  spendStamina(n) {
    if (n <= 0) return true;
    if (this.stamina < n) {
      this.stamina = 0;
      this.exhausted = true;
      this._changed();
      return false;
    }
    this.stamina -= n;
    this._staminaLock = 0.7;          // после рывка силы отдыхнут не сразу
    this.exhausted = this.stamina <= 0;
    this._changed();
    return true;
  }

  /**
   * Потратить силы понемногу (бег).
   *
   * @param {number} n сколько
   * @returns {boolean} true, если силы ещё остались
   */
  drainStamina(n) {
    if (n <= 0) return true;
    if (this.stamina < n) {
      this.stamina = 0;
      this.exhausted = true;
      this._changed();
      return false;
    }
    this.stamina -= n;
    if (this.stamina <= 0) this.exhausted = true;
    this._changed();
    return true;
  }

  /**
   * Потратить ману.
   *
   * @param {number} n сколько
   * @returns {boolean} true, если маны хватило
   */
  spendMana(n) {
    if (n <= 0) return true;
    if (this.mana < n) {
      this.mana = 0;
      this._changed();
      return false;
    }
    this.mana -= n;
    this._changed();
    return true;
  }

  /**
   * Потратить монеты.
   *
   * @param {number} n сколько
   * @returns {boolean} true, если монет хватило
   */
  spendCoins(n) {
    if (n <= 0) return true;
    if (this.coins < n) {
      this._changed();
      return false;
    }
    this.coins -= n;
    this._changed();
    return true;
  }

  /* ---------------- поступления ---------------- */

  /**
   * Получить урон.
   *
   * @param {number} n величина урона
   * @returns {number} сколько здоровья реально снято
   */
  damage(n) {
    if (n <= 0) return 0;
    const taken = Math.min(this.hp, n);
    this.hp -= taken;
    this._changed();
    return taken;
  }

  /**
   * Вылечиться.
   *
   * @param {number} n сколько
   * @returns {number} сколько здоровья реально восстановлено
   */
  heal(n) {
    if (n <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    this._changed();
    return this.hp - before;
  }

  /**
   * Восстановить силы (например, при отдхе).
   *
   * @param {number} n сколько
   * @returns {number} сколько реально восстановлено
   */
  restoreStamina(n) {
    if (n <= 0) return 0;
    const before = this.stamina;
    this.stamina = Math.min(this.maxStamina, this.stamina + n);
    if (this.stamina >= this.maxStamina * 0.3) this.exhausted = false;
    this._changed();
    return this.stamina - before;
  }

  /**
   * Восстановить ману.
   *
   * @param {number} n сколько
   * @returns {number} сколько реально восстановлено
   */
  restoreMana(n) {
    if (n <= 0) return 0;
    const before = this.mana;
    this.mana = Math.min(this.maxMana, this.mana + n);
    this._changed();
    return this.mana - before;
  }

  /**
   * Получить монеты.
   *
   * @param {number} n сколько
   * @returns {number} итоговое число монет
   */
  earnCoins(n) {
    this.coins = Math.max(0, this.coins + n);
    this._changed();
    return this.coins;
  }

  /* ---------------- ход времени ---------------- */

  /**
   * Естественное восстановление.
   *
   * @param {number} dt кадр в секундах
   * @param {object} [opts] { sprinting: boolean, resting: boolean }
   */
  update(dt, opts = {}) {
    let changed = false;

    // силы: восстанавливаются, пока не бежим; после рывка — пауза
    this._staminaLock = Math.max(0, this._staminaLock - dt);
    if (this._staminaLock <= 0 && !opts.sprinting && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 16 * dt);
      changed = true;
    }
    // выдохся — отпускаем только когда силы вернулись на треть
    if (this.exhausted && this.stamina >= this.maxStamina * 0.3) this.exhausted = false;

    // мана: медленно и всегда
    if (this.mana < this.maxMana) {
      this.mana = Math.min(this.maxMana, this.mana + 3.2 * dt);
      changed = true;
    }

    if (changed) this._changed();
  }

  /**
   * Сбросить состояние (после смерти или новой игры).
   */
  reset() {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.mana = this.maxMana;
    this.exhausted = false;
    this._staminaLock = 0;
    this._changed();
  }
}
