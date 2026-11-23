/* ------------------------------------------------------------------ *
 *  Процедурная музыка «Шёпот-Долины»
 *
 *  Музыка не записана — она рождается прямо в игре: осцилляторы, фильтры
 *  и математика. У каждого места свой характер (дерево, таверна, храм,
 *  подземелье), у каждого времени суток и сезона — своя окраска, а когда
 *  из темноты подступает тень, музыка сама становится тревожнее.
 *
 *  Почему генератор, а не запись:
 *   * бесконечно, без повторов и без «хвоста» из пяти минут;
 *   * музыка всегда подходит к тому, что происходит вокруг;
 *   * и — главное — никаких чужих прав: в игре не звучит ни одной
 *     записи, поэтому её можно продавать, не делясь с правообладателем.
 *
 *  Как это устроено:
 *   * ПАД — три расстроенных осциллятора, медленное дыхание фильтра;
 *   * БАС — синус на корне аккорда, длинные ноты;
 *   * МЕЛОДИЯ — случайное блуждание по гамме, фразы по 8–16 долей;
 *   * ПЕРКУССИЯ — мягкий бубен и шейкер, только в «живых» местах;
 *   * КОЛОКОЛ — стеклянный обертон в храме;
 *   * ТРЕВОГА — низкий тритон и пульс, когда рядом тень.
 *
 *  Модуль ничего не знает про игру: он получает настроение настроек и
 *  сам решает, что играть.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Лады
 * ------------------------------------------------------------------ */

/** Лады в полутонах от корня. */
const SCALES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  majPent: [0, 2, 4, 7, 9],
  minPent: [0, 3, 5, 7, 10],
};

/* ------------------------------------------------------------------ *
 *  Настроения места
 * ------------------------------------------------------------------ */

/**
 * Характер места.
 *
 *  root      — корневая нота (Гц);
 *  scale     — лад;
 *  chords    — аккорды как ступени лада (индексы в SCALES[...]);
 *  bpm       — темп;
 *  density   — насколько часто звучит мелодия (0…1);
 *  phrase    — длина фразы в долях;
 *  timbre    — тембр мелодии: 'flute' | 'fiddle' | 'bell' | 'harp';
 *  pad       — громкость пада;
 *  bass      — громкость баса;
 *  perc      — громкость перкуссии;
 *  reverb    — сколько уходит в реверберацию;
 *  bell      — колокол каждые N долей (0 — не звучит);
 */
const MOODS = {
  village: {
    root: 146.83, scale: 'dorian', chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]],
    bpm: 74, density: 0.4, phrase: 16, timbre: 'flute',
    pad: 0.10, bass: 0.085, perc: 0.32, reverb: 0.20,
  },
  forest: {
    root: 174.61, scale: 'majPent', chords: [[0, 2, 4], [3, 0, 2], [4, 1, 3], [2, 4, 0]],
    bpm: 60, density: 0.24, phrase: 12, timbre: 'flute',
    pad: 0.09, bass: 0.06, perc: 0.0, reverb: 0.34,
  },
  fields: {
    root: 196.00, scale: 'lydian', chords: [[0, 2, 4], [4, 1, 3], [5, 2, 4], [3, 0, 2]],
    bpm: 66, density: 0.3, phrase: 12, timbre: 'flute',
    pad: 0.11, bass: 0.07, perc: 0.12, reverb: 0.30,
  },
  tavern: {
    root: 164.81, scale: 'mixolydian', chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]],
    bpm: 104, density: 0.52, phrase: 16, timbre: 'fiddle',
    pad: 0.07, bass: 0.11, perc: 0.5, reverb: 0.16,
  },
  barn: {
    root: 130.81, scale: 'mixolydian', chords: [[0, 2, 4], [3, 5, 0], [4, 6, 1], [0, 2, 4]],
    bpm: 58, density: 0.18, phrase: 12, timbre: 'harp',
    pad: 0.10, bass: 0.075, perc: 0.0, reverb: 0.26,
  },
  church: {
    root: 130.81, scale: 'aeolian', chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]],
    bpm: 50, density: 0.14, phrase: 16, timbre: 'bell',
    pad: 0.15, bass: 0.09, perc: 0.0, reverb: 0.42, bell: 8,
  },
  dungeon: {
    root: 110.00, scale: 'phrygian', chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 1]],
    bpm: 56, density: 0.16, phrase: 12, timbre: 'harp',
    pad: 0.12, bass: 0.11, perc: 0.0, reverb: 0.46,
  },
  home: {
    root: 155.56, scale: 'majPent', chords: [[0, 2, 4], [3, 0, 2], [4, 1, 3], [0, 2, 4]],
    bpm: 54, density: 0.2, phrase: 8, timbre: 'harp',
    pad: 0.08, bass: 0.06, perc: 0.0, reverb: 0.22,
  },
  mill: {
    root: 146.83, scale: 'dorian', chords: [[0, 2, 4], [3, 5, 0], [5, 0, 2], [0, 2, 4]],
    bpm: 90, density: 0.34, phrase: 12, timbre: 'fiddle',
    pad: 0.08, bass: 0.1, perc: 0.4, reverb: 0.18,
  },
};

