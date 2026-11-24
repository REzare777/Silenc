/**
 * ============================================================================
 *  Раунд 61 — тест-агент: босс и сложность
 * ============================================================================
 *
 *  Проверяю:
 *   1) полоска здоровья босса (#bossBar) сверху экрана, с именем и заполнением;
 *   2) полоска появляется при живом боссе и исчезает после его смерти;
 *   3) это отдельная полоса, а не полоса игрока;
 *   4) босс реально применяет все четыре атаки: swing, slam, roar, charge;
 *   5) у каждой атаки есть свой эффект (урон / ударная волна / призыв / наскок);
 *   6) босс наносит урон;
 *   7) переключатель «Сложность» в настройках сохраняется в localStorage;
 *   8) сложность меняет HP / урон / количество монстров;
 *   9) смена сложности прямо в пещере пересобирает монстров.
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_boss.mjs
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

/* ================= 1. полоска босса ================= */
const bar = await page.evaluate(() => {
  const d = window.__dbg;
  const bb = document.getElementById('bossBar');
  const bn = document.getElementById('bossName');
  const bf = document.getElementById('bossFill');
  const php = document.getElementById('barHp');
  const r = (el) => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom) }; };
  const boss = d.monsters.getBoss();
  return {
    on: bb.classList.contains('on'),
    display: getComputedStyle(bb).display,
    name: bn.textContent,
    fill: bf.style.transform,
    fillRect: r(bf),
    barRect: r(bb),
    compassRect: r(document.getElementById('compass')),
    brandRect: r(document.getElementById('brand')),
    timeRect: r(document.getElementById('timebar')),
    vitalsRect: r(document.getElementById('vitals')),
    toastRect: r(document.getElementById('toast')),
    playerBarRect: r(php),
    sameNode: bf === php,
    bossInside: bb.contains(bf),
    playerBarInsideVitals: document.getElementById('vitals').contains(php),
    bossAlive: !!boss,
    bossHp: boss ? boss.hp : 0,
    bossMax: boss ? boss.maxHp : 0,
    vw: innerWidth, vh: innerHeight,
  };
});
check('полоска босса показана (класс on)', bar.on === true, `display: ${bar.display}`);
check('полоска босса сверху экрана', bar.barRect.y >= 0 && bar.barRect.y < 60,
  `rect: x=${bar.barRect.x} y=${bar.barRect.y} w=${bar.barRect.w} h=${bar.barRect.h}`);
