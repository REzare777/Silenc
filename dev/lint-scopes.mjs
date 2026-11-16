#!/usr/bin/env node
/**
 * Грубая, но полезная проверка: ищет обращения к именам, которые нигде
 * не объявлены (забытый `ctx.` после рефакторинга). Не заменяет ESLint,
 * но ловит именно тот класс ошибок, что появляется при массовой замене.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');
// Проверяем модули, где имена вида scene/M/rng приходят только из контекста.
// В src/world/ и src/player.js такие имена — обычные параметры функций.

const GLOBALS = new Set([
  'Math','JSON','Object','Array','Number','String','Boolean','console','window','document',
  'setTimeout','clearTimeout','setInterval','clearInterval','localStorage','sessionStorage','location',
  'URLSearchParams','devicePixelRatio','innerWidth','innerHeight','requestAnimationFrame',
  'Float32Array','Float64Array','Uint8Array','Uint16Array','Date','isNaN','isFinite',
  'parseFloat','parseInt','Promise','Map','Set','WeakMap','WeakSet','Symbol','Error',
  'RegExp','Infinity','NaN','undefined','globalThis','performance','navigator','Image','Audio',
  'AudioContext','webkitAudioContext','TouchEvent','KeyboardEvent','MouseEvent','CustomEvent',
  'Event','Blob','FileReader','fetch','structuredClone','queueMicrotask','Intl','Proxy','Reflect',
  'THREE','Vector2','Vector3','Group','Mesh','Scene','Color','Fog','BoxGeometry','PlaneGeometry',
  'this','true','false','null','undefined','export','import','as','from','default','extends','super',
  'new','delete','typeof','void','instanceof','static','get','set','async','await','yield','of','in',
  'CircleGeometry','SphereGeometry','CylinderGeometry','ConeGeometry','RingGeometry','TorusGeometry',
  'DodecahedronGeometry','BufferGeometry','BufferAttribute','Float32BufferAttribute',
  'MeshStandardMaterial','MeshBasicMaterial','MeshLambertMaterial','MeshPhongMaterial',
  'PointsMaterial','PointLight','DirectionalLight','HemisphereLight','AmbientLight','SpotLight',
  'Quaternion','Euler','Raycaster','Vector4','Shape','Path','Curve','CatmullRomCurve3',
  'ExtrudeGeometry','LatheGeometry','TorusKnotGeometry','IcosahedronGeometry','OctahedronGeometry',
  'TetrahedronGeometry','Matrix4','Matrix3','Spherical','Cylindrical','Box3','Sphere','Line3',
]);

const CTX_FIELDS = new Set([
  'scene','camera','renderer','composer','renderPass','bloom','gradePass','T','M','glowTex',
  'ui','ambience','env','player','nav','inventory','colliders','platforms','animalCircles',
  'critters','interactables','animated','smokeSources','lanterns','roomLights','rng','systems',
  'mode','loc','doors','mill','fireBoost','emberSys','game',
]);

let problems = 0;

function collectDeclared(code) {
  const declared = new Set();
  // import { a, b } / import * as ns / import ns
  for (const m of code.matchAll(/import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\}|(\w+))/g)) {
    if (m[1]) declared.add(m[1]);
    if (m[3]) declared.add(m[3]);
    if (m[2]) for (const part of m[2].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) declared.add(name);
    }
  }
  // объявления: const/let/var, function, class, параметры (грубо)
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([\w$]+)/g)) declared.add(m[1]);
  // «const a = 1, b = 2, c = 3» — следующие имена в той же строке
  for (const m of code.matchAll(/\b(?:const|let|var)\s+[^;\n]*/g)) {
    const tail = m[0].replace(/\b(?:const|let|var)\s+/, '');
    const parts = tail.split(',');
    for (let i = 1; i < parts.length; i++) {
      const nm = parts[i].trim().split(/[=:]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nm)) declared.add(nm);
    }
  }
  // for (const x of ...) / for (const x in ...)
  for (const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+(?:of|in)\b/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[:=]/)[0].trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[:=]/)[0].trim();
      if (name) declared.add(name);
    }
  }
  for (const m of code.matchAll(/function\s+([\w$]+)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/class\s+([\w$]+)/g)) declared.add(m[1]);
  for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) {
    for (const part of m[1].split(',')) {
      let name = part.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
      if (name.startsWith('{') || name.startsWith('[')) {
        // деструктуризация в параметрах: { a, b } или [a, b]
        for (const inner of name.replace(/[{}[\]]/g, '').split(',')) {
          const n2 = inner.trim().split(/[:=]/)[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(n2)) declared.add(n2);
        }
        continue;
      }
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  for (const m of code.matchAll(/\b([\w$]+)\s*=>/g)) declared.add(m[1]);
  // (x, y) => …  — параметры в скобках
  for (const m of code.matchAll(/\(\s*([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)\s*\)\s*=>/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  for (const m of code.matchAll(/catch\s*\(\s*([\w$]+)/g)) declared.add(m[1]);
  // параметры методов: name(a, b) {
  const KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'do', 'else']);
  for (const m of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g)) {
    if (KW.has(m[1])) continue;
    for (const part of m[2].split(',')) {
      let name = part.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
      if (name.startsWith('{') || name.startsWith('[')) {
        for (const inner of name.replace(/[{}[\]]/g, '').split(',')) {
          const n2 = inner.trim().split(/[:=]/)[0].trim();
          if (/^[A-Za-z_$][\w$]*$/.test(n2)) declared.add(n2);
        }
        continue;
      }
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  // for (const [a, b] of ...)
  for (const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim();
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  for (const m of code.matchAll(/(?:function\s*[\w$]*|constructor)\s*\(([^)]*)\)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[:=]/)[0].trim().replace(/^\.\.\./, '');
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  // поля объектов: ctx.X → X разрешён через ctx.
  return declared;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const code = fs.readFileSync(full, 'utf8');
    // вырезаем комментарии и строки, чтобы не ловить шум
    const clean = code
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
      .replace(/`(?:\\.|[^`\\])*`/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, '""')
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/<\/?[A-Za-z][^>]*>?/g, ' ');  // HTML-теги из шаблонных строк
    const declared = collectDeclared(clean);
    // поля контекста: если имя встречается «как значение» (без точки после),
    // значит забыли ctx. — такие места ловим отдельно
    const ctxNames = new Set([
      'scene','camera','player','ambience','renderer','composer','bloom','env','glowTex',
      'colliders','platforms','critters','interactables','lanterns','roomLights','animated',
      'smokeSources','inventory','renderPass','M','T','ui','rng',
    ]);
    const seen = new Set();
    // 0) общая проверка: идентификатор, которого нигде нет — опечатка или
    // забытое объявление. Ловит, например, «z0 is not defined» в новой функции.
    const KEYWORDS = new Set([
      'if','for','while','switch','catch','return','function','class','typeof','instanceof',
      'new','delete','void','in','of','do','else','try','finally','throw','case','default','yield','await',
      'const','let','var','break','continue','extends','super','static','get','set','async','export',
      'import','as','from','this','true','false','null','undefined',
    ]);
    for (const m of clean.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)(?![\w$])/g)) {
      const name = m[1];
      if (KEYWORDS.has(name) || GLOBALS.has(name) || declared.has(name)) continue;
      if (name.length < 2) continue;          // одиночные буквы слишком шумные
      const before = clean.slice(Math.max(0, m.index - 26), m.index);
      const after = clean.slice(m.index + name.length, m.index + name.length + 2);
      if (/[\{,]\s*$/.test(before)) continue;        // ключ объекта или объявление
      if (/^\s*[(:,)]/.test(after)) continue;         // аргумент вызова
      if (/^\s*=/.test(after)) continue;              // присваивание
      if (/^\s*[)\]},;]/.test(before.slice(-1))) continue;
      const line = clean.slice(0, m.index).split('\n').length;
      const key = `any-${name}@${full}`;
      if (!seen.has(key)) {
        seen.add(key);
        const around = clean.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\n/g, ' ');
        console.log(`✗ ${path.relative(SRC, full)}:${line}: "${name}" нигде не объявлено  …${around}…`);
        problems++;
      }
    }
    // 1) обращения «имя.» без ctx.
    for (const m of clean.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)\s*\./g)) {
      const name = m[1];
      if (GLOBALS.has(name) || declared.has(name)) continue;
      if (ctxNames.has(name)) {
        const key = `${name}@${full}`;
        if (!seen.has(key)) {
          seen.add(key);
          const line = clean.slice(0, m.index).split('\n').length;
          console.log(`✗ ${path.relative(SRC, full)}:${line}: "${name}." — похоже, забыт ctx.`);
          problems++;
        }
      }
    }
    // 2) имя из списка ctx, переданное как значение (без точки): scene, M, rng() ...
    if (path.basename(full) !== 'context.js' && full.includes('/game/')) {
      for (const m of clean.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)(?![\w$])/g)) {
        const name = m[1];
        if (!ctxNames.has(name) || declared.has(name)) continue;
        // пропускаем объявления полей и ключи объектов
        const before = clean.slice(Math.max(0, m.index - 24), m.index);
        const after = clean.slice(m.index + name.length, m.index + name.length + 2);
        if (/[:{,]\s*$/.test(before)) continue;      // ключ объекта или объявление
        if (/^\s*[(:,]/.test(after)) continue;        // вызов или аргумент — как раз наш случай
        const line = clean.slice(0, m.index).split('\n').length;
        const key = `val-${name}@${full}`;
        if (!seen.has(key)) {
          seen.add(key);
          console.log(`✗ ${path.relative(SRC, full)}:${line}: "${name}" используется без ctx.`);
          problems++;
        }
      }
    }
  }
}

walk(SRC);
console.log(problems ? `\nНайдено проблем: ${problems}` : '✓ Неопределённых обращений не найдено');
process.exit(problems ? 1 : 0);
