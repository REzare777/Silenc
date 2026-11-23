/**
 * Раунд 60: выгрузка сэмплов музыки в WAV.
 *
 * Генератор рендерится офлайн (OfflineAudioContext) — получаются реальные
 * фрагменты звучания, которые можно послушать и оценить.
 *
 * Запуск: node dev/r60_music_wav.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/workspace/Шёпот-Долина-музыка';
const RATE = 32000;
const SECONDS = 16;

/** Что выгружаем: файл — настроение — сезон — ночь. */
const CLIPS = [
  ['01-деревня-день', 'village', 'spring', 0],
  ['02-деревня-ночь', 'village', 'autumn', 1],
  ['03-лес', 'forest', 'summer', 0],
  ['04-поля', 'fields', 'spring', 0],
  ['05-мельница', 'mill', 'summer', 0],
  ['06-таверна', 'tavern', 'autumn', 0],
  ['07-амбар', 'barn', 'winter', 0],
  ['08-храм', 'church', 'winter', 1],
  ['09-подземелье', 'dungeon', 'spring', 1],
  ['10-дом', 'home', 'spring', 0],
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 700, height: 440 } });
page.setDefaultTimeout(300000);
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`http://127.0.0.1:4205/?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

for (const [name, mood, season, night] of CLIPS) {
  const b64 = await page.evaluate(async ({ mood, season, night, seconds, rate }) => {
    const Music = window.__dbg.music.constructor;
    const ctx = new OfflineAudioContext(1, rate * seconds, rate);
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const m = new Music();
    m.attach({ ctx, master });
    m.setMood(mood);
    m.setSeason(season);
    m.setNight(night);
    m.setVolume(0.55);
    m.applyMood(0.01);
    // планируем всю длительность
    let t = 0;
    const stepDur = (60 / m.bpm) / 2;
    while (t < seconds) {
      m.scheduleStep(t, stepDur);
      t += stepDur;
    }
    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    // 16 бит PCM
    const bytes = new Uint8Array(d.length * 2);
    const dv = new DataView(bytes.buffer);
    for (let i = 0; i < d.length; i++) {
      const v = Math.max(-1, Math.min(1, d[i]));
      dv.setInt16(i * 2, v * 32000, true);
    }
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }, { mood, season, night, seconds: SECONDS, rate: RATE });

  const raw = Buffer.from(b64, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + raw.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(raw.length, 40);
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, Buffer.concat([header, raw]));
  console.log('сэмпл:', path.basename(file), `${(raw.length / 1024 / 1024).toFixed(2)} МБ`);
}

await browser.close();
console.log('готово:', OUT);
