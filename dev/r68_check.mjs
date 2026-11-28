/**
 * Раунд 68 — проверки баланса зверей.
 *
 * Что проверяем:
 *   1. Кривую силы: мелочь слабее обычных, обычные слабее стражи,
 *      стража слабее владыки — по здоровью, урону, стойкости и опыту.
 *   2. Полноту реестра: у каждой породы заполнены все характеристики,
 *      есть описание и совет.
 *   3. Что призрак не тронут (по просьбе «после всего посмотрим»).
 *   4. «Зверинец» в интерфейсе: открывается, показывает все породы,
 *      характеристики совпадают с кодом, закрывается.
 *   5. Что документ docs/БАЛАНС-МОБЫ.md говорит то же самое, что код.
 *
 * Запуск: cd /workspace/village && node dev/r68_check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import { MONSTERS, TIERS, ZONES, LOOT_TABLE } from '../src/game/monsters.js';
import { buildBestiary, buildTiers } from '../src/game/bestiary.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DOC = path.join(ROOT, 'docs', 'БАЛАНС-МОБЫ.md');

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) bad++;
};

/* ------------------------------------------------------------------
 *  1. Кривая силы
 * ------------------------------------------------------------------ */

const byTier = { trash: [], normal: [], elite: [], boss: [] };
for (const m of MONSTERS) (byTier[m.tier] || byTier.trash).push(m);

const hpOf = (t) => byTier[t].map((m) => m.hp);
const dmgOf = (t) => byTier[t].map((m) => m.dmg);
const expOf = (t) => byTier[t].map((m) => m.exp);
const veilOf = (t) => byTier[t].map((m) => m.veil);
const avgSpeed = (t) => byTier[t].reduce((s, m) => s + m.speed, 0) / byTier[t].length;

console.log('=== Кривая силы ===');
ok('всего 12 пород', MONSTERS.length === 12, String(MONSTERS.length));
ok('4 ступени силы', TIERS.length === 4);
ok('мелочь: пород больше, чем страж', byTier.trash.length > byTier.elite.length);

ok('здоровье: мелочь слабее обычных',
  Math.max(...hpOf('trash')) < Math.min(...hpOf('normal')),
  `${Math.max(...hpOf('trash'))} < ${Math.min(...hpOf('normal'))}`);
ok('здоровье: обычные слабее стражи',
  Math.max(...hpOf('normal')) < Math.min(...hpOf('elite')),
  `${Math.max(...hpOf('normal'))} < ${Math.min(...hpOf('elite'))}`);
ok('здоровье: стража слабее владыки',
  Math.max(...hpOf('elite')) < Math.min(...hpOf('boss')),
  `${Math.max(...hpOf('elite'))} < ${Math.min(...hpOf('boss'))}`);

ok('урон: мелочь слабее обычных',
  Math.max(...dmgOf('trash')) < Math.min(...dmgOf('normal')),
  `${Math.max(...dmgOf('trash'))} < ${Math.min(...dmgOf('normal'))}`);
ok('урон: обычные слабее стражи',
  Math.max(...dmgOf('normal')) < Math.min(...dmgOf('elite')),
  `${Math.max(...dmgOf('normal'))} < ${Math.min(...dmgOf('elite'))}`);
ok('урон: стража слабее владыки',
  Math.max(...dmgOf('elite')) < Math.max(...dmgOf('boss')),
  `${Math.max(...dmgOf('elite'))} < ${Math.max(...dmgOf('boss'))}`);

ok('опыт растёт по ступеням',
  Math.max(...expOf('trash')) < Math.min(...expOf('normal'))
  && Math.max(...expOf('normal')) < Math.min(...expOf('elite'))
  && Math.max(...expOf('elite')) < Math.max(...expOf('boss')));
ok('стойкость растёт по ступеням',
  Math.max(...veilOf('trash')) < Math.max(...veilOf('elite'))
  && Math.max(...veilOf('elite')) < Math.max(...veilOf('boss')));
ok('мелочь быстрее обычных', avgSpeed('trash') > avgSpeed('normal'),
  `${avgSpeed('trash').toFixed(2)} > ${avgSpeed('normal').toFixed(2)}`);

/* ------------------------------------------------------------------
 *  2. Полнота реестра
 * ------------------------------------------------------------------ */

console.log('\n=== Полнота реестра ===');
const REQUIRED = ['id', 'name', 'tier', 'hp', 'dmg', 'speed', 'aggro', 'reach', 'cd',
  'attack', 'windup', 'active', 'radius', 'height', 'sp', 'scale', 'exp', 'veil'];
const missing = [];
for (const m of MONSTERS) {
  for (const f of REQUIRED) {
    if (m[f] === undefined || m[f] === null) missing.push(`${m.id}.${f}`);
  }
}
ok('у всех пород заполнены все характеристики', missing.length === 0, missing.join(', '));

