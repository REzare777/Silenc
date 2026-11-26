/**
 * ============================================================================
 *  Раунд 66 — проверка дел (квестов) Хорта и Торна
 * ============================================================================
 *
 *  Что проверяем:
 *   1) дела определены, у обоих NPC есть знак «!» над головой;
 *   2) поговорил с NPC — тема о деле появилась, дело взято;
 *   3) убийства засчитываются в прогресс (гоблины);
 *   4) предметные цели считаются по сумке, при сдаче предметы забираются;
 *   5) сдача выдаёт награду (монеты + предмет), дело помечается сданным;
 *   6) цепочка дел: следующее дело открывается только после предыдущего;
 *   7) «дойти до зала Врат» засчитывается по факту прихода игрока;
 *   8) журнал дел (J) показывает дела и прогресс;
 *   9) состояние дел сохраняется в сейв и восстанавливается;
 *  10) знак «?» появляется, когда дело готово к сдаче.
 *
 *  Запуск: cd /workspace/village && node dev/r66_check.mjs
 */

import { chromium } from 'playwright';
import { LAUNCH } from './browser.mjs';

const browser = await chromium.launch(LAUNCH);
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.setDefaultTimeout(300000);
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto('http://127.0.0.1:4205/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__villageReady === true, null, { timeout: 300000 });
await page.evaluate(() => document.getElementById('begin').click());
await page.waitForTimeout(1200);

let ok = 0, fail = 0;
const results = [];

/**
 * Проверка.
 *
 * @param {string} name название
 * @param {boolean} cond условие
 * @param {string} [info] подробности
 */
function check(name, cond, info = '') {
  if (cond) { ok++; results.push(`  ok   ${name}`); }
  else { fail++; results.push(`  FAIL ${name}${info ? ' — ' + info : ''}`); }
}

/* ---------------- 1. дела определены, знаки над NPC ---------------- */
const defs = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  return {
    count: q.QUESTS.length,
    givers: q.QUESTS.map((x) => x.giver),
    ids: q.QUESTS.map((x) => x.id),
    markerBarkeep: q.markerKind('barkeep'),
    markerBlacksmith: q.markerKind('blacksmith'),
    hasSystem: !!q,
  };
});
console.log('  дела:', JSON.stringify(defs));
check('система дел создана', defs.hasSystem);
check('дела определены', defs.count >= 4, `${defs.count}`);
check('дела есть и у Хорта, и у Торна',
  defs.givers.includes('barkeep') && defs.givers.includes('blacksmith'),
  defs.givers.join(', '));
check('над обоими NPC висит знак «!»', defs.markerBarkeep === 'new' && defs.markerBlacksmith === 'new',
  `barkeep=${defs.markerBarkeep}, blacksmith=${defs.markerBlacksmith}`);

/* ---------------- 2. разговор: тема о деле и взятие дела ---------------- */
const talk = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const before = q.states.get('hort_goblins').state;
  const topics = q.topicsFor('barkeep');
  const label = topics.length ? topics[0].label : '';
  // берём дело так же, как это делает диалог
  topics[0].act();
  return {
    before,
    topicCount: topics.length,
    label,
    after: q.states.get('hort_goblins').state,
    journal: q.journal().length,
    // знак остаётся «!»: у Хорта есть ещё одно дело — «Грибы для котла»
    marker: q.markerKind('barkeep'),
  };
});
console.log('  разговор:', JSON.stringify(talk));
check('в диалоге Хорта есть тема о деле', talk.topicCount >= 1, `${talk.topicCount}`);
check('тема называет своё дело', talk.label.includes('Гоблинья возня'), talk.label);
check('дело берётся из диалога', talk.before === 'new' && talk.after === 'active',
  `${talk.before} → ${talk.after}`);
check('знак «!» остаётся: у Хорта есть ещё одно дело', talk.marker === 'new', talk.marker);

/* ---------------- 3. убийства засчитываются ---------------- */
const kills = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // шесть гоблинов: пять с мечом и один луточник
  for (let i = 0; i < 6; i++) {
    q.onKill({ id: i === 5 ? 'goblin_bow' : 'goblin_sword', name: 'Гоблин' });
  }
  // чужой зверь не засчитывается
  q.onKill({ id: 'spider', name: 'Паук' });
  const st = q.states.get('hort_goblins');
  const entry = q.journal().find((x) => x.id === 'hort_goblins');
  return {
    kills: st.kills.goblin,
    objective: entry ? entry.objectives[0] : null,
  };
});
console.log('  убийства:', JSON.stringify(kills));
check('убийства гоблинов засчитаны', kills.kills === 6, `${kills.kills}`);
check('в журнале виден прогресс «6 из 6»',
  !!kills.objective && kills.objective.text === '6 из 6',
  kills.objective ? kills.objective.text : 'нет цели');
check('чужой зверь не засчитан', kills.kills === 6, `${kills.kills}`);

