/**
 * ============================================================================
 *  Модель «в руках» (viewmodel): парящее оружие от первого лица
 * ============================================================================
 *
 *  Раньше в кадре была рука: кисть сжимала рукоять, и оружие сидело в ней.
 *  Выглядело это скверно — кисть читалась как «булка», а рукоять проходила
 *  сквозь кулак. Теперь руки нет вовсе: оружие **висит в воздухе** перед
 *  камерой.
 *
 *  Как это выглядит:
 *
 *  * оружие крупное, справа-снизу, целиком в кадре;
 *  * «дышит»: медленно покачивается и слегка дрожит, как будто удерживается
 *    невидимой силой;
 *  * вокруг него кружатся светящиеся пылинки;
 *  * у оружия есть свой источник света — в пещере оно светит, а в деревне
 *    подсвечивает само себя;
 *  * при замахе оружие вылетает вперёд-вниз и возвращается на место.
 *
 *  Оверлейная сцена (как и раньше) — руки/оружие никогда не проваливаются
 *  в стены и не ловят свет локации.
 *
 *  @module game/viewmodel
 */

import * as THREE from 'three';
import { weaponFloat, weaponModel } from '../world/weapons.js';

/**
 * Посадка обычного предмета (рыба и прочее), когда он «висит» перед камерой.
 */
const FLOAT_ITEM = {
  two: { pos: [-0.02, -0.05, -0.42], rot: [0.10, -0.22, 0.04] },
  right: { pos: [0.10, -0.07, -0.40], rot: [0.16, -0.35, 0.10] },
  left: { pos: [-0.12, -0.06, -0.40], rot: [0.16, 0.30, -0.10] },
  point: { pos: [-0.01, -0.03, -0.55], rot: [0.06, -0.10, 0.02] },
};

/**
 * Посадка факела (бранда): парит слева, горит вверх.
 */
const FLOAT_TORCH = { pos: [-0.20, -0.09, -0.38], rot: [0.10, 0.0, 0.18] };

/**
 * Число светящихся пылинок вокруг оружия.
 */
const MOTE_COUNT = 60;

/**
 * Круглая текстура-«искра» для пылинок.
 *
 * @returns {THREE.Texture} текстура
 */
function moteTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,240,210,1)');
  grad.addColorStop(0.35, 'rgba(255,205,140,0.75)');
  grad.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Класс модели «в руках» — теперь это парящее оружие.
 */
export class ViewModel {
  constructor() {
    /** Оверлейная сцена — рисуется поверх игрового кадра. */
    this.scene = new THREE.Scene();
    /** Своя камера: копирует поворот игровой, но с другим углом обзора. */
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 12);
    this.scene.add(this.camera);

    // собственный свет — оружие читается в любой локации
    const key = new THREE.DirectionalLight(0xffeacb, 3.0);
    key.position.set(-0.7, 1.0, 0.8);
    const fill = new THREE.DirectionalLight(0xa8c6f0, 1.25);
    fill.position.set(1.0, -0.3, 0.6);
    const rim = new THREE.DirectionalLight(0xffcf96, 1.7);
    rim.position.set(0.3, 0.5, -1);
    this.scene.add(key, fill, rim, new THREE.AmbientLight(0xb3a894, 1.55));

    /** Парящая группа: оружие или предмет. */
    this.float = new THREE.Group();
    this.float.name = 'floatModel';
    this.camera.add(this.float);

    /** Вторая парящая группа — для факела (горит отдельно, слева). */
    this.float2 = new THREE.Group();
    this.float2.name = 'floatTorch';
    this.camera.add(this.float2);

    /** Собственный источник света у оружия. */
    this.glow = new THREE.PointLight(0xffd9a0, 5, 1.6, 2);
    this.glow.position.set(0, 0, 0);
    this.float.add(this.glow);

    /** Светящиеся пылинки вокруг. */
    this.motes = this._buildMotes();
    this.float.add(this.motes);

    /** Удерживаемый предмет (рыба, кружка). */
    this.item = null;
    /** Оружие. */
    this.weapon = null;
    /** Спецификация оружия. */
    this.weaponSpec = null;
    /** Факел (бранд). */
    this.torch = null;
    /** Имя предмета (для отладки и тестов). */
    this.itemName = '';
    /** Таймер анимации удара. */
    this.swingT = 0;
    /** Длительность анимации удара. */
    this.swingDur = 0.3;
    /** Текущий захват (для предметов). */
    this.grip = 'two';
    /** Текущая поза (для предметов). */
    this.pose = 'present';
    /** Видна ли модель. */
    this.visible = false;
    /** Секунд счётчик — для покачивания. */
    this.time = 0;
    /** Сколько живёт предмет (0 = до отмены). */
    this.lifetime = 0;
    /** Плавное появление/исчезновение. */
    this._fade = 0;
    /** Вспышка заклинания: сколько осталось гореть. */
    this._flash = 0;
    /** Сила вспышки заклинания. */
    this._flashPower = 0;

