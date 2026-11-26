/**
 * Раунд 64 — съёмка подземелья «как есть»: оба яруса, залы, шахта, Врата.
 *
 * Запуск: cd /workspace/village && node dev/r64_dungeon_shots.mjs
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
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2000);

/* ---- верхний ярус ---- */
await shot('R64_dg_entry', [0, 1.7, -32], [0, 1.5, -20]);
await shot('R64_dg_entry_corner', [-10, 1.7, -32], [10, 1.4, -20]);
// печать входа: барьер в проёме
await shot('R64_dg_seal_closed', [0, 1.6, -23.5], [0, 1.9, -20]);
// та же точка, но печать уже пала
await page.evaluate(() => window.__dbg.dungeonLoc.openSeal('hall'));
await shot('R64_dg_seal_open', [0, 1.6, -23.5], [0, 1.9, -20]);
await shot('R64_dg_crystal', [0, 1.7, -18], [0, 1.8, 5]);
await shot('R64_dg_crystal_corner', [-13, 1.7, -18], [13, 1.5, 4]);
await shot('R64_dg_crystal_wall', [0, 1.7, -6], [-14, 2.6, -12]);
await shot('R64_dg_shaft', [0, 1.7, 3], [0, -2.6, 12]);

/* ---- нижний ярус ---- */
await shot('R64_dg_gates', [0, -2.9, 16], [0, -2.4, 34]);
await shot('R64_dg_gates_corner', [-12, -2.9, 17], [12, -2.4, 33]);
await shot('R64_dg_altar', [0, -2.6, 25], [0, -1.6, 33]);
// печать Врат: кольцо рун на полу у алтаря
await shot('R64_dg_gateseal', [0, -3.2, 26.5], [0, -4.4, 31.8]);

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
