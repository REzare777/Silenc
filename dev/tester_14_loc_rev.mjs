/**
 * Тест 14: обратный вариант бага локации —
 *   загрузка «деревня»-сохранения, пока игрок внутри таверны.
 */

import { withGame, grabScene, report, SHOTS } from './tester_lib.mjs';

await withGame({ start: true }, async (page) => {
  const r = await page.evaluate(() => {
    const D = window.__dbg;
    // 1) сохраняем в деревне
    D.setLocation('village');
    D.player.teleport(5, 25, 0);
    D.saveToSlot(3);
    const saved = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    // 2) идём в таверну
    D.setLocation('tavern');
    const inTavern = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), loc: D.loc };
    // 3) грузим «деревня»-слот, оставаясь в таверне
    D.loadSlot('slot3', 3);
    const after = {
      loc: D.loc,
      scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior',
      x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2),
      groundY: +D.player.groundY.toFixed(2),
      grounded: D.player.grounded,
      boxes: D.player.boxes.length,
    };
    // игрок внутри коллайдера? (застрял в стене)
    let inside = 0;
    for (const b of D.player.boxes) {
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      const dx = D.player.pos.x - b.cx, dz = D.player.pos.z - b.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz) inside++;
    }
    // пробуем пойти
    D.player.keys.clear(); D.player.keys.add('KeyW');
    for (let i = 0; i < 40; i++) D.player.update(0.05);
    D.player.keys.clear();
    const afterWalk = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), h: +D.player.y.toFixed(2), gy: +D.player.groundY.toFixed(2), grounded: D.player.grounded };
    return { saved, inTavern, after, внутри_коллайдеров: inside, после_попытки_идти: afterWalk };
  });
  report('загрузка village-слота внутри таверны', r);
  await grabScene(page, SHOTS + '/TEST_85_load_village_in_tavern.jpg');
});
