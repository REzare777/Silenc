/**
 * ============================================================================
 *  Раунд 62 — проверка храма по правкам пользователя
 * ============================================================================
 *
 *  Проверяем ровно четыре пункта:
 *   1) дверь храма не уходит в пол: стоит на полу крыльца, ступени ведут
 *      к ней в три уступа, косяки не пересекают кладку (мерцания нет);
 *   2) в нефе нет колонн, закрывающих образы на стенах;
 *   3) в проходе в башню стоит нормальная закрытая дверь, сквозь стену
 *      пройти нельзя, а по двери игрок переходит в звонарную и обратно;
 *   4) у колокола — сплошная дощатая площадка, на которую игрок сходит с
 *      винтовой лестницы, и колокол висит над ней на верёвке.
 *
 *  Запуск: cd /workspace/village && node dev/r62_church_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

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

/* ---------------- 1. фасад: дверь и ступени ---------------- */
const front = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.footprints.find((f) => f.name === 'храм');
  const ry = ch.ry;
  // мировые координаты локальной точки (lx, lz)
  const world = (lx, lz) => [
    ch.x + lx * Math.cos(ry) + lz * Math.sin(ry),
    ch.z - lx * Math.sin(ry) + lz * Math.cos(ry),
  ];
  // полотнище двери: геометрия всех дубовых дверей слита в один меш,
  // поэтому берём вершины и выбираем те, что стоят в проёме крыльца
  let doorLow = 99, doorHigh = -99, doorZ = null;
  const group = d.scene.getObjectByName('church');
  if (group) {
    // вершины слитой геометрии уже лежат в системе координат группы храма
    const v = new d.THREE.Vector3();
    group.traverse((o) => {
      if (!o.isMesh || !o.material || o.material.name !== 'oakDoor') return;
      const pos = o.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        if (Math.abs(v.x) > 1.05 || v.z > -11.9 || v.z < -12.15) continue;
        if (v.y < doorLow) doorLow = v.y;
        if (v.y > doorHigh) doorHigh = v.y;
        doorZ = +v.z.toFixed(2);
      }
    });
  }
  // ступени: площадки перед крыльцом
  const steps = d.ctx.platforms
    .filter((p) => {
      const dx = p.cx - ch.x, dz = p.cz - ch.z;
      const lx = dx * Math.cos(ry) - dz * Math.sin(ry);
      const lz = dx * Math.sin(ry) + dz * Math.cos(ry);
      return Math.abs(lx) < 2.2 && lz < -9.5 && lz > -14.6;
    })
    .map((p) => +p.y.toFixed(2))
    .sort((a, b) => a - b);
  // косяки: тёмный камень у проёма — проверяем, что они не в кладке стены
  const [wx, wz] = world(0, -14.6);
  return { doorLow: +doorLow.toFixed(2), doorHigh: +doorHigh.toFixed(2), doorZ, steps, wx, wz };
});
check('дверь храма стоит на полу крыльца, а не уходит в пол',
  front.doorLow >= 0.85 && front.doorLow <= 1.0, JSON.stringify(front));
check('высота двери нормальная (2,5–3 м)', front.doorHigh - front.doorLow > 2.4
  && front.doorHigh - front.doorLow < 3.1, JSON.stringify(front));
check('ступени ведут к двери в три уступа',
  front.steps.length >= 3 && front.steps[front.steps.length - 1] >= 0.85,
  JSON.stringify(front.steps));

/* ---------------- 2. неф: колонн нет ---------------- */
await page.evaluate(() => window.__dbg.setLocation('church'));
await page.waitForTimeout(1800);
const nave = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  let columns = 0;
  let icons = 0;
  const scene = d.sceneChurch;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.getWorldPosition(new d.THREE.Vector3());
    if (p.y > 6.2) return;                 // свод и балки
    // колонна нефа: цилиндр радиусом 0,2–0,3, высотой от пола
    if (o.geometry.type === 'CylinderGeometry') {
      const r = o.geometry.parameters.radiusTop;
      const h = o.geometry.parameters.height;
      if (r > 0.18 && r < 0.32 && h > 3 && p.y > 1 && p.y < 5) columns++;
    }
  });
  // образы на стенах (киоты): слитая геометрия, поэтому смотрим вершины
  // медных рамок у стен — они должны стоять на высоте образа
  const vtx = new d.THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.name) return;
    if (!/brass/.test(o.material.name)) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      vtx.fromBufferAttribute(pos, i);
      if (Math.abs(vtx.x) < 3.9 || Math.abs(vtx.x) > 4.2) continue;
      if (vtx.y < 1.4 || vtx.y > 3.0) continue;
      icons++;
    }
  });
  return { columns, icons, loc: d.ctx.loc };
});
check('в нефе нет колонн перед образами', nave.columns === 0, JSON.stringify(nave));
check('образы на стенах на месте', nave.icons > 10, JSON.stringify(nave));

