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

  // 1) к воротам амбара снаружи
  const bx = -40, bz = -8;
  p.teleport(bx + 3.5, bz - 4.5, 0);
  p.y = 0; p.groundY = 0;
  log.push(`у ворот: ${d.loc} y=${p.groundY.toFixed(2)}`);
  const it = d.interactables.find((x) => x.label === 'Войти в амбар');
  const d0 = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
  log.push(`до интеракта: ${d0.toFixed(2)} м ${d0 < it.radius ? 'в радиусе' : 'НЕ В РАДИУСЕ'}`);
  it.act();
  log.push(`после входа: loc=${d.loc} pos=(${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);

  // 2) полы первого этажа
  const floors = [];
  for (const [x, z] of [[0, -2], [3, 0], [-5, 0], [3, 3]]) {
    p.teleport(x, z, 0); p.y = 0; p.groundY = 0;
    floors.push(`(${x},${z}) -> ${p.groundAt(x, z).toFixed(2)}`);
  }
  log.push('полы: ' + floors.join(' | '));

  // 3) бочки у ворот убраны — проход к лестнице свободен
  const zone = d.barnLoc.climbs[0];
  log.push(`зона подъёма: x=${zone.x} z=${zone.z} r=${zone.r} y0=${zone.y0} y1=${zone.y1}`);

  // 4) вокруг лестницы на первом этаже должно быть пусто
  //    (бочки стоят у восточной стены, западная сторона свободна)
  const nearLadder = d.barnLoc.colliders.circles.filter((c) =>
    Math.hypot(c.x - zone.x, c.z - zone.z) < 2.2 && !(c.y0 !== undefined));
  log.push(`препятствий у лестницы (круглых): ${nearLadder.length} ${nearLadder.length === 0 ? '— проход свободен' : 'ПЕРЕКРЫТО'}`);

  // 5) подъём по ВЕРТИКАЛЬНОЙ лестнице: W + взгляд вверх
  //    сперва проверяем, что к лестнице можно дойти пешком от спавна
  {
    const walk = await (async () => {
      p.teleport(d.barnLoc.spawn.x, d.barnLoc.spawn.z, 0);
      p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
      const tx = zone.x + 0.25, tz = zone.z;
      let stuck = 0, lastD = 1e9;
      for (let i = 0; i < 900; i++) {
        const dx = tx - p.pos.x, dz = tz - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.7) return { ok: true, dist, t: i / 60, pos: [p.pos.x, p.pos.z] };
        p.yaw = Math.atan2(-dx, -dz);   // yaw так, чтобы W двигал к цели
        p.pitch = 0;
        p.keys.add('KeyW');
        p.update(1 / 60);
        if (dist > lastD - 0.002) stuck++; else stuck = 0;
        lastD = dist;
        if (stuck > 220) return { ok: false, dist, t: i / 60, pos: [p.pos.x, p.pos.z] };
      }
      return { ok: false, dist: lastD, t: 15, pos: [p.pos.x, p.pos.z] };
    })();
    p.keys.clear();
    log.push(`пеший путь к лестнице: ${walk.ok ? 'ДОШЁЛ' : 'ЗАСТРЯЛ'} за ${walk.t.toFixed(1)} с, до цели ${walk.dist.toFixed(2)} м, поз=(${walk.pos[0].toFixed(1)}, ${walk.pos[1].toFixed(1)})`);
  }
  p.teleport(zone.x + 0.25, zone.z, 0);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  p.pitch = 0.55;                       // смотрим вверх
  let maxFeet = 0, drops = 0, lastY = 0, climbed = false;
  for (let i = 0; i < 700; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    const feet = p.groundY + p.y;
    if (feet < lastY - 0.01) drops++;
    lastY = feet;
    maxFeet = Math.max(maxFeet, feet);
    if (p.climb === null && p.groundY > 3.5) { climbed = true; break; }
  }
  p.keys.clear();
  log.push(`подъём по лестнице: max=${maxFeet.toFixed(2)} (настил 4.30) наверху=${climbed ? 'ДА' : 'НЕТ'} падений=${drops} pos=(${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}) y=${p.groundY.toFixed(2)}`);

  // 6) настил сеновала
  p.teleport(3.0, 0, 0); p.y = 4.3; p.groundY = 4.3;
  log.push(`пол сеновала: ${p.groundAt(3.0, 0).toFixed(2)}`);
  // люк для сена — под ним должен быть пол первого этажа
  p.teleport(1.5, -0.2, 0); p.y = 0.0; p.groundY = 0.0;
  log.push(`люк для сена (должно быть 0): ${p.groundAt(1.5, -0.2).toFixed(2)}`);
  // проём под лестницу: под ним тоже первый этаж
  p.teleport(zone.x, zone.z, 0); p.y = 0; p.groundY = 0;
  log.push(`проём под лестницу (должно быть 0): ${p.groundAt(zone.x, zone.z).toFixed(2)}`);

  // 7) спуск обратно: S + взгляд вниз
  p.teleport(zone.x + 0.7, zone.z, 0);
  p.y = 0; p.groundY = 0;
  p.pitch = -0.45;
  let minFeet = 99, down = false;
  for (let i = 0; i < 700; i++) {
    p.keys.add('KeyS');
    p.update(1 / 60);
    const feet = p.groundY + p.y;
    minFeet = Math.min(minFeet, feet);
    if (p.climb === null && p.groundY < 0.5) { down = true; break; }
  }
  p.keys.clear();
  log.push(`спуск: min=${minFeet.toFixed(2)} внизу=${down ? 'ДА' : 'НЕТ'} pos=(${p.pos.x.toFixed(2)}, ${p.pos.z.toFixed(2)}) y=${p.groundY.toFixed(2)}`);

  // 8) выход обратно в деревню
  p.teleport(0, -3.0, 0); p.y = 0; p.groundY = 0;
  const ex = d.interactables.find((x) => x.label === 'Выйти из амбара');
  const dEx = Math.hypot(p.pos.x - ex.pos.x, p.pos.z - ex.pos.z);
  log.push(`до выхода: ${dEx.toFixed(2)} м ${dEx < ex.radius ? 'в радиусе' : 'НЕ В РАДИУСЕ'}`);
  ex.act();
  log.push(`после выхода: loc=${d.loc} pos=(${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
  return { log, errs };
});
console.log(res.log.join('\n'));
console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
