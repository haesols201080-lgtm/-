"""Rewrites a production build (dist/) into file types an artifact host serves:
  * every .glb -> standard glTF JSON (.json) with the binary buffer embedded as a base64 data URI
  * every Radiance .hdr -> two PNGs: <name>_rgb.png (RGBE mantissas) + <name>_e.png (shared exponent)
Run with Blender's Python (bpy) because it decodes the .hdr:  python tools/artifact_assets.py dist"""
import sys, os, json, struct, base64, glob
import numpy as np
from PIL import Image

D = sys.argv[1]
for p in glob.glob(f'{D}/models/**/*.glb', recursive=True):
    b = open(p, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', b, 0)
    assert magic == 0x46546C67, p
    off = 12; js = None; bin_ = b''
    while off < total:
        ln, typ = struct.unpack_from('<II', b, off); chunk = b[off + 8: off + 8 + ln]; off += 8 + ln
        if typ == 0x4E4F534A: js = json.loads(chunk.decode('utf-8'))
        elif typ == 0x004E4942: bin_ = chunk
    if js.get('buffers'):
        js['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(bin_).decode('ascii')
    out = p[:-4] + '.json'
    json.dump(js, open(out, 'w'), separators=(',', ':'))
    os.remove(p)
    print('gltf', os.path.relpath(out, D), round(os.path.getsize(out) / 1e6, 2), 'MB')

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
