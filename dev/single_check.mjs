// Проверка однофайловой версии: открыть file:// и дождаться готовности
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('file:///workspace/Шёпот-Долина.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
const r = await page.evaluate(() => {
  const d = window.__dbg;
  let meshey = 0;
  d.scene.traverse((o) => { if (o.isMesh) meshey++; });
  return {
    бейдж: document.body.innerText.includes('MiniMax') || document.body.innerHTML.includes('MiniMax Code'),
    мешей: meshey,
    интерактов: d.interactables.length,
    точкиРыбалки: d.castSpots.length,
    мельницаВысота: d.mill ? d.mill.group.position.y : null,
  };
});
console.log(JSON.stringify(r, null, 1));
console.log('ошибки:', errs.length, errs.slice(0, 3));
await browser.close();
