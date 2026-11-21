/**
 * ============================================================================
 *  Боёвка «Уголь и тени»: факел в руке, удары брандом, вспышка
 * ============================================================================
 *
 *  Игрок носит в руке горящий бранд. Он и освещает, и защищает: пока огонь
 *  горит, тени не подходят ближе 2,8 м. Удар брандом (ЛКМ) гасит одну из трёх
 *  «veil»-единиц тени и отбрасывает её. Вспышка (ПКМ) разом разбрасывает всех
 *  вблизи, но тратит ману, топливо и — главное — зовёт остальных шумом.
 *
 *  Правила, которые нельзя нарушать:
 *   * смерти нет: HP никогда не падает ниже 1, лечит огонь;
 *   * новых источников света нет: используется фонарь игрока в пещере;
 *   * новых предметов в инвентаре нет: огонь — это снаряжение, а не стак;
 *   * нового режима игры нет: бой живёт внутри обычного прогулочного цикла.
 *
 *  @module game/combat
 */

import * as THREE from 'three';
import { brandModel } from '../world/torch.js';

/** Параметры боёвки — сведены в одну таблицу, чтобы их было легко балансировать. */
export const COMBAT = {
  fuelMax: 100,
  burnPerSec: 0.35,          // ≈ 4 мин 45 с света
  lightTime: 1.5,            // разжигание
  litIntensity: 6.5,        // факел в руке — заметный круг света
  litDistance: 17,
  darkIntensity: 1.2,       // в темноте не чёрно: в кадре всё видно
  darkDistance: 6,
  flashIntensity: 15.0,     // вспышка разом разбрасывает всех вблизи
  flashDistance: 26,
  flashTime: 1.2,
  flashMana: 25,
  flashFuel: 6,
  flashCooldown: 4.0,
  strikeRange: 2.2,
  strikeCone: Math.PI * 40 / 180,   // ±40°
  strikeCooldown: 0.48,
  strikeAnim: 0.28,
  keepDistance: 2.8,         // минимальная дистанция тени при горящем факеле
  dangerRadius: 6,           // с какого расстояния включается «слой угрозы»
  healPerSec: 5,             // у жаровни и костра
  tavernHealPerSec: 4,
  forgePrice: 10,            // «смола и фитиль» у кузнеца
};

/**
 * Создать систему боя.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система боя
 */
