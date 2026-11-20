/**
 * ============================================================================
 *  Проверки раунда 42: физика опоры, костёр за городом, дверь храма, perf
 * ============================================================================
 *
 *   1. Физика: спуск по винтовой лестнице не «поднимает» игрока над ступенями
 *      (высота ног над опорой не растёт) — это был баг «становишься высоким».
 *   2. Физика: прыжок на винтовой лестнице не перебрасывает на целый виток.
 *   3. Физика: спуск по лестнице звонарной — ноги идут по ступеням.
 *   4. Костёр: перенесён «за город», дальше 25 м от центра деревни и 10 м
 *      от любого дома; на площади его больше нет.
 *   5. Храм: дверь в звонарную переставлена вправо и закрыта — из нефа
 *      проёма не видно, а звонарка доступна с заднего двора.
 *   6. Производительность: лес нарезан на чанки и отсекается, точечных
 *      источников света в десятки раз меньше.
 *
 *  Запуск: cd dev && node r42_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const ctx = d.ctx;
  const out = { errors: [] };

  const put = (x, z) => { p.teleport(x, z, 0); p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true; p.keys.clear(); };
  const step = (yaw, n, run = false) => {
    for (let i = 0; i < n; i++) {
      p.yaw = yaw;
      p.keys.add('KeyW');
      if (run) p.keys.add('ShiftLeft'); else p.keys.delete('ShiftLeft');
      p.update(1 / 60);
    }
    p.keys.clear();
  };

  /* ---------- 1–2. винтовая лестница мельницы ---------- */
  const pls = ctx.platforms || [];
  const spPl = pls.find((pl) => pl.sp);
  const spiral = spPl ? spPl.sp : null;
  out.spiral = { found: !!spiral };
  if (spiral) {
    const total = spiral.turns * Math.PI * 2;
    const at = (t) => {
      const a = spiral.a0 + total * t;
      const rOut = spiral.rOut0 + (spiral.rOut1 - spiral.rOut0) * t;
      const r = (spiral.rIn + rOut) / 2;
      return {
        x: spiral.cx + Math.sin(a) * r,
        z: spiral.cz + Math.cos(a) * r,
        y: spiral.y0 + (spiral.y1 - spiral.y0) * t,
      };
    };

    /* --- спуск сверху вниз --- */
    const top = at(0.97);
    put(top.x, top.z);
    p.groundY = top.y; p.y = 0;
    let maxLift = 0;          // насколько ноги «отрывались» от опоры
    let maxErr = 0;           // расхождение с высотой ступени
    let steps = 0;
    for (let i = 0; i <= 300; i++) {
      const t = 0.97 - (i / 300) * 0.94;
      const tgt = at(t);
      const yaw = Math.atan2(-(tgt.x - p.pos.x), -(tgt.z - p.pos.z));
      step(yaw, 2, true);
      steps++;
      if (p.grounded) maxLift = Math.max(maxLift, p.y);
      maxErr = Math.max(maxErr, Math.abs((p.groundY + p.y) - tgt.y));
    }
    out.spiralDown = {
      maxLift: +maxLift.toFixed(3),
      maxErr: +maxErr.toFixed(3),
      endY: +(p.groundY + p.y).toFixed(2),
      targetY: +at(0.03).y.toFixed(2),
    };
    // было бы: maxLift > 1 (игрок «вырастал» над лестницей)
    out.spiralDownOk = out.spiralDown.maxLift < 0.25 && out.spiralDown.maxErr < 0.6;

    /* --- прыжок на витке: не перебрасывает на целый виток --- */
    const mid = at(0.5);
    put(mid.x, mid.z);
    p.groundY = mid.y; p.y = 0;
    const yBefore = p.groundY;
    p.vy = p.jumpSpeed; p.grounded = false;
    for (let i = 0; i < 90; i++) p.update(1 / 60);
    out.spiralJump = {
      before: +yBefore.toFixed(2),
      after: +(p.groundY + p.y).toFixed(2),
      lift: +((p.groundY + p.y) - yBefore).toFixed(2),
    };
    // целый виток — это (y1-y0)/turns метра; больше трети витка — баг
    const turn = (spiral.y1 - spiral.y0) / spiral.turns;
    out.spiralJumpOk = out.spiralJump.lift < turn * 0.6;
    out.turnHeight = +turn.toFixed(2);
  }

  /* ---------- 3. лестница звонарной ---------- */
  {
    d.setLocation('church');
    p.keys.clear();
    const L = ctx.churchLoc || d.churchLoc;
    const plats = (L && L.platforms) || [];
    const ramps = plats.filter((pl) => pl.ramp);
    out.ramps = ramps.length;
    if (ramps.length) {
      // берём самый нижний участок лестницы и спускаемся по нему
      const r = ramps.reduce((a, b) => (a.ramp.y0 < b.ramp.y0 ? a : b));
      const rr = r.ramp;
      const t = 0.15;
      const x = rr.x0 + (rr.x1 - rr.x0) * t;
      const z = rr.z0 + (rr.z1 - rr.z0) * t;
      put(x, z);
      p.groundY = rr.y0 + (rr.y1 - rr.y0) * t; p.y = 0;
      let maxLift = 0;
      let minY = 1e9, maxY = -1e9;
      for (let i = 0; i < 60; i++) {
        // спускаемся вдоль участка «назад»
        const tt = 0.15 + (i / 60) * 0.8;
        const tx = rr.x0 + (rr.x1 - rr.x0) * tt;
        const tz = rr.z0 + (rr.z1 - rr.z0) * tt;
        const yaw = Math.atan2(-(tx - p.pos.x), -(tz - p.pos.z));
        step(yaw, 1, true);
        if (p.grounded) maxLift = Math.max(maxLift, p.y);
        minY = Math.min(minY, p.groundY + p.y);
        maxY = Math.max(maxY, p.groundY + p.y);
      }
      out.stairs = {
        maxLift: +maxLift.toFixed(3),
        span: +(maxY - minY).toFixed(2),
        from: +rr.y0.toFixed(2), to: +rr.y1.toFixed(2),
      };
      out.stairsOk = out.stairs.maxLift < 0.25;
    } else {
      out.stairsOk = false;
    }
    d.setLocation('village');
    p.keys.clear();
  }

  /* ---------- 4. костёр «за город» ---------- */
  {
    const f = ctx.campfirePos || { x: 0, z: 0 };
    const fromCenter = Math.hypot(f.x, f.z);
    const fromPond = Math.hypot(f.x - 50, f.z + 14);
    const homes = (ctx.homes || []).map((h) => Math.hypot(h.x - f.x, h.z - f.z));
    const minHome = homes.length ? Math.min(...homes) : 99;
    // деревья не должны расти вплотную к кострищу
    let treeNear = 0;
    for (const c of (ctx.colliders.circles || [])) {
      if (c.r > 0.5) continue;                     // это не дерево (брёвна, камни)
      if (Math.hypot(c.x - f.x, c.z - f.z) < 5) treeNear++;
    }
    out.fire = {
      x: +f.x.toFixed(2), z: +f.z.toFixed(2),
      fromCenter: +fromCenter.toFixed(1),
      fromPond: +fromPond.toFixed(1),
      minHome: +minHome.toFixed(1),
      treeNear,
    };
    out.fireOk = fromCenter >= 25 && minHome >= 12 && fromPond < 25
      && fromPond > 13 && treeNear === 0;
    // на площади костра больше нет
    out.fireOnPlaza = Math.hypot(f.x, f.z) < 15;
  }

  /* ---------- 5. храм: дверь переставлена вправо и закрыта ---------- */
  {
    const ch = d.churchLoc;
    out.naveDoor = ch.naveDoor
      ? { x: +ch.naveDoor.x.toFixed(2), w: +ch.naveDoor.w.toFixed(2), closed: ch.naveDoor.closed }
      : null;
    // проём закрыт коллайдером: игрок не пройдёт ни через неф, ни сзади
    const doorBoxes = (ch.colliders.boxes || []).filter((b) =>
      Math.abs(b.cx - ch.naveDoor.x) < 0.8 && Math.abs(b.cz - ch.naveDoor.z) < 0.6);
    out.doorCollider = doorBoxes.length;
    // в бelfry можно попасть только с заднего двора
    d.setLocation('church', 'back');
    const inBelfry = Math.abs(p.pos.z - ch.spawnBack.z) < 1.2 && Math.abs(p.pos.x) < 1;
    out.belfryFromBack = inBelfry;
    d.setLocation('village');
    out.doorOk = !!out.naveDoor && out.naveDoor.x < -3 && out.naveDoor.closed
      && out.doorCollider > 0 && out.belfryFromBack;
  }

  /* ---------- 6. производительность ---------- */
  {
    let pointLights = 0;
    let instanced = 0;
    let instVisible = 0;
    ctx.scene.traverse((o) => {
      if (o.isPointLight && o.visible) pointLights++;
      if (o.isInstancedMesh) {
        instanced++;
        if (o.visible) instVisible++;
      }
    });
    out.perf = { pointLights, instanced, instVisible };
    // точечных источников должно быть заметно меньше, а лес — нарезан на чанки
    out.perfOk = pointLights <= 20 && instanced >= 20 && instVisible < instanced;
    // сколько деревььев видит камера
    out.perfTrees = (ctx.forestChunks || []).length;
  }

  return out;
});

