/**
 * ============================================================================
 *  Снимки раунда 39: таверна, храм и новая планировка домов
 * ============================================================================
 */

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
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(700);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// 1. таверна: фасад с дверью (проверяем цоколь и крыльцо)
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const door = d.ctx.doors.tavern, ry = d.ctx.doors.tavernRy;
  const c = Math.cos(ry), s = Math.sin(ry);
  // дверь = локальная точка (0, -9.5) фасада
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz + 9.5) * s,
    z: door.z - lx * s + (lz + 9.5) * c,
  });
  const cam = w(0, -14.6), look = w(0, -9.3);
  d.camera.fov = 60; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 1.65, cam.z);
  d.camera.lookAt(look.x, 1.35, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_tavern_facade');

// 2. храм: башня-колокольня спереди, как и прежде
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.church, ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  // дверь = локальная точка (0, -14.2)
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz + 14.2) * s,
    z: door.z - lx * s + (lz + 14.2) * c,
  });
  const cam = w(3.2, -21.5), look = w(0, -12.2);
  d.camera.fov = 60; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 2.1, cam.z);
  d.camera.lookAt(look.x, 3.4, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_church_tower');

// 3. храм сзади: сломанная дверь нефа
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.churchBack, ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  // точка выхода = локальная (0, 10.6)
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz - 10.6) * s,
    z: door.z - lx * s + (lz - 10.6) * c,
  });
  const cam = w(3.4, 14.6), look = w(0, 9.0);
  d.camera.fov = 60; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 1.9, cam.z);
  d.camera.lookAt(look.x, 1.7, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_church_back_door');

// 4. дом у пруда: с лужайки
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(40, 3.2, -8);
  d.camera.lookAt(28, 1.8, -20); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_house_by_pond');

// 5. таверна с улицы (широкий ракурс)
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(-2, 3.0, -2);
  d.camera.lookAt(-17, 2.2, -13); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_tavern_street');

// 6. общий вид деревни с юга
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(4, 34, -78);
  d.camera.lookAt(2, 0, 8); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1000);
await grab('R39_village_overview');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
