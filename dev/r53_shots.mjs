/**
 * Раунд 53: кадры титульного экрана, окна загрузки и экрана смерти.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

// немного данных, чтобы «Продолжить» было видно
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.stats.coins = 137;
  d.saveGame(true);
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/R53_title.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: title');

// окно загрузки
await page.click('#loadGame');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/R53_slots.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: slots');

// входим в игру
await page.evaluate(() => document.getElementById('slots').classList.remove('on'));
// JS-клик: у кнопок есть hover-трансформация, из-за которой playwright
// не может вычислить точку попадания
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);
console.log('после клика:', JSON.stringify(await page.evaluate(() => ({
  startGone: document.getElementById('start').classList.contains('gone'),
  mode: window.__dbg.ctx.mode,
  hasUi: !!window.__dbg.ui,
  playerEnabled: window.__dbg.ctx.player.enabled,
}))));

// кадр падения: камера валится на землю (экран смерти пока скрыт)
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.death.kill('Тень забрала вас в пещере. Тьма сомкнулась.');
  // софт-рендер: 1 кадр за ~900 мс, поэтому падение «прокручиваем» вручную
  for (let i = 0; i < 45; i++) d.ctx.systems.death.update(1 / 60);
  d.ui.hideDeath();          // экран смерти покажем следующим кадром
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/R53_fall.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: fall');

// экран смерти
await page.evaluate(() => {
  const d = window.__dbg;
  for (let i = 0; i < 90; i++) d.ctx.systems.death.update(1 / 60);
});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/R53_death.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: death');

await browser.close();
