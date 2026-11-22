#!/usr/bin/env node
/**
 * ============================================================================
 *  Единый прогон автотестов
 * ============================================================================
 *
 *  Зачем он нужен: тесты гоняют настоящий браузер с программным рендером
 *  (~0,4–3 FPS), поэтому каждый занимает от 30 секунд до полутора минут.
 *  Запускать их по одному вручную — муторно. Этот скрипт:
 *
 *   1. поднимает локальный статический сервер, если он ещё не отвечает;
 *   2. прогоняет тесты последовательно (или в `--jobs N` потоков);
 *   3. печатает сводку: имя, вердикт и ключевую строку каждого теста;
 *   4. возвращает ненулевой код, если хоть один тест упал.
 *
 *  Использование:
 *    node dev/run-tests.mjs              # полный набор
 *    node dev/run-tests.mjs --quick      # быстрый набор (3 теста)
 *    node dev/run-tests.mjs --only=fish_test,inv_test
 *    node dev/run-tests.mjs --jobs=2     # два браузера одновременно
 *
 *  @module dev/run-tests
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOGS = path.join(ROOT, '.testlogs');

/** Полный набор тестов. */
const ALL = [
  'regress', 'regress_file', 'barn_test', 'tavern_test', 'interiors_test',
  'volume_test', 'mill_test', 'roof_test', 'stair_smooth', 'animals_test',
  'animals_collide', 'dog_test', 'fish_test', 'inv_test', 'broken_normals',
  'npc_test', 'dungeon_test', 'single_check',
  'house_check', 'church_check', 'time_check', 'town_layout',
  'round36_check', 'r37_check', 'r39_check', 'r40_check', 'r41_check', 'r42_check', 'r43_check', 'r44_check',
  'home_loc_check', 'focus_check', 'mill_climb', 'r45_check', 'r46_check', 'r48_roads', 'r49_check', 'r50_check', 'r51_check', 'r51_build_check', 'r52_check', 'r52_smoke', 'r53_check', 'r53_smoke', 'r54_check',
];

/** Быстрый набор — для проверки «ничего не сломалось» после правки. */
const QUICK = ['regress', 'broken_normals', 'single_check'];

/**
 * Разбор аргументов командной строки.
 *
 * @returns {{tests: string[], jobs: number, keepLogs: boolean}} параметры
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let tests = null;
  let jobs = 1;
  for (const a of args) {
    if (a.startsWith('--only=')) {
      tests = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a.startsWith('--jobs=')) {
      jobs = Math.max(1, Math.min(3, Number(a.slice(7)) || 1));
    } else if (a === '--quick') {
      tests = QUICK;
    } else if (a === '--all') {
      tests = ALL;
    }
  }
  if (!tests) tests = ALL;
  return { tests, jobs, keepLogs: true };
}

/**
 * Проверить, отвечает ли локальный сервер сборки.
 *
 * @returns {Promise<boolean>} true, если сервер доступен
 */
function serverAlive() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:4205/', (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Поднять локальный сервер сборки (`dev/serve.py`), если он не запущен.
 *
 * @returns {Promise<void>} ничего
 */
async function ensureServer() {
  if (await serverAlive()) {
    console.log('• сервер уже отвечает на :4205');
    return;
  }
  console.log('• поднимаю сервер сборки (dev/serve.py)…');
  const child = spawn('python3', [path.join(HERE, 'serve.py')], {
    cwd: ROOT, detached: true, stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await serverAlive()) {
      console.log('• сервер поднят');
      return;
    }
  }
  console.warn('! сервер не поднялся — тесты, которым он нужен, могут не пройти');
}

/**
 * Запустить один тест и разобрать его вывод.
 *
 * @param {string} name имя теста (без .mjs)
 * @returns {{name: string, ok: boolean, code: number, summary: string, log: string}}
 */
function runOne(name) {
  const file = path.join(HERE, `${name}.mjs`);
  if (!fs.existsSync(file)) {
    return Promise.resolve({ name, ok: false, code: 127, summary: 'файл теста не найден', log: '' });
  }
  // spawn, а не spawnSync: иначе «потоки» не работают — Node однопоточный,
  // и блокирующий spawnSync полностью сериализует прогон.
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd: HERE });
    let out = '';
    const grab = (buf) => { out += buf.toString(); };
    child.stdout.on('data', grab);
    child.stderr.on('data', grab);
    const timer = setTimeout(() => { out += '\n[превышено время 600 с]\n'; child.kill('SIGKILL'); }, 600000);
    child.on('close', (code) => {
      clearTimeout(timer);
      fs.writeFileSync(path.join(LOGS, `${name}.log`), out);
      // Ключевая строка: «ошибки: нет» / «ошибок: 0 из 12» / «ошибки в консоли: 0»
      const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
      const errLine = [...lines].reverse().find((l) => /^ошибк/i.test(l)) || '';
      const ok = code === 0 && !/ошибк[а-я]*:\s*[1-9]/.test(out);
      const summary = errLine || (ok ? 'пройден' : `код ${code}`);
      resolve({ name, ok, code: code ?? -1, summary, log: out });
    });
  });
}

const { tests, jobs } = parseArgs();
fs.mkdirSync(LOGS, { recursive: true });
await ensureServer();

// 0. Статическая проверка: ловит «забытый ctx.» — самый частый класс ошибок
// после рефакторинга. Работает мгновенно, поэтому идёт первым.
console.log('\n=== Статическая проверка модулей ===');
const lint = spawnSync(process.execPath, [path.join(HERE, 'lint-scopes.mjs')], {
  cwd: HERE, encoding: 'utf8', timeout: 60000,
});
const lintOut = `${lint.stdout || ''}${lint.stderr || ''}`.trim();
console.log(lintOut);
const lintOk = lint.status === 0;
console.log(lintOk ? '✓ модули согласованы\n' : '✗ есть несогласованные обращения\n');

console.log(`=== Прогон ${tests.length} тест(ов), потоков: ${jobs} ===\n`);

const results = [];
if (jobs === 1) {
  for (const t of tests) {
    process.stdout.write(`… ${t} `);
    const r = await runOne(t);
    results.push(r);
    console.log(r.ok ? '✓' : '✗', r.summary);
  }
} else {
  const queue = [...tests];
  const workers = Array.from({ length: jobs }, async () => {
    while (queue.length) {
      const t = queue.shift();
      const r = await runOne(t);
      results.push(r);
      console.log(`${r.ok ? '✓' : '✗'} ${t} — ${r.summary}`);
    }
  });
  await Promise.all(workers);
}

const failed = results.filter((r) => !r.ok);
if (!lintOk) failed.push({ name: 'lint-scopes', ok: false, summary: 'несогласованные обращения' });
console.log('\n================= СВОДКА =================');
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(18)} ${r.summary}`);
console.log('===========================================');
console.log(`Пройдено: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log('\nЛоги подробностей — в .testlogs/');
  process.exit(1);
}
console.log('Все тесты зелёные.');
