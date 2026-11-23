/**
 * Тест 11: проверка двух подозрений на баги
 *   A) загрузка сохранения, сделанного внутри интерьера, ломает позицию;
 *   B) после «Погиб → В начало → Продолжить» игра остаётся в режиме паузы.
 */

import { withGame, shotPage, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- A. сохранение внутри таверны ---------- */
  const A = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('tavern');
    const inTavern = { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.saveGame();                       // сохраняем, стоя внутри таверны
    D.setLocation('village');
    const inVillage = { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.loadGame();                       // грузим то же сохранение
    const after = {
      loc: D.loc,
      x: +D.player.pos.x.toFixed(2),
      z: +D.player.pos.z.toFixed(2),
      scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior',
      groundY: +D.player.groundY.toFixed(2),
    };
    return { inTavern, inVillage, after };
  });
  report('A) сохранение в интерьере → загрузка в деревне', A);
  report('A) совпало ли с сохранённой позицией', {
    совпадает: Math.abs(A.after.x - A.inTavern.x) < 0.5 && Math.abs(A.after.z - A.inTavern.z) < 0.5,
    должн_быть_в_деревне: A.after.loc === 'village',
    ФАКТ_ИГРОК_В: A.after,
  });

  /* ---------- A2. то же через подземелье ---------- */
  const A2 = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    const inDungeon = { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.saveGame();
    D.setLocation('village');
    D.loadGame();
    return { inDungeon, after: { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior', groundY: +D.player.groundY.toFixed(2), y: +D.player.y.toFixed(2) } };
  });
  report('A2) сохранение в подземелье → загрузка', A2);

  /* ---------- B. «Погиб → В начало → Продолжить» ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    D.stats.hp = 3;
    D.death.kill('Проверка режима паузы.');
    for (let i = 0; i < 25; i++) D.death.update(0.09);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__dbg.ui.onDeathTitle());
  await page.waitForTimeout(900);
  const b0 = await page.evaluate(() => ({ mode: window.__dbg.mode, started: !document.getElementById('start').classList.contains('gone') }));
  await page.evaluate(() => document.getElementById('continue').click());
  await page.waitForTimeout(700);
  const b1 = await page.evaluate(() => ({
    mode: window.__dbg.mode,
    playerEnabled: window.__dbg.player.enabled,
    acceptInput: window.__dbg.player.acceptInput,
    pauseMenuVisible: document.getElementById('menu').classList.contains('on'),
    startHidden: document.getElementById('start').classList.contains('gone'),
    hudPrompt: document.getElementById('prompt') ? document.getElementById('prompt').textContent : null,
  }));
  report('B) режим после «Продолжить»', { перед_кликом: b0, после_клика: b1 });

  // проверяем, что HUD-подсказки не обновляются
  const b2 = await page.evaluate(() => {
    const D = window.__dbg;
    // ставим игрока рядом с интерактом, чтобы подсказка должна была смениться
    const it = D.interactables.find((i) => (i.label || '').includes('колодец')) || D.interactables[0];
    if (it) { D.player.pos.set(it.pos.x, 0, it.pos.z + 1.0); D.player.update(0.05); }
    D.ui.setPrompt('ТЕСТ-ПОДСКАЗКА');
    return { label: it ? it.label : null };
  });
  await page.waitForTimeout(2500);
  const b3 = await page.evaluate(() => ({
    prompt: document.getElementById('prompt') ? document.getElementById('prompt').textContent : null,
    mode: window.__dbg.mode,
  }));
  report('B) обновляются ли подсказки HUD', { около: b2, подсказка: b3 });

  // а теперь — после Esc
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  report('B) после Esc', await page.evaluate(() => ({
    mode: window.__dbg.mode,
    pauseMenuVisible: document.getElementById('menu').classList.contains('on'),
  })));

  report('итого ошибок', errs.slice());
});
