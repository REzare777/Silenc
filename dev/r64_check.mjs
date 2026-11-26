/**
 * ============================================================================
 *  Раунд 64 — проверка боёвки, лута и печатей подземелья
 * ============================================================================
 *
 *  Что проверяем:
 *   1) удар достаёт several зверей сразу (мультихит по конусу);
 *   2) бывает критический удар — вдвое больший урон;
 *   3) броня зверя гасит часть урона;
 *   4) удар оружием стоит силы, а цифра урона появляется над зверем;
 *   5) лут расширен: новые предметы есть, цены у всех разные;
 *   6) печати: барьер держит игрока, а после зачистки зала — падает;
 *   7) босс запечатан, пока жива стража у Врат.
 *
 *  Запуск: cd /workspace/village && node dev/r64_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
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

await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2000);

/* ---------------- 1-3. мультихит, крит, броня ---------------- */
const hits = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const THREE = d.THREE;

  /**
   * Отобрать ровно три зверя и убрать всех прочих подальше.
   *
   * Раньше тест брал «первых трёх гоблинов» — но гоблинов могло
   * выпасть меньше трёх, и проверка падала случайно.
   */
  const setup = () => {
    const list = m.list.filter((x) => x.hp > 0 && x.dying <= 0).slice(0, 3);
    for (const x of m.list) {
      if (list.includes(x)) continue;
      x.x = 120; x.z = 120; x.hp = x.maxHp; x.state = 'sleep';
      x.stun = 0; x.vx = 0; x.vz = 0;
    }
    list.forEach((g, i) => {
      g.x = -1.2 + i * 1.2;
      g.z = -21.5;
      g.y = 0;
      g.hp = g.maxHp;
      g.state = 'sleep';
      g.stun = 0;
      g.vx = 0; g.vz = 0;
    });
    d.player.pos.set(0, 0, -24);
    d.player.groundY = 0;
    return list;
  };

  // луч идёт от игрока на север (в +z), звери стоят в 2,5 м впереди
  const org = new THREE.Vector3(0, 1.5, -24);
  const dir = new THREE.Vector3(0, 0, 1);

  // удар по одному
  setup();
  const one = m.hit(org, dir, 3.5, 0.6, 20, { count: 1 });
  const oneDamaged = one.hits.length;

  // удар по площади
  const g = setup();
  const many = m.hit(org, dir, 3.5, 0.6, 20, { count: 3 });
  const manyDamaged = g.filter((x) => x.hp < x.maxHp).length;

  // крит: удвоенный урон
  setup();
  const crit = m.hit(org, dir, 3.5, 0.6, 20, { count: 1, crit: 1 });
  const critAmount = crit.hits[0] ? crit.hits[0].amount : 0;

  // обычный удар той же силы
  setup();
  const plain = m.hit(org, dir, 3.5, 0.6, 20, { count: 1, crit: 0 });
  const plainAmount = plain.hits[0] ? plain.hits[0].amount : 0;

  // броня: голем получает меньше, чем гоблин
  const golem = m.list.find((x) => x.spec.id === 'golem_small');
  let golemAmount = 0;
  if (golem) {
    for (const x of m.list) {
      if (x === golem) continue;
      x.x = 120; x.z = 120; x.hp = x.maxHp; x.state = 'sleep';
    }
    golem.x = 0; golem.z = -21.5; golem.y = 0; golem.hp = golem.maxHp; golem.state = 'sleep';
    const r = m.hit(org, dir, 3.5, 0.6, 40, { count: 1 });
    golemAmount = r.hits[0] ? r.hits[0].amount : 0;
  }
  // столько же получает обычный гоблин
  setup();
  const gRes = m.hit(org, dir, 3.5, 0.6, 40, { count: 1 });
  const goblinAmount = gRes.hits[0] ? gRes.hits[0].amount : 0;

  return {
    oneDamaged, manyDamaged, critAmount, plainAmount,
    golemAmount, goblinAmount,
    hitsLen: many.hits.length,
  };
});
console.log('  удары:', JSON.stringify(hits));
check('удар достаёт одного зверя', hits.oneDamaged === 1, `задетых ${hits.oneDamaged}`);
check('удар по площади достаёт троих', hits.manyDamaged === 3, `задетых ${hits.manyDamaged}`);
check('в ответе есть список попаданий', hits.hitsLen === 3, `попаданий ${hits.hitsLen}`);
check('критический урон вдвое больше', hits.critAmount === hits.plainAmount * 2,
  `${hits.critAmount} против ${hits.plainAmount}`);
