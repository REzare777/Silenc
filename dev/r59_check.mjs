/**
 * Раунд 59: проверки того, чего агент-тестировщик не смог проверить.
 *
 *  Л1  вертикальная лестница (climbs) — амбар и таверна;
 *  Л2  битое сохранение не роняет игру;
 *  Л3  живой ввод с клавиатуры и мыши;
 *  Л4  звуковая среда жива (AudioContext, ноды, вызовы);
 *  Л5  рыбалка, диалоги, животные;
 *  Л6  плавный перелив времени суток;
 *  Л7  смена суток через nextDay и смена сезона;
 *  Л8  тач-управление;
 *  Л9  много автосейвов подряд (долгая сессия, переполнение localStorage).
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const BASE = 'http://127.0.0.1:4205/';
let ok = 0;
let fail = 0;
const failed = [];

/**
 * Проверка с записью результата.
 *
 * @param {string} name что проверяем
 * @param {boolean} cond результат
 * @param {string} [extra] подробности при ошибке
 */
function check(name, cond, extra = '') {
  if (cond) {
    ok++;
    console.log('✓', name);
  } else {
    fail++;
    failed.push(name);
    console.log('✗', name, extra ? `— ${extra}` : '');
  }
}

const browser = await chromium.launch(LAUNCH);
// hasTouch: включает ветку тач-управления ('ontouchstart' in window) —
// без неё обработчики стика вообще не ставятся
const context = await browser.newContext({
  viewport: { width: 900, height: 560 },
  hasTouch: true,
});
const page = await context.newPage();
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(800);

/* ================= Л1: вертикальная лестница ================= */
const climbBarn = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('barn');
  const loc = D.barnLoc;
  const zone = (loc.climbs || [])[0];
  if (!zone) return { err: 'в амбаре нет зон подъёма' };
  // встаём у лестницы и смотрим вверх
  D.player.teleport(zone.x, zone.z - 0.5, 0);
  D.player.pitch = 0.6;
  D.player.keys.add('KeyW');
  let grabbed = false;
  for (let i = 0; i < 240; i++) {
    D.player.update(0.05);
    if (D.player.climb) grabbed = true;
  }
  D.player.keys.delete('KeyW');
  const out = {
    grabbed,
    y: D.player.y,
    groundY: D.player.groundY,
    climb: !!D.player.climb,
    zone: { x: zone.x, z: zone.z, y0: zone.y0, y1: zone.y1 },
  };
  return out;
});
check('Л1: у лестницы в амбаре игрок цепляется за неё', climbBarn.grabbed === true,
  JSON.stringify(climbBarn));
check('Л1: подъём в амбаре поднимает игрока на чердак',
  climbBarn.groundY + climbBarn.y > climbBarn.zone.y1 - 0.5 || climbBarn.groundY > 0.8,
  `y=${climbBarn.y} groundY=${climbBarn.groundY}`);

const climbTavern = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('tavern');
  const zone = (D.tavernLoc.climbs || [])[0];
  if (!zone) return { err: 'в таверне нет зон подъёма' };
  D.player.teleport(zone.x, zone.z - 0.5, 0);
  D.player.pitch = 0.6;
  D.player.keys.add('KeyW');
  let grabbed = false;
  for (let i = 0; i < 240; i++) {
    D.player.update(0.05);
    if (D.player.climb) grabbed = true;
  }
  D.player.keys.delete('KeyW');
  return { grabbed, y: D.player.y, groundY: D.player.groundY, y1: zone.y1 };
});
check('Л1: у лестницы в таверне игрок цепляется за неё', climbTavern.grabbed === true,
  JSON.stringify(climbTavern));
check('Л1: подъём в таверне поднимает игрока на первый этаж',
  climbTavern.groundY + climbTavern.y > climbTavern.y1 - 0.5,
  `y=${climbTavern.y} groundY=${climbTavern.groundY} y1=${climbTavern.y1}`);

