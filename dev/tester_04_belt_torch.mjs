/**
 * Тест 4: пояс (1–9), факел (R/F), заклинания, подземелье с факелом и без.
 */

import { withGame, grabScene, imgStats, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- выдать предметы на пояс ---------- */
  const give = await page.evaluate(() => {
    const D = window.__dbg;
    const put = (slot, id) => {
      const spec = D.items.getItem(id);
      if (!spec) return 'нет предмета ' + id;
      D.inventory.slots[slot] = { id, spec, count: 1, best: null };
      return id;
    };
    const r = [put(27, 'axe'), put(28, 'torch'), put(29, 'spell_flash'), put(30, 'pitch'), put(31, 'spell_heal')];
    D.inventory.touch();
    return { r, belt: D.inventory.slots.slice(27, 36).map((s, i) => s ? `${i + 1}:${s.id}` : null) };
  });
  report('выдано на пояс', give);

  /* ---------- цифра 1: оружие в правую руку ---------- */
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(300);
  report('клавиша 1 (оружие)', await page.evaluate(() => ({
    weaponId: window.__dbg.loadout.weaponId,
    armed: window.__dbg.loadout.armed,
    sel: window.__dbg.inventory.sel,
    vmWeapon: !!(window.__dbg.viewmodel.weapon || window.__dbg.viewmodel.weaponGroup),
    vmKeys: Object.keys(window.__dbg.viewmodel).filter((k) => /weapon|torch|hand/i.test(k)),
  })));

  /* ---------- цифра 2: факел ---------- */
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(300);
  report('клавиша 2 (факел на поясе)', await page.evaluate(() => ({
    torchEquipped: window.__dbg.combat.state.torchEquipped,
    loadoutTorch: window.__dbg.loadout.torchEquipped,
    weaponId: window.__dbg.loadout.weaponId,
  })));

  /* ---------- R: взять/убрать факел ---------- */
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(300);
  const afterR = await page.evaluate(() => ({ torchEquipped: window.__dbg.combat.state.torchEquipped, lit: window.__dbg.combat.state.lit }));
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(300);
  const afterR2 = await page.evaluate(() => ({ torchEquipped: window.__dbg.combat.state.torchEquipped, lit: window.__dbg.combat.state.lit }));
  report('клавиша R (факел в руку)', { после_первого_R: afterR, после_второго_R: afterR2 });

  /* ---------- F: зажечь факел ---------- */
  await page.evaluate(() => { window.__dbg.loadout.setTorchEquipped(true); });
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(300);
  const lighting = await page.evaluate(() => ({ lit: window.__dbg.combat.state.lit, lighting: window.__dbg.combat.state.lighting, fuel: window.__dbg.combat.state.fuel }));
  // домотать разжигание
  await page.evaluate(() => {
    const c = window.__dbg.combat;
    for (let i = 0; i < 30; i++) c.update(0.1, i * 0.1);
  });
  const litState = await page.evaluate(() => ({ lit: window.__dbg.combat.state.lit, fuel: +window.__dbg.combat.state.fuel.toFixed(1) }));
  report('клавиша F (зажечь)', { сразу_после_F: lighting, после_дожигания: litState });

  /* ---------- цифра 5: «Живой огонь» — тратит ману ---------- */
  const manaBefore = await page.evaluate(() => window.__dbg.stats.mana);
  await page.keyboard.press('Digit5');
  await page.waitForTimeout(300);
  report('клавиша 5 (Лечебное слово)', {
    mana_before: manaBefore,
    mana_after: await page.evaluate(() => window.__dbg.stats.mana),
    hp: await page.evaluate(() => window.__dbg.stats.hp),
  });

  /* ---------- цифра 3: «Огненная вспышка» ---------- */
  const manaBefore2 = await page.evaluate(() => window.__dbg.stats.mana);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(300);
  report('клавиша 3 (Огненная вспышка)', {
    mana_before: manaBefore2,
    mana_after: await page.evaluate(() => window.__dbg.stats.mana),
  });

  /* ---------- цифра 4: смола и фитиль (заправка факела) ---------- */
  const fuelBefore = await page.evaluate(() => window.__dbg.combat.state.fuel);
  await page.evaluate(() => { window.__dbg.combat.state.fuel = 20; });
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(300);
  report('клавиша 4 (смола и фитиль)', {
    fuel_before: fuelBefore,
    fuel_after: await page.evaluate(() => +window.__dbg.combat.state.fuel.toFixed(1)),
    pitch_left: await page.evaluate(() => window.__dbg.inventory.countOf('pitch')),
  });

  /* ---------- пустая ячейка ---------- */
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(200);
  report('клавиша 9 (пусто)', await page.evaluate(() => ({ sel: window.__dbg.inventory.sel, weaponId: window.__dbg.loadout.weaponId })));

  /* ---------- инвентарь (I) ---------- */
  await page.keyboard.press('KeyI');
  await page.waitForTimeout(500);
  report('инвентарь открыт', await page.evaluate(() => ({ mode: window.__dbg.mode, invVisible: !!document.querySelector('#inv.on, #inventory.on') })));
  await page.screenshot({ path: SHOTS + '/TEST_20_inventory.jpg', type: 'jpeg', quality: 82, timeout: 180000 });
  await page.keyboard.press('KeyI');
  await page.waitForTimeout(300);

  /* ---------- подземелье БЕЗ факела ---------- */
  await page.evaluate(() => {
    window.__dbg.combat.setTorchEquipped(false);
    window.__dbg.setLocation('dungeon');
  });
  await grabScene(page, SHOTS + '/TEST_21_dungeon_dark.jpg');
  report('подземелье без факела', {
    яркость: await imgStats(page, SHOTS + '/TEST_21_dungeon_dark.jpg'),
    shadows: await page.evaluate(() => window.__dbg.shadows.list.length),
    torchEquipped: await page.evaluate(() => window.__dbg.combat.state.torchEquipped),
    lit: await page.evaluate(() => window.__dbg.combat.state.lit),
    lantern: await page.evaluate(() => {
      const L = window.__dbg.dungeonLoc.lights.lantern;
      return L ? { intensity: +L.intensity.toFixed(2), distance: L.distance } : null;
    }),
  });

  /* ---------- тени нападают? ---------- */
  const shadowSim = await page.evaluate(() => {
    const D = window.__dbg;
    D.shadows.spawn();
    const before = { n: D.shadows.list.length, hp: D.stats.hp, threat: D.combat.state.threat };
    // 20 секунд боя без факела
    for (let i = 0; i < 200; i++) {
      D.shadows.update(0.1, i * 0.1);
      D.combat.update(0.1, i * 0.1);
    }
    const after = { n: D.shadows.list.length, hp: D.stats.hp, threat: +D.combat.state.threat.toFixed(2), hits: D.combat.state.hits };
    const dists = D.shadows.list.map((s) => +Math.hypot(s.x - D.player.pos.x, s.z - D.player.pos.z).toFixed(2));
    return { before, after, dists: dists.slice(0, 12), hpMin: D.stats.hp };
  });
  report('тени без факела (20 с)', shadowSim);

  /* ---------- подземелье С факелом ---------- */
  await page.evaluate(() => {
    window.__dbg.loadout.setTorchEquipped(true);
    window.__dbg.combat.lightNow();
  });
  await grabScene(page, SHOTS + '/TEST_22_dungeon_torch.jpg');
  report('подземелье с факелом', {
    яркость: await imgStats(page, SHOTS + '/TEST_22_dungeon_torch.jpg'),
    lit: await page.evaluate(() => window.__dbg.combat.state.lit),
    lantern: await page.evaluate(() => {
      const L = window.__dbg.dungeonLoc.lights.lantern;
      return L ? { intensity: +L.intensity.toFixed(2), distance: L.distance } : null;
    }),
  });

  /* ---------- удар факелом по тени ---------- */
  const strike = await page.evaluate(() => {
    const D = window.__dbg;
    D.shadows.spawn();
    // поставить тень прямо перед игроком
    const s = D.shadows.list[0];
    const info = { found: !!s };
    if (s) {
      const dir = new D.THREE.Vector3();
      D.camera.getWorldDirection(dir);
      s.x = D.player.pos.x + dir.x * 1.5;
      s.z = D.player.pos.z + dir.z * 1.5;
      info.veilBefore = s.veil;
      info.hit = D.combat.strike();
      info.veilAfter = s.veil;
    }
    return info;
  });
  report('удар факелом', strike);

  report('итого ошибок', errs.slice());
});
