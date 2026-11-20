/**
 * Раунд 44: кадры рук и захватов.
 * Запуск: cd dev && node r44_shots.mjs [метка]
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
import fs from 'fs';

const TAG = process.argv[2] || 'R44';
const OUT = '/workspace/village/shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(240000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 240000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

// игрок в деревне, руки — с рыбой
await page.evaluate(() => {
  const d = window.__dbg;
  d.teleport(6, 20, 0.6);
  d.holdFish(5);
});
await page.waitForTimeout(800);

const grab = async (name) => {
  // софт-рендер медленный: доводим проявление до конца, иначе руки полупрозрачны
  await page.evaluate(() => { window.__dbg.viewmodel._fade = 1; });
  await page.evaluate(() => { window.__grab = { resolve: () => {} }; });
  await page.waitForFunction(() => window.__frame && window.__frame.length > 100, null, { timeout: 180000 });
  const frame = await page.evaluate(() => { const f = window.__frame; window.__frame = ''; return f; });
  fs.writeFileSync(`${OUT}/${TAG}_${name}.jpg`, Buffer.from(frame.split(',')[1], 'base64'));
  console.log('снимок:', name);
};

await grab('hands_two');

for (const [grip, pose] of [['right', 'present'], ['left', 'present'], ['two', 'carry'], ['right', 'reach'], ['point', 'present']]) {
  await page.evaluate(({ grip, pose }) => {
    window.__dbg.viewmodel.setPose(grip, pose);
  }, { grip, pose });
  await page.waitForTimeout(500);
  await grab(`grip_${grip}_${pose}`);
}

// крупный план рук
await page.evaluate(() => { window.__dbg.viewmodel.setPose('two', 'present'); });
await page.waitForTimeout(400);
await grab('hands_two_close');

if (errs.length) console.log('ОШИБКИ:', errs.slice(0, 5));
await browser.close();
