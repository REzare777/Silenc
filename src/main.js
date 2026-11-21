/**
 * ============================================================================
 *  Шёпот-Долина — прогулка по средневековой деревне
 * ============================================================================
 *
 *  Этот файл — **точка входа и сборка**. Здесь нет деталей мира: он только
 *  создаёт рендер, поднимает системы и запускает игровой цикл.
 *
 *  Карта проекта
 *  -------------
 *  ```
 *  src/
 *    main.js              ← вы находитесь здесь: сборка и игровой цикл
 *    player.js            игрок: движение, прыжок, лестницы, камера
 *    ui.js                интерфейс: HUD, меню настроек, инвентарь
 *    audio.js             звуковая среда (WebAudio)
 *    nav.js               сетка проходимости и поиск пути (A*)
 *    inventory.js         модель инвентаря
 *    fishview.js          просмотр пойманной рыбы в 3D
 *    game/
 *      context.js         общий контекст игры (GameContext)
 *      terrain.js         земля, дороги, пруд и причал
 *      village.js         здания и уличные пропсы
 *      animals.js         куры, овцы, утки, пёс и кот
 *      fishing.js         удочки, заброс и мини-игра ловли
 *      locations.js       переходы: улица / амбар / таверна
 *      interactions.js    реестр действий по клавише E
 *      bag.js             открытие и закрытие инвентаря
 *      settings.js        качество, свечение, громкость
 *      debug.js           визуализация границ столкновений (клавиша C)
 *    world/
 *      textures.js        процедурные текстуры
 *      materials.js       материалы
 *      buildings.js       дома, таверна, церковь, амбар, мельница, кузня
 *      props.js           деревья, трава, заборы, фонари, удочки
 *      animals.js         модели животных и их анимация
 *      barn.js            интерьер амбара
 *      tavern.js          интерьер таверны
 *      fish.js            каталог рыб
 *      environment.js     небо, солнце, погода, время суток
 *      particles.js       дым, угли, светлячки, пылинки, листья
 *      bloom.js           мягкое свечение
 *  ```
 *
 *  Управление: WASD — ходьба, мышь — обзор, Shift — бег, Space — прыжок,
 *  E — взаимодействие, I — инвентарь, Esc или O — настройки, T — время
 *  суток, P — фото-режим, C — границы столкновений.
 *
 *  @module main
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SoftBloomPass } from './world/bloom.js';
import { buildTextures } from './world/textures.js';
import { buildMaterials } from './world/materials.js';
import { glowTexture, mulberry } from './world/props.js';
import { Environment } from './world/environment.js';
import { Fireflies, Smoke, Motes, Leaves } from './world/particles.js';
import { Player, CinematicCam } from './player.js';
import { Ambience } from './audio.js';
import { UI } from './ui.js';
import { NavGrid } from './nav.js';
import { FISH, fishModel } from './world/fish.js';

import { createContext, assertContextReady } from './game/context.js';
import { buildTerrain } from './game/terrain.js';
import { createVillage } from './game/village.js';
import { setForestRange } from './world/forest.js';
import { fishById } from './world/fish.js';
import { createSnow } from './world/snow.js';
import { createCalendar } from './game/calendar.js';
import { snapshot, applySnapshot, writeSave, readSave, hasSave, clearSave } from './game/save.js';
import { createAnimalsSystem } from './game/animals.js';
import { createFishingSystem } from './game/fishing.js';
import { createLocations } from './game/locations.js';
import { createCombat, COMBAT } from './game/combat.js';
import { createShadows } from './game/shadows.js';
import { createDialog } from './game/dialog.js';
import { createInteractions } from './game/interactions.js';
import { createBag } from './game/bag.js';
import { PlayerStats } from './game/stats.js';
import { ViewModel } from './game/viewmodel.js';
import { bindSettings, loadVolume } from './game/settings.js';
import { createColliderDebug } from './game/debug.js';

/* ================================================================== *
 *  Проверка поддержки WebGL
 * ================================================================== */

/**
 * Поддерживает ли браузер WebGL.
 *
 * @returns {boolean} true, если WebGL доступен
 */
function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

if (!webglSupported()) {
  const load = document.getElementById('load');
  const begin = document.getElementById('begin');
  if (load) load.textContent = 'нужна поддержка WebGL — включите аппаратное ускорение в браузере';
  if (begin) { begin.disabled = true; begin.style.opacity = '0.45'; begin.style.cursor = 'not-allowed'; }
  throw new Error('WebGL не поддерживается');
}

window.__villageBooted = true;

/* ================================================================== *
 *  Рендер
 * ================================================================== */

// antialias у контекста тут бесполезен: сцена рисуется в буфер композитора,
// а не в кадровый буфер окна. Лишняя память и лишнее разрешение — вонь.
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

/* --------------------- адаптивное разрешение --------------------- *
 *
 * Если кадры идут тяжело (старый ноутбук, слабая видеокарта), картинка
 * становится мягче, но игра идёт ровно. На программном рендере
 * (SwiftShader в автотестах) авто-деградация выключена — иначе скриншоты
 * «плыли» бы от кадра к кадру.
 */
