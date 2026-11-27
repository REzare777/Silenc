#!/usr/bin/env node
/**
 * ============================================================================
 *  ВНЕСЕНИЕ ПРАВОК ТЕКСТА В КОД
 * ============================================================================
 *
 *  Пользователь правит файл «ВЕСЬ-ТЕКСТ-ИГРЫ.txt» в любом текстовом
 *  редакторе. Этот скрипт переносит правки обратно в исходники.
 *
 *  Как это работает:
 *   1) «до» берётся из `docs/ТЕКСТ-ИГРЫ.json` — снимок текста на момент
 *      выгрузки (его сделал `dev/text-dump.mjs`);
 *   2) «после» — из отредактированного .txt;
 *   3) для каждой изменённой строки ищется тот же строковый литерал
 *      в исходнике (рядом с той же строкой) и заменяется на новый.
 *
 *  Что можно и нельзя менять:
 *   · менять можно всё, что между кавычками;
 *   · подстановки вида `${имя}` не трогать — это живые значения из игры;
 *   · если строку удалили или продублировали — ничего страшного: лишнее
 *     просто не применится, а в отчёте будет сказано, что не нашлось.
 *
 *  Запуск:
 *    node dev/text-apply.mjs                      # применить правки
 *    node dev/text-apply.mjs --check              # только показать, что изменится
 *    node dev/text-apply.mjs путь/к/файлу.txt     # свой файл с правками
 *
 *  @module dev/text-apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = path.join(ROOT, 'docs', 'ТЕКСТ-ИГРЫ.json');

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const TXT = args.find((a) => !a.startsWith('--'))
  || path.join(ROOT, 'ВЕСЬ-ТЕКСТ-ИГРЫ.txt');

/** Разобрать файл выгрузки: строки вида `[путь/файл.js:42] "текст"`. */
function parseDump(txt) {
  const out = [];
  for (const line of txt.split('\n')) {
    const m = line.match(/^\[([^\]]+):(\d+)\] "(.*)"$/);
    if (m) out.push({ file: m[1], line: Number(m[2]), text: m[3] });
  }
  return out;
}

/** Номер строки по смещению в тексте. */
function lineAt(src, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

/** Все вхождения подстроки. */
function allIndexes(src, needle) {
  const out = [];
  if (!needle) return out;
  let i = src.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = src.indexOf(needle, i + 1);
  }
  return out;
}

/**
 * Найти строковый литерал в исходнике.
 *
 * @param {string} src текст исходника
 * @param {string} oldText прежнее содержимое литерала (как в исходнике)
 * @param {number} lineHint строка, на которой литерал стоял при выгрузке
 * @returns {{index: number, quote: string}|null} найденное место
 */
function findLiteral(src, oldText, lineHint) {
  let best = null;
  for (const q of ['\'', '"', '`']) {
    const needle = q + oldText + q;
    for (const index of allIndexes(src, needle)) {
      const ln = lineAt(src, index);
      const score = Math.abs(ln - lineHint);
      if (!best || score < best.score) best = { index, quote: q, score, line: ln };
    }
  }
  if (!best) return null;
  // слишком далеко от места, где литерал стоял, — считаем, что это другой
  // текст (файл переписали) и не трогаем его молча
  if (best.score > 40) return null;
  return { index: best.index, quote: best.quote, line: best.line };
}

/**
 * Подготовить новый текст к записи в исходник.
 *
 * `⏎` — реальный перенос строки, который выгрузка заменила; в исходнике он
 * становится escape-последовательностью (или настоящим переносом в
 * шаблонной строке). Кавычки внутри строки экранируются.
 *
 * @param {string} text новый текст из файла правок
 * @param {string} quote кавычка, которой обрамлён литерал
 * @returns {string} готовый к записи текст
 */
