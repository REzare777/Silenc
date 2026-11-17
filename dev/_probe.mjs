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
  const church = d.ctx.scene.getObjectByName('church');
  const wp = new d.THREE.Vector3();
  church.getWorldPosition(wp);
  const box = new d.THREE.Box3().setFromObject(church);
  const door = d.ctx.doors.church;
  return {
    churchPos: wp.toArray().map((v) => +v.toFixed(2)),
    churchBox: { min: box.min.toArray().map((v) => +v.toFixed(1)), max: box.max.toArray().map((v) => +v.toFixed(1)) },
    door: { x: +door.x.toFixed(2), z: +door.z.toFixed(2), ry: +door.ry.toFixed(3) },
  };
});
console.log(JSON.stringify(info));
await browser.close();
