/**
 * Тест 9: разное —
 *   · продажа рыбы Хорту;
 *   · вход в подземелье через дверь в деревне (интеракт, а не setLocation);
 *   · экран смерти и загрузка последнего сохранения;
 *   · кнопка «Продолжить» на титульном экране;
 *   · проверка «застревания» в стенах (коллайдеры).
 */

import { withGame, shotPage, grabScene, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- 1. продажа рыбы Хорту ---------- */
  report('продажа рыбы Хорту', await page.evaluate(() => {
    const D = window.__dbg;
    D.trade.open('barkeep');
    const fish = D.items.getItem(D.FISH[0].id);
    D.inventory.add({ id: fish.id, spec: fish, count: 3, best: { weight: fish.weightMin, length: fish.lengthMin } });
    D.trade.refresh();
    const before = D.stats.coins;
    const ok = D.trade.sell(fish.id);
    const mid = D.stats.coins;
    // продать факел Хорту — он «покупает» только рыбу/товары/заклинания
    D.inventory.add({ id: 'torch', spec: D.items.getItem('torch'), count: 1, best: null });
    const ok2 = D.trade.sell('torch');
    const after = D.stats.coins;
    D.trade.close();
    return {
      рыба: { продана: ok, цена: D.items.sellPrice(fish), coinsBefore: before, coinsAfter: mid, осталось: D.inventory.countOf(fish.id) },
      факел_у_Хорта: { продана: ok2, coinsAfter: after },
    };
  }));

  /* ---------- 2. вход в подземелье через дверь ---------- */
  const gate = await page.evaluate(() => {
    const D = window.__dbg;
    const gate = D.ctx.doors.dungeon;
    D.teleport(gate.x, gate.z, gate.ry);
    for (let i = 0; i < 10; i++) D.player.update(0.05);
    const near = D.nearestInteractable ? D.nearestInteractable() : null;
    const all = D.interactables.filter((it) => (it.label || '').includes('подземель')).map((it) => ({
      label: it.label, pos: { x: +it.pos.x.toFixed(1), z: +it.pos.z.toFixed(1) }, radius: it.radius,
    }));
    return { player: { x: +D.player.pos.x.toFixed(1), z: +D.player.pos.z.toFixed(1) }, near: near ? near.label : null, all };
  });
  report('подземельная дверь (интеракт)', gate);
  report('вход в подземелье по интеракту', await page.evaluate(() => {
    const D = window.__dbg;
    D.doInteract();
    return { loc: D.loc, mode: D.mode };
  }));
  await grabScene(page, SHOTS + '/TEST_70_dungeon_entry.jpg');
  report('обратно в деревню', await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    return { loc: D.loc, pos: { x: +D.player.pos.x.toFixed(1), z: +D.player.pos.z.toFixed(1) } };
  }));

  /* ---------- 3. экран смерти ---------- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    D.saveGame();
  });
  const death = await page.evaluate(() => {
    const D = window.__dbg;
    D.stats.hp = 5;
    D.death.kill('Проверка экрана смерти.');
    return { isDead: D.death.isDead, mode: D.mode };
  });
  report('смерть', death);
  await page.waitForTimeout(1500);
  report('экран смерти (DOM)', await page.evaluate(() => {
    const el = document.getElementById('death');
    return {
      visible: !!el && el.classList.contains('on'),
      причина: document.getElementById('deathReason') ? document.getElementById('deathReason').textContent : null,
      текст: el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null,
    };
  }));
  await shotPage(page, SHOTS + '/TEST_71_death.jpg');

  /* ---------- 4. загрузка последнего сохранения со экрана смерти ---------- */
  report('«Загрузить последнее сохранение»', await page.evaluate(() => {
    const D = window.__dbg;
    document.getElementById('deathLast').click();
    return { isDead: D.death.isDead, hp: D.stats.hp, loc: D.loc, mode: D.mode, day: D.calendar.day };
  }));

  /* ---------- 5. «Продолжить» на титульном экране ---------- */
  await page.evaluate(() => { window.__dbg.ctx.onDeathTitle ? window.__dbg.ctx.onDeathTitle() : null; });
  await page.waitForTimeout(800);
  report('титульный экран (после смерти)', await page.evaluate(() => {
    const vis = (id) => { const el = document.getElementById(id); return el ? !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' : null; };
    return {
      startVisible: vis('start'),
      continueVisible: vis('continue'),
      continueText: document.getElementById('continue') ? document.getElementById('continue').textContent.trim() : null,
      hasSave: window.__dbg.hasSave(),
    };
  }));
  await shotPage(page, SHOTS + '/TEST_72_title_continue.jpg');

  report('«Продолжить» клик', await page.evaluate(() => {
    const D = window.__dbg;
    document.getElementById('continue').click();
    return { mode: D.mode, day: D.calendar.day, coins: D.stats.coins };
  }));

  /* ---------- 6. не застреваем ли в стенах ---------- */
  const stuck = await page.evaluate(() => {
    const D = window.__dbg;
    const out = [];
    const boxes = D.colliders.boxes.filter((b) => b.hx > 0.5 && b.hz > 0.5).slice(0, 40);
    for (const b of boxes) {
      // встаём в центр стены и идём сквозь неё в обе стороны
      D.teleport(b.cx, b.cz, 0);
      for (let i = 0; i < 10; i++) D.player.update(0.05);
      const inside0 = {
        x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2),
      };
      D.player.keys.clear(); D.player.keys.add('KeyW');
      for (let i = 0; i < 60; i++) D.player.update(0.05);
      D.player.keys.clear();
      // проверяем, не остался ли игрок внутри прямоугольника стены
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      const dx = D.player.pos.x - b.cx, dz = D.player.pos.z - b.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      const inside = Math.abs(lx) < b.hx && Math.abs(lz) < b.hz;
      out.push({ стена: { cx: +b.cx.toFixed(1), cz: +b.cz.toFixed(1), hx: b.hx, hz: b.hz }, старт: inside0, конец: { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) }, остался_в_стене: inside });
    }
    return out;
  });
  const insideCount = stuck.filter((s) => s.остался_в_стене).length;
  report('проверка «стены держат» (' + stuck.length + ' стен)', { осталось_в_стене: insideCount, примеры: stuck.filter((s) => s.остался_в_стене).slice(0, 8) });

  report('итого ошибок', errs.slice());
});
