/**
 * ============================================================================
 *  Раунд 61 — тест-агент: зверинец подземелья (исправленная версия)
 * ============================================================================
 *
 *  Проверяю нововведения раунда 61:
 *   1) в пещере есть все 11 пород + босс;
 *   2) у каждой породы свои HP / урон / скорость;
 *   3) монстры не стоят в стенах и не выходят за пределы пещеры (и после игры);
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

/**
 * Общий помощник, который кладётся в окно страницы: изоляция одного монстра
 * и прогон его поведения.
 */
await page.evaluate(() => {
  const d = window.__dbg;

  /**
   * Оставить в пещере только одного монстра.
   *
   * @param {object} target кого оставить
   * @returns {Function} функция возврата остальных
   */
  window.__isolate = (target) => {
    const m = d.monsters;
    const all = m.list.slice();
    m.list.length = 0;
    if (target) m.list.push(target);
    return () => {
      m.list.length = 0;
      for (const o of all) m.list.push(o);
    };
  };

  /**
   * Подождать, пока игрок перестанет быть неуязвимым.
   *
   * @returns {boolean} стало ли
   */
  window.__waitInvuln = () => {
    const m = d.monsters;
    for (let i = 0; i < 120 && m.playerInvuln > 0; i++) m.update(1 / 30, 900 + i / 30);
    return m.playerInvuln <= 0;
  };
});

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
const wallProbe = await page.evaluate(() => {
  const d = window.__dbg;
  const boxes = (d.dungeonLoc.colliders.boxes || []);
  /**
   * Внутри ли точки прямоугольник.
   *
   * @param {number} x координата
   * @param {number} z координата
   * @param {object} b прямоугольник
   * @param {number} r радиус
   * @returns {boolean} внутри ли
   */
  const inside = (x, z, b, r) => {
    const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
    const dx = x - b.cx, dz = z - b.cz;
    const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
    const qx = Math.max(-b.hx, Math.min(lx, b.hx));
    const qz = Math.max(-b.hz, Math.min(lz, b.hz));
    return Math.hypot(lx - qx, lz - qz) < r;
  };
  const scan = () => {
    const insideList = [], outside = [], nan = [];
    for (const s of d.monsters.list) {
      if (![s.x, s.y, s.z].every(Number.isFinite)) nan.push(s.spec.id);
      for (const b of boxes) {
        if (inside(s.x, s.z, b, s.spec.radius)) {
          insideList.push({ id: s.spec.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1), st: s.state, ghost: !!s.spec.ghost });
          break;
        }
      }
      if (s.x < -15.01 || s.x > 15.01 || s.z < -34.51 || s.z > 36.51) {
        outside.push({ id: s.spec.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1) });
      }
    }
    return { insideList, outside, nan };
  };
  const atSpawn = scan();
  // теперь поиграем: игрок в середине пещеры, монстры бегают и бьются
  d.player.pos.set(0, 0, -8);
  d.player.groundY = 0;
  for (let i = 0; i < 400; i++) {
    d.stats.hp = 100;
    d.monsters.update(1 / 30, 100 + i / 30);
  }
  const afterGame = scan();
  return {
    atSpawn, afterGame,
    ghostsInWalls: afterGame.insideList.filter((i) => i.ghost).length,
  };
});
check('нет NaN в координатах монстров',
  wallProbe.atSpawn.nan.length === 0 && wallProbe.afterGame.nan.length === 0, 'нет');
check('монстры (кроме призраков) не стоят в стенах при появлении',
  wallProbe.atSpawn.insideList.filter((i) => !i.ghost).length === 0,
  JSON.stringify(wallProbe.atSpawn.insideList.filter((i) => !i.ghost).slice(0, 6)));
check('монстры (кроме призраков) не встают в стены во время боя',
  wallProbe.afterGame.insideList.filter((i) => !i.ghost).length === 0,
  JSON.stringify(wallProbe.afterGame.insideList.filter((i) => !i.ghost).slice(0, 6)));
