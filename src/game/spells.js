/**
 * ============================================================================
 *  Заклинания: то, что Хорт продаёт «от старых мастеров»
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  Мана в игре была пустым числом: посох тратил её, но наполнить было
 *  нечем. Теперь мана — ресурс, который тратится на заклинания, а сами
 *  заклинания покупаются у трактирщика. Это даёт второй смысл поясу:
 *  в одном слоте может лежать оружие, в другом — свиток.
 *
 *  Как колдовать
 *  --------------
 *  Заклинание лежит в слоте пояса. Игрок нажимает цифру этого слота —
 *  свиток срабатывает, мана тратится, справа остаётся оружие. Заклинания
 *  не тратятся: они требуют только маны и отката.
 *
 *  Что делают заклинания
 *  ----------------------
 *  * `flash` — огненная вспышка: свет разом отбрасывает тени рядом;
 *  * `heal`  — лечебное слово: стягивает раны;
 *  * `light` — живой огонь: зажигает факел в руке, а если его нет —
 *    светит вокруг игрока минуту.
 *
 *  @module game/spells
 */

import * as THREE from 'three';
import { SPELL_COOLDOWN } from './items.js';

/**
 * Что делает каждое заклинание.
 *
 * `mana` — цена в мана, `color` — цвет вспышки, `heal` — сколько лечит,
 * `fuel` — сколько топлива добавляет факелу, `glow` — сколько секунд светит
 * вокруг игрока, если факела нет.
 */
export const SPELL_INFO = {
  flash: {
    name: 'Огненная вспышка',
    mana: 25,
    color: 0xffb066,
    desc: 'Свет разом отбрасывает всё, что подошло слишком близко.',
  },
  heal: {
    name: 'Лечебное слово',
    mana: 20,
    color: 0x8ce09a,
    heal: 35,
    desc: 'Стягивает раны: +35 здоровья.',
  },
  light: {
    name: 'Живой огонь',
    mana: 15,
    color: 0xffd98a,
    fuel: 60,
    glow: 60,
    desc: 'Зажигает факел в руке. Без факела — светит минуту.',
  },
};

/**
 * Создать систему заклинаний.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система заклинаний
 */
