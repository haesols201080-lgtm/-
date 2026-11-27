"""Packs a GLB's textures into a few atlas sheets for the artifact host (which takes at most 511 files a version: the
house alone brings ~375 scanned-furniture maps, one file each once tools/pack_models.mjs has split them out).

Each image keeps its pixels exactly (no resampling) in a cell of a 4096-wide sheet, with an 8 px gutter of its own
edge pixels around it so mipmaps don't bleed in the neighbours; every material that used it now points at the
sheet through KHR_texture_transform (offset and scale of its cell), which three.js's GLTFLoader applies, so the
geometry and its UVs are untouched. Only images whose users all keep their UVs inside 0..1 are packed (a texture
that repeats can't live in an atlas); colour maps (sRGB) and data maps (normal, roughness/metal, occlusion) go to
separate sheets, and maps with alpha to their own PNG sheets.
Usage (Blender's Python, for numpy and PIL):  python tools/atlas_glb.py in.glb out.glb"""
import sys, json, struct, io
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
SHEET, G = 4096, 8
f = open(SRC, 'rb').read()
L = struct.unpack('<I', f[12:16])[0]
J = json.loads(f[20:20 + L])
B = f[20 + L + 8:20 + L + 8 + struct.unpack('<I', f[20 + L:24 + L])[0]]

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
def accessor(i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
    st = bv.get('byteStride', dt.itemsize * n); off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    base = np.frombuffer(B, dtype=dt, count=(st * (a['count'] - 1)) // dt.itemsize + n, offset=off)
    out = np.lib.stride_tricks.as_strided(base, shape=(a['count'], n), strides=(st, dt.itemsize)).astype(np.float64)
    if a.get('normalized'): out /= {5121: 255, 5123: 65535, 5120: 127, 5122: 32767}[a['componentType']]
    return out

# the UV range each material's primitives use, per texcoord set
rng = {}
for m in J['meshes']:
    for p in m['primitives']:
        mi = p.get('material')
        if mi is None: continue
        for k, v in p['attributes'].items():
            if k.startswith('TEXCOORD_'):
                uv = accessor(v); r = rng.setdefault((mi, int(k[9:])), [1e9, -1e9]); r[0] = min(r[0], uv.min()); r[1] = max(r[1], uv.max())

COLOR = {'baseColorTexture', 'emissiveTexture', 'specularColorTexture', 'sheenColorTexture'}
def slots(m):
    # every texture reference of a material: the core ones and those inside its extensions (Blender writes
    # KHR_materials_specular's specularTexture, for one)
    pbr = m.get('pbrMetallicRoughness', {})
    out = [(pbr, 'baseColorTexture'), (pbr, 'metallicRoughnessTexture'), (m, 'normalTexture'), (m, 'occlusionTexture'), (m, 'emissiveTexture')]
    for e in m.get('extensions', {}).values():
        out += [(e, k) for k, v in e.items() if k.endswith('Texture') and isinstance(v, dict)]
    return [('color' if k in COLOR else 'data', h, k) for h, k in out]
use = {}
for mi, m in enumerate(J['materials']):
    for kind, holder, key in slots(m):
        ti = holder.get(key)
        if ti: use.setdefault(J['textures'][ti['index']]['source'], []).append((mi, kind, ti))

def load(i):
    im = J['images'][i]; bv = J['bufferViews'][im['bufferView']]; o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(B[o:o + bv['byteLength']]))
groups = {}
for img, us in use.items():
    kinds = {u[1] for u in us}
    inside = all(-0.01 <= rng.get((u[0], u[2].get('texCoord', 0)), [0, 1])[0] and rng.get((u[0], u[2].get('texCoord', 0)), [0, 1])[1] <= 1.01
                 and 'KHR_texture_transform' not in u[2].get('extensions', {}) for u in us)
    if not inside or len(kinds) != 1: continue
    pic = load(img); alpha = pic.mode in ('RGBA', 'LA') or (pic.mode == 'P' and 'transparency' in pic.info)
    if alpha:
        a = np.asarray(pic.convert('RGBA'))[..., 3]; alpha = a.min() < 250
    groups.setdefault((kinds.pop(), bool(alpha)), []).append((img, pic))

# guillotine packing into sheets SHEET wide and tall (cells: the image plus its gutter)
def pack(items):
    sheets = []
    for img, pic in sorted(items, key=lambda t: -t[1].size[0] * t[1].size[1]):
        w, h = pic.size[0] + 2 * G, pic.size[1] + 2 * G
        for sh in sheets + [None]:
            if sh is None: sh = {'free': [(0, 0, SHEET, SHEET)], 'cells': []}; sheets.append(sh)
            best = None
            for k, (x, y, fw, fh) in enumerate(sh['free']):
                if w <= fw and h <= fh:
                    score = min(fw - w, fh - h)
                    if best is None or score < best[0]: best = (score, k)
            if best is None: continue
            x, y, fw, fh = sh['free'].pop(best[1])
            # split the rest along the shorter leftover
            if fw - w < fh - h: sh['free'] += [(x + w, y, fw - w, h), (x, y + h, fw, fh - h)]
            else: sh['free'] += [(x + w, y, fw - w, fh), (x, y + h, w, fh - h)]
            sh['free'] = [r for r in sh['free'] if r[2] > 0 and r[3] > 0]
            sh['cells'].append((img, pic, x, y)); break
    return sheets

new_images, cell_of = [], {}
out_bv = []   # (bytes, mime) for the sheets
for (kind, alpha), items in groups.items():
    for sh in pack(items):
        W = max(x + p.size[0] + 2 * G for _, p, x, y in sh['cells']); H = max(y + p.size[1] + 2 * G for _, p, x, y in sh['cells'])
        W, H = -(-W // 4) * 4, -(-H // 4) * 4
        mode = 'RGBA' if alpha else 'RGB'
        canvas = np.zeros((H, W, 4 if alpha else 3), np.uint8)
        for img, pic, x, y in sh['cells']:
            a = np.asarray(pic.convert(mode))
            canvas[y:y + a.shape[0] + 2 * G, x:x + a.shape[1] + 2 * G] = np.pad(a, ((G, G), (G, G), (0, 0)), mode='edge')
            cell_of[img] = (len(new_images), (x + G) / W, (y + G) / H, pic.size[0] / W, pic.size[1] / H)
        buf = io.BytesIO()
        if alpha: Image.fromarray(canvas, mode).save(buf, 'PNG', optimize=True); mime = 'image/png'
        else: Image.fromarray(canvas, mode).save(buf, 'JPEG', quality=93, subsampling=0 if kind == 'data' else 2); mime = 'image/jpeg'
        new_images.append((buf.getvalue(), mime, f'atlas_{kind}{"_alpha" if alpha else ""}_{len(new_images)}'))
        print(f'sheet {kind}{" alpha" if alpha else ""} {W}x{H}: {len(sh["cells"])} maps, {len(buf.getvalue()) / 1e6:.1f} MB')

# rebuild: images (kept ones, then the sheets), textures, the materials' references, and the binary buffer
used_imgs = {J['textures'][t]['source'] for m in J['materials'] for _, h, k in slots(m) if h.get(k) for t in [h[k]['index']]}
kept_imgs = [i for i in range(len(J['images'])) if i in used_imgs and i not in cell_of]
img_map = {old: k for k, old in enumerate(kept_imgs)}
J.setdefault('samplers', []).append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}); clamp = len(J['samplers']) - 1
old_tex = J['textures']; new_tex, tex_map = [], {}
for t, tx in enumerate(old_tex):
    if tx['source'] in img_map: tex_map[t] = len(new_tex); new_tex.append({**tx, 'source': img_map[tx['source']]})
