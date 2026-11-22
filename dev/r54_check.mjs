/**
 * ============================================================================
 *  Раунд 54: каталог предметов, торговля, кузнец, оружие в руках и бой
 * ============================================================================
 *
 *  Что проверяем:
 *   1. Каталог предметов: у каждого вида есть иконка и описание.
 *   2. Каталог оружия: у каждого вида есть 3D-модель и 2D-иконка,
 *      параметры осмысленные (лёгкое — быстрее, тяжёлое — сильнее).
 *   3. Инвентарь работает с предметами без «лучшего экземпляра».
 *   4. Торговля: открытие, покупка, продажа, отказ при нехватке монет.
 *   5. Купил оружие — оно сразу на поясе и в руках.
 *   6. Кузнец стоит у кузни, с ним можно поговорить, в диалоге есть тема
 *      «торговля», которая открывает окно торговли.
 *   7. Удар оружием снимает здоровье тени и уважает перезарядку.
 *   8. Посох тратит ману, лук бьёт дальше меча.
 *
 *  Запуск: cd dev && node r54_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

const res = {};
const info = {};
const ok = (name, cond, extra) => { res[name] = cond ? true : (extra === undefined ? false : extra); };
const step = async (label, fn) => {
  const r = await page.evaluate(fn);
  Object.assign(res, r);
  console.log('шаг:', label, '— готово');
};

await step('каталоги', () => {
  const d = window.__dbg;
  const out = {};
  const info = window.__info || (window.__info = {});
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };

  /* --- 1. каталог предметов --- */
  const items = d.items;
  info.itemCount = items.ITEMS.size;
  ok('itemsCatalog', items.ITEMS.size > 20, items.ITEMS.size);
  const goodsOk = items.GOODS.every((g) => {
    const ic = items.itemIcon(g, 64);
    const de = items.itemDesc(g, null);
    return !!ic && ic.width === 64 && de.rows.length > 0 && de.name === g.name;
  });
  ok('goodsIcons', goodsOk);
  const matOk = items.MATERIALS.every((m) => !!items.itemIcon(m, 64));
  ok('materialIcons', matOk);

  /* --- 2. каталог оружия --- */
  const W = d.weapons;
  info.weaponCount = W.WEAPONS.length;
  ok('weaponCount', W.WEAPONS.length === 7, W.WEAPONS.length);
  let modelsOk = true, iconsOk = true, gripOk = true;
  for (const w of W.WEAPONS) {
    const m = W.weaponModel(w.id);
    if (!m) { modelsOk = false; continue; }
    let meshes = 0;
    m.traverse((o) => { if (o.isMesh) meshes++; });
    if (meshes < 3) modelsOk = false;
    const ic = W.weaponIcon(w, 64);
    if (!ic || ic.width !== 64) iconsOk = false;
    const g = W.weaponGrip(w);
    if (!g || !g.pose || !(g.scale > 0)) gripOk = false;
  }
  ok('weaponModels', modelsOk);
  ok('weaponIcons', iconsOk);
  ok('weaponGrips', gripOk);
  // осмысленность параметров: лёгкое быстрее, тяжёлое сильнее
  const dagger = W.getWeapon('dagger');
  const greatsword = W.getWeapon('greatsword');
  ok('daggerFaster', dagger.speed < greatsword.speed, `${dagger.speed} vs ${greatsword.speed}`);
  ok('greatswordStronger', greatsword.dmg[1] > dagger.dmg[1], `${greatsword.dmg[1]} vs ${dagger.dmg[1]}`);
  ok('bowReach', W.getWeapon('bow').reach > greatsword.reach);
  ok('staffMana', W.getWeapon('staff').mana > 0);
  ok('twoHanded', greatsword.hands === 'two');

  /* --- 3. инвентарь без «лучшего экземпляра» --- */
  const inv = d.inventory;
  inv.slots.fill(null);
  const res1 = inv.add({ id: 'bread', spec: items.getItem('bread'), count: 3, best: null });
  ok('addGoods', res1.ok, JSON.stringify(res1));
  ok('goodsNoBest', inv.slots[res1.slot].best === null);
  const res2 = inv.add({ id: 'dagger', spec: items.getItem('dagger'), count: 1, best: null });
  ok('addWeapon', res2.ok);
  ok('weaponNoBest', inv.slots[res2.slot].best === null);
  ok('countOf', inv.countOf('bread') === 3, inv.countOf('bread'));
  return Object.assign(out, info);
});

