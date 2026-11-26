/**
 * Раунд 65 — съёмка: кладка на стенах, щебень на полу, босс на полу
 * и полоска здоровья над зверем.
 *
 * Запуск: cd /workspace/village && node dev/r65_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);

/** Снять кадр с заданной камеры. */
async function shot(name, pos, look) {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2000);

/* ---- стены и пол входного зала ---- */
await shot('R65_dg_wall', [-6, 1.6, -26], [6, 1.4, -21]);
await shot('R65_dg_floor', [0, 2.6, -28], [0, 0, -20]);

/* ---- полоска здоровья: раненый гоблин в двух шагах ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const g = m.list.find((x) => x.spec.id === 'goblin_sword');
  if (!g) return;
  g.x = 0; g.z = -25; g.y = 0; g.state = 'stalk'; g.dying = 0;
  g.hp = Math.round(g.maxHp * 0.42);
  for (let i = 0; i < 3; i++) m.update(1 / 30, 1 + i / 30);
});
await shot('R65_dg_hpbar', [0, 1.6, -21.5], [0, 1.3, -25]);

/* ---- босс у Врат: стоит на полу, а не в текстуре ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  const m = d.monsters;
  const b = m.getBoss();
  if (!b) return;
  b.x = 0; b.z = 27.5; b.y = -4.6; b.state = 'stalk'; b.dying = 0;
  b.hp = Math.round(b.maxHp * 0.66);
  for (let i = 0; i < 3; i++) m.update(1 / 30, 2 + i / 30);
  for (let i = 0; i < 20; i++) d.dungeonLoc.update(0.05, 40 + i * 0.05, d.camera);
});
await shot('R65_dg_boss', [0, -2.6, 22], [0, -3.2, 28]);
await shot('R65_dg_boss_close', [3.2, -3.2, 25], [0, -3.4, 27.5]);

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