const basePixelRatio = { v: Math.min(devicePixelRatio, 1.5) };
const adaptive = { scale: 1, fps: 60, timer: 0 };

/** Определяем программный рендер (в нём FPS всегда низкий). */
function isSoftwareGL() {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '').toLowerCase();
    const soft = ['swift', 'llvmpipe', 'software', 'basic render'];
    return soft.some((k) => name.includes(k));
  } catch (e) { return false; }
}
const softwareGL = isSoftwareGL();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 620);
camera.position.set(0, 3, 26);

const ui = new UI();
const ambience = new Ambience();

/* --------------------- пост-обработка --------------------- */

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new SoftBloomPass(innerWidth, innerHeight, 0.62, 0.78);
composer.addPass(bloom);

/** Финальный «цветокор»: виньетка, лёгкое зерно и тёплый оттенок. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.62 },
    uGrain: { value: 0.012 },
    uResolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
    uWarm: { value: 0.055 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uWarm;
    uniform vec2 uResolution; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5);
      float v = 1.0 - dot(uv, uv) * uVignette;
      c.rgb *= clamp(v, 0.0, 1.0);
      c.rgb *= vec3(1.0 + uWarm, 1.0, 1.0 - uWarm * 0.7);
      float g = fract(sin(dot(vUv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * uGrain;
      gl_FragColor = c;
    }`,
};

const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());

/**
 * Применить разрешение рендера: базовое из настроек × адаптивный коэффициент.
 *
 * @param {number} [pr] базовое соотношение пикселей
 */
function applyPixelRatio(pr) {
  if (pr !== undefined) basePixelRatio.v = pr;
  const ratio = Math.max(0.5, basePixelRatio.v * adaptive.scale);
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  composer.setSize(innerWidth, innerHeight);
}
applyPixelRatio();

/* ================================================================== *
 *  Ресурсы
 * ================================================================== */

const T = buildTextures();
const M = buildMaterials(T);
const glowTex = glowTexture();
const env = new Environment(scene, renderer);

/* ================================================================== *
 *  Контекст игры
 * ================================================================== */

const ctx = createContext();
ctx.scene = scene;
ctx.camera = camera;
ctx.renderer = renderer;
ctx.composer = composer;
ctx.renderPass = renderPass;
ctx.bloom = bloom;
ctx.gradePass = gradePass;
ctx.T = T;
ctx.M = M;
ctx.glowTex = glowTex;
ctx.ui = ui;
ctx.ambience = ambience;
ctx.env = env;
ctx.rng = mulberry(20261107);
/** Настройки графики меняют базовое разрешение через эту функцию. */
ctx.setBasePixelRatio = (pr) => applyPixelRatio(pr);

/** Режим игры: 'play' | 'menu' | 'inv' | 'dog' | 'aim'. */
ctx.mode = 'play';

/** Двери и выходы, которые заполняются при сборке мира. */
ctx.doors = { barnExit: { x: -40, z: -8, ry: 0 }, tavern: null, tavernRy: 0 };

/** Мельница: полный объект, лопасти и вращающаяся шапка. */
ctx.mill = { ref: null, blades: null, cap: null, landingGeom: null };
ctx.campfirePos = { x: 0, z: 0 };

/** Кострёный огонь: всплеск жара после «подбросить дрова». */
ctx.fireBoost = 0;

/** Система частиц углей костра. */
ctx.emberSys = null;

/* ================================================================== *
 *  Игрок
 * ================================================================== */

const player = new Player(camera, renderer.domElement);
ctx.player = player;
player.onStep = (run) => ambience.step(run);
player.onJump = () => ambience.jump();
player.onLand = () => ambience.land();

/* ================================================================== *
 *  Характеристики игрока и модель «в руках»
 * ================================================================== */

/** Жизнь, силы, мана и монеты. */
const stats = new PlayerStats();
ctx.stats = stats;
player.stats = stats;
stats.onChange = () => {
  ui.setVitals(stats);
  ui.setCoins(stats.coins);
};

/** Руки и предмет перед камерой (рисуются поверх игрового кадра). */
const viewmodel = new ViewModel();
ctx.viewmodel = viewmodel;
ui.stats = stats;
viewmodel.resize(innerWidth, innerHeight);
ui.setVitals(stats);
ui.setCoins(stats.coins);

const cine = new CinematicCam(camera);
cine.active = true;

const clock = new THREE.Clock();
let clockAccum = 0;
let started = false;     // игрок нажал «Начать»
let photo = false;       // фото-режим

/* ================================================================== *
 *  Системы
 * ================================================================== */

ctx.systems.interactions = createInteractions(ctx);
ctx.systems.fishing = createFishingSystem(ctx);
ctx.systems.bag = createBag(ctx);

const village = createVillage(ctx);
const animals = createAnimalsSystem(ctx);
ctx.systems.animals = animals;

// псу нужен способ закрыть инвентарь, если он открыт
animals.setInventoryCloser(ctx.systems.bag.close);

