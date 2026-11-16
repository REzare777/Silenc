import * as THREE from 'three';
import { mulberry } from './props.js';

/* ------------------------------------------------------------------ *
 *  Частицы: светлячки, дым, угли, пыль в воздухе
 * ------------------------------------------------------------------ */

export class Fireflies {
  constructor(scene, glowTex, count = 130, bounds = 90) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const rng = mulberry(9182);
    this.homes = [];
    for (let i = 0; i < count; i++) {
      const hx = (rng() - 0.5) * bounds;
      const hz = (rng() - 0.5) * bounds;
      const hy = 0.8 + rng() * 3.2;
      this.homes.push({ x: hx, y: hy, z: hz, ph: rng() * 100, sp: 0.3 + rng() * 0.8 });
      pos[i * 3] = hx; pos[i * 3 + 1] = hy; pos[i * 3 + 2] = hz;
      seed[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    this.uniforms = {
      uTime: { value: 0 },
      uMap: { value: glowTex },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0xffe08a) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * (0.4 + aSeed * 0.7) + aSeed * 30.0) * 1.6;
          p.y += sin(uTime * (0.6 + aSeed) + aSeed * 12.0) * 0.55;
          p.z += cos(uTime * (0.35 + aSeed * 0.6) + aSeed * 21.0) * 1.6;
          vGlow = 0.35 + 0.65 * pow(max(0.0, sin(uTime * (1.1 + aSeed * 1.4) + aSeed * 44.0)), 2.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (26.0 + aSeed * 22.0) * vGlow / max(0.001, -mv.z) * 12.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vGlow;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * t.rgb, t.a * vGlow * uOpacity);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
  }
  update(dt, nightAmount) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uOpacity.value = nightAmount;
    this.points.visible = nightAmount > 0.02;
  }
}

/* ---------- дым из труб ---------- */
export class Smoke {
  constructor(scene, tex, emitters) {
    this.emitters = emitters.map((e) => ({ ...e, acc: 0, puff: 0 }));
    this.pool = [];
    const mat = new THREE.SpriteMaterial({
      map: tex, color: 0xd8d2c6, transparent: true, opacity: 0.0, depthWrite: false,
    });
    for (let i = 0; i < 60; i++) {
      const m = mat.clone();
      const s = new THREE.Sprite(m);
      s.visible = false;
      s.userData = { life: 0, max: 1, vx: 0, vy: 0, vz: 0, scale0: 1, scale1: 2 };
      scene.add(s);
      this.pool.push(s);
    }
    this.tex = tex;
  }
  update(dt) {
    for (const e of this.emitters) {
      e.acc += dt;
      const period = 1 / e.rate;
      while (e.acc > period) {
        e.acc -= period;
        this.spawn(e);
      }
    }
    for (const s of this.pool) {
      if (!s.visible) continue;
      const u = s.userData;
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) { s.visible = false; continue; }
      s.position.x += u.vx * dt;
      s.position.y += u.vy * dt;
      s.position.z += u.vz * dt;
      u.vy *= 0.995;
      const sc = u.scale0 + (u.scale1 - u.scale0) * t;
      s.scale.set(sc, sc, 1);
      s.material.opacity = 0.30 * Math.sin(Math.PI * Math.min(1, t * 1.6)) * (1 - t * 0.35);
    }
  }
  spawn(e) {
    const s = this.pool.find((p) => !p.visible);
    if (!s) return;
    const u = s.userData;
    u.life = 0;
    u.max = 3.2 + Math.random() * 2.2;
    u.vx = (Math.random() - 0.5) * 0.35 + 0.25;
    u.vy = 0.55 + Math.random() * 0.35;
    u.vz = (Math.random() - 0.5) * 0.35;
    u.scale0 = 0.55 + Math.random() * 0.35;
    u.scale1 = u.scale0 * (3.5 + Math.random() * 2.5);
    s.position.set(e.pos.x + (Math.random() - 0.5) * 0.4, e.pos.y, e.pos.z + (Math.random() - 0.5) * 0.4);
    s.visible = true;
  }
}

