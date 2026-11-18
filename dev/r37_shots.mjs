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
await page.waitForTimeout(700);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// в храм
await page.evaluate(() => {
  const d = window.__dbg;
  const it = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  it.act();
});
await page.waitForTimeout(1400);
// 1. низ башни: лестница
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 66; d.camera.updateProjectionMatrix();
  d.camera.position.set(1.9, 2.1, -10.4);
  d.camera.lookAt(-1.9, 2.4, -6.6); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R37_tower_stairs');
// 2. площадка с колоколом
await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(ch.bellPoint.x - 2.4, 6.05, ch.bellPoint.z + 1.7);
  d.camera.lookAt(ch.bellPoint.x, 5.5, ch.bellPoint.z - 0.2);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R37_bell_tower');
// 3. неф
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 1.85, -3.2);
  d.camera.lookAt(0, 2.6, 8.0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R37_church_nave');
// 4. таверна: задняя дверь открыта и сени
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('tavern');
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = window.__dbg;
  const it = d.ctx.interactables.find((x) => x.label === 'Открыть заднюю дверь' && x.where === 'tavern');
  it.act();
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const tv = d.ctx.systems.locations.tavernLoc;
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(4.4, 1.9, tv.barExit.z + 2.2);
  d.camera.lookAt(8.6, 1.2, tv.barExit.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R37_tavern_backdoor');
// 5. снаружи: боковая дверь таверны
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('village');
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  // камера ставится по локальным осям таверны, иначе можно встать внутри стены
  const L = d.ctx.layout || null;
  const door = d.ctx.doors.tavernBack;
  const ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  const w = (lx, lz) => ({
    x: door.x - 8.5 * c + lx * c + lz * s,
    z: door.z + 8.5 * s - lx * s + lz * c,
  });
  const cam = w(12.2, -9.6), look = w(7.4, -6.7);
  d.camera.fov = 55; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 2.5, cam.z);
  d.camera.lookAt(look.x, 1.5, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R37_tavern_back_out');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
