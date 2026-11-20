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
    const key = new THREE.DirectionalLight(0xffeacb, 1.45);
    key.position.set(-0.6, 1.0, 0.7);
    const fill = new THREE.DirectionalLight(0xa8c6f0, 0.5);
    fill.position.set(0.9, -0.4, 0.5);
    const rim = new THREE.DirectionalLight(0xffcf96, 0.42);
    rim.position.set(0.2, 0.4, -1);
    this.scene.add(key, fill, rim, new THREE.AmbientLight(0x8d8375, 0.5));

    /** Руки. */
    this.hands = buildHands();
    this.camera.add(this.hands.group);

    /** Якорь для предмета «на двух руках». */
    this.anchorBoth = new THREE.Group();
    this.anchorBoth.position.set(0, -0.115, -0.36);
    this.hands.group.add(this.anchorBoth);

    /** Удерживаемый предмет. */
    this.item = null;
    /** Имя предмета (для отладки и тестов). */
    this.itemName = '';
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
    this.hands.setPose(this.grip, this.pose);
    this._place();
    if (this.item) this.item.visible = this.grip !== 'point';
    this.visible = true;
    this._fade = 0;
  }

  /** Отпустить предмет. */
  release() {
    if (this.item) {
      if (this.item.parent) this.item.parent.remove(this.item);
      this.item = null;
    }
    this.itemName = '';
  }

  /** Спрятать руки (предмет при этом остаётся «в руках»). */
  hideHands() {
    this.visible = false;
    this.release();
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
    this.hands.setPose(this.grip, this.pose);
    this._place();
    // в жесте «указать» предмет в руке не нужен
    if (this.item) this.item.visible = this.grip !== 'point';
  }

  /** Поставить предмет туда, где его ждут при текущем захвате. */
  _place() {
    if (!this.item) return;
    const t = holdTransform(this.grip);
    const hold = this.hands.right.userData.hold;
    const holdL = this.hands.left.userData.hold;
    let target;
    if (this.grip === 'left') target = holdL;
    else target = hold;          // 'two' и 'right' — предмет в правой руке
    target.add(this.item);
    this.item.position.fromArray(t.pos);
    this.item.rotation.set(t.rot[0], t.rot[1], t.rot[2]);
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
