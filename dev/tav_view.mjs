/**
 * Точечные кадры: фасад таверны (без прилавков в кадре) и сокрытие скалы.
 * Запуск: cd dev && node tav_view.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'T';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
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
  const d = window.__dbg;
  const t = d.ctx.doors.tavern;           // точка двери
  const ry = d.ctx.doors.tavernRy;        // поворот фасада
  return { x: t.x, z: t.z, fx: -Math.sin(ry), fz: -Math.cos(ry) };
});
console.log('дверь:', JSON.stringify(tav));

// фасад с улицы (выше прилавков, сбоку)
await shot('facade', [tav.x + tav.fx * 20, 6.5, tav.z + tav.fz * 20], [tav.x, 3.0, tav.z]);
// фасад с уровня земли, но со свободной точки
await shot('street', [tav.x + tav.fx * 17 - tav.fz * 5, 1.9, tav.z + tav.fz * 17 + tav.fx * 5],
  [tav.x, 2.6, tav.z]);
// скала подземелья из леса — видно ли её
await shot('hidden', [-44, 2.4, -32], [-72, 1.5, -66]);
// опушка леса со стороны деревни
await shot('wall', [0, 1.7, 30], [0, 7.0, 56]);

await browser.close();