check('в полоске — имя босса', /гримм/i.test(bar.name), `"${bar.name}"`);
check('заполнение полоски — transform scaleX', /scaleX\(/.test(bar.fill), `"${bar.fill}"`);
check('у босса своя полоска, а не полоса игрока',
  bar.sameNode === false && bar.bossInside === true && bar.playerBarInsideVitals === true,
  `#bossFill и #barHp — разные элементы; #barHp лежит в #vitals (y=${bar.playerBarRect.y})`);

/* --- перекрытие интерфейса --- */
const overlapBoss = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const overlaps = [];
if (overlapBoss(bar.barRect, bar.compassRect)) overlaps.push(`компас (${bar.compassRect.x},${bar.compassRect.y},${bar.compassRect.w}×${bar.compassRect.h})`);
if (overlapBoss(bar.barRect, bar.brandRect)) overlaps.push(`логотип (${bar.brandRect.x},${bar.brandRect.y})`);
if (overlapBoss(bar.barRect, bar.timeRect)) overlaps.push(`время (${bar.timeRect.x},${bar.timeRect.y})`);
if (overlapBoss(bar.barRect, bar.toastRect)) overlaps.push(`подсказка-тост (${bar.toastRect.x},${bar.toastRect.y})`);
if (overlapBoss(bar.barRect, bar.vitalsRect)) overlaps.push(`жизнь/силы (${bar.vitalsRect.x},${bar.vitalsRect.y})`);
check('полоска босса не перекрывает другие элементы интерфейса', overlaps.length === 0,
  overlaps.length ? `перекрывает: ${overlaps.join('; ')}` : 'нет перекрытий');

/* ================= 2. полоска реагирует на урон и исчезает после смерти ================= */
const barLife = await page.evaluate(() => {
  const d = window.__dbg;
  const bf = document.getElementById('bossFill');
  const bb = document.getElementById('bossBar');
  const b = d.monsters.getBoss();
  if (!b) return { err: 'нет босса' };
  const scaleOf = () => {
    const mm = /scaleX\(([-0-9.]+)\)/.exec(bf.style.transform || '');
    return mm ? parseFloat(mm[1]) : 1;
  };
  const before = scaleOf();
  b.hp = Math.round(b.maxHp * 0.5);
  d.monsters.update(1 / 30, 999);
  const mid = scaleOf();
  // убиваем босса
  b.hp = 1;
  const org = new d.THREE.Vector3(b.x, b.y + 1.2, b.z + 2);
  d.monsters.hit(org, new d.THREE.Vector3(0, 0, -1), 3, 0.8, 999);
  d.monsters.update(1 / 30, 1000);
  const after = scaleOf();
  const onAfter = bb.classList.contains('on');
  // ещё немного времени — полоска не должна вернуться
  for (let i = 0; i < 60; i++) d.monsters.update(1 / 30, 1000 + i / 30);
  return { before, mid, after, onAfter, onLater: bb.classList.contains('on'), hp: b.hp, dying: b.dying };
});
check('полоска босса показывает долю здоровья', barLife.mid < barLife.before && barLife.mid > 0.4 && barLife.mid < 0.6,
  `scaleX: ${barLife.before} → ${barLife.mid} при 50 % HP`);
check('после смерти босса полоска исчезает', barLife.onAfter === false && barLife.onLater === false,
  `класс on сразу после смерти: ${barLife.onAfter}, через 2 с: ${barLife.onLater}`);

/* ================= 3. четыре атаки босса ================= */
/* Случайная сессия: какие атаки вообще встречаются */
const seen = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss() || m.list.find((s) => s.spec.id === 'orc_boss');
  if (!b) return { err: 'нет босса' };
  const names = new Set();
  const dists = [4, 8.5, 4, 8.5, 3, 8.5];
  for (let i = 0; i < 1200; i++) {
    b.hp = b.maxHp; b.cd = 0; b.stun = 0; b.state = 'stalk'; b.dying = 0;
    const dd = dists[i % dists.length];
    const ang = i * 0.7;
    d.player.pos.set(b.x + Math.cos(ang) * dd, b.y, b.z + Math.sin(ang) * dd);
    d.player.groundY = b.y;
    d.stats.hp = 100;
    m.update(1 / 30, 2000 + i / 30);
    if (b.attackName) names.add(b.attackName);
  }
  return { names: [...names] };
});
check('в игре встречаются все четыре атаки босса',
  ['swing', 'slam', 'roar', 'charge'].every((n) => seen.names?.includes(n)),
  `встречены: ${(seen.names || []).join(', ')}`);

