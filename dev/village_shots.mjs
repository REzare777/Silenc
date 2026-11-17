/**
 * Кадры после правок: фасад таверны, ступени, дороги, опушка леса.
 * Запуск: cd dev && node village_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'V';
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
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1500);

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

const tav = await page.evaluate(() => {
  const t = window.__dbg.ctx.doors.tavern;
  return { x: t.x, z: t.z, ry: t.ry, fx: -Math.sin(t.ry), fz: -Math.cos(t.ry) };
});

// 1. фасад таверны прямо
await shot('tavern_front', [tav.x + tav.fx * 8, 2.4, tav.z + tav.fz * 8],
  [tav.x + tav.fx * 1.5, 3.2, tav.z + tav.fz * 1.5]);
// 2. фасад таверны с угла — видно восточный фасад с высоким окном
await shot('tavern_side', [tav.x + tav.fx * 6 + tav.fz * 11, 3.0, tav.z + tav.fz * 6 - tav.fx * 11],
  [tav.x, 3.2, tav.z]);
// 3. ступеньки дома [-11, 8] (фасад смотрит в центр)
await shot('porch', [-5.3, 1.5, 2.9], [-11, 1.1, 8]);
// 4. крыльцо церкви
await shot('church', [1.9, 1.8, 27], [3, 2.2, 36]);
// 5. перекрёсток дорог
await shot('roads', [12, 3.0, 16], [0, 0.3, 0]);
// 6. опушка леса с юга
await shot('forest_edge', [0, 1.7, 42], [0, 6.0, 62]);
// 7. тропа к пещере в лесу
await shot('trail', [-40, 1.8, -28], [-52, 1.2, -42]);

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