export function createCombat(ctx) {
  const state = {
    fuel: COMBAT.fuelMax,
    lit: false,
    lighting: 0,          // сколько осталось разжигания
    flashCd: 0,
    flashTime: 0,
    strikeCd: 0,
    strikeAnim: 0,
    active: false,        // бой активен (подземелье)
    inLight: 0,           // 0..1 — насколько близко игрок к огню
    threat: 0,            // 0..1 — близость тени (для слоя угрозы)
    hits: 0,
  };

  /** Бранд в руках. */
  const brand = brandModel(ctx.M, ctx.glowTex);
  brand.group.scale.setScalar(0.22);

  /** Точки огня: пополняют топливо и лечат. */
  const firePoints = [];

  const _dir = new THREE.Vector3();
  const _org = new THREE.Vector3();

  /**
   * Поставить/убрать бранд в руках.
   *
   * @param {boolean} on в руке ли он
   */
  function holdBrand(on) {
    if (on) {
      ctx.viewmodel.hold(brand.group, { grip: 'right', pose: 'carry', scale: 0.22 });
    } else {
      ctx.viewmodel.release();
    }
  }

  /**
   * Включить или выключить боевой режим (вход/выход из подземелья).
   *
   * @param {boolean} on активен ли бой
   */
  function setActive(on) {
    if (state.active === !!on) return;
    state.active = !!on;
    if (state.active) {
      state.fuel = COMBAT.fuelMax;
      state.lit = true;
      state.lighting = 0;
      brand.setLit(true);
      holdBrand(true);
    } else {
      state.lit = false;
      brand.setLit(false);
      holdBrand(false);
    }
  }

  /**
   * Потушить или разжечь факел.
   *
   * @returns {string} что произошло — для подсказки
   */
  function toggleTorch() {
    if (!state.active) return '';
    if (state.lit) {
      state.lit = false;
      brand.setLit(false);
      if (ctx.ambience) ctx.ambience.torchOut();
      return 'Факел погашен. В темноте тени ближе.';
    }
    if (state.lighting > 0) return 'Факел уже разжигается…';
    if (state.fuel <= 0) {
      if (ctx.ambience) ctx.ambience.torchOut();
      return 'В факеле нет топлива. Подойди к огню.';
    }
    state.lighting = COMBAT.lightTime;
    if (ctx.ambience) ctx.ambience.torchLight();
    return 'Разжигаю факел…';
  }

  /**
   * Удар брандом: ищем ближайшую тень в конусе и бьём.
   *
   * @returns {boolean} попали ли
   */
  function strike() {
    if (!state.active || !state.lit || state.strikeCd > 0) return false;
    state.strikeCd = COMBAT.strikeCooldown;
    state.strikeAnim = COMBAT.strikeAnim;
    // поза вытянутой руки
    ctx.viewmodel.setPose('right', 'reach');
    const shadows = ctx.systems.shadows;
    let hit = false;
    if (shadows) {
      ctx.camera.getWorldPosition(_org);
      ctx.camera.getWorldDirection(_dir);
      hit = shadows.strike(_org, _dir, COMBAT.strikeRange, COMBAT.strikeCone);
    }
    if (ctx.ambience) {
      if (hit) ctx.ambience.hitBrand();
      else ctx.ambience.hitStone();
    }
    if (hit) state.hits++;
    return hit;
  }

  /**
   * Вспышка: разбрасывает всех вблизи, но зовёт остальных.
   *
   * @returns {boolean} получилось ли
   */
  function flare() {
    if (!state.active) return false;
    if (state.flashCd > 0) {
      if (ctx.ambience) ctx.ambience.dryClick();
      return false;
    }
    if (!ctx.stats.spendMana(COMBAT.flashMana)) {
      if (ctx.ambience) ctx.ambience.dryClick();
      if (ctx.ui) ctx.ui.toast('Мана кончилась — вспышка не вышла.', 1800);
      return false;
    }
    if (state.fuel < COMBAT.flashFuel) {
      if (ctx.ambience) ctx.ambience.dryClick();
      if (ctx.ui) ctx.ui.toast('В факеле не хватило топлива.', 1800);
      return false;
    }
    state.fuel -= COMBAT.flashFuel;
    state.flashCd = COMBAT.flashCooldown;
    state.flashTime = COMBAT.flashTime;
    if (ctx.ambience) ctx.ambience.flare();
    const shadows = ctx.systems.shadows;
    if (shadows) {
      ctx.camera.getWorldPosition(_org);
      shadows.flare(_org, 6, 2.5, 0.7, 16);
    }
    return true;
  }

  /**
   * Тень под прицелом — для пипсов «veil» и цвета прицела.
   *
   * @returns {object|null} тень или null
   */
  function aimTarget() {
    if (!state.active || !state.lit) return null;
    const shadows = ctx.systems.shadows;
    if (!shadows) return null;
    ctx.camera.getWorldPosition(_org);
    ctx.camera.getWorldDirection(_dir);
    return shadows.aimTarget(_org, _dir, COMBAT.strikeRange * 1.7, COMBAT.strikeCone * 1.4);
  }

  /**
   * Топливо и лечение у огня.
   *
   * @param {number} dt кадр
   * @param {THREE.Vector3} pos позиция игрока
   */
  function updateFire(dt, pos) {
    let inLight = 0;
    for (const f of firePoints) {
      const d = Math.hypot(pos.x - f.x, pos.z - f.z);
      if (d > f.r) continue;
      inLight = Math.max(inLight, 1 - d / f.r);
      if (state.fuel < COMBAT.fuelMax) {
        state.fuel = Math.min(COMBAT.fuelMax, state.fuel + f.fuel * dt);
      }
      if (ctx.stats.hp < ctx.stats.maxHp) {
        ctx.stats.heal(f.heal * dt);
      }
    }
    state.inLight = inLight;
  }

  /**
   * Каждый кадр: горение, разжигание, перезарядки, свет, огонь.
   *
   * @param {number} dt кадр
   * @param {number} t время
   */
  function update(dt, t) {
    if (!state.active) {
      state.threat = 0;
      return;
    }

    // разжигание
    if (state.lighting > 0) {
      state.lighting -= dt;
      if (state.lighting <= 0) {
        state.lighting = 0;
        state.lit = true;
        brand.setLit(true);
      }
    }

    // горение
    if (state.lit) {
      state.fuel -= COMBAT.burnPerSec * dt;
      if (state.fuel <= 0) {
        state.fuel = 0;
        state.lit = false;
        brand.setLit(false);
        if (ctx.ambience) ctx.ambience.torchOut();
        if (ctx.ui) ctx.ui.toast('Факел погас. Найди огонь.', 2400);
      }
    }

    // таймеры
    state.flashCd = Math.max(0, state.flashCd - dt);
    state.flashTime = Math.max(0, state.flashTime - dt);
    state.strikeCd = Math.max(0, state.strikeCd - dt);
    if (state.strikeAnim > 0) {
      state.strikeAnim -= dt;
      if (state.strikeAnim <= 0) {
        state.strikeAnim = 0;
        ctx.viewmodel.setPose('right', 'carry');
      }
    }

    // свет: фонарь игрока в пещере переиспользуется под факел
    const L = ctx.systems.locations && ctx.systems.locations.dungeonLoc
      ? ctx.systems.locations.dungeonLoc.lights.lantern : null;
    if (L) {
      if (state.flashTime > 0) {
        L.intensity = COMBAT.flashIntensity;
        L.distance = COMBAT.flashDistance;
      } else if (state.lit) {
        L.intensity = COMBAT.litIntensity + Math.sin(t * 9.1) * 0.14;
        L.distance = COMBAT.litDistance;
      } else {
        L.intensity = COMBAT.darkIntensity + Math.sin(t * 5.3) * 0.05;
        L.distance = COMBAT.darkDistance;
      }
    }

    brand.update(t);

    // огонь рядом: пополнение топлива и лечение
    updateFire(dt, ctx.player.pos);
  }

  /**
   * Подсказка для HUD: что игрок может сделать сейчас.
   *
   * @returns {string} текст подсказки (пусто — если нечего делать)
   */
  function prompt() {
    if (!state.active) return '';
    if (state.flashCd > 0.01) {
      return `Вспышка перезаряжается — ${state.flashCd.toFixed(1)} с`;
    }
    if (state.lighting > 0) return 'Разжигаю факел…';
    if (!state.lit) {
      return state.fuel > 0 ? 'Зажечь факел — F' : 'Факел пуст — найди огонь';
    }
    const pct = Math.round(state.fuel / COMBAT.fuelMax * 100);
    if (pct < 15) return `Горит: ${pct} % — топливо на исходе`;
    return 'Ударь факелом — ЛКМ';
  }

  /**
   * Добавить точку огня (жаровня, костёр, очаг).
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @param {number} r радиус действия
   * @param {number} fuel скорость пополнения топлива
   * @param {number} heal скорость лечения
   */
  function addFirePoint(x, z, r, fuel, heal) {
    firePoints.push({ x, z, r, fuel, heal });
  }

  return {
    state, brand, firePoints,
    update, strike, flare, toggleTorch, setActive, prompt, aimTarget,
    addFirePoint, holdBrand,
    /** Доля топлива 0..1 — для полоски в HUD. */
    get fuelRatio() { return state.fuel / COMBAT.fuelMax; },
  };
}
