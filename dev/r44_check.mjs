/**
 * ============================================================================
 *  Проверки раунда 44: характеристики, монеты, руки и захваты
 * ============================================================================
 *
 *   1. Характеристики: жизнь, силы, мана — тратятся, восстанавливаются,
 *      появляется «выдохся», монеты считаются.
 *   2. HUD: три полоски меняют длину, счётчик монет обновляется и в HUD,
 *      и в окне инвентаря.
 *   3. Руки: модель появляется только когда предмет в руках, скрывается
 *      когда предмет убран; захваты переключаются.
 *   4. Продажа рыбы в таверне: монеты прибавляются, рыба уходит из сумки.
 *   5. Ошибок в консоли нет.
 *
 *  Запуск: cd dev && node r44_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 720, height: 450 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const d = window.__dbg;
  const s = d.stats;
  const res = { errors: [] };

  /* ---------- 1. характеристики ---------- */
  const t = {};
  t.start = { hp: s.hp, maxHp: s.maxHp, st: s.stamina, mp: s.mana, coins: s.coins };
  const taken = s.damage(30);
  t.damage = { taken, hp: Math.round(s.hp) };
  const healed = s.heal(10);
  t.heal = { healed, hp: Math.round(s.hp) };
  t.spendStamina = s.spendStamina(40);
  t.staminaAfter = Math.round(s.stamina);
  t.spendStaminaFail = s.spendStamina(999);
  t.exhausted = s.exhausted;
  t.drain = s.drainStamina(10);
  t.spendMana = s.spendMana(25);
  t.manaAfter = Math.round(s.mana);
  t.spendManaFail = s.spendMana(999);
  t.earn = s.earnCoins(70);
  t.spendCoins = s.spendCoins(100);
  t.spendCoinsFail = s.spendCoins(1);
  t.coinsAfter = s.coins;
  // регенерация
  s.stamina = 40; s.mana = 40;
  s.update(1, { sprinting: false });
  t.regen = { st: Math.round(s.stamina), mp: Math.round(s.mana) };
  s.update(1, { sprinting: true });
  t.regenSprint = { st: Math.round(s.stamina) };
  // сброс
  s.reset();
  t.afterReset = { hp: s.hp, st: s.stamina, mp: s.mana };
  res.stats = t;

  /* ---------- 2. HUD ---------- */
  const bar = (id) => {
    const el = document.getElementById(id);
    return el ? el.style.transform : '';
  };
  s.damage(50);
  s.spendMana(60);
  s.earnCoins(15);
  const hud = {
    hpBar: bar('barHp'),
    mpBar: bar('barMp'),
    hpNum: document.getElementById('numHp').textContent,
    mpNum: document.getElementById('numMp').textContent,
    coinsHud: document.getElementById('numCoins').textContent,
  };
  d.ui.renderInventory(d.inventory);
  hud.coinsInv = document.getElementById('invCoinsNum').textContent;
  res.hud = hud;
  s.reset();

  /* ---------- 3. руки и захваты ---------- */
  const vm = d.viewmodel;
  const hands = vm.hands.group;
  let meshes = 0;
  hands.traverse((o) => { if (o.isMesh) meshes++; });
  const rig = {
    meshes,
    visibleBefore: vm.visible,
    itemBefore: !!vm.item,
  };
  // взять предмет
  const model = d.THREE ? null : null;
  vm.hold(new d.THREE.Group(), { grip: 'two', pose: 'present', scale: 1, life: 0 });
  rig.visibleAfter = vm.visible;
  rig.itemAfter = !!vm.item;
  rig.grip = vm.grip;
  // смена захвата
  vm.setPose('right', 'carry');
  rig.gripRight = vm.grip;
  rig.poseCarry = vm.pose;
  rig.rightVisible = vm.hands.right.visible;
  rig.leftVisible = vm.hands.left.visible;
  vm.setPose('left', 'reach');
  rig.rightHidden = vm.hands.right.visible;
  rig.leftShown = vm.hands.left.visible;
  vm.setPose('two', 'present');
  rig.bothVisible = vm.hands.right.visible && vm.hands.left.visible;
  // убрать
  vm.hideHands();
  rig.visibleEnd = vm.visible;
  rig.itemEnd = !!vm.item;
  res.rig = rig;

  /* ---------- 4. продажа рыбы в таверне ---------- */
  const spec = d.FISH[0];
  const stack = { id: spec.id, spec, count: 1, best: { weight: spec.weightMin, length: spec.lengthMin } };
  d.inventory.add(stack);
  const coinsBefore = s.coins;
  const slotsBefore = d.inventory.slots.filter(Boolean).length;
  const sell = d.interactables.find((it) => it.label === 'Продать рыбу');
  res.sell = { found: !!sell, where: sell ? sell.where : null };
  if (sell) {
    sell.act();
    res.sell.coinsBefore = coinsBefore;
    res.sell.coinsAfter = s.coins;
    res.sell.slotsBefore = slotsBefore;
    res.sell.slotsAfter = d.inventory.slots.filter(Boolean).length;
    res.sell.gained = s.coins - coinsBefore;
  }
  // пустая сумка
  const sell2 = d.interactables.find((it) => it.label === 'Продать рыбу');
  sell2.act();
  res.sell.emptyOk = true;

  /* ---------- 5. улов: рыба попадает в руки ---------- */
  const f = d.fishing;
  f.state = 'bite';
  f.stage = 0;
  f.need = 1;
  f.fish = { spec: d.FISH[3], weight: 0.42, length: 31 };
  f.mark = 0.5; f.zonePos = 0.5; f.zone = 0.3;
  const slotsPre = d.inventory.slots.filter(Boolean).length;
  d.hookFish();
  res.catch = {
    slotsBefore: slotsPre,
    slotsAfter: d.inventory.slots.filter(Boolean).length,
    itemHeld: d.viewmodel.itemName,
    visible: d.viewmodel.visible,
    grip: d.viewmodel.grip,
  };

  return res;
});

