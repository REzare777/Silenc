/**
 * ============================================================================
 *  Проверки раунда 46: храм (закрытые двери, чистый проём, открытый проход
 *  к винтовой лестнице), перестановка домов и амбара, пёс у дома с табличкой
 * ============================================================================
 *
 *   1. Храм: створки южного портала закрыты, «фризы»-колонны убраны,
 *      белый прямоугольник за проёмом удалён.
 *   2. Храм: проход из нефа в башню открыт — игрок доходит до винтовой
 *      лестницы и может ударить в колокол.
 *   3. Пустой забор в лесу убран (на его месте теперь амбар).
 *   4. Дом, стоявший прямо за трактиром, переехал на место амбара;
 *      амбар уехал к лесу, рядом с пастбищем, и не заходит в загоны.
 *   5. Пёс ждёт у дома с табличкой (там доска у дороги к скале).
 *
 *  Запуск: cd dev && node r46_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import { readFileSync } from 'node:fs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

/* ---------- 1. исходник храма: двери закрыты, «фризов» нет ---------- */
const src = readFileSync(new URL('../src/world/church.js', import.meta.url), 'utf8');
const srcChecks = {
  closedLeaves: /const openA = 0;/.test(src),
  noFrieze: !/stoneDark', 0\.6, 3\.8, 0\.6/.test(src),
  noGradient: !/createLinearGradient/.test(src),
  noNaveBacking: !/B\.put\('dark', ARK_W/.test(src),
  noNaveCollider: !/ARK_X, cz: nz\(D \/ 2 - T \/ 2\), hx: ARK_W \/ 2/.test(src),
  noShield: !/С изнанки башни проём тоже закрыт/.test(src),
};

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const p = d.player;
  const out = {};

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

  /* ---------- 2. проход неф → башня ---------- */
  {
    const ch = d.churchLoc;
    out.naveDoor = ch.naveDoor
      ? { x: +ch.naveDoor.x.toFixed(2), w: +ch.naveDoor.w.toFixed(2), closed: ch.naveDoor.closed }
      : null;
    // коллайдер, накрывающий сам проём, — это и есть стена; стены рядом
    const doorBoxes = (ch.colliders.boxes || []).filter((b) =>
      Math.abs(ch.naveDoor.x - b.cx) < b.hx && Math.abs(ch.naveDoor.z - b.cz) < b.hz);
    out.doorCollider = doorBoxes.length;

    d.setLocation('church');
    p.keys.clear();
    const dz = ch.naveDoor.z;
    put(ch.naveDoor.x, dz - 1.4);
    const z0 = p.pos.z;
    step(Math.PI, 150, true);                 // на север, через проём в башню
    out.pass = { from: +z0.toFixed(2), to: +p.pos.z.toFixed(2), x: +p.pos.x.toFixed(2) };
    out.passOk = p.pos.z > dz + 0.8;

    // винтовая лестница башни — рядом, игрок доходит до неё
    const sp = (ch.platforms || []).find((pl) => pl.sp);
    out.spiral = !!sp;
    if (sp) {
      const s = sp.sp;
      const a0 = s.a0 ?? 0;
      out.spiralDist = +Math.hypot(p.pos.x - (s.cx + Math.sin(a0) * 1.3),
        p.pos.z - (s.cz + Math.cos(a0) * 1.3)).toFixed(2);
      // подъём по винту: ноги на ступенях, высота растёт
      put(s.cx + Math.sin(a0) * 1.3, s.cz + Math.cos(a0) * 1.3);
      p.groundY = 0; p.y = 0; p.vy = 0;
      let minY = 1e9, maxY = -1e9, maxLift = 0;
      for (let i = 0; i < 900; i++) {
        const a = Math.atan2(p.pos.x - s.cx, p.pos.z - s.cz);
        step(Math.atan2(-Math.cos(a), Math.sin(a)), 1, true);
        if (p.grounded) maxLift = Math.max(maxLift, p.y);
        minY = Math.min(minY, p.groundY + p.y);
        maxY = Math.max(maxY, p.groundY + p.y);
      }
      out.climb = {
        minY: +minY.toFixed(2), maxY: +maxY.toFixed(2),
        span: +(maxY - minY).toFixed(2), maxLift: +maxLift.toFixed(3),
      };
      out.climbOk = out.climb.span > 5 && out.climb.maxLift < 0.25;
      // колокол — наверху, рядом с галереей
      const bp = ch.bellPoint;
      out.bell = { x: +bp.x.toFixed(2), y: +bp.y.toFixed(2), z: +bp.z.toFixed(2) };
      out.bellNear = Math.hypot(p.pos.x - bp.x, p.pos.z - bp.z) < 3.5
        && Math.abs((p.groundY + p.y) - bp.y) < 3;
      ch.ringBell();
      out.bellOk = out.bellNear;
    }
    d.setLocation('village');
    p.keys.clear();
  }

  /* ---------- 3–4. планировка западной части деревни ---------- */
  {
    const homes = ctx.homes || [];
    const fp = ctx.footprints || [];
    const fields = ctx.fields || [];
    out.homeMoved = homes.some((h) => Math.abs(h.x + 40) < 0.6 && Math.abs(h.z + 8) < 0.6);
    out.oldHomeGone = !homes.some((h) => Math.abs(h.x + 29) < 0.6 && Math.abs(h.z + 22) < 0.6);
    const barnFp = fp.find((f) => f.name && f.name.indexOf('амбар') === 0)
      || fp.find((f) => Math.abs(f.x + 11) < 1 && Math.abs(f.z - 40) < 1);
    out.barn = barnFp ? { x: +barnFp.x.toFixed(1), z: +barnFp.z.toFixed(1) } : null;
    // амбар переехал к краю поля — рядом с тем местом, где зреет хлеб
    out.barnMoved = !!barnFp && Math.abs(barnFp.x + 11) < 1 && Math.abs(barnFp.z - 40) < 1;
    // лесная делянка на опушке: избушка лесоруба вместо амбара
    const yardFp = fp.find((f) => f.name === 'лесная делянка');
    out.yard = yardFp ? { x: +yardFp.x.toFixed(1), z: +yardFp.z.toFixed(1) } : null;
    out.yardOk = !!yardFp && Math.abs(yardFp.x + 45) < 1 && Math.abs(yardFp.z - 13) < 1;
    // пустой забор в лесу убран: поля только за озером
    out.fields = fields.map((f) => `${Math.round(f.x)},${Math.round(f.z)}`);
    out.emptyPlotGone = !fields.some((f) => Math.abs(f.x + 44) < 2 && Math.abs(f.z - 16) < 2);
    // амбар не заходит в овечий загон и в курятник
    const pasture = ctx.pasture || { x: -45, z: 31, w: 13, d: 11 };
    const henyard = ctx.henyard || { x: -16, z: 22, w: 6, d: 8 };
    out.barnPastureDist = barnFp ? +Math.hypot(barnFp.x - pasture.x, barnFp.z - pasture.z).toFixed(1) : 0;
    out.barnHenyardDist = barnFp ? +Math.hypot(barnFp.x - henyard.x, barnFp.z - henyard.z).toFixed(1) : 0;
    // углы амбара не заходят в загон (пастбище: x −51.5…−38.6, z 25.5…36.5)
    let corners = null;
    if (barnFp) {
      const c = Math.cos(barnFp.ry || 0), s = Math.sin(barnFp.ry || 0);
      const hx = barnFp.hx, hz = barnFp.hz;
      corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([ox, oz]) => ({
        x: barnFp.x + ox * c + oz * s, z: barnFp.z - ox * s + oz * c,
      }));
    }
    out.barnCorners = corners ? corners.map((q) => `${q.x.toFixed(1)},${q.z.toFixed(1)}`) : [];
    const inPasture = corners ? corners.some((q) =>
      q.x > -51.5 && q.x < -38.6 && q.z > 25.5 && q.z < 36.5) : true;
    out.barnOutPasture = !inPasture;
    // тропинка к амбару и к новому дому существует
    const trails = ctx.roadTrails || [];
    const barnTrail = trails.find((t) => t.id === 'barn');
    const homeTrail = trails.find((t) => t.id === 'homeE_w');
    const last = (tr) => (tr && tr.pts.length ? tr.pts[tr.pts.length - 1] : null);
    const bLast = last(barnTrail), hLast = last(homeTrail);
    out.barnTrail = bLast ? [+bLast[0].toFixed(1), +bLast[1].toFixed(1)] : null;
    const woodsTrail = trails.find((t) => t.id === 'woods');
    const wLast = last(woodsTrail);
    out.woodsTrail = wLast ? [+wLast[0].toFixed(1), +wLast[1].toFixed(1)] : null;
    out.homeTrail = hLast ? [+hLast[0].toFixed(1), +hLast[1].toFixed(1)] : null;
    const doors = ctx.doors.homes || [];
    const movedHome = homes.find((h) => Math.abs(h.x + 40) < 0.6 && Math.abs(h.z + 8) < 0.6);
    const movedDoor = movedHome ? doors[movedHome.i] : null;
    out.movedDoor = movedDoor ? [+movedDoor.x.toFixed(1), +movedDoor.z.toFixed(1)] : null;
    out.homeTrailOk = !!(hLast && movedDoor
      && Math.hypot(hLast[0] - movedDoor.x, hLast[1] - movedDoor.z) < 3);
    out.barnTrailOk = !!(bLast && barnFp && Math.hypot(bLast[0] - barnFp.x, bLast[1] - barnFp.z) < 8);
  }

  /* ---------- 5. пёс у дома с табличкой ---------- */
  {
    const dog = ctx.critters.dog;
    const bi = ctx.boardHome;
    const door = (ctx.doors.homes || [])[bi];
    out.boardHome = bi;
    out.dog = dog ? { x: +dog.g.position.x.toFixed(1), z: +dog.g.position.z.toFixed(1), mode: dog.mode } : null;
    out.dogAtBoard = !!(dog && door
      && Math.hypot(dog.g.position.x - door.x, dog.g.position.z - door.z) < 2.5);
    // смена локации не уводит пса в другое место
    const before = { x: dog.g.position.x, z: dog.g.position.z };
    ctx.systems.locations.setLocation('tavern');
    const after = { x: dog.g.position.x, z: dog.g.position.z };
    ctx.systems.locations.setLocation('village');
    out.dogAfter = { x: +after.x.toFixed(1), z: +after.z.toFixed(1), mode: dog.mode };
    out.dogStays = !!door && Math.hypot(after.x - door.x, after.z - door.z) < 2.5
      && dog.mode === 'wait';
    out.dogMovedFromTavern = Math.hypot(after.x - before.x, after.z - before.z) < 3;
  }

  return out;
});

