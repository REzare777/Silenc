/**
 * Проверка однофайловой версии: файл открывается с диска (file://),
 * игра стартует, система дел на месте, знаки и журнал работают.
 *
 * Запуск: cd /workspace/village && node dev/r66_single_check.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const FILE = 'file:///workspace/Шёпот-Долина.html';

let ok = 0;
let fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name что проверяем
 * @param {boolean} cond условие
 * @param {string} info подробности
 */
function check(name, cond, info = '') {
  if (cond) { ok++; results.push(`  ok   ${name}`); }
  else { fail++; results.push(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(FILE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
check('игра загрузилась с диска', true);

await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2000);

const st = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  return {
    quests: q ? q.QUESTS.length : 0,
    markerBarkeep: q ? q.markerKind('barkeep') : '',
    journal: q ? q.journal().length : 0,
    trackerShown: document.getElementById('questTrack') ? true : false,
    journalEl: !!document.getElementById('questList'),
    started: !!d.player,
  };
});
check('система дел работает', st.quests === 5, `${st.quests}`);
check('над Хортом горит знак «!»', st.markerBarkeep === 'new', st.markerBarkeep);
check('в журнале видны все пять дел', st.journal === 5, `${st.journal}`);
check('трекер дела на месте', st.trackerShown && st.journalEl);

// журнал открывается по J
await page.keyboard.press('KeyJ');
await page.waitForTimeout(800);
const opened = await page.evaluate(() => {
  const el = document.getElementById('questLog');
  return el ? el.classList.contains('on') : false;
});
check('журнал дел открывается по клавише J', opened);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(600);
const closed = await page.evaluate(() => {
  const el = document.getElementById('questLog');
  return el ? !el.classList.contains('on') : false;
});
check('журнал дел закрывается по клавише J', closed);

check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log('\nОднофайловая версия — раунд 66');
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
