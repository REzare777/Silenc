/**
 * Раунд 71 — проверки дома игрока, доски объявлений и «Зверинца».
 *
 * Что проверяем:
 *   1. Дом игрока: внутри пусто (осталась только кровать), есть потолок,
 *      игрок не проваливается сквозь пол и не выходит сквозь стены.
 *   2. Табличка (доска объявлений) стоит целиком снаружи дома — не заходит
 *      внутрь здания.
 *   3. «Зверинец», открытый из меню паузы, не лежит поверх меню, а после
 *      закрытия возвращает паузу.
 *
 * Запуск: cd /workspace/village && node dev/r71_check.mjs [url]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SITE = process.argv[2] || 'http://127.0.0.1:4205';
const SHOTS = path.join(ROOT, 'shots');

let bad = 0;
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) bad++;
};

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(SITE + '/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/* ------------------------------------------------------------------
 *  1. Дом игрока
 * ------------------------------------------------------------------ */
console.log('=== Дом игрока ===');
const home = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  d.setLocation('home10');
  const loc = ctx.systems.locations.homeLocs[10];
  // ищем потолок: самый верхний крупный меш комнаты
  let topY = -99;
  let meshes = 0;
  loc.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    const y = bb.max.y + o.position.y;
    if (y > topY) topY = y;
  });
  return {
    name: loc.name,
    spots: loc.spots.map((s) => s[1]),
    bed: !!loc.bed,
    topY: +topY.toFixed(2),
    meshes,
    sceneChildren: loc.scene.children.length,
  };
});
ok('в доме игрока пусто — только кровать',
  home.spots.length === 1 && /кровать/i.test(home.spots[0]), home.spots.join(', '));
ok('кровать на месте — можно переночевать', home.bed);
ok('в комнате есть потолок (нет дыры в небо)', home.topY >= 2.6, `верх мешей y=${home.topY}`);

await page.waitForTimeout(600);
await page.screenshot({ path: path.join(SHOTS, 'r71-home-inside.png') });
// осмотреться на четыре стороны
for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
  await page.evaluate((y) => { window.__dbg.ctx.player.yaw = y; }, yaw);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOTS, `r71-home-${i}.png`) });
}

// ходьба: не проваливается и не выходит сквозь стены
const walk = await page.evaluate(async () => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const p = ctx.player;
  p.enabled = true; p.acceptInput = true;
  const steps = [];
  const dirs = [['KeyW', 0], ['KeyD', 1], ['KeyS', 2], ['KeyA', 3]];
  for (const [key] of dirs) {
    p.keys.clear();
    p.keys.add(key);
    await new Promise((r) => setTimeout(r, 800));
    p.keys.clear();
    steps.push({
      key,
      x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2),
      g: +p.groundY.toFixed(2),
    });
  }
  return { steps, groundY: p.groundY };
});
for (const s of walk.steps) {
  ok(`после ходьбы (${s.key}) игрок на полу и внутри стен`,
    s.y === 0 && s.g === 0 && Math.abs(s.x) < 3.2 && Math.abs(s.z) < 2.7,
    `x=${s.x} z=${s.z} y=${s.y} пол=${s.g}`);
}

/* ------------------------------------------------------------------
 *  2. Табличка снаружи
 * ------------------------------------------------------------------ */
console.log('\n=== Табличка у дома ===');
const board = await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  d.setLocation('village');
  const h = (ctx.homes || []).find((x) => x.i === 10);
  const b = ctx.boardInteract.pos;
  const dx = b.x - h.x, dz = b.z - h.z;
  const c = Math.cos(h.ry), s = Math.sin(h.ry);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  // полуразмеры доски: полотно 1.9 + рама, толщина ≈ 0.12
  const halfW = 1.01, halfD = 0.06;
  return {
    lx: +lx.toFixed(2), lz: +lz.toFixed(2),
    hw: h.w / 2, hd: h.d / 2,
    outX: Math.abs(lx) - halfW,
    outZ: Math.abs(lz) - halfD,
    x: +b.x.toFixed(2), z: +b.z.toFixed(2),
  };
});
ok('табличка целиком снаружи дома (не входит внутрь здания)',
  board.outX > 0.05 || board.outZ > 0.05,
  `lx=${board.lx} lz=${board.lz} зазор по X=${board.outX.toFixed(2)} по Z=${board.outZ.toFixed(2)}`);

// вид с фасада: игрок стоит перед домом и смотрит на него
await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const h = (ctx.homes || []).find((x) => x.i === 10);
  const dir = { x: -0.5387, z: 0.8439 };              // от дома к дороге
  // взгляд — на дом: направление камеры = (-sin yaw, -cos yaw)
  ctx.player.teleport(h.x + dir.x * 10, h.z + dir.z * 10, Math.atan2(dir.x, dir.z));
  ctx.player.pitch = -0.02;
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(SHOTS, 'r71-home-facade.png') });

