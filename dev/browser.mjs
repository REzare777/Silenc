/**
 * ============================================================================
 *  Общие настройки запуска браузера для автотестов
 * ============================================================================
 *
 *  Раньше путь к Chromium был прописан жёстко, и на чужом компьютере
 *  тесты падали с «Executable doesn't exist». Теперь браузер ищется
 *  в таком порядке:
 *
 *   1. переменная окружения `CHROME_PATH` — если путь задан, он главный;
 *   2. системный кэш Playwright (`~/.cache/ms-playwright/chromium-<версия>/…`);
 *   3. стандартный браузер, установленный самим Playwright
 *      (`npx playwright install chromium`).
 *
 *  Сам Playwright ставится командой `npm install` (он в devDependencies),
 *  браузер — командой `npx playwright install chromium`.
 *
 *  @module dev/browser
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Ищет установленный Chromium/Chrome.
 *
 * @returns {string|undefined} путь к исполняемому файлу или undefined
 */
export function findChrome() {
  const env = process.env.CHROME_PATH;
  if (env && fs.existsSync(env)) return env;

  const roots = [
    path.join(process.env.HOME || '', '.cache', 'ms-playwright'),
    '/root/.cache/ms-playwright',
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    // ищем новейшую версию каталога chromium-*
    const dirs = fs.readdirSync(root)
      .filter((d) => d.startsWith('chromium'))
      .sort()
      .reverse();
    for (const d of dirs) {
      for (const rel of [
        ['chrome-linux', 'chrome'],
        ['chrome-linux', 'headless_shell'],
        ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
        ['chrome-win', 'chrome.exe'],
      ]) {
        const p = path.join(root, d, ...rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const chrome = findChrome();

/** Параметры запуска Chromium для тестов: софтверный рендер, без песочницы. */
export const LAUNCH = {
  ...(chrome ? { executablePath: chrome } : {}),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
};

/**
 * Запускает браузер с настройками по умолчанию.
 *
 * @returns {Promise<import('playwright').Browser>} браузер
 */
export async function launchBrowser(chromium) {
  return chromium.launch(LAUNCH);
}
