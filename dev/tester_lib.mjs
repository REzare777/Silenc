/**
 * Общие помощники для ручного тестирования игры «Шёпот-Долина».
 *
 * Рендер программный (SwiftShader): один кадр — 10–60 секунд.
 * Поэтому здесь нет «покадровой» симуляции на sleep: продвижение игры
 * делается прямыми вызовами внутренних функций через `window.__dbg`,
 * а скриншот снимается только после реального роста `window.__frames`.
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const SHOTS = '/workspace/village/shots';
export const URL_BASE = 'http://127.0.0.1:4205/';

fs.mkdirSync(SHOTS, { recursive: true });

/**
 * Открыть игру и дождаться первого отрисованного кадра.
 *
 * @param {object} [opt]
 * @param {boolean} [opt.start] сразу нажать «Начать игру»
 * @param {number} [opt.w] ширина вьюпорта
 * @param {number} [opt.h] высота вьюпорта
 * @returns {Promise<{browser:object, page:object, errors:string[]}>}
 */
export async function openGame(opt = {}) {
  const { start = true, w = 1024, h = 576 } = opt;
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
  });
  page.on('requestfailed', (r) => {
    const f = r.failure();
    errors.push('REQFAIL: ' + r.url() + ' — ' + (f ? f.errorText : '?'));
  });
  let gotoOk = false;
  for (let attempt = 0; attempt < 3 && !gotoOk; attempt++) {
    try {
      await page.goto(URL_BASE + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 120000 });
      gotoOk = true;
    } catch (e) {
      if (attempt === 2) throw e;
      console.log('  ! goto не удался, повтор: ' + e.message.split('\n')[0]);
      await page.waitForTimeout(3000);
    }
  }
  await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
  if (start) {
    await page.evaluate(() => {
      const b = document.getElementById('begin');
      if (b) b.click();
    });
    await page.waitForFunction(() => !!window.__dbg && !!window.__dbg.ctx, null, { timeout: 60000 });
  }
  return { browser, page, errors };
}

/**
 * Дождаться, пока счётчик кадров вырастет на `n`.
 *
 * @param {object} page
 * @param {number} [n]
 * @param {number} [timeout]
 */
export async function waitFrames(page, n = 1, timeout = 180000) {
  const start = await page.evaluate(() => window.__frames || 0);
  await page.waitForFunction(
    (target) => (window.__frames || 0) >= target,
    start + n,
    { timeout, polling: 250 }
  );
  return page.evaluate(() => window.__frames || 0);
}

/**
 * Снять кадр САМОГО 3D-канваса через внутренний `__grab`
 * (он снимает буфер сразу после отрисовки — значит, кадр всегда свежий).
 *
 * @param {object} page
 * @param {string} file абсолютный путь файла
 */
export async function grabScene(page, file) {
  await waitFrames(page, 1);
  const b64 = await page.evaluate(() => new Promise((resolve) => {
    window.__frame = null;
    window.__grab = { resolve: () => resolve(window.__frame) };
    setTimeout(() => resolve(window.__frame || ''), 120000);
  }));
  if (!b64 || !b64.startsWith('data:')) throw new Error('grabScene: кадр не получен (' + String(b64).slice(0, 40) + ')');
  const raw = b64.split(',')[1];
  fs.writeFileSync(file, Buffer.from(raw, 'base64'));
  return file;
}

/**
 * Снять скриншот всей страницы (для UI: меню, инвентарь, торговля).
 *
 * @param {object} page
 * @param {string} file
 */
export async function shotPage(page, file, timeout = 180000) {
  await waitFrames(page, 1);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout, animations: 'disabled' });
  return file;
}

/**
 * Открыть игру, выполнить тест и гарантированно закрыть браузер.
 *
 * @param {object} opt
 * @param {Function} fn
 */
export async function withGame(opt, fn) {
  const { browser, page, errors } = await openGame(opt);
  try {
    await fn(page, errors);
  } finally {
    try { await browser.close(); } catch { /* уже закрыт */ }
  }
  return errors;
}

/**
 * Проверить, что картинка не чёрная (средняя яркость).
 */
export async function brightness(page) {
  return page.evaluate(() => {
    const c = window.__dbg.renderer.domElement;
    const tmp = document.createElement('canvas');
    tmp.width = 160; tmp.height = 90;
    const g = tmp.getContext('2d');
    g.drawImage(c, 0, 0, tmp.width, tmp.height);
    const d = g.getImageData(0, 0, tmp.width, tmp.height).data;
    let sum = 0; let min = 255; let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      sum += l; if (l < min) min = l; if (l > max) max = l;
    }
    return { avg: +(sum / (d.length / 4)).toFixed(2), min: +min.toFixed(1), max: +max.toFixed(1) };
  });
}


/**
 * Прочитать JPEG и посчитать статистики яркости (нужен браузер для декодирования).
 *
 * @param {object} page
 * @param {string} file
 */
export async function imgStats(page, file) {
  const b64 = fs.readFileSync(file).toString('base64');
  return page.evaluate(async (data) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + data;
    await img.decode();
    const w = img.width, h = img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let sum = 0, min = 255, max = 0, dark = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      sum += l; if (l < min) min = l; if (l > max) max = l;
      if (l < 18) dark++;
    }
    return { w, h, avg: +(sum / n).toFixed(2), min: +min.toFixed(1), max: +max.toFixed(1), darkPct: +(dark / n * 100).toFixed(1) };
  }, b64);
}

/** Пробуждение клавиши. */
export async function key(page, k, ms = 60) {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
}

/** Печать отчёта в консоль. */
export function report(title, obj) {
  console.log('\n=== ' + title + ' ===');
  console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}
