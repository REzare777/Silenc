/**
 * ============================================================================
 *  Модель «в руках» (viewmodel): руки и предмет перед камерой
 * ============================================================================
 *
 *  Руки рисуются не в основной сцене, а в отдельной оверлейной сцене:
 *  так они никогда не проваливаются в стены и не ловят свет локации.
 *  Оверлей рендерится поверх картинки после пост-обработки.
 *
 *  Модель появляется только когда игрок что-то держит, и прячется,
 *  когда предмет убран.
 *
 *  @module game/viewmodel
 */

import * as THREE from 'three';
import { buildHands, holdTransform } from '../world/hands.js';
import { weaponGrip } from '../world/weapons.js';

/**
 * Класс модели «в руках».
 */
export class ViewModel {
  constructor() {
    /** Оверлейная сцена — рисуется поверх игрового кадра. */
    this.scene = new THREE.Scene();
    /** Своя камера: копирует поворот игровой, но с другим углом обзора. */
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 8);
    this.scene.add(this.camera);

    // собственный свет — руки читаются в любой локации
    const key = new THREE.DirectionalLight(0xffeacb, 1.6);
    key.position.set(-0.6, 1.0, 0.7);
    const fill = new THREE.DirectionalLight(0xa8c6f0, 0.5);
    fill.position.set(0.9, -0.4, 0.5);
    const rim = new THREE.DirectionalLight(0xffcf96, 0.42);
    rim.position.set(0.2, 0.4, -1);
    this.scene.add(key, fill, rim, new THREE.AmbientLight(0x9a8f80, 0.72));

    /** Руки. */
    this.hands = buildHands();
    this.camera.add(this.hands.group);

    /** Якорь для предмета «на двух руках». */
    this.anchorBoth = new THREE.Group();
    this.anchorBoth.position.set(0, -0.115, -0.36);
    this.hands.group.add(this.anchorBoth);

