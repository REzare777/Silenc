/**
 * ============================================================================
 *  Сфокусированная проверка: церковь, амбар, трактир, мельница
 *  + быстрый обход всех построек города
 * ============================================================================
 *
 *  Что проверяем:
 *   1) все постройки: нельзя ли пройти внутрь сквозь стену;
 *   2) обход вокруг здания — нет ли «невидимых стенок» и тупиков;
 *   3) локации: вход → пол под ногами → выход наружу (не в стене);
 *   4) мельница: подъём по винтовой лестнице под новой «твёрдой» крышей —
 *      игрок поднимается, его не выталкивает настилом;
 *   5) церковь: войти нельзя, у двери не застреваешь.
 *
 *  Запуск: cd dev && node focus_check.mjs
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
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const out = [];
  const ryToFace = (fx, fz, tx, tz) => {
    const l = Math.hypot(tx - fx, tz - fz) || 1;
    return Math.atan2(-(tx - fx) / l, -(tz - fz) / l);
  };
  const localOf = (b, wx, wz) => {
    const dx = wx - b.x, dz = wz - b.z, c = Math.cos(b.ry), s = Math.sin(b.ry);
    return { lx: dx * c - dz * s, lz: dx * s + dz * c };
  };
  const insideOf = (b, wx, wz) => {
    const { lx, lz } = localOf(b, wx, wz);
    if (b.rad) return Math.hypot(lx, lz) < b.rad - 0.35;
    return Math.abs(lx) < b.hx - 0.35 && Math.abs(lz) < b.hz - 0.35;
  };
  const put = (x, z) => { p.teleport(x, z, 0); p.y = 0; p.groundY = 0; p.vy = 0; };
  const step = (yaw, n = 1) => {
    for (let i = 0; i < n; i++) { p.yaw = yaw; p.keys.add('KeyW'); p.update(1 / 60); }
    p.keys.clear();
  };

  /* ---------- 1. все постройки: проход внутрь ---------- */
  const buildings = [
    { name: 'церковь', x: 3, z: 44, ry: ryToFace(3, 44, 0, 0), hx: 4.5, hz: 8.5 },

    { name: 'таверна', x: -17, z: -13, ry: ryToFace(-17, -13, 0, 0), hx: 7.5, hz: 9.0 },
    { name: 'амбар', x: -40, z: -8, ry: ryToFace(-40, -8, -10, -4), hx: 6.0, hz: 4.0 },
  ];
  for (const b of buildings) {
    const R = b.rad || Math.max(b.hx, b.hz);
    let leaks = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sx = b.x + Math.cos(a) * (R + 1.4), sz = b.z + Math.sin(a) * (R + 1.4);
      put(sx, sz);
      const yaw = Math.atan2(-(b.x - sx), -(b.z - sz));
      for (let k = 0; k < 120; k++) {
        step(yaw, 1);
        if (insideOf(b, p.pos.x, p.pos.z)) { leaks++; break; }
      }
    }
    out.push(`${leaks ? '✗' : '✓'} ${b.name}: пролез ${leaks ? leaks + ' раз(а)' : 'нигде'}`);
  }

  /* ---------- 2. обход вокруг фокусных зданий ---------- */
  /**
   * Обход по периметру здания: для прямоугольных — четыре стороны
   * на расстоянии `gap` от стен, для круглых — по кругу.
   */
  const ring = (b, gap) => {
    const pts = [];
    if (b.hx) {
      // локальный прямоугольник (hx+gap) × (hz+gap) в мировых координатах
      const c = Math.cos(b.ry), s = Math.sin(b.ry);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let ci = 0; ci < 4; ci++) {
        const [ax, az] = corners[ci], [bx2, bz2] = corners[(ci + 1) % 4];
        for (let k = 0; k < 6; k++) {
          const t = k / 6;
          const lx = (ax + (bx2 - ax) * t) * (b.hx + gap);
          const lz = (az + (bz2 - az) * t) * (b.hz + gap);
          pts.push([b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
        }
      }
    } else {
      const N = 24;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push([b.x + Math.cos(a) * gap, b.z + Math.sin(a) * gap]);
      }
    }
    let stuck = 0;
    const bad = [];
    put(pts[0][0], pts[0][1]);
    for (let i = 1; i <= pts.length; i++) {
      const [tx, tz] = pts[i % pts.length];
      const yaw = Math.atan2(-(tx - p.pos.x), -(tz - p.pos.z));
      const bx = p.pos.x, bz = p.pos.z;
      for (let k = 0; k < 140; k++) step(yaw, 1);
      // «застрял» = почти не сдвинулся за ~2 секунды
      const moved = Math.hypot(p.pos.x - bx, p.pos.z - bz);
      if (moved < 0.6) {
        stuck++;
        if (bad.length < 3) bad.push(`[${tx.toFixed(1)},${tz.toFixed(1)}]`);
      }
    }
    if (bad.length) out.push(`    точки застревания: ${bad.join(' ')}`);
    return stuck;
  };
  for (const b of [
    // hz = 12.3: колокольня выступает южнее нефа на 4,8 м — обход идёт вокруг неё
    { name: 'церковь', x: 3, z: 44, ry: ryToFace(3, 44, 0, 0), hx: 4.5, hz: 12.3, gap: 1.8 },
    { name: 'амбар', x: -40, z: -8, ry: ryToFace(-40, -8, -10, -4), hx: 6.0, hz: 4.0, gap: 1.8 },
    { name: 'таверна', x: -17, z: -13, ry: ryToFace(-17, -13, 0, 0), hx: 7.5, hz: 9.0, gap: 1.8 },
    { name: 'мельница', x: 34, z: -33, gap: 5.4 },
  ]) {
    const stuck = ring(b, b.gap);
    out.push(`${stuck ? '✗' : '✓'} обход ${b.name}: застреваний ${stuck}`);
  }

  /* ---------- 3. локации: таверна и амбар ---------- */
  const checkLocation = async (loc, doorLabel) => {
    d.setLocation(loc);
    await new Promise((r) => setTimeout(r, 400));
    const exit = (d.ctx.interactables || []).find((i) => i.label === 'Выйти ' + (loc === 'tavern' ? 'из таверны' : 'из амбара'));
    if (!exit) { out.push(`✗ ${loc}: нет интеракта выхода`); d.setLocation('village'); return; }
    put(exit.pos.x, exit.pos.z);
    const ground = p.groundAt(p.pos.x, p.pos.z);
    out.push(`${ground > -0.2 ? '✓' : '✗'} ${loc}: пол под выходом y=${ground.toFixed(2)}`);
    // выход по интеракту
    const act = d.ctx.interactables.find((i) => i.label === exit.label);
    d.doInteract(act);
    await new Promise((r) => setTimeout(r, 500));
    const inVillage = d.loc === 'village';
    out.push(`${inVillage ? '✓' : '✗'} ${loc}: выход сработал (loc=${d.loc})`);
  };
  await checkLocation('tavern');
  await checkLocation('barn');

  /* ---------- 4. мельница: подъём по лестнице ---------- */
  {
    const mill = d.ctx.doors ? null : null;
    const sp = (d.ctx.platforms || []).find((pl) => pl.sp);
    if (!sp) {
      out.push('✗ мельница: винтовая лестница не найдена в платформах');
    } else {
      const s = sp.sp;
      const total = s.turns * Math.PI * 2;
      const at = (t) => {
        const a = s.a0 + total * t;
        const rOut = s.rOut0 + (s.rOut1 - s.rOut0) * t;
        const r = (s.rIn + rOut) / 2;
        return { x: s.cx + Math.sin(a) * r, z: s.cz + Math.cos(a) * r, a, y: s.y0 + (s.y1 - s.y0) * t };
      };
      const t0 = 0.02;
      const st0 = at(t0);
      put(st0.x, st0.z);
      let maxY = p.groundY, stuckAt = -1, hitRoof = false, prevG = p.groundY;
      for (let i = 1; i <= 340; i++) {
        const t = t0 + (i / 340) * 0.98;
        const tgt = at(t);
        const yaw = Math.atan2(-(tgt.x - p.pos.x), -(tgt.z - p.pos.z));
        step(yaw, 2);
        // скачок пола больше чем на полметра = настил «вытолкнул» игрока
        if (p.groundY - prevG > 0.5) hitRoof = true;
        prevG = p.groundY;
        maxY = Math.max(maxY, p.groundY);
        if (stuckAt < 0 && Math.hypot(p.pos.x - tgt.x, p.pos.z - tgt.z) > 1.6) stuckAt = i;
      }
      out.push(`${maxY > s.y1 - 0.6 ? '✓' : '✗'} мельница: подъём до y=${maxY.toFixed(2)} (цель ${s.y1})`);
      out.push(`${!hitRoof ? '✓' : '✗'} мельница: пол в башне не перехватывает подъём`);
      out.push(`${stuckAt < 0 ? '✓' : '✗'} мельница: игрок не отстал от лестницы (проблема на шаге ${stuckAt})`);
      // в башне пола нет: под последней ступенью — каменный пол первого этажа
      const top = at(0.99);
      p.teleport(top.x, top.z, 0);
      p.groundY = s.y1 - 0.4;
      p.y = 0;
      out.push(`  мельница: под верхней ступенью y=${p.groundAt(top.x, top.z).toFixed(2)} (пол башни 0.00)`);
      // жёлтая крыша твёрдая: с площадки можно подняться на соломенную шапку
      {
        // Ступеней на соломенной крыше нет (решение игрока): сверху остаётся
        // только смотровая площадка, а настила-потолка быть не должно.
        const gal = (d.ctx.platforms || []).find((pl) => !pl.sp && Math.abs((pl.y ?? 0) - s.y1) < 0.05 && pl.hx > 1.2);
        out.push(`${!gal ? '✓' : '✗'} мельница: настила-потолка нет — крыша осталась соломенной`);
      }
    }
  }

  /* ---------- 5. церковь: не войти и не застрять у двери ---------- */
  {
    const b = { x: 3, z: 44, ry: ryToFace(3, 44, 0, 0), hx: 4.5, hz: 12.3 };
    const doorZ = 44 - 11.9;
    put(3, doorZ - 1.5);
    const yaw = Math.atan2(-(3 - 3), -(44 - (doorZ - 1.5)));
    for (let k = 0; k < 90; k++) step(yaw, 1);
    const inside = insideOf(b, p.pos.x, p.pos.z);
    out.push(`${inside ? '✗' : '✓'} церковь: внутрь не попал (лок. z=${localOf(b, p.pos.x, p.pos.z).lz.toFixed(2)})`);
    // отойти от двери
    for (let k = 0; k < 60; k++) step(yaw + Math.PI, 1);
    const dist = Math.hypot(p.pos.x - 3, p.pos.z - doorZ);
    out.push(`${dist > 1.5 ? '✓' : '✗'} церковь: от двери можно отойти (${dist.toFixed(1)} м)`);
  }

  return out;
});

for (const l of res) console.log(l);
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
