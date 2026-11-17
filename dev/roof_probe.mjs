import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
const out = await page.evaluate(() => {
  const d = window.__dbg, p = d.player;
  const sp = (d.ctx.platforms || []).find((pl) => pl.sp).sp;
  const res = { probes: [], tops: [] };
  for (const ang of [1.9, 2.1, 2.4, 3.0, 3.6, 4.2]) {
    for (const r of [2.6, 3.0, 3.6]) {
      const x = sp.cx + Math.sin(ang) * r, z = sp.cz + Math.cos(ang) * r;
      res.probes.push({ ang: +ang.toFixed(1), r, g: +p.groundAt(x, z).toFixed(2) });
    }
  }
  // все платформы выше 11.5: сколько и где
  for (const pl of (d.ctx.platforms || [])) {
    if (pl.sp) continue;
    const y = pl.y ?? 0;
    if (y > 11.5 && y < 16) {
      res.tops.push({ x: +pl.cx.toFixed(2), z: +pl.cz.toFixed(2), hx: +pl.hx.toFixed(2), hz: +pl.hz.toFixed(2), y: +y.toFixed(2) });
    }
  }
  res.tops = res.tops.slice(0, 14);
  res.nTops = (d.ctx.platforms || []).filter((pl) => !pl.sp && (pl.y ?? 0) > 11.5).length;
  return res;
});
console.log('площадка (groundAt по углам/радиусам):');
for (const q of out.probes) console.log(`  ang=${q.ang} r=${q.r} -> y=${q.g}`);
console.log('платформ выше 11.5:', out.nTops);
for (const t of out.tops) console.log('  ', JSON.stringify(t));
await browser.close();
