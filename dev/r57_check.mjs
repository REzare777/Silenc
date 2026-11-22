/**
 * ============================================================================
 *  Раунд 57: факел как снаряжение, заклинания, сохранения, дом с дороги
 * ============================================================================
 *
 *  Что проверяем:
 *   1. В каталоге есть факел и три заклинания (иконки, описания, цены).
 *   2. Торговля: Хорт продаёт заклинания, Торн — факел; купленное сразу
 *      попадает на пояс.
 *   3. Пояс: цифра с оружием — оружие в правой руке; цифра со свитком —
 *      колдовство (списывается мана, рука с оружием остаётся); цифра с
 *      факелом — факел в левой руке.
 *   4. Факел — снаряжение, а не часть подземелья: вход в подземелье не
 *      зажигает его сам и не кладёт в руку.
 *   5. Сохранения: автосейв при смене локации и при смене времени суток;
 *      сохранение восстанавливает оружие, факел и топливо.
 *   6. Меню паузы: есть «Загрузить игру…», и она открывает список слотов.
 *   7. Дом на отшибе больше не стоит на дороге к скале.
 *
 *  Запуск: cd dev && node r57_check.mjs
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
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = {};
const info = {};

/* ---------------- 1–2. каталог и торговля ---------------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };

  const items = d.items;
  const torch = items.getItem('torch');
  ok('torchInCatalog', !!torch);
  ok('torchIsGear', !!torch && torch.kind === 'gear');
  ok('torchIcon', !!torch && !!items.itemIcon(torch, 64));
  ok('torchDesc', !!torch && items.itemDesc(torch, null).rows.length > 0);
  ok('torchTip', !!torch && !!torch.tip);

  const spellIds = ['spell_flash', 'spell_heal', 'spell_light'];
  out.spellCount = spellIds.filter((id) => {
    const s = items.getItem(id);
    return s && s.kind === 'spell' && !!items.itemIcon(s, 64) && items.itemDesc(s, null).rows.length > 0;
  }).length;
  ok('spellsInCatalog', out.spellCount === 3, out.spellCount);
  ok('spellsHaveMana', spellIds.every((id) => (items.getItem(id) || {}).mana > 0));
  ok('spellsHaveSpell', spellIds.every((id) => !!(items.getItem(id) || {}).spell));

  // Хорт продаёт заклинания, Торн — факел
  const trade = d.trade;
  d.ctx.stats.coins = 500;
  trade.open('barkeep');
  const barkeepIds = [...document.querySelectorAll('#tradeGoods .tradeRow')].map((r) => r.dataset.id || '');
  ok('barkeepSellsSpells', spellIds.every((id) => barkeepIds.includes(id)), barkeepIds.join(','));
  trade.close();

  trade.open('blacksmith');
  const smithIds = [...document.querySelectorAll('#tradeGoods .tradeRow')].map((r) => r.dataset.id || '');
  ok('smithSellsTorch', smithIds.includes('torch'), smithIds.join(','));
  trade.close();

  // покупка: заклинание и факел сразу на пояс
  const inv = d.inventory;
  inv.slots.fill(null);
  trade.open('barkeep');
  const boughtSpell = trade.buy('spell_flash');
  trade.close();
  const spellSlot = inv.slots.findIndex((s) => s && s.id === 'spell_flash');
  ok('boughtSpell', boughtSpell && spellSlot >= 27, spellSlot);

  trade.open('blacksmith');
  const boughtTorch = trade.buy('torch');
  trade.close();
  const torchSlot = inv.slots.findIndex((s) => s && s.id === 'torch');
  ok('boughtTorch', boughtTorch && torchSlot >= 27, torchSlot);

  Object.assign(window.__info || (window.__info = {}), out);
});
Object.assign(res, await page.evaluate(() => window.__info || {}));

/* ---------------- 3–4. пояс, факел, подземелье ---------------- */
await page.evaluate(async () => {
  const d = window.__dbg;
  const out = {};
  const info = window.__info || (window.__info = {});
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };
  const inv = d.inventory;
  const loadout = d.loadout;
  const combat = d.combat;

  // оружие в правой руке
  const swordSpec = d.items.getItem('shortsword');
  const spellSpec = d.items.getItem('spell_flash');
  const torchSpec = d.items.getItem('torch');
  inv.slots.fill(null);
  inv.slots[27] = { id: 'shortsword', spec: swordSpec, count: 1, best: null };
  inv.slots[28] = { id: 'spell_flash', spec: spellSpec, count: 1, best: null };
  inv.slots[29] = { id: 'torch', spec: torchSpec, count: 1, best: null };
  inv.sel = 0;
  loadout.sync();
  ok('weaponInRightHand', !!d.viewmodel.weapon && loadout.currentWeapon().id === 'shortsword');

  // свиток колдуется по нажатию цифры, оружие остаётся в руке
  const manaBefore = d.ctx.stats.mana;
  loadout.select(1);   // свиток во втором слоте пояса
  out.manaSpent = +(manaBefore - d.ctx.stats.mana).toFixed(1);
  ok('spellCasts', out.manaSpent === 25, out.manaSpent);
  ok('spellKeepsWeapon', !!d.viewmodel.weapon && loadout.currentWeapon().id === 'shortsword');
  ok('spellCooldown', d.spells.cooldownLeft('flash') > 0);

  // факел: цифра его слота — взять/убрать из левой руки
  loadout.select(2);   // факел в третьем слоте пояса
  ok('torchEquipped', loadout.torchEquipped === true);
  ok('brandInLeftHand', !!d.viewmodel.torch);
  // второй раз — убрать
  loadout.select(2);
  ok('torchRemoved', loadout.torchEquipped === false && !d.viewmodel.torch);
  // и снова взять
  loadout.toggleTorch();
  ok('torchBackInHand', loadout.torchEquipped === true);

  // в подземелье факел не зажигается сам
  d.setLocation('dungeon');
  out.litOnEnter = combat.state.lit;
  ok('torchNotAutoLit', combat.state.lit === false);
  // но зажечь его можно
  const msg = combat.toggleTorch();
  for (let i = 0; i < 40; i++) combat.update(0.05, i * 0.05);
  ok('torchLightsOnCommand', combat.state.lit === true, msg);
  ok('flameVisible', combat.brand.flame.visible === true);
  // без факела в руке — удара брандом нет
  combat.setTorchEquipped(false);
  out.strikeWithoutTorch = combat.strike();
  ok('noBrandStrikeWithoutTorch', out.strikeWithoutTorch === false);
  combat.setTorchEquipped(true);

  d.setLocation('village');
  Object.assign(info, out);
});
Object.assign(res, await page.evaluate(() => window.__info || {}));

