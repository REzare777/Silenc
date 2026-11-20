/**
 * Раунд 43: кадры переработанного подземелья.
 *
 * Запуск: cd dev && node r43_dungeon.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R43';
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

// счётчик источников света в сцене подземелья
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(900);

const lights = await page.evaluate(() => {
  const d = window.__dbg;
  let point = 0, other = 0, tris = 0;
  d.sceneDungeon.traverse((o) => {
    if (o.isPointLight) point++;
    else if (o.isLight) other++;
    if (o.geometry && o.geometry.index) tris += o.geometry.index.count / 3;
    else if (o.geometry && o.geometry.attributes.position) tris += o.geometry.attributes.position.count / 3;
  });
  return { point, other, tris: Math.round(tris) };
});
console.log('свет подземелья:', JSON.stringify(lights));

// 1. входной зал у портала
await shot('entry', [0, 1.7, -27.5], [0, 1.5, -14]);
// 2. входной зал — вид назад к порталу
await shot('portal_back', [0, 1.7, -22], [0, 2.2, -33]);
// 3. кристальный зал с арками
await shot('arches', [0, 1.7, -17], [0, 2.4, -21]);
// 4. кристальный зал вдоль
await shot('hall', [0, 1.7, -14], [0, 2.0, 4]);
// 5. колонны и кристаллы
await shot('pillar', [-6, 1.7, -6.8], [-11.6, 2.2, -6.8]);
// 6. стена с пилястрами
await shot('wall', [0, 1.7, -10], [-14.3, 3.2, -9]);
// 7. край шахты
await shot('shaft_top', [0, 1.7, 3.5], [0, -1.6, 10]);
// 8. спуск в шахте
await shot('shaft_down', [0, -1.5, 8], [0, -3.6, 13.5]);
// 9. зал Врат
await shot('gate_hall', [0, -2.9, 16], [0, -2.4, 30]);
// 10. алтарь
await shot('altar', [0, -2.6, 24], [0, -2.0, 31.5]);
// 11. низ зала Врат — кости
await shot('bones', [0, -2.6, 24], [8, -3.4, 27]);
// 12. тёплый факел
await shot('torch', [-10.5, 2.0, -30.5], [-11.1, 2.9, -30.5]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
