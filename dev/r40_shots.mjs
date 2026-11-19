/**
 * ============================================================================
 *  Снимки раунда 40: храм снаружи, двери, звонарная и лестница к колоколу
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

/* ---------- 1. фасад храма: башня, дверь, фонари ---------- */
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  const door = d.ctx.doors.church, ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz + 14.2) * s,
    z: door.z - lx * s + (lz + 14.2) * c,
  });
  const cam = w(2.6, -21.0), look = w(0, -12.4);
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 2.0, cam.z);
  d.camera.lookAt(look.x, 3.2, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_church_front');

/* ---------- 2. храм сбоку: видны стыки крыши и башни ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.church, ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz + 14.2) * s,
    z: door.z - lx * s + (lz + 14.2) * c,
  });
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(-16, 11, 24);
  d.camera.lookAt(3, 4, 43); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_church_side');

/* ---------- 3. задняя дверь нефа снаружи ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.churchBack, ry = door.ry;
  const c = Math.cos(ry), s = Math.sin(ry);
  const w = (lx, lz) => ({
    x: door.x + lx * c + (lz - 10.6) * s,
    z: door.z - lx * s + (lz - 10.6) * c,
  });
  const cam = w(3.0, 15.2), look = w(0, 9.2);
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(cam.x, 1.9, cam.z);
  d.camera.lookAt(look.x, 1.7, look.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_church_back');

/* ---------- 4. вход в звонарную: свободный пол у двери ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  const enter = d.ctx.interactables.find((x) => x.label === 'Войти в звонарку');
  if (enter) enter.act();
  d.player.enabled = false;
  d.camera.fov = 66; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 1.7, 15.7);
  d.camera.lookAt(0, 1.4, 10.0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_belfry_entry');

/* ---------- 4b. дверь наружу изнутри звонарной ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(0, 1.7, 14.6);
  d.camera.lookAt(0, 1.6, 16.4); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_belfry_door');

/* ---------- 5. лестница в звонарной ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 66; d.camera.updateProjectionMatrix();
  d.camera.position.set(-1.9, 1.6, 14.6);
  d.camera.lookAt(0.4, 2.6, 11.4); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_belfry_stairs');

/* ---------- 6. колокол наверху ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 62; d.camera.updateProjectionMatrix();
  d.camera.position.set(0.3, 5.7, 15.5);
  d.camera.lookAt(2.3, 5.1, 13.4); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_bell');

/* ---------- 6b. стык башни и нефа: там раньше были артефакты ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 58; d.camera.updateProjectionMatrix();
  d.camera.position.set(3.0, 4.2, 28);
  d.camera.lookAt(3.0, 6.0, 38); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(1200);
await grab('R40_church_seam');

/* ---------- 7. спавн в храме: игрок смотрит вглубь нефа ---------- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  const enter = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  if (enter) enter.act();
});
await page.waitForTimeout(1400);
await grab('R40_church_spawn');

console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
