import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:4205/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.click('#begin');
await page.waitForTimeout(2000);
const ok = (n, c) => console.log(`${c ? '✓' : '✗'} ${n}`);

// 1. прыжок
const jmp = await page.evaluate(() => {
  const p = window.__dbg.player;
  p.teleport(0, -6, Math.PI); p.vel.set(0,0,0);
  let max = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  for (let i = 0; i < 120; i++) { p.update(1/60); max = Math.max(max, p.y); }
  p.keys.clear();
  for (let i = 0; i < 120; i++) p.update(1/60);
  return { max, y: p.y, g: p.grounded };
});
ok(`прыжок: высота ${jmp.max.toFixed(2)} м, приземление y=${jmp.y.toFixed(2)} grounded=${jmp.g}`, jmp.max > 0.6 && jmp.max < 0.95 && jmp.y === 0 && jmp.g);

// 2. столкновение со стеной
const wall = await page.evaluate(() => {
  const d = window.__dbg, p = d.player;
  p.teleport(0, -6, Math.PI); p.keys.clear(); p.keys.add('KeyW');
  for (let i = 0; i < 240; i++) p.update(1/60);
  p.keys.clear();
  let gap = 1e9;
  for (const c of d.colliders.circles) {
    if (c.soft) continue;
    gap = Math.min(gap, Math.hypot(p.pos.x-c.x, p.pos.z-c.z) - c.r);
  }
  for (const b of d.colliders.boxes) {
    const c = Math.cos(b.ang||0), s = Math.sin(b.ang||0);
    const dx = p.pos.x-b.cx, dz = p.pos.z-b.cz;
    const lx = c*dx-s*dz, lz = s*dx+c*dz;
    const qx = Math.max(-b.hx, Math.min(lx,b.hx)), qz = Math.max(-b.hz, Math.min(lz,b.hz));
    gap = Math.min(gap, Math.hypot(lx-qx, lz-qz));
  }
  return +gap.toFixed(3);
});
ok(`стена: зазор ${wall} м (радиус игрока 0.34)`, Math.abs(wall - 0.34) < 0.02);

// 3. меню Esc + настройки + Продолжить
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
const menuOn = await page.evaluate(() => document.getElementById('menu').classList.contains('on'));
console.log('  состояние перед кликом:', JSON.stringify(await page.evaluate(() => {
  const b = document.querySelector('#segQ button[data-q="high"]');
  const r = b ? b.getBoundingClientRect() : null;
  const top = r ? document.elementFromPoint(r.x + r.width/2, r.y + r.height/2) : null;
  return { menu: document.getElementById('menu').className, mode: window.__dbg.mode, locked: !!document.pointerLockElement,
           rect: r ? [r.x|0, r.y|0] : null, top: top ? (top.id || top.className || top.tagName) : null,
           scrollY: window.scrollY, bodyH: document.body.scrollHeight };
})));
await page.click('#segQ button[data-q="high"]');
await page.waitForTimeout(1500);
const q = await page.evaluate(() => ({ pr: window.__dbg.renderer.getPixelRatio(), sh: window.__dbg.renderer.shadowMap.enabled }));
await page.click('#resume');
await page.waitForTimeout(1500);
const back = await page.evaluate(() => !!document.pointerLockElement);
ok(`меню: открылось=${menuOn}, качество «Высокое» pr=${q.pr} тени=${q.sh}, вернулись=${back}`, menuOn && q.pr >= 1 && back);

// 4. отладка границ
await page.keyboard.press('KeyC');
await page.waitForTimeout(1200);
const dbg = await page.evaluate(() => !!window.__dbg.scene.getObjectByName('colliderDebug'));
await page.keyboard.press('KeyC');
ok(`клавиша C: границы показаны=${dbg}`, dbg);

// 5. время суток через меню
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await page.click('#segT button[data-tod="night"]');
await page.waitForTimeout(1800);
const tod = await page.evaluate(() => ({
  hudOn: [...document.querySelectorAll('#timebar button')].find(b => b.classList.contains('on'))?.dataset.tod,
  menuOn: [...document.querySelectorAll('#segT button')].find(b => b.classList.contains('on'))?.dataset.tod,
}));
await page.click('#resume');
await page.waitForTimeout(800);
ok(`время суток в меню: HUD=${tod.hudOn}, меню=${tod.menuOn}`, tod.hudOn === 'night' && tod.menuOn === 'night');

// 6. взаимодействия
await page.evaluate(() => window.__dbg.teleport(0, 2.2, 0));
await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
await page.waitForTimeout(800);
const toast = await page.evaluate(() => document.querySelector('#toast')?.textContent || '');
ok(`взаимодействие у колодца: "${toast.slice(0, 40)}"`, toast.length > 3);

console.log('\nошибки:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
