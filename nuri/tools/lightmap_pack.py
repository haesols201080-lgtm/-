"""Turns a lightmap baked by blender/build_house.py (float irradiance, .npy) into the game's 8-bit image: fireflies
removed (median), the bake noise smoothed (a small blur that stays inside the islands: dilated first), encoded
sRGB after dividing by a scale that is written next to it (the game multiplies it back: lightMapIntensity).
usage: python tools/lightmap_pack.py <in.npy> <out.webp> [percentile]"""
import sys, json
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
pct = float(sys.argv[3]) if len(sys.argv) > 3 else 99.7
a = np.load(src).astype(np.float32)
a = np.nan_to_num(a, nan=0.0, posinf=0.0, neginf=0.0).clip(0, None)
lum = a.mean(axis=2)
filled = lum > 1e-7
scale = float(np.percentile(lum[filled], pct)) if filled.any() else 1.0
scale = max(scale, 1e-4)
# denoise: fireflies out (median), then a blur that stays inside the islands (normalised convolution with the coverage)
def box(x, r, axis):
    c = np.cumsum(np.pad(x, [(r + 1, r) if i == axis else (0, 0) for i in range(2)], mode='edge'), axis=axis, dtype=np.float64)
    n = x.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis); lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)
def blur(x, r):
    # three box passes each way: close to a gaussian of the same width
    k = max(1, int(round(r * 0.8)))
    for _ in range(3): x = box(box(x, k, 0), k, 1)
    return x
m = filled.astype(np.float32)
med = np.stack([np.asarray(Image.fromarray(a[..., k].astype(np.float32), 'F').filter(ImageFilter.MedianFilter(5)), np.float32) for k in range(3)], -1)
mb = blur(m, 2.2) + 1e-6
den = np.stack([blur(med[..., k] * m, 2.2) / mb for k in range(3)], -1)
den = np.where(filled[..., None], den, med)
v = (den / scale).clip(0, 1) ** (1 / 2.2)
img = Image.fromarray((v * 255 + 0.5).astype(np.uint8), 'RGB')
img.save(out, 'WEBP', quality=92, method=6)
json.dump({'scale': scale}, open(out.rsplit('.', 1)[0] + '.json', 'w'))
print('lightmap', out, img.size, 'scale %.4g' % scale, 'filled %.0f%%' % (100 * filled.mean()))
