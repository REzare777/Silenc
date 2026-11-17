/**
 * Кадры раунда 32: интерьеры домов-локаций + часы времени суток.
 * Запуск: cd dev && node r32_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1200);

const shot = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R32_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// войти в дом i и снять интерьер
const enterHouse = async (i, camPos, camLook) => {
  await page.evaluate(({ i, camPos, camLook }) => {
    const d = window.__dbg;
    d.ctx.env.setTimeOfDay('day', true);
    const doors = d.ctx.interactables.filter((x) => x.label === 'Войти в дом');
    doors[i].act();
    d.player.enabled = false;
    d.camera.position.set(camPos[0], camPos[1], camPos[2]);
    d.camera.lookAt(camLook[0], camLook[1], camLook[2]);
    d.camera.updateMatrixWorld();
  }, { i, camPos, camLook });
  await page.waitForTimeout(900);
  await shot(`home${i}`);
};

// 0 — кухня с печью
await enterHouse(0, [2.4, 1.9, -1.6], [-2.0, 1.0, 1.4]);
// 5 — общая зала с большим столом
await enterHouse(5, [2.3, 1.9, -1.7], [-0.6, 0.9, 1.2]);
// 7 — оружейная
await enterHouse(7, [-2.2, 1.9, -1.6], [2.2, 1.2, 0.4]);
// 10 — ткацкая
await enterHouse(10, [2.3, 1.9, -1.6], [-0.4, 1.1, 1.2]);

// выйти обратно и снять деревню с часами
await page.evaluate(() => {
  const d = window.__dbg;
  const exit = d.ctx.interactables.find((x) => x.label === 'Выйти из дома');
  exit.act();
  d.player.enabled = false;
  d.camera.position.set(2, 3.2, 12);
  d.camera.lookAt(0, 1.6, 0);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await shot('village_clock');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