/* ================================================================== *
 *  Сборка мира
 * ================================================================== */

// земля, дороги, пруд с причалом и удочками
buildTerrain(ctx);

// здания и уличные пропсы
/** Положение костра — берём из контекста, а не из константы: костёр переезжает. */
const firePos = new THREE.Vector3(0, 0, 0);

village.buildBuildings();
village.buildProps();
village.buildFarm();          // пастбище для овец и курятник
village.buildWoodcuttersYard();   // лесная делянка на опушке: избушка и поленница
village.buildBarnClearing();      // вырубка у амбара: пеньки и срубленные стволы
village.buildNoticeBoard();   // доска у дороги к скале
firePos.set(ctx.campfirePos.x, 0, ctx.campfirePos.z);   // костёр «за город»
village.buildDungeonGate();      // вход в подземелье — примерно в 100 м от села

// сетка проходимости — для пса (и других, кто ходит по карте)
const nav = new NavGrid({ minX: -78, minZ: -78, size: 168, cell: 1.0, radius: 0.42 });
for (const b of ctx.colliders.boxes) nav.addBox(b.cx, b.cz, b.hx, b.hz, b.ang || 0);
for (const c of ctx.colliders.circles) {
  if (c.soft) continue;                 // по воде не ходим
  if (c.r < 0.25) continue;              // мелочь не мешает
  nav.addCircle(c.x, c.z, c.r);
}
ctx.nav = nav;

// животные
animals.build();

// амбар и таверна — отдельные сцены
ctx.systems.dialog = createDialog(ctx);
ctx.systems.locations = createLocations(ctx);

// боёвка: факел в руке и тени в подземелье
ctx.systems.combat = createCombat(ctx);
ctx.systems.shadows = createShadows(ctx);
const combat = ctx.systems.combat;
const shadows = ctx.systems.shadows;

// Огонь — единственный источник света, топлива и лечения.
// Жаровни в пещере, костёр за селом, очаг в таверне.
combat.addFirePoint(-5.6, -17.2, 2.4, 4, 5);    // жаровня у входа
combat.addFirePoint(5.6, -4.5, 2.4, 4, 5);      // жаровня в кристальном зале
combat.addFirePoint(-5.6, 20.5, 2.4, 4, 5);     // жаровня на пути к Вратам
combat.addFirePoint(ctx.campfirePos.x, ctx.campfirePos.z, 3.2, 8, 5);   // костёр
combat.addFirePoint(-6.5, 0, 2.5, 4, 4);        // очаг в таверне

// контекст собран — проверяем, что ничего не забыто
assertContextReady(ctx);

// Коллекция пойманных пород и флаги сюжета — часть сохранения.
ctx.caught = ctx.caught || {};
ctx.flags = ctx.flags || {};

// Системы получают доступ к сохранению через контекст: так локации
// (например, переночевание в трактире) могут сохранить игру сами.
ctx.saveGame = (quiet) => saveGame(quiet !== false);
ctx.itemById = (id) => fishById(id);

// Если есть сохранение — показываем «Продолжить» на титульном экране.
{
  const data = readSave();
  if (data && data.day) {
    ui.setContinue(true, data.day);
    ui.setDate(`День ${data.day}, ${(data.season || 'spring') === 'spring' ? 'весна'
      : (data.season === 'summer' ? 'лето' : (data.season === 'autumn' ? 'осень' : 'зима'))}`);
  }
}

player.setColliders(ctx.colliders.boxes, ctx.colliders.circles);
player.dynamicCircles = ctx.animalCircles;
player.setPlatforms(ctx.platforms);
player.teleport(0, 16, 0);

/* --------------------- частицы --------------------- */

const smoke = new Smoke(scene, glowTex, ctx.smokeSources.map((s) => ({ pos: s.pos, rate: s.rate })));
const fireflies = new Fireflies(scene, glowTex, 140, 110);
const motes = new Motes(scene, glowTex, 240, 18);
const leaves = new Leaves(scene, 40, 80);

// Календарь: дни и сезоны. Сезон меняет облик долины — траву, листву,
// небо и снег. Снег — частицы, живущие в мире, а не наклейка.
const snow = createSnow(ctx);
scene.add(snow.points);
scene.add(snow.cover);       // снежный покров поверх земли
ctx.snow = snow;
ctx.calendar = createCalendar(ctx);
// календарь должен знать о снеге раньше, чем первый applyLook
ctx.calendar.applyLook();

/* --------------------- пул огней --------------------- */
// внутренние источники (окна домов) — светят изнутри, когда игрок рядом
const LIGHT_POOL = 8;                 // фиксированное число источников — шейдеры не перекомпилируются
const lightPool = [];
for (let i = 0; i < LIGHT_POOL; i++) {
  const l = new THREE.PointLight(0xffc07a, 0, 14, 2);
  // Источник остаётся в сцене всегда (интенсивность 0 у неиспользуемых):
  // так число точечных источников не меняется и шейдеры не пересобираются.
  scene.add(l);
  lightPool.push(l);
}