/* ---------- вывод ---------- */
const L = [];
const ok = (cond, msg) => L.push(`${cond ? 'OK  ' : 'FAIL'} ${msg}`);

const t = out.stats;
ok(t.start.hp === 100 && t.start.maxHp === 100, `жизнь ${t.start.hp}/${t.start.maxHp}`);
ok(t.damage.taken === 30 && t.damage.hp === 70, `урон снял ${t.damage.taken}, осталось ${t.damage.hp}`);
ok(t.heal.healed === 10, `лечение вернуло ${t.heal.healed}`);
ok(t.spendStamina === true && t.staminaAfter === 60, `силы потрачены: ${t.staminaAfter}`);
ok(t.spendStaminaFail === false && t.exhausted === true, 'при нехватке сил — отказ и «выдохся»');
ok(t.spendMana === true && t.manaAfter === 75, `мана потрачена: ${t.manaAfter}`);
ok(t.spendManaFail === false, 'при нехватке маны — отказ');
ok(t.coinsAfter === 0, `монеты списаны: ${t.coinsAfter}`);
ok(t.spendCoinsFail === false, 'при нехватке монет — отказ');
ok(t.regen.st > 40 && t.regen.mp > 40, `регенерация: силы ${t.regen.st}, мана ${t.regen.mp}`);
ok(t.regenSprint.st <= t.regen.st, 'на бегу силы не восстанавливаются');
ok(t.afterReset.hp === 100 && t.afterReset.st === 100 && t.afterReset.mp === 100, 'сброс вернул всё к полному');

ok(out.hud.hpBar.includes('scaleX(0.5)'), `полоска жизни: ${out.hud.hpBar}`);
ok(out.hud.mpBar.includes('scaleX(0.4)'), `полоска маны: ${out.hud.mpBar}`);
ok(out.hud.hpNum === '50' && out.hud.mpNum === '40', `числа в HUD: жизнь ${out.hud.hpNum}, мана ${out.hud.mpNum}`);
ok(out.hud.coinsHud === out.hud.coinsInv && out.hud.coinsHud !== '', `монеты в HUD и инвентаре: ${out.hud.coinsHud}`);

ok(out.rig.meshes >= 6, `руки собраны: ${out.rig.meshes} мешей`);
ok(out.rig.visibleBefore === false && out.rig.itemBefore === false, 'без предмета рук нет');
ok(out.rig.visibleAfter === true && out.rig.itemAfter === true, 'предмет взяли — руки появились');
ok(out.rig.grip === 'two' && out.rig.bothVisible, 'захват «две руки» — обе видны');
ok(out.rig.gripRight === 'right' && out.rig.rightVisible && !out.rig.leftVisible, 'захват «правой» — только правая');
ok(out.rig.rightHidden === false && out.rig.leftShown === true, 'захват «левой» — только левая');
ok(out.rig.poseCarry === 'carry', 'поза переключается');
ok(out.rig.visibleEnd === false && out.rig.itemEnd === false, 'предмет убран — руки спрятались');

ok(out.sell.found === true && out.sell.where === 'tavern', 'в таверне есть «Продать рыбу»');
ok(out.sell.gained > 0, `продажа дала ${out.sell.gained} зол.`);
ok(out.sell.slotsAfter === out.sell.slotsBefore - 1, 'рыба ушла из сумки');
ok(out.sell.emptyOk === true, 'продажа при пустой сумке не ломается');

ok(out.catch.slotsAfter === out.catch.slotsBefore + 1, 'улов попал в инвентарь');
ok(out.catch.visible === true && out.catch.itemHeld.startsWith('fish:'), `рыба в руках: ${out.catch.itemHeld}`);
ok(out.catch.grip === 'two', `захват при улове: ${out.catch.grip}`);

ok(errs.length === 0, `ошибок в консоли: ${errs.length}`);
if (errs.length) errs.slice(0, 6).forEach((e) => L.push('   ' + e));

console.log(L.join('\n'));
const fails = L.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${L.length - fails}/${L.length} проверок пройдено`);
await browser.close();
process.exit(fails ? 1 : 0);
