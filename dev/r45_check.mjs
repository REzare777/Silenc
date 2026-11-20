/**
 * ============================================================================
 *  Раунд 45: проверки дорог, построек, полей и животных
 * ============================================================================
 *
 *  Проверяем то, что жаловался игрок:
 *
 *   1. дороги не идут по воде и не пересекают постройки;
 *   2. к каждому дому ведёт тропинка, и она кончается у порога;
 *   3. уличные предметы не стоят внутри стен;
 *   4. стоги сена переехали за озеро, поля на месте;
 *   5. кот и пёс на месте, пёс уходит к дому при смене локации;
 *   6. овцы на пастбище, куры в курятнике.
 *
 *  Запуск: cd dev && node r45_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const out = {};

  const POND = { x: 50, z: -14, r: 10.6 };
  const trails = ctx.roadTrails || [];
  out.trailCount = trails.length;

  /* ---------- 1. дороги: ни воды, ни стен ---------- */
  // расстояние от точки до отрезка
  const distSeg = (px, pz, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
  };

  // точка внутри повёрнутого прямоугольника?
  const inside = (x, z, b, pad = 0) => {
    if (b.r) return Math.hypot(x - b.x, z - b.z) < b.r + pad;   // круглая постройка
    const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
    const dx = x - b.x, dz = z - b.z;
    const lx = c * dx - s * dz, lz = s * dx + c * dz;
    return Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad;
  };

  const inWater = [];
  const inBuilding = [];
  const minPond = { d: 99, id: '' };
  for (const t of trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const a = t.pts[i], b = t.pts[i + 1];
      // вода: считаем расстояние от центра пруда до отрезка
      const dw = distSeg(POND.x, POND.z, a, b);
      if (dw < minPond.d) { minPond.d = +dw.toFixed(2); minPond.id = t.id; }
      if (dw < POND.r + 1.3) inWater.push(`${t.id}[${i}] ${dw.toFixed(1)} м`);
      // постройки: внутренние точки отрезка, за 30 см вглубь стен.
      // Тропинка может подходить к порогу, но не идёт сквозь стены.
      for (const k of [0.2, 0.4, 0.6, 0.8]) {
        const x = a[0] + (b[0] - a[0]) * k;
        const z = a[1] + (b[1] - a[1]) * k;
        for (const fp of (ctx.footprints || [])) {
          if (inside(x, z, fp, -0.3)) {
            inBuilding.push(`${t.id} → ${fp.name} (${x.toFixed(1)},${z.toFixed(1)})`);
          }
        }
      }
    }
  }
  out.inWater = inWater;
  out.inBuilding = [...new Set(inBuilding)];
  out.minPond = minPond;

  /* ---------- 2. к каждому дому — тропинка до порога ---------- */
  const homeTrails = {};
  for (const h of (ctx.homes || [])) {
    const door = (ctx.doors.homes || [])[h.i];
    let best = 99, bestId = '';
    for (const t of trails) {
      const last = t.pts[t.pts.length - 1];
      const dd = Math.hypot(last[0] - door.x, last[1] - door.z);
      if (dd < best) { best = dd; bestId = t.id; }
    }
    homeTrails[h.i] = { id: bestId, dist: +best.toFixed(2) };
  }
  out.homeTrails = homeTrails;
  out.homesReachable = Object.values(homeTrails).every((v) => v.dist < 3.5);

  /* ---------- 3. предметы не внутри построек ---------- */
  const badProps = [];
  for (const p of (ctx.propSpots || [])) {
    for (const fp of (ctx.footprints || [])) {
      if (inside(p.x, p.z, fp, 0)) {
        badProps.push(`${p.name} (${p.x.toFixed(1)},${p.z.toFixed(1)}) в «${fp.name}»`);
      }
    }
  }
  out.badProps = badProps;

  /* ---------- 4. поля и стоги за озером ---------- */
  const wheat = (ctx.fields || []).map((f) => ({ x: f.x, z: f.z, w: f.w, d: f.d }));
  out.wheat = wheat;
  out.fieldsEast = wheat.filter((w) => w.x > 60).length;
  const hay = (ctx.propSpots || []).filter((p) => p.name === 'стог');
  out.hay = hay.map((h) => `${h.x},${h.z}`);
  out.hayEast = hay.filter((h) => h.x > 60).length;
  // деревья не растут на полях
  let treeOnField = 0;
  for (const t of (ctx.forestTrees || [])) {
    if (t.x > 60 && t.x < 104 && t.z > -34 && t.z < 16) treeOnField++;
  }
  out.treeOnField = treeOnField;

  /* ---------- 5. кот и пёс ---------- */
  const dog = ctx.critters.dog;
  const cat = ctx.critters.cat;
  out.dog = dog ? { x: +dog.g.position.x.toFixed(1), z: +dog.g.position.z.toFixed(1), mode: dog.mode } : null;
  out.cat = cat ? { x: +cat.g.position.x.toFixed(1), z: +cat.g.position.z.toFixed(1) } : null;
  // пёс не внутри трактира
  const tavernFp = (ctx.footprints || []).find((f) => f.name === 'таверна');
  out.dogOutsideTavern = dog && tavernFp ? !inside(dog.g.position.x, dog.g.position.z, tavernFp, 0.2) : false;
  // кот не внутри дома
  const catHome = (ctx.homes || []).find((h) => cat && Math.hypot(h.x - cat.g.position.x, h.z - cat.g.position.z) < 6);
  out.catOnPorch = !!catHome;

  /* ---------- 6. зоны животных ---------- */
  const pasture = ctx.pasture;
  const henyard = ctx.henyard;
  out.pasture = pasture ? { x: pasture.x, z: pasture.z } : null;
  out.henyard = henyard ? { x: henyard.x, z: henyard.z } : null;
  out.sheepInPasture = (ctx.critters.sheep || []).every((s) => s.area &&
    Math.hypot(s.g.position.x - pasture.x, s.g.position.z - pasture.z) < 12);
  out.hensInYard = (ctx.critters.hens || []).every((h) => h.area &&
    Math.hypot(h.g.position.x - henyard.x, h.g.position.z - henyard.z) < 8);
  out.ramHasHorns = !!(ctx.critters.sheep || [])[1]?.g;

  /* ---------- 7. доска для записки ---------- */
  const boardIt = (ctx.interactables || []).find((i) => (i.labelFn ? i.labelFn() : i.label) === 'Написать на доске');
  out.boardExists = !!boardIt;
  out.boardPos = boardIt ? { x: +boardIt.pos.x.toFixed(1), z: +boardIt.pos.z.toFixed(1) } : null;
  // доска рядом с домиком в сторону подземелья
  const dh = ctx.dungeon || { x: -72, z: -66 };
  out.boardTowardDungeon = boardIt
    ? Math.hypot(boardIt.pos.x - dh.x, boardIt.pos.z - dh.z) < Math.hypot(13 - dh.x, 14 - dh.z)
    : false;

  return out;
});