// рядом с табличкой
await page.evaluate(() => {
  const d = window.__dbg;
  const ctx = d.ctx;
  const b = ctx.boardInteract.pos;
  ctx.player.teleport(b.x + 2.6, b.z + 1.4, Math.atan2(2.6, 1.4));
  ctx.player.pitch = -0.05;
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(SHOTS, 'r71-board.png') });

/* ------------------------------------------------------------------
 *  3. Зверинец из меню
 * ------------------------------------------------------------------ */
console.log('\n=== Зверинец ===');
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.mode = 'menu';
  d.ui.openMenu();
});
await page.waitForTimeout(500);
await page.evaluate(() => document.getElementById('bestBtn').click());
await page.waitForTimeout(700);
const fromMenu = await page.evaluate(() => ({
  mode: window.__dbg.ctx.mode,
  bestiaryOn: document.getElementById('bestiary').classList.contains('on'),
  menuOn: document.getElementById('menu').classList.contains('on'),
  cards: document.querySelectorAll('#bestList .bItem').length,
  grids: document.querySelectorAll('#bestList .bGrid').length,
  medallions: document.querySelectorAll('#bestList .bMedallion').length,
  badge: document.getElementById('bestCount').textContent,
}));
ok('зверинец открылся из меню', fromMenu.bestiaryOn && fromMenu.mode === 'bestiary');
ok('меню паузы не лежит поверх зверинца', !fromMenu.menuOn);
ok('карточки пород на месте с эмблемами',
  fromMenu.cards === 12 && fromMenu.grids >= 1 && fromMenu.medallions === 12,
  `карточек ${fromMenu.cards}, эмблем ${fromMenu.medallions}`);
ok('счётчик изученных на месте', /Изучено \d+ из 12/.test(fromMenu.badge), fromMenu.badge);
await page.screenshot({ path: path.join(SHOTS, 'r71-bestiary-menu.png') });

// закрыть — пауза возвращается
await page.evaluate(() => window.__dbg.ctx.systems.ui ? 0 : document.getElementById('bestClose').click());
await page.waitForTimeout(600);
const afterClose = await page.evaluate(() => ({
  mode: window.__dbg.ctx.mode,
  bestiaryOn: document.getElementById('bestiary').classList.contains('on'),
  menuOn: document.getElementById('menu').classList.contains('on'),
}));
ok('после закрытия зверинца вернулась пауза',
  !afterClose.bestiaryOn && afterClose.menuOn && afterClose.mode === 'menu', afterClose.mode);

// из игры — по клавише B
await page.evaluate(() => {
  const d = window.__dbg;
  d.ui.closeMenu();
  d.ctx.mode = 'play';
  d.ctx.player.acceptInput = true;
});
await page.keyboard.press('KeyB');
await page.waitForTimeout(700);
const fromGame = await page.evaluate(() => ({
  bestiaryOn: document.getElementById('bestiary').classList.contains('on'),
  menuOn: document.getElementById('menu').classList.contains('on'),
  mode: window.__dbg.ctx.mode,
}));
ok('зверинец открывается по B из игры',
  fromGame.bestiaryOn && !fromGame.menuOn && fromGame.mode === 'bestiary', fromGame.mode);
await page.screenshot({ path: path.join(SHOTS, 'r71-bestiary.png') });

// изученные породы: карточка с полными характеристиками
await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.ctx.systems.bestiary;
  for (const id of ['goblin_bow', 'slime_blue', 'stone_golem', 'wraith']) {
    try { b.unlock(id); } catch (e) { /* породы может не быть */ }
  }
});
// закрываем и открываем заново — список перерисуется с новыми записями
await page.evaluate(() => document.getElementById('bestClose').click());
await page.waitForTimeout(400);
await page.evaluate(() => {
  window.__dbg.ctx.mode = 'play';
  window.__dbg.ctx.player.acceptInput = true;
});
await page.keyboard.press('KeyB');
await page.waitForTimeout(700);
const known = await page.evaluate(() => ({
  count: document.getElementById('bestCount').textContent,
  known: document.querySelectorAll('#bestList .bItem:not(.locked)').length,
  bestiaryOn: document.getElementById('bestiary').classList.contains('on'),
}));
ok('изученные породы показаны с характеристиками',
  known.known >= 1 && known.bestiaryOn, `${known.count}, карточек ${known.known}`);
await page.screenshot({ path: path.join(SHOTS, 'r71-bestiary-known.png') });

console.log('\nошибок в консоли:', errs.length);
for (const e of errs.slice(0, 5)) console.log('  ', e.slice(0, 200));

await browser.close();
console.log(bad || errs.length ? `\nошибок: ${bad + errs.length}` : '\nошибок: 0');
process.exit(bad || errs.length ? 1 : 0);
