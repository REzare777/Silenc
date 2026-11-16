/**
 * Кадры бара и второго этажа (раунд 22). Временный инструмент.
 * Запуск: cd dev && node bar_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import fs from 'fs';

const TAG = process.argv[2] || 'R22';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
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
await page.waitForTimeout(600);

const shots = [
  ['gallery_edge', [0.6, 1.9, 1.4], [-1.4, 4.8, 4.6]],
  ['gallery_pillars', [1.6, 2.2, 1.0], [-3.2, 4.7, 4.4]],
  ['gallery_walk', [-1.0, 5.6, 4.2], [2.0, 5.2, 6.0]],
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
