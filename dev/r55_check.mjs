/**
 * Проверки кисти от первого лица (раунд 55).
 *
 * Тест быстрый: считает только геометрию и позы, без браузера.
 *
 *   node dev/r55_check.mjs
 */
import { buildHands } from '../src/world/hands.js';
import { weaponGrip, WEAPONS } from '../src/world/weapons.js';

let okCount = 0;
let failCount = 0;

/**
 * Проверка с сообщением.
 *
 * @param {string} name что проверяем
 * @param {boolean} cond условие
 * @param {string} [extra] подробности при ошибке
 */
function ok(name, cond, extra = '') {
  if (cond) {
    okCount++;
    console.log(`✓ ${name}`);
  } else {
    failCount++;
    console.log(`✗ ${name} ${extra}`);
  }
}

const hands = buildHands();

/* ---- каркас ---- */
ok('buildHands отдаёт группу и обе руки', !!hands.group && !!hands.right && !!hands.left);
ok('есть setPose/setArms/update', typeof hands.setPose === 'function'
  && typeof hands.setArms === 'function' && typeof hands.update === 'function');
ok('точка захвата есть у обеих рук', !!hands.right.userData.hold && !!hands.left.userData.hold);

/* ---- симметрия рук ---- */
const hr = hands.right.userData.hold.position;
const hl = hands.left.userData.hold.position;
ok('захват правой и левой руки зеркальны по X',
  Math.abs(hr.x + hl.x) < 1e-6 && Math.abs(hr.y - hl.y) < 1e-6 && Math.abs(hr.z - hl.z) < 1e-6,
  `right=${hr.toArray()} left=${hl.toArray()}`);

/* ---- сжатие ---- */
hands.setArms('sword');
for (let i = 0; i < 60; i++) hands.update(1 / 60);
const fistR = hands.right.userData.fistAmount();
ok('в позе с оружием правая рука сжата', fistR > 0.98, `a=${fistR}`);

const joint = hands.right.userData.fingers[0].userData.joint;
const bentFist = Math.abs(joint.rotation.x);
hands.right.userData.setFist(false);
for (let i = 0; i < 60; i++) hands.update(1 / 60);
const bentOpen = Math.abs(joint.rotation.x);
ok('палец разгибается, когда кулак разжат', bentOpen < bentFist - 0.5,
  `сжат=${bentFist.toFixed(2)} открыт=${bentOpen.toFixed(2)}`);
ok('состояние сжатия достигает нуля', hands.right.userData.fistAmount() < 0.02);

hands.right.userData.setFist(true);
for (let i = 0; i < 60; i++) hands.update(1 / 60);
ok('кулак сжимается обратно', hands.right.userData.fistAmount() > 0.98);

/* ---- позы ---- */
/** Прокрутить анимацию сжатия до конца. */
function settle(n = 60) {
  for (let i = 0; i < n; i++) hands.update(1 / 60);
}

hands.setArms('sword2');
settle();
ok('двуручный хват: обе руки сжаты',
  hands.right.userData.fistAmount() > 0.9 && hands.left.userData.fistAmount() > 0.9);
hands.setPose('two', 'present');
settle();
ok('поза предмета: ладонь раскрыта', hands.right.userData.fistAmount() < 0.1);
ok('поза предмета: обе руки на месте', hands.right.visible && hands.left.visible);
hands.setPose('point', 'present');
settle();
ok('жест указания: левая рука сжата, правая свободна',
  hands.left.userData.fistAmount() > 0.9 && hands.right.userData.fistAmount() < 0.1);

/* ---- хват оружия ---- */
for (const spec of WEAPONS) {
  const g = weaponGrip(spec);
  const okPose = typeof g.pose === 'string' && g.pose.length > 0;
  const okScale = g.scale > 0.05 && g.scale < 1;
  const okPos = Array.isArray(g.pos) && g.pos.length === 3 && g.pos.every((v) => Number.isFinite(v));
  ok(`хват «${spec.name}»: поза/масштаб/позиция корректны`, okPose && okScale && okPos,
    `pose=${g.pose} scale=${g.scale} pos=${g.pos}`);
}
const gSword = weaponGrip(WEAPONS.find((w) => w.id === 'shortsword'));
ok('короткий меч берётся в правую руку', gSword.hand === 'right' && gSword.pose === 'sword');
const gGreat = weaponGrip(WEAPONS.find((w) => w.id === 'greatsword'));
ok('двуручный меч — поза sword2', gGreat.pose === 'sword2');
const gBow = weaponGrip(WEAPONS.find((w) => w.id === 'bow'));
ok('лук держит левая (защитная) рука', gBow.hand === 'left' && gBow.pose === 'bow');

/* ---- клинок смотрит вперёд, а не вверх ---- */
// суммарный наклон клинка = поворот кисти + поворот хвата
const armRot = 0.10;      // поза «sword» в hands.js
const gripRot = weaponGrip(WEAPONS.find((w) => w.id === 'shortsword')).rot[0];
const total = armRot + gripRot;
const up = Math.cos(total);          // доля «вверх»
const fwd = -Math.sin(total);        // доля «вперёд»
ok('клинок направлен вперёд, а не вверх', fwd > 0.9 && up < 0.35,
  `вперёд=${fwd.toFixed(2)} вверх=${up.toFixed(2)}`);

console.log(`\nr55_check: ${okCount} ok, ${failCount} fail`);
process.exit(failCount ? 1 : 0);
