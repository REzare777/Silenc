import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Рыбы долины: каталог + иконки (2D) + модели (3D)
 *  Всё процедурное — ни одного внешнего файла и ни одной загрузки.
 *  Модуль безопасен для импорта в Node: document используется только
 *  внутри fishIcon/fishTexture и только под проверкой окружения.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Редкости
 * ------------------------------------------------------------------ */

export const RARITY = {
  common:    { key: 'common',    label: 'Обычная',     color: '#e9e6df', glow: '#ffffff' },
  rare:      { key: 'rare',      label: 'Редкая',     color: '#49b6f2', glow: '#8fd8ff' },
  epic:      { key: 'epic',      label: 'Эпическая',  color: '#b060e8', glow: '#d9a3ff' },
  legendary: { key: 'legendary', label: 'Легендарная', color: '#f2c14e', glow: '#ffe9a8' },
  mythic:    { key: 'mythic',    label: 'Мифическая', color: '#2b2f3a', glow: '#7f6bff' },
};

/* ------------------------------------------------------------------ *
 *  Каталог: 9 обычных, 5 редких, 3 эпические, 2 легендарные, 1 мифическая
 *  shape:  round | long | flat | spiny | eel
 *  pattern: plain | stripe | spots | belly | scale
 * ------------------------------------------------------------------ */

