/**
 * Тест 13: оставшиеся мелочи —
 *   • «Загрузить игру» на титульном экране;
 *   • Shift+ЛКМ (быстрое перемещение сумка → пояс);
 *   • «Огненная вспышка» в подземелье (визуальный эффект);
 *   • чистые кадры деревни (без лука) и костра с расстояния.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- «Загрузить игру» на титульном экране ---------- */
  await page.evaluate(() => {
    window.__dbg.ui.onDeathTitle ? null : null;
  });
  await page.evaluate(() => {
    // возвращаемся на титульный экран «через» смерть, чтобы проверить кнопку
    window.__dbg.ui.showStart();
    window.__dbg.ui.setContinue(window.__dbg.hasSave(), 1);
  });
  await page.waitForTimeout(700);
  await page.evaluate(() => document.getElementById('loadGame').click());
  await page.waitForTimeout(700);
  report('кнопка «Загрузить игру» на титуле', await page.evaluate(() => {
    const el = document.getElementById('slots');
    return { visible: el.classList.contains('on'), текст: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) };
  }));
  await page.evaluate(() => { const b = document.getElementById('slotsClose'); if (b) b.click(); });

  /* ---------- Shift+ЛКМ: сумка → пояс ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.ui.onStart();  // новая игра
  });
  await page.waitForTimeout(800);
  report('быстрое перемещение Shift+ЛКМ', await page.evaluate(() => {
    const D = window.__dbg;
    D.inventory.slots[0] = { id: 'torch', spec: D.items.getItem('torch'), count: 1, best: null };
    D.inventory.touch();
    const before = D.inventory.slots.slice(27).map((s) => s && s.id);
    // эмулируем Shift+ЛКМ по слоту 0 основного хранилища
    const ev = new MouseEvent('mousedown', { bubbles: true, shiftKey: true, button: 0, clientX: 10, clientY: 10 });
    const el = D.ui.el.invGrid.children[0];
    el.dispatchEvent(ev);
    const after = D.inventory.slots.slice(27).map((s) => s && s.id);
    return { до: before, после: after, основной: D.inventory.slots[0] ? D.inventory.slots[0].id : null };
  }));

  /* ---------- «Огненная вспышка» в подземелье ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    D.player.teleport(0, -8, 0);
    for (let i = 0; i < 20; i++) D.player.update(0.05);
  });
  await grabScene(page, SHOTS + '/TEST_81_dungeon_before_flash.jpg');
  const before = await imgStats(page, SHOTS + '/TEST_81_dungeon_before_flash.jpg');
  await page.evaluate(() => {
    const D = window.__dbg;
    const spec = D.items.getItem('spell_flash');
    D.spells.cast(spec);
  });
  await grabScene(page, SHOTS + '/TEST_82_dungeon_flash.jpg');
  const after = await imgStats(page, SHOTS + '/TEST_82_dungeon_flash.jpg');
  report('«Огненная вспышка»: яркость до/после', { до: before, после: after });

  /* ---------- чистые кадры деревни ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    D.inventory.slots.fill(null);
    D.inventory.touch();
    D.loadout.select(0);
    D.env.setTimeOfDay('golden', true);
  });
  const look = (x, z, yaw, pitch = -0.03) => page.evaluate(({ x, z, yaw, pitch }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.pitch = pitch;
    for (let i = 0; i < 20; i++) window.__dbg.player.update(0.05);
    return true;
  }, { x, z, yaw, pitch });

  await look(40, -28, 2.6, 0.02);         // костёр с расстояния
  await grabScene(page, SHOTS + '/TEST_83_campfire_far.jpg');
  report('костёр издалека', await imgStats(page, SHOTS + '/TEST_83_campfire_far.jpg'));

  await look(18, 6, 2.9, 0.0);            // улица к кузне
  await grabScene(page, SHOTS + '/TEST_84_street.jpg');
  report('улица', await imgStats(page, SHOTS + '/TEST_84_street.jpg'));

  report('итого ошибок', errs.slice());
});
