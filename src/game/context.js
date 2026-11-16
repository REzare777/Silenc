/**
 * ============================================================================
 *  Контекст игры (GameContext)
 * ============================================================================
 *
 *  Что это такое
 *  --------------
 *  Единственный объект, который видят все системы игры. Вместо того чтобы
 *  держать десятки «глобальных переменных» в `main.js`, каждая система
 *  получает контекст и берёт из него нужное: сцену, материалы, игрока,
 *  реестр взаимодействий и так далее.
 *
 *  Такой подход даёт три вещи:
 *
 *   1. **Понятность.** Видно, откуда взялась зависимость: `ctx.player`,
 *      `ctx.M`, `ctx.systems.fishing`.
 *   2. **Тестируемость.** Систему можно создать с подставными зависимостями,
 *      не поднимая всю игру.
 *   3. **Отсутствие «невидимых» связей.** Никаких файлов, которые молча
 *      меняют чужие переменные через импорт.
 *
 *  Правило: `ctx.systems.*` заполняется при сборке игры (в `main.js`).
 *  Обращения к системам из обработчиков событий безопасны — к моменту
 *  нажатия клавиши все системы уже созданы.
 *
 *  @module game/context
 */

/**
 * Создаёт пустой контекст. Все поля заполняются по мере сборки игры.
 *
 * @returns {object} контекст игры
 */
export function createContext() {
  return {
    /* ---------------- Three.js ---------------- */
    scene: null,             // THREE.Scene — главная сцена деревни
    camera: null,            // THREE.PerspectiveCamera — камера игрока
    renderer: null,          // THREE.WebGLRenderer
    composer: null,          // EffectComposer — пост-обработка
    renderPass: null,        // RenderPass — какую сцену рендерим (меняется при смене локации)
    bloom: null,             // SoftBloomPass — мягкое свечение
    gradePass: null,         // ShaderPass — виньетка, зерно, тёплый тон

    /* ---------------- Ресурсы ---------------- */
    T: null,                 // текстуры (buildTextures)
    M: null,                 // материалы (buildMaterials)
    glowTex: null,           // текстура мягкого ореола

    /* ---------------- Системы ---------------- */
    ui: null,                // интерфейс: HUD, меню, инвентарь
    ambience: null,          // звуковая среда (WebAudio)
    env: null,               // окружение: солнце, небо, погода, время суток
    player: null,            // игрок (Player)
    nav: null,               // сетка поиска пути для пса (NavGrid)
    inventory: null,         // инвентарь (Inventory)

    /* ---------------- Геометрия мира ---------------- */
    colliders: { boxes: [], circles: [] },  // препятствия для игрока
    platforms: [],           // поверхности, на которые можно встать (крыльца, настилы)
    animalCircles: [],       // движущиеся препятствия (животные)
    critters: { hens: [], sheep: [], ducks: [], dog: null, cat: null },
    interactables: [],       // реестр действий по клавише E
    animated: [],            // функции анимации: (время) => void
    smokeSources: [],        // дым из труб
    lanterns: [],            // фонари (уличные и внутренние)
    roomLights: [],          // источники света из окон

    /* ---------------- Прочее ---------------- */
    rng: null,               // генератор случайных чисел (mulberry) — мир всегда одинаковый

    /* ---------------- Слоты систем ---------------- */
    // Заполняются в `main.js` после создания систем.
    systems: {
      fishing: null,         // рыбалка: заброс, ловля
      locations: null,       // переключение локаций: деревня / амбар / таверна
      interactions: null,    // реестр действий по клавише E
      animals: null,         // животные: появление и поведение
    },
  };
}

/**
 * Проверяет, что контекст заполнен и игра готова к запуску.
 *
 * Вызывается один раз после сборки мира. Нужен, чтобы ошибка порядка
 * инициализации («поле не заполнили вовремя») выглядела понятным
 * сообщением, а не как `undefined is not a function` где-то в игровом цикле.
 *
 * @param {object} ctx контекст игры
 * @returns {string[]} список недостающих полей (пустой массив — всё на месте)
 */
export function assertContextReady(ctx) {
  const missing = [];
  const need = (cond, name) => { if (!cond) missing.push(name); };

  need(ctx.scene, 'scene');
  need(ctx.camera, 'camera');
  need(ctx.renderer, 'renderer');
  need(ctx.composer, 'composer');
  need(ctx.renderPass, 'renderPass');
  need(ctx.M, 'M (материалы)');
  need(ctx.T, 'T (текстуры)');
  need(ctx.player, 'player');
  need(ctx.nav, 'nav (сетка проходимости)');
  need(ctx.inventory, 'inventory');
  need(ctx.rng, 'rng (генератор случайных чисел)');
  need(ctx.doors && ctx.doors.tavern, 'doors.tavern (дверь таверны)');
  need(ctx.doors && ctx.doors.barnExit, 'doors.barnExit (выход из амбара)');
  need(ctx.systems.interactions, 'systems.interactions');
  need(ctx.systems.fishing, 'systems.fishing');
  need(ctx.systems.locations, 'systems.locations');
  need(ctx.systems.animals, 'systems.animals');

  if (missing.length) {
    const err = new Error(`Контекст игры не собран: не хватает — ${missing.join(', ')}`);
    err.code = 'WV_CONTEXT_INCOMPLETE';
    throw err;
  }
  return missing;
}
