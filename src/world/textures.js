import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Процедурные текстуры — всё рисуется на canvas, никаких внешних файлов
 * ------------------------------------------------------------------ */

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, seed = 1, oct = 4, lac = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 37);
    norm += amp;
    amp *= gain; freq *= lac;
  }
  return sum / norm;
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((lerp(ar, br, t) | 0) << 16) | ((lerp(ag, bg, t) | 0) << 8) | (lerp(ab, bb, t) | 0);
}

function tex(canvas, repeat = 1, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/* ---------- трава ---------- */
/**
 * Трава-газон. Палитра задаётся сезоном: зимой газон — серо-белый под снегом,
 * осенью — сухой жёлто-бурый. Оттенком зелёную текстуру в белую не превратить,
 * поэтому у каждого сезона своя палитра.
 */
function grassCanvas(size = 512, pal = {}) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const dark = pal.dark ?? 0x3c5a24;
  const mid = pal.mid ?? 0x597c31;
  const light = pal.light ?? 0x86a44a;
  const dry = pal.dry ?? 0x9a9a4e;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 26, y / 26, 11, 4);
      const n2 = fbm(x / 6.5, y / 6.5, 77, 3);
      const patch = fbm(x / 60, y / 60, 5, 3);
      let col = mixHex(dark, mid, clamp01(n * 1.5));
      col = mixHex(col, light, clamp01((n2 - 0.55) * 2.2));
      col = mixHex(col, dry, clamp01((patch - 0.62) * 1.6));
      const speck = hash2(x, y, 3) > 0.9955 ? 0.22 : 0;
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, ((col >> 16) & 255) + speck * 255);
      d[i + 1] = Math.min(255, ((col >> 8) & 255) + speck * 190);
      d[i + 2] = Math.min(255, (col & 255) + speck * 120);
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // редкие травинки
  g.globalAlpha = 0.35;
  for (let i = 0; i < 2600; i++) {
    const x = hash2(i, 7, 9) * size, y = hash2(i, 13, 4) * size;
    const l = 2 + hash2(i, 3, 1) * 4;
    g.strokeStyle = pal.blade
      ? pal.blade
      : (hash2(i, 21, 6) > 0.5 ? '#7d9b3f' : '#33501f');
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash2(i, 5, 2) - 0.5) * 2, y - l); g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

/* ---------- земляная дорога ---------- */
/**
 * Земляная дорога. Зимой (`snow` = true) она заснежена: тёмная утоптанная
 * колея посреди белого наста, а не ровная коричневая лента.
 */
