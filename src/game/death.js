/**
 * ============================================================================
 *  Смерть: падение и экран «Погиб»
 * ============================================================================
 *
 *  Зачем это нужно
 *  ---------------
 *  Пока сохранений не было, смерть была невозможна: урон не опускал
 *  здоровье ниже единицы, и пещера оставалась «безопасной прогулкой».
 *  Теперь игра помнит, где игрок был, — значит, проиграть можно.
 *  И смерть должна быть честной: не «экран ошибки», а упавший человек.
 *
 *  Что происходит
 *  --------------
 *  1. Тень бьёт игрока, здоровье падает до нуля — вызывается `kill()`.
 *  2. Управление замирает, мир останавливается (тени, факел, погода).
 *  3. Камера валится: игрок «заваливается» на землю — камера опускается
 *     к полу и заваливается набок, картинка темнеет и уходит вниз.
 *  4. Через полторы секунды появляется экран «Погиб»:
 *        • «Загрузить последнее сохранение» — вернуться в последний сейв;
 *        • «Загрузить» — открыть список слотов и выбрать самому;
 *        • «В начало» — выйти на титульный экран.
 *
 *  Чего модуль не делает
 *  --------------------
 *  Он не трогает сохранения: их пишет `game/save.js`. Он только решает,
 *  что игрок мёртв, двигает камеру и показывает экран.
 *
 *  @module game/death
 */

import * as THREE from 'three';

/** Высота камеры над землёй в начале падения. */
const EYE = 1.68;

/** Длительность падения, секунды. */
const FALL_TIME = 1.5;

/**
 * Создать систему смерти.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система смерти
 */
export function createDeath(ctx) {
  const state = {
    phase: 'alive',   // alive → falling → dead
    reason: '',       // почему погиб («Тень забрала вас в пещере»)
    t: 0,             // сколько секунд прошло с начала падения
    camY: EYE,        // текущая высота камеры
    roll: 0,          // наклон камеры (радианы)
    pitch: 0,         // завал взгляда вниз
    yaw: 0,           // направление взгляда
    lastGround: 0,    // высота пола под игроком
  };

  /**
   * Убить игрока.
   *
   * @param {string} reason причина смерти (показывается на экране)
   * @returns {boolean} true, если смерть только что произошла
   */
  function kill(reason) {
    if (state.phase !== 'alive') return false;
    state.phase = 'falling';
    state.reason = reason || 'Вы пали.';
    state.t = 0;

    const p = ctx.player;
    if (p) {
      p.enabled = false;          // игрок больше не управляется
      p.acceptInput = false;
      p.vel.set(0, 0, 0);
      p.vy = 0;
      state.yaw = p.yaw;
      state.lastGround = p.groundY ?? 0;
      state.camY = EYE;
    }
    // мир замирает: тени не бьют, факел не тратит топливо
    if (ctx.systems && ctx.systems.combat) {
      ctx.systems.combat.pause();
    }
    if (ctx.systems && ctx.systems.monsters) {
      ctx.systems.monsters.pause();
    }
    if (ctx.ui) {
      ctx.ui.setPrompt('');
      ctx.ui.toast(state.reason, 3200);
    }
    if (ctx.ambience && typeof ctx.ambience.death === 'function') ctx.ambience.death();
    return true;
  }

  /**
   * Продолжить после смерти — снять экран, вернуть управление и бой.
   */
  function revive() {
    state.phase = 'alive';
    state.t = 0;
    if (ctx.ui) ctx.ui.hideDeath();
    if (ctx.systems && ctx.systems.combat && ctx.systems.combat.resume) {
      ctx.systems.combat.resume();
    }
    if (ctx.systems && ctx.systems.monsters && ctx.systems.monsters.resume) {
      ctx.systems.monsters.resume();
    }
  }

  /**
   * Обновление анимации падения.
   *
   * @param {number} dt кадр
   */
  function update(dt) {
    if (state.phase !== 'falling') return;
    state.t += dt;

    // Падение: быстрый завал с лёгким подпрыгиванием, как у живого тела.
    const k = Math.min(1, state.t / FALL_TIME);
    // наклон идёт нелинейно — сначала резко, потом мягко «дожимается»
    const fall = 1 - Math.pow(1 - k, 2.2);
    state.camY = EYE * (1 - fall * 0.86);
    state.roll = fall * 1.24;
    state.pitch = fall * 0.22;

    const p = ctx.player;
    if (p && p.camera) {
      const cam = p.camera;
      cam.position.set(
        p.pos.x,
        state.lastGround + state.camY + Math.sin(state.t * 9) * 0.012 * (1 - k),
        p.pos.z,
      );
      cam.rotation.set(0, 0, 0);
      cam.rotateY(state.yaw);
      cam.rotateX(-state.pitch);
      cam.rotateZ(state.roll);
      cam.updateMatrixWorld();
    }

    // Затемнение кадра — чем глубже падение, тем темнее.
    if (ctx.ui && ctx.ui.setDeathFade) ctx.ui.setDeathFade(Math.min(1, fall));

    if (state.t >= FALL_TIME && state.phase === 'falling') {
      state.phase = 'dead';
      if (ctx.ui) {
        // подпись под кнопкой: игрок должен видеть, куда его вернёт
        const last = ctx.readSave ? ctx.readSave() : null;
        const seasonName = {
          spring: 'весна', summer: 'лето', autumn: 'осень', winter: 'зима',
        };
        ctx.ui.showDeath(state.reason, last ? {
          exists: true,
          day: last.day,
          season: last.season,
          seasonName: seasonName[last.season] || last.season,
          coins: last.coins,
        } : { exists: false });
      }
    }
  }

  return {
    state,
    kill,
    revive,
    update,
    get isDead() { return state.phase !== 'alive'; },
    get isFalling() { return state.phase === 'falling'; },
  };
}
