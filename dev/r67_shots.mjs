/**
 * Раунд 67 — снимки: дорога к скале, дом игрока, скала, шахта.
 *
 * Запуск: cd /workspace/village && node dev/r67_shots.mjs
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

/** Снять кадр с заданной камеры. */
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

/* ---- дорога: как она читается с выезда из села ---- */
await shot('R67_road_village', [-6, 3.2, -16], [-40, 1.5, -42]);

/* ---- дорога в лесу: сплошное полотно, без плит и столбов ---- */
await shot('R67_road_forest', [-52, 2.2, -55], [-64, 1.0, -61]);

/* ---- дом игрока: подход по ответвку от дороги ---- */
await shot('R67_house_road', [-61.5, 2.3, -58.5], [-59.2, 1.5, -66]);

/* ---- дом игрока и скала вместе (с юго-востока) ---- */
await shot('R67_house_cliff', [-51, 3.4, -73], [-65, 2.0, -65]);

/* ---- доска для записки у дома ---- */
await shot('R67_board', [-56.5, 1.7, -59.5], [-58.6, 1.3, -62]);

/* ---- скала: фасад с новой породой камня ---- */
await shot('R67_cliff_face', [-62, 2.4, -57], [-70, 2.0, -63]);

/* ---- скала сбоку: тоннель за порогом закрыт ---- */
await shot('R67_cliff_side', [-64, 2.0, -73], [-69, 1.6, -62]);

/* ---- подземелье: шахта — вместо лестницы каменный парапет ---- */
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2500);
await shot('R67_dungeon_shaft', [0, 2.4, 2], [0, 0.4, 10]);

/* ---- дом игрока: интерьер с кроватью ---- */
await page.evaluate(() => window.__dbg.setLocation('home10'));
await page.waitForTimeout(2500);
await shot('R67_home_inside', [1.6, 1.7, 2.1], [-1.6, 0.7, -0.6]);

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
