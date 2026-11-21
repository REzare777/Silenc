import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack||'').split('\n').slice(0,4).join(' | ')));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0,200)); });
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
const r = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const it = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  p.teleport(it.pos.x + 1.2, it.pos.z + 1.2, 0);
  p.y = 0; p.groundY = 0;
  it.act();
  await new Promise((r) => setTimeout(r, 1500));
  const c = d.ctx.systems.combat;
  const L = d.ctx.systems.locations.dungeonLoc.lights.lantern;
  return {
    active: c.state.active, lit: c.state.lit, fuel: +c.state.fuel.toFixed(1),
    lightIntensity: +L.intensity.toFixed(2), lightDistance: L.distance,
    dbgSame: d.dungeonLoc === d.ctx.systems.locations.dungeonLoc,
    frames: window.__frames,
    combatUpdates: d.ctx.combatUpdates,
    before: d.ctx.__iBefore, after: d.ctx.__iAfter,
    setActiveCalls: d.ctx.setActiveCalls, lastSetActive: d.ctx.lastSetActive,
    lastActiveInUpdate: d.ctx.lastActiveInUpdate, locNow: d.ctx.loc,
    setActiveAt: d.ctx.setActiveAt, updateLog: d.ctx.updateLog, now: performance.now(),
  };
});
console.log(JSON.stringify(r));
await browser.close();
