/**
 * Раунд 69 — проверки «Зверинца»: изучение пород и записи у Хорта.
 *
 * Что проверяем:
 *   1. Цена записи зависит от силы породы: мелочь дешевле обычных,
 *      обычные дешевле стражи, стража дешевле владыки.
 *   2. Система зверинца: открытие, снимок и восстановление из сохранения.
 *   3. В игре записи закрыты: у не изученных пород не видно характеристик,
 *      видна цена и подсказка «убейте или купите у Хорта».
 *   4. Убитый зверь открывает свою породу бесплатно.
 *   5. Хорт продаёт записи о не изученных породах; покупка списывает
 *      монеты и открывает породу.
 *   6. Открытые породы переживают сохранение и загрузку.
 *
 * Запуск: cd /workspace/village && node dev/r69_check.mjs [url]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import { MONSTERS } from '../src/game/monsters.js';
import { createBestiary, entryPrice, entryGood } from '../src/game/bestiary.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = process.argv[2] || 'http://127.0.0.1:4205';

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) bad++;
};

const spec = (id) => MONSTERS.find((m) => m.id === id);
const byTier = (t) => MONSTERS.filter((m) => m.tier === t);

/* ------------------------------------------------------------------
 *  1. Цена зависит от силы
 * ------------------------------------------------------------------ */

console.log('=== Цена записи ===');
const priceOf = (m) => entryPrice(m);
const maxTrash = Math.max(...byTier('trash').map(priceOf));
const minNormal = Math.min(...byTier('normal').map(priceOf));
const maxNormal = Math.max(...byTier('normal').map(priceOf));
const elite = priceOf(spec('goblin_guard'));
const boss = priceOf(spec('orc_boss'));

ok('у всех пород есть цена', MONSTERS.every((m) => priceOf(m) > 0));
ok('цены кратны пяти', MONSTERS.every((m) => priceOf(m) % 5 === 0));
ok('мелочь дешевле обычных', maxTrash < minNormal, `${maxTrash} < ${minNormal}`);
ok('обычные дешеле стража', maxNormal < elite, `${maxNormal} < ${elite}`);
ok('стража дешевле владыки', elite < boss, `${elite} < ${boss}`);
console.log('  · цены:',
  'мелочь', `${Math.min(...byTier('trash').map(priceOf))}–${maxTrash}`,
  '| обычные', `${minNormal}–${maxNormal}`,
  '| стража', elite, '| владыка', boss);

/* ------------------------------------------------------------------
 *  2. Система зверинца
 * ------------------------------------------------------------------ */

console.log('\n=== Система зверинца ===');
const fake = { ui: { toast: () => {} } };
const sys = createBestiary(fake);
ok('изначально ничего не изучено', sys.count === 0);
ok('открытие первой породы возвращает true', sys.unlock('goblin_sword') === true);
ok('повторное открытие — false', sys.unlock('goblin_sword') === false);
ok('порода считается изученной', sys.has('goblin_sword'));
ok('чужая порода не изучена', !sys.has('orc_boss'));
ok('счётчик изученных', sys.count === 1 && sys.total === 12);
const snap = sys.snapshot();
ok('в снимке есть изученные', snap.known.length === 1 && snap.known[0] === 'goblin_sword');
const sys2 = createBestiary(fake);
sys2.restore(snap);
ok('из сохранения порода восстановилась', sys2.has('goblin_sword'));
const sys3 = createBestiary(fake);
sys3.restore({ known: ['goblin_sword', 'выдумка'] });
ok('чужие названия из сохранения отброшены', sys3.count === 1);
ok('на продаже только не изученные',
  sys.forSale().length === 11 && !sys.forSale().some((g) => g.id === 'codex_goblin_sword'));
const good = entryGood(spec('orc_boss'));
ok('товар — запись о породе', good.kind === 'codex' && good.id === 'codex_orc_boss');
ok('в товаре указана цена', good.price === boss);

/* ------------------------------------------------------------------
 *  3–6. В игре
 * ------------------------------------------------------------------ */

console.log('\n=== «Зверинец» в игре ===');
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(SITE + '/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

await page.keyboard.press('KeyB');
await page.waitForTimeout(700);

const locked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('#bestList .bItem')];
  return {
    count: items.length,
    lockedCount: items.filter((i) => i.classList.contains('locked')).length,
    counter: document.getElementById('bestCount')?.textContent || '',
    statsInLocked: items.filter((i) => i.classList.contains('locked'))
      .some((i) => i.querySelector('.bStats')),
    priceShown: items.filter((i) => i.classList.contains('locked'))
      .every((i) => /зол/.test(i.querySelector('.bTip')?.textContent || '')),
  };
});
ok('в «Зверинце» 12 карточек', locked.count === 12, String(locked.count));
ok('изначально все породы закрыты', locked.lockedCount === 12, String(locked.lockedCount));
ok('счётчик показывает «Изучено 0 из 12»', /0 из 12/.test(locked.counter), locked.counter);
ok('у закрытых пород нет характеристик', !locked.statsInLocked);
ok('у закрытых пород видна цена', locked.priceShown);
await page.screenshot({ path: path.join(ROOT, 'shots', 'r69-closed.png') });
console.log('✓ снимок shots/r69-closed.png');
// закрываем справочник: дальше он должен открываться заново
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

