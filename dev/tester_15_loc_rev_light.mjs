/**
 * Тест 15:
 *   A) загрузка «деревня»-слота, пока игрок внутри таверны (обратный вариант бага локации);
 *   B) заклинания-светочи оставляют «залипший» источник света в сцене деревни.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

await withGame({ start: true }, async (page) => {
  /* ---------- A ---------- */
  const r = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    D.player.teleport(5, 25, 0);
    D.saveToSlot(3);
    const saved = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.setLocation('tavern');
    const inTavern = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), loc: D.loc };
    D.loadSlot('slot3', 3);
    const after = {
      loc: D.loc,
      scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior',
      x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2),
      groundY: +D.player.groundY.toFixed(2), grounded: D.player.grounded,
      boxes: D.player.boxes.length,
    };
    let inside = 0;
    for (const b of D.player.boxes) {
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      const dx = D.player.pos.x - b.cx, dz = D.player.pos.z - b.cz;
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) < b.hx && Math.abs(lz) < b.hz) inside++;
    }
    D.player.keys.clear(); D.player.keys.add('KeyW');
    for (let i = 0; i < 40; i++) D.player.update(0.05);
    D.player.keys.clear();
    return { saved, inTavern, after, внутри_коллайдеров: inside, после_попытки_идти: { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), h: +D.player.y.toFixed(2), gy: +D.player.groundY.toFixed(2), grounded: D.player.grounded } };
  });
  report('A) загрузка village-слота внутри таверны', r);
  await grabScene(page, SHOTS + '/TEST_85_load_village_in_tavern.jpg');

  /* ---------- B ---------- */
  const lights0 = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    const out = [];
    D.scene.traverse((o) => { if (o.isLight) out.push({ name: o.name || o.type, i: +o.intensity.toFixed(2), d: o.distance, pos: { x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(1), z: +o.position.z.toFixed(1) } }); });
    return out.filter((l) => l.i > 0.5);
  });
  report('B) яркие источники в сцене деревни ДО заклинания', lights0);

  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    D.spells.cast(D.items.getItem('spell_flash'));
  });
  const lights1 = await page.evaluate(() => {
    const D = window.__dbg;
    const out = [];
    D.scene.traverse((o) => { if (o.isLight) out.push({ name: o.name || o.type, i: +o.intensity.toFixed(2), d: o.distance, pos: { x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(1), z: +o.position.z.toFixed(1) }, inDungeonScene: D.sceneDungeon.children.includes(o) }); });
    return out.filter((l) => l.i > 0.5);
  });
  report('B) яркие источники в сцене деревни ПОСЛЕ «Огненной вспышки»', lights1);

  await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    D.player.teleport(0, 12, Math.PI);
    for (let i = 0; i < 20; i++) D.player.update(0.05);
  });
  await grabScene(page, SHOTS + '/TEST_86_village_after_flash.jpg');
  report('B) яркость деревни у колодца после заклинания', await imgStats(page, SHOTS + '/TEST_86_village_after_flash.jpg'));
});
