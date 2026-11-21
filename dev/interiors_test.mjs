import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const BASE = process.env.TEST_URL || 'http://127.0.0.1:4205';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });

// запускаем игру: без этого игрок выключен и update() ничего не делает
await page.click('#begin');
await page.waitForTimeout(1500);

const ok = (n, c) => console.log(`${c ? '✓' : '✗'} ${n}`);
const dbg = () => page.evaluate(() => window.__dbg);

/* ---- вход в таверну ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  // координаты берём из самой игры, а не из зашитых чисел:
  // трактир переезжал, и старые координаты роняли весь каскад проверок
  const it = d.interactables.find(i => i.label.startsWith('Войти в таверну'));
  d.teleport(it.pos.x, it.pos.z + 0.2, 0);
});
await page.waitForTimeout(600);
await page.evaluate(() => window.__dbg.doInteract());
await page.waitForTimeout(1200);
let st = await page.evaluate(() => ({ loc: window.__dbg.loc }));
ok('вход в таверну', st.loc === 'tavern');

/* ---- контроль: игрок живой и ходит ---- */
const alive = await page.evaluate(() => {
  const p = window.__dbg.player;
  return { enabled: p.enabled, acceptInput: p.acceptInput };
});
ok(`игрок включён (enabled=${alive.enabled}, ввод=${alive.acceptInput})`, alive.enabled && alive.acceptInput);

/* ---- комнаты второго этажа ---- */
const rooms = await page.evaluate(() => {
  const d = window.__dbg;
  return (d.tavernLoc.rooms || []).map((r) => ({ ...r }));
});
ok(`комнат на втором этаже: ${rooms.length}`, rooms.length >= 3);

for (const r of rooms) {
  const info = await page.evaluate((rm) => {
    const d = window.__dbg;
    const p = d.player;
    // встаём рядом с кроватью
    p.teleport(rm.bedX, rm.bedZ - 1.2, 0);
    p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
    // ищем интеракт «переночевать» рядом
    const it = d.interactables.filter((i) => (i.where || 'village') === 'tavern'
      && /переночевать/i.test(i.label || ''))
      .map((i) => ({ label: i.label, d: Math.hypot(p.pos.x - i.pos.x, p.pos.z - i.pos.z) }))
      .sort((a, b) => a.d - b.d)[0];
    return { label: it ? it.label : null, dist: it ? it.d : 999, y: p.y };
  }, r);
  ok(`у кровати (${r.name}) есть интеракт «переночевать»`, !!info.label && info.dist < 3.0);
}

/* ---- переночевать переводит мир на утро ---- */
const night = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const r = d.tavernLoc.rooms[0];
  p.teleport(r.bedX, r.bedZ - 1.0, 0);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  d.env.setTimeOfDay('night', true);
  const before = d.env.target;
  const label = (d.nearestInteractable() || {}).label || '';
  const done = d.doInteract();
  return { before, after: d.env.target, done, label };
});
ok(`ночлег: «${night.label}» переводит время суток ${night.before} → ${night.after}`,
  night.done && night.before === 'night' && night.after === 'morning');