/* ---------------- 5–6. сохранения и меню ---------------- */
await page.evaluate(async () => {
  const d = window.__dbg;
  const out = {};
  const info = window.__info || (window.__info = {});
  const ok = (name, cond, extra) => { out[name] = cond ? true : (extra === undefined ? false : extra); };
  const inv = d.inventory;

  // автосейв при смене локации
  d.ctx.stats.coins = 123;
  const before = JSON.parse(localStorage.getItem('wv.save.v1') || 'null');
  const atBefore = before ? before.at : 0;
  await new Promise((r) => setTimeout(r, 150));
  d.setLocation('barn');
  await new Promise((r) => setTimeout(r, 250));
  const afterLoc = JSON.parse(localStorage.getItem('wv.save.v1') || 'null');
  out.autosaveOnLocation = !!(afterLoc && afterLoc.at > atBefore);
  out.autosaveCoins = afterLoc ? afterLoc.coins : 0;
  ok('autosaveOnLocation', out.autosaveOnLocation === true);
  d.setLocation('village');
  await new Promise((r) => setTimeout(r, 250));

  // автосейв при смене времени суток: проверка идёт в игровом цикле,
  // поэтому ждём реального кадра (в софт-рендере он идёт десятки секунд)
  const at2 = (JSON.parse(localStorage.getItem('wv.save.v1') || '{}')).at || 0;
  const frame0 = window.__frames || 0;
  d.ctx.env.setTimeOfDay('dusk', true);
  const deadline = Date.now() + 180000;
  while ((window.__frames || 0) <= frame0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
  }
  const afterTod = JSON.parse(localStorage.getItem('wv.save.v1') || '{}');
  out.autosaveOnTime = (afterTod.at || 0) > at2;
  ok('autosaveOnTime', out.autosaveOnTime === true);

  // сохранение восстанавливает оружие и факел
  d.ctx.stats.coins = 77;
  d.combat.state.fuel = 42;
  d.loadout.toggleTorch();     // факел в руке
  d.saveGame(true);
  // ломаем состояние
  d.ctx.stats.coins = 0;
  inv.slots.fill(null);
  d.combat.state.fuel = 0;
  d.loadout.setTorchEquipped(false);
  d.loadGame();
  out.coinsRestored = d.ctx.stats.coins;
  ok('coinsRestored', d.ctx.stats.coins === 77, d.ctx.stats.coins);
  const weaponBack = inv.slots.find((s) => s && s.id === 'shortsword');
  ok('weaponRestored', !!weaponBack);
  ok('torchFuelRestored', d.combat.state.fuel === 42, d.combat.state.fuel);

  // меню паузы: «Загрузить игру…»
  const btn = document.getElementById('loadInMenu');
  ok('loadButtonExists', !!btn);
  if (btn) {
    btn.click();
    await new Promise((r) => setTimeout(r, 200));
    const slots = document.getElementById('slots');
    ok('slotsWindowOpens', !!slots && slots.classList.contains('on'));
    const rows = document.querySelectorAll('#slotsList .slotRow').length;
    out.slotRows = rows;
    ok('slotRowsListed', rows >= 4, rows);
    if (slots) slots.classList.remove('on');
  }
  Object.assign(info, out);
});
Object.assign(res, await page.evaluate(() => window.__info || {}));

