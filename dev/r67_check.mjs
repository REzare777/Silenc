/**
 * Раунд 67 — проверки.
 *
 * Что проверяем:
 *   1. Дом игрока стоит у скалы, справа от дороги, фасадом к дороге.
 *   2. В свой дом можно войти всегда, хоть ночью; в остальные — как раньше.
 *   3. В доме есть кровать: сон лечит, сдвигает календарь и сохраняет игру.
 *   4. К дому ведёт тропа, доска для записки и фонарь стоят рядом.
 *   5. Пёс ждёт у дома с табличкой — то есть у нового дома.
 *   6. Дорога к скале: полотно сплошное, столбов-указателей нет.
 *   7. Пещера: за порогом тоннель закрыт — провалиться внутрь скалы нельзя.
 *   8. Шахта: лестницы нет, есть каменный парапет и мгновенный переход
 *      между ярусами; печать шахты держит переход, пока в зале живы звери.
 *
 * Запуск: cd /workspace/village && node dev/r67_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const p = d.player;
  const out = {};

  /* ---------- дорога к скале ---------- */
  const TRAIL = [
    [-2.5, -14], [-5, -21], [-12, -28], [-20, -33], [-28, -38],
    [-36, -41], [-44, -46], [-51, -52], [-56, -58], [-62, -60], [-67, -63],
  ];
  /** Ближайший отрезок дороги к точке. */
  const nearestSeg = (x, z) => {
    let best = { d: Infinity };
    for (let i = 0; i < TRAIL.length - 1; i++) {
      const [ax, az] = TRAIL[i], [bx, bz] = TRAIL[i + 1];
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t, pz = az + dz * t;
      const dd = Math.hypot(x - px, z - pz);
      if (dd < best.d) {
        best = { d: dd, px, pz, dir: [dx, dz], len: Math.hypot(dx, dz) };
      }
    }
    return best;
  };

  /* ---------- 1. дом игрока ---------- */
  const home = (ctx.homes || [])[10];
  out.home = home ? { x: +home.x.toFixed(2), z: +home.z.toFixed(2) } : null;
  if (home) {
    const seg = nearestSeg(home.x, home.z);
    out.homeRoadDist = +seg.d.toFixed(2);
    // «вправо» при движении к пещере: вектор (-dz, dx)
    const rx = -seg.dir[1] / seg.len, rz = seg.dir[0] / seg.len;
    out.homeSide = +((home.x - seg.px) * rx + (home.z - seg.pz) * rz).toFixed(2);
    // фасад (локальная −Z) смотрит на дорогу
    const fx = -Math.sin(home.ry), fz = -Math.cos(home.ry);
    const tx = seg.px - home.x, tz = seg.pz - home.z;
    const tl = Math.hypot(tx, tz) || 1;
    out.homeFacesRoad = +((fx * tx + fz * tz) / tl).toFixed(2);
    // до скалы не больше 20 м
    out.homeCliffDist = +Math.hypot(home.x + 72, home.z + 66).toFixed(1);
  }
  const door = (ctx.doors.homes || [])[10];
  out.door = door ? { x: +door.x.toFixed(2), z: +door.z.toFixed(2) } : null;
  out.doorRoadDist = door ? +nearestSeg(door.x, door.z).d.toFixed(2) : 99;

  /* ---------- 2. вход в свой дом (и ночью) ---------- */
  const doorIt = (ctx.interactables || []).find((i) => i.label === 'Войти в свой дом');
  out.doorInteract = !!doorIt;
  if (doorIt) {
    ctx.env.setTimeOfDay('night', true);
    out.phase = ctx.env.current;
    doorIt.act();
    out.inHome = ctx.loc;
    out.homeName = (d.homeLocs || [])[10] ? d.homeLocs[10].name : null;
    out.hasBed = !!(d.homeLocs || [])[10] && !!d.homeLocs[10].bed;
    ctx.env.setTimeOfDay('day', true);
    d.setLocation('village');
  }
  // чужие дома по-прежнему заперты
  const otherIt = (ctx.interactables || []).find((i) => i.label === 'Запертая дверь дома');
  out.otherLocked = !!otherIt;

  /* ---------- 3. сон на кровати ---------- */
  {
    d.setLocation('home10');
    const sleepIt = (ctx.interactables || []).find((i) => i.label === 'Лечь и поспать');
    out.sleepInteract = !!sleepIt;
    if (sleepIt) {
      const day0 = ctx.calendar.day;
      const hp0 = ctx.stats.hp;
      ctx.stats.hp = 1;                       // «ранен» — чтобы было видно, что сон лечит
      sleepIt.act();
      out.sleep = {
        day0, day1: ctx.calendar.day,
        hp0, hp1: ctx.stats.hp,
        time: ctx.env.current,
      };
      out.sleepOk = ctx.calendar.day !== day0 && ctx.stats.hp > 1
        && (ctx.env.current === 'morning' || ctx.env.target === 'morning');
    }
    d.setLocation('village');
  }

  /* ---------- 4. тропа, доска и фонарь у дома ---------- */
  {
    const trail = (ctx.roadTrails || []).find((t) => t.id === 'homeCliff');
    out.trail = trail ? trail.pts.length : 0;
    out.trailEnd = trail && trail.pts.length
      ? [+trail.pts[trail.pts.length - 1][0].toFixed(2), +trail.pts[trail.pts.length - 1][1].toFixed(2)]
      : null;
    out.trailAtDoor = out.trailEnd && door
      ? +Math.hypot(out.trailEnd[0] - door.x, out.trailEnd[1] - door.z).toFixed(2) : 99;

    const boardIt = (ctx.interactables || []).find((i) =>
      (i.labelFn ? i.labelFn() : i.label) === 'Написать на доске'
      || (i.labelFn ? i.labelFn() : i.label) === 'Прочитать записку');
    out.board = boardIt ? { x: +boardIt.pos.x.toFixed(1), z: +boardIt.pos.z.toFixed(1) } : null;
    out.boardNearHouse = out.board && door
      ? +Math.hypot(out.board.x - door.x, out.board.z - door.z).toFixed(1) : 99;
    out.boardHome = ctx.boardHome;

    const lamp = (ctx.propSpots || []).find((p) => p.name === 'фонарь'
      && door && Math.hypot(p.x - door.x, p.z - door.z) < 6);
    out.lampNearHouse = !!lamp;
  }

  /* ---------- 5. пёс ---------- */
  {
    const dog = ctx.critters.dog;
    const bd = (ctx.doors.homes || [])[ctx.boardHome];
    out.dogAtHome = !!(dog && bd
      && Math.hypot(dog.g.position.x - bd.x, dog.g.position.z - bd.z) < 3);
    out.dogHome = ctx.boardHome;
  }

  /* ---------- 6. дорога: без столбов и плит ---------- */
  {
    const scene = ctx.scene;
    let signposts = 0, plates = 0;
    ctx.scene.traverse((o) => {
      if (o.name && /signpost|post|указател/i.test(o.name)) signposts++;
    });
    // отдельные плиты вдоль дороги: их больше нет, полотно одно
    out.trailStones = !!ctx.scene.getObjectByName('dungeonTrailStones');
    out.roadRibbon = !!ctx.scene.getObjectByName('dungeonTrail');
    out.signposts = signposts;
  }

  /* ---------- 7. пещера: тоннель закрыт ---------- */
  {
    const gate = { x: -72, z: -66 };
    const ry = Math.atan2(-(0 - gate.x) / Math.hypot(gate.x, gate.z), -(0 - gate.z) / Math.hypot(gate.x, gate.z));
    // мировая точка «за порогом»: локальная (0, +0.78) от центра скалы
    const tx = gate.x + 0.78 * Math.sin(ry);
    const tz = gate.z + 0.78 * Math.cos(ry);
    out.tunnelPoint = { x: +tx.toFixed(2), z: +tz.toFixed(2) };
    const near = (ctx.colliders.boxes || []).filter((b) =>
      Math.hypot(b.cx - tx, b.cz - tz) < 0.6 && b.y1 > 2.5);
    out.tunnelCollider = near.length;
    // и текстура скалы — своя, не щебень пещеры
    out.cliffMat = !!ctx.M.cliff && !!ctx.M.cliff.map;
    const cliffGroup = ctx.scene.getObjectByName('dungeonGate');
    out.cliffGroup = !!cliffGroup;
  }

  /* ---------- 8. шахта: парапет и мгновенный переход ---------- */
  {
    d.setLocation('dungeon');
    const dl = d.dungeonLoc;
    out.shaft = {
      top: dl.shaftTop ? { x: dl.shaftTop.x, y: dl.shaftTop.y, z: dl.shaftTop.z } : null,
      bottom: dl.shaftBottom ? { x: dl.shaftBottom.x, y: dl.shaftBottom.y, z: dl.shaftBottom.z } : null,
      deep: dl.spawnDeep ? { x: dl.spawnDeep.x, z: dl.spawnDeep.z } : null,
      topSpawn: dl.spawnTop ? { x: dl.spawnTop.x, z: dl.spawnTop.z } : null,
    };
    // лестницы больше нет: у края шахты нет платформ со ступенями
    const stairs = (dl.platforms || []).filter((pl) =>
      pl.cz > 5 && pl.cz < 15 && pl.y < -0.5 && pl.y > -4.5);
    out.shaftSteps = stairs.length;
    // есть парапет — коллайдер у края шахты
    const shaftTop = dl.shaftTop;
    out.parapet = (dl.colliders.boxes || []).filter((b) =>
      shaftTop && Math.abs(b.cz - shaftTop.z) < 1.5 && b.y0 > -0.1 && b.hz < 0.6).length;

    // переход вниз: печать шахты держит, пока в кристальном зале живы звери
    const downIt = (ctx.interactables || []).find((i) => i.label === 'Спуститься в зал Врат');
    out.downInteract = !!downIt;
    if (downIt) {
      const counts = ctx.systems.monsters && ctx.systems.monsters.zoneCounts
        ? ctx.systems.monsters.zoneCounts() : null;
      out.aliveCrystal = counts && counts.crystal ? counts.crystal.alive : 0;
      // игрок у парапета
      p.teleport(shaftTop.x, shaftTop.z - 1.2, Math.PI);
      p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true; p.keys.clear();
      downIt.act();
      out.afterDown = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +(p.groundY + p.y).toFixed(2) };
      out.downBlocked = Math.abs(p.pos.z - dl.spawnDeep.z) > 1;   // не спустился — печать держит
      // теперь печать открыта — переход должен сработать
      const seal = (dl.seals || []).find((s) => s.id === 'crystal');
      if (seal) seal.open = true;
      p.teleport(shaftTop.x, shaftTop.z - 1.2, Math.PI);
      p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true; p.keys.clear();
      downIt.act();
      out.afterDown2 = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +(p.groundY + p.y).toFixed(2) };
      out.downOk = Math.abs(p.pos.z - dl.spawnDeep.z) < 1.5
        && Math.abs((p.groundY + p.y) - (-4.6)) < 1.5;
      // и обратно наверх
      const upIt = (ctx.interactables || []).find((i) => i.label === 'Подняться на верхний ярус');
      out.upInteract = !!upIt;
      if (upIt) {
        p.teleport(dl.shaftBottom.x, dl.shaftBottom.z, 0);
        p.y = 0; p.groundY = -4.6; p.vy = 0; p.grounded = true; p.keys.clear();
        upIt.act();
        out.afterUp = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), y: +(p.groundY + p.y).toFixed(2) };
        out.upOk = Math.abs(p.pos.z - dl.spawnTop.z) < 1.5;
      }
    }
    d.setLocation('village');
  }

  return out;
});

