#!/usr/bin/env node
/**
 * ============================================================================
 *  ТРЕЙЛЕР ИГРЫ ИЗ НАСТОЯЩИХ КАДРОВ
 * ============================================================================
 *
 *  Собирает видео-трейлер «Шёпот-Долины» из кадров, снятых настоящей игрой
 *  (папка `shots/`), добавляет плавные переходы, подписи сцен и музыку —
 *  выгрузку той самой процедурной музыки игры (папка с .wav).
 *
 *  Как это устроено:
 *
 *   1. каждый кадр превращается в короткий отрывок с наездом камеры
 *      (Ken Burns) и подписью сцены;
 *   2. отрывки соединяются перекрёстными затуханиями (`xfade`);
 *   3. титры и финальная карточка делаются отдельными отрывками;
 *   4. музыка клеится из выгрузок игры перекрёстными затуханиями (`acrossfade`);
 *   5. всё сводится в один MP4 (H.264, без звука — звук добавится в п. 4).
 *
 *  Запуск: cd /workspace/village && node scripts/trailer.mjs
 *  Результат: `publish/Шёпот-Долина-трейлер.mp4`
 *
 *  @module scripts/trailer
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'shots');
const PUBLISH = path.join(ROOT, 'publish');
const WORK = path.join(ROOT, '.work', 'trailer');
const MUSIC = path.join(ROOT, '.work', 'music');

/** Размер кадра. */
const W = 1280;
const H = 720;
/** Кадров в секунду. */
const FPS = 25;
/** Длительность обычной сцены, сек. */
const SCENE = 4.0;
/** Длительность перехода между сценами, сек. */
const XFADE = 0.7;
/** Цвет букв заголовка. */
const GOLD = '0xE9C9A2';
/** Цвет основного текста. */
const INK = '0xD8C9B6';

/** Шрифты: DejaVu есть в системе и умеет кириллицу. */
const FONT_SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf';
const FONT_SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

/**
 * Сцены трейлера.
 *
 * `shot` — файл в shots/; `caption` — подпись внизу кадра;
 * `zoom` — как двигается камера: 'in' (наезд), 'out' (отъезд), 'drift'
 * (наезд с уходом вбок).
 */
const SCENES = [
  { shot: 'R8_north.png', caption: 'Деревня в долине', zoom: 'in' },
  { shot: 'G2_village.jpg', caption: 'Улица в сумерках', zoom: 'drift' },
  { shot: 'FINAL_night.jpg', caption: 'Ночью зажигаются фонари', zoom: 'in' },
  { shot: 'T4_tavern_bar.png', caption: 'Трактир «Уставший вепрь»', zoom: 'drift' },
  { shot: 'T2_tavern_hall.png', caption: 'Зал, стойка, очаг', zoom: 'in' },
  { shot: 'T3_tavern_fireplace.png', caption: 'У очага тепло даже зимой', zoom: 'in' },
  { shot: 'CAM_pier.png', caption: 'Озеро и причал', zoom: 'drift' },
  { shot: 'FIN_pond.png', caption: 'Тишина у воды', zoom: 'in' },
  { shot: 'D3_dog_follow.png', caption: 'Пёс с командами и прыжком', zoom: 'drift' },
  { shot: 'R64_dg_entry.jpg', caption: 'Подземелье в скале', zoom: 'in' },
  { shot: 'R64_dg_crystal.jpg', caption: 'Холодные кристаллы и туман', zoom: 'drift' },
  { shot: 'R64_dg_gates.jpg', caption: 'Зал Врат', zoom: 'in' },
  { shot: 'R64_dg_altar.jpg', caption: 'Алтарь и страж', zoom: 'in' },
  { shot: 'R66_smith_mark.jpg', caption: 'Дела: жёлтый «!» — новое дело', zoom: 'in' },
  { shot: 'R66_journal.jpg', caption: 'Журнал дел по клавише J', zoom: 'in' },
];

/** Музыка: выгрузки процедурной музыки самой игры. */
const MUSIC_TRACKS = [
  '01-деревня-день.wav',
  '02-деревня-ночь.wav',
  '06-таверна.wav',
  '08-храм.wav',
  '09-подземелье.wav',
];

/**
 * Выполнить команду ffmpeg.
 *
 * @param {string[]} args аргументы
 */
