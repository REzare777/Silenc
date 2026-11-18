/**
 * ============================================================================
 *  Замер FPS: деревня, таверна, храм, подземелье
 * ============================================================================
 *
 *  «В храме фризит» — проверяем, действительно ли в локации просадка.
 *  Меряем реальные кадры в браузере (софтварный рендер — цифры ниже, чем
 *  на машине игрока, но сравнение между локациями честное).
 *
 *  Запуск: cd dev && node fps_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const measure = async (label, setup) => {
  const info = await page.evaluate(async ({ setup }) => {
    const d = window.__dbg;
    // eslint-disable-next-line no-new-func
    new Function('d', setup)(d);
    await new Promise((r) => setTimeout(r, 1200));
    // считаем кадры 3 секунды
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 > 3000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const dt = (performance.now() - t0) / 1000;
    let lights = 0, meshes = 0;
    d.ctx.renderPass.scene.traverse((o) => { if (o.isLight) lights++; if (o.isMesh) meshes++; });
    return { fps: +(frames / dt).toFixed(1), lights, meshes };
  }, { setup });
  console.log(`${label}: ${info.fps} FPS | источников света: ${info.lights} | мешей: ${info.meshes}`);
  return info;
};

await measure('деревня   ', 'd.ctx.env.setTimeOfDay("day", true); d.ctx.systems.locations.setLocation("village");');
await measure('таверна   ', 'd.ctx.systems.locations.setLocation("tavern");');
await measure('храм      ', 'd.ctx.systems.locations.setLocation("church");');
await measure('подземелье', 'd.ctx.systems.locations.setLocation("dungeon");');
await measure('деревня   ', 'd.ctx.systems.locations.setLocation("village");');

console.log('ошибки: ' + errs.length, errs.slice(0, 3));
await browser.close();
