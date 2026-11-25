/**
 * ============================================================================
 *  Раунд 63 — проверка правок игрока: дверь храма и окна таверны
 * ============================================================================
 *
 *  Два пункта:
 *   1) дверь из нефа в звонарную (и с башенной стороны) стала шире:
 *      0,9 → 1,2 м. Проверяем настоящей геометрией: пускаем лучи по стене
 *      и смотрим, где полотно, где косяки, где кладка. Полотно должно быть
 *      шире прежнего, косяки — по обе стороны, а в стене не должно быть
 *      щели (сквозь неё по-прежнему не пройти).
 *   2) окна трактира стоят на логичном уровне и совпадают с обеих сторон:
 *      фасад считает высоту от цоколя, интерьер — от пола зала. Нижний ряд
 *      поднят, верхние окна больше не висят под самым карнизом.
 *
 *  Запуск: cd /workspace/village && node dev/r63_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Корень проекта — путь считаем от файла теста, а не от рабочей папки. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

let ok = 0, fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} [info] подробности
 */
function check(name, cond, info = '') {
  if (cond) { ok++; results.push(`  ok   ${name}`); }
  else { fail++; results.push(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

/* ---------------- 0. исходники ---------------- */
const src = {
  plan: fs.readFileSync(path.join(ROOT, 'src/world/tavernPlan.js'), 'utf8'),
  buildings: fs.readFileSync(path.join(ROOT, 'src/world/buildings.js'), 'utf8'),
  tavern: fs.readFileSync(path.join(ROOT, 'src/world/tavern.js'), 'utf8'),
  church: fs.readFileSync(path.join(ROOT, 'src/world/church.js'), 'utf8'),
};
check('план окон лежит в отдельном файле', src.plan.includes('TAVERN_WINDOWS'));
check('фасад берёт окна из плана', src.buildings.includes('TAVERN_WINDOWS.southLow'));
check('фасад прибавляет цоколь к высоте окна', src.buildings.includes('BASE + win.y'));
check('интерьер берёт окна из плана', src.tavern.includes('TAVERN_WINDOWS.north'));
check('старых окон в фасаде не осталось',
  !/addWindow\(B, fx, 1\.5/.test(src.buildings) && !/addWindow\(B, fx, 5\.5/.test(src.buildings));
check('дверь храма расширена до 1,2 м', /const ARK_W = 1\.2;/.test(src.church));

/* ---------------- 1. дверь храма: настоящая геометрия ---------------- */
const door = await page.evaluate(() => {
  const d = window.__dbg;
  const loc = d.ctx.systems.locations.churchLoc;
  const scene = loc.scene;

  /**
   * Пустить луч и вернуть материалы всех попаданий.
   *
   * @param {number[]} from начало
   * @param {number[]} to конец
   * @returns {object[]} попадания
   */
  const cast = (from, to) => {
    const a = new d.THREE.Vector3(from[0], from[1], from[2]);
    const b = new d.THREE.Vector3(to[0], to[1], to[2]);
    const rc = new d.THREE.Raycaster(a, b.sub(a).normalize());
    rc.camera = d.camera;   // в сцене есть спрайты свечения: без камеры рейкаст падает
    return rc.intersectObjects(scene.children, true).map((h) => ({
      mat: h.object.material && h.object.material.name,
      y: +h.point.y.toFixed(2),
      z: +h.point.z.toFixed(2),
    }));
  };

  /**
   * Обойти стену лучом и собрать, где полотно, где косяк, где кладка.
   *
   * @param {number} z0 откуда пускать
   * @param {number} z1 докуда
   * @param {number} y высота луча
   * @returns {object} карта материалов
   */
  const sweep = (z0, z1, y) => {
    const leaf = [], jamb = [], wall = [];
    for (let x = -4.3; x <= -1.7; x += 0.05) {
      const hits = cast([x, y, z0], [x, y, z1]);
      if (!hits.length) continue;
      const m = hits[0].mat;
      // полотно, филёнки, петли и кольцо — всё это дверь
      if (m === 'oakDoor' || m === 'timber' || m === 'iron') leaf.push(+x.toFixed(2));
      else if (m === 'stoneDark') jamb.push(+x.toFixed(2));
      else wall.push(+x.toFixed(2));
    }
    const span = (arr) => (arr.length
      ? { from: arr[0], to: arr[arr.length - 1], n: arr.length } : null);
    return { leaf: span(leaf), jamb: span(jamb), wall: span(wall), leafN: leaf.length, jambN: jamb.length };
  };

  // неф: луч от алтаря к двери в башню
  const nave = sweep(7.6, 9.8, 1.0);
  // башня: луч от лестницы к той же двери с другой стороны
  const tower = sweep(11.4, 9.9, 1.0);

  // сплошная ли стена: между косяками не должно быть кладки
  const gap = [];
  for (let x = -3.7; x <= -2.3; x += 0.05) {
    const hits = cast([x, 1.0, 7.6], [x, 1.0, 9.8]);
    if (hits.length && hits[0].mat === 'stone') gap.push(+x.toFixed(2));
  }

  // игрок по-прежнему не проходит сквозь стену, а по двери — переходит в башню
  const p = d.player;
  const ch = loc;
  p.teleport(ch.naveDoor.x + 0.6, ch.naveDoor.z - 2.2, 0);
  p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
  p.yaw = 0;
  for (let i = 0; i < 400; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
  p.keys.clear();
  const stopZ = +p.pos.z.toFixed(2);
  const blocked = p.pos.z < ch.naveDoor.z + 0.4;
  const act = d.ctx.interactables.find((x) => x.label === 'Открыть дверь в башню');
  let inTower = false;
  if (act) {
    act.act();
    inTower = d.player.pos.z > ch.spawnTower.z - 0.6 && d.player.pos.z < ch.spawnTower.z + 0.8;
  }
  return {
    nave, tower, gapN: gap.length, blocked, stopZ, inTower,
    doorW: ch.naveDoor.w,
  };
});

console.log('  неф: полотно', JSON.stringify(door.nave.leaf), 'косяки', JSON.stringify(door.nave.jamb));
console.log('  башня: полотно', JSON.stringify(door.tower.leaf), 'косяки', JSON.stringify(door.tower.jamb));

check('дверь храма шире прежних 0,9 м', door.doorW >= 1.15, `ширина ${door.doorW}`);
// видная часть полотна: края уходят под косяки (на 3 см с каждой стороны),
// прежде она была 0,90 м — теперь 1,10 м
check('полотно двери шире прежних 0,9 м',
  door.nave.leaf && (door.nave.leaf.to - door.nave.leaf.from) >= 1.05, JSON.stringify(door.nave.leaf));
check('полотно двери по центру проёма', door.nave.leaf
  && Math.abs((door.nave.leaf.from + door.nave.leaf.to) / 2 + 3.0) < 0.12, JSON.stringify(door.nave.leaf));
check('косяки стоят по обе стороны от полотна',
  door.nave.jambN >= 2 && door.nave.jamb.from < door.nave.leaf.from && door.nave.jamb.to > door.nave.leaf.to,
  JSON.stringify(door.nave.jamb));
check('в проёме нет щели (кладка не пробивается)', door.gapN === 0, `щелей ${door.gapN}`);
check('с башенной стороны дверь такой же ширины',
  door.tower.leaf && door.nave.leaf
  && Math.abs((door.tower.leaf.to - door.tower.leaf.from) - (door.nave.leaf.to - door.nave.leaf.from)) < 0.06,
  JSON.stringify(door.tower.leaf));
check('сквозь стену в башню не пройти', door.blocked === true, `z=${door.stopZ}`);
check('по двери игрок попадает в звонарную', door.inTower === true);

/* ---------------- 2. окна трактира снаружи ---------------- */
const facade = await page.evaluate(() => {
  const d = window.__dbg;
  const scene = d.scene;
  const f = d.ctx.footprints.find((x) => x.name === 'таверна');
  const c = Math.cos(f.ry), s = Math.sin(f.ry);
  /** Локальная точка фасада -> мир. */
  const world = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];

  /**
   * Что видно снаружи в данной точке фасада.
   *
   * @param {number[]} a начало луча (мир)
   * @param {number[]} b конец луча (мир)
   * @returns {string|null} материал
   */
  const hit = (a, b) => {
    const va = new d.THREE.Vector3(a[0], a[1], a[2]);
    const vb = new d.THREE.Vector3(b[0], b[1], b[2]);
    const rc = new d.THREE.Raycaster(va, vb.sub(va).normalize());
    rc.camera = d.camera;   // в сцене есть спрайты свечения: без камеры рейкаст падает
    const hits = rc.intersectObjects(scene.children, true);
    if (!hits.length) return null;
    const h = hits[0];
    const m = h.object.material;
    return {
      mat: m && m.name,
      hex: m && m.color ? '#' + m.color.getHexString() : '',
      obj: h.object.name || h.object.type,
      p: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
    };
  };

  /**
   * Южный фасад: окно на заданной высоте.
   *
   * @param {number} lx локальная x
   * @param {number} y высота
   * @returns {string|null} материал
   */
  const south = (lx, y) => {
    const p = world(lx, -9.4), q = world(lx, -8.4);
    return hit([p[0], y, p[1]], [q[0], y, q[1]]);
  };
  /**
   * Северный фасад.
   *
   * @param {number} lx локальная x
   * @param {number} y высота
   * @returns {string|null} материал
   */
  const north = (lx, y) => {
    const p = world(lx, 9.4), q = world(lx, 8.4);
    return hit([p[0], y, p[1]], [q[0], y, q[1]]);
  };
  /**
   * Восточный фасад.
   *
   * @param {number} lz локальная z
   * @param {number} y высота
   * @returns {string|null} материал
   */
  const east = (lz, y) => {
    const p = world(8.0, lz), q = world(6.6, lz);
    return hit([p[0], y, p[1]], [q[0], y, q[1]]);
  };

  return {
    lowNew: south(-3.5, 2.47), lowOld: south(-3.5, 1.5), lowOld2: south(3.5, 1.5),
    lowNew2: south(3.5, 2.47),
    highNew: south(-2.6, 5.71), highOld: south(-2.6, 6.5), highMid: south(2.6, 5.71),
    northNew: north(-1.15, 6.12), northOld: north(-1.15, 4.9),
    eastNew: east(-3.6, 5.82), eastOld: east(-3.6, 4.7),
  };
});
console.log('  фасад:', JSON.stringify(facade));
/** Стекло окна? */
const isGlass = (h) => !!h && h.mat === 'windowLit';
check('нижние окна таверны подняты на логичный уровень',
  isGlass(facade.lowNew) && isGlass(facade.lowNew2), JSON.stringify(facade));
check('на прежней высоте нижних окон стена глухая',
  !isGlass(facade.lowOld) && !isGlass(facade.lowOld2));
check('верхние окна таверны на новой высоте',
  isGlass(facade.highNew) && isGlass(facade.highMid), JSON.stringify(facade));
check('верхние окна больше не висят под карнизом', !isGlass(facade.highOld));
check('северные окна таверны на высоте ниш',
  isGlass(facade.northNew) && !isGlass(facade.northOld));
check('восточное окно таверны — над стойкой',
  isGlass(facade.eastNew) && !isGlass(facade.eastOld));

/* ---------------- 3. окна таверны внутри ---------------- */
/** Штора? Материалы полотна сделаны прямо в трактире, без имён — узнаём по цвету. */
const isCurtain = (m) => !!m && ['#d2c0a0', '#b59c7c', '#5c7245', '#495a37'].includes(m.hex);
const inside = await page.evaluate(() => {
  const d = window.__dbg;
  const scene = d.ctx.systems.locations.sceneTavern;

  /**
   * Материал первого попадания луча.
   *
   * @param {number[]} a начало
   * @param {number[]} b конец
   * @returns {object|null} материал
   */
  const hit = (a, b) => {
    const va = new d.THREE.Vector3(a[0], a[1], a[2]);
    const vb = new d.THREE.Vector3(b[0], b[1], b[2]);
    const rc = new d.THREE.Raycaster(va, vb.sub(va).normalize());
    rc.camera = d.camera;   // в сцене есть спрайты свечения: без камеры рейкаст падает
    const hits = rc.intersectObjects(scene.children, true);
    if (!hits.length) return null;
    const m = hits[0].object.material;
    return {
      mat: m && m.name,
      hex: m && m.color ? '#' + m.color.getHexString() : '',
    };
  };
  /** Южная стена зала. */
  const south = (x, y) => hit([x, y, -8.0], [x, y, -8.9]);
  /** Северная стена (ниши). */
  const north = (x, y) => hit([x, y, 7.8], [x, y, 8.9]);

  return {
    // 0,7 м — раньше тут было окно, а теперь глухая стена
    // (низ окна поднялся с 0,65 до 1,0 м)
    lowNew: south(-3.5, 1.85), lowOld: south(-3.5, 0.7),
    lowNew2: south(3.5, 1.85), lowOld2: south(3.5, 0.7),
    highNew: south(-2.6, 5.09), highOld: south(-2.6, 5.7),
    highMid: south(0, 5.09),
    northNew: north(-1.15, 5.5), northOld: north(-1.15, 4.4),
  };
});
console.log('  зал:', JSON.stringify(inside));
check('в зале нижние окна подняты', isCurtain(inside.lowNew) && isCurtain(inside.lowNew2),
  JSON.stringify(inside));
check('на прежней высоте в зале стена глухая',
  inside.lowOld.mat === 'tavernWall' && inside.lowOld2.mat === 'tavernWall',
  JSON.stringify(inside));
check('в зале верхние окна на высоте 5,09',
  isCurtain(inside.highNew) && isCurtain(inside.highMid), JSON.stringify(inside));
check('окна ниш на месте', isCurtain(inside.northNew) && !isCurtain(inside.northOld));

/* ---------------- 4. ошибки в консоли ---------------- */
check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log('\nРаунд 63 — проверка двери храма и окон таверны');
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
