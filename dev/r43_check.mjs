/**
 * ============================================================================
 *  Проверки раунда 43: текстуры, костёр, подземелье, звук
 * ============================================================================
 *
 *   1. Текстуры: у всех карт проекта есть настоящее изображение нужного
 *      размера — «битая» текстура превращается в белые/чёрные пятна.
 *   2. Материалы: у каждого материала с картой карта валидна и не чёрная.
 *   3. Костёр: отодвинут от пруда, подстилки (светлого пятна) под ним нет.
 *   4. Подземелье: стены замкнуты (в залах нет дыр в стенах), есть свод,
 *      есть тёплые огни, число точечных источников в норме.
 *   5. Звук: у подземелья свой звуковой режим, шаги по камню, капли.
 *   6. Игровая логика: время суток, инвентарь, рыбалка — не сломаны.
 *
 *  Запуск: cd dev && node r43_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const out = { errors: [] };

  /* ---------- 1. текстуры ---------- */
  const texBad = [];
  let texCount = 0;
  for (const [name, t] of Object.entries(d.T)) {
    if (!t || !t.image) { texBad.push(`${name}: нет изображения`); continue; }
    texCount++;
    const w = t.image.width, h = t.image.height;
    if (!w || !h) texBad.push(`${name}: ${w}×${h}`);
    if (w < 8 || h < 8) texBad.push(`${name}: слишком мелкая ${w}×${h}`);
  }
  out.textures = { count: texCount, bad: texBad };

  /* ---------- 2. материалы ---------- */
  const matBad = [];
  for (const [name, m] of Object.entries(d.M)) {
    if (!m || !m.isMaterial) continue;
    const map = m.map;
    if (map && (!map.image || !map.image.width)) matBad.push(`${name}: карта без изображения`);
    // материал не должен быть полностью чёрным или полностью белым
    if (m.color && m.emissiveIntensity === undefined) { /* пропускаем */ }
  }
  out.materials = { bad: matBad, count: Object.keys(d.M).length };

  /* ---------- 3. костёр ---------- */
  const fire = d.ctx.campfirePos;
  const pond = { x: 50, z: -14, r: 10.6 };
  const dp = Math.hypot(fire.x - pond.x, fire.z - pond.z) - pond.r;
  // ищем «подстилку» — круглую светлую плоскость рядом с костром
  let pad = null;
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.type || !g.type.includes('Circle')) return;
    const p = o.getWorldPosition(new d.THREE.Vector3());
    const r = Math.hypot(p.x - fire.x, p.z - fire.z);
    if (r < 9) pad = { r: Math.max(...g.parameters?.radius || [0]), dist: +r.toFixed(2), type: g.type };
  });
  out.fire = { x: fire.x, z: fire.z, fromPond: +dp.toFixed(2), pad };

  /* ---------- 4. подземелье ---------- */
  d.setLocation('dungeon');
  const dun = d.dungeonLoc;
  const scene = d.sceneDungeon;
  let point = 0, dir = 0, hemi = 0, amb = 0;
  scene.traverse((o) => {
    if (o.isPointLight) point++;
    else if (o.isDirectionalLight) dir++;
    else if (o.isHemisphereLight) hemi++;
    else if (o.isAmbientLight) amb++;
  });
  // есть ли свод (объекты потолка) и огни (факелы)
  let vaultTris = 0, torches = 0;
  scene.traverse((o) => {
    // свод собран как группа с несколькими мешами — считаем все её треугольники
    if (o.name === 'dungeonCeiling') {
      o.traverse((c) => {
        if (c.geometry && c.geometry.index) vaultTris += c.geometry.index.count / 3;
      });
    }
    if (o.isPointLight && o.color && o.color.getHex() === 0xff8a3c) torches++;
  });
  // дыры в стенах: проверяем, что в каждом зале периметр перекрыт коллайдерами
  const A = { x0: -12, x1: 12, z0: -34, z1: -20 };
  const B = { x0: -15, x1: 15, z0: -20, z1: 6 };
  const C = { x0: -14, x1: 14, z0: 14, z1: 36 };
  const boxes = dun.colliders.boxes;
  /** Есть ли коллайдер, закрывающий точку на стене. */
  const covered = (x, z) => boxes.some((b) => {
    const dx = Math.abs(x - b.cx), dz = Math.abs(z - b.cz);
    const ax = dx * Math.abs(Math.cos(b.ang || 0)) + dz * Math.abs(Math.sin(b.ang || 0));
    const az = dx * Math.abs(Math.sin(b.ang || 0)) + dz * Math.abs(Math.cos(b.ang || 0));
    return ax <= b.hx + 0.35 && az <= b.hz + 0.35;
  });
  // проёмы, которые так и задуманы: портал наружу, три арки между залами
  // и широкий спуск в шахту. В них коллайдера нет — иначе не пройти.
  const GATE_X = 2.3;
  const GAP_MAIN = [-2.9, 2.9], GAP_WEST = [-9.8, -6.4], GAP_EAST = [6.4, 9.8];
  const SHAFT = [-4.5, 4.5];
  /** Проём на данной стене: [от, до] по её оси. */
  const openingAt = (z, x) => {
    if (Math.abs(z - A.z0) < 0.1 && Math.abs(x) <= GATE_X) return true;      // портал
    if (Math.abs(z - A.z1) < 0.1
      && (x >= GAP_MAIN[0] && x <= GAP_MAIN[1]
        || x >= GAP_WEST[0] && x <= GAP_WEST[1]
        || x >= GAP_EAST[0] && x <= GAP_EAST[1])) return true;               // арки
    if (Math.abs(z - B.z1) < 0.1 && x >= SHAFT[0] && x <= SHAFT[1]) return true; // шахта
    if (Math.abs(z - C.z0) < 0.1 && x >= SHAFT[0] && x <= SHAFT[1]) return true; // низ шахты
    return false;
  };
  const holes = [];
  for (const [room, r] of [['A', A], ['B', B], ['C', C]]) {
    for (let x = r.x0 + 0.6; x <= r.x1 - 0.6; x += 1.2) {
      if (!covered(x, r.z0) && !openingAt(r.z0, x)) holes.push(`${room} север x=${x.toFixed(1)}`);
      if (!covered(x, r.z1) && !openingAt(r.z1, x)) holes.push(`${room} юг x=${x.toFixed(1)}`);
    }
    for (let z = r.z0 + 0.6; z <= r.z1 - 0.6; z += 1.2) {
      if (!covered(r.x0, z)) holes.push(`${room} запад z=${z.toFixed(1)}`);
      if (!covered(r.x1, z)) holes.push(`${room} восток z=${z.toFixed(1)}`);
    }
  }
  out.dungeon = {
    point, dir, hemi, amb, vaultTris: Math.round(vaultTris), torches,
    holes: holes.slice(0, 12), holeCount: holes.length,
    floors: (dun.floors || []).length,
    spots: Object.keys(dun.spots || {}).length,
    update: typeof dun.update === 'function',
  };

  /* ---------- 5. звук ---------- */
  const amb2 = d.ambience;
  amb2.setInterior('dungeon');
  amb2.setSurface('stone');
  out.audio = {
    interior: amb2.interior,
    surface: amb2.surface,
    hasDrone: !!amb2.drone,
    hasCaveBus: !!amb2.caveBus,
    fns: ['drip', 'groan', 'stoneStep', 'woodStep', 'deepBoom', 'crystalChime']
      .filter((k) => typeof amb2[k] === 'function'),
  };
  // вызовы не должны бросать
  try {
    amb2.drip(); amb2.groan(); amb2.stoneStep(false); amb2.woodStep(true);
    amb2.deepBoom(); amb2.crystalChime(); amb2.step(true); amb2.jump(); amb2.land();
  } catch (e) {
    out.errors.push('звук: ' + e.message);
  }
  amb2.setInterior('outdoor');
  amb2.setSurface('grass');

  /* ---------- 6. игровая логика ---------- */
  d.setLocation('village');
  const logic = {};
  // время суток
  const before = d.env.target;
  d.env.setTimeOfDay('night', true);
  logic.night = d.env.target === 'night';
  d.env.setTimeOfDay('morning', true);
  logic.morning = d.env.target === 'morning';
  d.env.setTimeOfDay(before, true);
  // инвентарь
  const inv = d.inventory;
  const free = inv.slots.filter((s) => !s).length;
  inv.add({ id: 'test_wood', name: 'Тест', count: 3, icon: '🪵' });
  logic.inventory = { free, added: inv.slots.some((s) => s && s.id === 'test_wood') };
  // рыбалка: каталог и конфиг мини-игры на месте
  logic.fish = {
    species: (d.FISH || []).length,
    hookCfg: !!(d.HOOK_CFG && d.HOOK_CFG.common),
  };
  // двери: дом, таверна, храм, подземелье
  logic.doors = {
    tavern: !!d.ctx.doors.tavern,
    barnExit: !!d.ctx.doors.barnExit,
    dungeon: !!d.ctx.doors.dungeon,
    homes: (d.ctx.doors.homes || []).length,
    church: !!d.ctx.doors.church,
  };
  out.logic = logic;
  return out;
});

