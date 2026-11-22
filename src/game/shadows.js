/**
 * ============================================================================
 *  Тени: то, что живёт в темноте подземелья
 * ============================================================================
 *
 *  Шесть теней: четыре в кристальном зале и два стража у Врат. Навигации
 *  нет — они идут напрямую к игроку и «скользят» вдоль стен, если упираются.
 *
 *  Ключевое правило: **пока факел горит, тень не подходит ближе 2,8 м**.
 *  Это не «пугаются», а жёсткое ограничение — так правило читается честно.
 *  Если факел погас и игрок не ранен, тень бросается.
 *
 *  Тени не убивают. У них три «veil»-единицы, их можно сбить ударом
 *  бранда или отбросить вспышкой; когда veil кончается, тень рассеивается.
 *
 *  @module game/shadows
 */

import * as THREE from 'three';
import { shadowModel } from '../world/creature.js';

/** Параметры теней. */
export const SHADOW = {
  count: 6,
  veil: 3,
  hp: 40,                  // здоровье: его снимают обычным оружием
  stalkSpeed: 1.15,        // крадучи
  stalkSpeedDark: 1.45,    // в темноте быстрее
  lungeSpeed: 3.4,
  lungeTime: 1.1,
  aggroLit: 18,            // радиус агро, когда факел горит
  aggroDark: 24,           // в темноте слышат дальше
  lungeRange: 4.5,         // с какого расстояния бросаются
  contact: 1.15,           // дистанция удара
  keepDistance: 2.8,       // не подходят ближе при горящем факеле
  lairRadius: 14,          // легенда: не уходят дальше от своего места
  stun: 0.9,               // оглушение от удара
  flareStun: 0.7,          // оглушение от вспышки
  knock: 2.5,              // отбрасывание, м/с
  strikeKnock: 1.3,
  dissolve: 0.8,           // время рассеяния
  damage: 6,               // урон игроку
  pushPlayer: 1.6,         // выталкивание игрока
  playerStun: 0.9,
  invuln: 1.5,             // неуязвимость после удара
  woundedAt: 25,           // ниже этого HP тени не бросаются
  slowWhenWounded: 0.85,
  safeZ: -20,              // входной зал (z < −20) — зона безопасности
};

/** Точки появления: X, Y, Z. */
const SPAWNS = [
  [-9.4, 0, -17.8],
  [8.6, 0, -16.0],
  [-11.5, 0, -2.0],
  [12.0, 0, 1.5],
  [-5.6, -4.6, 28.0],
  [5.6, -4.6, 28.0],
];

/**
 * Создать систему теней.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система теней
 */
