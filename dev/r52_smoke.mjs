/**
 * Раунд 52: смоук-тест кнопок «Сохранить игру» и «Продолжить».
 * Проверяет то, чего не проверяет r52_check: реальные клики по DOM.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

const out = {};

// 1. играем: ставим монеты, перемещаемся, сохраняем через меню паузы
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.stats.coins = 42;
  d.ctx.player.teleport(3, 30, 1.0);
  d.ctx.calendar.nextDay();
});
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
out.pauseVisible = await page.evaluate(() =>
  !document.getElementById('pause')?.classList.contains('hidden'));
await page.click('#saveBtn');
await page.waitForTimeout(700);
out.saved = await page.evaluate(() => !!localStorage.getItem('wv.save.v1'));
out.saveCoins = await page.evaluate(() => JSON.parse(localStorage.getItem('wv.save.v1') || '{}').coins);
out.saveDay = await page.evaluate(() => JSON.parse(localStorage.getItem('wv.save.v1') || '{}').day);

// 2. перезагружаем страницу — кнопка «Продолжить» должна появиться
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
out.continueShown = await page.evaluate(() =>
  !document.getElementById('continue')?.classList.contains('hidden'));
out.continueLabel = await page.evaluate(() => document.getElementById('contDay')?.textContent);

// 3. жмём «Продолжить» — должны восстановиться монеты, день и позиция
await page.click('#continue');
await page.waitForTimeout(2500);
out.afterContinue = await page.evaluate(() => {
  const d = window.__dbg;
  return {
    coins: d.ctx.stats.coins,
    day: d.ctx.calendar.day,
    x: +d.ctx.player.pos.x.toFixed(1),
    z: +d.ctx.player.pos.z.toFixed(1),
    inGame: d.ctx.mode === 'play',
    date: document.getElementById('dateText')?.textContent,
  };
});

console.log(JSON.stringify(out, null, 1));
console.log('ошибок в консоли:', errs.length, errs.slice(0, 3));
await browser.close();
process.exit(errs.length ? 1 : 0);