/**
 * Вернуть игру в обычный режим.
 *
 * После зачистки зала открывается диалог о печати — он перехватывает клавиши,
 * поэтому перед открытием справочника его надо закрыть.
 */
const toPlay = () => page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  if (ctx.systems && ctx.systems.dialog) ctx.systems.dialog.close();
  ctx.mode = 'play';
});

// --- убийство зверя открывает породу ---
const killed = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  d.setLocation('dungeon');
  const monsters = ctx.systems.monsters;
  monsters.spawn();
  const m = monsters.list[0];
  if (!m) return null;
  const org = { x: m.x, y: m.y + 1, z: m.z - 1.2 };
  const dir = { x: 0, y: 0, z: 1 };
  const res = monsters.hit(org, dir, 3, 0.7, 9999);
  return {
    id: m.spec.id,
    killed: res.killed,
    known: ctx.systems.bestiary.has(m.spec.id),
  };
});
ok('подземелье открылось и зверь убит', !!killed && killed.killed, killed ? killed.id : 'нет зверя');
ok('убитый зверь открыл свою породу', !!killed && killed.known);

await toPlay();
await page.keyboard.press('KeyB');
await page.waitForTimeout(600);
const afterKill = await page.evaluate(() => ({
  counter: document.getElementById('bestCount')?.textContent || '',
  locked: document.querySelectorAll('#bestList .bItem.locked').length,
  opened: document.querySelectorAll('#bestList .bItem:not(.locked)').length,
}));
ok('счётчик учёл убитую породу', /1 из 12/.test(afterKill.counter), afterKill.counter);
ok('одна карточка стала открытой', afterKill.opened === 1 && afterKill.locked === 11);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// --- покупка записи у Хорта ---
const buy = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  ctx.stats.coins = 5000;
  d.setLocation('village');
  const trade = ctx.systems.trade;
  trade.open('barkeep');
  const goods = document.querySelectorAll('#tradeGoods .tradeRow');
  const rows = [...goods].map((r) => ({
    name: r.querySelector('.tradeInfo b')?.textContent || '',
    text: r.querySelector('.tradeInfo span')?.textContent || '',
  }));
  const codexRows = rows.filter((r) => /Запись в зверинце/.test(r.name));
  // покупаем самую дорогую запись (владыка)
  const target = codexRows.find((r) => /Орк-владыка/.test(r.name));
  let bought = false;
  if (target) {
    const row = [...goods].find((r) => (r.querySelector('.tradeInfo b')?.textContent || '') === target.name);
    row.querySelector('.tradeBtn').click();
    bought = true;
  }
  const known = ctx.systems.bestiary.has('orc_boss');
  const coins = ctx.stats.coins;
  trade.close();
  return { total: rows.length, codex: codexRows.length, bought, known, coins, target };
});
ok('у Хорта в продаже есть записи', buy.codex >= 10, String(buy.codex));
ok('запись о владыке продаётся', !!buy.target, buy.target ? buy.target.text : 'нет');
ok('покупка записи открыла породу', buy.known);
ok('монеты списались', buy.coins < 5000, `осталось ${buy.coins}`);
await toPlay();
await page.keyboard.press('KeyB');
await page.waitForTimeout(600);
const afterBuy = await page.evaluate(() => document.getElementById('bestCount')?.textContent || '');
ok('счётчик учёл купленную запись', /2 из 12/.test(afterBuy), afterBuy);
await page.screenshot({ path: path.join(ROOT, 'shots', 'r69-open.png') });
console.log('✓ снимок shots/r69-open.png');

// --- сохранение переживает изученное ---
const persisted = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const snap = ctx.systems.bestiary.snapshot();
  ctx.systems.bestiary.restore({ known: [] });
  const cleared = ctx.systems.bestiary.count;
  ctx.systems.bestiary.restore(snap);
  return { cleared, restored: ctx.systems.bestiary.count, snap };
});
ok('очистка снимка обнуляет зверинец', persisted.cleared === 0);
ok('восстановление возвращает породы', persisted.restored === 2, String(persisted.restored));

console.log('\nошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));

await browser.close();
console.log(bad || errs.length ? `\nошибок: ${bad + errs.length}` : '\nошибок: 0');
process.exit(bad || errs.length ? 1 : 0);