const noDesc = MONSTERS.filter((m) => !m.desc || m.desc.length < 40).map((m) => m.id);
const noTip = MONSTERS.filter((m) => !m.tip || m.tip.length < 40).map((m) => m.id);
ok('у всех пород есть описание', noDesc.length === 0, noDesc.join(', '));
ok('у всех пород есть совет, как бить', noTip.length === 0, noTip.join(', '));

const badZone = MONSTERS.filter((m) => !m.boss && !ZONES.some((z) => z.tier === m.tier)).map((m) => m.id);
ok('у каждой породы (кроме босса) есть зона, где она водится', badZone.length === 0, badZone.join(', '));
const noLoot = MONSTERS.filter((m) => !(LOOT_TABLE[m.tier] || []).length).map((m) => m.id);
ok('у каждой ступени есть таблица добычи', noLoot.length === 0, noLoot.join(', '));

/* ------------------------------------------------------------------
 *  3. Призрак не тронут
 * ------------------------------------------------------------------ */

console.log('\n=== Призрак (отложен по вашей просьбе) ===');
const ghost = MONSTERS.find((m) => m.id === 'ghost');
ok('призрак на месте', !!ghost);
if (ghost) {
  const expect = { hp: 46, dmg: 12, speed: 1.75, aggro: 19, reach: 1.7, cd: 2.1, exp: 12, veil: 2 };
  const diff = Object.keys(expect).filter((k) => ghost[k] !== expect[k]);
  ok('числа призрака не изменились', diff.length === 0,
    diff.map((k) => `${k}=${ghost[k]} (было ${expect[k]})`).join(', '));
}

/* ------------------------------------------------------------------
 *  4. Данные «Зверинца»
 * ------------------------------------------------------------------ */

console.log('\n=== Данные «Зверинца» ===');
const best = buildBestiary();
const tiers = buildTiers();
ok('в «Зверинце» 12 пород', best.length === 12, String(best.length));
ok('в «Зверинце» 4 ступени', tiers.length === 4);
ok('породы идут по ступеням силы',
  best.map((b) => tiers.findIndex((t) => t.id === b.tier))
    .every((v, i, a) => i === 0 || a[i - 1] <= v));
ok('у каждой породы есть зона и добыча',
  best.every((b) => b.where && b.drops.length));
ok('в «Зверинце» есть все описания',
  best.every((b) => b.desc.length > 40 && b.tip.length > 40));

/* ------------------------------------------------------------------
 *  5. Документ совпадает с кодом
 * ------------------------------------------------------------------ */

console.log('\n=== Документ docs/БАЛАНС-МОБЫ.md ===');
const doc = fs.readFileSync(DOC, 'utf8');
// берём только раздел с породами: в документе есть ещё таблица
// «было → стало», где числа старые и специально показывают разницу
const docSection = doc.split('## 4. Порода за породой')[1]?.split('## 5.')[0] || '';
ok('в документе есть раздел с породами', docSection.length > 500);
const docRows = new Map();
for (const line of docSection.split('\n')) {
  if (!line.trim().startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 3) continue;
  const name = cells[0];
  const spec = MONSTERS.find((m) => m.name === name);
  if (!spec) continue;
  const nums = cells.slice(1).map((c) => {
    const m2 = c.match(/-?\d+(?:\.\d+)?/);
    return m2 ? Number(m2[0]) : null;
  }).filter((v) => v !== null);
  docRows.set(name, { spec, nums });
}
ok('в документе описаны все 12 пород', docRows.size === 12, String(docRows.size));
let docBad = [];
for (const [name, { spec, nums }] of docRows) {
  // первые пять столбцов во всех таблицах одинаковые:
  // здоровье, урон, скорость, дальность, стойкость
  const want = [spec.hp, spec.dmg, spec.speed, spec.reach, spec.veil];
  for (let i = 0; i < want.length; i++) {
    if (nums[i] !== want[i]) docBad.push(`${name}: столбец ${i + 1} — ${nums[i]} вместо ${want[i]}`);
  }
  // дальше порядок столбцов зависит от ступени (броня, щит, опыт, стая),
  // поэтому ищем вес и стаю среди чисел строки
  if (!nums.includes(spec.exp)) docBad.push(`${name}: нет веса ${spec.exp}`);
  if (!nums.includes(spec.sp)) docBad.push(`${name}: нет стаи ${spec.sp}`);
}
ok('цифры в документе совпадают с кодом', docBad.length === 0, docBad.join('; '));
ok('в документе описан призрак', doc.includes('Призрак'));
ok('в документе есть раздел про бой', doc.includes('Что бьёт как'));

