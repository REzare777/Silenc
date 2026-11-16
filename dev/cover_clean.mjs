/**
 * ============================================================================
 *  Обложка для поиска и соцсетей (og:image, 1200×630)
 * ============================================================================
 *
 *  Снимает чистый кадр без игрового интерфейса: HUD прячется, подсказки
 *  управления и инвентарь не попадают в обложку.
 *
 *  Запуск: node dev/cover_clean.mjs [файл-вывода]
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';

const OUT = process.argv[2] || 'public/og-image.png';
fs.mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));

await page.goto('http://127.0.0.1:4205/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.click('#begin');
await page.waitForTimeout(7000);

// прячем весь игровой интерфейс — в обложке он только мешает
await page.evaluate(() => {
  const ui = document.getElementById('ui');
  if (ui) ui.style.display = 'none';
  const hints = document.querySelectorAll('.hints, #hints, #hotbar, #crosshair');
  hints.forEach((n) => { n.style.display = 'none'; });
});

await page.waitForTimeout(1500);
await page.screenshot({ path: OUT });
console.log(`✓ ${OUT}`);

console.log(errs.length ? `ошибки: ${errs.join(' | ')}` : 'ошибки: нет');
await browser.close();
