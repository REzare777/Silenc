/**
 * Раунд 52: кадры сезонов — весна, лето, осень, зима.
 * Запуск: cd dev && node r52_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 300000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R52_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// вид от площади на колокольню — там видно и лес, и поля
const place = async (season, day) => {
  await page.evaluate(({ season, day }) => {
    const d = window.__dbg;
    d.ctx.calendar.restore(day, season, 1);
    d.player.enabled = false;
    // дневной свет: в сумерках сезон не читается
    d.env.setTimeOfDay('day', true);
    d.camera.position.set(0, 2.2, 20);
    d.camera.lookAt(3, 4.5, 50);
    d.camera.updateMatrixWorld();
  }, { season, day });
  // софт-рендер даёт по 10–25 секунд на кадр: чтобы покров успел
  // набрать силу, «прокручиваем» его вручную
  await page.evaluate(() => {
    const d = window.__dbg;
    for (let i = 0; i < 120; i++) {
      d.snow.updateCover(1 / 60);
      d.snow.update(1 / 60, { x: 0, y: 0, z: 0 }, true);
    }
  });
  await page.waitForTimeout(900);
};

for (const [season, day] of [['spring', 2], ['summer', 7], ['autumn', 12], ['winter', 17]]) {
  await place(season, day);
  await grab(season);
}

// зима: снег крупным планом
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.calendar.restore(17, 'winter', 1);
  d.player.enabled = false;
  d.env.setTimeOfDay('day', true);
  d.camera.position.set(2, 1.7, 8);
  d.camera.lookAt(2, 1.2, 26);
  d.camera.updateMatrixWorld();
});
await page.evaluate(() => {
  const d = window.__dbg;
  for (let i = 0; i < 120; i++) {
    d.snow.updateCover(1 / 60);
    d.snow.update(1 / 60, { x: 0, y: 0, z: 0 }, true);
  }
});
await page.waitForTimeout(1200);
await grab('winter_close');

await browser.close();