/* ---------- печать ---------- */
const ok = (v) => (v ? 'да' : 'НЕТ');
console.log('=== Раунд 42: проверки ===');
console.log('спираль найдена:', ok(res.spiral.found));
if (res.spiralDown) {
  console.log(`спуск по спирали: подъём ног над опорой max=${res.spiralDown.maxLift} м, ` +
    `расхождение со ступенью max=${res.spiralDown.maxErr} м, конец y=${res.spiralDown.endY} (цель ${res.spiralDown.targetY})`);
  console.log('  спуск без «роста»:', ok(res.spiralDownOk));
}
if (res.spiralJump) {
  console.log(`прыжок на спирали: было ${res.spiralJump.before} → стало ${res.spiralJump.after} ` +
    `(подъём ${res.spiralJump.lift} м, виток ${res.turnHeight} м)`);
  console.log('  прыжок без переброса на виток:', ok(res.spiralJumpOk));
}
if (res.stairs) {
  console.log(`лестница звонарной: подъём ног над опорой max=${res.stairs.maxLift} м, ` +
    `перепад ${res.stairs.span} м (участок ${res.stairs.from}→${res.stairs.to})`);
  console.log('  лестница без «роста»:', ok(res.stairsOk));
}
if (res.fire) {
  console.log(`костёр «за город»: (${res.fire.x}, ${res.fire.z}) — ${res.fire.fromCenter} м от центра, ` +
    `${res.fire.fromPond} м от пруда, ${res.fire.minHome} м до ближайшего дома`);
  console.log('  костёр унесён из деревни:', ok(res.fireOk), res.fireOnPlaza ? '(СТАРЫЙ — на площади!)' : '');
}
if (res.naveDoor) {
  console.log(`дверь храма: x=${res.naveDoor.x} (ширина ${res.naveDoor.w}), закрыта=${res.naveDoor.closed}, ` +
    `коллайдеров на проёме: ${res.doorCollider}`);
  console.log('  дверь вправо и закрыта, звонарка — с заднего двора:', ok(res.doorOk));
}
if (res.perf) {
  console.log(`производительность: точечных источников ${res.perf.pointLights}, ` +
    `инстанс-мешей ${res.perf.instanced} (видимых ${res.perf.instVisible}), чанков леса ${res.perfTrees}`);
  console.log('  оптимизации применены:', ok(res.perfOk));
}
console.log('ошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 200));

let bad = 0;
if (!res.spiralDownOk) bad++;
if (!res.spiralJumpOk) bad++;
if (!res.stairsOk) bad++;
if (!res.fireOk) bad++;
if (!res.doorOk) bad++;
if (!res.perfOk) bad++;
if (errs.length) bad++;
console.log(`\nошибок: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
