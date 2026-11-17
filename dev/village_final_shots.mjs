/**
 * Финальные кадры раунда 29: фасад таверны, опушка леса, скрытое подземелье,
 * ступеньки и замер производительности.
 * Запуск: cd dev && node village_final_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R29';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 690 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1000);
await page.evaluate(() => window.__dbg.ctx.env.setTimeOfDay('day', true));
await page.waitForTimeout(1500);

const shot = async (name, pos, look) => {
  await page.evaluate(({ pos, look }) => {
    const d = window.__dbg;
    d.player.enabled = false;
    d.camera.position.set(pos[0], pos[1], pos[2]);
    d.camera.lookAt(look[0], look[1], look[2]);
    d.camera.updateMatrixWorld();
  }, { pos, look });
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

const tav = await page.evaluate(() => {
  const t = window.__dbg.ctx.doors.tavern;
  return { x: t.x, z: t.z, ry: t.ry, fx: -Math.sin(t.ry), fz: -Math.cos(t.ry) };
});

// 1. фасад таверны целиком (камера высоко и издалека)
await shot('tavern_facade',
  [tav.x + tav.fx * 11 - tav.fz * 8, 3.6, tav.z + tav.fz * 11 + tav.fx * 8],
  [tav.x + tav.fx * 2, 2.6, tav.z + tav.fz * 2]);
// 1b. таверна с улицы — по касательной, чтобы не загораживал прилавок
await shot('tavern_street', [tav.x + tav.fx * 13 - tav.fz * 9, 2.1, tav.z + tav.fz * 13 + tav.fx * 9],
  [tav.x, 2.4, tav.z]);
// 2. таверна с угла — видно восточный фасад с высоким окном и трубы
await shot('tavern_corner', [-17 + 15, 3.4, -13 + 13], [-17, 3.0, -13]);
// 3. опушка леса: с поляны видно стену деревьев
await shot('forest_wall', [0, 1.7, 30], [0, 7.0, 56]);
// 4. подземелье не видно с опушки
await shot('dungeon_hidden', [-44, 2.4, -32], [-72, 1.5, -66]);
// 5. лес с высоты: кольцо вокруг деревни
await shot('forest_ring', [0, 46, 0.01], [0, 0, 0]);
// 6. ступеньки дома (крыльцо на каменном цоколе)
await shot('porch', [-5.3, 1.5, 2.9], [-11, 1.1, 8]);
// 7. дороги у площади — проверка на «фризит»
await shot('roads', [12, 3.0, 16], [0, 0.3, 0]);
// 8. тропа к пещере
await shot('trail', [-40, 1.8, -28], [-52, 1.2, -42]);

// замер производительности
const perf = await page.evaluate(() => {
  const d = window.__dbg;
  const info = d.renderer.info;
  let meshes = 0, instanced = 0;
  d.scene.traverse((o) => {
    if (o.isInstancedMesh) { instanced++; meshes++; }
    else if (o.isMesh) meshes++;
  });
  return {
    drawCalls: info.render.calls, triangles: info.render.triangles,
    meshes, instanced, textures: info.memory.textures, geometries: info.memory.geometries,
  };
});
console.log('производительность:', JSON.stringify(perf));
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