check('броня голема гасит урон', hits.golemAmount < hits.goblinAmount,
  `голем ${hits.golemAmount}, гоблин ${hits.goblinAmount}`);

/* ---------------- 4. силы, цифры урона, тряска ---------------- */
const feel = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const combat = d.ctx.systems.combat;
  const out = {};

  // вооружаемся двуручным мечом: кладём его в первую ячейку пояса
  const gs = d.ctx.systems.loadout;
  const spec = d.items.ITEMS.get('greatsword');
  out.hasGreatsword = !!spec;
  if (spec) {
    d.inventory.slots[27] = { id: spec.id, spec, count: 1, best: null };
    d.inventory.sel = 0;
    if (gs && gs.sync) gs.sync();
  }
  const g = m.list.find((x) => x.hp > 0 && x.dying <= 0);
  if (!g) return { err: 'нет живых зверей' };
  g.x = 0; g.z = -20.4; g.y = 0; g.hp = g.maxHp; g.state = 'sleep'; g.stun = 0;
  g.dying = 0; g.dyingT = 0; g.vx = 0; g.vz = 0;
  d.player.pos.set(0, 0, -21.8);
  d.player.groundY = 0;
  d.player.yaw = Math.PI;          // игрок смотрит на север, в +z
  d.player.pitch = 0;
  d.camera.position.set(0, 1.68, -21.8);
  d.camera.rotation.set(0, Math.PI, 0);
  d.camera.updateMatrixWorld();
  d.stats.stamina = 100;
  d.player.shake = 0;
  document.querySelectorAll('.dmgNum').forEach((n) => n.remove());

  combat.weaponStrike();

  out.stamina = Math.round(d.stats.stamina);
  out.shake = +(d.player.shake || 0).toFixed(3);
  out.dmgNums = document.querySelectorAll('.dmgNum').length;
  out.goblinHp = g.hp;
  out.goblinMax = g.maxHp;
  return out;
});
console.log('  ощущение удара:', JSON.stringify(feel));
check('удар тратит силы', feel.stamina < 100 && feel.stamina >= 80, `силы ${feel.stamina}`);
check('удар отбрасывает и оглушает зверя', feel.goblinHp < feel.goblinMax);
check('над зверем появляется цифра урона', feel.dmgNums > 0, `цифр ${feel.dmgNums}`);
check('камера дёргается от удара', feel.shake > 0, `тряска ${feel.shake}`);

/* ---------------- 5. лут ---------------- */
const loot = await page.evaluate(() => {
  const d = window.__dbg;
  const items = d.items;
  const out = { ids: [], missing: [], sells: [] };
  const registry = items.ITEMS;
  for (const id of ['cave_rat_tail', 'moss_lump', 'glow_cap', 'bat_wing',
    'spore_powder', 'obsidian_shard']) {
    out.ids.push({ id, exists: !!registry.get(id) });
  }
  let lootCount = 0;
  for (const [, s] of registry) {
    if (s.kind !== 'loot') continue;
    lootCount++;
    out.sells.push(s.sell);
  }
  out.lootCount = lootCount;
  out.uniqueSells = new Set(out.sells).size;
  return out;
});
console.log('  лут:', JSON.stringify(loot));
check('новые предметы лута есть в реестре',
  loot.ids.every((x) => x.exists), JSON.stringify(loot.ids));
check('предметов лута стало больше (было 12)', loot.lootCount >= 18, `сейчас ${loot.lootCount}`);
check('цены продажи у лута разные', loot.uniqueSells === loot.lootCount,
  `${loot.uniqueSells}/${loot.lootCount}`);

