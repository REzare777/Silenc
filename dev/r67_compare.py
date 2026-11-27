#!/usr/bin/env python3
"""
Сравнение кадров-кандидатов со скриншотом пользователя.

Игровой кадр в скриншоте: x 40..2560, y 118..1390.
Кандидаты сняты в 1280x650 (тот же формат).

Запуск: python3 dev/r67_compare.py
"""
import os

from PIL import Image
import numpy as np

SRC = '/workspace/attachments/cc70bccfa9188b11/image.png'
DIR = '/workspace/village/shots/find'
BOX = (40, 118, 2560, 1390)
W, H = 1280, 650


def main():
    src = Image.open(SRC).crop(BOX).resize((W, H), Image.LANCZOS)
    src.save(os.path.join(DIR, 'user.png'))
    g_src = np.asarray(src.convert('L'), dtype=np.float32)

    files = sorted(f for f in os.listdir(DIR) if f.startswith('cand_') and f.endswith('.jpg'))
    res = []
    for f in files:
        im = Image.open(os.path.join(DIR, f)).resize((W, H), Image.LANCZOS)
        g = np.asarray(im.convert('L'), dtype=np.float32)
        # только нижние 2/3 — там земля, дорога и лес: они и определяют место
        band = slice(int(H * 0.38), H)
        d = float(np.abs(g_src[band] - g[band]).mean())
        res.append((d, f, im))
    res.sort()
    for d, f, _ in res:
        print('%6.2f  %s' % (d, f))

    if res:
        best = res[0][2]
        combo = Image.new('RGB', (W, H * 2 + 6), (15, 15, 15))
        combo.paste(src, (0, 0))
        combo.paste(best, (0, H + 6))
        combo.save(os.path.join(DIR, 'compare_best.png'))
        print('эталон сверху, лучший кандидат снизу:', res[0][1])


if __name__ == '__main__':
    main()
