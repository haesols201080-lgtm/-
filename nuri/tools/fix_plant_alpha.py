"""Puts the cut-out back into the scanned plants. Poly Haven's 1k glTF downloads ship the leaf colour map as a JPEG,
so the fronds, blades and petals lost their alpha and rendered as solid cards. This merges each asset's separate
opacity map (Poly Haven 'Alpha' / 'opacity', CC0) into the colour map as RGBA and makes the leaf material a cut-out.
usage: python tools/fix_plant_alpha.py <alpha_dir> public/models/ph   (alpha_dir holds <asset>_alpha_1k.png)"""
import sys, os, io, json, struct
import numpy as np
from PIL import Image

ALPHA_DIR, MODELS = sys.argv[1], sys.argv[2]
# asset -> (alpha file, material names that are leaves; None = every MASK material)
ASSETS = {
    'celandine_01': None, 'dandelion_01': None, 'fern_02': None, 'flower_empodium': None, 'flower_heliophila': None,
    'flower_stinkkruid': None, 'flower_ursinia': None, 'grass_medium_01': None, 'grass_medium_02': None, 'nettle_plant': None,
    'periwinkle_plant': None, 'shrub_01': None, 'shrub_02': None, 'shrub_03': None, 'shrub_04': None, 'shrub_sorrel_01': None,
    'weed_plant_02': None,
    'pine_sapling_small': ['pine_sapling_small_twig'],
}
# (fir_sapling's twig 'alpha' does not line up with its atlas and Poly Haven ships that material opaque: left as is)
ALPHA_FILE = {'pine_sapling_small': 'pine_sapling_small_twig_alpha_1k.png'}


def read_glb(p):
    b = open(p, 'rb').read(); off = 12; js = None; bin_ = b''
    while off < len(b):
        ln, typ = struct.unpack_from('<II', b, off); ch = b[off + 8: off + 8 + ln]; off += 8 + ln
        if typ == 0x4E4F534A: js = json.loads(ch)
        elif typ == 0x004E4942: bin_ = ch
    return js, bin_


def write_glb(p, js, views):
    # views: list of bytes per bufferView, in order; rebuild the single buffer with 4-byte alignment
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4: out.append(0)
        js['bufferViews'][i]['byteOffset'] = len(out); js['bufferViews'][i]['byteLength'] = len(data); js['bufferViews'][i]['buffer'] = 0
        out += data
    while len(out) % 4: out.append(0)
    js['buffers'] = [{'byteLength': len(out)}]
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(out)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j)
        f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)


def bleed(rgb, alpha):
    """Colour under the transparent texels is pushed out from the leaves (push-pull over a mip pyramid), so filtered
    and mipmapped edges keep the leaf colour instead of darkening toward the black background of the scan atlas."""
    c = np.asarray(rgb).astype(np.float32); w = (np.asarray(alpha) > 127).astype(np.float32)
    cs, ws = [c * w[..., None]], [w]
    while min(cs[-1].shape[:2]) > 1:
        h, wd = cs[-1].shape[0] // 2 * 2, cs[-1].shape[1] // 2 * 2
        cc = cs[-1][:h, :wd].reshape(h // 2, 2, wd // 2, 2, 3).sum((1, 3)); ww = ws[-1][:h, :wd].reshape(h // 2, 2, wd // 2, 2).sum((1, 3))
        cs.append(cc); ws.append(ww)
    col = cs[-1] / np.maximum(ws[-1], 1e-6)[..., None]
    for lv in range(len(cs) - 2, -1, -1):
        up = np.repeat(np.repeat(col, 2, 0), 2, 1)
        H, W = cs[lv].shape[:2]
        up = np.pad(up, ((0, max(0, H - up.shape[0])), (0, max(0, W - up.shape[1])), (0, 0)), mode='edge')[:H, :W]
        own = cs[lv] / np.maximum(ws[lv], 1e-6)[..., None]
        k = np.clip(ws[lv], 0, 1)[..., None]
        col = own * k + up * (1 - k)
    out = np.where(w[..., None] > 0, c, col)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGB')


def alpha_map(asset, size):
    a = Image.open(os.path.join(ALPHA_DIR, ALPHA_FILE.get(asset, f'{asset}_alpha_1k.png')))
    arr = np.asarray(a).astype(np.float32)
    if arr.ndim == 3: arr = arr[..., 0]
    arr = arr / (65535.0 if arr.max() > 255 else 255.0)
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), 'L')
    return im if im.size == size else im.resize(size, Image.LANCZOS)


for asset, leafMats in ASSETS.items():
    p = os.path.join(MODELS, asset + '.glb')
    js, bin_ = read_glb(p)
    views = [bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']] for bv in js['bufferViews']]
    done = set()
    for m in js['materials']:
        if leafMats is None and m.get('alphaMode') not in ('MASK', 'BLEND'): continue
        if leafMats is not None and m.get('name') not in leafMats: continue
        m['alphaMode'] = 'MASK'; m['alphaCutoff'] = 0.5; m['doubleSided'] = True
        tex = m['pbrMetallicRoughness']['baseColorTexture']['index']
        src = js['textures'][tex]['source']
        if src in done: continue
        img = js['images'][src]
        rgb = Image.open(io.BytesIO(views[img['bufferView']])).convert('RGB')
        am = alpha_map(asset, rgb.size)
        rgba = bleed(rgb, am); rgba.putalpha(am)
        buf = io.BytesIO(); rgba.save(buf, 'PNG', optimize=True)
        views[img['bufferView']] = buf.getvalue(); img['mimeType'] = 'image/png'
        done.add(src)
        cov = (np.asarray(rgba)[..., 3] > 127).mean()
        print(f'{asset}: {m["name"]} alpha merged ({cov:.0%} of the map is leaf)')
    write_glb(p, js, views)
