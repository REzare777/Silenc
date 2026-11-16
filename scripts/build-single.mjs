import fs from 'node:fs';
import path from 'node:path';

/* Собирает весь сайт в ОДИН html-файл: css + js внутри.
   Такой файл открывается с диска и работает вообще без сети. */

const dist = path.resolve('dist');
const outFile = process.argv[2] || path.resolve('whispervale.html');

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const m = html.match(/<script\s+type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/);
if (!m) {
  console.error('Не найден тег со сборкой в dist/index.html');
  process.exit(1);
}
const js = fs.readFileSync(path.join(dist, 'assets', m[1]), 'utf8');
if (js.includes('</script>')) {
  console.error('В бандле есть </script> — нужна экранировка');
  process.exit(1);
}

// вырезаем modulepreload, он больше не нужен
html = html.replace(/<link\s+rel="modulepreload"[^>]*>/g, '');
// встраиваем бандл
// обычный script, а не module: module-скрипты Chromium блокирует на file://
// ВАЖНО: замена через функцию — иначе `$&` и прочие спецсимволы внутри бандла
// будут развёрнуты replace'ем и сломают код.
html = html.replace(m[0], () => '');
// Vite поднимает entry-скрипт в <head>, где document.body ещё null —
// переносим его в конец <body>.
html = html.replace('</body>', () => `  <script>\n${js}\n</script>\n</body>`);

fs.writeFileSync(outFile, html, 'utf8');
console.log(`Готово: ${outFile} — ${(fs.statSync(outFile).size / 1024).toFixed(0)} КБ`);