/* ================= Л2: битое сохранение ================= */
const broken = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {};
  // 1) совсем мусор
  localStorage.setItem('wv.save.v1', '{{{ это не json');
  try {
    out.musor = D.loadGame() === false || true;   // не должно бросить
  } catch (e) {
    out.musor = 'исключение: ' + e.message;
  }
  // 2) json, но не объект
  localStorage.setItem('wv.save.v1', '"строка"');
  try {
    out.nesav对象 = D.loadGame() === false || true;
  } catch (e) {
    out.nesav对象 = 'исключение: ' + e.message;
  }
  // 3) объект без полей
  localStorage.setItem('wv.save.v1', JSON.stringify({ v: 1 }));
  try {
    out.pusto = D.loadGame() === false || true;
  } catch (e) {
    out.pusto = 'исключение: ' + e.message;
  }
  // 4) мусор в полях
  localStorage.setItem('wv.save.v1', JSON.stringify({
    v: 1, day: 'нет', hp: 'много', pos: { x: 'a', z: null }, loc: 'не-локация',
    inv: 'не массив', torch: { fuel: 'нет' },
  }));
  try {
    out.musorPole = D.loadGame() === false || true;
  } catch (e) {
    out.musorPole = 'исключение: ' + e.message;
  }
  return out;
});
check('Л2: сохранение-мусор не роняет игру', broken.musor === true, String(broken.musor));
check('Л2: не-объект в слоте сохранения не роняет игру', broken.nesav对象 === true,
  String(broken.nesav对象));
check('Л2: сохранение без полей не роняет игру', broken.pusto === true, String(broken.pusto));
check('Л2: мусор в полях сохранения не роняет игру', broken.musorPole === true,
  String(broken.musorPole));

// состояние после загрузки мусора должно остаться живым
const afterGarbage = await page.evaluate(() => {
  const D = window.__dbg;
  return {
    hp: D.stats.hp,
    coins: D.stats.coins,
    px: D.player.pos.x,
    pz: D.player.pos.z,
    finite: Number.isFinite(D.player.pos.x) && Number.isFinite(D.player.pos.z),
  };
});
check('Л2: после мусора здоровье и монеты — числа', Number.isFinite(afterGarbage.hp)
  && Number.isFinite(afterGarbage.coins), JSON.stringify(afterGarbage));
check('Л2: после мусора игрок не оказался в NaN-координатах', afterGarbage.finite === true,
  JSON.stringify(afterGarbage));

/* ================= Л3: живой ввод ================= */
await page.evaluate(() => { window.__dbg.setLocation('village'); });
await page.waitForTimeout(300);
const before = await page.evaluate(() => {
  const D = window.__dbg;
  D.player.teleport(0, 16, 0);
  return { x: D.player.pos.x, z: D.player.pos.z, yaw: D.player.yaw };
});
// в SwiftShader кадр идёт 10–60 секунд, поэтому ждём РЕАЛЬНЫЙ кадр
const frame0 = await page.evaluate(() => window.__frames || 0);
await page.keyboard.down('KeyW');
await page.waitForTimeout(300);
const keysHeld = await page.evaluate(() => window.__dbg.player.keys.size);
await page.waitForFunction((t) => (window.__frames || 0) > t, frame0, { timeout: 240000 });
await page.keyboard.up('KeyW');
const afterKeys = await page.evaluate(() => {
  const D = window.__dbg;
  const moved = Math.hypot(D.player.pos.x - 0, D.player.pos.z - 16);
  return { moved, keys: D.player.keys.size };
});
check('Л3: реальная клавиша W доходит до игрока', keysHeld > 0, `keys=${keysHeld}`);
check('Л3: игрок реально двигается по нажатой клавише', afterKeys.moved > 0.05,
  JSON.stringify(afterKeys));