export const FISH = [
  /* ---------------- обычные ---------------- */
  {
    id: 'ukleyka', name: 'Уклейка', rarity: 'common',
    weightMin: 0.02, weightMax: 0.09, lengthMin: 7, lengthMax: 14, value: 5,
    shape: 'long', pattern: 'scale', tint: '#9fb6c6',
    desc: 'Нежная и мелкая, ходит косяками у самого берега.',
  },
  {
    id: 'elets', name: 'Елец', rarity: 'common',
    weightMin: 0.04, weightMax: 0.18, lengthMin: 9, lengthMax: 20, value: 6,
    shape: 'long', pattern: 'stripe', tint: '#b5c4c7',
    desc: 'Быстрый и стайный, держится быстрого течения.',
  },
  {
    id: 'plotva', name: 'Плотва', rarity: 'common',
    weightMin: 0.06, weightMax: 0.35, lengthMin: 10, lengthMax: 22, value: 8,
    shape: 'round', pattern: 'belly', tint: '#8b9a60',
    desc: 'Кисловатая, но в улове всегда вкусная.',
  },
  {
    id: 'okun', name: 'Окунь', rarity: 'common',
    weightMin: 0.08, weightMax: 0.55, lengthMin: 12, lengthMax: 28, value: 10,
    shape: 'round', pattern: 'stripe', tint: '#5f7d43',
    desc: 'Колючий, полосатый, клюёт на живца.',
  },
  {
    id: 'ersh', name: 'Ёрш', rarity: 'common',
    weightMin: 0.09, weightMax: 0.42, lengthMin: 11, lengthMax: 25, value: 12,
    shape: 'spiny', pattern: 'plain', tint: '#6f6a4c',
    desc: 'Вонючий и колючий, зато уха с него знатная.',
  },
  {
    id: 'krasnoperka', name: 'Краснопёрка', rarity: 'common',
    weightMin: 0.05, weightMax: 0.32, lengthMin: 12, lengthMax: 24, value: 14,
    shape: 'round', pattern: 'spots', tint: '#c4532f',
    desc: 'Яркая, с золотыми плавниками — жарится золотистой.',
  },
  {
    id: 'lin', name: 'Линь', rarity: 'common',
    weightMin: 0.30, weightMax: 3.20, lengthMin: 25, lengthMax: 52, value: 20,
    shape: 'round', pattern: 'belly', tint: '#8a7838',
    desc: 'Жилистый и крепкий, наваренный суп с ним знают все.',
  },
  {
    id: 'lesch', name: 'Лещ', rarity: 'common',
    weightMin: 0.50, weightMax: 3.80, lengthMin: 28, lengthMax: 48, value: 26,
    shape: 'flat', pattern: 'scale', tint: '#98a288',
    desc: 'Плоский и серебристый, с крупным тёмным глазом.',
  },
  {
    id: 'karas', name: 'Карась', rarity: 'common',
    weightMin: 0.15, weightMax: 1.50, lengthMin: 18, lengthMax: 36, value: 30,
    shape: 'round', pattern: 'scale', tint: '#b0762c',
    desc: 'Броня чешуи, выживает в любой заводи.',
  },

  /* ---------------- редкие ---------------- */
  {
    id: 'sudak', name: 'Судак', rarity: 'rare',
    weightMin: 0.80, weightMax: 7.50, lengthMin: 38, lengthMax: 72, value: 90,
    shape: 'long', pattern: 'stripe', tint: '#7d8a68',
    desc: 'Хищный, с клыками: держится глубины и коряг.',
  },
  {
    id: 'schuka', name: 'Щука', rarity: 'rare',
    weightMin: 1.20, weightMax: 11.00, lengthMin: 45, lengthMax: 95, value: 120,
    shape: 'long', pattern: 'spots', tint: '#5c7a44',
    desc: 'Зелёная в пятнах, бросается из-за куста.',
  },
  {
    id: 'forel', name: 'Форель', rarity: 'rare',
    weightMin: 0.30, weightMax: 3.00, lengthMin: 22, lengthMax: 55, value: 75,
    shape: 'flat', pattern: 'spots', tint: '#9c7a5a',
    desc: 'Живёт в холодных ручьях, розовеет на морозе.',
  },
  {
    id: 'karp', name: 'Карп', rarity: 'rare',
    weightMin: 2.50, weightMax: 16.00, lengthMin: 38, lengthMax: 82, value: 70,
    shape: 'round', pattern: 'scale', tint: '#a8823f',
    desc: 'Обитает в прудах, плодовит и нежданно богат.',
  },
  {
    id: 'zerkalny_karp', name: 'Зеркальный карп', rarity: 'rare',
    weightMin: 3.00, weightMax: 20.00, lengthMin: 45, lengthMax: 90, value: 110,
    shape: 'round', pattern: 'belly', tint: '#c9a04e',
    desc: 'Редкая порода с голой золотой спиной.',
  },

  /* ---------------- эпические ---------------- */
  {
    id: 'som', name: 'Сом', rarity: 'epic',
    weightMin: 4.00, weightMax: 80.00, lengthMin: 70, lengthMax: 180, value: 240,
    shape: 'eel', pattern: 'plain', tint: '#4b4436',
    desc: 'Ночной голод с длинными усами, берёт всё живое.',
  },
  {
    id: 'nalim', name: 'Налим', rarity: 'epic',
    weightMin: 1.50, weightMax: 10.00, lengthMin: 40, lengthMax: 95, value: 180,
    shape: 'eel', pattern: 'spots', tint: '#3d4a3b',
    desc: 'Слепой ночной рыбак, ползёт по дну на усах.',
  },
  {
    id: 'osetr', name: 'Осётр', rarity: 'epic',
    weightMin: 6.00, weightMax: 70.00, lengthMin: 90, lengthMax: 230, value: 400,
    shape: 'spiny', pattern: 'plain', tint: '#4f5b52',
    desc: 'Древний хозяин реки, на спине костяные пластины.',
  },

  /* ---------------- легендарные ---------------- */
  {
    id: 'zolotaya_forel', name: 'Форель золотая', rarity: 'legendary',
    weightMin: 2.00, weightMax: 12.00, lengthMin: 40, lengthMax: 75, value: 850,
    shape: 'flat', pattern: 'scale', tint: '#e3c063',
    desc: 'Светится золотом и уходит на дно при луне.',
  },
  {
    id: 'drakon_doliny', name: 'Дракон Долины', rarity: 'legendary',
    weightMin: 25.00, weightMax: 140.00, lengthMin: 150, lengthMax: 380, value: 1200,
    shape: 'long', pattern: 'scale', tint: '#e0b23c',
    desc: 'Легенда долины: чешуя звенит, а глаза горят золотом.',
  },

  /* ---------------- мифическая ---------------- */
  {
    id: 'hozyain_glubin', name: 'Хозяин Глубин', rarity: 'mythic',
    weightMin: 120.00, weightMax: 900.00, lengthMin: 300, lengthMax: 900, value: 3000,
    shape: 'eel', pattern: 'scale', tint: '#2b2f3a',
    desc: 'Тот, кто спит на дне. Ловцы шепчут, уходя.',
  },
];

/* Запасной состав легендарной ветки (в ТЗ список видов содержал 21 позицию —
   9+5+3+2+1 = 20, поэтому одна позиция осталась за бортом). Если нужна
   «Стерлядь» вместо «Золотая форели» — замените ею объект zolotaya_forel:
   { id: 'sterlyad', name: 'Стерлядь', rarity: 'legendary',
     weightMin: 3.00, weightMax: 25.00, lengthMin: 60, lengthMax: 130, value: 800,
     shape: 'spiny', pattern: 'stripe', tint: '#d9b45c',
     desc: 'Золотистая, с костяными пластинами по спине.' } */

const FISH_BY_ID = new Map(FISH.map((f) => [f.id, f]));

/** Рыба по id или null. */
export function fishById(id) {
  return FISH_BY_ID.get(id) || null;
}

/** Описание редкости (fallback — обычная). */
export function rarityOf(rarityKey) {
  return RARITY[rarityKey] || RARITY.common;
}

/* ------------------------------------------------------------------ *
 *  Мелкие утилиты
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hexToRgb(hex) {
  let h = String(hex || '#000000').trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(t, 0, 1))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Осветление (t>0) или затемнение (t<0) цвета. */
