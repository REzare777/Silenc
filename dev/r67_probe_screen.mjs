/**
 * Раунд 67 — прицельный пробник: что попадает в экранную точку скриншота.
 *
 * Для каждой кандидатной позиции игрока считаем экранные координаты
 * пней-указателей у дороги и ближайших деревьев: в скриншоте пользователя
 * тёмный объект стоит на x=405, низ на y=757, ширина 68 px.
 *
 * Запуск: cd /workspace/village && node dev/r67_probe_screen.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const CX0 = 40, CY0 = 118, CX1 = 2560, CY1 = 1390;
const CW = CX1 - CX0, CH = CY1 - CY0;
const CCX = (CX0 + CX1) / 2, CCY = (CY0 + CY1) / 2;
const FOV_V = 68, EYE = 1.68;
const TAN_V = Math.tan((FOV_V / 2) * Math.PI / 180);
const KXY = (CW / 2) / (TAN_V * (CW / CH));
const KY = (CH / 2) / TAN_V;

const TRAIL = [[-2.5, -14], [-5, -21], [-12, -28], [-20, -33], [-28, -38],
  [-36, -41], [-44, -46], [-51, -52], [-56, -58], [-62, -60], [-67, -63],
  [-67.87, -62.22]];
const STUMPS = [];
for (const i of [1, 3, 5, 7, 9]) {
  for (const s of [1, -1]) STUMPS.push([TRAIL[i][0] + 2.1 * s, TRAIL[i][1] + 0.8]);
}

const CANDS = [
  [-11.45, -30.83, 325.3, -14.1],
  [-19.5, -36.9, 325.3, -16],
  [-15.2, -34.5, 325.3, -16],
  [-10.8, -32.1, 325.3, -16],
  [-6.4, -29.6, 325.3, -16],
  [-19.5, -36.9, 325.3, -9],
  [-15.2, -34.5, 325.3, -9],
  [-23.9, -39.3, 325.3, -16],
];

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);
await page.goto('http://127.0.0.1:4206/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

const trees = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  return (ctx.forestTrees || []).map((t) => ({ x: t.x, z: t.z, type: t.type, s: t.s }));
});

function screen(px, py, pz, cam, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const vx = px - cam[0], vy = py - cam[1], vz = pz - cam[2];
  const a = vx * cy - vz * sy;
  const b = vx * (sp * sy) + vy * cp + vz * (sp * cy);
  const c = vx * (-cp * sy) + vy * sp + vz * (-cp * cy);
  if (c <= 0.05) return null;
  return [CCX + (a / c) * KXY, CCY - (b / c) * KY];
}

const TRUNK_R = { pine: 0.42, spruce: 0.34, oak: 0.5, birch: 0.26, aspen: 0.32 };

for (const [x, z, bearing, pitchDeg] of CANDS) {
  const yaw = (-bearing * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const cam = [x, EYE, z];
  console.log(`\n=== P=(${x}, ${z}) азимут ${bearing} наклон ${pitchDeg} ===`);
  // пни
  for (const st of STUMPS) {
    const s = screen(st[0], 0, st[1], cam, yaw, pitch);
    if (!s) continue;
    if (Math.abs(s[0] - 405) < 120) {
      const d = Math.hypot(x - st[0], z - st[1]);
      console.log(`  пень (${st[0].toFixed(1)}, ${st[1].toFixed(1)}) -> x=${s[0].toFixed(0)} y=${s[1].toFixed(0)} d=${d.toFixed(1)} ширина=${(0.48 / d * KXY).toFixed(0)}px`);
    }
  }
  // деревья
  let best = [];
  for (const t of trees) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d > 30) continue;
    const s = screen(t.x, 0, t.z, cam, yaw, pitch);
    if (!s) continue;
    if (Math.abs(s[0] - 405) < 120) {
      const w = 2 * (TRUNK_R[t.type] || 0.35) * t.s / d * KXY;
      best.push(`  дерево (${t.x.toFixed(1)}, ${t.z.toFixed(1)} ${t.type}) -> x=${s[0].toFixed(0)} y=${s[1].toFixed(0)} d=${d.toFixed(1)} ширина=${w.toFixed(0)}px`);
    }
  }
  console.log(best.slice(0, 6).join('\n') || '  (рядом с x=405 ничего нет)');
}

await browser.close();
