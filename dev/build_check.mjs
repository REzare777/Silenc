/**
 * ============================================================================
 *  Инспектор постройк «Шёпот-Долина»
 * ============================================================================
 *
 *  Разовая инспекция с отчётом и скриншотами. В общий набор тестов
 *  (dev/run-tests.mjs) НЕ входит.
 *
 *  Проверяет:
 *   1. ХРАМ — вход в колокольню с северной стороны:
 *      где стоит интеракт, что мешает подойти, доходит ли игрок пешком,
 *      куда попадает после входа, где оказывается при выходе,
 *      достижим ли колокол по винтовой лестнице;
 *   2. Остальные локации с интерьером: трактир, амбар, мельница,
 *      дом с табличкой, лесорубная избушка, подземелье;
 *   3. Уличные предметы: не стоят ли они внутри стен
 *      (ctx.propSpots и ctx.lanterns против ctx.footprints).
 *
 *  Запуск: cd dev && node build_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
await page.evaluate(() => window.__dbg.env.setTimeOfDay('day', true));
await page.waitForTimeout(500);

/* ------------------------------------------------------------------ *
 *  Снимки экрана
 * ------------------------------------------------------------------ */
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
const look = async (px, py, pz, tx, ty, tz) => {
  await page.evaluate(({ px, py, pz, tx, ty, tz }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(px, py, pz);
    d.camera.lookAt(tx, ty, tz);
    d.camera.updateMatrixWorld();
  }, { px, py, pz, tx, ty, tz });
  await page.waitForTimeout(350);
};

/* ------------------------------------------------------------------ *
 *  Факты
 * ------------------------------------------------------------------ */