function dirtCanvas(size = 512, snow = false) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  const a = snow ? 0x8a8378 : 0x6d5236;
  const b = snow ? 0xb9b4ab : 0x8a6a45;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 18, y / 18, 21, 4);
      const gr = fbm(x / 4, y / 4, 33, 2);
      let col = mixHex(a, b, clamp01(n * 1.25 - 0.1));
      const shade = (gr - 0.5) * 26;
      const i = (y * size + x) * 4;
      d[i] = clamp01(((col >> 16) & 255) / 255 + shade / 255) * 255;
      d[i + 1] = clamp01(((col >> 8) & 255) / 255 + shade / 255) * 255;
      d[i + 2] = clamp01((col & 255) / 255 + shade / 255) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // камешки
  for (let i = 0; i < 700; i++) {
    const x = hash2(i, 17, 8) * size, y = hash2(i, 23, 2) * size;
    const r = 0.6 + hash2(i, 29, 5) * 2.1;
    const v = 120 + Math.floor(hash2(i, 31, 3) * 70);
    g.fillStyle = `rgba(${v},${v - 12},${v - 26},0.75)`;
    g.beginPath(); g.ellipse(x, y, r, r * 0.72, hash2(i, 11, 7) * 3, 0, 7); g.fill();
  }
  if (snow) {
    // наст: белые наносы по краям полотна и редкие проплешины земли
    g.globalAlpha = 0.85;
    for (let i = 0; i < 420; i++) {
      const x = hash2(i, 41, 3) * size;
      const y = hash2(i, 43, 5) * size;
      const rx = 10 + hash2(i, 47, 7) * 46;
      const ry = rx * (0.28 + hash2(i, 53, 11) * 0.3);
      const grd = g.createRadialGradient(x, y, 0, x, y, rx);
      grd.addColorStop(0, 'rgba(246,250,255,0.95)');
      grd.addColorStop(1, 'rgba(246,250,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(x, y, rx, ry, hash2(i, 59, 13) * 3, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  return c;
}

/* ---------- булыжник ---------- */
function cobbleCanvas(size = 512, cells = 16, snow = false) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const rnd = (i, j, s) => hash2(i * 31 + j * 7, j * 17, s);
  g.fillStyle = snow ? '#8e949c' : '#4a443c'; g.fillRect(0, 0, size, size);
  const cell = size / cells;
  for (let j = -1; j < cells + 1; j++) {
    for (let i = -1; i < cells + 1; i++) {
      const jx = (rnd(i, j, 1) - 0.5) * cell * 0.8;
      const jy = (rnd(i, j, 2) - 0.5) * cell * 0.8;
      const cx = (i + 0.5) * cell + jx;
      const cy = (j + 0.5) * cell + jy;
      const rx = cell * (0.3 + rnd(i, j, 3) * 0.19);
      const ry = rx * (0.72 + rnd(i, j, 4) * 0.24);
      const v = snow ? (150 + rnd(i, j, 5) * 62) : (88 + rnd(i, j, 5) * 62);
      const warm = rnd(i, j, 7);
      g.save();
      g.translate(cx, cy);
      g.rotate((rnd(i, j, 6) - 0.5) * 1.3);
      g.fillStyle = `rgb(${(v * (1 + warm * 0.09)) | 0},${v | 0},${(v * (1.05 - warm * 0.09)) | 0})`;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,248,236,0.11)';
      g.beginPath(); g.ellipse(-rx * 0.18, -ry * 0.28, rx * 0.62, ry * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(28,22,16,0.16)';
      g.beginPath(); g.ellipse(rx * 0.22, ry * 0.3, rx * 0.55, ry * 0.45, 0, 0, 7); g.fill();
      g.restore();
    }
  }
  // мох между камнями
  g.globalAlpha = 0.24;
  for (let i = 0; i < 1100; i++) {
    const x = hash2(i, 41, 2) * size, y = hash2(i, 43, 3) * size;
    g.fillStyle = hash2(i, 47, 5) > 0.5 ? '#54682f' : '#38422a';
    g.fillRect(x, y, 1 + hash2(i, 51, 7) * 3, 1 + hash2(i, 53, 9) * 2);
  }
  g.globalAlpha = 1;
  return c;
}

/* ---------- штукатурка ---------- */
function plasterCanvas(size = 256, base = 0xd9c9ac, seed = 3) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 30, y / 30, seed, 4);
      const fine = fbm(x / 3.2, y / 3.2, seed + 13, 2);
      const k = 0.86 + n * 0.22 + (fine - 0.5) * 0.08;
      const i = (y * size + x) * 4;
      d[i] = clamp01((((base >> 16) & 255) / 255) * k) * 255;
      d[i + 1] = clamp01((((base >> 8) & 255) / 255) * k) * 255;
      d[i + 2] = clamp01(((base & 255) / 255) * k) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // трещины
  g.strokeStyle = 'rgba(90,72,54,0.20)'; g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    let x = hash2(i, 61, 3) * size, y = hash2(i, 67, 5) * size;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 12; s++) {
      x += (hash2(i, s, 7) - 0.5) * 26; y += (hash2(i, s, 9) - 0.5) * 26;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // потёки у низа
  const grd = g.createLinearGradient(0, size * 0.72, 0, size);
  grd.addColorStop(0, 'rgba(110,88,60,0)');
  grd.addColorStop(1, 'rgba(96,78,54,0.26)');
  g.fillStyle = grd; g.fillRect(0, size * 0.72, size, size * 0.28);
  return c;
}

/* ---------- дерево (брёвна) ---------- */
function woodCanvas(size = 256, base = 0x5a3d26, seed = 5) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ring = fbm(x / 40, y / 3.4, seed, 4);
      const grain = Math.sin((y / size) * 90 + ring * 12) * 0.5 + 0.5;
      const k = 0.72 + ring * 0.34 + grain * 0.16;
      const i = (y * size + x) * 4;
      d[i] = clamp01((((base >> 16) & 255) / 255) * k) * 255;
      d[i + 1] = clamp01((((base >> 8) & 255) / 255) * k) * 255;
      d[i + 2] = clamp01(((base & 255) / 255) * k) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- доски ---------- */
