/**
 * ============================================================================
 *  ПЕЧАТИ ПОДЗЕМЕЛЬЯ: уровни, которые открываются по мере зачистки
 * ============================================================================
 *
 *  Подземелье разбито на три уровня, и между ними стоят магические
 *  печати — светящиеся барьеры в проёмах:
 *
 *      I.   Входной зал     → Печать входа    (три проёма, z = -20)
 *      II.  Кристальный зал → Печать шахты   (арка, z = 6)
 *      III. Зал Врат        → Печать Врат    (сами Врата: запечатан босс)
 *
 *  Пока в зале живы звери, печать держит путь. Зачистил зал — печать
 *  рассыпалась, и игрок идёт дальше. Порядок получается честным: сначала
 *  мелочь, потом серьёзная порода, потом стража и только потом босс.
 *
 *  Модуль следит за тем, сколько зверей осталось в каждой зоне, и открывает
 *  печать, когда зал пуст. Он же подсказывает у закрытой печати, сколько
 *  ещё зверей надо убить, — иначе игрок не понимает, почему проём не
 *  открывается.
 *
 *  @module game/progression
 */

/**
 * Создать систему прогрессии подземелья.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система прогрессии
 */
export function createProgression(ctx) {
  /** Пауза перед следующей подсказкой у печати. */
  let hintT = 0;
  /** Последняя подсказка в интерфейсе — чтобы не трогать DOM каждый кадр. */
  let lastHud = '';

  /**
   * Локация подземелья.
   *
   * @returns {object|null} локация
   */
  function dungeonLoc() {
    const sys = ctx.systems || {};
    return sys.locations ? sys.locations.dungeonLoc : null;
  }

  /**
   * Система монстров.
   *
   * @returns {object|null} монстры
   */
  function monsters() {
    const sys = ctx.systems || {};
    return sys.monsters || null;
  }

  /**
   * Новая вылазка: печати снова закрыты, босс снова запечатан.
   *
   * Звери при входе в подземелье расставляются заново, поэтому и печати
   * закрываются заново — иначе порядок уровней ломался бы.
   */
  function reset() {
    const L = dungeonLoc();
    if (L && L.resetSeals) L.resetSeals();
    const m = monsters();
    if (m && m.setBossLocked) m.setBossLocked(true);
    hintT = 0;
    lastHud = '';
    if (ctx.ui && ctx.ui.setSeal) ctx.ui.setSeal('');
  }

  /**
   * Открыть печать.
   *
   * @param {object} seal печать
   */
  function openSeal(seal) {
    const L = dungeonLoc();
    if (!L || !L.openSeal) return;
    if (!L.openSeal(seal.id)) return;
    const m = monsters();

    if (seal.id === 'gate') {
      // печать Врат падает — Гримм просыпается, а самоцвет вспыхивает
      if (m && m.setBossLocked) m.setBossLocked(false);
      const lights = L.lights;
      if (lights) {
        lights.gateBoost = 3.4;
        setTimeout(() => { if (lights) lights.gateBoost = 0; }, 9000);
      }
    }

    const lines = {
      hall: 'Печать входа рассыпалась. Проход в кристальный зал открыт — '
        + 'оттуда несёт вонью, и слышно, как там что-то ворочается.',
      crystal: 'Печать шахты лопнула. Вниз, по каменной лестнице, — там '
        + 'холоднее, и слышно чьё-то дыхание.',
      gate: 'Стража пала. Печать Врат разбита — Гримм проснулся. '
        + 'Самоцвет горит так ярко, что видно весь зал.',
    };
    // дела: открытая печать — засчитанная цель
    if (ctx.systems && ctx.systems.quests) ctx.systems.quests.onSeal(seal.id);
    if (ctx.ui) ctx.ui.toast(lines[seal.id] || 'Печать пала. Путь открыт.', 5200);
    if (ctx.ambience) {
      ctx.ambience.deepBoom();
      if (seal.id === 'gate' && ctx.ambience.crystalChime) ctx.ambience.crystalChime();
    }
  }

  /**
   * Обновление: проверяем залы и подсказываем у закрытых печатей.
   *
   * @param {number} dt кадр в секундах
   */
  function update(dt) {
    if (ctx.loc !== 'dungeon') return;
    const L = dungeonLoc();
    const m = monsters();
    if (!L || !m || !L.seals || !L.seals.length) return;

    const counts = m.zoneCounts ? m.zoneCounts() : null;
    if (!counts) return;

    // 1) зал пуст — печать падает
    for (const seal of L.seals) {
      if (seal.open) continue;
      const c = counts[seal.zone];
      if (!c) continue;
      if (c.alive <= 0) openSeal(seal);
    }

    // 2) подсказка в интерфейсе: какая печать держит путь и сколько зверей
    //    осталось. Это главный ориентир — без него игрок не понимает,
    //    почему проём не открывается.
    let hud = '';
    for (const seal of L.seals) {
      if (seal.open) continue;
      const c = counts[seal.zone];
      const left = c ? c.alive : 0;
      hud = (seal.hud || 'Печать держит путь: {n}').replace('{n}', String(left));
      break;
    }
    if (hud !== lastHud) {
      lastHud = hud;
      if (ctx.ui && ctx.ui.setSeal) ctx.ui.setSeal(hud);
    }

    // 3) разовый совет у самой печати
    hintT -= dt;
    if (hintT > 0) return;
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    for (const seal of L.seals) {
      if (seal.open) continue;
      const d = Math.hypot(px - seal.pos.x, pz - seal.pos.z);
      if (d > 7.5) continue;
      const c = counts[seal.zone];
      const left = c ? c.alive : 0;
      hintT = 8;
      if (ctx.ui) {
        ctx.ui.toast(left > 0
          ? `Печать не спадёт, пока в зале остаются враги: ${left}.`
          : 'Печать слабеет…', 3400);
      }
      break;
    }
  }

  /**
   * Состояние печатей — для проверок и отладки.
   *
   * @returns {object[]} печати
   */
  function state() {
    const L = dungeonLoc();
    if (!L || !L.seals) return [];
    return L.seals.map((s) => ({ id: s.id, open: s.open, zone: s.zone }));
  }

  return { update, reset, state, openSeal };
}
