"""
Trace the client's raster logo into an exact SVG.

The supplied artwork is flat-colour, so its outlines can be recovered rather
than redrawn: marching squares extracts sub-pixel contours at the alpha
half-level, Douglas-Peucker simplifies them, and each colour band becomes one
even-odd path. That keeps the real letterforms — including the tagline —
instead of approximating them by hand.

Three things matter for quality:

  * The source is upsampled before tracing. Marching squares interpolates
    between corner values, so a Lanczos upsample of an antialiased edge
    yields genuinely smoother contours than tracing at native size.
  * Simplification is per band. The tagline is only ~39px tall in the source;
    the tolerance that suits the mark destroys it.
  * The two-tone wordmark is split by contour centroid, never by masking a
    column range. Masking cuts straight through the "Y" and leaves a seam
    where the two paths butt together.

    python tools/trace-logo.py
"""

import io
import os
import numpy as np
from PIL import Image

SRC = 'brand-source/logo-transparent-1280.png'
ISO = 0.5
UPSCALE = 3

# Band boundaries, measured from the ink profile of the trimmed artwork,
# in source pixels. Simplification tolerance is per band, also in source px.
MARK_END, WORD_END, TRAVEL_END = 360, 578, 661
EPS = {'mark': 0.55, 'word': 0.40, 'travel': 0.20, 'tag': 0.13}

# Column at which SKY gives way to LINE. Only used to classify whole
# contours by centroid, so it never has to land in a letter gap.
SKY_SPLIT = 450

# Marching-squares segment table. Corner bits: TL=8 TR=4 BR=2 BL=1.
# Edges: T=0 R=1 B=2 L=3
TABLE = {
    1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(0, 1)],
    5: [(0, 3), (2, 1)], 6: [(0, 2)], 7: [(0, 3)], 8: [(0, 3)],
    9: [(0, 2)], 10: [(0, 1), (3, 2)], 11: [(0, 1)], 12: [(3, 1)],
    13: [(2, 1)], 14: [(3, 2)],
}


def contours(mask):
    """Sub-pixel contours of a float mask, as closed point loops."""
    g = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), np.float32)
    g[1:-1, 1:-1] = mask

    tl, tr = g[:-1, :-1], g[:-1, 1:]
    br, bl = g[1:, 1:], g[1:, :-1]
    case = (((tl > ISO) << 3) | ((tr > ISO) << 2) |
            ((br > ISO) << 1) | (bl > ISO)).astype(np.uint8)

    ii, jj = np.nonzero((case > 0) & (case < 15))

    def interp(a, b):
        d = b - a
        return 0.5 if abs(d) < 1e-9 else (ISO - a) / d

    adj = {}
    for i, j in zip(ii.tolist(), jj.tolist()):
        A, B, C, D = float(tl[i, j]), float(tr[i, j]), float(br[i, j]), float(bl[i, j])
        pt = {
            0: (j + interp(A, B), float(i)),
            1: (float(j + 1), i + interp(B, C)),
            2: (j + interp(D, C), float(i + 1)),
            3: (float(j), i + interp(A, D)),
        }
        for e0, e1 in TABLE[case[i, j]]:
            p, q = pt[e0], pt[e1]
            adj.setdefault(p, []).append(q)
            adj.setdefault(q, []).append(p)

    seen, loops = set(), []
    for start in adj:
        if start in seen:
            continue
        loop, cur, prev = [start], start, None
        seen.add(start)
        while True:
            nxt = None
            for cand in adj.get(cur, ()):
                if cand != prev and cand not in seen:
                    nxt = cand
                    break
            if nxt is None:
                break
            seen.add(nxt)
            loop.append(nxt)
            prev, cur = cur, nxt
        if len(loop) > 3:
            loops.append(loop)
    return loops


def rdp(pts, eps):
    """Douglas-Peucker, iterative so deep contours cannot blow the stack."""
    a = np.asarray(pts, np.float64)
    n = len(a)
    if n < 4:
        return pts
    keep = np.zeros(n, bool)
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1:
            continue
        p0, p1 = a[s], a[e]
        d = p1 - p0
        norm = float(np.hypot(d[0], d[1]))
        seg = a[s + 1:e]
        if norm < 1e-12:
            dist = np.hypot(seg[:, 0] - p0[0], seg[:, 1] - p0[1])
        else:
            dist = np.abs(d[0] * (p0[1] - seg[:, 1]) - (p0[0] - seg[:, 0]) * d[1]) / norm
        k = int(np.argmax(dist))
        if dist[k] > eps:
            m = s + 1 + k
            keep[m] = True
            stack.append((s, m))
            stack.append((m, e))
    return [tuple(p) for p in a[keep]]