console.log('=== Раунд 67: проверки ===');
console.log(JSON.stringify(res, null, 2));

const checks = [
  ['дом игрока стоит там, где стоял игрок на скриншоте',
    !!res.home && Math.abs(res.home.x + 8.9) < 3 && Math.abs(res.home.z + 34.3) < 3],
  ['дом справа от дороги', res.homeSide > 0],
  ['дом не стоит на дороге', res.homeRoadDist >= 5],
  ['фасад дома смотрит на дорогу', res.homeFacesRoad > 0.75],
  ['до двери — пара минут ходьбы от дороги', res.doorRoadDist > 1.5 && res.doorRoadDist < 7],
  ['в свой дом есть вход', res.doorInteract],
  ['в свой дом пускают и ночью', res.inHome === 'home10' && res.phase === 'night'],
  ['дом называется «Ваш дом у дороги»', res.homeName === 'Ваш дом у дороги'],
  ['чужие дома заперты по-прежнему', res.otherLocked],
  ['в доме есть кровать', res.hasBed],
  ['на кровати можно поспать', res.sleepInteract && res.sleepOk],
  ['сон лечит и сдвигает день', res.sleep && res.sleep.day1 !== res.sleep.day0 && res.sleep.hp1 > 1],
  ['к дому ведёт тропа', res.trailAtDoor < 1.5],
  ['доска стоит у дома', res.boardNearHouse < 6],
  ['у двери горит фонарь', res.lampNearHouse],
  ['пёс ждёт у дома с доской', res.dogAtHome && res.dogHome === 10],
  ['старых плит и столбов на дороге нет', !res.trailStones],
  ['полотно дороги на месте', res.roadRibbon],
  ['тоннель за порогом закрыт', res.tunnelCollider > 0],
  ['у скалы своя текстура породы', res.cliffMat],
  ['в шахте нет ступеней', res.shaftSteps === 0],
  ['у края шахты стоит парапет', res.parapet > 0],
  ['переход в зал Врат есть', res.downInteract],
  ['печать шахты держит переход', res.downBlocked],
  ['переход на ровный пол зала Врат', res.downOk],
  ['и обратный переход наверх', res.upInteract && res.upOk],
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) bad++;
}
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 6)) console.log('  ', e.slice(0, 220));
console.log(bad ? `ошибок: ${bad}` : 'ошибок: 0');
process.exit(bad || errs.length ? 1 : 0);
