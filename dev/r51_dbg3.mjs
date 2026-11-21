import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
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
  await new Promise((r) => setTimeout(r, 800));
  const c = d.ctx.systems.combat;
  const out = {
    hasLocations: !!d.ctx.systems.locations,
    hasDungeon: !!(d.ctx.systems.locations && d.ctx.systems.locations.dungeonLoc),
    hasLights: !!(d.ctx.systems.locations && d.ctx.systems.locations.dungeonLoc && d.ctx.systems.locations.dungeonLoc.lights),
    hasLantern: !!(d.ctx.systems.locations && d.ctx.systems.locations.dungeonLoc && d.ctx.systems.locations.dungeonLoc.lights && d.ctx.systems.locations.dungeonLoc.lights.lantern),
  };
  // вызовем обновление вручную
  try { c.update(0.016, 5); out.manualCall = 'ok'; } catch (e) { out.manualCall = 'ERR ' + e.message; }
  out.after = d.ctx.systems.locations.dungeonLoc.lights.lantern.intensity;
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
