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
// 1. снаружи: звонарная сзади храма
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const door = d.ctx.doors.churchBack;
  const ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  // door соответствует локальной точке (0, 13.5) храма
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz - 13.5) * s,
    z: door.z - lx * s + (lz - 13.5) * c,
  });
  const cam = w(4.5, 17.0), look = w(0, 12.2);
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 3.4, cam.z);
  d.camera.lookAt(look.x, 3.2, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R38_bellhouse_out');
// 2. в нефе: сломанная дверь в арке звонарной
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.interactables.find((x) => x.label === 'Войти в храм').act();
});
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 60; d.camera.updateProjectionMatrix();
  d.camera.position.set(-2.3, 1.75, 6.3);
  d.camera.lookAt(-2.3, 1.45, 9.7); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R38_broken_door');
// 3. внутри звонарной: сломанная лестница
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('village');
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.interactables.find((x) => x.label === 'Войти в колокольню').act();
});
await page.waitForTimeout(1400);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.fov = 68; d.camera.updateProjectionMatrix();
  d.camera.position.set(2.4, 2.6, 10.9);
  d.camera.lookAt(-2.2, 2.0, 14.2); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R38_broken_stairs');
// 3. колокол наверху
await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(ch.bellPoint.x + 2.25, 6.25, ch.bellPoint.z + 3.3);
  d.camera.lookAt(ch.bellPoint.x - 0.2, 5.0, ch.bellPoint.z - 0.1);
  d.camera.updateMatrixWorld();
  d.ctx.interactables.find((x) => x.label === 'Ударить в колокол').act();
});
await page.waitForTimeout(900);
await grab('R38_bell_tower');
// 4. таверна: табличка «ДЛЯ ПЕРСОНАЛА» над задней дверью
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('tavern');
});
await page.waitForTimeout(1300);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const tv = d.ctx.systems.locations.tavernLoc;
  d.camera.fov = 55; d.camera.updateProjectionMatrix();
  d.camera.position.set(4.2, 1.8, tv.barExit.z + 1.6);
  d.camera.lookAt(7.1, 2.2, tv.barExit.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R38_tavern_sign');
// 5. снаружи таверны: боковая дверь с табличкой
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('village');
});
await page.waitForTimeout(1300);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  // берём матрицу самого здания таверны
  let g = null;
  d.ctx.scene.traverse((o) => { if (o.name === 'tavern' && o.isGroup) g = o; });
  g.updateMatrixWorld(true);
  const e = g.matrixWorld.elements;
  const L = (lx, ly, lz) => ({
    x: e[0] * lx + e[4] * ly + e[8] * lz + e[12],
    y: e[1] * lx + e[5] * ly + e[9] * lz + e[13],
    z: e[2] * lx + e[6] * ly + e[10] * lz + e[14],
  });
  const cam = L(11.4, 2.1, -6.7), look = L(7.8, 2.55, -6.7);
  d.camera.fov = 52; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, cam.y, cam.z);
  d.camera.lookAt(look.x, look.y, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R38_tavern_back_out');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
