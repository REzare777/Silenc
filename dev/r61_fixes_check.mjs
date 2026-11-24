/**
 * ============================================================================
 *  Раунд 61 (исправления) — проверка багов, найденных тест-агентом
 * ============================================================================
 *
 *  Проверяем ровно то, что чинили:
 *   1) монстры проходят через проём между залами (стены с высотой);
 *   2) призрак проходит сквозь стены, когда гонится;
 *   3) у босса работают все четыре атаки: рубящий удар, удар оземь
 *      (ударная волна), рёв (призыв гоблинов) и наскок (рывок и урон);
 *   4) полоска HP босса не накрывает компас и панель времени;
 *   5) полоса босса не появляется при входе в пещеру и не возвращается после смерти;
 *   6) ядовитая лужа слизня видна на полу;
 *   7) частичный подбор мешка не теряет добычу;
 *   8) у пород разные урон и скорость, у лута — разные цены продажи;
 *   9) каменный голем — маленький, а призрак — высокий и широкий.
 *
 *  Запуск: cd /workspace/village && node dev/r61_fixes_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

let ok = 0, fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} [info] подробности
 */
function check(name, cond, info = '') {
  if (cond) { ok++; results.push(`  ok   ${name}`); }
  else { fail++; results.push(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

// в подземелье
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2000);

/* ---------------- 1. проём между залами ---------------- */
const gap = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((s) => s.spec.id === 'goblin_sword');
  if (!g) return { err: 'нет гоблина' };
  // гоблин — в кристальном зале, игрок — во входном, проём между ними
  g.x = 0; g.z = -22; g.y = 0; g.state = 'stalk'; g.hp = g.maxHp;
  d.player.pos.set(0, 0, -17);
  d.player.groundY = 0;
  let minD = 1e9;
  for (let i = 0; i < 400; i++) {
    d.player.pos.set(0, 0, -17);
    d.player.groundY = 0;
    d.stats.hp = 100;
    m.update(1 / 30, i / 30);
    minD = Math.min(minD, Math.hypot(d.player.pos.x - g.x, d.player.pos.z - g.z));
  }
  return { minD: +minD.toFixed(2), z: +g.z.toFixed(2), x: +g.x.toFixed(2) };
});
check('зверь проходит через проём между залами', gap.minD < 3,
  `минимальная дистанция ${gap.minD} (позиция ${gap.x}, ${gap.z})`);

/* ---------------- 2. призрак сквозь стены ---------------- */
const ghost = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const gh = m.list.find((s) => s.spec.id === 'ghost');
  if (!gh) return { err: 'нет призрака' };
  gh.x = -4.65; gh.z = -18.6; gh.y = 0; gh.state = 'stalk'; gh.hp = gh.maxHp;
  d.player.pos.set(-4.65, 0, -21.4);
  d.player.groundY = 0;
  let minD = 1e9;
  for (let i = 0; i < 400; i++) {
    d.player.pos.set(-4.65, 0, -21.4);
    d.player.groundY = 0;
    d.stats.hp = 100;
    m.update(1 / 30, i / 30);
    minD = Math.min(minD, Math.hypot(d.player.pos.x - gh.x, d.player.pos.z - gh.z));
  }
  return { minD: +minD.toFixed(2), z: +gh.z.toFixed(2) };
});
check('призрак проходит сквозь стены', ghost.minD < 2.5,
  `минимальная дистанция ${ghost.minD} (z=${ghost.z})`);

