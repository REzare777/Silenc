/**
 * Кадры бармена и диалогового окна.
 * Запуск: cd dev && node npc_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R25';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.waitForTimeout(900);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(1400);
await page.evaluate(() => { window.__dbg.setLocation('tavern'); });
await page.waitForTimeout(700);

// бармен стоит в удобной позе (посреди маршрута)
await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.npcs.barkeep;
  b.x = 6.28; b.z = 0.35;
  for (let i = 0; i < 40; i++) d.updateNpc(1 / 30, i / 30);
});

const shots = [
  ['bar_hall', [3.6, 1.7, -1.2], [6.3, 1.25, 0.35]],
  ['bar_guest', [4.6, 1.65, 1.2], [6.3, 1.3, 0.35]],
  ['bar_close', [5.2, 1.55, -0.4], [6.3, 1.35, 0.35]],
  ['bar_behind', [6.0, 1.5, 3.4], [6.28, 1.2, 0.5]],
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
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

// окно диалога — снимок всей страницы (DOM поверх сцены)
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.camera.position.set(4.6, 1.7, -0.4);
  d.camera.lookAt(6.42, 1.2, 0.4);
  d.camera.updateMatrixWorld();
  d.dialog.open('barkeep');
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/${TAG}_dialog.png` });
console.log('снимок: dialog');
await page.evaluate(() => window.__dbg.dialog.close());

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
