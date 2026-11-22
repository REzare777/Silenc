import { withGame, report } from './tester_lib.mjs';

await withGame({ start: true }, async (page) => {
  const log = await page.evaluate(() => {
    const p = window.__dbg.player;
    p.teleport(0, 16, Math.PI);
    p.update(0.016);
    p.vy = p.jumpSpeed; p.grounded = false;
    const out = [];
    for (let i = 0; i < 12; i++) {
      p.update(0.05);
      out.push({
        i, y: +p.y.toFixed(4), groundY: +p.groundY.toFixed(4), vy: +p.vy.toFixed(3),
        grounded: p.grounded, camY: p.camY === null ? null : +p.camY.toFixed(4),
        gh: +p.groundAt(p.pos.x, p.pos.z, p.groundY + p.y, p.vy > 0.01 ? 0 : 0.46).toFixed(4),
        floor: p.floorAt(p.pos.x, p.pos.z),
        platforms: p.platforms.length,
      });
    }
    return out;
  });
  report('прыжок пошагово', log);
});
