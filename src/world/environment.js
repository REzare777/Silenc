import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Небо, свет, погода
 * ------------------------------------------------------------------ */

const SKY_VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SKY_FRAG = `
varying vec3 vWorld;
uniform vec3 topColor, horizonColor, groundColor, sunDir, sunColor, moonDir;
uniform float sunSize, starAmount, moonAmount, time;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 d = normalize(vWorld);
  float h = d.y;

  vec3 col = mix(horizonColor, topColor, smoothstep(-0.02, 0.62, h));
  col = mix(col, groundColor, smoothstep(0.02, -0.30, h));

  // тёплое гало вокруг солнца
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * pow(sd, 5.0) * 0.28 * sunSize;
  col += sunColor * smoothstep(0.9985, 0.9994, sd) * 1.6 * sunSize;

  // луна
  float md = max(dot(d, normalize(moonDir)), 0.0);
  col += vec3(0.85,0.88,1.0) * smoothstep(0.9990, 0.9996, md) * 2.2 * moonAmount;
  col += vec3(0.55,0.62,0.85) * pow(md, 40.0) * 0.18 * moonAmount;

  // звёзды
  if (starAmount > 0.002) {
    vec3 p = floor(d * 260.0);
    float s = hash13(p);
    float star = smoothstep(0.9972, 0.9999, s);
    float tw = 0.55 + 0.45 * sin(time * 1.7 + s * 90.0);
    col += vec3(0.92, 0.95, 1.0) * star * tw * starAmount * smoothstep(-0.04, 0.22, h);
  }

  gl_FragColor = vec4(col, 1.0);
}`;

const PRESETS = {
  morning: {
    sunElev: 27, sunAzim: 108,
    skyTop: 0x4d84c4, skyHorizon: 0xe8c9a4, skyGround: 0xb7a894,
    sunColor: 0xffe3b4, sunIntensity: 2.5, sunSize: 0.75,
    hemiSky: 0x9fc4ea, hemiGround: 0x6c6248, hemiIntensity: 0.85,
    fog: 0xcfd8d8, fogNear: 26, fogFar: 175,
    ambient: 0x8fa5b8, ambientIntensity: 0.28,
    stars: 0, moon: 0.15, exposure: 1.02, lamps: 0.35, bloom: 0.42,
  },
  day: {
    sunElev: 52, sunAzim: 148,
    skyTop: 0x3d7fd0, skyHorizon: 0xa8cbe8, skyGround: 0x9a9a8c,
    sunColor: 0xfff6e2, sunIntensity: 3.2, sunSize: 1.0,
    hemiSky: 0x9ec8f0, hemiGround: 0x6f7a54, hemiIntensity: 1.0,
    fog: 0xc3d6e2, fogNear: 40, fogFar: 230,
    ambient: 0xa8bccd, ambientIntensity: 0.32,
    stars: 0, moon: 0, exposure: 1.0, lamps: 0.15, bloom: 0.3,
  },
  golden: {
    sunElev: 15, sunAzim: 248,
    skyTop: 0x4a6baa, skyHorizon: 0xf5b069, skyGround: 0x7a5a42,
    sunColor: 0xffbe7a, sunIntensity: 3.6, sunSize: 1.1,
    hemiSky: 0xd6a077, hemiGround: 0x5a4835, hemiIntensity: 1.0,
    fog: 0xdca87c, fogNear: 30, fogFar: 195,
    ambient: 0x8d7f8e, ambientIntensity: 0.4,
    stars: 0, moon: 0.05, exposure: 1.06, lamps: 0.7, bloom: 0.6,
  },
  dusk: {
    sunElev: 2.5, sunAzim: 262,
    skyTop: 0x27396c, skyHorizon: 0xd87a52, skyGround: 0x3b3040,
    sunColor: 0xffa165, sunIntensity: 2.5, sunSize: 1.05,
    hemiSky: 0x8093bd, hemiGround: 0x483e4e, hemiIntensity: 0.95,
    fog: 0x6e6479, fogNear: 26, fogFar: 170,
    ambient: 0x6d7499, ambientIntensity: 0.46,
    stars: 0.12, moon: 0.35, exposure: 1.1, lamps: 0.95, bloom: 0.58,
  },
  night: {
    sunElev: -18, sunAzim: 280,
    skyTop: 0x081026, skyHorizon: 0x223354, skyGround: 0x0d1220,
    sunColor: 0x4a63a4, sunIntensity: 0.14, sunSize: 0.4,
    hemiSky: 0x445c93, hemiGround: 0x1c2233, hemiIntensity: 0.68,
    fog: 0x1b2740, fogNear: 16, fogFar: 125,
    ambient: 0x44598a, ambientIntensity: 0.46,
    stars: 1.0, moon: 1.0, exposure: 1.3, lamps: 1.0, bloom: 0.62,
  },
};

