/**
 * ============================================================================
 *  Раунд 61 — тест-агент: добыча (лут), торговля, сумка, сохранения
 * ============================================================================
 *
 *  Проверяю:
 *   1) после убийства монстра падает мешок (тканевая сумка со свечением);
 *   2) мешок виден и подсвечен;
 *   3) мешок подбирается клавишей E рядом с ним;
 *   4) предметы попадают в сумку (инвентарь);
 *   5) у каждого предмета лута есть редкость и своя цена;
 *   6) лут можно продать и трактирщику (Хорт), и кузнецу (Торн);
 *   7) в инвентаре у лута есть иконка и подпись редкости;
 *   8) при полной сумке подбор не ломает игру;
 *   9) сохранение/загрузка работают после всех этих изменений.
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_loot.mjs
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
await page.waitForTimeout(1500);

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

/* ================= 1. убийство → мешок ================= */
const drop = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const target = m.list.find((s) => s.spec.id === 'goblin_sword' && s.hp > 0);
  if (!target) return { err: 'нет гоблина' };
  const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
  for (const o of m.list) {
    if (o === target) continue;
    o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
  }
  const org = new d.THREE.Vector3(target.x, target.y + 1.2, target.z + 2);
  const before = m.bags.length;
  const res = m.hit(org, new d.THREE.Vector3(0, 0, -1), 3, 0.8, 999);
  const bag = m.bags[0];
  // что внутри мешка — насколько это «сумка со свечением»
  let meshes = 0, glow = 0, sphere = 0, halo = 0;
  if (bag) {
    bag.group.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const t = o.geometry ? o.geometry.type : '';
      if (t === 'SphereGeometry') sphere++;
      const mt = o.material;
      if (mt && mt.blending === d.THREE.AdditiveBlending) halo++;
      if (mt && mt.isMeshBasicMaterial) glow++;
    });
  }
  const inter = bag ? bag.interact : null;
  const out = {
    killed: res.killed, bagsBefore: before, bagsAfter: m.bags.length,
    items: bag ? bag.items.map((i) => ({ id: i.id, rarity: i.rarity })) : [],
    rarity: bag ? bag.rarity : null,
    meshes, glow, halo, sphere,
    label: inter ? inter.label : null,
    where: inter ? inter.where : null,
    radius: inter ? inter.radius : null,
    inInteractables: inter ? d.interactables.includes(inter) : false,
    x: bag ? bag.x : null, z: bag ? bag.z : null, y: bag ? bag.y : null,
  };
  for (const s of saved) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.state = s.st; s.o.group.position.set(s.x, s.y, s.z); }
  return out;
});
check('убитый монстр роняет мешок с добычей', drop.killed === true && drop.bagsAfter === 1,
  `мешков: ${drop.bagsBefore} → ${drop.bagsAfter}, предметов: ${drop.items.map((i) => i.id).join(', ') || 'нет'}`);
check('мешок — тканевая сумка со свечением',
  drop.meshes >= 3 && drop.halo > 0 && drop.sphere > 0,
  `мешей: ${drop.meshes}, с аддитивным свечением: ${drop.halo}, сфер: ${drop.sphere}`);
check('у мешка редкость', !!drop.rarity, `редкость мешка: ${drop.rarity}`);
check('мешок зарегистрирован как интеракт в подземелье',
  drop.inInteractables === true && drop.where === 'dungeon' && /добычу/i.test(drop.label || ''),
  `подпись: "${drop.label}", где: ${drop.where}, радиус: ${drop.radius}`);

/* ================= 2. подбор клавишей E ================= */
await page.evaluate(() => {
  const d = window.__dbg;
  const bag = d.monsters.bags[0];
  if (!bag) return;
  d.player.pos.set(bag.x, 0, bag.z + 1.2);
  d.player.groundY = bag.y; d.player.y = 0;
});
await page.waitForTimeout(400);
const beforePick = await page.evaluate(() => ({
  slots: window.__dbg.inventory.slots.filter(Boolean).length,
  nearest: (() => {
    const n = window.__dbg.nearestInteractable();
    return n ? n.label : null;
  })(),
  mode: window.__dbg.mode,
}));
check('рядом с мешком предлагается действие E',
  /добычу/i.test(beforePick.nearest || ''), `подсказка: "${beforePick.nearest}"`);

