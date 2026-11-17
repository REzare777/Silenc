/**
 * ============================================================================
 *  Скан «тупиков»: где игрок вообще не может сдвинуться
 * ============================================================================
 *
 *  Идёт по карте сеткой и в каждой точке пробует сдвинуть игрока в четырёх
 *  направлениях. Если не сдвинулся ни в одну сторону — он «застрял».
 *  Для каждой застрявшей точки проверяем, есть ли рядом видимая геометрия:
 *   * геометрия есть  — настоящая стена (дом, забор, камень) — так и задумано;
 *   * геометрии нет   — невидимая стенка, её надо убрать.
 *
 *  Запуск: cd dev && node stuck_scan.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);

const res = await page.evaluate(() => {
  const d = window.__dbg, p = d.player, THREE = d.THREE;
  const put = (x, z) => { p.teleport(x, z, 0); p.y = 0; p.groundY = 0; p.vy = 0; p.keys.clear(); };
  const tryMove = (yaw) => {
    const x0 = p.pos.x, z0 = p.pos.z;
    for (let i = 0; i < 10; i++) { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
    return Math.hypot(p.pos.x - x0, p.pos.z - z0);
  };

  // видимая геометрия рядом: bbox мешей (лес-инстансы пропускаем)
  const items = [];
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const n = (o.name || '').toLowerCase();
    if (n.includes('forest') || n.includes('undergrowth') || n.includes('foliage')) return;
    if (o.isInstancedMesh && o.count > 400) return;
    const b = new THREE.Box3().setFromObject(o);
    if (!b.isEmpty()) items.push(b);
  });
  const hasGeometry = (x, z) => {
    const probe = new THREE.Box3(
      new THREE.Vector3(x - 1.1, 0.3, z - 1.1),
      new THREE.Vector3(x + 1.1, 2.2, z + 1.1));
    for (const b of items) if (b.intersectsBox(probe)) return true;
    return false;
  };

  const stuck = [];
  const STEP = 3;
  for (let gx = -45; gx <= 45; gx += STEP) {
    for (let gz = -45; gz <= 45; gz += STEP) {
      put(gx, gz);
      let moved = 0;
      for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        moved = Math.max(moved, tryMove(yaw));
        put(gx, gz);
      }
      if (moved < 0.25) {
        stuck.push({ x: gx, z: gz, geom: hasGeometry(gx, gz), y: +p.groundY.toFixed(2) });
      }
    }
  }
  const ghosts = stuck.filter((s) => !s.geom);
  return { total: Math.round((91 / STEP) ** 2), stuck, ghosts };
});

console.log(`точек проверено: ${res.total}`);
console.log(`застрял: ${res.stuck.length}`);
console.log(`из них БЕЗ видимой геометрии (невидимые стенки): ${res.ghosts.length}`);
if (res.ghosts.length) {
  for (const g of res.ghosts.slice(0, 40)) console.log('   ⚠', JSON.stringify(g));
}
const withGeom = res.stuck.filter((s) => s.geom);
console.log(`\nзастреваний у настоящих стен (нормально): ${withGeom.length}`);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