export const TIME_ORDER = ['morning', 'day', 'golden', 'dusk', 'night'];

const c = (hex) => new THREE.Color(hex);

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.uniforms = {
      topColor: { value: c(0x3f5f9e) },
      horizonColor: { value: c(0xf2a758) },
      groundColor: { value: c(0x6b4a38) },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
      sunColor: { value: c(0xffb066) },
      moonDir: { value: new THREE.Vector3(0, 0.6, 1) },
      sunSize: { value: 1.1 },
      starAmount: { value: 0 },
      moonAmount: { value: 0.05 },
      time: { value: 0 },
    };

    const skyGeo = new THREE.SphereGeometry(480, 32, 20);
    this.sky = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    // свет
    this.sun = new THREE.DirectionalLight(0xffb066, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = 52;
    this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 220;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.045;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8fa8d8, 0);
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0xc98f66, 0x4d3d2c, 0.6);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x7a6a80, 0.3);
    scene.add(this.ambient);

    scene.fog = new THREE.Fog(0xd9a06f, 22, 165);

    // облака
    this.clouds = this.makeClouds();
    scene.add(this.clouds);

    this.current = 'golden';
    this.target = 'golden';
    this.from = PRESETS.golden;
    this.to = PRESETS.golden;
    this.t = 1;
    this.duration = 2.6;
    this.apply(PRESETS.golden);
  }

  makeClouds() {
    const grp = new THREE.Group();
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = 256;
    const g = cnv.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const x = 60 + rnd() * 136, y = 110 + rnd() * 44, r = 22 + rnd() * 40;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,246,232,0.5)');
      grd.addColorStop(0.55, 'rgba(255,238,220,0.22)');
      grd.addColorStop(1, 'rgba(255,235,215,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprites = [];
    for (let i = 0; i < 13; i++) {
      const m = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
      });
      const s = new THREE.Sprite(m);
      const a = (i / 13) * Math.PI * 2 + rnd() * 0.6;
      const r = 150 + rnd() * 120;
      s.position.set(Math.cos(a) * r, 55 + rnd() * 40, Math.sin(a) * r);
      const sc = 48 + rnd() * 60;
      s.scale.set(sc, sc * 0.42, 1);
      s.userData.speed = 0.4 + rnd() * 0.7;
      grp.add(s);
      sprites.push(s);
    }
    grp.name = 'clouds';
    this.cloudSprites = sprites;
    return grp;
  }

  setTimeOfDay(name, instant = false) {
    if (!PRESETS[name] || name === this.target) return;
    if (instant) {
      this.from = PRESETS[name]; this.to = PRESETS[name];
      this.target = name; this.current = name; this.t = 1;
      this.apply(PRESETS[name]);
      return;
    }
    this.from = this.snapshot();
    this.to = PRESETS[name];
    this.target = name;
    this.t = 0;
  }

  cycle() {
    const i = TIME_ORDER.indexOf(this.target ?? this.current);
    this.setTimeOfDay(TIME_ORDER[(i + 1) % TIME_ORDER.length]);
  }

  snapshot() {
    const s = {};
    for (const k in this.to) s[k] = this.to[k];
    // промежуточные значения храним отдельно
    return s;
  }

  update(dt, focus) {
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      const e = this.t < 0.5 ? 2 * this.t * this.t : 1 - Math.pow(-2 * this.t + 2, 2) / 2;
      this.apply({
        ...this.to,
        sunElev: lerp(this.from.sunElev, this.to.sunElev, e),
        sunAzim: lerp(this.from.sunAzim, this.to.sunAzim, e),
        sunIntensity: lerp(this.from.sunIntensity, this.to.sunIntensity, e),
        sunSize: lerp(this.from.sunSize, this.to.sunSize, e),
        hemiIntensity: lerp(this.from.hemiIntensity, this.to.hemiIntensity, e),
        ambientIntensity: lerp(this.from.ambientIntensity, this.to.ambientIntensity, e),
        stars: lerp(this.from.stars, this.to.stars, e),
        moon: lerp(this.from.moon, this.to.moon, e),
        exposure: lerp(this.from.exposure, this.to.exposure, e),
        lamps: lerp(this.from.lamps, this.to.lamps, e),
        bloom: lerp(this.from.bloom, this.to.bloom, e),
      });
      if (this.t >= 1) this.current = this.target;
    }

    // движение солнца по небу (плавно)
    const az = THREE.MathUtils.degToRad(this.sunAzim);
    const el = THREE.MathUtils.degToRad(this.sunElev);
    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el),
    ).normalize();
    this.uniforms.sunDir.value.copy(dir);
    this.uniforms.moonDir.value.copy(dir).multiplyScalar(-1);
    this.uniforms.time.value += dt;

    const f = focus || new THREE.Vector3();
    this.sun.position.copy(f).addScaledVector(dir, 90);
    this.sun.target.position.copy(f);
    this.sun.target.updateMatrixWorld();
    this.moon.position.copy(f).addScaledVector(dir, -90);
    this.moon.target.position.copy(f);
    this.moon.target.updateMatrixWorld();

    // облака плывут и тускнеют к ночи
    const cloudAlpha = 0.38 * (1 - (this.stars ?? 0) * 0.72);
    for (const s of this.cloudSprites) {
      s.position.x += s.userData.speed * dt * 0.8;
      if (s.position.x > 260) s.position.x = -260;
      s.material.opacity = cloudAlpha;
      s.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x6a7a9e), (this.stars ?? 0) * 0.6);
    }
  }

  apply(p) {
    this.sunElev = p.sunElev; this.sunAzim = p.sunAzim;
    this.stars = p.stars; this.moonAmount = p.moon;
    this.uniforms.topColor.value.copy(c(p.skyTop));
    this.uniforms.horizonColor.value.copy(c(p.skyHorizon));
    this.uniforms.groundColor.value.copy(c(p.skyGround));
    this.uniforms.sunColor.value.copy(c(p.sunColor));
    this.uniforms.sunSize.value = p.sunSize;
    this.uniforms.starAmount.value = p.stars;
    this.uniforms.moonAmount.value = p.moon;

    this.sun.color.copy(c(p.sunColor));
    this.sun.intensity = p.sunIntensity;
    this.moon.intensity = p.moon * 0.85;
    this.hemi.color.copy(c(p.hemiSky));
    this.hemi.groundColor.copy(c(p.hemiGround));
    this.hemi.intensity = p.hemiIntensity;
    this.ambient.color.copy(c(p.ambient));
    this.ambient.intensity = p.ambientIntensity;

    this.scene.fog.color.copy(c(p.fog));
    this.scene.fog.near = p.fogNear;
    this.scene.fog.far = p.fogFar;
    this.scene.background = null;

    this.renderer.toneMappingExposure = p.exposure;
    this.lampBoost = p.lamps;
    this.bloomStrength = p.bloom;
    this.cloudOpacity = 0.28 + p.stars * 0.4;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
