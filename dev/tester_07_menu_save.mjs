/**
 * Тест 7: меню Esc, сохранение/загрузка, слоты.
 */

import { withGame, shotPage, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- меню Esc ---------- */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  report('меню по Esc', await page.evaluate(() => {
    const vis = (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { display: cs.display, on: el.classList.contains('on'), visible: cs.display !== 'none' && cs.opacity !== '0', text: el.textContent.trim().slice(0, 40) };
    };
    return {
      mode: window.__dbg.mode,
      menu: vis('menu'),
      saveBtn: vis('saveBtn'),
      loadInMenu: vis('loadInMenu'),
      slotsBtn: vis('slotsBtn'),
      resume: vis('resume'),
    };
  }));
  await shotPage(page, SHOTS + '/TEST_40_menu.jpg');

  /* ---------- «Загрузить игру…» открывает список сохранений ---------- */
  await page.evaluate(() => document.getElementById('loadInMenu').click());
  await page.waitForTimeout(600);
  report('окно сохранений из меню', await page.evaluate(() => {
    const el = document.getElementById('slots');
    return {
      visible: !!el && getComputedStyle(el).display !== 'none' && el.classList.contains('on'),
      text: el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null,
    };
  }));
  await shotPage(page, SHOTS + '/TEST_41_slots.jpg');
  await page.evaluate(() => { const b = document.getElementById('slotsClose'); if (b) b.click(); });
  await page.waitForTimeout(400);
  report('после закрытия окна сохранений', await page.evaluate(() => ({ mode: window.__dbg.mode, slotsOn: document.getElementById('slots').classList.contains('on') })));

  /* ---------- закрыть меню ---------- */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  report('Esc ещё раз (выход из меню)', await page.evaluate(() => ({ mode: window.__dbg.mode, menuOn: document.getElementById('menu').classList.contains('on') })));

  /* ---------- состояние до сохранения ---------- */
  const before = await page.evaluate(() => {
    const D = window.__dbg;
    D.stats.coins = 137;
    D.stats.mana = 61;
    D.calendar.restore(4, 'summer', 2);
    D.env.setTimeOfDay('dusk', true);
    D.player.teleport(12.5, -33.25, 1.2);
    // предметы на пояс
    D.inventory.slots[27] = { id: 'bow', spec: D.items.getItem('bow'), count: 1, best: null };
    D.inventory.slots[28] = { id: 'torch', spec: D.items.getItem('torch'), count: 1, best: null };
    D.inventory.slots[29] = { id: 'spell_heal', spec: D.items.getItem('spell_heal'), count: 1, best: null };
    D.inventory.slots[0] = { id: 'bread', spec: D.items.getItem('bread'), count: 3, best: null };
    D.inventory.touch();
    D.combat.state.fuel = 42.5;
    D.combat.state.lit = true;
    D.loadout.setTorchEquipped(true);
    D.loadout.select(0);
    return {
      coins: D.stats.coins, mana: D.stats.mana,
      day: D.calendar.day, season: D.calendar.season, year: D.calendar.year,
      tod: D.env.current,
      pos: { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), yaw: +D.player.yaw.toFixed(2) },
      belt: D.inventory.slots.slice(27).map((s) => s && s.id),
      fuel: D.combat.state.fuel, lit: D.combat.state.lit,
      torchEquipped: D.combat.state.torchEquipped,
      weaponId: D.loadout.weaponId,
    };
  });
  report('состояние ДО сохранения', before);

  const saved = await page.evaluate(() => window.__dbg.saveGame());
  report('saveGame()', saved);

  /* ---------- портим состояние ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.stats.coins = 3;
    D.stats.mana = 1;
    D.calendar.restore(9, 'winter', 3);
    D.env.setTimeOfDay('morning', true);
    D.player.teleport(-50, 50, 0);
    D.inventory.slots.fill(null);
    D.combat.state.fuel = 0;
    D.combat.state.lit = false;
    D.loadout.setTorchEquipped(false);
  });
  report('состояние ПОСЛЕ порчи', await page.evaluate(() => ({
    coins: window.__dbg.stats.coins, day: window.__dbg.calendar.day,
    belt: window.__dbg.inventory.slots.slice(27).map((s) => s && s.id), fuel: window.__dbg.combat.state.fuel,
  })));

  const loaded = await page.evaluate(() => window.__dbg.loadGame());
  report('loadGame()', loaded);
  const after = await page.evaluate(() => {
    const D = window.__dbg;
    return {
      coins: D.stats.coins, mana: D.stats.mana,
      day: D.calendar.day, season: D.calendar.season, year: D.calendar.year,
      tod: D.env.current,
      pos: { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), yaw: +D.player.yaw.toFixed(2) },
      belt: D.inventory.slots.slice(27).map((s) => s && s.id),
      bread: D.inventory.countOf('bread'),
      fuel: D.combat.state.fuel, lit: D.combat.state.lit,
      torchEquipped: D.combat.state.torchEquipped,
      weaponId: D.loadout.weaponId,
    };
  });
  report('состояние ПОСЛЕ загрузки', after);

  /* ---------- слоты ---------- */
  report('listSlots() до записи', await page.evaluate(() => window.__dbg.listSlots().map((s) => ({ key: s.key, exists: s.exists, day: s.day, coins: s.coins, season: s.season }))));
  report('saveToSlot(1)', await page.evaluate(() => window.__dbg.saveToSlot(1)));
  report('saveToSlot(2)', await page.evaluate(() => window.__dbg.saveToSlot(2)));
  report('saveToSlot(99) (неверный номер)', await page.evaluate(() => window.__dbg.saveToSlot(99)));
  report('listSlots() после записи', await page.evaluate(() => window.__dbg.listSlots().map((s) => ({ key: s.key, exists: s.exists, day: s.day, coins: s.coins, season: s.season }))));

  /* ---------- loadSlot ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.stats.coins = 1;
    D.calendar.restore(12, 'winter', 5);
    D.inventory.slots.fill(null);
  });
  report('loadSlot(slot1, 1)', await page.evaluate(() => window.__dbg.loadSlot('slot1', 1)));
  report('после loadSlot', await page.evaluate(() => ({
    coins: window.__dbg.stats.coins, day: window.__dbg.calendar.day, season: window.__dbg.calendar.season,
    belt: window.__dbg.inventory.slots.slice(27).map((s) => s && s.id),
  })));

  /* ---------- слот через UI ---------- */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('slotsBtn').click());
  await page.waitForTimeout(600);
  report('окно слотов (из меню)', await page.evaluate(() => {
    const el = document.getElementById('slots');
    return { visible: el.classList.contains('on'), text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 500) };
  }));
  await shotPage(page, SHOTS + '/TEST_42_slots_from_menu.jpg');

  report('итого ошибок', errs.slice());
});