const shade = (hex, t) => mixHex(hex, t >= 0 ? '#ffffff' : '#000000', Math.abs(t));

/** Детерминированный шум по строке — узоры не «прыгают» между вызовами. */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 *  2D-иконка
 * ------------------------------------------------------------------ */

/* Пропорции силуэта в нормализованных координатах (0..1 от размера иконки).
   hgt — полувысота тела, tailH — полувысота хвоста (в долях hgt),
   dorsal — высота спинного плавника над спиной, pect — длина грудного (в долях hgt). */
const ICON_SHAPES = {
  round:  { hgt: 0.30, nose: 0.90, tail: 0.26, dorsal: 0.075, tailL: 0.13, tailH: 1.20, anal: 0.055, pect: 1.25, ribbon: false },
  long:   { hgt: 0.21, nose: 0.93, tail: 0.20, dorsal: 0.055, tailL: 0.12, tailH: 1.25, anal: 0.045, pect: 1.30, ribbon: false },
  flat:   { hgt: 0.27, nose: 0.90, tail: 0.26, dorsal: 0.070, tailL: 0.13, tailH: 1.20, anal: 0.055, pect: 1.25, ribbon: false },
  spiny:  { hgt: 0.32, nose: 0.90, tail: 0.26, dorsal: 0.105, tailL: 0.13, tailH: 1.20, anal: 0.055, pect: 1.20, ribbon: false },
  eel:    { hgt: 0.17, nose: 0.82, tail: 0.14, dorsal: 0.075, tailL: 0.12, tailH: 1.45, anal: 0.035, pect: 1.15, ribbon: true },
};

/* Сила свечения по редкости — обычная рыба светится сдержанно. */
const ICON_GLOW = {
  common:    { blur: 0.10, alpha: 0.35 },
  rare:      { blur: 0.13, alpha: 0.50 },
  epic:      { blur: 0.15, alpha: 0.60 },
  legendary: { blur: 0.20, alpha: 0.85 },
  mythic:    { blur: 0.28, alpha: 0.95 },
};

const iconCache = new Map();

/**
 * Иконка рыбы 2D (canvas size×size, прозрачный фон).
 * @param {object} spec — запись из FISH
 * @param {number} size — сторона иконки в пикселях
 * @returns {HTMLCanvasElement|null} null, если окружения без DOM нет
 */
export function fishIcon(spec, size = 96) {
  if (typeof document === 'undefined' || !spec) return null;
  const px = Math.max(16, Math.round(size || 96));
  const key = `${spec.id}|${px}`;
  const cached = iconCache.get(key);
  if (cached) return copyCanvas(cached);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  drawFishIcon(ctx, spec, px);
  iconCache.set(key, canvas);
  return copyCanvas(canvas);
}

/** Отдельный canvas-копия: один и тот же рисунок можно вставить в DOM дважды. */
function copyCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  return c;
}

/** Контур тела: капля с заострением к хвосту (для «eel» — длинная лента). */
function traceBody(ctx, p, size) {
  const cy = size * 0.52;
  const nose = size * p.nose;
  const tail = size * p.tail;
  const H = size * p.hgt;
  const L = nose - tail;

  if (p.ribbon) {
    const steps = 26;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = tail + L * t;
      const y = cy + Math.sin(t * Math.PI * 1.6 + 0.35) * size * 0.045 * (1 - t * 0.45);
      const w = H * (0.30 + 0.85 * Math.pow(t, 0.35)) * (1 - 0.42 * Math.pow(t, 3));
      pts.push([x, y, w]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - pts[0][2]);
    for (let i = 1; i <= steps; i++) ctx.lineTo(pts[i][0], pts[i][1] - pts[i][2]);
    // круглая голова
    const head = pts[steps];
    ctx.arc(head[0], head[1], head[2], -Math.PI / 2, Math.PI / 2, false);
    for (let i = steps; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2]);
    ctx.closePath();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(nose, cy);
  ctx.bezierCurveTo(nose - L * 0.24, cy - H * 1.28, tail + L * 0.40, cy - H * 1.18, tail, cy);
  ctx.bezierCurveTo(tail + L * 0.40, cy + H * 1.18, nose - L * 0.24, cy + H * 1.28, nose, cy);
  ctx.closePath();
}

/** Верхняя кромка тела: точки [x, y] от носа к хвосту (x убывает). */
function bodyTopEdge(p, size) {
  const cy = size * 0.52;
  const nose = size * p.nose;
  const tail = size * p.tail;
  const H = size * p.hgt;
  const L = nose - tail;
  const x0 = nose, x1 = nose - L * 0.24, x2 = tail + L * 0.40, x3 = tail;
  const y0 = cy, y1 = cy - H * 1.28, y2 = cy - H * 1.18, y3 = cy;
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    pts.push([x, y]);
  }
  return pts;
}