function plankCanvas(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const planks = 6, h = size / planks;
  for (let p = 0; p < planks; p++) {
    const v = 0.72 + hash2(p, 3, 5) * 0.4;
    const r = (118 * v) | 0, gg = (84 * v) | 0, b = (52 * v) | 0;
    g.fillStyle = `rgb(${r},${gg},${b})`;
    g.fillRect(0, p * h, size, h);
    g.globalAlpha = 0.25;
    for (let i = 0; i < 34; i++) {
      const y = p * h + hash2(i, p, 9) * h;
      g.strokeStyle = hash2(i, p, 11) > 0.5 ? '#3d2818' : '#a07a4f';
      g.lineWidth = 0.8 + hash2(i, p, 13) * 1.1;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= size; x += 32) g.lineTo(x, y + Math.sin(x / 40 + i) * 1.6);
      g.stroke();
    }
    g.globalAlpha = 1;
    // тень в зазоре
    const grd = g.createLinearGradient(0, p * h, 0, p * h + 5);
    grd.addColorStop(0, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, p * h, size, 5);
  }
  // гвозди
  g.fillStyle = 'rgba(40,32,26,0.65)';
  for (let p = 0; p < planks; p++)
    for (let i = 0; i < 4; i++)
      g.beginPath(), g.arc(size * (0.12 + i * 0.25), p * h + h * 0.5, 1.6, 0, 7), g.fill();
  return c;
}

/* ---------- солома (кровля) ---------- */
function thatchCanvas(size = 512) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 14, y / 5, 17, 4);
      const st = Math.sin(x * 0.9 + n * 6) * 0.5 + 0.5;
      const k = 0.68 + n * 0.3 + st * 0.24;
      const i = (y * size + x) * 4;
      d[i] = clamp01((0.72 * k)) * 255;
      d[i + 1] = clamp01((0.55 * k)) * 255;
      d[i + 2] = clamp01((0.28 * k)) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // соломинки
  for (let i = 0; i < 2200; i++) {
    const x = hash2(i, 71, 1) * size, y = hash2(i, 73, 2) * size;
    const l = 5 + hash2(i, 79, 4) * 16;
    const a = (hash2(i, 83, 6) - 0.5) * 0.5;
    g.strokeStyle = hash2(i, 89, 8) > 0.6 ? 'rgba(214,178,96,0.55)' : 'rgba(110,80,36,0.45)';
    g.lineWidth = 0.9 + hash2(i, 97, 10) * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l * 0.4, y + l); g.stroke();
  }
  // тёмные полосы у краёв (тень)
  const grd = g.createLinearGradient(0, 0, 0, size);
  grd.addColorStop(0, 'rgba(40,26,10,0.30)');
  grd.addColorStop(0.35, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(40,26,10,0.22)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return c;
}

