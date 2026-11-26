#!/usr/bin/env node
/**
 * ============================================================================
 *  МАТЕРИАЛЫ ДЛЯ СТРАНИЦЫ НА ITCH.IO
 * ============================================================================
 *
 *  Готовит то, что загружается на страницу игры:
 *
 *   1. `publish/itch-upload.zip` — сама игра (однофайловый HTML) и обложка;
 *   2. `publish/itch-shots/` — скриншоты 1280×720 из настоящих кадров игры;
 *   3. `publish/itch-description.md` — текст описания (он уже обновлён).
 *
 *  Трейлер собирается отдельно: `node scripts/trailer.mjs`.
 *
 *  Запуск: cd /workspace/village && node scripts/itch-assets.mjs
 *
 *  @module scripts/itch-assets
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'shots');
const PUBLISH = path.join(ROOT, 'publish');
const OUT = path.join(PUBLISH, 'itch-shots');

/** Скриншоты для галереи: файл кадра и его название. */
const PICKED = [
  ['R8_north.png', '01-деревня-с-высоты'],
  ['G2_village.jpg', '02-улица-в-сумерках'],
  ['FINAL_night.jpg', '03-ночная-улица'],
  ['T2_tavern_hall.png', '04-трактир-зал'],
  ['T4_tavern_bar.png', '05-стойка-бара'],
  ['CAM_pier.png', '06-озеро-и-причал'],
  ['R64_dg_crystal.jpg', '07-подземелье-кристаллы'],
  ['R64_dg_gates.jpg', '08-зал-врат'],
  ['R66_smith_mark.jpg', '09-знак-дела-над-кузнецом'],
  ['R66_journal.jpg', '10-журнал-дел'],
];

/**
 * Выполнить команду ffmpeg.
 *
 * @param {string[]} args аргументы
 */
function ff(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

console.log('=== Материалы для itch.io ===');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { force: true });

let n = 0;
for (const [file, name] of PICKED) {
  const src = path.join(SHOTS, file);
  if (!fs.existsSync(src)) {
    console.log(`  пропущено: нет кадра ${file}`);
    continue;
  }
  const out = path.join(OUT, `${name}.png`);
  // кадры сняты в 5:3 — обрезаем по вертикали до 16:9 и приводим к 1280×720
  ff(['-i', src, '-vf', 'crop=iw:trunc(iw*9/16),scale=1280:720:flags=lanczos',
    '-frames:v', '1', out]);
  n++;
  console.log(`  ${name}`);
}
console.log(`\n✓ ${OUT} — ${n} скриншотов`);

/* пакет для загрузки: игра + обложка */
const single = path.join(ROOT, 'whispervale.html');
const cover = path.join(PUBLISH, 'cover-itch.png');
if (fs.existsSync(single)) {
  // itch запускает «index.html» — переименовываем игру перед упаковкой
  fs.copyFileSync(single, path.join(PUBLISH, 'index.html'));
}
if (fs.existsSync(path.join(PUBLISH, 'index.html')) && fs.existsSync(cover)) {
  const zip = path.join(PUBLISH, 'itch-upload.zip');
  fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-q', '-j', zip,
    path.join(PUBLISH, 'index.html'), cover], { stdio: 'inherit' });
  const size = (fs.statSync(zip).size / 1024 / 1024).toFixed(2);
  console.log(`✓ ${zip} — ${size} МБ (index.html + обложка)`);
}