/* ---------- проверка телепорта пса при смене локации ---------- */
const dogMove = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const before = { x: ctx.critters.dog.g.position.x, z: ctx.critters.dog.g.position.z };
  ctx.systems.locations.setLocation('tavern');
  const after = { x: ctx.critters.dog.g.position.x, z: ctx.critters.dog.g.position.z };
  const home = (ctx.doors.homes || [])[ctx.playerHome ?? 1];
  ctx.systems.locations.setLocation('village');
  return {
    before, after, mode: ctx.critters.dog.mode,
    home: home ? { x: +home.x.toFixed(1), z: +home.z.toFixed(1) } : null,
    moved: Math.hypot(after.x - before.x, after.z - before.z) > 3,
    atHome: home ? Math.hypot(after.x - home.x, after.z - home.z) < 2.5 : false,
  };
});

const checks = [
  ['дороги описаны в одном месте', res.trailCount >= 20],
  ['ни одна тропинка не идёт по пруду', res.inWater.length === 0],
  ['дороги не пересекают постройки', res.inBuilding.length === 0],
  ['к каждому дому ведёт тропинка', res.homesReachable],
  ['предметы не стоят внутри стен', res.badProps.length === 0],
  ['поля за озером появились', res.fieldsEast >= 3],
  ['все стоги переехали за озеро', res.hayEast === res.hay.length && res.hay.length === 4],
  ['на полях не растут деревья', res.treeOnField === 0],
  ['пёс на месте и не внутри трактира', !!res.dog && res.dogOutsideTavern],
  ['кот сидит на крыльце дома', res.catOnPorch],
  ['пёс уходит к дому при смене локации', dogMove.moved && dogMove.atHome && dogMove.mode === 'wait'],
  ['овцы на пастбище', res.sheepInPasture],
  ['куры в курятнике', res.hensInYard],
  ['доска для записки стоит у дороги к скале', res.boardExists && res.boardTowardDungeon],
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) bad++;
}
console.log('\nдетали:');
console.log('  тропинок:', res.trailCount, '| ближе всего к пруду:', res.minPond.d, 'м (' + res.minPond.id + ')');
console.log('  дороги в постройках:', res.inBuilding.join(', ') || 'нет');
console.log('  дороги в воде:', res.inWater.join(', ') || 'нет');
console.log('  предметы в стенах:', res.badProps.join(', ') || 'нет');
console.log('  поля (пшеница):', res.wheat.map((w) => `${w.x},${w.z}`).join(' | '));
console.log('  стоги:', res.hay.join(' | '));
console.log('  пёс:', JSON.stringify(res.dog), '| кот:', JSON.stringify(res.cat));
console.log('  пёс после смены локации:', JSON.stringify(dogMove));
console.log('  тропинки к домам:', JSON.stringify(res.homeTrails));
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 8)) console.log('  ', e.slice(0, 200));

bad += errs.length;
console.log(`\nошибок: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
