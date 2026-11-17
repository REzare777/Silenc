/**
 * Отладка кадра таверны: где стоит камера и что перед ней.
 * Запуск: cd dev && node tav_probe.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const d = window.__dbg, THREE = d.THREE;
  const t = d.ctx.doors.tavern;
  const fx = -Math.sin(t.ry), fz = -Math.cos(t.ry);
  const cam = new THREE.Vector3(t.x + fx * 8, 2.4, t.z + fz * 8);
  const look = new THREE.Vector3(t.x + fx * 1.5, 3.2, t.z + fz * 1.5);
  // что под камерой и на луче
  const rc = new THREE.Raycaster();
  const down = rc.set(cam, new THREE.Vector3(0, -1, 0));
  const hitDown = rc.intersectObjects(d.scene.children, true).slice(0, 3)
    .map((h) => ({ n: h.object.name || h.object.type, y: +h.point.y.toFixed(2), dist: +h.distance.toFixed(2) }));
  const dir = look.clone().sub(cam).normalize();
  const fwd = rc.set(cam, dir);
  const hitFwd = rc.intersectObjects(d.scene.children, true).slice(0, 5)
    .map((h) => ({ n: h.object.name || h.object.type, d: +h.distance.toFixed(2) }));
  return {
    door: { x: +t.x.toFixed(2), z: +t.z.toFixed(2), ry: +t.ry.toFixed(3) },
    out: { fx: +fx.toFixed(3), fz: +fz.toFixed(3) },
    cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
    look: [+look.x.toFixed(2), +look.y.toFixed(2), +look.z.toFixed(2)],
    hitDown, hitFwd,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
