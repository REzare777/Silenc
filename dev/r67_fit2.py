#!/usr/bin/env python3
"""
Финальная подгонка точки игрока (v5) — с полной проекцией камеры.

Учитывает наклон камеры: он меняет и вертикальное положение объектов,
и их экранный азимут.

Наблюдения (пиксели окна 2560x1440, кадр x 40..2560, y 118..1390):
  * пень-указатель у дороги: x=405, низ y=757, ширина 68 px;
  * фонарь у входа в пещеру: x=864;
  * светлая скала: центр x≈880;
  * дальний участок дороги в лесу: x≈675.

Запуск: python3 dev/r67_fit2.py
"""
import json
import math

CX0, CY0, CX1, CY1 = 40, 118, 2560, 1390
CW, CH = CX1 - CX0, CY1 - CY0
CCX, CCY = (CX0 + CX1) / 2, (CY0 + CY1) / 2
FOV_V = 68.0
EYE = 1.68
TAN_V = math.tan(math.radians(FOV_V / 2))
KXY = (CW / 2) / (TAN_V * (CW / CH))
KY = (CH / 2) / TAN_V

CLIFF = (-72.0, -66.0)
CLIFF_H = 6.0
LANTERNS = [(-67.17, -64.76), (-70.34, -61.29)]
TRAIL = [(-2.5, -14), (-5, -21), (-12, -28), (-20, -33), (-28, -38),
         (-36, -41), (-44, -46), (-51, -52), (-56, -58), (-62, -60), (-67, -63),
         (-67.87, -62.22)]
STUMP_IDX = (1, 3, 5, 7, 9)

OBS = {'stump_x': 405, 'stump_y': 757, 'stump_w': 68,
       'lantern_x': 864, 'cliff_x': 880, 'road_x': 675}


def screen(px, py, pz, cam, yaw, pitch):
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    vx, vy, vz = px - cam[0], py - cam[1], pz - cam[2]
    a = vx * cy - vz * sy
    b = vx * (sp * sy) + vy * cp + vz * (sp * cy)
    c = vx * (-cp * sy) + vy * sp + vz * (-cp * cy)
    if c <= 0.05:
        return None
    return (CCX + (a / c) * KXY, CCY - (b / c) * KY)


def fit(p, stump, lantern, road_seg):
    x, z, vb, pitch = p
    yaw = math.radians(-vb)
    cam = (x, EYE, z)
    s = screen(stump[0], 0.0, stump[1], cam, yaw, pitch)
    if s is None:
        return 1e9, {}
    d = math.hypot(x - stump[0], z - stump[1])
    if d < 3 or d > 25:
        return 1e9, {}
    width = 0.48 / d * KXY
    lan = screen(lantern[0], 2.4, lantern[1], cam, yaw, pitch)
    cl = screen(CLIFF[0], CLIFF_H, CLIFF[1], cam, yaw, pitch)
    a1, a2 = road_seg
    seg_b = math.degrees(math.atan2(a2[0] - a1[0], -(a2[1] - a1[1]))) % 360
    # экранный азимут отрезка: берём точку далеко по нему
    far = (a1[0] + (a2[0] - a1[0]) * 6, a1[1] + (a2[1] - a1[1]) * 6)
    rx = screen(far[0], 0.0, far[1], cam, yaw, pitch)
    e = (s[0] - OBS['stump_x']) ** 2 + (s[1] - OBS['stump_y']) ** 2
    e += (width - OBS['stump_w']) ** 2 * 2.0
    if lan:
        e += (lan[0] - OBS['lantern_x']) ** 2
    else:
        e += 1e6
    if cl:
        e += (cl[0] - OBS['cliff_x']) ** 2 * 0.3
    else:
        e += 1e6
    if rx:
        e += (rx[0] - OBS['road_x']) ** 2 * 0.3
    else:
        e += 1e6
    return e, {'stump_screen': (round(s[0]), round(s[1])), 'width': round(width, 1),
               'dist': round(d, 2), 'lantern_x': round(lan[0]) if lan else None,
               'cliff_x': round(cl[0]) if cl else None, 'road_x': round(rx[0]) if rx else None,
               'r': round(math.hypot(x, z), 1)}


def main():
    out = []
    segs = [(TRAIL[i], TRAIL[i + 1]) for i in range(len(TRAIL) - 1)]
    for side in (1, -1):
        for idx in (3, 5):
            stump = (TRAIL[idx][0] + 2.1 * side, TRAIL[idx][1] + 0.8)
            for lantern in LANTERNS:
                for seg in segs[2:6]:
                    for dist0 in (8, 12, 16, 22):
                        for vb0 in (314, 322, 330):
                            for pit0 in (-0.28, -0.16, -0.06):
                                p = [stump[0] + dist0 * 0.95, stump[1] + dist0 * 0.2, vb0, pit0]
                                e, _ = fit(p, stump, lantern, seg)
                                step = [1.5, 1.5, 3.0, 0.08]
                                for _ in range(160):
                                    imp = False
                                    for i in range(4):
                                        for d in (step[i], -step[i]):
                                            q = list(p)
                                            q[i] += d
                                            ee, _ = fit(q, stump, lantern, seg)
                                            if ee < e:
                                                e, p, imp = ee, q, True
                                    if not imp:
                                        step = [s * 0.5 for s in step]
                                        if step[0] < 0.005:
                                            break
                                e, info = fit(p, stump, lantern, seg)
                                out.append((e, list(p), stump, lantern, seg, info))
    out.sort(key=lambda t: t[0])
    print('вариантов:', len(out))
    for e, p, stump, lantern, seg, info in out[:15]:
        print('err=%8.1f P=(%.2f, %.2f) азимут=%.1f наклон=%.1f пень=%s фонарь=%s дорога=%s %s'
              % (e, p[0], p[1], p[2], math.degrees(p[3]), stump, lantern, seg[0], info))
    e, p, stump, lantern, seg, info = out[0]
    json.dump({'x': p[0], 'z': p[1], 'bearing': p[2], 'pitch': math.degrees(p[3]),
               'stump': stump, 'lantern': lantern, 'road_seg': seg[0], 'err': e, 'info': info},
              open('/workspace/village/dev/r67_fit2.json', 'w'), indent=1)


if __name__ == '__main__':
    main()
