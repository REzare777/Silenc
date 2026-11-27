/**
 * Раунд 67 — разведка: дорога к скале, вход в пещеру, лестница в шахте.
 *
 * Запуск: cd /workspace/village && node dev/r67_probe.mjs
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

/* ---- дорога к скале: общий вид с выезда из села ---- */
await shot('R67_trail_start', [-6, 3.2, -16], [-40, 1.5, -42]);

/* ---- дорога в лесу: плиты и бордюр вблизи ---- */
await shot('R67_trail_mid', [-30, 2.0, -36], [-44, 0.6, -48]);

/* ---- дорога вдали: как она читается издалека ---- */
await shot('R67_trail_far', [-22, 2.4, -30], [-60, 1.0, -55]);

/* ---- вход в пещеру: скала, проём, лестница ---- */
await shot('R67_cave_front', [-60, 2.6, -54], [-70, 1.6, -63]);

/* ---- вход в пещеру сбоку: тоннель и ступени вниз ---- */
await shot('R67_cave_side', [-66, 2.0, -68], [-68, 1.2, -60]);

/* ---- подход к подножию лестницы ---- */
await shot('R67_cave_foot', [-66, 1.9, -58], [-68, 2.0, -63]);

/* ---- подземелье: входной зал и портал ---- */
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2500);
await shot('R67_dungeon_hall', [0, 2.2, -26], [0, 1.2, -34]);

/* ---- подземелье: шахта с лестницей вниз ---- */
await shot('R67_dungeon_shaft', [0, 2.4, 2], [0, 0.4, 10]);

/* ---- подземелье: зал Врат ---- */
await shot('R67_dungeon_gate', [0, -2.8, 22], [0, -3.4, 32]);

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
