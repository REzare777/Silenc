import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 300)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const d = window.__dbg;
  const pls = d.ctx.platforms || [];
  const near = pls.filter((pl) => !pl.sp && Math.abs((pl.y ?? 0) - 11.6) < 0.05);
  return {
    total: pls.length,
    nearTop: near.length,
    sample: near.slice(0, 4).map((pl) => ({ cx: pl.cx, cz: pl.cz, hx: pl.hx, hz: pl.hz, y: pl.y })),
    keys: Object.keys(pls[0] || {}),
  };
});
console.log(JSON.stringify(info, null, 1));
console.log('ошибки:', errs.slice(0, 3));
await browser.close();
