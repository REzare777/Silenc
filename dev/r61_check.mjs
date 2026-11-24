/**
 * ============================================================================
 *  Раунд 61 — проверка зверинца подземелья
 * ============================================================================
 *
 *  Проверяем:
 *   1) в пещере появляются все десять пород, в случайных местах;
 *   2) у каждой поры свои статы и своя атака;
 *   3) босс-орк жив, у него своя полоска здоровья и четыре атаки;
 *   4) сложность меняет характеристики монстров;
 *   5) удар оружием снимает здоровье, смерть роняет мешок с добычей;
 *   6) мешок подбирается, лут попадает в сумку и продаётся;
 *   7) призраки выше и больше остальных;
 *   8) стрелок стреляет, споры замедляют, лужи наносят урон;
 *   9) монстры не вылезают за пределы пещеры и не стоят в стенах.
 *
 *  Запуск: cd /workspace/village && node dev/r61_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
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

/* ---------------- заходим в подземелье ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.player.pos.set(-9, 0, -17);
  d.player.groundY = 0;
  d.player.y = 0;
  d.setLocation('dungeon');
});
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const list = m.list;
  const byType = {};
  for (const s of list) {
    byType[s.spec.id] = byType[s.spec.id] || [];
    byType[s.spec.id].push(s);
  }
  // где находится игрок
  const p = d.player.pos;
  return {
    count: list.length,
    types: Object.keys(byType),
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
    boss: m.getBoss() ? {
      name: m.getBoss().spec.name,
      hp: m.getBoss().maxHp,
      tier: m.getBoss().spec.tier,
      attack: m.getBoss().spec.attack,
    } : null,
    guards: m.guardsLeft(),
    difficulty: m.difficulty.id,
    specList: d.__monsterSpecs ? null : undefined,
    playerPos: { x: p.x, y: p.y, z: p.z },
    loc: d.loc,
    inDungeon: list.length > 0,
    // позиции — разбросаны ли
    xs: list.map((s) => Math.round(s.x)),
    zs: list.map((s) => Math.round(s.z)),
    // призрак: рост и размер
    ghost: (() => {
      const g = list.find((s) => s.spec.id === 'ghost');
      if (!g) return null;
      const box = new d.THREE.Box3().setFromObject(g.group);
      const size = new d.THREE.Vector3();
      box.getSize(size);
      return { h: +size.y.toFixed(2), w: +size.x.toFixed(2) };
    })(),
    goblin: (() => {
      const g = list.find((s) => s.spec.id === 'goblin_sword');
      if (!g) return null;
      const box = new d.THREE.Box3().setFromObject(g.group);
      const size = new d.THREE.Vector3();
      box.getSize(size);
      return { h: +size.y.toFixed(2), w: +size.x.toFixed(2) };
    })(),
  };
});

check('подземелье населено', res.inDungeon, `монстров: ${res.count}`);
check('локация — подземелье', res.loc === 'dungeon', res.loc);
check('есть все десять пород (11 видов + босс)', res.types.length === 12, `пород: ${res.types.length} (${res.types.join(', ')})`);
check('есть босс', !!res.boss, res.boss ? `${res.boss.name}, HP ${res.boss.hp}` : 'нет');
check('босс — ступень boss', res.boss && res.boss.tier === 'boss');
check('босс — отдельная атака', res.boss && res.boss.attack === 'boss');
check('элитные гоблины-стражи', res.guards > 0, `стражей: ${res.guards}`);
check('призрак выше гоблина', res.ghost && res.goblin && res.ghost.h > res.goblin.h * 1.5,
  `призрак ${res.ghost ? res.ghost.h : '?'} м, гоблин ${res.goblin ? res.goblin.h : '?'} м`);
check('призрак шире гоблина', res.ghost && res.goblin && res.ghost.w > res.goblin.w,
  `призрак ${res.ghost ? res.ghost.w : '?'} м, гоблин ${res.goblin ? res.goblin.w : '?'} м`);

/* ---------------- сложность ---------------- */
const diff = await page.evaluate(async () => {
  const d = window.__dbg;
  const out = {};
  for (const id of ['easy', 'nightmare']) {
    localStorage.setItem('wv.difficulty', id);
    d.monsters.respawn();
    const m = d.monsters;
    const boss = m.getBoss();
    const g = m.list.find((s) => s.spec.id === 'goblin_sword');
    out[id] = { bossHp: boss ? boss.maxHp : 0, goblinHp: g ? g.maxHp : 0, count: m.list.length };
  }
  localStorage.setItem('wv.difficulty', 'normal');
  d.monsters.respawn();
  const boss = d.monsters.getBoss();
  out.normal = { bossHp: boss ? boss.maxHp : 0, count: d.monsters.list.length };
  return out;
});
check('сложность меняет здоровье босса',
  diff.nightmare.bossHp > diff.normal.bossHp && diff.easy.bossHp < diff.normal.bossHp,
  `легко ${diff.easy.bossHp} / обычно ${diff.normal.bossHp} / кошмар ${diff.nightmare.bossHp}`);
