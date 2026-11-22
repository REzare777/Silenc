import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const look = (x, z, yaw, pitch = -0.05) => page.evaluate(({ x, z, yaw, pitch }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.pitch = pitch;
    for (let i = 0; i < 20; i++) window.__dbg.player.update(0.05);
    return true;
  }, { x, z, yaw, pitch });

  const places = [
    { name: 'таверна', x: -17, z: -13, yaw: 0.6, file: 'TEST_64_tavern_out' },
    { name: 'церковь', x: 3, z: 44, yaw: 0.2, file: 'TEST_65_church_out' },
    { name: 'амбар', x: -30, z: 64, yaw: 0.4, file: 'TEST_66_barn_out' },
    { name: 'вход_в_подземелье', x: -72, z: -66, yaw: 2.0, file: 'TEST_67_dungeon_gate' },
  ];
  const walk = [];
  for (const p of places) {
    await look(p.x, p.z, p.yaw, -0.02);
    await grabScene(page, SHOTS + '/' + p.file + '.jpg');
    walk.push({ ...p, яркость: await imgStats(page, SHOTS + '/' + p.file + '.jpg'), pos: await page.evaluate(() => ({ x: +window.__dbg.player.pos.x.toFixed(1), z: +window.__dbg.player.pos.z.toFixed(1), y: +window.__dbg.player.y.toFixed(2), grounded: window.__dbg.player.grounded })) });
  }
  report('прогулка (часть 2)', walk);
  report('итого ошибок', errs.slice());
});