/* ---------- печать ---------- */
const ok = (v) => (v ? 'да' : 'НЕТ');
console.log('=== Раунд 46: проверки ===');
console.log('исходник храма:');
for (const [k, v] of Object.entries(srcChecks)) console.log(`  ${v ? '✓' : '✗'} ${k}`);
console.log('проход неф → башня:');
console.log(`  дверь: x=${res.naveDoor ? res.naveDoor.x : '—'}, закрыта=${res.naveDoor ? res.naveDoor.closed : '—'}, ` +
  `коллайдеров на проёме: ${res.doorCollider}`);
console.log(`  игрок прошёл: z ${res.pass.from} → ${res.pass.to}`);
if (res.climb) {
  console.log(`  винт: перепад ${res.climb.span} м (${res.climb.minY}→${res.climb.maxY}), ` +
    `подъём ног max=${res.climb.maxLift} м`);
}
console.log(`  колокол: x=${res.bell ? res.bell.x : '—'}, y=${res.bell ? res.bell.y : '—'}`);
console.log('планировка:');
console.log(`  дом на месте амбара: ${res.homeMoved ? 'да' : 'НЕТ'} (старый дом у трактира убран: ${res.oldHomeGone ? 'да' : 'НЕТ'})`);
console.log(`  амбар: ${res.barn ? `${res.barn.x}, ${res.barn.z}` : '—'} (углы: ${res.barnCorners.join(' | ')})`);
console.log(`  поля: ${res.fields.join(' | ')}`);
console.log(`  до пастбища ${res.barnPastureDist} м, до курятника ${res.barnHenyardDist} м`);
console.log(`  тропинка к дому: ${res.homeTrail} (дверь ${res.movedDoor})`);
console.log(`  тропинка к амбару: ${res.barnTrail}`);
console.log('пёс:');
console.log(`  дом с табличкой: №${res.boardHome}, пёс: ${res.dog ? `${res.dog.x}, ${res.dog.z}` : '—'}`);
console.log(`  после смены локации: ${res.dogAfter.x}, ${res.dogAfter.z} (${res.dogAfter.mode})`);
console.log('ошибок в консоли:', errs.length);
for (const e of errs) console.log('  ', e.slice(0, 200));

