"""Game-ready conifers built in Blender from Poly Haven's scanned fir twig atlas + pine bark (CC0).
Trunk: tapered generalized cylinder with root flare, bark UVs in metres. Crown: whorls of drooping branches,
each carrying alpha-tested twig cards (sprites detected automatically from the atlas alpha), plus dead stubs.
Variants: tall pines (high crown), firs (conical), and understory saplings. LOD0 + LOD1.
usage: python build_conifers.py <polyhaven_dl_dir> <out_dir>"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler, noise
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- twig sprites from the alpha atlas
def find_sprites(alpha_path, size=512):
    a = np.asarray(Image.open(alpha_path).convert('L').resize((size, size))) > 110
    lab = np.zeros(a.shape, np.int32); n = 0; boxes = []
    for y in range(size):
        for x in range(size):
            if a[y, x] and not lab[y, x]:
                n += 1; stack = [(y, x)]; lab[y, x] = n; ys, xs = [], []
                while stack:
                    cy, cx = stack.pop(); ys.append(cy); xs.append(cx)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < size and 0 <= xx < size and a[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; stack.append((yy, xx))
                x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                area = len(xs)
                if area < 300 or x0 <= 2 or y0 <= 2 or x1 >= size - 3 or y1 >= size * 0.86: continue
                if (x1 - x0) > size * 0.45 or (y1 - y0) < size * 0.06: continue
                boxes.append((x0 / size, y0 / size, (x1 + 1) / size, (y1 + 1) / size, area))
    boxes.sort(key=lambda b: -b[4])
    return boxes

SPRITES = find_sprites(f'{SRC}/tex/fir_tree_01/twig_alpha_2k.jpg')
print('twig sprites:', len(SPRITES), [tuple(round(v, 2) for v in b[:4]) for b in SPRITES])
BIG = [s for s in SPRITES if (s[3] - s[1]) > 0.2] or SPRITES
SMALL = [s for s in SPRITES if s not in BIG] or SPRITES

# ---------------------------------------------------------------- mesh builders
class MB:
    def __init__(self): self.v, self.uv, self.f = [], [], []
    def quad(self, a, b, c, d, uvs):
        i = len(self.v); self.v += [a, b, c, d]; self.uv += uvs; self.f.append((i, i + 1, i + 2, i + 3))
    def obj(self, name, mat):
        me = bpy.data.meshes.new(name); me.from_pydata([tuple(p) for p in self.v], [], self.f)
        ul = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices: ul.data[li].uv = self.uv[me.loops[li].vertex_index]
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(bpy.data.materials.get(mat) or bpy.data.materials.new(mat))
        return ob

def tube(mb_v, mb_f, mb_uv, spine, rfn, radial, tile=1.2):
    """append a generalized cylinder to raw lists; UVs in metres / tile"""
    n = len(spine)
    tang = [(spine[min(n - 1, i + 1)] - spine[max(0, i - 1)]).normalized() for i in range(n)]
    up = Vector((1, 0, 0)) if abs(tang[0].z) > 0.9 else Vector((0, 0, 1))
    nrm = tang[0].cross(up).normalized(); frames = []
    for i in range(n):
        if i:
            ax = tang[i - 1].cross(tang[i])
            if ax.length > 1e-6: nrm = (Matrix.Rotation(tang[i - 1].angle(tang[i]), 3, ax.normalized()) @ nrm).normalized()
        frames.append((nrm.copy(), tang[i].cross(nrm).normalized()))
    base = len(mb_v); L = 0.0
    r0 = rfn(0, 0); k = max(1, round(2 * math.pi * r0 / tile))
    for i in range(n):
        if i: L += (spine[i] - spine[i - 1]).length
        t = i / (n - 1); N_, Bn = frames[i]
        for j in range(radial + 1):
            th = j / radial * 2 * math.pi
            mb_v.append(spine[i] + (N_ * math.cos(th) + Bn * math.sin(th)) * rfn(t, th))
            mb_uv.append((j / radial * k, L / tile))
    for i in range(n - 1):
        for j in range(radial):
            a = base + i * (radial + 1) + j
            mb_f.append((a, a + 1, a + radial + 2, a + radial + 1))

def twig_card(mb, base, direction, side_hint, length, sprite, droop=0.15, fold=0.35, rnd=None):
    """V-folded card: sprite stem at base, tip along `direction`."""
    x0, y0, x1, y1 = sprite[:4]
    aspect = (x1 - x0) / max(1e-6, (y1 - y0))
    w = length * aspect
    d = direction.normalized()
    s = d.cross(side_hint); s = s.normalized() if s.length > 1e-6 else Vector((1, 0, 0))
    up = s.cross(d).normalized()
    tip = base + d * length - up * droop * length
    mid_b, mid_t = base, tip
    # uv: v=1 top of image (glTF flips later); stem at bottom of sprite
    u0, u1, uc = x0, x1, (x0 + x1) / 2
    vb, vt = 1 - y1, 1 - y0
    lift = up * fold * w * 0.5
    lb = base - s * w * 0.5 + lift; rb = base + s * w * 0.5 + lift
    lt = tip - s * w * 0.5 + lift; rt = tip + s * w * 0.5 + lift
    mb.quad(lb, mid_b, mid_t, lt, [(u0, vb), (uc, vb), (uc, vt), (u0, vt)])
    mb.quad(mid_b, rb, rt, mid_t, [(uc, vb), (u1, vb), (u1, vt), (uc, vt)])

R0_LAST = [0.0]
def make_conifer(name, kind, seed, lod=0):
    rnd = random.Random(seed)
    if kind == 'pine':
        H = rnd.uniform(16, 24); R0 = rnd.uniform(0.26, 0.46); crown0 = rnd.uniform(0.55, 0.7)
    elif kind == 'snag':
        H = rnd.uniform(7, 13); R0 = rnd.uniform(0.24, 0.34); crown0 = 2.0
    elif kind == 'fir':
        H = rnd.uniform(10, 14); R0 = rnd.uniform(0.22, 0.32); crown0 = rnd.uniform(0.1, 0.18)
    else:  # sapling
        H = rnd.uniform(0.9, 2.6); R0 = H * 0.012 + 0.008; crown0 = 0.02
    rings = [40, 14][lod] if kind != 'sapling' else [10, 6][lod]
    radial = [18, 9][lod] if kind != 'sapling' else 6
    # real stems are never plumb lines: a lean (up to ~2.5 deg), a butt sweep near the ground that bends back
    # toward vertical, and small kinks along the bole
    la = rnd.uniform(0, 6.28)
    lean = Vector((math.cos(la), math.sin(la), 0)) * (rnd.uniform(0.01, 0.045) * H if kind != 'sapling' else 0.012 * H)
    sweep = -lean.normalized() * (rnd.uniform(0.05, 0.16) if kind in ('pine', 'snag') else 0.03) if kind != 'sapling' else Vector()
    spine = []
    for i in range(rings):
        t = (i / (rings - 1)) ** 1.25
        z = t * H
        kink = 0.03 + 0.004 * z if kind != 'sapling' else 0.01 * H
        wob = Vector((noise.noise(Vector((t * 5.0, seed, 0))), noise.noise(Vector((0, t * 5.0, seed))), 0)) * kink
        spine.append(Vector((0, 0, z - (0.3 if kind != 'sapling' else 0.02))) + lean * t ** 1.5 + sweep * (1 - math.exp(-z / 1.6)) + wob)
    nb = rnd.randint(5, 7); ths = [i / nb * 2 * math.pi + rnd.uniform(-0.3, 0.3) for i in range(nb)]
    def rfn(t, th):
        z = t * H
        if kind == 'pine':  # slow taper along the clear bole, faster inside the crown
            r = R0 * ((1 - 0.42 * t) if t < crown0 else (1 - 0.42 * crown0) * (1 - 0.92 * ((t - crown0) / (1 - crown0)) ** 0.85))
        else:
            r = R0 * (1 - (0.45 if kind == 'snag' else 0.88) * t ** 0.9)
        if kind == 'snag' and t > 0.97: r *= 0.6 + 0.4 * abs(math.sin(th * 3 + seed))  # splintered break
        if kind != 'sapling':
            fl = math.exp(-z / 0.7)
            b = sum(max(0.0, math.cos(th - a)) ** 8 for a in ths)
            r *= 1 + fl * (0.45 + 0.9 * b)
            r *= 1 + 0.035 * noise.noise(Vector((math.cos(th) * 2.5, math.sin(th) * 2.5, z * 1.3 + seed)))
        return max(r, 0.004)
    bv, bf, buv = [], [], []
    tube(bv, bf, buv, spine, rfn, radial)
    n_trunk = len(bv)
    cards = MB()
    def trunk_at(h):
        t = min(1, max(0, (h + 0.3) / H)); i = t * (rings - 1); i0 = int(min(rings - 2, i)); f = i - i0
        return spine[i0].lerp(spine[i0 + 1], f), rfn(t, 0)
    # self-pruned lower bole: whorls of dead branches (longer and more complete toward the crown, broken to
    # stubs and knots lower down) with bare side twigs; every LOD keeps them, they are what the eye reads
    if kind in ('pine', 'snag'):
        z = rnd.uniform(1.0, 1.8); top = min(crown0, 0.95) * H
        while z < top:
            p, r = trunk_at(z); u = z / top
            nw = rnd.randint(2, 5) if lod == 0 else rnd.randint(2, 4)
            a0 = rnd.uniform(0, 6.28)
            for k in range(nw):
                a = a0 + k / nw * 6.28 + rnd.uniform(-0.4, 0.4)
                stub = rnd.random() > 0.25 + 0.6 * u            # low on the stem most have snapped off
                up = rnd.uniform(0.05, 0.4) if stub else rnd.uniform(-0.15, 0.3)
                d = Vector((math.cos(a), math.sin(a), up)).normalized()
                L = rnd.uniform(0.05, 0.28) if stub else rnd.uniform(0.45, 0.8 + 1.2 * u)
                br = rnd.uniform(0.02, 0.034) + 0.014 * u
                seg = 2 if (stub or lod) else 4
                pts = [p + d * (r * 0.85 + L * (i / seg)) - Vector((0, 0, 0.12 * L * (i / seg) ** 2)) for i in range(seg + 1)]
                tube(bv, bf, buv, pts, lambda t, th, br=br, stub=stub: br * (1 - (0.35 if stub else 0.88) * t), 5 if lod == 0 else 4, tile=0.5)
                if not stub:
                    for tw in range(rnd.randint(4, 8) if lod == 0 else rnd.randint(1, 2)):
                        f = rnd.uniform(0.3, 0.9); i0 = min(seg - 1, int(f * seg)); bp = pts[i0].lerp(pts[i0 + 1], f * seg - i0)
                        side = d.cross(Vector((0, 0, 1))).normalized() * (1 if tw % 2 else -1)
                        td = (d * 0.6 + side * 0.8 + Vector((0, 0, rnd.uniform(-0.3, 0.2)))).normalized()
                        tl = rnd.uniform(0.12, 0.42) * (1.25 - f) * (1 if lod == 0 else 1.3)
                        tube(bv, bf, buv, [bp, bp + td * tl * 0.5, bp + td * tl - Vector((0, 0, 0.03 * tl))],
                             lambda t, th, tr=br * 0.4: max(0.003, tr * (1 - 0.8 * t)), 3, tile=0.4)
            z += rnd.uniform(0.3, 0.6)
    # living crown: whorls
    z = crown0 * H
    step = 0.55 if kind != 'sapling' else 0.16 * H / 1.5
    while z < H * 0.97:
        t = z / H
        p, r = trunk_at(z)
        nwh = rnd.randint(4, 6) if kind != 'sapling' else rnd.randint(3, 5)
        if kind == 'pine': L = (0.6 + 2.4 * math.sin(math.pi * min(1, (t - crown0) / (1 - crown0) * 0.9 + 0.1))) * rnd.uniform(0.8, 1.1)
        else: L = (1 - t) * (0.42 * H if kind == 'fir' else 0.45 * H) + 0.1 * H * 0.1
        rot0 = rnd.uniform(0, 6.28)
        for k in range(nwh):
            a = rot0 + k / nwh * 2 * math.pi + rnd.uniform(-0.25, 0.25)
            up_ang = (0.12 if kind == 'pine' else -0.05) + rnd.uniform(-0.1, 0.1)
            d = Vector((math.cos(a), math.sin(a), up_ang)).normalized()
            seg = 6 if lod == 0 else 3
            pts = []
            for s in range(seg + 1):
                u = s / seg
                droop = (0.22 if kind != 'pine' else 0.12) * L * u * u
                pts.append(p + d * (r * 0.7 + L * u) - Vector((0, 0, droop)))
            br = max(0.006, (0.05 if kind == 'pine' else 0.035) * (L / 2.5)) if kind != 'sapling' else 0.004 + 0.006 * L
            if lod == 0 or kind != 'sapling':
                tube(bv, bf, buv, pts, lambda tt, th, br=br: br * (1 - 0.85 * tt), 5 if lod == 0 else 4)
            # twig cards along the branch (denser toward the tip), alternating sides
            ncard = max(2, int(L * (10.5 if lod == 0 else 4.8) * (1.0 if kind != 'sapling' else 2.2)))
            for c in range(ncard):
                u = 0.15 + 0.85 * (c + rnd.random() * 0.5) / ncard
                i0 = min(seg - 1, int(u * seg)); f = u * seg - i0
                bp = pts[i0].lerp(pts[i0 + 1], f)
                bd = (pts[i0 + 1] - pts[i0]).normalized()
                side = 1 if c % 2 else -1
                sd = bd.cross(Vector((0, 0, 1))).normalized() * side
                dirc = (bd * 0.55 + sd * 0.8 + Vector((0, 0, rnd.uniform(-0.1, 0.25)))).normalized()
                clen = (0.4 + 0.55 * rnd.random()) * (0.55 if kind == 'sapling' else 1.0) * min(1.3, 0.55 + L * 0.38)
                twig_card(cards, bp, dirc, Vector((0, 0, 1)), clen, rnd.choice(BIG if clen > 0.4 else SMALL), droop=0.18, fold=0.35, rnd=rnd)
            # tip card continues the branch
            twig_card(cards, pts[-1], d + Vector((0, 0, 0.05)), Vector((0, 0, 1)), 0.45 * (0.6 if kind == 'sapling' else 1), rnd.choice(BIG), droop=0.2, rnd=rnd)
        z += step * rnd.uniform(0.8, 1.2)
    # leader at the top
    top = spine[-1]
    twig_card(cards, top - Vector((0, 0, 0.3 if kind != 'sapling' else 0.08)), Vector((0.05, 0.02, 1)), Vector((1, 0, 0)), 0.8 if kind != 'sapling' else 0.25, rnd.choice(BIG), droop=0.02)
    R0_LAST[0] = R0
    bark = MB(); bark.v, bark.f, bark.uv = bv, bf, buv
    bo = bark.obj(f'{name}_bark', 'BarkSnag' if kind == 'snag' else 'Bark')
    # bark colour by position (multiplies the scanned bark): pines have thick dark grey-brown plates low on the
    # stem and thin orange flaking bark higher up; dead and living branches are weathered grey; snags bleached
    def tint(i, co):
        if kind == 'snag': return (0.8, 0.79, 0.78)
        if i >= n_trunk: return (0.7, 0.68, 0.67)
        if kind == 'pine':
            k = min(1.0, max(0.0, (co.z - 3.0 - 2.0 * noise.noise(Vector((co.x * 0.7, co.y * 0.7, co.z * 0.25 + seed)))) / 6.5))
            k = k * k * (3 - 2 * k)
            low, high = (0.62, 0.6, 0.58), (0.92, 0.64, 0.44)
            return tuple(low[c] + (high[c] - low[c]) * k for c in range(3))
        return (0.72, 0.68, 0.64)
    bo['tints'] = [c for i, v in enumerate(bo.data.vertices) for c in tint(i, v.co)]
    if kind == 'snag':
        return bo, None, H
    co = cards.obj(f'{name}_twigs', 'Twig')
    zs = [v.co.z for v in co.data.vertices]
    zmid = (min(zs) + max(zs)) / 2 if zs else H * 0.7
    nrm = []
    for v in co.data.vertices:
        d = Vector((v.co.x, v.co.y, (v.co.z - zmid) * 0.55))
        if d.length < 1e-4: d = Vector((0, 0, 1))
        nrm.append((d.normalized() + Vector((0, 0, 0.35))).normalized())
    co.data.normals_split_custom_set_from_vertices(nrm)
    return bo, co, H

def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True, export_normals=True,
                              export_vertex_color='ACTIVE')

def bake_ao(ob):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
    sc.world = bpy.data.worlds.new('W')
    try: sc.world.light_settings.distance = 1.0
    except Exception: pass
    ca = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

SPECS = [('pine', 11), ('pine', 22), ('pine', 33), ('pine', 44), ('fir', 55), ('fir', 66), ('sapling', 77), ('sapling', 88), ('sapling', 99), ('snag', 111), ('snag', 122)]
for i, (kind, seed) in enumerate(SPECS):
    for lod in ((0, 1) if kind != 'sapling' else (0,)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try: bpy.ops.preferences.addon_enable(module='cycles')
        except Exception: pass
        b, c, H = make_conifer(f'{kind}{i}', kind, seed, lod)
        if lod == 0: bake_ao(b)
        # vertex colour = baked AO x bark tint (LOD1 / saplings: tint only)
        me = b.data; tints = list(b['tints'])
        ca = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
        for li, loop in enumerate(me.loops):
            vi = loop.vertex_index; ao = ca.data[li].color[0] if lod == 0 else 1.0
            f = 1.0 - 0.6 * (1.0 - ao)   # AO goes into the albedo at partial strength (the game multiplies vertex colour)
            ca.data[li].color = (f * tints[vi * 3], f * tints[vi * 3 + 1], f * tints[vi * 3 + 2], 1)
        del b['tints']
        path = f'{OUT}/{kind}_{i}{"_lod1" if lod else ""}.glb'
        export([b] + ([c] if c else []), path)
        b.data.calc_loop_triangles()
        if c: c.data.calc_loop_triangles()
        print('TREE', os.path.basename(path), 'H=%.1f' % H, 'R0=%.3f' % R0_LAST[0], 'bark', len(b.data.loop_triangles), 'cards', len(c.data.loop_triangles) if c else 0, round(os.path.getsize(path) / 1e6, 2), 'MB')
