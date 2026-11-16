/**
 * ============================================================================
 *  Тест NPC: бармен трактира
 * ============================================================================
 *
 *  Проверяем:
 *   1) бармен есть в таверне и виден;
 *   2) ходит за стойкой (позиция меняется, состояние «walk»);
 *   3) рядом с ним есть интеракт «Поговорить с барменом»;
 *   4) E открывает диалоговое окно с репликами и темами;
 *   5) ночью бармена в таверне нет (интеракт отвечает «трактир закрыт»);
 *   6) утром он возвращается.
 *
 *  Запуск: cd dev && node npc_test.mjs
 */
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
await page.click('#begin');
await page.waitForTimeout(1500);

const ok = (n, c) => console.log(`${c ? '✓' : '✗'} ${n}`);

/* ---- вход в таверну ---- */
await page.evaluate(() => window.__dbg.setLocation('tavern'));
await page.waitForTimeout(800);

/* ---- 1. бармен есть и виден ---- */
const npc = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.npcs.barkeep;
  return {
    exists: !!b,
    visible: b ? b.group.visible : false,
    x: b ? +b.x.toFixed(2) : 0,
    z: b ? +b.z.toFixed(2) : 0,
    inScene: !!(d.sceneTavern && d.sceneTavern.getObjectByName('barkeep')),
  };
});
ok(`бармен создан и находится в сцене таверны (${npc.x}, ${npc.z})`, npc.exists && npc.inScene);
ok('бармен виден', npc.visible);

/* ---- 2. ходит за стойкой ---- */
const walk = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.npcs.barkeep;
  const start = { x: b.x, z: b.z };
  const seen = new Set();
  let moved = 0;
  for (let i = 0; i < 600; i++) {
    d.updateNpc(1 / 30, i / 30);
    moved = Math.max(moved, Math.hypot(b.x - start.x, b.z - start.z));
    seen.add(b.state);
  }
  return { start, end: { x: +b.x.toFixed(2), z: +b.z.toFixed(2) }, moved: +moved.toFixed(2), states: [...seen] };
});
ok(`бармен ходит за стойкой (сдвинулся на ${walk.moved} м, состояния: ${walk.states.join(',')})`,
  walk.moved > 0.3 && walk.states.includes('walk'));

/* ---- бармен остаётся в закутке за стойкой ---- */
ok(`бармен не выходит из-под стойки (x=${walk.end.x})`, walk.end.x > 5.9 && walk.end.x < 7.1);

/* ---- 3. интеракт «Поговорить с барменом» ---- */
const inter = await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.npcs.barkeep;
  const p = d.player;
  p.teleport(b.x, b.z + 1.4, 0);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  const near = d.nearestInteractable();
  return { label: near ? near.label : '', dist: near ? Math.hypot(p.pos.x - near.pos.x, p.pos.z - near.pos.z) : 99 };
});
ok(`рядом с барменом есть интеракт «${inter.label}»`, /бармен/i.test(inter.label));

/* ---- 4. E открывает диалог ---- */
await page.evaluate(() => window.__dbg.doInteract());
await page.waitForTimeout(600);
const dlg = await page.evaluate(() => {
  const d = window.__dbg;
  const el = document.getElementById('dialog');
  const topics = [...document.querySelectorAll('#dlgTopics button')].map((b) => b.textContent);
  return {
    open: el.classList.contains('on'),
    mode: d.mode,
    name: document.getElementById('dlgName').textContent,
    text: document.getElementById('dlgText').textContent,
    topics,
    portrait: !!document.querySelector('#dlgPic canvas'),
  };
});
ok(`диалог открылся (режим «${dlg.mode}», собеседник ${dlg.name})`, dlg.open && dlg.mode === 'dialog');
ok(`в диалоге есть реплика (${dlg.text.slice(0, 40)}…)`, dlg.text.length > 20);
ok(`в диалоге ${dlg.topics.length} тем для разговора`, dlg.topics.length >= 4);
ok('в диалоге есть портрет', dlg.portrait);

/* ---- тема меняет реплику ---- */
await page.evaluate(() => document.querySelector('#dlgTopics button').click());
await page.waitForTimeout(300);
const reply = await page.evaluate(() => document.getElementById('dlgText').textContent);
ok('выбор темы меняет реплику', reply.length > 20 && reply !== dlg.text);

/* ---- Esc закрывает диалог ---- */
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const closed = await page.evaluate(() => ({
  open: document.getElementById('dialog').classList.contains('on'),
  mode: window.__dbg.mode,
}));
ok('Esc закрывает диалог и возвращает управление', !closed.open && closed.mode === 'play');

/* ---- 5. ночью бармена нет ---- */
const night = await page.evaluate(() => {
  const d = window.__dbg;
  d.env.setTimeOfDay('night', true);
  for (let i = 0; i < 10; i++) d.updateNpc(1 / 30, i / 30);
  const b = d.npcs.barkeep;
  const p = d.player;
  p.teleport(b.x, b.z + 1.2, 0);
  p.y = 0; p.groundY = 0; p.vy = 0; p.grounded = true;
  d.doInteract();
  return {
    away: b.away,
    visible: b.group.visible,
    toast: document.getElementById('toast').textContent,
    dialogOpen: document.getElementById('dialog').classList.contains('on'),
  };
});
ok('ночью бармен ушёл (его нет в таверне)', night.away && !night.visible);
ok(`ночью трактир закрыт: «${night.toast}»`, /закрыт|уш/i.test(night.toast) && !night.dialogOpen);

/* ---- 6. утром бармен вернулся ---- */
const morning = await page.evaluate(() => {
  const d = window.__dbg;
  d.env.setTimeOfDay('morning', true);
  for (let i = 0; i < 10; i++) d.updateNpc(1 / 30, i / 30);
  const b = d.npcs.barkeep;
  return { away: b.away, visible: b.group.visible };
});
ok('утром бармен снова на месте', !morning.away && morning.visible);

console.log('\nошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
process.exit(errs.length ? 1 : 0);