/* ---------- угли над костром ---------- */
export class Embers {
  constructor(scene, tex, origin) {
    this.origin = origin.clone();
    this.count = 46;
    const pos = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.vel = [];
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
      this.life[i] = Math.random();
      this.vel.push({ x: (Math.random() - 0.5) * 0.5, y: 0.7 + Math.random() * 1.3, z: (Math.random() - 0.5) * 0.5 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));
    this.uniforms = { uMap: { value: tex }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (16.0 + aLife * 22.0) / max(0.001, -mv.z) * 10.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap;
        varying float vLife;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          float a = t.a * (1.0 - vLife) * 1.2;
          gl_FragColor = vec4(vec3(1.0, 0.55, 0.18) * t.rgb, a);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  update(dt) {
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      this.life[i] += dt * 0.42;
      if (this.life[i] > 1) {
        this.life[i] = 0;
        p[i * 3] = this.origin.x + (Math.random() - 0.5) * 0.5;
        p[i * 3 + 1] = this.origin.y + 0.2;
        p[i * 3 + 2] = this.origin.z + (Math.random() - 0.5) * 0.5;
        this.vel[i] = { x: (Math.random() - 0.5) * 0.6, y: 0.8 + Math.random() * 1.4, z: (Math.random() - 0.5) * 0.6 };
        continue;
      }
      p[i * 3] += this.vel[i].x * dt;
      p[i * 3 + 1] += this.vel[i].y * dt;
      p[i * 3 + 2] += this.vel[i].z * dt;
      this.vel[i].y *= 0.985;
      this.vel[i].x += (Math.random() - 0.5) * dt * 0.9;
      this.vel[i].z += (Math.random() - 0.5) * dt * 0.9;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aLife.needsUpdate = true;
  }
}

/* ---------- пылинки в воздухе ---------- */
export class Motes {
  constructor(scene, glowTex, count = 220, radius = 16) {
    const pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count);
    const rng = mulberry(3311);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * radius * 2;
      pos[i * 3 + 1] = 0.3 + rng() * 6;
      pos[i * 3 + 2] = (rng() - 0.5) * radius * 2;
      this.seed[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.uniforms = {
      uTime: { value: 0 }, uMap: { value: glowTex },
      uColor: { value: new THREE.Color(0xffe6c0) }, uOpacity: { value: 0.28 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        varying float vA;
        void main() {
          vec3 p = position;
          p.y += sin(uTime * 0.25 + aSeed * 20.0) * 0.8;
          p.x += sin(uTime * 0.18 + aSeed * 13.0) * 0.7;
          p.z += cos(uTime * 0.2 + aSeed * 9.0) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = 0.35 + 0.65 * sin(uTime * 0.9 + aSeed * 30.0) * 0.5 + 0.32;
          gl_PointSize = (5.0 + aSeed * 7.0) / max(0.001, -mv.z) * 10.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
        varying float vA;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor * t.rgb, t.a * vA * uOpacity);
          if (gl_FragColor.a < 0.01) discard;
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  update(dt, focus) {
    this.uniforms.uTime.value += dt;
    this.points.position.set(focus.x, 0, focus.z);
  }
}

/* ---------- падающие листья ---------- */
export class Leaves {
  constructor(scene, count = 70, radius = 70) {
    const geo = new THREE.PlaneGeometry(0.11, 0.075);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc8913f, side: THREE.DoubleSide, roughness: 0.9,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.data = [];
    const rng = mulberry(777);
    for (let i = 0; i < count; i++) {
      this.data.push({
        x: (rng() - 0.5) * radius, y: rng() * 12, z: (rng() - 0.5) * radius,
        rot: rng() * 6, sp: 0.35 + rng() * 0.5, sway: rng() * 6,
      });
    }
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
  }
  update(dt, t) {
    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i];
      d.y -= d.sp * dt;
      d.rot += dt * 1.4;
      if (d.y < 0.9) { d.y = 11 + Math.random() * 4; d.x = (Math.random() - 0.5) * 70; d.z = (Math.random() - 0.5) * 70; }
      this.dummy.position.set(
        d.x + Math.sin(t * 0.7 + d.sway) * 1.4,
        d.y,
        d.z + Math.cos(t * 0.55 + d.sway) * 1.1,
      );
      this.dummy.rotation.set(d.rot * 0.7, d.rot, d.rot * 0.4);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
