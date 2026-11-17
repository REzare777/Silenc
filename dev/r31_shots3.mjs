import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 150)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1200);
const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg; d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]); d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R31_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// берём интеракт «Толкнуть дверь» — он стоит ровно у двери
const info = await page.evaluate(() => {
  const list = window.__dbg.ctx.interactables || [];
  const it = list.find((i) => (i.label || '') === 'Толкнуть дверь');
  if (!it) return null;
  const p = it.pos;
  // отойти от двери в сторону от центра деревни
  const l = Math.hypot(p.x, p.z) || 1;
  return { dx: p.x / l, dz: p.z / l, px: p.x, pz: p.z, label: it.label };
});
console.log('дверь:', JSON.stringify(info));
if (info) {
  await shot('house_door', [info.px + info.dx * 3.6, 1.8, info.pz + info.dz * 3.6], [info.px, 1.5, info.pz]);
}
await browser.close();