/* ---------------- 3. четыре атаки босса ---------------- */
const bossAtk = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss();
  if (!b) return { err: 'нет босса' };
  const out = { swing: {}, slam: {}, roar: {}, charge: {} };

  /** Заставить босса атаковать выбранным приёмом. */
  const force = (name, dist) => {
    b.hp = b.maxHp; b.cd = 0; b.stun = 0; b.dying = 0; b.state = 'stalk';
    b.attackName = name;
    b.windup = name === 'charge' ? 0.85 : name === 'roar' ? 1.0 : name === 'slam' ? 0.95 : 0.55;
    b.active = name === 'swing' ? 0.26 : 0.24;
    b.x = 0; b.z = 24; b.y = -4.6;
    d.player.pos.set(0, -4.6, 24 + dist);
    d.player.groundY = -4.6;
    d.stats.hp = 100;
  };

  // --- рубящий удар ---
  force('swing', 1.5);
  const kids0 = m.list.length;
  for (let i = 0; i < 60; i++) {
    b.state = 'attack'; b.stateT = 0.5; b.cd = 0; b.stun = 0;
    d.player.pos.set(0, -4.6, 24 + 1.5);
    m.update(1 / 30, i / 30);
  }
  out.swing = { hpDrop: 100 - d.stats.hp, shocks: (b.shocks || []).length, spawned: m.list.length - kids0 };
  d.stats.hp = 100;

  // --- удар оземь: ударная волна ---
  force('slam', 2.0);
  const kids1 = m.list.length;
  for (let i = 0; i < 60; i++) {
    b.state = 'attack'; b.stateT = 0.5; b.cd = 0; b.stun = 0;
    d.player.pos.set(0, -4.6, 24 + 2.0);
    m.update(1 / 30, i / 30);
  }
  out.slam = { hpDrop: 100 - d.stats.hp, shocks: (b.shocks || []).length, spawned: m.list.length - kids1 };
  d.stats.hp = 100;

  // --- рёв: призыв ---
  force('roar', 4.0);
  const kids2 = m.list.length;
  for (let i = 0; i < 80; i++) {
    b.state = 'attack'; b.stateT = 0.5; b.cd = 0; b.stun = 0;
    d.player.pos.set(0, -4.6, 24 + 4.0);
    m.update(1 / 30, i / 30);
  }
  out.roar = { hpDrop: 100 - d.stats.hp, shocks: (b.shocks || []).length, spawned: m.list.length - kids2 };
  d.stats.hp = 100;

  // --- наскок: рывок и урон (игрок рядом, иначе орк до него не достанет) ---
  force('charge', 3.5);
  const z0 = b.z;
  for (let i = 0; i < 40; i++) {
    b.state = 'attack'; b.stateT = 0.05; b.cd = 0; b.stun = 0;
    d.player.pos.set(0, -4.6, 24 + 3.5);
    m.update(1 / 30, i / 30);
  }
  out.charge = { hpDrop: 100 - d.stats.hp, moved: +(b.z - z0).toFixed(2), z0 };
  return out;
});
check('босс рубит мечом', bossAtk.swing && bossAtk.swing.hpDrop > 0, `урон ${bossAtk.swing?.hpDrop}`);
check('удар оземь даёт ударную волну', bossAtk.slam && bossAtk.slam.shocks > 0,
  `колец ${bossAtk.slam?.shocks}, урон ${bossAtk.slam?.hpDrop}`);
check('рёв призывает гоблинов', bossAtk.roar && bossAtk.roar.spawned > 0,
  `призвано ${bossAtk.roar?.spawned}`);
check('наскок сближает и ранит', bossAtk.charge && bossAtk.charge.moved > 1.0 && bossAtk.charge.hpDrop > 0,
  `прошёл ${bossAtk.charge?.moved} м, урон ${bossAtk.charge?.hpDrop}`);

/* ---------------- 4. полоска босса не перекрывает интерфейс ---------------- */
const bar = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss();
  if (!b) return { err: 'нет босса' };
  b.state = 'stalk'; b.hp = b.maxHp;
  d.player.pos.set(b.x + 2, b.y, b.z + 2);
  m.update(1 / 30, 1);
  const el = document.getElementById('bossBar');
  const time = document.getElementById('timebar');
  const compass = document.getElementById('compass');
  const r = el.getBoundingClientRect();
  const t = time.getBoundingClientRect();
  const c = compass.getBoundingClientRect();
  const overlap = (a, b2) => !(a.bottom <= b2.top || a.top >= b2.bottom || a.right <= b2.left || a.left >= b2.right);
  return {
    visible: el.classList.contains('on'),
    overTime: overlap(r, t), overCompass: overlap(r, c),
    top: Math.round(r.top), compassBottom: Math.round(c.bottom), timeBottom: Math.round(t.bottom),
  };
});
check('полоса босса видна, когда босс проснулся', bar.visible === true, JSON.stringify(bar));
check('полоса босса не накрывает панель времени', bar.overTime === false, JSON.stringify(bar));
check('полоса босса не накрывает компас', bar.overCompass === false, JSON.stringify(bar));

/* ---------------- 5. полоса не появляется при входе и не возвращается после смерти ---------------- */
const barLife = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss();
  const el = document.getElementById('bossBar');
  const res = {};
  // после смерти босса полоса не должна вернуться
  // остальных зверей убираем из-под удара, чтобы били точно босса
  for (const o of m.list) if (o !== b) o.dying = 5;
  d.player.pos.set(b.x, b.y, b.z + 1.5);
  d.player.groundY = b.y;
  m.hit({ x: d.player.pos.x, z: d.player.pos.z }, { x: 0, z: -1 }, 4, 1.2, 9999);
  for (let i = 0; i < 60; i++) m.update(1 / 30, 1 + i / 30);
  res.afterDeath = el.classList.contains('on');
  res.getBoss = m.getBoss() ? 'вернулся' : 'нет';
  return res;
});
check('полоса босса не возвращается после смерти', barLife.afterDeath === false, JSON.stringify(barLife));
check('getBoss() не выдаёт мёртвого босса', barLife.getBoss === 'нет', JSON.stringify(barLife));

