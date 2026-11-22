/**
 * Тест 2: ходьба, бег, прыжок, столкновения.
 *
 * Кадры в софтверном рендере идут по 10–60 секунд, поэтому продвижение
 * движения делается прямым вызовом player.update(dt) — как это делает
 * игровой цикл, но без ожидания картинки.
 */

import { withGame, grabScene, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const pos = () => page.evaluate(() => {
    const p = window.__dbg.player;
    return {
      x: +p.pos.x.toFixed(3), y: +p.pos.y.toFixed(3), z: +p.pos.z.toFixed(3),
      groundY: +p.groundY.toFixed(3), vy: +p.vy.toFixed(3),
      grounded: p.grounded, camY: p.camY === null ? null : +p.camY.toFixed(3),
      loc: window.__dbg.loc, mode: window.__dbg.mode,
    };
  });

  /** Прогнать N шагов симуляции с зажатыми клавишами. */
  const step = (codes, n = 30, dt = 0.05) => page.evaluate(({ codes, n, dt }) => {
    const p = window.__dbg.player;
    p.keys.clear();
    for (const c of codes) p.keys.add(c);
    for (let i = 0; i < n; i++) p.update(dt);
    p.keys.clear();
    return true;
  }, { codes, n, dt });

  const teleport = (x, z, yaw) => page.evaluate(({ x, z, yaw }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.update(0.016);
    return true;
  }, { x, z, yaw });

  report('старт', await pos());

  /* ---------- 1. Ходьба вперёд ---------- */
  await teleport(0, 16, Math.PI);      // смотрит в сторону -Z? yaw=PI
  const a0 = await pos();
  await step(['KeyW'], 40);
  const a1 = await pos();
  report('ходьба W (40 шагов по 0.05 c = 2 c)', { a0, a1, d: +(Math.hypot(a1.x - a0.x, a1.z - a0.z)).toFixed(3) });

  /* ---------- 2. Бег (Shift) ---------- */
  await teleport(0, 16, Math.PI);
  const b0 = await pos();
  await step(['KeyW', 'ShiftLeft'], 40);
  const b1 = await pos();
  report('бег Shift+W', { b0, b1, d: +(Math.hypot(b1.x - b0.x, b1.z - b0.z)).toFixed(3), stamina: await page.evaluate(() => +window.__dbg.stats.stamina.toFixed(1)) });

  /* ---------- 3. Прыжок ---------- */
  await teleport(0, 16, Math.PI);
  await page.evaluate(() => { window.__dbg.player.vy = window.__dbg.player.jumpSpeed; window.__dbg.player.grounded = false; });
  const j1 = await pos();
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__dbg.player.update(0.05); });
  const j2 = await pos();
  await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__dbg.player.update(0.05); });
  const j3 = await pos();
  report('прыжок', { старт: j1, через_0_5с: j2, приземление: j3 });

  /* ---------- 4. Столкновения: идём в стену ---------- */
  const boxes = await page.evaluate(() => window.__dbg.colliders.boxes.slice(0, 8).map((b) => ({
    cx: +b.cx.toFixed(2), cz: +b.cz.toFixed(2), hx: b.hx, hz: b.hz, ang: +(b.ang || 0).toFixed(3), y0: b.y0, y1: b.y1,
  })));
  report('первые коллайдеры (деревня)', boxes);

  // выбрать ближайший прямоугольный коллайдер и упереться в него
  const target = await page.evaluate(() => {
    const p = window.__dbg.player;
    let best = null, bd = Infinity;
    for (const b of window.__dbg.colliders.boxes) {
      if (!Number.isFinite(b.hx) || b.hx < 0.6 || b.hz < 0.6) continue;
      const d = Math.hypot(b.cx - p.pos.x, b.cz - p.pos.z);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return null;
    // встать перед центром стены и повернуться к ней
    const ang = Math.atan2(best.cx - p.pos.x, best.cz - p.pos.z);
    return { cx: best.cx, cz: best.cz, hx: best.hx, hz: best.hz, ang, dist: bd };
  });
  report('ближайшая стена', target);

  if (target) {
    // встать снаружи и толкаться в стену
    const nx = Math.cos(target.ang), nz = -Math.sin(target.ang);
    const stand = 2.2;
    await teleport(target.cx + nx * stand, target.cz + nz * stand, Math.atan2(-nx, -nz));
    const c0 = await pos();
    await step(['KeyW'], 80, 0.05);
    const c1 = await pos();
    report('упор в стену', { c0, c1, moved: +Math.hypot(c1.x - c0.x, c1.z - c0.z).toFixed(3) });
  }

  /* ---------- 5. Не проваливается ли под землю ---------- */
  const probe = [];
  for (const [x, z] of [[0, 16], [0, 0], [10, 10], [-20, 5], [30, -10], [0, 60], [45, 45]]) {
    await teleport(x, z, 0);
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__dbg.player.update(0.05); });
    const p = await pos();
    probe.push({ x, z, ...p });
  }
  report('пол под ногами (30 шагов покоя)', probe);

  /* ---------- 6. Границы мира ---------- */
  await teleport(0, 0, 0);
  await page.evaluate(() => {
    const p = window.__dbg.player;
    p.keys.clear(); p.keys.add('KeyW');
    for (let i = 0; i < 400; i++) p.update(0.05);
    p.keys.clear();
  });
  report('после 20 с ходьбы вперёд', await pos());

  await grabScene(page, SHOTS + '/TEST_03_move.jpg');
  report('ошибки (пока)', errs.length);
});

report('ошибки консоли', errors);
