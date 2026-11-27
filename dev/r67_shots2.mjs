/**
 * Раунд 67 — снимки (вторая партия): скала после правки породы, дом игрока.
 *
 * Запуск: cd /workspace/village && node dev/r67_shots2.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

async function shot(name, pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

/* ---- скала: фасад (порода, трещины, мох) ---- */
await shot('R67b_cliff_face', [-62, 2.4, -57], [-70, 2.0, -63]);

/* ---- скала сбоку ---- */
await shot('R67b_cliff_side', [-64, 2.0, -73], [-69, 1.6, -62]);

/* ---- дом игрока и скала вместе ---- */
await shot('R67b_house_cliff', [-51, 3.4, -73], [-65, 2.0, -65]);

/* ---- дорога от села: как она читается с выезда ---- */
await shot('R67b_road_village', [-1.5, 3.2, -12], [-30, 0.8, -37]);

/* ---- дом игрока: интерьер (кровать видна от порога) ---- */
await page.evaluate(() => window.__dbg.setLocation('home10'));
await page.waitForTimeout(2500);
await shot('R67b_home_inside', [1.9, 1.7, -1.6], [-2.0, 0.6, 0.4]);

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
