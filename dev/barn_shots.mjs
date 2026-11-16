/**
 * Кадры второго этажа амбара (сеновала) — где видно наружу.
 * Запуск: cd dev && node barn_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'B1';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
await page.evaluate(() => { window.__dbg.setLocation('barn'); });
await page.waitForTimeout(800);

// сеновал: настил на H1 = 4.3
const shots = [
  ['west_day', [-4.6, 5.9, 0], [-6.6, 5.2, 0]],
  ['north_day', [0, 5.9, 0], [0, 5.2, 4.6]],
  ['south_day', [0, 5.9, 0], [0, 5.2, -4.6]],
  ['gable_west', [0, 5.9, 0], [-6.5, 8.6, 0]],
  ['loft_overview', [5.0, 7.0, 3.2], [-3.0, 5.2, -2.0]],
];

// прячем материалы по карте, чтобы понять, что за щелью
async function hideMaterials(keys) {
  await page.evaluate((keys) => {
    const d = window.__dbg;
    const maps = keys.map((k) => d.M[k] && d.M[k].map).filter(Boolean);
    d.barnLoc.group.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const m = o.material;
      if (maps.includes(m.map)) o.visible = false;
    });
  }, keys);
}

for (const [name, pos, look] of shots) {
  if (name === 'hide_plaster') await hideMaterials(['plasterWarm']);
  if (name === 'hide_plaster_timber') await hideMaterials(['plasterWarm', 'timber', 'oakDoor']);
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

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
