/**
 * ============================================================================
 *  Раунд 61 — тест-агент: эффекты четырёх атак босса (детально)
 * ============================================================================
 *
 *  Отдельно проверяю, что каждая из четырёх атак босса не только называется,
 *  но и делает то, что обещает:
 *   swing  — рубящий удар: снимает здоровье игрока;
 *   slam   — удар оземь: появляется ударная волна (кольцо на полу);
 *   roar   — рёв: призывает гоблинов и отталкивает игрока;
 *   charge — наскок: босс набирает разбег и бьёт.
 *
 *  Запуск: cd /workspace/village && node dev/tester_r61_bossfx.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

await page.evaluate(() => {
  const d = window.__dbg;
  d.player.enabled = true;
  d.player.pos.set(-9, 0, -17);
  d.player.groundY = 0;
  d.player.y = 0;
  d.setLocation('dungeon');
});
await page.waitForTimeout(1500);

const out = await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const res = {};

  /**
   * Прогнать одну атаку босса и собрать подробности.
   *
   * @param {string} label название атаки
   * @param {number} roll значение Math.random
   * @param {number} dist дистанция до игрока
   * @returns {object} подробности
   */
  const force = (label, roll, dist) => {
    // свежий босс
    m.respawn();
    const b = m.list.find((o) => o.spec.id === 'orc_boss');
    if (!b) return { label, err: 'нет босса' };
    // изоляция: в пещере только босс
    const saved = m.list.slice();
    m.list.length = 0;
    m.list.push(b);
    b.x = 0; b.z = 28; b.y = -4.6;
    b.group.position.set(b.x, b.y, b.z);
    b.hp = b.maxHp; b.dying = 0; b.veil = 6; b.stun = 0; b.cd = 0;
    b.state = 'stalk';
    const root = b.group.parent;
    const kidsBefore = root ? root.children.length : -1;
    const listBefore = m.list.length;
    d.player.pos.set(b.x + dist, b.y, b.z);
    d.player.groundY = b.y; d.player.y = 0;
    d.stats.hp = 100;
    const toastEl = document.getElementById('toast');
    const toastBefore = toastEl.textContent;
    const realRandom = Math.random;
    const names = new Set();
    const trace = [];
    let hpDrop = 0, minD = Infinity, shocks = 0, listAfter = 0, kidsAfter = 0;
    let playerPush = 0;
    for (let i = 0; i < 150; i++) {
      Math.random = () => roll;
      d.player.pos.set(b.x + dist, b.y, b.z);
      d.player.groundY = b.y;
      d.stats.hp = 100;
      b.hp = b.maxHp; b.stun = 0; b.cd = 0; b.dying = 0;
      if (b.state === 'recoil' || b.state === 'sleep') b.state = 'stalk';
      m.update(1 / 30, 3000 + i / 30);
      if (b.attackName) names.add(b.attackName);
      if (b.shocks) shocks = Math.max(shocks, b.shocks.length);
      minD = Math.min(minD, Math.hypot(b.x - d.player.pos.x, b.z - d.player.pos.z));
      hpDrop = Math.max(hpDrop, 100 - d.stats.hp);
      playerPush = Math.max(playerPush, Math.abs(d.player.pos.x - (b.x + dist)));
      if (i % 10 === 0) trace.push(`${i}: ${b.state}/${b.attackName} d=${Math.hypot(b.x - d.player.pos.x, b.z - d.player.pos.z).toFixed(2)} hp=${d.stats.hp}`);
    }
    Math.random = realRandom;
    listAfter = m.list.length;
    kidsAfter = root ? root.children.length : -1;
    const toastAfter = toastEl.textContent;
    const spawned = m.list.filter((o) => o !== b).map((o) => o.spec.id);
    m.list.length = 0;
    for (const o of saved) m.list.push(o);
    return {
      label, specAttack: b.spec.attack, names: [...names],
      listBefore, listAfter, spawned: spawned.length, spawnedIds: [...new Set(spawned)],
      kidsBefore, kidsAfter, shocks, hpDrop,
      minD: +minD.toFixed(2), dist, playerPush: +playerPush.toFixed(2),
      toastBefore, toastAfter, toastChanged: toastAfter !== toastBefore,
      trace: trace.join(' | '),
    };
  };

  res.swing = force('swing', 0.9, 2.0);
  res.slam = force('slam', 0.4, 2.0);
  res.roar = force('roar', 0.1, 2.0);
  res.charge = force('charge', 0.4, 8.5);
  return res;
});

for (const [k, v] of Object.entries(out)) {
  console.log(`--- ${k} ---`);
  console.log(JSON.stringify(v, null, 1));
}
console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
await browser.close();
