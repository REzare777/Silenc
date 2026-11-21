import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);
const info = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const it = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  p.teleport(it.pos.x + 1.2, it.pos.z + 1.2, 0);
  p.y = 0; p.groundY = 0;
  it.act();
  await new Promise((r) => setTimeout(r, 400));
  const c = d.ctx.systems.combat;
  const sh = d.ctx.systems.shadows;
  return {
    loc: d.ctx.loc,
    active: c.state.active,
    lit: c.state.lit,
    fuel: c.state.fuel,
    shadows: sh.list.length,
    viewmodelItem: d.ctx.viewmodel.itemName,
    viewmodelVisible: d.ctx.viewmodel.visible,
    lightIntensity: d.dungeonLoc.lights.lantern.intensity,
    states: sh.list.map((s) => `${s.state}:${s.veil}:${s.x.toFixed(0)},${s.z.toFixed(0)}`),
  };
});
console.log(JSON.stringify(info, null, 1));
await page.waitForTimeout(1200);
const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
if (frame && frame.length > 100) {
  fs.writeFileSync('/workspace/village/shots/R51_probe.jpg', Buffer.from(frame.split(',')[1], 'base64'));
  console.log('кадр снят');
}
console.log('ошибки:', errs.slice(0, 5));
await browser.close();
