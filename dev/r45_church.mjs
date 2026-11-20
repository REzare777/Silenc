/**
 * Раунд 45: кадры храма — неф, башня, фасад.
 * Запуск: cd dev && node r45_church.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R45CH';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// вход в храм
await page.evaluate(() => {
  const d = window.__dbg;
  const door = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  if (door) door.act();
});
await page.waitForTimeout(1500);

const put = async (x, z, yaw, pitch = 0, y = 1.68) => {
  // камеру ставим напрямую: игрок отключён, иначе update() не двигает камеру
  await page.evaluate(({ x, z, yaw, pitch, y }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    const cp = Math.cos(pitch), sp2 = Math.sin(pitch);
    d.camera.position.set(x, y, z);
    d.camera.lookAt(x - Math.sin(yaw) * cp, y + sp2, z - Math.cos(yaw) * cp);
    d.camera.updateMatrixWorld();
  }, { x, z, yaw, pitch, y });
  await page.waitForTimeout(400);
};

// неф: от портала на алтарь
await put(0, -4.5, Math.PI);
await grab('nave_entry');
await put(0, 0, Math.PI);
await grab('nave_mid');
await put(0, 3.5, Math.PI);
await grab('nave_altar');
// портал: вид изнутри
await put(0, 1.5, 0);
await grab('nave_portal');
await put(0, -1.0, 0, 0.05);
await grab('nave_portal_close');
await put(2.2, -2.0, 0.45, 0.1);
await grab('nave_portal_side');
await put(-2.2, -2.0, -0.45, 0.1);
await grab('nave_portal_side2');
// иконы на стенах
await put(2.0, -1.0, -Math.PI / 2);
await grab('nave_icons_w');
await put(-2.0, 1.5, Math.PI / 2);
await grab('nave_icons_e');
// дверь в башню (старая позиция)
await put(2.6, 6.2, Math.PI);
await grab('nave_tower_door');
// башня
await put(0, 18.2, 0);
await grab('tower_floor');
await put(0, 17.6, 0);
await grab('tower_stairs');
await put(0, 16.4, 0, -0.3);
await grab('tower_up');
await put(3.4, 17.0, 0.7, -0.15, 10.88);
await grab('tower_gallery');
await put(1.6, 15.9, 0.5, 0.25, 10.88);
await grab('tower_bell');
await put(0, 12.9, 0, 0.75, 10.88);
await grab('tower_top');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
