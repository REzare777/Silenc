/**
 * Диагностика проходимости подземелья: где игрока останавливает преграда.
 * Запуск: cd dev && node dungeon_debug.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);

const out = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const log = [];
  d.loc = 'dungeon';
  const L = d.dungeonLoc;
  p.setColliders(L.colliders.boxes, L.colliders.circles);
  p.setPlatforms(L.platforms);
  p.teleport(0, 2, Math.PI);
  p.y = 0; p.groundY = 0;

  const step = () => { p.yaw = Math.PI; p.keys.add('KeyW'); p.update(1 / 60); };
  for (let i = 0; i < 400; i++) {
    step();
    if (i % 40 === 0) {
      log.push(`шаг ${i}: x=${p.pos.x.toFixed(2)} z=${p.pos.z.toFixed(2)} y=${(p.groundY + p.y).toFixed(2)}`);
    }
  }
  log.push(`итог: x=${p.pos.x.toFixed(2)} z=${p.pos.z.toFixed(2)} y=${(p.groundY + p.y).toFixed(2)}`);

  // что находится рядом с игроком
  const near = [];
  for (const b of L.colliders.boxes) {
    const dx = Math.abs(p.pos.x - b.cx) - b.hx;
    const dz = Math.abs(p.pos.z - b.cz) - b.hz;
    if (dx < 1.2 && dz < 1.2) {
      near.push(`box cx=${b.cx.toFixed(1)} cz=${b.cz.toFixed(1)} hx=${b.hx.toFixed(2)} hz=${b.hz.toFixed(2)} ang=${b.ang} y=${b.y0}..${b.y1}`);
    }
  }
  for (const c of L.colliders.circles) {
    const dd = Math.hypot(p.pos.x - c.x, p.pos.z - c.z) - c.r;
    if (dd < 1.2) near.push(`circle x=${c.x.toFixed(1)} z=${c.z.toFixed(1)} r=${c.r.toFixed(2)} y=${c.y0}..${c.y1}`);
  }
  log.push('рядом с игроком:');
  log.push(...(near.length ? near : ['(ничего)']));

  // платформы в районе
  const pf = L.platforms
    .filter((q) => Math.abs(q.cz - p.pos.z) < 4 && Math.abs(q.cx) < 6)
    .map((q) => `platform cz=${q.cz.toFixed(2)} y=${q.y.toFixed(2)} hz=${q.hz}`);
  log.push('платформы рядом:', ...pf);
  return log;
});

console.log(out.join('\n'));
await browser.close();
