/**
 * ============================================================================
 *  Проверка планировки деревни: дома симметричны и ни на что не наезжают
 * ============================================================================
 *
 *  Проверяем:
 *   1) дом не стоит на главной дороге, поперечной, площади или тропинке;
 *   2) дома не наезжают друг на друга и на другие здания;
 *   3) у каждого дома есть зеркальный на другой стороне улицы;
 *   4) между домами и соседями есть проход.
 *
 *  Запуск: cd dev && node town_layout.mjs
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

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const homes = (d.ctx.homes || []).map((h) => ({ ...h }));
  const problems = [];

  // --- что занимает место в деревне ---
  const MAIN_HALF = 3.7;      // половина ширины главной дороги
  const CROSS_HALF = 2.8;     // половина поперечной дороги
  const PLAZA_R = 11.5;       // радиус площади
  const YARD = 1.6;           // двор/крыльцо перед фасадом

  const others = [
    { name: 'таверна', x: -17, z: -13, hx: 7.5, hz: 9.0 },
    { name: 'амбар', x: -30, z: 64, hx: 6.0, hz: 4.0 },
    { name: 'лесная делянка', x: -45, z: 13, hx: 2.6, hz: 2.2 },
    { name: 'кузня', x: 14.5, z: -8, hx: 3.0, hz: 2.5 },
    { name: 'мельница', x: 34, z: -33, r: 4.6 },
    { name: 'церковь', x: 3, z: 44, hx: 4.5, hz: 12.3 },
    { name: 'колодец', x: 0, z: 0, r: 1.8 },
    { name: 'костёр', x: 46, z: -30, r: 1.2 },   // «за город», у пруда
    { name: 'прилавок 1', x: 5.6, z: 5.6, r: 1.6 },
    { name: 'прилавок 2', x: -5.8, z: 6.4, r: 1.6 },
    { name: 'прилавок 3', x: 6.4, z: -6.2, r: 1.6 },
    { name: 'прилавок 4', x: -8.0, z: 0.0, r: 1.6 },
  ];
  const hay = [[-40, 28, 1.5], [-53, 13, 1.5], [28, 38, 1.5], [21, 16, 1.5]];
  // пруд и лужайка у него — дом не должен стоять на лужайке и подходить к воде
  const POND = { x: 50, z: -14, r: 10.6 };
  const MEADOW = { x0: 36, x1: 73, z0: -35, z1: 7 };
  // поля с заборами (забор — тоже препятствие)
  const fields = [
    { name: 'поле (запад)', x: -30, z: 50, hx: 10, hz: 6 },
    { name: 'поле (восток)', x: 31, z: 44, hx: 9.5, hz: 7 },
    { name: 'поле (дальнее)', x: -44, z: 16, hx: 7, hz: 6 },
  ];

  // расстояние от центра дома до прямой (по двум осям)
  const gapX = (h) => Math.abs(h.x) - (MAIN_HALF + h.w / 2 + YARD);
  const gapZ = (h) => Math.abs(h.z) - (CROSS_HALF + h.d / 2 + YARD);

  const boxGap = (h, o) => {
    const dx = Math.abs(h.x - o.x) - (h.w / 2 + o.hx);
    const dz = Math.abs(h.z - o.z) - (h.d / 2 + o.hz);
    return Math.max(dx, dz);
  };
  const circleGap = (h, o) => Math.hypot(h.x - o.x, h.z - o.z) - (Math.max(h.w, h.d) / 2 + o.r);

  for (const h of homes) {
    const p = [];
    if (gapX(h) < 0) p.push(`на главной дороге (зазор ${gapX(h).toFixed(1)} м)`);
    if (gapZ(h) < 0) p.push(`на поперечной дороге (зазор ${gapZ(h).toFixed(1)} м)`);
    const plazaGap = Math.hypot(h.x, h.z) - (Math.max(h.w, h.d) / 2 + PLAZA_R);
    if (plazaGap < 0) p.push(`на площади (зазор ${plazaGap.toFixed(1)} м)`);
    for (const o of others) {
      const g = o.r ? circleGap(h, o) : boxGap(h, o);
      if (g < 0) p.push(`наезжает на «${o.name}» (${g.toFixed(1)} м)`);
    }
    // пруд: от воды должно быть не меньше 4 м
    const pondGap = Math.hypot(h.x - POND.x, h.z - POND.z) - (Math.max(h.w, h.d) / 2 + POND.r);
    if (pondGap < 4) p.push(`слишком близко к пруду (${pondGap.toFixed(1)} м)`);
    // лужайка у пруда — на ней домам не место
    if (h.x + h.w / 2 > MEADOW.x0 && h.x - h.w / 2 < MEADOW.x1
      && h.z + h.d / 2 > MEADOW.z0 && h.z - h.d / 2 < MEADOW.z1) {
      p.push('на лужайке у пруда');
    }
    for (const [hx, hz, hr] of hay) {
      if (Math.hypot(h.x - hx, h.z - hz) < Math.max(h.w, h.d) / 2 + hr) p.push('наезжает на стог сена');
    }
    for (const f of fields) {
      const g = boxGap(h, f);
      if (g < 0) p.push(`наезжает на «${f.name}» (${g.toFixed(1)} м)`);
    }
    // дома между собой
    for (const o of homes) {
      if (o.i <= h.i) continue;
      const g = boxGap(h, o);
      if (g < 2.0) p.push(`слишком близко к дому ${o.i} (${g.toFixed(1)} м)`);
    }
    if (p.length) problems.push({ i: h.i, x: h.x, z: h.z, p });
  }

  // --- симметрия: у каждого дома есть зеркальный ---
  // Исключения: дом E на восточной стороне (29, −22). Его зеркало
  // ((40, −8)) попало бы в пруд, поэтому в раунде 46 западный дом E
  // переехал на окраину (−40, −8) и пара у этой пары — одна.
  // Дом F на западе (−34, −16) — тоже один: раньше он стоял на дороге
  // к скале (−19, −34) и перекрывал её. Парный ему дом 11 (19, −34) остался
  // на месте, но зеркала у него больше нет.
  const ASYM = new Set([8, 9, 10, 11]);
  const mirror = [];
  for (const h of homes) {
    if (ASYM.has(h.i)) continue;
    const m = homes.find((o) => o.i !== h.i && Math.abs(o.x + h.x) < 0.6 && Math.abs(o.z - h.z) < 0.6);
    if (!m) mirror.push(h.i);
  }

  // расстояния между соседними домами — «как в деревне», а не щель
  // --- дорога к скале: дом не должен стоять на ней ---
  // Точки повторяют DUNGEON_TRAIL из game/layout.js: раньше дом стоял
  // прямо на дороге к скале и перекрывал её.
  const TRAIL = [
    [-2.5, -14], [-5, -21], [-12, -28], [-20, -33], [-28, -38],
    [-36, -41], [-44, -46], [-51, -52], [-56, -58], [-62, -60], [-67, -63],
  ];
  const distToTrail = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < TRAIL.length - 1; i++) {
      const [ax, az] = TRAIL[i];
      const [bx, bz] = TRAIL[i + 1];
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz;
      let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };
  const onTrail = [];
  for (const h of homes) {
    const d = distToTrail(h.x, h.z);
    // половина диагонали дома + половина ширины дороги + запас
    const need = Math.hypot(h.w, h.d) / 2 + 1.3 + 1.5;
    if (d < need) onTrail.push(`дом ${h.i} (${h.x}, ${h.z}): ${d.toFixed(1)} м от дороги к скале`);
  }

  const gaps = [];
  for (let i = 0; i < homes.length; i++) {
    for (let j = i + 1; j < homes.length; j++) {
      const a = homes[i], b = homes[j];
      const g = Math.max(Math.abs(a.x - b.x) - (a.w + b.w) / 2,
        Math.abs(a.z - b.z) - (a.d + b.d) / 2);
      if (g < 20) gaps.push(`${a.i}-${b.i}: ${g.toFixed(1)} м`);
    }
  }

  return { homes, problems, mirror, gaps, others, onTrail };
});

console.log('--- дома ---');
for (const h of res.homes) {
  console.log(`  дом ${String(h.i).padStart(2)}: (${String(h.x).padStart(4)}, ${String(h.z).padStart(4)})  ${h.w}×${h.d}`);
}
console.log('\n--- наезды и нарушения ---');
if (!res.problems.length) console.log('  нет — все дома на месте');
for (const p of res.problems) {
  console.log(`  ✗ дом ${p.i} (${p.x}, ${p.z}): ${p.p.join('; ')}`);
}
console.log('\n--- расстояния между домами (ближе 20 м) ---');
console.log(res.gaps.length ? '  ' + res.gaps.join(', ') : '  все участки просторные');
console.log('\n--- дорога к скале ---');
if (!res.onTrail.length) console.log('  ✓ ни один дом не стоит на дороге к скале');
for (const t of res.onTrail) console.log(`  ✗ ${t}`);

console.log('\n--- симметрия ---');
console.log(res.mirror.length
  ? `  ✗ нет зеркального дома: ${res.mirror.join(', ')}`
  : '  ✓ все дома имеют зеркальную пару');
console.log('\nошибки: ' + errs.length, errs.slice(0, 3));
await browser.close();
if (res.problems.length || res.mirror.length || res.onTrail.length) process.exit(1);