check('сложность меняет число монстров', diff.nightmare.count > diff.normal.count,
  `обычно ${diff.normal.count}, кошмар ${diff.nightmare.count}`);

/* ---------------- бой: удар, смерть, лут ---------------- */
const fight = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const target = m.list.find((s) => s.spec.id === 'goblin_sword' && s.hp > 0);
  if (!target) return { err: 'нет гоблина' };
  const hp0 = target.hp;
  const totalHp = () => m.list.reduce((s, x) => s + Math.max(0, x.hp), 0);
  const total0 = totalHp();
  // бьём оружием: подставляем игрока рядом и «стреляем» в конус
  d.player.pos.set(target.x, 0, target.z + 1.2);
  d.player.groundY = target.y;
  const org = new d.THREE.Vector3(target.x, target.y + 1.4, target.z + 1.2);
  const dir = new d.THREE.Vector3(0, 0, -1);
  const res1 = m.hit(org, dir, 3, 0.8, 25);
  const hpAfter = target.hp;
  const totalAfter = totalHp();
  // добиваем
  let killed = false;
  if (target.hp > 0) {
    const r2 = m.hit(org, dir, 3, 0.8, 999);
    killed = r2.killed;
  }
  return {
    hp0, hpAfter, total0, totalAfter, killed,
    bags: m.bags.length,
    bagItems: m.bags[0] ? m.bags[0].items.map((i) => i.id) : [],
    bagRarity: m.bags[0] ? m.bags[0].rarity : null,
    interactables: d.ctx.interactables.filter((i) => i.label && i.label.includes('добычу')).length,
  };
});
check('удар оружием снимает здоровье', fight.totalAfter < fight.total0 || fight.hpAfter < fight.hp0,
  `цель ${fight.hp0} → ${fight.hpAfter}, всего ${fight.total0} → ${fight.totalAfter}`);
check('монстр убит', fight.killed === true);
check('после смерти выпал мешок', fight.bags === 1, `мешков: ${fight.bags}`);
check('в мешке 1–2 предмета', fight.bagItems.length >= 1 && fight.bagItems.length <= 2, fight.bagItems.join(', '));
check('мешок зарегистрирован как интеракт', fight.interactables >= 1);

/* ---------------- подбор лута ---------------- */
const pick = await page.evaluate(() => {
  const d = window.__dbg;
  const bag = d.monsters.bags[0];
  if (!bag) return { err: 'нет мешка' };
  d.player.pos.set(bag.x, bag.y, bag.z + 0.6);
  const before = d.inventory.slots.filter(Boolean).length;
  const okPick = d.doInteract();
  const after = d.inventory.slots.filter(Boolean).length;
  const items = d.inventory.slots.filter(Boolean).map((s) => s.id);
  return { okPick, before, after, items, bagsLeft: d.monsters.bags.length };
});
check('мешок подбирается', pick.okPick === true);
check('предметы попали в сумку', pick.after > pick.before, `${pick.before} → ${pick.after} (${pick.items.join(', ')})`);
check('мешок исчез', pick.bagsLeft === 0);

/* ---------------- лут продаётся ---------------- */
const sell = await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  const slot = inv.slots.findIndex((s) => s && d.items.getItem(s.id) && d.items.getItem(s.id).kind === 'loot');
  if (slot < 0) return { err: 'нет лута в сумке' };
  const spec = d.items.getItem(inv.slots[slot].id);
  const coins0 = d.stats.coins;
  // цена продажи должна считаться
  const price = d.items.sellPrice(spec);
  // идём к кузнецу и продаём (кузнец берёт не всё — проверяем через трактирщика)
  const t = d.trade;
  const okOpen = t.open('barkeep');
  let sold = false;
  if (okOpen) {
    sold = t.sell(spec.id);
    t.close();
  }
  return {
    kind: spec.kind, rarity: spec.rarity, price, coins0, coins: d.stats.coins, sold,
    hasCraft: !!spec.craft, craftTags: spec.craft ? spec.craft.tags : null,
  };
});
check('лут — предмет kind=loot', sell.kind === 'loot', sell.kind);
check('у лута есть редкость', !!sell.rarity, sell.rarity);
check('у лута есть заготовка под крафт', sell.hasCraft === true, JSON.stringify(sell.craftTags));
check('лут можно продать', sell.sold === true, `цена ${sell.price}, монеты ${sell.coins0} → ${sell.coins}`);

