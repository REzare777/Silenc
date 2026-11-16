import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* ------------------------------------------------------------------ *
 *  Мягкое свечение (bloom): яркие зоны → размытие → добавление
 *  Собственная реализация: без смешивания в буфере, только шейдеры.
 * ------------------------------------------------------------------ */

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float soft = clamp(lum - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 0.0001);
  float bright = max(soft, lum - threshold);
  bright = max(bright, 0.0) / max(lum, 0.0001);
  gl_FragColor = vec4(max(c.rgb * bright, vec3(0.0)), 1.0);
}`;

const BLUR_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform vec2 dir;
varying vec2 vUv;
void main() {
  vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
  sum += texture2D(tDiffuse, vUv + dir * 1.3846153846) * 0.3162162162;
  sum += texture2D(tDiffuse, vUv - dir * 1.3846153846) * 0.3162162162;
  sum += texture2D(tDiffuse, vUv + dir * 3.2307692308) * 0.0702702703;
  sum += texture2D(tDiffuse, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = sum;
}`;

const COMPOSITE_FRAG = /* glsl */`
uniform sampler2D tDiffuse;
uniform sampler2D tBloom;
uniform float strength;
uniform vec3 tint;
varying vec2 vUv;
void main() {
  vec4 base = texture2D(tDiffuse, vUv);
  vec4 bl = texture2D(tBloom, vUv);
  gl_FragColor = vec4(base.rgb + bl.rgb * tint * strength, base.a);
}`;

export class SoftBloomPass extends Pass {
  constructor(width = 1024, height = 1024, strength = 0.62, threshold = 0.8) {
    super();
    this.needsSwap = true;
    this.strength = strength;
    this.threshold = threshold;

    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    for (const rt of [this.rtA, this.rtB]) {
      rt.texture.generateMipmaps = false;
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
    }

    this.brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: threshold },
        knee: { value: 0.35 },
      },
      vertexShader: VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tBloom: { value: null },
        strength: { value: strength },
        tint: { value: new THREE.Color(1.0, 0.92, 0.82) },
      },
      vertexShader: VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.fsQuad = new FullScreenQuad(this.brightMat);
    this.setSize(width, height);
  }

  setSize(width, height) {
    const w = Math.max(2, Math.floor(width / 2));
    const h = Math.max(2, Math.floor(height / 2));
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this._w = w; this._h = h;
  }

  render(renderer, writeBuffer, readBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    // 1. выделение ярких зон
    this.fsQuad.material = this.brightMat;
    this.brightMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.brightMat.uniforms.threshold.value = this.threshold;
    renderer.setRenderTarget(this.rtA);
    renderer.clear();
    this.fsQuad.render(renderer);

    // 2. два прохода размытия (узкое → широкое)
    this.fsQuad.material = this.blurMat;
    const px = 1 / this._w, py = 1 / this._h;
    for (let i = 0; i < 2; i++) {
      const spread = 1 + i * 2.2;
      this.blurMat.uniforms.tDiffuse.value = this.rtA.texture;
      this.blurMat.uniforms.dir.value.set(px * spread, 0);
      renderer.setRenderTarget(this.rtB);
      renderer.clear();
      this.fsQuad.render(renderer);

      this.blurMat.uniforms.tDiffuse.value = this.rtB.texture;
      this.blurMat.uniforms.dir.value.set(0, py * spread);
      renderer.setRenderTarget(this.rtA);
      renderer.clear();
      this.fsQuad.render(renderer);
    }

    // 3. сложение с исходным кадром
    this.fsQuad.material = this.compMat;
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.compMat.uniforms.tBloom.value = this.rtA.texture;
    this.compMat.uniforms.strength.value = this.strength;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.renderToScreen) renderer.clear();
    this.fsQuad.render(renderer);

    renderer.autoClear = oldAutoClear;
  }

  dispose() {
    this.rtA.dispose(); this.rtB.dispose();
    this.brightMat.dispose(); this.blurMat.dispose(); this.compMat.dispose();
    this.fsQuad.dispose();
  }
}