/* ---------- черепица ---------- */
function tileCanvas(size = 512, base = 0x8e4632) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = `rgb(${((base >> 16) & 255) * 0.7 | 0},${((base >> 8) & 255) * 0.7 | 0},${(base & 255) * 0.7 | 0})`;
  g.fillRect(0, 0, size, size);
  const rows = 10, rh = size / rows, tw = size / 9;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * tw * 0.5;
    for (let i = -1; i < 10; i++) {
      const x = i * tw + off, y = r * rh;
      const v = 0.78 + hash2(i, r, 3) * 0.42;
      const rr = clamp01(((base >> 16) & 255) / 255 * v) * 255;
      const gg = clamp01(((base >> 8) & 255) / 255 * v) * 255;
      const bb = clamp01((base & 255) / 255 * v) * 255;
      g.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
      g.beginPath();
      g.moveTo(x + 1, y + rh);
      g.lineTo(x + 1, y + rh * 0.3);
      g.quadraticCurveTo(x + tw * 0.5, y - rh * 0.22, x + tw - 1, y + rh * 0.3);
      g.lineTo(x + tw - 1, y + rh);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(40,20,12,0.35)'; g.lineWidth = 1.2; g.stroke();
    }
  }
  // мох
  g.globalAlpha = 0.2;
  for (let i = 0; i < 240; i++) {
    const x = hash2(i, 101, 5) * size, y = hash2(i, 103, 7) * size;
    g.fillStyle = '#5c6b34';
    g.beginPath(); g.ellipse(x, y, 3 + hash2(i, 107, 9) * 9, 2 + hash2(i, 109, 11) * 5, 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

/* ---------- камень (цоколь, колоннада) ---------- */
/**
 * Порода пещеры: грубый камень с крапинами и трещинами.
 * Отдельная текстура, потому что кирпичная кладка смотрится в пещере
 * как заброшенный подвал, а не как скала.
 *
 * @param {number} size размер текстуры в пикселях
 * @returns {HTMLCanvasElement} готовая текстура
 */
function caveRockCanvas(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = '#3f4250';
  g.fillRect(0, 0, size, size);

  // ЩЕБЕНЬ: округлые камешки, обведённые тенью и подсвеченные сверху.
  // Раньше пол был «пятнами породы» — на растянутом на весь зал растре
  // это читалось как размытая грязь, а не как земля под ногами.
  const stones = 210;
  for (let i = 0; i < stones; i++) {
    const x = hash2(i, 211, 3) * size, y = hash2(i, 223, 5) * size;
    const r = 4 + hash2(i, 227, 7) * 9;
    const v = 62 + hash2(i, 229, 11) * 54;
    const tint = hash2(i, 233, 13);
    // тень под камнем
    g.fillStyle = 'rgba(18,20,28,0.45)';
    g.beginPath();
    g.ellipse(x + r * 0.16, y + r * 0.22, r * 1.04, r * 0.92, 0, 0, 6.3);
    g.fill();
    // сам камень
    g.fillStyle = `rgb(${(v * 0.98) | 0},${(v * 0.99) | 0},${(v * (1.04 + tint * 0.1)) | 0})`;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.72 + hash2(i, 239, 17) * 0.3), hash2(i, 241, 19) * 3, 0, 6.3);
    g.fill();
    // верхняя фаска — камешек блестит сверху
    g.fillStyle = 'rgba(190,200,220,0.20)';
    g.beginPath();
    g.ellipse(x - r * 0.18, y - r * 0.24, r * 0.52, r * 0.34, 0, 0, 6.3);
    g.fill();
  }

  // пыль и мелкий сор между камешками
  for (let i = 0; i < 700; i++) {
    const x = hash2(i, 277, 43) * size, y = hash2(i, 281, 47) * size;
    const v = hash2(i, 283, 53);
    g.fillStyle = v > 0.55 ? 'rgba(150,146,132,0.16)' : 'rgba(24,26,34,0.22)';
    g.fillRect(x, y, 1 + (v > 0.92 ? 1 : 0), 1 + (v > 0.88 ? 1 : 0));
  }

  // редкие трещины в сплошной породе
  g.strokeStyle = 'rgba(16,18,26,0.42)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = 0.7 + hash2(i, 251, 23) * 1.4;
    g.beginPath();
    let x = hash2(i, 257, 29) * size, y = hash2(i, 263, 31) * size;
    g.moveTo(x, y);
    const steps = 3 + Math.floor(hash2(i, 269, 37) * 4);
    for (let k = 0; k < steps; k++) {
      x += (hash2(i + k, 271, 41) - 0.5) * 40;
      y += (hash2(i + k, 277, 43) - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

/**
 * Кость: светлая тёплая поверхность с тёмными вкраплениями.
 *
 * @param {number} size размер текстуры
 * @returns {HTMLCanvasElement} текстура
 */
function boneCanvas(size = 64) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = '#e2d7ba';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = hash2(i, 313, 3) * size, y = hash2(i, 317, 5) * size;
    g.fillStyle = 'rgba(120,102,72,0.22)';
    g.fillRect(x, y, 1 + (hash2(i, 331, 7) > 0.8 ? 1 : 0), 1);
  }
  return c;
}

/**
 * Скала для СТЕН подземелья.
 *
 * Стена должна читаться как стена, а не как растр с рисунком: поэтому
 * порода собрана в крупные неровные камни, каждый обведён тенью в шов
 * и подсвечен сверху. Раньше здесь были мелкие грани — на стене в
 * семь метров высотой они сливались в шум, и зал читался как «синяя
 * коробка». Теперь это кладка: видно, где камень, а где шов.
 *
 * @param {number} size размер текстуры в пикселях
 * @returns {HTMLCanvasElement} готовая текстура
 */
function caveWallCanvas(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  // шов между камнями
  g.fillStyle = '#232634';
  g.fillRect(0, 0, size, size);

  const cols = 4, rows = 3;
  const cw = size / cols, ch = size / rows;
  for (let r = -1; r <= rows; r++) {
    // каждый ряд смещён — кладка вразбежку
    const off = (r % 2 ? 0.5 : 0) * cw + (r < 0 ? cw : 0);
    for (let i = -1; i <= cols; i++) {
      const bx = i * cw + off, by = r * ch;
      const jx = (hash2(i, r, 811) - 0.5) * cw * 0.1;
      const jy = (hash2(i, r, 823) - 0.5) * ch * 0.12;
      const pad = 2.2;
      const x = bx + pad + jx, y = by + pad + jy;
      const w = cw - pad * 2, h = ch - pad * 2;
      const v = 66 + hash2(i, r, 827) * 52;
      const cool = hash2(i, r, 829);
      // тень под камнем — камень стоит на шве
      g.fillStyle = 'rgba(10,11,17,0.5)';
      g.fillRect(x + 2, y + 3, w, h);
      // тело камня
      g.fillStyle = `rgb(${(v * 0.95) | 0},${(v * 0.99) | 0},${(v * (1.05 + cool * 0.16)) | 0})`;
      g.fillRect(x, y, w, h);
      // верхняя фаска — свет падает сверху
      g.fillStyle = 'rgba(196,208,232,0.16)';
      g.fillRect(x, y, w, 2);
      g.fillStyle = 'rgba(196,208,232,0.08)';
      g.fillRect(x, y, 2, h);
      // нижняя тень
      g.fillStyle = 'rgba(6,7,12,0.26)';
      g.fillRect(x, y + h - 2.5, w, 2.5);
      // сколы на гранях
      for (let k = 0; k < 7; k++) {
        const px = x + hash2(i * 13 + k, r, 839) * w;
        const py = y + hash2(i * 13 + k, r, 853) * h;
        const s = 1 + hash2(i * 13 + k, r, 857) * 3.4;
        g.fillStyle = hash2(i * 13 + k, r, 859) > 0.5
          ? 'rgba(214,226,250,0.10)' : 'rgba(8,9,15,0.20)';
        g.beginPath();
        g.ellipse(px, py, s, s * 0.7, hash2(i, r, 863) * 3, 0, 6.3);
        g.fill();
      }
    }
  }

  // тонкие трещины по швам
  g.strokeStyle = 'rgba(10,11,17,0.55)';
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 0.6 + hash2(i, 877, 29) * 1.2;
    g.beginPath();
    let x = hash2(i, 881, 31) * size, y = hash2(i, 887, 37) * size;
    g.moveTo(x, y);
    const steps = 3 + Math.floor(hash2(i, 893, 41) * 4);
    for (let k = 0; k < steps; k++) {
      x += (hash2(i + k, 907, 43) - 0.5) * 26;
      y += (hash2(i + k, 911, 47) - 0.5) * 26;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // крапины породы — мелкие и негромкие, иначе стена выглядит грязной
  for (let i = 0; i < 220; i++) {
    const x = hash2(i, 919, 53) * size, y = hash2(i, 929, 59) * size;
    const v = hash2(i, 937, 61);
    g.fillStyle = v > 0.6 ? 'rgba(126,132,156,0.08)' : 'rgba(24,26,36,0.10)';
    g.fillRect(x, y, 1 + (v > 0.94 ? 1 : 0), 1);
  }
  return c;
}

function stoneCanvas(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = '#6e6a63'; g.fillRect(0, 0, size, size);
  const rows = 6, rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * size / 8;
    for (let i = -1; i < 5; i++) {
      const x = i * (size / 4) + off, y = r * rh;
      const v = 108 + hash2(i, r, 9) * 70;
      g.fillStyle = `rgb(${v | 0},${(v * 0.98) | 0},${(v * 0.92) | 0})`;
      g.fillRect(x + 2, y + 2, size / 4 - 4, rh - 4);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x + 2, y + 2, size / 4 - 4, 2);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x + 2, y + rh - 5, size / 4 - 4, 3);
    }
  }
  // мох
  g.globalAlpha = 0.24;
  for (let i = 0; i < 200; i++) {
    const x = hash2(i, 111, 3) * size, y = hash2(i, 113, 5) * size;
    g.fillStyle = hash2(i, 117, 7) > 0.5 ? '#566b31' : '#3d4426';
    g.beginPath(); g.ellipse(x, y, 2 + hash2(i, 119, 9) * 8, 1 + hash2(i, 121, 11) * 4, 0, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

/* ---------- тёплое окно ---------- */
function windowCanvas(size = 128, warm = true) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = warm ? '#ffbe63' : '#1d1a17';
  g.fillRect(0, 0, size, size);
  const grd = g.createRadialGradient(size * 0.5, size * 0.55, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
  grd.addColorStop(0, warm ? 'rgba(255,236,190,1)' : 'rgba(60,60,70,1)');
  grd.addColorStop(1, warm ? 'rgba(255,168,66,1)' : 'rgba(18,18,24,1)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  g.strokeStyle = warm ? 'rgba(70,40,14,0.85)' : 'rgba(10,10,12,0.9)';
  g.lineWidth = size * 0.07;
  g.beginPath();
  g.moveTo(size / 2, 0); g.lineTo(size / 2, size);
  g.moveTo(0, size / 2); g.lineTo(size, size / 2);
  g.stroke();
  g.lineWidth = size * 0.1;
  g.strokeRect(size * 0.05, size * 0.05, size * 0.9, size * 0.9);
  return c;
}

/* ---------- ткань (навесы) ---------- */
function fabricCanvas(size = 128, a = '#a8453c', b = '#e3d3b4') {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, size, size);
  g.fillStyle = b;
  for (let i = 0; i < 4; i++) if (i % 2 === 0) g.fillRect(0, i * size / 4, size, size / 8);
  g.globalAlpha = 0.12;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = hash2(i, 131, 3) > 0.5 ? '#000' : '#fff';
    g.fillRect(hash2(i, 133, 5) * size, hash2(i, 137, 7) * size, 2, 2);
  }
  g.globalAlpha = 1;
  return c;
}

/* ---------- вода ---------- */
function waterCanvas(size = 256) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 22, y / 22, 61, 4);
      const n2 = Math.sin((x * 0.2 + n * 8)) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      d[i] = 62 + n * 26 + n2 * 14;
      d[i + 1] = 118 + n * 38 + n2 * 18;
      d[i + 2] = 142 + n * 34 + n2 * 20;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- мята / листва деревьев ---------- */