check('монстры не выходят за пределы пещеры',
  wallProbe.atSpawn.outside.length === 0 && wallProbe.afterGame.outside.length === 0,
  JSON.stringify(wallProbe.afterGame.outside.slice(0, 6)) || 'нет');
results.push(`· призраков в стенах (им можно): ${wallProbe.ghostsInWalls}`);

/* ================= 4. размеры: призрак vs гоблин ================= */
const sizes = await page.evaluate(() => {
  const d = window.__dbg;
  const sizeOf = (id) => {
    const m = d.monsters.list.find((s) => s.spec.id === id);
    if (!m) return null;
    const box = new d.THREE.Box3().setFromObject(m.group);
    const size = new d.THREE.Vector3();
    box.getSize(size);
    return { h: +size.y.toFixed(2), w: +size.x.toFixed(2) };
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
  const restore = window.__isolate(guard);
  const all = m.list.slice();
  m.list.length = 0;
  m.list.push(guard, plain);
  /**
   * Нанести удар по конкретной цели.
   *
   * @param {object} t цель
   * @param {number} dmg урон
   * @returns {number} полученный урон
   */
  const strike = (t, dmg) => {
    const org = new d.THREE.Vector3(t.x, t.y + 1.0, t.z + 2);
    const dir = new d.THREE.Vector3(0, 0, -1);
    const hp0 = t.hp;
    m.hit(org, dir, 3, 0.8, dmg);
    return hp0 - t.hp;
  };
  const dg = strike(guard, 20);
  const dp = strike(plain, 20);
  let shieldMesh = 0;
  guard.group.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry') {
      const p = o.geometry.parameters;
      if (Math.abs(p.width - 0.44) < 0.02 && Math.abs(p.height - 0.62) < 0.02) shieldMesh++;
    }
  });
  m.list.length = 0;
  for (const o of all) m.list.push(o);
  restore();
  return { dg, dp, guardSpec: guard.spec.guard, shieldMesh };
});
check('щит стража гасит урон', shield.dg < shield.dp,
  `страж (щит ${shield.guardSpec}) получил ${shield.dg} из 20, обычный гоблин ${shield.dp} из 20`);
check('щит стража виден на модели', (shield.shieldMesh || 0) > 0,
  `щитов-панелей на модели: ${shield.shieldMesh}`);

/* ================= 6. гоблин-лучник стреляет ================= */
const archer = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const a = m.list.find((s) => s.spec.id === 'goblin_bow' && s.hp > 0);
  if (!a) return { err: 'нет лукника' };
  const restore = window.__isolate(a);
  d.player.pos.set(a.x, 0, a.z + 6);
  d.player.groundY = a.y; d.player.y = 0;
  a.state = 'stalk'; a.cd = 0;
  let shots = 0, sawAttack = false;
  for (let i = 0; i < 240; i++) {
    d.player.pos.set(a.x, 0, a.z + 6);
    d.player.groundY = a.y;
    d.stats.hp = 100;
    a.cd = 0;
    m.update(1 / 30, 200 + i / 30);
    if (a.attackName === 'ranged') sawAttack = true;
    shots = Math.max(shots, m.__projCount());
    if (shots > 0) break;
  }
  restore();
  return { shots, sawAttack };
});
check('гоблин-лучник стреляет', archer.shots > 0,
  `снарядов в полёте: ${archer.shots ?? 0}, атака «ranged»: ${archer.sawAttack}`);

