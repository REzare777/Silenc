/**
 * Замер производительности сцены: кадры, draw-call-ы, треугольники, свет.
 *
 * Сравнение «до/после» раунда 42 (лес нарезан на чанки, точечных источников
 * втрое меньше). Запуск: cd dev && node r42_perf.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const d = window.__dbg;
  const res = {};
  const sample = async (label, setup) => {
    // eslint-disable-next-line no-new-func
    new Function('d', setup)(d);
    await new Promise((r) => setTimeout(r, 800));
    let frames = 0;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 > 4000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const dt = (performance.now() - t0) / 1000;
    const info = d.renderer.info;
    res[label] = {
      fps: +(frames / dt).toFixed(2),
      ms: +(dt / frames * 1000).toFixed(0),
      calls: info.render.calls,
      tris: info.render.triangles,
      lights: info.render.frame ? undefined : undefined,
    };
  };
  // 1. центр деревни
  await sample('village_center', 'd.player.teleport(0, 16, Math.PI);');
  // 2. у пруда
  await sample('village_pond', 'd.player.teleport(40, -18, Math.PI);');
  // 3. в храме
  await sample('church', "d.ctx.systems.locations.setLocation('church');");
  // 4. в таверне
  await sample('tavern', "d.ctx.systems.locations.setLocation('tavern');");
  d.ctx.systems.locations.setLocation('village');
  let lights = 0;
  let inst = 0;
  d.ctx.scene.traverse((o) => {
    if (o.isPointLight && o.visible) lights++;
    if (o.isInstancedMesh) inst++;
  });
  res.counts = { lights, inst };
  return res;
});

for (const [k, v] of Object.entries(out)) {
  if (k === 'counts') console.log(`счётчики сцены:`, JSON.stringify(v));
  else console.log(`${k}: ${v.fps} FPS (${v.ms} мс/кадр), draw-call-ов ${v.calls}, треугольников ${v.tris}`);
}
console.log('ошибки:', errs.length, errs.slice(0, 2));
await browser.close();
