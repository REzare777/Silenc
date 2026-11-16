/**
 * Автотест подземелья: вход, интерьер, свет, выход.
 * Запуск: cd dev && node dungeon_test.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.LIVE_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(async () => {
  const d = window.__dbg, p = d.player;
  const log = [];
  const ok = (cond, text) => log.push(`${cond ? '✓' : '✗'} ${text}`);

  const gate = d.ctx.doors.dungeon;
  log.push(`вход в подземелье: (${gate.x.toFixed(1)}, ${gate.z.toFixed(1)})`);
  const dist = Math.hypot(gate.x, gate.z);
  ok(dist > 80 && dist < 130, `вход далеко от деревни: ${dist.toFixed(0)} м`);

  // 1) интеракт входа есть и рядом с игроком
  const it = d.interactables.find((x) => x.label === 'Спуститься в подземелье');
  ok(!!it, 'есть интеракт «Спуститься в подземелье»');
  if (it) {
    p.teleport(it.pos.x + 1.2, it.pos.z + 1.2, 0);
    p.y = 0; p.groundY = 0;
    const d0 = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
    ok(d0 < it.radius, `интеракт в радиусе (${d0.toFixed(2)} м)`);
    it.act();
    await new Promise((r) => setTimeout(r, 200));
    ok(d.loc === 'dungeon', `переход в подземелье: loc=${d.loc}`);
  }

  // 2) игрок внутри, под ногами пол
  const spot = d.loc === 'dungeon' ? d.dungeonLoc : null;
  ok(!!spot, 'локация подземелья доступна');
  if (spot) {
    ok(Math.hypot(p.pos.x - spot.spawn.x, p.pos.z - spot.spawn.z) < 3,
      `игрок у портала пещеры (${p.pos.x.toFixed(1)}, ${p.pos.z.toFixed(1)})`);
    ok(p.groundAt(p.pos.x, p.pos.z) > -1, `под ногами пол (${p.groundAt(p.pos.x, p.pos.z).toFixed(2)})`);

    // 3) свет: кристаллы и точки света
    let lights = 0, emissive = 0, glows = 0, maxEm = 0;
    d.sceneDungeon.traverse((o) => {
      if (o.isPointLight) lights++;
      if (o.isSprite) glows++;
      if (o.isMesh && o.material && o.material.emissiveIntensity > 1) {
        emissive++;
        maxEm = Math.max(maxEm, o.material.emissiveIntensity);
      }
    });
    ok(lights >= 5, `в пещере есть точечные источники: ${lights}`);
    ok(emissive >= 2 && maxEm > 2, `светящиеся кристаллы: ${emissive} (яркость ${maxEm.toFixed(1)})`);
    ok(glows >= 10, `мягких ореолов света: ${glows}`);
    ok(d.sceneDungeon.fog && d.sceneDungeon.fog.density > 0.02, 'в пещере плотный туман');
    ok(d.sceneDungeon.background.getHex() < 0x101020, 'фон пещеры почти чёрный');

    // 4) стены держат игрока
    const wall = spot.colliders.boxes.length;
    ok(wall >= 4, `коллайдеров стен: ${wall}`);

    // 5) выход: интеракт «Подняться на поверхность»
    const out = d.interactables.find((x) => x.label === 'Подняться на поверхность');
    ok(!!out, 'есть интеракт «Подняться на поверхность»');
    if (out) {
      p.teleport(out.pos.x, out.pos.z, 0);
      p.y = 0; p.groundY = 0;
      const d1 = Math.hypot(p.pos.x - out.pos.x, p.pos.z - out.pos.z);
      ok(d1 < out.radius, `выход в радиусе (${d1.toFixed(2)} м)`);
      out.act();
      await new Promise((r) => setTimeout(r, 200));
      ok(d.loc === 'village', `возврат в деревню: loc=${d.loc}`);
      const back = Math.hypot(p.pos.x - gate.x, p.pos.z - gate.z);
      ok(back < 8, `игрок вернулся к входу (${back.toFixed(1)} м)`);
    }
  }
  return log;
});

for (const line of res) console.log(line);
console.log('ошибки в консоли:', errs.length, errs.slice(0, 5));
const failed = res.filter((l) => l.startsWith('✗')).length;
console.log(failed ? `ПРОВАЛЕНО проверок: ${failed}` : 'Все проверки пройдены');
await browser.close();
process.exit(failed ? 1 : 0);
