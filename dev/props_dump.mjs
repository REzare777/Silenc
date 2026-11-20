import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
const r = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  return (ctx.propSpots || []).map((p) => `${p.name} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) r=${p.r}`);
});
console.log(r.join('\n'));
await browser.close();