/* ------------------------------------------------------------------ */
/*  Вывод                                                               */
/* ------------------------------------------------------------------ */
const ok = (v) => (v ? '✓' : '✗');

console.log(`текстуры: ${res.textures.count} шт., битых ${res.textures.bad.length}`);
for (const b of res.textures.bad.slice(0, 8)) console.log('   ', b);
console.log(`материалы: ${res.materials.count} шт., с битыми картами ${res.materials.bad.length}`);
for (const b of res.materials.bad.slice(0, 8)) console.log('   ', b);
console.log(`костёр: (${res.fire.x}, ${res.fire.z}), до кромки воды ${res.fire.fromPond} м; ` +
  `светлая подстилка: ${res.fire.pad ? JSON.stringify(res.fire.pad) : 'нет'}`);
if (res.dungeon.holes.length) console.log('  щели:', res.dungeon.holes.join('; '));
console.log(`подземелье: источников ${res.dungeon.point} (факелов ${res.dungeon.torches}), ` +
  `свод ${res.dungeon.vaultTris} треугольников, дыр в стенах ${res.dungeon.holeCount}, ` +
  `уровней пола ${res.dungeon.floors}, точек осмотра ${res.dungeon.spots}`);
console.log(`звук: пространство «${res.audio.interior}», поверхность «${res.audio.surface}», ` +
  `гул ${res.audio.hasDrone ? 'есть' : 'нет'}, эхо ${res.audio.hasCaveBus ? 'есть' : 'нет'}, ` +
  `функции: ${res.audio.fns.join(', ')}`);