export function createShadows(ctx) {
  /** @type {object[]} */
  const list = [];
  let playerInvuln = 0;
  let playerStun = 0;

  const _v = new THREE.Vector3();

  /**
   * Коллайдеры подземелья (они живут в отдельной сцене локации).
   *
   * @returns {object[]} список прямоугольников
   */
  function dungeonBoxes() {
    const loc = ctx.systems.locations;
    if (!loc || !loc.dungeonLoc || !loc.dungeonLoc.colliders) return [];
    return loc.dungeonLoc.colliders.boxes || [];
  }

  /**
   * Свободно ли в точке (по коллайдерам подземелья).
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @param {number} r радиус тени
   * @returns {boolean} свободно ли
   */
  function freeSpot(x, z, r = 0.45) {
    for (const b of dungeonBoxes()) {
      const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
      const dx = x - b.cx, dz = z - b.cz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      if (Math.hypot(lx - qx, lz - qz) < r + 0.15) return false;
    }
    return true;
  }

  /**
   * Выбрать направление движения, в котором не упрёшься в стену.
   *
   * @param {object} s тень
   * @param {number} dir желаемое направление
   * @param {number} ahead как далеко проверять
   * @returns {number} угол
   */
  function pickDir(s, dir, ahead = 0.9) {
    const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, Math.PI];
    for (const o of offs) {
      const a = dir + o;
      const nx = s.x + Math.cos(a) * ahead;
      const nz = s.z + Math.sin(a) * ahead;
      if (freeSpot(nx, nz)) return a;
    }
    return dir + Math.PI;
  }

  /**
   * Создать одну тень.
   *
   * @param {number[]} p точка появления [x, y, z]
   * @param {number} idx номер
   * @returns {object} тень
   */
  function makeShadow(p, idx) {
    const model = shadowModel(ctx.M);
    const s = {
      idx,
      model,
      group: model.group,
      x: p[0], y: p[1], z: p[2],
      home: { x: p[0], z: p[2] },
      veil: SHADOW.veil,
      hp: SHADOW.hp,
      state: 'sleep',
      stun: 0,
      dissolve: 0,
      lungeT: 0,
      fade: 1,
      dir: Math.random() * Math.PI * 2,
      isGuard: idx >= 4,
    };
    s.group.position.set(s.x, s.y, s.z);
    list.push(s);
    return s;
  }

  /**
   * Поставить всех теней на места.
   */
  function spawn() {
    clear();
    const loc = ctx.systems.locations;
    if (!loc || !loc.dungeonLoc) return;
    loc.sceneDungeon.add(ctx.sceneDungeonShadowRoot || (ctx.sceneDungeonShadowRoot = new THREE.Group()));
    for (const p of SPAWNS) {
      const s = makeShadow(p, list.length);
      ctx.sceneDungeonShadowRoot.add(s.group);
    }
  }

  /**
   * Убрать всех теней.
   */
  function clear() {
    for (const s of list) {
      if (s.group.parent) s.group.parent.remove(s.group);
    }
    list.length = 0;
    if (ctx.sceneDungeonShadowRoot) {
      ctx.sceneDungeonShadowRoot.clear();
    }
  }

  /**
   * Шум: привлечь ближайших теней.
   *
   * @param {THREE.Vector3} pos где шум
   * @param {number} radius радиус шума
   */
  function makeNoise(pos, radius) {
    for (const s of list) {
      if (s.veil <= 0) continue;
      if (Math.hypot(s.x - pos.x, s.z - pos.z) > radius) continue;
      if (s.state === 'sleep') s.state = 'stalk';
    }
  }

  /**
   * Тень под прицелом: ближайшая в конусе (для HUD — пипсов и подсказки).
   *
   * @param {THREE.Vector3} org начало луча (камера)
   * @param {THREE.Vector3} dir направление взгляда
   * @param {number} range дальность
   * @param {number} cone половина угла конуса
   * @returns {object|null} тень или null
   */
  function aimTarget(org, dir, range, cone) {
    let best = null, bestD = Infinity;
    for (const s of list) {
      if (s.veil <= 0) continue;
      const dx = s.x - org.x, dz = s.z - org.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1e-3) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot < Math.cos(cone)) continue;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /**
   * Удар брандом: ищем ближайшую тень в конусе и гасим у неё veil.
   *
   * @param {THREE.Vector3} org начало луча (камера)
   * @param {THREE.Vector3} dir направление взгляда
   * @param {number} range дальность
   * @param {number} cone половина угла конуса
   * @returns {boolean} попали ли
   */
  function strike(org, dir, range, cone) {
    let best = null, bestD = Infinity;
    for (const s of list) {
      if (s.veil <= 0) continue;
      const dx = s.x - org.x, dz = s.z - org.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1e-3) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot < Math.cos(cone)) continue;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) {
      makeNoise(org, 12);       // удар в стену слышно дальше
      return false;
    }
    best.veil -= 1;
    best.stun = SHADOW.stun;
    best.state = 'recoil';
    // отбрасывание от игрока
    const dx = best.x - org.x, dz = best.z - org.z;
    const d = Math.hypot(dx, dz) || 1;
    best.vx = (dx / d) * SHADOW.strikeKnock * 3;
    best.vz = (dz / d) * SHADOW.strikeKnock * 3;
    if (best.veil <= 0) {
      best.dissolve = SHADOW.dissolve;
      if (ctx.ambience) ctx.ambience.dissolve();
    } else if (ctx.ambience) {
      ctx.ambience.hiss();
    }
    makeNoise(org, 8);
    return true;
  }

  /**
   * Удар оружием: ищем ближайшую тень в конусе и снимаем здоровье.
   *
   * Бранд гасит «veil» — стойкость тени. Оружие бьёт по здоровью. Когда
   * здоровье кончилось, тень рассыпается, как и после третьего удара
   * брандом. Так у игрока есть два пути: тихий и быстрый.
   *
   * @param {THREE.Vector3} org начало луча (камера)
   * @param {THREE.Vector3} dir направление взгляда
   * @param {number} range дальность
   * @param {number} cone половина угла конуса
   * @param {number} dmg урон
   * @returns {{hit: boolean, killed: boolean}}
   */
  function hit(org, dir, range, cone, dmg) {
    let best = null, bestD = Infinity;
    for (const s of list) {
      if (s.veil <= 0 || s.hp <= 0) continue;
      const dx = s.x - org.x, dz = s.z - org.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 1e-3) continue;
      const dot = (dx / d) * dir.x + (dz / d) * dir.z;
      if (dot < Math.cos(cone)) continue;
      if (d < bestD) { bestD = d; best = s; }
    }
    if (!best) {
      makeNoise(org, 10);       // удар мимо слышно
      return { hit: false, killed: false };
    }
    best.hp -= dmg;
    best.stun = SHADOW.stun * 0.7;
    best.state = 'recoil';
    // отбрасывание — слабее, чем от бранда
    const dx = best.x - org.x, dz = best.z - org.z;
    const d = Math.hypot(dx, dz) || 1;
    best.vx = (dx / d) * SHADOW.strikeKnock * 1.4;
    best.vz = (dz / d) * SHADOW.strikeKnock * 1.4;
    let killed = false;
    if (best.hp <= 0) {
      killed = true;
      best.veil = 0;
      best.dissolve = SHADOW.dissolve;
      if (ctx.ambience) ctx.ambience.dissolve();
    } else if (ctx.ambience) {
      ctx.ambience.hiss();
    }
    makeNoise(org, 6);
    return { hit: true, killed };
  }

  /**
   * Вспышка: отбрасывает всех вблизи.
   *
   * @param {THREE.Vector3} pos центр вспышки
   * @param {number} radius радиус
   * @param {number} knock сила отбрасывания
   * @param {number} stun оглушение
   * @param {number} noise радиус шума (вспышка зовёт остальных)
   */
  function flare(pos, radius, knock, stun, noise) {
    for (const s of list) {
      if (s.veil <= 0) continue;
      const dx = s.x - pos.x, dz = s.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      s.stun = stun;
      s.state = 'recoil';
      const l = d || 1;
      s.vx = (dx / l) * knock * 3;
      s.vz = (dz / l) * knock * 3;
    }
    makeNoise(pos, noise);
  }

  /**
   * Тень ударила игрока.
   *
   * @param {object} s тень
   */
  /** Бой приостановлен (игрок погиб или загрузка новой игры). */
  let paused = false;

  function hitPlayer(s) {
    if (playerInvuln > 0) return;
    const stats = ctx.stats;
    stats.damage(SHADOW.damage);
    // Здоровье может упасть до нуля — тогда игрок погибает.
    if (stats.hp <= 0) {
      stats.hp = 0;
      if (ctx.systems && ctx.systems.death) {
        ctx.systems.death.kill('Тень забрала вас в пещере. Тьма сомкнулась.');
      }
      return;
    }
    playerInvuln = SHADOW.invuln;
    playerStun = SHADOW.playerStun;
    // вытолкнуть игрока
    const dx = ctx.player.pos.x - s.x, dz = ctx.player.pos.z - s.z;
    const d = Math.hypot(dx, dz) || 1;
    ctx.player.pos.x += (dx / d) * SHADOW.pushPlayer;
    ctx.player.pos.z += (dz / d) * SHADOW.pushPlayer;
    // огонь в руке гаснет, но топливо остаётся
    if (ctx.systems.combat && ctx.systems.combat.state.lit) {
      ctx.systems.combat.state.lit = false;
      ctx.systems.combat.brand.setLit(false);
      if (ctx.ambience) ctx.ambience.torchOut();
      if (ctx.ui) ctx.ui.toast('Факел погас от удара. Ищи огонь.', 2400);
    }
    if (ctx.ambience) ctx.ambience.hurt();
    if (ctx.ui && ctx.ui.flashDamage) ctx.ui.flashDamage();
  }

  /**
   * Обновление всех теней.
   *
   * @param {number} dt кадр
   * @param {number} t время
   */
  function update(dt, t) {
    if (paused) return;
    if (!list.length) return;
    playerInvuln = Math.max(0, playerInvuln - dt);
    playerStun = Math.max(0, playerStun - dt);

    const combat = ctx.systems.combat;
    const lit = combat ? combat.state.lit : false;
    const aggro = lit ? SHADOW.aggroLit : SHADOW.aggroDark;
    const px = ctx.player.pos.x, pz = ctx.player.pos.z;
    const hp = ctx.stats.hp;
    const wounded = hp <= SHADOW.woundedAt;
    let threat = 0;

    for (const s of list) {
      // рассеяние
      if (s.dissolve > 0) {
        s.dissolve -= dt;
        s.fade = Math.max(0, s.dissolve / SHADOW.dissolve);
        s.group.scale.setScalar(0.35 + s.fade * 0.65);
        s.model.update(t, dt);
        if (s.dissolve <= 0) {
          s.veil = 0;
          s.group.visible = false;
        }
        continue;
      }

      const dx = px - s.x, dz = pz - s.z;
      const dist = Math.hypot(dx, dz);

      // состояния
      if (s.stun > 0) {
        s.stun -= dt;
        if (s.stun <= 0) s.state = 'stalk';
      } else if (s.state === 'recoil') {
        s.state = 'stalk';
      } else if (s.state === 'sleep') {
        if (dist < aggro) s.state = 'stalk';
      } else if (s.state === 'stalk') {
        // бросок: факел погас, игрок не ранен, расстояние небольшое
        const inShaft = s.z > 6 && s.z < 14;         // узкая шахта: бросок невозможен
        if (!lit && !wounded && !inShaft && dist < SHADOW.lungeRange && dist > 0.8) {
          s.state = 'lunge';
          s.lungeT = SHADOW.lungeTime;
        } else if (dist > aggro * 1.35) {
          s.state = 'sleep';
        }
      } else if (s.state === 'lunge') {
        s.lungeT -= dt;
        if (s.lungeT <= 0 || lit || wounded) s.state = 'stalk';
      }

      // движение
      let speed = 0;
      let tx = s.x, tz = s.z;
      if (s.state === 'sleep') {
        // дрейф вокруг логовища
        s.dir += (Math.random() - 0.5) * dt * 2.2;
        const toHome = Math.hypot(s.x - s.home.x, s.z - s.home.z);
        if (toHome > SHADOW.lairRadius) {
          tx = s.home.x; tz = s.home.z;
          speed = 0.8;
        } else {
          tx = s.x + Math.cos(s.dir) * 1.4;
          tz = s.z + Math.sin(s.dir) * 1.4;
          speed = 0.25;
        }
      } else if (s.state === 'stalk') {
        speed = lit ? SHADOW.stalkSpeed : SHADOW.stalkSpeedDark;
        if (wounded) speed *= SHADOW.slowWhenWounded;
        // не подходим ближе, пока горит факел: шаг, который нарушил бы
        // правило, просто не делаем
        if (lit && dist - speed * dt < SHADOW.keepDistance) speed = 0;
        tx = px; tz = pz;
      } else if (s.state === 'lunge') {
        speed = SHADOW.lungeSpeed;
        tx = px; tz = pz;
      } else if (s.state === 'recoil') {
        // отлетает
        const vx = s.vx || 0, vz = s.vz || 0;
        s.vx = vx * Math.pow(0.02, dt);
        s.vz = vz * Math.pow(0.02, dt);
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        tx = s.x; tz = s.z;
      }

      if (s.state !== 'recoil' && speed > 0) {
        const ang = Math.atan2(tz - s.z, tx - s.x);
        const dir2 = pickDir(s, ang, 0.9);
        const nx = s.x + Math.cos(dir2) * speed * dt;
        const nz = s.z + Math.sin(dir2) * speed * dt;
        // зона безопасности: входной зал закрыт
        const tooNorth = nz < SHADOW.safeZ && s.z >= SHADOW.safeZ;
        if (freeSpot(nx, nz) && !tooNorth) {
          s.x = nx; s.z = nz;
        } else if (!freeSpot(nx, nz)) {
          // упёрлись: пробуем скользить вдоль стены
          const slide = pickDir(s, ang + Math.PI / 2, 0.9);
          const sx = s.x + Math.cos(slide) * speed * dt;
          const sz = s.z + Math.sin(slide) * speed * dt;
          if (freeSpot(sx, sz)) { s.x = sx; s.z = sz; }
        }
      }

      // разворот к игроку
      if (s.state === 'stalk' || s.state === 'lunge') {
        const want = Math.atan2(px - s.x, pz - s.z);
        let d = want - s.group.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        s.group.rotation.y += d * Math.min(1, dt * 6);
      }

      // Контакт с игроком.
      //
      // Бросок — это внезапный наскок, и раненого (HP ≤ 25) в списке
      // «не догоняют»: тень не бросается сама. Но если она уже подошла
      // вплотную, она бьёт — иначе раненый был бы бессмертным, а значит
      // и смерть в пещере была бы невозможна.
      if (s.state === 'lunge' && dist < SHADOW.contact) {
        hitPlayer(s);
        s.state = 'recoil';
        const l = dist || 1;
        s.vx = (dx / l) * SHADOW.knock * 3;
        s.vz = (dz / l) * SHADOW.knock * 3;
        s.stun = SHADOW.stun;
      } else if (s.state === 'stalk' && dist < SHADOW.contact * 0.75) {
        hitPlayer(s);
      }

      // угроза для HUD
      if (s.state === 'stalk' || s.state === 'lunge') {
        threat = Math.max(threat, 1 - Math.min(1, dist / 12));
        // из темноты доносится шёпот — редко, чтобы не надоедало
        if (dist < 9 && Math.random() < 0.004 && ctx.ambience) {
          ctx.ambience.whisper(0.7 + (1 - dist / 9) * 0.5);
        }
      }

      s.group.position.set(s.x, s.y, s.z);
      s.model.update(t, dt);
    }

    ctx.shadowThreat = threat;
    ctx.playerStunned = playerStun;
  }

  /**
   * Рассеяны ли оба стража у Врат.
   *
   * @returns {boolean} да
   */
  function guardsCleared() {
    const guards = list.filter((s) => s.isGuard);
    return guards.length > 0 && guards.every((s) => s.veil <= 0);
  }

  /**
   * Сколько стражей ещё целы.
   *
   * @returns {number} число
   */
  function guardsLeft() {
    return list.filter((s) => s.isGuard && s.veil > 0).length;
  }

  return {
    list, spawn, clear, update, strike, hit, flare, makeNoise, aimTarget,
    guardsCleared, guardsLeft,
    /** Заморозить тени (игрок погиб — бой окончен). */
    pause() { paused = true; },
    /** Разбудить тени обратно. */
    resume() { paused = false; },
    get playerInvuln() { return playerInvuln; },
    get playerStun() { return playerStun; },
  };
}
