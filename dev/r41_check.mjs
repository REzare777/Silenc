/**
 * ============================================================================
 *  Проверки раунда 41: двери без «фриза», лестницы и костёр
 * ============================================================================
 *
 *   1. Передняя дверь дома: створка уже косяков и стоит глубже — плоскости
 *      не совпадают, значит z-fighting (мерцание) исключён.
 *   2. Внутренняя дверь дома: та же проверка + настоящий проём в стене.
 *   3. Лестница звонарной: настил площадки ниже верхней ступени.
 *   4. Мельница: перемычка ниже смотровой площадки (стык без совпадения граней).
 *   5. Костёр: перенесён с лужайки у домов на площадь — дальше 8 м от
 *      любого дома и вне главной дороги.
 *
 *  Запуск: cd dev && node r41_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const out = { errors: [] };

  /* ---------- 1. передняя дверь каждого дома ---------- */
  const front = [];
  (ctx.homes || []).forEach((h) => {
    const g = h.doorGeom;
    if (!g) { front.push({ i: h.i, ok: false, why: 'нет метрик двери' }); return; }
    const gapZ = +(g.leafZ - g.jambZ).toFixed(3);      // створка глубже косяка
    const gapX = +(g.jambHalf - g.leafHalf).toFixed(3); // створка уже косяка
    front.push({
      i: h.i, gapZ, gapX,
      ok: gapZ >= 0.01 && gapX >= 0.005,
    });
  });
  out.frontDoors = front;
  out.frontDoorsOk = front.length === 12 && front.every((f) => f.ok);

  /* ---------- 2. внутренняя дверь дома ---------- */
  const locs = ctx.systems.locations;
  const hl = locs.homeLocs && locs.homeLocs[0];
  if (hl && hl.doorGeom) {
    const g = hl.doorGeom;
    out.innerDoor = {
      gapZ: +(g.leafZ - g.jambZ).toFixed(3),
      gapX: +(g.jambHalf - g.leafHalf).toFixed(3),
    };
    out.innerDoorOk = out.innerDoor.gapZ >= 0.01 && out.innerDoor.gapX >= 0.005;
  } else {
    out.innerDoorOk = false;
    out.innerDoor = { why: 'нет метрик' };
  }

  /* ---------- 3. лестница звонарной ---------- */
  const ch = locs.churchLoc;
  if (ch && ch.stairsGeom) {
    const s = ch.stairsGeom;
    out.stairs = { deckTop: +s.deckTop.toFixed(3), stepTop: +s.stepTop.toFixed(3) };
    out.stairsOk = out.stairs.deckTop <= out.stairs.stepTop - 0.02;
  } else {
    out.stairsOk = false;
    out.stairs = { why: 'нет метрик' };
  }

  /* ---------- 4. мельница ---------- */
  const mg = ctx.mill && ctx.mill.landingGeom;
  if (mg) {
    out.mill = { bridgeTop: +mg.bridgeTop.toFixed(3), deckTop: +mg.deckTop.toFixed(3) };
    out.millOk = out.mill.bridgeTop <= out.mill.deckTop - 0.05;
  } else {
    out.millOk = false;
    out.mill = { why: 'нет метрик' };
  }

  /* ---------- 5. костёр ---------- */
  const f = ctx.campfirePos || { x: 0, z: 0 };
  out.fire = { x: +f.x.toFixed(2), z: +f.z.toFixed(2) };
  const near = (ctx.homes || [])
    .map((h) => ({ i: h.i, d: +Math.hypot(h.x - f.x, h.z - f.z).toFixed(2) }))
    .sort((a, b) => a.d - b.d);
  out.fireNearest = near.slice(0, 3);
  out.fireOk = near.every((h) => h.d >= 8) && Math.abs(f.x) >= 4.5
    && Math.hypot(f.x, f.z) <= 12;

  return out;
});

/* ---------- сводка ---------- */
const lines = [];
let bad = 0;
const chk = (name, ok, extra = '') => {
  if (!ok) bad++;
  lines.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};

chk('передние двери домов: створка отделена от косяков', res.frontDoorsOk,
  `дверей ${res.frontDoors.length}, зазор Z ${Math.min(...res.frontDoors.map((f) => f.gapZ ?? 0))}, зазор X ${Math.min(...res.frontDoors.map((f) => f.gapX ?? 0))}`);
chk('внутренняя дверь дома: створка отделена от косяков', res.innerDoorOk, JSON.stringify(res.innerDoor));
chk('лестница звонарной: настил ниже ступени', res.stairsOk, JSON.stringify(res.stairs));
chk('мельница: перемычка ниже площадки', res.millOk, JSON.stringify(res.mill));
chk('костёр на площади и дальше 8 м от домов', res.fireOk,
  `костёр (${res.fire.x}, ${res.fire.z}), ближайший дом ${res.fireNearest[0]?.d} м`);

if (errs.length) { bad++; lines.push('FAIL ошибки страницы: ' + errs.join(' | ')); }

console.log(lines.join('\n'));
console.log('ошибки: ' + bad);
await browser.close();
process.exit(bad ? 1 : 0);