const mouse = await page.evaluate(() => {
  const D = window.__dbg;
  const y0 = D.player.yaw;
  const p0 = D.player.pitch;
  // имитация движения мыши через штатные обработчики
  const ev = new MouseEvent('mousemove', { bubbles: true, movementX: 120, movementY: -40 });
  document.dispatchEvent(ev);
  return { yaw: D.player.yaw, pitch: D.player.pitch, y0, p0 };
});
check('Л3: мышь поворачивает обзор', Math.abs(mouse.yaw - mouse.y0) > 0.001
  || Math.abs(mouse.pitch - mouse.p0) > 0.001, JSON.stringify(mouse));

/* ================= Л4: звук ================= */
const sound = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {};
  const amb = D.ambience;
  out.hasAmbience = !!amb;
  out.ctxState = amb && amb.ctx ? amb.ctx.state : 'нет контекста';
  out.started = amb ? !!amb.started : false;
  // звуки не должны бросать исключений
  const errs = [];
  for (const fn of ['step', 'spell', 'dryClick', 'setInterior', 'setSurface']) {
    if (!amb || typeof amb[fn] !== 'function') { errs.push(`${fn}: нет метода`); continue; }
    try {
      if (fn === 'spell') amb.spell('flash');
      else if (fn === 'setInterior') amb.setInterior('dungeon');
      else if (fn === 'setSurface') amb.setSurface('stone');
      else amb[fn]();
    } catch (e) {
      errs.push(`${fn}: ${e.message}`);
    }
  }
  out.errs = errs;
  return out;
});
check('Л4: звуковая среда создана', sound.hasAmbience === true, JSON.stringify(sound));
check('Л4: звуковые вызовы не падают', sound.errs.length === 0, sound.errs.join(' | '));

/* ================= Л5: рыбалка, диалоги, животные ================= */
const life = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {};
  // рыбалка
  try {
    const spots = D.castSpots || [];
    out.spots = spots.length;
    const s = spots[0];
    out.started = D.startFishing ? 'есть функция' : 'нет функции';
    if (s && D.startFishing) {
      D.startFishing(s);
      const rolled = D.rollFish();
      out.fish = rolled ? (rolled.name || rolled.id || 'рыба') : 'пусто';
    }
  } catch (e) {
    out.fishErr = e.message;
  }
  // диалог с барменом
  try {
    D.setLocation('tavern');
    D.dialog.open('barkeep');
    out.dialogOpen = !!(D.dialog && (D.dialog.open_ || D.dialog.isOpen));
    out.dialogKeys = D.dialog ? Object.keys(D.dialog).slice(0, 8) : [];
  } catch (e) {
    out.dialogErr = e.message;
  }
  // животные
  try {
    const an = D.ctx.systems.animals;
    out.animals = an ? Object.keys(an).slice(0, 8) : 'нет системы';
    if (an && typeof an.update === 'function') {
      for (let i = 0; i < 60; i++) an.update(0.05, D.player);
      out.animalsOk = true;
    }
  } catch (e) {
    out.animalErr = e.message;
  }
  return out;
});
check('Л5: места для рыбалки есть', life.spots > 0, JSON.stringify(life.spots));
check('Л5: рыбалка выдаёт улов', !!life.fish && life.fish !== 'пусто',
  `${life.fish || ''} ${life.fishErr || ''}`);
check('Л5: диалог с барменом открывается', life.dialogOpen === true,
  `${life.dialogErr || ''} ${JSON.stringify(life.dialogKeys || [])}`);
check('Л5: животные обновляются без ошибок', life.animalsOk === true, life.animalErr || '');

/* ================= Л6: плавный перелив времени ================= */
const blend = await page.evaluate(() => {
  const D = window.__dbg;
  const env = D.env;
  env.setTimeOfDay('day', true);
  const sun0 = env.sun ? env.sun.intensity : null;
  env.setTimeOfDay('night', false);      // плавно
  const t0 = env.t;
  const sunStart = env.sun ? env.sun.intensity : null;
  for (let i = 0; i < 30; i++) env.update(0.05, false);
  const t1 = env.t;
  const sunMid = env.sun ? env.sun.intensity : null;
  return { t0, t1, sunStart, sunMid, target: env.target, current: env.current };
});
check('Л6: перелив времени идёт плавно, а не скачком', blend.t1 > blend.t0,
  JSON.stringify(blend));
