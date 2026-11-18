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
await page.waitForTimeout(1000);
const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};
// винтов��вая лестница мельницы изнутри
await page.evaluate(() => {
  const d = window.__dbg;
  const sp = (d.ctx.platforms || []).find((pl) => pl.sp).sp;
  const a = sp.a0 + Math.PI * 0.9;
  const r = (sp.rIn + sp.rOut0) / 2;
  d.player.enabled = false;
  d.camera.position.set(sp.cx + Math.sin(a) * r, 3.2, sp.cz + Math.cos(a) * r);
  d.camera.lookAt(sp.cx, 1.4, sp.cz); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(800);
await grab('R35_mill_stairs');
// новая планировка: вид вдоль улицы с юга на север
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 60; d.camera.updateProjectionMatrix();
  d.camera.position.set(-2, 5.5, -12);
  d.camera.lookAt(2, 2.0, 24); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(800);
await grab('R35_town_street');
// пара домов: вид сверху-сбоку, видно дворы между участками
await page.evaluate(() => {
  const d = window.__dbg;
  d.camera.fov = 50; d.camera.updateProjectionMatrix();
  d.camera.position.set(26, 11, 2);
  d.camera.lookAt(-10, 0.5, 22); d.camera.updateMatrixWorld();
});
await page.waitForTimeout(800);
await grab('R35_houses_rows');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