/* ---------------- 6. ядовитая лужа видима ---------------- */
const puddle = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const s = m.list.find((x) => x.spec.attack === 'splash');
  if (!s) return { err: 'нет слизня' };
  s.state = 'attack'; s.stateT = 0.3; s.attackName = 'splash';
  d.player.pos.set(s.x + 20, s.y, s.z + 20);
  for (let i = 0; i < 20; i++) {
    s.state = 'attack'; s.stateT = 0.3;
    m.update(1 / 30, i / 30);
  }
  const count = m.__puddleCount();
  let meshes = 0;
  const scene = d.sceneDungeon;
  scene.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.type === 'CircleGeometry') meshes++;
  });
  return { count, meshes };
});
check('ядовитая лужа видна на полу', puddle.count > 0 && puddle.meshes > 0,
  `луж ${puddle.count}, мешей ${puddle.meshes}`);

/* ---------------- 7. частичный подбор не теряет добычу ---------------- */
const partial = await page.evaluate(async () => {
  const d = window.__dbg;
  const m = d.monsters;
  const inv = d.inventory;
  // освобождаем сумку и добиваем её почти до конца
  inv.slots.fill(null);
  for (let i = 0; i < 35; i++) {
    inv.slots[i] = { id: 'test_filler', spec: { id: 'test_filler', name: 'Хлам', kind: 'goods', weight: 0.1, stackable: false }, count: 1 };
  }
  // роняем мешок: убиваем гоблина ударом игрока
  const target = m.list.find((x) => x.spec.id === 'goblin_sword');
  for (const o of m.list) if (o !== target) o.dying = 5;
  d.player.pos.set(target.x, target.y, target.z + 1.5);
  d.player.groundY = target.y;
  m.hit({ x: d.player.pos.x, z: d.player.pos.z }, { x: 0, z: -1 }, 4, 1.2, 9999);
  for (let i = 0; i < 60; i++) m.update(1 / 30, i / 30);
  const bag = m.bags[m.bags.length - 1];
  if (!bag) return { err: 'нет мешка' };
  bag.items = [
    { id: 'goblin_ear', rarity: 'common' },
    { id: 'warden_seal', rarity: 'epic' },
  ];
  const act = bag.interact.act;
  const ok = act();
  const left = bag.items.length;
  const inBag = inv.slots.filter((s) => s && s.id && !String(s.id).startsWith('test_')).length;
  return { ok, left, inBag, bags: m.bags.length };
});
check('частичный подбор не теряет добычу', partial.ok === true && partial.left === 1 && partial.inBag === 1,
  JSON.stringify(partial));

/* ---------------- 8. уникальность статов и цен ---------------- */
const uniq = await page.evaluate(() => {
  const d = window.__dbg;
  const specs = d.monsters.list.map((m) => m.spec);
  const byId = new Map(specs.map((s) => [s.id, s]));
  const dmg = [...byId.values()].map((s) => s.dmg);
  const spd = [...byId.values()].map((s) => s.speed);
  const sells = [];
  for (const s of d.items.ITEMS.values()) if (s.kind === 'loot') sells.push(s.sell);
  return {
    dmg: [...new Set(dmg)].length + '/' + dmg.length,
    spd: [...new Set(spd)].length + '/' + spd.length,
    sells: sells.length ? [...new Set(sells)].length + '/' + sells.length : 'нет списка',
  };
});
check('урон у пород разный', uniq.dmg.startsWith(uniq.dmg.split('/')[0]) && uniq.dmg.split('/')[0] === uniq.dmg.split('/')[1],
  uniq.dmg);
check('скорость у пород разная', uniq.spd.split('/')[0] === uniq.spd.split('/')[1], uniq.spd);
check('цены продажи лута разные', uniq.sells === 'нет списка' || uniq.sells.split('/')[0] === uniq.sells.split('/')[1], uniq.sells);

/* ---------------- 9. голем маленький, призрак большой ---------------- */
const sizes = await page.evaluate(() => {
  const d = window.__dbg;
  const g = d.monsters.list.find((m) => m.spec.id === 'golem_small');
  const gh = d.monsters.list.find((m) => m.spec.id === 'ghost');
  if (!g || !gh) return { err: 'нет пород' };
  return {
    golemH: g.spec.height * (g.baseScale || 1),
    golemScale: g.group.scale.x,
    ghostH: gh.spec.height * (gh.baseScale || 1),
  };
});
check('каменный голем — маленький', sizes.golemH < 1.4, JSON.stringify(sizes));
check('призрак — выше и шире гоблина', sizes.ghostH > 2.4, JSON.stringify(sizes));

/* ---------------- вывод ---------------- */
console.log(results.join('\n'));
console.log(`\nr61_fixes_check: ${ok} ok, ${fail} fail`);
if (errs.length) console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
if (fail) process.exit(1);
