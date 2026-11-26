/**
 * ============================================================================
 *  МЕТКА ДЕЛА НАД ПЕРСОНАЖЕМ
 * ============================================================================
 *
 *  Когда у торговца есть незакрытое дело, над его головой висит метка:
 *
 *    «!» — жёлтая. Новое дело: можно взять.
 *    «?» — зелёная. Дело сделано, можно сдать.
 *
 *  Метка — это спрайт с текстурой, нарисованной на canvas. Она всегда
 *  развёрнута к камере (спрайты в Three.js так умеют) и слегка покачивается,
 *  чтобы её было видно издалека.
 *
 *  Метка не «знает» ни про какие квесты: ей просто говорят, что показать,
 *  — состоянием `off`, `new` или `ready`.
 *
 *  @module world/questmark
 */

import * as THREE from 'three';

/** Размер холста метки (пиксели). */
const PX = 96;

/**
 * Нарисовать знак на холсте.
 *
 * @param {HTMLCanvasElement} canvas холст
 * @param {string} kind 'new' | 'ready'
 */
function drawSign(canvas, kind) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, PX, PX);
  const isNew = kind === 'new';
  const color = isNew ? '#ffc94a' : '#7ce8a6';
  const glow = isNew ? 'rgba(255,201,74,.55)' : 'rgba(124,232,166,.5)';

  // мягкое свечение вокруг знака
  const halo = g.createRadialGradient(PX / 2, PX / 2, PX * 0.08, PX / 2, PX / 2, PX * 0.5);
  halo.addColorStop(0, glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, PX, PX);

  // сам знак
  g.font = '700 66px "Cormorant Garamond", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(12,9,6,.92)';
  g.strokeText(isNew ? '!' : '?', PX / 2, PX / 2 + 3);
  g.fillStyle = color;
  g.fillText(isNew ? '!' : '?', PX / 2, PX / 2 + 3);
}

/**
 * Создать метку дела.
 *
 * @returns {{sprite: THREE.Sprite, set: Function, get: Function, update: Function}}
 */
export function questMarker() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PX;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.46, 0.46, 1);
  sprite.visible = false;
  sprite.renderOrder = 8;

  let cur = 'off';
  let t = 0;

  /**
   * Показать метку.
   *
   * @param {string} kind 'off' | 'new' | 'ready'
   */
  function set(kind) {
    const k = kind || 'off';
    if (k !== cur) {
      cur = k;
      if (k !== 'off') {
        drawSign(canvas, k);
        tex.needsUpdate = true;
      }
    }
    // видимость пересчитывается каждый раз: персонаж мог уйти, а потом вернуться
    sprite.visible = k !== 'off';
  }

  /**
   * Спрятать метку, не меняя её состояние (например, персонаж ушёл на ночь).
   */
  function hide() {
    sprite.visible = false;
  }

  /**
   * Покачивание метки.
   *
   * @param {number} dt кадр в секундах
   * @param {number} y базовая высота
   */
  function update(dt, y) {
    if (!sprite.visible) return;
    t += dt;
    sprite.position.y = y + Math.sin(t * 2.4) * 0.06;
  }

  return {
    sprite,
    set,
    hide,
    update,
    /** Текущее состояние метки. */
    get kind() { return cur; },
  };
}