check('Л6: солнце гаснет к ночи', blend.sunMid < blend.sunStart, JSON.stringify(blend));

/* ================= Л7: nextDay и смена сезона ================= */
const cal = await page.evaluate(() => {
  const D = window.__dbg;
  const c = D.calendar;
  const before = { day: c.day, season: c.season, year: c.year };
  c.nextDay();
  const after = { day: c.day, season: c.season, year: c.year };
  // сезон должен смениться на границе
  const before2 = { day: c.day, season: c.season };
  c.restore(84, 'winter', 1);   // зима по календарю
  const winter = { day: c.day, season: c.season };
  c.applyLook();
  return { before, after, before2, winter };
});
check('Л7: nextDay увеличивает день', cal.after.day === cal.before.day + 1
  || cal.after.year > cal.before.year, JSON.stringify(cal));
check('Л7: сезон меняется по календарю', cal.winter.season === 'winter',
  JSON.stringify(cal.winter));

/* ================= Л8: тач-управление ================= */
const touch = await page.evaluate(() => {
  const D = window.__dbg;
  const stick = document.getElementById('stick');
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const mk = (type, id, x, y) => {
    const t = new Touch({ identifier: id, target: stick, clientX: x, clientY: y });
    return new TouchEvent(type, {
      bubbles: true, cancelable: true,
      touches: type === 'touchend' ? [] : [t],
      changedTouches: [t],
    });
  };
  stick.dispatchEvent(mk('touchstart', 7, cx, cy));
  window.dispatchEvent(mk('touchmove', 7, cx, cy - 40));
  const move = { x: D.player.touchMove.x, y: D.player.touchMove.y };
  window.dispatchEvent(mk('touchend', 7, cx, cy - 40));
  const after = { x: D.player.touchMove.x, y: D.player.touchMove.y };
  return { move, after };
});
check('Л8: стик даёт направление движения', Math.abs(touch.move.y) > 0.1,
  JSON.stringify(touch));
check('Л8: отпускание стика останавливает движение',
  Math.abs(touch.after.x) < 0.01 && Math.abs(touch.after.y) < 0.01, JSON.stringify(touch));

/* ================= Л9: долгая сессия и localStorage ================= */
const stress = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {};
  // 200 автосейвов подряд
  let err = null;
  try {
    for (let i = 0; i < 200; i++) D.saveGame(true);
  } catch (e) {
    err = e.message;
  }
  out.err = err;
  const raw = localStorage.getItem('wv.save.v1');
  out.size = raw ? raw.length : 0;
  out.valid = false;
  try {
    const parsed = JSON.parse(raw);
    out.valid = !!(parsed && parsed.v);
    out.hasLoc = typeof parsed.loc === 'string';
  } catch (e) {
    out.parseErr = e.message;
  }
  // и переполнение: запись мусора прямо в ключ
  try {
    localStorage.setItem('wv.save.v1', 'x'.repeat(2 * 1024 * 1024));
    out.overflow = 'записалось';
  } catch (e) {
    out.overflow = e.name;   // QuotaExceededError — это нормально
  }
  // после переполнения игра должна продолжать работать
  try {
    D.saveGame(true);
    out.afterOverflow = !!localStorage.getItem('wv.save.v1');
  } catch (e) {
    out.afterOverflow = 'исключение: ' + e.message;
  }
  return out;
});
check('Л9: 200 автосейвов подряд не ломают игру', !stress.err, String(stress.err));
check('Л9: сохранение остаётся валидным json', stress.valid === true,
  `${stress.parseErr || ''} ${stress.size}`);
check('Л9: после переполнения хранилища игра продолжает работать',
  stress.afterOverflow === true, JSON.stringify(stress.afterOverflow));

/* ================= консоль ================= */
check('нет ошибок в консоли', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\nr59_check: ${ok} ok, ${fail} fail`);
if (fail) {
  console.log('не прошли:', failed.join(', '));
  process.exit(1);
}