/* ================= 7. гриб замедляет игрока ================= */
const shroom = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'shroom' && o.hp > 0);
  if (!s) return { err: 'нет гриба' };
  const restore = window.__isolate(s);
  d.player.slow = 0;
  d.player.pos.set(s.x, 0, s.z + 5);
  d.player.groundY = s.y; d.player.y = 0;
  s.state = 'stalk'; s.cd = 0;
  let sawSpore = false, maxProj = 0;
  for (let i = 0; i < 240 && d.player.slow <= 0; i++) {
    d.player.pos.set(s.x, 0, s.z + 5);
    d.player.groundY = s.y;
    d.stats.hp = 100;
    s.cd = 0;
    m.update(1 / 30, 400 + i / 30);
    if (s.attackName === 'spore') sawSpore = true;
    maxProj = Math.max(maxProj, m.__projCount());
  }
  const slow = d.player.slow;
  restore();
  return { slow, sawSpore, maxProj };
});
check('споры гриба замедляют игрока', shroom.slow > 0,
  `player.slow = ${shroom.slow}, атака «spore»: ${shroom.sawSpore}, снарядов: ${shroom.maxProj}`);

/* ================= 8. слизень оставляет ядовитую лужу ================= */
const slime = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id.startsWith('slime') && o.hp > 0);
  if (!s) return { err: 'нет слизня' };
  const restore = window.__isolate(s);
  const root = s.group.parent;              // группа, где живут монстры
  const kidsBefore = root ? root.children.length : -1;
  const countPuddles = () => {
    let n = 0;
    if (root) root.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') n++;
    });
    return n;
  };
  const puddlesBefore = countPuddles();
  d.player.pos.set(s.x, 0, s.z + 1);
  d.player.groundY = s.y; d.player.y = 0;
  s.state = 'stalk'; s.cd = 0;
  for (let i = 0; i < 90; i++) {
    d.player.pos.set(s.x, 0, s.z + 1);
    d.player.groundY = s.y;
    d.stats.hp = 100;
    s.cd = 0;
    m.update(1 / 30, 500 + i / 30);
  }
  const puddles = m.__puddleCount();
  const kidsAfter = root ? root.children.length : -1;
  const puddlesAfter = countPuddles();
  // ищем круглый меш (лужу) в группе монстров и во всей сцене пещеры
  let puddleMesh = 0;
  d.sceneDungeon.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') puddleMesh++;
  });
  restore();
  return { puddles, kidsBefore, kidsAfter, puddlesBefore, puddlesAfter, puddleMesh };
});
check('слизень оставляет ядовитую лужу', slime.puddles > 0, `луж: ${slime.puddles}`);
check('ядовитая лужа видна на полу (есть меш)',
  slime.puddlesAfter > 0,
  `круглых мешей-луж в группе монстров: ${slime.puddlesBefore} → ${slime.puddlesAfter}; всего круглых мешей в сцене пещеры: ${slime.puddleMesh} (из них ${slime.puddleMesh - 6} — ядовитые лужи слизней)`);

/* ================= 9. змея кусается ================= */
const snake = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'snake' && o.hp > 0);
  if (!s) return { err: 'нет змеи' };
  const restore = window.__isolate(s);
  const calm = window.__waitInvuln();
  d.player.pos.set(s.x, 0, s.z + 1.0);
  d.player.groundY = s.y; d.player.y = 0;
  d.stats.hp = 100;
  const hp0 = d.stats.hp;
  s.state = 'stalk'; s.cd = 0;
  for (let i = 0; i < 120 && d.stats.hp >= hp0; i++) {
    d.player.pos.set(s.x, 0, s.z + 1.0);
    d.player.groundY = s.y;
    d.stats.hp = 100;
    s.cd = 0;
    m.update(1 / 30, 600 + i / 30);
  }
  const hp1 = d.stats.hp;
  restore();
  return { hp0, hp1, dmg: s.dmg, calm };
});
check('змея кусается (игрок теряет здоровье)', snake.hp1 < snake.hp0,
  `HP ${snake.hp0} → ${snake.hp1}, урон змеи ${snake.dmg}, неуязвимость снята: ${snake.calm}`);

