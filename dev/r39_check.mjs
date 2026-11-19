/**
 * ============================================================================
 *  Проверки раунда 39: таверна не «утоплена», храм на прежнем месте,
 *  дома разнесены (дом у пруда не стоит на лужайке)
 * ============================================================================
 *
 *   1. Трактир стоит ровно: пол зала и улица на одном уровне, при выходе
 *      игрок оказывается на крыльце, а не в ступне.
 *   2. Храм не развёрнут: башня-колокольня снова спереди, вход в храм —
 *      у башни, а вход в звонарку — сзади, у сломанной двери нефа.
 *   3. Дома разнесены: у каждого есть зеркальная пара, никто не стоит на
 *      лужайке у пруда и не подходит к воде ближе 4 м.
 *
 *  Запуск: cd dev && node r39_check.mjs
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

  /* ---------- 1. таверна ---------- */
  {
    // выход из бара: игрок должен оказаться на крыльце, а не в ступне
    d.ctx.systems.locations.setLocation('tavern');
    await0();
    const exitAct = d.ctx.interactables.find((x) => x.where === 'tavern' && x.label === 'Выйти из таверны');
    out.tavernExitExists = !!exitAct;
    exitAct.act();
    out.tavernOutside = d.ctx.loc === 'village';
    for (let i = 0; i < 20; i++) p.update(1 / 60);
    out.tavernGround = +p.groundY.toFixed(3);
    out.tavernY = +p.y.toFixed(3);
    // рядом (в сторону улицы) земля должна быть вровень — без ямы
    const door = d.ctx.doors.tavern, ry = d.ctx.doors.tavernRy;
    const c = Math.cos(ry), s = Math.sin(ry);
    const away = { x: door.x - 2.0 * s, z: door.z - 2.0 * c };
    out.streetGround = +p.groundAt(away.x, away.z).toFixed(3);
    // крыльцо — ступень, но игрок на ней не проваливается
    out.stepOk = out.tavernGround > 0.1 && out.tavernGround < 0.4;
  }
  function await0() { /* заглушка: setLocation синхронный */ }

  /* ---------- 2. храм ---------- */
  {
    d.ctx.systems.locations.setLocation('village');
    // подходим к башне: интеракт входа должен быть «под рукой»
    const door = d.ctx.doors.church, ry = door.ry;
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx, lz) => ({
      x: door.x + lx * c + (lz + 14.2) * s,
      z: door.z - lx * s + (lz + 14.2) * c,
    });
    const spot = at(0, -11.6);            // у ступеней башни
    p.teleport(spot.x, spot.z, ry);
    p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
    for (let i = 0; i < 10; i++) p.update(1 / 60);
    const near = d.ctx.systems.interactions.nearest();
    out.towerInteract = !!near && near.label === 'Войти в храм';
    if (near) near.act();
    out.inChurch = d.ctx.loc === 'church';
    out.churchSpawn = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };
    // выход из храма — у башни, на земле
    const exitAct = d.ctx.interactables.find((x) => x.where === 'church' && x.label === 'Выйти из храма');
    exitAct.act();
    out.backToVillage = d.ctx.loc === 'village';
    out.churchExitDist = +Math.hypot(p.pos.x - door.x, p.pos.z - door.z).toFixed(2);
    // сзади — вход в звонарную
    const back = d.ctx.doors.churchBack;
    const spot2 = {
      x: back.x - 1.2 * Math.sin(ry),
      z: back.z - 1.2 * Math.cos(ry),
    };
    p.teleport(spot2.x, spot2.z, ry);
    p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
    for (let i = 0; i < 10; i++) p.update(1 / 60);
    const near2 = d.ctx.systems.interactions.nearest();
    out.backInteract = !!near2 && near2.label === 'Войти в звонарку';
    if (near2) near2.act();
    out.inTower = d.ctx.loc === 'church';
    out.towerSpawn = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };
  }

  /* ---------- 3. дома ---------- */
  {
    const homes = d.ctx.homes || [];
    out.homeCount = homes.length;
    const POND = { x: 50, z: -14, r: 10.6 };
    const MEADOW = { x0: 36, x1: 73, z0: -35, z1: 7 };
    let minPond = 99, onMeadow = 0, noMirror = 0;
    for (const h of homes) {
      const g = Math.hypot(h.x - POND.x, h.z - POND.z) - (Math.max(h.w, h.d) / 2 + POND.r);
      if (g < minPond) minPond = g;
      if (h.x + h.w / 2 > MEADOW.x0 && h.x - h.w / 2 < MEADOW.x1
        && h.z + h.d / 2 > MEADOW.z0 && h.z - h.d / 2 < MEADOW.z1) onMeadow++;
      if (!homes.find((o) => o.i !== h.i && Math.abs(o.x + h.x) < 0.6 && Math.abs(o.z - h.z) < 0.6)) noMirror++;
    }
    out.minPondGap = +minPond.toFixed(2);
    out.onMeadow = onMeadow;
    out.noMirror = noMirror;
  }
  return out;
});

const checks = [
  ['из таверны есть выход', res.tavernExitExists && res.tavernOutside],
  ['после выхода игрок на крыльце, а не в яме', res.stepOk],
  ['улица рядом с таверной вровень', res.streetGround !== undefined && Math.abs(res.streetGround) < 0.15],
  ['у башни храма есть вход', res.towerInteract],
  ['вход ведёт в храм (неф)', res.inChurch && res.churchSpawn && res.churchSpawn.z < 0],
  ['выход из храма у башни', res.backToVillage && res.churchExitDist !== undefined && res.churchExitDist < 4],
  ['сзади есть вход в звонарку', res.backInteract],
  ['вход сзади ведёт в звонарную', res.inTower && res.towerSpawn && res.towerSpawn.z > 12],
  ['все 12 домов на месте', res.homeCount === 12],
  ['у каждого дома есть зеркальная пара', res.noMirror === 0],
  ['никто не стоит на лужайке у пруда', res.onMeadow === 0],
  ['до воды не меньше 4 м', res.minPondGap >= 4],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log('детали:', JSON.stringify({
  ground: res.tavernGround, street: res.streetGround, pond: res.minPondGap,
  churchSpawn: res.churchSpawn, towerSpawn: res.towerSpawn, exitDist: res.churchExitDist,
}));
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
