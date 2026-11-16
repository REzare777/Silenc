import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.waitForSelector('#begin');
await page.waitForTimeout(600);
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);

const res = await page.evaluate(() => {
  const d = window.__dbg, p = d.player, dog = d.critters.dog;
  const out = {};
  // игрок уходит на другой конец деревни
  p.teleport(13, -8, 0); p.y = 0; p.groundY = 0;
  const start = Math.hypot(dog.g.position.x - 13, dog.g.position.z + 8);
  const samples = [];
  for (let i = 0; i < 60 * 25; i++) {
    d.updateAnimals(1 / 60, i / 60);
    if (i % 300 === 0) samples.push(+Math.hypot(dog.g.position.x - 13, dog.g.position.z + 8).toFixed(1));
  }
  out.старт_дист = +start.toFixed(1);
  out.выборка = samples;
  out.конец_дист = +Math.hypot(dog.g.position.x - 13, dog.g.position.z + 8).toFixed(2);
  out.пёс = [+dog.g.position.x.toFixed(1), +dog.g.position.z.toFixed(1)];
  out.игрок = [13, -8];
  // маршрут строит?
  const path = d.nav.findPath(dog.g.position.x, dog.g.position.z, 13, -8);
  out.маршрут_точек = path ? path.length : null;
  return out;
});
console.log(JSON.stringify(res, null, 1));
console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
