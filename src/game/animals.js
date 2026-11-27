/**
 * ============================================================================
 *  Животные: куры, овцы, утки, пёс и кот
 * ============================================================================
 *
 *  Животные — не декорация: они занимают место в мире. Каждое из них:
 *
 *   * имеет собственную анимацию (`userData.update`);
 *   * обходит препятствия (`pickDir` ищет свободное направление, `unstick`
 *     выталкивает наружу, если животное всё же застряло);
 *   * является настоящим препятствием для игрока (круг в `animalCircles`).
 *
 *  Пёс умеет больше остальных: ищет путь по сетке карты (A*), выполняет
 *  команды игрока («следовать», «стоять», «идти туда», «прыгнуть») и
 *  прыгает.
 *
 *  @module game/animals
 */

import * as THREE from 'three';
import { chicken, sheep, duck, dog, cat } from '../world/animals.js';
import { POND } from './terrain.js';

/**
 * Создаёт систему животных.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система животных
 */
export function createAnimalsSystem(ctx) {

  /* ================================================================
   *  Поиск свободного места и обход препятствий
   * ================================================================ */

  /**
   * Свободно ли место для животного (с запасом на его размер).
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @param {number} [r] радиус животного
   * @returns {boolean} true, если место свободно
   */
  function freeSpot(x, z, r = 0.4) {
    for (const b of ctx.colliders.boxes) {
      const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
      const dx = x - b.cx, dz = z - b.cz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      if (Math.hypot(lx - qx, lz - qz) < r + 0.2) return false;
    }
    for (const c of ctx.colliders.circles) {
      if (c.r < 0.14) continue;                 // совсем мелкие предметы
      if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    }
    return true;
  }

  /**
   * Подбирает направление, в котором животное не упрётся в стену, забор или дерево.
   *
   * @param {THREE.Object3D} g животное
   * @param {number} dir текущее направление
   * @param {number} [ahead] насколько вперёд проверять
   * @param {number} [r] радиус животного
   * @returns {number} безопасное направление
   */
  function pickDir(g, dir, ahead = 0.9, r = 0.4) {
    const offs = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.2, -2.2, Math.PI];
    for (const o of offs) {
      const a = dir + o;
      const nx = g.position.x + Math.cos(a) * ahead;
      const nz = g.position.z + Math.sin(a) * ahead;
      if (freeSpot(nx, nz, r)) return a;
    }
    return dir + Math.PI;
  }

  /**
   * Если животное оказалось внутри препятствия — выталкиваем наружу.
   *
   * @param {THREE.Object3D} g животное
   * @param {number} [r] радиус животного
   */
  function unstick(g, r = 0.4) {
    if (freeSpot(g.position.x, g.position.z, r)) return;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const nx = g.position.x + Math.cos(a) * 1.2;
      const nz = g.position.z + Math.sin(a) * 1.2;
      if (freeSpot(nx, nz, r)) {
        g.position.x = nx; g.position.z = nz;
        return;
      }
    }
  }

  /* ================================================================
   *  Появление животных
   * ================================================================ */

  /** Расставить животных по деревне. */
  function build() {
    const critters = ctx.critters;

    // куры — в своём загоне у курятника: отдельная зона, не мельница и не пруд
    const yard = ctx.henyard || { x: -16, z: 22, w: 6, d: 8 };
    const henArea = { x: yard.x, z: yard.z, r: 2.2 };
    for (let i = 0; i < 4; i++) {
      const g = chicken(i);
      g.name = 'chicken';
      const a = (i / 4) * Math.PI * 2 + 0.6;
      g.position.set(henArea.x + Math.cos(a) * (0.9 + i * 0.35), 0, henArea.z + Math.sin(a) * (0.9 + i * 0.35));
      g.rotation.y = a + 1.2;
      ctx.scene.add(g);
      ctx.critters.hens.push({ g, dir: a + 1.2, speed: 0.20 + (i % 3) * 0.04, t: i * 1.9, area: henArea, moving: false });
      ctx.animalCircles.push({ x: g.position.x, z: g.position.z, r: 0.24, g });
    }

    // овцы — на пастбище: своя огороженная земля, где они пасутся и сидят
    const pasture = ctx.pasture || { x: -45, z: 31, graze: [{ x: -43, z: 29 }], rest: { x: -49, z: 31 } };
    const sheepArea = { x: pasture.x + 1.5, z: pasture.z, r: 4.6 };
    for (let i = 0; i < 3; i++) {
      const g = sheep(i === 1);          // средний — баран с рогами
      g.name = 'sheep';
      const spot = pasture.graze[i % pasture.graze.length];
      const a = (i / 3) * Math.PI * 2 + 1.4;
      g.position.set(spot.x + Math.cos(a) * 0.6, 0, spot.z + Math.sin(a) * 0.6);
      g.rotation.y = a;
      ctx.scene.add(g);
      ctx.critters.sheep.push({
        g, dir: a, speed: 0.12 + (i % 2) * 0.03, t: i * 2.7,
        area: sheepArea, moving: false, rest: pasture.rest,
      });
      ctx.animalCircles.push({ x: g.position.x, z: g.position.z, r: 0.42, g });
    }

    // утки — на пруду
    const pond = { x: POND.x, z: POND.z, r: 11.7 };
    for (let i = 0; i < 3; i++) {
      const g = duck();
      g.name = 'duck';
      g.scale.setScalar(1.45);
      const a = (i / 3) * Math.PI * 2;
      g.position.set(pond.x + Math.cos(a) * 6.4, 0.0, pond.z + Math.sin(a) * 6.4);
      g.rotation.y = -a + Math.PI / 2;
      ctx.scene.add(g);
      ctx.critters.ducks.push({ g, a, r: 5.6 + i * 0.9, w: 0.16 + i * 0.03, t: i * 2.1, pond });
    }

    // собака — у дома с табличкой (там доска у дороги к скале).
    // Раньше она стояла у трактира, а ждать шла к дому хозяина, которое
    // менялось вместе с локацией; теперь дом у пса один и постоянный.
    {
      const g = dog();
      g.name = 'dog';
      const homeDoor = (ctx.doors.homes || [])[ctx.boardHome];
      const DOG_HOME = homeDoor ? { x: homeDoor.x, z: homeDoor.z } : { x: -7.2, z: -5.4 };
      const dogRy = homeDoor ? homeDoor.ry : -2.2;
      g.position.set(DOG_HOME.x, 0, DOG_HOME.z);
      g.rotation.y = dogRy;
      ctx.scene.add(g);
      ctx.critters.dog = {
        g, dir: dogRy, speed: 0.55, t: 0, home: DOG_HOME, r: 7, moving: false,
        mode: 'follow',          // 'follow' | 'stay' | 'goto' | 'wait'
        target: null, jumpT: 0, cmd: 'Ходит за хозяином',
      };
      ctx.animalCircles.push({ x: g.position.x, z: g.position.z, r: 0.32, g });
      // «Е» на псе — панель команд
      const dogIt = {
        pos: new THREE.Vector3(g.position.x, 0.7, g.position.z),
        radius: 2.1, label: 'Дать команду псу', act: () => openDogMenu(),
      };
      ctx.interactables.push(dogIt);
      ctx.critters.dog.interact = dogIt;
    }

    // кот — на крыльце одного из домов. Крыльцо ищем по-настоящему:
    // раньше здесь была зашитая координата несуществующего дома, и кот
    // оказывался внутри стен, а потом просто пропадал.
    {
      const g = cat();
      g.name = 'cat';
      let porch = null, bestD = 1e9;
      for (const h of ctx.homes || []) {
        const door = (ctx.doors.homes || [])[h.i];
        if (!door) continue;
        for (const p of ctx.platforms) {
          if (p.y < 0.4 || p.y > 0.8) continue;          // это крыльцо, а не пол
          const dd = Math.hypot(p.cx - door.x, p.cz - door.z);
          if (dd < bestD && dd < 3.2) { bestD = dd; porch = p; }
        }
      }
      const px = porch ? porch.cx : -11.2, pz = porch ? porch.cz : 12.0;
      const pang = porch ? (porch.ang || 0) : -0.7;
      // смещение вдоль края крыльца (в его локальных осях) и поворот наружу
      const ox = 0.5, oz = -0.32;   // ближе к краю крыльца, лицом в сторону двора
      g.position.set(
        px + ox * Math.cos(pang) + oz * Math.sin(pang),
        0.48,
        pz - ox * Math.sin(pang) + oz * Math.cos(pang),
      );
      g.rotation.y = pang + Math.PI;
      g.scale.setScalar(1.22);
      ctx.scene.add(g);
      ctx.critters.cat = { g, t: 0 };
      ctx.colliders.circles.push({ x: g.position.x, z: g.position.z, r: 0.18 });
      // «Е» на кота — погладить
      ctx.systems.interactions.add(
        new THREE.Vector3(g.position.x, 0.75, g.position.z),
        1.7, 'Погладить кота',
        () => {
          g.userData.pet && g.userData.pet();
          ctx.ambience.meow(0.9);
          ctx.ui.toast('Кот довольно заурчал и подставил голову под ладонь.', 2200);
        },
      );
    }
  }

  /* ================================================================
   *  Поведение
   * ================================================================ */

  /**
   * Обновить всех животных.
   *
   * @param {number} dt время кадра
   * @param {number} t общее время игры
   */
  function update(dt, t) {
    const critters = ctx.critters;
    const pd = ctx.player.pos;

    // куры щиплют траву и разбегаются, если подойти
    for (const h of ctx.critters.hens) {
      h.t += dt;
      const a = h.area;
      let spd = h.speed * (Math.sin(h.t * 0.6) > 0.9 ? 0 : 1);
      const pdx = h.g.position.x - pd.x, pdz = h.g.position.z - pd.z;
      if (pdx * pdx + pdz * pdz < 2.8 * 2.8) {
        h.dir = Math.atan2(pdz, pdx);
        spd = h.speed * 3.6;
      }
      h.moving = spd > 0.01;
      if (h.moving) {
        h.dir = pickDir(h.g, h.dir, 0.8, 0.3);
        h.g.position.x += Math.cos(h.dir) * spd * dt;
        h.g.position.z += Math.sin(h.dir) * spd * dt;
      }
      const dx = h.g.position.x - a.x, dz = h.g.position.z - a.z;
      if (Math.hypot(dx, dz) > a.r) {
        h.dir = Math.atan2(-dz, -dx);
        h.g.position.x = a.x + dx * 0.94;
        h.g.position.z = a.z + dz * 0.94;
      }
      unstick(h.g, 0.3);
      h.g.rotation.y = -h.dir + Math.PI / 2;
      h.g.userData.update(dt, h.t, h.moving);
    }

    // овцы пасутся на выпасе, изредка переступают — и иногда уходят отдыхать
    // под навес, где сухо
    for (const s3 of ctx.critters.sheep) {
      s3.t += dt;
      const a = s3.area;
      // раз в полминуты овца решает: пастись или отдыхать
      s3.restT = (s3.restT ?? 6 + s3.t * 0.7) - dt;
      if (s3.restT <= 0) {
        s3.restT = 26 + Math.random() * 30;
        s3.wantsRest = !s3.wantsRest;
      }
      const rest = s3.rest;
      const dRest = rest ? Math.hypot(rest.x - s3.g.position.x, rest.z - s3.g.position.z) : 99;
      let spd = s3.speed * (Math.sin(s3.t * 0.22) > 0.86 ? 1 : 0);
      s3.moving = spd > 0.01;
      if (s3.wantsRest && rest && dRest > 1.1) {
        // идём к навесу
        s3.dir = Math.atan2(rest.z - s3.g.position.z, rest.x - s3.g.position.x);
        spd = s3.speed * 1.5;
        s3.moving = true;
      }
      if (s3.moving) {
        if (!s3.wantsRest) {
          s3.dir += (Math.sin(s3.t * 0.5) * 0.9 - s3.dir) * dt * 0.6;
        }
        s3.dir = pickDir(s3.g, s3.dir, 1.0, 0.42);
        s3.g.position.x += Math.cos(s3.dir) * spd * dt;
        s3.g.position.z += Math.sin(s3.dir) * spd * dt;
        const dx = s3.g.position.x - a.x, dz = s3.g.position.z - a.z;
        if (Math.hypot(dx, dz) > a.r) {
          s3.dir = Math.atan2(-dz, -dx);
          s3.g.position.x = a.x + dx * 0.9;
          s3.g.position.z = a.z + dz * 0.9;
        }
        s3.g.rotation.y = -s3.dir + Math.PI / 2;
      }
      // дошли до навеса — ложимся
      s3.resting = !!(s3.wantsRest && rest && dRest <= 1.3);
      unstick(s3.g, 0.42);
      s3.g.userData.update(dt, s3.t, s3.moving, s3.resting);
    }

    // утки бродят по пруду: плывут к цели, чистят пёрышки и пугаются игрока
    for (const d of ctx.critters.ducks) {
      d.t += dt;
      const dpx = pd.x - d.g.position.x, dpz = pd.z - d.g.position.z;
      const pdist = Math.hypot(dpx, dpz);
      const near = pdist < 7;

      // выбираем цель: от игрока — прочь, иначе блуждаем по пруду
      d.retarget = (d.retarget ?? 0) - dt;
      if (d.retarget <= 0 || d.tx === undefined) {
        d.retarget = 3 + Math.random() * 5;
        if (near) {
          const ang = Math.atan2(-dpz, -dpx) + (Math.random() - 0.5) * 0.9;
          d.tx = d.pond.x + Math.cos(ang) * d.r;
          d.tz = d.pond.z + Math.sin(ang) * d.r;
        } else {
          const ang = Math.random() * Math.PI * 2;
          const rr = 3.4 + Math.random() * 6.2;
          d.tx = d.pond.x + Math.cos(ang) * rr;
          d.tz = d.pond.z + Math.sin(ang) * rr;
        }
      }
      const tx = d.tx - d.g.position.x, tz = d.tz - d.g.position.z;
      const tl = Math.hypot(tx, tz);

      // плавно разворачиваемся к цели
      const want = Math.atan2(tz, tx);
      let diff = want - (d.heading ?? want);
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      d.heading = (d.heading ?? want) + diff * Math.min(1, dt * 2.4);

      // скорость плывания: быстрее, если игрок рядом
      const edge = Math.hypot(d.g.position.x - d.pond.x, d.g.position.z - d.pond.z);
      let spd = near ? 0.62 : 0.26 + 0.1 * Math.sin(d.t * 0.7 + d.a);
      if (edge > d.r + 2.2) spd *= 0.45;         // у самого берега — тише
      if (tl < 0.7) spd *= 0.35;                // подплыли — тормозим
      d.g.position.x += Math.cos(d.heading) * spd * dt;
      d.g.position.z += Math.sin(d.heading) * spd * dt;
      // нос по курсу (у утки морда в +z)
      d.g.rotation.y = Math.PI / 2 - d.heading;
      d.g.userData.update(dt, d.t + d.a, spd, near);
    }

    // собака: ходит за хозяином по настоящему маршруту (A* по сетке карты),
    // а если хозяин далеко — возвращается к таверне
    if (ctx.critters.dog) {
      const d = ctx.critters.dog;
      d.t += dt;
      const pdx = pd.x - d.g.position.x, pdz = pd.z - d.g.position.z;
      const dist = Math.hypot(pdx, pdz);
      const look = dist < 9;
      let follow = dist < 40;                        // хозяин рядом — пёс за ним
      let target = follow ? pd : d.home;
      let hold = false;                              // пёс стоит на месте

      if (d.mode === 'wait') {
        // пёс ждёт у дома хозяина: стоит на месте и смотрит на игрока
        hold = true;
        d.cmd = 'Ждёт хозяина у дома';
        if (dist < 12) d.dir = Math.atan2(pdz, pdx);
      } else if (d.mode === 'stay') {
        hold = true;
        d.cmd = 'Сидит и ждёт команды';
      } else if (d.mode === 'goto' && d.target) {
        const tx = d.target.x - d.g.position.x, tz = d.target.z - d.g.position.z;
        if (Math.hypot(tx, tz) < 0.8) {
          d.mode = 'stay';
          hold = true;
          d.cmd = 'Добежал до места и сидит';
        } else {
          follow = true;
          target = d.target;
          d.cmd = 'Идёт к выбранному месту';
        }
      } else {
        d.cmd = 'Ходит за хозяином';
      }

      // маршрут пересчитываем, когда цель уехала или подошло время
      d.pathTimer = (d.pathTimer ?? 0) - dt;
      const shift = Math.hypot(target.x - (d.lastTx ?? 1e9), target.z - (d.lastTz ?? 1e9));
      if (d.pathTimer <= 0 || shift > 1.5 || !d.path) {
        d.pathTimer = 0.5;
        d.lastTx = target.x; d.lastTz = target.z;
        d.path = ctx.nav.findPath(d.g.position.x, d.g.position.z, target.x, target.z);
        d.pathIdx = 0;
      }

      let spd = 0;
      if (hold) {
        d.path = null;
        d.dir = Math.atan2(pdz, pdx);
      } else if (d.path && d.path.length) {
        let wp = d.path[d.pathIdx];
        while (wp && d.pathIdx < d.path.length - 1 &&
               Math.hypot(wp.x - d.g.position.x, wp.z - d.g.position.z) < 0.6) {
          d.pathIdx++; wp = d.path[d.pathIdx];
        }
        if (wp) {
          const remain = Math.hypot(wp.x - d.g.position.x, wp.z - d.g.position.z);
          d.dir = Math.atan2(wp.z - d.g.position.z, wp.x - d.g.position.x);
          spd = follow ? d.speed * 3.4 : d.speed * 1.4;
          if (remain < 0.8) spd *= 0.35;              // тормозим у цели
        }
      } else {
        // маршрута нет — идём напрямую, огибая препятствия по крюку
        d.dir = Math.atan2(pdz, pdx);
        spd = d.speed * (follow ? 1.8 : 1.0);
      }
      // рядом с хозяином — сидит рядом и виляет хвостом
      if (follow && !hold && dist < 1.9 && d.mode !== 'goto') {
        spd = 0;
        d.dir = Math.atan2(pdz, pdx);
      }
      d.moving = spd > 0.01;
      if (d.moving) {
        d.dir = pickDir(d.g, d.dir, 0.9, 0.3);
        d.g.position.x += Math.cos(d.dir) * spd * dt;
        d.g.position.z += Math.sin(d.dir) * spd * dt;
      }
      unstick(d.g, 0.3);
      d.g.rotation.y = -d.dir + Math.PI / 2;
      // прыжок
      if (d.jumpT > 0) {
        d.jumpT += dt / 0.62;
        if (d.jumpT >= 1) d.jumpT = 0;
      }
      const jump = d.jumpT > 0 ? d.jumpT : 0;
      d.g.userData.update(dt, d.t, d.moving, look, jump);
      // интеракт идёт за псом
      if (d.interact) d.interact.pos.set(d.g.position.x, 0.7, d.g.position.z);
      // пёс иногда лает сам, если хозяин рядом
      d.barkT = (d.barkT ?? 5) - dt;
      if (d.barkT <= 0) {
        d.barkT = 9 + Math.random() * 16;
        if (dist < 14) ctx.ambience.bark(0.55 + Math.random() * 0.35);
      }
    }

    // кот сидит на крыльце и следит за игроком
    if (ctx.critters.cat) {
      const c = ctx.critters.cat;
      c.t += dt;
      const dist = Math.hypot(pd.x - c.g.position.x, pd.z - c.g.position.z);
      c.g.userData.update(dt, c.t, false, dist < 6);
      // кот мурчит/мяукает, когда хозяин рядом
      c.meowT = (c.meowT ?? 8) - dt;
      if (c.meowT <= 0) {
        c.meowT = 14 + Math.random() * 26;
        if (dist < 7) ctx.ambience.meow(0.6 + Math.random() * 0.4);
      }
    }

    // круги препятствий следуют за животными
    for (const c of ctx.animalCircles) {
      c.x = c.g.position.x;
      c.z = c.g.position.z;
    }
  }

  /* ================================================================
   *  Пёс уходит к дому, когда игрок сменил локацию
   * ================================================================ */

  /**
   * Игрок перешёл в другую локацию — пёс телепортируется к дому
   * хозяина и ждёт там, пока игрок не подойдёт и не позовёт его.
   */
  function onLocationChange() {
    const d = ctx.critters.dog;
    if (!d) return;
    // Дом с табличкой — постоянное место пса; если он неизвестен,
    // берём дом, из которого игрок последний раз выходил.
    const idx = ctx.boardHome >= 0 ? ctx.boardHome : (ctx.playerHome ?? 1);
    const home = (ctx.doors.homes || [])[idx];
    if (!home) return;
    d.mode = 'wait';
    d.cmd = 'Ждёт хозяина у дома';
    d.path = null;
    d.pathTimer = 0;
    d.target = null;
    d.g.position.set(home.x, 0, home.z);
    d.g.rotation.y = home.ry;
    if (d.interact) d.interact.pos.set(home.x, 0.7, home.z);
  }

  /* ================================================================
   *  Команды пса
   * ================================================================ */

  /**
   * Текущее состояние пса — одной строкой для панели команд.
   *
   * @returns {string} описание
   */
  function statusText() {
    const d = ctx.critters.dog;
    return d ? d.cmd : '';
  }

  /** Открыть панель команд пса. */
  function openDogMenu() {
    if (ctx.mode === 'dog') return;
    if (ctx.mode === 'inv') closeInventory();
    if (ctx.mode === 'menu') ctx.ui.closeMenu();
    ctx.mode = 'dog';
    ctx.ui.openDogMenu(statusText());
    ctx.player.acceptInput = false;
    ctx.player.lookOnly = false;
    ctx.player.enabled = false;
    ctx.player.keys.clear();
    if (document.pointerLockElement === ctx.renderer.domElement) document.exitPointerLock();
  }

  /** Закрыть панель команд пса. */
  function closeDogMenu() {
    if (ctx.mode !== 'dog') return;
    ctx.ui.closeDogMenu();
    ctx.mode = 'play';
    ctx.player.enabled = true;
    ctx.player.acceptInput = true;
    ctx.player.lookOnly = false;
    ctx.player.keys.clear();
    ctx.player.requestLock();
  }

  /** «Иди туда»: включаем прицел по земле. */
  function dogAim() {
    closeDogMenu();
    ctx.mode = 'aim';
    ctx.ui.toast('Щёлкните по земле — туда пёс и пойдёт.', 3400);
    ctx.player.enabled = true;
    ctx.player.acceptInput = false;
    ctx.player.lookOnly = true;        // можно оборачиваться, но не идти
    ctx.player.keys.clear();
    ctx.player.requestLock();
  }

  /**
   * Точка на земле под прицелом (или прямо перед камерой, если смотрим в горизонт).
   *
   * @returns {THREE.Vector3|null} точка на земле
   */
  function pickGroundPoint() {
    const dir = new THREE.Vector3();
    const org = new THREE.Vector3();
    ctx.camera.getWorldDirection(dir);
    ctx.camera.getWorldPosition(org);
    let x, z;
    if (Math.abs(dir.y) > 0.12) {
      const t = (ctx.player.groundY - org.y) / dir.y;      // пересечение с плоскостью земли
      if (t > 0.6 && t < 60) { x = org.x + dir.x * t; z = org.z + dir.z * t; }
    }
    if (x === undefined) { const l = 11; x = org.x + dir.x * l; z = org.z + dir.z * l; }
    if (Math.hypot(x - ctx.player.pos.x, z - ctx.player.pos.z) > 40) return null;
    return new THREE.Vector3(x, ctx.player.groundY, z);
  }

  // Закрыть инвентарь, если он открыт (нужно для модулей, которые его знают).
  let closeInventory = () => {};

  ctx.ui.onDogCommand = (cmd) => {
    const d = ctx.critters.dog;
    if (!d) return;
    if (cmd === 'stay') {
      d.mode = 'stay'; d.target = null;
      d.cmd = 'Сидит и ждёт команды';
      ctx.ui.toast('Пёс сел и не сводит с вас глаз.', 2200);
      ctx.ambience.bark(0.85);
      closeDogMenu();
    } else if (cmd === 'goto') {
      dogAim();
    } else if (cmd === 'follow') {
      d.mode = 'follow'; d.target = null;
      d.cmd = 'Ходит за хозяином';
      ctx.ui.toast('Пёс трусцой бежит следом.', 2200);
      ctx.ambience.bark(0.9);
      closeDogMenu();
    } else if (cmd === 'jump') {
      d.jumpT = 0.001;
      d.cmd = 'Прыгнул!';
      ctx.ui.toast('Пёс прыгнул — гляньте, как летит!', 2400);
      ctx.ambience.bark(1.0);
      setTimeout(() => ctx.ambience.bark(0.6), 320);
      closeDogMenu();
    }
  };

  return {
    build,
    update,
    statusText,
    openDogMenu,
    closeDogMenu,
    onLocationChange,
    dogAim,
    pickGroundPoint,
    /**
     * Передать функцию закрытия инвентаря (она живёт в интерфейсе игры).
     *
     * @param {Function} fn функция закрытия инвентаря
     */
    setInventoryCloser(fn) { closeInventory = fn; },
  };
}
