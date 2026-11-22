/**
 * Тест 8: время суток, сезоны, лук, прогулка по деревне.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const look = (x, z, yaw, pitch = -0.05) => page.evaluate(({ x, z, yaw, pitch }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.pitch = pitch;
    for (let i = 0; i < 20; i++) window.__dbg.player.update(0.05);
    return true;
  }, { x, z, yaw, pitch });

  /* ---------- время суток (клавиша T) ---------- */
  const tods = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(250);
    tods.push(await page.evaluate(() => ({ current: window.__dbg.env.current, target: window.__dbg.env.target })));
  }
  report('клавиша T: смена времени', tods);

  /* ---------- ночь ---------- */
  await page.evaluate(() => { window.__dbg.env.setTimeOfDay('night', true); });
  await look(0, 20, Math.PI);
  await grabScene(page, SHOTS + '/TEST_50_night.jpg');
  report('ночь', { яркость: await imgStats(page, SHOTS + '/TEST_50_night.jpg'), tod: await page.evaluate(() => window.__dbg.env.current) });

  /* ---------- утро ---------- */
  await page.evaluate(() => { window.__dbg.env.setTimeOfDay('morning', true); });
  await look(0, 20, Math.PI);
  await grabScene(page, SHOTS + '/TEST_51_morning.jpg');
  report('утро', { яркость: await imgStats(page, SHOTS + '/TEST_51_morning.jpg') });

  /* ---------- сезоны ---------- */
  const seasons = [];
  for (const [day, season, file] of [[1, 'spring', 'TEST_52_spring'], [6, 'summer', 'TEST_53_summer'], [11, 'autumn', 'TEST_54_autumn'], [16, 'winter', 'TEST_55_winter']]) {
    await page.evaluate(({ day, season }) => {
      window.__dbg.calendar.restore(day, season, 1);
      window.__dbg.env.setTimeOfDay('day', true);
    }, { day, season });
    await look(0, 20, Math.PI);
    await grabScene(page, SHOTS + '/' + file + '.jpg');
    seasons.push({
      day, season,
      фактический: await page.evaluate(() => window.__dbg.calendar.season),
      яркость: await imgStats(page, SHOTS + '/' + file + '.jpg'),
    });
  }
  report('сезоны', seasons);

  /* ---------- лук ---------- */
  await page.evaluate(() => {
    window.__dbg.calendar.restore(1, 'spring', 1);
    window.__dbg.env.setTimeOfDay('golden', true);
    const D = window.__dbg;
    D.inventory.slots[27] = { id: 'bow', spec: D.items.getItem('bow'), count: 1, best: null };
    D.inventory.touch();
    D.loadout.select(0);
  });
  await look(0, 20, Math.PI, -0.1);
  await grabScene(page, SHOTS + '/TEST_56_bow.jpg');
  report('лук в руках', {
    weaponId: await page.evaluate(() => window.__dbg.loadout.weaponId),
    vmWeapon: await page.evaluate(() => {
      const v = window.__dbg.viewmodel;
      return { есть: !!v.weapon, id: v.weaponSpec ? v.weaponSpec.id : null, scale: v.weapon ? v.weapon.scale.toArray() : null };
    }),
  });

  /* ---------- прогулка по деревне ---------- */
  const places = [
    { name: 'площадь_колодец', x: 0, z: 14, yaw: Math.PI, file: 'TEST_60_square' },
    { name: 'костёр_у_пруда', x: 44, z: -32, yaw: 2.2, file: 'TEST_61_campfire' },
    { name: 'мельница', x: 34, z: -33, yaw: 3.6, file: 'TEST_62_mill' },
    { name: 'кузня', x: 14.5, z: -8, yaw: 2.6, file: 'TEST_63_blacksmith' },
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
  report('прогулка по деревне', walk);

  report('итого ошибок', errs.slice());
});
