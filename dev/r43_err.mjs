/**
 * Быстрая диагностика: ошибки при загрузке страницы.
 * Запуск: cd dev && node r43_err.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(60000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 400)); });
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(45000);
const ready = await page.evaluate(() => !!window.__villageReady);
console.log('ready:', ready);
console.log('ошибки:', errs.length);
for (const e of errs.slice(0, 8)) console.log('---\n' + e);
await browser.close();