def loop_path(loop, eps, scale):
    s = rdp(loop, eps)
    if len(s) < 3:
        return ''
    pts = [f'{x * scale:.2f},{y * scale:.2f}' for x, y in s]
    return 'M' + pts[0] + 'L' + 'L'.join(pts[1:]) + 'Z'


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    src = Image.open(SRC).convert('RGBA')
    a = np.array(src)
    ys, xs = np.nonzero(a[:, :, 3] > 20)
    crop = src.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    W, H = crop.size

    big = crop.resize((W * UPSCALE, H * UPSCALE), Image.LANCZOS)
    al = np.array(big)[:, :, 3].astype(np.float32) / 255.0
    scale = 1.0 / UPSCALE

    def band(y0, y1):
        m = np.zeros_like(al)
        m[y0 * UPSCALE:y1 * UPSCALE] = al[y0 * UPSCALE:y1 * UPSCALE]
        return m

    paths = {k: [] for k in ('mark', 'sky', 'line', 'travel', 'tag')}

    for lp in contours(band(0, MARK_END)):
        paths['mark'].append(loop_path(lp, EPS['mark'] * UPSCALE, scale))

    # Trace the wordmark whole, then assign each contour to SKY or LINE by
    # its centroid — no letter is ever cut, so no seam can appear.
    for lp in contours(band(MARK_END, WORD_END)):
        cx = float(np.asarray(lp, np.float64)[:, 0].mean()) * scale
        key = 'sky' if cx < SKY_SPLIT else 'line'
        paths[key].append(loop_path(lp, EPS['word'] * UPSCALE, scale))

    for lp in contours(band(WORD_END, TRAVEL_END)):
        paths['travel'].append(loop_path(lp, EPS['travel'] * UPSCALE, scale))

    for lp in contours(band(TRAVEL_END, H)):
        paths['tag'].append(loop_path(lp, EPS['tag'] * UPSCALE, scale))

    joined = {k: ''.join(p for p in v if p) for k, v in paths.items()}
    for k in ('mark', 'sky', 'line', 'travel', 'tag'):
        print(f'  {k:7s} loops={len(paths[k]):4d}  chars={len(joined[k])}')

    order = ['mark', 'sky', 'line', 'travel', 'tag']

    def build(colours, out, only=None, vh=None, label=''):
        names = only or order
        body = ''.join(
            f'<path fill="{colours[n]}" fill-rule="evenodd" d="{joined[n]}"/>'
            for n in names if joined[n]
        )
        h = vh or H
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {h}" '
               f'role="img" aria-label="{label}">{body}</svg>')
        io.open(out, 'w', encoding='utf-8').write(svg)
        print(f'{out}  {len(svg) // 1024} KB  {W}x{h}')

    FULL = 'Skyline Travel Solution - You belong Everywhere'

    build({'mark': '#25b06b', 'sky': '#25b06b', 'line': '#3ecb84',
           'travel': '#f2ede0', 'tag': '#e4dcc9'}, 'public/logo.svg', label=FULL)

    build({'mark': '#0e8f47', 'sky': '#0e8f47', 'line': '#23ad68',
           'travel': '#116431', 'tag': '#325138'}, 'public/logo-color.svg', label=FULL)

    build({'mark': '#25b06b', 'sky': '#f2ede0', 'line': '#f2ede0'},
          'public/logo-compact.svg', only=['mark', 'sky', 'line'],
          vh=WORD_END + 8, label='Skyline Travel Solution')

    # Lockup without the tagline. The tagline is only ~39px tall in the
    # source and its letterforms are already eroded there, so no tolerance
    # recovers them — it is set as live type in Logo.jsx instead.
    build({'mark': '#25b06b', 'sky': '#25b06b', 'line': '#3ecb84',
           'travel': '#f2ede0'}, 'public/logo-lockup.svg',
          only=['mark', 'sky', 'line', 'travel'], vh=TRAVEL_END + 6,
          label='Skyline Travel Solution')

    build({'mark': '#0e8f47', 'sky': '#0e8f47', 'line': '#23ad68',
           'travel': '#116431'}, 'public/logo-lockup-color.svg',
          only=['mark', 'sky', 'line', 'travel'], vh=TRAVEL_END + 6,
          label='Skyline Travel Solution')

    # Favicon: the mark alone. Anything with type in it is illegible at 32px.
    toks = [t.split(',') for t in joined['mark']
            .replace('M', ' ').replace('L', ' ').replace('Z', ' ').split() if ',' in t]
    mxs = [float(t[0]) for t in toks]
    mys = [float(t[1]) for t in toks]
    bx0, bx1, by0, by1 = min(mxs), max(mxs), min(mys), max(mys)
    bw, bh = bx1 - bx0, by1 - by0
    pad = 84
    sc = (512 - 2 * pad) / max(bw, bh)
    tx = (512 - bw * sc) / 2 - bx0 * sc
    ty = (512 - bh * sc) / 2 - by0 * sc
    fav = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
           '<rect width="512" height="512" rx="112" fill="#06130d"/>'
           f'<g transform="translate({tx:.1f} {ty:.1f}) scale({sc:.4f})">'
           f'<path fill="#25b06b" fill-rule="evenodd" d="{joined["mark"]}"/></g></svg>')
    io.open('public/favicon.svg', 'w', encoding='utf-8').write(fav)
    print(f'public/favicon.svg  {len(fav) // 1024} KB')


if __name__ == '__main__':
    main()
