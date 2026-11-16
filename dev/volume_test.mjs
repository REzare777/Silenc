import { chromium } from 'playwright';
const URL = process.env.LIVE_URL || 'http://127.0.0.1:4205/';
const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => {
  document.getElementById('begin').click();
  setTimeout(() => { const s = document.getElementById('start'); if (s) s.remove(); }, 150);
});
await page.waitForTimeout(2500);

const out = await page.evaluate(async () => {
  const d = window.__dbg;
  const log = [];
  const ok = [];
  const vol = document.getElementById('vol');
  const val = document.getElementById('volVal');
  const tSound = document.getElementById('tSound');
  log.push(`ползунок есть: ${!!vol}, подпись: ${!!val}`);
  log.push(`старт: значение=${vol.value} подпись="${val.textContent}" тумблер=${tSound.classList.contains('on') ? 'вкл' : 'выкл'} звук=${d.ambience ? 'есть' : 'нет'}`);

  // 1) движение ползунка меняет громкость и подпись
  vol.value = '35';
  vol.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const g1 = d.ambience.volume;
  log.push(`после 35 %: подпись="${val.textContent}" громкость=${g1.toFixed(2)} тумблер=${tSound.classList.contains('on') ? 'вкл' : 'выкл'}`);
  ok.push(['ползунок меняет громкость', Math.abs(g1 - 0.35) < 0.001]);
  ok.push(['подпись обновилась', val.textContent === '35%']);
  ok.push(['тумблер включён', tSound.classList.contains('on')]);

  // 2) громкость применяется к мастер-каналу
  const gain = d.ambience.ctx ? d.ambience.master.gain.value : null;
  log.push(`gain мастер-канала: ${gain === null ? 'нет ctx' : gain.toFixed(3)} (ожидаем ~${(0.35 * 0.9).toFixed(3)})`);
  ok.push(['gain вырос', gain === null || gain > 0.1]);

  // 3) в ноль — тумблер гаснет, звук приглушён
  vol.value = '0';
  vol.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  log.push(`0 %: подпись="${val.textContent}" тумблер=${tSound.classList.contains('on') ? 'вкл' : 'выкл'} muted=${d.ambience.muted}`);
  ok.push(['тумблер погас на 0 %', !tSound.classList.contains('on')]);
  ok.push(['звук заглушён', d.ambience.muted === true]);

  // 4) тумблер при 0 % поднимает ползунок
  tSound.click();
  await new Promise((r) => setTimeout(r, 400));
  log.push(`тумблер при 0 %: значение=${vol.value} подпись="${val.textContent}" тумблер=${tSound.classList.contains('on') ? 'вкл' : 'выкл'} muted=${d.ambience.muted}`);
  ok.push(['ползунок поднялся', +vol.value > 0]);
  ok.push(['звук снова включён', d.ambience.muted === false]);

  // 5) тумблер вручную выключает звук, уровень сохраняется
  vol.value = '60';
  vol.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  tSound.click();
  await new Promise((r) => setTimeout(r, 400));
  log.push(`ручной выключатель: громкость=${d.ambience.volume.toFixed(2)} muted=${d.ambience.muted} тумблер=${tSound.classList.contains('on') ? 'вкл' : 'выкл'}`);
  ok.push(['уровень сохранён', Math.abs(d.ambience.volume - 0.6) < 0.001]);
  ok.push(['звук выключен', d.ambience.muted === true]);

  // 6) настройка сохраняется
  const saved = localStorage.getItem('wv.volume');
  log.push(`localStorage wv.volume = ${saved}`);
  ok.push(['сохранено в localStorage', saved !== null]);

  // 7) клавиша M
  tSound.click();  // вернуть звук
  await new Promise((r) => setTimeout(r, 300));
  const before = d.ambience.muted;
  d.ui.toggleSound();
  await new Promise((r) => setTimeout(r, 300));
  log.push(`клавиша M (toggleSound): muted ${before} -> ${d.ambience.muted}`);
  ok.push(['toggleSound переключает', before !== d.ambience.muted]);

  return { log, ok };
});
for (const l of out.log) console.log(l);
let bad = 0;
for (const [name, good] of out.ok) {
  console.log(`${good ? '✓' : '✗'} ${name}`);
  if (!good) bad++;
}
console.log('ошибок:', bad, 'из', out.ok.length);
console.log('ошибки в консоли:', errs.length, errs.slice(0, 4));
await browser.close();
process.exit(bad ? 1 : 0);