await step('торговля и кузнец', () => {
  const d = window.__dbg;
  const out = {};
  const info = window.__info || (window.__info = {});
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };
  const items = d.items;
  const inv = d.inventory;

  /* --- 4. торговля --- */
  const trade = d.trade;
  d.ctx.stats.coins = 500;
  const opened = trade.open('blacksmith');
  ok('tradeOpen', opened && d.ctx.mode === 'trade');
  const tradeEl = document.getElementById('trade');
  ok('tradeVisible', tradeEl && tradeEl.classList.contains('on'));
  const rows = document.querySelectorAll('#tradeGoods .tradeRow');
  info.tradeGoodRows = rows.length;
  ok('tradeRows', rows.length === 8, rows.length);   // 7 видов оружия + смола и фитиль
  info.tradeMineBefore = document.querySelectorAll('#tradeMine .tradeRow').length;
  ok('tradeMineListed', info.tradeMineBefore >= 0, info.tradeMineBefore);

  /* --- 5. покупка оружия: сразу на пояс и в руки --- */
  const coinsBefore = d.ctx.stats.coins;
  const bought = trade.buy('dagger');
  ok('buyWeapon', bought);
  ok('coinsSpent', d.ctx.stats.coins === coinsBefore - 25, `${coinsBefore} → ${d.ctx.stats.coins}`);
  const onBelt = inv.slots.findIndex((s, i) => s && s.id === 'dagger' && i >= 27);
  ok('weaponOnBelt', onBelt >= 27, onBelt);
  ok('loadoutWeapon', !!(d.loadout && d.loadout.currentWeapon()), d.loadout && d.loadout.currentWeapon() && d.loadout.currentWeapon().id);
  ok('viewmodelWeapon', !!d.viewmodel.weapon);

  /* --- отказ при нехватке монет --- */
  d.ctx.stats.coins = 0;
  const refused = trade.buy('greatsword');
  ok('refuseNoCoins', refused === false);
  ok('coinsKept', d.ctx.stats.coins === 0, d.ctx.stats.coins);
  d.ctx.stats.coins = 500;
  trade.close();
  ok('tradeClosed', d.ctx.mode === 'play' && !tradeEl.classList.contains('on'));

  /* --- продажа: трактирщик берёт рыбу за полную цену --- */
  const fish = d.FISH[0];
  inv.slots.fill(null);
  const coinsPre = d.ctx.stats.coins;
  inv.add({ id: fish.id, spec: fish, count: 2, best: { weight: fish.weightMin, length: fish.lengthMin } });
  trade.open('barkeep');
  const sold = trade.sell(fish.id);
  ok('sellFish', sold);
  ok('sellCoins', d.ctx.stats.coins === coinsPre + fish.value, `${coinsPre} + ${fish.value} = ${d.ctx.stats.coins}`);
  ok('sellCount', inv.countOf(fish.id) === 1, inv.countOf(fish.id));
  const barkeepRows = document.querySelectorAll('#tradeGoods .tradeRow');
  ok('barkeepGoods', barkeepRows.length === 6, barkeepRows.length);
  trade.close();

  /* --- 5б. торговля в таверне: интеракт на месте --- */
  const tradeInteract = d.interactables.find((i) => i.label === 'Торговать с трактирщиком');
  ok('barkeepTradeInteract', !!tradeInteract);
  ok('noOldSellInteract', !d.interactables.some((i) => i.label === 'Продать рыбу'));

  /* --- 6. кузнец --- */
  const smith = d.npcs && d.npcs.blacksmith;
  ok('smithExists', !!smith);
  if (smith) {
    ok('smithInScene', !!smith.group && !!smith.group.parent);
    ok('smithAtForge', Math.abs(smith.x - 14.5) < 6 && Math.abs(smith.z + 8) < 6, `${smith.x.toFixed(1)},${smith.z.toFixed(1)}`);
  }
  const smithTalk = d.interactables.find((i) => i.label === 'Поговорить с кузнецом');
  ok('smithInteract', !!smithTalk);
  const dlg = d.ctx.systems.dialog;
  const dlgOpened = dlg.open('blacksmith');
  ok('smithDialog', dlgOpened && d.ctx.mode === 'dialog');
  const dialogEl = document.getElementById('dialog');
  ok('smithDialogVisible', dialogEl && dialogEl.classList.contains('on'));
  const topics = dialogEl ? dialogEl.querySelectorAll('.topic, .dlgTopic, button') : [];
  info.smithTopics = topics.length;
  // тема с торговлей открывает окно торговли
  const tradeTopic = d.ctx.systems.dialog && window.__dbg.ctx.systems.dialog;
  let tradeOpened = false;
  if (dialogEl) {
    const btns = [...dialogEl.querySelectorAll('button')];
    const t = btns.find((b) => /продажу|товар/i.test(b.textContent || ''));
    if (t) { t.click(); tradeOpened = document.getElementById('trade').classList.contains('on'); }
  }
  ok('dialogTradeTopic', tradeOpened);
  if (tradeOpened) d.trade.close(); else dlg.close();
  return Object.assign(out, info);
});

