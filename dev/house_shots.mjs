/**
 * Кадры интерьеров домов (раунд 31): вид изнутри и со стороны фасада.
 * Запуск: cd dev && node house_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R31';
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

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// дом (-11, 8): смотрит в центр деревни -> фасад на юго-запад
// найдём мировые координаты двери через place-логику
const home = await page.evaluate(() => {
  const d = window.__dbg;
  const g = d.scene.getObjectByName('cottage');
  return g ? g.position.toArray() : null;
});
console.log('первый дом:', home);

// вид изнутри дома (комната, очаг, стол)
await shot('house_in1', [-11.6, 1.75, 6.6], [-12.8, 1.1, 9.4]);
await shot('house_in2', [-9.4, 1.75, 9.6], [-12.2, 1.0, 7.2]);
// вид снаружи на фасад с крыльцом
await shot('house_front', [-14.6, 2.1, 3.6], [-11.0, 1.6, 8.0]);
// дом (28,13) — двухэтажный: антресоль
await shot('house2_in', [26.0, 1.8, 11.0], [28.0, 4.2, 14.5]);
await shot('house2_mezz', [28.0, 4.4, 14.2], [26.2, 3.2, 11.4]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