/* ================================================================== *
 *  Меню настроек
 * ================================================================== */

/**
 * Открыть окно настроек (Esc или O).
 */
function openMenu() {
  ctx.mode = 'menu';
  ui.openMenu();
  player.acceptInput = false;
  player.enabled = false;
  player.keys.clear();
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
}

/**
 * Сохранить игру.
 *
 * @param {boolean} quiet не показывать подтверждение
 * @returns {boolean} true, если сохранение записалось
 */
function saveGame(quiet = false) {
  const ok = writeSave(snapshot(ctx));
  if (!quiet && ctx.ui) {
    ctx.ui.toast(ok ? 'Игра сохранена.' : 'Не удалось сохранить игру.', ok ? 2200 : 3600);
  }
  return ok;
}

/**
 * Автосохранение — пишем тихо, без сообщения.
 *
 * @returns {boolean}
 */
function autosave() {
  return writeSave(snapshot(ctx));
}

/**
 * Загрузить сохранение и применить его к игре.
 *
 * @returns {boolean} true, если сохранение было и применено
 */
function loadGame() {
  const data = readSave();
  if (!data) return false;
  applySnapshot(ctx, data);
  if (ctx.ui) {
    ctx.ui.setDate(ctx.calendar ? ctx.calendar.label() : '');
    ctx.ui.renderInventory(ctx.inventory);
  }
  return true;
}

/**
 * Закрыть окно настроек и вернуться к игре.
 */
function resumeGame() {
  ui.closeMenu();
  ctx.mode = 'play';
  player.enabled = true;
  player.acceptInput = true;
  player.keys.clear();
  player.requestLock();
}

/* ================================================================== *
 *  Интерфейс
 * ================================================================== */

const bag = ctx.systems.bag;
const interactions = ctx.systems.interactions;
const fishing = ctx.systems.fishing;
const locations = ctx.systems.locations;
const colliderDebug = createColliderDebug(ctx);

bindSettings(ctx);
loadVolume(ctx);

ui.onStart = () => {
  started = true;
  ui.hideStart();
  ui.renderInventory(bag.inventory);
  ambience.start();
  ambience.setVolume(loadVolume(ctx));
  ambience.setMuted(!ui.el.tSound.classList.contains('on'));
  cine.active = false;
  player.enabled = true;
  player.requestLock();
  setTimeout(() => {
    if (!document.pointerLockElement) {
      ui.toast('Захват мыши недоступен — осматривайтесь, зажав левую кнопку.', 5200);
    } else {
      ui.toast('Добро пожаловать в долину. Идите, куда зовёт сердце.', 3800);
    }
  }, 900);
};

ui.onResume = () => resumeGame();
ui.onSave = () => saveGame();
// «Продолжить» на титульном экране: грузим сохранение и сразу входим в игру
ui.onContinue = () => {
  const ok = loadGame();
  if (!ok) {
    ui.toast('Сохранение не найдено или повреждено.', 3200);
    return;
  }
  started = true;
  ui.hideStart();
  ui.renderInventory(bag.inventory);
  ambience.start();
  ambience.setVolume(loadVolume(ctx));
  ambience.setMuted(!ui.el.tSound.classList.contains('on'));
  cine.active = false;
  player.enabled = true;
  player.requestLock();
  ui.toast(`С возвращением. ${ctx.calendar.label()}.`, 3200);
};

/* ================================================================== *
 *  Ввод
 * ================================================================== */

