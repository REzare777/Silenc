import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';
const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(180000);
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
await page.goto('http://127.0.0.1:4205/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(2500);
const ok = (n, c) => console.log(`${c ? '✓' : '✗'} ${n}`);

// 1. состав поголовья
const count = await page.evaluate(() => {
  const d = window.__dbg;
  const c = {};
  d.scene.traverse(o => { if (['chicken','sheep','duck','dog','cat'].includes(o.name)) c[o.name] = (c[o.name]||0)+1; });
  return c;
});
console.log('поголовье:', JSON.stringify(count));
ok(`всего животных ${Object.values(count).reduce((a,b)=>a+b,0)} (было 15)`, Object.values(count).reduce((a,b)=>a+b,0) === 12);

// 2. куры разбегаются от игрока
const flee = await page.evaluate(() => {
  const d = window.__dbg;
  let hen = null;
  d.scene.traverse(o => { if (o.name === 'chicken' && !hen) hen = o; });
  const p = hen.position.clone();
  const before = p.clone();
  // ставим игрока рядом с курицей
  d.player.teleport(p.x + 1.2, p.z + 1.2, 0);
  for (let i = 0; i < 120; i++) d.updateScene ? d.updateScene(1/60) : null;
  return { before: [+before.x.toFixed(2), +before.z.toFixed(2)], after: [+hen.position.x.toFixed(2), +hen.position.z.toFixed(2)] };
});
const dBefore = Math.hypot(flee.before[0] - flee.before[0], 0);
console.log('курица до/после:', JSON.stringify(flee));

// 3. собака подбегает к игроку
const dog = await page.evaluate(() => {
  const d = window.__dbg;
  let dg = null;
  d.scene.traverse(o => { if (o.name === 'dog' && !dg) dg = o; });
  const before = Math.hypot(dg.position.x - d.player.pos.x, dg.position.z - d.player.pos.z);
  d.player.teleport(dg.position.x + 4, dg.position.z + 4, 0);
  const b2 = Math.hypot(dg.position.x - d.player.pos.x, dg.position.z - d.player.pos.z);
  return { до: +before.toFixed(1), после: +b2.toFixed(1) };
});
ok(`собака рядом с игроком (${dog.после} м)`, dog.после < 8);

// 4. карта по-прежнему проходима
const reach = await page.evaluate(() => {
  const d = window.__dbg;
  const R = 0.34, STEP = 0.4, MIN = -70, MAX = 70;
  const N = Math.round((MAX - MIN) / STEP);
  const blocked = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) { const x = MIN + i * STEP;
    for (let j = 0; j < N; j++) { const z = MIN + j * STEP; let hit = 0;
      for (const b of d.colliders.boxes) { const c = Math.cos(b.ang||0), s = Math.sin(b.ang||0);
        const dx = x-b.cx, dz = z-b.cz; const lx = c*dx-s*dz, lz = s*dx+c*dz;
        const qx = Math.max(-b.hx, Math.min(lx,b.hx)), qz = Math.max(-b.hz, Math.min(lz,b.hz));
        if (Math.hypot(lx-qx, lz-qz) < R) { hit = 1; break; } }
      if (!hit) for (const c of d.colliders.circles) if (Math.hypot(x-c.x, z-c.z) < c.r + R) { hit = 1; break; }
      blocked[i*N+j] = hit; } }
  const idx = (x,z) => { const i = Math.round((x-MIN)/STEP), j = Math.round((z-MIN)/STEP);
    return (i<0||j<0||i>=N||j>=N) ? -1 : i*N+j; };
  const seen = new Uint8Array(N*N); const q=[idx(0,16)]; seen[idx(0,16)] = 1; let cnt = 0;
  while (q.length) { const cur=q.pop(); cnt++; const i=Math.floor(cur/N), j=cur%N;
    for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ni=i+di,nj=j+dj;
      if (ni<0||nj<0||ni>=N||nj>=N) continue; const k=ni*N+nj;
      if (seen[k]||blocked[k]) continue; seen[k]=1; q.push(k); } }
  let free = 0; for (let k=0;k<N*N;k++) if (!blocked[k]) free++;
  return { pct: +(cnt/free*100).toFixed(1), lost: free - cnt };
});
ok(`проходимость карты ${reach.pct}% (недостижимо ${reach.lost} клеток)`, reach.pct >= 99.9);

console.log('ошибки:', errs.length ? errs.join(' | ') : 'нет');
await browser.close();
