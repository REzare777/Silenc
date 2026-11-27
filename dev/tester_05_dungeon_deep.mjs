/**
 * Тест 5: подземелье — спуск в шахту, нижний ярус, тени нападают.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  await page.evaluate(() => window.__dbg.setLocation('dungeon'));

  report('структура подземелья', await page.evaluate(() => {
    const p = window.__dbg.player;
    return {
      floors: p.floors,
      climbs: p.climbs.map((c) => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), r: c.r, y0: c.y0, y1: c.y1, exitX: +c.exitX.toFixed(2), exitZ: +c.exitZ.toFixed(2) })),
      platforms: p.platforms.map((x) => ({ cx: +x.cx.toFixed(2), cz: +x.cz.toFixed(2), y: x.y, hx: x.hx, hz: x.hz, ramp: !!x.ramp, sp: !!x.sp })).slice(0, 25),
    };
  }));

  /* ---------- спуск в шахту ---------- */
  const descent = await page.evaluate(() => {
    const p = window.__dbg.player;
    const out = [];
    // идём на юг (уменьшаем z) до шахты (z ≈ 10) — старт в z=-26
    p.pitch = 0;
    for (let i = 0; i < 320; i++) {
      p.keys.clear(); p.keys.add('KeyW');
      p.update(0.05);
      if (i % 60 === 0) out.push({ i, x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.y.toFixed(2), gy: +p.groundY.toFixed(2), g: p.grounded });
    }
    out.push({ i: 320, x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), h: +p.y.toFixed(2), gy: +p.groundY.toFixed(2), g: p.grounded });
    return out;
  });
  report('ход на юг (к шахте)', descent);

  /* ---------- переход вниз: лестницы нет, только интеракт у парапета ---------- */
  const stairs = await page.evaluate(() => {
    const D = window.__dbg;
    const p = D.player;
    const out = [];
    // спускаемся по интеракту «Спуститься в зал Врат»
    const it = (D.ctx.interactables || []).find((x) => x.label === 'Спуститься в зал Врат');
    if (!it) return [{ note: 'интеракта нет' }];
    out.push({ note: 'интеракт найден', x: it.pos.x, z: it.pos.z, r: it.radius });
    it.act();
    out.push({ note: 'после перехода', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), gy: +p.groundY.toFixed(2), h: +p.y.toFixed(2) });
    for (let i = 0; i < 40; i++) { p.keys.clear(); p.update(0.05); }
    out.push({ note: 'устояли', x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), gy: +p.groundY.toFixed(2), h: +p.y.toFixed(2) });
    return out;
  });
  report('переход в зал Врат (без лестницы)', stairs);

  await grabScene(page, SHOTS + '/TEST_23_dungeon_deep.jpg');
  report('яркость нижнего яруса', await imgStats(page, SHOTS + '/TEST_23_dungeon_deep.jpg'));

  /* ---------- проверка пола нижнего яруса ---------- */
  const floorCheck = await page.evaluate(() => {
    const p = window.__dbg.player;
    const out = [];
    for (const [x, z] of [[0, 20], [0, 26], [6, 28], [-6, 28], [0, 32], [10, 24], [-10, 24]]) {
      p.teleport(x, z, 0);
      for (let i = 0; i < 40; i++) p.update(0.05);
      out.push({ x, z, h: +p.y.toFixed(2), gy: +p.groundY.toFixed(2), grounded: p.grounded, vy: +p.vy.toFixed(2) });
    }
    return out;
  });
  report('пол нижнего яруса', floorCheck);

  /* ---------- тени нападают (без факела, в пещере) ---------- */
  const attack = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    // встаём в пещере (не в безопасном зале)
    D.player.teleport(0, -10, 0);
    D.combat.setTorchEquipped(false);
    D.combat.state.lit = false;
    D.shadows.clear();
    D.shadows.spawn();
    const start = { n: D.shadows.list.length, hp: D.stats.hp };
    const log = [];
    for (let i = 0; i < 300; i++) {
      D.shadows.update(0.1, i * 0.1);
      D.combat.update(0.1, i * 0.1);
      if (i % 50 === 0) {
        const near = Math.min(...D.shadows.list.map((s) => Math.hypot(s.x - D.player.pos.x, s.z - D.player.pos.z)));
        log.push({ t: +(i * 0.1).toFixed(1), hp: +D.stats.hp.toFixed(1), near: +near.toFixed(2), threat: +(D.ctx.shadowThreat || 0).toFixed(2) });
      }
    }
    return { start, log, end: { hp: D.stats.hp, dead: D.stats.hp <= 0, deaths: D.death ? D.death.isDead : null } };
  });
  report('тени нападают (30 с, без факела)', attack);

  report('итого ошибок', errs.slice());
});
