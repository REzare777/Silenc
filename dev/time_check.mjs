/**
 * ============================================================================
 *  Проверка времени суток и доступа: трактир всегда, трактирщик только днём
 * ============================================================================
 *
 *  1) время идёт само, пока игрок стоит (period = 10 минут);
 *  2) смена периода плавная (переход, а не скачок);
 *  3) в таверну можно войти в любую погоду, а трактирщика ночью нет.
 *
 *  Запуск: cd dev && node time_check.mjs
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

const res = await page.evaluate(async () => {
  const d = window.__dbg, env = d.env, p = d.player;
  const out = {};

  // 1. время идёт, пока игрок стоит
  env.setTimeOfDay('day', true);
  env.phaseTime = 0;
  const t0 = env.phaseTime;
  const before = p.pos.x;
  for (let i = 0; i < 180; i++) { p.update(1 / 60); env.update(1 / 60, p.pos); }   // 3 секунды стоя
  out.timeRuns = env.phaseTime > t0 + 2;
  out.period = env.periodSeconds;
  out.playerStayed = Math.abs(p.pos.x - before) < 0.01;

  // 2. смена периода плавная: t растёт от 0, а не скачок
  env.phaseTime = env.periodSeconds - 0.05;
  env.cycle();
  out.transitionStarted = env.t < 0.2 && env.target !== env.current;

  // 3. таверна: вход доступен всегда, трактирщик есть днём и отсутствует ночью
  const enterTavern = d.ctx.interactables.find((x) => x.label && x.label.includes('Войти в таверну'));
  out.tavernDoorExists = !!enterTavern;
  const phases = ['morning', 'day', 'golden', 'dusk', 'night'];
  out.tavernAlways = [];
  out.barkeep = [];
  for (const ph of phases) {
    env.setTimeOfDay(ph, true);
    const it = d.ctx.interactables.find((x) => x.label && x.label.includes('Войти в таверну'));
    out.tavernAlways.push(!!it);
  }
  // трактирщик: днём на месте, ночью ушёл
  const bark = d.ctx.systems.locations.npcs.barkeep;
  env.setTimeOfDay('day', true);
  d.ctx.systems.locations.updateNpc(0.016, 1);
  out.barkeepDay = !bark.away;
  env.setTimeOfDay('night', true);
  d.ctx.systems.locations.updateNpc(0.016, 2);
  out.barkeepNight = bark.away;

  env.setTimeOfDay('day', true);
  return out;
});

console.log('время идёт, пока стоишь:', res.timeRuns ? '✓' : '✗', `| период ${res.period} с (${res.period / 60} мин)`);
console.log('игрок стоял на месте:', res.playerStayed ? '✓' : '✗');
console.log('смена периода плавная:', res.transitionStarted ? '✓' : '✗');
console.log('дверь таверны есть:', res.tavernDoorExists ? '✓' : '✗');
console.log('вход в таверну во всех фазах:', res.tavernAlways.every(Boolean) ? '✓' : '✗', JSON.stringify(res.tavernAlways));
console.log('трактирщик днём на месте:', res.barkeepDay ? '✓' : '✗');
console.log('трактирщик ночью ушёл:', res.barkeepNight ? '✓' : '✗');
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