window.addEventListener('keydown', (e) => {
  if (!started) return;

  if (ctx.mode === 'dog') {
    if (e.code === 'Escape' || e.code === 'KeyE') { e.preventDefault(); animals.closeDogMenu(); }
    return;
  }

  if (ctx.mode === 'note') {
    // в окне записи печатаем текст: Esc — закрыть, Enter — записать
    if (e.code === 'Escape') { e.preventDefault(); ctx.ui.closeNote(); ctx.mode = 'play'; player.acceptInput = true; }
    else if (e.code === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const v = ui.el.noteInput.value.trim();
      ui.closeNote();
      ctx.mode = 'play';
      player.acceptInput = true;
      if (ctx.onNoteSubmit) ctx.onNoteSubmit(v);
    }
    return;
  }

  if (ctx.mode === 'dialog') {
    // в диалоге работает только Esc — закрыть разговор
    if (e.code === 'Escape') { e.preventDefault(); ctx.systems.dialog.close(); }
    return;
  }

  if (ctx.mode === 'aim') {
    if (e.code === 'Escape') {
      e.preventDefault();
      ctx.mode = 'play';
      player.acceptInput = true;
      player.lookOnly = false;
      player.requestLock();
    }
    return;
  }

  if (ctx.mode === 'inv') {
    // в инвентаре работают только его клавиши: выход — Esc или та же I, что открыла
    if (e.code === 'Escape' || e.code === 'KeyI') { e.preventDefault(); bag.close(); }
    else if (e.code.startsWith('Digit')) {
      const n = +e.code.slice(5);
      if (n >= 1 && n <= 9) {
        bag.inventory.sel = n - 1;
        ui.renderInventory(bag.inventory);
        ui.toast(`Слот пояса: ${n}`, 900);
      }
    }
    return;
  }

  if (e.code === 'KeyT') {
    env.cycle();
    ui.setTime(env.target);
  } else if (e.code === 'KeyO') {
    if (ctx.mode === 'menu') resumeGame(); else openMenu();
  } else if (e.code === 'KeyC') {
    colliderDebug.toggle();
  } else if (e.code === 'Escape') {
    if (ctx.mode === 'menu') resumeGame(); else openMenu();
  } else if (e.code === 'KeyP') {
    photo = !photo;
    ui.photoMode(photo);
  } else if (e.code === 'KeyM') {
    ui.toggleSound();
  } else if (e.code === 'KeyQ') {
    // убрать предмет из рук
    if (viewmodel.visible) {
      viewmodel.hideHands();
      ui.toast('Убрано в сумку.', 1400);
    }
  } else if (e.code === 'KeyF') {
    // потушить или разжечь факел
    if (ctx.mode === 'play') {
      const msg = combat.toggleTorch();
      if (msg) ui.toast(msg, 1800);
    }
  } else if (e.code === 'KeyE') {
    if (ctx.mode === 'play') {
      if (fishing.session.state === 'bite') fishing.hookFish();
      else {
        const spot = fishing.aimedCastSpot();
        if (spot) fishing.startFishing(spot);
        else interactions.doInteract();
      }
    }
  } else if (e.code === 'KeyI') {
    bag.toggle();
  } else if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 9) {
      bag.inventory.sel = n - 1;
      ui.renderInventory(bag.inventory);
    }
  }
});

document.addEventListener('pointerlockchange', () => {
  if (!started) return;
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    // в режиме прицела («иди туда») управление остаётся выключенным
    if (ctx.mode === 'aim') {
      player.acceptInput = false;
      player.lookOnly = true;
      player.keys.clear();
      return;
    }
    ctx.mode = 'play';
    ui.closeMenu();
    player.enabled = true;
    player.acceptInput = true;
    player.keys.clear();
    return;
  }
  player.acceptInput = false;
  player.keys.clear();
  if (ctx.mode === 'play') openMenu();   // Esc или потеря захвата — окно настроек
});

/* ================================================================== *
 *  Бой: ЛКМ — удар брандом, ПКМ — вспышка
 *
 *  Клик отличается от перетаскивания: короткое нажатие без сдвига.
 *  Перетаскивание мышью остаётся осмотром (fallback без захвата).
 * ================================================================== */

let mouseDownAt = 0;
let mouseDownX = 0;
let mouseDownY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!started || ctx.mode !== 'play') return;
  mouseDownAt = performance.now();
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
});

renderer.domElement.addEventListener('mouseup', (e) => {
  if (!started || ctx.mode !== 'play') return;
  const dt = performance.now() - mouseDownAt;
  const moved = Math.hypot(e.clientX - mouseDownX, e.clientY - mouseDownY);
  const locked = document.pointerLockElement === renderer.domElement;
  // при захваченной мыши считаем кликом любое нажатие; без захвата —
  // только короткое нажатие без сдвига, иначе это осмотр перетаскиванием
  if (!locked && (dt > 250 || moved > 8)) return;
  if (e.button === 0) combat.strike();
  else if (e.button === 2) combat.flare();
});

renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

renderer.domElement.addEventListener('click', () => {
  if (ctx.mode === 'aim') {
    const hit = animals.pickGroundPoint();
    const d = ctx.critters.dog;
    if (hit && d) {
      d.target = { x: hit.x, z: hit.z };
      d.mode = 'goto';
      d.cmd = 'Идёт к выбранному месту';
      ui.toast('Пёс бежит туда. Ладно, не бежит — шагает. Но решительно.', 3000);
    }
    ctx.mode = 'play';
    player.acceptInput = true;
    player.lookOnly = false;
    player.requestLock();
    return;
  }
  if (started && ctx.mode === 'play' && !document.pointerLockElement) player.requestLock();
});

/* ================================================================== *
 *  Тач-управление (мобильные)
 * ================================================================== */

if ('ontouchstart' in window) {
  document.body.classList.add('touch');
  const stick = document.getElementById('stick');
  const nub = document.getElementById('nub');
  const look = document.getElementById('look');
  let stickId = null, lookId = null, lx = 0, ly = 0;

  stick.addEventListener('touchstart', (e) => {
    stickId = e.changedTouches[0].identifier;
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const r = stick.getBoundingClientRect();
        const dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.min(1, Math.hypot(dx, dy));
        const a = Math.atan2(dy, dx);
        player.touchMove.x = Math.cos(a) * l;
        player.touchMove.y = Math.sin(a) * l;
        nub.style.transform = `translate(${Math.cos(a) * l * 36}px, ${Math.sin(a) * l * 36}px)`;
      } else if (t.identifier === lookId) {
        player.yaw -= (t.clientX - lx) * 0.005 * player.sensitivity;
        player.pitch -= (t.clientY - ly) * 0.005 * player.sensitivity;
        player.pitch = Math.max(-1.35, Math.min(1.25, player.pitch));
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null; player.touchMove.x = 0; player.touchMove.y = 0;
        nub.style.transform = '';
      }
      if (t.identifier === lookId) lookId = null;
    }
  });

  look.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    lookId = t.identifier; lx = t.clientX; ly = t.clientY;
  });
}