const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const p = d.player;
  const out = {};

  const f2 = (v) => +Number(v).toFixed(2);
  /** Точка внутри повёрнутого прямоугольника? */
  const inBox = (x, z, b, pad = 0) => {
    const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
    const dx = x - b.cx, dz = z - b.cz;
    const lx = c * dx - s * dz, lz = s * dx + c * dz;
    return Math.abs(lx) <= b.hx + pad && Math.abs(lz) <= b.hz + pad;
  };
  const hitsAt = (boxes, x, z, pad = 0) => boxes.filter((b) => inBox(x, z, b, pad));
  const circleHits = (circles, x, z) => (circles || [])
    .filter((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.34);

  /* ---------- общие помощники ходьбы ---------- */
  const put = (x, z, yaw = 0) => {
    p.teleport(x, z, yaw);
    p.y = 0; p.groundY = p.groundAt(x, z, 0, 0.46);
    p.vy = 0; p.grounded = true; p.keys.clear();
  };
  /** Идти к точке, каждый кадр поворачиваясь на неё. */
  const walkTo = (tx, tz, frames, stopDist = 0.2) => {
    let minD = Infinity;
    for (let i = 0; i < frames; i++) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z;
      const d = Math.hypot(dx, dz);
      minD = Math.min(minD, d);
      if (d < stopDist) break;
      p.yaw = Math.atan2(-dx, -dz);
      p.keys.add('KeyW');
      p.update(1 / 60);
    }
    p.keys.clear();
    return minD;
  };
  const walkYaw = (yaw, frames) => {
    for (let i = 0; i < frames; i++) {
      p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60);
    }
    p.keys.clear();
  };
  /** Некоторые действия открывают меню и выключают ввод — возвращаем игру в игру. */
  const restore = () => {
    if (ctx.mode !== 'play') { ctx.mode = 'play'; }
    p.enabled = true; p.acceptInput = true; p.lookOnly = false; p.keys.clear();
  };
  /** Точка старта пешего захода: ищем такую, откуда игрок не внутри стены. */
  const freeStart = (tx, tz, radius = 6) => {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const x = tx + Math.sin(a) * radius, z = tz + Math.cos(a) * radius;
      if (hitsAt(ctx.colliders.boxes, x, z, 0.34).length) continue;
      if (circleHits(ctx.colliders.circles, x, z).length) continue;
      return [x, z];
    }
    return null;
  };

  /* ================= 1. ХРАМ ================= */
  const church = {};
  {
    const it = ctx.interactables.find((i) => i.label === 'Войти в колокольню');
    church.interactExists = !!it;
    const ix = it ? it.pos.x : 0, iz = it ? it.pos.z : 0;
    if (it) {
      church.interact = {
        x: f2(ix), y: f2(it.pos.y), z: f2(iz),
        radius: it.radius, where: it.where || 'village',
      };
      const nearB = (b, r) => Math.hypot(b.cx - ix, b.cz - iz) < r;
      const nearC = (c, r) => Math.hypot(c.x - ix, c.z - iz) < r;
      const nearP = (pl, r) => Math.hypot(pl.cx - ix, pl.cz - iz) < r;
      church.nearColliders = ctx.colliders.boxes.filter((b) => nearB(b, 8))
        .map((b) => ({
          c: [f2(b.cx), f2(b.cz)], h: [f2(b.hx), f2(b.hz)], ang: f2(b.ang || 0),
          dist: f2(Math.hypot(b.cx - ix, b.cz - iz)),
          inside: inBox(ix, iz, b, 0), insidePad: inBox(ix, iz, b, 0.34),
        }))
        .sort((a, b) => a.dist - b.dist);
      church.nearCircles = ctx.colliders.circles.filter((c) => nearC(c, 8))
        .map((c) => ({
          c: [f2(c.x), f2(c.z)], r: f2(c.r),
          dist: f2(Math.hypot(c.x - ix, c.z - iz)),
          inside: Math.hypot(c.x - ix, c.z - iz) < c.r + 0.34,
        }))
        .sort((a, b) => a.dist - b.dist);
      church.nearPlatforms = ctx.platforms
        .filter((pl) => (pl.sp ? Math.hypot(pl.sp.cx - ix, pl.sp.cz - iz) < 12 : nearP(pl, 8)))
        .map((pl) => (pl.sp
          ? { spiral: true, c: [f2(pl.sp.cx), f2(pl.sp.cz)], y1: f2(pl.sp.y1) }
          : { c: [f2(pl.cx), f2(pl.cz)], h: [f2(pl.hx), f2(pl.hz)], y: f2(pl.y), ang: f2(pl.ang || 0) }))
        .sort((a, b) => Math.hypot(a.c[0] - ix, a.c[1] - iz) - Math.hypot(b.c[0] - ix, b.c[1] - iz));
      church.groundAtInteract = f2(p.groundAt(ix, iz));
    }

    /* --- пеший проход к двери --- */
    church.walk = [];
    if (it) {
      const cases = [
        { name: 'с севера, по оси башни', from: [ix, iz + 9] },
        { name: 'с главной улицы (из точки 0,63.55)', from: [0, iz + 6] },
        { name: 'с запада, сбоку от башни', from: [ix - 8, iz + 1.5] },
        { name: 'с востока, сбоку от башни', from: [ix + 8, iz + 1.5] },
      ];
      for (const c of cases) {
        put(c.from[0], c.from[1]);
        const minD = walkTo(ix, iz, 1200, 0.15);
        church.walk.push({
          name: c.name,
          from: [f2(c.from[0]), f2(c.from[1])],
          to: [f2(p.pos.x), f2(p.pos.z)],
          minDist: f2(minD),
          reached: minD <= it.radius,
          groundY: f2(p.groundY),
        });
      }
      // что срабатывает на E у двери
      put(ix, iz);
      const near = d.nearestInteractable();
      church.nearestAtDoor = near ? near.label : null;
      church.nearestIsTower = !!(near && near.label === 'Войти в колокольню');
      // игрок стоит на земле или на ступенях?
      church.doorGround = f2(p.groundY);
      church.doorStepsUnder = ctx.platforms
        .filter((pl) => !pl.sp && Math.hypot(pl.cx - ix, pl.cz - iz) < 3)
        .map((pl) => ({ c: [f2(pl.cx), f2(pl.cz)], h: [f2(pl.hx), f2(pl.hz)], y: f2(pl.y) }));
    }

    /* --- каменный цоколь vs. физика (видимая геометрия vs. опоры) --- */
    {
      const fpCh = (ctx.footprints || []).find((f) => f.name === 'храм');
      if (fpCh) {
        const c = Math.cos(fpCh.ry || 0), s = Math.sin(fpCh.ry || 0);
        const toWorld = (lx, lz) => ({
          x: fpCh.x + lx * c + lz * s,
          z: fpCh.z - lx * s + lz * c,
        });
        // вдоль северного фасада башни: цоколь 0,6 м, две ступени 0,22 и 0,43
        church.towerNorth = [];
        for (const lz of [17.0, 18.0, 18.5, 18.72, 19.05, 19.4, 19.6, 20.0]) {
          const w = toWorld(0, lz);
          church.towerNorth.push({
            localZ: lz,
            world: [f2(w.x), f2(w.z)],
            ground: f2(p.groundAt(w.x, w.z, 0, 0.46)),
          });
        }
        // вдоль западной стены нефа: цоколь 0,7 м
        church.naveWest = [];
        for (const lx of [-5.0, -4.7, -4.4]) {
          const w = toWorld(lx, 0);
          church.naveWest.push({
            localX: lx,
            world: [f2(w.x), f2(w.z)],
            ground: f2(p.groundAt(w.x, w.z, 0, 0.46)),
          });
        }
        church.churchRy = f2(fpCh.ry || 0);
      }
    }

    /* --- вход в локацию church (back) --- */
    {
      d.setLocation('church', 'back');
      const ch = d.churchLoc;
      church.loc = ctx.loc;
      church.spawn = {
        x: f2(p.pos.x), y: f2(p.pos.y), z: f2(p.pos.z),
        groundY: f2(p.groundY), yaw: f2(p.yaw),
      };
      church.spawnBackDef = { x: f2(ch.spawnBack.x), z: f2(ch.spawnBack.z), yaw: f2(ch.spawnBack.yaw) };
      church.spawnInWall = hitsAt(ch.colliders.boxes, p.pos.x, p.pos.z, 0).length;
      church.spawnInWallPad = hitsAt(ch.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
      church.spawnCircleHits = circleHits(ch.colliders.circles, p.pos.x, p.pos.z).length;
      church.spawnGround = f2(p.groundAt(p.pos.x, p.pos.z));
      // внутренняя геометрия башни (координаты локации)
      church.towerInner = { z0: 10.2, z1: 19.2, x0: -4.5, x1: 4.5 };
      // сквозь заднюю дверь наружу не пройти?
      put(0, 18.7, 0);
      walkYaw(Math.PI, 500);
      church.leakBackDoorZ = f2(p.pos.z);
      church.leakBackDoorBlocked = p.pos.z < 19.2;   // стена башни на z = 19.2
      church.leakBackDoorLimit = 19.2;
    }

    /* --- выход через заднюю дверь --- */
    {
      const backAct = ctx.interactables.find(
        (i) => (i.where || 'village') === 'church' && /дверь/i.test(i.label));
      church.backExitActExists = !!backAct;
      church.backExitActLabel = backAct ? backAct.label : null;
      if (backAct) {
        backAct.act();
        church.locAfterExit = ctx.loc;
        const door = ctx.doors.churchBack;
        church.exitDoor = { x: f2(door.x), z: f2(door.z), ry: f2(door.ry) };
        church.exitPos = { x: f2(p.pos.x), z: f2(p.pos.z), yaw: f2(p.yaw) };
        church.exitGround = f2(p.groundY);
        church.exitInWall = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0).length;
        church.exitInWallPad = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
        church.exitCircleHits = circleHits(ctx.colliders.circles, p.pos.x, p.pos.z).length;
        church.exitFacing = { x: f2(-Math.sin(p.yaw)), z: f2(-Math.cos(p.yaw)) };
        // расстояние до башни (её северной стены) в локальных осях
        const tower = (ctx.footprints || []).find((f) => f.name === 'колокольня');
        if (tower) {
          const c = Math.cos(tower.ry || 0), s = Math.sin(tower.ry || 0);
          const dx = p.pos.x - tower.x, dz = p.pos.z - tower.z;
          church.exitLocalToTower = {
            lx: f2(c * dx - s * dz), lz: f2(s * dx + c * dz),
            towerHalf: f2(tower.hz),
          };
        }
      }
    }

    /* --- обычный выход из храма (южный фасад) --- */
    {
      d.setLocation('church');
      const exitAct = ctx.interactables.find(
        (i) => (i.where || 'village') === 'church' && i.label === 'Выйти из храма');
      church.frontExitExists = !!exitAct;
      if (exitAct) {
        exitAct.act();
        church.locAfterExitFront = ctx.loc;
        const door = ctx.doors.church;
        church.exitFrontDoor = { x: f2(door.x), z: f2(door.z), ry: f2(door.ry) };
        church.exitFrontPos = { x: f2(p.pos.x), z: f2(p.pos.z), yaw: f2(p.yaw) };
        church.exitFrontInWallPad = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
        church.exitFrontGround = f2(p.groundY);
        church.exitFrontFacing = { x: f2(-Math.sin(p.yaw)), z: f2(-Math.cos(p.yaw)) };
      }
    }

    /* --- колокол: лестница, галерея, интеракт --- */
    {
      d.setLocation('church');
      const ch = d.churchLoc;
      const sp = (ch.platforms || []).find((pl) => pl.sp);
      church.spiral = sp ? {
        c: [f2(sp.sp.cx), f2(sp.sp.cz)], rIn: f2(sp.sp.rIn), rOut: f2(sp.sp.rOut0),
        turns: sp.sp.turns, steps: sp.sp.steps, y0: f2(sp.sp.y0), y1: f2(sp.sp.y1),
      } : null;
      const bellAct = ctx.interactables.find(
        (i) => (i.where || 'village') === 'church' && i.label === 'Ударить в колокол');
      church.bellAct = bellAct ? {
        c: [f2(bellAct.pos.x), f2(bellAct.pos.y), f2(bellAct.pos.z)],
        radius: bellAct.radius, yTol: bellAct.yTol,
      } : null;
      church.galleryPlatforms = (ch.platforms || []).filter(
        (pl) => !pl.sp && Math.abs(pl.y - 9.2) < 0.3).length;
      church.interiorPlatformCount = (ch.platforms || []).length;
      if (sp) {
        const s = sp.sp;
        // подъём по винту
        put(s.cx + Math.sin(s.a0) * 1.3, s.cz + Math.cos(s.a0) * 1.3);
        let maxY = -1e9, minY = 1e9, maxLift = 0;
        for (let i = 0; i < 1400; i++) {
          const a = Math.atan2(p.pos.x - s.cx, p.pos.z - s.cz);
          p.yaw = Math.atan2(-Math.cos(a), Math.sin(a));
          p.keys.add('KeyW'); p.keys.add('ShiftLeft');
          p.update(1 / 60);
          if (p.grounded) maxLift = Math.max(maxLift, p.y);
          minY = Math.min(minY, p.groundY + p.y);
          maxY = Math.max(maxY, p.groundY + p.y);
          if (maxY > 9.0 && i > 700) break;
        }
        p.keys.clear();
        church.climb = {
          minY: f2(minY), maxY: f2(maxY), span: f2(maxY - minY),
          maxLift: f2(maxLift), endPos: [f2(p.pos.x), f2(p.pos.z)],
        };
        church.climbOk = maxY - minY > 5 && maxLift < 0.25;
        // колокол доступен?
        const bp = ch.bellPoint;
        const dBell = Math.hypot(p.pos.x - bp.x, p.pos.z - bp.z);
        const feet = p.groundY + p.y;
        church.bellDist = f2(dBell);
        church.bellFeet = f2(feet);
        church.bellInReach = dBell < bellAct.radius && Math.abs(feet - bellAct.y) <= bellAct.yTol;
        church.nearestAtBell = (d.nearestInteractable() || {}).label || null;
        // реальный удар
        const pivot = ch.group.children.find((c) => c.isGroup);
        bellAct.act();
        ch.update(0.016, 2.0);
        church.bellSwing = pivot ? f2(pivot.rotation.x) : null;
        church.bellWorks = !!(pivot && Math.abs(pivot.rotation.x) > 1e-4);
      }
      // пол локации: насколько он выше нарисованного камня
      church.floorSamples = [[0, 18.1], [0, 14.0], [2.5, 16.5], [-3, 17.5]]
        .map(([x, z]) => ({ at: [x, z], ground: f2(p.groundAt(x, z, 0, 0.46)) }));
    }
    d.setLocation('village');
  }

  /* ================= 2. Остальные локации ================= */
  const interiors = {};
  {
    interiors.allDoors = ctx.interactables
      .filter((i) => /Войти в|Выйти из|Открыть|Спуститься|Подняться/i.test(i.label || ''))
      .map((i) => ({
        label: i.label, where: i.where || 'village',
        c: [f2(i.pos.x), f2(i.pos.y), f2(i.pos.z)], radius: i.radius,
      }));

    const cases = [
      { key: 'таверна', enter: /Войти в таверну/, exit: 'Выйти из таверны', loc: 'tavern' },
      { key: 'амбар', enter: /Войти в амбар/, exit: 'Выйти из амбара', loc: 'barn' },
      { key: 'храм (юг)', enter: /^Войти в храм$/, exit: 'Выйти из храма', loc: 'church' },
      { key: 'подземелье', enter: /Спуститься в подземелье/, exit: 'Подняться на поверхность', loc: 'dungeon' },
    ];
    interiors.cases = [];
    for (const c of cases) {
      const rec = { key: c.key };
      const it = ctx.interactables.find((i) => c.enter.test(i.label || '')
        && (i.where || 'village') === 'village');
      rec.entryExists = !!it;
      if (it) {
        rec.entry = { c: [f2(it.pos.x), f2(it.pos.z)], radius: it.radius };
        const start = freeStart(it.pos.x, it.pos.z, 6);
        rec.start = start ? [f2(start[0]), f2(start[1])] : null;
        if (start) {
          put(start[0], start[1]);
          const minD = walkTo(it.pos.x, it.pos.z, 1200, 0.15);
          rec.walkMinDist = f2(minD);
          rec.walkOk = minD <= it.radius;
        }
        it.act();
        restore();
        rec.loc = ctx.loc;
        rec.spawn = { c: [f2(p.pos.x), f2(p.pos.z)], groundY: f2(p.groundY) };
        const L = ctx.loc === 'tavern' ? d.tavernLoc
          : ctx.loc === 'barn' ? d.barnLoc
            : ctx.loc === 'church' ? d.churchLoc
              : ctx.loc === 'dungeon' ? d.dungeonLoc : null;
        if (L) {
          rec.spawnInWall = hitsAt(L.colliders.boxes, p.pos.x, p.pos.z, 0).length;
          rec.spawnInWallPad = hitsAt(L.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
          rec.spawnGround = f2(p.groundAt(p.pos.x, p.pos.z));
        }
        // второй этаж трактира: лестница наверх
        if (c.loc === 'tavern') {
          const zone = d.tavernLoc.climbs && d.tavernLoc.climbs[0];
          rec.climbZone = zone
            ? { c: [f2(zone.x), f2(zone.z)], r: zone.r, y0: zone.y0, y1: zone.y1 } : null;
          if (zone) {
            put(zone.x + 0.3, zone.z);
            p.pitch = 0.55;
            let max = 0, climbed = false;
            for (let i = 0; i < 700; i++) {
              p.keys.add('KeyW');
              p.update(1 / 60);
              const feet = p.groundY + p.y;
              max = Math.max(max, feet);
              if (p.climb === null && p.groundY > 3.5) { climbed = true; break; }
            }
            p.keys.clear();
            p.pitch = -0.05;
            rec.climbMax = f2(max);
            rec.climbOk = max > 4.0 && climbed;
            // спуск обратно
            put(zone.x + 0.3, zone.z);
            p.pitch = -0.55;
            let min = 99;
            for (let i = 0; i < 700; i++) {
              p.keys.add('KeyS');
              p.update(1 / 60);
              min = Math.min(min, p.groundY + p.y);
              if (p.climb === null && p.groundY < 0.5) break;
            }
            p.keys.clear();
            p.pitch = -0.05;
            rec.downMin = f2(min);
          }
        }
        const outIt = ctx.interactables.find((i) => i.label === c.exit
          && (i.where || 'village') === ctx.loc);
        rec.exitExists = !!outIt;
        if (outIt) {
          outIt.act();
          rec.locAfterExit = ctx.loc;
          rec.exitPos = { c: [f2(p.pos.x), f2(p.pos.z)], yaw: f2(p.yaw) };
          rec.exitInWallPad = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
          rec.exitCircleHits = circleHits(ctx.colliders.circles, p.pos.x, p.pos.z).length;
          rec.exitGround = f2(p.groundY);
          rec.exitFacing = { x: f2(-Math.sin(p.yaw)), z: f2(-Math.cos(p.yaw)) };
        }
      }
      interiors.cases.push(rec);
      d.setLocation('village');
    }

    /* --- трактир: выход через сени --- */
    {
      const rec = { key: 'таверна: сени → улица' };
      d.setLocation('tavern');
      const openBack = ctx.interactables.find((i) => i.label === 'Открыть заднюю дверь'
        && (i.where || 'village') === 'tavern');
      rec.openBackExists = !!openBack;
      if (openBack) {
        openBack.act();
        restore();
        rec.backDoorOpened = true;
        const outIt = ctx.interactables.find((i) => i.label === 'Выйти на улицу'
          && (i.where || 'village') === 'tavern');
        rec.exitExists = !!outIt;
        if (outIt) {
          outIt.act();
          restore();
          rec.locAfterExit = ctx.loc;
          rec.exitPos = { c: [f2(p.pos.x), f2(p.pos.z)], yaw: f2(p.yaw) };
          rec.exitInWallPad = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
          rec.exitCircleHits = circleHits(ctx.colliders.circles, p.pos.x, p.pos.z).length;
          rec.exitGround = f2(p.groundY);
        }
      }
      interiors.cases.push(rec);
      d.setLocation('village');
    }

    /* --- дом с табличкой (западный дом F) --- */
    {
      const rec = { key: 'дом с табличкой' };
      rec.boardHomeIndex = ctx.boardHome;
      const door = (ctx.doors.homes || [])[ctx.boardHome];
      rec.door = door ? { c: [f2(door.x), f2(door.z)] } : null;
      const it = ctx.interactables.find((i) => (i.where || 'village') === 'village'
        && /дверь дома/i.test(i.label || '')
        && Math.abs(i.pos.x - (door ? door.x : 1e9)) < 1.2
        && Math.abs(i.pos.z - (door ? door.z : 1e9)) < 1.2);
      rec.entryExists = !!it;
      rec.entryLabel = it ? it.label : null;
      if (it) {
        const start = freeStart(it.pos.x, it.pos.z, 5);
        rec.start = start ? [f2(start[0]), f2(start[1])] : null;
        if (start) {
          put(start[0], start[1]);
          const minD = walkTo(it.pos.x, it.pos.z, 900, 0.15);
          rec.walkMinDist = f2(minD);
          rec.walkOk = minD <= it.radius;
        }
        it.act();                       // при запертом доме — только тост
        restore();
        rec.locAfterAct = ctx.loc;
        rec.entered = ctx.loc !== 'village';
      }
      // сам интерьер работает?
      d.setLocation('home' + ctx.boardHome);
      rec.interiorLoc = ctx.loc;
      rec.interiorSpawn = { c: [f2(p.pos.x), f2(p.pos.z)], groundY: f2(p.groundY) };
      const L = d.homeLocs[ctx.boardHome];
      rec.interiorInWallPad = L ? hitsAt(L.colliders.boxes, p.pos.x, p.pos.z, 0.34).length : -1;
      const outIt = ctx.interactables.find((i) => i.label === 'Выйти из дома'
        && (i.where || 'village') === ctx.loc);
      rec.interiorExitExists = !!outIt;
      if (outIt) {
        outIt.act();
        rec.locAfterExit = ctx.loc;
        rec.exitPos = { c: [f2(p.pos.x), f2(p.pos.z)], yaw: f2(p.yaw) };
        rec.exitInWallPad = hitsAt(ctx.colliders.boxes, p.pos.x, p.pos.z, 0.34).length;
        rec.exitCircleHits = circleHits(ctx.colliders.circles, p.pos.x, p.pos.z).length;
        rec.exitGround = f2(p.groundY);
        rec.exitFacing = { x: f2(-Math.sin(p.yaw)), z: f2(-Math.cos(p.yaw)) };
      }
      interiors.cases.push(rec);
      d.setLocation('village');
    }

    /* --- мельница --- */
    {
      const rec = { key: 'мельница' };
      const it = ctx.interactables.find((i) => i.label === 'Войти в мельницу');
      rec.entryExists = !!it;
      if (it) {
        rec.entry = { c: [f2(it.pos.x), f2(it.pos.z)], radius: it.radius };
        const start = freeStart(it.pos.x, it.pos.z, 6);
        rec.start = start ? [f2(start[0]), f2(start[1])] : null;
        if (start) {
          put(start[0], start[1]);
          const minD = walkTo(it.pos.x, it.pos.z, 1200, 0.15);
          rec.walkMinDist = f2(minD);
          rec.walkOk = minD <= it.radius;
        }
        it.act();
        restore();
        rec.locAfterAct = ctx.loc;      // локация не меняется — подъём по лестнице
      }
      // винт мельницы
      const sp = (ctx.platforms || []).find((pl) => pl.sp);
      rec.spiral = sp ? {
        c: [f2(sp.sp.cx), f2(sp.sp.cz)], rIn: f2(sp.sp.rIn),
        rOut: f2(sp.sp.rOut0), y1: f2(sp.sp.y1), turns: sp.sp.turns,
      } : null;
      if (sp) {
        const s = sp.sp;
        put(s.cx + Math.sin(s.a0) * 1.3, s.cz + Math.cos(s.a0) * 1.3);
        let maxY = -1e9;
        for (let i = 0; i < 1400; i++) {
          const a = Math.atan2(p.pos.x - s.cx, p.pos.z - s.cz);
          p.yaw = Math.atan2(-Math.cos(a), Math.sin(a));
          p.keys.add('KeyW'); p.keys.add('ShiftLeft');
          p.update(1 / 60);
          maxY = Math.max(maxY, p.groundY + p.y);
          if (maxY > s.y1 - 0.6 && i > 700) break;
        }
        p.keys.clear();
        rec.climbMaxY = f2(maxY);
        rec.climbOk = maxY > s.y1 - 1.0;
      }
      interiors.cases.push(rec);
      d.setLocation('village');
    }

    /* --- лесорубная избушка --- */
    {
      const rec = { key: 'лесорубная избушка' };
      const fp = (ctx.footprints || []).find((f) => f.name === 'лесная делянка');
      rec.footprint = fp ? { c: [f2(fp.x), f2(fp.z)], h: [f2(fp.hx), f2(fp.hz)], ry: f2(fp.ry || 0) } : null;
      const it = ctx.interactables.find((i) => fp
        && Math.hypot(i.pos.x - fp.x, i.pos.z - fp.z) < 4 && /избушк|лесоруб|в дом/i.test(i.label || ''));
      rec.entryExists = !!it;
      rec.entryLabels = ctx.interactables
        .filter((i) => fp && Math.hypot(i.pos.x - fp.x, i.pos.z - fp.z) < 6)
        .map((i) => i.label);
      // коллайдер совпадает с геометрией? (избушка 5 × 4,2 м)
      const hutBox = ctx.colliders.boxes.find((b) => fp
        && Math.hypot(b.cx - fp.x, b.cz - fp.z) < 0.6 && Math.abs(b.hx - 2.5) < 0.2);
      rec.hutCollider = hutBox ? { c: [f2(hutBox.cx), f2(hutBox.cz)], h: [f2(hutBox.hx), f2(hutBox.hz)] } : null;
      // подойти можно?
      if (fp) {
        const start = freeStart(fp.x, fp.z, 5);
        rec.start = start ? [f2(start[0]), f2(start[1])] : null;
        if (start) {
          put(start[0], start[1]);
          const minD = walkTo(fp.x, fp.z, 900, 0.3);
          rec.walkMinDist = f2(minD);
          rec.walkOk = minD < 3;
        }
      }
      interiors.cases.push(rec);
      d.setLocation('village');
    }
  }

  /* ================= 3. Уличные предметы ================= */
  const props = {};
  {
    const fp = ctx.footprints || [];
    const spots = ctx.propSpots || [];
    props.footprints = fp.map((f) => ({
      name: f.name, c: [f2(f.x), f2(f.z)],
      h: f.hx !== undefined ? [f2(f.hx), f2(f.hz)] : null,
      r: f.r ?? null, ry: f2(f.ry || 0),
    }));
    props.propSpots = spots.map((s) => ({ name: s.name, c: [f2(s.x), f2(s.z)], r: s.r ?? null }));
    props.lanterns = (ctx.lanterns || []).map((l) => ({
      c: [f2(l.pos.x), f2(l.pos.z)],
    }));
    const insideOf = (x, z, r, f) => {
      if (f.r) return Math.hypot(x - f.x, z - f.z) < f.r - (r || 0);
      const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0);
      const dx = x - f.x, dz = z - f.z;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      return Math.abs(lx) < f.hx - (r || 0) && Math.abs(lz) < f.hz - (r || 0);
    };
    props.inside = [];
    for (const s of spots) {
      for (const f of fp) {
        if (insideOf(s.x, s.z, s.r, f)) {
          props.inside.push({ kind: 'prop', name: s.name, at: [f2(s.x), f2(s.z)], fp: f.name });
        }
      }
    }
    for (const l of props.lanterns) {
      for (const f of fp) {
        if (insideOf(l.c[0], l.c[1], 0.15, f)) {
          props.inside.push({ kind: 'фонарь', name: 'фонарь', at: l.c, fp: f.name });
        }
      }
    }
    // коллайдеры, полностью утопленные в постройке (висят в стене)
    props.colliderInWall = [];
    for (const b of ctx.colliders.boxes) {
      for (const f of fp) {
        if (!f.h) continue;
        const c = Math.cos(f.ry || 0), s = Math.sin(f.ry || 0);
        const dx = b.cx - f.x, dz = b.cz - f.z;
        const lx = c * dx - s * dz, lz = s * dx + c * dz;
        const deep = Math.abs(lx) < f.hx - b.hx && Math.abs(lz) < f.hz - b.hz;
        if (deep) {
          props.colliderInWall.push({
            fp: f.name, at: [f2(b.cx), f2(b.cz)], h: [f2(b.hx), f2(b.hz)],
          });
        }
      }
    }
    props.counts = {
      footprints: fp.length, propSpots: spots.length,
      lanterns: props.lanterns.length, colliders: ctx.colliders.boxes.length,
      platforms: ctx.platforms.length,
    };
  }

  /* ================= 4. Видимая геометрия vs. опора ================= */
  const geom = {};
  {
    const ray = new d.THREE.Raycaster();
    ray.far = 60;
    // группы построек: по ним ищем видимую поверхность
    const groups = {};
    d.ctx.scene.traverse((o) => {
      if (o.name && !groups[o.name]) groups[o.name] = o;
    });
    /** Высота верхней видимой поверхности под точкой (луч сверху вниз). */
    const visualY = (x, z) => {
      ray.set(new d.THREE.Vector3(x, 8, z), new d.THREE.Vector3(0, -1, 0));
      const targets = ['church', 'barn', 'tavern', 'windmill', 'woodcuttersHut', 'cottage']
        .map((n) => groups[n]).filter(Boolean);
      const hits = targets.length ? ray.intersectObjects(targets, true) : [];
      return hits.length ? f2(hits[0].point.y) : null;
    };
    const fpCh = (ctx.footprints || []).find((f) => f.name === 'храм');
    const fpTw = (ctx.footprints || []).find((f) => f.name === 'колокольня');
    const chRy = fpCh ? (fpCh.ry || 0) : 0;
    const chX = fpCh ? fpCh.x : 3, chZ = fpCh ? fpCh.z : 44;
    const toWorld = (lx, lz) => ({
      x: chX + lx * Math.cos(chRy) + lz * Math.sin(chRy),
      z: chZ - lx * Math.sin(chRy) + lz * Math.cos(chRy),
    });
    const samples = [];
    const add = (name, x, z) => {
      const v = visualY(x, z);
      const g = f2(p.groundAt(x, z, 0, 0.46));
      const wall = v !== null && v > 2.5;      // луч упёрся в стену/крышу
      samples.push({
        name, at: [f2(x), f2(z)],
        visual: v === null ? 0 : v, ground: g,
        diff: wall ? null : f2(g - v),
        insideWall: wall,
        standable: hitsAt(ctx.colliders.boxes, x, z, 0.34).length === 0,
      });
    };
    // дверь колокольни с севера: цоколь, ступени, земля
    for (const lz of [18.0, 18.5, 18.72, 19.05, 19.6, 20.0]) {
      const w = toWorld(0, lz);
      add(`башня, местная z=${lz}`, w.x, w.z);
    }
    // западная стена нефа (цоколь 0,7 м)
    for (const lx of [-5.2, -4.9, -4.6]) {
      const w = toWorld(lx, 0);
      add(`неф, местная x=${lx}`, w.x, w.z);
    }
    // крыльцо храма: ступени
    for (const lz of [-13.9, -13.6, -12.8, -12.4]) {
      const w = toWorld(0, lz);
      add(`крыльцо, местная z=${lz}`, w.x, w.z);
    }
    // прочие постройки: подходы к дверям
    const itBarn = ctx.interactables.find((i) => i.label === 'Войти в амбар');
    if (itBarn) {
      add('амбар, точка входа', itBarn.pos.x, itBarn.pos.z);
      add('амбар, 2 м южнее', itBarn.pos.x, itBarn.pos.z + 2);
    }
    const itMill = ctx.interactables.find((i) => i.label === 'Войти в мельницу');
    if (itMill) add('мельница, точка входа', itMill.pos.x, itMill.pos.z);
    const itTav = ctx.interactables.find((i) => /Войти в таверну/.test(i.label || ''));
    if (itTav) {
      add('таверна, точка входа', itTav.pos.x, itTav.pos.z);
      add('таверна, 1 м выше', itTav.pos.x, itTav.pos.z + 1);
    }
    const fpHut = (ctx.footprints || []).find((f) => f.name === 'лесная делянка');
    if (fpHut) {
      add('избушка, у крыльца', fpHut.x - 3.2, fpHut.z);
      add('избушка, у стены', fpHut.x + 3.2, fpHut.z);
    }
    geom.samples = samples;
    geom.mismatches = samples.filter((s) => s.diff !== null && Math.abs(s.diff) > 0.08);
    geom.towerFootprint = fpTw
      ? { c: [f2(fpTw.x), f2(fpTw.z)], h: [f2(fpTw.hx), f2(fpTw.hz)] } : null;
  }

  return { church, interiors, props, geom };
});