const checks = [
  ['створки южного портала закрыты', srcChecks.closedLeaves],
  ['«фризы»-колонны убраны', srcChecks.noFrieze],
  ['белый прямоугольник за проёмом удалён', srcChecks.noGradient],
  ['глухая подложка в проёме убрана', srcChecks.noNaveBacking],
  ['коллайдер проёма убран', srcChecks.noNaveCollider],
  ['щит в башне убран', srcChecks.noShield],
  ['проём неф → башня открыт', !!res.naveDoor && !res.naveDoor.closed && res.doorCollider === 0 && res.passOk],
  ['винтовая лестница проходится', !!res.spiral && res.climbOk],
  ['колокол достижим с винта', !!res.bellOk],
  ['пустой забор в лесу убран', res.emptyPlotGone],
  ['дом за трактиром переехал на место амбара', res.homeMoved && res.oldHomeGone],
  ['амбар стоит у поля', res.barnMoved],
  ['на опушке — лесная делянка', res.yardOk],
  ['амбар не заходит в овечий загон', res.barnOutPasture],
  ['тропинка ведёт к новому дому', res.homeTrailOk],
  ['тропинка ведёт к амбару', res.barnTrailOk],
  ['тропинка ведёт к лесной делянке', !!(res.woodsTrail && res.yard
    && Math.hypot(res.woodsTrail[0] - res.yard.x, res.woodsTrail[1] - res.yard.z) < 8)],
  ['пёс ждёт у дома с табличкой', res.dogAtBoard && res.dogStays && res.dogMovedFromTavern],
];

let bad = 0;
for (const [name, good] of checks) {
  console.log(`${good ? '✓' : '✗'} ${name}`);
  if (!good) bad++;
}
console.log(`\nошибок: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
