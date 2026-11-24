/**
 * ============================================================================
 *  Раунд 61 — тест-агент: деревня (трактир, заборы, тропинки) + снимки
 * ============================================================================
 *
 *  Проверяю:
 *   1) трактир стоит на цоколе и не «утоплен» (сравниваю высоту стен
 *      трактира и домов в сцене);
 *   2) заборы не проходят сквозь стены домов и трактира;
 *   3) забор не перекрывает вход (крыльцо) каждого дома;
 *   4) тропинки не идут сквозь постройки;
 *   5) тропинка доходит до крыльца каждого дома и до трактира;
 *   6) снимки: вид сверху без тумана, трактир с улицы, цоколь, тропинки.
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_village.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

let ok = 0, fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} extra подробность
 */
function check(name, cond, extra = '') {
  if (cond) { ok++; results.push(`✓ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; results.push(`✗ ${name}${extra ? ' — ' + extra : ''}`); }
}

/* ================= снимок ================= */
/**
 * Снять кадр (SwiftShader рисует медленно — ждём новых кадров, а не sleep).
 *
 * Снимок делаем через page.screenshot, чтобы в кадр попал и интерфейс.
 *
 * @param {string} name имя файла
 */
async function grab(name) {
  const before = await page.evaluate(() => window.__frames || 0);
  await page.waitForFunction(
    (b) => (window.__frames || 0) > b + 1,
    before, { timeout: 300000 },
  );
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
  const size = fs.statSync(`${OUT}/${name}.jpg`).size;
  results.push(`· снимок ${name}.jpg (${Math.round(size / 1024)} КБ)`);
}

/* ================= 1. цоколь трактира ================= */
const podium = await page.evaluate(() => {
  const d = window.__dbg;
  const M = d.M;
  const box3 = new d.THREE.Box3();

  /**
   * Найти группу постройки рядом с точкой.
   *
   * @param {number} x координата X
   * @param {number} z координата Z
   * @returns {object|null} группа
   */
  const groupAt = (x, z) => {
    let best = null, bd = 1e9;
    for (const c of d.scene.children) {
      if (!c.isGroup && !c.isObject3D) continue;
      const dx = c.position.x - x, dz = c.position.z - z;
      const dd = dx * dx + dz * dz;
      if (dd < bd) { bd = dd; best = c; }
    }
    return best;
  };

  /**
   * Нижняя граница мешей заданного материала внутри группы.
   *
   * @param {object} group группа
   * @param {object[]} materials материалы
   * @returns {number|null} минимальный Y
   */
  const wallBase = (group, materials) => {
    let min = null;
    group.traverse((o) => {
      if (!o.isMesh) return;
      if (!materials.includes(o.material)) return;
      box3.setFromObject(o);
      if (min === null || box3.min.y < min) min = box3.min.y;
    });
    return min;
  };

  const tav = groupAt(-17, -13);
  const house = groupAt(-13, 14);
  const house2 = groupAt(13, 14);
  const tavWallBase = tav ? wallBase(tav, [M.tavernWall]) : null;
  const tavStone = tav ? wallBase(tav, [M.stone]) : null;
  const stoneTop = (g) => {
    if (!g) return null;
    let max = null;
    g.traverse((o) => {
      if (!o.isMesh || o.material !== M.stone) return;
      box3.setFromObject(o);
      if (max === null || box3.max.y > max) max = box3.max.y;
    });
    return max;
  };
  const houseWallBase = house ? wallBase(house, [M.plaster, M.plasterWarm, M.plasterGrey]) : null;
  const houseStoneTop = stoneTop(house);
  // высота крыльца — по платформам (там записана высота верхней площадки)
  const plats = (d.ctx.platforms || []).filter((p) => Math.abs(p.cx + 17) < 12 && Math.abs(p.cz + 13) < 14);
  const housePlats = (d.ctx.platforms || []).filter((p) => Math.abs(p.cx + 13) < 5 && Math.abs(p.cz - 14) < 5);
  return {
    tavWallBase, tavStone, tavStoneTop: stoneTop(tav),
    houseWallBase, houseStoneTop, house2WallBase: house2 ? wallBase(house2, [M.plaster, M.plasterWarm, M.plasterGrey]) : null,
    tavPlats: plats.map((p) => ({ y: +p.y.toFixed(2), cx: +p.cx.toFixed(1), cz: +p.cz.toFixed(1) })),
    housePlats: housePlats.map((p) => ({ y: +p.y.toFixed(2), cx: +p.cx.toFixed(1), cz: +p.cz.toFixed(1) })),
  };
});
check('стены трактира начинаются выше земли (есть цоколь)',
  podium.tavWallBase !== null && podium.tavWallBase > 0.4,
  `низ стен трактира: ${podium.tavWallBase} м`);
check('трактир стоит не ниже домов (не утоплен)',
  podium.tavWallBase !== null && podium.houseWallBase !== null && podium.tavWallBase >= podium.houseWallBase,
  `трактир ${podium.tavWallBase} м, дом ${podium.houseWallBase} м (разница ${(podium.tavWallBase - podium.houseWallBase).toFixed(2)} м)`);
check('цоколь трактира выше цоколя дома',
  podium.tavStoneTop !== null && podium.houseStoneTop !== null && podium.tavStoneTop > podium.houseStoneTop,
  `камень трактира до ${podium.tavStoneTop} м, камня дома до ${podium.houseStoneTop} м`);
check('у трактира есть ступени к крыльцу (вход не в стену)',
  podium.tavPlats.length >= 2 && podium.tavPlats.some((p) => p.y > 0.4) && podium.tavPlats.some((p) => p.y > 0.1 && p.y <= 0.4),
  `площадки у трактира: ${podium.tavPlats.map((p) => `y=${p.y}`).join(', ')}`);

/* ================= 2-5. геометрия: заборы и тропинки ================= */
const geo = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const boxes = [];
  for (const h of (ctx.homes || [])) {
    boxes.push({
      name: `дом ${h.i}`, x: h.x, z: h.z, hx: h.w / 2, hz: h.d / 2, ry: h.ry || 0,
      door: (ctx.doors && ctx.doors.homes && ctx.doors.homes[h.i]) || null,
    });
  }
  for (const f of (ctx.footprints || [])) {
    if (f.name === 'крыльцо храма') continue;
    if (/^дом /.test(f.name)) continue;      // дома уже взяты из ctx.homes
    boxes.push({
      name: f.name, x: f.x, z: f.z,
      hx: f.r ? f.r : f.hx, hz: f.r ? f.r : f.hz, ry: f.ry || 0, round: !!f.r,
    });
  }
  // столбы заборов: в игре это круги радиуса 0.26
  const posts = (ctx.colliders.circles || []).filter((c) => Math.abs(c.r - 0.26) < 0.001);
  return {
    boxes,
    posts: posts.map((p) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2) })),
    trails: (ctx.roadTrails || []).map((t) => ({ id: t.id, pts: t.pts })),
    doors: ctx.doors ? { tavernBack: ctx.doors.tavernBack || null, homes: ctx.doors.homes || [] } : null,
    tavernDoor: (() => {
      // дверь трактира: фасад смотрит на площадь
      const x = -17, z = -13;
      const ry = Math.atan2(-(0 - x), -(0 - z));
      const lz = -18 / 2 - 0.5;
      return {
        x: +(x + lz * Math.sin(ry)).toFixed(2),
        z: +(z + lz * Math.cos(ry)).toFixed(2),
      };
    })(),
  };
});

/** Точка в локальных осях прямоугольника. */
function toLocal(x, z, b) {
  const c = Math.cos(b.ry || 0), s = Math.sin(b.ry || 0);
  const dx = x - b.x, dz = z - b.z;
  return [c * dx - s * dz, s * dx + c * dz];
}

/** Пересекает ли отрезок прямоугольник (с запасом). */
function segHitsBox(a, b, box, pad = 0) {
  const la = toLocal(a[0], a[1], box);
  const lb = toLocal(b[0], b[1], box);
  let t0 = 0, t1 = 1;
  const dx = lb[0] - la[0], dz = lb[1] - la[1];
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r > t1) return false; if (r < t0) t0 = r; }
    return true;
  };
  if (!clip(-dx, la[0] + box.hx + pad)) return false;
  if (!clip(dx, box.hx + pad - la[0])) return false;
  if (!clip(-dz, la[1] + box.hz + pad)) return false;
  if (!clip(dz, box.hz + pad - la[1])) return false;
  return true;
}

/** Расстояние от точки до отрезка. */
function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - a[0]) * dx + (pz - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

/* --- 2. столбы заборов внутри построек --- */
const postProblems = [];
for (const p of geo.posts) {
  for (const b of geo.boxes) {
    const [lx, lz] = toLocal(p.x, p.z, b);
    const inside = b.round
      ? Math.hypot(lx, lz) < b.hx + 0.2
      : Math.abs(lx) < b.hx + 0.2 && Math.abs(lz) < b.hz + 0.2;
    if (inside) {
      postProblems.push(`столб забора (${p.x}, ${p.z}) внутри «${b.name}»`);
      break;
    }
  }
}
check('заборы не проходят сквозь стены домов и трактира', postProblems.length === 0,
  postProblems.length ? postProblems.slice(0, 8).join('; ') : `столбов забора проверено: ${geo.posts.length}`);

/* --- 3. забор не перекрывает крыльцо --- */
const doorBlocked = [];
for (const b of geo.boxes) {
  if (!b.door) continue;
  for (const p of geo.posts) {
    const d = Math.hypot(p.x - b.door.x, p.z - b.door.z);
    if (d < 2.0) { doorBlocked.push(`«${b.name}»: столб в ${d.toFixed(1)} м от двери (${p.x}, ${p.z})`); break; }
  }
}
check('забор не перекрывает вход в дом', doorBlocked.length === 0,
  doorBlocked.length ? doorBlocked.join('; ') : 'все двери свободны');

/* --- 4. тропинки сквозь постройки --- */
const trailProblems = [];
for (const t of geo.trails) {
  for (let i = 0; i < t.pts.length - 1; i++) {
    for (const b of geo.boxes) {
      if (b.round) continue;
      if (segHitsBox(t.pts[i], t.pts[i + 1], b, 0.25)) {
        trailProblems.push(`тропа «${t.id}» (отрезок ${i}) идёт сквозь «${b.name}»`);
      }
    }
  }
}
check('тропинки не идут сквозь постройки', trailProblems.length === 0,
  trailProblems.length ? trailProblems.slice(0, 8).join('; ') : `тропинок проверено: ${geo.trails.length}`);

/* --- 5. тропинка доходит до каждого крыльца --- */
const reach = [];
for (const b of geo.boxes) {
  if (!b.door) continue;
  let best = Infinity, bestId = '';
  for (const t of geo.trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(b.door.x, b.door.z, t.pts[i], t.pts[i + 1]);
      if (d < best) { best = d; bestId = t.id; }
    }
  }
  reach.push({ name: b.name, d: +best.toFixed(2), trail: bestId });
}
const farDoors = reach.filter((r) => r.d > 2.0);
check('до каждого дома есть тропинка до крыльца', farDoors.length === 0,
  farDoors.length ? farDoors.map((r) => `${r.name}: ${r.d} м (${r.trail})`).join('; ')
    : reach.map((r) => `${r.name}: ${r.d} м`).join(', '));

/* --- тропинка до трактира --- */
{
  let best = Infinity, bestId = '';
  for (const t of geo.trails) {
    for (let i = 0; i < t.pts.length - 1; i++) {
      const d = distSeg(geo.tavernDoor.x, geo.tavernDoor.z, t.pts[i], t.pts[i + 1]);
      if (d < best) { best = d; bestId = t.id; }
    }
  }
  check('до трактира доходит тропинка', best < 2.0,
    `дверь трактира (${geo.tavernDoor.x}, ${geo.tavernDoor.z}), ближайшая тропа «${bestId}» — ${best.toFixed(2)} м`);
}

/* ================= 6. снимки ================= */
/** Убрать туман (среда перезаписывает его каждый кадр). */
async function noFog() {
  await page.evaluate(() => {
    const d = window.__dbg;
    const f = d.scene.fog;
    if (!f) return;
    Object.defineProperty(f, 'near', { get: () => 1e6, set: () => {}, configurable: true });
    Object.defineProperty(f, 'far', { get: () => 2e6, set: () => {}, configurable: true });
    d.scene.background = new d.THREE.Color(0x9fb6c8);
  });
}

/**
 * Поставить камеру.
 *
 * @param {number[]} pos позиция
 * @param {number[]} look куда смотреть
 */
async function cam(pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
}

await noFog();
await cam([0, 118, 0.01], [0, 0, 0]);
await page.waitForTimeout(600);
await grab('TEST61_village_top');

await cam([-40, 12, 26], [-17, 2, -13]);
await page.waitForTimeout(600);
await grab('TEST61_tavern_front');

await cam([-17, 3.2, -2], [-17, 2.2, -13]);
await page.waitForTimeout(600);
await grab('TEST61_tavern_street');

await cam([-24.5, 2.0, -3.5], [-16.5, 1.0, -14]);
await page.waitForTimeout(600);
await grab('TEST61_tavern_podium');

await cam([-13, 2.2, 22], [-13, 1.4, 12]);
await page.waitForTimeout(600);
await grab('TEST61_house_podium');

await cam([-2, 3.0, 4], [-13, 1.4, 11]);
await page.waitForTimeout(600);
await grab('TEST61_trail_home');

await cam([-14.5, 2.4, 8.0], [-17, 1.2, -6]);
await page.waitForTimeout(600);
await grab('TEST61_trail_tavern');

await cam([22, 9, 20], [10, 1.5, 8]);
await page.waitForTimeout(600);
await grab('TEST61_street_east');

console.log(results.join('\n'));
console.log(`\ntester_r61_village: ${ok} ok, ${fail} fail`);
console.log('ошибки в консоли:', errs.length);
if (errs.length) console.log(errs.slice(0, 8).join('\n'));
await browser.close();
if (fail) process.exit(1);
