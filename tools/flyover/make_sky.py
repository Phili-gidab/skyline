"""Offline art for the Study fly-over.

Cloud cutouts (top-down cumulus, lit from the upper left, self-shadowed) and
the contour ground. Written as WebP to <out>/, plus preview sheets over ink
and over cream to <preview>/.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

OUT = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else OUT
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREVIEW, exist_ok=True)

INK = np.array([6, 19, 13], np.float32)
CREAM = np.array([246, 242, 232], np.float32)
GOLD = np.array([201, 162, 75], np.float32)
LIT = np.array([255, 253, 247], np.float32)
SHADE = np.array([128, 142, 152], np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def value_noise(h, w, cell, rng):
    cell = max(2.0, float(cell))
    gh, gw = int(np.ceil(h / cell)) + 4, int(np.ceil(w / cell)) + 4
    g = rng.random((gh, gw)).astype(np.float32)
    up = ndimage.zoom(g, cell, order=3, mode='nearest')
    oy = int(rng.integers(0, int(cell)))
    ox = int(rng.integers(0, int(cell)))
    return up[oy:oy + h, ox:ox + w]


def fbm(h, w, cell, octaves, rng, gain=0.5, billow=False):
    v = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for _ in range(octaves):
        n = value_noise(h, w, cell, rng)
        if billow:
            n = np.abs(n * 2.0 - 1.0)
        v += amp * n
        total += amp
        amp *= gain
        cell /= 2.0
    return v / total


def cloud(w, h, anchor, seed, blobs=22):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    short = min(w, h)

    # the mass: a union of soft blobs, crowded toward the edge it enters from
    shape = np.zeros((h, w), np.float32)
    for _ in range(blobs):
        if anchor == 'left':
            cx, cy = rng.uniform(-0.2, 0.55) * w, rng.uniform(0.0, 1.0) * h
        elif anchor == 'right':
            cx, cy = rng.uniform(0.45, 1.2) * w, rng.uniform(0.0, 1.0) * h
        elif anchor == 'bottom':
            cx, cy = rng.uniform(-0.05, 1.05) * w, rng.uniform(0.45, 1.2) * h
        else:
            cx, cy = rng.normal(0.5, 0.13) * w, rng.normal(0.5, 0.13) * h
        r = rng.uniform(0.08, 0.2) * short
        shape = np.maximum(shape, np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))

    # break the blobs' round edges into cauliflower
    wx = (fbm(h, w, 220, 5, rng) - 0.5) * 0.22 * short
    wy = (fbm(h, w, 220, 5, rng) - 0.5) * 0.22 * short
    shape = ndimage.map_coordinates(shape, [yy + wy, xx + wx], order=1, mode='nearest')

    base = fbm(h, w, 320, 6, rng)
    puff = fbm(h, w, 150, 4, rng, billow=True)
    d = shape * 1.25 + (base - 0.5) * 0.75 + (puff - 0.5) * 0.28 - 0.55

    # fade out toward every edge that will be on screen
    m = short * 0.12
    fx0 = smoothstep(0, m, xx)
    fx1 = smoothstep(0, m, w - 1 - xx)
    fy0 = smoothstep(0, m, yy)
    fy1 = smoothstep(0, m, h - 1 - yy)
    win = {
        'left': fx1,
        'right': fx0,
        'bottom': fy0,
        'puff': fx0 * fx1 * fy0 * fy1,
    }[anchor]
    d = d * win - (1 - win) * 0.3

    alpha = smoothstep(0.0, 0.3, d)
    # domes, not crags: a rounded profile, blurred, with only a trace of puff
    thick = np.sqrt(np.clip(d, 0, None))
    hf = ndimage.gaussian_filter(thick, 9) + puff * 0.02 * alpha
    hs = hf * 140.0  # heights, in pixels

    # lambert against the heightfield's normal; y grows downward in images
    gy, gx = np.gradient(hs)
    L = np.array([-0.5, -0.55, 0.67], np.float32)
    L /= np.linalg.norm(L)
    inv = 1.0 / np.sqrt(gx * gx + gy * gy + 1.0)
    lam = np.clip((-gx * L[0] - gy * L[1] + L[2]) * inv, 0, 1)

    # self-shadow: march toward the light; anything taller than the sun ray occludes
    step, n_steps, tan_e = 3, 26, 0.75
    pad = step * n_steps + 2
    hp = np.pad(hs, pad, mode='edge')
    occl = np.zeros_like(hs)
    for s in range(1, n_steps + 1):
        dy = int(round(s * step * 0.72))
        dx = int(round(s * step * 0.69))
        sample = hp[pad - dy:pad - dy + h, pad - dx:pad - dx + w]
        occl = np.maximum(occl, sample - hs - np.hypot(dy, dx) * tan_e)
    shadow = np.exp(-occl / 10.0)

    light = np.clip(0.52 + 0.62 * lam * shadow - 0.08 * (1 - shadow), 0, 1)
    # thin edges read bright, as sunlit cloud does
    light = np.clip(light + (1 - smoothstep(0.0, 0.35, d)) * 0.3, 0, 1)

    rgb = SHADE + (LIT - SHADE) * light[..., None]
    return np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)


def ground(w=2400, h=1500, seed=3):
    rng = np.random.default_rng(seed)
    hgt = fbm(h, w, 800, 8, rng)
    hgt = ndimage.gaussian_filter(hgt, 1.0)
    hgt = (hgt - hgt.min()) / (hgt.max() - hgt.min())
    f = hgt * 26
    gy, gx = np.gradient(f)
    grad = np.hypot(gx, gy) + 1e-4
    dist = np.abs(((f + 0.5) % 1.0) - 0.5) / grad  # pixels to the nearest contour
    major = (np.floor(f + 0.5).astype(np.int32) % 5) == 0
    line = np.clip(np.where(major, 1.1, 0.6) + 0.5 - dist, 0, 1)
    a = line * np.where(major, 0.5, 0.2)
    tint = 1.0 + 0.9 * smoothstep(0.3, 0.8, hgt)
    base = np.clip(INK * tint[..., None], 0, 255)
    rgb = base * (1 - a[..., None]) + GOLD * a[..., None]
    return rgb.clip(0, 255).astype(np.uint8)


def save(name, arr, quality=82):
    mode = 'RGBA' if arr.shape[2] == 4 else 'RGB'
    path = os.path.join(OUT, name + '.webp')
    Image.fromarray(arr, mode).save(path, 'WEBP', quality=quality, method=6)
    print(f'{name}: {arr.shape[1]}x{arr.shape[0]}, {os.path.getsize(path) // 1024} KB')


def over(rgba, bg):
    a = rgba[..., 3:4].astype(np.float32) / 255.0
    return (rgba[..., :3] * a + bg * (1 - a)).astype(np.uint8)


SPRITES = {
    'cloud-left': (1500, 1700, 'left', 11),
    'cloud-right': (1500, 1700, 'right', 23),
    'cloud-bottom': (2400, 1000, 'bottom', 37),
    'cloud-puff': (1200, 1000, 'puff', 5),
    'cloud-puff-2': (1000, 850, 'puff', 61),
}

made = {}
for name, (w, h, anchor, seed) in SPRITES.items():
    if ONLY and name not in ONLY:
        continue
    made[name] = cloud(w, h, anchor, seed)
    save(name, made[name])

if not ONLY or 'ground' in ONLY:
    g = ground()
    save('ground', g, quality=80)
    Image.fromarray(g).resize((1200, 750), Image.LANCZOS).save(os.path.join(PREVIEW, '_ground.png'))

# preview: every sprite over ink (top row) and over cream (bottom row)
if made:
    tiles = []
    for name, rgba in made.items():
        pair = []
        for bg in (INK, CREAM):
            im = Image.fromarray(over(rgba, bg))
            im.thumbnail((560, 560), Image.LANCZOS)
            pair.append(im)
        tiles.append(pair)
    tw = sum(p[0].width for p in tiles) + 8 * len(tiles)
    th = max(p[0].height for p in tiles) * 2 + 8
    sheet = Image.new('RGB', (tw, th), (40, 40, 40))
    x = 0
    for top, bottom in tiles:
        sheet.paste(top, (x, 0))
        sheet.paste(bottom, (x, th // 2 + 4))
        x += top.width + 8
    sheet.save(os.path.join(PREVIEW, '_clouds.png'))
    print('preview', sheet.size)
