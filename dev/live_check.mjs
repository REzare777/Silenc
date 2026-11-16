import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 140)));
const url = (process.env.LIVE_URL || 'https://48scr412dj6o2.space.mcode.io') + '/?v=' + Date.now();
const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
console.log('HTTP', resp.status(), url.split('?')[0]);
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

const r = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player, THREE = d.THREE;
  const MX = 34, MZ = -33, RY = 0.6, c = Math.cos(RY), s = Math.sin(RY);
  const W = (lx, lz) => [MX + lx * c + lz * s, MZ - lx * s + lz * c];
  const step = (yaw) => { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); };
  const walkTo = (tx, tz, max = 400, tol = 0.22) => {
    for (let i = 0; i < max; i++) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z;
      if (Math.hypot(dx, dz) < tol) return true;
      step(Math.atan2(-dx, -dz));
    }
    return false;
  };
  const out = {};

  // --- 1. подъём по винтовой лестнице ---
  const H = 11.6, TURNS = 3, NSTEP = 33, DTH = Math.PI * 2 * TURNS / NSTEP, RISE = H / NSTEP;
  const RB = 3.584, RT = 2.624, WALL = 0.34;
  const rIn = (y) => (RB + (RT - RB) * (y / H)) - WALL;
  const [ox, oz] = W(0, -5.4);
  p.teleport(ox, oz, 0); p.y = 0; p.groundY = 0;
  walkTo(...W(0, -3.6), 400); walkTo(...W(0, -2.2), 400);
  out.вошли = p.pos.x !== undefined;
  let maxY = 0, drops = 0, maxStep = 0, lastY = 0;
  for (let i = 0; i < NSTEP; i++) {
    const y = (i + 1) * RISE, th = Math.PI + (i + 0.5) * DTH;
    const ro = rIn(y) - 0.06, rm = (0.45 + ro) / 2;
    walkTo(...W(Math.sin(th) * rm, Math.cos(th) * rm), 90, 0.2);
    const yy = p.groundY;
    if (yy - lastY > maxStep) maxStep = yy - lastY;
    if (yy < lastY - 0.001) drops++;
    lastY = yy; maxY = Math.max(maxY, yy);
  }
  out.подъём = { макс: +maxY.toFixed(2), максШаг: +maxStep.toFixed(3), провалов: drops };

  // --- 2. настил и площадка ---
  walkTo(...W(Math.sin(Math.PI) * 1.2, Math.cos(Math.PI) * 1.2), 600);
  out.настил = +p.groundY.toFixed(2);
  walkTo(...W(0, -3.4), 700);
  out.площадка = +p.groundY.toFixed(2);
  let guard = 0;
  for (let k = 0; k <= 10; k++) {
    const a = 1.9 + (4.4 - 1.9) * (k / 10);
    walkTo(...W(Math.sin(a) * 3.5, Math.cos(a) * 3.5), 300, 0.25);
    if (Math.abs(p.groundY - 11.6) > 0.4) guard++;
  }
  out.обходПлощадки = { сходов: guard, минY: +p.groundY.toFixed(2) };

  // --- 3. пруд и пирс на новом месте ---
  p.teleport(36.5, -14, -Math.PI / 2); p.y = 0; p.groundY = 0;
  p.keys.clear(); p.keys.add('KeyW');
  for (let i = 0; i < 60 * 14; i++) p.update(1 / 60);
  p.keys.clear();
  out.пирс = { x: +p.pos.x.toFixed(1), y: +p.groundY.toFixed(2) };

  // --- 3a. пёс идёт за игроком по маршруту ---
  {
    p.teleport(13, -8, 0); p.y = 0; p.groundY = 0;
    for (let i = 0; i < 60 * 20; i++) d.updateAnimals(1 / 60, i / 60);
    out.пёс_рядом = +Math.hypot(d.critters.dog.g.position.x - 13, d.critters.dog.g.position.z + 8).toFixed(2);
  }

  // --- 3b. рыбалка и инвентарь ---
  {
    p.teleport(37.5, -14, -Math.PI / 2); p.y = 0; p.groundY = 0;
    d.startFishing();
    let f = 0;
    while (d.fishing.state !== 'bite' && f < 60 * 15) { d.updateFishing(1 / 60); f++; }
    out.клёв = d.fishing.state;
    out.рыба = d.fishing.fish ? d.fishing.fish.spec.name : null;
    let tries = 0;
    while (d.inventory.stats().total === 0 && tries < 40 && d.fishing.state === 'bite') {
      d.fishing.mark = d.fishing.zonePos;
      d.hookFish();
      d.updateFishing(1 / 60);
      tries++;
    }
    out.поймано = d.inventory.stats().total;
    d.toggleInventory();
    out.слоты = document.querySelectorAll('#invGrid .slot').length;
    out.пояс_слотов = document.querySelectorAll('#invBelt .slot').length;
    const slot = document.querySelector('#invGrid .slot');
    if (slot) {
      slot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 900));
    }
    out.окно_просмотра = document.getElementById('viewCard').classList.contains('has');
    out.модель_в_окне = window.__dbg.ui.fishView.model ? window.__dbg.ui.fishView.model.children.length : 0;
    d.ui.closeInv();
  }

  // --- 3c. взаимодействия ---
  out.взаимодействий = d.interactables.length;
  out.есть_задняя_дверь = d.interactables.some((i) => i.label === 'Открыть тяжёлую дверь');
  out.есть_рыбалка = d.castSpots.length >= 2;      // точки рыбалки — по удочкам
  out.точек_рыбалки = d.castSpots.map((s) => s.label);

  // --- 4. сцена: меши, нормали, окна мельницы ---
  let meshes = 0, broken = 0, millWindows = 0;
  const pos = new THREE.Vector3(), nrm = new THREE.Vector3();
  d.scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    if (!g.attributes.normal) return;
    const na = g.attributes.normal.array;
    for (let i = 0; i < na.length; i += 3) {
      if (!Number.isFinite(na[i]) || !Number.isFinite(na[i + 1]) || !Number.isFinite(na[i + 2])) { broken++; break; }
    }
    o.getWorldPosition(pos);
    const dx = pos.x - 34, dz = pos.z + 33;
    if (Math.hypot(dx, dz) < 5 && pos.y > 1 && pos.y < 11.5 && g.type === 'PlaneGeometry') millWindows++;
  });
  out.сцена = { мешей: meshes, битыхНормалей: broken, оконМельницы: millWindows };
  return out;
});

console.log(JSON.stringify(r, null, 1));
console.log('ошибки в консоли:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
