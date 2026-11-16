/**
 * Кадры ниш-комнат и выхода из лестницы (раунд 23).
 * Запуск: cd dev && node niche_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R23';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__dbg.setLocation('tavern'); });
await page.waitForTimeout(800);

const shots = [
  // выход из лестницы: точка высадки и вид вдоль галереи
  ['ladder_exit', [-4.0, 5.55, 4.5], [-7.0, 4.9, 4.5]],
  ['ladder_rails', [-3.0, 5.35, 5.2], [-7.1, 4.6, 3.7]],
  ['gallery_view', [-1.0, 5.5, 4.6], [-6.0, 4.8, 4.4]],
  // ниши — изнутри, от двери вглубь
  ['nicheA', [-1.6, 5.75, 6.1], [-2.6, 4.85, 8.5]],
  ['nicheA_bed', [-1.3, 5.75, 7.9], [-3.2, 4.85, 7.6]],
  ['nicheC', [5.2, 5.75, 6.1], [4.0, 4.85, 8.5]],
  ['nicheC_bed', [5.9, 5.75, 7.9], [3.6, 4.85, 7.6]],
  ['nicheB', [1.9, 5.75, 6.1], [0.4, 4.85, 8.5]],
];

for (const [name, pos, look] of shots) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 60000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
