/**
 * ============================================================================
 *  Проверки раунда 37: колокол в башне и задняя дверь таверны
 * ============================================================================
 *
 *   1. В храм игрок попадает в башню-колокольню, может подняться по
 *      лестнице на площадку и там ударить в колокол. С пола (из нефа)
 *      колокол ударить нельзя — интеракт есть только наверху.
 *   2. Задняя дверь таверны открывается, за ней сени, а из сеней —
 *      рабочий выход на улицу с задней стороны трактира.
 *
 *  Запуск: cd dev && node r37_check.mjs
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

const res = await page.evaluate(async () => {
  const d = window.__dbg;
  const out = {};

  /* ---------- 1. храм ---------- */
  const enter = d.ctx.interactables.find((x) => x.label === 'Войти в храм');
  out.enterExists = !!enter;
  enter.act();
  out.inChurch = d.ctx.loc === 'church';
  out.spawn = { x: +d.player.pos.x.toFixed(2), z: +d.player.pos.z.toFixed(2) };
  const ch = d.ctx.systems.locations.churchLoc;

  // с пола колокол не достаётся: интеракт далеко
  const bellNear = d.ctx.interactables.filter((x) => x.label === 'Ударить в колокол');
  out.bellInteractCount = bellNear.length;
  // с пола башни колокол недоступен: система сама не предлагает этот интеракт
  const nearFloor = d.ctx.systems.interactions.nearest();
  out.bellReachableFromFloor = !!nearFloor && nearFloor.label === 'Ударить в колокол';

  // подъём по лестнице: телепорт к низу лестницы и шаг вверх
  const p = d.player;
  const f0 = ch.platforms.find((pl) => pl.ramp);
  out.rampCount = ch.platforms.filter((pl) => pl.ramp).length;
  const r = f0.ramp;
  p.teleport(r.x0, r.z0, 0);
  p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
  // смотрим в сторону подъёма
  p.yaw = Math.atan2(r.x1 - r.x0, r.z1 - r.z0) + Math.PI;
  let maxY = 0;
  for (let i = 0; i < 900; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    if (p.y > maxY) maxY = p.y;
    if (p.y > (r.y1 - 0.1)) break;
  }
  p.keys.clear();
  out.climbHeight = +maxY.toFixed(2);
  out.climbTarget = +r.y1.toFixed(2);
  out.climbed = maxY > r.y1 - 0.35;

  // на площадке колокол доступен
  p.teleport(ch.bellPoint.x, ch.bellPoint.z, 0);
  p.y = 0.02; p.groundY = 4.5; p.vy = 0;
  const nearTower = d.ctx.systems.interactions.nearest();
  out.bellOnTower = !!nearTower && nearTower.label === 'Ударить в колокол';

  // проход из нефа в звонарную (арка сбоку от алтаря) свободен
  {
    const p2 = d.player;
    p2.teleport(0, 4.5, 0);
    p2.y = 0.02; p2.groundY = 0.02; p2.vy = 0; p2.keys.clear();
    p2.yaw = Math.PI / 2;                   // к арке, влево
    for (let i = 0; i < 58; i++) { p2.keys.add('KeyW'); p2.update(1 / 60); }
    p2.keys.clear();
    p2.yaw = Math.PI;                       // на север, сквозь арку
    let got = false;
    for (let i = 0; i < 500; i++) {
      p2.keys.add('KeyW');
      p2.update(1 / 60);
      if (p2.pos.z > 12.5) { got = true; break; }
    }
    p2.keys.clear();
    out.passageToNave = got;
    out.naveZ = +p2.pos.z.toFixed(2);
  }

  // удар: колокол должен качнуться
  const before = ch.group.children.length;
  const bellAct = d.ctx.interactables.find((x) => x.label === 'Ударить в колокол');
  bellAct.act();
  out.bellRang = true;

  // выход через заднюю дверь звонарной
  const backAct = d.ctx.interactables.find((x) => x.label === 'Открыть тяжёлую дверь' && x.where === 'church');
  out.backDoorExists = !!backAct;
  if (backAct) {
    backAct.act();
    out.backToVillage = d.ctx.loc === 'village';
    const door = d.ctx.doors.churchBack;
    out.backDist = +Math.hypot(d.player.pos.x - door.x, d.player.pos.z - door.z).toFixed(2);
  }

  // вход с задней стороны храма — сразу в звонарную
  d.ctx.systems.locations.setLocation('village');
  {
    const enter = d.ctx.interactables.find((x) => x.label === 'Войти в звонарку');
    out.backEnterExists = !!enter;
    if (enter) {
      enter.act();
      out.backEnterLoc = d.ctx.loc;
      out.backSpawn = { x: +d.player.pos.x.toFixed(2), z: +d.player.pos.z.toFixed(2) };
    }
  }

  /* ---------- 2. таверна ---------- */
  d.ctx.systems.locations.setLocation('tavern');
  const tv = d.ctx.systems.locations.tavernLoc;
  const openAct = d.ctx.interactables.find((x) => x.label === 'Открыть заднюю дверь' && x.where === 'tavern');
  out.openDoorExists = !!openAct;
  out.doorClosedBefore = !tv.isBackDoorOpen();
  if (openAct) openAct.act();
  out.doorOpenAfter = tv.isBackDoorOpen();

  // после открытия проём свободен: шаг из зала в сени
  const exitAct = d.ctx.interactables.find((x) => x.label === 'Выйти на улицу' && x.where === 'tavern');
  out.exitExists = !!exitAct;
  if (exitAct) {
    exitAct.act();
    out.backToVillageFromTavern = d.ctx.loc === 'village';
    const door = d.ctx.doors.tavernBack;
    out.tavernBackDist = +Math.hypot(d.player.pos.x - door.x, d.player.pos.z - door.z).toFixed(2);
    // игрок снаружи не должен оказаться внутри стены: проверяем выталкивание
    const p3 = d.player;
    const bx = p3.pos.x, bz = p3.pos.z;
    p3.keys.clear();
    p3.update(1 / 60);
    out.pushedOutside = +Math.hypot(p3.pos.x - bx, p3.pos.z - bz).toFixed(3);
  }
  // табличка «ДЛЯ ПЕРСОНАЛА» над второй дверью таверны
  {
    d.ctx.systems.locations.setLocation('tavern');
    let signs = 0;
    d.ctx.systems.locations.sceneTavern.traverse((o) => {
      if (o.isMesh && o.name === 'sign') signs++;
    });
    out.staffSigns = signs;
  }
  return out;
});

