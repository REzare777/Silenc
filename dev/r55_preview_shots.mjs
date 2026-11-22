/**
 * Быстрые кадры кисти: рендерится только рука (без мира), поэтому
 * кадр выходит за доли секунды.
 */
import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const OUT = '/workspace/village/shots';
const BASE = 'http://localhost:5199/dev/r55_hand_preview.html';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 700, height: 560 } });
page.setDefaultTimeout(120000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

const shots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
    'sword|game|w=shortsword',
    'sword|close|w=shortsword',
    'sword|top|w=shortsword',
    'sword|side|w=shortsword',
    'sword|front|w=shortsword',
    'sword2|close|w=greatsword',
    'bow|close|w=bow',
    'staff|close|w=staff',
  ];

for (const spec of shots) {
  const [pose, cam, extra = ''] = spec.split('|');
  const url = `${BASE}?pose=${pose}&cam=${cam}&${extra}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__frames || 0) > 2, null, { timeout: 120000 });
  const name = `R55_p_${pose}_${cam}${extra.includes('w=') ? '_' + extra.slice(2) : ''}`;
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92 });
  console.log('снимок:', name);
}
await browser.close();
console.log('готово');
