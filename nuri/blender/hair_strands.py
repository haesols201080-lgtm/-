"""Draws the strand texture for the stranger's hair cards: a few thousand hairs per card, each a thin tapered curve
with its own slight wave, thickness and shade (dark brown, a few grey ones at 45), their roots denser and darker.
Out: <out>_albedo.png (RGBA, alpha the hair coverage) and <out>_normal.png (a gentle cylinder normal across each hair,
so light catches along them). Cards are laid out in 4 columns (4 variants), roots at v = 0, tips at v = 1.
usage: python hair_strands.py <out_prefix> [width height]"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1]; W = int(sys.argv[2]) if len(sys.argv) > 2 else 1024; H = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
SS = 2                                           # (drawn at twice the size, then filtered down: soft edges)
rng = random.Random(7)
col = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0)); nrm = Image.new('RGB', (W * SS, H * SS), (128, 128, 255))
dc = ImageDraw.Draw(col); dn = ImageDraw.Draw(nrm)
cols = 4; cw = W * SS // cols
for c in range(cols):
    x0 = c * cw; n = 650 + c * 120
    for i in range(n):
        # (denser in the middle of the card, thinning to nothing at its sides: cards melt into each other)
        x = x0 + cw * min(0.97, max(0.03, rng.gauss(0.5, 0.17)))
        L = H * SS * rng.uniform(0.55, 1.0)                           # (hairs end at different lengths)
        grey = rng.random() < 0.08
        base = (int(rng.uniform(150, 175)), int(rng.uniform(140, 160)), int(rng.uniform(130, 150))) if grey else \
               (int(rng.uniform(32, 58)), int(rng.uniform(22, 38)), int(rng.uniform(15, 26)))
        w0 = rng.uniform(1.4, 2.6) * SS / 2; amp = rng.uniform(0, 6) * SS; ph = rng.random() * 6.28; fr = rng.uniform(0.6, 1.6)
        drift = rng.uniform(-0.06, 0.06) * cw
        pts = []
        for k in range(24):
            t = k / 23; y = t * L
            pts.append((x + drift * t * t + amp * math.sin(ph + t * fr * 6.28) * t, y))
        for k in range(23):
            t = k / 23
            wk = max(0.5, w0 * (1 - 0.85 * t))                       # (tapering to the tip)
            # (fading in over the first part of the card, so card roots melt into the layer under them; thinning at the tip)
            a = int(255 * min(1.0, t / 0.18 + 0.15) * (1 - 0.3 * t) * rng.uniform(0.75, 1.0))
            shade = 0.85 + 0.35 * t                                   # (a little lighter toward the tip, as hair is)
            cc = tuple(min(255, int(v * shade)) for v in base)
            dc.line([pts[k], pts[k + 1]], fill=cc + (a,), width=max(1, int(round(wk * 2))))
            dx, dy = pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]
            # normal across the hair: tilt toward the side (the strand is round)
            dn.line([(pts[k][0] - wk * 0.5, pts[k][1]), (pts[k + 1][0] - wk * 0.5, pts[k + 1][1])], fill=(90, 128, 235), width=max(1, int(wk)))
            dn.line([(pts[k][0] + wk * 0.5, pts[k][1]), (pts[k + 1][0] + wk * 0.5, pts[k + 1][1])], fill=(166, 128, 235), width=max(1, int(wk)))
col = col.resize((W, H), Image.LANCZOS); nrm = nrm.resize((W, H), Image.LANCZOS)
# colour under the transparent parts: the nearest hair colour bleeds out (no dark halos when filtered)
a = np.asarray(col).astype(np.float32); rgb = a[..., :3]; al = a[..., 3:] / 255
blur = np.asarray(Image.fromarray(np.uint8(rgb * al)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)
wb = np.asarray(Image.fromarray(np.uint8(al[..., 0] * 255)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[..., None] / 255
fill = np.where(wb > 1e-3, blur / np.maximum(wb, 1e-3), 40)
rgb = np.where(al > 0.02, rgb / np.maximum(al, 1e-3) * 1.0, fill)
out_a = np.concatenate([np.clip(rgb, 0, 255), a[..., 3:]], -1).astype(np.uint8)
Image.fromarray(out_a, 'RGBA').save(out + '_albedo.png')
nrm.save(out + '_normal.png')
print('hair strands', out, W, H)
