import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  const look = (x, z, yaw, pitch = -0.05) => page.evaluate(({ x, z, yaw, pitch }) => {
    window.__dbg.teleport(x, z, yaw);
    window.__dbg.player.pitch = pitch;
    for (let i = 0; i < 20; i++) window.__dbg.player.update(0.05);
    return true;
  }, { x, z, yaw, pitch });

  await page.evaluate(() => { window.__dbg.env.setTimeOfDay('night', true); });
  await look(0, 20, Math.PI);
  await grabScene(page, SHOTS + '/TEST_50_night.jpg');
  report('ночь', { яркость: await imgStats(page, SHOTS + '/TEST_50_night.jpg') });

  const seasons = [];
  for (const [day, season, file] of [[1, 'spring', 'TEST_52_spring'], [6, 'summer', 'TEST_53_summer'], [11, 'autumn', 'TEST_54_autumn'], [16, 'winter', 'TEST_55_winter']]) {
    await page.evaluate(({ day, season }) => {
      window.__dbg.calendar.restore(day, season, 1);
      window.__dbg.env.setTimeOfDay('day', true);
    }, { day, season });
    await look(0, 20, Math.PI);
    await grabScene(page, SHOTS + '/' + file + '.jpg');
    seasons.push({ day, season, фактический: await page.evaluate(() => window.__dbg.calendar.season), снег: await page.evaluate(() => window.__dbg.snow && window.__dbg.snow.season), яркость: await imgStats(page, SHOTS + '/' + file + '.jpg') });
  }
  report('сезоны', seasons);
  report('итого ошибок', errs.slice());
});
