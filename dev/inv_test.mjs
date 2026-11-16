import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.env.TEST_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text().slice(0, 160)); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.waitForSelector('#begin');
await page.waitForTimeout(700);
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);

const out = {};

/* ---------- 1. наполняем инвентарь ---------- */
out.наполнение = await page.evaluate(() => {
  const d = window.__dbg;
  const F = d.rollFish;
  // кладём 3 вида рыбы по 2-3 штуки
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const f = d.rollFish();
    ids.push(f.spec.id);
  }
  const uniq = [...new Set(ids)];
  const inv = d.inventory;
  uniq.forEach((id, k) => {
    const spec = d.FISH.find((x) => x.id === id) || d.FISH[0];
    for (let n = 0; n <= k; n++) inv.add({ id: spec.id, spec, count: 1, best: { weight: spec.weightMin, length: spec.lengthMin } });
  });
  d.ui.renderInventory(inv);
  return { виды: uniq.length, всего: inv.stats().total, слотов: inv.slots.filter(Boolean).length };
});

/* ---------- 2. открытие по I: фокус курсора ---------- */
await page.keyboard.press('KeyI');
await page.waitForTimeout(700);
out.открытие = await page.evaluate(() => {
  const d = window.__dbg;
  return {
    открыт: document.getElementById('inv').classList.contains('on'),
    фокус_курсора: document.body.classList.contains('uiFocus'),
    захват_мыши: !!document.pointerLockElement,
    игрок_заморожен: !d.player.enabled && !d.player.acceptInput,
    главных_слотов: document.querySelectorAll('#invGrid .slot').length,
    поясов_слотов: document.querySelectorAll('#invBelt .slot').length,
    хотбар_в_hud: document.querySelectorAll('#hotbar .slot').length,
    счётчик: document.getElementById('invCount').textContent,
  };
});

/* ---------- 3. перетаскивание ---------- */
out.перетаскивание = await page.evaluate(() => {
  const d = window.__dbg;
  const inv = d.inventory;
  const slots = [...document.querySelectorAll('#invGrid .slot')];
  const belt = [...document.querySelectorAll('#invBelt .slot')];
  const res = {};
  const down = (el, button = 0, shift = false) =>
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button, shiftKey: shift, cancelable: true }));

  // берём предмет из первого занятого слота
  const i0 = inv.slots.findIndex((s) => s);
  const name = inv.slots[i0].spec.name;
  const cnt = inv.slots[i0].count;
  down(slots[i0]);
  res.взяли = { на_курсоре: !!inv.held, слот_пуст: !inv.slots[i0], имя: name, счётчик: cnt };
  res.виден_предмет_на_курсоре = document.getElementById('invHeld').classList.contains('on');

  // кладём в первый пустой слот основной сетки
  const iEmpty = inv.slots.findIndex((s, k) => !s && k < 27);
  down(slots[iEmpty]);
  res.положили = { на_курсоре: !!inv.held, в_слоте: inv.slots[iEmpty] ? inv.slots[iEmpty].spec.name : null };

  // Shift+ЛКМ — быстрый перенос в пояс
  const iBelt = inv.slots.findIndex((s, k) => s && k < 27);
  down(slots[iBelt], 0, true);
  res.shift_в_пояс = {
    в_поясе: inv.slots.slice(27).filter(Boolean).length,
    осталось_в_основном: inv.slots.slice(0, 27).filter(Boolean).length,
  };

  // ПКМ — взять половину стека
  const iStack = inv.slots.findIndex((s) => s && s.count > 1);
  if (iStack >= 0) {
    const before = inv.slots[iStack].count;
    down(slots[iStack], 2);
    res.пкм_половина = { было: before, на_курсоре: inv.held ? inv.held.count : 0, в_слоте: inv.slots[iStack] ? inv.slots[iStack].count : 0 };
    // возвращаем обратно
    down(slots[iStack], 2);
  }

  // клик мимо сетки — предмет возвращается в инвентарь
  const invEl = document.getElementById('inv');
  invEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
  res.возврат_на_фоне = { на_курсоре: !!inv.held, всего_предметов: inv.stats().total };

  // объединение двух стаков одного вида и обмен разных
  const spec = inv.slots.find((s) => s)?.spec;
  const a = inv.slots.findIndex((s) => s);
  inv.slots[a] = { id: spec.id, spec, count: 3, best: { weight: 1, length: 10 } };
  const b = inv.slots.findIndex((s, k) => !s && k !== a);
  inv.slots[b] = { id: spec.id, spec, count: 4, best: { weight: 2, length: 20 } };
  d.ui.renderInventory(inv);
  const sl2 = [...document.querySelectorAll('#invGrid .slot')];
  down(sl2[a]);
  down(sl2[b]);
  res.объединение = {
    было: '3 + 4', стало: inv.slots[b] ? inv.slots[b].count : null,
    на_курсоре: inv.held ? inv.held.count : 0,
    лучший_вес: inv.slots[b] ? +inv.slots[b].best.weight.toFixed(2) : null,
  };
  // разные предметы — обмен местами
  const spec2 = inv.slots.find((s) => s && s.spec.id !== spec.id)?.spec;
  if (spec2) {
    const c = inv.slots.findIndex((s) => s && s.spec.id === spec.id);
    const e = inv.slots.findIndex((s) => s && s.spec.id === spec2.id);
    const sl3 = [...document.querySelectorAll('#invGrid .slot')];
    down(sl3[c]);
    down(sl3[e]);
    res.обмен = { в_слоте_c: inv.slots[c]?.spec.name, в_слоте_e: inv.slots[e]?.spec.name, на_курсоре: !!inv.held };
    down(sl3[c]);   // вернуть
  }
  // предел стака
  const big = { id: spec.id, spec, count: 70, best: { weight: 1, length: 10 } };
  inv.slots[a] = { id: spec.id, spec, count: 60, best: { weight: 1, length: 10 } };
  inv.add(big);
  res.предел_стака = inv.slots[a].count;

  d.ui.renderInventory(inv);
  return res;
});