/* ================= 4. у каждой атаки есть свой эффект ================= */
const effects = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const out = {};

  /**
   * Прогнать одну атаку босса с подменённым Math.random.
   *
   * @param {number} roll значение Math.random
   * @param {number} dist дистанция до игрока
   * @returns {object} что произошло
   */
  const force = (roll, dist) => {
    const b = m.getBoss() || m.list.find((s) => s.spec.id === 'orc_boss');
    if (!b) return { err: 'нет босса' };
    // остальных зверей убираем, чтобы они не мешали
    const saved = m.list.map((o) => ({ o, x: o.x, z: o.z, y: o.y, st: o.state }));
    for (const o of m.list) {
      if (o === b) continue;
      o.x = -13.5; o.z = -32.5; o.y = 0; o.state = 'sleep'; o.group.position.set(o.x, o.y, o.z);
    }
    const root = d.sceneDungeon.children.find((c) => c.name === 'monsters');
    const kidsBefore = root ? root.children.length : 0;
    const monstersBefore = m.list.length;
    const d0 = Math.hypot(b.x - d.player.pos.x, b.z - d.player.pos.z);
    b.hp = b.maxHp; b.veil = 6; b.dying = 0; b.stun = 0; b.cd = 0;
    b.state = 'stalk';
    b.x = 0; b.z = 28; b.y = -4.6; b.group.position.set(b.x, b.y, b.z);
    d.player.pos.set(b.x + dist, b.y, b.z);
    d.player.groundY = b.y;
    const toastEl = document.getElementById('toast');
    const toastBefore = toastEl.textContent;
    const realRandom = Math.random;
    let name = null, minDist = d0, hpDrop = 0;
    for (let i = 0; i < 120; i++) {
      Math.random = () => roll;
      d.player.pos.set(b.x + dist, b.y, b.z);
      d.player.groundY = b.y;
      d.stats.hp = 100;
      b.hp = b.maxHp; b.stun = 0; b.cd = 0;
      if (b.state !== 'windup' && b.state !== 'attack') b.state = 'stalk';
      m.update(1 / 30, 3000 + i / 30);
      if (b.attackName) name = b.attackName;
      minDist = Math.min(minDist, Math.hypot(b.x - d.player.pos.x, b.z - d.player.pos.z));
      hpDrop = Math.max(hpDrop, 100 - d.stats.hp);
    }
    Math.random = realRandom;
    const kidsAfter = root ? root.children.length : 0;
    const toastAfter = toastEl.textContent;
    for (const s of saved) { s.o.x = s.x; s.o.z = s.z; s.o.y = s.y; s.o.state = s.st; s.o.group.position.set(s.x, s.y, s.z); }
    return {
      name, d0: +d0.toFixed(2), minDist: +minDist.toFixed(2),
      hpDrop, kidsBefore, kidsAfter,
      monstersBefore, monstersAfter: m.list.length,
      shocks: b.shocks ? b.shocks.length : 0,
      toastChanged: toastAfter !== toastBefore,
      toast: toastAfter,
      bossDmg: b.dmg,
    };
  };

  // swing: игрок рядом
  out.swing = force(0.9, 2.0);
  // slam: игрок рядом — ждём ударную волну
  out.slam = force(0.4, 2.0);
  // roar: игрок рядом — ждём призыв гоблинов
  out.roar = force(0.1, 2.0);
  // charge: игрок далеко (дистанция > 7 — только там босс выбирает наскок)
  out.charge = force(0.4, 8.5);
  return out;
});

check('атака «рубящий удар» (swing) наносит урон',
  effects.swing?.name === 'swing' && effects.swing.hpDrop > 0,
  `атака: ${effects.swing?.name}, урон игроку: ${effects.swing?.hpDrop} (урон босса ${effects.swing?.bossDmg})`);
check('атака «удар оземь» (slam) бьёт с земли ударной волной',
  effects.slam?.name === 'slam' && effects.slam.shocks > 0,
  `атака: ${effects.slam?.name}, ударных колец на боссе: ${effects.slam?.shocks}, новых объектов в сцене: ${effects.slam?.kidsBefore} → ${effects.slam?.kidsAfter}, урон игроку: ${effects.slam?.hpDrop}`);
check('атака «рёв» (roar) призывает гоблинов',
  effects.roar?.name === 'roar' && effects.roar.monstersAfter > effects.roar.monstersBefore,
  `атака: ${effects.roar?.name}, зверей: ${effects.roar?.monstersBefore} → ${effects.roar?.monstersAfter}, подсказка: "${effects.roar?.toast}"`);
check('атака «наскок» (charge) сближается с игроком и бьёт',
  effects.charge?.name === 'charge' && effects.charge.minDist < effects.charge.d0 - 1.0 && effects.charge.hpDrop > 0,
  `атака: ${effects.charge?.name}, дистанция ${effects.charge?.d0} → ${effects.charge?.minDist} м, урон игроку: ${effects.charge?.hpDrop}`);

/* ================= 5. сложность ================= */
const diffBefore = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  const g = d.monsters.list.find((s) => s.spec.id === 'goblin_sword');
  return {
    stored: localStorage.getItem('wv.difficulty'),
    bossHp: b ? b.maxHp : 0, bossDmg: b ? b.dmg : 0, count: d.monsters.list.length,
    goblinHp: g ? g.maxHp : 0, goblinDmg: g ? g.dmg : 0,
  };
});

/* --- переключатель в настройках: открыть по Esc и нажать кнопку --- */
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const menuOpen = await page.evaluate(() => window.__dbg.mode === 'menu'
  && document.getElementById('menu').classList.contains('on'));
check('настройки открываются по Esc', menuOpen === true, `режим: ${menuOpen}`);