    /** Целевая посадка парящего объекта. */
    this._base = { pos: [0, 0, 0], rot: [0, 0, 0] };
    /** Целевая посадка факела. */
    this._base2 = { pos: FLOAT_TORCH.pos.slice(), rot: FLOAT_TORCH.rot.slice() };
  }

  /**
   * Пылинки: светящиеся точки, медленно кружащие вокруг оружия.
   *
   * @returns {THREE.Points} облако точек
   */
  _buildMotes() {
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(MOTE_COUNT * 3);
    this._moteSeed = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.10 + Math.random() * 0.20;
      const y = (Math.random() - 0.5) * 0.34;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(a) * r;
      this._moteSeed[i * 3] = Math.random() * Math.PI * 2;
      this._moteSeed[i * 3 + 1] = 0.25 + Math.random() * 0.7;
      this._moteSeed[i * 3 + 2] = 0.10 + Math.random() * 0.28;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd9a0,
      map: moteTexture(),
      size: 0.011,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'motes';
    pts.frustumCulled = false;
    return pts;
  }

  /**
   * Взять предмет в руки (теперь — он просто висит перед камерой).
   *
   * @param {THREE.Object3D} model модель предмета
   * @param {object} [opts] { grip, pose, scale, life }
   */
  hold(model, opts = {}) {
    if (!model) return;
    this.release();
    this.item = model;
    this.itemName = model.name || 'item';
    const s = opts.scale ?? 1;
    this.item.scale.setScalar(s);
    this.grip = opts.grip || 'two';
    this.pose = opts.pose || 'present';
    this.lifetime = opts.life ?? 0;
    this._applyFloat();
    if (this.item) this.item.visible = this.grip !== 'point';
    this.visible = true;
    this._fade = 0;
  }

  /**
   * Взять оружие (оно повисает перед камерой).
   *
   * @param {THREE.Object3D|null} model модель оружия
   * @param {object|null} spec спецификация оружия
   */
  setWeapon(model, spec) {
    if (this.weapon) {
      if (this.weapon.parent) this.weapon.parent.remove(this.weapon);
      this.weapon = null;
    }
    this.weaponSpec = spec || null;
    if (model && spec) {
      const f = weaponFloat(spec);
      this.weapon = model;
      model.scale.setScalar(f.scale);
      this.floatInfo = f;
    }
    this._applyFloat();
    if (this.weapon || this.item || this.torch) this.visible = true;
  }

  /**
   * Показать факел (бранд) — он тоже парит в воздухе.
   *
   * @param {THREE.Object3D|null} model модель факела
   * @param {number} [scale] масштаб
   */
  setTorch(model, scale = 0.22) {
    if (this.torch) {
      if (this.torch.parent) this.torch.parent.remove(this.torch);
      this.torch = null;
    }
    if (model) {
      this.torch = model;
      model.scale.setScalar(scale);
    }
    this._applyFloat();
    if (this.weapon || this.item || this.torch) this.visible = true;
  }

  /** Убрать оружие. */
  clearWeapon() {
    this.setWeapon(null, null);
  }

  /**
   * Вспышка заклинания: свет вокруг оружия на мгновение усиливается.
   *
   * @param {number} color цвет вспышки
   * @param {number} power сила
   */
  flash(color = 0xffb066, power = 8) {
    this.glow.color.setHex(color);
    this.glow.intensity = power;
    this._flash = 0.35;
    this._flashPower = power;
    if (this.motes) this.motes.material.color.setHex(color);
  }

  /**
   * Замах: короткая анимация удара.
   *
   * @param {number} [dur] длительность, сек
   */
  swing(dur = 0.3) {
    this.swingDur = dur;
    this.swingT = dur;
  }

  /**
   * Разместить всё, что висит в воздухе.
   *
   * Правило приоритета: сюжетный предмет важнее оружия, факел парит
   * отдельно, слева.
   */
  _applyFloat() {
    // сначала всё убираем — потом ставим заново в правильном порядке
    for (const o of [this.item, this.weapon, this.torch]) {
      if (o && o.parent) o.parent.remove(o);
    }
    this._base2 = { pos: FLOAT_TORCH.pos.slice(), rot: FLOAT_TORCH.rot.slice() };

    if (this.item) {
      this.float.add(this.item);
      this._base = this._poseFor(this.grip, this.pose);
      this.item.rotation.set(this._base.rot[0], this._base.rot[1], this._base.rot[2]);
      this.item.position.set(0, 0, 0);
      if (this.weapon) this.weapon.visible = false;
      if (this.torch) this.torch.visible = false;
      this.glow.intensity = 2.5;
      this.glow.color.setHex(0xffd9a0);
      return;
    }

    if (this.weapon) {
      this.float.add(this.weapon);
      const f = this.floatInfo || weaponFloat(this.weaponSpec || {});
      this._base = { pos: f.pos.slice(), rot: f.rot.slice() };
      this.weapon.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
      this.weapon.position.set(0, 0, 0);
      this.weapon.visible = true;
      // оружие светит: у магического — фиолетовым, у остального — тёплым
      const magic = this.weaponSpec && this.weaponSpec.subclass === 'magic';
      this.glow.color.setHex(magic ? 0x9a6bff : 0xffd9a0);
      this.glow.intensity = magic ? 6 : 3.2;
      if (this.torch) {
        this.float2.add(this.torch);
        this.torch.position.set(0, 0, 0);
        this.torch.rotation.set(0, 0, 0);
        this.torch.visible = true;
      }
      return;
    }

    if (this.torch) {
      this.float2.add(this.torch);
      this.torch.position.set(0, 0, 0);
      this.torch.rotation.set(0, 0, 0);
      this.torch.visible = true;
      this._base = { pos: [0, 0, 0], rot: [0, 0, 0] };
      this.glow.color.setHex(0xffb066);
      this.glow.intensity = 5;
    }
  }

  /**
   * Посадка предмета по захвату и позе.
   *
   * @param {string} grip 'two' | 'right' | 'left' | 'point'
   * @param {string} pose 'present' | 'carry' | 'reach'
   * @returns {{pos: number[], rot: number[]}} смещение и поворот
   */
  _poseFor(grip, pose) {
    const base = FLOAT_ITEM[grip] || FLOAT_ITEM.two;
    const pos = base.pos.slice();
    const rot = base.rot.slice();
    if (pose === 'carry') {
      pos[1] -= 0.09;
      rot[0] += 0.12;
    } else if (pose === 'reach') {
      pos[2] -= 0.09;
      rot[0] -= 0.08;
    }
    return { pos, rot };
  }

  /** Отпустить предмет. */
  release() {
    if (this.item) {
      if (this.item.parent) this.item.parent.remove(this.item);
      this.item = null;
    }
    this.itemName = '';
    this._applyFloat();
  }

  /** Спрятать модель (предмет при этом остаётся «в руках»). */
  hideHands() {
    this.visible = false;
    this.release();
    this.clearWeapon();
    if (this.torch) {
      if (this.torch.parent) this.torch.parent.remove(this.torch);
      this.torch = null;
    }
    this._applyFloat();
  }

  /**
   * Сменить захват/позу предмета.
   *
   * @param {string} [grip] 'two' | 'right' | 'left' | 'point'
   * @param {string} [pose] 'present' | 'carry' | 'reach'
   */
  setPose(grip, pose) {
    if (grip) this.grip = grip;
    if (pose) this.pose = pose;
    if (this.item) {
      this._base = this._poseFor(this.grip, this.pose);
      this.item.rotation.set(this._base.rot[0], this._base.rot[1], this._base.rot[2]);
      this.item.visible = this.grip !== 'point';
    } else if (this.torch) {
      // удар факелом: факел вытягивается вперёд
      const reach = pose === 'reach';
      this._base2 = {
        pos: [
          FLOAT_TORCH.pos[0] + (reach ? 0.04 : 0),
          FLOAT_TORCH.pos[1] - (reach ? 0.03 : 0),
          FLOAT_TORCH.pos[2] - (reach ? 0.14 : 0),
        ],
        rot: [
          FLOAT_TORCH.rot[0] + (reach ? 0.25 : 0),
          FLOAT_TORCH.rot[1],
          FLOAT_TORCH.rot[2],
        ],
      };
    }
  }

  /**
   * Обновление: парение, дрожание, замах, синхронизация камеры.
   *
   * @param {number} dt кадр в секундах
   * @param {THREE.Camera} mainCamera камера игрока
   * @param {object} [player] игрок (для лёгкого качания при ходьбе)
   */
  update(dt, mainCamera, player) {
    this.time += dt;
    const t = this.time;

    if (this.visible) {
      this._fade = Math.min(1, this._fade + dt * 7);
      if (this.lifetime > 0) {
        this.lifetime -= dt;
        if (this.lifetime <= 0) { this.visible = false; this.release(); }
      }
    } else {
      this._fade = Math.max(0, this._fade - dt * 3.5);
    }

    // поворот совпадает с игровой камерой
    if (mainCamera) {
      this.camera.quaternion.copy(mainCamera.quaternion);
      this.camera.position.set(0, 0, 0);
    }

    // «дыхание» парящего оружия: медленное покачивание + мелкая дрожь
    const walk = player ? Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 2.4) : 0;
    const ph = player ? player.bobPhase : 0;
    const b = this._base;
    const sway = Math.sin(t * 0.83) * 0.010 + Math.sin(t * 1.27 + 1.1) * 0.013;
    const jitter = Math.sin(t * 23.7) * 0.0016 + Math.sin(t * 19.3 + 2.0) * 0.0018;
    this.float.position.set(
      b.pos[0] + Math.sin(t * 0.61) * 0.006 + jitter,
      b.pos[1] + sway + jitter - walk * Math.sin(ph * 2) * 0.010,
      b.pos[2] + Math.sin(t * 0.47) * 0.005,
    );
    this.float.rotation.set(
      b.rot[0] + Math.sin(t * 1.1) * 0.030 + walk * Math.sin(ph) * 0.02,
      b.rot[1] + Math.sin(t * 0.8) * 0.045,
      b.rot[2] + Math.sin(t * 1.4 + 0.6) * 0.025,
    );

    // замах: оружие вылетает вперёд-вниз и возвращается
    let swingOffset = 0;
    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      swingOffset = Math.sin((1 - this.swingT / this.swingDur) * Math.PI);
      if (this.swingT === 0 && this.weapon) {
        this._applyFloat();
      }
    }
    if (swingOffset > 0 && this.weapon) {
      const bow = this.weaponSpec && this.weaponSpec.subclass === 'bow';
      if (bow) {
        // лук: натяжение тетивы — оружие отводится назад
        this.float.position.z += swingOffset * 0.06;
        this.float.rotation.x -= swingOffset * 0.22;
      } else {
        this.float.position.z -= swingOffset * 0.20;
        this.float.position.y -= swingOffset * 0.06;
        this.float.rotation.x += swingOffset * 0.55;
        this.float.rotation.z += swingOffset * 0.10;
      }
      this.glow.intensity += swingOffset * 4;
    }

    // вторая парящая группа (факел) — дышит в своём ритме
    const b2 = this._base2;
    this.float2.position.set(
      b2.pos[0] + Math.sin(t * 0.71 + 2.0) * 0.007 + jitter,
      b2.pos[1] + Math.sin(t * 1.11 + 0.4) * 0.011,
      b2.pos[2] + Math.sin(t * 0.53) * 0.005,
    );
    this.float2.rotation.set(
      b2.rot[0] + Math.sin(t * 1.3) * 0.035,
      b2.rot[1] + Math.sin(t * 0.9 + 1.0) * 0.040,
      b2.rot[2] + Math.sin(t * 1.5 + 0.2) * 0.030,
    );

    // пылинки: медленно кружат и поднимаются
    const pts = this.motes.geometry.attributes.position;
    const seed = this._moteSeed;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const ph2 = seed[i * 3] + t * seed[i * 3 + 1] * 0.35;
      const rr = seed[i * 3 + 2];
      let y = pts.getY(i) + dt * 0.035 * seed[i * 3 + 1];
      if (y > 0.19) y = -0.19;
      pts.setXYZ(i, Math.cos(ph2) * rr, y, Math.sin(ph2) * rr);
    }
    pts.needsUpdate = true;
    this.motes.material.opacity = 0.55 * this._fade;

    // вспышка заклинания: свет гаснет сам
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt);
      const k = this._flash / 0.35;
      this.glow.intensity = Math.max(this.glow.intensity, this._flashPower * k);
      if (this._flash === 0) {
        // возвращаем обычный цвет свечения оружия
        const magic = this.weaponSpec && this.weaponSpec.subclass === 'magic';
        this.glow.color.setHex(this.torch && !this.weapon ? 0xffb066 : (magic ? 0x9a6bff : 0xffd9a0));
        this.glow.intensity = this.weapon ? (magic ? 6 : 3.2) : (this.torch ? 5 : 2.5);
        if (this.motes) this.motes.material.color.setHex(0xffd9a0);
      }
    }

    // появление/исчезновение
    const f = this._fade;
    this.float.scale.setScalar(0.88 + 0.12 * f);
    for (const grp of [this.float, this.float2]) {
      grp.traverse((o) => {
        if (o.isMesh && o.material) {
          if (!o.material.transparent) { o.material.transparent = true; }
          o.material.opacity = f;
        }
      });
    }
  }

  /**
   * Отрисовать модель поверх игрового кадра.
   *
   * @param {THREE.WebGLRenderer} renderer рендерер
   */
  render(renderer) {
    if (!this.visible || this._fade <= 0.01) return;
    const prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = prevAuto;
  }

  /**
   * Подогнать размер оверлея под экран.
   *
   * @param {number} w ширина
   * @param {number} h высота
   */
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

export { weaponModel };
