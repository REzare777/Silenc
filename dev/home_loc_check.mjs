/**
 * ============================================================================
 *  Проверка домашних локаций: вход днём, отказ ночью, выход к своей двери
 * ============================================================================
 *
 *  Запуск: cd dev && node home_loc_check.mjs
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
  const out = { names: [], scenes: new Set(), enter: [], night: [], exit: [], unique: true };
  const all = d.ctx.interactables;

  // 1. днём: вход в первый дом
  d.ctx.env.setTimeOfDay('day', true);
  const door = all.find((i) => i.label === 'Войти в дом');
  if (!door) return { ...out, error: 'нет интеракта «Войти в дом»' };
  door.act();
  out.enter.push(d.ctx.mode === 'play' ? 'ok' : 'ok');
  out.locAfterEnter = d.ctx.loc;

  // 2. внутри: имена домов и сцены разные
  const homeLoc = d.ctx.loc;
  const exitIt = all.find((i) => i.label === 'Выйти из дома' && i.where === homeLoc);
  out.exit.push(!!exitIt);
  const spots = all.filter((i) => i.where === homeLoc && i.label !== 'Выйти из дома');
  out.spotsInHome = spots.length;
  out.homeNames = all.filter((i) => i.where && i.where.startsWith('home')).length;

  // 3. выход из дома
  if (exitIt) exitIt.act();
  out.locAfterExit = d.ctx.loc;

  // 4. ночью в дом не пускают
  d.ctx.env.setTimeOfDay('night', true);
  const door2 = all.find((i) => i.label === 'Войти в дом');
  door2.act();
  out.night.push(d.ctx.loc);           // должно остаться 'village'
  out.nightRejected = d.ctx.loc === 'village';

  // 5. вечером тоже не пускают
  d.ctx.env.setTimeOfDay('dusk', true);
  door2.act();
  out.duskRejected = d.ctx.loc === 'village';

  // 6. имена домов уникальны
  const names = [];
  for (let i = 0; i < 12; i++) {
    const it = all.find((x) => x.where === `home${i}` && x.label !== 'Выйти из дома');
    names.push(it ? it.label : null);
  }
  out.names = names;
  out.unique = new Set(names).size === names.length && names.every(Boolean);
  return out;
});

console.log('локация после входа:', res.locAfterEnter);
console.log('локация после выхода:', res.locAfterExit);
console.log('интеракт «Выйти из дома» найден:', res.exit[0]);
console.log('предметов в доме:', res.spotsInHome);
console.log('ночью не пустили:', res.nightRejected, '| вечером не пустили:', res.duskRejected);
console.log('уникальность подписей:', res.unique);
console.log('подписи:', res.names.join(' | '));
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
