/**
 * ============================================================================
 *  Проверка храма: вход, выход, проход по нефу без застреваний
 * ============================================================================
 *
 *  Храм — отдельная локация: за южным порталом настоящий неф со скамьями,
 *  витражами и алтарём, а в северной стене — сломанная арка в звонарную
 *  (колокольню). Алтарь стоит по центру, поэтому проход к арке идёт сбоку.
 *
 *  Запуск: cd dev && node church_check.mjs
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
  const out = {};
  const p = d.player;

  const door = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  out.doorExists = !!door;
  door.act();
  out.inChurch = d.ctx.loc === 'church';
  out.spawn = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };

  const reset = (x, z) => {
    p.teleport(x, z, 0);
    p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
  };
  const walk = (yaw, frames, done) => {
    p.yaw = yaw;
    for (let i = 0; i < frames; i++) {
      p.keys.add('KeyW');
      p.update(1 / 60);
      if (done && done()) break;
    }
    p.keys.clear();
  };

  // 1. свободный проход по нефу от портала к алтарю
  reset(0, -4.6);
  walk(Math.PI, 700, () => p.pos.z > 6.1);
  out.reachedAltar = p.pos.z > 6.1;
  out.altarZ = +p.pos.z.toFixed(2);

  // 2. дверь в звонарную (раунд 42): переставлена вправо и закрыта —
  //    из молитвенной её не видно, сквозь неё не пройти
  reset(0, 5.0);
  walk(Math.PI / 2, 300, () => p.pos.x < -2.45);
  out.sideX = +p.pos.x.toFixed(2);
  walk(Math.PI, 600, () => p.pos.z > 10.3);
  out.reachedTower = p.pos.z > 10.3;
  out.towerZ = +p.pos.z.toFixed(2);

  // 3. вход с заднего двора ведёт в звонарную
  const ch = d.ctx.systems.locations.churchLoc;
  d.ctx.systems.locations.setLocation('church', 'back');
  out.backEntryZ = +p.pos.z.toFixed(2);
  out.backEntryX = +p.pos.x.toFixed(2);
  out.inBelfry = Math.abs(p.pos.z - ch.spawnBack.z) < 1.2 && Math.abs(p.pos.x) < 1;

  // 3a. из нефа нельзя выйти наружу сквозь портал, из звонарной — сквозь дверь
  reset(0, -4.0);
  walk(Math.PI * 2, 400);
  out.noPortalLeak = p.pos.z > -6.5;
  reset(0, 15.0);
  walk(0, 400);
  out.noDoorLeak = p.pos.z < 17.0;

  // 4. выход из храма
  const exit = d.ctx.interactables.find((x) => x.where === 'church' && x.label === 'Выйти из храма');
  out.exitExists = !!exit;
  exit.act();
  out.backToVillage = d.ctx.loc === 'village';
  const doorPos = d.ctx.doors.church;
  out.exitDist = +Math.hypot(d.player.pos.x - doorPos.x, d.player.pos.z - doorPos.z).toFixed(2);
  return out;
});

const checks = [
  ['интеракт входа есть', res.doorExists],
  ['вход в локацию храма', res.inChurch],
  ['проход по нефу до алтаря', res.reachedAltar],
  ['проход сбоку к двери в звонарную', res.sideX !== undefined && res.sideX < -2.3],
  ['дверь в звонарную закрыта — прохода нет', res.reachedTower === false],
  ['вход с заднего двора ведёт в звонарную', res.inBelfry],
  ['сквозь портал наружу не пройти', res.noPortalLeak],
  ['сквозь заднюю дверь не пройти', res.noDoorLeak],
  ['интеракт выхода есть', res.exitExists],
  ['выход в деревню', res.backToVillage],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log('детали:', JSON.stringify({
  spawn: res.spawn, altarZ: res.altarZ, sideX: res.sideX,
  towerZ: res.towerZ, backEntry: [res.backEntryX, res.backEntryZ], exitDist: res.exitDist,
}));
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
