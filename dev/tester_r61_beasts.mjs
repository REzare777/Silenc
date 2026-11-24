/**
 * ============================================================================
 *  Раунд 61 — тест-агент: зверинец подземелья
 * ============================================================================
 *
 *  Проверяю нововведения раунда 61:
 *   1) в пещере есть все 11 пород + босс;
 *   2) у каждой породы свои HP / урон / скорость;
 *   3) монстры не стоят в стенах и не выходят за пределы пещеры;
 *   4) призрак выше и шире гоблина;
 *   5) у элитного гоблина-стража щит (меньше получаемого урона);
 *   6) гоблин-лучник стреляет (снаряды в полёте);
 *   7) гриб замедляет игрока (player.slow > 0);
 *   8) слизень оставляет ядовитую лужу (и видно ли её);
 *   9) змея кусается (игрок теряет здоровье);
 *  10) паук прыгает (близко подходит к игроку);
 *  11) голем бьёт с земли (ударная волна);
 *  12) призрак проходит сквозь стены.
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_beasts.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/* ---------------- заходим в подземелье ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.player.pos.set(-9, 0, -17);
  d.player.groundY = 0;
  d.player.y = 0;
  d.setLocation('dungeon');
});
await page.waitForTimeout(1500);

let ok = 0, fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} extra подробность
 */