/* ------------------------------------------------------------------ *
 *  Печать отчёта
 * ------------------------------------------------------------------ */
const R = res;
console.log('=== 1. ХРАМ ===');
console.log('интеракт «Войти в колокольню»:',
  R.church.interact ? `(${R.church.interact.x}, ${R.church.interact.z}), r=${R.church.interact.radius}, where=${R.church.interact.where}` : 'НЕТ');
console.log('коллайдеры рядом:');
for (const b of R.church.nearColliders) {
  console.log(`   ${b.c} h=${b.h} ang=${b.ang} dist=${b.dist} внутри=${b.inside} +радиус=${b.insidePad}`);
}
console.log('круглые коллайдеры рядом:');
for (const c of R.church.nearCircles) console.log(`   ${c.c} r=${c.r} dist=${c.dist} внутри=${c.inside}`);
console.log('платформы рядом:');
for (const p of R.church.nearPlatforms) console.log(`   ${JSON.stringify(p)}`);
console.log('высота земли у интеракта:', R.church.groundAtInteract);
console.log('пеший проход:');
for (const w of R.church.walk) {
  console.log(`   ${w.name}: из (${w.from}) в (${w.to}), min=${w.minDist}, дошёл=${w.reached}, groundY=${w.groundY}`);
}
console.log('у двери срабатывает:', R.church.nearestAtDoor);
console.log('вход в локацию:', R.church.loc, 'spawn:', JSON.stringify(R.church.spawn));
console.log('   в стене:', R.church.spawnInWall, 'с запасом:', R.church.spawnInWallPad,
  'пол:', R.church.spawnGround, 'круги:', R.church.spawnCircleHits);
