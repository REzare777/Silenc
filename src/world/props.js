import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, box, cyl, sphere, cone, torus, mat, plane } from './geo.js';

/* ------------------------------------------------------------------ *
 *  Мелкие элементы мира
 * ------------------------------------------------------------------ */

/* ---------- мягкое свечение (спрайт) ---------- */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,225,170,1)');
  grd.addColorStop(0.25, 'rgba(255,183,96,0.55)');
  grd.addColorStop(0.6, 'rgba(255,140,60,0.14)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Табличка с надписью — доска с текстом (например «ДЛЯ ПЕРСОНАЛА»).
 *
 * @param {string} text надпись
 * @param {object} [opts] оформление: w, h, bg, color, size, border
 * @returns {THREE.CanvasTexture|null} текстура (null вне браузера)
 */
export function signTexture(text, opts = {}) {
  if (typeof document === 'undefined') return null;
  const w = opts.w ?? 512, h = opts.h ?? 128;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  // тёмное дерево
  c.fillStyle = opts.bg ?? '#2b1d12';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.28)';
  c.lineWidth = 3;
  for (let i = 1; i < 5; i++) {
    c.beginPath();
    c.moveTo(0, (h / 5) * i);
    c.lineTo(w, (h / 5) * i);
    c.stroke();
  }
  // рамка
  c.strokeStyle = opts.border ?? '#6b4a28';
  c.lineWidth = 9;
  c.strokeRect(5, 5, w - 10, h - 10);
  // надпись
  c.font = `bold ${opts.size ?? Math.round(h * 0.42)}px Georgia, "Times New Roman", serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = 'rgba(0,0,0,0.55)';
  c.fillText(text, w / 2 + 2, h / 2 + 3);
  c.fillStyle = opts.color ?? '#e6d3a4';
  c.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Готовая табличка-меш с надписью.
 *
 * @param {string} text надпись
 * @param {number} w ширина таблички, м
 * @param {number} h высота таблички, м
 * @param {object} [opts] оформление (см. signTexture)
 * @returns {THREE.Mesh|null}
 */
export function signMesh(text, w = 1.3, h = 0.33, opts = {}) {
  const tex = signTexture(text, opts);
  if (!tex) return null;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.name = 'sign';
  return mesh;
}

export function makeGlow(tex, size = 2.4, color = 0xffb45a, opacity = 0.85) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

/* ---------- деревья (сливаются в общие меши) ---------- */
export function forest(M, placements) {
  const B = new Builder();
  const rng = mulberry(20241117);
  for (const p of placements) {
    const s = p.s ?? 1;
    const type = p.type ?? 'oak';
    const m = mat(p.x, 0, p.z, p.ry ?? rng() * Math.PI * 2, 0, 0, s);
    if (type === 'pine') {
      B.add(cyl(0.16, 0.3, 3.2, 7), 'timber', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 1.6, 0)));
      for (let i = 0; i < 3; i++) {
        const t = 1 - i * 0.26;
        const c = cone(1.5 * t, 2.1 * t, 8);
        const mm = m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 2.6 + i * 1.35, 0));
        B.add(c, 'leafPine', mm);
      }
    } else if (type === 'birch') {
      B.add(cyl(0.14, 0.2, 4.4, 7), 'plank', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 2.2, 0)));
      const blobs = [[0, 4.7, 0, 1.5], [0.85, 4.2, 0.3, 1.05], [-0.75, 4.4, -0.4, 1.0], [0.2, 5.5, 0.5, 0.85]];
      for (const [bx, by, bz, r] of blobs) {
        B.add(sphere(r, 6, 4), 'leafPine', m.clone().multiply(new THREE.Matrix4().makeTranslation(bx, by, bz)));
      }
    } else {
      const h = 2.4 + rng() * 0.9;
      B.add(cyl(0.22, 0.42, h, 7), 'timber', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h / 2, 0)));
      const blobs = [[0, h + 1.15, 0, 1.75], [1.15, h + 0.55, 0.35, 1.15], [-1.0, h + 0.7, -0.45, 1.2], [0.2, h + 2.1, -0.2, 1.05]];
      for (const [bx, by, bz, r] of blobs) {
        const key = p.autumn ? 'leafAutumn' : 'leaf';
        B.add(sphere(r, 6, 4), key, m.clone().multiply(new THREE.Matrix4().makeTranslation(bx, by, bz)));
      }
    }
  }
  return B.build(M, null, { name: 'forest', castShadow: true, receiveShadow: true });
}

/* ---------- трава-кустики и цветы (инстансы) ---------- */
export function scatterGrass(M, spots, count = 900) {
  const geo = cone(0.075, 0.26, 4);
  geo.translate(0, 0.13, 0);
  geo.scale(1, 0.8, 1);
  const mesh = new THREE.InstancedMesh(geo, M.foliageInstanced, count);
  const dummy = new THREE.Object3D();
  const rng = mulberry(77);
  for (let i = 0; i < count; i++) {
    const s = spots[i % spots.length];
    const a = rng() * Math.PI * 2, r = rng() * s.r;
    dummy.position.set(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.scale.setScalar(0.55 + rng() * 0.55);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = 'grassTufts';
  return mesh;
}

export function scatterFlowers(M, spots, perKind = 90) {
  const group = new THREE.Group();
  const kinds = [
    { mat: M.flowerWhite, c: 0xf7f0dc },
    { mat: M.flowerYellow, c: 0xf2c744 },
    { mat: M.flowerViolet, c: 0xa98ad0 },
  ];
  const rng = mulberry(913);
  // Цветок, а не квадратик: пять лепестков, стебель и сердцевина.
  // Раньше это был плоский квад, и с высоты он читался как цветной артефакт.
  const petalParts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.PlaneGeometry(0.075, 0.12);
    p.rotateX(-Math.PI / 2);
    p.rotateY(-a);
    p.translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    petalParts.push(p);
  }
  const core = new THREE.CircleGeometry(0.028, 6);
  core.rotateX(-Math.PI / 2);
  core.translate(0, 0.004, 0);
  petalParts.push(core);
  const petal = mergeGeometries(petalParts, false);
  const stemGeo = cyl(0.01, 0.014, 0.22, 4);
  stemGeo.translate(0, 0.11, 0);
  const flowerGeo = mergeGeometries([petal.clone().translate(0, 0.22, 0), stemGeo], false);
  kinds.forEach((k, ki) => {
    const inst = new THREE.InstancedMesh(flowerGeo, k.mat, perKind);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color(k.c);
    for (let i = 0; i < perKind; i++) {
      const s = spots[(i * 3 + ki) % spots.length];
      const a = rng() * Math.PI * 2, r = rng() * s.r;
      dummy.position.set(s.x + Math.cos(a) * r, 0, s.z + Math.sin(a) * r);
      dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3);
      dummy.scale.setScalar(0.8 + rng() * 0.6);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  });
  group.name = 'flowers';
  return group;
}

/* ---------- поле пшеницы ---------- */
export function wheatField(M, x, z, w, d, rows = 26) {
  const group = new THREE.Group();
  const stalk = new THREE.PlaneGeometry(0.12, 1.25);
  stalk.translate(0, 0.62, 0);
  const head = new THREE.PlaneGeometry(0.13, 0.3);
  head.translate(0, 1.32, 0);
  const merged = mergeTwo(stalk, head);
  const cols = Math.round(rows * (w / d));
  // столько колосков, сколько мест в решётке: иначе поле зарастает
  // только на треть и остаётся голая земля
  const count = rows * cols;
  const inst = new THREE.InstancedMesh(merged, M.wheat, count);
  const dummy = new THREE.Object3D();
  const rng = mulberry(5150);
  for (let i = 0; i < count; i++) {
    const cx = (i % cols) + 0.5, cz = Math.floor(i / cols) + 0.5;
    dummy.position.set(x + (cx / cols - 0.5) * w, 0, z + (cz / rows - 0.5) * d);
    dummy.rotation.set((rng() - 0.5) * 0.18, rng() * Math.PI, (rng() - 0.5) * 0.18);
    dummy.scale.setScalar(0.9 + rng() * 0.35);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.name = 'wheat';
  group.add(inst);
  return group;
}

function mergeTwo(a, b) {
  const pos = new Float32Array(a.attributes.position.array.length + b.attributes.position.array.length);
  const nor = new Float32Array(pos.length);
  const uv = new Float32Array((pos.length / 3) * 2);
  pos.set(a.attributes.position.array, 0);
  pos.set(b.attributes.position.array, a.attributes.position.array.length);
  nor.set(a.attributes.normal.array, 0);
  nor.set(b.attributes.normal.array, a.attributes.normal.array.length);
  uv.set(a.attributes.uv.array, 0);
  uv.set(b.attributes.uv.array, a.attributes.uv.array.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (const geo of [a, b]) {
    const off = geo === a ? 0 : a.attributes.position.count;
    const c = geo.attributes.position.count;
    for (let i = 0; i < c; i++) idx.push(i + off);
  }
  g.setIndex(idx);
  return g;
}

/* ---------- фонарь ---------- */
export function lantern(M, glowTex, opts = {}) {
  const { x = 0, z = 0, height = 3.2, lit = true, color = 0xffb45a, intensity = 2.4, distance = 14 } = opts;
  const B = new Builder();
  B.put('timber', 0.16, height, 0.16, 0, height / 2, 0);
  B.put('stone', 0.5, 0.25, 0.5, 0, 0.12, 0);
  B.put('iron', 0.5, 0.09, 0.5, 0, height + 0.02, 0);
  // коробочка фонаря
  B.put('iron', 0.44, 0.06, 0.44, 0, height + 0.09, 0);
  B.put('iron', 0.44, 0.06, 0.44, 0, height + 0.62, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.put('iron', 0.05, 0.56, 0.05, sx * 0.2, height + 0.35, sz * 0.2);
  }
  B.add(cone(0.34, 0.3, 4), 'iron', mat(0, height + 0.78, 0, Math.PI / 4));
  B.add(torus(0.07, 0.02, 5, 10), 'iron', mat(0, height + 0.96, 0, 0, Math.PI / 2));

  const group = B.build(M, null, { name: 'lantern' });
  const glass = new THREE.Mesh(box(0.3, 0.5, 0.3, 1), M.lampGlass);
  glass.position.y = height + 0.35;
  group.add(glass);
  const flame = new THREE.Mesh(sphere(0.08, 8, 6), M.ember);
  flame.position.y = height + 0.32;
  group.add(flame);

  const glow = makeGlow(glowTex, 2.1, 0xffd9a0, lit ? 0.55 : 0);
  glow.position.set(0, height + 0.35, 0);
  group.add(glow);

  const out = {
    group, glow, glass, flame, lit, baseIntensity: intensity, distance,
    flicker: Math.random() * 10, power: 1, pos: new THREE.Vector3(),
  };
  out.place = (px, pz, ry = 0) => {
    group.position.set(px, 0, pz);
    group.rotation.y = ry;
    out.pos.set(px, height + 0.35, pz);
    return out;
  };
  out.setLit = (v) => {
    out.lit = v;
    glow.material.opacity = v ? 0.55 : 0;
    glass.material = v ? M.lampGlass : M.windowDark;
  };
  return out;
}

/* ---------- костёр ---------- */
export function campfire(M, glowTex) {
  const B = new Builder();
  const rng = mulberry(4242);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    B.add(sphere(0.19 + rng() * 0.07, 6, 5), 'stone',
      mat(Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75, rng() * 3, 0, 0, 1));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    B.add(cyl(0.07, 0.09, 1.1, 6), 'timber',
      mat(Math.cos(a) * 0.18, 0.42, Math.sin(a) * 0.18, 0, 0, 0.5, 1));
  }
  const group = B.build(M, null, { name: 'campfire' });
  const flame = new THREE.Group();
  const f1 = new THREE.Mesh(cone(0.36, 1.1, 6), M.ember);
  f1.position.y = 0.62;
  const f2 = new THREE.Mesh(cone(0.2, 0.7, 5), new THREE.MeshStandardMaterial({
    color: 0xffd27a, emissive: 0xffbb44, emissiveIntensity: 3.2, roughness: 0.9,
  }));
  f2.position.y = 0.48;
  flame.add(f1, f2);
  group.add(flame);
  const light = new THREE.PointLight(0xff8a33, 3.2, 13, 2);
  light.position.y = 0.9;
  group.add(light);
  const glow = makeGlow(glowTex, 3.0, 0xffa050, 0.6);
  glow.position.y = 0.8;
  group.add(glow);
  return { group, flame, light, glow, flicker: Math.random() * 10 };
}

/* ---------- бочки, ящики, поленница ---------- */
export function clutter(M, items) {
  const B = new Builder();
  const rng = mulberry(31337);
  for (const it of items) {
    const m = mat(it.x, 0, it.z, it.ry ?? rng() * Math.PI, 0, 0, it.s ?? 1);
    if (it.t === 'barrel') {
      const r = 0.36, h = 0.86;
      B.add(cyl(r, r * 0.88, h, 12), 'plank', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h / 2, 0)));
      B.add(cyl(r * 0.94, r * 0.94, 0.07, 12), 'iron', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h * 0.2, 0)));
      B.add(cyl(r * 0.92, r * 0.92, 0.07, 12), 'iron', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h * 0.8, 0)));
      B.add(cyl(r * 0.86, r * 0.86, 0.05, 12), 'plank', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h + 0.02, 0)));
    } else if (it.t === 'crate') {
      const s = 0.66;
      B.add(box(s, s, s, 1), 'plank', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, s / 2, 0)));
      B.add(box(s + 0.03, 0.07, s + 0.03, 1), 'timber', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, s * 0.2, 0)));
      B.add(box(s + 0.03, 0.07, s + 0.03, 1), 'timber', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, s * 0.8, 0)));
    } else if (it.t === 'logs') {
      for (let i = 0; i < 7; i++) {
        const row = Math.floor(i / 3), col = i % 3;
        B.add(cyl(0.13, 0.13, 1.1, 7), 'timber',
          m.clone().multiply(new THREE.Matrix4().makeTranslation((col - 1) * 0.28, 0.14 + row * 0.26, 0))
            .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)));
      }
    } else if (it.t === 'sack') {
      B.add(sphere(0.3, 8, 6), 'cloth', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.28, 0)));
      B.add(cyl(0.12, 0.16, 0.16, 7), 'cloth', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.55, 0)));
    } else if (it.t === 'bucket') {
      B.add(cyl(0.2, 0.16, 0.3, 9), 'plank', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0)));
      B.add(torus(0.2, 0.02, 5, 10), 'iron', m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.3, 0, 0, 0, Math.PI / 2)));
    }
  }
  return B.build(M, null, { name: 'clutter' });
}

/* ---------- забор ---------- */
export function fence(M, segments) {
  const B = new Builder();
  for (const seg of segments) {
    const [a, b] = seg;
    const x1 = a[0], z1 = a[1], x2 = b[0], z2 = b[1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (!Number.isFinite(len) || len < 0.01) continue;
    const ang = Math.atan2(dx, dz);
    const n = Math.max(1, Math.round(len / 2.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = x1 + dx * t, pz = z1 + dz * t;
      B.add(box(0.14, 1.25, 0.14, 1), 'timber', mat(px, 0.62, pz, ang));
    }
    // продольные брусья
    for (const y of [0.45, 0.95]) {
      const mid = mat((x1 + x2) / 2, y, (z1 + z2) / 2, ang);
      B.add(box(0.09, 0.12, len, 1), 'timber', mid);
    }
  }
  return B.build(M, null, { name: 'fence' });
}

/* ---------- калитка (открытая створка) ---------- */
export function gate(M, opts = {}) {
  const { x = 0, z = 0, ang = 0, w = 1.7 } = opts;
  const B = new Builder();
  const open = 1.15;                       // на сколько створка открыта
  const a = ang + open;
  const hx = x + Math.sin(a) * 0, hz = z;
  // створка, отложенная от проёма
  const cx = hx + Math.cos(a) * w * 0.5, cz = hz + Math.sin(a) * w * 0.5;
  B.add(box(w, 0.12, 0.1, 1), 'timber', mat(cx, 0.5, cz, a + Math.PI / 2));
  B.add(box(w, 0.12, 0.1, 1), 'timber', mat(cx, 0.95, cz, a + Math.PI / 2));
  B.add(box(0.1, 1.15, 0.1, 1), 'timber', mat(hx, 0.6, hz, 0));
  return B.build(M, null, { name: 'gate' });
}

/* ---------- телега ---------- */
export function cart(M, opts = {}) {
  const { x = 0, z = 0, ry = 0 } = opts;
  const B = new Builder();
  // кузов: дно, борта, передний щит
  B.put('plank', 2.6, 0.18, 1.4, 0, 0.85, 0);
  for (const sz of [-1, 1]) B.put('plank', 2.6, 0.5, 0.1, 0, 1.1, sz * 0.68);
  B.put('plank', 0.1, 0.5, 1.4, -1.28, 1.1, 0);
  B.put('plank', 0.1, 0.5, 1.4, 1.28, 1.1, 0);
  // крепление и ободья
  B.put('timber', 0.14, 0.14, 1.5, 0, 0.8, 0);
  for (const sx of [-1, 1]) B.put('timber', 0.12, 0.12, 1.44, sx * 1.2, 1.05, 0);
  // груз: мешки и ящик — телега выглядит рабочей, а не брошенной
  B.put('cloth', 0.62, 0.5, 0.52, -0.55, 1.2, 0.22);
  B.put('cloth', 0.55, 0.44, 0.48, -0.5, 1.6, -0.2);
  B.put('cloth', 0.58, 0.46, 0.5, 0.45, 1.18, -0.25);
  B.put('plank', 0.8, 0.42, 0.72, 0.62, 1.2, 0.28);
  const group = new THREE.Group();
  const base = B.build(M, null, { name: 'cartBase' });
  group.add(base);
  // колёса: обод со спицами и ступица на оси
  for (const sz of [-1, 1]) {
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(torus(0.62, 0.07, 6, 16), M.timber);
    rim.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(cyl(0.12, 0.12, 0.2, 8), M.timber);
    hub.rotation.x = Math.PI / 2;                 // ось колеса вдоль Z
    wheel.add(rim, hub);
    const spokeG = box(0.05, 1.2, 0.05, 1);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(spokeG, M.timber);
      sp.rotation.x = (i * Math.PI) / 6;
      wheel.add(sp);
    }
    wheel.position.set(0.1, 0.62, sz * 0.72);
    wheel.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(wheel);
  }
  // оглобли: тянутся вперёд по оси X, слегка вверх
  for (const sz of [-1, 1]) {
    const shaft = new THREE.Mesh(box(1.9, 0.11, 0.11, 1), M.timber);
    shaft.position.set(-2.15, 0.72, sz * 0.42);
    shaft.rotation.z = 0.06;
    shaft.castShadow = true;
    group.add(shaft);
    // кобыла — деревянная головка на конце оглобли
    const yoke = new THREE.Mesh(box(0.34, 0.14, 0.14, 1), M.timber);
    yoke.position.set(-3.05, 0.78, sz * 0.42);
    yoke.castShadow = true;
    group.add(yoke);
  }
  group.position.set(x, 0, z);
  group.rotation.y = ry;
  return group;
}

/* ---------- поилка ---------- */
export function trough(M, opts = {}) {
  const { x = 0, z = 0, ry = 0 } = opts;
  const B = new Builder();
  B.put('plank', 2.4, 0.5, 0.9, 0, 0.25, 0);
  B.put('dark', 2.2, 0.12, 0.72, 0, 0.44, 0);
  B.put('timber', 0.16, 0.5, 0.16, -1.05, 0.25, 0.4);
  B.put('timber', 0.16, 0.5, 0.16, 1.05, 0.25, 0.4);
  const group = B.build(M, null, { name: 'trough' });
  group.position.set(x, 0, z); group.rotation.y = ry;
  return group;
}

/* ---------- указатель ---------- */
export function signpost(M, opts = {}) {
  const { x = 0, z = 0, ry = 0, text = '' } = opts;
  const B = new Builder();
  B.put('timber', 0.16, 2.6, 0.16, 0, 1.3, 0);
  B.add(box(1.5, 0.42, 0.09, 1), 'plank', mat(0, 2.25, 0.1, 0.12));
  B.add(box(1.1, 0.34, 0.09, 1), 'plank', mat(0, 1.75, -0.08, -0.14));
  const group = B.build(M, null, { name: 'sign' });
  group.position.set(x, 0, z); group.rotation.y = ry;
  return group;
}

/* ---------- детерминированный ГПСЧ ---------- */
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Удочка для рыбалки: рукоять, древко, катушка и леска.
 * Возвращает группу, у которой можно взять мировую точку «взвода»
 * (fishTip) — от неё уходит леска в воду.
 */
export function fishingRod(M, opts = {}) {
  const g = new THREE.Group();
  const len = opts.len ?? 2.6;

  // древко — тонкое, слегка изогнутое
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.032, len, 6),
    M.timberLight,
  );
  shaft.position.y = len / 2 - 0.2;
  shaft.castShadow = true;
  g.add(shaft);

  // рукоять
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.42, 7), M.timber);
  grip.position.y = 0.06;
  grip.castShadow = true;
  g.add(grip);

  // катушка с кольцом и ручкой
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 10), M.iron);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.075, 0.3, 0);
  reel.castShadow = true;
  g.add(reel);
  const spool = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 6, 12), M.brass);
  spool.rotation.y = Math.PI / 2;
  spool.position.set(0.075, 0.3, 0);
  g.add(spool);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), M.brass);
  knob.position.set(0.13, 0.22, 0.02);
  g.add(knob);

  // кольца на удочке
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 5, 9), M.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9 + i * 0.62;
    g.add(ring);
  }

  // леска свисает вертикально — её ставим в мир отдельно, по кончику удочки
  const tipY = len - 0.2;

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // точка, от которой идёт леска (кончик удочки)
  const tip = new THREE.Object3D();
  tip.position.set(0.05, tipY, 0.02);
  g.add(tip);
  g.userData.tip = tip;
  g.userData.tipY = tipY;
  return g;
}

/** Вертикальная леска от кончика удочки вниз (ставится в мир, а не в удочку). */
export function fishingLine(M, tip, len = 1.3) {
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, len, 4),
    M.rope,
  );
  line.position.set(tip.x, tip.y - len / 2, tip.z);
  line.castShadow = false;
  return line;
}

/* ---------- огородная грядка ---------- */
/**
 * Грядка: деревянный ящик с землёй и зелёными кустиками.
 *
 * Ставится во дворах между домами — чтобы пустое место между участками
 * выглядело огородом, а не вытоптанным лугом.
 *
 * @param {object} M набор материалов
 * @param {object} opts {w, d} — размеры грядки (длина вдоль X)
 * @returns {THREE.Group} группа грядки
 */
export function gardenBed(M, opts = {}) {
  const { w = 2.6, d = 1.2 } = opts;
  const B = new Builder();
  const wallH = 0.42;
  // доски ящика
  for (const sx of [-1, 1]) {
    B.add(box(0.12, wallH, d, 1), 'plank', mat(sx * (w / 2 - 0.06), wallH / 2, 0));
  }
  for (const sz of [-1, 1]) {
    B.add(box(w, wallH, 0.12, 1), 'plank', mat(0, wallH / 2, sz * (d / 2 - 0.06)));
  }
  // земля и кустики
  B.add(box(w - 0.3, 0.16, d - 0.3, 1), 'dirt', mat(0, wallH - 0.08, 0));
  const n = Math.max(3, Math.round(w / 0.75));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.45 + (i * (w - 0.9)) / Math.max(1, n - 1);
    for (const sz of [-1, 1]) {
      B.add(sphere(0.17, 6, 5), 'leaf',
        mat(x, wallH + 0.12, sz * (d / 2 - 0.3), 0, 0, 0, 0.85));
    }
  }
  return B.build(M, null, { name: 'gardenBed' });
}