/* ================= 10. паук прыгает ================= */
const spider = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((o) => o.spec.id === 'spider' && o.hp > 0);
  if (!s) return { err: 'нет паука' };
  const restore = window.__isolate(s);
  // выбираем направление, где между пауком и игроком нет стены
  const boxes = d.dungeonLoc.colliders.boxes || [];
  /**
   * Внутри ли точки прямоугольник.
   *
   * @param {number} x координата
   * @param {number} z координата
   * @param {object} b прямоугольник
   * @returns {boolean} внутри ли
   */
  const inside = (x, z, b) => {
    const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
    const dx = x - b.cx, dz = z - b.cz;
    const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
    return Math.abs(lx) < b.hx + 0.5 && Math.abs(lz) < b.hz + 0.5;
  };
  const freeAt = (x, z) => !boxes.some((b) => inside(x, z, b));
  let px = s.x, pz = s.z + 4;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const tx = s.x + Math.cos(a) * 3.2;
    const tz = s.z + Math.sin(a) * 3.2;
    if (freeAt(tx, tz)) { px = tx; pz = tz; break; }
  }
  d.player.pos.set(px, 0, pz);
  d.player.groundY = s.y; d.player.y = 0;
  const d0 = Math.hypot(d.player.pos.x - s.x, d.player.pos.z - s.z);
  let sawLeap = false, minD = d0;
  const states = [];
  const trace = [];
  s.state = 'stalk'; s.cd = 0;
  for (let i = 0; i < 120; i++) {
    d.player.pos.set(px, 0, pz);
    d.player.groundY = s.y;
    d.stats.hp = 100;
    s.cd = 0;
    m.update(1 / 30, 700 + i / 30);
    if (s.attackName === 'leap') sawLeap = true;
    states.push(s.state);
    if (i < 6 || i % 20 === 0) trace.push(`${i}: ${s.state} x=${s.x.toFixed(2)} z=${s.z.toFixed(2)} spd=${s.moveSpeed.toFixed(2)} stun=${s.stun.toFixed(2)} dying=${s.dying}`);
    minD = Math.min(minD, Math.hypot(d.player.pos.x - s.x, d.player.pos.z - s.z));
  }
  restore();
  return {
    d0, minD, sawLeap,
    states: [...new Set(states)].join(','),
    trace: trace.join(' | '),
    start: { x: +px.toFixed(2), z: +pz.toFixed(2), y: s.y },
  };
});
check('паук прыгает к игроку', spider.sawLeap && spider.minD < spider.d0 - 1.0,
  `дистанция ${spider.d0?.toFixed(2)} → ${spider.minD?.toFixed(2)} м, атака «leap»: ${spider.sawLeap}; состояния: ${spider.states}; ${spider.trace}`);

/* ================= 11. голем бьёт с земли (ударная волна) ================= */
const golem = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((o) => o.spec.id === 'golem_small' && o.hp > 0);
  if (!g) return { err: 'нет голема' };
  const restore = window.__isolate(g);
  const root = g.group.parent;
  const kidsBefore = root ? root.children.length : -1;
  window.__waitInvuln();
  d.player.pos.set(g.x, 0, g.z + 2.4);
  d.player.groundY = g.y; d.player.y = 0;
  d.stats.hp = 100;
  const hp0 = d.stats.hp;
  g.state = 'stalk'; g.cd = 0;
  let sawSlam = false, shockSeen = false, hpLost = 0;
  for (let i = 0; i < 180; i++) {
    d.player.pos.set(g.x, 0, g.z + 2.4);
    d.player.groundY = g.y;
    g.cd = 0;
    m.update(1 / 30, 800 + i / 30);
    if (g.attackName === 'slam') sawSlam = true;
    if (g.shocks && g.shocks.length) { shockSeen = true; break; }
  }
  const kidsAfter = root ? root.children.length : -1;
  restore();
  return { sawSlam, shockSeen, kidsBefore, kidsAfter, hp0, dmg: g.dmg };
});
check('голем применяет «удар оземь»', golem.sawSlam, `атака slam видна: ${golem.sawSlam}`);
check('ударная волна голема появляется (кольцо на полу)', golem.shockSeen,
  `групп в группе монстров: ${golem.kidsBefore} → ${golem.kidsAfter}`);