/* ---------------- 4-5. сдача: предметы забираются, награда выдаётся ---------------- */
const turnIn = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const inv = d.inventory;
  const coinsBefore = d.stats.coins;
  // кладём в сумку грибы (для другого дела) и сдаём дело про гоблинов
  const shroom = d.items.getItem('shroom_cap');
  const mk = (spec, n) => {
    const st = { id: spec.id, spec, count: n, best: null };
    return st;
  };
  inv.add(mk(shroom, 3));
  const okTurn = q.turnIn('hort_goblins');
  const st = q.states.get('hort_goblins');
  return {
    okTurn,
    state: st.state,
    coinsBefore,
    coinsAfter: d.stats.coins,
    hasSpell: inv.countOf('spell_light'),
    marker: q.markerKind('barkeep'),
    shrooms: inv.countOf('shroom_cap'),
    journal: q.journal().find((x) => x.id === 'hort_goblins'),
  };
});
console.log('  сдача:', JSON.stringify(turnIn));
check('дело сдаётся', turnIn.okTurn === true);
check('после сдачи дело помечено сданным', turnIn.state === 'done', turnIn.state);
check('награда монетой выдана', turnIn.coinsAfter === turnIn.coinsBefore + 40,
  `${turnIn.coinsBefore} → ${turnIn.coinsAfter}`);
check('предметная награда выдана (Живой огонь)', turnIn.hasSpell === 1, `${turnIn.hasSpell}`);
check('чужие грибы в сумке не тронуты', turnIn.shrooms === 3, `${turnIn.shrooms}`);

/* ---------------- 6. цепочка дел ---------------- */
const chain = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const topics = q.topicsFor('barkeep').map((t) => t.label);
  const entry = q.journal().find((x) => x.id === 'hort_deep');
  return {
    topics,
    deepStatus: entry ? entry.status : null,
    deepText: entry ? entry.statusText : null,
  };
});
console.log('  цепочка:', JSON.stringify(chain));
check('следующее дело открылось после предыдущего',
  chain.topics.some((t) => t.includes('Слухи из глубины')),
  chain.topics.join(' | '));
check('в журнале дело видно как доступное', chain.deepStatus === 'new', chain.deepStatus);

/* ---------------- 7. «дойти до зала Врат» ---------------- */
const reach = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // берём дело «слухи из глубины»
  const t = q.topicsFor('barkeep').find((x) => x.label.includes('Слухи из глубины'));
  if (t && t.act) t.act();
  const st = q.states.get('hort_deep');
  const before = st.reached.gate ? 1 : 0;
  // ставим игрока в зал Врат (нижний ярус)
  d.setLocation('dungeon');
  const p = d.player;
  p.teleport(0, 30);
  p.y = -4.6;
  p.groundY = -4.6;
  q.update(0.016);
  const after = st.reached.gate ? 1 : 0;
  return { before, after, state: st.state };
});
console.log('  достижение:', JSON.stringify(reach));
check('цель «дойти до зала Врат» засчитывается по приходу',
  reach.after === 1, `${reach.before} → ${reach.after}`);

/* ---------------- 8. журнал дел (клавиша J) ---------------- */
const journal = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const list = q.journal();
  return {
    total: list.length,
    done: list.filter((x) => x.status === 'done').length,
    active: list.filter((x) => x.status === 'active').length,
    locked: list.filter((x) => x.status === 'locked').length,
    hasReward: list.every((x) => !!x.reward),
    hasObjectives: list.every((x) => x.objectives.length > 0),
    titles: list.map((x) => x.title),
  };
});
console.log('  журнал:', JSON.stringify(journal));
check('в журнале видны все дела', journal.total >= 5, `${journal.total}`);
check('сданное дело помечено «Сдано»', journal.done >= 1, `${journal.done}`);
check('у каждого дела есть цели', journal.hasObjectives);
check('у каждого дела указана награда', journal.hasReward);
check('заблокированное дело видно как «Позже»', journal.locked >= 1, `${journal.locked}`);

/* ---------------- 9. сохранение и восстановление ---------------- */
const save = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const snap = q.snapshot();
  const json = JSON.stringify(snap);
  // сбрасываем и восстанавливаем
  q.reset();
  const afterReset = q.states.get('hort_goblins').state;
  q.restore(JSON.parse(json));
  return {
    json: json.slice(0, 220),
    afterReset,
    restored: q.states.get('hort_goblins').state,
    restoredKills: q.states.get('hort_goblins').kills.goblin,
  };
});
console.log('  сохранение:', JSON.stringify(save));
check('состояние дел пишется в снимок', save.json.includes('hort_goblins'), save.json);
check('после сброса дело снова «новое»', save.afterReset === 'new', save.afterReset);
check('после загрузки дело снова сдано', save.restored === 'done', save.restored);