/* ------------------------------------------------------------------ *
 *  Сезоны
 * ------------------------------------------------------------------ */

/**
 * Как сезон меняет музыку.
 *
 *  density — во сколько раз реже звучит мелодия;
 *  oct     — сдвиг октавы (−1 ниже, +1 выше);
 *  bright  — во сколько раз открывается фильтр пада;
 *  scale   — лад, если сезон требует свой.
 */
const SEASONS = {
  spring: { density: 1.15, oct: 0, bright: 1.25, scale: null },
  summer: { density: 1.0, oct: 0, bright: 1.0, scale: null },
  autumn: { density: 0.85, oct: -1, bright: 0.75, scale: 'aeolian' },
  winter: { density: 0.55, oct: 1, bright: 1.5, scale: 'minPent' },
};

/**
 * Ночь: реже, ниже, тише.
 *
 * @param {number} n 0 — день, 1 — ночь
 * @returns {object} поправки
 */
function nightMix(n) {
  return {
    density: 1 - n * 0.55,
    oct: n > 0.5 ? -1 : 0,
    bright: 1 - n * 0.45,
    perc: 1 - n * 0.6,
  };
}

/* ------------------------------------------------------------------ *
 *  Инструменты
 * ------------------------------------------------------------------ */

/**
 * Частота MIDI-ноты в герцах.
 *
 * @param {number} midi номер ноты (69 = ля 440 Гц)
 * @returns {number} частота
 */
function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Плавная случайная величина: базовый плюс разброс.
 *
 * @param {number} base база
 * @param {number} spread разброс
 * @returns {number}
 */
function jitter(base, spread) {
  return base + (Math.random() * 2 - 1) * spread;
}

/* ------------------------------------------------------------------ *
 *  Музыка
 * ------------------------------------------------------------------ */

/**
 * Генератор музыки.
 *
 * @module music
 */
export class Music {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    /** Уровень музыки (0…1) — свой ползунок в настройках. */
    this.volume = 0.55;
    this.muted = false;

    /** Настроение места. */
    this.mood = 'village';
    /** Сезон. */
    this.season = 'spring';
    /** Ночь 0…1. */
    this.night = 0;
    /** Тревога 0…1 (рядом тень). */
    this.danger = 0;