export function createSpells(ctx) {
  const state = {
    /** Остаток отката по id заклинания (секунды). */
    cd: {},
    /** Сколько осталось светить «живому огню» без факела. */
    glowT: 0,
  };

  /** Лампа «живого огня» в мире (создаётся по надобности). */
  let glowLight = null;

  /** Короткая вспышка света: своя лампа, своя жизнь. */
  let pulse = null;

  const _org = new THREE.Vector3();
  const _dir = new THREE.Vector3();

  /**
   * Активная сцена: подземелье, таверна, храм и дома — отдельные сцены,
   * и свет заклинания должен жить именно в ней.
   *
   * @returns {THREE.Scene|null}
   */
  function activeScene() {
    if (ctx.renderPass && ctx.renderPass.scene) return ctx.renderPass.scene;
    return ctx.scene || null;
  }

  /**
   * Поставить лампу в активную сцену и посадить её на игрока.
   *
   * @param {THREE.PointLight} light лампа
   */
  function placeLight(light) {
    const scene = activeScene();
    if (scene && light.parent !== scene) scene.add(light);
    if (ctx.player) {
      light.position.set(ctx.player.pos.x, ctx.player.pos.y + 1.5, ctx.player.pos.z);
    }
  }

  /**
   * Сколько осталось отката.
   *
   * @param {string} id id заклинания
   * @returns {number} секунды
   */
  function cooldownLeft(id) {
    return Math.max(0, state.cd[id] || 0);
  }

  /**
   * Можно ли сейчас колдовать.
   *
   * @param {object} spec предмет-заклинание
   * @returns {boolean}
   */
  function canCast(spec) {
    if (!spec || spec.kind !== 'spell') return false;
    const info = SPELL_INFO[spec.spell];
    if (!info) return false;
    if (cooldownLeft(spec.spell) > 0) return false;
    return !!ctx.stats && ctx.stats.mana >= info.mana;
  }

  /**
   * Сказать игроку, что пошло не так.
   *
   * @param {string} text текст
   * @param {number} [ms] сколько показывать
   */
  function say(text, ms = 2400) {
    if (ctx.ui) ctx.ui.toast(text, ms);
  }

  /**
   * Вспышка света: разом отбрасывает тени и на миг освещает подземелье.
   */
  function effectFlash() {
    const shadows = ctx.systems && ctx.systems.shadows;
    if (ctx.camera) {
      ctx.camera.getWorldPosition(_org);
      ctx.camera.getWorldDirection(_dir);
    }
    if (shadows) shadows.flare(_org, 7.5, 3.2, 0.85, 18);
    if (ctx.viewmodel) ctx.viewmodel.flash(0xffb066, 10);
    if (ctx.ambience) ctx.ambience.spell('flash');
    // свет в мире: короткий круг света вокруг игрока
    pulseLight(0xffc07a, 22, 0.6);
    say('Огненная вспышка! Тени отброшены.', 2200);
  }

  /**
   * Лечение: стягивает раны.
   */
  function effectHeal(info) {
    if (ctx.stats) ctx.stats.heal(info.heal);
    if (ctx.viewmodel) ctx.viewmodel.flash(0x8ce09a, 6);
    if (ctx.ambience) ctx.ambience.spell('heal');
    pulseLight(0x9be6a8, 10, 1.2);
    say(`Лечебное слово: +${info.heal} здоровья.`, 2200);
  }

  /**
   * Живой огонь: зажигает факел, а без факела — светит вокруг.
   */
  function effectLight(info) {
    const combat = ctx.systems && ctx.systems.combat;
    if (combat && combat.setTorchEquipped && combat.state.torchEquipped) {
      combat.addFuel(info.fuel);
      combat.lightNow();
      if (ctx.viewmodel) ctx.viewmodel.flash(0xffd98a, 7);
      pulseLight(0xffd07a, 14, 1.4);
      say('Живой огонь: факел горит.', 2200);
    } else {
      state.glowT = info.glow;
      if (ctx.viewmodel) ctx.viewmodel.flash(0xffd98a, 7);
      pulseLight(0xffd07a, 16, 1.6);
      say('Живой огонь: вокруг тебя светло минуту. Факела в руках нет.', 3000);
    }
    if (ctx.ambience) ctx.ambience.spell('light');
  }

  /**
   * Короткая вспышка света в мире.
   *
   * Лампа живёт в активной сцене (подземелье, таверна, храм, дом) и гаснет
   * по своему таймеру — независимо от «живого огня».
   *
   * @param {number} color цвет
   * @param {number} intensity сила
   * @param {number} time длительность, с
   */
  function pulseLight(color, intensity, time) {
    const scene = activeScene();
    if (!scene) return;
    if (!pulse) {
      pulse = {
        light: new THREE.PointLight(color, 0, 20, 2),
        t: 0,
        max: 1,
        base: intensity,
      };
      pulse.light.name = 'spellPulse';
      scene.add(pulse.light);
    }
    pulse.light.color.setHex(color);
    pulse.light.intensity = intensity;
    pulse.t = time;
    pulse.max = Math.max(0.01, time);
    pulse.base = intensity;
    placeLight(pulse.light);
  }

  /**
   * Колдовать.
   *
   * @param {object} spec предмет-заклинание
   * @returns {boolean} удалось ли
   */
  function cast(spec) {
    if (!spec || spec.kind !== 'spell') return false;
    const info = SPELL_INFO[spec.spell];
    if (!info) return false;
    const left = cooldownLeft(spec.spell);
    if (left > 0) {
      say(`«${info.name}» не отвечает ещё ${left.toFixed(0)} с.`, 2000);
      if (ctx.ambience) ctx.ambience.dryClick();
      return false;
    }
    if (!ctx.stats || !ctx.stats.spendMana(info.mana)) {
      say('Мана кончилась — слово не звучит.', 2200);
      if (ctx.ambience) ctx.ambience.dryClick();
      return false;
    }
    state.cd[spec.spell] = SPELL_COOLDOWN[spec.spell] ?? 6;
    if (spec.spell === 'flash') effectFlash();
    else if (spec.spell === 'heal') effectHeal(info);
    else if (spec.spell === 'light') effectLight(info);
    else return false;
    return true;
  }

  /**
   * Каждый кадр: откаты и свет «живого огня».
   *
   * @param {number} dt кадр
   */
  function update(dt) {
    for (const id in state.cd) {
      if (state.cd[id] > 0) {
        state.cd[id] = Math.max(0, state.cd[id] - dt);
        if (state.cd[id] === 0) delete state.cd[id];
      }
    }
    // короткая вспышка: гаснет сама, свет всегда в активной сцене
    if (pulse) {
      pulse.t = Math.max(0, pulse.t - dt);
      placeLight(pulse.light);
      pulse.light.intensity = pulse.base * (pulse.t / pulse.max);
      if (pulse.t === 0) pulse.light.intensity = 0;
    }
    // «живой огонь» без факела: свет вокруг игрока минуту
    if (state.glowT > 0) {
      state.glowT = Math.max(0, state.glowT - dt);
      if (!glowLight) {
        glowLight = new THREE.PointLight(0xffd07a, 0, 20, 2);
        glowLight.name = 'spellLight';
      }
      placeLight(glowLight);
      glowLight.intensity = 12;
      if (state.glowT === 0) glowLight.intensity = 0;
    }
  }

  return {
    state,
    cast,
    canCast,
    update,
    cooldownLeft,
    /** Список заклинаний для подсказок. */
    info: SPELL_INFO,
  };
}
