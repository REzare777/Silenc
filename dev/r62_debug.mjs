import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const d = window.__dbg;
  const out = { groups: [], mats: [] };
  d.scene.children.forEach((c) => {
    if (c.isGroup) out.groups.push(c.name);
  });
  d.scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.name && !out.mats.includes(o.material.name)) {
      out.mats.push(o.material.name);
    }
  });
  out.hasChurchGroup = !!d.scene.getObjectByName('church');
  out.churchNames = d.scene.children.map((c) => c.name).slice(0, 20);
  return out;
});
console.log(JSON.stringify(info, null, 1).slice(0, 2000));
await browser.close();