    /** Удерживаемый предмет (рыба, кружка — то, что «в руках» по сюжету). */
    this.item = null;
    /** Оружие в правой руке. */
    this.weapon = null;
    /** Спецификация оружия (нужна для позы и анимации). */
    this.weaponSpec = null;
    /** Факел (бранд) — горит в левой руке, если правая занята оружием. */
    this.torch = null;
    /** Имя предмета (для отладки и тестов). */
    this.itemName = '';
    /** Таймер анимации удара. */
    this.swingT = 0;
    /** Длительность анимации удара. */
    this.swingDur = 0.3;
    /** Текущий захват. */
    this.grip = 'two';
    /** Текущая поза. */
    this.pose = 'present';
    /** Видна ли модель. */
    this.visible = false;
    /** Секунд счётчик — для покачивания. */
    this.time = 0;
    /** Сколько живёт предмет в руках (0 = до отмены). */
    this.lifetime = 0;
    /** Плавное появление/исчезновение. */
    this._fade = 0;
  }

  /**
   * Взять предмет в руки.
   *
   * @param {THREE.Object3D} model модель предмета (остаётся в руках)
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
    this._applyArms();
    if (this.item) this.item.visible = this.grip !== 'point';
    this.visible = true;
    this._fade = 0;
  }

  /**
   * Взять оружие в правую руку.
   *
   * @param {THREE.Object3D|null} model модель оружия
   * @param {object|null} spec спецификация (для позы и анимации)
   */
  setWeapon(model, spec) {
    if (this.weapon) {
      if (this.weapon.parent) this.weapon.parent.remove(this.weapon);
      this.weapon = null;
    }
    this.weaponSpec = spec || null;
    if (model && spec) {
      const g = weaponGrip(spec);
      this.weapon = model;
      model.scale.setScalar(g.scale);
      this.weaponGripInfo = g;
    }
    this._applyArms();
    if (this.weapon || this.item || this.torch) this.visible = true;
  }

  /**
   * Показать факел в руке.
   *
   * @param {THREE.Object3D|null} model модель бранда
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
    this._applyArms();
    if (this.weapon || this.item || this.torch) this.visible = true;
  }

  /** Убрать оружие из рук. */
  clearWeapon() {
    this.setWeapon(null, null);
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
   * Расставить руки и предметы по местам.
   *
   * Правило приоритета: сюжетный предмет важнее оружия, факел уходит в
   * левую руку, если правая занята одноручным оружием.
   */
  _applyArms() {
    const itemActive = !!this.item;
    const weaponActive = !!this.weapon;
    const torchActive = !!this.torch;

    if (itemActive) {
      // обычный предмет: как раньше
      this.hands.setPose(this.grip, this.pose);
      this._placeItem();
      if (this.weapon) this.weapon.visible = false;
      if (this.torch) {
        // факел — в свободную руку
        if (this.grip === 'left') {
          this.torch.visible = false;
        } else {
          this.torch.visible = true;
          this._placeTorch(true);
        }
      }
      this.visible = true;
      return;
    }

    if (this.weapon) this.weapon.visible = true;
    if (this.torch) this.torch.visible = true;

    if (weaponActive) {
      const g = this.weaponGripInfo || weaponGrip(this.weaponSpec || {});
      this.hands.setArms(g.pose);
      this._placeWeapon(g);
      // факел в левую руку, только если оружие одноручное
      const oneHand = this.weaponSpec && this.weaponSpec.hands !== 'two'
        && g.pose !== 'bow' && g.pose !== 'staff';
      if (torchActive) {
        this.torch.visible = !!oneHand;
        if (oneHand) {
          this.hands.setArms(g.pose, 'torchLeft');
          this._placeTorch(false);
        }
      }
      this.visible = true;
      return;
    }

    if (torchActive) {
      this.hands.setArms('torchRight');
      this._placeTorch(false);
      this.visible = true;
      return;
    }

    this.hands.setArms('idle');
    this.visible = false;
  }

  /** Поставить обычный предмет в руку. */
  _placeItem() {
    if (!this.item) return;
    const t = holdTransform(this.grip);
    const hold = this.hands.right.userData.hold;
    const holdL = this.hands.left.userData.hold;
    const target = this.grip === 'left' ? holdL : hold;
    target.add(this.item);
    this.item.position.fromArray(t.pos);
    this.item.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
  }

  /**
   * Поставить оружие в руку.
   *
   * По умолчанию — правая рука, но лук держит защитная (левая): так он
   * стоит перед камерой, а натягивающая рука остаётся сбоку.
   */
  _placeWeapon(g) {
    if (!this.weapon) return;
    const hold = g.hand === 'left'
      ? this.hands.left.userData.hold
      : this.hands.right.userData.hold;
    hold.add(this.weapon);
    this.weapon.position.fromArray(g.pos);
    this.weapon.rotation.set(g.rot[0], g.rot[1], g.rot[2]);
  }

  /**
   * Поставить факел в руку.
   *
   * @param {boolean} right в правую ли руку
   */
  _placeTorch(right) {
    if (!this.torch) return;
    const hold = right
      ? this.hands.right.userData.hold
      : this.hands.left.userData.hold;
    hold.add(this.torch);
    if (right) {
      this.torch.position.set(-0.01, 0.055, 0.0);
      this.torch.rotation.set(0.15, 0.0, 1.02);
    } else {
      this.torch.position.set(0.01, 0.05, 0.0);
      this.torch.rotation.set(0.15, 0.0, -1.02);
    }
  }

  /** Отпустить предмет. */
  release() {
    if (this.item) {
      if (this.item.parent) this.item.parent.remove(this.item);
      this.item = null;
    }
    this.itemName = '';
    this._applyArms();
  }

  /** Спрятать руки (предмет при этом остаётся «в руках»). */
  hideHands() {
    this.visible = false;
    this.release();
    this.clearWeapon();
    if (this.torch) {
      if (this.torch.parent) this.torch.parent.remove(this.torch);
      this.torch = null;
    }
    this._applyArms();
  }

  /**
   * Сменить захват/позу.
   *
   * @param {string} [grip] 'two' | 'right' | 'left' | 'point'
   * @param {string} [pose] 'present' | 'carry' | 'reach'
   */
  setPose(grip, pose) {
    if (grip) this.grip = grip;
    if (pose) this.pose = pose;
    if (this.item) {
      this.hands.setPose(this.grip, this.pose);
      this._placeItem();
      // в жесте «указать» предмет в руке не нужен
      this.item.visible = this.grip !== 'point';
    }
  }

  /**
   * Обновление: покачивание, жизнь предмета, синхронизация камеры.
   *
   * @param {number} dt кадр в секундах
   * @param {THREE.Camera} mainCamera камера игрока
   * @param {object} [player] игрок (для покачивания при ходьбе)
   */
  update(dt, mainCamera, player) {
    this.time += dt;
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

    // анимация удара: рука с оружием идёт вперёд и возвращается
    let swingOffset = 0;
    if (this.swingT > 0) {
      this.swingT = Math.max(0, this.swingT - dt);
      const k = Math.sin((1 - this.swingT / this.swingDur) * Math.PI);
      swingOffset = k;
      if (this.swingT === 0 && this.weapon) {
        // вернуть оружие в исходную позу
        const g = this.weaponGripInfo || weaponGrip(this.weaponSpec || {});
        this._placeWeapon(g);
      }
    }

    // лёгкое покачивание рук
    const t = this.time;
    const walk = player ? Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 2.4) : 0;
    const ph = player ? player.bobPhase : 0;
    const g = this.hands.group;
    const amp = 0.006 + walk * 0.012;
    g.position.set(
      Math.sin(t * 1.1) * amp * 0.5,
      Math.sin(t * 1.6) * amp - walk * Math.sin(ph * 2) * 0.008,
      0,
    );
    g.rotation.set(
      Math.sin(t * 0.9) * 0.012,
      Math.sin(t * 1.3) * 0.016,
      walk * Math.sin(ph) * 0.02,
    );
    // замах оружия: правая рука уходит вперёд и вниз
    if (swingOffset > 0 && this.weapon) {
      const bow = this.weaponSpec && this.weaponSpec.subclass === 'bow';
      const r = this.hands.right;
      if (bow) {
        // натяжение тетивы: рука отводится назад
        r.position.z += swingOffset * 0.1;
        r.rotation.x -= swingOffset * 0.35;
      } else {
        r.position.z -= swingOffset * 0.13;
        r.position.y -= swingOffset * 0.05;
        r.rotation.x += swingOffset * 0.45;
      }
    }
    // появление/исчезновение
    const f = this._fade;
    g.scale.setScalar(0.85 + 0.15 * f);
    g.traverse((o) => {
      if (o.isMesh && o.material) {
        if (!o.material.transparent) { o.material.transparent = true; }
        o.material.opacity = f;
      }
    });
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
