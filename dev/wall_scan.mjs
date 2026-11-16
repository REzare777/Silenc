/**
 * Диагностика «невидимых стенок» в интерьере таверны.
 *
 * Для каждого коллайдера проверяем, есть ли рядом с ним видимая геометрия:
 * пускаем лучи из центра коллайдера в шесть сторон и смотрим, попадает ли
 * луч в меш в пределах половины размера коллайдера. Если попаданий нет —
 * коллайдер «висит в воздухе»: игрок упирается в пустоту.
 *
 * Запуск: cd dev && node wall_scan.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.waitForTimeout(1000);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(1500);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('tavern');
  const THREE = d.THREE;
  const group = d.tavernLoc.group;
  const names = {};
  for (const [k, v] of Object.entries(d.M)) if (v && v.isMaterial) names[v.uuid] = k;

  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const DIRS = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ];

  const boxes = d.tavernLoc.colliders.boxes || [];
  const circles = d.tavernLoc.colliders.circles || [];
  const all = [];
  boxes.forEach((b, i) => all.push({ kind: 'box', i, ...b }));
  circles.forEach((c, i) => all.push({ kind: 'circle', i, ...c }));

  const probe = (cx, cy, cz, reach) => {
    const hits = [];
    for (const dir of DIRS) {
      ray.set(new THREE.Vector3(cx, cy, cz), dir);
      ray.far = reach;
      const inter = ray.intersectObjects(meshes, false);
      if (inter.length) {
        const m = inter[0].object.material;
        hits.push({ dir: `${dir.x},${dir.y},${dir.z}`, d: +inter[0].distance.toFixed(2), mat: names[m && m.uuid] || '?' });
      }
    }
    return hits;
  };

  /**
   * Покрытие объёма коллайдера геометрией: сэмплируем точки внутри
   * и проверяем, есть ли рядом с каждой видимая поверхность.
   */
  const coverage = (cx, cy, cz, hx, hy, hz) => {
    let inside = 0, total = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          const px = cx - hx + (2 * hx * (i + 0.5)) / 4;
          const py = cy - hy + (2 * hy * (j + 0.5)) / 4;
          const pz = cz - hz + (2 * hz * (k + 0.5)) / 4;
          total++;
          if (probe(px, py, pz, 0.22).length) inside++;
        }
      }
    }
    return total ? inside / total : 0;
  };

  const list = all.map((c) => {
    const isBox = c.kind === 'box';
    const hx = isBox ? c.hx : c.r;
    const hz = isBox ? c.hz : c.r;
    const cx = c.cx ?? c.x, cz = c.cz ?? c.z;
    const y0 = c.y0 ?? 0, y1 = c.y1 ?? 1.8;
    const cy = (y0 + y1) / 2;
    const reach = Math.max(hx, hz, (y1 - y0) / 2) + 0.12;
    const hits = probe(cx, cy, cz, reach);
    const near = hits.filter((h) => h.d <= reach + 0.01);
    const cov = coverage(cx, cy, cz, Math.max(hx, 0.05), Math.max((y1 - y0) / 2, 0.05), Math.max(hz, 0.05));
    return {
      cover: +cov.toFixed(2),
      kind: c.kind, i: c.i,
      pos: `${cx.toFixed(2)},${cz.toFixed(2)}`,
      y: `${y0.toFixed(2)}..${y1.toFixed(2)}`,
      size: isBox ? `${(hx * 2).toFixed(2)}×${(hz * 2).toFixed(2)}` : `r${c.r}`,
      visible: near.length > 0,
      near: near.map((h) => `${h.dir}@${h.d}(${h.mat})`).join(' '),
    };
  });

  return {
    total: list.length,
    invisible: list.filter((x) => !x.visible),
    thin: list.filter((x) => x.cover < 0.6 && parseFloat(x.y.split('..')[1]) > 1.6),
    upper: list.filter((x) => parseFloat(x.y.split('..')[1]) > 4.4),
  };
});

console.log('всего коллайдеров:', res.total);
console.log('\n=== БЕЗ ВИДИМОЙ ГЕОМЕТРИИ (игрок упирается в пустоту) ===');
for (const c of res.invisible) {
  console.log(`  ${c.kind}#${c.i}  pos=${c.pos}  y=${c.y}  размер=${c.size}`);
}
console.log('\n=== ПОКРЫТИЕ ОБЪЁМА < 60% (коллайдер шире видимой стены) ===');
for (const c of res.thin) {
  console.log(`  ${c.kind}#${c.i}  pos=${c.pos}  y=${c.y}  размер=${c.size}  покрытие=${c.cover}`);
}
console.log('\n=== коллайдеры верхнего уровня (y1 > 4.4) ===');
for (const c of res.upper) {
  console.log(`  ${c.kind}#${c.i}  pos=${c.pos}  y=${c.y}  размер=${c.size}  ${c.visible ? 'видимая' : 'НЕВИДИМАЯ'}  ${c.near}`);
}
console.log('\nошибки:', errs.length, errs.slice(0, 3));
await browser.close();