function ff(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

/**
 * Записать строку в файл — чтобы не мучиться с экранированием в командной строке.
 *
 * @param {string} file путь
 * @param {string} text содержимое
 */
function writeText(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

/**
 * Выражение наезда камеры для `zoompan`.
 *
 * @param {string} mode режим
 * @param {number} frames сколько кадров длится сцена
 * @returns {string} выражение
 */
function zoomExpr(mode, frames) {
  const step = (1.25 - 1) / frames;
  if (mode === 'out') {
    return {
      z: `if(lte(on,1),1.22,max(zoom-${step.toFixed(6)},1.02))`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
    };
  }
  if (mode === 'drift') {
    return {
      z: `min(zoom+${step.toFixed(6)},1.25)`,
      x: `(iw-iw/zoom)*(1-on/${frames})`,
      y: 'ih/2-(ih/zoom/2)',
    };
  }
  return {
    z: `min(zoom+${step.toFixed(6)},1.25)`,
    x: 'iw/2-(iw/zoom/2)',
    y: 'ih/2-(ih/zoom/2)',
  };
}

/**
 * Сделать сцену: наезд камеры + подпись.
 *
 * @param {object} scene сцена
 * @param {number} index номер
 * @returns {string} путь к готовому отрывку
 */
function makeScene(scene, index) {
  const src = path.join(SHOTS, scene.shot);
  if (!fs.existsSync(src)) throw new Error(`нет кадра: ${src}`);
  const out = path.join(WORK, `seg-${String(index).padStart(2, '0')}.mp4`);
  const frames = Math.round(SCENE * FPS);
  const { z, x, y } = zoomExpr(scene.zoom, frames);

  const caption = path.join(WORK, `cap-${index}.txt`);
  writeText(caption, scene.caption);

  const vf = [
    // кадры сняты в 5:3 — обрезаем по вертикали до 16:9, чтобы не тянуло
    'crop=iw:trunc(iw*9/16)',
    `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=${W}x${H}:fps=${FPS}`,
    'format=yuv420p',
  ].join(',');

  const filt = [
    `[0:v]${vf}[v]`,
    // подпись появляется после перехода и исчезает до следующего:
    // иначе две подписи накладываются друг на друга
    `[v]drawtext=fontfile=${FONT_SANS}:textfile='${caption}':fontsize=26:fontcolor=${INK}`
      + `:x=(w-text_w)/2:y=h-92:box=1:boxcolor=black@0.42:boxborderw=14`
      + `:enable='between(t,0.7,${(SCENE - 0.7).toFixed(2)})'[v2]`,
  ].join(';');

  ff(['-i', src, '-vf', filt, '-frames:v', String(frames), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', out]);
  return out;
}

/**
 * Титульная карточка: название и подзаголовок на тёмном фоне.
 *
 * @param {number} frames сколько кадров
 * @returns {string} путь к отрывку
 */
function makeTitle(frames) {
  const out = path.join(WORK, 'seg-00.mp4');
  const title = path.join(WORK, 'title.txt');
  const sub = path.join(WORK, 'subtitle.txt');
  writeText(title, 'ШЁПОТ-ДОЛИНА');
  writeText(sub, 'средневековая деревня в браузере');

  const filt = [
    `[0:v]drawtext=fontfile=${FONT_SERIF}:textfile='${title}':fontsize=96:fontcolor=${GOLD}`
      + `:x=(w-text_w)/2:y=(h-text_h)/2-40:shadowcolor=black@0.8:shadowx=3:shadowy=3[t]`,
    `[t]drawtext=fontfile=${FONT_SANS}:textfile='${sub}':fontsize=30:fontcolor=${INK}`
      + `:x=(w-text_w)/2:y=(h-text_h)/2+80[u]`,
    `[u]fade=t=in:st=0:d=1.2,fade=t=out:st=${(frames / FPS - 1.2).toFixed(2)}:d=1.2,`
      + `format=yuv420p[v]`,
  ].join(';');

  ff(['-f', 'lavfi', '-i', `color=c=0x14100c:s=${W}x${H}:d=${(frames / FPS).toFixed(2)}:r=${FPS}`,
    '-vf', filt, '-frames:v', String(frames), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', out]);
  return out;
}

/**
 * Финальная карточка: чем играть и куда зайти.
 *
 * @param {number} frames сколько кадров
 * @returns {string} путь к отрывку
 */
function makeEnd(frames) {
  const out = path.join(WORK, 'seg-end.mp4');
  const t1 = path.join(WORK, 'end1.txt');
  const t2 = path.join(WORK, 'end2.txt');
  const t3 = path.join(WORK, 'end3.txt');
  writeText(t1, 'Бесплатно. В браузере. Без установки.');
  writeText(t2, 'rezare777.github.io/Silenc');
  writeText(t3, 'rezare777.itch.io');

  const filt = [
    `[0:v]drawtext=fontfile=${FONT_SERIF}:textfile='${t1}':fontsize=52:fontcolor=${GOLD}`
      + `:x=(w-text_w)/2:y=(h-text_h)/2-90[t]`,
    `[t]drawtext=fontfile=${FONT_SANS}:textfile='${t2}':fontsize=32:fontcolor=${INK}`
      + `:x=(w-text_w)/2:y=(h-text_h)/2+10[a]`,
    `[a]drawtext=fontfile=${FONT_SANS}:textfile='${t3}':fontsize=32:fontcolor=${INK}`
      + `:x=(w-text_w)/2:y=(h-text_h)/2+60[b]`,
    `[b]fade=t=in:st=0:d=1.0,fade=t=out:st=${(frames / FPS - 1.0).toFixed(2)}:d=1.0,`
      + `format=yuv420p[v]`,
  ].join(';');

  ff(['-f', 'lavfi', '-i', `color=c=0x14100c:s=${W}x${H}:d=${(frames / FPS).toFixed(2)}:r=${FPS}`,
    '-vf', filt, '-frames:v', String(frames), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', out]);
  return out;
}

/**
 * Склеить музыку: перекрёстные затухания между треками.
 *
 * @returns {string} путь к готовой дорожке
 */
function buildMusic() {
  const inputs = [];
  const filters = [];
  MUSIC_TRACKS.forEach((name, i) => {
    const file = path.join(MUSIC, name);
    if (!fs.existsSync(file)) throw new Error(`нет музыки: ${file}`);
    inputs.push('-i', file);
    // у каждого входа своя метка: [i:a] → [ai]
    filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`);
  });
  // склеиваем: между треками — затухание в 2 секунды
  let chain = 'a0';
  for (let i = 1; i < MUSIC_TRACKS.length; i++) {
    const next = `x${i}`;
    filters.push(`[${chain}][a${i}]acrossfade=d=2:c1=tri:c2=tri[${next}]`);
    chain = next;
  }
  filters.push(`[${chain}]afade=t=in:st=0:d=2,afade=t=out:st=58:d=3,`
    + `loudnorm=I=-18:TP=-1.5:LRA=11[music]`);

  const script = path.join(WORK, 'music.ff');
  writeText(script, filters.join(';\n'));
  const musicFile = path.join(WORK, 'music.wav');
  ff([...inputs, '-filter_complex_script', script, '-map', '[music]',
    '-t', '62', '-ar', '48000', '-ac', '2', musicFile]);
  return musicFile;
}

/**
 * Свести отрывки в один ролик перекрёстными затуханиями.
 *
 * @param {string[]} segments отрывки по порядку
 * @param {number[]} durations длительности, сек
 * @returns {string} путь к готовому видео
 */
function concatVideo(segments, durations) {
  const inputs = [];
  segments.forEach((s) => inputs.push('-i', s));

  const chain = [];
  let cur = '0:v';
  let acc = durations[0];
  for (let i = 1; i < segments.length; i++) {
    const label = `v${i}`;
    const offset = (acc - XFADE).toFixed(3);
    chain.push(`[${cur}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset}[${label}]`);
    cur = label;
    acc = acc + durations[i] - XFADE;
  }
  chain.push(`[${cur}]format=yuv420p[v]`);
  const script = path.join(WORK, 'video.ff');
  writeText(script, chain.join(';\n'));

  const out = path.join(WORK, 'video.mp4');
  ff([...inputs, '-filter_complex_script', script, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart', out]);
  return out;
}

/**
 * Собрать трейлер целиком.
 */
function main() {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(PUBLISH, { recursive: true });

  // режим дособорки: переиспользовать уже собранное видео и пересобрать только музыку
  const onlyMusic = process.argv.includes('--only=music');

  if (onlyMusic) {
    const video = path.join(WORK, 'video.mp4');
    if (!fs.existsSync(video)) throw new Error('нет video.mp4 — соберите трейлер целиком');
    console.log('=== Дособорка трейлера (только музыка) ===');
    const music = buildMusic();
    mux(video, music);
    return;
  }

  for (const f of fs.readdirSync(WORK)) fs.rmSync(path.join(WORK, f), { force: true });

  console.log('=== Трейлер «Шёпот-Долины» ===');

  const titleFrames = Math.round(4.0 * FPS);
  const endFrames = Math.round(5.0 * FPS);
  const sceneFrames = Math.round(SCENE * FPS);

  const segments = [makeTitle(titleFrames)];
  const durations = [titleFrames / FPS];

  console.log(`сцен: ${SCENES.length}`);
  SCENES.forEach((scene, i) => {
    process.stdout.write(`  ${i + 1}/${SCENES.length} ${scene.shot}\n`);
    segments.push(makeScene(scene, i + 1));
    durations.push(sceneFrames / FPS);
  });

  segments.push(makeEnd(endFrames));
  durations.push(endFrames / FPS);

  console.log('сведение видео…');
  const video = concatVideo(segments, durations);

  console.log('сведение музыки…');
  const music = buildMusic();

  const out = path.join(PUBLISH, 'Шёпот-Долина-трейлер.mp4');
  mux(video, music, out);
}

/**
 * Свести видео и музыку в готовый MP4.
 *
 * @param {string} video файл видео
 * @param {string} music файл музыки
 * @param {string} [outFile] куда сохранить (по умолчанию — в publish)
 */
function mux(video, music, outFile) {
  const out = outFile || path.join(PUBLISH, 'Шёпот-Долина-трейлер.mp4');
  fs.rmSync(out, { force: true });
  ff(['-i', video, '-i', music, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    '-movflags', '+faststart', out]);
  const size = (fs.statSync(out).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ ${out} — ${size} МБ`);
}

main();
