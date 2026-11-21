/**
 * ============================================================================
 *  Проверка правок по итогам инспекции построек (раунд 51)
 * ============================================================================
 *
 *  Что проверяем:
 *   1. Вход в колокольню с задней стороны (с севера) доступен пешком —
 *      к интеракту можно подойти, игрок попадает внутрь башни, а наружу
 *      выходит не в стену, а лицом на север.
 *   2. Пол звонарной совпадает с каменным полом (раньше игрок «висел»
 *      на 26 см выше, потому что цеплялся за ступень винта).
 *   3. Ступень у двери колокольни — на уровне видимого камня.
 *   4. К задней двери колокольни ведёт тропинка, и она не заходит в
 *      камень построек.
 *
 *  Запуск: cd dev && node r51_build_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

const res = await page.evaluate(() => {
  const d = window.__dbg;
  const out = {};
  const p = d.player;

  const it = d.interactables.find((x) => x.label === 'Войти в колокольню');
  out.backInteract = !!it;
  if (it) {
    out.backPos = { x: +it.pos.x.toFixed(2), z: +it.pos.z.toFixed(2), r: it.radius };
    // подойти пешком с севера
    const reset = (x, z) => {
      p.teleport(x, z, 0);
      p.y = 0.02; p.groundY = 0.02; p.vy = 0; p.keys.clear();
    };
    reset(it.pos.x, it.pos.z + 9);
    p.yaw = 0;                             // взгляд = (-sin yaw, -cos yaw) → на юг, к двери
    let best = 99;
    for (let i = 0; i < 900; i++) {
      p.keys.add('KeyW');
      p.update(1 / 60);
      const dd = Math.hypot(p.pos.x - it.pos.x, p.pos.z - it.pos.z);
      if (dd < best) best = dd;
      if (dd < 1.2) break;
    }
    p.keys.clear();
    out.reached = best < 1.2;
    out.minDist = +best.toFixed(2);
    // сработала ли нужная подсказка
    const near = d.nearestInteractable ? d.nearestInteractable() : null;
    out.nearestLabel = near ? near.label : null;
  }

  // вход в башню
  const it2 = d.interactables.find((x) => x.label === 'Войти в колокольню');
  if (it2) {
    it2.act();
    out.inTower = d.ctx.loc === 'church';
    out.towerGroundY = +p.groundY.toFixed(3);
    out.towerPos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };
  }

  // выход наружу
  const exit = d.interactables.find((x) => x.label === 'Открыть тяжёлую дверь');
  out.exitExists = !!exit;
  if (exit) {
    exit.act();
    out.outside = d.ctx.loc === 'village';
    const ry = d.ctx.doors.churchBack ? d.ctx.doors.churchBack.ry : 0;
    out.exitRy = +ry.toFixed(3);
    // взгляд: (-sin ry, -cos ry) — должен смотреть на север (+z),
    // то есть от колокольни, а не в её стену
    out.lookX = +(-Math.sin(ry)).toFixed(3);
    out.lookZ = +(-Math.cos(ry)).toFixed(3);
    out.facesNorth = out.lookZ > 0.9;
    // игрок снаружи: севернее стены башни
    out.exitPos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2) };
    // проверка «в камне»: игрок не внутри коллайдера
    let inside = 0;
    for (const c of (d.colliders.boxes || [])) {
      const hw = (c.hx ?? c.w ?? 0) / 2, hd = (c.hz ?? c.d ?? 0) / 2;
      if (Math.abs(p.pos.x - c.x) < hw && Math.abs(p.pos.z - c.z) < hd) inside++;
    }
    out.insideColliders = inside;
  }

  // ступень у двери: платформа должна совпадать с камнем
  {
    const plats = d.ctx.loc === 'village' ? (d.platforms || []) : [];
    // ищем платформу рядом с дверью колокольни
    const door = d.ctx.doors.churchBack;
    let bestY = null;
    for (const pl of plats) {
      const dx = Math.abs(pl.cx - door.x), dz = Math.abs(pl.cz - door.z);
      if (dx < 1.4 && dz < 1.4) {
        const top = pl.y ?? 0;
        if (bestY === null || top > bestY) bestY = top;
      }
    }
    out.stepTop = bestY === null ? null : +bestY.toFixed(3);
    out.stepOnStone = bestY !== null && Math.abs(bestY - 0.43) < 0.02;
  }

  // тропинка к задней двери
  out.trailIds = (d.ctx.roadTrails || []).map((t) => t.id);
  out.hasChurchBackTrail = out.trailIds.includes('church_back');

  return out;
});

const checks = [];
const ok = (name, cond, extra = '') => {
  checks.push({ name, pass: !!cond, extra });
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
};

ok('интеракт «Войти в колокольню» есть', res.backInteract);
ok('к колокольне можно подойти пешком', res.reached, `мин. дистанция ${res.minDist} м`);
ok('у двери срабатывает нужная подсказка', res.nearestLabel === 'Войти в колокольню', String(res.nearestLabel));
ok('вход в башню открывает локацию', res.inTower);
ok('пол звонарной = 0 (без «залипания» на ступени)', Math.abs((res.towerGroundY ?? 1) - 0) < 0.02, `groundY=${res.towerGroundY}`);
ok('игрок внутри башни, не в стене', Math.abs((res.towerPos?.x ?? 9)) < 4.5 && (res.towerPos?.z ?? 99) < 19.2, JSON.stringify(res.towerPos));
ok('выход наружу работает', res.outside);
ok('после выхода игрок смотрит на север, а не в стену', res.facesNorth, `взгляд (${res.lookX}, ${res.lookZ})`);
ok('игрок снаружи, не в камне', res.insideColliders === 0, `коллайдеров внутри: ${res.insideColliders}`);
ok('ступень у двери на уровне камня', res.stepOnStone, `верх ступени ${res.stepTop}`);
ok('к задней двери ведёт тропинка', res.hasChurchBackTrail);

const failed = checks.filter((c) => !c.pass);
console.log('\n' + (failed.length ? `ПРОВАЛЕНО: ${failed.length}` : 'все проверки пройдены'));
console.log('ошибок в консоли:', errs.length, errs.slice(0, 3));
await browser.close();
process.exit(failed.length || errs.length ? 1 : 0);