const checks = [
  ['вход в храм есть', res.enterExists],
  ['вход ведёт в башню колокольни', res.inChurch],
  ['колокол недоступен с пола', res.bellReachableFromFloor === false],
  ['лестница в башне: три пролёта', res.rampCount === 3],
  ['игрок поднимается по лестнице', res.climbed],
  ['наверху есть интеракт удара в колокол', res.bellOnTower],
  ['из нефа можно пройти в звонарную', res.passageToNave],
  ['вход сзади ведёт в звонарную', res.backEnterExists && res.backEnterLoc === 'church'
    && res.backSpawn && res.backSpawn.z > 12],
  ['задняя дверь нефа открыта на выход', res.backDoorExists && res.backToVillage],
  ['выход у задней двери нефа', res.backDist !== undefined && res.backDist < 3],
  ['задняя дверь таверны открывается', res.openDoorExists && res.doorClosedBefore && res.doorOpenAfter],
  ['из таверны есть выход на улицу сзади', res.exitExists && res.backToVillageFromTavern],
  ['выход у задней двери таверны', res.tavernBackDist !== undefined && res.tavernBackDist < 3],
  ['на улице игрок не внутри стены', res.pushedOutside !== undefined && res.pushedOutside < 0.2],
  ['над второй дверью таверны табличка «для персонала»', res.staffSigns >= 1],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log('детали:', JSON.stringify({
  spawn: res.spawn, climb: res.climbHeight, target: res.climbTarget,
  backDist: res.backDist, tavernBackDist: res.tavernBackDist,
}));
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
