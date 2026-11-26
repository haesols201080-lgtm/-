"""Re-encodes the images embedded in small props' GLBs at a lower resolution (a 20 cm object does not need 1k maps).
usage: python tools/shrink_glb_textures.py <max_px> file.glb ..."""
import sys, io, json, struct
from PIL import Image
MAX = int(sys.argv[1])
for p in sys.argv[2:]:
    b = open(p, 'rb').read(); off = 12; js = None; bin_ = b''
    while off < len(b):
        ln, typ = struct.unpack_from('<II', b, off); ch = b[off + 8: off + 8 + ln]; off += 8 + ln
        if typ == 0x4E4F534A: js = json.loads(ch)
        elif typ == 0x004E4942: bin_ = ch
    views = [bin_[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']] for bv in js['bufferViews']]
    before = len(b)
    for im in js.get('images', []):
        if 'bufferView' not in im: continue
        I = Image.open(io.BytesIO(views[im['bufferView']])); I.load()
        if max(I.size) <= MAX: continue
        k = MAX / max(I.size); I = I.resize((max(1, round(I.size[0] * k)), max(1, round(I.size[1] * k))), Image.LANCZOS)
        buf = io.BytesIO()
        if im.get('mimeType') == 'image/png': I.save(buf, 'PNG', optimize=True)
        else: I.convert('RGB').save(buf, 'JPEG', quality=86)
        views[im['bufferView']] = buf.getvalue()
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4: out.append(0)
        js['bufferViews'][i]['byteOffset'] = len(out); js['bufferViews'][i]['byteLength'] = len(data); out += data
    while len(out) % 4: out.append(0)
    js['buffers'] = [{'byteLength': len(out)}]
    j = json.dumps(js, separators=(',', ':')).encode(); j += b' ' * ((4 - len(j) % 4) % 4)
    with open(p, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(out)))
        f.write(struct.pack('<II', len(j), 0x4E4F534A)); f.write(j); f.write(struct.pack('<II', len(out), 0x004E4942)); f.write(out)
    print('shrunk', p, round(before / 1e6, 2), '->', round((20 + len(j) + 8 + len(out)) / 1e6, 2), 'MB')
