/**
 * Проверка «невидимых стен» на втором этаже таверны.
 *
 * Для ключевых точек (выход из лестницы, ниши A/B/C) скрипт:
 *   1) находит коллайдеры рядом и проверяет, есть ли у них видимая геометрия;
 *   2) моделирует движение игрока и находит, где он упирается.
 *
 * Запуск: cd dev && node niche_check.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
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
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  group.updateMatrixWorld(true);
  const names = {};
  for (const [k, v] of Object.entries(d.M)) if (v && v.isMaterial) names[v.uuid] = k;
  const ray = new THREE.Raycaster();

  const hasGeom = (x, y, z, reach = 0.3) => {
    ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0));
    ray.far = reach;
    const up = ray.intersectObjects(meshes, false).length > 0;
    ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0));
    ray.far = reach;
    const down = ray.intersectObjects(meshes, false).length > 0;
    ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(1, 0, 0));
    ray.far = reach;
    const right = ray.intersectObjects(meshes, false).length > 0;
    ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(-1, 0, 0));
    ray.far = reach;
    const left = ray.intersectObjects(meshes, false).length > 0;
    return { up, down, right, left };
  };

  const boxes = (d.tavernLoc.colliders.boxes || []).map((b, i) => ({ i, kind: 'box', ...b }));
  const near = (x, z, y, rad) => boxes.filter((b) => {
    const dx = Math.abs(b.cx - x), dz = Math.abs(b.cz - z);
    return dx < b.hx + rad && dz < b.hz + rad && b.y1 > y - 1.2 && b.y0 < y + 1.2;
  }).map((b) => {
    const g = hasGeom(b.cx, (b.y0 + b.y1) / 2, b.cz, 0.45);
    const visible = g.up || g.down || g.right || g.left;
    return {
      i: b.i, cx: +b.cx.toFixed(2), cz: +b.cz.toFixed(2),
      hx: +b.hx.toFixed(2), hz: +b.hz.toFixed(2),
      y: `${b.y0.toFixed(2)}..${b.y1.toFixed(2)}`,
      visible, dirs: Object.entries(g).filter(([, v]) => v).map(([k]) => k).join(',') || '—',
    };
  });

  // --- моделирование движения игрока ---
  const p = d.player;
  const walk = (x0, z0, yaw, frames = 150) => {
    p.teleport(x0, z0, yaw);
    p.y = 0; p.groundY = 4.25; p.vy = 0; p.grounded = true;
    const start = { x: p.pos.x, z: p.pos.z };
    for (let i = 0; i < frames; i++) { p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
    return { from: start, to: { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) } };
  };

  const rooms = d.tavernLoc.rooms.map((r) => ({
    name: r.name, doorX: +r.doorX.toFixed(2), doorZ: +r.doorZ.toFixed(2),
    bedX: +r.bedX.toFixed(2), bedZ: +r.bedZ.toFixed(2),
  }));

  const out = { rooms, spots: [] };

  // 1. выход из лестницы: 8 направлений
  const ladderOut = { x: -5.63, z: 4.5 };
  for (let k = 0; k < 8; k++) {
    const yaw = (k / 8) * Math.PI * 2;
    const w = walk(ladderOut.x, ladderOut.z, yaw, 90);
    const moved = Math.hypot(w.to.x - w.from.x, w.to.z - w.from.z);
    out.spots.push({
      label: `выход из лестницы, направление ${k * 45}°`,
      from: ladderOut, to: w.to, moved: +moved.toFixed(2),
      colliders: near(ladderOut.x, ladderOut.z, 4.25, 1.2),
    });
  }

  // 2. каждая ниша: от двери к кровати и обратно
  for (const r of rooms) {
    const inDoor = walk(r.doorX, r.doorZ + 0.5, Math.PI, 120);
    const toBed = walk(r.doorX, r.doorZ + 0.5, Math.PI, 150);
    const back = walk(r.bedX, r.bedZ - 0.9, 0, 150);
    out.spots.push({
      label: `ниша «${r.name}»: дверь → кровать`,
      from: { x: r.doorX, z: r.doorZ + 0.5 }, to: toBed.to,
      moved: +Math.hypot(toBed.to.x - toBed.from.x, toBed.to.z - toBed.from.z).toFixed(2),
      colliders: near(r.doorX, r.doorZ + 1.2, 4.25, 1.4),
    });
    out.spots.push({
      label: `ниша «${r.name}»: кровать → дверь`,
      from: { x: r.bedX, z: r.bedZ - 0.9 }, to: back.to,
      moved: +Math.hypot(back.to.x - back.from.x, back.to.z - back.from.z).toFixed(2),
      colliders: near(r.bedX, r.bedZ - 1.4, 4.25, 1.4),
    });
  }
  return out;
});

for (const s of res.spots) {
  console.log(`\n■ ${s.label}`);
  console.log(`   старт ${JSON.stringify(s.from)} → конец ${JSON.stringify(s.to)}  прошёл ${s.moved} м`);
  for (const c of s.colliders) {
    const flag = c.visible ? 'видимая' : 'НЕВИДИМАЯ';
    console.log(`   box#${c.i} pos=${c.cx},${c.cz} ${c.hx}×${c.hz} y=${c.y}  ${flag} (${c.dirs})`);
  }
}
console.log('\nошибки:', errs.length, errs.slice(0, 3));
await browser.close();
