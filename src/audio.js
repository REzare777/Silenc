/* ------------------------------------------------------------------ *
 *  Процедурная звуковая среда (WebAudio, без внешних файлов)
 * ------------------------------------------------------------------ */

export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.master = null;
    this.nodes = {};
    this.nextBird = 2;
    this.nextCricket = 0;
    this.nextCrackle = 0;
    this.night = 0;
    this.forgeGain = 0;
    /** Громкость 0…1 (ползунок в настройках) */
    this.volume = 0.8;
    /** Звук выключен тумблером */
    this.muted = false;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    this.master = master;

    // мягкий фон-пампинг
    const pad = ctx.createGain();
    pad.gain.value = 0.05;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 620;
    padFilter.Q.value = 0.6;
    pad.connect(padFilter).connect(master);
    const freqs = [110, 164.81, 220, 246.94];
    this.padOsc = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 5;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      o.connect(g).connect(pad);
      o.start();
      return o;
    });
    this.pad = pad;

    // ветер — шум через полосовой фильтр с медленным LFO
    const noiseBuf = this.noiseBuffer(3);
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.031;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 0.035;
    lfo2.connect(lfo2Gain).connect(windGain.gain);
    lfo2.start();

    this.wind = windGain;
    this.nodes.noiseBuf = noiseBuf;

    // гул костра / горна
    const fire = ctx.createBufferSource();
    fire.buffer = noiseBuf; fire.loop = true;
    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 900;
    fireFilter.Q.value = 0.9;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    fire.connect(fireFilter).connect(fireGain).connect(master);
    fire.start();
    this.fire = fireGain;

    this.enabled = true;
    master.gain.setTargetAtTime(this.targetGain(), ctx.currentTime, 1.2);
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  /** Итоговая громкость мастер-канала: 0, если звук выключен. */
  targetGain() {
    return this.muted ? 0 : Math.max(0, Math.min(1, this.volume)) * 0.9;
  }

  /** Уровень громкости 0…1 — из ползунка в настройках. */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this.applyGain();
  }

  /** Тумблер звука: вкл/выкл. Уровень громкости при этом сохраняется. */
  setMuted(m) {
    this.muted = !!m;
    this.applyGain();
  }

  applyGain() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.12);
  }

  /** Птицы днём, кузнечики ночью, потрескивание огня рядом. */
  update(dt, night, forgeDist, fireDist) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.night = night;

    // ветер сильнее в ночи и на возвышенностях
    this.wind.gain.setTargetAtTime(0.035 + night * 0.05, t, 1.5);

    // треск костра
    const near = Math.min(1, Math.max(0, 1 - fireDist / 16));
    this.fire.gain.setTargetAtTime(near * 0.14, t, 0.4);
    this.nextCrackle -= dt;
    if (this.nextCrackle <= 0) {
      this.nextCrackle = 0.12 + Math.random() * 0.5;
      if (near > 0.05) this.crackle(near);
    }

    // птицы
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 1.4 + Math.random() * 5;
      if (night < 0.55) this.chirp(0.9 - night);
    }

    // кузнечики
    if (night > 0.4) {
      this.nextCricket -= dt;
      if (this.nextCricket <= 0) {
        this.nextCricket = 0.12 + Math.random() * 0.25;
        this.cricket(0.4 + night * 0.6);
      }
    }
  }

  chirp(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 1.2;
      const start = t + i * (0.07 + Math.random() * 0.08);
      const f0 = 2100 + Math.random() * 1800;
      o.frequency.setValueAtTime(f0, start);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.6), start + 0.09);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.035 * vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      o.connect(g).connect(pan).connect(this.master);
      o.start(start); o.stop(start + 0.14);
    }
  }

  cricket(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 4200 + Math.random() * 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.010 * vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }

  crackle(vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500 + Math.random() * 2200;
    f.Q.value = 2.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * vol * (0.4 + Math.random()), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.09);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.2);
  }

  /** Лёгкий прыжок: короткий восходящий «whoosh». */
  jump() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.16);
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.25);
  }

  /** Мягкое приземление. */
  land() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.18);
  }

  step(run) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320 + Math.random() * 260;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(run ? 0.075 : 0.045, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.16);
  }

  /** Плеск воды: «блюп» плюс шум всплеска. */
  splash(big = false) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(big ? 520 : 780, t);
    o.frequency.exponentialRampToValueAtTime(big ? 120 : 230, t + 0.16);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(big ? 0.1 : 0.07, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 0.26);
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.22);
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(big ? 0.075 : 0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.42);
  }

  /** Лай пса: резкий шумовой «удар» + падающий по формантам тон. */
  bark(vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085 * vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    g.connect(this.master);

    // рычащий «孰» — пила со скольжением вниз
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f0 = 300 + Math.random() * 90;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.42, t + 0.18);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(780, t);
    bp.frequency.exponentialRampToValueAtTime(430, t + 0.2);
    bp.Q.value = 2.4;
    o.connect(bp).connect(g);
    o.start(t); o.stop(t + 0.26);

    // шумовой «хап» на вдохе
    const src = ctx.createBufferSource();
    src.buffer = this.nodes.noiseBuf;
    src.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1500 + Math.random() * 700;
    nf.Q.value = 1.3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(nf).connect(ng).connect(this.master);
    src.start(t); src.stop(t + 0.12);
  }

  /** Мяуканье кота: «мя» с нарастанием и затуханием + гортанный призвук. */
  meow(vol = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    const base = 520 + Math.random() * 110;
    o.frequency.setValueAtTime(base * 0.72, t);
    o.frequency.exponentialRampToValueAtTime(base * 1.22, t + 0.13);
    o.frequency.exponentialRampToValueAtTime(base * 0.66, t + 0.46);
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(base * 1.44, t);
    o2.frequency.exponentialRampToValueAtTime(base * 1.02, t + 0.34);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075 * vol, t + 0.09);
    g.gain.setValueAtTime(0.075 * vol, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    // «ми»-формат — два резонанса
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass'; f1.frequency.value = 950; f1.Q.value = 4.5;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass'; f2.frequency.value = 2450; f2.Q.value = 6.5;
    const lg = ctx.createGain(); lg.gain.value = 0.55;
    o.connect(f1).connect(g);
    o2.connect(f2).connect(lg).connect(g);
    g.connect(this.master);
    o.start(t); o.stop(t + 0.55);
    o2.start(t); o2.stop(t + 0.55);
  }

  /** Колокол церкви — редкий, но узнаваемый. */
  bell() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const partials = [1, 2.0, 2.76, 4.07, 5.43];
    const base = 196;
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = base * p;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1.4), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6 - i * 0.35);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + 4);
    });
  }
}
