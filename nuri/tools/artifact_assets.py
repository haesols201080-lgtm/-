"""Rewrites a production build (dist/) into file types an artifact host serves (after tools/pack_models.mjs):
  * every PNG colour map in models/ and tex/ -> WebP
  * every Radiance .hdr -> two PNGs: <name>_rgb.png (RGBE mantissas) + <name>_e.png (shared exponent)
Run with Blender's Python (bpy) because it decodes the .hdr:  python tools/artifact_assets.py dist"""
import sys, os, glob
import numpy as np
from PIL import Image

D = sys.argv[1]
# models: tools/pack_models.mjs has already turned every .glb into glTF JSON (meshopt geometry, images as files);
# a .glb still here means that step was skipped
left = glob.glob(f'{D}/models/**/*.glb', recursive=True)
assert not left, f'run "node tools/pack_models.mjs {D}" first ({len(left)} .glb left)'

# PNG colour maps (leaf and flower cut-outs, the moss tile with height in alpha) -> WebP: lossy colour at q90,
# lossless alpha, and exact=True so the colour under transparent pixels survives (it bleeds in at cut-out edges)
for p in glob.glob(f'{D}/models/**/*.png', recursive=True) + glob.glob(f'{D}/tex/*.png'):
    im = Image.open(p); im.load()
    out = p[:-4] + '.webp'
    kw = dict(quality=90, method=6)
    if im.mode in ('RGBA', 'LA', 'P'): im = im.convert('RGBA'); kw.update(alpha_quality=100, exact=True)
    else: im = im.convert('RGB')
    im.save(out, 'WEBP', **kw)
    print('webp', os.path.relpath(out, D), round(os.path.getsize(p) / 1e6, 2), '->', round(os.path.getsize(out) / 1e6, 2), 'MB')
    os.remove(p)

hdrs = glob.glob(f'{D}/hdri/*.hdr')
if hdrs:
    import bpy
    for p in hdrs:
        im = bpy.data.images.load(p); w, h = im.size
        a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1, :, :3]  # top row first
        mx = a.max(axis=2)
        e = np.where(mx > 1e-32, np.ceil(np.log2(np.maximum(mx, 1e-32))), -128)
        scale = np.where(mx > 1e-32, 256.0 / np.exp2(e), 0)
        m = np.clip(np.floor(a * scale[..., None]), 0, 255).astype(np.uint8)
        E = np.clip(e + 128, 0, 255).astype(np.uint8); E[mx <= 1e-32] = 0
        base = p[:-4]
        Image.fromarray(m, 'RGB').save(base + '_rgb.png', optimize=True)
        Image.fromarray(E, 'L').save(base + '_e.png', optimize=True)
        os.remove(p)
        print('hdr', os.path.basename(base), w, h, round((os.path.getsize(base + '_rgb.png') + os.path.getsize(base + '_e.png')) / 1e6, 2), 'MB')
