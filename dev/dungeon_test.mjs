/**
 * Автотест подземелья: вход, интерьер, маршрут до Врат и обратно, выход.
 * Запуск: cd dev && node dungeon_test.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
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
  const ok = (cond, text) => log.push(`${cond ? '✓' : '✗'} ${text}`);

  const gate = d.ctx.doors.dungeon;
  log.push(`вход в подземелье: (${gate.x.toFixed(1)}, ${gate.z.toFixed(1)})`);
  const dist = Math.hypot(gate.x, gate.z);
  ok(dist > 80 && dist < 130, `вход далеко от деревни: ${dist.toFixed(0)} м`);

  // 1) интеракт входа есть и рядом с игроком
  const it = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  ok(!!it, 'есть интеракт «Спуститься в подземелье»');
  if (!it) return log;
  p.teleport(it.pos.x + 1.2, it.pos.z + 1.2, 0);
  p.y = 0; p.groundY = 0;
  const d0 = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
  ok(d0 < it.radius, `интеракт в радиусе (${d0.toFixed(2)} м)`);
  it.act();
  await new Promise((r) => setTimeout(r, 200));
  ok(d.loc === 'dungeon', `переход в подземелье: loc=${d.loc}`);

  const spot = d.dungeonLoc;
  if (!spot) { log.push('✗ локация подземелья недоступна'); return log; }

  /* ---------------- helpers ---------------- */
  const step = (yaw) => { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); };
  const walkTo = (tx, tz, max = 700, tol = 0.3) => {
    for (let i = 0; i < max; i++) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z;
      if (Math.hypot(dx, dz) < tol) return true;
      step(Math.atan2(-dx, -dz));
    }
    return Math.hypot(tx - p.pos.x, tz - p.pos.z) < tol;
  };

  // 2) игрок появился ВНУТРИ зала, а не в стене
  ok(Math.hypot(p.pos.x - spot.spawn.x, p.pos.z - spot.spawn.z) < 3,
    `игрок у портала пещеры (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
  ok(p.groundAt(p.pos.x, p.pos.z) > -1, `под ногами пол (${p.groundAt(p.pos.x, p.pos.z).toFixed(2)})`);
  // не внутри стены: расстояние до ближайшего прямоугольного коллайдера
  const insideWall = (c) => {
    const dx = Math.abs(p.pos.x - c.cx) - c.hx;
    const dz = Math.abs(p.pos.z - c.cz) - c.hz;
    return dx < 0 && dz < 0 && p.groundY + p.y < c.y1 && p.groundY + p.y > c.y0;
  };
  ok(!spot.colliders.boxes.some(insideWall), 'игрок не внутри стены');

  // 3) свет: кристаллы и точки света
  let lights = 0, emissive = 0, glows = 0, maxEm = 0;
  d.sceneDungeon.traverse((o) => {
    if (o.isPointLight) lights++;
    if (o.isSprite) glows++;
    if (o.isMesh && o.material && o.material.emissiveIntensity > 1) {
      emissive++;
      maxEm = Math.max(maxEm, o.material.emissiveIntensity);
    }
  });
  ok(lights >= 10, `в пещере есть точечные источники: ${lights}`);
  ok(emissive >= 2 && maxEm > 2, `светящиеся кристаллы: ${emissive} (яркость ${maxEm.toFixed(1)})`);
  ok(glows >= 20, `мягких ореолов света: ${glows}`);
  ok(d.sceneDungeon.fog && d.sceneDungeon.fog.density > 0.01, 'в пещере есть туман');
  ok(d.sceneDungeon.background.getHex() < 0x101020, 'фон пещеры почти чёрный');

  // 4) маршрут: входной зал → кристальный зал
  const r = spot.rooms;
  ok(!!r && !!r.entry && !!r.crystal && !!r.shaft && !!r.gate, 'у локации описаны залы');
  const reachedEntry = walkTo(0, -23);
  ok(reachedEntry, `дошли до южного проёма входного зала (z=${p.pos.z.toFixed(1)})`);

  const reachedHall = walkTo(0, -8);
  ok(reachedHall, `прошли в кристальный зал (z=${p.pos.z.toFixed(1)})`);

  // 5) спуск в шахту — вниз по каменной лестнице
  const reachedShaft = walkTo(0, 10);
  ok(reachedShaft, `дошли до спуска (z=${p.pos.z.toFixed(1)})`);
  ok(p.groundY + p.y < -1.0, `идём по лестнице вниз (y=${(p.groundY + p.y).toFixed(2)})`);

  // 6) зал Врат
  const reachedGate = walkTo(0, 27);
  ok(reachedGate, `дошли до алтаря Врат (z=${p.pos.z.toFixed(1)})`);
  ok(p.groundY + p.y < -3.0, `мы на нижнем уровне (y=${(p.groundY + p.y).toFixed(2)})`);

  // 7) обратно наверх — лестница должна вывести на верхний ярус
  const backShaft = walkTo(0, 9);
  ok(backShaft, `вернулись к лестнице (z=${p.pos.z.toFixed(1)})`);
  const climbed = walkTo(0, 4);
  ok(climbed, `поднялись по лестнице (z=${p.pos.z.toFixed(1)})`);
  ok(p.groundY + p.y > -1.0, `снова на верхнем ярусе (y=${(p.groundY + p.y).toFixed(2)})`);

  // 8) выход наружу — интеракт должен быть достижим пешком
  const out = d.interactables.find((x) => x.label === 'Подняться на поверхность');
  ok(!!out, 'есть интеракт «Подняться на поверхность»');
  if (out) {
    const reachedExit = walkTo(out.pos.x, out.pos.z, 900, 0.8);
    ok(reachedExit, `дошли до портала (x=${p.pos.x.toFixed(1)}, z=${p.pos.z.toFixed(1)})`);
    const d1 = Math.hypot(p.pos.x - out.pos.x, p.pos.z - out.pos.z);
    ok(d1 < out.radius, `выход в радиусе (${d1.toFixed(2)} м)`);
    ok(p.groundY + p.y > 0.8, `выход на площадке портала (y=${(p.groundY + p.y).toFixed(2)})`);
    out.act();
    await new Promise((r2) => setTimeout(r2, 200));
    ok(d.loc === 'village', `возврат в деревню: loc=${d.loc}`);
    const back = Math.hypot(p.pos.x - gate.x, p.pos.z - gate.z);
    ok(back < 8, `игрок вернулся к входу (${back.toFixed(1)} м)`);
  }
  return log;
});

// ---- внешний вход: дорога не через дома, лестница у скалы ----
{
  const { dungeonTrail, LAYOUT } = await import('../src/game/layout.js');
  const pts = dungeonTrail();

  // прямоугольник здания в мировых координатах
  const rectOf = (cx, cz, ry, hx, hz) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [[cx + hx * c - hz * s, cz - hx * s - hz * c],
      [cx - hx * c - hz * s, cz + hx * s - hz * c],
      [cx - hx * c + hz * s, cz + hx * s + hz * c],
      [cx + hx * c + hz * s, cz - hx * s + hz * c]];
  };
  const inside = (pt, rect) => {
    const [a, b, c, d] = rect;
    // признак точки внутри четырёхугольника по знакам векторных произведений
    const cross = (p1, p2, p3) => (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    const signs = [cross(a, b, pt), cross(b, c, pt), cross(c, d, pt), cross(d, a, pt)];
    // точка внутри выпуклого многоугольника, если все знаки одинаковы
    return !(signs.some((v) => v > 0) && signs.some((v) => v < 0));
  };
  const ryToFace = (from, to) => {
    const dx = to[0] - from[0], dz = to[1] - from[1];
    const l = Math.hypot(dx, dz) || 1;
    return Math.atan2(-dx / l, -dz / l);
  };
  const tavern = LAYOUT.tavern;
  const barn = LAYOUT.barn;
  const rects = [
    ['таверна', rectOf(tavern.x, tavern.z, ryToFace([tavern.x, tavern.z], [0, 0]), 13 / 2 + 1, 12 / 2 + 1)],
    ['амбар', rectOf(barn.x, barn.z, ryToFace([barn.x, barn.z], [-10, -4]), 13 / 2 + 1, 9 / 2 + 1)],
  ];
  let hits = [];
  for (const [name, rect] of rects) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (inside(pt, rect)) hits.push(`${name} на участке ${i}`);
      }
    }
  }
  res.push(`${hits.length ? '✗' : '✓'} дорога к скале не проходит через строения${hits.length ? ': ' + [...new Set(hits)].join(', ') : ''}`);
  res.push(`${pts.length >= 8 ? '✓' : '✗'} дорога извилистая: ${pts.length} точек`);
}

for (const line of res) console.log(line);
console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
const failed = res.filter((l) => l.startsWith('✗')).length;
console.log(failed ? `ПРОВАЛЕНО проверок: ${failed}` : 'Все проверки пройдены');
await browser.close();
process.exit(failed ? 1 : 0);
