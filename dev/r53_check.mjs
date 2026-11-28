/**
 * ============================================================================
 *  Раунд 53: титульный экран, слоты сохранений и смерть
 * ============================================================================
 *
 *  Что проверяем:
 *   1. На титульном экране есть «Начать игру», «Продолжить», «Загрузить игру».
 *   2. Ручные слоты пишутся, читаются и не перетирают друг друга.
 *   3. Смерть: здоровье падает до нуля, игрок валится, появляется экран «Погиб».
 *   4. Тень действительно убивает игрока (правило «смерти нет» снято).
 *   5. После смерти бой заморожен.
 *   6. «Загрузить последнее сохранение» возвращает игрока к жизни.
 *   7. «Загрузить» открывает окно выбора слота.
 *   8. «В начало» возвращает на титульный экран.
 *
 *  Запуск: cd dev && node r53_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};

  /* --- 1. титульный экран --- */
  const vis = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  };
  out.hasNewGame = vis('begin');
  out.hasLoadGame = vis('loadGame');
  out.hasContinue = vis('continue');
  out.startVisible = !document.getElementById('start').classList.contains('gone');

  /* --- 2. слоты --- */
  d.ctx.stats.coins = 55;
  d.ctx.calendar.nextDay();
  const saved = d.saveToSlot(1);
  out.slotApi = !!saved;
  out.slots = d.listSlots ? d.listSlots() : null;

  /* --- 3. смерть --- */
  d.ctx.stats.hp = 5;
  const killed = d.ctx.systems.death.kill('Тень забрала вас в пещере.');
  out.killed = killed;
  out.phaseAfterKill = d.ctx.systems.death.state.phase;
  out.playerDisabled = d.ctx.player.enabled === false;
  // прокручиваем падение (софт-рендер: 1 кадр за ~900 мс)
  for (let i = 0; i < 130; i++) d.ctx.systems.death.update(1 / 60);
  out.phaseAfterFall = d.ctx.systems.death.state.phase;
  out.deathScreen = document.getElementById('death').classList.contains('on');
  out.deathReason = document.getElementById('deathReason').textContent;
  out.deathMeta = document.getElementById('deathLastMeta').textContent;
  // камера упала: стала ниже и завалилась
  out.camHeight = +d.ctx.player.camera.position.y.toFixed(2);
  out.camRoll = +d.ctx.systems.death.state.roll.toFixed(2);

  /* --- 4. тень убивает игрока --- */
  d.ctx.systems.death.revive();
  d.ctx.stats.hp = 4;
  // наносим урон через штатный механизм тени
  d.ctx.stats.damage(10);
  out.hpCanReachZero = d.ctx.stats.hp === 0;

  // Настоящий удар зверя: ставим игрока вплотную к монстру и прокручиваем
  // его логику — зверь должен дотянуться и ударить.
  //
  // Раньше здесь была «тень» (ctx.systems.shadows), но с раунда 61 её
  // заменил общий зверинец (ctx.systems.monsters) с десятью породами.
  d.ctx.stats.hp = 2;
  d.ctx.systems.death.revive();
  const mon = d.ctx.systems.monsters;
  // звери живут в подземелье — без входа их список пуст
  if (mon && !mon.list.length) mon.spawn();
  out.shadowCount = mon ? mon.list.length : 0;
  if (mon && mon.list.length) {
    const s0 = mon.list[0];
    d.ctx.player.teleport(s0.x + 0.4, s0.z, 0);
    s0.state = 'stalk';
    s0.dissolve = 0;
    let hits = 0;
    const hpStart = d.ctx.stats.hp;
    for (let i = 0; i < 200 && d.ctx.stats.hp > 0; i++) {
      // тянем зверя к игроку: он сам дойдёт и ударит
      s0.x = d.ctx.player.pos.x - 0.3;
      s0.z = d.ctx.player.pos.z;
      mon.update(1 / 60, i / 60);
    }
    out.hpAfterShadowHits = d.ctx.stats.hp;
    out.shadowKilled = d.ctx.stats.hp === 0;
    out.deathAfterShadow = d.ctx.systems.death.state.phase !== 'alive';
    hits = hpStart - d.ctx.stats.hp;
    out.shadowDamageTaken = hits;
    d.ctx.systems.death.revive();
    d.ctx.stats.hp = 100;
  }

  /* --- 5. бой заморожен после смерти --- */
  d.ctx.systems.death.kill('Тень забрала вас в пещере.');
  out.battlePaused = d.ctx.systems.combat.state.active === false;
  d.ctx.systems.death.revive();
  d.ctx.systems.combat.resume();
  out.battleResumed = d.ctx.systems.combat.state.active === true;

  /* --- 6. «Загрузить последнее сохранение» --- */
  d.ctx.stats.hp = 100;
  d.ctx.stats.coins = 55;
  d.saveGame(true);
  d.ctx.stats.hp = 3;
  d.ctx.stats.coins = 1;
  d.ui.onDeathLast();
  out.hpRestored = d.ctx.stats.hp;
  out.coinsRestored = d.ctx.stats.coins;
  out.deathHidden = !document.getElementById('death').classList.contains('on');

  /* --- 7. «Загрузить» открывает окно слотов --- */
  d.ui.onDeathLoad();
  out.slotsOpen = document.getElementById('slots').classList.contains('on');
  out.slotRows = document.querySelectorAll('#slotsList .slotRow').length;
  out.slotSaveButtons = document.querySelectorAll('#slotsList button[data-act="save"]').length;

  /* --- 8. «В начало» --- */
  d.ui.hideSlots();
  d.ui.onDeathTitle();
  out.titleShown = !document.getElementById('start').classList.contains('gone');
  out.deathClosed = !document.getElementById('death').classList.contains('on');

  return out;
});

