import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 *  Геометрические помощники
 * ------------------------------------------------------------------ */

/** Пропорциональный тайлинг UV для параллелепипеда (текстура не «растягивается»). */
export function boxUV(geo, w, h, d, scale = 1) {
  const uv = geo.attributes.uv;
  const faces = [
    [d, h], [d, h], // +x, -x
    [w, d], [w, d], // +y, -y
    [w, h], [w, h], // +z, -z
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * su / scale, uv.getY(idx) * sv / scale);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function box(w, h, d, scale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  return scale ? boxUV(g, w, h, d, scale) : g;
}

export function cyl(rTop, rBottom, h, seg = 12, open = false, scale = 1) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
  if (scale) {
    const uv = g.attributes.uv;
    const circ = Math.PI * (rTop + rBottom);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / scale, uv.getY(i) * h / scale);
    uv.needsUpdate = true;
  }
  return g;
}

export function sphere(r, wSeg = 14, hSeg = 10) {
  return new THREE.SphereGeometry(r, wSeg, hSeg);
}

export function cone(r, h, seg = 10) {
  return new THREE.ConeGeometry(r, h, seg);
}

export function torus(r, tube, rSeg = 8, tSeg = 16) {
  return new THREE.TorusGeometry(r, tube, rSeg, tSeg);
}

