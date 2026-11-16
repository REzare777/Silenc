/** Диагностика освещения подземелья: сколько источников, какие интенсивности. */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(800);

const info = await page.evaluate(() => {
  const d = window.__dbg;
  d.setLocation('dungeon');
  const sc = d.sceneDungeon;
  const out = { ambient: [], hemi: [], dir: [], point: 0, pointSum: 0, mats: {}, exposure: null, tone: null };
  let wallMesh = null, floorMesh = null;
  sc.traverse((o) => {
    if (o.isAmbientLight) out.ambient.push([o.color.getHexString(), o.intensity]);
    if (o.isHemisphereLight) out.hemi.push([o.color.getHexString(), o.groundColor.getHexString(), o.intensity]);
    if (o.isDirectionalLight) out.dir.push([o.color.getHexString(), o.intensity, o.position.toArray().map((v) => +v.toFixed(1))]);
    if (o.isPointLight) { out.point++; out.pointSum += o.intensity; }
    if (o.name === 'dungeonWalls') wallMesh = o;
    if (o.name === 'dungeonFloor') floorMesh = o;
  });
  const wr = d.renderer || window.renderer;
  if (wr) {
    out.exposure = wr.toneMappingExposure;
    out.tone = wr.toneMapping;
  }
  if (wallMesh) {
    const mats = [];
    wallMesh.traverse((o) => {
      if (o.isMesh && o.material) {
        const m = o.material;
        mats.push({ color: m.color ? m.color.getHexString() : '?', map: !!m.map, type: m.type });
      }
    });
    out.mats.wall = mats.slice(0, 4);
  }
  // сколько всего объектов в сцене
  let meshes = 0, sprites = 0, points = 0;
  sc.traverse((o) => { if (o.isMesh) meshes++; if (o.isSprite) sprites++; if (o.isPoints) points++; });
  out.meshes = meshes; out.sprites = sprites; out.points = points;
  out.fog = sc.fog ? sc.fog.density : null;
  out.bg = sc.background ? sc.background.getHexString() : null;
  return out;
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
