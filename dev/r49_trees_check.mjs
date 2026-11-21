import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.setDefaultTimeout(240000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
const r = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  const THREE = window.__dbg.THREE;
  const trees = [];
  ctx.scene.traverse((o) => {
    if (!o.isInstancedMesh) return;
    if (!/forest/i.test(o.name)) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const p = new THREE.Vector3().setFromMatrixPosition(m);
      trees.push({ x: p.x, z: p.z, name: o.name });
    }
  });
  const fields = ctx.fields || [];
  const out = [];
  for (const f of fields) {
    const inside = trees.filter((t) => Math.abs(t.x - f.x) < f.w / 2 + 1 && Math.abs(t.z - f.z) < f.d / 2 + 1);
    const near = trees.filter((t) => Math.abs(t.x - f.x) < f.w / 2 + 6 && Math.abs(t.z - f.z) < f.d / 2 + 6);
    out.push({ field: `${f.x},${f.z}`, inside: inside.length, near: near.length,
      sample: inside.slice(0, 8).map((t) => `${t.x.toFixed(0)},${t.z.toFixed(0)}`) });
  }
  const bx = -30, bz = 64;
  const sorted = trees.map((t) => ({ t, d: Math.hypot(t.x - bx, t.z - bz) })).sort((a, b) => a.d - b.d);
  const nearBarn = sorted.slice(0, 16).map((o) => `${o.t.x.toFixed(0)},${o.t.z.toFixed(0)}:${o.d.toFixed(1)}`);
  return { total: trees.length, out, nearBarn };
});
console.log('деревьев в инстансах:', r.total);
for (const f of r.out) console.log('поле', f.field, 'внутри:', f.inside, 'рядом:', f.near, f.sample.join(' '));
console.log('ближайшие к амбару:', r.nearBarn.join('  '));
await browser.close();
