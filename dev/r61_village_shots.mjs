/**
 * Раунд 61 — съёмка деревни: общий план сверху и виды на трактир.
 *
 * Запуск: cd /workspace/village && node dev/r61_village_shots.mjs
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(2000);

/**
 * Снять кадр.
 *
 * @param {string} name имя файла
 */
async function grab(name) {
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 120000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/R61_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
}

const shots = [
  // вид сверху без тумана — чтобы разглядеть планировку
  ['village_top', [0, 120, 0.1], [0, 0, 0]],
  ['village_top_west', [-30, 90, -20], [-20, 0, 0]],
  ['village_top_east', [30, 90, 10], [20, 0, 5]],
  // трактир с улицы (фасад смотрит к площади)
  ['tavern_front', [3.0, 4.2, 2.0], [-15, 2.4, -12]],
  ['tavern_porch', [-6.5, 2.4, -3.0], [-13, 1.6, -10]],
  ['tavern_side', [-24, 4.0, -20], [-16, 2.5, -13]],
  // улица и перекрёсток
  ['street_look', [0, 2.2, -4], [-15, 2.0, -12]],
  ['square', [0, 7.0, 18], [0, 1, 0]],
  // огороды у домов и новые заборы
  ['gardens', [-24, 5.0, 22], [-16, 1.0, 14]],
  // тропинка к дому №10 (была сквозь дом)
  ['home10', [-24, 4.0, -18], [-31, 1.5, -15]],
];

for (const [name, pos, look] of shots) {
  await page.evaluate(({ pos, look, name }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    if (name.includes('top')) {
      // туман съедает всё, а env.apply() каждый кадр ставит его заново —
      // поэтому на время съёмки отключаем применение окружения
      if (!d.__envApply) d.__envApply = d.env.apply.bind(d.env);
      d.env.apply = () => {};
      d.scene.fog = null;
    } else if (d.__envApply) {
      d.env.apply = d.__envApply;
    }
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look, name });
  await page.waitForTimeout(900);
  await grab(name);
}

console.log('ошибки:', errs.length, errs.slice(0, 5));
await browser.close();