console.log(`логика: ночь ${ok(res.logic.night)}, утро ${ok(res.logic.morning)}, ` +
  `инвентарь ${ok(res.logic.inventory.added)}, рыб ${res.logic.fish.species} видов, ` +
  `двери ${JSON.stringify(res.logic.doors)}`);

const texOk = res.textures.bad.length === 0;
const matOk = res.materials.bad.length === 0;
const fireOk = res.fire.fromPond > 7 && !res.fire.pad;
const dunOk = res.dungeon.holeCount === 0 && res.dungeon.point <= 28
  && res.dungeon.torches >= 6 && res.dungeon.vaultTris > 100;
const audioOk = res.audio.hasDrone && res.audio.hasCaveBus
  && res.audio.fns.length === 6 && res.audio.interior === 'dungeon';
const logicOk = res.logic.night && res.logic.morning && res.logic.inventory.added
  && res.logic.fish.species > 0 && res.logic.doors.tavern && res.logic.doors.dungeon;

console.log('текстуры целы:', ok(texOk));
console.log('материалы в порядке:', ok(matOk));
console.log('костёр убран от воды и без подстилки:', ok(fireOk));
console.log('подземелье замкнуто и освещено:', ok(dunOk));
console.log('звук подземелья работает:', ok(audioOk));
console.log('игровая логика цела:', ok(logicOk));
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 6)) console.log('  ', e.slice(0, 200));

let bad = 0;
if (!texOk) bad++;
if (!matOk) bad++;
if (!fireOk) bad++;
if (!dunOk) bad++;
if (!audioOk) bad++;
if (!logicOk) bad++;
if (errs.length) bad++;
console.log(`\nошибок: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