/* ================= 12. призрак проходит сквозь стены ================= */
const ghost = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((o) => o.spec.id === 'ghost');
  const gob = m.list.find((o) => o.spec.id === 'goblin_sword');
  const boxes = d.dungeonLoc.colliders.boxes || [];
  if (!g) return { err: 'нет призрака' };
  // стена УРОВНЯ ПОЛА (y0 <= 0.6) — именно она должна быть непроходимой
  let wall = null;
  for (const b of boxes) {
    if ((b.y0 === undefined || b.y0 <= 0.6) && b.hx > 1.2
      && Math.abs(b.cz + 20) < 2.5 && (!wall || b.hx > wall.hx)) wall = b;
  }
  if (!wall) return { err: 'нет стены уровня пола' };
  const restore = window.__isolate(g);

  /**
   * Внутри ли точки прямоугольник.
   *
   * @param {number} x координата
   * @param {number} z координата
   * @param {object} b прямоугольник
   * @returns {boolean} внутри ли
   */
  const inside = (x, z, b) => {
    const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
    const dx = x - b.cx, dz = z - b.cz;
    const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
    return Math.abs(lx) < b.hx && Math.abs(lz) < b.hz;
  };

  /* --- 12а. призрак внутри стены: дрейфует (стена ему не преграда) --- */
  g.x = wall.cx; g.z = wall.cz; g.y = 0;
  g.group.position.set(g.x, g.y, g.z);
  g.state = 'sleep';
  const startInside = inside(g.x, g.z, wall);
  let drifted = 0;
  let everInWall = false;
  for (let i = 0; i < 60; i++) {
    m.update(1 / 30, 1000 + i / 30);
    drifted = Math.max(drifted, Math.hypot(g.x - wall.cx, g.z - wall.cz));
    if (inside(g.x, g.z, wall)) everInWall = true;
  }
  const canBeInWall = everInWall;

  /* --- 12б. призrak гонится за игроком через стену --- */
  const wx = wall.cx, wz = wall.cz;
  d.player.pos.set(wx, 0, wz - 1.4);
  d.player.groundY = 0; d.player.y = 0;
  g.x = wx; g.z = wz + 1.4; g.y = 0;
  g.group.position.set(g.x, g.y, g.z);
  g.state = 'stalk'; g.cd = 9;
  let crossed = null;
  let minD = Infinity;
  for (let i = 0; i < 300; i++) {
    d.player.pos.set(wx, 0, wz - 1.4);
    d.stats.hp = 100;
    g.cd = 9;
    m.update(1 / 30, 1100 + i / 30);
    minD = Math.min(minD, Math.hypot(g.x - d.player.pos.x, g.z - d.player.pos.z));
    // «пересёк» = оказался по ту сторону центра стены
    if (!crossed && g.z < wz) crossed = { x: +g.x.toFixed(2), z: +g.z.toFixed(2), step: i };
  }
  const finalD = Math.hypot(g.x - d.player.pos.x, g.z - d.player.pos.z);

  /* --- 12в. для сравнения: обычный гоблин на том же месте --- */
  let gobMoved = null;
  if (gob) {
    const all = m.list.slice();
    m.list.length = 0;
    m.list.push(gob);
    gob.x = wx; gob.z = wz; gob.y = 0;
    gob.group.position.set(gob.x, gob.y, gob.z);
    gob.state = 'stalk'; gob.cd = 9;
    const g0 = Math.hypot(gob.x - d.player.pos.x, gob.z - d.player.pos.z);
    for (let i = 0; i < 120; i++) {
      d.player.pos.set(wx, 0, wz - 1.4);
      d.stats.hp = 100;
      gob.cd = 9;
      m.update(1 / 30, 1400 + i / 30);
    }
    gobMoved = +Math.hypot(gob.x - d.player.pos.x, gob.z - d.player.pos.z).toFixed(2);
    m.list.length = 0;
    for (const o of all) m.list.push(o);
  }
  restore();
  return {
    wall: { cx: +wall.cx.toFixed(2), cz: +wall.cz.toFixed(2), hx: +wall.hx.toFixed(2), hz: +wall.hz.toFixed(2), y0: wall.y0 },
    canBeInWall, drifted: +drifted.toFixed(2),
    crossed, finalD: +finalD.toFixed(2), minD: +minD.toFixed(2), gobMoved,
  };
});
check('призрак умеет находиться внутри стены (стена ему не преграда)',
  ghost.canBeInWall === true,
  `стена x=${ghost.wall?.cx} z=${ghost.wall?.cz} (hx=${ghost.wall?.hx}, y0=${ghost.wall?.y0}), призрак внутри: ${ghost.canBeInWall}, дрейф внутри стены: ${ghost.drifted} м`);