console.log('сквозь заднюю дверь:', R.church.leakBackDoorZ, 'ограничено стеной z<',
  R.church.leakBackDoorLimit, '→', R.church.leakBackDoorBlocked);
console.log('выход «', R.church.backExitActLabel, '» → локация', R.church.locAfterExit,
  'точка', JSON.stringify(R.church.exitPos), 'пол', R.church.exitGround);
console.log('   в стене:', R.church.exitInWall, 'с запасом:', R.church.exitInWallPad,
  'круги:', R.church.exitCircleHits, 'смотрит:', JSON.stringify(R.church.exitFacing));
console.log('   относительно башни:', JSON.stringify(R.church.exitLocalToTower));
console.log('выход «Выйти из храма» →', R.church.locAfterExitFront,
  JSON.stringify(R.church.exitFrontPos), 'в стене:', R.church.exitFrontInWallPad);
console.log('винт:', JSON.stringify(R.church.spiral), 'подъём:', JSON.stringify(R.church.climb));
console.log('колокол:', JSON.stringify(R.church.bellAct), 'расстояние', R.church.bellDist,
  'ноги', R.church.bellFeet, 'достижим:', R.church.bellInReach, 'срабатывает:', R.church.nearestAtBell);
console.log('колокол качается:', R.church.bellWorks, R.church.bellSwing);
console.log('пол локации (высота опоры):', JSON.stringify(R.church.floorSamples));
console.log('цоколь башни, север (местная z → высота опоры):', JSON.stringify(R.church.towerNorth));
console.log('цоколь нефа, запад (местная x → высота опоры):', JSON.stringify(R.church.naveWest));