/* ---------------- 7. дом с дороги ---------------- */
const house = await page.evaluate(() => {
  const d = window.__dbg;
  const h = (d.ctx.homes || []).find((x) => x.i === 10);
  if (!h) return null;
  const TRAIL = [
    [-2.5, -14], [-5, -21], [-12, -28], [-20, -33], [-28, -38],
    [-36, -41], [-44, -46], [-51, -52], [-56, -58], [-62, -60], [-67, -63],
  ];
  let best = Infinity;
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const [ax, az] = TRAIL[i];
    const [bx, bz] = TRAIL[i + 1];
    const dx = bx - ax, dz = bz - az;
    const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((h.x - ax) * dx + (h.z - az) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(h.x - (ax + dx * t), h.z - (az + dz * t)));
  }
  return { x: h.x, z: h.z, dist: +best.toFixed(2) };
});
res.houseOffTrail = !!house && house.dist >= 6;
info.house10 = house;

console.log('--- детали ---');
for (const [k, v] of Object.entries(info)) console.log(`  ${k}: ${JSON.stringify(v)}`);

const checks = [
  ['факел есть в каталоге', res.torchInCatalog === true],
  ['факел — снаряжение', res.torchIsGear === true],
  ['у факела есть иконка', res.torchIcon === true],
  ['у факела есть описание', res.torchDesc === true],
  ['три заклинания в каталоге', res.spellsInCatalog === true],
  ['у заклинаний есть мана', res.spellsHaveMana === true],
  ['Хорт продаёт заклинания', res.barkeepSellsSpells === true],
  ['Торн продаёт факел', res.smithSellsTorch === true],
  ['купленный свиток на поясе', res.boughtSpell === true],
  ['купленный факел на поясе', res.boughtTorch === true],
  ['оружие в правой руке', res.weaponInRightHand === true],
  ['свиток колдуется по цифре', res.spellCasts === true],
  ['колдовство не убирает оружие', res.spellKeepsWeapon === true],
  ['у заклинания есть откат', res.spellCooldown === true],
  ['факел берётся в левую руку', res.torchEquipped === true],
  ['бранд виден в левой руке', res.brandInLeftHand === true],
  ['факел снимается и возвращается', res.torchRemoved === true && res.torchBackInHand === true],
  ['в подземелье факел не зажигается сам', res.torchNotAutoLit === true],
  ['факел зажигается по команде', res.torchLightsOnCommand === true],
  ['пламя видно', res.flameVisible === true],
  ['без факела удара брандом нет', res.noBrandStrikeWithoutTorch === true],
  ['автосейв при входе в локацию', res.autosaveOnLocation === true],
  ['автосейв при смене времени суток', res.autosaveOnTime === true],
  ['монеты восстанавливаются из сохранения', res.coinsRestored === true],
  ['оружие восстанавливается из сохранения', res.weaponRestored === true],
  ['топливо факела восстанавливается', res.torchFuelRestored === true],
  ['в меню есть кнопка загрузки', res.loadButtonExists === true],
  ['окно слотов открывается из меню', res.slotsWindowOpens === true],
  ['слоты показаны списком', res.slotRowsListed === true],
  ['дом убран с дороги к скале', res.houseOffTrail === true],
];

let failed = 0;
for (const [name, okFlag] of checks) {
  console.log(`${okFlag ? '✓' : '✗'} ${name}`);
  if (!okFlag) failed++;
}
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 220));
console.log(`r57_check: ${checks.length - failed} ok, ${failed} fail`);
await browser.close();
process.exit(failed + (errs.length ? 1 : 0) ? 1 : 0);
