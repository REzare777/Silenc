/**
 * ============================================================================
 *  Взаимодействия (клавиша E)
 * ============================================================================
 *
 *  Каждый объект, с которым можно что-то сделать, регистрируется здесь как
 *  «интеракт»:
 *
 *  ```js
 *  interactions.add({
 *    pos: new THREE.Vector3(0, 1.2, 0),
 *    radius: 2.8,
 *    label: 'Набрать воды',
 *    act: () => ctx.ui.toast('Вода из колодца — ледяная и чистая.'),
 *  });
 *  ```
 *
 *  У интеракта есть поле `where` — локация, в которой он доступен:
 *  `'village'` (по умолчанию), `'barn'` или `'tavern'`. Так одна и та же
 *  система обслуживает все три локации.
 *
 *  @module game/interactions
 */

/**
 * Создаёт реестр взаимодействий.
 *
 * @param {object} ctx контекст игры
 * @returns {object} реестр взаимодействий
 */
export function createInteractions(ctx) {

  /**
   * Добавить действие по нажатию E.
   *
   * @param {THREE.Vector3} pos точка действия в мировых координатах
   * @param {number} radius радиус срабатывания
   * @param {string} label подпись в подсказке
   * @param {Function} act что делать
   * @param {string} [where] локация: 'village' | 'barn' | 'tavern'
   * @returns {object} зарегистрированный интеракт (позицию можно двигать)
   */
  function add(pos, radius, label, act, where = 'village') {
    const it = { pos, radius, label, act, where };
    ctx.interactables.push(it);
    return it;
  }

  /**
   * Ближайшее доступное действие в текущей локации.
   *
   * @returns {object|null} интеракт или null
   */
  function nearest() {
    let best = null, bestD = 1e9;
    // высота ног игрока: интеракт наверху (колокол в башне) не должен
    // срабатывать, когда игрок стоит внизу, под ним
    const feet = ctx.player.y + ctx.player.groundY;
    for (const it of ctx.interactables) {
      if ((it.where || 'village') !== ctx.loc) continue;
      if (it.y !== undefined && Math.abs(feet - it.y) > (it.yTol ?? 1.8)) continue;
      const dx = ctx.player.pos.x - it.pos.x;
      const dz = ctx.player.pos.z - it.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < it.radius && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  /**
   * Выполнить ближайшее действие.
   *
   * @returns {boolean} было ли что-то выполнено
   */
  function doInteract() {
    const it = nearest();
    if (!it) return false;
    it.act();
    return true;
  }

  return { add, nearest, doInteract };
}
