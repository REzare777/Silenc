/**
 * Раунд 60: объективная проверка звучания.
 *
 * Генератор рендерится в OfflineAudioContext — можно измерить то, что
 * слышно: громкость, пики, сколько музыкальных событий, есть ли паузы
 * и не захлёбывается ли сигнал.
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
const page = await browser.newPage({ viewport: { width: 700, height: 440 } });
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:4205/?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

/* ---------- рендер восьми секунд музыки офлайн ---------- */
const audio = await page.evaluate(async () => {
  const Music = window.__dbg.music.constructor;
  const ctx = new OfflineAudioContext(2, 44100 * 8, 44100);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  const m = new Music();
  m.attach({ ctx, master });
  m.setMood('village');
  m.setVolume(0.7);
  // планируем всю длительность
  let t = 0;
  const stepDur = (60 / m.bpm) / 2;
  while (t < 8) {
    m.scheduleStep(t, stepDur);
    t += stepDur;
  }
  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);

  // общая энергия и пик
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    sum += v * v;
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sum / d.length);

  // окна по 50 мс: считаем, сколько раз энергия заметно меняется
  // (каждая нота — это всплеск, а не сплошной гул)
  const win = Math.floor(44100 * 0.05);
  const windows = [];
  for (let i = 0; i + win < d.length; i += win) {
    let s = 0;
    for (let k = i; k < i + win; k++) s += d[k] * d[k];
    windows.push(Math.sqrt(s / win));
  }
  const sorted = [...windows].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  // «события» — окна, где энергия заметно выше медианы
  const events = windows.filter((w) => w > median * 1.8).length;

  // доля окнов выше порога тишины: музыка не должна быть «рваной» наглухо
  const silence = windows.filter((w) => w < Math.max(1e-5, median * 0.12)).length;

  return {
    rms,
    peak,
    median,
    p90,
    events,
    silenceRatio: silence / windows.length,
    windows: windows.length,
    samples: d.length,
  };
});

check('З: музыка не тишина', audio.rms > 0.002, `rms=${audio.rms}`);
check('З: музыка не захлёбывается', audio.peak < 1.0, `peak=${audio.peak}`);
check('З: есть запас по громкости', audio.peak > 0.05, `peak=${audio.peak}`);
check('З: сигнал живой, а не ровный гул',
  audio.p90 / Math.max(1e-6, audio.median) > 1.4, `p90/median=${(audio.p90 / audio.median).toFixed(2)}`);
check('З: музыка не рассыпается на отдельные пики',
  audio.events > 8 && audio.events < audio.windows * 0.7,
  `событий=${audio.events} из ${audio.windows}`);
check('З: нет длинных провалов тишины', audio.silenceRatio < 0.55,
  `тишина=${(audio.silenceRatio * 100).toFixed(0)}%`);

/* ---------- другой характер: подземелье должно быть глуше и тише ---------- */
const dark = await page.evaluate(async () => {
  const Music = window.__dbg.music.constructor;
  const out = {};
  for (const mood of ['village', 'dungeon', 'tavern']) {
    const ctx = new OfflineAudioContext(2, 44100 * 6, 44100);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const m = new Music();
    m.attach({ ctx, master });
    m.setMood(mood);
    m.setVolume(0.7);
    let t = 0;
    const stepDur = (60 / m.bpm) / 2;
    while (t < 6) {
      m.scheduleStep(t, stepDur);
      t += stepDur;
    }
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
    out[mood] = Math.sqrt(sum / d.length);
  }
  return out;
});
check('З: в подземелье музыка тише, чем в деревне',
  dark.dungeon < dark.village, JSON.stringify(dark));
check('З: в таверне музыка громче, чем в подземелье',
  dark.tavern > dark.dungeon, JSON.stringify(dark));

check('нет ошибок в консоли', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\nr60_music_audio: ${ok} ok, ${fail} fail`);
if (fail) {
  console.log('не прошли:', failed.join(', '));
  process.exit(1);
}
