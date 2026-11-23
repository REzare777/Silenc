/**
 * Проверки раунда 58: то, что нашёл агент-тестировщик.
 *
 *  К1  сохранение восстанавливает локацию (а не только координаты);
 *  С1  свет заклинания живёт в активной сцене и гаснет;
 *  С2  пустая ячейка пояса не отнимает оружие из руки;
 *  С3  «Продолжить» сразу включает игру, а не ждёт захвата мыши;
 *  С4  ручное сохранение не затирается автосейвом на смене локации;
 *  М1  у смолы, свечи, мёда и соли свои иконки;
 *  М3  пламя факела — не белый кубик.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const BASE = 'http://127.0.0.1:4205/';
let ok = 0;
let fail = 0;
const failed = [];

/**
 * Проверка с записью результата.
 *
 * @param {string} name что проверяем
 * @param {boolean} cond результат
 * @param {string} [extra] подробности при ошибке
 */
function check(name, cond, extra = '') {
  if (cond) {
    ok++;
    console.log('✓', name);
  } else {
    fail++;
    failed.push(name);
    console.log('✗', name, extra ? `— ${extra}` : '');
  }
}

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(300000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}?v=${Date.now()}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(800);

/* ---------- К1: сохранение восстанавливает локацию ---------- */
const k1 = await page.evaluate(() => {
  const D = window.__dbg;
  // уходим в таверну
  D.setLocation('tavern');
  D.player.teleport(1.5, 0.5, 0);
  const snapshot = D.snapshot();
  const savedLoc = snapshot.loc;
  const savedPos = { x: snapshot.pos.x, z: snapshot.pos.z };
  // выходим в деревню и уходим далеко, чтобы поймать неправильную загрузку
  D.setLocation('village');
  D.player.teleport(20, 30, 0);
  // применяем сохранение
  D.applySnapshot(snapshot);
  return {
    savedLoc,
    savedPos,
    nowLoc: D.ctx ? D.ctx.loc : window.__dbg.loc,
    nowPos: { x: D.player.pos.x, z: D.player.pos.z },
  };
});
check('К1: в сохранении пишется локация', k1.savedLoc === 'tavern', `loc=${k1.savedLoc}`);
check('К1: загрузка возвращает в таверну', k1.nowLoc === 'tavern', `loc=${k1.nowLoc}`);
check('К1: загрузка возвращает точку', Math.abs(k1.nowPos.x - k1.savedPos.x) < 0.2
  && Math.abs(k1.nowPos.z - k1.savedPos.z) < 0.2, JSON.stringify(k1.nowPos));

/* ---------- К1 (обратный случай): сохранение из деревни ---------- */
const k1b = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('village');
  D.player.teleport(12, 14, 0);
  const snapshot = D.snapshot();
  D.setLocation('tavern');
  D.applySnapshot(snapshot);
  return { loc: window.__dbg.loc, x: D.player.pos.x, z: D.player.pos.z };
});
check('К1: сохранение из деревни грузится в деревню', k1b.loc === 'village', `loc=${k1b.loc}`);
check('К1: координаты деревни восстановлены', Math.abs(k1b.x - 12) < 0.3 && Math.abs(k1b.z - 14) < 0.3,
  `x=${k1b.x} z=${k1b.z}`);

/* ---------- С1: свет заклинания в активной сцене ---------- */
const c1 = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('dungeon');
  const spec = D.items.getItem('spell_flash');
  const before = D.ctx ? null : null;
  const okCast = D.spells.cast(spec);
  // лампа должна оказаться в сцене подземелья
  const scene = D.renderPass ? D.renderPass.scene : null;
  let inDungeon = false;
  let intensity = 0;
  if (scene) {
    scene.traverse((o) => {
      if (o.isPointLight && o.name === 'spellPulse') {
        inDungeon = true;
        intensity = o.intensity;
      }
    });
  }
  return { okCast, inDungeon, intensity, mana: D.stats.mana };
});
check('С1: «Огненная вспышка» колдуется', c1.okCast === true, `cast=${c1.okCast}`);
check('С1: свет вспышки живёт в активной сцене', c1.inDungeon, 'лампа не найдена в сцене подземелья');
check('С1: мана тратится', c1.mana < 100, `mana=${c1.mana}`);

