/**
 * Тест 12:
 *   1) загрузка слота, сохранённого внутри интерьера (позиция vs. сцена);
 *   2) коллайдеры в деревне (снаружи → в стену);
 *   3) F гасит факел;
 *   4) пустая ячейка пояса снимает оружие с руки.
 */

import { withGame, grabScene, report, SHOTS } from './tester_lib.mjs';

const errors = await withGame({ start: true }, async (page, errs) => {
  /* ---------- 1. слот, сохранённый внутри таверны ---------- */
  const A = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('tavern');
    const inTavern = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.saveToSlot(1);                       // ручной слот — автосейв его не перетрёт
    D.setLocation('village');
    const inVillage = { loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2), scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior' };
    D.loadSlot('slot1', 1);                // грузим слот, сделанный в таверне
    const after = {
      loc: D.loc,
      x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2),
      scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior',
      groundY: +D.player.groundY.toFixed(2),
      playerBoxes: D.player.boxes.length,
      villageBoxes: D.colliders.boxes.length,
    };
    return { inTavern, inVillage, after };
  });
  report('1) слот из интерьера загружен в деревне', A);
  report('1) вывод', {
    позиция_из_слота_применена: Math.abs(A.after.x - A.inTavern.x) < 0.5 && Math.abs(A.after.z - A.inTavern.z) < 0.5,
    сцена_после_загрузки: A.after.scene,
    игрок_в_координатах_интерьера: A.after,
  });
  await grabScene(page, SHOTS + '/TEST_80_load_interior_slot.jpg');

  /* ---------- 1б. то же с подземельем ---------- */
  const A2 = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('dungeon');
    const inDungeon = { x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2) };
    D.saveToSlot(2);
    D.setLocation('village');
    D.loadSlot('slot2', 2);
    const after = {
      loc: D.loc, x: +D.player.pos.x.toFixed(2), z: +D.player.pos.z.toFixed(2),
      scene: D.ctx.renderPass.scene === D.scene ? 'village' : 'interior',
      groundY: +D.player.groundY.toFixed(2), y: +D.player.y.toFixed(2), grounded: D.player.grounded,
    };
    return { inDungeon, after };
  });
  report('1б) слот из подземелья загружен в деревне', A2);

  /* ---------- 2. коллайдеры в деревне ---------- */
  const walls = await page.evaluate(() => {
    const D = window.__dbg;
    D.setLocation('village');
    const out = [];
    const list = D.colliders.boxes.filter((b) => b.hx > 0.4 && b.hz > 0.25 && b.hx < 8 && b.hz < 8).slice(0, 50);
    for (const b of list) {
      const c = Math.cos(b.ang || 0), s = Math.sin(b.ang || 0);
      const nx = c, nz = -s;
      const stand = b.hx + 1.5;
      D.teleport(b.cx + nx * stand, b.cz + nz * stand, 0);
      for (let i = 0; i < 5; i++) D.player.update(0.05);
      D.player.yaw = Math.atan2(nx, nz);
      D.player.keys.clear(); D.player.keys.add('KeyW');
      for (let i = 0; i < 90; i++) D.player.update(0.05);
      D.player.keys.clear();
      const dx = D.player.pos.x - b.cx, dz = D.player.pos.z - b.cz;
      const lx = c * dx - s * dz;
      const lz = s * dx + c * dz;
      out.push({
        wall: { cx: +b.cx.toFixed(1), cz: +b.cz.toFixed(1), hx: b.hx, hz: b.hz, ang: +(b.ang || 0).toFixed(2) },
        lx: +lx.toFixed(2), lz: +lz.toFixed(2),
        прошёл_насквозь: lx < -b.hx - 0.34,
        остался_на_стороне: lx > -b.hx - 0.34,
      });
    }
    return out;
  });
  const passed = walls.filter((w) => w.прошёл_насквозь);
  report('2) стены держат? (' + walls.length + ' шт.)', { прошёл_насквозь: passed.length, примеры: passed.slice(0, 6) });

  /* ---------- 3. F гасит факел ---------- */
  report('3) F — зажечь/погасить', await page.evaluate(() => {
    const D = window.__dbg;
    D.inventory.slots[27] = { id: 'torch', spec: D.items.getItem('torch'), count: 1, best: null };
    D.inventory.touch();
    D.loadout.setTorchEquipped(true);
    D.combat.lightNow();
    const lit = { lit: D.combat.state.lit, fuel: +D.combat.state.fuel.toFixed(1) };
    const msg = D.combat.toggleTorch();
    const off = { lit: D.combat.state.lit, msg };
    return { lit, off };
  }));

  /* ---------- 4. пустая ячейка пояса ---------- */
  report('4) пустая ячейка пояса', await page.evaluate(() => {
    const D = window.__dbg;
    D.inventory.slots[27] = { id: 'axe', spec: D.items.getItem('axe'), count: 1, best: null };
    D.inventory.slots[28] = null;
    D.inventory.touch();
    D.loadout.select(0);
    const withAxe = { weaponId: D.loadout.weaponId, sel: D.inventory.sel };
    D.loadout.select(1);   // пустая ячейка
    const afterEmpty = { weaponId: D.loadout.weaponId, sel: D.inventory.sel };
    return { withAxe, afterEmpty };
  }));

  report('итого ошибок', errs.slice());
});
