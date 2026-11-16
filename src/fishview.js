import * as THREE from 'three';
import { fishModel } from './world/fish.js';

/**
 * Отдельное окно просмотра предмета: свой рендерер, своя сцена.
 * Рыба покачивается и медленно поворачивается — её можно рассмотреть.
 */
export class FishView {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, canvas.width / canvas.height, 0.1, 40);
    this.camera.position.set(0, 0.2, 2.75);
    this.camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xfff0d8, 2.1);
    key.position.set(2.2, 3.0, 3.4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fc7ff, 1.25);
    rim.position.set(-3.0, 1.2, -2.6);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0xbfae94, 0.55));
    const fill = new THREE.PointLight(0xffc98a, 12, 9);
    fill.position.set(0, 1.4, 1.6);
    this.scene.add(fill);

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.model = null;
    this.raf = 0;
    this.t = 0;
    this.running = false;
  }

  /** Показать модель рыбы (или любого предмета-группы). */
  show(spec) {
    this.clear();
    try {
      this.model = fishModel(spec);
    } catch (e) {
      this.model = null;
    }
    if (this.model) {
      this.model.rotation.y = -0.35;
      this.holder.add(this.model);
    }
    this.resize();
    this.start();
  }

  clear() {
    if (this.model) {
      this.holder.remove(this.model);
      this.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.model = null;
    }
    try { this.renderer.clear(); } catch (e) { /* контекст мог быть потерян */ }
  }

  resize() {
    const c = this.canvas;
    // рендерим в двойном разрешении — превью остаётся чётким
    const w = (c.clientWidth || 300) * 2, h = (c.clientHeight || 200) * 2;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(tick);
      this.t += 0.016;
      if (this.model) {
        this.model.position.y = Math.sin(this.t * 1.5) * 0.06;
        this.model.rotation.y = -0.35 + Math.sin(this.t * 0.6) * 0.5;
        this.model.rotation.z = Math.sin(this.t * 1.1) * 0.05;
      }
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  hide() {
    this.stop();
    this.clear();
  }
}