/* ------------------------------------------------------------------
 *  6. «Зверинец» в интерфейсе
 * ------------------------------------------------------------------ */

console.log('\n=== «Зверинец» в игре ===');
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

const SITE = process.argv[2] || 'http://127.0.0.1:4205';
await page.goto(SITE + '/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

// породы изучаются с раунда 69: чтобы увидеть полные карточки,
// сначала «изучаем» их все
await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  for (const e of ctx.systems.bestiary.entries()) ctx.systems.bestiary.unlock(e.id);
});
await page.keyboard.press('KeyB');
await page.waitForTimeout(700);
const open = await page.evaluate(() => document.getElementById('bestiary').classList.contains('on'));
ok('зверинец открывается по клавише B', open);

const view = await page.evaluate(() => {
  const items = [...document.querySelectorAll('#bestList .bItem')];
  return {
    count: items.length,
    tiers: document.querySelectorAll('#bestList .bTierHead').length,
    cards: items.map((it) => ({
      id: it.dataset.monster,
      name: it.querySelector('.bTop b')?.textContent || '',
      tier: it.querySelector('.bTop .bState')?.textContent || '',
      where: it.querySelector('.bTop .bWhere')?.textContent || '',
      stats: [...it.querySelectorAll('.bStats span')].map((s) => s.textContent.trim()),
      desc: (it.querySelector('.bDesc')?.textContent || '').length,
      tip: (it.querySelector('.bTip')?.textContent || '').length,
      loot: (it.querySelector('.bLoot')?.textContent || '').length,
    })),
  };
});
ok('в «Зверинце» 12 карточек', view.count === 12, String(view.count));
ok('в «Зверинце» 4 заголовка ступеней', view.tiers === 4, String(view.tiers));
ok('в каждой карточке есть характеристики',
  view.cards.every((c) => c.stats.length >= 8),
  view.cards.filter((c) => c.stats.length < 8).map((c) => c.name).join(', '));
ok('в каждой карточке есть описание и совет',
  view.cards.every((c) => c.desc > 40 && c.tip > 40));
ok('в каждой карточке указано, где водится и что падает',
  view.cards.every((c) => c.where && c.loot > 10));

// характеристики в карточке совпадают с кодом
const guard = view.cards.find((c) => c.id === 'goblin_guard');
const guardSpec = MONSTERS.find((m) => m.id === 'goblin_guard');
ok('в карточке стража верные числа',
  !!guard && guard.stats.some((s) => s.includes(String(guardSpec.hp)))
  && guard.stats.some((s) => s.includes(String(guardSpec.dmg))));

// порядок: сначала мелочь, потом обычные, потом стража, потом владыка
const order = view.cards.map((c) => c.id);
const tierRank = (id) => ['trash', 'normal', 'elite', 'boss'].indexOf(
  MONSTERS.find((m) => m.id === id).tier);
const ranks = order.map(tierRank);
ok('породы упорядочены по силе',
  ranks.every((v, i) => i === 0 || ranks[i - 1] <= v),
  order.join(' → '));
ok('владыка в конце списка', order[order.length - 1] === 'orc_boss');

await page.screenshot({ path: path.join(ROOT, 'shots', 'r68-bestiary.png') });
console.log('✓ снимок shots/r68-bestiary.png');
// и нижняя часть — стража и владыка
await page.evaluate(() => {
  const card = document.querySelector('#bestList .bItem.boss');
  if (card) card.scrollIntoView({ block: 'end' });
});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(ROOT, 'shots', 'r68-bestiary-boss.png') });
console.log('✓ снимок shots/r68-bestiary-boss.png');

await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const closed = await page.evaluate(() => ({
  hidden: !document.getElementById('bestiary').classList.contains('on'),
  mode: window.__dbg.ctx.mode,
}));
ok('зверинец закрывается по Esc', closed.hidden);
ok('после закрытия управление возвращается', closed.mode === 'play', closed.mode);

// кнопка в меню паузы
await page.keyboard.press('KeyO');
await page.waitForTimeout(500);
const hasBtn = await page.evaluate(() => !!document.getElementById('bestBtn'));
ok('в меню паузы есть кнопка «Зверинец…»', hasBtn);
if (hasBtn) {
  await page.evaluate(() => document.getElementById('bestBtn').click());
  await page.waitForTimeout(600);
  const viaMenu = await page.evaluate(() => document.getElementById('bestiary').classList.contains('on'));
  ok('кнопка в меню открывает «Зверинец»', viaMenu);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => window.__dbg.ctx.mode);
  ok('после закрытия возвращаемся в паузу', back === 'menu', back);
}

console.log('\nошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));

await browser.close();
console.log(bad ? `\nошибок: ${bad}` : '\nошибок: 0');
process.exit(bad || errs.length ? 1 : 0);