/* ================================================================== *
 *  Игровой цикл
 * ================================================================== */

const forgePos = new THREE.Vector3(14.5, 0, -8);
/** Таймер обновления дальности леса. */
let forestRangeTimer = 0;
/** Накопитель автосохранения (секунды). */
let autosaveAccum = 0;

function loop() {
  requestAnimationFrame(loop);
  if (window.__stop) return;
  const raw = clock.getDelta();
  const dt = Math.min(0.09, raw);
  const dtEnv = Math.min(0.3, raw);
  const t = clock.elapsedTime;

  for (const fn of ctx.animated) fn(t, dt);
  // крылья крутятся на ступице, приваренной к шапке (шапка стоит на башне неподвижно:
  // иначе крылья задевают за настил смотровой площадки)
  if (ctx.mill.blades) ctx.mill.blades.rotation.z += dt * 0.42;
  ctx.fireBoost = Math.max(0, ctx.fireBoost - dt);

  const focus = started ? player.pos : new THREE.Vector3(0, 0, 0);
  env.update(dtEnv, focus);
  gradePass.uniforms.uTime.value = t;

  // Новый день начинается, когда ночь естественно сменилась утром.
  // Флаг ставит окружение: ручная смена времени суток (клавиша T)
  // новым днём не считается.
  if (env.rolledOver) {
    env.rolledOver = false;
    if (started) {
      ctx.calendar.nextDay();
      ui.setDate(ctx.calendar.label());
      ctx.ui.toast(`${ctx.calendar.info.note}`, 4200);
      autosave();
    }
  }

  // часы: текущий период и время до следующего (обновляем раз в полсекунды)
  clockAccum += dtEnv;
  if (clockAccum > 0.5) {
    clockAccum = 0;
    ui.setClock(env.current, env.periodSeconds - env.phaseTime);
  }

  const nightAmt = THREE.MathUtils.clamp((env.stars - 0.05) * 1.4, 0, 1);
  fireflies.update(dt, nightAmt);
  // снег идёт только на улице: в подземелье и в интерьерах его нет
  snow.update(dt, focus, ctx.loc === 'village');
  snow.updateCover(dt);
  smoke.update(dt);
  if (M.water.map) {                       // вода медленно колышется
    M.water.map.offset.x += dt * 0.007;
    M.water.map.offset.y += dt * 0.004;
  }
  motes.update(dt, player.pos);
  leaves.update(dt, t);
  if (ctx.emberSys) ctx.emberSys.update(dt);

  if (ctx.loc === 'village') animals.update(dt, t);
  else if (ctx.critters.dog) {
    // в амбаре пёс ждёт хозяина у ворот
    const dg = ctx.critters.dog;
    dg.t += dt;
    dg.g.userData.update(dt, dg.t, false, false);
  }
  if (ctx.loc === 'barn') {
    locations.barnLoc.update(dt, env, t);
    // «улица» за воротами: цвет берём из тумана основной локации
    const fc = env.scene && env.scene.fog ? env.scene.fog.color : null;
    if (fc) {
      if (!locations.sceneBarn.background) locations.sceneBarn.background = new THREE.Color();
      locations.sceneBarn.background.copy(fc).lerp(locations.WARM_OUT, 0.45).multiplyScalar(0.82);
      locations.sceneBarn.fog.color.copy(fc).lerp(locations.WARM_OUT, 0.3).multiplyScalar(0.5);
    }
  }
  if (ctx.loc === 'dungeon') {
    // подземелье: свой мрачный свет, свой туман, кристаллы пульсируют
    locations.dungeonLoc.update(dt, t, camera);
    locations.sceneDungeon.background.copy(locations.DUNGEON_BG);
  }
  if (ctx.loc === 'church') {
    // в храме свечи мерцают, а в лучах от витражей плывут пылинки
    locations.churchLoc.update(dt, t);
    locations.sceneChurch.background.copy(locations.CHURCH_BG);
  }
  if (ctx.loc === 'tavern') {
    // внутри таверны свет ПОСТОЯННЫЙ: своя палитра, не зависит от часов улицы
    locations.tavernLoc.update(dt, t);
    // бармен: ходит за стойкой, смотрит на игрока, ночью уходит домой
    locations.updateNpc(dt, t);
    locations.sceneTavern.background.copy(locations.TAVERN_BG);
    locations.sceneTavern.fog.color.setHex(0x241408);
  }

  // бой: факел горит, тратит топливо, светит; тени в подземелье
  if (ctx.loc === 'dungeon') {
    shadows.update(dt, t);
    combat.update(dt, t);
  } else {
    combat.update(dt, t);
  }
  // автосохранение раз в минуту реального времени — чтобы прогресс не пропал,
  // даже если игрок закрыл вкладку не по сюжету
  autosaveAccum += dt;
  if (autosaveAccum >= 60) {
    autosaveAccum = 0;
    if (started && ctx.loc === 'village') autosave();
  }
  ui.setCombat(ctx.loc === 'dungeon');
  if (ctx.loc === 'dungeon') {
    ui.setFire(combat.state.fuel, COMBAT.fuelMax);
    const aim = combat.aimTarget();
    ui.setVeil(aim ? aim.veil : 0, 3);
    ui.setReticle(!!aim, combat.state.strikeAnim > 0);
    ui.setThreat(ctx.shadowThreat || 0);
  } else {
    ui.setVeil(0, 3);
    ui.setReticle(false, false);
    ui.setThreat(0);
  }

  // Лес подрезается по расстоянию: за туманом он всё равно не виден,
  // а без этого рисуются все шестнадцать тысяч деревьев.
  forestRangeTimer -= dtEnv;
  if (forestRangeTimer <= 0) {
    forestRangeTimer = 0.4;
    if (ctx.loc === 'village' && ctx.forestChunks) setForestRange(ctx.forestChunks, player.pos, 185);
  }

  // Автоматически подстраиваем разрешение под реальную частоту кадров
  if (!softwareGL) {
    adaptive.fps = adaptive.fps * 0.93 + (1 / Math.max(0.001, raw)) * 0.07;
    adaptive.timer -= dtEnv;
    if (adaptive.timer <= 0) {
      adaptive.timer = 1.5;
      if (adaptive.fps < 42 && adaptive.scale > 0.6) {
        adaptive.scale = Math.max(0.6, adaptive.scale - 0.1);
        applyPixelRatio();
      } else if (adaptive.fps > 57 && adaptive.scale < 1) {
        adaptive.scale = Math.min(1, adaptive.scale + 0.05);
        applyPixelRatio();
      }
    }
  }

  const lampBoost = env.lampBoost ?? 0.75;
  M.windowLit.emissiveIntensity = 0.32 + lampBoost * 2.1;
  M.lampGlass.emissiveIntensity = 0.45 + lampBoost * 3.1;
  M.windowDark.emissiveIntensity = lampBoost * 0.2;
  for (const l of ctx.lanterns) {
    const f = 0.85 + Math.sin(t * 9 + l.flicker) * 0.07 + Math.sin(t * 23.3 + l.flicker) * 0.04;
    l.power = f;
    l.glow.material.opacity = l.lit ? 0.38 * f * (0.1 + lampBoost * 0.95) : 0;
  }
  // ближайшие фонари получают реальные источники света
  const near = ctx.lanterns
    .map((l) => ({ l, d: l.pos.distanceTo(focus) }))
    .concat(ctx.roomLights.map((l) => ({ l, d: l.pos.distanceTo(focus) })))
    .sort((a, b) => a.d - b.d);
  for (let i = 0; i < lightPool.length; i++) {
    const src = near[i];
    const l = lightPool[i];
    if (src && src.l.lit && src.d < 30) {
      l.position.copy(src.l.pos);
      l.distance = src.l.distance;
      l.intensity = src.l.baseIntensity * src.l.power * (0.12 + lampBoost * 0.95);
    } else {
      l.intensity = 0;
    }
  }
  bloom.strength = (env.bloomStrength ?? 0.62) * (bloom.enabled ? 1 : 0);

  if (!started) {
    cine.update(dt, new THREE.Vector3(0, 0, 0));
  } else {
    player.update(dt);
  }

  if (started && ctx.mode === 'play') {
    if (fishing.session.state === 'bite') {
      ui.setPrompt('Подсечь! Нажмите E');
    } else if (fishing.session.state === 'wait' || fishing.session.state === 'cast') {
      ui.setPrompt('Ждите поклёвки…');
    } else {
      const spot = fishing.aimedCastSpot();
      if (spot) {
        ui.setPrompt('закинуть удочку');
      } else if (combat.state.active && combat.prompt()) {
        ui.setPrompt(combat.prompt());
      } else {
        const it = interactions.nearest();
        const hint = player.climbHint();
        if (it) ui.setPrompt(it.labelFn ? it.labelFn() : it.label);
        else if (hint) ui.setPrompt(hint);
        else if (fishing.nearestCastSpot()) ui.setPrompt('Наведитесь на удочку, чтобы закинуть её');
        else ui.setPrompt('');
      }
    }
  } else {
    ui.setPrompt('');
  }
  ui.updateCompass(player.yaw);

  if (started) {
    ambience.update(dt, nightAmt, player.pos.distanceTo(forgePos), player.pos.distanceTo(firePos));
    if (ctx.mode === 'play') fishing.updateFishing(dt);   // в инвентаре и паузе ловля замирает
    stats.update(dt, { sprinting: player.sprinting });
    viewmodel.update(dt, camera, player);
  } else {
    viewmodel.update(dt, camera, player);
  }

  composer.render();
  viewmodel.render(renderer);
  window.__frames = (window.__frames || 0) + 1;
  if (!window.__villageReady) window.__villageReady = true;
  if (window.__grab) {
    const req = window.__grab;
    window.__grab = null;
    try { window.__frame = renderer.domElement.toDataURL('image/jpeg', 0.9); } catch (err) { window.__frame = ''; }
    if (req.resolve) req.resolve(true);
  }
}

