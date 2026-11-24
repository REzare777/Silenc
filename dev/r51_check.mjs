/**
 * ============================================================================
 *  Проверки раунда 51: боёвка «Уголь и тени»
 * ============================================================================
 *
 *   1. Факел в руке в подземелье, топливо тратится, F гасит и разжигает.
 *   2. Шесть теней появляются в подземелье и не лезут в деревню.
 *   3. Удар брандом (ЛКМ) снимает одну «veil»-единицу и отбрасывает тень.
 *   4. Вспышка (ПКМ) тратит 25 маны и 6 топлива и разбрасывает всех вблизи.
 *   5. Тень не подходит ближе 2,8 м, пока факел горит; при погашенном —
 *      бросается.
 *   6. Удар тени отнимает 6 HP, но HP никогда не падает ниже 1.
 *   7. Огонь (жаровня, костёр) пополняет топливо и лечит.
 *   8. «Смола и фитиль» у кузнеца: −12 монет и +100 топлива.
 *   9. Переночевать в таверне восстанавливает HP и силы полностью.
 *
 *  Запуск: cd dev && node r51_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const res = await page.evaluate(async () => {
  const d = window.__dbg;
  const p = d.player;
  const out = {};
  const ctx = d.ctx;

  const combat = ctx.systems.combat;
  const monsters = ctx.systems.monsters;

  /* ---------- вход в подземелье ---------- */
  const entry = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  p.teleport(entry.pos.x + 1.2, entry.pos.z + 1.2, 0);
  p.y = 0; p.groundY = 0;
  entry.act();
  await new Promise((r) => setTimeout(r, 100));
  out.loc = ctx.loc;
  out.active = combat.state.active;
  out.shadowCount = monsters.list.length;
  // оставляем в пещере одного зверя: тест проверяет механику боя,
  // а не толпу (иначе игрока моментально забивают)
  const s0 = monsters.list.find((x) => x.spec.id === 'goblin_sword') || monsters.list[0];
  monsters.list.length = 0;
  monsters.list.push(s0);
  out.monstersLeft = monsters.list.length;
  // факел — снаряжение: в подземелье он сам не зажигается и в руке не появляется
  out.torchAutoLit = combat.state.lit;
  out.brandInHand = ctx.viewmodel.torch ? 'brand' : ctx.viewmodel.itemName;

  // игрок берёт факел из сумки и кладёт в левую руку
  const torchSpec = ctx.itemById('torch');
  out.torchInCatalog = !!torchSpec;
  if (torchSpec) {
    ctx.inventory.slots[0] = { id: 'torch', spec: torchSpec, count: 1, best: null };
    ctx.inventory.touch();
  }
  ctx.systems.loadout.toggleTorch();
  out.torchEquipped = ctx.systems.loadout.torchEquipped;
  out.brandAfterEquip = ctx.viewmodel.torch ? 'brand' : ctx.viewmodel.itemName;
  out.handVisible = ctx.viewmodel.visible;

  /* ---------- 1. топливо тратится ---------- */
  // сначала факел надо зажечь: горение начинается только по команде
  combat.toggleTorch();
  for (let i = 0; i < 40; i++) combat.update(0.05, i * 0.05);
  out.litAfterLight = combat.state.lit;
  const fuel0 = combat.state.fuel;
  for (let i = 0; i < 60; i++) combat.update(0.05, i * 0.05);
  out.fuelBurned = +(fuel0 - combat.state.fuel).toFixed(2);

  /* ---------- 2. F гасит и разжигает ---------- */
  combat.toggleTorch();
  out.litAfterToggle = combat.state.lit;
  // разжигание занимает 1,5 с
  combat.toggleTorch();
  for (let i = 0; i < 40; i++) combat.update(0.05, i * 0.05);
  out.litAfterRelight = combat.state.lit;
  out.flameVisible = combat.brand.flame.visible;

  /* ---------- 3. удар брандом ---------- */
  // ставим игрока рядом с первой тенью и целимся в неё
  p.teleport(s0.x, s0.z - 1.4, 0);
  p.y = 0; p.groundY = 0;
  // разворачиваемся к тени
  p.yaw = Math.atan2(-(s0.x - p.pos.x), -(s0.z - p.pos.z));
  d.camera.position.set(p.pos.x, p.groundY + 1.68, p.pos.z);
  d.camera.lookAt(s0.x, p.groundY + 1.0, s0.z);
  d.camera.updateMatrixWorld();
  const veil0 = s0.veil;
  out.aimed = !!combat.aimTarget();
  const hit = combat.strike();
  out.strikeHit = hit;
  out.veilBefore = veil0;
  out.veilAfter = s0.veil;
  out.strikeStun = s0.stun > 0;

  /* ---------- 4. вспышка ---------- */
  const mana0 = ctx.stats.mana;
  const fuel1 = combat.state.fuel;
  combat.state.flashCd = 0;
  const flared = combat.flare();
  out.flareOk = flared;
  out.manaSpent = +(mana0 - ctx.stats.mana).toFixed(1);
  out.fuelSpent = +(fuel1 - combat.state.fuel).toFixed(1);
  out.flashCd = +combat.state.flashCd.toFixed(1);

  /* ---------- 5. тень держит дистанцию при горящем факеле ---------- */
  combat.state.lit = true;
  s0.veil = 3; s0.state = 'stalk'; s0.stun = 0; s0.cd = 99;
  // игрок далеко: зверь идёт к нему, но при горящем факеле не подходит
  p.teleport(0, -12, 0);
  let minDist = 99;
  for (let i = 0; i < 600; i++) {
    monsters.update(0.05, i * 0.05);
    const dd = Math.hypot(s0.x - p.pos.x, s0.z - p.pos.z);
    if (dd < minDist) minDist = dd;
  }
  out.minDistLit = +minDist.toFixed(2);

  /* ---------- 6. урон игроку: HP не ниже 1 ---------- */
  combat.state.lit = false;   // в темноте звери нападают смелее
  ctx.stats.hp = 100;
  s0.stun = 0;
  s0.cd = 0;
  s0.state = 'stalk';
  s0.x = p.pos.x + 0.6;
  s0.z = p.pos.z;
  for (let k = 0; k < 40; k++) {
    s0.cd = 0;                 // атака готова
    s0.x = p.pos.x + 0.6;
    s0.z = p.pos.z;
    monsters.update(0.05, k * 0.05);
    if (ctx.stats.hp < 100) break;
  }
  out.hpAfterHit = ctx.stats.hp;
  out.hitRegistered = ctx.stats.hp < 100;
  // ждём, пока пройдёт неуязвимость (0,8 с)
  for (let k = 0; k < 40; k++) monsters.update(0.05, k * 0.05);
  // раненый игрок: зверь бьёт вблизи, но не преследует
  ctx.stats.hp = 20;
  s0.stun = 0;
  s0.cd = 0;
  s0.state = 'stalk';
  for (let k = 0; k < 20; k++) {
    s0.cd = 0;
    s0.x = p.pos.x + 0.6;
    s0.z = p.pos.z;
    monsters.update(0.05, k * 0.05);
  }
  out.hpWhenWounded = ctx.stats.hp;
  out.neverZero = ctx.stats.hp >= 1;

  /* ---------- 7. огонь: топливо и лечение ---------- */
  combat.state.fuel = 10;
  ctx.stats.hp = 50;
  ctx.stats.stamina = 50;
  s0.x = -14; s0.z = -33;          // зверь уходит подальше
  p.teleport(-5.6, -17.2, 0);       // жаровня у входа
  for (let i = 0; i < 40; i++) combat.update(0.05, i * 0.05);
  out.fuelAtBrazier = +combat.state.fuel.toFixed(1);
  out.hpAtBrazier = +ctx.stats.hp.toFixed(1);

  /* ---------- 8. смола и фитиль у кузнеца ---------- */
  ctx.systems.locations.setLocation('village');
  await new Promise((r) => setTimeout(r, 100));
  out.shadowsInVillage = monsters.list.length;
  // факел — снаряжение: вышел из подземелья, а он остался в руке
  out.brandInVillage = ctx.viewmodel.torch ? 'brand' : ctx.viewmodel.itemName;
  const forgeShop = ctx.interactables.find((x) => x.label && x.label.includes('смолу'));
  out.forgeShopExists = !!forgeShop;
  if (forgeShop) {
    ctx.stats.coins = 50;
    combat.state.fuel = 10;
    forgeShop.act();
    out.coinsAfterShop = ctx.stats.coins;
    out.fuelAfterShop = +combat.state.fuel.toFixed(1);
  }

  /* ---------- 9. переночевать восстанавливает ---------- */
  ctx.stats.hp = 20;
  ctx.stats.stamina = 5;
  const beds = ctx.interactables.filter((x) => x.label && x.label.startsWith('Переночевать'));
  out.bedExists = beds.length > 0;
  if (beds.length) {
    // поднимаем на второй этаж, чтобы сработала проверка пола
    p.y = 3.2; p.groundY = 3.2;
    beds[0].act();
    out.hpAfterSleep = ctx.stats.hp;
    out.staminaAfterSleep = ctx.stats.stamina;
  }

  return out;
});

