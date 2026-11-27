import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const URL = process.env.LIVE_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const log = [];
  const errs = [];

  // 1) у двери таверны снаружи
  const doorIt = d.interactables.find((x) => x.label === 'Войти в трактир «Уставший вепрь»');
  log.push(`интеракт двери: ${!!doorIt} радиус=${doorIt ? doorIt.radius : '-'}`);
  if (!doorIt) return { log, errs };
  // телепортируемся к двери и проверяем радиус
  p.teleport(doorIt.pos.x, doorIt.pos.z, 0);
  const dd = Math.hypot(p.pos.x - doorIt.pos.x, p.pos.z - doorIt.pos.z);
  log.push(`до двери: ${dd.toFixed(2)} м ${dd < doorIt.radius ? 'в радиусе' : 'НЕ В РАДИУСЕ'}`);

  // 2) вход по E
  doorIt.act();
  log.push(`после входа: loc=${d.loc} pos=(${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)}) сцена=${d.renderSceneName ? d.renderSceneName() : '-'}`);

  // 3) интерьер: полы, стены
  const floors = [];
  for (const [x, z] of [[0, -4], [3, 0], [-3, 2], [5, 3]]) {
    p.teleport(x, z, 0); p.y = 0; p.groundY = 0;
    floors.push(`(${x},${z}) -> ${p.groundAt(x, z).toFixed(2)}`);
  }
  log.push('полы: ' + floors.join(' | '));

  // 4) стены-препятствия: игрок не должен проходить сквозь стены
  const wallChecks = [];
  for (const [x, z] of [[-7.3, 0], [7.3, 0], [0, -6.3], [0, 6.3]]) {
    p.teleport(x, z, 0);
    wallChecks.push(`(${x},${z}) проход=${d.barnWallProbe ? '?' : '?'}`);
  }

  // 5) постоянство света: меняем время суток и сравниваем интенсивности
  const lightsOf = () => {
    const l = d.tavernLoc.lights;
    return {
      fire: +l.fire.intensity.toFixed(3),
      hemi: +l.hemi.intensity.toFixed(3),
      ambient: +l.ambient.intensity.toFixed(3),
      lamps: l.lamps.map((x) => +x.l.intensity.toFixed(3)),
      bar: +l.bar.intensity.toFixed(3),
    };
  };
  const snap1 = lightsOf();
  // имитируем смену времени суток: env меняется в основной локации.
  // Время t одинаковое в обоих замерах, чтобы мерцание огня не влияло.
  d.env.setTimeOfDay('night', true);
  d.env.update(0.016, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 30; i++) d.tavernLoc.update(1 / 60, 5);
  const snapNight = lightsOf();
  d.env.setTimeOfDay('day', true);
  d.env.update(0.016, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 30; i++) d.tavernLoc.update(1 / 60, 5);
  const snapDay = lightsOf();
  const same = JSON.stringify(snapNight) === JSON.stringify(snapDay);
  log.push(`свет одинаков при ночи и дне: ${same ? 'ДА' : 'НЕТ'}`);
  log.push(`  ночь: ${JSON.stringify(snapNight)}`);
  log.push(`  день: ${JSON.stringify(snapDay)}`);
  log.push(`  огонь: ${snap1.fire.toFixed(2)}`);

  // 6) подъём на галерею по вертикальной лестнице
  const zone = d.tavernLoc.climbs[0];
  log.push(`зона подъёма: x=${zone.x} z=${zone.z} r=${zone.r} y0=${zone.y0} y1=${zone.y1}`);
  // пеший путь от спавна к лестнице (маршрут с обходом мебели)
  {
    const route = [
      [-4.3, -2.6], [-5.5, 0.4], [-6.3, 3.2], [zone.x + 0.25, zone.z],
    ];
    p.teleport(d.tavernLoc.spawn.x, d.tavernLoc.spawn.z, 0);
    p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
    let ok = true, msg = 'ДОШЁЛ', leg = 0;
    for (const [tx, tz] of route) {
      let stuck = 0, lastD = 1e9, reached = false;
      for (let i = 0; i < 700; i++) {
        const dx = tx - p.pos.x, dz = tz - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.55) { reached = true; break; }
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = 0;
        p.keys.add('KeyW');
        p.update(1 / 60);
        if (dist > lastD - 0.002) stuck++; else stuck = 0;
        lastD = dist;
        if (stuck > 200) break;
      }
      p.keys.clear();
      if (!reached) { ok = false; msg = `ЗАСТРЯЛ на участке ${leg} (цель ${tx},${tz}), поз=(${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`; break; }
      leg++;
    }
    log.push(`пеший маршрут к лестнице: ${ok ? msg : msg} (участков пройдено ${leg}/${route.length})`);
  }
  // встаём под лестницей, смотрим вверх, жмём W
  p.teleport(zone.x + 0.2, zone.z, 0);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  p.pitch = 0.6;                       // смотрим вверх
  let maxFeet = 0, climbed = false;
  for (let i = 0; i < 600; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    maxFeet = Math.max(maxFeet, p.groundY + p.y);
    if (p.climb === null && p.groundY > 3.5) { climbed = true; break; }
  }
  p.keys.clear();
  log.push(`подъём по лестнице: max=${maxFeet.toFixed(2)} (галерея 4.20) наверху=${climbed ? 'ДА' : 'НЕТ'} pos=(${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}) y=${p.groundY.toFixed(2)}`);

  // 7) спуск обратно
  p.teleport(zone.x + 0.6, zone.z, 0);
  p.y = 0; p.groundY = 0;
  p.pitch = -0.5;
  let minFeet = 99;
  for (let i = 0; i < 600; i++) {
    p.keys.add('KeyS');
    p.update(1 / 60);
    minFeet = Math.min(minFeet, p.groundY + p.y);
    if (p.climb === null && p.groundY < 0.5) break;
  }
  p.keys.clear();
  log.push(`спуск: min=${minFeet.toFixed(2)} pos=(${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}) y=${p.groundY.toFixed(2)}`);

  // 8) выход из таверны
  const ex = d.interactables.find((x) => x.label === 'Выйти из трактира');
  log.push(`интеракт выхода: ${!!ex}`);
  if (ex) {
    p.teleport(ex.pos.x, ex.pos.z, 0);
    const dEx = Math.hypot(p.pos.x - ex.pos.x, p.pos.z - ex.pos.z);
    log.push(`до выхода: ${dEx.toFixed(2)} м ${dEx < ex.radius ? 'в радиусе' : 'НЕ В РАДИУСЕ'}`);
    ex.act();
    log.push(`после выхода: loc=${d.loc} pos=(${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
  }
  return { log, errs };
});
console.log(res.log.join('\n'));
console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
