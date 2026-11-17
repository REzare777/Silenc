import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('ERR ' + e.message.slice(0, 120)));
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
  fs.writeFileSync(`${OUT}/R33_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// снаружи: портал храма
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.church;
  d.player.enabled = false;
  d.camera.position.set(door.x + Math.sin(door.ry) * -7.5, 2.6, door.z + Math.cos(door.ry) * -7.5);
  d.camera.lookAt(door.x, 2.4, door.z); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(600);
await grab('church_portal');

// интерьер храма
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.interactables.find((x) => x.label === 'Войти в храм').act();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const d = window.__dbg; d.player.enabled = false;
  d.camera.position.set(0, 1.7, -6.0);
  d.camera.lookAt(0, 2.2, 6.0); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(500);
await grab('church_nave');
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.position.set(-2.2, 1.6, 1.2);
  d.camera.lookAt(2.6, 2.0, -2.4); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(500);
await grab('church_altar');
// запертый дом снаружи
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.locations.setLocation('village');
});
await page.waitForTimeout(900);
const homePos = await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.doors.homes[5];
  d.player.enabled = false;
  const rx = door.x - Math.sin(door.ry) * 7.0;
  const rz = door.z - Math.cos(door.ry) * 7.0;
  d.camera.position.set(rx, 2.4, rz);
  d.camera.lookAt(door.x, 1.7, door.z); d.camera.updateMatrixWorld();
  return { x: +rx.toFixed(1), z: +rz.toFixed(1) };
});
await page.waitForTimeout(500);
await grab('locked_house');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