await page.keyboard.press('e');
await page.waitForTimeout(700);
const afterPick = await page.evaluate(() => {
  const d = window.__dbg;
  const items = d.inventory.slots.filter(Boolean).map((s) => ({ id: s.id, name: s.spec.name, kind: s.spec.kind, rarity: s.spec.rarity }));
  return {
    slots: d.inventory.slots.filter(Boolean).length,
    items, bags: d.monsters.bags.length,
    toast: document.getElementById('toast').textContent,
  };
});
check('клавиша E подбирает мешок', afterPick.bags === 0 && afterPick.slots > beforePick.slots,
  `слотов ${beforePick.slots} → ${afterPick.slots}, мешков осталось ${afterPick.bags}`);
check('предметы лута попали в сумку', afterPick.items.some((i) => i.kind === 'loot'),
  afterPick.items.map((i) => `${i.name} (${i.rarity})`).join(', '));

/* ================= 3. редкость и цены у всех видов лута ================= */
const lootTable = await page.evaluate(() => {
  const d = window.__dbg;
  const ids = ['goblin_ear', 'goblin_tooth', 'slime_jelly', 'spider_web', 'shroom_cap',
    'ghost_dust', 'snake_fang', 'golem_core', 'guard_badge', 'warden_seal', 'orc_tusk', 'grim_crown'];
  const rows = [];
  for (const id of ids) {
    const spec = d.items.getItem(id);
    rows.push({
      id, name: spec ? spec.name : null, kind: spec ? spec.kind : null,
      rarity: spec ? spec.rarity : null, value: spec ? spec.value : null,
      sell: spec ? d.items.sellPrice(spec) : null, craft: spec ? !!spec.craft : null,
      icon: spec ? !!d.items.itemIcon(spec, 64) : false,
    });
  }
  return rows;
});
check('у всех 12 видов лута есть редкость',
  lootTable.every((r) => !!r.rarity), [...new Set(lootTable.map((r) => r.rarity))].join(', '));
check('встречаются все пять уровней редкости',
  new Set(lootTable.map((r) => r.rarity)).size === 5,
  [...new Set(lootTable.map((r) => r.rarity))].join(', '));
const values = lootTable.map((r) => r.value);
check('у каждого вида лута своя цена', new Set(values).size === values.length,
  lootTable.map((r) => `${r.id}=${r.value}`).join(' '));
const sells = lootTable.map((r) => r.sell);
check('у каждого вида лута своя цена продажи', new Set(sells).size === sells.length,
  lootTable.map((r) => `${r.id}=${r.sell}`).join(' '));
check('у лута есть иконка', lootTable.every((r) => r.icon), 'иконки нарисованы для всех 12 видов');

/* ================= 4. иконка и редкость в инвентаре ================= */
const invUi = await page.evaluate(() => {
  const d = window.__dbg;
  d.toggleInventory();
  const grid = document.getElementById('invGrid');
  const slots = [...grid.querySelectorAll('.slot')];
  const lootSlot = slots.find((s) => {
    const st = d.inventory.slots[+[...grid.children].indexOf(s)];
    return st && st.spec.kind === 'loot';
  });
  const res = {
    open: document.getElementById('inv').classList.contains('on'),
    canvases: grid.querySelectorAll('canvas').length,
    lootSlotFound: !!lootSlot,
    tip: '', rar: '', name: '',
  };
  if (lootSlot) {
    lootSlot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    res.tip = document.getElementById('invTip').textContent || '';
    res.rar = document.getElementById('vRar').textContent || '';
    res.name = document.getElementById('vName').textContent || '';
  }
  d.toggleInventory();
  return res;
});
check('инвентарь открывается и в нём есть иконки', invUi.open === true && invUi.canvases > 0,
  `иконок (canvas) в сетке: ${invUi.canvases}`);