/* ---------------- 10. знак «?» у готового дела ---------------- */
const ready = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // берём дело Торна и выполняем предметную цель
  const t = q.topicsFor('blacksmith').find((x) => x.label.includes('Есть работа'));
  if (t && t.act) t.act();
  const inv = d.inventory;
  const core = d.items.getItem('golem_core');
  inv.add({ id: core.id, spec: core, count: 1, best: null });
  q.refresh();
  return {
    marker: q.markerKind('blacksmith'),
    topic: q.topicsFor('blacksmith').map((x) => x.label),
    entry: q.journal().find((x) => x.id === 'torn_core'),
  };
});
console.log('  готовность:', JSON.stringify(ready));
check('над Торном загорелся знак «?»', ready.marker === 'ready', ready.marker);
check('в диалоге есть тема «Сдать дело»',
  ready.topic.some((t) => t.includes('Сдать дело')),
  ready.topic.join(' | '));
check('в журнале дело помечено «Готово к сдаче»',
  !!ready.entry && ready.entry.statusText === 'Готово к сдаче',
  ready.entry ? ready.entry.statusText : 'нет');

/* ---------------- 11. сдача дела с предметной целью ---------------- */
const turnInTorn = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  const inv = d.inventory;
  const coinsBefore = d.stats.coins;
  const coreBefore = inv.countOf('golem_core');
  const okTurn = q.turnIn('torn_core');
  const st = q.states.get('torn_core');
  return {
    okTurn,
    state: st.state,
    coinsBefore,
    coinsAfter: d.stats.coins,
    coreBefore,
    coreAfter: inv.countOf('golem_core'),
    hasAxe: inv.countOf('axe'),
    marker: q.markerKind('blacksmith'),
  };
});
console.log('  сдача Торну:', JSON.stringify(turnInTorn));
check('дело кузнеца сдаётся', turnInTorn.okTurn === true);
check('ядро голема забрали из сумки', turnInTorn.coreAfter === 0,
  `${turnInTorn.coreBefore} → ${turnInTorn.coreAfter}`);
check('награда за дело кузнеца выдана (секира)', turnInTorn.hasAxe === 1, `${turnInTorn.hasAxe}`);
check('монеты за дело кузнеца начислены', turnInTorn.coinsAfter === turnInTorn.coinsBefore + 45,
  `${turnInTorn.coinsBefore} → ${turnInTorn.coinsAfter}`);
check('после сдачи ядра у Торна появляется новое дело', turnInTorn.marker === 'new', turnInTorn.marker);

/* ---------------- 12. знак гаснет, когда дела закончились ---------------- */
const done = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // закрываем все дела Торна — знак должен погаснуть
  const st = q.states.get('torn_boss');
  st.state = 'done';
  q.refresh();
  return { marker: q.markerKind('blacksmith') };
});
console.log('  завершение дел:', JSON.stringify(done));
check('когда дела закончились, знак гаснет', done.marker === 'off', done.marker);

/* ---------------- 13. темы разговора обновляются на месте ---------------- */
const refreshTopics = await page.evaluate(() => {
  const d = window.__dbg;
  const q = d.quests;
  // начинаем с чистого состояния: все дела снова «новые»
  q.reset();
  d.ctx.systems.dialog.open('barkeep');
  const labels = () => Array.from(document.querySelectorAll('#dlgTopics button'))
    .map((b) => b.textContent);
  const before = labels();
  // нажимаем тему «Есть работа» — как это делает игрок
  const btn = Array.from(document.querySelectorAll('#dlgTopics button'))
    .find((b) => b.textContent.startsWith('Есть работа'));
  if (btn) btn.click();
  const after = labels();
  const state = q.states.get('hort_goblins').state;
  d.ctx.systems.dialog.close();
  return { before, after, state };
});
console.log('  темы разговора:', JSON.stringify(refreshTopics));
check('в окне разговора была тема «Есть работа»',
  refreshTopics.before.some((l) => l.startsWith('Есть работа')), refreshTopics.before.join(' | '));
check('после взятия дела темы перерисованы на месте',
  refreshTopics.after.some((l) => l.startsWith('По делу')), refreshTopics.after.join(' | '));
check('взятая тема «Есть работа» исчезла',
  !refreshTopics.after.some((l) => l.includes('Гоблинья возня') && l.startsWith('Есть работа')),
  refreshTopics.after.join(' | '));
check('следующее дело предлагается сразу',
  refreshTopics.after.some((l) => l.includes('Грибы для котла')), refreshTopics.after.join(' | '));
check('дело действительно взято', refreshTopics.state === 'active', refreshTopics.state);

/* ---------------- 14. ошибки в консоли ---------------- */
check('в консоли нет ошибок', errs.length === 0, errs.slice(0, 3).join(' | '));

console.log('\nРаунд 66 — дела Хорта и Торна');
for (const r of results) console.log(r);
console.log(`\nИтог: ${ok} ok, ${fail} fail`);
await browser.close();
process.exit(fail ? 1 : 0);
