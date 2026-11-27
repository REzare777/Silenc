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
  litIntensity: 16.0,       // факел в руке — заметный круг света
  litDistance: 26,
  darkIntensity: 1.6,       // в темноте не чёрно: в кадре всё видно
  darkDistance: 7,
  flashIntensity: 42.0,     // вспышка разом разбрасывает всех вблизи
  flashDistance: 40,
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
    torchEquipped: false, // факел взят в левую руку
    flashCd: 0,
    flashTime: 0,
    strikeCd: 0,
    strikeAnim: 0,
    weaponCd: 0,           // перезарядка оружия
    lastWeapon: null,      // id оружия, которым били последним
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
  const _v = new THREE.Vector3();

  /**
   * Поставить/убрать бранд в руках.
   *
   * @param {boolean} on в руке ли он
   */
  function holdBrand(on) {
    if (on) {
      // бранд живёт в левой руке: если правая занята оружием, горит там
      ctx.viewmodel.setTorch(brand.group, 0.22);
    } else {
      ctx.viewmodel.setTorch(null);
    }
  }

  /**
   * Взять факел в левую руку или убрать его.
   *
   * Факел — обычное снаряжение: его можно купить, положить на пояс и взять
   * в руку. Никто его не выдаёт при входе в подземелье, и гореть он
   * начинает только по команде игрока.
   *
   * @param {boolean} on взять ли в руку
   */
  function setTorchEquipped(on) {
    const want = !!on;
    if (state.torchEquipped === want) return;
    state.torchEquipped = want;
    holdBrand(want);
    if (!want) {
      // убрали факел — огонь погас
      state.lit = false;
      state.lighting = 0;
      brand.setLit(false);
    }
  }

  /**
   * Взять/убрать факел (переключатель).
   *
   * @returns {boolean} взят ли он теперь в руку
   */
  function toggleTorchEquip() {
    setTorchEquipped(!state.torchEquipped);
    return state.torchEquipped;
  }

  /**
   * Добавить топлива в факел.
   *
   * @param {number} n сколько
   * @returns {number} сколько топлива стало
   */
  function addFuel(n) {
    state.fuel = Math.max(0, Math.min(COMBAT.fuelMax, state.fuel + n));
    return state.fuel;
  }

  /**
   * Зажечь факел сразу, без ожидания разжигания.
   *
   * @returns {boolean} удалось ли
   */
  function lightNow() {
    if (!state.torchEquipped || state.fuel <= 0) return false;
    state.lighting = 0;
    state.lit = true;
    brand.setLit(true);
    return true;
  }

  /**
   * Включить или выключить боевой режим (вход/выход из подземелья).
   *
   * @param {boolean} on активен ли бой
   */
  function setActive(on) {
    const want = !!on;
    if (state.active === want) return;
    state.active = want;
    if (state.active) {
      // факел не зажигается сам — это снаряжение игрока
      if (!state.torchEquipped) {
        state.lit = false;
        brand.setLit(false);
      }
      if (ctx.systems.monsters) ctx.systems.monsters.spawn();
    } else {
      state.threat = 0;
    }
  }

  /**
   * Потушить или разжечь факел.
   *
   * @returns {string} что произошло — для подсказки
   */
  function toggleTorch() {
    if (!state.torchEquipped) {
      return 'В руках нет факела. Возьмите его с пояса — клавиша R.';
    }
    if (state.lit) {
      state.lit = false;
      brand.setLit(false);
      if (ctx.ambience) ctx.ambience.torchOut();
      return 'Факел потушен. В темноте тени подбираются ближе.';
    }
    if (state.lighting > 0) return 'Факел уже разжигается…';
    if (state.fuel <= 0) {
      if (ctx.ambience) ctx.ambience.torchOut();
      return 'Факел пуст. Подойдите к огню или купите смолу с фитилём.';
    }
    state.lighting = COMBAT.lightTime;
    if (ctx.ambience) ctx.ambience.torchLight();
    return 'Факел разгорается…';
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
    const monsters = ctx.systems.monsters;
    let hit = false;
    if (monsters) {
      ctx.camera.getWorldPosition(_org);
      ctx.camera.getWorldDirection(_dir);
      hit = monsters.strike(_org, _dir, COMBAT.strikeRange, COMBAT.strikeCone);
    }
    if (ctx.ambience) {
      if (hit) ctx.ambience.hitBrand();
      else ctx.ambience.hitStone();
    }
    if (hit) state.hits++;
    return hit;
  }

  /**
   * Удар оружием из пояса.
   *
   * Правила простые и честные:
   *   * урон — случайное число из диапазона оружия;
   *   * скорость — кулдаун равен `speed` оружия: тяжёлое бьёт медленно;
   *   * дальность — `reach`: у лука и посоха своя;
   *   * посох тратит ману, любой клинок — силы;
   *   * замах бьёт по площади: длинный меч достаёт двоих, двуручный — троих;
   *   * бывает крит — вдвое больший урон.
   *
   * @returns {boolean} попали ли
   */
  function weaponStrike() {
    const spec = ctx.systems.loadout ? ctx.systems.loadout.currentWeapon() : null;
    if (!spec) return false;
    if (state.weaponCd > 0) return false;
    if (spec.mana && !ctx.stats.spendMana(spec.mana)) {
      if (ctx.ambience) ctx.ambience.dryClick();
      if (ctx.ui) ctx.ui.toast('Мана кончилась — жезл молчит.', 2000);
      return false;
    }
    // тяжёлый замах стоит силы: без этого можно рубить бесконечно
    const effort = spec.effort ?? 4;
    if (ctx.stats.stamina < effort) {
      if (ctx.ambience) ctx.ambience.dryClick();
      if (ctx.ui) ctx.ui.toast('Сил не осталось — дайте рукам передохнуть.', 1600);
      return false;
    }
    ctx.stats.spendStamina(effort);
    state.weaponCd = spec.speed;
    state.lastWeapon = spec.id;

    // замах
    const dur = Math.max(0.16, Math.min(0.38, spec.speed * 0.5));
    ctx.viewmodel.swing(dur);
    if (ctx.ambience) {
      ctx.ambience.swing(
        spec.subclass === 'magic' ? 'magic'
          : spec.subclass === 'bow' ? 'bow'
            : spec.subclass === 'axe' ? 'axe' : 'blade');
    }

    // урон
    const dmg = spec.dmg[0] + Math.random() * (spec.dmg[1] - spec.dmg[0]);
    const cone = spec.subclass === 'bow' ? 0.10 : spec.subclass === 'magic' ? 0.55 : 0.5;
    ctx.camera.getWorldPosition(_org);
    ctx.camera.getWorldDirection(_dir);

    const monsters = ctx.systems.monsters;
    let hit = false;
    if (monsters) {
      const res = monsters.hit(_org, _dir, spec.reach, cone, dmg, {
        count: spec.sweep ?? 1,
        crit: spec.crit ?? 0,
        knock: spec.knock ?? 4.5,
        stun: spec.stun ?? 0.35,
      });
      hit = res.hit;
      if (hit) {
        // цифры урона над зверем и тряска камеры: удар должен чувствоваться
        let sealed = false;
        for (const h of res.hits || []) {
          if (h.sealed) { sealed = true; continue; }
          showDamage(h.x, h.y, h.z, h.amount, h.crit);
        }
        if (sealed && ctx.ui) {
          ctx.ui.toast('Его держит печать Врат. Сперва разберитесь со стражей.', 2600);
        }
        if (ctx.player && ctx.player.addShake) {
          ctx.player.addShake((spec.weight || 1) >= 3 ? 0.55 : 0.22);
        }
      }
      if (hit && ctx.ambience) {
        if (spec.subclass === 'bow') ctx.ambience.twang();
        else if (spec.subclass === 'magic') ctx.ambience.zap();
        else ctx.ambience.hitBlade(spec.weight >= 3);
      }
    }
    if (!hit && ctx.ambience) ctx.ambience.hitStone();
    return hit;
  }

  /**
   * Показать цифру урона над зверем.
   *
   * Мировая точка переводится в экранную здесь же: у интерфейса нет
   * камеры, а проекция должна идти от того же кадра, который игрок видит.
   *
   * @param {number} x где по X
   * @param {number} y где по Y
   * @param {number} z где по Z
   * @param {number} amount сколько урона
   * @param {boolean} crit критический ли
   */
  function showDamage(x, y, z, amount, crit) {
    if (!ctx.ui || !ctx.ui.popDamage) return;
    const p = _v.set(x, y, z).project(ctx.camera);
    if (p.z < -1 || p.z > 1) return;          // цель за камерой или слишком далеко
    const sx = (p.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-p.y * 0.5 + 0.5) * window.innerHeight;
    ctx.ui.popDamage(sx, sy, amount, crit);
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
      if (ctx.ui) ctx.ui.toast('Маны не хватило — вспышка не вышла.', 1800);
      return false;
    }
    if (state.fuel < COMBAT.flashFuel) {
      if (ctx.ambience) ctx.ambience.dryClick();
      if (ctx.ui) ctx.ui.toast('Топлива в факеле не хватило.', 1800);
      return false;
    }
    state.fuel -= COMBAT.flashFuel;
    state.flashCd = COMBAT.flashCooldown;
    state.flashTime = COMBAT.flashTime;
    if (ctx.ambience) ctx.ambience.flare();
    const monsters = ctx.systems.monsters;
    if (monsters) {
      ctx.camera.getWorldPosition(_org);
      monsters.flare(_org, 6, 2.5, 0.7, 16);
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
    const monsters = ctx.systems.monsters;
    if (!monsters) return null;
    ctx.camera.getWorldPosition(_org);
    ctx.camera.getWorldDirection(_dir);
    return monsters.aimTarget(_org, _dir, COMBAT.strikeRange * 1.7, COMBAT.strikeCone * 1.4);
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
      // вне подземелья боя нет, но факел — обычная вещь: он горит,
      // тратит топливо и живым пламенем
      state.threat = 0;
      if (state.lighting > 0) {
        state.lighting -= dt;
        if (state.lighting <= 0) {
          state.lighting = 0;
          state.lit = true;
          brand.setLit(true);
        }
      }
      if (state.lit) {
        state.fuel -= COMBAT.burnPerSec * dt;
        if (state.fuel <= 0) {
          state.fuel = 0;
          state.lit = false;
          brand.setLit(false);
          if (ctx.ambience) ctx.ambience.torchOut();
          if (ctx.ui) ctx.ui.toast('Факел погас. Нужен огонь.', 2400);
        }
      }
      brand.update(t);
      return;
    }

    // близость ближайшей тени — по ней музыка понимает, что пора нервничать
    state.threat = nearestThreat();

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
        if (ctx.ui) ctx.ui.toast('Факел погас. Нужен огонь.', 2400);
      }
    }

    // таймеры
    state.flashCd = Math.max(0, state.flashCd - dt);
    state.flashTime = Math.max(0, state.flashTime - dt);
    state.strikeCd = Math.max(0, state.strikeCd - dt);
    state.weaponCd = Math.max(0, state.weaponCd - dt);
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
   * Насколько близко подобралась тень: 0 — тихо, 1 — рядом.
   *
   * Это значение смотрит музыка: когда тень подходит, музыка густеет
   * и добавляет низкий пульс тревоги.
   *
   * @returns {number} 0…1
   */
  function nearestThreat() {
    const monsters = ctx.systems && ctx.systems.monsters;
    if (!monsters || !monsters.list || !ctx.player) return 0;
    const px = ctx.player.pos.x;
    const pz = ctx.player.pos.z;
    let threat = 0;
    for (const s of monsters.list) {
      if (s.dying > 0 || s.hp <= 0) continue;
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d > 16) continue;
      const t = 1 - d / 16;
      if (t > threat) threat = t;
    }
    return threat;
  }

  /**
   * Подсказка для HUD: что игрок может сделать сейчас.
   *
   * @returns {string} текст подсказки (пусто — если нечего делать)
   */
  function prompt() {
    if (!state.active) return '';
    if (state.flashCd > 0.01) {
      return `Вспышка копит силу — ещё ${state.flashCd.toFixed(1)} с`;
    }
    if (!state.torchEquipped) return 'Взять факел — R';
    if (state.lighting > 0) return 'Факел разгорается…';
    if (!state.lit) {
      return state.fuel > 0 ? 'Зажечь факел — F' : 'Факел пуст — нужен огонь';
    }
    const pct = Math.round(state.fuel / COMBAT.fuelMax * 100);
    if (pct < 15) return `Горит: ${pct} % — топливо на исходе`;
    return 'Ударить факелом — ЛКМ';
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
    update, strike, weaponStrike, flare, toggleTorch, setActive, prompt, aimTarget,
    addFirePoint, holdBrand, setTorchEquipped, toggleTorchEquip, addFuel, lightNow,
    /**
     * Заморозить бой (например, когда игрок погиб): факел не тратит
     * топливо, удары и вспышки не работают.
     */
    pause() {
      state.active = false;
      state.threat = 0;
    },
    /** Разбудить бой обратно. */
    resume() {
      state.active = true;
    },
    /** Доля топлива 0..1 — для полоски в HUD. */
    get fuelRatio() { return state.fuel / COMBAT.fuelMax; },
  };
}
