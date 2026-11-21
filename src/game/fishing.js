/**
 * ============================================================================
 *  Рыбалка: удочки, заброс, мини-игра
 * ============================================================================
 *
 *  Как это работает
 *  ----------------
 *  1. В мире стоят две 3D-удочки (на пирсе и на берегу). Каждая
 *     регистрируется как **точка рыбалки** — отрезок «основание → кончик».
 *  2. Забросить можно **только наведясь на саму удочку**: луч из камеры должен
 *     попасть в этот отрезок (`aimedCastSpot`).
 *  3. Состояния ловли: `idle → cast → wait → bite → (catch | miss)`.
 *  4. В момент клёва открывается мини-игра: бегущая метка и узкая зона.
 *     Сколько раз нужно попасть и насколько зона узкая — зависит от редкости
 *     рыбы (`HOOK_CFG`). **Редкость заранее не показывается** — её узнают
 *     только после улова.
 *
 *  @module game/fishing
 */

import * as THREE from 'three';
import { FISH, rarityOf, fishModel } from '../world/fish.js';
import { makeStack } from '../inventory.js';
import { POND } from './terrain.js';

/**
 * Параметры мини-игмы по редкости.
 * Чем реже рыба, тем больше раз нужно успешно попасть в зону,
 * уже сама зона, быстрее метка и меньше времени на клёв.
 *
 * @type {Record<string, {speed: number, zone: number, need: number, time: number}>}
 */
export const HOOK_CFG = {
  common: { speed: 0.62, zone: 0.30, need: 1, time: 3.6 },
  rare: { speed: 0.88, zone: 0.21, need: 2, time: 3.0 },
  epic: { speed: 1.15, zone: 0.15, need: 3, time: 2.5 },
  legendary: { speed: 1.45, zone: 0.10, need: 4, time: 2.1 },
  mythic: { speed: 1.78, zone: 0.065, need: 5, time: 1.8 },
};

/**
 * Создаёт систему рыбалки.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система рыбалки
 */
