/**
 * ============================================================================
 *  Доска для записки у дороги
 * ============================================================================
 *
 *  Простая wooden-доска на двух столбах: на ней можно что-то написать
 *  углём — один раз за всю игру. Надпись рисуется прямо на canvas-текстуре,
 *  поэтому она видна с любого расстояния и не мигает.
 *
 *  @module world/board
 */

import * as THREE from 'three';
import { Builder, box, cyl, mat } from './geo.js';

/**
 * Доска для записки.
 *
 * @param {object} M материалы мира
 * @param {{w?: number, h?: number, postH?: number, title?: string}} [opts] параметры
 * @returns {{group: THREE.Group, setText: Function, board: THREE.Mesh}} доска
 */
export function noticeBoard(M, opts = {}) {
  const { w = 1.8, h = 1.15, postH = 1.35, title = '' } = opts;

  const B = new Builder();
  // два столба
  for (const s of [-1, 1]) {
    B.add(cyl(0.09, 0.11, postH, 7), 'timber',
      mat(s * (w / 2 - 0.16), postH / 2, 0, 0, 0, 0, 1));
  }
  // рама
  B.add(box(w + 0.12, 0.1, 0.12, 1), 'timber', mat(0, postH - h / 2 - 0.06, 0.02));
  B.add(box(w + 0.12, 0.1, 0.12, 1), 'timber', mat(0, postH + h / 2 + 0.06, 0.02));
  for (const s of [-1, 1]) {
    B.add(box(0.1, h + 0.2, 0.12, 1), 'timber', mat(s * (w / 2 + 0.01), postH, 0.02));
  }
  // доска-подложка
  B.add(box(w, h, 0.07, 1), 'plank', mat(0, postH, -0.03));

  const group = B.build(M, null, { name: 'noticeBoard' });

  /* --- надпись: рисуем на canvas и натягиваем на плоскость --- */
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const c2d = canvas.getContext('2d');

  /**
   * Перерисовать надпись на доске.
   *
   * @param {string} text текст записки (пусто — доска чистая)
   * @param {string} [head] заголовок надписи
   */
  function setText(text, head = title) {
    c2d.clearRect(0, 0, canvas.width, canvas.height);
    // фон: серые доски с прожилками
    c2d.fillStyle = '#6b5842';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 260; i++) {
      c2d.fillStyle = `rgba(${40 + Math.random() * 60},${30 + Math.random() * 40},${18 + Math.random() * 26},${0.05 + Math.random() * 0.12})`;
      c2d.fillRect(Math.random() * canvas.width, Math.random() * canvas.height,
        10 + Math.random() * 60, 1 + Math.random() * 3);
    }
    // рамка
    c2d.strokeStyle = 'rgba(28,20,12,.75)';
    c2d.lineWidth = 8;
    c2d.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

    if (text) {
      // заголовок
      if (head) {
        c2d.fillStyle = 'rgba(38,28,18,.9)';
        c2d.font = 'italic 26px Georgia, serif';
        c2d.textAlign = 'center';
        c2d.fillText(head, canvas.width / 2, 56);
        c2d.beginPath();
        c2d.moveTo(60, 70); c2d.lineTo(canvas.width - 60, 70);
        c2d.strokeStyle = 'rgba(38,28,18,.5)'; c2d.lineWidth = 3; c2d.stroke();
      }
      // сам текст — «углём», с лёгким наклоном
      c2d.fillStyle = 'rgba(26,20,14,.92)';
      c2d.font = 'italic 30px Georgia, serif';
      c2d.textAlign = 'left';
      const maxW = canvas.width - 90;
      const words = String(text).split(/\s+/);
      let line = '';
      let y = head ? 118 : 80;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (c2d.measureText(test).width > maxW && line) {
          c2d.fillText(line, 48, y);
          line = word; y += 42;
          if (y > canvas.height - 40) break;
        } else line = test;
      }
      if (line && y <= canvas.height - 40) c2d.fillText(line, 48, y);
    } else {
      c2d.fillStyle = 'rgba(30,22,14,.55)';
      c2d.font = 'italic 26px Georgia, serif';
      c2d.textAlign = 'center';
      c2d.fillText('здесь можно написать', canvas.width / 2, canvas.height / 2 + 8);
    }
    tex.needsUpdate = true;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  setText('');

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.97, h * 0.95),
    // лёгкое собственное свечение: доска часто стоит в тени от дома,
    // и без него надпись не прочесть
    new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.28,
      roughness: 0.92, metalness: 0,
    }),
  );
  face.position.set(0, postH, 0.012);
  face.castShadow = false;
  face.receiveShadow = true;
  group.add(face);

  // гвозди по углам
  const nails = new Builder();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    nails.add(cyl(0.022, 0.022, 0.03, 6), 'iron',
      mat(sx * (w / 2 - 0.12), postH + sy * (h / 2 - 0.12), 0.03, Math.PI / 2, 0, 0, 1));
  }
  group.add(nails.build(M, null, { name: 'boardNails' }));

  return { group, setText, board: face, tex };
}