await page.click('#segDiff button[data-diff="nightmare"]');
await page.waitForTimeout(900);
const afterNight = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  const g = d.monsters.list.find((s) => s.spec.id === 'goblin_sword');
  return {
    stored: localStorage.getItem('wv.difficulty'),
    bossHp: b ? b.maxHp : 0, bossDmg: b ? b.dmg : 0, count: d.monsters.list.length,
    goblinHp: g ? g.maxHp : 0, goblinDmg: g ? g.dmg : 0,
    segOn: [...document.querySelectorAll('#segDiff button')].filter((x) => x.classList.contains('on')).map((x) => x.dataset.diff),
    difficulty: d.monsters.difficulty.id,
  };
});
check('выбор сложности сохраняется в localStorage["wv.difficulty"]',
  afterNight.stored === 'nightmare', `в localStorage: "${afterNight.stored}", подсвечена кнопка: ${afterNight.segOn.join(',')}`);
check('сложность подсвечивается в настройках', afterNight.segOn.includes('nightmare'), afterNight.segOn.join(','));

check('на «Кошмар» у монстров больше здоровья',
  afterNight.bossHp > diffBefore.bossHp && afterNight.goblinHp > diffBefore.goblinHp,
  `босс ${diffBefore.bossHp} → ${afterNight.bossHp}, гоблин ${diffBefore.goblinHp} → ${afterNight.goblinHp}`);
check('на «Кошмар» у монстров больше урона',
  afterNight.bossDmg > diffBefore.bossDmg && afterNight.goblinDmg > diffBefore.goblinDmg,
  `босс ${diffBefore.bossDmg} → ${afterNight.bossDmg}, гоблин ${diffBefore.goblinDmg} → ${afterNight.goblinDmg}`);
check('на «Кошмар» монстров больше', afterNight.count > diffBefore.count,
  `было ${diffBefore.count}, стало ${afterNight.count}`);

await page.click('#segDiff button[data-diff="easy"]');
await page.waitForTimeout(900);
const afterEasy = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  const g = d.monsters.list.find((s) => s.spec.id === 'goblin_sword');
  return {
    stored: localStorage.getItem('wv.difficulty'),
    bossHp: b ? b.maxHp : 0, bossDmg: b ? b.dmg : 0, count: d.monsters.list.length,
    goblinHp: g ? g.maxHp : 0, goblinDmg: g ? g.dmg : 0,
  };
});
check('на «Легко» у монстров меньше здоровья и урона',
  afterEasy.bossHp < diffBefore.bossHp && afterEasy.goblinHp < diffBefore.goblinHp
  && afterEasy.bossDmg < diffBefore.bossDmg && afterEasy.goblinDmg < diffBefore.goblinDmg,
  `босс HP ${diffBefore.bossHp} → ${afterEasy.bossHp}, урон ${diffBefore.bossDmg} → ${afterEasy.bossDmg}; гоблин HP ${diffBefore.goblinHp} → ${afterEasy.goblinHp}, урон ${diffBefore.goblinDmg} → ${afterEasy.goblinDmg}`);
check('на «Легко» монстров меньше', afterEasy.count < diffBefore.count,
  `было ${diffBefore.count}, стало ${afterEasy.count}`);
check('смена сложности прямо в пещере пересобирает монстров',
  afterEasy.count !== diffBefore.count && afterEasy.bossHp !== diffBefore.bossHp,
  `список монстров пересобран: HP босса ${diffBefore.bossHp} → ${afterEasy.bossHp}, зверей ${diffBefore.count} → ${afterEasy.count}`);

/* --- сложность переживает перезагрузку --- */
await page.evaluate(() => localStorage.setItem('wv.difficulty', 'hard'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
const afterReload = await page.evaluate(() => {
  const d = window.__dbg;
  return {
    stored: localStorage.getItem('wv.difficulty'),
    segOn: [...document.querySelectorAll('#segDiff button')].filter((x) => x.classList.contains('on')).map((x) => x.dataset.diff),
  };
});
check('сложность сохраняется между запусками',
  afterReload.stored === 'hard' && afterReload.segOn.includes('hard'),
  `localStorage: "${afterReload.stored}", подсвечена: ${afterReload.segOn.join(',') || 'ни одна'}`);

console.log(results.join('\n'));
console.log(`\ntester_r61_boss: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await browser.close();
if (fail) process.exit(1);