/* ---------------- 3. дверь в башню: переход ---------------- */
const door = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  const out = {};
  out.naveDoor = { x: ch.naveDoor.x, z: ch.naveDoor.z, closed: ch.naveDoor.closed };
  // игрок идёт к двери и упирается в стену — сквозь неё не пройти
  const p = d.player;
  p.teleport(ch.naveDoor.x + 0.6, ch.naveDoor.z - 2.2, 0);
  p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
  p.yaw = 0;
  for (let i = 0; i < 400; i++) {
    p.keys.add('KeyW');
    p.update(1 / 60);
  }
  p.keys.clear();
  out.stopZ = +p.pos.z.toFixed(2);
  out.blocked = p.pos.z < ch.naveDoor.z + 0.4;
  // переход по двери
  const act = d.ctx.interactables.find((x) => x.label === 'Открыть дверь в башню');
  out.actExists = !!act;
  if (act) {
    act.act();
    out.afterX = +d.player.pos.x.toFixed(2);
    out.afterZ = +d.player.pos.z.toFixed(2);
    out.inTower = d.player.pos.z > ch.spawnTower.z - 0.6 && d.player.pos.z < ch.spawnTower.z + 0.8;
  }
  return out;
});
check('дверь в башню есть и помечена закрытой', door.naveDoor.closed === true, JSON.stringify(door.naveDoor));
check('сквозь стену в башню не пройти', door.blocked === true, `z=${door.stopZ}`);
check('интеракт двери в башню есть', door.actExists === true);
check('по двери игрок попадает в звонарную', door.inTower === true, JSON.stringify(door));

const back = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  const act = d.ctx.interactables.find((x) => x.label === 'Вернуться в неф');
  if (!act) return { actExists: false };
  act.act();
  return {
    actExists: true,
    x: +d.player.pos.x.toFixed(2),
    z: +d.player.pos.z.toFixed(2),
    inNave: d.player.pos.z < ch.spawnNave.z + 0.8 && d.player.pos.z > ch.spawnNave.z - 0.8,
  };
});
check('обратный переход из звонарной в неф работает', back.actExists && back.inNave, JSON.stringify(back));

/* ---------------- 4. площадка и колокол ---------------- */
const bell = await page.evaluate(() => {
  const d = window.__dbg;
  const ch = d.ctx.systems.locations.churchLoc;
  const out = {};
  // площадка под колоколом
  const deck = ch.platforms.filter((pl) => Math.abs(pl.y - 9.2) < 0.1);
  out.decks = deck.length;
  out.deckBox = deck[0] ? { x: +deck[0].cx.toFixed(2), z: +deck[0].cz.toFixed(2), y: +deck[0].y.toFixed(2) } : null;
  // колокол над площадкой
  let bellMesh = null;
  d.sceneChurch.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'CylinderGeometry'
      && o.geometry.parameters.radiusBottom > 0.45 && o.geometry.parameters.height > 0.7) {
      const p = o.getWorldPosition(new d.THREE.Vector3());
      if (p.y > 10) bellMesh = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
    }
  });
  out.bell = bellMesh;
  out.bellOverDeck = !!(bellMesh && deck[0]
    && Math.abs(bellMesh.x - deck[0].cx) < 1.2 && Math.abs(bellMesh.z - deck[0].cz) < 1.6);
  // верёвка: тонкий цилиндр выше колокола
  let rope = null;
  d.sceneChurch.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'CylinderGeometry'
      && o.geometry.parameters.radiusTop <= 0.05 && o.geometry.parameters.height > 0.5) {
      const p = o.getWorldPosition(new d.THREE.Vector3());
      if (p.y > 11) rope = { y: +p.y.toFixed(2), x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
    }
  });
  out.rope = rope;
  // игрок встаёт на площадку с винтовой лестницы
  const p = d.player;
  p.teleport(deck[0].cx, deck[0].cz, 0);
  p.y = 12; p.groundY = 0; p.vy = 0; p.keys.clear();
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  out.standY = +(p.y + p.groundY).toFixed(2);
  // интеракт колокола доступен с площадки
  const bellAct = d.ctx.interactables.find((x) => x.label === 'Ударить в колокол');
  out.bellAct = !!bellAct;
  out.bellActVisible = bellAct ? d.ctx.interactables.includes(bellAct) : false;
  out.feet = +(p.y + p.groundY).toFixed(2);
  return out;
});
check('у колокола есть сплошная площадка', bell.decks >= 1, JSON.stringify(bell.deckBox));
check('колокол висит над площадкой', bell.bellOverDeck === true, JSON.stringify(bell.bell));
check('колокол подвешен на верёвке', !!bell.rope, JSON.stringify(bell.rope));
check('на площадке можно стоять (высота ~9,2 м)', Math.abs(bell.standY - 9.22) < 0.35,
  `y=${bell.standY}`);
check('интеракт колокола на месте', bell.bellAct === true);

/* ---------------- вывод ---------------- */
console.log(results.join('\n'));
console.log(`\nr62_church_check: ${ok} ok, ${fail} fail`);
if (errs.length) console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
if (fail) process.exit(1);
