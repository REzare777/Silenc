#!/usr/bin/env node
/**
 * ============================================================================
 *  ВЫГРУЗКА ВСЕГО РУССКОГО ТЕКСТА ИГРЫ
 * ============================================================================
 *
 *  Собирает в один файл все строки, которые видит игрок: реплики NPC,
 *  подсказки, названия предметов, тосты, названия дел, тексты интерфейса.
 *
 *  Формат строки — такой, чтобы правку можно было вернуть в код:
 *
 *      [путь/файл.js:42] "текст, который видит игрок"
 *
 *  Квадратные скобки — это метка строки, кавычки — сами литералы из кода.
 *  Можно переписать текст между кавычками как угодно; подстановки вида
 *  `${имя}` трогать нельзя — это живые значения из игры.
 *
 *  Рядом кладётся `docs/ТЕКСТ-ИГРЫ.json` — тот же список в виде структуры
 *  (файл, строка, текст). По нему изменения можно применить автоматически.
 *
 *  Запуск: cd /workspace/village && node dev/text-dump.mjs
 *
 *  @module dev/text-dump
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DOCS = path.join(ROOT, 'docs');
const OUT_TXT = path.join(ROOT, 'ВЕСЬ-ТЕКСТ-ИГРЫ.txt');
const OUT_JSON = path.join(DOCS, 'ТЕКСТ-ИГРЫ.json');

/** Есть ли кириллица. */
const CYR = /[А-Яа-яЁё]/;

/**
 * Разобрать файл на строковые литералы, пропуская комментарии.
 *
 * @param {string} src содержимое файла
 * @returns {{line: number, text: string, kind: string}[]} найденные литералы
 */
function extractLiterals(src) {
  const out = [];
  let line = 1;
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    // комментарии
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    // строковый литерал
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      const startLine = line;
      let text = '';
      i++;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') {
          text += src[i] + (src[i + 1] || '');
          i += 2;
          continue;
        }
        if (ch === quote) {
          i++;
          break;
        }
        if (ch === '\n') {
          line++;
          if (quote !== '`') break;   // одинарные кавычки многострочными не бывают
        }
        text += ch;
        i++;
      }
      if (CYR.test(text)) {
        out.push({ line: startLine, text, kind: quote === '`' ? 'template' : 'string' });
      }
      continue;
    }
    if (c === '\n') line++;
    i++;
  }
  return out;
}

/**
 * Все файлы исходников — по порядку, чтобы список был стабильным.
 *
 * @param {string} dir папка
 * @param {string[]} [acc] накопитель
 * @returns {string[]} пути
 */
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.js')) acc.push(p);
  }
  return acc;
}

/**
 * Видимый текст из HTML: содержимое элементов и подсказки.
 *
 * @param {string} html разметка
 * @returns {{line: number, text: string, kind: string}[]}
 */
function extractHtml(html) {
  const out = [];
  const lines = html.split('\n');
  // внутри <script> кода нет — выкусываем эти куски, чтобы в выгрузку
  // не попал мусор из встроенных скриптов
  let inScript = false;
  lines.forEach((ln, idx) => {
    if (/<script/i.test(ln)) inScript = true;
    if (inScript) {
      if (/<\/script/i.test(ln)) inScript = false;
      return;
    }
    // атрибуты title, placeholder, aria-label
    const attrs = ln.match(/(?:title|placeholder|aria-label)="([^"]*[А-Яа-яЁё][^"]*)"/g) || [];
    for (const a of attrs) {
      const v = a.replace(/^[a-z-]+="/, '').replace(/"$/, '');
      out.push({ line: idx + 1, text: v, kind: 'attr' });
    }
    // видимый текст между тегами
    const inner = ln.match(/>([^<>]*[А-Яа-яЁё][^<>]*)</g) || [];
    for (const t of inner) {
      const v = t.replace(/^>/, '').replace(/</, '').trim();
      if (v && !/^&/.test(v)) out.push({ line: idx + 1, text: v, kind: 'html' });
    }
    // хвост многострочного элемента: текст строки, закрывающий тег.
    // раньше такие строки выпадали из выгрузки, и их нельзя было править
    const tail = ln.match(/^\s*([^<>]*[А-Яа-яЁё][^<>]*)<\/[a-zA-Z]/);
    if (tail) {
      const v = tail[1].trim();
      if (v && !/^&/.test(v)) out.push({ line: idx + 1, text: v, kind: 'html' });
    }
  });
  return out;
}

/** Экранировать текст для вывода в файл. */
function esc(s) {
  return s.replace(/\n/g, '⏎').replace(/\r/g, '');
}

console.log('=== Выгрузка русского текста игры ===');

const entries = [];
const files = walk(SRC);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  const lits = extractLiterals(src);
  if (!lits.length) continue;
  entries.push({ file: rel, kind: 'file', items: lits.map((l) => ({
    line: l.line, text: l.text, type: l.kind,
  })) });
}

// разметка интерфейса
{
  const file = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const lits = extractHtml(html);
  if (lits.length) {
    entries.push({
      file: 'index.html',
      kind: 'file',
      items: lits.map((l) => ({ line: l.line, text: l.text, type: l.kind })),
    });
  }
}

/* ------------------------------- текстовый файл ------------------------------- */

const lines = [];
lines.push('ШЁПОТ-ДОЛИНА — ВЕСЬ РУССКИЙ ТЕКСТ ИГРЫ');
lines.push('='.repeat(64));
lines.push('');
lines.push('Что это: все строки, которые видит игрок, — реплики, подсказки,');
lines.push('названия, тосты, описания. Собраны автоматически из исходников.');
lines.push('');
lines.push('Как править:');
lines.push('  · менять можно всё, что между кавычками;');
lines.push('  · подстановки вида ${имя} — живые значения, их не трогать;');
lines.push('  · после правок скажите — изменения верну в код автоматически;');
lines.push('  · если строка удалена или продублирована — ничего страшного,');
lines.push('    лишнее просто не применится.');
lines.push('');
lines.push(`Всего строк: ${entries.reduce((n, e) => n + e.items.length, 0)}`);
lines.push('');

for (const e of entries) {
  lines.push('-'.repeat(64));
  lines.push(`ФАЙЛ: ${e.file}`);
  lines.push('-'.repeat(64));
  for (const it of e.items) {
    lines.push(`[${e.file}:${it.line}] "${esc(it.text)}"`);
  }
  lines.push('');
}

fs.writeFileSync(OUT_TXT, lines.join('\n'), 'utf8');

/* -------------------------------- json-выгрузка -------------------------------- */

fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify({
  generated: new Date().toISOString(),
  total: entries.reduce((n, e) => n + e.items.length, 0),
  files: entries,
}, null, 2), 'utf8');

/* ---------------------------------- сводка ---------------------------------- */

const perFile = entries.map((e) => `  ${e.file} — ${e.items.length}`).join('\n');
console.log(`\nСтрок всего: ${entries.reduce((n, e) => n + e.items.length, 0)}`);
console.log(perFile);
console.log(`\n✓ ${OUT_TXT}`);
console.log(`✓ ${OUT_JSON}`);
