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
    { name: 'амбар', x: -40, z: -8, hx: 6.0, hz: 4.0 },
    { name: 'кузня', x: 14.5, z: -8, hx: 3.0, hz: 2.5 },
    { name: 'мельница', x: 34, z: -33, r: 4.6 },
    { name: 'церковь', x: 3, z: 44, hx: 4.5, hz: 12.3 },
    { name: 'колодец', x: 0, z: 0, r: 1.8 },
    { name: 'костёр', x: -9, z: 8.5, r: 1.2 },
    { name: 'прилавок 1', x: 5.6, z: 5.6, r: 1.6 },
    { name: 'прилавок 2', x: -5.8, z: 6.4, r: 1.6 },
    { name: 'прилавок 3', x: 6.4, z: -6.2, r: 1.6 },
    { name: 'прилавок 4', x: -9.2, z: -2.6, r: 1.6 },
  ];
  const hay = [[-40, 28, 1.5], [-53, 13, 1.5], [28, 35, 1.5], [21, 16, 1.5]];
  // поля с заборами (забор — тоже препятствие)
  const fields = [
    { name: 'поле (запад)', x: -29, z: 38, hx: 10, hz: 7 },
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
  const mirror = [];
  for (const h of homes) {
    const m = homes.find((o) => o.i !== h.i && Math.abs(o.x + h.x) < 0.6 && Math.abs(o.z - h.z) < 0.6);
    if (!m) mirror.push(h.i);
  }

  return { homes, problems, mirror, others };
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
console.log('\n--- симметрия ---');
console.log(res.mirror.length
  ? `  ✗ нет зеркального дома: ${res.mirror.join(', ')}`
  : '  ✓ все дома имеют зеркальную пару');
console.log('\nошибки: ' + errs.length, errs.slice(0, 3));
await browser.close();
if (res.problems.length || res.mirror.length) process.exit(1);
