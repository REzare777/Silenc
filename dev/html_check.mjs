/** Проверка однофайловой версии: файл открывается и игра запускается. */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const file = process.argv[2] || '/workspace/whispervale-village.html';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await page.goto('file://' + file, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const d = window.__dbg;
  let meshes = 0, instances = 0;
  d.scene.traverse((o) => { if (o.isMesh) meshes++; if (o.isInstancedMesh) instances += o.count; });
  return {
    meshes, instances,
    interact: d.ctx.interactables.length,
    forest: !!d.scene.getObjectByName('forest'),
    castSpots: (d.castSpots || []).length,
  };
});
console.log('HTML-файл ОК:', JSON.stringify(info), '| ошибок:', errs.length, errs.slice(0, 3));
await browser.close();
