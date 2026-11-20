/**
 * Проверка опубликованной сборки: игра грузится, ошибок нет, мир на месте.
 *
 * Запуск: cd dev && node public_check.mjs [url]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.argv[2] || 'https://rezare777.github.io/Silenc/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text().slice(0, 200)); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const d = window.__dbg;
  let meshes = 0, inst = 0, lights = 0;
  d.ctx.scene.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.isInstancedMesh) inst++;
    if (o.isPointLight && o.visible) lights++;
  });
  const f = d.ctx.campfirePos || {};
  const ch = d.churchLoc;
  return {
    meshes, inst, lights,
    fire: { x: f.x, z: f.z },
    naveDoor: ch && ch.naveDoor ? { x: ch.naveDoor.x, w: ch.naveDoor.w, closed: ch.naveDoor.closed } : null,
    interacts: d.ctx.interactables.length,
    chunks: (d.ctx.forestChunks || []).length,
  };
});

console.log('URL:', URL);
console.log('мешей:', info.meshes, '| инстанс-мешей:', info.inst, '| точечных источников:', info.lights);
console.log('костёр:', JSON.stringify(info.fire), '| чанков леса:', info.chunks);
console.log('дверь храма:', JSON.stringify(info.naveDoor));
console.log('взаимодействий:', info.interacts);
console.log('ошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e);
await browser.close();
process.exit(errs.length ? 1 : 0);
