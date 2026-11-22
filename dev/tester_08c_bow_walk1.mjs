import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const look = (x, z, yaw, pitch = -0.05) => page.evaluate(({ x, z, yaw, pitch }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.pitch = pitch;
    for (let i = 0; i < 20; i++) window.__dbg.player.update(0.05);
    return true;
  }, { x, z, yaw, pitch });

  await page.evaluate(() => {
    const D = window.__dbg;
    D.calendar.restore(1, 'spring', 1);
    D.env.setTimeOfDay('golden', true);
    D.inventory.slots[27] = { id: 'bow', spec: D.items.getItem('bow'), count: 1, best: null };
    D.inventory.touch();
    D.loadout.select(0);
  });
  await look(0, 20, Math.PI, -0.1);
  await grabScene(page, SHOTS + '/TEST_56_bow.jpg');
  report('лук в руках', {
    weaponId: await page.evaluate(() => window.__dbg.loadout.weaponId),
    vm: await page.evaluate(() => { const v = window.__dbg.viewmodel; return { есть: !!v.weapon, id: v.weaponSpec ? v.weaponSpec.id : null }; }),
  });

  const places = [
    { name: 'площадь_колодец', x: 0, z: 14, yaw: Math.PI, file: 'TEST_60_square' },
    { name: 'костёр_у_пруда', x: 44, z: -32, yaw: 2.2, file: 'TEST_61_campfire' },
    { name: 'мельница', x: 34, z: -33, yaw: 3.6, file: 'TEST_62_mill' },
    { name: 'кузня', x: 14.5, z: -8, yaw: 2.6, file: 'TEST_63_blacksmith' },
  ];
  const walk = [];
  for (const p of places) {
    await look(p.x, p.z, p.yaw, -0.02);
    await grabScene(page, SHOTS + '/' + p.file + '.jpg');
    walk.push({ ...p, яркость: await imgStats(page, SHOTS + '/' + p.file + '.jpg'), pos: await page.evaluate(() => ({ x: +window.__dbg.player.pos.x.toFixed(1), z: +window.__dbg.player.pos.z.toFixed(1), y: +window.__dbg.player.y.toFixed(2), grounded: window.__dbg.player.grounded })) });
  }
  report('прогулка (часть 1)', walk);
  report('итого ошибок', errs.slice());
});
