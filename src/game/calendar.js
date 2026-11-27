/**
 * ============================================================================
 *  Календарь: дни, сезоны и смена облика долины
 * ============================================================================
 *
 *  Что это даёт игре
 *  -----------------
 *  Без календаря мир не меняется: всегда одно и то же утро, одна и та же
 *  трава, одна и та же листва. С календарём долина живёт — через несколько
 *  дней деревья желтеют, потом на деревья ложится снег, а весной всё
 *  зеленеет заново. Это даёт игроку повод прийти завтра.
 *
 *  Как считается день
 *  ------------------
 *  Сутки в игре — это полный круг времени суток: утро → день → золотой
 *  час → сумерки → ночь → снова утро. Ночь заканчивается утром, значит
 *  на рассвете начинается новый день. Календарь ловит этот момент.
 *
 *  Длина сезона
 *  ------------
 *  Пять дней на сезон, четыре сезона — двадцать дней в году. Короткий
 *  год: игрок успевает увидеть все четыре облика, не застревая в одном.
 *
 *  Облик сезона
 *  ------------
 *  Сезон меняет не «всё подряд», а три конкретные вещи:
 *    • цвет травы и листвы (материалы `M.grass`, `M.leaf`);
 *    • цвет неба и тумана (через окружение);
 *    • появление снега зимой.
 *
 *  @module game/calendar
 */

import * as THREE from 'three';

/** Сколько дней длится сезон. */
export const DAYS_PER_SEASON = 5;

/**
 * Сезоны и их облик.
 *
 * `grass` и `leaf` — множители к базовому цвету материалов (1 = не менять),
 * `sky` и `fog` — цвет неба и тумана, `snow` — идёт ли снег.
 */
export const SEASONS = {
  spring: {
    id: 'spring',
    name: 'Весна',
    // трава и листва — оттенком к базовому цвету (1 = без изменений)
    grass: 0xcdf0a8,
    leaf: 0xd6f59e,
    // пшеница: весной всходы зелёные
    wheat: 0x8fb35c,
    sky: 0xdff0ff,
    fog: 0xf2f6ff,
    sun: 1.05,
    snow: false,
    note: 'Весна в долине: трава сочная, листва молодая, в воздухе пахнет дождём.',
  },
  summer: {
    id: 'summer',
    name: 'Лето',
    grass: 0xc8cf78,
    leaf: 0xbcc768,
    // пшеница: летом колос ещё зеленеет
    wheat: 0xb9b25c,
    sky: 0xf2f6ff,
    fog: 0xf0f4f8,
    sun: 1.2,
    snow: false,
    note: 'Лето в долине: солнце высоко, трава выгорела и хрустит под ногами.',
  },
  autumn: {
    id: 'autumn',
    name: 'Осень',
    grass: 0xdcb26a,
    leaf: 0xee9c36,
    // пшеница: в поле зреет колос, к осени — золотая
    wheat: 0xd8a13c,
    sky: 0xffd9a8,
    fog: 0xf0c890,
    sun: 0.94,
    snow: false,
    note: 'Осень в долине: листва горит, а по утрам с деревьев сыплется золото.',
  },
  winter: {
    id: 'winter',
    name: 'Зима',
    // зимой трава и листва бледные, будто припорошенные снегом
    grass: 0xa8bccc,
    leaf: 0x9db2c8,
    // пшеницы зимой нет: поле убрано, лежит снег
    wheat: 0xa8bccc,
    sky: 0xe8f0ff,
    fog: 0xf4f8ff,
    sun: 0.72,
    snow: true,
    note: 'Зима в долине: дороги замело, дым из труб валит гуще, а темнеет рано.',
  },
};

/** Порядок сезонов в году. */
export const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

/**
 * Создать календарь.
 *
 * @param {object} ctx контекст игры
 * @returns {object} календарь
 */
