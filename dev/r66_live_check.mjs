/**
 * Проверка опубликованного сайта: открыть страницу с GitHub Pages,
 * начать игру и убедиться, что система дел работает.
 *
 * Запуск: cd /workspace/village && node dev/r66_live_check.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.argv[2] || 'https://rezare777.github.io/Silenc/';

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

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
check('страница открылась и игра собралась', true, URL);

await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);

const st = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  return {
    quests: q ? q.QUESTS.length : 0,
    marker: q ? q.markerKind('barkeep') : '',
    journal: q ? q.journal().length : 0,
    hasTracker: !!document.getElementById('questTrack'),
  };
});
check('на сайте работает система дел', st.quests === 5, `${st.quests}`);
check('над Хортом горит знак «!»', st.marker === 'new', st.marker);
check('в журнале пять дел', st.journal === 5, `${st.journal}`);
check('трекер дела на месте', st.hasTracker);

await page.keyboard.press('KeyJ');
await page.waitForTimeout(900);
const logOpen = await page.evaluate(() => {
  const el = document.getElementById('questLog');
  return el ? el.classList.contains('on') : false;
});
check('журнал дел открывается по J', logOpen);
check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log(`\nОпубликованный сайт — ${URL}`);
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