check('у лута в сумке есть иконка', invUi.lootSlotFound === true,
  `слот с лутом найден: ${invUi.lootSlotFound}`);
check('у лута в сумке показана редкость', /обычн|необычн|редк|эпическ|легендар/i.test(invUi.rar + invUi.tip),
  `подпись: "${invUi.rar}", подсказка: "${invUi.tip.slice(0, 90)}"`);

/* ================= 5. продажа лута торговцам ================= */
const sell = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};
  for (const who of ['barkeep', 'blacksmith']) {
    // кладём лут в сумку, если его там нет
    const spec = d.items.getItem('goblin_ear');
    if (!d.inventory.slots.some((s) => s && s.id === 'goblin_ear')) {
      d.inventory.add({ id: spec.id, spec, count: 1, best: null });
    }
    const coins0 = d.stats.coins;
    const opened = d.trade.open(who);
    const mine = document.getElementById('tradeMine').textContent || '';
    const sold = d.trade.sell('goblin_ear');
    d.trade.close();
    out[who] = { opened, sold, coins0, coins: d.stats.coins, inList: /Гоблинское ухо/.test(mine) };
  }
  return out;
});
check('трактирщик Хорт берёт лут', sell.barkeep && sell.barkeep.sold === true,
  `продано: ${sell.barkeep?.sold}, монеты ${sell.barkeep?.coins0} → ${sell.barkeep?.coins}, лут есть в списке: ${sell.barkeep?.inList}`);
check('кузнец Торн берёт лут', sell.blacksmith && sell.blacksmith.sold === true,
  `продано: ${sell.blacksmith?.sold}, монеты ${sell.blacksmith?.coins0} → ${sell.blacksmith?.coins}`);

/* ================= 6. полная сумка ================= */
const full = await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  const bread = d.items.getItem('bread');
  const saved = inv.slots.slice();
  // забиваем сумку целиком
  for (let i = 0; i < inv.slots.length; i++) {
    inv.slots[i] = { id: 'bread', spec: bread, count: 1, best: null };
  }
  // роняем мешок с лутом
  const m = d.monsters;
  const target = m.list.find((s) => s.spec.id === 'slime_green' && s.hp > 0);
  let bagItems = null;
  if (target) {
    const iso = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
    for (const o of m.list) {
      if (o === target) continue;
      o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
    }
    const org = new d.THREE.Vector3(target.x, target.y + 1.2, target.z + 2);
    m.hit(org, new d.THREE.Vector3(0, 0, -1), 3, 0.8, 999);
    const bag = m.bags[m.bags.length - 1];
    bagItems = bag ? bag.items.length : 0;
    for (const s of iso) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.state = s.st; s.o.group.position.set(s.x, s.y, s.z); }
  }
  const bag = m.bags[m.bags.length - 1];
  if (!bag) return { err: 'нет мешка' };
  const before = { bags: m.bags.length, filled: inv.slots.filter(Boolean).length };
  const toastBefore = document.getElementById('toast').textContent;
  // подбираем при полной сумке
  d.player.pos.set(bag.x, 0, bag.z + 1.0);
  d.player.groundY = bag.y; d.player.y = 0;
  const ok = d.doInteract();
  const toastAfter = document.getElementById('toast').textContent;
  const res = {
    ok, bagsBefore: before.bags, bagsAfter: m.bags.length,
    filled: before.filled, bagItems,
    toast: toastAfter, toastChanged: toastAfter !== toastBefore,
    alive: Number.isFinite(d.player.pos.x) && Number.isFinite(d.player.pos.z),
    hp: d.stats.hp,
  };
  inv.slots = saved;
  inv.touch();
  return res;
});
check('при полной сумке подбор не ломает игру',
  full.ok === false && full.bagsAfter === full.bagsBefore && full.alive === true,
  `подбор вернул ${full.ok}, мешков ${full.bagsBefore} → ${full.bagsAfter}, сумка занята на ${full.filled} слотов, подсказка: "${full.toast}"`);