export function createCalendar(ctx) {
  const state = {
    day: 1,          // номер дня внутри года (1..DAYS_PER_SEASON*4)
    year: 1,         // номер года
    season: 'spring',
    seasonIndex: 0,  // индекс в SEASON_ORDER
    daysInSeason: 0, // сколько дней прошло в текущем сезоне
  };

  /** Подписчики на смену дня и сезона. */
  const dayListeners = [];
  const seasonListeners = [];

  /**
   * Посчитать сезон по номеру дня.
   *
   * @param {number} day
   * @returns {number} индекс сезона
   */
  function seasonIndexFor(day) {
    return Math.floor((day - 1) / DAYS_PER_SEASON) % SEASON_ORDER.length;
  }

  /**
   * Пересчитать сезон по текущему дню.
   */
  function recompute() {
    const idx = seasonIndexFor(state.day);
    const changed = idx !== state.seasonIndex;
    state.seasonIndex = idx;
    state.season = SEASON_ORDER[idx];
    state.daysInSeason = (state.day - 1) % DAYS_PER_SEASON;
    if (changed) applyLook();
  }

  /**
   * Применить облик сезона к материалам и окружению.
   */
  function applyLook() {
    const s = SEASONS[state.season];
    const M = ctx.M;

    // Оттенок сезона накладывается на базовый цвет материала.
    // Базовый цвет запоминается один раз: иначе второй сезон умножался бы
    // на результат первого, и трава со временем стала бы чёрной.
    const tint = (mat, hex) => {
      if (!mat) return;
      if (!mat.userData.baseColor) mat.userData.baseColor = mat.color.clone();
      mat.color.copy(mat.userData.baseColor).multiply(new THREE.Color(hex));
    };
    // Газон: у каждого сезона своя текстура. Зелёную текстуру земли
    // оттенком в белую не превратить — поэтому зимой ставится серая.
    const groundMat = {
      spring: M?.grassSpring,
      summer: M?.grass,
      autumn: M?.grassAutumn,
      winter: M?.grassWinter,
    }[state.season] || M?.grass;
    const hillMat = {
      spring: M?.grassFarSpring,
      summer: M?.grassFar,
      autumn: M?.grassFarAutumn,
      winter: M?.grassFarWinter,
    }[state.season] || M?.grassFar;
    if (ctx.groundMesh) ctx.groundMesh.material = groundMat;
    for (const hill of ctx.hillMeshes || []) hill.material = hillMat;
    // Полоски газона: своя текстура со своим масштабом — красим через map.
    const patchTex = {
      spring: M?.grassSpring?.map,
      summer: M?.grass?.map,
      autumn: M?.grassAutumn?.map,
      winter: M?.grassWinter?.map,
    }[state.season];
    if (patchTex) {
      for (const p of ctx.grassPatches || []) {
        if (!p.mesh.material.map) continue;
        p.mesh.material.map = patchTex.clone();
        p.mesh.material.map.needsUpdate = true;
        p.mesh.material.map.wrapS = p.mesh.material.map.wrapT = THREE.RepeatWrapping;
        p.mesh.material.map.repeat.set(p.repeat, p.repeat);
        p.mesh.material.color.setHex(state.season === 'winter' ? 0xffffff : 0xffffff);
      }
    }

    if (M) {
      // Пшеница — материал без текстуры, поэтому цвет задаётся напрямую:
      // умножение золотого на зелёный дал бы болотный.
      if (M.wheat) M.wheat.color.setHex(s.wheat);
    }

    // Листва и трава — это РАЗНЫЕ материалы по сезону, а не оттенок одного.
    // Умножение зелёной текстуры на оранжевый оттенок даёт оливковый цвет,
    // а не осенний, поэтому материал подменяется целиком.
    if (M) {
      const leafMat = {
        spring: M.leafSpring,
        summer: M.leaf,
        autumn: M.leafAutumn,
        winter: M.leafWinter,
      }[state.season] || M.leaf;
      const tuftMat = {
        spring: M.foliageInstanced,
        summer: M.foliageInstanced,
        autumn: M.foliageAutumn,
        winter: M.foliageWinter,
      }[state.season] || M.foliageInstanced;

      // Кроны, кусты и папоротник леса.
      for (const mesh of ctx.forestFoliage || []) mesh.material = leafMat;
      // Трава-кустики на лугах и у дорог. Зимой они скрыты под снегом —
      // серые конусы, торчащие из наста, выглядели бы как шишки.
      const showTufts = state.season !== 'winter';
      for (const mesh of ctx.tuftMeshes || []) {
        mesh.material = tuftMat;
        mesh.visible = showTufts;
      }

      // Пшеница зимой убрана — поле заметает снегом.
      const showWheat = state.season !== 'winter';
      for (const mesh of ctx.wheatMeshes || []) mesh.visible = showWheat;

      // Дороги и площадь зимой заснежены: меняем текстуру полотна.
      const roadTex = {
        spring: ctx.T?.dirt,
        summer: ctx.T?.dirt,
        autumn: ctx.T?.dirt,
        winter: ctx.T?.dirtWinter,
      }[state.season];
      const cobbleTex = state.season === 'winter' ? ctx.T?.cobbleWinter : ctx.T?.cobble;
      for (const mesh of ctx.roadMeshes || []) {
        const mat = mesh.material;
        if (!mat || !mat.map) continue;
        const want = mesh.name === 'plaza' ? cobbleTex : roadTex;
        if (!want || mat.map === want) continue;
        const t = want.clone();
        t.needsUpdate = true;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1, 1);
        mat.map = t;
        mat.needsUpdate = true;
      }

      // Цветы зимой не растут.
      const showFlowers = state.season !== 'winter';
      for (const f of ctx.flowerMeshes || []) f.visible = showFlowers;
    }

    // Небо и туман: окружение переписывает их по пресетам времени суток
    // каждый кадр, поэтому сезон задаёт тонировку, а не прямой цвет.
    if (ctx.env && typeof ctx.env.setSeasonTint === 'function') {
      ctx.env.setSeasonTint({ sky: s.sky, fog: s.fog, sun: s.sun });
    }

    // Снег: частицы в мире, а не наклейка.
    if (ctx.snow && typeof ctx.snow.setSeason === 'function') {
      ctx.snow.setSeason(state.season);
    }

    // Снежный покров на земле — белая плёнка над травой и дорогами.
    if (ctx.snow && typeof ctx.snow.setCoverSeason === 'function') {
      ctx.snow.setCoverSeason(state.season);
    }

    // уведомить подписчиков
    for (const fn of seasonListeners) {
      try { fn(state.season, s); } catch (e) { /* подписчик не должен ронять календарь */ }
    }
  }

  /**
   * Начать новый день.
   *
   * @returns {object} состояние после смены
   */
  function nextDay() {
    const total = DAYS_PER_SEASON * SEASON_ORDER.length;
    state.day++;
    if (state.day > total) {
      state.day = 1;
      state.year++;
    }
    recompute();
    for (const fn of dayListeners) {
      try { fn(state.day, state.season, state.year); } catch (e) { /* ditto */ }
    }
    return state;
  }

  /**
   * Восстановить состояние из сохранения.
   *
   * @param {number} day
   * @param {string} season
   * @param {number} year
   */
  function restore(day, season, year) {
    if (typeof day === 'number' && day >= 1) state.day = Math.floor(day);
    if (typeof year === 'number' && year >= 1) state.year = Math.floor(year);
    recompute();
    // сезон из сохранения важнее расчётного: если формат календаря изменится,
    // сохранение должно выиграть
    if (season && SEASONS[season]) {
      state.season = season;
      state.seasonIndex = SEASON_ORDER.indexOf(season);
      applyLook();
    }
  }

  /**
   * Подписаться на смену дня.
   *
   * @param {Function} fn (day, season, year)
   */
  function onNewDay(fn) {
    if (typeof fn === 'function') dayListeners.push(fn);
  }

  /**
   * Подписаться на смену сезона.
   *
   * @param {Function} fn (seasonId, seasonInfo)
   */
  function onNewSeason(fn) {
    if (typeof fn === 'function') seasonListeners.push(fn);
  }

  /** Человеческое название сезона. */
  function seasonName() {
    return SEASONS[state.season].name;
  }

  /** «День 7, осень» — для подсказки в углу. */
  function label() {
    return `День ${state.day}, ${seasonName().toLowerCase()}`;
  }

  recompute();

  return {
    state,
    get day() { return state.day; },
    get year() { return state.year; },
    get season() { return state.season; },
    get seasonIndex() { return state.seasonIndex; },
    get info() { return SEASONS[state.season]; },
    nextDay,
    restore,
    onNewDay,
    onNewSeason,
    seasonName,
    label,
    applyLook,
  };
}