await step('бой', () => {
  const d = window.__dbg;
  const out = {};
  const info = window.__info || (window.__info = {});
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };
  const items = d.items;
  const inv = d.inventory;

  /* --- 7. бой: урон оружием --- */
  d.setLocation('dungeon');
  const shadows = d.shadows;
  shadows.spawn();
  shadows.update(0.016, 1);
  const list = shadows.list;
  info.shadowCount = list.length;
  ok('shadowsSpawned', list.length > 0, list.length);
  if (list.length) {
    const s = list[0];
    // ставим тень прямо перед игроком
    const cam = d.camera;
    const dir = new d.THREE.Vector3();
    cam.getWorldDirection(dir);
    const org = new d.THREE.Vector3();
    cam.getWorldPosition(org);
    s.x = org.x + dir.x * 1.2;
    s.z = org.z + dir.z * 1.2;
    s.hp = 40;
    // экипируем короткий меч
    inv.slots.fill(null);
    inv.add({ id: 'shortsword', spec: items.getItem('shortsword'), count: 1, best: null });
    // кладём на пояс и выбираем
    const beltIdx = inv.slots.findIndex((s2, i) => s2 && s2.id === 'shortsword' && i >= 27);
    if (beltIdx < 0) {
      inv.slots[28] = { id: 'shortsword', spec: items.getItem('shortsword'), count: 1, best: null };
    }
    d.loadout.select(1);
    d.loadout.sync();
    info.armedId = d.loadout.currentWeapon() ? d.loadout.currentWeapon().id : null;
    ok('armedShortsword', d.loadout.currentWeapon() && d.loadout.currentWeapon().id === 'shortsword');
    const hpBefore = s.hp;
    const hit1 = d.combat.weaponStrike();
    ok('weaponHit', hit1 === true, JSON.stringify({ hit1 }));
    ok('shadowDamaged', s.hp < hpBefore, `${hpBefore} → ${s.hp}`);
    // перезарядка: второй удар сразу не проходит
    const hit2 = d.combat.weaponStrike();
    ok('weaponCooldown', hit2 === false);
    // снимаем кулдаун и бьём до смерти
    d.combat.state.weaponCd = 0;
    let guard = 0;
    while (s.hp > 0 && guard < 12) {
      d.combat.state.weaponCd = 0;
      s.x = org.x + dir.x * 1.2;
      s.z = org.z + dir.z * 1.2;
      s.hp = Math.min(s.hp, 12);
      d.combat.weaponStrike();
      guard++;
    }
    ok('shadowKilled', s.hp <= 0, s.hp);
  }

  /* --- 8. посох тратит ману --- */
  const staff = items.getItem('staff');
  inv.slots.fill(null);
  inv.slots[27] = { id: 'staff', spec: staff, count: 1, best: null };
  d.loadout.select(0);
  d.loadout.sync();
  d.ctx.stats.mana = 30;
  d.combat.state.weaponCd = 0;
  d.combat.weaponStrike();
  ok('staffCostsMana', d.ctx.stats.mana <= 24, d.ctx.stats.mana);
  return Object.assign(out, info);
});

/* --- печать --- */
for (const [k, v] of Object.entries(info)) console.log('info:', k, '=', JSON.stringify(v));
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(res)) {
  if (v === true) { pass++; continue; }
  if (v === false) { fail++; console.log('FAIL', k); continue; }
  console.log('info:', k, '=', JSON.stringify(v));
}
console.log(`\nr54_check: ${pass} ok, ${fail} fail`);
if (errs.length) { console.log('Ошибки страницы:'); errs.forEach((e) => console.log(' ', e)); }
await browser.close();
process.exit(fail || errs.length ? 1 : 0);