export function createFishingSystem(ctx) {

  /* ---------------- состояние ловли ---------------- */
  const session = {
    state: 'idle',        // idle → cast → wait → bite → (catch | miss)
    t: 0,
    timer: 0,
    biteTime: 0,
    stage: 0,
    need: 1,
    mark: 0.5,
    markDir: 1,
    markSpeed: 0.8,
    zone: 0.3,
    zonePos: 0.5,
    fish: null,
    bobber: null,
    ripples: [],
    spot: new THREE.Vector3(),
    from: new THREE.Vector3(),
  };

  /* ---------------- точки рыбалки ---------------- */
  /** @type {{rod: THREE.Object3D, label: string, base: THREE.Vector3, tip: THREE.Vector3}[]} */
  const castSpots = [];

  // Временные векторы — чтобы не создавать их в каждом кадре.
  const _tmpAb = new THREE.Vector3();
  const _tmpTo = new THREE.Vector3();
  const _tmpClosest = new THREE.Vector3();
  const _tmpRel = new THREE.Vector3();
  const _aimOrg = new THREE.Vector3();
  const _aimDir = new THREE.Vector3();

  /**
   * Запомнить удочку как точку рыбалки: основание и кончик в мировых координатах.
   *
   * @param {THREE.Object3D} rod модель удочки
   * @param {string} label подпись для подсказки
   * @returns {object} зарегистрированная точка рыбалки
   */
  function registerCastSpot(rod, label) {
    rod.updateWorldMatrix(true, true);
    const base = new THREE.Vector3();
    rod.getWorldPosition(base);
    const tip = new THREE.Vector3();
    const tipObj = rod.userData.tip;
    if (tipObj) { tipObj.updateWorldMatrix(true, false); tipObj.getWorldPosition(tip); }
    else tip.copy(base).add(new THREE.Vector3(0, 2.4, 0));
    const spot = { rod, label, base, tip };
    castSpots.push(spot);
    return spot;
  }

  /**
   * Какая удочка под прицелом: луч из камеры должен попасть в саму удочку.
   *
   * @param {number} [maxDist] максимальная дистанция заброса
   * @param {number} [tol] допустимое отклонение луча от удочки
   * @returns {object|null} точка рыбалки или null
   */
  function aimedCastSpot(maxDist = 5.5, tol = 0.55) {
    if (!ctx.camera || !castSpots.length) return null;
    ctx.camera.getWorldPosition(_aimOrg);
    ctx.camera.getWorldDirection(_aimDir);
    let best = null, bestAlong = Infinity;
    for (const s of castSpots) {
      const ab = _tmpAb.copy(s.tip).sub(s.base);
      const len2 = ab.lengthSq();
      let t = len2 > 1e-6 ? _tmpTo.copy(_aimOrg).sub(s.base).dot(ab) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const closest = _tmpClosest.copy(s.base).addScaledVector(ab, t);
      const rel = _tmpRel.copy(closest).sub(_aimOrg);
      const along = rel.dot(_aimDir);
      if (along <= 0.15 || along > maxDist) continue;          // за спиной или слишком далеко
      const perp = rel.addScaledVector(_aimDir, -along).length();
      if (perp > tol) continue;                                // прицел не на удочке
      if (along < bestAlong) { bestAlong = along; best = s; }
    }
    return best;
  }

  /**
   * Ближайшая удочка, до которой можно дйти (для подсказки).
   *
   * @param {number} [maxDist] максимальная дистанция
   * @returns {object|null} точка рыбалки или null
   */
  function nearestCastSpot(maxDist = 7) {
    let best = null, bestD = Infinity;
    for (const s of castSpots) {
      const d = Math.hypot(ctx.player.pos.x - s.base.x, ctx.player.pos.z - s.base.z);
      if (d < maxDist && d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /* ---------------- поплавок и всплески ---------------- */

  /**
   * Поплавок: две половинки, палка и наконечник.
   *
   * @returns {THREE.Group} готовая модель поплавка
   */
  function makeBobber() {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), ctx.M.redCloth);
    top.position.y = 0.05;
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), ctx.M.plank);
    bot.position.y = -0.05;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 5), ctx.M.timber);
    stick.position.y = 0.26;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), ctx.M.redCloth);
    tip.position.y = 0.52;
    g.add(top, bot, stick, tip);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /**
   * Круг на воде — расходится от поплавка.
   *
   * @param {THREE.Vector3} pos центр всплеска
   */
  function spawnRipple(pos) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.07, pos.z);
    ctx.scene.add(m);
    session.ripples.push({ m, t: 0 });
  }

  /* ---------------- заброс и ловля ---------------- */

  /**
   * Заброс удочки.
   *
   * @param {object|null} spot точка рыбалки (или null — заброс от игрока)
   */
  function startFishing(spot) {
    if (session.state !== 'idle') return;
    const from = spot ? spot.tip.clone() : ctx.player.pos.clone();
    // заброс от удочки в сторону центра озера
    const toC = new THREE.Vector3(POND.x, 0, POND.z).sub(from);
    toC.y = 0;
    const dir = toC.lengthSq() > 0.04 ? toC.normalize() : new THREE.Vector3(0, 0, 1);
    const land = from.clone().addScaledVector(dir, 2.2 + Math.random() * 4.5);
    const cd = Math.hypot(land.x - POND.x, land.z - POND.z);
    const lim = POND.r - 1.4;
    if (cd > lim) { land.x = POND.x + (land.x - POND.x) / cd * lim; land.z = POND.z + (land.z - POND.z) / cd * lim; }
    session.spot.set(land.x, 0.05, land.z);
    session.from.copy(from);
    session.state = 'cast';
    session.t = 0;
    session.bobber = makeBobber();
    session.bobber.position.set(from.x, from.y - 0.2, from.z);
    ctx.scene.add(session.bobber);
    ctx.ui.toast(spot ? 'Заброс с удочки. Ждите поклёвки...' : 'Заброс. Ждите поклёвки...');
  }

  /**
   * Определить, какая рыба клюёт: сначала редкость, потом вид.
   * Шансы: обычная 65 %, редкая 20 %, эпическая 10 %, легендарная 4 %, мифическая 1 %.
   *
   * @returns {{spec: object, weight: number, length: number}} улов
   */
  function rollFish() {
    const table = [['common', 0.65], ['rare', 0.20], ['epic', 0.10], ['legendary', 0.04], ['mythic', 0.01]];
    let r = Math.random(), acc = 0, key = 'common';
    for (const [k, p] of table) { acc += p; if (r <= acc) { key = k; break; } }
    const pool = FISH.filter((f) => f.rarity === key);
    const spec = pool[Math.floor(Math.random() * pool.length)];
    const weight = spec.weightMin + Math.random() * (spec.weightMax - spec.weightMin);
    const length = spec.lengthMin + Math.random() * (spec.lengthMax - spec.lengthMin);
    return { spec, weight, length };
  }

  /**
   * Подготовить этап подсечки: зона, скорость метки, число попыток.
   */
  function prepareHook() {
    const f = session;
    const cfg = HOOK_CFG[f.fish.spec.rarity] || HOOK_CFG.common;
    f.markSpeed = cfg.speed;
    f.zone = cfg.zone;
    f.need = cfg.need;
    f.biteTime = cfg.time;
    f.zonePos = 0.08 + Math.random() * (0.84 - cfg.zone);
    f.mark = Math.random() < 0.5 ? 0.02 : 0.98;
    f.markDir = f.mark < 0.5 ? 1 : -1;
    // редкость не подсказываем — её видно только в улове
    const title = f.stage === 0 ? 'Клюёт!' : 'Ещё раз!';
    ctx.ui.showFishing({
      mark: f.mark, zone: f.zone, zonePos: f.zonePos, stage: f.stage, need: f.need, title,
    });
  }

  /** Подсечь. */
  function hookFish() {
    const f = session;
    if (f.state !== 'bite') return;
    const inZone = f.mark >= f.zonePos - f.zone / 2 && f.mark <= f.zonePos + f.zone / 2;
    if (!inZone) {
      failFish('Слишком рано — рыба сорвалась с крючка.');
      return;
    }
    f.stage++;
    if (f.stage >= f.need) {
      catchFish();
    } else {
      prepareHook();
      ctx.ui.toast('Рыба дёрнулась! Ещё раз — <b>E</b>.', 1500);
    }
  }

  /**
   * Промах: ловля закончена.
   *
   * @param {string} msg сообщение игроку
   */
  function failFish(msg) {
    endFishing();
    ctx.ui.hideFishing();
    ctx.ui.toast(msg, 2600);
  }

  /** Улов: рыба отправляется в инвентарь. */
  function catchFish() {
    const f = session;
    const spec = f.fish.spec;
    const inventory = ctx.inventory;
    const placed = ctx.inventory.add(makeStack(spec, { weight: f.fish.weight, length: f.fish.length }));
    ctx.ui.renderInventory(inventory);
    // запись в коллекцию пород: сколько поймали и какой удачный экземпляр
    if (ctx.caught) {
      const rec = ctx.caught[spec.id] || { count: 0, bestWeight: 0, bestLength: 0 };
      rec.count++;
      rec.bestWeight = Math.max(rec.bestWeight, f.fish.weight);
      rec.bestLength = Math.max(rec.bestLength, f.fish.length);
      ctx.caught[spec.id] = rec;
    }
    if (!placed.ok) {
      ctx.ui.toast('Все слоты заняты — пришлось выпустить рыбу обратно в озеро.', 3600);
      endFishing();
      ctx.ui.hideFishing();
      return;
    }
    const rar = rarityOf(spec.rarity);
    ctx.ui.toast(`Поймана рыба: ${spec.name} — ${rar ? rar.label : ''}, ${f.fish.weight.toFixed(2)} кг`, 3400);
    ctx.ambience.splash(true);
    spawnRipple(f.spot);
    // рыба остаётся в руках — посмотреть можно, не открывая инвентарь
    if (ctx.viewmodel) {
      const model = fishModel(spec);
      if (model) ctx.viewmodel.hold(model, { grip: 'two', pose: 'present', scale: 0.16, life: 8 });
    }
    endFishing();
    ctx.ui.hideFishing();
  }

  /** Убрать поплавок и всплески, вернуть систему в покой. */
  function endFishing() {
    const f = session;
    if (f.bobber) { ctx.scene.remove(f.bobber); f.bobber = null; }
    for (const r of f.ripples) ctx.scene.remove(r.m);
    f.ripples.length = 0;
    f.state = 'idle';
    f.fish = null;
  }

  /**
   * Обновление ловли (каждый кадр).
   *
   * @param {number} dt время кадра в секундах
   */
  function updateFishing(dt) {
    const f = session;
    if (f.state === 'idle') return;
    f.t += dt;

    // ушёл далеко — снимаем удочку
    if (f.state !== 'idle' && ctx.player.pos.distanceTo(f.spot) > 20) {
      endFishing();
      ctx.ui.hideFishing();
      ctx.ui.toast('Вы ушли далеко — удочка утонула.', 2000);
      return;
    }

    if (f.state === 'cast') {
      const k = Math.min(1, f.t / 0.65);
      const e = 1 - Math.pow(1 - k, 3);
      f.bobber.position.lerpVectors(f.from, f.spot, e);
      f.bobber.position.y = 1.25 + (0.05 - 1.25) * e + Math.sin(k * Math.PI) * 1.15;
      if (k >= 1) {
        f.state = 'wait';
        f.timer = 2.2 + Math.random() * 5.5;
        ctx.ambience.splash(false);
        spawnRipple(f.spot);
      }
      return;
    }

    if (f.state === 'wait') {
      f.bobber.position.y = 0.05 + Math.sin(f.t * 2.2) * 0.022;
      f.timer -= dt;
      if (f.timer <= 0) {
        f.state = 'bite';
        f.stage = 0;
        f.fish = rollFish();
        f.bobber.position.y = -0.08;
        prepareHook();
        ctx.ambience.splash(false);
      }
      return;
    }

    if (f.state === 'bite') {
      f.mark += f.markDir * f.markSpeed * dt;
      if (f.mark >= 1) { f.mark = 1; f.markDir = -1; }
      if (f.mark <= 0) { f.mark = 0; f.markDir = 1; }
      f.bobber.position.y = -0.1 + Math.sin(f.t * 18) * 0.03;
      ctx.ui.setFishing({ mark: f.mark, zone: f.zone, zonePos: f.zonePos, stage: f.stage, need: f.need });
      f.biteTime -= dt;
      if (f.biteTime <= 0) failFish('Рыба ушла с крючка. Терпение.');
      return;
    }

    // расходящиеся круги на воде
    for (let i = f.ripples.length - 1; i >= 0; i--) {
      const r = f.ripples[i];
      r.t += dt;
      const s = 1 + r.t * 3.4;
      r.m.scale.setScalar(s);
      r.m.material.opacity = Math.max(0, 0.5 - r.t * 0.55);
      if (r.t > 1.0) { ctx.scene.remove(r.m); f.ripples.splice(i, 1); }
    }
  }

  return {
    session,
    castSpots,
    HOOK_CFG,
    registerCastSpot,
    aimedCastSpot,
    nearestCastSpot,
    startFishing,
    hookFish,
    rollFish,
    prepareHook,
    endFishing,
    updateFishing,
    /** Активна ли ловля прямо сейчас (для HUD-подсказок). */
    get busy() { return session.state !== 'idle'; },
  };
}