/**
 * Листва. `blossom` — весеннее цветение: светлая зелень с белыми
 * крапинами цветов, по которому весна читается сразу.
 */
function leafCanvas(size = 256, base = 0x4c7a33, blossom = false) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 16, y / 16, 81, 4);
      const l = fbm(x / 4, y / 4, 91, 2);
      const k = 0.6 + n * 0.55 + (l - 0.5) * 0.2;
      const i = (y * size + x) * 4;
      d[i] = clamp01((((base >> 16) & 255) / 255) * k) * 255;
      d[i + 1] = clamp01((((base >> 8) & 255) / 255) * k) * 255;
      d[i + 2] = clamp01(((base & 255) / 255) * k) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (blossom) {
    // бело-розовые цветы по всей кроне
    for (let i = 0; i < 340; i++) {
      const x = hash2(i, 61, 3) * size;
      const y = hash2(i, 67, 5) * size;
      const r = 2 + hash2(i, 71, 7) * 4.5;
      const pink = hash2(i, 73, 11) > 0.45;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, pink ? 'rgba(255,236,242,0.95)' : 'rgba(255,252,246,0.92)');
      grd.addColorStop(0.6, pink ? 'rgba(252,222,234,0.6)' : 'rgba(248,246,238,0.55)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  }
  return c;
}

/* ---------- травинки для кустиков газона ---------- */
/**
 * Травинки газона. `base` — цвет основания, `blade` — цвет травинок:
 * зимой трава бледная и присыпанная снегом, осенью — жёлто-бурная.
 */
function tuftCanvas(size = 64, base = '#8fbf58', blade = [120, 170, 70]) {
  const c = makeCanvas(size), g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = hash2(i, 3, 11) * size;
    const h = 6 + hash2(i, 7, 13) * size * 0.7;
    const w = 1 + hash2(i, 11, 17) * 2;
    const lean = (hash2(i, 13, 19) - 0.5) * 10;
    g.fillStyle = `rgba(${blade[0] + hash2(i, 17, 23) * 60 | 0},${blade[1] + hash2(i, 19, 29) * 50 | 0},${blade[2]},0.85)`;
    g.beginPath();
    g.moveTo(x - w, size);
    g.quadraticCurveTo(x + lean * 0.5, size - h * 0.6, x + lean, size - h);
    g.quadraticCurveTo(x + lean * 0.5 + w, size - h * 0.6, x + w, size);
    g.closePath();
    g.fill();
  }
  return c;
}