check('при полной сумке игроку объясняют причину', /полна/i.test(full.toast || ''),
  `"${full.toast}"`);

/* --- частичный подбор: в сумке есть одно место, а в мешке два предмета --- */
const partial = await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  const m = d.monsters;
  const bread = d.items.getItem('bread');
  const saved = inv.slots.slice();
  // оставляем ровно одно пустое место
  const free = 3;
  for (let i = 0; i < inv.slots.length; i++) {
    inv.slots[i] = i === free ? null : { id: 'bread', spec: bread, count: 1, best: null };
  }
  // делаем мешок с двумя разными предметами
  const target = m.list.find((s) => s.spec.id === 'goblin_sword' && s.hp > 0);
  let bag = null;
  if (target) {
    const iso = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
    for (const o of m.list) {
      if (o === target) continue;
      o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
    }
    const org = new d.THREE.Vector3(target.x, target.y + 1.2, target.z + 2);
    m.hit(org, new d.THREE.Vector3(0, 0, -1), 3, 0.8, 999);
    bag = m.bags[m.bags.length - 1];
    if (bag) {
      bag.items = [
        { id: 'goblin_ear', rarity: 'common' },
        { id: 'warden_seal', rarity: 'epic' },
      ];
    }
    for (const s of iso) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.state = s.st; s.o.group.position.set(s.x, s.y, s.z); }
  }
  if (!bag) return { err: 'нет мешка' };
  d.player.pos.set(bag.x, 0, bag.z + 1.0);
  d.player.groundY = bag.y; d.player.y = 0;
  const ok = d.doInteract();
  const inInv = inv.slots.filter(Boolean).map((s) => s.id);
  const res = { ok, inInv, bags: m.bags.length, bagHad: 2 };
  inv.slots = saved;
  inv.touch();
  return res;
});
check('мешок с двумя предметами при одном свободном месте',
  partial.ok === true && partial.inInv.includes('goblin_ear'),
  `подбор: ${partial.ok}, в сумке: ${partial.inInv.join(', ')}`);
check('второй предмет мешка не теряется молча при частичном подборе',
  partial.inInv.includes('warden_seal'),
  partial.inInv.includes('warden_seal')
    ? 'оба предмета на месте'
    : `«Печать надзирателя» потеряна: в сумке только ${partial.inInv.join(', ')}`);

/* ================= 7. сохранение и загрузка ================= */
const saveLoad = await page.evaluate(() => {
  const d = window.__dbg;
  // кладём в сумку что-нибудь редкое и сохраняем
  const spec = d.items.getItem('warden_seal');
  d.inventory.add({ id: spec.id, spec, count: 1, best: null });
  const invBefore = d.inventory.slots.filter(Boolean).map((s) => s.id);
  const okSave = d.saveToSlot(1);
  // портим сумку
  d.inventory.slots.fill(null);
  const invAfterWipe = d.inventory.slots.filter(Boolean).length;
  const okLoad = d.loadSlot('slot', 1);
  const invAfter = d.inventory.slots.filter(Boolean).map((s) => s.id);
  return {
    okSave, okLoad, invBefore, invAfterWipe, invAfter,
    loc: d.loc,
    hp: d.stats.hp,
    nan: !Number.isFinite(d.player.pos.x) || !Number.isFinite(d.player.pos.z),
  };
});
check('сохранение в слот работает', saveLoad.okSave === true, `слот 1: ${saveLoad.okSave}`);
check('загрузка из слота возвращает сумку', saveLoad.okLoad === true && saveLoad.invAfter.includes('warden_seal'),
  `после загрузки: ${saveLoad.invAfter.join(', ') || 'пусто'}`);
check('после загрузки координаты — числа', saveLoad.nan === false,
  `локация: ${saveLoad.loc}, HP: ${saveLoad.hp}`);

console.log(results.join('\n'));
console.log(`\ntester_r61_loot: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await browser.close();
if (fail) process.exit(1);