function check(name, cond, extra = '') {
  if (cond) { ok++; results.push(`✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; results.push(`✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

/* ================= 1. состав зверинца ================= */
const roster = await page.evaluate(() => {
  const d = window.__dbg;
  const list = d.monsters.list;
  const byId = {};
  for (const m of list) {
    const id = m.spec.id;
    if (!byId[id]) {
      byId[id] = {
        id, name: m.spec.name, n: 0,
        hp: m.maxHp, dmg: m.dmg, speed: m.spec.speed, reach: m.spec.reach,
        attack: m.spec.attack, tier: m.spec.tier, radius: m.spec.radius,
        height: m.spec.height, y: m.y,
      };
    }
    byId[id].n++;
  }
  return { total: list.length, byId };
});

const WANT = ['goblin_sword', 'goblin_bow', 'goblin_guard', 'ghost', 'spider',
  'slime_green', 'slime_blue', 'slime_red', 'shroom', 'snake', 'golem_small', 'orc_boss'];
const missing = WANT.filter((id) => !roster.byId[id]);
const extra = Object.keys(roster.byId).filter((id) => !WANT.includes(id));

check('в пещере все 11 пород + босс', missing.length === 0,
  missing.length ? `нет: ${missing.join(', ')}` : `найдено ${Object.keys(roster.byId).length}/12, всего зверей ${roster.total}`);
check('нет лишних пород', extra.length === 0, extra.join(', ') || 'нет');
check('каждая порода встречается хотя бы раз',
  WANT.every((id) => roster.byId[id] && roster.byId[id].n >= 1),
  WANT.map((id) => `${id}:${roster.byId[id] ? roster.byId[id].n : 0}`).join(' '));

/* ================= 2. у каждой породы свои статы ================= */
const statsTable = WANT.map((id) => roster.byId[id]).filter(Boolean);
const dupHp = statsTable.map((s) => s.hp).filter((v, i, a) => a.indexOf(v) !== i);
const dupDmg = statsTable.map((s) => s.dmg).filter((v, i, a) => a.indexOf(v) !== i);
const dupSpd = statsTable.map((s) => s.speed).filter((v, i, a) => a.indexOf(v) !== i);

check('HP у всех пород разные', dupHp.length === 0,
  dupHp.length ? `совпадают: ${dupHp.join(', ')}` : statsTable.map((s) => `${s.id}=${s.hp}`).join(' '));
check('урон у всех пород разный', dupDmg.length === 0,
  dupDmg.length ? `совпадают: ${dupDmg.join(', ')}` : statsTable.map((s) => `${s.id}=${s.dmg}`).join(' '));
check('скорость у всех пород разная', dupSpd.length === 0,
  dupSpd.length ? `совпадают: ${dupSpd.join(', ')}` : statsTable.map((s) => `${s.id}=${s.speed}`).join(' '));
check('у каждой породы своя атака',
  new Set(statsTable.map((s) => s.attack)).size >= 8,
  [...new Set(statsTable.map((s) => s.attack))].join(', '));

/* ================= 3. стены и границы пещеры ================= */
const walls = await page.evaluate(() => {
  const d = window.__dbg;
  const boxes = (d.dungeonLoc.colliders.boxes || []);
  const inside = [];
  const outside = [];
  const nan = [];
  for (const s of d.monsters.list) {
    if (![s.x, s.y, s.z].every(Number.isFinite)) nan.push(s.spec.id);
    const r = s.spec.radius;
    for (const b of boxes) {
      const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
      const dx = s.x - b.cx, dz = s.z - b.cz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      if (Math.hypot(lx - qx, lz - qz) < r) {
        inside.push({ id: s.spec.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: s.y, st: s.state, ghost: !!s.spec.ghost });
        break;
      }
    }
    if (s.x < -15.01 || s.x > 15.01 || s.z < -34.51 || s.z > 36.51) {
      outside.push({ id: s.spec.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1) });
    }
  }
  return { inside, outside, nan, ghostsInside: inside.filter((i) => i.ghost).length };
});

check('нет NaN в координатах монстров', walls.nan.length === 0, walls.nan.join(', ') || 'нет');
check('монстры (кроме призраков) не стоят в стенах',
  walls.inside.filter((i) => !i.ghost).length === 0,
  JSON.stringify(walls.inside.filter((i) => !i.ghost).slice(0, 6)));
check('монстры не выходят за пределы пещеры', walls.outside.length === 0,
  JSON.stringify(walls.outside.slice(0, 6)) || 'нет');
results.push(`· призраков в стенах (им можно): ${walls.ghostsInside}`);

/* ================= 4. размеры: призрак vs гоблин ================= */
const sizes = await page.evaluate(() => {
  const d = window.__dbg;
  const sizeOf = (id) => {
    const m = d.monsters.list.find((s) => s.spec.id === id);
    if (!m) return null;
    const box = new d.THREE.Box3().setFromObject(m.group);
    const size = new d.THREE.Vector3();
    box.getSize(size);
    return { h: +size.y.toFixed(2), w: +size.x.toFixed(2), d: +size.z.toFixed(2) };
  };
  const out = {};
  for (const id of ['ghost', 'goblin_sword', 'orc_boss', 'golem_small', 'goblin_guard']) out[id] = sizeOf(id);
  return out;
});
check('призрак выше гоблина', sizes.ghost && sizes.goblin_sword && sizes.ghost.h > sizes.goblin_sword.h,
  `призрак ${sizes.ghost?.h} м, гоблин ${sizes.goblin_sword?.h} м`);
check('призрак шире гоблина', sizes.ghost && sizes.goblin_sword && sizes.ghost.w > sizes.goblin_sword.w,
  `призрак ${sizes.ghost?.w} м, гоблин ${sizes.goblin_sword?.w} м`);
check('босс крупнее обычного гоблина', sizes.orc_boss && sizes.goblin_sword && sizes.orc_boss.h > sizes.goblin_sword.h,
  `босс ${sizes.orc_boss?.h} м, гоблин ${sizes.goblin_sword?.h} м`);

/* ================= 5. щит элитного гоблина ================= */
const shield = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const guard = m.list.find((s) => s.spec.id === 'goblin_guard' && s.hp > 0);
  const plain = m.list.find((s) => s.spec.id === 'goblin_sword' && s.hp > 0);
  if (!guard || !plain) return { err: 'нет стража или гоблина' };
  // остальных — в дальний угол, чтобы удар попал точно в цель
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y }));
  for (const o of m.list) {
    if (o === guard || o === plain) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep';
    o.group.position.set(o.x, o.y, o.z);
  }
  const strike = (t, dmg) => {
    const org = new d.THREE.Vector3(t.x, t.y + 1.0, t.z + 2);
    const dir = new d.THREE.Vector3(0, 0, -1);
    const hp0 = t.hp;
    m.hit(org, dir, 3, 0.8, dmg);
    return hp0 - t.hp;
  };
  const dg = strike(guard, 100);
  const dp = strike(plain, 100);
  // щит должен быть и на картинке
  let shieldMesh = 0;
  guard.group.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 0.44) < 0.02 && Math.abs(p.height - 0.62) < 0.02) shieldMesh++;
    }
  });
  for (const s of saved) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.group.position.set(s.x, s.y, s.z); }
  return { dg, dp, guardSpec: guard.spec.guard, shieldMesh };
});
check('щит стража гасит урон', shield.dg < shield.dp,
  `страж (щит ${shield.guardSpec}) получил ${shield.dg} из 100, обычный гоблин ${shield.dp} из 100`);
