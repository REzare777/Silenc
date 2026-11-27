/**
 * Раунд 67 — выгрузка геометрии леса из сборки раунда 66.
 *
 * Нужна, чтобы найти точку игрока по скриншоту: деревья расставлены
 * детерминированно, и по их силуэтам можно восстановить позицию камеры.
 *
 * Запуск: cd /workspace/village && node dev/r67_dump_trees.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(300000);

await page.goto('http://127.0.0.1:4206/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const data = await page.evaluate(() => {
  const ctx = window.__dbg.ctx;
  const trees = (ctx.forestTrees || []).map((t) => ({
    x: +t.x.toFixed(3), z: +t.z.toFixed(3), type: t.type,
    s: +t.s.toFixed(4), r: +t.r.toFixed(4),
  }));
  // точки входа в подземелье и прочие ориентиры
  const gate = ctx.doors?.dungeon || null;
  const lanterns = (ctx.lanterns || []).map((l) => ({
    x: +l.group.position.x.toFixed(2), z: +l.group.position.z.toFixed(2),
  }));
  return { trees, gate, lanterns, count: trees.length };
});

fs.writeFileSync('/workspace/village/dev/r67_trees.json', JSON.stringify(data));
console.log('деревьев:', data.count, 'фонарей:', data.lanterns.length);
console.log('фонари:', JSON.stringify(data.lanterns));
await browser.close();
