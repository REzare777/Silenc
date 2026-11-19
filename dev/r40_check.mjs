/**
 * ============================================================================
 *  Проверки раунда 40: спавн лицом в локацию, звонарная прибрана
 * ============================================================================
 *
 *   1. При входе в локацию игрок смотрит ВПЕРЁД, а не спиной к ней:
 *      храм, дом, трактир.
 *   2. Звонарная (комната в задней части храма): у входа свободный пол —
 *      лестница не встречает сразу; подъём к колоколу работает;
 *      дверь из нефа — рабочая, проходимая.
 *
 *  Запуск: cd dev && node r40_check.mjs
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

  /** Куда игрок движется при нажатии W: вектор направления в локации. */
  const faceDir = (frames = 40) => {
    const x0 = p.pos.x, z0 = p.pos.z;
    p.keys.clear();
    p.keys.add('KeyW');
    for (let i = 0; i < frames; i++) p.update(1 / 60);
    p.keys.clear();
    return { dx: +(p.pos.x - x0).toFixed(3), dz: +(p.pos.z - z0).toFixed(3) };
  };

  /* ---------- 1. храм: спавн лицом в неф ---------- */
  {
    const enter = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
    enter.act();
    out.churchDir = faceDir();
    out.churchLooksIn = out.churchDir.dz > 0.3;   // на север — вглубь нефа
    out.churchYaw = +p.yaw.toFixed(2);

    /* ---------- 2. звонарная ---------- */
    const ch = d.ctx.systems.locations.churchLoc;
    out.towerSpawn = { x: +ch.spawnBack.x.toFixed(2), z: +ch.spawnBack.z.toFixed(2) };
    // у входа не должно быть лестничных платформ
    const near = ch.platforms.filter((pl) => pl.ramp
      && Math.hypot(pl.ramp.x0 - ch.spawnBack.x, pl.ramp.z0 - ch.spawnBack.z) < 2.0
      && Math.hypot(pl.ramp.x1 - ch.spawnBack.x, pl.ramp.z1 - ch.spawnBack.z) < 2.0);
    out.rampsAtDoor = near.length;
    // свободное место перед дверью: игрок не упирается в лестницу
    p.teleport(ch.spawnBack.x, ch.spawnBack.z, ch.spawnBack.yaw);
    p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
    for (let i = 0; i < 30; i++) p.update(1 / 60);
    out.doorFree = +p.pos.z.toFixed(2);
    // Подъём по лестнице как живой игрок: внизу → вверх → на восток → к колоколу.
    const ramps = ch.platforms.filter((pl) => pl.ramp);
    out.rampCount = ramps.length;
    const start = ramps[0].ramp;
    p.teleport(start.x0, start.z0, 0);
    p.y = 0; p.groundY = 0; p.vy = 0; p.keys.clear();
    const walk = (yaw, until, maxFrames = 600) => {
      p.yaw = yaw;
      for (let i = 0; i < maxFrames; i++) {
        p.keys.add('KeyW');
        p.update(1 / 60);
        if (until()) break;
      }
      p.keys.clear();
      return +p.groundY.toFixed(2);
    };
    const h1 = walk(0, () => p.pos.z < 11.7);                 // вверх по западной стене
    const h2 = walk(-Math.PI / 2, () => p.pos.x > 2.2);       // на восток по каменной галерее
    const h3 = walk(Math.PI, () => p.pos.z > 13.3);           // вверх по восточной стене
    out.steps = [h1, h2, h3];
    out.climbMax = Math.max(h1, h2, h3);
    out.climbTarget = 4.5;
    out.climbed = h3 > 4.0;
    out.onBellLanding = h3 > 3.9 && p.pos.z > 12.6 && p.pos.z < 14.2;
    // колокол на площадке доступен
    p.teleport(ch.bellPoint.x, ch.bellPoint.z, 0);
    p.y = 0.02; p.groundY = 4.5; p.vy = 0;
    const nearBell = d.ctx.systems.interactions.nearest();
    out.bellOk = !!nearBell && nearBell.label === 'Ударить в колокол';
    // из нефа в звонарную — проход свободен (дверь распахнута)
    p.teleport(0, 5.0, 0);
    p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
    p.yaw = Math.PI / 2;
    for (let i = 0; i < 58; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
    p.yaw = Math.PI;
    let got = false;
    for (let i = 0; i < 400; i++) {
      p.keys.add('KeyW');
      p.update(1 / 60);
      if (p.pos.z > 10.4) { got = true; break; }
    }
    p.keys.clear();
    out.passToTower = got;
    out.passZ = +p.pos.z.toFixed(2);
  }

  /* ---------- 3. дом и трактир: спавн лицом вглубь ---------- */
  {
    d.ctx.systems.locations.setLocation('home0');
    out.homeDir = faceDir();
    out.homeLooksIn = out.homeDir.dz > 0.3 || out.homeDir.dx < -0.3;
    d.ctx.systems.locations.setLocation('tavern');
    out.tavernDir = faceDir();
    out.tavernLooksIn = out.tavernDir.dz > 0.3;
  }
  return out;
});

const checks = [
  ['в храме игрок смотрит вглубь', res.churchLooksIn],
  ['у входа в звонарную нет лестницы', res.rampsAtDoor === 0],
  ['перед дверью звонарной свободно', res.doorFree !== undefined && res.doorFree > 12],
  ['лестница: подъём до площадки с колоколом', res.climbed],
  ['колокол на своей площадке', res.onBellLanding],
  ['наверху есть удар в колокол', res.bellOk],
  ['дверь из нефа — рабочая, проход свободен', res.passToTower],
  ['в доме игрок смотрит в комнату', res.homeLooksIn],
  ['в трактире игрок смотрит в зал', res.tavernLooksIn],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log('детали:', JSON.stringify({
  churchDir: res.churchDir, churchYaw: res.churchYaw, towerSpawn: res.towerSpawn,
  doorFree: res.doorFree, climbMax: res.climbMax, passZ: res.passZ,
  homeDir: res.homeDir, tavernDir: res.tavernDir, steps: res.steps,
}));
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
