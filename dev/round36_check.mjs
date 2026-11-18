/**
 * ============================================================================
 *  Проверки раунда 36: бармен, фасады домов, храм
 * ============================================================================
 *
 *  Три задачи раунда проверяются объективно:
 *
 *   1. Бармен уходит домой через заднюю дверь за стойкой (а не исчезает
 *      в воздухе), а утром возвращается и снова ходит по маршруту.
 *   2. В фасаде каждого дома над дверью нет щели — стена сплошная.
 *      Раньше над дверным проёмом стены не было вовсе, и по центру дома
 *      зиял вертикальный провал во всю высоту стены.
 *   3. В двухэтажных домах перекрытие сплошное в центре комнаты, а люк
 *      для лестницы — в углу у стены. Храм живой: свет и пламя меняются.
 *
 *  Запуск: cd dev && node round36_check.mjs
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
  const T = d.THREE;
  const out = {};

  /* ---------- 1. бармен ---------- */
  d.ctx.systems.locations.setLocation('tavern');
  const npc = d.ctx.systems.locations.npcs.barkeep;
  const exit = d.ctx.systems.locations.tavernLoc.barExit;
  out.barExit = exit;

  d.ctx.env.setTimeOfDay('day', true);
  for (let i = 0; i < 300; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  const dayStart = { x: npc.x, z: npc.z };
  for (let i = 0; i < 300; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  out.dayWalks = Math.hypot(npc.x - dayStart.x, npc.z - dayStart.z) > 0.4;
  out.dayVisible = npc.group.visible !== false;
  out.dayAway = !!npc.away;

  d.ctx.env.setTimeOfDay('night', true);
  for (let i = 0; i < 900; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  out.nightAway = !!npc.away;
  out.nightHidden = npc.group.visible === false;
  out.nightAtDoor = Math.hypot(npc.x - exit.x, npc.z - exit.z) < 0.6;

  d.ctx.env.setTimeOfDay('morning', true);
  for (let i = 0; i < 60; i++) d.ctx.systems.locations.updateNpc(1 / 60, i / 60);
  out.backVisible = npc.group.visible !== false;
  out.backAway = !!npc.away;
  out.backAtBar = Math.hypot(npc.x - 6.28, npc.z - 2.3) < 1.6;

  /* ---------- 2. фасады домов ---------- */
  // на время включаем двусторонние материалы: луч изнутри дома должен
  // видеть внутреннюю грань стены
  const mats = new Set();
  d.scene.traverse((o) => { if (o.isMesh && o.material) mats.add(o.material); });
  const saved = [...mats].map((m) => m.side);
  mats.forEach((m) => { m.side = T.DoubleSide; });

  const ray = new T.Raycaster();
  // только настоящие меши: у части объектов геометрии нет, и raycast падает
  const meshes = [];
  d.scene.traverse((o) => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) meshes.push(o);
  });
  const V = T.Vector3;
  const facade = [];
  const mezz = [];
  for (const h of d.ctx.homes) {
    const c = Math.cos(h.ry), s = Math.sin(h.ry);
    const toWorld = (lx, lz) => new V(h.x + lx * c + lz * s, 0, h.z - lx * s + lz * c);
    // 1) луч изнутри в фасад, выше дверного проёма
    const from = toWorld(0, 0);
    from.y = 2.62;
    ray.set(from, new V(-s, 0, -c));
    const hits = ray.intersectObjects(meshes, false);
    const wall = hits.find((x) => x.distance < 5.2);
    facade.push({ i: h.i, ok: !!wall, dist: wall ? +wall.distance.toFixed(2) : -1 });
    // 2) перекрытие двухэтажного дома: в центре — сплошное, в углу — люк
    if (h.w >= 7) {
      const centre = toWorld(0, 0);
      centre.y = 1.0;
      ray.set(centre, new V(0, 1, 0));
      const up = ray.intersectObjects(meshes, false)
        .filter((x) => x.point.y > 3.0 && x.point.y < 4.3);
      const hole = toWorld(-2.6, -1.2);
      hole.y = 1.0;
      ray.set(hole, new V(0, 1, 0));
      const upHole = ray.intersectObjects(meshes, false)
        .filter((x) => x.point.y > 3.0 && x.point.y < 4.3);
      mezz.push({ i: h.i, solid: up.length > 0, holeOpen: upHole.length === 0 });
    }
  }
  mats.forEach((m, i) => { m.side = saved[i]; });
  out.facade = facade;
  out.mezz = mezz;

  /* ---------- 3. храм живой ---------- */
  d.ctx.systems.locations.setLocation('church');
  const ch = d.ctx.systems.locations.churchLoc;
  const lights = [];
  ch.scene.traverse((o) => { if (o.isLight) lights.push(o); });
  const before = lights.map((l) => l.intensity);
  ch.update(0.016, 1.0);
  const after = lights.map((l) => l.intensity);
  out.lightChanged = before.some((v, i) => Math.abs(v - after[i]) > 0.001);
  const pts = ch.scene.children.filter((o) => o.isPoints);
  out.motes = pts.length;
  const t0 = pts[0] ? pts[0].material.uniforms.uTime.value : 0;
  ch.update(0.5, 2.0);
  out.motesAlive = pts[0] ? pts[0].material.uniforms.uTime.value > t0 : false;
  out.churchLights = lights.length;
  return out;
});

const checks = [
  ['бармен ходит за стойкой днём', res.dayWalks && res.dayVisible && !res.dayAway],
  ['бармен уходит к задней двери ночью', res.nightAway && res.nightAtDoor],
  ['бармен пропадает у двери, а не в зале', res.nightHidden],
  ['бармен возвращается утром', res.backVisible && !res.backAway && res.backAtBar],
  ['в фасаде всех домов нет щели над дверью',
    res.facade.length === 12 && res.facade.every((f) => f.ok)],
  ['перекрытие двухэтажных домов сплошное в центре',
    res.mezz.length === 2 && res.mezz.every((m) => m.solid)],
  ['люк лестницы — в углу, а не посередине',
    res.mezz.every((m) => m.holeOpen)],
  ['в храме мерцает свет', res.lightChanged],
  ['в храме живут пылинки', res.motes > 0 && res.motesAlive],
];
let bad = 0;
for (const [name, ok] of checks) {
  if (!ok) bad++;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
if (res.facade.some((f) => !f.ok)) console.log('  щели в фасадах:', res.facade.filter((f) => !f.ok));
console.log('ошибки: ' + (bad + errs.length), errs.slice(0, 3));
await browser.close();
if (bad + errs.length) process.exit(1);
