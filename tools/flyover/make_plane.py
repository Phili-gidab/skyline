"""Plane assets for the Study fly-over, from the raw top-down render.

plane-2800.webp / plane-1600.webp: the aircraft, trimmed to its bounds.
plane-shadow.webp: its silhouette, blurred and ink-coloured, padded by PAD of
the plane's width on every side, so CSS can place it with a -PAD margin.
"""
import os
import sys

from PIL import Image, ImageFilter

RAW, SIL, OUT = sys.argv[1:4]
PAD = 0.08
os.makedirs(OUT, exist_ok=True)

full = Image.open(RAW).convert('RGBA')
bbox = full.getbbox()
plane = full.crop(bbox)
print('plane bounds', plane.size, 'aspect', round(plane.width / plane.height, 4))

for w in (2800, 1600):
    h = round(plane.height * w / plane.width)
    path = os.path.join(OUT, f'plane-{w}.webp')
    plane.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=86, method=6)
    print(f'plane-{w}: {w}x{h}, {os.path.getsize(path) // 1024} KB')

sil = Image.open(SIL).convert('RGBA')
k = sil.width / full.width
sbox = tuple(round(v * k) for v in bbox)
alpha = sil.crop(sbox).getchannel('A')
pad = round(alpha.width * PAD)
canvas = Image.new('L', (alpha.width + 2 * pad, alpha.height + 2 * pad), 0)
canvas.paste(alpha, (pad, pad))
blurred = canvas.filter(ImageFilter.GaussianBlur(radius=alpha.width * 0.014))
shadow = Image.new('RGBA', canvas.size, (6, 19, 13, 0))
shadow.putalpha(blurred)
path = os.path.join(OUT, 'plane-shadow.webp')
shadow.save(path, 'WEBP', quality=80, method=6)
print(f'plane-shadow: {canvas.size[0]}x{canvas.size[1]}, {os.path.getsize(path) // 1024} KB')
