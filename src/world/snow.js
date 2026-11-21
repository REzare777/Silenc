/**
 * ============================================================================
 *  Снег: зимняя погода в долине
 * ============================================================================
 *
 *  Снег — самый заметный признак зимы, поэтому он сделан честно:
 *  это настоящие частицы, которые живут в мире, а не наклейка на экране.
 *
 *  Как устроен
 *  -----------
 *  Точки разбросаны в кубе над игроком. Каждый кадр они падают вниз и
 *  чуть смещаются вбок («ветер»), а когда опускаются ниже земли или
 *  слишком далеко от игрока, их подбрасывает наверх — так снег идёт
 *  бесконечно, а игрок не замечает границ куба.
 *
 *  Частицы живут в локации игрока: снег идёт в деревне, но не в подземелье
 *  и не в интерьерах.
 *
 *  @module world/snow
 */

import * as THREE from 'three';

/** Сколько снежинок в кубе над игроком. */
const COUNT = 900;

/** Размер куба, в котором живёт снег. */
const BOX = 46;

/**
 * Создать систему снега.
 *
 * @param {object} ctx контекст игры
 * @returns {object} система снега
 */
export function createSnow(ctx) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);

  // псевдослучайное разбрасывание — без Math.random, чтобы кадры были повторяемы
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rnd() - 0.5) * BOX;
    pos[i * 3 + 1] = rnd() * 26;
    pos[i * 3 + 2] = (rnd() - 0.5) * BOX;
    vel[i * 3] = (rnd() - 0.5) * 0.5;
    vel[i * 3 + 1] = -(0.5 + rnd() * 0.9);
    vel[i * 3 + 2] = (rnd() - 0.5) * 0.5;
    size[i] = 0.035 + rnd() * 0.055;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

  // круглая мягкая снежинка
  const sprite = document.createElement('canvas');
  sprite.width = 32; sprite.height = 32;
  const g = sprite.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(240,248,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(sprite);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.PointsMaterial({
    size: 0.14,
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'snow';
  points.frustumCulled = false;
  points.visible = false;

  /** Текущий сезон. */
  let season = 'spring';
  /** Плавно меняемая сила снега (0..1). */
  let strength = 0;
  let target = 0;

  /**
   * Включить или выключить снег по сезону.
   *
   * @param {string} s идентификатор сезона
   */
  function setSeason(s) {
    season = s;
    target = (s === 'winter') ? 1 : 0;
  }

  /**
   * Обновить снег.
   *
   * @param {number} dt кадр в секундах
   * @param {THREE.Vector3} focus точка, вокруг которой живёт снег
   * @param {boolean} active снег виден (в подземелье — нет)
   */
  function update(dt, focus, active = true) {
    // сила меняется плавно: снег не начинается с одного кадра, но и не
    // наползает слишком долго — иначе зима наступала бы десятками секунд
    strength += (target - strength) * Math.min(1, dt * 2.5);
    const on = active && strength > 0.01;
    points.visible = on;
    if (!on) return;

    mat.opacity = 0.85 * strength;
    const arr = geo.attributes.position.array;
    const f = focus || { x: 0, z: 0 };
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      arr[i3] += vel[i3] * dt;
      arr[i3 + 1] += vel[i3 + 1] * dt;
      arr[i3 + 2] += vel[i3 + 2] * dt;
      // упал на землю или улетел из куба — подбрасываем наверх
      const dy = arr[i3 + 1] - (f.y || 0);
      if (dy < 0.2 || Math.abs(arr[i3] - f.x) > BOX / 2 || Math.abs(arr[i3 + 2] - f.z) > BOX / 2) {
        arr[i3] = f.x + (Math.sin(i * 12.9898 + arr[i3 + 1]) * 0.5 + 0.5 - 0.5) * BOX;
        arr[i3 + 1] = 22 + (i % 7) * 0.8;
        arr[i3 + 2] = f.z + (Math.cos(i * 78.233 + arr[i3]) * 0.5 + 0.5 - 0.5) * BOX;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }

  /* ---------------- снежный покров ---------------- */

  /**
   * Лёгкая белая плёнка над травой и дорогами.
   *
   * Снег на земле — это не отдельная геометрия, а второй слой того же
   * полотна, чуть приподнятый, с прозрачностью. Летом он невидим,
   * зимой — плотный. Так снег покрывает и поля, и дороги, и всё
   * остальное, не нужно строить отдельную зимнюю карту.
   */
  // текстура снега: ровная белизна с лёгкими бугорками и пятнами
  const coverCanvas = document.createElement('canvas');
  coverCanvas.width = 256; coverCanvas.height = 256;
  {
    const cg = coverCanvas.getContext('2d');
    cg.fillStyle = '#f4f8fd';
    cg.fillRect(0, 0, 256, 256);
    // мягкие бугорки наметённого снега
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      const r = 3 + Math.random() * 13;
      const a = 0.05 + Math.random() * 0.1;
      cg.fillStyle = Math.random() > 0.45
        ? `rgba(255,255,255,${a})`
        : `rgba(206,220,236,${a})`;
      cg.beginPath(); cg.arc(x, y, r, 0, Math.PI * 2); cg.fill();
    }
  }
  const coverTex = new THREE.CanvasTexture(coverCanvas);
  coverTex.wrapS = coverTex.wrapT = THREE.RepeatWrapping;
  coverTex.repeat.set(46, 46);
  coverTex.colorSpace = THREE.SRGBColorSpace;

  const coverGeo = new THREE.PlaneGeometry(460, 460, 1, 1);
  const coverMat = new THREE.MeshStandardMaterial({
    map: coverTex,
    color: 0xffffff,
    // снег слегка светится: зимой в долине светло даже в тени
    emissive: 0x9fb4cc,
    emissiveIntensity: 0.32,
    roughness: 0.66,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const cover = new THREE.Mesh(coverGeo, coverMat);
  cover.rotation.x = -Math.PI / 2;
  cover.position.y = 0.012;         // чуть выше земли, чтобы не z-fighting
  cover.receiveShadow = true;
  cover.name = 'groundSnow';
  cover.visible = false;
  cover.renderOrder = 1;

  /** Сила покрова (0..1). */
  let coverStrength = 0;
  let coverTarget = 0;

  /**
   * Включить или выключить снежный покров.
   *
   * @param {string} s идентификатор сезона
   */
  function setCoverSeason(s) {
    coverTarget = (s === 'winter') ? 1 : 0;
  }

  /** Обновить покров. */
  function updateCover(dt) {
    coverStrength += (coverTarget - coverStrength) * Math.min(1, dt * 2.5);
    if (coverStrength < 0.01) {
      cover.visible = false;
      coverMat.opacity = 0;
      return;
    }
    cover.visible = true;
    // зимой снег закрывает землю почти целиком: трава должна уйти под снег
    coverMat.opacity = coverStrength * 0.97;
  }

  return {
    points,
    cover,
    setSeason,
    update,
    setCoverSeason,
    updateCover,
    get strength() { return strength; },
    get coverStrength() { return coverStrength; },
  };
}
