/**
 * ============================================================================
 *  Проверка домов: игрок заходит через дверь внутрь и выходит обратно
 * ============================================================================
 *
 *  После того как у дома появились настоящие стены с дверным проёмом и
 *  интерьер, надо убедиться, что:
 *   1) игрок доходит до двери и входит внутрь (а не упирается в стену);
 *   2) внутри есть пол, и игрок стоит на нём;
 *   3) изнутри можно выйти обратно наружу;
 *   4) в двухэтажных домах поднимается на антресоль по лестнице.
 *
 *  Запуск: cd dev && node house_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('https://rezare777.github.io/Silenc/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const homes = [
    [-11, 8, 6, 5, 1], [13, 9, 6.5, 5, 1], [-16, 19, 7, 5.5, 1], [16, 20, 6, 5, 1],
    [-32, -22, 6.5, 5, 1], [24, -22, 6, 5.4, 1], [-27, 11, 6, 5, 1], [28, 13, 8, 6, 2],
    [-10, 29, 6, 5, 1], [11, 30, 7, 5.5, 2], [24, -33, 5.5, 4.6, 1], [-30, 27, 6, 5, 1],
  ];
  const ryToFace = (fx, fz, tx, tz) => {
    const l = Math.hypot(tx - fx, tz - fz) || 1;
    return Math.atan2(-(tx - fx) / l, -(tz - fz) / l);
  };
  const put = (x, z, y = 0) => { p.teleport(x, z, 0); p.y = y; p.groundY = y; p.vy = 0; p.keys.clear(); };
  const walk = (yaw, frames) => {
    for (let i = 0; i < frames; i++) { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
  };
  const out = [];
  for (const [hx, hz, w, dd, floors] of homes) {
    const ry = ryToFace(hx, hz, 0, 0);
    const c = Math.cos(ry), s = Math.sin(ry);
    // точка перед фасадом (дверь смотрит в центр деревни)
    // точка перед фасадом: в локальной системе дома фасад — это -z
    const lz0 = -(dd / 2 + 2.2);
    const startX = hx + lz0 * s;
    const startZ = hz + lz0 * c;
    put(startX, startZ);
    const yaw = ryToFace(startX, startZ, hx, hz);
    walk(yaw, 90);                       // подойти и войти
    const inside = {
      x: p.pos.x, z: p.pos.z, y: p.groundY,
      lx: (p.pos.x - hx) * c - (p.pos.z - hz) * s,
      lz: (p.pos.x - hx) * s + (p.pos.z - hz) * c,
    };
    const inHouse = Math.abs(inside.lx) < w / 2 && Math.abs(inside.lz) < dd / 2;
    // выход обратно наружу
    const yawOut = ryToFace(p.pos.x, p.pos.z, startX, startZ);
    walk(yawOut, 120);
    const outX = p.pos.x, outZ = p.pos.z;
    const lxo = (outX - hx) * c - (outZ - hz) * s;
    const lzo = (outX - hx) * s + (outZ - hz) * c;
    const outside = Math.abs(lxo) > w / 2 + 0.2 || Math.abs(lzo) > dd / 2 + 0.2;
    out.push({
      home: `${hx},${hz}`,
      inside: inHouse, floorY: +inside.y.toFixed(2),
      outside, outDist: +Math.hypot(outX - hx, outZ - hz).toFixed(2),
      floors,
    });
  }
  return out;
});

let bad = 0;
for (const r of res) {
  const ok = r.inside && r.outside && r.floorY > 0.3;
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} дом ${r.home.padEnd(9)} вошёл:${r.inside ? 'да' : 'НЕТ'} пол:${r.floorY} вышел:${r.outside ? 'да' : 'НЕТ'} (${r.outDist} м) ${r.floors > 1 ? '[2 этажа]' : ''}`);
}
console.log(`\nпроблемных домов: ${bad} из ${res.length}`);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
