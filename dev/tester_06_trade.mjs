/**
 * Тест 6: торговля — Хорт (заклинания, товары) и Торн (факел, смола и фитиль).
 */

import { withGame, shotPage, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const dumpTrade = () => page.evaluate(() => {
    const g = document.getElementById('tradeGoods');
    const m = document.getElementById('tradeMine');
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
    return {
      visible: !!(document.getElementById('trade') && document.getElementById('trade').classList.contains('on')),
      name: txt(document.getElementById('tradeName')),
      title: txt(document.getElementById('tradeTitle')),
      greet: (txt(document.getElementById('tradeGreet')) || '').slice(0, 120),
      goods: g ? g.textContent.replace(/\s+/g, ' ').trim() : null,
      goodsCount: g ? g.children.length : 0,
      mine: m ? m.textContent.replace(/\s+/g, ' ').trim() : null,
      coins: window.__dbg.stats.coins,
    };
  });

  /* ---------- Хорт ---------- */
  report('открываем торговлю Хорта', await page.evaluate(() => {
    window.__dbg.stats.coins = 500;
    return window.__dbg.trade.open('barkeep');
  }));
  await page.waitForTimeout(600);
  report('окно торговли (Хорт)', await dumpTrade());
  await shotPage(page, SHOTS + '/TEST_30_trade_barkeep.jpg');

  report('каталог Хорта (из кода)', await page.evaluate(() => {
    const D = window.__dbg;
    const t = D.trade;
    return {
      кто: t.who,
      покупает: ['fish', 'goods', 'spell'],
      заклинания_в_каталоге: ['spell_flash', 'spell_heal', 'spell_light'].map((id) => {
        const s = D.items.getItem(id);
        return { id, name: s.name, buy: D.items.buyPrice(s), sell: D.items.sellPrice(s), mana: s.mana };
      }),
    };
  }));

  /* ---------- покупка заклинания ---------- */
  const buySpell = await page.evaluate(() => {
    const D = window.__dbg;
    const before = { coins: D.stats.coins, belt: D.inventory.slots.slice(27).map((s) => s && s.id) };
    const ok = D.trade.buy('spell_flash');
    const after = { coins: D.stats.coins, belt: D.inventory.slots.slice(27).map((s) => s && s.id) };
    return { ok, before, after };
  });
  report('покупка «Огненная вспышка»', buySpell);

  /* ---------- покупка факела и смолы у кузнеца ---------- */
  await page.evaluate(() => window.__dbg.trade.close());
  report('открываем торговлю Торна', await page.evaluate(() => window.__dbg.trade.open('blacksmith')));
  await page.waitForTimeout(600);
  report('окно торговли (Торн)', await dumpTrade());
  await shotPage(page, SHOTS + '/TEST_31_trade_blacksmith.jpg');

  report('покупка факела и смолы', await page.evaluate(() => {
    const D = window.__dbg;
    const before = { coins: D.stats.coins };
    const t1 = D.trade.buy('torch');
    const c1 = D.stats.coins;
    const t2 = D.trade.buy('pitch');
    const c2 = D.stats.coins;
    return {
      torch: { ok: t1, coinsBefore: before.coins, coinsAfter: c1 },
      pitch: { ok: t2, coinsAfter: c2 },
      belt: D.inventory.slots.slice(27).map((s, i) => s ? `${i + 1}:${s.id}x${s.count}` : null),
      каталог_Торна: ['axe', 'bow', 'staff', 'torch', 'pitch'].map((id) => {
        const s = D.items.getItem(id);
        return s ? { id, name: s.name, kind: s.kind, buy: D.items.buyPrice(s), sell: D.items.sellPrice(s) } : { id, нет: true };
      }),
    };
  }));

  /* ---------- продажа ---------- */
  report('продажа (рыба и факел)', await page.evaluate(() => {
    const D = window.__dbg;
    // кладём рыбу в сумку
    const fish = D.items.getItem(D.FISH[0].id);
    D.inventory.add({ id: fish.id, spec: fish, count: 2, best: { weight: fish.weightMin, length: fish.lengthMin } });
    const before = D.stats.coins;
    const s1 = D.trade.sell(fish.id);
    const c1 = D.stats.coins;
    const s2 = D.trade.sell('torch');
    const c2 = D.stats.coins;
    return {
      рыба: { продана: s1, цена_продажи: D.items.sellPrice(fish), coinsBefore: before, coinsAfter: c1 },
      факел: { продан: s2, цена_продажи: D.items.sellPrice(D.items.getItem('torch')), coinsAfter: c2 },
      факел_остался_в_сумке: D.inventory.countOf('torch'),
      torchEquipped: D.combat.state.torchEquipped,
    };
  }));

  /* ---------- цены из UI vs. код ---------- */
  report('цены в UI (Торн)', await page.evaluate(() => {
    const g = document.getElementById('tradeGoods');
    const rows = [];
    for (const el of g.children) {
      rows.push({ text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) });
    }
    return rows;
  }));

  await page.evaluate(() => window.__dbg.trade.close());
  await page.waitForTimeout(300);
  report('после закрытия торговли', await page.evaluate(() => ({ mode: window.__dbg.mode, tradeOpen: window.__dbg.trade.isOpen })));

  report('итого ошибок', errs.slice());
});