/* ---- контроль: в пустом месте игрок идёт ---- */
const walkFree = await page.evaluate(() => {
  const p = window.__dbg.player;
  p.teleport(0, -3.0, 0);
  p.y = 0; p.groundY = 0; p.vy = 0;
  const p0 = { x: p.pos.x, z: p.pos.z };
  for (let i = 0; i < 30; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  return { moved: Math.hypot(p.pos.x - p0.x, p.pos.z - p0.z) };
});
ok(`контроль: в пустом месте игрок идёт (${walkFree.moved.toFixed(2)} м)`, walkFree.moved > 0.5);

/* ---- ниши: вход через дверь в стене, боковая перегородка глухая ---- */
const wallTest = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const r = d.tavernLoc.rooms[1];          // средняя ниша
  const doorX = r.doorX, doorZ = r.doorZ;
  // 1. идём в дверь ниши: из зала перед нишами — сквозь проём в стене.
  // yaw = π — движение в сторону +z
  p.teleport(doorX, doorZ - 1.6, Math.PI);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  for (let i = 0; i < 150; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  const throughDoor = { z: p.pos.z, inAlcove: p.pos.z > doorZ + 0.4 };
  // 2. боковая перегородка между нишами — глухая: идём вбок и упираемся
  p.teleport(r.bedX, r.bedZ - 0.4, Math.PI / 2);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  for (let i = 0; i < 120; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  const side = { x: p.pos.x, inside: p.pos.x > r.x - r.w / 2 + 0.15 };
  return { throughDoor, side, wallX: r.x - r.w / 2 };
});
ok(`через дверь в стене можно войти в нишу (z=${wallTest.throughDoor.z.toFixed(2)})`,
  wallTest.throughDoor.inAlcove);
ok(`боковая перегородка ниши глухая (x=${wallTest.side.x.toFixed(2)}, стена ${wallTest.wallX.toFixed(2)})`,
  wallTest.side.inside);

/* ---- каждая ниша проходима: вход через дверь и свободный проход к окну ---- */
const nicheWalk = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const out = [];
  for (const r of d.tavernLoc.rooms) {
    const x1 = r.x + r.w / 2;
    // 1. вход в нишу через дверь (из зала, сквозь проём)
    p.teleport(r.doorX, r.doorZ - 1.4, Math.PI);
    p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
    for (let i = 0; i < 120; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
    const entered = p.pos.z;
    // 2. ищем свободный проход к окну: перебираем поперечные позиции
    //    и смотрим, от какой точки игрок доходит до северной стены
    let best = null, bestX = 0, band = 0, run = 0;
    for (let x = x1 - 1.6; x <= x1 - 0.35; x += 0.1) {
      p.teleport(x, r.doorZ + 0.35, Math.PI);
      p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
      for (let i = 0; i < 200; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
      p.keys.clear();
      const reached = p.pos.z;
      if (reached > r.z + r.d / 2 - 0.75) {
        if (!best || reached > best) { best = reached; bestX = x; }
        run += 0.1;
        band = Math.max(band, run);
      } else run = 0;
    }
    out.push({
      name: r.name, entered, toWindow: best || 0, bestX,
      okEnter: entered > r.doorZ + 0.3,
      okWindow: !!best,
      width: +band.toFixed(2),
    });
  }
  return out;
});
for (const n of nicheWalk) {
  ok(`ниша «${n.name}»: вход через дверь (z=${n.entered.toFixed(2)})`, n.okEnter);
  ok(`ниша «${n.name}»: свободный проход к окну (дошёл до z=${n.toWindow.toFixed(2)}, x=${n.bestX.toFixed(2)})`,
    n.okWindow);
  ok(`ниша «${n.name}»: ширина свободного прохода ${n.width.toFixed(2)} м`, n.width >= 0.6);
}

/* ---- выход из лестницы: на настиле есть куда идти ---- */
const ladderExit = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const zone = d.tavernLoc.climbs[0];
  const res = [];
  // высаживаемся там же, куда ставит игрока подъём
  p.teleport(zone.exitX, zone.exitZ, -Math.PI / 2);   // смотрим на восток
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  const s = { x: p.pos.x, z: p.pos.z };
  for (let i = 0; i < 150; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  res.push({ dir: 'на восток', moved: Math.hypot(p.pos.x - s.x, p.pos.z - s.z) });
  // и на север — вдоль стены ниш
  p.teleport(zone.exitX, zone.exitZ, 0);              // yaw = 0 → движение в -z
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  const s2 = { x: p.pos.x, z: p.pos.z };
  for (let i = 0; i < 150; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  res.push({
    dir: 'на юг (край галереи)',
    moved: Math.hypot(p.pos.x - s2.x, p.pos.z - s2.z),
    onFloor: p.groundY + p.y > 4.0,
  });
  return { exit: { x: zone.exitX, z: zone.exitZ }, res };
});
for (const r of ladderExit.res) {
  if (r.dir.startsWith('на юг')) {
    // на юг — край галереи: там перила, игрок должен упереться в них,
    // но остаться на настиле и не пройти сквозь
    ok(`выход из лестницы: на юг — перила держат (${r.moved.toFixed(2)} м, на настиле)`,
      r.moved > 0.2 && r.moved < 1.2 && r.onFloor);
  } else {
    ok(`выход из лестницы: ${r.dir} — игрок проходит ${r.moved.toFixed(2)} м`, r.moved > 0.45);
  }
}

/* ---- на втором этаже нет коллайдеров без видимой геометрии ---- */
const ghosts = await page.evaluate(() => {
  const d = window.__dbg;
  const THREE = d.THREE;
  const group = d.tavernLoc.group;
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const dirs = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const bad = [];
  for (const b of d.tavernLoc.colliders.boxes) {
    if (b.y0 < 4.0 || b.y1 < 4.2) continue;            // только второй этаж
    if (b.hx > 1.5 || b.hz > 1.5) continue;             // длинные секции — перила и стены
    const y = Math.min(b.y1 - 0.02, Math.max(b.y0 + 0.02, b.y0 + (b.y1 - b.y0) * 0.35));
    let hit = 0;
    for (const [dx, dy, dz] of dirs) {
      ray.set(new THREE.Vector3(b.cx, y, b.cz), new THREE.Vector3(dx, dy, dz));
      ray.far = 0.35;
      if (ray.intersectObjects(meshes, false).length) hit++;
    }
    if (hit === 0) bad.push(`${b.cx.toFixed(2)},${b.cz.toFixed(2)} ${b.hx}×${b.hz}`);
  }
  return bad;
});
ok(`нет невидимых коллайдеров на втором этаже (${ghosts.length})`, ghosts.length === 0);
if (ghosts.length) console.log('   ', ghosts.slice(0, 6));

/* ---- в зале перед нишами свободный проход (столики убрали) ---- */
const hallTest = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  // идём вдоль зала перед нишами (yaw = -PI/2 — движение в +x)
  p.teleport(-3.2, 4.35, -Math.PI / 2);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  for (let i = 0; i < 220; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  // и отдельно: в коллайдерах таверны в зале перед нишами
  const hall = d.tavernLoc.colliders.boxes.filter(
    (b) => b.cz > 4.3 && b.cz < 5.6 && b.y0 >= 4.0,
  );
  // столик/лавка — широкий и глубокий; сундук у стены — узкий
  const wide = hall.filter((b) => b.hx > 0.6 || b.hz > 0.5).length;
  return { x: p.pos.x, total: hall.length, wide };
});
ok(`в зале перед нишами свободный проход вдоль стены (x=${hallTest.x.toFixed(2)})`,
  hallTest.x > 5.4);
