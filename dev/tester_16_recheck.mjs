/**
 * Тест 16: контрольная проверка на ТЕКУЩЕЙ сборке
 *   (во время тестирования dist пересобрали и поправили посадку лука).
 */

import { withGame, grabScene, report, SHOTS } from './tester_lib.mjs';

await withGame({ start: true }, async (page, errs) => {
  report('сборка', await page.evaluate(() => ({
    assets: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
    frames: window.__frames,
  })));

  /* --- лук на текущей сборке --- */
  await page.evaluate(() => {
    const D = window.__dbg;
    D.env.setTimeOfDay('golden', true);
    D.inventory.slots[27] = { id: 'bow', spec: D.items.getItem('bow'), count: 1, best: null };
    D.inventory.touch();
    D.loadout.select(0);
    D.teleport(0, 20, Math.PI);
    D.player.pitch = -0.1;
    for (let i = 0; i < 20; i++) D.player.update(0.05);
  });
  await grabScene(page, SHOTS + '/TEST_90_bow_current_build.jpg');

  /* --- баг К1 на текущей сборке --- */
  report('К1 на текущей сборке', await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('tavern');
    D.saveToSlot(1);
    D.setLocation('village');
    D.loadSlot('slot1', 1);
    return { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior' };
  }));

  /* --- баг С1 на текущей сборке --- */
  report('С1 на текущей сборке', await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    D.spells.cast(D.items.getItem('spell_flash'));
    let found = null;
    D.scene.traverse((o) => { if (o.name === 'spellLight') found = { i: +o.intensity.toFixed(2), pos: { x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(1), z: +o.position.z.toFixed(1) }, в_сцене_деревни: true }; });
    let inDungeon = null;
    D.sceneDungeon.traverse((o) => { if (o.name === 'spellLight') inDungeon = true; });
    return { spellLight_в_деревне: found, spellLight_в_подземелье: !!inDungeon };
  }));

  report('ошибки', errs.slice());
});