    /** Номер доли в фразе. */
    this.step = 0;
    /** Время следующей доли (в аудио-часах). */
    this.nextTime = 0;
    /** Номер аккорда. */
    this.chordIdx = 0;
    /** Текущая мелодическая фраза: индексы ступеней или null (пауза). */
    this.phrase = [];
    /** Индекс ступени в ладу, от которого идёт блуждание. */
    this.melIdx = 2;
  }

  /* ---------------- построение графа ---------------- */

  /**
   * Подключиться к звуковой среде игры.
   *
   * @param {object} ambience звуковая среда (даёт ctx и мастер-канал)
   */
  attach(ambience) {
    if (this.ctx || !ambience || !ambience.ctx) return;
    const ctx = ambience.ctx;
    this.ctx = ctx;
    this.master = ambience.master;

    // шина музыки: своя громкость, общий тумблер звука
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);
    this.bus = bus;

    // реверберация: своя «комната» из затухающего шума
    const conv = ctx.createConvolver();
    conv.buffer = this.impulse(2.6, 2.4);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.9;
    conv.connect(revGain).connect(bus);
    this.reverb = conv;

    // посыл на реверберацию
    const send = ctx.createGain();
    send.gain.value = 0.2;
    send.connect(conv);
    this.send = send;

    /* --- пад: три расстроенных голоса, дышащий фильтр --- */
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.Q.value = 0.8;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    padFilter.connect(padGain).connect(bus);
    this.padFilter = padFilter;
    this.padGain = padGain;
    this.padOsc = [0, 1, 2].map((i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = 220;
      o.detune.value = (i - 1) * 7;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.24 : 0.16;
      o.connect(g).connect(padFilter);
      o.start();
      return o;
    });

    /* --- слой тревоги: низкий тритон, просыпается у тени --- */
    const tenFilter = ctx.createBiquadFilter();
    tenFilter.type = 'lowpass';
    tenFilter.frequency.value = 420;
    const tenGain = ctx.createGain();
    tenGain.gain.value = 0;
    tenFilter.connect(tenGain).connect(bus);
    this.tenFilter = tenFilter;
    this.tenGain = tenGain;
    this.tenOsc = [0, 1].map((i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o.detune.value = i ? 14 : -14;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      o.connect(g).connect(tenFilter);
      o.start();
      return o;
    });

    /* --- пульс тревоги: тихий бубен, который стучит у тени --- */
    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.value = 0;
    this.pulseGain.connect(bus);

    this.enabled = true;
    this.nextTime = ctx.currentTime + 0.2;
    this.applyMood(0.01);
  }

  /**
   * Импульсная характеристика для реверберации.
   *
   * @param {number} seconds длина хвоста
   * @param {number} decay скорость затухания
   * @returns {AudioBuffer}
   */
  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  /* ---------------- настройки ---------------- */

  /**
   * Место.
   *
   * @param {string} mood ключ MOODS
   */
  setMood(mood) {
    if (!MOODS[mood] || mood === this.mood) return;
    this.mood = mood;
    this.applyMood(1.6);
  }

  /**
   * Сезон.
   *
   * @param {string} season 'spring' | 'summer' | 'autumn' | 'winter'
   */
  setSeason(season) {
    if (!SEASONS[season] || season === this.season) return;
    this.season = season;
    this.applyMood(1.6);
  }

  /**
   * Ночь или день.
   *
   * @param {number} n 0 — день, 1 — ночь
   */
  setNight(n) {
    const v = Math.max(0, Math.min(1, Number(n) || 0));
    if (Math.abs(v - this.night) < 0.02) return;
    this.night = v;
    this.applyMood(1.2);
  }

  /**
   * Тревога: подступает тень.
   *
   * @param {number} d 0…1
   */
  setDanger(d) {
    const v = Math.max(0, Math.min(1, Number(d) || 0));
    if (Math.abs(v - this.danger) < 0.03) return;
    this.danger = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tenGain.gain.setTargetAtTime(v * 0.10, t, 0.6);
    this.pulseGain.gain.setTargetAtTime(v * 0.9, t, 0.6);
    this.tenFilter.frequency.setTargetAtTime(300 + v * 260, t, 0.8);
  }

  /**
   * Уровень музыки.
   *
   * @param {number} v 0…1
   */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this.applyGain();
  }

  /**
   * Тумблер: музыка выключается вместе со звуком.
   *
   * @param {boolean} m выключена ли
   */
  setMuted(m) {
    this.muted = !!m;
    this.applyGain();
  }

  applyGain() {
    if (!this.ctx || !this.bus) return;
    const v = this.muted ? 0 : this.volume;
    // ползунок «Музыка» — это и есть громкость музыки: 100 % — музыка
    // слышна, но всё ещё тише звуков места
    this.bus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  /* ---------------- характер места и времени ---------------- */

  /**
   * Пересобрать характер под текущие место, сезон и время суток.
   *
   * @param {number} fade длительность перехода, с
   */
  applyMood(fade) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = MOODS[this.mood] || MOODS.village;
    const se = SEASONS[this.season] || SEASONS.spring;
    const ni = nightMix(this.night);

    const scale = SCALES[se.scale || m.scale] || SCALES.dorian;
    this.scale = scale;
    this.oct = se.oct + ni.oct;
    this.density = m.density * se.density * ni.density;
    this.percLevel = m.perc * ni.perc;

    // фильтр пада: сезон и время суток делают его шире или уже
    const bright = Math.max(0.35, Math.min(2, se.bright * ni.bright));
    this.padFilter.frequency.setTargetAtTime(620 * bright, t, fade);
    this.padGain.gain.setTargetAtTime(m.pad, t, fade);
    this.send.gain.setTargetAtTime(m.reverb, t, fade);

    // бас: ниже в сегодняшнем дне
    this.bassLevel = m.bass * (1 - this.night * 0.3);
    this.timbre = m.timbre;
    this.bpm = m.bpm * (1 - this.night * 0.08);
    this.phraseLen = m.phrase;

    this.applyChord(this.chordIdx, t, fade);
  }

  /**
   * Перевести пад на другой аккорд.
   *
   * @param {number} idx номер аккорда
   * @param {number} t время
   * @param {number} fade длительность перехода
   */
  applyChord(idx, t, fade) {
    const m = MOODS[this.mood] || MOODS.village;
    const chord = m.chords[idx % m.chords.length];
    const root = m.root;
    for (let i = 0; i < this.padOsc.length; i++) {
      const deg = chord[i % chord.length];
      const semi = this.scale[deg % this.scale.length] + 12 * Math.floor(deg / this.scale.length);
      const f = root * Math.pow(2, (semi + this.oct * 12) / 12);
      this.padOsc[i].frequency.setTargetAtTime(f, t, Math.max(0.2, fade));
    }
    this.chord = chord;
  }

  /* ---------------- планировщик ---------------- */

  /**
   * Каждый кадр: доиграть запланированное и запланировать новое.
   */
  update() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // если кадр был очень долгий (вкладка свёрнута, программный рендер) —
    // не вываливаем в аудио сразу полминуты нот, а пересинхронизируемся
    if (this.nextTime < now - 0.4) {
      const stepDur = (60 / this.bpm) / 2;
      const skip = Math.ceil((now - this.nextTime) / stepDur);
      this.nextTime += skip * stepDur;
      this.step = (this.step + skip) % (this.phraseLen * 2);
    }

    const stepDur = (60 / this.bpm) / 2;
    while (this.nextTime < now + 0.35) {
      this.scheduleStep(this.nextTime, stepDur);
      this.nextTime += stepDur;
    }
  }

  /**
   * Запланировать одну долю.
   *
   * @param {number} t время
   * @param {number} stepDur длительность доли, с
   */
  scheduleStep(t, stepDur) {
    const m = MOODS[this.mood] || MOODS.village;
    const inPhrase = this.step % (this.phraseLen * 2);

    // новая фраза и новый аккорд
    if (inPhrase === 0) {
      this.phrase = this.makePhrase(m.phraseLen * 2);
      this.chordIdx = (this.chordIdx + 1 + (Math.random() < 0.35 ? 1 : 0)) % m.chords.length;
      this.applyChord(this.chordIdx, t, 1.8);
    }

    // мелодия
    const note = this.phrase[inPhrase];
    if (note !== undefined && note !== null && Math.random() < this.density * 1.35) {
      this.playMelody(note, t);
    }

    // бас: на каждой сильной доле
    if (inPhrase % 4 === 0) {
      this.playBass(t, stepDur * 3.4);
    }

    // перкуссия
    if (this.percLevel > 0.01) {
      if (inPhrase % 8 === 0) this.playDrum(t, this.percLevel * 0.5);
      else if (inPhrase % 8 === 4) this.playDrum(t, this.percLevel * 0.28);
      if (inPhrase % 2 === 1 && Math.random() < 0.5) this.playShaker(t, this.percLevel * 0.16);
    }

    // колокол в храме
    if (m.bell && inPhrase % m.bell === 0) {
      this.playBell(t, this.chord ? this.chord[0] : 0);
    }

    // пульс тревоги
    if (this.danger > 0.05 && inPhrase % 4 === 0) {
      this.playDrum(t, this.danger * 0.35, 62);
    }

    this.step++;
  }

  /**
   * Новая мелодическая фраза: блуждание по ладу с аркой.
   *
   * @param {number} len длина фразы в долях
   * @returns {Array<number|null>} индексы ступеней (null — пауза)
   */
  makePhrase(len) {
    const m = MOODS[this.mood] || MOODS.village;
    const scaleLen = this.scale.length;
    const out = [];
    // опорные ступени: тоника, терция, квинта — мелодия не уходит дальше
    const anchors = [0, 2, 4];
    let idx = anchors[Math.floor(Math.random() * anchors.length)];
    const arch = Math.random() < 0.5 ? 1 : -1;   // вверх или вниз
    for (let i = 0; i < len; i++) {
      const pos = i / len;
      // арка: к середине фразы ступень поднимается (или опускается)
      const shape = Math.sin(pos * Math.PI) * arch;
      const r = Math.random();
      if (r < 0.16) {
        out.push(null);                     // пауза — музыка дышит
        continue;
      }
      const step = r < 0.42 ? -2 : r < 0.68 ? -1 : r < 0.82 ? 1 : 2;
      idx += step + Math.sign(shape) * (Math.random() < 0.3 ? 1 : 0);
      if (idx < 0) idx = 0;
      if (idx > scaleLen * 2 - 1) idx = scaleLen * 2 - 1;
      // иногда возвращаемся к опорной ступени
      if (Math.random() < 0.12) idx = anchors[Math.floor(Math.random() * anchors.length)];
      out.push(idx);
    }
    this.melIdx = idx;
    void m;
    return out;
  }

  /* ---------------- голоса ---------------- */

  /**
   * Нота аккорда в частоте.
   *
   * @param {number} deg ступень лада
   * @param {number} oct смещение октавы
   * @returns {number} частота
   */
  chordFreq(deg, oct = 0) {
    const scale = this.scale || SCALES.dorian;
    const semi = scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
    const root = (MOODS[this.mood] || MOODS.village).root;
    return root * Math.pow(2, (semi + oct * 12) / 12);
  }

  /**
   * Мелодическая нота.
   *
   * @param {number} idx ступень лада
   * @param {number} t время
   */
  playMelody(idx, t) {
    const scale = this.scale || SCALES.dorian;
    const deg = idx % scale.length;
    const oct = Math.floor(idx / scale.length) + 1 + this.oct;
    const f = this.chordFreq(idx, oct) * 2;
    const timbre = this.timbre || 'flute';
    if (timbre === 'bell') {
      this.bellVoice(f, t, 1.6, 0.10);
      return;
    }
    if (timbre === 'fiddle') {
      this.pluck(f, t, 0.42, 0.16, 'sawtooth', 2200);
      return;
    }
    if (timbre === 'harp') {
      this.pluck(f, t, 0.9, 0.14, 'triangle', 3000);
      return;
    }
    this.pluck(f, t, 0.6, 0.15, 'triangle', 2600);
  }

  /**
   * Щипковый голос: короткая нота с быстрым спадом.
   *
   * @param {number} f частота
   * @param {number} t время
   * @param {number} dur длительность
   * @param {number} gain громкость
   * @param {string} type тип осциллятора
   * @param {number} cutoff частота фильтра
   */
  pluck(f, t, dur, gain, type, cutoff) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = jitter(0, 7);
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(cutoff, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(220, cutoff * 0.35), t + dur);
    flt.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt).connect(g);
    g.connect(this.bus);
    const sendAmt = this.send ? this.send : null;
    if (sendAmt) {
      const s = ctx.createGain();
      s.gain.value = 0.5;
      g.connect(s).connect(sendAmt);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /**
   * Стеклянный обертон (колокол, храм).
   *
   * @param {number} f частота
   * @param {number} t время
   * @param {number} dur хвост
   * @param {number} gain громкость
   */
  bellVoice(f, t, dur, gain) {
    const ctx = this.ctx;
    const parts = [[1, 1], [2.76, 0.42], [5.4, 0.16]];
    for (const [mult, amp] of parts) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain * amp, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1 / mult + 0.35));
      o.connect(g).connect(this.bus);
      if (this.send) {
        const s = ctx.createGain();
        s.gain.value = 0.8;
        g.connect(s).connect(this.send);
      }
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }

  /**
   * Колокол места (храм).
   *
   * @param {number} t время
   * @param {number} deg ступень лада
   */
  playBell(t, deg) {
    const f = this.chordFreq(deg, 2) * 2;
    this.bellVoice(f, t, 3.2, 0.11);
  }

  /**
   * Бас.
   *
   * @param {number} t время
   * @param {number} dur длительность
   */
  playBass(t, dur) {
    const ctx = this.ctx;
    const deg = this.chord ? this.chord[0] : 0;
    const f = this.chordFreq(deg, -1);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(this.bassLevel, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.bus);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /**
   * Мягкий бубен.
   *
   * @param {number} t время
   * @param {number} gain громкость
   * @param {number} [f0] стартовая частота
   */
  playDrum(t, gain, f0 = 96) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.4);
  }

  /**
   * Шейкер: короткий шум.
   *
   * @param {number} t время
   * @param {number} gain громкость
   */
  playShaker(t, gain) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.value = Math.max(0.0002, gain);
    src.connect(flt).connect(g).connect(this.bus);
    src.start(t);
  }
}

/** Набор настроений — для проверок и подсказок. */
export const MUSIC_MOODS = MOODS;

/** Лады — для проверок. */
export const MUSIC_SCALES = SCALES;
