import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(120000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 120000 });
const info = await page.evaluate(() => {
  const d = window.__dbg;
  const out = { doorsType: Object.prototype.toString.call(d.ctx.doors), keys: Object.keys(d.ctx.doors || {}) };
  out.tavern = d.ctx.doors && d.ctx.doors.tavern ? { x: d.ctx.doors.tavern.x, z: d.ctx.doors.tavern.z, isVec: !!d.ctx.doors.tavern.isVector3 } : null;
  out.tavernRy = d.ctx.doors ? d.ctx.doors.tavernRy : 'нет doors';
  out.loc = d.loc;
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