/* ---------------- атаки: стрелок, споры, лужа ---------------- */
const atk = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const out = {};
  // стрелок: ставим рядом и ждём выстрела
  const archer = m.list.find((s) => s.spec.id === 'goblin_bow');
  if (archer) {
    d.player.pos.set(archer.x, 0, archer.z + 6);
    d.player.groundY = archer.y;
    archer.state = 'stalk';
    archer.cd = 0;
    for (let i = 0; i < 200; i++) {
      m.update(1 / 30, i / 30);
      if (m.__projCount && m.__projCount() > 0) break;
    }
    out.archer = { projectiles: m.__projCount ? m.__projCount() : 0 };
  }
  // лужа от слизня
  const slime = m.list.find((s) => s.spec.id.startsWith('slime'));
  if (slime) {
    d.player.pos.set(slime.x, 0, slime.z + 1);
    d.player.groundY = slime.y;
    slime.state = 'attack';
    slime.stateT = 0.3;
    m.update(1 / 30, 5);
    out.puddles = m.__puddleCount ? m.__puddleCount() : 0;
  }
  // споры: замедление игрока (ждём, пока снаряд долетит)
  d.player.slow = 0;
  const shroom = m.list.find((s) => s.spec.id === 'shroom');
  if (shroom) {
    d.player.pos.set(shroom.x, 0, shroom.z + 5);
    d.player.groundY = shroom.y;
    shroom.state = 'attack';
    shroom.stateT = 0.3;
    for (let i = 0; i < 120 && d.player.slow <= 0; i++) {
      shroom.state = 'attack';
      shroom.stateT = 0.3;
      d.player.pos.set(shroom.x, 0, shroom.z + 5);
      m.update(1 / 30, 6 + i / 30);
    }
    out.slow = d.player.slow;
  }
  return out;
});
check('гоблин-лучник стреляет', atk.archer && atk.archer.projectiles > 0, `снарядов: ${atk.archer ? atk.archer.projectiles : 0}`);
check('слизень оставляет лужу', atk.puddles > 0, `луж: ${atk.puddles}`);
check('споры гриба замедляют игрока', atk.slow > 0, `slow=${atk.slow}`);

/* ---------------- босс: полоска и атаки ---------------- */
const boss = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss();
  if (!b) return { err: 'нет босса' };
  const seen = new Set();
  // прогоняем разные атаки: босс свободно выбирает их по ситуации
  for (let i = 0; i < 900; i++) {
    b.hp = b.maxHp;
    b.cd = 0;
    b.stun = 0;
    d.player.pos.set(b.x + 3, b.y, b.z + 3);
    d.player.groundY = b.y;
    d.player.slow = 0;
    d.stats.hp = 100;
    m.update(1 / 30, i / 30);
    if (b.attackName) seen.add(b.attackName);
    if (b.shocks && b.shocks.length) seen.add('slam');
  }
  const bar = document.getElementById('bossBar');
  return {
    attacks: [...seen],
    barVisible: bar ? bar.classList.contains('on') : false,
    barName: document.getElementById('bossName') ? document.getElementById('bossName').textContent : '',
    hp: d.stats.hp,
  };
});
check('босс применяет несколько атак', boss.attacks && boss.attacks.length >= 2, (boss.attacks || []).join(', '));
check('полоска босса показана', boss.barVisible === true, boss.barName);

/* ---------------- монстры не в стенах ---------------- */
const inside = await page.evaluate(() => {
  const d = window.__dbg;
  const boxes = (d.dungeonLoc.colliders.boxes || []);
  let bad = 0;
  const inWalls = [];
  const total = [];
  for (const s of d.monsters.list) {
    if (s.spec.ghost) continue;         // призраки проходят сквозь стены
    for (const b of boxes) {
      const c = Math.cos(b.ang || 0), sn = Math.sin(b.ang || 0);
      const dx = s.x - b.cx, dz = s.z - b.cz;
      const lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.hx, Math.min(lx, b.hx));
      const qz = Math.max(-b.hz, Math.min(lz, b.hz));
      if (Math.hypot(lx - qx, lz - qz) < s.spec.radius) {
        bad++;
        inWalls.push({ id: s.spec.id, x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: s.y, st: s.state });
        break;
      }
    }
    total.push({ x: +s.x.toFixed(1), z: +s.z.toFixed(1), y: s.y });
  }
  // все ли в пределах пещеры
  const out = total.filter((p) => p.z < -35 || p.z > 37 || Math.abs(p.x) > 15.5);
  return { bad, outside: out.length, sample: out.slice(0, 3), inWalls };
});
check('монстры не стоят в стенах', inside.bad === 0,
  `в стенах: ${inside.bad} ${JSON.stringify(inside.inWalls || [])}`);
check('монстры внутри пещеры', inside.outside === 0, `вне: ${inside.outside}`);

/* ---------------- вывод ---------------- */
console.log(results.join('\n'));
console.log(`\nr61_check: ${ok} ok, ${fail} fail`);
if (errs.length) console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
if (fail) process.exit(1);
