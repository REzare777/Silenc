import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('ERR', e.message.slice(0, 200)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
const out = await page.evaluate(() => {
  const d = window.__dbg, p = d.player;
  const sp = (d.ctx.platforms || []).find((pl) => pl.sp).sp;
  const put = (x, z) => { p.teleport(x, z, 0); p.y = 0; p.groundY = 0; p.vy = 0; p.keys.clear(); };
  const step = (yaw, n) => { for (let i = 0; i < n; i++) { p.yaw = yaw; p.keys.add('KeyW'); p.update(1/60); } p.keys.clear(); };
  const total = sp.turns * Math.PI * 2;
  const at = (t) => {
    const a = sp.a0 + total * t;
    const rOut = sp.rOut0 + (sp.rOut1 - sp.rOut0) * t;
    const r = (sp.rIn + rOut) / 2;
    return { x: sp.cx + Math.sin(a) * r, z: sp.cz + Math.cos(a) * r, y: sp.y0 + (sp.y1 - sp.y0) * t };
  };
  const st0 = at(0.02);
  put(st0.x, st0.z);
  const log = [];
  let maxY = 0;
  for (let i = 1; i <= 340; i++) {
    const t = 0.02 + (i / 340) * 0.98;
    const tgt = at(t);
    const yaw = Math.atan2(-(tgt.x - p.pos.x), -(tgt.z - p.pos.z));
    step(yaw, 2);
    maxY = Math.max(maxY, p.groundY);
    if (i % 40 === 0) log.push(`шаг ${i}: y=${p.groundY.toFixed(2)} (цель ${tgt.y.toFixed(2)}) d=${Math.hypot(p.pos.x - tgt.x, p.pos.z - tgt.z).toFixed(2)} r=${Math.hypot(p.pos.x - sp.cx, p.pos.z - sp.cz).toFixed(2)}`);
  }
  // подъём на жёлтую крышу: с площадки — к центру конуса
  // старт на смотровой площадке (снаружи башни), шаг к оси
  const gal = (d.ctx.platforms || []).find((pl) => !pl.sp && Math.abs((pl.y ?? 0) - sp.y1) < 0.05 && pl.hx > 1.2);
  put(gal.cx, gal.cz);
  p.groundY = sp.y1; p.y = 0;
  const roof = { log: [], maxY: 0 };
  for (let i = 1; i <= 260; i++) {
    const yaw = Math.atan2(-(sp.cx - p.pos.x), -(sp.cz - p.pos.z));
    step(yaw, 2);
    roof.maxY = Math.max(roof.maxY, p.groundY);
    if (i % 40 === 0) roof.log.push(`крыша шаг ${i}: y=${p.groundY.toFixed(2)} r=${Math.hypot(p.pos.x - sp.cx, p.pos.z - sp.cz).toFixed(2)}`);
  }
  return { log, maxY, y1: sp.y1, rOut1: sp.rOut1, rIn: sp.rIn, roof };
});
console.log(out.log.join('\n'));
console.log('\n--- крыша ---\n' + out.roof.log.join('\n') + '\nroof maxY:', out.roof.maxY.toFixed(2));
console.log('maxY:', out.maxY.toFixed(2), 'цель:', out.y1, 'rOut1:', out.rOut1.toFixed(2), 'rIn:', out.rIn);
await browser.close();
