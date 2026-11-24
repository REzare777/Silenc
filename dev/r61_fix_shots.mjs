/**
 * Проверка двух правок раунда 61:
 *  1) полоска HP босса не налезает на верхнюю панель времени и компас;
 *  2) каменный голем стал «маленьким» (ниже гоблина).
 *
 * Запуск: node dev/r61_fix_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const URL = process.env.WV_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });

// в игру
await page.evaluate(() => window.__dbg.enterGame());
await page.waitForTimeout(1500);

// в подземелье
await page.evaluate(() => {
  window.__dbg.setLocation('dungeon');
});
await page.waitForTimeout(2500);

// --- 1. босс: полоска сверху ---
await page.evaluate(() => {
  const d = window.__dbg;
  d.ui.setBoss('Орк-владыка Гримм', 0.62);
});
await page.waitForTimeout(600);

const bossBar = await page.evaluate(() => {
  const el = document.getElementById('bossBar');
  const time = document.getElementById('timebar');
  const compass = document.getElementById('compass');
  const r = el.getBoundingClientRect();
  const t = time.getBoundingClientRect();
  const c = compass.getBoundingClientRect();
  const overlap = (a, b) => !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right);
  return {
    top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right),
    timeTop: Math.round(t.top), timeBottom: Math.round(t.bottom), timeLeft: Math.round(t.left),
    compassBottom: Math.round(c.bottom),
    overTime: overlap(r, t), overCompass: overlap(r, c),
  };
});
console.log('полоса босса:', JSON.stringify(bossBar));
await page.screenshot({ path: 'shots/R61_bossbar_fixed.jpg', timeout: 180000 });

await page.evaluate(() => window.__dbg.ui.setBoss(null, 0));

// --- 2. голем: высота рядом с гоблином ---
const sizes = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};
  for (const m of d.monsters.list) {
    if (!['golem_small', 'goblin_sword', 'ghost'].includes(m.spec.id)) continue;
    out[m.spec.id] = { scale: m.group.scale.x, baseScale: m.baseScale, height: m.spec.height };
  }
  return out;
});
console.log('масштабы:', JSON.stringify(sizes));

// изолированный кадр голема
await page.evaluate(() => {
  const d = window.__dbg;
  for (const m of d.monsters.list) {
    m.group.visible = m.spec.id === 'golem_small';
    if (m.spec.id === 'golem_small') {
      m.group.rotation.y = 0;
      m.group.position.set(0, -4.6, 24);
      m.x = 0; m.z = 24;
    }
  }
  const cam = d.camera;
  cam.position.set(0, -4.6 + 1.2, 27.4);
  cam.lookAt(0, -4.6 + 0.7, 24);
  cam.updateMatrixWorld();
});
await page.waitForTimeout(2500);
const f0 = await page.evaluate(() => window.__frames);
await page.waitForTimeout(9000);
const f1 = await page.evaluate(() => window.__frames);
console.log('кадры:', f0, '->', f1);
await page.screenshot({ path: 'shots/R61_golem_small_fixed.jpg', timeout: 180000 });

// изолированный кадр гоблина для сравнения
await page.evaluate(() => {
  const d = window.__dbg;
  for (const m of d.monsters.list) {
    m.group.visible = m.spec.id === 'goblin_sword';
    if (m.spec.id === 'goblin_sword') {
      m.group.rotation.y = 0;
      m.group.position.set(0, -4.6, 24);
      m.x = 0; m.z = 24;
    }
  }
  const cam = d.camera;
  cam.position.set(0, -4.6 + 1.2, 27.4);
  cam.lookAt(0, -4.6 + 0.7, 24);
  cam.updateMatrixWorld();
});
await page.waitForTimeout(9000);
await page.screenshot({ path: 'shots/R61_goblin_compare.jpg', timeout: 180000 });

console.log('ошибки консоли:', errors.length ? errors.slice(0, 5) : 'нет');
await browser.close();