/** Высота верхней кромки тела в точке x. */
function topYAt(edge, x) {
  let best = edge[0][1];
  let bestD = Infinity;
  for (let i = 0; i < edge.length; i++) {
    const d = Math.abs(edge[i][0] - x);
    if (d < bestD) { bestD = d; best = edge[i][1]; }
  }
  return best;
}

function drawFishIcon(ctx, spec, size) {
  const rarity = rarityOf(spec.rarity);
  const p = ICON_SHAPES[spec.shape] || ICON_SHAPES.round;
  const mythic = spec.rarity === 'mythic';
  const legendary = spec.rarity === 'legendary';

  const body = mythic ? '#2b2f3a' : (spec.tint || '#9aa');
  const fin = shade(body, mythic ? 0.10 : -0.10);
  const glow = rarity.glow || '#ffffff';

  const cy = size * 0.52;
  const nose = size * p.nose;
  const tail = size * p.tail;
  const H = size * p.hgt;
  const L = nose - tail;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const gl = ICON_GLOW[spec.rarity] || ICON_GLOW.common;
  const shadow = (blur) => {
    ctx.shadowColor = rgba(glow, gl.alpha);
    ctx.shadowBlur = size * blur;
  };

  /* --- хвостовой плавник (за телом) --- */
  ctx.save();
  shadow(gl.blur * 0.7);
  ctx.fillStyle = rgba(fin, 0.94);
  ctx.beginPath();
  ctx.moveTo(tail + L * 0.12, cy - H * 0.40);
  ctx.quadraticCurveTo(tail - size * p.tailL * 0.5, cy - H * p.tailH * 0.95, tail - size * p.tailL, cy - H * p.tailH);
  ctx.quadraticCurveTo(tail - size * p.tailL * 0.62, cy, tail - size * p.tailL, cy + H * p.tailH);
  ctx.quadraticCurveTo(tail - size * p.tailL * 0.5, cy + H * p.tailH * 0.95, tail + L * 0.12, cy + H * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* --- спинной плавник (за телом): у колючей формы — гребень-пила --- */
  ctx.save();
  shadow(gl.blur * 0.7);
  ctx.fillStyle = rgba(fin, 0.96);
  if (p.ribbon) {
    ctx.beginPath();
    ctx.moveTo(tail + L * 0.60, cy - H * 0.45);
    ctx.lineTo(tail + L * 0.34, cy - H - size * p.dorsal);
    ctx.lineTo(tail + L * 0.08, cy - H * 0.55);
    ctx.closePath();
    ctx.fill();
  } else {
    const edge = bodyTopEdge(p, size);
    ctx.beginPath();
    if (spec.shape === 'spiny') {
      // зубцы идут по самой кромке спины — гребень не отрывается от тела
      const teeth = 5;
      const xFront = tail + L * 0.64;
      const xBack = tail + L * 0.08;
      ctx.moveTo(xFront, topYAt(edge, xFront));
      for (let i = 0; i < teeth; i++) {
        const xp = xFront + (xBack - xFront) * ((i + 0.5) / teeth);
        const xv = xFront + (xBack - xFront) * ((i + 1) / teeth);
        const h = size * p.dorsal * (1 - (i / teeth) * 0.35);
        ctx.lineTo(xp, topYAt(edge, xp) - h);
        ctx.lineTo(xv, topYAt(edge, xv) - h * 0.3);
      }
      ctx.lineTo(xBack, topYAt(edge, xBack));
    } else {
      const xa = tail + L * 0.66;
      const xb = tail + L * 0.40;
      const xc = tail + L * 0.12;
      ctx.moveTo(xa, topYAt(edge, xa) + H * 0.3);
      ctx.lineTo(xb, topYAt(edge, xb) - size * p.dorsal);
      ctx.lineTo(xc, topYAt(edge, xc) + H * 0.3);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  /* --- анальный плавник (за телом) --- */
  ctx.fillStyle = rgba(fin, 0.92);
  ctx.beginPath();
  ctx.moveTo(tail + L * 0.48, cy + H * 0.50);
  ctx.lineTo(tail + L * 0.30, cy + H * 0.95 + size * p.anal);
  ctx.lineTo(tail + L * 0.08, cy + H * 0.64);
  ctx.closePath();
  ctx.fill();

  /* --- тело --- */
  ctx.save();
  shadow(gl.blur);
  if (legendary) {
    const grd = ctx.createLinearGradient(nose, cy - H, tail, cy + H);
    grd.addColorStop(0, '#fff6d2');
    grd.addColorStop(0.45, body);
    grd.addColorStop(1, shade(body, -0.22));
    ctx.fillStyle = grd;
  } else {
    ctx.fillStyle = body;
  }
  traceBody(ctx, p, size);
  ctx.fill();
  ctx.restore();

  /* --- рисунок по pattern --- */
  ctx.save();
  traceBody(ctx, p, size);
  ctx.clip();
  paintPattern(ctx, spec, p, size, body);
  ctx.restore();

  /* --- контур: подчёркивает силуэт, у мифической — фиолетовое свечение --- */
  ctx.save();
  ctx.lineWidth = Math.max(1, size * (mythic ? 0.035 : 0.022));
  ctx.strokeStyle = mythic ? rgba(glow, 0.95) : legendary ? rgba('#ffe9a8', 0.8) : rgba(shade(body, -0.35), 0.55);
  ctx.shadowColor = rgba(glow, gl.alpha);
  ctx.shadowBlur = size * (mythic ? 0.22 : gl.blur * 0.5);
  traceBody(ctx, p, size);
  ctx.stroke();
  ctx.restore();

  /* --- мифическая: руны вдоль тела --- */
  if (mythic) {
    ctx.save();
    traceBody(ctx, p, size);
    ctx.clip();
    ctx.fillStyle = rgba(glow, 0.85);
    ctx.shadowColor = rgba(glow, 0.9);
    ctx.shadowBlur = size * 0.18;
    for (let i = 0; i < 5; i++) {
      const x = tail + L * (0.18 + i * 0.16);
      const y = cy + (i % 2 ? 1 : -1) * H * 0.42;
      const r = size * 0.018;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --- плавник на груди (поверх тела) --- */
  ctx.save();
  ctx.fillStyle = mythic ? rgba(glow, 0.8) : rgba(shade(fin, -0.08), 0.95);
  ctx.beginPath();
  ctx.moveTo(nose - L * 0.30, cy + H * 0.10);
  ctx.quadraticCurveTo(nose - L * 0.56, cy + H * 0.55, nose - L * 0.46, cy + H * p.pect);
  ctx.quadraticCurveTo(nose - L * 0.32, cy + H * 0.55, nose - L * 0.22, cy + H * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* --- глаз с бликом --- */
  const ex = nose - L * (p.ribbon ? 0.13 : 0.18);
  const ey = cy - H * 0.32;
  const er = size * 0.040;
  ctx.fillStyle = '#14141c';
  ctx.beginPath();
  ctx.arc(ex, ey, er, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ex - er * 0.32, ey - er * 0.34, er * 0.34, 0, Math.PI * 2);
  ctx.fill();

  /* --- рот --- */
  ctx.strokeStyle = rgba(shade(body, -0.5), 0.9);
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  if (p.ribbon) {
    ctx.moveTo(nose - L * 0.02, cy + H * 0.20);
    ctx.quadraticCurveTo(nose - L * 0.10, cy + H * 0.30, nose - L * 0.16, cy + H * 0.16);
  } else {
    ctx.moveTo(nose - L * 0.01, cy + H * 0.12);
    ctx.quadraticCurveTo(nose - L * 0.08, cy + H * 0.26, nose - L * 0.14, cy + H * 0.10);
  }
  ctx.stroke();

  ctx.restore();
}

/** Рисунок тела поверх pattern (рисуется внутри clip по контуру тела). */
function paintPattern(ctx, spec, p, size, body) {
  const pattern = spec.pattern || 'plain';
  const cy = size * 0.52;
  const nose = size * p.nose;
  const tail = size * p.tail;
  const H = size * p.hgt;
  const L = nose - tail;

  if (pattern === 'stripe') {
    ctx.fillStyle = rgba(shade(body, -0.30), 0.5);
    const n = 7;
    const w = Math.max(1.5, size * 0.035);
    for (let i = 0; i < n; i++) {
      const x = tail + L * (0.12 + (i / (n - 1)) * 0.72);
      ctx.fillRect(x, cy - H * 1.4, w, H * 2.8);
    }
  } else if (pattern === 'spots') {
    const rnd = mulberry(hashStr(spec.id));
    ctx.fillStyle = rgba(shade(body, -0.38), 0.55);
    for (let i = 0; i < 16; i++) {
      const x = tail + L * (0.14 + rnd() * 0.70);
      const y = cy + (rnd() * 2 - 1) * H * 0.70;
      const r = size * (0.012 + rnd() * 0.013);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'belly') {
    const grd = ctx.createLinearGradient(0, cy - H * 0.1, 0, cy + H);
    grd.addColorStop(0, rgba('#ffffff', 0));
    grd.addColorStop(0.4, rgba('#ffffff', 0.22));
    grd.addColorStop(1, rgba('#ffffff', 0.5));
    ctx.fillStyle = grd;
    ctx.fillRect(tail - size * 0.1, cy - H * 0.1, L + size * 0.2, H * 1.4);
  } else if (pattern === 'scale') {
    ctx.save();
    ctx.strokeStyle = rgba(shade(body, -0.26), 0.34);
    ctx.lineWidth = Math.max(1, size * 0.008);
    const step = size * 0.058;
    let row = 0;
    for (let y = cy - H * 0.98; y < cy + H * 1.05; y += step * 0.62, row++) {
      for (let x = tail + (row % 2 ? step * 0.5 : 0); x < nose; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, step * 0.52, Math.PI * 1.06, Math.PI * 1.94);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ *
 *  3D-модель
 * ------------------------------------------------------------------ */

/* Полуоси тела по форме (X — длина, Y — высота, Z — ширина). */
const SHAPE_BODY = {
  round: { sx: 0.42, sy: 0.30, sz: 0.22 },
  long:  { sx: 0.52, sy: 0.17, sz: 0.14 },
  flat:  { sx: 0.46, sy: 0.26, sz: 0.12 },
  spiny: { sx: 0.44, sy: 0.34, sz: 0.20 },
  eel:   { sx: 0.56, sy: 0.11, sz: 0.09 },
};

/* Плавники: [длина, высота] хвоста, спинного, анального; длина грудного. */
const SHAPE_FIN = {
  round: { tail: [0.24, 0.24], dorsal: [0.24, 0.13], anal: [0.13, 0.08], pect: 0.13, barb: 0 },
  long:  { tail: [0.22, 0.19], dorsal: [0.28, 0.10], anal: [0.12, 0.07], pect: 0.12, barb: 0 },
  flat:  { tail: [0.22, 0.23], dorsal: [0.26, 0.12], anal: [0.13, 0.09], pect: 0.13, barb: 0 },
  spiny: { tail: [0.24, 0.24], dorsal: [0.28, 0.16], anal: [0.13, 0.08], pect: 0.13, barb: 0 },
  eel:   { tail: [0.13, 0.10], dorsal: [0.32, 0.06], anal: [0.11, 0.04], pect: 0.09, barb: 0.13 },
};

const texCache = new Map();

/**
 * Процедурная текстура тела (128×64): чешуя / полосы / крапины / брюхо.
 * @returns {THREE.CanvasTexture|null}
 */
function fishTexture(spec) {
  if (typeof document === 'undefined') return null;
  const key = spec.id;
  if (texCache.has(key)) return texCache.get(key);

  const w = 128, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');

  // база — белая: цвет задаёт материал, карта отвечает только за рисунок
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);

  // мягкое затемнение от спины (верх карты) к брюху
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, 'rgba(0,0,0,0.16)');
  grd.addColorStop(0.45, 'rgba(0,0,0,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);

  const pattern = spec.pattern || 'plain';
  const rnd = mulberry(hashStr(spec.id));

  if (pattern === 'stripe') {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 9; i++) {
      const x = Math.round((i / 9) * w + 3);
      g.fillRect(x, 0, 5, h);
    }
  } else if (pattern === 'spots') {
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = h * (0.12 + rnd() * 0.72);
      const r = 1.6 + rnd() * 2.6;
      g.fillStyle = 'rgba(0,0,0,0.20)';
      g.beginPath();
      g.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (pattern === 'belly') {
    const bg = g.createLinearGradient(0, h * 0.45, 0, h);
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(1, 'rgba(255,255,255,0.85)');
    g.fillStyle = bg;
    g.fillRect(0, h * 0.45, w, h * 0.55);
  } else if (pattern === 'scale') {
    g.strokeStyle = 'rgba(0,0,0,0.16)';
    g.lineWidth = 1;
    const step = 9;
    let row = 0;
    for (let y = 0; y < h + step; y += step * 0.6, row++) {
      for (let x = (row % 2 ? step * 0.5 : 0); x < w; x += step) {
        g.beginPath();
        g.arc(x, y, step * 0.52, Math.PI * 1.06, Math.PI * 1.94);
        g.stroke();
      }
    }
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}

/** Заостраение хвоста тела: сфера превращается в «каплю». */
/** Текстура брюха: плавный переход от цвета спины к светлому брюху. */
function bellyTexture(spec, tint) {
  if (typeof document === 'undefined') return null;
  const key = `belly:${spec.id}`;
  if (texCache.has(key)) return texCache.get(key);

  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, mixHex(tint, '#ffffff', 0.04));
  grd.addColorStop(0.35, mixHex(tint, '#ffffff', 0.18));
  grd.addColorStop(1, mixHex(tint, '#ffffff', 0.52));
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, h);

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}

function taperGeometry(geo) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) + 1) * 0.5;
    const tailK = 0.16 + 0.84 * smoothstep(0, 0.34, t);
    const headK = 1 - 0.16 * smoothstep(0.80, 1, t);
    const k = tailK * headK;
    pos.setY(i, pos.getY(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function bodyGeometry(s) {
  const geo = new THREE.SphereGeometry(1, 20, 14);
  taperGeometry(geo);
  geo.scale(s.sx, s.sy, s.sz);
  return geo;
}

function bellyGeometry(s) {
  const geo = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  taperGeometry(geo);
  geo.scale(s.sx * 1.004, s.sy * 1.004, s.sz * 1.004);
  return geo;
}

/** Полигон-фигура из точек [[x,y], ...]. */
function polyShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

/** Раздвоенный хвостовой плавник (лежит в плоскости XY, растёт в −X). */
function tailGeometry(len, hgt) {
  const s = new THREE.Shape();
  s.moveTo(0, hgt * 0.12);
  s.quadraticCurveTo(-len * 0.55, hgt * 0.62, -len, hgt);
  s.quadraticCurveTo(-len * 0.80, hgt * 0.18, -len * 0.52, 0);
  s.quadraticCurveTo(-len * 0.80, -hgt * 0.18, -len, -hgt);
  s.quadraticCurveTo(-len * 0.55, -hgt * 0.62, 0, -hgt * 0.12);
  s.closePath();
  return new THREE.ShapeGeometry(s, 8);
}

/** Спинной плавник; для колючей формы — гребень-пила. */
function dorsalGeometry(len, hgt, spiny) {
  if (!spiny) {
    const shape = polyShape([[-0.5, 0], [0.5, 0], [0.12, 1]]);
    const geo = new THREE.ShapeGeometry(shape, 4);
    geo.scale(len, hgt, 1);
    return geo;
  }
  const pts = [[-0.55, 0]];
  const teeth = 5;
  for (let i = 0; i < teeth; i++) {
    const x0 = -0.55 + (1.05 * i) / teeth;
    const x1 = -0.55 + (1.05 * (i + 0.55)) / teeth;
    pts.push([x0, 1 - (i % 2) * 0.08]);
    pts.push([x1, 0.55 - (i % 2) * 0.06]);
  }
  pts.push([0.5, 0]);
  const geo = new THREE.ShapeGeometry(polyShape(pts), 1);
  geo.scale(len, hgt, 1);
  return geo;
}

/** Грудной плавник: растёт от основания вверх, потом поворачивается вбок. */
function pectGeometry(len) {
  const shape = polyShape([[0, 0], [0.42, 0.52], [0.08, 1], [-0.2, 0.42]]);
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.scale(len, len, 1);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function makeMesh(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * 3D-модель рыбы: группа в мировых координатах, нос смотрит в +X,
 * длина модели ≈ 1.0 условной единицы.
 * @param {object} spec — запись из FISH
 * @returns {THREE.Group|null}
 */
export function fishModel(spec) {
  if (!spec) return null;

  const rarity = rarityOf(spec.rarity);
  const shape = spec.shape || 'round';
  const S = SHAPE_BODY[shape] || SHAPE_BODY.round;
  const F = SHAPE_FIN[shape] || SHAPE_FIN.round;
  const mythic = spec.rarity === 'mythic';
  const legendary = spec.rarity === 'legendary';

  const tint = mythic ? '#2b2f3a' : (spec.tint || '#9aa5a8');
  const metal = legendary || mythic ? 0.35 : 0;
  const emissive = legendary || mythic ? rarity.glow : '#000000';
  const emissiveIntensity = mythic ? 0.45 : legendary ? 0.18 : 0;

  const group = new THREE.Group();
  group.name = `fish:${spec.id}`;

  const map = fishTexture(spec);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: tint,
    map: map || null,
    roughness: 0.62,
    metalness: metal,
    emissive: new THREE.Color(emissive),
    emissiveIntensity,
  });

  const bellyMap = bellyTexture(spec, tint);
  const bellyMat = new THREE.MeshStandardMaterial({
    color: bellyMap ? '#ffffff' : mixHex(tint, '#ffffff', 0.34),
    map: bellyMap || null,
    roughness: 0.74,
    metalness: metal * 0.5,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: emissiveIntensity * 0.6,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const finMat = new THREE.MeshStandardMaterial({
    color: mixHex(tint, '#ffffff', 0.10),
    roughness: 0.5,
    metalness: metal,
    emissive: new THREE.Color(emissive),
    emissiveIntensity: emissiveIntensity * 1.15,
    side: THREE.DoubleSide,
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#15151d',
    roughness: 0.25,
    metalness: 0.1,
    emissive: new THREE.Color(mythic ? rarity.glow : '#000000'),
    emissiveIntensity: mythic ? 0.9 : 0,
  });

  const glintMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.2,
    metalness: 0,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.7,
  });

  const scuteMat = new THREE.MeshStandardMaterial({
    color: mixHex(tint, '#ffffff', 0.12),
    roughness: 0.45,
    metalness: metal,
  });

  /* ---------------- тело ---------------- */
  const body = makeMesh(bodyGeometry(S), bodyMat);
  group.add(body);

  /* ---------------- светлое брюхо ---------------- */
  group.add(makeMesh(bellyGeometry(S), bellyMat));

  /* ---------------- хвостовой плавник ---------------- */
  const tail = makeMesh(tailGeometry(F.tail[0], F.tail[1]), finMat);
  tail.position.set(-S.sx * 0.94, 0, 0);
  tail.rotation.z = 0.10;
  tail.rotation.y = 0.16;
  group.add(tail);

  /* ---------------- спинной плавник ---------------- */
  const dorsal = makeMesh(dorsalGeometry(F.dorsal[0], F.dorsal[1], shape === 'spiny'), finMat);
  dorsal.position.set(-S.sx * 0.10, S.sy * 0.74, 0);
  group.add(dorsal);

  /* ---------------- анальный плавник ---------------- */
  const anal = makeMesh(dorsalGeometry(F.anal[0], F.anal[1], false), finMat);
  anal.position.set(-S.sx * 0.42, -S.sy * 0.76, 0);
  anal.rotation.z = Math.PI;
  group.add(anal);

  /* ---------------- грудные плавники ---------------- */
  const pectGeo = pectGeometry(F.pect * 1.25);
  for (const side of [1, -1]) {
    const pect = makeMesh(pectGeo, finMat);
    pect.position.set(S.sx * 0.42, -S.sy * 0.22, side * S.sz * 0.66);
    pect.rotation.x = side > 0 ? 0.52 : -0.52;
    pect.rotation.y = side > 0 ? -0.55 : 0.55;
    if (side < 0) pect.scale.z = -1;
    group.add(pect);
  }

  /* ---------------- глаза ---------------- */
  const eyeR = Math.max(S.sz * 0.3, 0.022);
  for (const side of [1, -1]) {
    const eye = makeMesh(new THREE.SphereGeometry(eyeR, 10, 8), eyeMat);
    eye.position.set(S.sx * 0.66, S.sy * 0.30, side * S.sz * 0.74);
    group.add(eye);

    const glint = makeMesh(new THREE.SphereGeometry(eyeR * 0.36, 8, 6), glintMat);
    glint.position.set(S.sx * 0.66 + eyeR * 0.35, S.sy * 0.30 + eyeR * 0.35, side * (S.sz * 0.74 + eyeR * 0.5));
    group.add(glint);
  }

  /* ---------------- у угревидных — тяжёлая голова ---------------- */
  if (shape === 'eel') {
    const head = makeMesh(new THREE.SphereGeometry(1, 14, 10), bodyMat);
    head.scale.set(S.sx * 0.24, S.sy * 1.25, S.sz * 1.2);
    head.position.set(S.sx * 0.76, 0, 0);
    group.add(head);
  }

  /* ---------------- усы (сом, налим, мифическая) ---------------- */
  if (F.barb > 0) {
    const barbGeo = new THREE.ConeGeometry(S.sz * 0.10, F.barb, 5);
    for (const side of [1, -1]) {
      const barb = makeMesh(barbGeo, finMat);
      barb.position.set(S.sx * 0.92, -S.sy * 0.25, side * S.sz * 0.35);
      barb.rotation.z = Math.PI / 2 - 0.5;
      barb.rotation.y = side * 0.4;
      group.add(barb);
    }
  }

  /* ---------------- костяные пластины (ёрш, осётр) ---------------- */
  if (shape === 'spiny') {
    const scuteGeo = new THREE.ConeGeometry(S.sz * 0.20, S.sy * 0.26, 5);
    for (let i = 0; i < 4; i++) {
      const x = S.sx * (0.42 - i * 0.34);
      const scute = makeMesh(scuteGeo, scuteMat);
      scute.position.set(x, S.sy * 0.82, 0);
      scute.rotation.z = -0.25;
      group.add(scute);
    }
  }

  /* ---------------- мифическая: светящийся гребень ---------------- */
  if (mythic) {
    const ridgeGeo = new THREE.ConeGeometry(S.sz * 0.16, S.sy * 0.55, 4);
    for (let i = 0; i < 5; i++) {
      const ridge = makeMesh(ridgeGeo, finMat);
      ridge.position.set(S.sx * (0.35 - i * 0.28), S.sy * 0.95, 0);
      ridge.rotation.z = 0.15;
      group.add(ridge);
    }
  }

  group.userData = {
    id: spec.id,
    name: spec.name,
    rarity: spec.rarity,
    shape,
    pattern: spec.pattern,
    value: spec.value,
  };

  /* -------- приводим общую длину к 1.0 и ставим модель в начало координат -------- */
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(size.x, 1e-6);
  for (const child of group.children) {
    child.position.multiplyScalar(k);
    child.scale.multiplyScalar(k);
  }
  group.position.set(-center.x * k, -center.y * k, -center.z * k);

  return group;
}