/* ---------- С1: свет гаснет ---------- */
const c1b = await page.evaluate(() => {
  const D = window.__dbg;
  const spec = D.items.getItem('spell_flash');
  D.spells.cast(spec);
  // прогоняем время: откат и затухание лампы
  for (let i = 0; i < 60; i++) D.spells.update(0.1);
  let intensity = -1;
  const scene = D.renderPass ? D.renderPass.scene : null;
  if (scene) {
    scene.traverse((o) => { if (o.name === 'spellPulse') intensity = o.intensity; });
  }
  return { intensity };
});
check('С1: вспышка гаснет сама', c1b.intensity === 0, `intensity=${c1b.intensity}`);

/* ---------- С2: пустая ячейка пояса не отнимает оружие ---------- */
const c2 = await page.evaluate(() => {
  const D = window.__dbg;
  const inv = D.inventory;
  // кладём топор в первую ячейку пояса
  const axe = D.items.getItem('axe');
  inv.slots[27] = { id: 'axe', spec: axe, count: 1, best: null };
  D.loadout.select(0);
  const armed = D.loadout.weaponId;
  // жмём пустую ячейку
  D.loadout.select(3);
  const after = D.loadout.weaponId;
  return { armed, after };
});
check('С2: оружие взялось по цифре', c2.armed === 'axe', `weaponId=${c2.armed}`);
check('С2: пустая ячейка не отнимает оружие', c2.after === 'axe', `weaponId=${c2.after}`);

/* ---------- С2: проданное оружие уходит из руки ---------- */
const c2b = await page.evaluate(() => {
  const D = window.__dbg;
  D.inventory.slots[27] = null;   // топора больше нет в сумке
  D.loadout.sync();
  return { weaponId: D.loadout.weaponId };
});
check('С2: пропавший из сумки оружие убирается из руки', c2b.weaponId === null, `weaponId=${c2b.weaponId}`);

/* ---------- С3: «Продолжить» сразу включает игру ---------- */
const c3 = await page.evaluate(() => {
  const D = window.__dbg;
  D.ctx.mode = 'menu';
  D.enterGame();
  return { mode: D.ctx.mode };
});
check('С3: игра включается сразу после «Продолжить»', c3.mode === 'play', `mode=${c3.mode}`);

/* ---------- С4: ручное сохранение не затирается автосейвом ---------- */
const c4 = await page.evaluate(() => {
  const D = window.__dbg;
  D.setLocation('village');
  D.player.teleport(5, 5, 0);
  D.saveGame(true);
  // сразу уходим в таверну: автосейв не должен переписать ручное
  D.setLocation('tavern');
  const raw = localStorage.getItem('wv.save.v1');
  const snap = raw ? JSON.parse(raw) : null;
  return snap ? { loc: snap.loc, x: snap.pos.x, z: snap.pos.z } : null;
});
check('С4: автосейв не затирает ручное сохранение', !!c4 && c4.loc === 'village'
  && Math.abs(c4.x - 5) < 0.3 && Math.abs(c4.z - 5) < 0.3, JSON.stringify(c4));

/* ---------- М1: иконки товаров разные ---------- */
const m1 = await page.evaluate(() => {
  const D = window.__dbg;
  const ids = ['pitch', 'candle', 'honey', 'salt'];
  // иконка приходит канвасом: сравниваем по пикселям, а не по ссылке
  const hashes = ids.map((id) => {
    const src = D.items.itemIcon(D.items.getItem(id), 32);
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) | 0;
    return h;
  });
  return { count: new Set(hashes).size, total: hashes.length };
});
check('М1: у смолы, свечи, мёда и соли разные иконки', m1.count === 4, `уникальных=${m1.count}`);

/* ---------- М3: пламя факела не белый кубик ---------- */
const m3 = await page.evaluate(() => {
  const D = window.__dbg;
  const brand = D.combat.brand;
  const out = [];
  brand.flame.traverse((o) => {
    if (o.isMesh && o.material && o.material.color) {
      out.push({
        hex: o.material.color.getHexString(),
        emissive: o.material.emissive ? o.material.emissive.getHexString() : '',
        intensity: o.material.emissiveIntensity ?? 0,
      });
    }
  });
  return out;
});
check('М3: у пламени есть оранжевая часть',
  m3.some((m) => m.hex.startsWith('ff') && !m.hex.startsWith('ffff')), JSON.stringify(m3));
check('М3: ядро пламени не пересвечено',
  m3.every((m) => m.intensity <= 2.2), JSON.stringify(m3));

/* ---------- ошибки в консоли ---------- */
check('нет ошибок в консоли', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\nr58_check: ${ok} ok, ${fail} fail`);
if (fail) {
  console.log('не прошли:', failed.join(', '));
  process.exit(1);
}