check('щит стража виден на модели', (shield.shieldMesh || 0) > 0,
  `щитов-панелей: ${shield.shieldMesh}`);

/* ================= 6. гоблин-лучник стреляет ================= */
const archer = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const a = m.list.find((s) => s.spec.id === 'goblin_bow' && s.hp > 0);
  if (!a) return { err: 'нет лукника' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === a) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  d.player.pos.set(a.x, 0, a.z + 6);
  d.player.groundY = a.y; d.player.y = 0;
  d.stats.hp = 100;
  a.state = 'stalk'; a.cd = 0;
  let shots = 0, sawAttack = false;
  for (let i = 0; i < 240; i++) {
    d.player.pos.set(a.x, 0, a.z + 6);
    d.stats.hp = 100;
    a.cd = 0; a.state = 'stalk';
    m.update(1 / 30, i / 30);
    if (a.attackName === 'ranged') sawAttack = true;
    shots = m.__projCount();
    if (shots > 0) break;
  }
  for (const s of saved) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.state = s.st; s.o.group.position.set(s.x, s.y, s.z); }
  return { shots, sawAttack };
});
check('гоблин-лучник стреляет', archer.shots > 0, `снарядов в полёте: ${archer.shots ?? 0}`);

/* ================= 7. гриб замедляет игрока ================= */
const shroom = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'shroom' && o.hp > 0);
  if (!s) return { err: 'нет гриба' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === s) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  d.player.slow = 0;
  d.player.pos.set(s.x, 0, s.z + 5);
  d.player.groundY = s.y; d.player.y = 0;
  let sawSpore = false;
  for (let i = 0; i < 300 && d.player.slow <= 0; i++) {
    d.player.pos.set(s.x, 0, s.z + 5);
    d.player.groundY = s.y;
    d.stats.hp = 100;
    s.cd = 0; s.state = 'stalk';
    m.update(1 / 30, 20 + i / 30);
    if (s.attackName === 'spore') sawSpore = true;
  }
  const slow = d.player.slow;
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return { slow, sawSpore };
});
check('споры гриба замедляют игрока', shroom.slow > 0, `player.slow = ${shroom.slow}`);

/* ================= 8. слизень оставляет ядовитую лужу ================= */
const slime = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id.startsWith('slime') && o.hp > 0);
  if (!s) return { err: 'нет слизня' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === s) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const root = d.sceneDungeon.children.find((c) => c.name === 'monsters');
  const kidsBefore = root ? root.children.length : -1;
  d.player.pos.set(s.x, 0, s.z + 1);
  d.player.groundY = s.y; d.player.y = 0;
  s.state = 'attack'; s.stateT = 0.3; s.attackName = 'splash';
  for (let i = 0; i < 40; i++) m.update(1 / 30, 40 + i / 30);
  const puddles = m.__puddleCount();
  const kidsAfter = root ? root.children.length : -1;
  // лужа должна быть видна: ищем в сцене круг с плоскостью, появившийся в этот момент
  let visiblePuddle = false;
  if (root) {
    for (const c of root.children) {
      if (c.isMesh && c.geometry && c.geometry.type === 'CircleGeometry') visiblePuddle = true;
    }
  }
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return { puddles, kidsBefore, kidsAfter, visiblePuddle };
});
check('слизень оставляет ядовитую лужу', slime.puddles > 0, `луж: ${slime.puddles}`);
check('ядовитая лужа видна на полу (есть меш)',
  slime.visiblePuddle === true,
  `объектов в группе монстров: ${slime.kidsBefore} → ${slime.kidsAfter}, круглых мешей: ${slime.visiblePuddle}`);