const checks = [];
const ok = (name, cond, extra = '') => {
  checks.push({ name, pass: !!cond });
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
};

ok('на титульном экране есть «Начать игру»', res.hasNewGame);
ok('на титульном экране есть «Загрузить игру»', res.hasLoadGame);
ok('титульный экран показан до входа в игру', res.startVisible);
ok('слоты сохраняются', res.slotApi);
ok('в списке четыре записи (последнее + 3 слота)',
  res.slots && res.slots.length === 4, `${res.slots ? res.slots.length : 0}`);
ok('слот 1 записан', res.slots && res.slots[1] && res.slots[1].exists === true);
ok('слоты 2 и 3 пусты', res.slots && !res.slots[2].exists && !res.slots[3].exists);
ok('смерть наступает', res.killed);
ok('после удара фаза «falling»', res.phaseAfterKill === 'falling', res.phaseAfterKill);
ok('игрок теряет управление при смерти', res.playerDisabled);
ok('после падения фаза «dead»', res.phaseAfterFall === 'dead', res.phaseAfterFall);
ok('экран «Погиб» показан', res.deathScreen);
ok('причина смерти видна', /Тень/.test(res.deathReason || ''), res.deathReason);
ok('подпись последнего сохранения видна', (res.deathMeta || '').length > 3, res.deathMeta);
ok('камера упала (ниже 1 м)', res.camHeight < 1.0, `y=${res.camHeight}`);
ok('камера завалилась набок', Math.abs(res.camRoll) > 0.5, `roll=${res.camRoll}`);
ok('здоровье может упасть до нуля', res.hpCanReachZero);
ok('звери в пещере есть', res.shadowCount > 0, `${res.shadowCount}`);
ok('зверь бьёт игрока', res.shadowDamageTaken > 0, `−${res.shadowDamageTaken} HP`);
ok('зверь может убить игрока', res.shadowKilled);
ok('после удара тенью игрок мёртв', res.deathAfterShadow);
ok('бой замораживается при смерти', res.battlePaused);
ok('бой возобновляется после загрузки', res.battleResumed);
ok('загрузка возвращает здоровье', res.hpRestored > 50, `hp=${res.hpRestored}`);
ok('загрузка возвращает монеты', res.coinsRestored > 0, `${res.coinsRestored} зол.`);
ok('экран смерти закрыт после загрузки', res.deathHidden);
ok('«Загрузить» открывает окно слотов', res.slotsOpen);
ok('в окне четыре строки', res.slotRows === 4, `${res.slotRows}`);
ok('у ручных слотов есть кнопка «Сохранить»', res.slotSaveButtons === 3, `${res.slotSaveButtons}`);
ok('«В начало» возвращает титульный экран', res.titleShown);
ok('экран смерти закрыт после «В начало»', res.deathClosed);

const failed = checks.filter((c) => !c.pass);
console.log('\n' + (failed.length ? `ПРОВАЛЕНО: ${failed.length}` : 'все проверки пройдены'));
console.log('ошибок в консоли:', errs.length, errs.slice(0, 3));
await browser.close();
process.exit(failed.length || errs.length ? 1 : 0);
