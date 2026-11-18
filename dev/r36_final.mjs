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
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(800);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// 1. фасад двухэтажного дома
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const h = d.ctx.homes[4];
  d.camera.fov = 50; d.camera.updateProjectionMatrix();
  d.camera.position.set(h.x - Math.sin(h.ry) * 15, 3.4, h.z - Math.cos(h.ry) * 15);
  d.camera.lookAt(h.x, 3.2, h.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R36_two_storey');
// 2. закрытая дверь обычного дома (без грубых перевязей)
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const h = d.ctx.homes[0];
  d.camera.fov = 46; d.camera.updateProjectionMatrix();
  d.camera.position.set(h.x - Math.sin(h.ry) * 7.5, 1.7, h.z - Math.cos(h.ry) * 7.5);
  d.camera.lookAt(h.x, 1.3, h.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(900);
await grab('R36_locked_door');
// 3. таверна: бармен уходит через заднюю дверь
await page.evaluate(() => { window.__dbg.ctx.systems.locations.setLocation('tavern'); });
await page.waitForTimeout(1200);
const npcInfo = await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.env.setTimeOfDay('night', true);
  const npc = d.ctx.systems.locations.npcs.barkeep;
  for (let i = 0; i < 230; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  d.player.enabled = false;
  const e = d.ctx.systems.locations.tavernLoc.barExit;
  d.camera.fov = 50; d.camera.updateProjectionMatrix();
  d.camera.position.set(e.x - 3.6, 2.0, e.z + 2.6);
  d.camera.lookAt(npc.x, 1.3, npc.z); d.camera.updateMatrixWorld();
  return { x: +npc.x.toFixed(2), z: +npc.z.toFixed(2), visible: npc.group.visible };
});
console.log('бармен у двери:', JSON.stringify(npcInfo));
await page.waitForTimeout(700);
await grab('R36_barkeep_leaves');
// 4. храм
await page.evaluate(() => { window.__dbg.ctx.systems.locations.setLocation('church'); });
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 1.85, -6.6);
  d.camera.lookAt(0, 2.6, 6.0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R36_church_nave');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