/* ================================================================== *
 *  Ресайз
 * ================================================================== */

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
  gradePass.uniforms.uResolution.value.set(innerWidth, innerHeight);
  viewmodel.resize(innerWidth, innerHeight);
});

/* ================================================================== *
 *  Режим снимка (?pos=0,16&yaw=0&tod=golden)
 * ================================================================== */

/**
 * Включить режим снимка по параметрам в адресной строке.
 *
 * @returns {boolean} true, если режим включён
 */
function applyHashMode() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.has('pos') && !h.has('shot')) return false;
  const [px, pz] = (h.get('pos') || '0,16').split(',').map(Number);
  const yaw = Number(h.get('yaw') ?? 0);
  const tod = h.get('tod');
  started = true;
  ui.hideStart();
  ui.photoMode(true);
  cine.active = false;
  player.enabled = true;
  player.teleport(px, pz, yaw);
  if (tod) { env.setTimeOfDay(tod, true); ui.setTime(tod); }
  if (h.has('cam')) {
    const [cx, cy, cz] = h.get('cam').split(',').map(Number);
    player.enabled = false;
    camera.position.set(cx, cy, cz);
    // точка взгляда: по умолчанию — на уровне глаз, но её можно задать (look=x,y,z)
    let lx = px, ly = 1.6, lz = pz;
    if (h.has('look')) {
      const L = h.get('look').split(',').map(Number);
      lx = L[0]; ly = L[1]; lz = L[2];
    }
    camera.lookAt(lx, ly, lz);
    cine.active = false;
  }
  return true;
}

