/**
 * Тест 10: экран смерти, титульный экран с кнопкой «Продолжить»,
 *          чистая проверка коллайдеров (снаружи → в стену),
 *          «Живой огонь», покупка при полной сумке.
 */

import { withGame, shotPage, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- 1. экран смерти ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.saveGame();
    D.setLocation('dungeon');
    D.death.kill('Тень забрала вас в пещере. Тьма сомкнулась.');
    // домотать падение (1.5 с игрового времени)
    for (let i = 0; i < 25; i++) D.death.update(0.09);
  });
  await page.waitForTimeout(800);
  report('экран смерти', await page.evaluate(() => {
    const el = document.getElementById('death');
    return {
      visible: el.classList.contains('on'),
      причина: document.getElementById('deathReason') ? document.getElementById('deathReason').textContent : null,
      мета: document.getElementById('deathLastMeta') ? document.getElementById('deathLastMeta').textContent : null,
      isDead: window.__dbg.death.isDead,
    };
  }));
  await shotPage(page, SHOTS + '/TEST_71_death.jpg');

  /* ---------- 2. «В начало» → титульный экран ---------- */
  report('кнопка «В начало»', await page.evaluate(() => {
    window.__dbg.ui.onDeathTitle();
    return { mode: window.__dbg.mode, isDead: window.__dbg.death.isDead };
  }));
  await page.waitForTimeout(1200);
  report('титульный экран с сохранением', await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return el ? !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' : null; };
    return {
      startVisible: vis('start'),
      continueVisible: vis('continue'),
      continueText: document.getElementById('continue') ? document.getElementById('continue').textContent.trim() : null,
      loadVisible: vis('loadGame'),
    };
  }));
  await shotPage(page, SHOTS + '/TEST_72_title_continue.jpg');

  report('клик «Продолжить»', await page.evaluate(() => {
    document.getElementById('continue').click();
    return { mode: window.__dbg.mode, day: window.__dbg.calendar.day, coins: window.__dbg.stats.coins, hp: window.__dbg.stats.hp };
  }));

  /* ---------- 3. коллайдеры: снаружи → в стену ---------- */
  const walls = await page.evaluate(() => {
    const D = window.__dbg;
    const out = [];
    const list = D.colliders.boxes.filter((b) => b.hx > 0.4 && b.hz > 0.25 && b.hx < 12 && b.hz < 12).slice(0, 60);
    for (const b of list) {
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      // нормаль локальной оси X в мире
      const nx = c, nz = -s;
      const stand = b.hx + 1.6;
      const sx = b.cx + nx * stand, sz = b.cz + nz * stand;
      D.teleport(sx, sz, 0);
      for (let i = 0; i < 5; i++) D.player.update(0.05);
      // смотрим в стену: вперёд = (-sin(yaw), -cos(yaw)) = (-nx, -nz)
      D.player.yaw = Math.atan2(nx, nz);
      D.player.keys.clear(); D.player.keys.add('KeyW');
      for (let i = 0; i < 90; i++) D.player.update(0.05);
      D.player.keys.clear();
      // локальные координаты финальной позиции
      const dx = D.player.pos.x - b.cx, dz = D.player.pos.z - b.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      const passed = lx < -b.hx - 0.34;     // игрок оказался ЗА стеной
      out.push({ wall: { cx: +b.cx.toFixed(1), cz: +b.cz.toFixed(1), hx: b.hx, hz: b.hz, ang: +(b.ang || 0).toFixed(2) }, lx: +lx.toFixed(2), прошёл_насквозь: passed });
    }
    return out;
  });
  const passed = walls.filter((w) => w.прошёл_насквозь);
  report('стены держат? (' + walls.length + ' шт.)', { прошёл_насквозь: passed.length, примеры: passed.slice(0, 8) });

  /* ---------- 4. «Живой огонь» ---------- */
  report('заклинание «Живой огонь»', await page.evaluate(() => {
    const D = window.__dbg;
    const spec = D.items.getItem('spell_light');
    D.inventory.slots[27] = { id: 'spell_light', spec, count: 1, best: null };
    D.inventory.touch();
    const manaBefore = D.stats.mana;
    const fuelBefore = D.combat.state.fuel;
    const ok = D.spells.cast(spec);
    const out1 = { ok, manaBefore, manaAfter: D.stats.mana, fuelBefore, fuelAfter: D.combat.state.fuel, lit: D.combat.state.lit, torchEquipped: D.combat.state.torchEquipped };
    // теперь с факелом в руке
    D.combat.state.fuel = 10;
    D.loadout.setTorchEquipped(true);
    const ok2 = D.spells.cast(spec);
    return { без_факела: out1, с_факелом: { ok: ok2, fuel: D.combat.state.fuel, lit: D.combat.state.lit } };
  }));

  /* ---------- 5. покупка при полной сумке ---------- */
  report('покупка при полной сумке', await page.evaluate(() => {
    const D = window.__dbg;
    D.stats.coins = 1000;
    for (let i = 0; i < 36; i++) D.inventory.slots[i] = { id: 'bread', spec: D.items.getItem('bread'), count: 64, best: null };
    for (let i = 27; i < 36; i++) D.inventory.slots[i] = { id: 'bread', spec: D.items.getItem('bread'), count: 64, best: null };
    D.trade.open('barkeep');
    const before = D.stats.coins;
    const ok = D.trade.buy('bread');
    const after = D.stats.coins;
    D.trade.close();
    return { куплено: ok, coinsBefore: before, coinsAfter: after, toast: 'см. скрин' };
  }));

  report('итого ошибок', errs.slice());
});