/* ================= 9. змея кусается ================= */
const snake = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'snake' && o.hp > 0);
  if (!s) return { err: 'нет змеи' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === s) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  // гасим неуязвимость игрока (она живёт в замыкании — просто ждём)
  for (let i = 0; i < 60; i++) m.update(1 / 30, 60 + i / 30);
  d.player.pos.set(s.x, 0, s.z + 1.0);
  d.player.groundY = s.y; d.player.y = 0;
  d.stats.hp = 100;
  const hp0 = d.stats.hp;
  s.state = 'attack'; s.stateT = 0.3; s.attackName = 'bite';
  for (let i = 0; i < 40; i++) {
    d.player.pos.set(s.x, 0, s.z + 1.0);
    m.update(1 / 30, 80 + i / 30);
    if (d.stats.hp < hp0) break;
  }
  const hp1 = d.stats.hp;
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return { hp0, hp1, dmg: s.dmg };
});
check('змея кусается (игрок теряет здоровье)', snake.hp1 < snake.hp0,
  `HP ${snake.hp0} → ${snake.hp1}, урон змеи ${snake.dmg}`);

/* ================= 10. паук прыгает ================= */
const spider = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'spider' && o.hp > 0);
  if (!s) return { err: 'нет паука' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === s) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const px = s.x, pz = s.z + 4;
  d.player.pos.set(px, 0, pz);
  d.player.groundY = s.y; d.player.y = 0;
  const d0 = Math.hypot(d.player.pos.x - s.x, d.player.pos.z - s.z);
  let sawLeap = false, minD = d0;
  for (let i = 0; i < 120; i++) {
    d.player.pos.set(px, 0, pz);
    d.stats.hp = 100;
    s.cd = 0; s.state = 'stalk';
    m.update(1 / 30, 120 + i / 30);
    if (s.attackName === 'leap') sawLeap = true;
    minD = Math.min(minD, Math.hypot(d.player.pos.x - s.x, d.player.pos.z - s.z));
  }
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return { d0, minD, sawLeap };
});
check('паук прыгает к игроку', spider.sawLeap && spider.minD < spider.d0 - 1.0,
  `дистанция ${spider.d0?.toFixed(2)} → ${spider.minD?.toFixed(2)} м, атака «leap» видна: ${spider.sawLeap}`);

/* ================= 11. голем бьёт с земли (ударная волна) ================= */
const golem = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((o) => o.spec.id === 'golem_small' && o.hp > 0);
  if (!g) return { err: 'нет голема' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === g) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const root = d.sceneDungeon.children.find((c) => c.name === 'monsters');
  const kidsBefore = root ? root.children.length : -1;
  for (let i = 0; i < 60; i++) m.update(1 / 30, 240 + i / 30);
  d.player.pos.set(g.x, 0, g.z + 2.4);
  d.player.groundY = g.y; d.player.y = 0;
  d.stats.hp = 100;
  const hp0 = d.stats.hp;
  g.cd = 0; g.state = 'stalk';
  let sawSlam = false, shockSeen = false;
  for (let i = 0; i < 180; i++) {
    d.player.pos.set(g.x, 0, g.z + 2.4);
    d.player.groundY = g.y;
    d.stats.hp = 100;
    g.cd = 0; g.state = 'stalk';
    m.update(1 / 30, 260 + i / 30);
    if (g.attackName === 'slam') sawSlam = true;
    if (g.shocks && g.shocks.length) { shockSeen = true; break; }
  }
  const kidsAfter = root ? root.children.length : -1;
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return { sawSlam, shockSeen, kidsBefore, kidsAfter, hp0, dmg: g.dmg };
});
check('голем применяет «удар оземь»', golem.sawSlam, `атака slam видна: ${golem.sawSlam}`);
check('ударная волна голема появляется (кольцо на полу)', golem.shockSeen,
  `групп в сцене монстров: ${golem.kidsBefore} → ${golem.kidsAfter}`);

