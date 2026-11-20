#!/usr/bin/env node
/**
 * ============================================================================
 *  Релиз: сборка → однофайловая версия → копии → архив
 * ============================================================================
 *
 *  Одна команда собирает всё, что можно отдать пользователю:
 *
 *   1. `vite build` — production-сборка в `dist/`;
 *   2. `scripts/build-single.mjs` — один html-файл, открывается с диска;
 *   3. копии в `/workspace`:
 *        `Шёпот-Долина.html`   — однофайловая версия для пользователя;
 *        `whispervale-village.zip` — исходники проекта;
 *   4. проверка целостности архива (`unzip -t`);
 *   5. обновление `/workspace/srcpkg` — чистая папка с исходниками для деплоя
 *      (без `node_modules`, иначе загрузка не влезает в лимит).
 *
 *  Использование: `npm run release`
 *
 *  @module scripts/release
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = path.resolve(ROOT, '..');
const SRC_PKG = path.join(WORKSPACE, 'srcpkg');

/**
 * Выполнить команду и показать её вывод.
 *
 * @param {string} cmd команда
 * @param {string[]} args аргументы
 * @param {string} cwd рабочая папка
 */
function run(cmd, args, cwd = ROOT) {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

/**
 * Размер файла или каталога в мегабайтах с одним знаком.
 *
 * @param {string} file путь к файлу или каталогу
 * @returns {string} human-readable размер
 */
function mb(file) {
  const st = fs.statSync(file);
  if (st.isFile()) return `${(st.size / 1024 / 1024).toFixed(2)} МБ`;
  let total = 0;
  const walkDir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walkDir(full);
      else total += fs.statSync(full).size;
    }
  };
  walkDir(file);
  return `${(total / 1024 / 1024).toFixed(2)} МБ`;
}

console.log('=== Релиз Шёпот-Долины ===');

/* 1. production-сборка */
run('npx', ['vite', 'build', '--logLevel', 'warn']);

/* 2. однофайловая версия */
run('node', [path.join('scripts', 'build-single.mjs')]);

/* 3. копия для пользователя */
const single = path.join(ROOT, 'whispervale.html');
const userCopy = path.join(WORKSPACE, 'Шёпот-Долина.html');
fs.copyFileSync(single, userCopy);
console.log(`\n✓ ${userCopy} — ${mb(userCopy)}`);

/* 4. архив с исходниками */
const zip = path.join(WORKSPACE, 'whispervale-village.zip');
fs.rmSync(zip, { force: true });
// dev/ в архив тоже кладём: тесты пригодятся тому, кто продолжит работу.
const items = ['index.html', 'src', 'scripts', 'dev', 'dist', 'docs', 'package.json',
  'vite.config.js', 'jsconfig.json', '.editorconfig', 'README.md', 'whispervale.html',
  '.github']
  .filter((i) => fs.existsSync(path.join(ROOT, i)));
run('zip', ['-r', '-q', zip, ...items, '-x', '*/node_modules/*', 'dev/shots/*', 'dev/.testlogs/*', '.testlogs/*']);
run('unzip', ['-t', zip]);
console.log(`\n✓ ${zip} — ${mb(zip)}`);

/* 5. чистая папка с исходниками для деплоя */
fs.rmSync(SRC_PKG, { recursive: true, force: true });
fs.mkdirSync(SRC_PKG, { recursive: true });
for (const i of items) {
  if (i === 'dist') continue;                 // dist не нужен: он и есть публикуемая сборка
  if (i === 'dev') {                          // в папку для деплоя тесты не кладём
    fs.cpSync(path.join(ROOT, i), path.join(SRC_PKG, i), { recursive: true, filter: (src) => !src.includes('node_modules') });
    fs.rmSync(path.join(SRC_PKG, i), { recursive: true, force: true });
    continue;
  }
  fs.cpSync(path.join(ROOT, i), path.join(SRC_PKG, i), { recursive: true });
}
console.log(`\n✓ ${SRC_PKG} — исходники для деплоя (${mb(SRC_PKG)})`);

/* 6. пакет для itch.io: однофайловая игра + обложка (в корне — index.html) */
const PUBLISH = path.join(ROOT, 'publish');
if (fs.existsSync(PUBLISH)) {
  fs.mkdirSync(PUBLISH, { recursive: true });
  fs.copyFileSync(single, path.join(PUBLISH, 'index.html'));
  const itchZip = path.join(PUBLISH, 'itch-upload.zip');
  fs.rmSync(itchZip, { force: true });
  run('zip', ['-q', '-j', itchZip, path.join(PUBLISH, 'index.html'),
    path.join(PUBLISH, 'cover-itch.png')]);
  run('unzip', ['-t', itchZip]);
  console.log(`\n✓ ${itchZip} — пакет для itch.io (${mb(itchZip)})`);
}

console.log('\n=== Готово ===');
console.log(`Онлайн: задеплойте папку dist (path) и исходники (source_path: ${SRC_PKG})`);