/* ================================================================== *
 *  Отладочный доступ (используется автотестами)
 * ================================================================== */

window.__dbg = {
  renderer, scene, camera, composer, bloom, env, player, M, T, THREE,
  ctx,
  EffectComposer, ShaderPass, RenderPass, OutputPass,
  colliders: ctx.colliders, platforms: ctx.platforms, animalCircles: ctx.animalCircles,
  nav, interactables: ctx.interactables, critters: ctx.critters,
  updateAnimals: animals.update, doInteract: interactions.doInteract,
  nearestInteractable: interactions.nearest, ui, ambience,
  inventory: bag.inventory, fishing: fishing.session,
  stats, viewmodel,
  /** Взять рыбу в руки (для проверок и отладки). */
  holdFish: (i = 0, opts = {}) => {
    const spec = FISH[((i % FISH.length) + FISH.length) % FISH.length];
    const model = fishModel(spec);
    if (!model) return null;
    viewmodel.hold(model, { grip: 'two', pose: 'present', scale: 0.16, life: 0, ...opts });
    return spec.name;
  },
  startFishing: fishing.startFishing, hookFish: fishing.hookFish,
  updateFishing: fishing.updateFishing, toggleInventory: bag.toggle,
  rollFish: fishing.rollFish, FISH,
  castSpots: fishing.castSpots, aimedCastSpot: fishing.aimedCastSpot,
  nearestCastSpot: fishing.nearestCastSpot, HOOK_CFG: fishing.HOOK_CFG,
  prepareHook: fishing.prepareHook,
  get mode() { return ctx.mode; },
  get mill() { return ctx.mill.ref; },
  get millBlades() { return ctx.mill.blades; },
  get millCap() { return ctx.mill.cap; },
  get loc() { return ctx.loc; },
  setLocation: locations.setLocation,
  barnLoc: locations.barnLoc, tavernLoc: locations.tavernLoc,
  dungeonLoc: locations.dungeonLoc, sceneDungeon: locations.sceneDungeon,
  churchLoc: locations.churchLoc, sceneChurch: locations.sceneChurch,
  homeLocs: locations.homeLocs,
  npcs: locations.npcs, updateNpc: locations.updateNpc,
  sceneTavern: locations.sceneTavern, dialog: ctx.systems.dialog,
  teleport: (x, z, yaw) => player.teleport(x, z, yaw),
  /** Сохранить игру (используется автотестами). */
  saveGame: (quiet) => saveGame(quiet !== false),
  /** Загрузить игру из сохранения. */
  loadGame: () => loadGame(),
  /** Есть ли сохранение. */
  hasSave: () => hasSave(),
  /** Удалить сохранение. */
  clearSave: () => clearSave(),
  /** Календарь: дни и сезоны. */
  calendar: ctx.calendar,
  /** Снег. */
  snow: ctx.snow,
};

/* ================================================================== *
 *  Старт
 * ================================================================== */

ui.setLoading('долина готова');
applyHashMode();
loop();