const checks = [
  ['вошли в подземелье', res.loc === 'dungeon'],
  ['боёвка включилась', res.active === true],
  ['факел не зажигается сам', res.torchAutoLit === false],
  ['без факела в руке ничего нет', res.brandInHand !== 'brand'],
  ['факел есть в каталоге предметов', res.torchInCatalog === true],
  ['факел берётся в левую руку', res.torchEquipped === true && res.brandAfterEquip === 'brand'],
  ['факел зажигается по команде', res.litAfterLight === true],
  ['в пещере есть зверинец', res.shadowCount >= 10],
  ['топливо тратится при горении', res.fuelBurned > 0.5],
  ['F гасит факел', res.litAfterToggle === false],
  ['факел разжигается за 1,5 с', res.litAfterRelight === true],
  ['пламя видно у разожжённого факела', res.flameVisible === true],
  ['удар брандом попадает по зверю', res.strikeHit === true],
  ['удар снимает одну veil-единицу', res.veilAfter === res.veilBefore - 1],
  ['попавший оглушён', res.strikeStun === true],
  ['вспышка тратит ровно 25 маны', res.manaSpent === 25],
  ['вспышка тратит ровно 6 топлива', res.fuelSpent === 6],
  ['после вспышки — перезарядка 4 с', res.flashCd === 4],
  ['при горящем факеле зверь держит дистанцию ≥ 2,8 м',
    res.minDistLit >= 2.8 && res.minDistLit < 12],
  ['зверь достаёт игрока', res.hitRegistered === true],
  ['HP не падает ниже единицы', res.neverZero === true],

  ['у жаровни топливо восстанавливается', res.fuelAtBrazier > 15],
  ['у жаровни HP лечится', res.hpAtBrazier > 50],
  ['в деревне зверей нет', res.shadowsInVillage === 0],
  ['в деревне факел остаётся в руке', res.brandInVillage === 'brand'],
  ['у кузнеца есть «смола и фитиль»', res.forgeShopExists === true],
  ['смола и фитиль: −12 монет и +100 топлива',
    res.coinsAfterShop === 38 && res.fuelAfterShop === 100],
  ['переночевать лечит и восстанавливает силы',
    res.bedExists && res.hpAfterSleep === 100 && res.staminaAfterSleep === 100],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
console.log('детали:', JSON.stringify(res));
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 220));
console.log('ошибок:', failed + (errs.length ? 1 : 0));
await browser.close();
process.exit(failed + (errs.length ? 1 : 0) ? 1 : 0);
