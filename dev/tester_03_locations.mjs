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

  /* ---------- подземелье: пол и переход вниз ---------- */
  await page.evaluate(() => window.__dbg.setLocation('dungeon'));
  const dun = await page.evaluate(() => {
    const D = window.__dbg;
    const p = D.player;
    const out = [];
    // в шахте лестницы нет: переход в зал Врат — по интеракту у парапета
    const it = (D.ctx.interactables || []).find((x) => x.label === 'Спуститься в зал Врат');
    if (!it) return [{ note: 'интеракта нет' }];
    out.push({ note: 'интеракт найден', x: it.pos.x, z: it.pos.z, r: it.radius });
    it.act();
    for (let i = 0; i < 40; i++) { p.keys.clear(); p.update(0.05); }
    out.push({ note: 'после перехода', x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), gy: +p.groundY.toFixed(2), g: p.grounded });
    return out;
  });
  report('переход в зал Врат', dun);

  report('итого ошибок', errs.slice());
});