console.log('\n=== 2. ОСТАЛЬНЫЕ ЛОКАЦИИ ===');
for (const c of R.interiors.cases) console.log(JSON.stringify(c));

console.log('\n=== 3. ПРЕДМЕТЫ ===');
console.log('счётчики:', JSON.stringify(R.props.counts));
console.log('предметы внутри построек:', JSON.stringify(R.props.inside));
console.log('коллайдеры, утопленные в постройку:', JSON.stringify(R.props.colliderInWall));

console.log('\n=== 4. ВИДИМАЯ ПОВЕРХНОСТЬ vs. ОПОРА (raycast сверху) ===');
for (const s of R.geom.samples) {
  console.log(`   ${s.name}: ${JSON.stringify(s.at)} камень=${s.visual} опора=${s.ground} `
    + `разница=${s.diff} луч-в-стену=${s.insideWall} можно-стоять=${s.standable}`);
}
console.log('расхождения > 8 см:', JSON.stringify(R.geom.mismatches));

console.log('\nошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 200));

fs.writeFileSync('/tmp/build_check.json', JSON.stringify(res, null, 1));

/* ------------------------------------------------------------------ *
 *  Снимки
 * ------------------------------------------------------------------ */
const T = R.church.interact;
await look(T.x, 3.2, T.z + 15, T.x, 4.0, T.z - 4);      // с севера, издалека
await grab('BUILD_church_north_far');
await look(T.x + 0.2, 1.9, T.z + 2.4, T.x, 1.5, T.z - 2); // у самой двери
await grab('BUILD_church_door');
await look(T.x + 5.2, 3.4, T.z + 6.5, T.x - 1, 5.0, T.z - 6); // башня сбоку
await grab('BUILD_church_tower_side');

// глазами игрока у двери: камень цоколя vs. высота ног
await look(T.x, 1.68, T.z + 0.9, T.x, 1.0, T.z - 2.4);
await grab('BUILD_church_door_eyes');
// западная стена нефа: цоколь 0,7 м
await look(-2.2, 1.2, 44 + 1.0, -2.2, 0.6, 44 + 8.2);
await grab('BUILD_church_nave_plinth');

// внутри башни
await page.evaluate(() => window.__dbg.setLocation('church', 'back'));
await page.waitForTimeout(500);
await look(0, 1.9, 17.4, 0, 1.2, 13.5);
await grab('BUILD_church_tower_inside');
// галерея с колоколом
await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.churchLoc;
  const sp = ch.platforms.find((pl) => pl.sp).sp;
  d.player.teleport(sp.cx + 1.6, sp.cz + 1.6, 0);
  d.player.groundY = 9.2; d.player.y = 0;
  d.player.enabled = false;
  d.camera.position.set(sp.cx + 2.2, 10.6, sp.cz + 2.2);
  d.camera.lookAt(sp.cx, 9.9, sp.cz);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(500);
await grab('BUILD_church_bell_gallery');

// выход в деревню
await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  // войти с северной стороны и выйти обратно через тяжёлую дверь
  d.setLocation('church', 'back');
  const backAct = ctx.interactables.find(
    (i) => (i.where || 'village') === 'church' && /дверь/i.test(i.label || ''));
  if (backAct) backAct.act();
  d.player.enabled = false;
  const c = ctx.doors.churchBack;
  d.camera.position.set(c.x - 0.9, 2.4, c.z + 3.4);
  d.camera.lookAt(c.x, 1.2, c.z - 4);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(600);
await grab('BUILD_church_exit_village');

// главный фасад храма с юга
await look(2.2, 3.2, 22, 3, 4.5, 33);
await grab('BUILD_church_front_south');

await browser.close();