function escapeFor(text, quote) {
  let s = text.replace(/⏎/g, quote === '`' ? '\n' : '\\n');
  if (quote === '\'') s = s.replace(/'/g, "\\'");
  else if (quote === '"') s = s.replace(/"/g, '\\"');
  return s;
}

if (!fs.existsSync(SNAPSHOT)) {
  console.error('Нет снимка текста docs/ТЕКСТ-ИГРЫ.json — сначала запустите dev/text-dump.mjs');
  process.exit(1);
}
if (!fs.existsSync(TXT)) {
  console.error(`Нет файла с правками: ${TXT}`);
  process.exit(1);
}

const before = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
// На одной строке кода может стоять несколько строковых литералов
// (например `a === 'весна' ? ... : 'лето'`), поэтому ключ — не просто
// «файл:строка», а список всех литералов этой строки.
const beforeByLine = new Map();
for (const f of before.files) {
  for (const it of f.items) {
    const key = `${f.file}:${it.line}`;
    if (!beforeByLine.has(key)) beforeByLine.set(key, []);
    beforeByLine.get(key).push(it.text);
  }
}

const after = parseDump(fs.readFileSync(TXT, 'utf8'));

// после — группируем по той же строке
const afterByLine = new Map();
for (const item of after) {
  const key = `${item.file}:${item.line}`;
  if (!afterByLine.has(key)) afterByLine.set(key, []);
  afterByLine.get(key).push(item.text);
}

// сопоставление: сперва гасим совпавшие литералы, остаток — правки
// переносы строк в снимке — настоящие, а в файле правок — знак «⏎»,
// поэтому перед сравнением приводим к одному виду
const norm = (t) => t.replace(/\r/g, '').replace(/\n/g, '⏎');
const changes = [];
for (const [key, afterList] of afterByLine) {
  const beforeList = (beforeByLine.get(key) || []).map(norm);
  if (!beforeList.length) continue;                       // новой строки в снимке нет
  const freeBefore = beforeList.slice();
  const freeAfter = afterList.map(norm);
  // 1) совпавшие — без изменений
  for (const t of freeAfter.slice()) {
    const i = freeBefore.indexOf(t);
    if (i !== -1) { freeBefore.splice(i, 1); freeAfter.splice(freeAfter.indexOf(t), 1); }
  }
  // 2) остаток: старые тексты заменяются новыми (по порядку)
  const n = Math.min(freeBefore.length, freeAfter.length);
  for (let i = 0; i < n; i++) {
    changes.push({
      file: key.slice(0, key.lastIndexOf(':')),
      line: Number(key.slice(key.lastIndexOf(':') + 1)),
      oldText: freeBefore[i],
      newText: freeAfter[i],
    });
  }
}

// строки, которые пользователь удалил
const afterKeys = new Set(after.map((i) => `${i.file}:${i.line}`));
const removed = [...beforeByLine.keys()].filter((k) => !afterKeys.has(k));

console.log(`=== Правки текста ===`);
console.log(`файл правок: ${TXT}`);
console.log(`изменённых строк: ${changes.length}, удалённых строк: ${removed.length}`);

if (!changes.length) {
  console.log('\nМенять нечего — правок не найдено.');
  process.exit(0);
}

// группируем по файлам и применяем снизу вверх, чтобы смещения не «поехали»
const byFile = new Map();
for (const c of changes) {
  if (!byFile.has(c.file)) byFile.set(c.file, []);
  byFile.get(c.file).push(c);
}

const applied = [];
const failed = [];

for (const [file, list] of byFile) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    for (const c of list) failed.push({ ...c, why: 'файл не найден' });
    continue;
  }
  let src = fs.readFileSync(full, 'utf8');
  // сначала ищем во всём файле, потом правим от последнего к первому
  const found = [];
  for (const c of list) {
    const hit = findLiteral(src, c.oldText, c.line);
    if (!hit) { failed.push({ ...c, why: 'строка не найдена в исходнике' }); continue; }
    found.push({ ...c, index: hit.index, quote: hit.quote, length: hit.quote.length + c.oldText.length + hit.quote.length });
  }
  found.sort((a, b) => b.index - a.index);
  for (const f of found) {
    const inner = escapeFor(f.newText, f.quote);
    src = src.slice(0, f.index + f.quote.length) + inner + src.slice(f.index + f.quote.length + f.oldText.length);
    applied.push({ file, line: f.line, newText: f.newText });
  }
  if (!CHECK_ONLY && found.length) {
    fs.writeFileSync(full, src, 'utf8');
  }
}

console.log(`\nприменено: ${applied.length}, не найдено: ${failed.length}`);
for (const a of applied.slice(0, 40)) console.log(`  ✓ ${a.file}:${a.line} — «${a.newText.slice(0, 70)}»`);
if (applied.length > 40) console.log(`  … и ещё ${applied.length - 40}`);
for (const f of failed) console.log(`  ✗ ${f.file}:${f.line} — ${f.why}: «${f.oldText.slice(0, 50)}»`);

if (CHECK_ONLY) {
  console.log('\nЭто был просмотр (--check): файлы не менялись.');
} else if (applied.length) {
  console.log('\n✓ Правки внесены в исходники.');
  console.log('Освежите выгрузку: node dev/text-dump.mjs');
}
process.exit(failed.length ? 1 : 0);
