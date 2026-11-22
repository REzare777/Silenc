/**
 * Тест 3: локации — амбар, таверна, подземелье, дом, храм.
 *
 * Проверяем: вход, пол (не проваливается), освещение (не чёрно), выход.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const LOCS = [
  { id: 'barn', file: 'TEST_10_barn' },
  { id: 'tavern', file: 'TEST_11_tavern' },
  { id: 'dungeon', file: 'TEST_12_dungeon' },
  { id: 'home0', file: 'TEST_13_home' },
  { id: 'church', file: 'TEST_14_church' },
];

const errors = await withGame({ start: true }, async (page, errs) => {
  for (const L of LOCS) {
    const before = await page.evaluate(() => window.__frames || 0);
    const st = await page.evaluate((id) => {
      window.__dbg.setLocation(id);
      const p = window.__dbg.player;
      for (let i = 0; i < 60; i++) p.update(0.05);
      const light = [];
      window.__dbg.scene.traverse((o) => { if (o.isLight) light.push({ type: o.type, i: +o.intensity.toFixed(2), d: o.distance }); });
      return {
        loc: window.__dbg.loc,
        mode: window.__dbg.mode,
        renderScene: window.__dbg.ctx.renderPass.scene === window.__dbg.scene ? 'village' : 'other',
        pos: { x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2) },
        heightAboveGround: +p.y.toFixed(3),
        groundY: +p.groundY.toFixed(3),
        grounded: p.grounded,
        vy: +p.vy.toFixed(3),
        floors: (p.floors || []).length,
        platforms: p.platforms.length,
        boxes: p.boxes.length,
        circles: p.circles.length,
        combatActive: window.__dbg.combat.state.active,
        torchEquipped: window.__dbg.combat.state.torchEquipped,
        shadows: window.__dbg.shadows.count ? window.__dbg.shadows.count() : null,
      };
    }, L.id);
    report('локация ' + L.id, st);

    await grabScene(page, SHOTS + '/' + L.file + '.jpg');
    report('  яркость ' + L.id, await imgStats(page, SHOTS + '/' + L.file + '.jpg'));
    report('  ошибок после ' + L.id, errs.slice());
  }

  /* ---------- выход из каждой локации ---------- */
  const exits = [];
  for (const L of LOCS) {
    const r = await page.evaluate((id) => {
      window.__dbg.setLocation(id);
      window.__dbg.setLocation('village');
      const p = window.__dbg.player;
      for (let i = 0; i < 40; i++) p.update(0.05);
      return { from: id, loc: window.__dbg.loc, pos: { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) }, grounded: p.grounded, y: +p.y.toFixed(3) };
    }, L.id);
    exits.push(r);
  }
  report('выход в деревню', exits);

  /* ---------- подземелье: пол и спуск ---------- */
  await page.evaluate(() => window.__dbg.setLocation('dungeon'));
  const dun = await page.evaluate(() => {
    const p = window.__dbg.player;
    const out = [];
    // спускаемся по лестнице в шахте: идём вперёд и смотрим вниз
    for (let i = 0; i < 200; i++) {
      p.keys.clear(); p.keys.add('KeyW');
      p.pitch = -0.9;
      p.update(0.05);
      if (i % 40 === 0) out.push({ i, x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.y.toFixed(2), gy: +p.groundY.toFixed(2), g: p.grounded });
    }
    p.keys.clear();
    out.push({ i: 200, x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.y.toFixed(2), gy: +p.groundY.toFixed(2), g: p.grounded });
    return out;
  });
  report('спуск в подземелье (шаги)', dun);

  report('итого ошибок', errs.slice());
});
