/**
 * ============================================================================
 *  ПОВЕДЕНИЕ ПЕРСОНАЖЕЙ (NPC)
 * ============================================================================
 *
 *  NPC — это «живой» персонаж в интерьере: он ходит по маршруту, стоит
 *  на месте, смотрит на игрока и уходит, когда трактир закрывается.
 *
 *  Модель (меши и анимация) живёт в `world/npc.js`, поведение — здесь.
 *
 *  Состояния:
 *  | состояние | что делает                                  |
 *  |-----------|----------------------------------------------|
 *  | `idle`    | стоит на точке, ждёт, пока пойдёт дальше       |
 *  | `walk`    | идёт к очередной точке маршрута                |
 *  | `talk`    | стоит и смотрит на игрока                      |
 *  | `away`    | персонажа нет на месте (ночь, трактир закрыт)  |
 *
 *  @module game/npc
 */

/**
 * Создаёт NPC.
 *
 * @param {object} ctx контекст игры
 * @param {object} cfg настройки:
 *   - `model` — { group, update } из world/npc.js
 *   - `route` — массив точек { x, z }: бармен ходит по ним по кругу
 *   - `speed` — скорость шага, м/с
 *   - `wait`  — сколько стоять на точке, сек
 *   - `face`  — начальный поворот
 * @returns {object} NPC
 */
export function createNpc(ctx, cfg) {
  const route = (cfg.route || []).map((p) => ({ x: p.x, z: p.z }));
  const model = cfg.model;
  const speed = cfg.speed ?? 0.9;
  const wait = cfg.wait ?? 2.2;

  const npc = {
    id: cfg.id || 'npc',
    name: cfg.name || 'Незнакомец',
    title: cfg.title || '',
    group: model.group,
    /** Позиция в мире (плавающая точка). */
    x: route.length ? route[0].x : 0,
    z: route.length ? route[0].z : 0,
    /** Поворот: 0 — вдоль +z. */
    yaw: cfg.face ?? 0,
    state: 'idle',
    /** Скучно ли: стоит и ждёт. */
    idleTime: 0,
    /** Индекс точки маршрута. */
    point: 0,
    /** Направление обхода маршрута. */
    dir: 1,
    /** Ушёл ли по ночи. */
    away: false,
    /** Идёт ли к двери, чтобы уйти. */
    leaving: false,
    /** Скорость (для анимации). */
    curSpeed: 0,
    /** Говорит ли сейчас с игроком. */
    talking: false,
    /** Точка, куда смотрит (игрок). */
    lookAt: null,
  };

  model.group.position.set(npc.x, 0, npc.z);
  model.group.rotation.y = npc.yaw;

  /** Целевая точка маршрута. */
  function target() {
    if (!route.length) return null;
    return route[(npc.point + npc.dir + route.length) % route.length];
  }

  /** Плавный поворот к цели. */
  function turnTo(angle, dt) {
    let d = angle - npc.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    npc.yaw += d * Math.min(1, dt * 7);
    model.group.rotation.y = npc.yaw;
  }

  /**
   * Обновление NPC.
   *
   * @param {number} dt кадр в секундах
   * @param {number} t  мировое время
   * @param {object|null} playerPos где игрок (чтобы смотреть на него)
   */
  function update(dt, t, playerPos = null) {
    if (npc.away && !npc.leaving) {
      model.group.visible = false;
      npc.curSpeed = 0;
      return;
    }
    model.group.visible = true;

    // Уход через дверь: персонаж идёт к своей двери и только там пропадает.
    if (npc.away && cfg.exit) {
      const dx = cfg.exit.x - npc.x;
      const dz = cfg.exit.z - npc.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.16) {
        model.group.visible = false;     // ушёл за дверь
        npc.leaving = false;
        npc.curSpeed = 0;
        return;
      }
      const step = Math.min(dist, speed * 2.2 * dt);
      npc.x += (dx / dist) * step;
      npc.z += (dz / dist) * step;
      npc.curSpeed = speed;
      npc.state = 'walk';
      turnTo(Math.atan2(dx, dz), dt);
      model.group.position.x = npc.x;
      model.group.position.z = npc.z;
      return;
    }

    let moving = false;
    if (npc.talking) {
      // стоит и смотрит на игрока
      npc.curSpeed = 0;
      if (playerPos) {
        const a = Math.atan2(playerPos.x - npc.x, playerPos.z - npc.z);
        turnTo(a, dt);
      }
    } else if (route.length) {
      const tg = target();
      if (tg) {
        const dx = tg.x - npc.x;
        const dz = tg.z - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.12) {
          // дошли: постоять и пойти дальше
          npc.state = 'idle';
          npc.idleTime += dt;
          npc.curSpeed = 0;
          // на отдыхе смотрит в зал, а не в стену
          if (cfg.face !== undefined) turnTo(cfg.face, dt);
          if (npc.idleTime >= wait) {
            npc.idleTime = 0;
            npc.point += npc.dir;
            if (npc.point >= route.length) { npc.point = 0; npc.dir = 1; }
            if (npc.point < 0) { npc.point = route.length - 1; npc.dir = -1; }
          }
        } else {
          npc.state = 'walk';
          moving = true;
          const step = Math.min(dist, speed * dt);
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
          npc.curSpeed = speed;
          turnTo(Math.atan2(dx, dz), dt);
        }
      }
    }

    model.group.position.x = npc.x;
    model.group.position.z = npc.z;

    // голова следит за игроком, когда тот рядом
    let lookYaw = 0;
    if (playerPos) {
      const a = Math.atan2(playerPos.x - npc.x, playerPos.z - npc.z);
      let d = a - npc.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      lookYaw = Math.max(-0.7, Math.min(0.7, d));
    }
    model.update(dt, t, {
      speed: npc.curSpeed,
      moving,
      talking: npc.talking,
      lookYaw,
    });
  }

  /**
   * Убрать или вернуть персонажа.
   *
   * @param {boolean} away true — персонажа нет на месте
   */
  function setAway(away) {
    away = !!away;
    // Состояние не менялось — ничего не трогаем. Раньше здесь каждый кадр
    // сбрасывалась позиция на первую точку маршрута, и днём персонаж не мог
    // уйти с маршрута, а ушедший к двери — «откатывался» назад.
    if (away === npc.away) return;
    npc.away = away;
    if (away) {
      npc.talking = false;
      npc.curSpeed = 0;
      // если указана дверь — персонаж сначала доходит до неё
      npc.leaving = !!cfg.exit;
      model.group.visible = true;
    } else {
      npc.leaving = false;
      model.group.visible = true;
      // вернулся — снова за стойку (на первую точку маршрута)
      if (route.length) {
        npc.x = route[0].x;
        npc.z = route[0].z;
        npc.point = 0;
        npc.dir = 1;
        npc.idleTime = 0;
        model.group.position.set(npc.x, 0, npc.z);
      }
    }
  }

  return {
    ...npc,
    get x() { return npc.x; },
    get z() { return npc.z; },
    get yaw() { return npc.yaw; },
    get state() { return npc.state; },
    get away() { return npc.away; },
    get talking() { return npc.talking; },
    set talking(v) { npc.talking = !!v; },
    update,
    setAway,
    /** Начать/ закончить разговор. */
    talk(on) { npc.talking = !!on; },
  };
}
