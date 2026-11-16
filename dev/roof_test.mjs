import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text())) errs.push(m.text().slice(0, 160)); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.waitForSelector('#begin');
await page.waitForTimeout(700);
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);

const out = {};

/* ---------- 1. у мельницы нет крыши: сверху плоская площадка ---------- */
out.мельница = await page.evaluate(() => {
  const d = window.__dbg, THREE = d.THREE;
  const MX = 34, MZ = -33;
  let thatchAbove = 0, meshesAbove = 0;
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    o.updateWorldMatrix(true, false);
    bb.applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (Math.hypot(cx - MX, cz - MZ) > 3.2) return;
    if (bb.max.y <= 12.4) return;
    meshesAbove++;
    const mat = o.material;
    const isThatch = mat && mat.map && mat.map.name === 'thatch';
    if (isThatch) thatchAbove++;
  });
  // площадка наверху: платформа на высоте ~9.6
  const deck = d.platforms.filter((p) => Math.hypot(p.cx - MX, p.cz - MZ) < 4 && Math.abs(p.y - 11.6) < 0.4).length;
  return { чтото_выше_площадки: meshesAbove, солома_выше: thatchAbove, платформ_на_верху: deck };
});

/* ---------- 2. горн и наковальня в кузне — препятствия ---------- */
out.кузня = await page.evaluate(async () => {
  const d = window.__dbg, THREE = d.THREE;
  // кузня стоит в (14.5, -8)
  const res = {};
  const near = d.colliders.boxes.filter((b) => Math.hypot(b.cx - 14.5, b.cz + 8) < 5);
  res.коллайдеров_рядом = near.length;
  res.размеры = near.map((b) => [+b.hx.toFixed(2), +b.hz.toFixed(2)]);

  // пробуем пройти сквозь наковальню и горн
  const tryWalk = async (tx, tz, label) => {
    d.player.teleport(tx, tz, 0);
    await new Promise((r) => setTimeout(r, 400));
    for (let i = 0; i < 40; i++) d.player.update(1 / 60);
    return { label, до: [+tx.toFixed(1), +tz.toFixed(1)], стало: [+d.player.pos.x.toFixed(1), +d.player.pos.z.toFixed(1)] };
  };
  // наковальня стоит в локальных (0.4, -0.4) от центра кузни
  res.наковальня = await tryWalk(14.5 + 0.4, -8 - 0.4, 'наковальня');
  res.горн = await tryWalk(14.5 - 3 + 1.2, -8 + 2.5 - 1.4, 'горн');
  return res;
});

/* ---------- 3. крыши: изнутри есть потолок ---------- */
out.крыши = await page.evaluate(() => {
  const d = window.__dbg, THREE = d.THREE;
  // дом (-11,8): стены 6x5, высота 3.1, крыша на 0.5+3.1=3.6
  const check = (name, x, z, ceilY) => {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, 1.2, z), new THREE.Vector3(0, 1, 0), 0.01, 12);
    const meshes = [];
    d.scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
    const hits = ray.intersectObjects(meshes, false);
    return { имя: name, попаданий_вверх: hits.length, высота: hits.length ? +hits[0].point.y.toFixed(2) : null };
  };
  return {
    дом: check('домик', -11, 8, 3.6),
    таверна: check('таверна', -17, -13, 6.8),
    кузня: check('кузня', 14.5, -8, 3.0),
  };
});

/* ---------- 4. фронтоны из кровельного материала (крыша читается целиком) ---------- */
out.фронтоны = await page.evaluate(() => {
  const d = window.__dbg, THREE = d.THREE;
  // у домика (-11,8) крыша из соломы: ищем соломенную геометрию выше стен
  let thatchHigh = 0, plasterHigh = 0;
  d.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone();
    o.updateWorldMatrix(true, false);
    bb.applyMatrix4(o.matrixWorld);
    const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    if (Math.hypot(cx + 11, cz - 8) > 5) return;
    if (bb.max.y < 3.6) return;             // выше стен — это крыша
    const m = o.material;
    const M = d.M;
    if (m === M.thatch) thatchHigh++;
    if (m === M.plaster || m === M.plasterWarm || m === M.plasterGrey) plasterHigh++;
  });
  return { солома_выше_стен: thatchHigh, штукатурка_выше_стен: plasterHigh };
});

console.log(JSON.stringify(out, null, 1));
console.log('ошибки:', errs.length ? errs : 'нет');
await browser.close();