/* ---------- кора: вертикальные волокна, борозды и сучки ---------- */
function barkCanvas(size = 256, base = 0x4b3524) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // борозды идут вдоль ствола (по вертикали), но слегка волнистые
      const wob = fbm(x / 26, y / 90, 17, 3) * 10;
      const groove = Math.abs(Math.sin((x + wob) / size * Math.PI * 13 + fbm(x / 60, y / 140, 29, 2) * 4));
      const fibre = fbm(x / 3.2, y / 46, 43, 3);
      const crack = fbm(x / 14, y / 70, 61, 4);
      let k = 0.52 + groove * 0.34 + (fibre - 0.5) * 0.26;
      if (crack < 0.34) k *= 0.62;               // глубокие трещины
      const i = (y * size + x) * 4;
      d[i] = clamp01((((base >> 16) & 255) / 255) * k) * 255;
      d[i + 1] = clamp01((((base >> 8) & 255) / 255) * k) * 255;
      d[i + 2] = clamp01(((base & 255) / 255) * k) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // сучки — тёмные овалы с кольцом вокруг
  for (let n = 0; n < 7; n++) {
    const x = hash2(n, 7, 3) * size, y = hash2(n, 11, 5) * size;
    const r = 3 + hash2(n, 13, 7) * 5;
    g.fillStyle = 'rgba(30,20,12,0.85)';
    g.beginPath(); g.ellipse(x, y, r, r * 1.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,92,62,0.5)';
    g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(x, y, r * 1.7, r * 2.3, 0, 0, Math.PI * 2); g.stroke();
  }
  return c;
}

