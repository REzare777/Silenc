/**
 * Раунд 51: кадры боёвки — факел в руке, тень, вспышка, HUD.
 * Запуск: cd dev && node r51_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

// заходим в подземелье
await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const it = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  p.teleport(it.pos.x + 1.2, it.pos.z + 1.2, 0);
  p.y = 0; p.groundY = 0;
  it.act();
  await new Promise((r) => setTimeout(r, 200));
});
await page.waitForTimeout(1500);

const grab = async (name) => {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 300000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R51_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

// 1. факел в руке, вид от первого лица
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = false;          // иначе игрок перезапишет камеру
  const sh = d.ctx.systems.shadows;
  const s = sh.list[0];
  const p = d.player;
  p.teleport(s.x + 0.4, s.z - 2.6, 0);
  p.y = 0; p.groundY = 0;
  p.yaw = Math.atan2(-(s.x - p.pos.x), -(s.z - p.pos.z));
  p.pitch = -0.05;
  d.camera.position.set(p.pos.x, 1.68, p.pos.z);
  d.camera.lookAt(s.x, 1.2, s.z);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(600);
await grab('torch_hand');

// 2. тень крупно
await page.evaluate(() => {
  const d = window.__dbg;
  const s = d.ctx.systems.shadows.list[0];
  // свет игрока идёт от позиции игрока — переносим и его, иначе кадр тёмный
  d.player.teleport(s.x + 1.6, s.z - 1.9, 0);
  d.player.y = 0; d.player.groundY = 0;
  d.camera.position.set(s.x + 1.6, 1.5, s.z - 1.9);
  d.camera.lookAt(s.x, 0.9, s.z);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(600);
await grab('shadow');

// 3. вспышка: свет и разброс
await page.evaluate(() => {
  const d = window.__dbg;
  const c = d.ctx.systems.combat;
  c.state.flashCd = 0;
  c.flare();
  // софт-рендер тратит по 10–25 секунд на кадр: вспышка (1,2 с)
  // успела бы погаснуть до отрисовки — держим её включённой
  c.state.flashTime = 6;
  // свет вспышки — фонарь игрока: он должен быть рядом с камерой
  const L = d.ctx.systems.locations.dungeonLoc.lights.lantern;
  if (L) {
    L.position.set(d.camera.position.x, d.camera.position.y - 0.4, d.camera.position.z);
    L.intensity = 15;
    L.distance = 26;
  }
});
await page.waitForTimeout(600);
const fl = await page.evaluate(() => {
  const d = window.__dbg;
  const L = d.ctx.systems.locations.dungeonLoc.lights.lantern;
  const c = d.ctx.systems.combat;
  return { flashTime: +c.state.flashTime.toFixed(2), li: L.intensity, ld: L.distance, lp: L.position.toArray().map(v => +v.toFixed(2)), cam: d.camera.position.toArray().map(v => +v.toFixed(2)) };
});
console.log('вспышка:', fl);
await grab('flash');

// 4. кристальный зал целиком
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.teleport(0, -16, 0);
  d.player.y = 0; d.player.groundY = 0;
  d.camera.position.set(0, 6.5, -16);
  d.camera.lookAt(0, 1.0, 2);
  d.camera.updateMatrixWorld();
});
await page.waitForTimeout(600);
await grab('hall');

await browser.close();
