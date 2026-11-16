import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const URL = process.env.LIVE_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(240000);
await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const d = window.__dbg;
  let meshes = 0, broken = 0, zeroArea = 0, tris = 0;
  const bad = [];
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    meshes++;
    const g = o.geometry, pos = g.attributes.position, nor = g.attributes.normal, idx = g.index;
    if (!nor) { bad.push('нет нормалей: ' + (o.name || o.material?.name || '?')); broken++; return; }
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < nor.count; i++) {
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
      if (!isFinite(nx) || !isFinite(ny) || !isFinite(nz) || (nx === 0 && ny === 0 && nz === 0)) {
        broken++;
        const mat = Object.keys(d.M).find(k => d.M[k] === o.material) || '?';
        const bb = new d.THREE.Box3().setFromBufferAttribute(pos);
        bad.push({ мате: mat, имя: o.name || '', тип: g.type, вершин: nor.count, idx: !!idx,
          n: [nx, ny, nz], i,
          мин: bb.min.toArray().map(v=>+v.toFixed(1)), макс: bb.max.toArray().map(v=>+v.toFixed(1)) });
        break;
      }
    }
    // вырожденные треугольники
    for (let t = 0; t < n; t += 3) {
      tris++;
      const ix = [0,1,2].map(k => idx ? idx.getX(t+k) : t+k);
      const a = new d.THREE.Vector3().fromBufferAttribute(pos, ix[0]);
      const b = new d.THREE.Vector3().fromBufferAttribute(pos, ix[1]);
      const c = new d.THREE.Vector3().fromBufferAttribute(pos, ix[2]);
      const area = new d.THREE.Vector3().subVectors(b,a).cross(new d.THREE.Vector3().subVectors(c,a)).length() / 2;
      if (area < 1e-7) zeroArea++;
    }
  });
  const uniq = {}; for (const b of bad) uniq[b.мате + '|' + b.имя] = (uniq[b.мате + '|' + b.имя] || 0) + 1;
  return { мешей: meshes, битыхНормалей: broken, вырожденныхТреугольников: zeroArea, треугольников: tris,
    список: bad.slice(0, 12), поИмени: uniq };
});
console.log(JSON.stringify(out));
await browser.close();
