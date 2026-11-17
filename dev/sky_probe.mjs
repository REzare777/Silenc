import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const d = window.__dbg, env = d.env;
  const read = () => ({
    top: '#' + env.uniforms.topColor.value.getHexString(),
    horizon: '#' + env.uniforms.horizonColor.value.getHexString(),
    current: env.current, target: env.target, phaseTime: +env.phaseTime.toFixed(1),
  });
  const before = read();
  env.setTimeOfDay('day', true);
  const afterDay = read();
  env.setTimeOfDay('morning', true);
  const afterMorning = read();
  return { before, afterDay, afterMorning, clock: document.getElementById('clock')?.textContent };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
