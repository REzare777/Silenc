import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:4205/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2000);

// прогоняем животных по карте: игрок ходит, животные живут
const check = async (label) => page.evaluate((label) => {
  const d = window.__dbg;
  const bad = [];
  d.scene.traverse(o => {
    if (!['chicken','sheep','dog'].includes(o.name)) return;
    const x = o.position.x, z = o.position.z;
    for (const b of d.colliders.boxes) {
      const c = Math.cos(b.ang||0), s = Math.sin(b.ang||0);
      const dx = x-b.cx, dz = z-b.cz; const lx = c*dx-s*dz, lz = s*dx+c*dz;
      const qx = Math.max(-b.hx, Math.min(lx,b.hx)), qz = Math.max(-b.hz, Math.min(lz,b.hz));
      if (Math.hypot(lx-qx, lz-qz) < 0.1) bad.push({ name: o.name, x: +x.toFixed(1), z: +z.toFixed(1), что: 'в стене' });
    }
    for (const c of d.colliders.circles) {
      if (c.r < 0.14) continue;
      const dd = Math.hypot(x-c.x, z-c.z) - c.r;
      if (dd < 0.05) bad.push({ name: o.name, x: +x.toFixed(1), z: +z.toFixed(1), что: 'в круге r=' + c.r.toFixed(2), d: +dd.toFixed(2) });
    }
  });
  return { label, bad };
}, label);

console.log('старт:', JSON.stringify(await check('старт')));
// идём к курятнику и таскаем игрока по деревне
const walk = async (x, z, yaw, secs) => {
  await page.evaluate(([x,z,yaw]) => window.__dbg.teleport(x, z, yaw), [x,z,yaw]);
  await page.waitForTimeout(secs * 1000);
};
await walk(7.5, 13.5, 0.6, 6);
console.log('у курятника:', JSON.stringify(await check('у курятника')));
await walk(-30, 18, 1.2, 6);
console.log('у овец:', JSON.stringify(await check('у овец')));
await walk(-13.5, -7.5, 2.0, 6);
console.log('у собаки:', JSON.stringify(await check('у собаки')));
await walk(0, 0, 0, 6);
console.log('в центре:', JSON.stringify(await check('в центре')));
console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