/* ---------- лесная подстилка: мох, прелая листва, земля ---------- */
function forestFloorCanvas(size = 512) {
  const c = makeCanvas(size), g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const soil = fbm(x / 22, y / 22, 11, 4);
      const moss = fbm(x / 34, y / 30, 23, 4);
      const litter = fbm(x / 7, y / 9, 37, 3);
      // мох зеленее, подстилка бурая, листва ржавая
      const green = clamp01((moss - 0.42) * 2.4);
      let r = lerp(48, 96, soil) * 0.9, gg = lerp(38, 74, soil) * 0.9, b = lerp(28, 48, soil) * 0.9;
      r = lerp(r, 58, green * 0.8); gg = lerp(gg, 88, green * 0.8); b = lerp(b, 40, green * 0.8);
      if (litter > 0.62) { r = lerp(r, 118, 0.6); gg = lerp(gg, 86, 0.6); b = lerp(b, 46, 0.6); }
      const i = (y * size + x) * 4;
      d[i] = clamp01(r / 255) * 255;
      d[i + 1] = clamp01(gg / 255) * 255;
      d[i + 2] = clamp01(b / 255) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // сухие листья и веточки поверх
  for (let n = 0; n < 260; n++) {
    const x = hash2(n, 3, 17) * size, y = hash2(n, 5, 19) * size;
    const a = hash2(n, 9, 23) * Math.PI * 2;
    const len = 5 + hash2(n, 15, 29) * 11;
    g.save();
    g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgba(${132 + hash2(n, 21, 31) * 50 | 0},${84 + hash2(n, 23, 37) * 40 | 0},40,0.5)`;
    g.beginPath(); g.ellipse(0, 0, len, len * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return c;
}

/* ------------------------------------------------------------------ */

/**
 * Витраж: мозаика цветных стёкол с тёмным швом и розеткой в центре.
 *
 * Раньше окно храма было однотонной панелью — читалось как заглушка.
 * Теперь это настоящее стекло: кусочки разного оттенка, швы между ними
 * и круглый медальон.
 *
 * @param {string} base основной цвет стекла
 * @param {string} accent цвет акцента (розетка и края)
 * @param {number} seed зерно рисунка
 * @returns {HTMLCanvasElement} готовая текстура
 */
function stainedGlassCanvas(base, accent, seed = 3, w = 96, h = 160) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);

  // кусочки стекла: неровные прямоугольники, у каждого свой оттенок
  const cols = 4;
  const rows = 6;
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const v = hash2(k, r, seed);
      g.globalAlpha = 0.32 + v * 0.5;
      g.fillStyle = v > 0.72 ? accent : base;
      g.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2);
      // блик по краю стекла
      g.globalAlpha = 0.35;
      g.fillStyle = '#ffffff';
      g.fillRect(k * cw + 1, r * rh + 1, cw - 2, 1.5);
    }
  }
  g.globalAlpha = 1;

  // розетка в центре окна
  const cx = w / 2;
  const cy = h / 2;
  const rad = Math.min(w, h) * 0.24;
  g.fillStyle = accent;
  g.beginPath();
  g.arc(cx, cy, rad, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = base;
  g.beginPath();
  g.arc(cx, cy, rad * 0.55, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(cx, cy, rad * 0.22, 0, Math.PI * 2);
  g.fill();

  // шов (свинец между стёклами)
  g.strokeStyle = 'rgba(18,16,20,0.85)';
  g.lineWidth = 2.2;
  for (let k = 0; k <= cols; k++) {
    g.beginPath();
    g.moveTo(k * cw, 0);
    g.lineTo(k * cw, h);
    g.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    g.beginPath();
    g.moveTo(0, r * rh);
    g.lineTo(w, r * rh);
    g.stroke();
  }
  // ободок окна
  g.lineWidth = 5;
  g.strokeRect(2.5, 2.5, w - 5, h - 5);
  return c;
}

export function buildTextures() {
  const grassCanvasImage = grassCanvas(512);
  // Газон по сезонам. Зимний — серо-белый: снег лёг на траву, но зелёное
  // ещё проглядывает местами.
  const grassWinterImage = grassCanvas(512, {
    dark: 0x8d9aa6, mid: 0xa8b4bd, light: 0xc9d3da, dry: 0xb6bec4,
    blade: '#c6d0d8',
  });
  const grassAutumnImage = grassCanvas(512, {
    dark: 0x6b5a2a, mid: 0x8a7333, light: 0xa8913f, dry: 0xb59a4a,
    blade: '#9c8438',
  });
  // Весенний газон — сочный, свежий: после зимы трава ярче и мягче.
  const grassSpringImage = grassCanvas(512, {
    dark: 0x35601f, mid: 0x52892a, light: 0x86bb41, dry: 0x93b04e,
    blade: '#6ea637',
  });
  const T = {
    grass: tex(grassCanvasImage, 26),
    grassFar: tex(grassCanvasImage, 90),
    grassSpring: tex(grassSpringImage, 26),
    grassFarSpring: tex(grassSpringImage, 90),
    grassWinter: tex(grassWinterImage, 26),
    grassFarWinter: tex(grassWinterImage, 90),
    grassAutumn: tex(grassAutumnImage, 26),
    grassFarAutumn: tex(grassAutumnImage, 90),
    dirt: tex(dirtCanvas(512), 8),
    // заснеженная дорога — зимний вариант
    dirtWinter: tex(dirtCanvas(512, true), 8),
    cobble: tex(cobbleCanvas(512, 16), 10),
    // заснеженный булыжник площади
    cobbleWinter: tex(cobbleCanvas(512, 16, true), 10),
    plaster: tex(plasterCanvas(256, 0xd9c9ac, 3), 1),
    plasterWarm: tex(plasterCanvas(256, 0xd8bf95, 9), 1),
    plasterGrey: tex(plasterCanvas(256, 0xc2bdb0, 15), 1),
    wood: tex(woodCanvas(256, 0x53381f, 5), 1),
    woodLight: tex(woodCanvas(256, 0x8a6238, 17), 1),
    plank: tex(plankCanvas(256), 1),
    thatch: tex(thatchCanvas(512), 1),
    tile: tex(tileCanvas(512, 0x8e4632), 1),
    tileSlate: tex(tileCanvas(512, 0x7c848c), 1),
    stone: tex(stoneCanvas(256), 1),
    cave: tex(caveRockCanvas(256), 1),
    caveWall: tex(caveWallCanvas(256), 1),
    bone: tex(boneCanvas(64), 1),
    windowLit: tex(windowCanvas(128, true), 1),
    windowDark: tex(windowCanvas(128, false), 1),
    // витражи храма: четыре варианта цветного стекла
    stainedRed: tex(stainedGlassCanvas('#a83a2c', '#e0a03a', 3), 1),
    stainedBlue: tex(stainedGlassCanvas('#2b5c96', '#7fc8e8', 5), 1),
    stainedGold: tex(stainedGlassCanvas('#c99a34', '#8fc25a', 7), 1),
    stainedGreen: tex(stainedGlassCanvas('#3d7a4c', '#e2c04a', 11), 1),
    fabric: tex(fabricCanvas(128, '#a8453c', '#e3d3b4'), 1),
    fabric2: tex(fabricCanvas(128, '#3f6b6a', '#ded0ad'), 1),
    water: tex(waterCanvas(256), 4),
    leaf: tex(leafCanvas(256, 0x4c7a33), 1),
    // Листва по сезонам — это РАЗНЫЕ текстуры, а не оттенок одной.
    // Умножение зелёной текстуры на оранжевый даёт оливковый, а не осенний.
    // весенняя листва с цветением — по белым крапинам весна читается сразу
    leafSpring: tex(leafCanvas(256, 0x86b03c, true), 1),
    leafAutumn: tex(leafCanvas(256, 0xa8622a), 1),   // багрянец
    leafPine: tex(leafCanvas(256, 0x2f5230), 1),
    leafWinter: tex(leafCanvas(256, 0x9aa6a8), 1),   // бледная, припорошена снегом
    bark: tex(barkCanvas(256, 0x4b3524), 1),
    barkBirch: tex(barkCanvas(256, 0xb9b3a4), 1),
    forestFloor: tex(forestFloorCanvas(512), 96),
    tuft: tex(tuftCanvas(64), 1),
    // зимняя трава — бледная, покрытая инеем
    tuftWinter: tex(tuftCanvas(64, '#c8d2dc', [190, 200, 205]), 1),
    // осенняя трава — сухая, жёлто-бурая
    tuftAutumn: tex(tuftCanvas(64, '#b09248', [175, 140, 70]), 1),
  };
  // Анизотропия для всех текстур. Без неё мипмапы «кипят» на больших
  // плоскостях (пол, стены, настил) при движении камеры — это и читалось
  // как мерцание текстур в интерьере.
  for (const key of Object.keys(T)) {
    if (T[key] && T[key].isTexture) T[key].anisotropy = 16;
  }
  T.grass.anisotropy = 16;
  T.cobble.anisotropy = 16;
  T.dirt.anisotropy = 16;
  return T;
}