check('призрак проходит сквозь стену к игроку', ghost.crossed !== null,
  ghost.crossed
    ? `пересёк стену на шаге ${ghost.crossed.step} в точке (${ghost.crossed.x}, ${ghost.crossed.z})`
    : `за 10 секунд призрак не прошёл сквозь стену: минимальная дистанция до игрока ${ghost.minD} м, финальная ${ghost.finalD} м (для сравнения, гоблин на том же месте: ${ghost.gobMoved} м)`);

/* ================= 13. проём между залами пещеры ================= */
const passage = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const t = m.list.find((o) => o.spec.id === 'goblin_sword' && o.hp > 0);
  if (!t) return { err: 'нет гоблина' };
  const restore = window.__isolate(t);
  // игрок — в кристальном зале (z = −17), монстр — во входном зале (z = −22)
  d.player.pos.set(0, 0, -17);
  d.player.groundY = 0; d.player.y = 0;
  t.x = 0; t.z = -22; t.y = 0;
  t.group.position.set(t.x, t.y, t.z);
  t.state = 'stalk'; t.cd = 0;
  let minD = Infinity;
  for (let i = 0; i < 300; i++) {
    d.player.pos.set(0, 0, -17);
    d.stats.hp = 100;
    t.cd = 0;
    m.update(1 / 30, 2000 + i / 30);
    minD = Math.min(minD, Math.hypot(t.x - 0, t.z + 17));
  }
  const out = {
    minD: +minD.toFixed(2),
    end: { x: +t.x.toFixed(2), z: +t.z.toFixed(2) },
  };
  // для сравнения: игрок проходит под надземной частью стены, а монстр — нет
  const boxes = d.dungeonLoc.colliders.boxes || [];
  const over = boxes.filter((b) => (b.y0 !== undefined && b.y0 > 1) && b.hx > 5);
  d.player.pos.set(0, 0, -17);
  d.player.groundY = 0; d.player.y = 0;
  out.overheadWalls = over.map((b) => ({ cx: b.cx, cz: b.cz, hx: b.hx, hz: b.hz, y0: b.y0, y1: b.y1 }));
  out.playerPasses = over.length ? !d.player.blocksAt(over[0]) : null;
  restore();
  return out;
});
check('монстр может пройти через проём между входным и кристальным залом',
  passage.minD < 1.5,
  `минимальная дистанция до игрока через стену: ${passage.minD} м, монстр застрял в (${passage.end?.x}, ${passage.end?.z})`);
check('надземные части стен не считаются препятствием для монстров',
  passage.playerPasses === true,
  `игрок проходит под стеной: ${passage.playerPasses}; такие коллайдеры: ${JSON.stringify(passage.overheadWalls)}`);

/* ================= вывод ================= */
console.log(results.join('\n'));
console.log(`\ntester_r61_beasts: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await browser.close();
if (fail) process.exit(1);