/* ---------- 4. клик по фону не закрывает инвентарь ---------- */
out.фон_не_закрывает = await page.evaluate(() => {
  document.getElementById('inv').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
  return document.getElementById('inv').classList.contains('on');
});

/* ---------- 5. 3D-превью по наведению ---------- */
await page.evaluate(() => {
  const s = [...document.querySelectorAll('#invGrid .slot')].find((el) => el.querySelector('canvas'));
  if (s) s.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
});
await page.waitForTimeout(1200);
out.превью = await page.evaluate(() => ({
  панель: document.getElementById('viewCard').classList.contains('has'),
  имя: document.getElementById('vName').textContent,
  мешей_в_модели: window.__dbg.ui.fishView.model ? window.__dbg.ui.fishView.model.children.length : 0,
  подсказка: document.getElementById('invTip').classList.contains('on'),
}));

/* ---------- 6. выход только по Esc или I ---------- */
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
out.выход_по_esc = await page.evaluate(() => ({
  закрыт: !document.getElementById('inv').classList.contains('on'),
  фокус_снят: !document.body.classList.contains('uiFocus'),
  игра_идёт: window.__dbg.player.enabled,
}));

await page.keyboard.press('KeyI');
await page.waitForTimeout(500);
const openedAgain = await page.evaluate(() => document.getElementById('inv').classList.contains('on'));
await page.keyboard.press('KeyI');
await page.waitForTimeout(500);
out.выход_по_I = {
  открылся_повторно: openedAgain,
  закрылся: await page.evaluate(() => !document.getElementById('inv').classList.contains('on')),
};

/* ---------- 7. в игре Esc открывает настройки, а не инвентарь ---------- */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
out.esc_в_игре = await page.evaluate(() => ({
  меню_настроек: document.getElementById('menu').classList.contains('on'),
  инвентарь_закрыт: !document.getElementById('inv').classList.contains('on'),
}));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

console.log(JSON.stringify(out, null, 1));
console.log('ошибки:', errs.length ? errs : 'нет');
await browser.close();