/* ---------------- 6-7. печати и запечатанный босс ---------------- */
const seals = await page.evaluate(() => {
  const d = window.__dbg;
  const loc = d.dungeonLoc;
  const m = d.monsters;
  const p = d.player;
  const out = {};

  out.ids = loc.seals.map((s) => s.id);
  out.closedAtStart = loc.seals.every((s) => !s.open);
  out.hallBarriers = loc.colliders.boxes.filter((b) => b.seal === 'hall').length;
  out.crystalBarriers = loc.colliders.boxes.filter((b) => b.seal === 'crystal').length;
  // подсказка в интерфейсе: какая печать держит путь
  const sealText = () => {
    const n = document.getElementById('sealText');
    const b = document.getElementById('sealBar');
    return { text: n ? n.textContent : '', on: b ? b.classList.contains('on') : false };
  };
  // обновляем прогрессию вручную: в headless-браузере кадр рендера идёт
  // десятки секунд, и игровой цикл мог просто не успеть ни разу пройти
  d.progression.update(0.016);
  out.hud = sealText();

  // барьер держит игрока: идём к печати и упираемся в неё
  const walk = (yaw, frames) => {
    p.yaw = yaw;
    p.keys.add('KeyW');
    for (let i = 0; i < frames; i++) p.update(1 / 60);
    p.keys.delete('KeyW');
  };
  p.teleport(0, -22.5, Math.PI);
  p.y = 0; p.groundY = 0;
  walk(Math.PI, 90);
  out.blockedZ = +p.pos.z.toFixed(2);

  // зачищаем входной зал — печать входа падает
  for (const g of m.list) {
    if (g.zone !== 'hall') continue;
    g.hp = 0; g.dying = 0.75; g.state = 'dead';
  }
  d.progression.update(0.016);
  out.hallOpen = loc.seals.find((s) => s.id === 'hall').open;
  out.hallBarriersAfter = loc.colliders.boxes.filter((b) => b.seal === 'hall').length;
  out.hudAfter = sealText();

  // теперь проём открыт — тот же путь проходит
  p.teleport(0, -22.5, Math.PI);
  p.y = 0; p.groundY = 0;
  walk(Math.PI, 120);
  out.passedZ = +p.pos.z.toFixed(2);

  // печать шахты всё ещё закрыта: кристальный зал не зачищен
  out.crystalClosed = !loc.seals.find((s) => s.id === 'crystal').open;

  // босс запечатан, пока жива стража
  out.bossLocked = !!m.bossLocked;
  for (const g of m.list) {
    if (g.zone !== 'gateElite') continue;
    g.hp = 0; g.dying = 0.75; g.state = 'dead';
  }
  d.progression.update(0.016);
  out.gateOpen = loc.seals.find((s) => s.id === 'gate').open;
  out.bossUnlocked = !m.bossLocked;
  return out;
});
console.log('  печати:', JSON.stringify(seals));
check('печатей три: вход, шахта, врата',
  seals.ids.length === 3 && seals.ids.includes('hall')
  && seals.ids.includes('crystal') && seals.ids.includes('gate'),
  JSON.stringify(seals.ids));
check('изначально все печати закрыты', seals.closedAtStart);
check('в проёмах есть барьеры', seals.hallBarriers === 3 && seals.crystalBarriers === 1,
  `вход ${seals.hallBarriers}, шахта ${seals.crystalBarriers}`);
check('печать входа держит игрока', seals.blockedZ > -21 && seals.blockedZ < -19.5,
  `z=${seals.blockedZ}`);
check('зачистил зал — печать входа пала', seals.hallOpen);
check('барьер печати убран из коллайдеров', seals.hallBarriersAfter === 0,
  `осталось ${seals.hallBarriersAfter}`);
check('через открытую печать можно пройти', seals.passedZ > -20.5,
  `z=${seals.passedZ}`);
check('печать шахты закрыта, пока зал не зачищен', seals.crystalClosed);
check('в интерфейсе видно, что держит печать', seals.hud.on && seals.hud.text.includes('Печать входа'),
  JSON.stringify(seals.hud));
check('после зачистки подсказка меняется на следующую печать',
  seals.hudAfter.text.includes('Печать шахты'), JSON.stringify(seals.hudAfter));
check('босс запечатан, пока жива стража', seals.bossLocked);
check('стража пала — печать Врат разбита', seals.gateOpen);
check('после падения печати босс просыпается', seals.bossUnlocked);

/* ---------------- 8. ошибки в консоли ---------------- */
check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log('\nРаунд 64 — бой, лут и печати подземелья');
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
