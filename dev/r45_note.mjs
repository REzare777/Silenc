/**
 * ============================================================================
 *  Раунд 45: доска для записки — написать можно ОДИН раз
 * ============================================================================
 *
 *  Проверяем:
 *   1. у доски есть интеракт «Написать на доске»;
 *   2. по нажатию открывается окно ввода, игра встаёт на паузу;
 *   3. надпись попадает на доску (текстура обновилась) и сохраняется;
 *   4. второй раз написать уже нельзя — интеракт предлагает прочитать.
 *
 *  Запуск: cd dev && node r45_note.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 160)); });

// чистим сохранённую записку, чтобы проверка была честной
await page.addInitScript(() => { try { localStorage.removeItem('wv.note'); } catch (e) { /* нет localStorage */ } });
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const out = {};

  const it = (ctx.interactables || []).find((i) => (i.labelFn ? i.labelFn() : i.label) === 'Написать на доске');
  out.found = !!it;
  if (!it) return out;

  // подходим к доске и «нажимаем E»
  const p = d.player;
  p.teleport(it.pos.x, it.pos.z, 0);
  p.y = 0; p.groundY = 0; p.vy = 0;
  for (let i = 0; i < 5; i++) p.update(1 / 60);
  const near = ctx.systems.interactions.nearest();
  out.nearest = near ? (near.labelFn ? near.labelFn() : near.label) : null;

  it.act();
  out.mode = ctx.mode;
  out.noteOpen = ctx.ui.noteOpen === true;
  out.playerFrozen = ctx.player.acceptInput === false;

  // печатаем и отправляем
  const inp = document.getElementById('noteInput');
  inp.value = 'Не ходите к скале после заката';
  inp.dispatchEvent(new Event('input'));
  document.getElementById('noteOk').click();

  out.note = ctx.boardNote;
  out.noteClosed = ctx.ui.noteOpen === false;
  out.modeAfter = ctx.mode;

  // текст действительно нарисован на доске
  let drawn = false;
  const g = ctx.scene.getObjectByName('noticeBoard');
  if (g) {
    g.traverse((o) => {
      if (o.isMesh && o.material.map && o.material.map.image
          && o.material.map.image.width === 512) {
        const cv = o.material.map.image;
        const c = cv.getContext('2d');
        const data = c.getImageData(0, 0, cv.width, cv.height).data;
        // ищем тёмные пиксели букв
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) dark++;
        }
        drawn = dark > 200;
      }
    });
  }
  out.drawn = drawn;

  // второй раз писать уже нельзя
  const it2 = (ctx.interactables || []).find((i) => (i.labelFn ? i.labelFn() : i.label) === 'Прочитать записку');
  out.readOnly = !!it2;
  out.saved = (() => { try { return localStorage.getItem('wv.note') || ''; } catch (e) { return ''; } })();
  return out;
});

const checks = [
  ['у доски есть интеракт «Написать на доске»', res.found],
  ['доска видна как ближайшая подсказка', res.nearest === 'Написать на доске'],
  ['окно записи открывается', res.mode === 'note' && res.noteOpen],
  ['во время записи игра на паузе', res.playerFrozen],
  ['надпись сохранена', res.note === 'Не ходите к скале после заката'],
  ['надпись нарисована на доске', res.drawn],
  ['окно записи закрылось', res.noteClosed && res.modeAfter !== 'note'],
  ['второй раз написать нельзя', res.readOnly],
  ['записка сохранилась в localStorage', res.saved === 'Не ходите к скале после заката'],
];

let bad = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) bad++;
}
console.log('\nдетали:', JSON.stringify(res));
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 6)) console.log('  ', e.slice(0, 200));
bad += errs.length;
console.log(`\nошибок: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
