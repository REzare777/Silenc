/**
 * ============================================================================
 *  Снимки обложки: кадры 1200×630 для og:image и карточек каталогов
 * ============================================================================
 *
 *  Делает несколько кадров подряд (разные моменты времени), чтобы выбрать
 *  самый удачный: на нём должно быть видно деревню, а не пустой лес.
 *
 *  Запуск: node dev/cover_shots.mjs [папка-вывода]
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));

await page.goto('http://127.0.0.1:4205/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.click('#begin');
await page.waitForTimeout(6000);

const marks = [0, 6000, 7000, 8000];
let waited = 0;
for (let i = 0; i < marks.length; i++) {
  await page.waitForTimeout(marks[i]);
  waited += marks[i];
  const file = `${OUT}/cover_${i + 1}.png`;
  await page.screenshot({ path: file });
  console.log(`✓ ${file} (после ${waited / 1000} c)`);
}

console.log(errs.length ? `ошибки: ${errs.join(' | ')}` : 'ошибки: нет');
await browser.close();
