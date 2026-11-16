/**
 * Крупные планы кроватей в нишах (диагностика/правка).
 * Запуск: cd dev && node bed_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R24';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
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

// где реально стоят кровати
const beds = await page.evaluate(() => window.__dbg.tavernLoc.rooms.map((r) => ({
  name: r.name, bedX: r.bedX, bedZ: r.bedZ, doorX: r.doorX, w: r.w,
})));
console.log('кровати:', JSON.stringify(beds));

const shots = [];
for (const b of beds) {
  const tag = b.name.replace(/[^a-zA-Zа-яА-Я]/g, '').slice(0, 6);
  shots.push([`${tag}_side`, [b.bedX + 1.5, 5.35, b.bedZ - 1.1], [b.bedX, 4.55, b.bedZ]]);
  shots.push([`${tag}_head`, [b.bedX + 0.9, 5.75, b.bedZ + 1.3], [b.bedX, 4.6, b.bedZ - 0.2]]);
  shots.push([`${tag}_top`, [b.bedX + 0.85, 6.35, b.bedZ + 0.7], [b.bedX, 4.5, b.bedZ - 0.1]]);
}

for (const [name, pos, look] of shots) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 60000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
