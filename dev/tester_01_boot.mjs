/**
 * Тест 1: титульный экран, запуск игры, ошибки в консоли, скорость кадров.
 */

import { withGame, shotPage, grabScene, waitFrames, brightness, report, SHOTS } from './tester_lib.mjs';
import fs from 'node:fs';

const errors = await withGame({ start: false }, async (page, errs) => {
  report('титульный экран', await page.evaluate(() => {
    const q = (id) => document.getElementById(id);
    const vis = (el) => !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
    return {
      begin: q('begin') ? { text: q('begin').textContent.trim(), disabled: q('begin').disabled, visible: vis(q('begin')) } : null,
      continueBtn: q('continue') ? { visible: vis(q('continue')), text: q('continue').textContent.trim() } : null,
      loadGame: q('loadGame') ? { visible: vis(q('loadGame')), text: q('loadGame').textContent.trim() } : null,
      loading: q('load') ? q('load').textContent.trim() : null,
      dbg: !!window.__dbg,
      frames: window.__frames || 0,
      hasSave: window.__dbg ? window.__dbg.hasSave() : null,
    };
  }));

  await shotPage(page, SHOTS + '/TEST_01_title.jpg');
  report('ошибки до старта', errs.slice());

  // замер скорости кадра
  const f1 = await page.evaluate(() => window.__frames || 0);
  const s1 = Date.now();
  await waitFrames(page, 2);
  report('кадр (мс)', { framesBefore: f1, perFrameMs: Math.round((Date.now() - s1) / 2) });

  // нажать «Начать игру»
  await page.evaluate(() => document.getElementById('begin').click());
  await page.waitForTimeout(1500);
  report('после старта', await page.evaluate(() => ({
    mode: window.__dbg.mode,
    loc: window.__dbg.loc,
    coins: window.__dbg.stats.coins,
    hp: window.__dbg.stats.hp,
    mana: window.__dbg.stats.mana,
    day: window.__dbg.calendar.day,
    season: window.__dbg.calendar.season,
    playerPos: window.__dbg.player.pos ? { x: +window.__dbg.player.pos.x.toFixed(2), y: +window.__dbg.player.pos.y.toFixed(2), z: +window.__dbg.player.pos.z.toFixed(2) } : null,
    invSlots: window.__dbg.inventory.slots.filter(Boolean).length,
    belt: window.__dbg.inventory.slots.slice(27).map((s, i) => s ? `${i + 1}:${s.id}x${s.count}` : null),
    pointerLock: !!document.pointerLockElement,
    camera: { x: +window.__dbg.camera.position.x.toFixed(2), y: +window.__dbg.camera.position.y.toFixed(2), z: +window.__dbg.camera.position.z.toFixed(2) },
  })));

  await shotPage(page, SHOTS + '/TEST_02_start.jpg');
  await grabScene(page, SHOTS + '/TEST_02b_start_scene.jpg');
  report('яркость 3D', await brightness(page));
});

report('все ошибки', errors);
fs.writeFileSync('/tmp/t01_errors.json', JSON.stringify(errors, null, 2));
console.log('\nOK. всего ошибок: ' + errors.length);
