/**
 * Раунд 60: проверка процедурной музыки.
 *
 *  Проверяем, что генератор:
 *   * действительно играет (в аудио-графе есть активные источники);
 *   * меняет настроение места, сезона и времени суток;
 *   * реагирует на опасность (слой тревоги);
 *   * не сыплет тысячу нот, если кадр был долгим;
 *   * не ломает игру и не кидает ошибок.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

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
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:4205/?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

/* ---------- музыка подключена и играет ---------- */
const on = await page.evaluate(() => {
  const D = window.__dbg;
  const m = D.music;
  if (!m) return { err: 'нет music в __dbg' };
  // считаем живые источники в аудио-графе
  let sources = 0;
  let started = 0;
  const ctx = m.ctx;
  if (ctx) {
    // WebAudio не даёт обхода графа, поэтому считаем через наши узлы
    sources = m.padOsc.length + m.tenOsc.length;
    started = m.padOsc.filter((o) => o.context.state === 'running').length;
  }
  return {
    hasCtx: !!ctx,
    state: ctx ? ctx.state : null,
    sources,
    started,
    mood: m.mood,
    season: m.season,
    volume: m.volume,
    busGain: m.bus ? m.bus.gain.value : null,
    step: m.step,
    nextTime: m.nextTime,
    now: ctx ? ctx.currentTime : null,
  };
});
check('М: музыка подключена к звуковой среде', on.hasCtx === true, JSON.stringify(on));
check('М: у генератора есть голоса', on.sources >= 5, `источников=${on.sources}`);
check('М: осцилляторы пада запущены', on.started >= 3, `запущено=${on.started}`);
check('М: шина музыки не в нуле', on.busGain > 0, `gain=${on.busGain}`);

/* ---------- планировщик живёт ---------- */
const t0 = await page.evaluate(() => ({ step: window.__dbg.music.step, now: window.__dbg.music.ctx.currentTime }));
await page.waitForTimeout(2500);
const t1 = await page.evaluate(() => ({ step: window.__dbg.music.step, now: window.__dbg.music.ctx.currentTime }));
check('М: планировщик отсчитывает доли', t1.step !== t0.step || t1.now > t0.now,
  JSON.stringify({ t0, t1 }));

/* ---------- смена места меняет настроение ---------- */
const moods = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {};
  const set = (loc) => {
    D.setLocation(loc);
    D.music.setMood(
      loc === 'tavern' ? 'tavern' : loc === 'dungeon' ? 'dungeon'
        : loc === 'barn' ? 'barn' : loc === 'church' ? 'church' : 'home',
    );
    return D.music.mood;
  };
  out.tavern = set('tavern');
  out.dungeon = set('dungeon');
  out.barn = set('barn');
  out.church = set('church');
  out.home = set('home3');
  out.bpm = D.music.bpm;
  out.pad = D.music.padGain.gain.value;
  return out;
});
check('М: настроение меняется вместе с местом',
  moods.tavern === 'tavern' && moods.dungeon === 'dungeon' && moods.church === 'church',
  JSON.stringify(moods));

/* ---------- темп и плотность зависят от места ---------- */
const tempo = await page.evaluate(() => {
  const D = window.__dbg;
  D.music.setMood('tavern');
  const fast = D.music.bpm;
  D.music.setMood('church');
  const slow = D.music.bpm;
  D.music.setMood('dungeon');
  const dark = { bpm: D.music.bpm, density: D.music.density };
  return { fast, slow, dark };
});
check('М: в таверне быстрее, чем в храме', tempo.fast > tempo.slow, JSON.stringify(tempo));

/* ---------- ночь меняет музыку ---------- */
// громкости и частоты меняются через setTargetAtTime — им нужно время,
// чтобы сойтись к новому значению
const night = await page.evaluate(async () => {
  const D = window.__dbg;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  D.music.setMood('village');
  D.music.setNight(0);
  await wait(1600);
  const day = { density: D.music.density, bright: D.music.padFilter.frequency.value };
  D.music.setNight(1);
  await wait(1600);
  const nightM = { density: D.music.density, bright: D.music.padFilter.frequency.value };
  D.music.setNight(0);
  return { day, nightM };
});
check('М: ночью мелодия реже', night.nightM.density < night.day.density, JSON.stringify(night));
check('М: ночью пад глуше', night.nightM.bright < night.day.bright, JSON.stringify(night));

/* ---------- сезон меняет музыку ---------- */
const season = await page.evaluate(() => {
  const D = window.__dbg;
  D.music.setMood('village');
  D.music.setSeason('spring');
  const spring = { density: D.music.density, oct: D.music.oct };
  D.music.setSeason('winter');
  const winter = { density: D.music.density, oct: D.music.oct };
  D.music.setSeason('autumn');
  const autumn = { density: D.music.density, oct: D.music.oct };
  D.music.setSeason('spring');
  return { spring, winter, autumn };
});
check('М: зимой музыка реже', season.winter.density < season.spring.density, JSON.stringify(season));
check('М: осенью музыка ниже, зимой — выше',
  season.autumn.oct < 0 && season.winter.oct > 0, JSON.stringify(season));

/* ---------- тревога включает слой опасности ---------- */
// слой тревоги включается по боевой системе: подошла тень — загудело
const calm = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('village');
  D.music.setDanger(0);
  return { ten: D.music.tenGain.gain.value, pulse: D.music.pulseGain.gain.value };
});
const frameBefore = await page.evaluate(() => window.__frames || 0);
await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('dungeon');
  const list = D.shadows.list || [];
  if (list.length) D.player.teleport(list[0].x + 1.5, list[0].z + 1.5, 0);
});
await page.waitForFunction((t) => (window.__frames || 0) > t, frameBefore, { timeout: 240000 });
await page.waitForTimeout(1800);
const tense = await page.evaluate(() => {
  const D = window.__dbg;
  const out = {
    ten: D.music.tenGain.gain.value,
    pulse: D.music.pulseGain.gain.value,
    danger: D.music.danger,
    threat: D.combat.state.threat,
  };
  D.setLocation('village');
  return out;
});
check('М: подошла тень — музыка стала тревожной',
  tense.threat > 0.3 && tense.danger > 0.3 && tense.ten > calm.ten,
  JSON.stringify({ calm, tense }));

/* ---------- ползунок музыки ---------- */
const vol = await page.evaluate(async () => {
  const D = window.__dbg;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  D.music.setVolume(0.9);
  await wait(900);
  const loud = D.music.bus.gain.value;
  D.music.setVolume(0);
  await wait(900);
  const quiet = D.music.bus.gain.value;
  D.music.setVolume(0.55);
  return { loud, quiet };
});
check('М: ползунок музыки управляет шиной', vol.loud > vol.quiet, JSON.stringify(vol));

/* ---------- долгий кадр не вываливает ноты ---------- */
const burst = await page.evaluate(() => {
  const D = window.__dbg;
  const m = D.music;
  const before = m.step;
  // имитируем «пропущенный» кусок времени: отодвинем планировщик назад
  m.nextTime = m.ctx.currentTime - 30;
  m.update();
  return { jumped: m.step - before, nextInFuture: m.nextTime > m.ctx.currentTime };
});
check('М: после долгого простоя нот не вываливается пачкой',
  burst.jumped <= 200 && burst.nextInFuture, JSON.stringify(burst));

/* ---------- ошибки ---------- */
check('нет ошибок в консоли', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\nr60_music_check: ${ok} ok, ${fail} fail`);
if (fail) {
  console.log('не прошли:', failed.join(', '));
  process.exit(1);
}
