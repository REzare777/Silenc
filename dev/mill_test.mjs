import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(180000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

await page.goto((process.env.LIVE_URL || 'http://127.0.0.1:4205/') + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg;
  const p = d.player;
  const MX = 34, MZ = -33, RY = 0.6;
  const c = Math.cos(RY), s = Math.sin(RY);
  const toWorld = (lx, lz) => [MX + lx * c + lz * s, MZ - lx * s + lz * c];
  const toLocal = (wx, wz) => [(wx - MX) * c - (wz - MZ) * s, (wx - MX) * s + (wz - MZ) * c];
  const log = [];
  // параметры мельницы (как в buildings.js)
  const RB = 3.5 * 1.12, RT = 3.5 * 0.82, WALL = 0.34, H = 11.6;
  const rOut = (y) => RB + (RT - RB) * (y / H);
  const rIn = (y) => rOut(y) - WALL;
  const NSTEP = 33, TURNS = 3;
  const DTH = Math.PI * 2 * TURNS / NSTEP;   // как в buildings.js
  const RISE = 11.6 / NSTEP;
  const CAP_H = 3.4, CAP_R0 = 3.0, CAP_R1 = 1.45;
  const capR = (y) => CAP_R0 + (CAP_R1 - CAP_R0) * ((y - H) / CAP_H);
  const CAP_Y = H + CAP_H;

  const step = (yaw) => { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); };
  const walkTo = (tx, tz, maxSteps = 400, tol = 0.22) => {
    let stuck = 0, lastD = 1e9;
    for (let i = 0; i < maxSteps; i++) {
      const dx = tx - p.pos.x, dz = tz - p.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd < tol) return true;
      step(Math.atan2(-dx, -dz));
      if (dd > lastD - 0.004) { stuck++; if (stuck > 90) return false; } else stuck = 0;
      lastD = dd;
    }
    return false;
  };

  // 1) к двери снаружи
  const [ox, oz] = toWorld(0, -5.4);
  p.teleport(ox, oz, 0); p.y = 0; p.groundY = 0;
  const ok1 = walkTo(...toWorld(0, -3.6), 400);
  log.push(`подошёл к двери: ${ok1} локально=(${toLocal(p.pos.x, p.pos.z).map(v=>v.toFixed(2))}) y=${p.groundY.toFixed(2)}`);

  // 2) войти внутрь
  const ok2 = walkTo(...toWorld(0, -2.2), 400);
  log.push(`вошёл в башню: ${ok2} y=${p.groundY.toFixed(2)}`);

  // 3) подъём по винтовой лестнице — по точкам ступеней
  let maxY = p.groundY, fails = 0;
  for (let i = 0; i < NSTEP; i++) {
    const y = 0.28 + i * RISE;
    const theta = Math.PI + i * DTH;
    const ro = rIn(y) - 0.06;
    const rm = (0.45 + ro) / 2;
    const ok = walkTo(...toWorld(Math.sin(theta) * rm, Math.cos(theta) * rm), 90, 0.2);
    if (!ok) { fails++; if (fails > 3) break; }
    maxY = Math.max(maxY, p.groundY);
  }
  log.push(`подъём: максимум y=${maxY.toFixed(2)} (ожидалось ~9.2), срывов=${fails}`);
  const [lx0, lz0] = toLocal(p.pos.x, p.pos.z);
  log.push(`после подъёма: y=${p.groundY.toFixed(2)} r=${Math.hypot(lx0, lz0).toFixed(2)}`);

  // 4) с последней ступени — прямо на смотровую площадку (настила в башне нет)
  const okDeck = walkTo(...toWorld(Math.sin(Math.PI) * 1.9, Math.cos(Math.PI) * 1.9), 300);
  log.push(`вышел с лестницы: ${okDeck} y=${p.groundY.toFixed(2)}`);
  const okDoor = walkTo(...toWorld(0, -3.1), 400);
  log.push(`вышел на площадку: ${okDoor} y=${p.groundY.toFixed(2)}`);
  const okGal = walkTo(...toWorld(0, -4.0), 400);
  const [gx, gz] = toLocal(p.pos.x, p.pos.z);
  log.push(`вышел на галерею: ${okGal} y=${p.groundY.toFixed(2)} r=${Math.hypot(gx, gz).toFixed(2)}`);

  // 5) смотровая площадка: обходим её по кругу — забор держит, с настила не сходим
  let guard = 0, minY = 99;
  for (let k = 0; k <= 10; k++) {
    const a = 1.85 + (4.45 - 1.85) * (k / 10);
    walkTo(...toWorld(Math.sin(a) * 3.5, Math.cos(a) * 3.5), 300, 0.25);
    if (Math.abs(p.groundY - 11.6) > 0.4) guard++;
    minY = Math.min(minY, p.groundY);
  }
  log.push(`обход площадки: сходов с настила = ${guard} (ожидается 0), мин. y=${minY.toFixed(2)}`);

  // 6) финальная проверка: игрок на крыше
  log.push(`ИТОГ: игрок y=${p.groundY.toFixed(2)}`);
  return { log };
});

console.log(res.log.join('\n'));
console.log('ошибок в консоли:', errors.length, errors.slice(0, 5));
await page.screenshot({ path: '/workspace/village/shots/MILL_top.png' });
await browser.close();
