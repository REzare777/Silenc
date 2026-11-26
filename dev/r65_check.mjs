/**
 * ============================================================================
 *  Раунд 65 — проверка «звери стоят на полу», полосок здоровья и оружия
 * ============================================================================
 *
 *  Что проверяем:
 *   1) ни один зверь не проваливается в пол (в том числе босс);
 *   2) над каждым зверем есть полоска здоровья; после удара она видна
 *      и стоит над головой;
 *   3) урон у каждого оружия свой, а в описании есть урон в секунду;
 *   4) стены и пол подземелья не «натянуты» на весь зал.
 *
 *  Запуск: cd /workspace/village && node dev/r65_check.mjs
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

/* ---------------- 1. звери стоят на полу ---------------- */
const feet = await page.evaluate(() => {
  const d = window.__dbg;
  const THREE = d.THREE;
  // меряем по нескольким фазам шага: ноги то поднимаются, то опускаются.
  // Важно, что модель НИКОГДА не уходит ниже земли.
  for (const g of d.monsters.list) {
    g.moveSpeed = 0;
    g.state = 'sleep';
  }
  const res = [];
  for (const g of d.monsters.list) {
    let lowest = Infinity;
    const saved = g.phase;
    const savedY = g.group.position.y;
    for (let i = 0; i < 6; i++) {
      g.phase = i * 0.9;
      if (g.model && g.model.update) g.model.update(i * 0.7, 0.016, g);
      g.group.position.y = 0;
      g.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.group);
      lowest = Math.min(lowest, box.min.y);
    }
    g.phase = saved;
    if (g.model && g.model.update) g.model.update(0, 0.016, g);
    g.group.position.y = savedY;      // возвращаем подъём модели
    g.group.updateMatrixWorld(true);
    // низ модели после подъёма (position.y уже с подъёмом)
    const bottom = g.group.position.y + lowest;
    res.push({ id: g.spec.id, sink: +(g.y - bottom).toFixed(3) });
  }
  // призрак — дух, он парит по замыслу; его считаем отдельно
  const grounded = res.filter((x) => x.id !== 'ghost');
  const ghost = res.find((x) => x.id === 'ghost') || null;
  grounded.sort((a, b) => b.sink - a.sink);
  return {
    worst: grounded.slice(0, 4),
    maxSink: grounded.length ? grounded[0].sink : 0,
    minSink: Math.min(...grounded.map((x) => x.sink)),
    boss: grounded.find((x) => x.id === 'orc_boss') || null,
    ghost,
  };
});
console.log('  ноги:', JSON.stringify(feet));
check('никто не уходит в пол', feet.minSink > -0.05,
  `глубже всех: ${feet.minSink}`);
check('модель стоит на земле, а не висит', feet.maxSink < 0.08,
  `выше всех: ${JSON.stringify(feet.worst[0])}`);
check('босс стоит на полу', !!feet.boss && Math.abs(feet.boss.sink) < 0.08,
  JSON.stringify(feet.boss));
check('призрак парит над землёй, но не проваливается',
  !!feet.ghost && feet.ghost.sink > -0.05 && feet.ghost.sink < 0.6,
  JSON.stringify(feet.ghost));

/* ---------------- 2. полоски здоровья ---------------- */
const bars = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const all = m.list;
  const withBar = all.filter((g) => !g.boss && g.bar).length;
  const need = all.filter((g) => !g.boss).length;
  // раним гоблина и смотрим полоску
  const g = all.find((x) => x.spec.id === 'goblin_sword' && x.hp > 0);
  g.hp = Math.round(g.maxHp * 0.5);
  for (let i = 0; i < 3; i++) m.update(1 / 30, 1 + i / 30);
  const head = g.y + (g.spec.height || 1.6) * (g.baseScale || 1);
  return {
    need,
    withBar,
    visible: g.bar ? g.bar.sprite.visible : false,
    above: g.bar ? +(g.bar.sprite.position.y - head).toFixed(2) : null,
    hp: g.hp,
    max: g.maxHp,
  };
});
console.log('  полоски:', JSON.stringify(bars));
check('у всех обычных зверей есть полоска', bars.withBar === bars.need,
  `${bars.withBar} из ${bars.need}`);
check('после ранения полоска видна', bars.visible === true);
check('полоска стоит над головой', bars.above > 0.2 && bars.above < 0.8,
  `+${bars.above} м`);

/* ---------------- 3. оружие: урон у каждого свой ---------------- */
const arms = await page.evaluate(() => {
  const d = window.__dbg;
  const list = d.weapons.WEAPONS.map((w) => ({
    id: w.id,
    name: w.name,
    dmg: w.dmg[0] + '-' + w.dmg[1],
    avg: (w.dmg[0] + w.dmg[1]) / 2,
    dps: Math.round(((w.dmg[0] + w.dmg[1]) / 2) / w.speed),
    effort: w.effort,
  }));
  // описание оружия в инвентаре
  const spec = d.weapons.WEAPONS[0];
  const desc = d.items.itemDesc(spec);
  return { list, rows: desc.rows.map((r) => r[0]) };
});
console.log('  оружие:', JSON.stringify(arms.list));
const ranges = arms.list.map((w) => w.dmg);
check('урон у всех оружий разный', new Set(ranges).size === ranges.length,
  ranges.join(', '));
check('урон оружия идут по возрастанию силы',
  arms.list.find((w) => w.id === 'dagger').avg < arms.list.find((w) => w.id === 'shortsword').avg
  && arms.list.find((w) => w.id === 'shortsword').avg < arms.list.find((w) => w.id === 'greatsword').avg,
  'кинжал < короткий < двуручный');
check('у двуручного меча самый большой урон за удар',
  arms.list.find((w) => w.id === 'greatsword').avg === Math.max(...arms.list.map((w) => w.avg)));
check('в описании есть урон в секунду', arms.rows.includes('В секунду'),
  arms.rows.join(', '));

/* ---------------- 4. стены и пол не растянуты ---------------- */
const tex = await page.evaluate(() => {
  const d = window.__dbg;
  let floorMesh = null;
  let wallMesh = null;
  d.sceneDungeon.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.uv) return;
    const uv = o.geometry.attributes.uv;
    let maxU = 0, maxV = 0;
    for (let i = 0; i < uv.count; i++) {
      maxU = Math.max(maxU, uv.getX(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    // пол — плоскость без материала стены; ищем самую большую UV-растяжку
    if (maxU * maxV > 8 && !floorMesh) floorMesh = { maxU: +maxU.toFixed(1), maxV: +maxV.toFixed(1) };
    if (maxU > 3 && !wallMesh) wallMesh = { maxU: +maxU.toFixed(1), maxV: +maxV.toFixed(1) };
  });
  return { floorMesh, wallMesh };
});
console.log('  текстуры:', JSON.stringify(tex));
check('пол не натянут на весь зал', !!tex.floorMesh && tex.floorMesh.maxU >= 4,
  JSON.stringify(tex.floorMesh));
check('стены тайлятся, а не растягиваются', !!tex.wallMesh && tex.wallMesh.maxU >= 2,
  JSON.stringify(tex.wallMesh));

/* ---------------- 5. ошибки в консоли ---------------- */
check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log('\nРаунд 65 — ноги, полоски здоровья, оружие');
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
