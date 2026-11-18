import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 140)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(900);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// --- таверна: задняя дверь ---
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('tavern');
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const e = d.ctx.systems.locations.tavernLoc.barExit;
  d.camera.fov = 50; d.camera.updateProjectionMatrix();
  d.camera.position.set(e.x - 4.2, 2.1, e.z + 3.4);
  d.camera.lookAt(e.x + 0.3, 1.5, e.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R36_tavern_backdoor');
// --- таверна: бармен уходит к двери ночью ---
const npcInfo = await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.env.setTimeOfDay('night', true);
  const npc = d.ctx.systems.locations.npcs.barkeep;
  for (let i = 0; i < 260; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  return { x: +npc.x.toFixed(2), z: +npc.z.toFixed(2), away: !!npc.away, visible: npc.model?.group?.visible };
});
console.log('бармен:', JSON.stringify(npcInfo));
await page.evaluate(() => {
  const d = window.__dbg;
  const npc = d.ctx.systems.locations.npcs.barkeep;
  d.camera.fov = 46; d.camera.updateProjectionMatrix();
  d.camera.position.set(npc.x - 2.6, 1.9, npc.z + 2.4);
  d.camera.lookAt(npc.x, 1.2, npc.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(700);
await grab('R36_barkeep_leaves');
// --- храм ---
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('church');
});
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 1.85, -6.6);
  d.camera.lookAt(0, 2.6, 6.0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R36_church_nave');
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 55; d.camera.updateProjectionMatrix();
  d.camera.position.set(-2.4, 1.7, 1.6);
  d.camera.lookAt(0.6, 2.4, 7.6); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R36_church_altar');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
