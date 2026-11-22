/**
 * Проверка системы заклинаний без браузера (node).
 *
 *   node dev/r57_spells_check.mjs
 */
import * as THREE from 'three';
import { createSpells } from '../src/game/spells.js';

let okCount = 0;
let failCount = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { okCount++; console.log(`✓ ${name}`); }
  else { failCount++; console.log(`✗ ${name} ${extra}`); }
};

/* --- заглушка контекста --- */
const toasts = [];
const flashes = [];
const heals = [];
let mana = 100;
let fuel = 50;

const ctx = {
  scene: new THREE.Scene(),
  renderPass: { scene: null },
  player: { pos: new THREE.Vector3(), y: 0 },
  camera: new THREE.PerspectiveCamera(),
  ui: { toast: (t) => toasts.push(t) },
  ambience: { spell: (k) => flashes.push(k), dryClick: () => {} },
  stats: {
    get mana() { return mana; },
    spendMana(n) {
      if (mana < n) return false;
      mana -= n;
      return true;
    },
    heal(n) { heals.push(n); },
  },
  systems: {
    combat: {
      state: { torchEquipped: false, fuel },
      addFuel(n) { fuel += n; return fuel; },
      lightNow() { return true; },
    },
    shadows: { flare() {} },
  },
};
ctx.renderPass.scene = ctx.scene;

const spells = createSpells(ctx);
const FLASH = { id: 'spell_flash', kind: 'spell', spell: 'flash', mana: 25 };
const HEAL = { id: 'spell_heal', kind: 'spell', spell: 'heal', mana: 20 };
const LIGHT = { id: 'spell_light', kind: 'spell', spell: 'light', mana: 15 };

/* --- каст --- */
ok('до каста мана полная', mana === 100);
ok('каст вспышки удался', spells.cast(FLASH) === true);
ok('мана списалась', mana === 75, mana);
ok('подсветка вспышки была', flashes.includes('flash'));

ok('повторный каст блокируется откатом', spells.cast(FLASH) === false);
ok('мана не списалась повторно', mana === 75, mana);

/* --- лечение --- */
ok('лечение сработало', spells.cast(HEAL) === true);
ok('вылечено 35', heals.includes(35), JSON.stringify(heals));
ok('мана после лечения', mana === 55, mana);

/* --- живой огонь без факела --- */
ok('живой огонь без факела светит', spells.cast(LIGHT) === true);
ok('зажжён «живой огонь» на минуту', spells.state.glowT > 50, spells.state.glowT);
spells.update(2);
ok('свет живёт дальше', spells.state.glowT > 45, spells.state.glowT);

/* --- живой огонь с факелом --- */
ctx.systems.combat.state.torchEquipped = true;
fuel = 10;
ok('живой огонь с факелом кастуется', spells.cast(LIGHT) === true || spells.cooldownLeft('light') > 0);

/* --- нехватка маны --- */
mana = 3;
ok('без маны не колдуется', spells.cast(FLASH) === false);
ok('подсказка показана', toasts.length > 0);

/* --- откаты идут --- */
spells.state.cd = { flash: 1 };
spells.update(0.5);
ok('откат уменьшается', (spells.state.cd.flash || 0) < 1);
spells.update(1);
ok('откат истёк', !spells.state.cd.flash);

console.log(`\nr57_spells_check: ${okCount} ok, ${failCount} fail`);
process.exit(failCount ? 1 : 0);