export function plane(w, d) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Скаты двускатной крыши (без фронтонов). */
export function gableSlopes(w, d, h, scale = 1) {
  const hw = w / 2, hd = d / 2;
  const slopeLen = Math.sqrt(h * h + hd * hd);
  const pos = [], nor = [], uvs = [], idx = [];
  const push = (p, n, u, v) => { pos.push(p[0], p[1], p[2]); nor.push(n.x, n.y, n.z); uvs.push(u, v); };

  const slopeN = new THREE.Vector3(0, hd, -h).normalize();   // скат к -z
  const slopeS = new THREE.Vector3(0, hd, h).normalize();    // скат к +z

  // северный скат (-z)
  let base = 0;
  push([-hw, 0, -hd], slopeN, 0, 0);
  push([hw, 0, -hd], slopeN, w / scale, 0);
  push([hw, h, 0], slopeN, w / scale, slopeLen / scale);
  push([-hw, h, 0], slopeN, 0, slopeLen / scale);
  idx.push(base, base + 2, base + 1, base, base + 3, base + 2);

  // южный скат (+z)
  base = 4;
  push([-hw, 0, hd], slopeS, 0, 0);
  push([hw, 0, hd], slopeS, w / scale, 0);
  push([hw, h, 0], slopeS, w / scale, slopeLen / scale);
  push([-hw, h, 0], slopeS, 0, slopeLen / scale);
  idx.push(base, base + 1, base + 2, base, base + 3, base + 1);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Торцевые стенки (фронтоны) двускатной крыши.
 * roofD — полная глубина крыши вместе с выносом: фронтон растёт пятиугольником,
 * заполняя промежуток между стеной и скатом, поэтому на торцах нет щелей.
 */
export function gableEnds(w, d, h, scale = 1, roofD = null) {
  const hw = w / 2, hd = d / 2;
  const D = roofD ?? d;
  const yE = D > d + 1e-4 ? h * (1 - hd / (D / 2)) : 0;   // высота ската над краем стены
  const pos = [], nor = [], uvs = [], idx = [];
  const push = (p, n, u, v) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); uvs.push(u, v); };
  let base = 0;
  // западный
  push([-hw, 0, -hd], [-1, 0, 0], 0, 0);
  push([-hw, 0, hd], [-1, 0, 0], d / scale, 0);
  if (yE > 0) {
    push([-hw, yE, hd], [-1, 0, 0], d / scale, yE / scale);
    push([-hw, h, 0], [-1, 0, 0], d / 2 / scale, h / scale);
    push([-hw, yE, -hd], [-1, 0, 0], 0, yE / scale);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 3, base + 4);
  } else {
    push([-hw, h, 0], [-1, 0, 0], d / scale, h / scale);
    idx.push(base, base + 1, base + 2);
  }
  // восточный
  base = yE > 0 ? 5 : 3;
  push([hw, 0, -hd], [1, 0, 0], 0, 0);
  push([hw, 0, hd], [1, 0, 0], d / scale, 0);
  if (yE > 0) {
    push([hw, yE, hd], [1, 0, 0], d / scale, yE / scale);
    push([hw, h, 0], [1, 0, 0], d / 2 / scale, h / scale);
    push([hw, yE, -hd], [1, 0, 0], 0, yE / scale);
    idx.push(base, base + 2, base + 1, base, base + 3, base + 2, base, base + 4, base + 3);
  } else {
    push([hw, h, 0], [1, 0, 0], d / scale, h / scale);
    idx.push(base, base + 2, base + 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/**
 * Крыша цельной оболочкой: внешние скаты, внутренний потолок и торцы.
 *
 * Раньше крыша собиралась из отдельных плоскостей (скаты + плоский потолок +
 * внутренний фронтон). Потолок лежал в 2 см от ската, а внутренний фронтон —
 * в одной плоскости со стеной: из-за этого крыша мерцала (z-fighting) и
 * «просвечивала». Теперь все поверхности разнесены по толщине (th):
 *   outer — внешние скаты (кровельный материал)
 *   inner — те же скаты, сдвинутые вниз на th (дощатый потолок)
 *   edges — карнизные и фронтонные торцы (толщина кровли)
 * Совпадающих плоскостей нет — значит, нет и мерцания.
 */
export function roofShell(w, d, h, opts = {}) {
  const overhang = opts.overhang ?? 0.4;
  const th = opts.thickness ?? 0.24;
  const scale = opts.scale ?? 1.7;
  const W = w + overhang * 2, D = d + overhang * 2;
  const hw = W / 2, hd = D / 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const quad = (p, n, uvs) => {
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i < 4; i++) {
      pos.push(p[i].x, p[i].y, p[i].z);
      nor.push(n.x, n.y, n.z);
      uv.push(uvs[i][0], uvs[i][1]);
    }
    // витой обход, как в gableSlopes: треугольник смотрит наружу по нормали
    idx.push(0, 2, 1, 0, 3, 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  };

  const nN = new THREE.Vector3(0, hd, -h).normalize();   // скат к -z
  const nS = new THREE.Vector3(0, hd, h).normalize();    // скат к +z
  const slopeLen = Math.hypot(h, hd);

  // внешние скаты
  const oN = [V(-hw, 0, -hd), V(hw, 0, -hd), V(hw, h, 0), V(-hw, h, 0)];
  const oS = [V(-hw, h, 0), V(hw, h, 0), V(hw, 0, hd), V(-hw, 0, hd)];   // порядок — наружу
  // внутренние — те же плоскости, опущенные на толщину кровли
  const iN = oN.map((p) => V(p.x, p.y - th, p.z));
  const iS = oS.map((p) => V(p.x, p.y - th, p.z));

  const uvSlope = [[0, 0], [W / scale, 0], [W / scale, slopeLen / scale], [0, slopeLen / scale]];
  const uvThin = (len) => [[0, 0], [W / scale, 0], [W / scale, len / scale], [0, len / scale]];
  const uvEdge = (len) => [[0, 0], [th / scale, 0], [th / scale, len / scale], [0, len / scale]];

  const outer = [
    quad(oN, nN, uvSlope),
    quad(oS, nS, uvSlope),
  ];
  const inner = [
    quad(iN, nN, uvSlope),
    quad(iS, nS, uvSlope),
  ];
  // торцы: карнизные (по z) и фронтонные (по x) — ими задаётся толщина крыши
  const edges = [
    // карнизные торцы (по z)
    quad([oN[1], oN[0], iN[0], iN[1]], new THREE.Vector3(0, 0, -1), uvThin(th)),
    quad([oS[3], oS[2], iS[2], iS[3]], new THREE.Vector3(0, 0, 1), uvThin(th)),
    // фронтонные торцы (по x) — от карниза к коньку
    quad([oN[3], iN[3], iN[0], oN[0]], new THREE.Vector3(-1, 0, 0), uvEdge(slopeLen)),
    quad([oS[3], iS[3], iN[3], oN[3]], new THREE.Vector3(-1, 0, 0), uvEdge(slopeLen)),
    quad([oS[1], iS[1], iS[2], oS[2]], new THREE.Vector3(1, 0, 0), uvEdge(slopeLen)),
    quad([oN[1], iN[1], iS[1], oS[1]], new THREE.Vector3(1, 0, 0), uvEdge(slopeLen)),
  ];
  return { outer, inner, edges, W, D, slopeLen };
}

/** Четырёхскатная (вальмовая) крыша: усечённая пирамида. */
export function hipRoof(w, d, h, ridgeFrac = 0.45, scale = 1) {
  const hw = w / 2, hd = d / 2;
  const rw = (w * ridgeFrac) / 2, rd = d * 0.08;
  const pos = [], nor = [], uvs = [], idx = [];
  const P = {
    a: [-hw, 0, -hd], b: [hw, 0, -hd], c: [hw, 0, hd], d: [-hw, 0, hd],
    e: [-rw, h, -rd], f: [rw, h, -rd], g: [rw, h, rd], i: [-rw, h, rd],
  };
  const quad = (p1, p2, p3, p4, u1, v1, u2, v2) => {
    const n = new THREE.Vector3().subVectors(new THREE.Vector3(...p2), new THREE.Vector3(...p1))
      .cross(new THREE.Vector3().subVectors(new THREE.Vector3(...p3), new THREE.Vector3(...p1))).normalize();
    const base = pos.length / 3;
    [p1, p2, p3, p4].forEach((p, k) => {
      pos.push(p[0], p[1], p[2]); nor.push(n.x, n.y, n.z);
      uvs.push(k === 0 || k === 3 ? u1 : u2, k < 2 ? v1 : v2);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad(P.a, P.b, P.f, P.e, 0, 0, w / scale, 1);      // северный скат
  quad(P.d, P.c, P.g, P.i, 0, 0, w / scale, 1);      // южный скат
  quad(P.c, P.b, P.f, P.g, 0, 0, d / scale, 1);      // восточный скат
  quad(P.a, P.d, P.i, P.e, 0, 0, d / scale, 1);      // западный скат
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/* ------------------------------------------------------------------ *
 *  Builder — копит геометрию по материалам и мержит в меши
 * ------------------------------------------------------------------ */
export class Builder {
  constructor() { this.buckets = new Map(); }

  add(geo, matKey, matrix = null) {
    if (!geo) return this;
    const g = matrix ? geo.clone().applyMatrix4(matrix) : geo;
    if (!this.buckets.has(matKey)) this.buckets.set(matKey, []);
    this.buckets.get(matKey).push(g);
    return this;
  }

  /** box(w,h,d) с центром в (x,y,z) */
  put(matKey, w, h, d, x, y, z, scale = 1, rot = null) {
    const g = box(w, h, d, scale);
    const m = new THREE.Matrix4();
    if (rot) m.makeRotationFromEuler(new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0));
    m.setPosition(x, y, z);
    return this.add(g, matKey, m);
  }

  build(materials, parent, opts = {}) {
    const { castShadow = true, receiveShadow = true, name = 'chunk' } = opts;
    const group = new THREE.Group();
    group.name = name;
    for (const [key, list] of this.buckets) {
      const mat = materials[key];
      if (!mat) { console.warn('Нет материала', key); continue; }
      let merged;
      try {
        merged = mergeGeometries(list, false);
      } catch (e) {
        merged = null;
      }
      if (!merged) {
        list.forEach((g) => {
          const mesh = new THREE.Mesh(g, mat);
          mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
          group.add(mesh);
        });
        continue;
      }
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    if (parent) parent.add(group);
    return group;
  }
}

/** Матрица позиционирования. */
export function mat(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(s, s, s),
  );
  return m;
}