sheet_tex = []
for k in range(len(new_images)): sheet_tex.append(len(new_tex)); new_tex.append({'sampler': clamp, 'source': len(kept_imgs) + k})
for m in J['materials']:
    for _, holder, key in slots(m):
        ti = holder.get(key)
        if not ti: continue
        src = old_tex[ti['index']]['source']
        if src in cell_of:
            s, ox, oy, sx, sy = cell_of[src]
            ti['index'] = sheet_tex[s]; ti.setdefault('extensions', {})['KHR_texture_transform'] = {'offset': [ox, oy], 'scale': [sx, sy]}
        else: ti['index'] = tex_map[ti['index']]
J['textures'] = new_tex
ext = J.setdefault('extensionsUsed', [])
if 'KHR_texture_transform' not in ext: ext.append('KHR_texture_transform')

drop_bv = {J['images'][i]['bufferView'] for i in range(len(J['images'])) if i not in img_map and 'bufferView' in J['images'][i]}
nb, bvs, bv_map = bytearray(), [], {}
for k, bv in enumerate(J['bufferViews']):
    if k in drop_bv: continue
    o = bv.get('byteOffset', 0); data = B[o:o + bv['byteLength']]
    while len(nb) % 4: nb.append(0)
    bv_map[k] = len(bvs); bvs.append({**bv, 'byteOffset': len(nb)}); nb += data
images = []
for i in kept_imgs: images.append({**J['images'][i], 'bufferView': bv_map[J['images'][i]['bufferView']]})
for data, mime, name in new_images:
    while len(nb) % 4: nb.append(0)
    bvs.append({'buffer': 0, 'byteOffset': len(nb), 'byteLength': len(data)}); nb += data
    images.append({'name': name, 'mimeType': mime, 'bufferView': len(bvs) - 1})
for a in J['accessors']:
    if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
    sp = a.get('sparse')
    if sp: sp['indices']['bufferView'] = bv_map[sp['indices']['bufferView']]; sp['values']['bufferView'] = bv_map[sp['values']['bufferView']]
J['bufferViews'] = bvs; J['images'] = images
while len(nb) % 4: nb.append(0)
J['buffers'] = [{'byteLength': len(nb)}]
js = json.dumps(J, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(nb)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(nb)) + b'BIN\x00' + bytes(nb)
open(DST, 'wb').write(out)
print(f'{len(cell_of)} maps into {len(new_images)} sheets; {len(kept_imgs)} images left as they were; {len(f) / 1e6:.1f} -> {len(out) / 1e6:.1f} MB')
