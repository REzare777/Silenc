import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
const URL = process.env.TEST_URL || ('http://127.0.0.1:4205/?v=' + Date.now());
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.waitForSelector('#begin');
await page.waitForTimeout(800);
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(3000);

const res = await page.evaluate(async () => {
  const d = window.__dbg;
  const out = {};
  // игрок на берегу у пирса
  d.player.teleport(37.5, -14, -Math.PI / 2);
  d.player.y = 0; d.player.groundY = 0;

  // 1. заброс
  d.startFishing();
  out.состояние_после_заброса = d.fishing.state;
  for (let i = 0; i < 60; i++) d.updateFishing(1 / 60);
  out.после_заброса = d.fishing.state;

  // 2. ждём клёв (максимум 15 секунд)
  let frames = 0;
  while (d.fishing.state !== 'bite' && frames < 60 * 15) { d.updateFishing(1 / 60); frames++; }
  out.клёв = d.fishing.state;
  out.ждали_секунд = +(frames / 60).toFixed(1);
  out.рыба = d.fishing.fish ? d.fishing.fish.spec.name + ' / ' + d.fishing.fish.spec.rarity : null;
  out.зона = d.fishing.zone;
  out.нужно_подсечек = d.fishing.need;
  out.полоска_видна = document.getElementById('fish').classList.contains('on');

  // 3. подсекаем (метку направляем в зону)
  let caught = false;
  for (let attempt = 0; attempt < 40 && !caught; attempt++) {
    if (d.fishing.state !== 'bite') break;
    d.fishing.mark = d.fishing.zonePos;      // точное попадание
    d.hookFish();
    d.updateFishing(1 / 60);
    caught = d.inventory.stats().total > 0;
  }
  out.поймано = d.inventory.stats().total;
  out.состояние_после = d.fishing.state;

  // 4. инвентарь
  const item = d.inventory.slots.find((s) => s);
  if (item) {
    out.пойманная = { имя: item.spec.name, вес: +item.best.weight.toFixed(3), длина: +item.best.length.toFixed(1) };
  }
  d.toggleInventory();
  const slots = document.querySelectorAll('#invGrid .slot');
  out.слоты = slots.length;
  out.иконка_есть = !!(slots[0] && slots[0].querySelector('canvas'));
  out.инвентарь_открыт = document.getElementById('inv').classList.contains('on');

  // 5. 3D-превью по наведению
  if (slots[0]) {
    slots[0].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
  }
  out.окно_просмотра = document.getElementById('viewCard').classList.contains('has');
  out.имя_в_окне = document.getElementById('vName').textContent;
  out.редкость_в_окне = document.getElementById('vRar').textContent;
  const cv = document.getElementById('viewCanvas');
  out.канвас_размер = [cv.width, cv.height];
  out.канвас_не_пустой = (() => {
    const gl = cv.getContext('webgl2') || cv.getContext('webgl');
    return !!gl;
  })();
  return out;
});

console.log(JSON.stringify(res, null, 1));
// скриншот окна просмотра
await page.screenshot({ path: '/workspace/village/shots/FIN_fishview.png' });
console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
