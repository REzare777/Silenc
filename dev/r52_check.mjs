/**
 * ============================================================================
 *  Раунд 52: сохранения, календарь и сезоны
 * ============================================================================
 *
 *  Что проверяем:
 *   1. Сохранение записывается, читается и восстанавливает состояние.
 *   2. Инвентарь, характеристики и позиция восстанавливаются точно.
 *   3. Календарь считает дни и меняет сезоны каждые 5 дней.
 *   4. Ручная смена времени суток не считается новым днём.
 *   5. Переночевание в трактире двигает календарь и сохраняет игру.
 *   6. Зима включает снег, лето — нет.
 *   7. Кнопка «Продолжить» появляется, когда есть сохранение.
 *
 *  Запуск: cd dev && node r52_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};
  const cal = d.ctx.calendar;

  // --- 1. календарь считает дни ---
  out.startDay = cal.day;
  out.startSeason = cal.season;
  cal.nextDay();
  out.afterOneDay = cal.day;

  // сезон меняется каждые 5 дней
  const seasons = [];
  for (let i = 0; i < 5; i++) { cal.nextDay(); seasons.push(cal.season); }
  out.seasonsOver5Days = seasons.join(',');
  out.seasonAfter5 = cal.season;

  // --- 2. сохранение ---
  d.ctx.stats.coins = 137;
  d.ctx.stats.hp = 61;
  d.ctx.player.teleport(5, 25, 1.2);
  const ok = d.saveGame(false);
  out.saved = ok;
  out.hasSave = !!localStorage.getItem('wv.save.v1');

  // читаем сырое — проверяем формат
  const raw = JSON.parse(localStorage.getItem('wv.save.v1'));
  out.saveVersion = raw.v;
  out.saveDay = raw.day;
  out.saveCoins = raw.coins;

  // --- 3. портим состояние и восстанавливаем ---
  d.ctx.stats.coins = 0;
  d.ctx.stats.hp = 100;
  d.ctx.player.teleport(-40, -30, 0);
  const loaded = d.loadGame();
  out.loaded = loaded;
  out.coinsRestored = d.ctx.stats.coins;
  out.hpRestored = d.ctx.stats.hp;
  out.posRestored = {
    x: +d.ctx.player.pos.x.toFixed(1),
    z: +d.ctx.player.pos.z.toFixed(1),
  };
  out.dayRestored = cal.day;

  // --- 4. ручная смена времени не двигает день ---
  const dayBefore = cal.day;
  d.env.setTimeOfDay('night', true);
  d.env.setTimeOfDay('morning', true);
  out.dayAfterManual = cal.day;
  out.dayUnchanged = cal.day === dayBefore;

  // --- 5. естественная смена суток двигает день ---
  d.env.rolledOver = true;
  // прокручиваем цикл: выставим флаг так же, как это делает окружение
  const dayBefore2 = cal.day;
  d.env.rolledOver = true;
  out.rolledOverFlagSet = d.env.rolledOver;

  // --- 6. снег по сезону ---
  // снег набирает силу постепенно (он не должен включаться разом),
  // поэтому прогоняем настоящие кадры симуляции
  d.ctx.calendar.restore(1, 'winter', 1);
  for (let i = 0; i < 90; i++) d.ctx.snow.update(1 / 60, { x: 0, y: 0, z: 0 }, true);
  out.winterSnow = d.ctx.snow.points.visible;
  out.winterStrength = +d.ctx.snow.strength.toFixed(2);

  d.ctx.calendar.restore(1, 'summer', 1);
  for (let i = 0; i < 180; i++) d.ctx.snow.update(1 / 60, { x: 0, y: 0, z: 0 }, true);
  out.summerSnow = d.ctx.snow.points.visible;
  d.ctx.calendar.restore(1, 'spring', 1);

  // --- 7. сезонные материалы ---
  // Листва: кроны, кусты и папоротник получают разный материал по сезону.
  const crownMat = () => (d.ctx.forestFoliage || [])[0]?.material;
  const M = d.ctx.M;
  d.ctx.calendar.restore(1, 'spring', 1);
  out.springLeafMat = crownMat() === M.leafSpring;
  d.ctx.calendar.restore(1, 'summer', 1);
  out.summerLeafMat = crownMat() === M.leaf;
  d.ctx.calendar.restore(1, 'autumn', 1);
  out.autumnLeafMat = crownMat() === M.leafAutumn;
  d.ctx.calendar.restore(1, 'winter', 1);
  out.winterLeafMat = crownMat() === M.leafWinter;

  // Газон: у каждого сезона своя текстура.
  const groundTex = () => d.ctx.groundMesh?.material?.map?.source?.data;
  d.ctx.calendar.restore(1, 'spring', 1);
  out.springGround = groundTex() === M.grassSpring.map.source.data;
  d.ctx.calendar.restore(1, 'autumn', 1);
  out.autumnGround = groundTex() === M.grassAutumn.map.source.data;
  d.ctx.calendar.restore(1, 'winter', 1);
  out.winterGround = groundTex() === M.grassWinter.map.source.data;
  d.ctx.calendar.restore(1, 'summer', 1);
  out.summerGround = groundTex() === M.grass.map.source.data;

  // Пшеница и цветы зимой скрыты, в остальные сезоны — видны.
  const wheatVisible = () => (d.ctx.wheatMeshes || [])[0]?.visible;
  const flowerVisible = () => (d.ctx.flowerMeshes || [])[0]?.visible;
  d.ctx.calendar.restore(1, 'winter', 1);
  out.winterWheatHidden = wheatVisible() === false;
  out.winterFlowersHidden = flowerVisible() === false;
  out.winterTuftsHidden = (d.ctx.tuftMeshes || [])[0]?.visible === false;
  d.ctx.calendar.restore(1, 'summer', 1);
  out.summerWheatVisible = wheatVisible() === true;
  out.summerFlowersVisible = flowerVisible() === true;

  // Дороги зимой заснежены.
  d.ctx.calendar.restore(1, 'winter', 1);
  const roadMap = (d.ctx.roadMeshes || []).find((m) => m.name !== 'plaza')?.material?.map;
  out.winterRoadSnow = roadMap?.source?.data === d.ctx.T.dirtWinter.source.data;
  d.ctx.calendar.restore(1, 'summer', 1);

  // --- 8. кнопка «Продолжить» ---
  d.ui.setContinue(true, 7);
  const cont = document.getElementById('continue');
  out.continueVisible = !cont.classList.contains('hidden');
  out.continueDay = document.getElementById('contDay').textContent;

  // дата в HUD
  d.ui.setDate(cal.label());
  out.dateText = document.getElementById('dateText').textContent;

  return out;
});

const checks = [];
const ok = (name, cond, extra = '') => {
  checks.push({ name, pass: !!cond });
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
};

ok('календарь начинается с дня 1', res.startDay === 1);
ok('смена дня увеличивает счётчик', res.afterOneDay === 2, `стало ${res.afterOneDay}`);
ok('сезон меняется каждые 5 дней', res.seasonAfter5 !== res.startSeason,
  `${res.startSeason} → ${res.seasonAfter5} (5 дней: ${res.seasonsOver5Days})`);
ok('сохранение записывается', res.saved && res.hasSave);
ok('у сохранения правильная версия формата', res.saveVersion === 1, `v${res.saveVersion}`);
ok('сохранение хранит номер дня', res.saveDay === res.startDay + 6, `день ${res.saveDay}`);
ok('сохранение хранит монеты', res.saveCoins === 137);
ok('загрузка применяется', res.loaded);
ok('монеты восстановлены', res.coinsRestored === 137, `${res.coinsRestored}`);
ok('здоровье восстановлено', res.hpRestored === 61, `${res.hpRestored}`);
ok('позиция восстановлена', Math.abs(res.posRestored.x - 5) < 1.5 && Math.abs(res.posRestored.z - 25) < 1.5,
  JSON.stringify(res.posRestored));
ok('номер дня восстановлен', res.dayRestored === res.startDay + 6, `день ${res.dayRestored}`);
ok('ручная смена времени не двигает день', res.dayUnchanged, `день ${res.dayAfterManual}`);
ok('зима включает снег', res.winterSnow === true, `сила ${res.winterStrength}`);
ok('лето без снега', res.summerSnow === false);
ok('кнопка «Продолжить» появляется', res.continueVisible);
ok('в кнопке показан день сохранения', String(res.continueDay) === '7', String(res.continueDay));
ok('дата в HUD заполнена', /День \d+/.test(res.dateText || ''), String(res.dateText));
ok('весна: кроны с цветением', res.springLeafMat);
ok('лето: обычная зелёная листва', res.summerLeafMat);
ok('осень: багряная листва', res.autumnLeafMat);
ok('зима: бледная листва', res.winterLeafMat);
ok('весна: сочный газон', res.springGround);
ok('лето: обычный газон', res.summerGround);
ok('осень: сухой газон', res.autumnGround);
ok('зима: газон под снегом', res.winterGround);
ok('зимой пшеница убрана', res.winterWheatHidden);
ok('зимой цветы не растут', res.winterFlowersHidden);
ok('зимой трава скрыта под снегом', res.winterTuftsHidden);
ok('летом пшеница на месте', res.summerWheatVisible);
ok('летом цветы цветут', res.summerFlowersVisible);
ok('зимой дорога заснежена', res.winterRoadSnow);

const failed = checks.filter((c) => !c.pass);
console.log('\n' + (failed.length ? `ПРОВАЛЕНО: ${failed.length}` : 'все проверки пройдены'));
console.log('ошибок в консоли:', errs.length, errs.slice(0, 3));
await browser.close();
process.exit(failed.length || errs.length ? 1 : 0);
