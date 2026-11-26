/**
 * Раунд 66 — съёмка: знаки «!» и «?» над NPC, трекер дел в углу,
 * журнал дел (J) и окно диалога с темой о деле.
 *
 * Запуск: cd /workspace/village && node dev/r66_shots.mjs
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

/* ---- кузнец Торн: знак «!» над головой ---- */
const smith = await page.evaluate(() => {
  const d = window.__dbg;
  const n = d.npcs.blacksmith;
  return { x: n.x, z: n.z };
});
await shot('R66_smith_mark', [smith.x - 2.6, 2.1, smith.z - 2.9], [smith.x, 1.7, smith.z]);

/* ---- таверна: Хорт и его знак ---- */
await page.evaluate(() => window.__dbg.setLocation('tavern'));
await page.waitForTimeout(1800);
const bark = await page.evaluate(() => {
  const d = window.__dbg;
  const n = d.ctx.systems.locations.npcs.barkeep;
  return { x: n.x, z: n.z };
});
await shot('R66_barkeep_mark', [bark.x - 2.2, 2.0, bark.z - 2.6], [bark.x, 1.7, bark.z]);

/* ---- знак «?» у Торна: дело готово к сдаче ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const t = q.topicsFor('blacksmith').find((x) => x.label.includes('Есть работа'));
  if (t && t.act) t.act();
  const core = d.items.getItem('golem_core');
  d.inventory.add({ id: core.id, spec: core, count: 1, best: null });
  q.refresh();
});
await page.evaluate(() => window.__dbg.setLocation('village'));
await page.waitForTimeout(1500);
const smith2 = await page.evaluate(() => {
  const d = window.__dbg;
  const n = d.npcs.blacksmith;
  return { x: n.x, z: n.z };
});
await shot('R66_smith_ready', [smith2.x - 2.6, 2.1, smith2.z - 2.9], [smith2.x, 1.7, smith2.z]);

/* ---- трекер дел в углу экрана + диалог ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // берём дело Хорта, чтобы трекер был виден
  const t = q.topicsFor('barkeep').find((x) => x.label.includes('Гоблинья'));
  if (t && t.act) t.act();
  for (let i = 0; i < 4; i++) q.onKill({ id: 'goblin_sword', name: 'Гоблин' });
  q.refresh();
  // открываем диалог с Хортом: он в таверне
  d.setLocation('tavern');
});
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.dialog.open('barkeep');
});
await page.waitForTimeout(900);
// окно диалога — это DOM поверх канваса, поэтому обычный скриншот страницы
await page.screenshot({ path: `${OUT}/R66_dialog.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: R66_dialog');

/* ---- журнал дел (клавиша J) ---- */
await page.evaluate(() => {
  const d = window.__dbg;
  d.ctx.systems.dialog.close();
});
await page.waitForTimeout(400);
await page.keyboard.press('KeyJ');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/R66_journal.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: R66_journal');

/* ---- трекер дела в углу экрана ---- */
await page.keyboard.press('KeyJ');
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/R66_tracker.jpg`, type: 'jpeg', quality: 88 });
console.log('снимок: R66_tracker');

console.log('ошибки:', errs.length ? errs.slice(0, 5) : 'нет');
await browser.close();