/* ================= 12. призрак проходит сквозь стены ================= */
const ghost = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((o) => o.spec.id === 'ghost');
  const boxes = d.dungeonLoc.colliders.boxes || [];
  // ищем длинную стену между залом A (z<-20) и кристальным залом B (z>-20)
  let wall = null;
  for (const b of boxes) {
    if (Math.abs(b.cz + 20) < 0.6 && b.hx > 1.2 && (!wall || b.hx > wall.hx)) wall = b;
  }
  if (!wall || !g) return { err: 'нет стены или призрака' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === g) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const wx = wall.cx, wz = wall.cz;
  // игрок — по ту сторону стены (зал A), призрак — в зале B
  const px = wx, pz = wz - 1.6;
  d.player.pos.set(px, 0, pz);
  d.player.groundY = 0; d.player.y = 0;
  g.x = wx; g.z = wz + 1.6; g.y = 0;
  g.group.position.set(g.x, g.y, g.z);
  g.state = 'stalk'; g.cd = 9;         // cd большой — чтобы не бил, только шёл
  let crossed = null;
  const trail = [];
  for (let i = 0; i < 240; i++) {
    d.player.pos.set(px, 0, pz);
    d.stats.hp = 100;
    g.state = 'stalk'; g.cd = 9;
    m.update(1 / 30, 400 + i / 30);
    trail.push({ x: +g.x.toFixed(2), z: +g.z.toFixed(2) });
    if (!crossed && g.z < wz - 0.6) {
      crossed = { x: +g.x.toFixed(2), z: +g.z.toFixed(2), step: i };
    }
  }
  const finalD = Math.hypot(g.x - px, g.z - pz);
  // проверка «второго» правила: призрак действительно умеет залезать в стены
  const g2 = m.list.filter((o) => o.spec.id === 'ghost')[1] || g;
  g2.x = wx; g2.z = wz; g2.y = 0; g2.group.position.set(g2.x, g2.y, g2.z);
  g2.state = 'sleep';
  let inWall = false;
  for (let i = 0; i < 60; i++) {
    m.update(1 / 30, 500 + i / 30);
    const c = Math.cos(wall.ang || 0), sn = Math.sin(wall.ang || 0);
    const dx = g2.x - wall.cx, dz = g2.z - wall.cz;
    const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
    if (Math.abs(lx) < wall.hx && Math.abs(lz) < wall.hz) { inWall = true; break; }
  }
  for (const st of saved) { st.o.x = st.x; st.o.z = st.z; st.o.y = st.y; st.o.state = st.st; st.o.group.position.set(st.x, st.y, st.z); }
  return {
    wall: { cx: wall.cx, cz: wall.cz, hx: wall.hx, hz: wall.hz },
    crossed, finalD, inWall,
    ghostStart: trail[0], ghostEnd: trail[trail.length - 1],
  };
});
check('призрак умеет залезать в стену (стена для него не преграда)', ghost.inWall === true,
  `стена x=${ghost.wall?.cx} z=${ghost.wall?.cz}, призрак внутри: ${ghost.inWall}`);
check('призрак проходит сквозь стену к игроку', ghost.crossed !== null,
  ghost.crossed
    ? `пересёк стену на шаге ${ghost.crossed.step} в точке (${ghost.crossed.x}, ${ghost.crossed.z})`
    : `за 8 секунд призрак не прошёл сквозь стену: финальная дистанция до игрока ${ghost.finalD?.toFixed(2)} м, старт ${JSON.stringify(ghost.ghostStart)} → конец ${JSON.stringify(ghost.ghostEnd)}`);

/* ================= вывод ================= */
console.log(results.join('\n'));
console.log(`\ntester_r61_beasts: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await browser.close();
if (fail) process.exit(1);
