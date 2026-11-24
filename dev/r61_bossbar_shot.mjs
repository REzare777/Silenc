/**
 * Финальный кадр раунда 61: босс с полосой здоровья (на новом месте),
 * рядом — гоблин и голем для сравнения по размеру.
 *
 * Запуск: node dev/r61_bossbar_shot.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 660 } });
page.setDefaultTimeout(180000);
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1500);
await page.evaluate(() => window.__dbg.setLocation('dungeon'));
await page.waitForTimeout(2500);

// будим босса и ставим игрока рядом — тогда полоса здоровья на экране
await page.evaluate(() => {
  const d = window.__dbg;
  const b = d.monsters.getBoss();
  if (!b) return;
  b.state = 'stalk';
  b.hp = b.maxHp;
  b.x = -3; b.z = 25; b.y = -4.6;
  b.group.rotation.y = Math.PI;
  d.player.pos.set(-3, -4.6, 31);
  d.player.groundY = -4.6;
  d.player.yaw = 0;
  d.camera.position.set(-3, -4.6 + 1.68, 31);
  d.camera.lookAt(-3, -4.6 + 1.5, 25);
  d.camera.updateMatrixWorld();
  d.ui.setBoss(b.spec.name, 0.72);
});
await page.waitForTimeout(2500);
const f0 = await page.evaluate(() => window.__frames);
await page.waitForTimeout(9000);
const f1 = await page.evaluate(() => window.__frames);
console.log('кадры:', f0, '->', f1);
const bar = await page.evaluate(() => {
  const el = document.getElementById('bossBar');
  const r = el.getBoundingClientRect();
  return { on: el.classList.contains('on'), top: Math.round(r.top), bottom: Math.round(r.bottom) };
});
console.log('полоса:', JSON.stringify(bar));
await page.screenshot({ path: 'shots/R61_bossbar_final.jpg', timeout: 180000 });
await browser.close();
console.log('готово');