ok(`в зале перед нишами нет столов и лавок (широких преград: ${hallTest.wide})`,
  hallTest.wide === 0);

/* ---- подъём по лестнице работает и второй этаж достижим ---- */
const climb = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  const zone = d.tavernLoc.climbs[0];
  // встаём рядом с лестницей: ровно в центре зоны стоит коллайдер стоек
  p.teleport(zone.x + 0.3, zone.z, 0);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  p.pitch = 0.55;
  p.keys.clear();
  let max = 0, climbed = false;
  for (let i = 0; i < 700; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
    const feet = p.groundY + p.y;
    max = Math.max(max, feet);
    if (p.climb === null && p.groundY > 3.5) { climbed = true; break; }
  }
  p.keys.clear();
  return { max, climbed, end: p.groundY };
});
ok(`подъём на второй этаж (max=${climb.max.toFixed(2)}, настил 4.20)`, climb.max > 4.0 && climb.climbed);

/* ---- настил расширен: балкон над баром ---- */
const wing = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  p.teleport(5.5, 0.35, 0);
  p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
  for (let i = 0; i < 30; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  return { y: p.groundY + p.y, supported: p.grounded };
});
ok('балкон над баром держит игрока', wing.y > 3.9 && wing.y < 4.5);

/* ---- стойки фахверка — настоящие препятствия ---- */
const postTest = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  // восточная стойка таверны: x = hw - inset = 7.19, z = 0
  p.teleport(6.2, 0, -Math.PI / 2);      // yaw = -π/2 → W ведёт в +x
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  const startX = p.pos.x;
  for (let i = 0; i < 90; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  return { startX, endX: p.pos.x };
});
ok('стойка фахверка не пропускает сквозь себя', postTest.endX < 7.0);

/* ---- амбар: загон и стойки ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('village');
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  const d = window.__dbg;
  // дверь амбара — из данных игры (амбар переезжал в раунде 48)
  const it = d.interactables.find(i => i.label === 'Войти в амбар');
  d.teleport(it.pos.x, it.pos.z + 0.2, 0);
});
await page.waitForTimeout(500);
await page.evaluate(() => window.__dbg.doInteract());
await page.waitForTimeout(1200);
const barn = await page.evaluate(() => ({ loc: window.__dbg.loc }));
ok('вход в амбар', barn.loc === 'barn');

const barnPost = await page.evaluate(() => {
  const d = window.__dbg;
  const p = d.player;
  // промежуточная стойка западной стены амбара: x = -(hw - inset), z = 0
  const walls = d.barnLoc.colliders.boxes.filter((b) => b.hx < 0.2 && b.hz < 0.2);
  if (!walls.length) return { skipped: true };
  const w = walls.find((b) => Math.abs(b.cz) < 0.3) || walls[0];
  p.teleport(w.cx - 1.2, w.cz, -Math.PI / 2);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  for (let i = 0; i < 90; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  return { endX: p.pos.x, wallX: w.cx };
});
ok('стойка амбара держит', barnPost.skipped || barnPost.endX < barnPost.wallX + 0.25);

console.log('\nошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
process.exit(errs.length ? 1 : 0);
