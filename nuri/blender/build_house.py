"""The stranger's house (chapter 2), built as architecture in Blender: a two-storey side-gabled house in Queens with
a front porch, a back deck and a fenced yard. Real wall thickness; double-hung windows with sashes, muntins,
casings, sills and stools; six-panel doors in cased jambs; a straight staircase with nosed oak treads, painted
risers, a skirt board and stringer, square balusters, a moulded handrail and newel posts; baseboards and crown
moulding; a brick fireplace with a painted mantel; cast-iron radiators; a shaker kitchen. Outside: lap siding,
corner boards, a shingled roof with fascia, soffits, gutters and downspouts, a brick chimney, the porch with columns
and railings, the deck, the fence, the driveway.
Same frame and numbers as src/flat.js (x east, y up, z south; the street is north; metres).
Materials are named and plain-coloured here: the game puts the scanned textures on them by name (UV0 is in metres).
UV1 is a lightmap atlas; with --bake the night lighting (street lamps, porch lamp, night lights, the light over the
stove, the city sky; not the moon, which stays real-time) is baked into it with Cycles.
usage: python build_house.py <out_dir> [--bake] [--samples N] [--size N] [--preview]"""
import bpy, bmesh, math, os, sys, json, random
from mathutils import Vector, Matrix

ARGS = sys.argv[1:]
OUT = ARGS[0] if ARGS else '/tmp/house_out'
FLAGS = set(a for a in ARGS[1:] if a.startswith('--'))
def opt(name, dflt):
    return type(dflt)(ARGS[ARGS.index(name) + 1]) if name in ARGS else dflt
os.makedirs(OUT, exist_ok=True)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RND = random.Random(11)

X0, X1, Z0, Z1, T = -5.0, 5.0, -4.0, 4.0, 0.14
HG, U, H2 = 2.75, 2.95, 2.6
TOP = U + H2
PART, KZ, HZ = 1.6, 0.2, 1.2
ST = dict(x0=3.85, x1=5.0, zTop=-3.0, zBot=0.75, n=15)
GRADE, DECK = -0.6, -0.06
PITCH = 8 / 12
EAVE, RAKE = 0.35, 0.25

# ------------------------------------------------------------------------------------------------ materials
PAL = {  # name: (base colour, roughness, metallic)
    'wall_paint': ((0.78, 0.74, 0.67), 0.92), 'wall_bed': ((0.60, 0.64, 0.66), 0.92), 'wall_kit': ((0.80, 0.76, 0.63), 0.9),
    'ceiling': ((0.85, 0.84, 0.81), 0.95), 'trim': ((0.87, 0.86, 0.83), 0.4), 'oak': ((0.42, 0.27, 0.16), 0.45),
    'tread': ((0.33, 0.2, 0.11), 0.4), 'rail': ((0.26, 0.15, 0.08), 0.35), 'tile': ((0.74, 0.73, 0.70), 0.35),
    'splash': ((0.82, 0.82, 0.80), 0.2), 'brick': ((0.34, 0.2, 0.16), 0.9), 'soot': ((0.025, 0.022, 0.02), 1.0),
    'hearth': ((0.30, 0.28, 0.26), 0.7), 'siding': ((0.76, 0.78, 0.77), 0.55), 'ext_trim': ((0.88, 0.88, 0.86), 0.45),
    'shutter': ((0.05, 0.06, 0.06), 0.5), 'shingle': ((0.16, 0.16, 0.17), 0.9), 'concrete': ((0.46, 0.45, 0.43), 0.9),
    'foundation': ((0.50, 0.49, 0.47), 0.95), 'deck': ((0.34, 0.27, 0.2), 0.8), 'porch_floor': ((0.27, 0.30, 0.33), 0.6),
    'door_front': ((0.22, 0.05, 0.045), 0.35), 'door': ((0.86, 0.85, 0.82), 0.4), 'iron': ((0.62, 0.62, 0.6), 0.45, 0.3),
    'cabinet': ((0.80, 0.81, 0.77), 0.4), 'counter': ((0.42, 0.41, 0.39), 0.22), 'steel': ((0.62, 0.62, 0.62), 0.25, 1.0),
    'brass': ((0.70, 0.55, 0.3), 0.3, 1.0), 'black_metal': ((0.035, 0.035, 0.035), 0.45, 0.5), 'glass': ((0.8, 0.85, 0.88), 0.05),
    'lawn': ((0.09, 0.13, 0.06), 1.0), 'gutter': ((0.86, 0.86, 0.84), 0.4), 'shade': ((0.84, 0.80, 0.70), 0.9),
    'curtain': ((0.62, 0.56, 0.47), 0.9), 'bed_wood': ((0.22, 0.13, 0.08), 0.45), 'linen': ((0.78, 0.77, 0.74), 0.9),
    'rug': ((0.45, 0.30, 0.24), 1.0), 'rug_bed': ((0.55, 0.52, 0.46), 1.0), 'fridge': ((0.86, 0.86, 0.84), 0.25),
    'fence': ((0.40, 0.33, 0.25), 0.9), 'asphalt': ((0.08, 0.08, 0.08), 0.85), 'lamp_glass': ((1.0, 0.85, 0.6), 0.2),
    'sheathing': ((0.2, 0.2, 0.2), 1.0), 'vent': ((0.75, 0.75, 0.73), 0.5), 'flue': ((0.45, 0.25, 0.18), 0.8),
    'mattress': ((0.80, 0.79, 0.76), 0.9), 'runner': ((0.36, 0.12, 0.1), 1.0), 'sisal': ((0.62, 0.52, 0.36), 1.0), 'carpet_grey': ((0.42, 0.42, 0.42), 1.0),
    'plastic_white': ((0.88, 0.88, 0.86), 0.35), 'plastic_dark': ((0.06, 0.06, 0.065), 0.4), 'enamel': ((0.9, 0.9, 0.88), 0.2), 'dust': ((0.55, 0.53, 0.5), 1.0), 'sock': ((0.2, 0.25, 0.4), 1.0), 'beadboard': ((0.86, 0.87, 0.85), 0.5), 'lattice': ((0.85, 0.85, 0.83), 0.6),
}
# the scanned texture sets (Poly Haven, CC0) on the named materials: (set, tile in metres, sRGB tint, normal strength,
# roughness factor). The game builds the same materials from house_mats.json.
TEX = {
    'wall_paint': ('hs_paint', 1.5, 0xe9e2d5, 0.6, 1.0), 'wall_bed': ('hs_paint', 1.5, 0xc2cbcf, 0.6, 1.0), 'wall_kit': ('hs_paint', 1.5, 0xf0e5ca, 0.6, 1.0),
    'ceiling': ('hs_stucco', 1.2, 0xf5f2eb, 0.4, 1.0), 'trim': ('hs_paint', 0.45, 0xf3f0e9, 0.25, 0.45), 'door': ('hs_paint', 0.45, 0xf1eee7, 0.25, 0.45),
    'cabinet': ('hs_paint', 0.45, 0xe8eae2, 0.25, 0.45), 'beadboard': ('hs_paint', 0.45, 0xf2f3ef, 0.25, 0.5), 'ext_trim': ('hs_paint', 0.5, 0xf6f5f1, 0.3, 0.55),
    'siding': ('hs_paint', 0.8, 0xe6ebe9, 0.4, 0.6), 'shutter': ('hs_paint', 0.5, 0x1f2626, 0.3, 0.55), 'door_front': ('hs_paint', 0.45, 0x6c1c15, 0.25, 0.4),
    'porch_floor': ('hs_paint', 0.6, 0x5b656d, 0.4, 0.7), 'oak': ('hs_oak', 1.4, 0xd9c0a4, 1.0, 1.0), 'tread': ('hs_stain', 0.9, 0xb89274, 0.8, 0.8),
    'rail': ('hs_stain', 0.6, 0x8a5e3e, 0.6, 0.7), 'bed_wood': ('hs_veneer', 0.8, 0xc8a890, 0.6, 0.7), 'deck': ('hs_stain', 1.0, 0x9e8a76, 1.0, 1.0),
    'fence': ('hs_stain', 1.0, 0x8e7e6e, 1.0, 1.0), 'tile': ('hs_lino', 1.2, 0xffffff, 0.8, 1.0), 'splash': ('hs_subway', 0.6, 0xffffff, 1.0, 1.0),
    'counter': ('hs_marble', 1.0, 0xffffff, 0.6, 0.6), 'brick': ('hs_brick', 0.9, 0xc49484, 1.0, 1.0), 'hearth': ('hs_pavement', 0.8, 0x9a958f, 1.0, 1.0),
    'concrete': ('hs_pavement', 1.6, 0xc2beb6, 1.0, 1.0), 'foundation': ('hs_pavement', 1.2, 0xb8b4ac, 1.0, 1.0), 'shingle': ('hs_roof', 1.2, 0xa6a6a6, 1.0, 1.0),
    'lawn': ('hs_lawn', 2.0, 0x8c9c76, 1.0, 1.0), 'shade': ('hs_linen', 0.5, 0xeee6d2, 1.0, 1.0), 'curtain': ('hs_jacquard', 0.6, 0xd6c8ae, 0.8, 1.0),
    'linen': ('hs_linen', 0.5, 0xe4e1da, 1.0, 1.0), 'mattress': ('hs_linen', 0.5, 0xf3f0ea, 0.8, 1.0), 'duvet': ('hs_linen', 0.45, 0xb9c4cf, 1.0, 1.0),
    'throw': ('hs_jacquard', 0.4, 0xa07a5c, 1.0, 1.0), 'knit': ('hs_linen', 0.25, 0x8a8f7c, 1.2, 1.0), 'jeans': ('hs_denim', 0.35, 0xffffff, 1.0, 1.0),
    'towel': ('hs_linen', 0.3, 0xd9b48c, 1.2, 1.0), 'coat': ('hs_linen', 0.3, 0x3a3d36, 1.0, 1.0), 'rug': ('hs_carpet', 0.9, 0xc09a86, 1.0, 1.0),
    'rug_bed': ('hs_rug', 0.8, 0xdcd3c4, 1.0, 1.0), 'runner': ('hs_carpet', 0.6, 0xb5584a, 1.0, 1.0), 'carpet_grey': ('hs_rug', 0.6, 0xa4a4a4, 1.0, 1.0),
    'lattice': ('hs_paint', 0.5, 0xf2f2ee, 0.3, 0.6), 'book_page': ('hs_linen', 0.1, 0xefe6d0, 0.5, 1.0),
}
def srgb(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)
PAL.update({'duvet': ((0.5, 0.55, 0.6), 0.95), 'throw': ((0.4, 0.25, 0.17), 1.0), 'knit': ((0.3, 0.32, 0.26), 1.0), 'jeans': ((0.2, 0.25, 0.4), 1.0),
            'towel': ((0.7, 0.45, 0.25), 1.0), 'coat': ((0.05, 0.055, 0.045), 0.9), 'book_page': ((0.85, 0.8, 0.68), 0.9), 'cover_red': ((0.35, 0.06, 0.05), 0.6),
            'cover_blue': ((0.05, 0.1, 0.25), 0.6), 'cover_green': ((0.08, 0.2, 0.12), 0.6), 'cover_tan': ((0.55, 0.42, 0.28), 0.6), 'cardboard': ((0.5, 0.36, 0.22), 0.95),
            'bin_plastic': ((0.62, 0.68, 0.72), 0.35), 'ceramic': ((0.85, 0.84, 0.8), 0.15), 'mug_blue': ((0.12, 0.22, 0.4), 0.2)})
TEXDIR = os.path.join(REPO, 'public', 'tex')
MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    c, r, *rest = PAL[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*c, 1.0); b.inputs['Roughness'].default_value = r
    b.inputs['Metallic'].default_value = rest[0] if rest else 0.0
    if name in TEX and '--flat' not in FLAGS:
        st, tile, tint, ns, rf = TEX[name]
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'
        mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1); nt.links.new(uv.outputs[0], mp.inputs[0])
        def img(kind, color):
            n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(TEXDIR, f'{st}_1024_{kind}.jpg'), check_existing=True)
            if not color: n.image.colorspace_settings.name = 'Non-Color'
            nt.links.new(mp.outputs[0], n.inputs[0]); n['__tex'] = 1; return n
        al = img('albedo', True); mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1.0
        nt.links.new(al.outputs[0], mix.inputs[6]); mix.inputs[7].default_value = (*srgb(tint), 1); nt.links.new(mix.outputs[2], b.inputs['Base Color']); mix['__tex'] = 1
        nm = img('normal', False); nn = nt.nodes.new('ShaderNodeNormalMap'); nn.inputs['Strength'].default_value = ns; nt.links.new(nm.outputs[0], nn.inputs['Color']); nt.links.new(nn.outputs[0], b.inputs['Normal']); nn['__tex'] = 1
        orm = img('orm', False); sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(orm.outputs[0], sp.inputs[0]); sp['__tex'] = 1
        ml = nt.nodes.new('ShaderNodeMath'); ml.operation = 'MULTIPLY'; ml.inputs[1].default_value = rf; nt.links.new(sp.outputs[1], ml.inputs[0]); nt.links.new(ml.outputs[0], b.inputs['Roughness']); ml['__tex'] = 1
        b.inputs['Base Color'].default_value = (*srgb(tint), 1.0)
    MATS[name] = m
    return m

def strip_textures():
    """before export: the arch materials lose their images (the game puts its own on by name), keeping their tint"""
    for name, m in MATS.items():
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.get('__tex') or n.type in ('UVMAP', 'MAPPING'): nt.nodes.remove(n)
    json.dump({k: {'set': v[0], 'tile': v[1], 'tint': v[2], 'normal': v[3], 'rough': v[4]} for k, v in TEX.items()} | {k: {'color': '#%02x%02x%02x' % tuple(int(255 * ((x ** (1 / 2.4)) * 1.055 - 0.055 if x > 0.0031308 else x * 12.92) + 0.5) for x in v[0]), 'rough': v[1], 'metal': (v[2] if len(v) > 2 else 0)} for k, v in PAL.items() if k not in TEX},
              open(os.path.join(OUT, 'house_mats.json'), 'w'), indent=0)

# ------------------------------------------------------------------------------------------------ geometry
def bl(p):  # three.js frame -> Blender frame
    return Vector((p[0], -p[2], p[1]))

class Part:
    """one mesh object assembled from boxes, sweeps and polygons given in the three.js frame"""
    def __init__(self, name):
        self.name = name; self.bm = bmesh.new(); self.names = []
    def mi(self, m):
        if m not in self.names: self.names.append(m)
        return self.names.index(m)
    def _faces(self, verts):
        return list({f for v in verts for f in v.link_faces})
    def cube(self, M, m):
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        fs = self._faces(r['verts'])
        for f in fs: f.normal_update()
        for f in fs: f.material_index = self.mi(m) if isinstance(m, str) else self.mi(m(f))
        return fs
    def box(self, x0, y0, z0, x1, y1, z1, m):
        x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
        if x1 - x0 < 1e-4 or y1 - y0 < 1e-4 or z1 - z0 < 1e-4: return []
        M = Matrix.Translation(bl(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))) @ Matrix.Diagonal((x1 - x0, z1 - z0, y1 - y0, 1))
        return self.cube(M, m)
    def obox(self, c, size, m, ry=0.0, rx=0.0, rz=0.0, pivot=None):
        """a box of size (sx, sy, sz) centred at c, turned by ry about the vertical (about `pivot` if given)"""
        S = Matrix.Diagonal((size[0], size[2], size[1], 1))
        Rl = Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(-rz, 4, 'Y')   # (three x / z tilts)
        if pivot is None:
            M = Matrix.Translation(bl(c)) @ Matrix.Rotation(ry, 4, 'Z') @ Rl @ S
        else:
            M = Matrix.Translation(bl(pivot)) @ Matrix.Rotation(ry, 4, 'Z') @ Matrix.Translation(bl(c) - bl(pivot)) @ Rl @ S
        return self.cube(M, m)
    def poly(self, pts, m):
        vs = [self.bm.verts.new(bl(p)) for p in pts]
        f = self.bm.faces.new(vs); f.material_index = self.mi(m); return f
    def prism(self, pts, axis, a0, a1, m):
        """a 2D polygon extruded along an axis: pts are (u, v) in the plane across it - for axis 'x': (z, y); 'z': (x, y); 'y': (x, z)"""
        def P(u, v, a):
            return (a, v, u) if axis == 'x' else (u, v, a) if axis == 'z' else (u, a, v)
        n = len(pts)
        A = [self.bm.verts.new(bl(P(u, v, a0))) for u, v in pts]; B = [self.bm.verts.new(bl(P(u, v, a1))) for u, v in pts]
        fs = [self.bm.faces.new(A), self.bm.faces.new(B[::-1])]
        for i in range(n):
            j = (i + 1) % n
            fs.append(self.bm.faces.new([A[i], A[j], B[j], B[i]]))
        for f in fs: f.material_index = self.mi(m)
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def sweep(self, prof, A, B, Uv, Vv, m):
        """a closed 2D profile (u, v) swept from A to B; u along Uv, v along Vv (three.js vectors)"""
        A, B, Uv, Vv = Vector(A), Vector(B), Vector(Uv), Vector(Vv)
        ra = [self.bm.verts.new(bl(A + Uv * u + Vv * v)) for u, v in prof]
        rb = [self.bm.verts.new(bl(B + Uv * u + Vv * v)) for u, v in prof]
        fs = [self.bm.faces.new(ra), self.bm.faces.new(rb[::-1])]
        n = len(prof)
        for i in range(n):
            j = (i + 1) % n; fs.append(self.bm.faces.new([ra[i], ra[j], rb[j], rb[i]]))
        for f in fs: f.material_index = self.mi(m)
        bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs
    def cyl(self, c, r, h, m, seg=12, axis='y', r2=None):
        """a cylinder (or a cone frustum with r2) centred at c along an axis"""
        r2 = r if r2 is None else r2
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=r2, depth=h)
        rot = Matrix.Identity(4) if axis == 'y' else Matrix.Rotation(math.pi / 2, 4, 'Y') if axis == 'x' else Matrix.Rotation(math.pi / 2, 4, 'X')
        bmesh.ops.transform(self.bm, matrix=Matrix.Translation(bl(c)) @ rot, verts=res['verts'])
        for f in self._faces(res['verts']): f.material_index = self.mi(m)
    def finish(self, smooth_angle=None):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5) if False else None
        self.bm.to_mesh(me); self.bm.free()
        ob = bpy.data.objects.new(self.name, me); bpy.context.scene.collection.objects.link(ob)
        for n in self.names: me.materials.append(mat(n))
        world_uv(me)
        if smooth_angle:
            for p in me.polygons: p.use_smooth = True
            try: me.set_sharp_from_angle(angle=math.radians(smooth_angle))
            except Exception: pass
        return ob

def world_uv(me):
    """UV0 in metres by box projection in the three.js frame (u across, v up the walls)"""
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal; nx, ny, nz = n.x, n.z, -n.y
        ax = max((abs(nx), 0), (abs(ny), 1), (abs(nz), 2))[1]
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co; x, y, z = co.x, co.z, -co.y
            uv.data[li].uv = (z * (1 if nx < 0 else -1), y) if ax == 0 else (x, z) if ax == 1 else (x * (1 if nz > 0 else -1), y)

# ------------------------------------------------------------------------------------------------ openings
# windows: (wall, a0, a1, sill, head, units, (cols, rows) per sash, roller shade (a room we never enter), shutters)
WINDOWS = [
    ('N', -4.0, -1.2, 0.8, 2.3, 3, (3, 2), False, True),
    ('N', 3.95, 4.75, 0.95, 2.25, 1, (3, 2), False, False),
    ('N', -3.6, -1.6, U + 0.8, U + 2.2, 2, (3, 2), False, True),
    ('N', 2.5, 3.3, U + 0.85, U + 2.2, 1, (3, 2), False, True),
    ('S', -4.1, -2.5, 1.15, 2.1, 2, (1, 1), False, False),
    ('S', 2.6, 3.4, 0.95, 2.1, 1, (3, 2), True, False),
    ('S', -3.4, -2.4, U + 0.85, U + 2.2, 1, (3, 2), True, False),
    ('S', 2.6, 3.4, U + 0.85, U + 2.2, 1, (3, 2), True, False),
    ('E', -1.7, -0.9, 2.45, 3.5, 1, (3, 2), False, False),
    ('E', 2.2, 3.0, 0.95, 2.1, 1, (3, 2), True, False),
    ('E', 2.2, 3.0, U + 0.85, U + 2.2, 1, (3, 2), True, False),
    ('W', -0.95, -0.2, 0.8, 2.3, 1, (3, 2), False, False),
    ('W', -1.0, -0.3, U + 0.85, U + 2.2, 1, (3, 2), False, False),
    ('W', 1.6, 2.4, U + 0.85, U + 2.2, 1, (3, 2), True, False),
]
# doors in the outer walls: (wall, a0, a1, head)
EXT_DOORS = [('N', 2.3, 3.3, 2.1), ('S', -1.3, -0.4, 2.05)]
# wall frames: 'N' runs along x at the front face, etc. Exterior face coordinate and outward sign
WALL = {'N': ('x', Z0 - T / 2, -1), 'S': ('x', Z1 + T / 2, 1), 'W': ('z', X0 - T / 2, -1), 'E': ('z', X1 + T / 2, 1)}

def wpt(wall, a, y, d):
    """a point on wall `wall` at distance a along it, height y, d outward from the wall's centre plane"""
    ax, c, s = WALL[wall]
    return (a, y, c + s * d) if ax == 'x' else (c + s * d, y, a)

def room_paint(p):
    x, y, z = p
    if y > U - 0.05:
        return 'wall_bed' if (x < PART and z < KZ) else 'wall_paint'
    return 'wall_kit' if (x < PART and z > KZ) else 'wall_paint'

def inside(p):
    return X0 - 1e-3 < p[0] < X1 + 1e-3 and Z0 - 1e-3 < p[2] < Z1 + 1e-3

def wall(P, axis, c, a0, a1, y0, y1, openings, ext=False):
    """a wall of thickness T split around rectangular openings [(a0, a1, bottom, top)]; each face painted for the room
    it faces (an outer wall's outside is sheathing under the siding)"""
    segs = [(a0, a1, y0, y1)]
    for o0, o1, ob, ot in openings:
        nxt = []
        for s0, s1, b, t in segs:
            if o1 <= s0 or o0 >= s1 or ot <= b or ob >= t: nxt.append((s0, s1, b, t)); continue
            if o0 > s0: nxt.append((s0, o0, b, t))
            if o1 < s1: nxt.append((o1, s1, b, t))
            m0, m1 = max(s0, o0), min(s1, o1)
            if ob > b: nxt.append((m0, m1, b, ob))
            if ot < t: nxt.append((m0, m1, ot, t))
        segs = nxt
    def paint(f):
        cen = f.calc_center_median(); n = f.normal
        p = (cen.x + n.x * 0.06, cen.z + n.z * 0.06, -cen.y - n.y * 0.06)
        if not inside(p): return 'sheathing'
        return room_paint(p)
    for s0, s1, b, t in segs:
        if s1 - s0 < 0.004 or t - b < 0.004: continue
        if axis == 'x': M = Matrix.Translation(bl(((s0 + s1) / 2, (b + t) / 2, c))) @ Matrix.Diagonal((s1 - s0, T, t - b, 1))
        else: M = Matrix.Translation(bl((c, (b + t) / 2, (s0 + s1) / 2))) @ Matrix.Diagonal((T, s1 - s0, t - b, 1))
        P.cube(M, paint)

def covered(openings, a0, a1, y):
    """the stretches of a wall standing at height y (between its openings)"""
    out = [(a0, a1)]
    for o0, o1, ob, ot in openings:
        if not (ob <= y <= ot): continue
        nxt = []
        for s0, s1 in out:
            if o1 <= s0 or o0 >= s1: nxt.append((s0, s1)); continue
            if o0 > s0: nxt.append((s0, o0))
            if o1 < s1: nxt.append((o1, s1))
        out = nxt
    return [(s0, s1) for s0, s1 in out if s1 - s0 > 0.02]

BASE_PROF = [(0, 0), (0.016, 0), (0.016, 0.105), (0.012, 0.118), (0.008, 0.122), (0.006, 0.135), (0, 0.14)]
CROWN_PROF = [(0, 0), (0, -0.095), (0.006, -0.093), (0.012, -0.08), (0.028, -0.058), (0.05, -0.03), (0.066, -0.014), (0.072, -0.006), (0.085, 0)]
CASE_PROF = [(0, 0), (0, 0.012), (0.008, 0.017), (0.05, 0.021), (0.062, 0.018), (0.07, 0.01), (0.07, 0)]

def moulding_along(P, prof, face, a0, a1, y, m='trim'):
    """baseboard / crown along an interior wall face: face = (axis, c, normal sign)"""
    ax, c, s = face
    if ax == 'x':
        P.sweep(prof, (a0, y, c), (a1, y, c), (0, 0, s), (0, 1, 0), m)
    else:
        P.sweep(prof, (c, y, a0), (c, y, a1), (s, 0, 0), (0, 1, 0), m)

# ------------------------------------------------------------------------------------------------ the shell
def build_walls(P, M):
    """walls with their openings; baseboards and crown mouldings on each room side"""
    ext_open = {k: [] for k in 'NSEW'}
    for w, a0, a1, s, h, *_ in WINDOWS: ext_open[w].append((a0, a1, s, h))
    for w, a0, a1, h in EXT_DOORS: ext_open[w].append((a0, a1, 0, h))
    spans = {'N': (X0 - T, X1 + T), 'S': (X0 - T, X1 + T), 'W': (Z0, Z1), 'E': (Z0, Z1)}
    for w, (ax, c, s) in WALL.items():
        a0, a1 = spans[w]
        wall(P, ax, c, a0, a1, 0, TOP, ext_open[w], ext=True)
        # the room side of the outer wall: baseboards on each floor, crown under each ceiling
        face = (ax, c - s * T / 2, -s)
        for yb, yc in ((0, HG), (U, TOP)):
            for s0, s1 in covered(ext_open[w], max(a0, X0 if ax == 'x' else Z0), min(a1, X1 if ax == 'x' else Z1), yb + 0.05):
                moulding_along(M, BASE_PROF, face, s0, s1, yb)
            for s0, s1 in covered(ext_open[w], max(a0, X0 if ax == 'x' else Z0), min(a1, X1 if ax == 'x' else Z1), yc - 0.05):
                if not (w == 'E' and yc == HG and -3.0 < (s0 + s1) / 2 < 0.75): moulding_along(M, CROWN_PROF, face, s0, s1, yc)
    # partitions: (axis, c, a0, a1, y0, y1, openings)
    parts = [
        ('z', PART, Z0, Z1, 0, HG, [(-2.6, -1.0, 0, 2.3), (0.3, 1.1, 0, 2.05)]),
        ('x', KZ, X0, PART - T / 2, 0, HG, [(-1.0, 0.2, 0, 2.05)]),
        ('x', HZ, PART + T / 2, X1, 0, HG, [(2.2, 3.0, 0, 2.05)]),
        ('z', PART, Z0, Z1, U, TOP, [(-1.5, -0.6, U, U + 2.05), (0.35, 1.15, U, U + 2.05)]),
        ('x', KZ, X0, PART - T / 2, U, TOP, []),
        ('x', HZ, PART + T / 2, X1, U, TOP, [(2.0, 2.8, U, U + 2.05)]),
    ]
    for ax, c, a0, a1, y0, y1, op in parts:
        wall(P, ax, c, a0, a1, y0, y1, op)
        for s in (-1, 1):
            face = (ax, c + s * T / 2, s)
            for s0, s1 in covered(op, a0, a1, y0 + 0.05):
                if ax == 'z' and y0 == 0 and s > 0 and -3.0 < (s0 + s1) / 2 < 0.75 and False: continue
                moulding_along(M, BASE_PROF, face, s0, s1, y0)
            for s0, s1 in covered(op, a0, a1, y1 - 0.05):
                moulding_along(M, CROWN_PROF, face, s0, s1, y1)
    return ext_open

def build_floors(P):
    def slab(x0, x1, z0, z1, y0, y1, top, bottom):
        P.box(x0, y0, z0, x1, y1, z1, lambda f: top if f.normal.z > 0.5 else bottom if f.normal.z < -0.5 else 'ceiling')
    slab(X0, X1, Z0, Z1, -0.25, 0, 'oak', 'foundation')
    P.box(X0, 0, KZ + T / 2, PART - T / 2, 0.004, Z1, 'tile')                                 # kitchen tiles
    S = ST
    for x0, x1, z0, z1 in ((X0, S['x0'], Z0, Z1), (S['x0'], S['x1'], Z0, S['zTop']), (S['x0'], S['x1'], S['zBot'], Z1)):
        slab(x0, x1, z0, z1, HG, U, 'oak', 'ceiling')
    slab(X0 - T, X1 + T, Z0 - T, Z1 + T, TOP, TOP + 0.14, 'sheathing', 'ceiling')
    # the stairwell's edge: a painted fascia board round the opening
    P.box(S['x0'] - 0.02, HG - 0.02, S['zTop'], S['x0'], U, S['zBot'], 'trim')

def build_stairs(P):
    S = ST; n = S['n']; rise = U / n; run = (S['zBot'] - S['zTop']) / n
    x0, x1 = S['x0'], S['x1']
    for i in range(n):
        top = (i + 1) * rise; zf = S['zBot'] - i * run; zb = zf - run
        # riser, then the tread with its rounded nosing, a cove moulding under the nosing
        P.box(x0, i * rise, zf - 0.02, x1, top - 0.028, zf, 'trim')
        P.box(x0 - 0.02, top - 0.028, zb, x1, top, zf + 0.028, 'tread')
        P.sweep([(0, 0), (0.016, 0), (0, -0.016)], (x0, top - 0.028, zf), (x1, top - 0.028, zf), (0, 0, 1), (0, 1, 0), 'trim')
    # the nosing line: y = nose(z); the skirt board (wall side) and the closed stringer (open side) follow it
    def nose(z): return rise + (S['zBot'] - z) * rise / run
    def band(xa, xb, up, down, m, z_end=S['zTop']):
        pts = [(S['zBot'] + 0.03, 0.0), (S['zBot'] + 0.03, nose(S['zBot']) + up), (z_end, nose(z_end) + up), (z_end, max(0.0, nose(z_end) - down))]
        zc = S['zBot'] - (down - up - rise) * run / rise if False else None
        z0 = S['zBot'] + 0.03 - max(0.0, (down - rise - 0.03 * rise / run)) * 0
        # where the lower edge meets the floor
        zf = S['zBot'] - (down - rise) * run / rise if down > rise else S['zBot'] + 0.03
        pts.append((min(zf, S['zBot'] + 0.03), 0.0))
        P.prism(pts, 'x', xa, xb, m)
    band(x1 - 0.025, x1, 0.11, 0.2, 'trim')
    band(x0 - 0.05, x0 - 0.012, 0.07, 0.28, 'trim')
    # the space under the stairs closed in below the stringer (a closet, its little door at the high end)
    zf = S['zBot'] - (0.28 - rise) * run / rise
    P.prism([(zf, 0.0), (S['zTop'], nose(S['zTop']) - 0.28), (S['zTop'], 0.0)], 'x', x0 - 0.04, x0 + 0.03, 'wall_paint')
    P.box(x0 - 0.06, 0, -2.75, x0 - 0.04, 1.6, -2.15, 'door'); P.box(x0 - 0.075, 0.75, -2.25, x0 - 0.06, 0.8, -2.22, 'brass')
    for zp0, zp1 in ((0.05, -0.65), (-0.75, -1.45), (-1.55, -2.05)):
        top_ = min(nose(zp0), nose(zp1)) - 0.45
        if top_ < 0.35: continue
        for (a0_, a1_, y0_, y1_) in ((zp1, zp0, 0.2, 0.222), (zp1, zp0, top_ - 0.022, top_), (zp1, zp1 + 0.022, 0.2, top_), (zp0 - 0.022, zp0, 0.2, top_)):
            P.box(x0 - 0.052, y0_, a0_, x0 - 0.04, y1_, a1_, 'trim')
    # a carpet runner held by brass rods, up the middle of the stairs
    for i in range(n):
        top = (i + 1) * rise; zf_ = S['zBot'] - i * run; zb = zf_ - run
        P.box((x0 + x1) / 2 - 0.36, top, zb, (x0 + x1) / 2 + 0.36, top + 0.008, zf_ + 0.036, 'runner')
        P.box((x0 + x1) / 2 - 0.36, i * rise, zf_ + 0.028, (x0 + x1) / 2 + 0.36, top + 0.008, zf_ + 0.036, 'runner')
        P.cyl(((x0 + x1) / 2, i * rise + 0.012, zf_ + 0.04), 0.006, 0.8, 'brass', seg=6, axis='x')
    # balusters (two a tread), the handrail, the newel posts
    for i in range(n):
        top = (i + 1) * rise; zf = S['zBot'] - i * run
        for k in (0.3, 0.75):
            z = zf - run * k; yb = nose(z) + 0.07
            yt = nose(z) + 0.86
            P.box(x0 - 0.047, yb, z - 0.016, x0 - 0.015, yt, z + 0.016, 'trim')
    A = Vector((x0 - 0.031, nose(S['zBot'] + 0.1) + 0.86, S['zBot'] + 0.1)); B = Vector((x0 - 0.031, nose(S['zTop'] + 0.6) + 0.86, S['zTop'] + 0.6))
    d = (B - A).normalized(); up = Vector((0, 1, 0)); side = Vector((1, 0, 0)); nrm = side.cross(d).normalized()
    rail = [(-0.03, -0.02), (0.03, -0.02), (0.035, 0.015), (0.025, 0.035), (0, 0.045), (-0.025, 0.035), (-0.035, 0.015)]
    P.sweep([(u, v) for u, v in rail], A, B, side, -nrm if nrm.y < 0 else nrm, 'rail')
    def newel(x, z, y0, h):
        P.box(x - 0.045, y0, z - 0.045, x + 0.045, y0 + h, z + 0.045, 'trim')
        P.box(x - 0.06, y0 + h, z - 0.06, x + 0.06, y0 + h + 0.03, z + 0.06, 'trim')
        P.box(x - 0.055, y0, z - 0.055, x + 0.055, y0 + 0.16, z + 0.055, 'trim')
        P.cyl((x, y0 + h + 0.065, z), 0.035, 0.07, 'trim', seg=12)
    newel(x0 - 0.03, S['zBot'] + 0.12, 0, 1.1)
    newel(x0 - 0.031, S['zTop'] + 0.6, U, 1.0)
    # the balustrade round the stairwell upstairs
    def balustrade(ax, c, a0, a1):
        for a in [a0 + 0.06 + k * 0.11 for k in range(int((a1 - a0 - 0.08) / 0.11) + 1)]:
            if ax == 'z': P.box(c - 0.016, U, a - 0.016, c + 0.016, U + 0.86, a + 0.016, 'trim')
            else: P.box(a - 0.016, U, c - 0.016, a + 0.016, U + 0.86, c + 0.016, 'trim')
        if ax == 'z': P.sweep(rail, (c, U + 0.86, a0), (c, U + 0.86, a1), (1, 0, 0), (0, 1, 0), 'rail'); P.box(c - 0.03, U, a0, c + 0.03, U + 0.06, a1, 'trim')
        else: P.sweep(rail, (a0, U + 0.86, c), (a1, U + 0.86, c), (0, 0, 1), (0, 1, 0), 'rail'); P.box(a0, U, c - 0.03, a1, U + 0.06, c + 0.03, 'trim')
    balustrade('z', x0 - 0.02, S['zTop'] + 0.6, S['zBot'])
    balustrade('x', S['zBot'] + 0.02, x0, x1)
    newel(x0 - 0.02, S['zBot'] + 0.02, U, 1.0)

# ------------------------------------------------------------------------------------------------ windows & doors
def casing(P, wall_face, a0, a1, y0, y1, out_dir, m='trim', head=True, legs=True):
    """flat moulded casing round an opening on a wall face (out_dir: +1/-1 normal sign of the face)"""
    ax, c = wall_face
    W = 0.07
    def pt(a, y): return (a, y, c) if ax == 'x' else (c, y, a)
    n = (0, 0, out_dir) if ax == 'x' else (out_dir, 0, 0)
    along = (1, 0, 0) if ax == 'x' else (0, 0, 1)
    if legs:
        for a, sgn in ((a0, -1), (a1, 1)):
            # the leg: profile across its width (outward from the opening edge), swept up
            prof = [(sgn * u, v) for u, v in CASE_PROF]
            P.sweep(prof, pt(a, y0), pt(a, y1 + W), along, n, m)
    if head:
        prof = [(u, v) for u, v in CASE_PROF]
        P.sweep(prof, pt(a0 - W, y1), pt(a1 + W, y1), (0, 1, 0), n, m)

def window(P, G, w, a0, a1, sill, head, units, grid, shade, shutters):
    ax, c, s = WALL[w]
    inner, outer = -T / 2, T / 2           # (relative to the wall centre, along the outward normal)
    def pt(a, y, d): return wpt(w, a, y, d)
    def B(a0_, y0_, d0, a1_, y1_, d1, m):
        p0, p1 = pt(a0_, y0_, d0), pt(a1_, y1_, d1)
        return P.box(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], m)
    # jamb liners in the reveal, the interior stool and apron, casings both sides
    B(a0, sill, inner, a0 + 0.02, head, outer, 'trim'); B(a1 - 0.02, sill, inner, a1, head, outer, 'trim'); B(a0, head - 0.02, inner, a1, head, outer, 'trim')
    B(a0 - 0.1, sill - 0.028, inner - 0.05, a1 + 0.1, sill, outer - 0.03, 'trim')                       # stool
    B(a0 - 0.06, sill - 0.12, inner - 0.016, a1 + 0.06, sill - 0.028, inner, 'trim')                     # apron
    casing(P, (ax, c - s * T / 2), a0, a1, sill, head, -s, head=True, legs=True)
    # exterior: flat casing boards, a head with its drip cap, a sloped sill
    eo = outer + 0.02
    B(a0 - 0.1, sill, eo, a0, head, eo + 0.025, 'ext_trim'); B(a1, sill, eo, a1 + 0.1, head, eo + 0.025, 'ext_trim')
    B(a0 - 0.1, head, eo, a1 + 0.1, head + 0.13, eo + 0.03, 'ext_trim'); B(a0 - 0.12, head + 0.13, eo, a1 + 0.12, head + 0.15, eo + 0.05, 'ext_trim')
    B(a0 - 0.13, sill - 0.045, outer - 0.03, a1 + 0.13, sill, eo + 0.06, 'ext_trim')
    # the units: mullions between them, each with two sashes (the upper one outside the lower), muntins, glass
    uw = (a1 - a0 - 0.04 - (units - 1) * 0.06) / units
    for k in range(units):
        u0 = a0 + 0.02 + k * (uw + 0.06); u1 = u0 + uw
        if k: B(u0 - 0.06, sill, inner + 0.02, u0, head, outer, 'trim')
        mid = (sill + head) / 2
        for (y0, y1, d) in ((sill + 0.01, mid + 0.02, 0.0), (mid - 0.02, head - 0.02, 0.045)):
            dd = d - 0.01
            st, rt, rb = 0.05, 0.045 if y0 > sill + 0.1 else 0.035, 0.07 if y0 < sill + 0.1 else 0.035
            B(u0, y0, dd, u0 + st, y1, dd + 0.035, 'trim'); B(u1 - st, y0, dd, u1, y1, dd + 0.035, 'trim')
            B(u0, y0, dd, u1, y0 + rb, dd + 0.035, 'trim'); B(u0, y1 - rt, dd, u1, y1, dd + 0.035, 'trim')
            cols, rows = grid
            gx0, gx1, gy0, gy1 = u0 + st, u1 - st, y0 + rb, y1 - rt
            for i in range(1, cols): a = gx0 + (gx1 - gx0) * i / cols; B(a - 0.009, gy0, dd + 0.008, a + 0.009, gy1, dd + 0.028, 'trim')
            for j in range(1, rows): y = gy0 + (gy1 - gy0) * j / rows; B(gx0, y - 0.009, dd + 0.008, gx1, y + 0.009, dd + 0.028, 'trim')
            p0, p1, p2, p3 = pt(gx0, gy0, dd + 0.018), pt(gx1, gy0, dd + 0.018), pt(gx1, gy1, dd + 0.018), pt(gx0, gy1, dd + 0.018)
            G.poly([p0, p1, p2, p3] if s > 0 else [p0, p3, p2, p1], 'glass')
        if shade:   # a roller shade pulled most of the way down
            yb = sill + (head - sill) * 0.25
            B(u0 + 0.03, yb, inner + 0.01, u1 - 0.03, head - 0.03, inner + 0.012, 'shade')
            B(u0 + 0.025, yb - 0.012, inner + 0.004, u1 - 0.025, yb, inner + 0.016, 'shade')
    if shutters:  # louvred shutters either side, on the siding
        sw = min(0.5, (a1 - a0) / units / 2 + 0.06)
        for sa0, sa1 in ((a0 - 0.1 - sw, a0 - 0.1), (a1 + 0.1, a1 + 0.1 + sw)):
            B(sa0, sill, eo + 0.005, sa1, head, eo + 0.03, 'shutter')
            for y in [sill + 0.08 + i * 0.055 for i in range(int((head - sill - 0.16) / 0.055))]:
                B(sa0 + 0.05, y, eo + 0.03, sa1 - 0.05, y + 0.012, eo + 0.038, 'shutter')

def door_leaf(P, M3, w, h, m='door', knob='brass', glass_top=False, G=None):
    """a six-panel door leaf in a local frame: x across (0..w), y up (0..h), z through (−0.022..0.022);
    M3 maps local (x, y, z) to the three.js frame"""
    def L(x0, y0, z0, x1, y1, z1, mm):
        c = M3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return c, (x1 - x0, y1 - y0, z1 - z0), mm
    stile, top_r, lock_r, bot_r, mid_r = 0.115, 0.115, 0.2, 0.24, 0.1
    parts = [L(0, 0, -0.022, stile, h, 0.022, m), L(w - stile, 0, -0.022, w, h, 0.022, m), L(stile, h - top_r, -0.022, w - stile, h, 0.022, m),
             L(stile, 0, -0.022, w - stile, bot_r, 0.022, m), L(stile, 0.9 - lock_r / 2, -0.022, w - stile, 0.9 + lock_r / 2, 0.022, m),
             L(stile, 1.55 - mid_r / 2, -0.022, w - stile, 1.55 + mid_r / 2, 0.022, m)]
    # the centre stile in three pieces between the rails (as a door is joined: no faces doubled where they cross)
    for y0, y1 in ((bot_r, 0.9 - lock_r / 2), (0.9 + lock_r / 2, 1.55 - mid_r / 2), (1.55 + mid_r / 2, h - top_r)):
        parts.append(L(w / 2 - 0.05, y0, -0.022, w / 2 + 0.05, y1, 0.022, m))
    for c, sz, mm in parts: P.obox(c, sz, mm, ry=M3.ry)
    # the panels: recessed, with a raised field
    rows = [(bot_r, 0.9 - lock_r / 2), (0.9 + lock_r / 2, 1.55 - mid_r / 2), (1.55 + mid_r / 2, h - top_r)]
    for ri, (y0, y1) in enumerate(rows):
        for x0, x1 in ((stile, w / 2 - 0.05), (w / 2 + 0.05, w - stile)):
            if glass_top and ri == 2:
                c, sz, _ = L(x0, y0, -0.004, x1, y1, 0.004, 'glass'); G.obox(c, sz, 'glass', ry=M3.ry); continue
            c, sz, _ = L(x0, y0, -0.012, x1, y1, 0.012, m); P.obox(c, sz, m, ry=M3.ry)
            c, sz, _ = L(x0 + 0.035, y0 + 0.035, -0.017, x1 - 0.035, y1 - 0.035, 0.017, m); P.obox(c, sz, m, ry=M3.ry)
    for zz in (-0.04, 0.04):
        P.cyl(M3(w - 0.07, 0.92, zz), 0.028, 0.03, knob, seg=14, axis='z' if abs(math.sin(M3.ry)) < 0.5 else 'x')
        P.cyl(M3(w - 0.07, 0.92, zz * 0.7), 0.009, abs(zz) * 0.6, knob, seg=8, axis='z' if abs(math.sin(M3.ry)) < 0.5 else 'x')

class Frame3:
    """local (x across the doorway, y up, z through) -> three.js, turned by ry about the vertical at origin o"""
    def __init__(self, o, ry): self.o = Vector(o); self.ry = ry
    def __call__(self, x, y, z):
        c, s = math.cos(self.ry), math.sin(self.ry)
        return (self.o.x + x * c + z * s, self.o.y + y, self.o.z - x * s + z * c)

def doorway(P, ax, c, a0, a1, y0, h, sides=(1, -1), m='trim'):
    """jamb liners through the wall and casings on both faces"""
    if ax == 'x':
        P.box(a0, y0, c - T / 2 - 0.005, a0 + 0.02, y0 + h, c + T / 2 + 0.005, m); P.box(a1 - 0.02, y0, c - T / 2 - 0.005, a1, y0 + h, c + T / 2 + 0.005, m)
        P.box(a0, y0 + h - 0.02, c - T / 2 - 0.005, a1, y0 + h, c + T / 2 + 0.005, m)
    else:
        P.box(c - T / 2 - 0.005, y0, a0, c + T / 2 + 0.005, y0 + h, a0 + 0.02, m); P.box(c - T / 2 - 0.005, y0, a1 - 0.02, c + T / 2 + 0.005, y0 + h, a1, m)
        P.box(c - T / 2 - 0.005, y0 + h - 0.02, a0, c + T / 2 + 0.005, y0 + h, a1, m)
    for s in sides:
        casing(P, (ax, c + s * T / 2), a0, a1, y0, y0 + h, s)

def build_doors(P, G):
    # cased openings and interior doors
    doorway(P, 'z', PART, -2.6, -1.0, 0, 2.3)
    doorway(P, 'z', PART, 0.3, 1.1, 0, 2.05)
    doorway(P, 'x', KZ, -1.0, 0.2, 0, 2.05)
    doorway(P, 'x', HZ, 2.2, 3.0, 0, 2.05);  door_leaf(P, Frame3((2.21, 0, HZ + T / 2), 0.55), 0.78, 2.03)          # ajar
    doorway(P, 'x', HZ, 2.0, 2.8, U, 2.05);  door_leaf(P, Frame3((2.01, U, HZ), 0.0), 0.78, 2.03)
    doorway(P, 'z', PART, 0.35, 1.15, U, 2.05); door_leaf(P, Frame3((PART, U, 1.14), math.pi / 2), 0.78, 2.03)
    # the bedroom door, ajar into the bedroom (hinged at its south jamb, as in the game)
    doorway(P, 'z', PART, -1.5, -0.6, U, 2.05)
    dw = 0.9
    door_leaf(P, Frame3((PART - T / 2 - 0.022 * math.cos(-0.85), U, -0.6 + 0.022 * math.sin(-0.85)), math.pi / 2 - 0.85), dw - 0.02, 2.03)
    # the front door (with its storm-door glass at the top) and the back door's frame (its leaf is the game's)
    doorway(P, 'x', Z0 - T / 2, 2.3, 3.3, 0, 2.1, sides=(1,))
    door_leaf(P, Frame3((2.31, 0, Z0 - T / 2 + 0.01), 0.0), 0.98, 2.08, m='door_front', glass_top=True, G=G)
    doorway(P, 'x', Z1 + T / 2, -1.3, -0.4, 0, 2.05, sides=(-1,))
    P.box(2.2, -0.02, Z0 - T - 0.08, 3.4, 0.012, Z0 - 0.02, 'oak')            # thresholds
    for w, a0, a1, h in EXT_DOORS:
        ax, c, s = WALL[w]; eo = T / 2 + 0.02
        p = lambda a, y, d: wpt(w, a, y, d)
        P.box(*p(a0 - 0.11, 0, eo), *p(a0, h, eo + 0.025), 'ext_trim'); P.box(*p(a1, 0, eo), *p(a1 + 0.11, h, eo + 0.025), 'ext_trim')
        P.box(*p(a0 - 0.11, h, eo), *p(a1 + 0.11, h + 0.15, eo + 0.03), 'ext_trim'); P.box(*p(a0 - 0.13, h + 0.15, eo), *p(a1 + 0.13, h + 0.17, eo + 0.05), 'ext_trim')

# ------------------------------------------------------------------------------------------------ rooms
def build_fireplace(P):
    fz0, fz1, fd = -3.0, -1.4, 0.4
    x = X0
    P.box(x, 0, fz0, x + fd, HG, fz0 + 0.42, 'brick'); P.box(x, 0, fz1 - 0.42, x + fd, HG, fz1, 'brick')
    P.box(x, 0.82, fz0 + 0.42, x + fd, HG, fz1 - 0.42, 'brick')
    P.box(x, 0, fz0 + 0.42, x + 0.06, 0.82, fz1 - 0.42, 'soot')                                   # the firebox back
    P.box(x + 0.06, 0, fz0 + 0.42, x + fd, 0.02, fz1 - 0.42, 'soot')
    P.box(x + fd, 0, fz0 - 0.15, x + fd + 0.5, 0.05, fz1 + 0.15, 'hearth')                        # hearth
    # the mantel: pilasters, a frieze, the shelf with its moulding
    for z0, z1 in ((fz0 - 0.05, fz0 + 0.17), (fz1 - 0.17, fz1 + 0.05)):
        P.box(x + fd, 0.05, z0, x + fd + 0.04, 1.12, z1, 'trim'); P.box(x + fd + 0.04, 0.05, z0 + 0.03, x + fd + 0.055, 1.08, z1 - 0.03, 'trim')
        P.box(x + fd, 0.05, z0 - 0.01, x + fd + 0.06, 0.2, z1 + 0.01, 'trim')
    P.box(x + fd, 0.9, fz0 + 0.17, x + fd + 0.04, 1.12, fz1 - 0.17, 'trim')
    P.box(x + fd, 1.12, fz0 - 0.08, x + fd + 0.07, 1.2, fz1 + 0.08, 'trim')
    P.box(x + fd - 0.06, 1.215, fz0 - 0.12, x + fd + 0.18, 1.285, fz1 + 0.12, 'trim')
    P.sweep([(0, 0), (0, -0.03), (0.02, -0.03), (0.05, 0)], (x + fd + 0.07, 1.215, fz0 - 0.1), (x + fd + 0.07, 1.215, fz1 + 0.1), (1, 0, 0), (0, 1, 0), 'trim')
    for z in (fz0 + 0.5, fz0 + 0.62):                                                               # andirons
        P.box(x + 0.1, 0.02, z - 0.01, x + 0.3, 0.05, z + 0.01, 'black_metal'); P.box(x + 0.27, 0.02, z - 0.012, x + 0.3, 0.2, z + 0.012, 'black_metal')
    for k in range(3):                                                                              # logs, burnt down
        P.cyl((x + 0.2, 0.08 + k * 0.05, -2.2 + (k - 1) * 0.06), 0.045, 0.42, 'soot', seg=9, axis='z')

def radiator(P, x, y, z, length, along='x', h=0.62):
    """a cast-iron column radiator standing on the floor against a wall"""
    n = int(length / 0.064)
    for i in range(n):
        a = -length / 2 + 0.032 + i * 0.064
        for dz in (-0.04, 0.04):
            c = (x + a, y + h / 2 + 0.05, z + dz) if along == 'x' else (x + dz, y + h / 2 + 0.05, z + a)
            P.cyl(c, 0.022, h - 0.06, 'iron', seg=8)
        for yy in (y + 0.09, y + h + 0.02):
            c = (x + a, yy, z) if along == 'x' else (x, yy, z + a)
            P.obox(c, (0.05, 0.05, 0.12) if along == 'x' else (0.12, 0.05, 0.05), 'iron')
    for a in (-length / 2 + 0.05, length / 2 - 0.05):
        c = (x + a, y + 0.035, z) if along == 'x' else (x, y + 0.035, z + a)
        P.obox(c, (0.05, 0.07, 0.14) if along == 'x' else (0.14, 0.07, 0.05), 'iron')
    c = (x + length / 2 + 0.05, y + 0.12, z) if along == 'x' else (x, y + 0.12, z + length / 2 + 0.05)
    P.cyl(c, 0.016, 0.1, 'brass', seg=8, axis='x' if along == 'x' else 'z')
    c2 = (x + length / 2 + 0.1, y + 0.06, z) if along == 'x' else (x, y + 0.06, z + length / 2 + 0.1)
    P.cyl(c2, 0.014, 0.12, 'iron', seg=8)

def cabinets(P, run_axis, a0, a1, wall_c, sgn, drawers=True, upper=None, skip=()):
    """base cabinets along a wall (sgn: the room side), shaker doors and drawers, bar pulls, toe kick, countertop"""
    D = 0.6
    def bx(ua0, y0, d0, ua1, y1, d1, m):
        if run_axis == 'x': P.box(ua0, y0, wall_c + sgn * d0, ua1, y1, wall_c + sgn * d1, m)
        else: P.box(wall_c + sgn * d0, y0, ua0, wall_c + sgn * d1, y1, ua1, m)
    bx(a0, 0, 0, a1, 0.1, D - 0.07, 'black_metal')                    # toe kick
    bx(a0, 0.1, 0, a1, 0.86, D - 0.02, 'cabinet')
    units, a = [], a0
    while a < a1 - 0.2:
        w = min(0.6, a1 - a)
        if a1 - (a + w) < 0.25: w = a1 - a
        units.append((a, a + w)); a += w
    for u0, u1 in units:
        if any(s0 < (u0 + u1) / 2 < s1 for s0, s1 in skip): continue
        # face frame gap lines, a drawer, the door (frame and recessed panel), pulls
        top = 0.86 - 0.02
        if drawers:
            bx(u0 + 0.004, top - 0.16, D - 0.02, u1 - 0.004, top, D, 'cabinet')
            bx((u0 + u1) / 2 - 0.08, top - 0.09, D, (u0 + u1) / 2 + 0.08, top - 0.07, D + 0.025, 'steel')
            top -= 0.17
        bx(u0 + 0.004, 0.11, D - 0.02, u1 - 0.004, top, D, 'cabinet')
        bx(u0 + 0.07, 0.18, D - 0.012, u1 - 0.07, top - 0.07, D - 0.002, 'cabinet')
        hx = u1 - 0.05
        bx(hx - 0.012, top - 0.2, D, hx + 0.012, top - 0.05, D + 0.025, 'steel')
    bx(a0 - 0.02, 0.86, 0, a1 + 0.02, 0.9, D + 0.025, 'counter')
    bx(a0, 0.9, 0, a1, 1.42, 0.008, 'splash')
    if upper:
        for u0, u1, y0, y1 in upper:
            bx(u0, y0, 0, u1, y1, 0.33, 'cabinet')
            w = u1 - u0; k = max(1, round(w / 0.45))
            for i in range(k):
                d0, d1 = u0 + i * w / k + 0.004, u0 + (i + 1) * w / k - 0.004
                bx(d0, y0 + 0.004, 0.33, d1, y1 - 0.004, 0.35, 'cabinet'); bx(d0 + 0.06, y0 + 0.07, 0.345, d1 - 0.06, y1 - 0.07, 0.352, 'cabinet')
                hx = d1 - 0.04 if i % 2 == 0 else d0 + 0.04
                bx(hx - 0.01, y0 + 0.06, 0.35, hx + 0.01, y0 + 0.18, 0.372, 'steel')
            bx(u0 - 0.01, y1, 0, u1 + 0.01, y1 + 0.06, 0.37, 'trim')

def build_kitchen(P):
    # the west wall: the fridge, then cabinets with the stove between them; the south wall: cabinets with the sink
    cabinets(P, 'z', 1.05, 3.38, X0, 1, skip=((1.66, 2.44),), upper=[(1.05, 1.6, 1.42, 2.17), (2.5, 3.38, 1.42, 2.17)])
    cabinets(P, 'x', X0 + 0.62, -1.55, Z1, -1, skip=(), upper=[(X0 + 0.62, -4.2, 1.42, 2.17), (-2.4, -1.55, 1.42, 2.17)])
    # the sink: a stainless bowl in the counter under the window, a gooseneck tap
    P.box(-3.62, 0.72, Z1 - 0.52, -2.98, 0.905, Z1 - 0.1, 'steel'); P.box(-3.58, 0.74, Z1 - 0.48, -3.02, 0.906, Z1 - 0.14, 'soot')
    P.cyl((-3.3, 1.02, Z1 - 0.06), 0.014, 0.24, 'steel', seg=10)
    P.sweep([(0, -0.012), (0.012, 0), (0, 0.012), (-0.012, 0)], (-3.3, 1.14, Z1 - 0.06), (-3.3, 1.14, Z1 - 0.26), (1, 0, 0), (0, 1, 0), 'steel')
    P.box(-3.38, 1.015, Z1 - 0.08, -3.34, 1.03, Z1 - 0.04, 'steel')
    # the range hood between the upper cabinets over the stove
    P.box(X0, 1.62, 1.6, X0 + 0.5, 1.75, 2.5, 'steel'); P.box(X0, 1.75, 1.75, X0 + 0.3, 2.3, 2.35, 'steel')
    P.box(X0 + 0.25, 1.615, 1.9, X0 + 0.4, 1.62, 2.2, 'lamp_glass')
    # the fridge
    fx0, fx1, fz0, fz1 = X0 + 0.02, X0 + 0.76, 0.3, 1.02
    P.box(fx0, 0.02, fz0, fx1 - 0.04, 1.78, fz1, 'fridge')
    P.box(fx1 - 0.04, 1.2, fz0 + 0.005, fx1, 1.78, fz1 - 0.005, 'fridge'); P.box(fx1 - 0.04, 0.03, fz0 + 0.005, fx1, 1.19, fz1 - 0.005, 'fridge')
    P.box(fx1 - 0.06, 0.02, fz0 + 0.04, fx1 - 0.02, 0.1, fz1 - 0.04, 'black_metal')
    for y0, y1 in ((1.25, 1.6), (0.7, 1.12)):
        P.box(fx1, y0, fz1 - 0.07, fx1 + 0.04, y1, fz1 - 0.05, 'steel'); P.box(fx1, y0, fz1 - 0.07, fx1 + 0.012, y0 + 0.02, fz1 - 0.05, 'steel')

def sphere(P, c, r, m, seg=10):
    res = bmesh.ops.create_uvsphere(P.bm, u_segments=seg, v_segments=max(4, seg // 2), radius=1.0)
    bmesh.ops.transform(P.bm, matrix=Matrix.Translation(bl(c)) @ Matrix.Diagonal((r[0], r[2], r[1], 1)), verts=res['verts'])
    for f in P._faces(res['verts']): f.material_index = P.mi(m)

def cable(P, pts, r, m):
    for a, b in zip(pts, pts[1:]):
        A, B_ = Vector(a), Vector(b); d = (B_ - A); L = d.length
        if L < 1e-4: continue
        d.normalize(); side = d.cross(Vector((0, 1, 0))) if abs(d.y) < 0.9 else d.cross(Vector((1, 0, 0))); side.normalize(); up = side.cross(d)
        prof = [(math.cos(t) * r, math.sin(t) * r) for t in [i * math.pi / 3 for i in range(6)]]
        P.sweep(prof, A, B_, side, up, m)

def outlet(P, wall, a, y, kind='outlet'):
    """a duplex outlet or a light switch on an interior wall face: wall = (axis, c, sign into the room)"""
    ax, c, sg = wall
    w, h = (0.07, 0.115) if kind == 'outlet' else (0.07, 0.115)
    if ax == 'x': P.box(a - w / 2, y - h / 2, c, a + w / 2, y + h / 2, c + sg * 0.006, 'plastic_white')
    else: P.box(c, y - h / 2, a - w / 2, c + sg * 0.006, y + h / 2, a + w / 2, 'plastic_white')
    for dy in ((-0.02, 0.02) if kind == 'outlet' else (0,)):
        hw, hh = (0.012, 0.018) if kind == 'outlet' else (0.008, 0.02)
        if ax == 'x': P.box(a - hw, y + dy - hh, c + sg * 0.006, a + hw, y + dy + hh, c + sg * 0.01, 'plastic_white' if kind != 'outlet' else 'plastic_dark' if False else 'plastic_white')
        else: P.box(c + sg * 0.006, y + dy - hh, a - hw, c + sg * 0.01, y + dy + hh, a + hw, 'plastic_white')

def build_dungeon(P, G):
    """the things a robot finds at its own height"""
    # under the bed: a flat storage box, a shoebox, a lost sock, dust, the phone charger's cable
    sphere(P, (-3.45, U + 0.025, -0.45), (0.09, 0.025, 0.05), 'sock'); sphere(P, (-3.33, U + 0.02, -0.4), (0.05, 0.02, 0.035), 'sock')
    for x, z, r in ((-2.6, -1.6, 0.035), (-3.9, -0.6, 0.025), (-2.9, -1.1, 0.03), (-3.6, -2.1, 0.02)):
        sphere(P, (x, U + r * 0.5, z), (r, r * 0.55, r * 1.2), 'dust', seg=8)
    cable(P, [(-4.45, U + 0.75, KZ - 0.25), (-4.62, U + 0.5, KZ - 0.12), (-4.7, U + 0.006, KZ - 0.2), (-4.2, U + 0.006, -0.5), (-3.6, U + 0.006, -0.62), (-3.1, U + 0.006, -0.5)], 0.0025, 'plastic_white')
    P.box(-3.14, U, -0.53, -3.06, U + 0.012, -0.47, 'plastic_dark')
    # the laundry chute: a little door in the landing wall; its shaft drops through the wall into the laundry room
    cx0, cx1, cy0, cy1 = 3.25, 3.7, U + 0.55, U + 0.97
    P.box(cx0 - 0.05, cy0 - 0.05, HZ - T / 2 - 0.012, cx1 + 0.05, cy1 + 0.05, HZ - T / 2, 'trim')
    P.box(cx0, cy0, HZ - T / 2 - 0.02, cx1, cy1, HZ - T / 2 - 0.012, 'door'); P.box(cx0 + 0.04, cy0 + 0.04, HZ - T / 2 - 0.024, cx1 - 0.04, cy1 - 0.04, HZ - T / 2 - 0.02, 'door')
    P.cyl(((cx0 + cx1) / 2, cy1 - 0.06, HZ - T / 2 - 0.035), 0.012, 0.025, 'brass', seg=10, axis='z')
    # (the shaft, boxed in the corner of the laundry room below, the outlet over the dryer)
    P.box(cx0 - 0.05, 1.95, HZ + T / 2, cx1 + 0.05, HG, HZ + T / 2 + 0.5, 'wall_paint'); P.box(cx0, 1.94, HZ + T / 2 + 0.05, cx1, 1.95, HZ + T / 2 + 0.45, 'soot')
    # the laundry room: washer and dryer against the wall under the chute, the basket on the dryer, a shelf
    for x0_, kind in ((2.6, 'washer'), (3.3, 'dryer')):
        P.box(x0_, 0.0, HZ + T / 2 + 0.02, x0_ + 0.68, 0.9, HZ + T / 2 + 0.72, 'enamel')
        P.box(x0_ + 0.02, 0.9, HZ + T / 2 + 0.02, x0_ + 0.66, 1.02, HZ + T / 2 + 0.12, 'enamel')
        P.box(x0_ + 0.08, 0.93, HZ + T / 2 + 0.12, x0_ + 0.4, 0.99, HZ + T / 2 + 0.125, 'plastic_dark')
        P.cyl((x0_ + 0.52, 0.96, HZ + T / 2 + 0.135), 0.03, 0.03, 'steel', seg=12, axis='z')
        cz = HZ + T / 2 + 0.725
        P.cyl((x0_ + 0.34, 0.45, cz), 0.21, 0.03, 'steel', seg=24, axis='z'); P.cyl((x0_ + 0.34, 0.45, cz + 0.016), 0.16, 0.012, 'plastic_dark', seg=24, axis='z')
        P.box(x0_ + 0.03, 0.0, HZ + T / 2 + 0.62, x0_ + 0.65, 0.07, HZ + T / 2 + 0.725, 'plastic_white')
    P.box(2.5, 1.7, HZ + T / 2, 4.1, 1.73, HZ + T / 2 + 0.3, 'trim')
    # the cat tree in the living room corner by the window: carpeted shelves, sisal posts, a cubby, a perch
    tx, tz = 1.05, -3.45
    P.box(tx - 0.3, 0, tz - 0.3, tx + 0.3, 0.06, tz + 0.3, 'carpet_grey')
    for px, pz, h in ((tx - 0.15, tz - 0.15, 1.35), (tx + 0.15, tz + 0.12, 0.9)): P.cyl((px, 0.06 + h / 2, pz), 0.05, h, 'sisal', seg=14)
    P.box(tx - 0.05, 0.44, tz - 0.05, tx + 0.35, 0.48, tz + 0.32, 'carpet_grey')
    P.box(tx - 0.32, 0.9, tz - 0.3, tx + 0.08, 0.94, tz + 0.05, 'carpet_grey')
    P.box(tx + 0.0, 0.94, tz + 0.0, tx + 0.32, 1.22, tz + 0.3, 'carpet_grey'); P.box(tx + 0.04, 0.98, tz + 0.29, tx + 0.28, 1.18, tz + 0.305, 'soot')
    P.cyl((tx - 0.15, 1.43, tz - 0.15), 0.2, 0.05, 'carpet_grey', seg=20); P.cyl((tx - 0.15, 1.47, tz - 0.15), 0.21, 0.05, 'carpet_grey', seg=20, r2=0.23)
    sphere(P, (tx + 0.26, 0.5, tz + 0.18), (0.025, 0.025, 0.025), 'runner')
    # outlets and switches at robot height and hand height; the television's cord along the baseboard
    for wl, a, y, k in ((('x', Z0, 1), -0.95, 0.3, 'outlet'), (('x', Z0, 1), -4.6, 0.3, 'outlet'), (('z', PART - T / 2, -1), -3.3, 0.3, 'outlet'),
                        (('z', PART - T / 2, -1), -0.85, 1.2, 'switch'), (('z', X0, 1), -0.6, 0.3, 'outlet'), (('x', Z1, -1), -1.75, 1.1, 'outlet'),
                        (('z', X0, 1), 0.4, 1.1, 'outlet'), (('z', PART - T / 2, -1), 1.3, 1.2, 'switch'), (('x', Z0, 1), -4.7, U + 0.3, 'outlet'),
                        (('z', PART - T / 2, -1), -1.6, U + 1.2, 'switch'), (('x', KZ - T / 2, -1), -4.7, U + 0.3, 'outlet'), (('x', Z0, 1), 2.0, U + 0.3, 'outlet'),
                        (('z', PART + T / 2, 1), -0.2, 1.2, 'switch'), (('x', HZ + T / 2, 1), 4.3, 1.1, 'outlet')):
        outlet(P, wl, a, y, k)
    cable(P, [(-4.45, 0.4, -3.75), (-4.62, 0.2, -3.86), (-4.7, 0.006, -3.9), (-4.6, 0.006, -3.97), (-4.6, 0.27, -3.99)], 0.003, 'plastic_dark')
    # the robot vacuum asleep in its dock in the hall
    vx, vz = 3.45, HZ - T / 2
    P.box(vx - 0.09, 0, vz - 0.08, vx + 0.09, 0.1, vz, 'plastic_dark')
    P.cyl((vx, 0.045, vz - 0.27), 0.17, 0.08, 'plastic_dark', seg=32); P.cyl((vx, 0.088, vz - 0.27), 0.12, 0.006, 'steel', seg=24)
    P.cyl((vx, 0.092, vz - 0.17), 0.01, 0.004, 'lamp_glass', seg=8)

def build_rooms(P, G):
    build_fireplace(P)
    radiator(P, -2.6, 0, Z0 + 0.12, 1.15)
    radiator(P, -2.6, U, Z0 + 0.12, 1.0)
    radiator(P, X1 - 0.12, 0, -3.3, 0.6, along='z')
    build_kitchen(P)
    # the bed: a panelled headboard with posts, a footboard, side rails high enough to crawl under, the mattress
    # (the duvet is the game's)
    bx, bz, BW, BL = -3.2, -0.95, 1.6, 2.1
    RB, RT, MT = U + 0.3, U + 0.42, U + 0.62
    for xx in (bx - BW / 2, bx + BW / 2 - 0.04):
        P.box(xx, RB, bz - BL / 2, xx + 0.04, RT, bz + BL / 2, 'bed_wood')
    for k in range(9): zz = bz - BL / 2 + 0.12 + k * (BL - 0.24) / 8; P.box(bx - BW / 2 + 0.04, RT - 0.03, zz - 0.04, bx + BW / 2 - 0.04, RT - 0.01, zz + 0.04, 'bed_wood')
    P.box(bx - BW / 2 + 0.03, RT - 0.01, bz - BL / 2 + 0.03, bx + BW / 2 - 0.03, MT, bz + BL / 2 - 0.03, 'mattress')
    for xx in (bx - BW / 2 - 0.03, bx + BW / 2 - 0.04):
        P.box(xx, U, KZ - 0.09, xx + 0.07, U + 1.3, KZ - 0.02, 'bed_wood'); P.cyl((xx + 0.035, U + 1.34, KZ - 0.055), 0.03, 0.08, 'bed_wood', seg=12)
        P.box(xx, U, bz - BL / 2 - 0.07, xx + 0.07, U + 0.9, bz - BL / 2, 'bed_wood'); P.cyl((xx + 0.035, U + 0.94, bz - BL / 2 - 0.035), 0.03, 0.08, 'bed_wood', seg=12)
    P.box(bx - BW / 2 + 0.04, U + 0.62, KZ - 0.08, bx + BW / 2 - 0.04, U + 1.2, KZ - 0.04, 'bed_wood')
    P.box(bx - BW / 2 + 0.04, U + 1.18, KZ - 0.09, bx + BW / 2 - 0.04, U + 1.23, KZ - 0.02, 'bed_wood')
    P.box(bx - BW / 2 + 0.04, U + 0.45, bz - BL / 2 - 0.065, bx + BW / 2 - 0.04, U + 0.82, bz - BL / 2 - 0.01, 'bed_wood')
    # rugs
    P.box(-4.0, 0.004, -3.3, -1.7, 0.016, -1.1, 'rug'); P.box(-4.1, U + 0.004, -2.6, -2.3, U + 0.014, -0.2, 'rug_bed')
    P.box(PART + 0.5, 0.004, -3.6, PART + 1.3, 0.012, 0.3, 'rug')
    # a closet with bifold doors in the bedroom
    cx0, cx1 = -1.3, 0.4
    P.box(cx0 - 0.04, U, KZ - 0.62, cx0, TOP, KZ - 0.07, 'wall_bed'); P.box(cx1 - 0.08 if False else cx1, U, KZ - 0.62, PART - T / 2, TOP, KZ - 0.07, 'wall_bed')
    P.box(cx0 - 0.04, U + 2.05, KZ - 0.64, cx1, TOP, KZ - 0.58, 'wall_bed')
    pw = (cx1 - cx0) / 4
    for i in range(4):
        a0 = cx0 + i * pw + 0.003; a1 = a0 + pw - 0.006
        if i < 2:   # the left pair folded together, standing out square from the jamb: the closet left open
            xx = cx0 + 0.012 + i * 0.024
            P.box(xx - 0.01, U + 0.01, KZ - 0.62 - pw + 0.01, xx + 0.01, U + 2.04, KZ - 0.62, 'door')
            for y0, y1 in ((U + 0.12, U + 0.95), (U + 1.05, U + 1.95)):
                sx = -1 if i == 0 else 1
                P.box(xx + sx * 0.01, y0, KZ - 0.62 - pw + 0.06, xx + sx * 0.014, y1, KZ - 0.62 - 0.05, 'door')
            continue
        P.box(a0, U + 0.01, KZ - 0.62, a1, U + 2.04, KZ - 0.6, 'door')
        for y0, y1 in ((U + 0.12, U + 0.95), (U + 1.05, U + 1.95)): P.box(a0 + 0.05, y0, KZ - 0.625, a1 - 0.05, y1, KZ - 0.62, 'door')
    P.cyl(((cx0 + cx1) / 2, U + 1.75, KZ - 0.32), 0.012, cx1 - cx0 - 0.05, 'steel', seg=10, axis='x')
    P.box(cx0, U + 1.85, KZ - 0.6, cx1, U + 1.87, KZ - 0.08, 'trim')
    for i, x in enumerate((cx0 + 0.2, cx0 + 0.55, cx0 + 0.95)):
        P.obox((x, U + 0.06 + (0.12 if i == 1 else 0), KZ - 0.3), (0.32, 0.12, 0.2), 'cardboard', ry=0.05 * i); P.obox((x, U + 0.125 + (0.12 if i == 1 else 0), KZ - 0.3), (0.325, 0.015, 0.205), 'cardboard', ry=0.05 * i)
    casing(P, ('x', KZ - 0.62), cx0, cx1, U, U + 2.05, -1)
    # curtains: lined drapes on rods over the living room and bedroom windows
    def drape(a0, a1, y0, y1, z, folds):
        n = 28; pts = []
        for i in range(n + 1):
            u = i / n; pts.append((a0 + (a1 - a0) * u, math.sin(u * math.pi * 2 * folds) * 0.035))
        for i in range(n):
            (xa, da), (xb, db) = pts[i], pts[i + 1]
            P.poly([(xa, y0, z + da), (xb, y0, z + db), (xb, y1, z + db), (xa, y1, z + da)], 'curtain')
            P.poly([(xa, y1, z + da + 0.004), (xb, y1, z + db + 0.004), (xb, y0, z + db + 0.004), (xa, y0, z + da + 0.004)], 'curtain')
    for a0, a1, y0, y1 in ((-4.5, -3.75, 0.06, 2.5), (-1.45, -0.7, 0.06, 2.5), (-4.05, -3.35, U + 0.25, U + 2.42), (-1.85, -1.15, U + 0.25, U + 2.42)):
        drape(a0, a1, y0, y1, Z0 + 0.12, (a1 - a0) / 0.14)
    for a0, a1, y in ((-4.55, -0.65, 2.52), (-4.1, -1.1, U + 2.44)):
        P.cyl(((a0 + a1) / 2, y, Z0 + 0.1), 0.014, a1 - a0, 'brass', seg=8, axis='x')

# ------------------------------------------------------------------------------------------------ the outside
def siding(P, ext_open):
    """lap siding: courses 17.8 cm to the weather, each board thicker at its lower edge, broken round the trim"""
    EXP = 0.178
    holes = {k: [] for k in 'NSEW'}
    for w, a0, a1, s, h, units, grid, shade, sh in WINDOWS:
        ext = 0.6 if sh else 0
        holes[w].append((a0 - 0.1 - (min(0.5, (a1 - a0) / units / 2 + 0.06) + 0.0 if sh else 0), a1 + 0.1 + (min(0.5, (a1 - a0) / units / 2 + 0.06) if sh else 0), s - 0.045, h + 0.15))
    for w, a0, a1, h in EXT_DOORS: holes[w].append((a0 - 0.11, a1 + 0.11, -1, h + 0.17))
    holes['W'].append((-3.02, -1.38, -1, 99))                                          # the chimney
    spans = {'N': (X0 - T - 0.0, X1 + T), 'S': (X0 - T, X1 + T), 'W': (Z0 - T, Z1 + T), 'E': (Z0 - T, Z1 + T)}
    for w, (ax, c, s) in WALL.items():
        a0, a1 = spans[w]; a0 += 0.1; a1 -= 0.1                                        # (inside the corner boards)
        gable = w in 'EW'
        y = 0.02; k = 0
        ymax = TOP + (Z1 + T) * PITCH if gable else TOP
        while y < ymax - 0.02:
            y1 = min(y + EXP, ymax)
            lo, hi = a0, a1
            if gable and y1 > TOP:
                half = (Z1 + T) * (1 - (y1 - TOP) / ((Z1 + T) * PITCH)); lo, hi = max(a0, -half), min(a1, half)
                if hi - lo < 0.05: break
            for s0, s1 in covered(holes[w], lo, hi, (y + y1) / 2):
                d0, d1 = T / 2 + 0.006, T / 2 + 0.022
                pa = lambda a, yy, d: wpt(w, a, yy, d)
                # the board's face, sloping out to its lower edge; its underside; its ends
                q = [pa(s0, y, d1), pa(s1, y, d1), pa(s1, y1, d0), pa(s0, y1, d0)]
                P.poly(q if (s > 0) == (ax == 'x') else q[::-1], 'siding')
                q = [pa(s0, y, d0), pa(s1, y, d0), pa(s1, y, d1), pa(s0, y, d1)]
                P.poly(q if (s > 0) == (ax == 'x') else q[::-1], 'siding')
            y = y1; k += 1
    # corner boards
    for x in (X0 - T, X1 + T):
        for z in (Z0 - T, Z1 + T):
            sx, sz = (1 if x > 0 else -1), (1 if z > 0 else -1)
            P.box(x - sx * 0.1, -0.05, z, x + sx * 0.03, TOP, z + sz * 0.03, 'ext_trim')
            P.box(x, -0.05, z - sz * 0.1, x + sx * 0.03, TOP, z + sz * 0.03, 'ext_trim')
    # frieze boards under the eaves
    for z, s in ((Z0 - T, -1), (Z1 + T, 1)): P.box(X0 - T, TOP - 0.22, z, X1 + T, TOP, z + s * 0.028, 'ext_trim')

def foundation(P):
    e = 0.03; xa, xb, za, zb = X0 - T - e, X1 + T + e, Z0 - T - e, Z1 + T + e
    for b in ((xa, za, xb, za + 0.3), (xa, zb - 0.3, xb, zb), (xa, za, xa + 0.3, zb), (xb - 0.3, za, xb, zb)):
        P.box(b[0], GRADE - 0.1, b[1], b[2], -0.004, b[3], 'foundation')
    # basement windows (dark), a dryer vent
    for x in (-3.2, 0.4, 3.6):
        P.box(x - 0.3, GRADE + 0.1, Z1 + T + 0.03, x + 0.3, GRADE + 0.45, Z1 + T + 0.035, 'soot')
        P.box(x - 0.33, GRADE + 0.07, Z1 + T + 0.03, x + 0.33, GRADE + 0.1, Z1 + T + 0.06, 'concrete')

def roof(P):
    """side gable, ridge along x at z = 0: deck, shingle courses (three-tab, a little uneven), ridge cap, fascia,
    soffits, rake boards, gutters and downspouts, a gable vent"""
    run = Z1 + T; ridge = TOP + 0.16 + run * PITCH
    xr0, xr1 = X0 - T - RAKE, X1 + T + RAKE
    ang = math.atan(PITCH)
    def surf(z):   # top of the roof deck at distance z from the ridge line
        return TOP + 0.16 + (run - abs(z)) * PITCH
    for s in (-1, 1):
        ze = s * (run + EAVE)
        # the deck slab (rafters and sheathing)
        pts = [(ze, surf(ze) - 0.18), (ze, surf(ze)), (0, ridge), (0, ridge - 0.18)]
        P.prism(pts, 'x', xr0, xr1, 'sheathing')
        # shingle courses from the eave up
        L = (run + EAVE) / math.cos(ang); n = int(L / 0.14)
        for i in range(n):
            d0 = i * 0.14; d1 = min(L, d0 + 0.2)
            z0 = ze - s * d0 * math.cos(ang); z1 = ze - s * d1 * math.cos(ang)
            y0 = surf(z0) + 0.002; y1 = surf(z1) + 0.002
            off = (i % 2) * 0.165
            x = xr0 - off
            while x < xr1:
                xa, xb = max(xr0, x + 0.003), min(xr1, x + 0.33 - 0.003)
                if xb - xa > 0.02:
                    th = 0.011 + RND.random() * 0.004; drop = RND.random() * 0.004
                    q_top = [(xa, y0 + th - drop, z0 + s * 0.0), (xb, y0 + th - drop, z0), (xb, y1 + 0.004, z1), (xa, y1 + 0.004, z1)]
                    P.poly(q_top if s > 0 else q_top[::-1], 'shingle')
                    q_edge = [(xa, y0 - drop, z0), (xb, y0 - drop, z0), (xb, y0 + th - drop, z0), (xa, y0 + th - drop, z0)]
                    P.poly(q_edge if s > 0 else q_edge[::-1], 'shingle')
                x += 0.33
        # fascia, soffit, frieze-to-fascia
        ye = surf(ze) - 0.18
        P.box(xr0, ye - 0.06, ze, xr1, surf(ze) + 0.01, ze + s * 0.025, 'ext_trim')
        P.box(X0 - T, ye - 0.02, s * run, X1 + T, ye, ze, 'ext_trim')
        # the gutter (half round with a lip) and two downspouts
        gz = ze + s * 0.075
        prof = [(math.cos(t) * 0.065, -math.sin(t) * 0.065) for t in [i * math.pi / 10 for i in range(11)]]
        prof = prof + [(0.06, 0.0)][:0]
        shell = [(u, v) for u, v in prof] + [(u * 0.92, v * 0.92) for u, v in prof[::-1]]
        P.sweep(shell, (xr0, ye + 0.02, gz), (xr1, ye + 0.02, gz), (0, 0, 1), (0, 1, 0), 'gutter')
        for x in (X0 - T + 0.25, X1 + T - 0.25):
            P.box(x - 0.035, -0.5, s * (run + 0.03), x + 0.035, ye - 0.05, s * (run + 0.08), 'gutter')
            P.box(x - 0.035, ye - 0.05, s * (run + 0.03), x + 0.035, ye + 0.02, gz + 0.03 * s, 'gutter')
            P.box(x - 0.035, GRADE - 0.02, s * (run + 0.03), x + 0.035, GRADE + 0.1, s * (run + 0.4), 'gutter')
    # rake boards along the gable edges, the ridge cap
    for x in (xr0, xr1):
        sx = 1 if x > 0 else -1
        for s in (-1, 1):
            ze = s * (run + EAVE)
            P.prism([(ze, surf(ze) - 0.2), (ze, surf(ze) + 0.02), (0, ridge + 0.02), (0, ridge - 0.2)], 'x', x - sx * 0.025, x, 'ext_trim')
    for i in range(int((xr1 - xr0) / 0.25)):
        xa = xr0 + i * 0.25; xb = xa + 0.27
        P.prism([(-0.16, ridge - 0.16 * PITCH + 0.012), (0, ridge + 0.02), (0.16, ridge - 0.16 * PITCH + 0.012), (0, ridge + 0.005)], 'x', xa, min(xb, xr1), 'shingle')
    # gable vents
    for x, sx in ((X0 - T, -1), (X1 + T, 1)):
        y0 = TOP + 1.2
        P.box(x + sx * 0.02, y0, -0.35, x + sx * 0.05, y0 + 0.7, 0.35, 'ext_trim')
        for k in range(8): P.box(x + sx * 0.05, y0 + 0.08 + k * 0.07, -0.29, x + sx * 0.07, y0 + 0.11 + k * 0.07, 0.29, 'vent')

def chimney(P):
    x0, x1 = X0 - T - 0.62, X0 - T
    P.box(x0, GRADE - 0.05, -3.02, x1, 3.3, -1.38, 'brick')
    # shoulders sloping in to the stack
    P.prism([(-3.02, 3.3), (-1.38, 3.3), (-1.8, 3.9), (-2.6, 3.9)], 'x', x0 + 0.08, x1, 'brick')
    run = Z1 + T; ridge = TOP + 0.16 + run * PITCH
    P.box(x0 + 0.08, 3.9, -2.6, x1 - 0.05, ridge + 0.9, -1.8, 'brick')
    P.box(x0 + 0.03, ridge + 0.9, -2.65, x1 + 0.0, ridge + 0.98, -1.75, 'concrete')
    for z in (-2.42, -1.98): P.box(x0 + 0.2, ridge + 0.98, z - 0.12, x0 + 0.42, ridge + 1.18, z + 0.12, 'flue')

def porch(P):
    """the front porch: a floor of painted boards on a lattice skirt, brick steps, four columns, a railing, a shed roof"""
    px0, px1, pz0, pz1, py = 1.0, 4.95, Z0 - T - 2.1, Z0 - T, -0.08
    P.box(px0, GRADE, pz0, px1, py - 0.03, pz1, 'lattice')
    for i in range(int((px1 - px0) / 0.09)):
        x = px0 + i * 0.09
        P.box(x + 0.003, py - 0.03, pz0 - 0.03, min(px1, x + 0.087), py, pz1, 'porch_floor')
    P.box(px0 - 0.03, py - 0.2, pz0 - 0.04, px1 + 0.03, py - 0.03, pz0, 'ext_trim')
    rs = (py - GRADE) / 3
    for k in range(2):   # brick steps down to the walk, bluestone treads
        top = py - rs * (k + 1)
        P.box(2.05, GRADE - 0.05, pz0 - 0.29 * (k + 1), 3.55, top - 0.03, pz0 - 0.29 * k, 'brick')
        P.box(2.02, top - 0.03, pz0 - 0.29 * (k + 1) - 0.02, 3.58, top, pz0 - 0.29 * k, 'concrete')
    cols = [(px0 + 0.12, pz0 + 0.12), (2.0, pz0 + 0.12), (3.6, pz0 + 0.12), (px1 - 0.12, pz0 + 0.12)]
    for x, z in cols:
        P.box(x - 0.11, py, z - 0.11, x + 0.11, py + 0.2, z + 0.11, 'ext_trim')
        P.cyl((x, py + 1.3, z), 0.075, 2.2, 'ext_trim', seg=16, r2=0.065)
        P.box(x - 0.1, py + 2.4, z - 0.1, x + 0.1, py + 2.48, z + 0.1, 'ext_trim')
    # railings between the columns (not across the steps), and along the sides back to the house
    def railing(a, b):
        A, B_ = Vector(a), Vector(b); d = (B_ - A); L = d.length; d.normalize()
        n = int(L / 0.11)
        for i in range(1, n):
            p = A + d * (i * L / n)
            P.box(p.x - 0.017, py + 0.08, p.z - 0.017, p.x + 0.017, py + 0.86, p.z + 0.017, 'ext_trim')
        side = Vector((-d.z, 0, d.x))
        P.sweep([(-0.045, 0), (0.045, 0), (0.035, 0.05), (-0.035, 0.05)], (A.x, py + 0.86, A.z), (B_.x, py + 0.86, B_.z), side, (0, 1, 0), 'ext_trim')
        P.sweep([(-0.035, 0), (0.035, 0), (0.035, 0.05), (-0.035, 0.05)], (A.x, py + 0.04, A.z), (B_.x, py + 0.04, B_.z), side, (0, 1, 0), 'ext_trim')
    zc = pz0 + 0.12
    railing((px0 + 0.12, 0, zc), (2.0, 0, zc)); railing((3.6, 0, zc), (px1 - 0.12, 0, zc))
    railing((px0 + 0.12, 0, zc), (px0 + 0.12, 0, pz1 - 0.05)); railing((px1 - 0.12, 0, zc), (px1 - 0.12, 0, pz1 - 0.05))
    # the beam on the columns, the shed roof sloping out from the wall, the beadboard ceiling
    yb = py + 2.48
    P.box(px0 - 0.05, yb, pz0 + 0.02, px1 + 0.05, yb + 0.22, pz0 + 0.22, 'ext_trim')
    yr0, yr1 = yb + 0.22, yb + 0.62
    P.prism([(pz0 - 0.3, yr0 - 0.02), (pz0 - 0.3, yr0 + 0.08), (pz1, yr1 + 0.12), (pz1, yr1 - 0.02)], 'x', px0 - 0.3, px1 + 0.3, 'sheathing')
    slope = (yr1 - yr0) / (pz1 - pz0 + 0.3)
    for i in range(int((pz1 - pz0 + 0.3) / 0.14)):
        z0 = pz0 - 0.3 + i * 0.14; z1 = z0 + 0.2
        y0 = yr0 + 0.08 + (z0 - pz0 + 0.3) * slope; y1 = yr0 + 0.08 + (min(z1, pz1) - pz0 + 0.3) * slope
        P.poly([(px0 - 0.3, y0 + 0.012, z0), (px1 + 0.3, y0 + 0.012, z0), (px1 + 0.3, y1 + 0.004, min(z1, pz1)), (px0 - 0.3, y1 + 0.004, min(z1, pz1))][::-1], 'shingle')
        P.poly([(px0 - 0.3, y0, z0), (px1 + 0.3, y0, z0), (px1 + 0.3, y0 + 0.012, z0), (px0 - 0.3, y0 + 0.012, z0)][::-1], 'shingle')
    P.box(px0 - 0.3, yr0 - 0.2, pz0 - 0.32, px1 + 0.3, yr0 + 0.09, pz0 - 0.3, 'ext_trim')
    P.box(px0, yb + 0.2, pz0 + 0.2, px1, yb + 0.22, pz1, 'beadboard')
    gz = pz0 - 0.38
    prof = [(math.cos(t) * 0.06, -math.sin(t) * 0.06) for t in [i * math.pi / 10 for i in range(11)]]
    shell = prof + [(u * 0.9, v * 0.9) for u, v in prof[::-1]]
    P.sweep(shell, (px0 - 0.3, yr0 - 0.12, gz), (px1 + 0.3, yr0 - 0.12, gz), (0, 0, 1), (0, 1, 0), 'gutter')
    # the porch lamp beside the door: a black lantern
    lx, ly, lz = 2.05, 1.75, Z0 - T - 0.06
    P.box(lx - 0.07, ly - 0.15, lz - 0.02, lx + 0.07, ly + 0.15, lz, 'black_metal')
    P.box(lx - 0.075, ly - 0.12, lz - 0.17, lx + 0.075, ly + 0.12, lz - 0.02, 'lamp_glass')
    P.box(lx - 0.09, ly + 0.12, lz - 0.19, lx + 0.09, ly + 0.15, lz - 0.0, 'black_metal')
    P.box(lx - 0.06, ly - 0.15, lz - 0.16, lx + 0.06, ly - 0.12, lz - 0.03, 'black_metal')
    # house numbers, the mailbox
    P.box(3.45, 1.55, Z0 - T - 0.03, 3.75, 1.8, Z0 - T - 0.01, 'brass')
    P.box(1.25, 1.1, Z0 - T - 0.08, 1.55, 1.42, Z0 - T - 0.01, 'black_metal')

def deck(P):
    """the back deck (its top as in the game), board by board, on joists and posts, with railings and steps"""
    x0, x1, z0, z1 = -2.65, 0.95, Z1 + T, Z1 + T + 2.0
    for i in range(int((z1 - z0) / 0.146)):
        z = z0 + i * 0.146
        P.box(x0, DECK - 0.026, z + 0.003, x1, DECK, min(z1, z + 0.143), 'deck')
    P.box(x0 - 0.04, DECK - 0.24, z1, x1 + 0.04, DECK - 0.026, z1 + 0.04, 'deck')
    for x in (x0 - 0.04, x1): P.box(x, DECK - 0.24, z0, x + 0.04, DECK - 0.026, z1 + 0.04, 'deck')
    for x in (x0 + 0.05, x1 - 0.05):
        P.box(x - 0.045, GRADE - 0.05, z1 - 0.09, x + 0.045, DECK - 0.24, z1, 'deck')
    def rail(a, b):
        A, B_ = Vector(a), Vector(b); d = B_ - A; L = d.length; d.normalize(); side = Vector((-d.z, 0, d.x))
        for i in range(int(L / 0.12) + 1):
            p = A + d * min(L, i * 0.12)
            P.box(p.x - 0.019, DECK, p.z - 0.019, p.x + 0.019, DECK + 0.9, p.z + 0.019, 'deck')
        P.sweep([(-0.07, 0), (0.07, 0), (0.07, 0.035), (-0.07, 0.035)], (A.x, DECK + 0.9, A.z), (B_.x, DECK + 0.9, B_.z), side, (0, 1, 0), 'deck')
        for p in (A, B_): P.box(p.x - 0.045, DECK, p.z - 0.045, p.x + 0.045, DECK + 0.98, p.z + 0.045, 'deck')
    rail((x0 + 0.02, 0, z0 + 0.05), (x0 + 0.02, 0, z1 - 0.02)); rail((x1 - 0.02, 0, z0 + 0.05), (x1 - 0.02, 0, z1 - 0.02))
    rail((x0 + 0.02, 0, z1 - 0.02), (-1.6, 0, z1 - 0.02)); rail((-0.1, 0, z1 - 0.02), (x1 - 0.02, 0, z1 - 0.02))
    for i in range(3):   # the steps (tops as in the game)
        top = DECK - 0.18 * (i + 1); zc = z0 + 2.15 + i * 0.3
        P.box(-1.55, top - 0.03, zc - 0.15, -0.15, top, zc + 0.15, 'deck')
        P.box(-1.55, max(GRADE, top - 0.18), zc - 0.15, -0.15, top - 0.03, zc - 0.12, 'deck')
    for x in (-1.58, -0.12):
        P.prism([(z1, DECK - 0.03), (z1 + 0.95, GRADE), (z1, GRADE)], 'z', 0, 0, 'deck') if False else None
        P.box(x - 0.02, GRADE, z1, x + 0.02, DECK - 0.03, z1 + 0.9, 'deck')

def yard(P):
    """ground round the house (lawn), the front walk, the driveway, the back fence, the side fences"""
    P.box(-12, GRADE - 0.05, -10.5, 12, GRADE, 17, 'lawn')
    P.box(2.25, GRADE, -10.6, 3.35, GRADE + 0.012, Z0 - T - 2.1 - 0.87, 'concrete')
    P.box(5.45, GRADE, -10.6, 8.35, GRADE + 0.014, 3.5, 'concrete')
    for z in [-10.6 + 1.5 * i for i in range(10)]: P.box(5.45, GRADE + 0.0141, z - 0.006, 8.35, GRADE + 0.0145, z + 0.006, 'asphalt')
    zf = Z1 + T + 11.5
    def fence(ax, c, a0, a1, h=1.8):
        a = a0
        while a < a1 - 0.01:
            b = min(a1, a + 0.14)
            if ax == 'x':
                if not (abs((a + b) / 2) < 3.2 and c == zf):
                    P.box(a + 0.002, GRADE, c - 0.01, b - 0.002, GRADE + h - 0.04, c + 0.01, 'fence')
                    P.prism([(a + 0.002, GRADE + h - 0.04), (b - 0.002, GRADE + h - 0.04), (b - 0.03, GRADE + h), (a + 0.03, GRADE + h)], 'z', c - 0.01, c + 0.01, 'fence')
            else:
                P.box(c - 0.01, GRADE, a + 0.002, c + 0.01, GRADE + h - 0.04, b - 0.002, 'fence')
                P.prism([(a + 0.002, GRADE + h - 0.04), (b - 0.002, GRADE + h - 0.04), (b - 0.03, GRADE + h), (a + 0.03, GRADE + h)], 'x', c - 0.01, c + 0.01, 'fence') if False else P.box(c - 0.01, GRADE + h - 0.04, a + 0.03, c + 0.01, GRADE + h, b - 0.03, 'fence')
            a = b
        for p in [a0 + k * 2.4 for k in range(int((a1 - a0) / 2.4) + 1)] + [a1]:
            if ax == 'x': P.box(p - 0.045, GRADE, c + 0.01, p + 0.045, GRADE + h - 0.05, c + 0.1, 'fence')
            else: P.box(c + 0.01, GRADE, p - 0.045, c + 0.1, GRADE + h - 0.05, p + 0.045, 'fence')
        for y in (0.3, h - 0.3):
            if ax == 'x': P.box(a0, GRADE + y, c + 0.01, a1, GRADE + y + 0.09, c + 0.05, 'fence')
            else: P.box(c + 0.01, GRADE + y, a0, c + 0.05, GRADE + y + 0.09, a1, 'fence')
    fence('x', zf, -9.0, 9.0)
    P.box(-3.2, GRADE, zf - 0.01, 3.2, GRADE + 0.9, zf + 0.01, 'fence')
    fence('z', -9.0, Z1 + T + 0.5, zf); fence('z', 9.0, 3.6, zf)
    fence('x', 3.6, X1 + T, 5.4, h=1.8)

# ------------------------------------------------------------------------------------------------ furniture
FURN_DIR = os.path.join(REPO, 'public', 'models', 'house')
BUDGET = {'tea_set_01': 2500, 'shrub_01': 5000, 'shrub_02': 5000, 'shrub_03': 5000, 'shrub_04': 5000, 'potted_plant_02': 7000, 'chess_set': 2500,
          'vintage_suitcase': 2500, 'electric_stove': 7000, 'binoculars': 1500, 'covered_car': 7000, 'rubber_boots': 4000, 'metal_trash_can': 2500,
          'wine_bottles_01': 1500, 'outdoor_table_chair_set_01': 5000, 'book_encyclopedia_set_01': 4000, 'vintage_video_camera': 1500, 'mousetrap': 800,
          'brass_candleholders': 1500, 'round_spectacles': 800, 'gamepad': 1000, 'desk_lamp_arm_01': 3000, 'ceiling_fan': 3000, 'mantel_clock_01': 1500,
          'pachira_aquatica_01': 9000, 'anthurium_botany_01': 6000, 'calathea_orbifolia_01': 6000, 'classic_laptop': 2500, 'portable_cassette_player': 1500,
          'stationery_supplies': 1500, 'Lantern_01': 2500, 'round_wooden_table_01': 4000}

def bbox3(ob):
    """an object's box in the three.js frame: (x0, y0, z0, x1, y1, z1)"""
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    xs = [v.x for v in vs]; ys = [v.z for v in vs]; zs = [-v.y for v in vs]
    return min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)

def rest_height(ob, x, z, y_hint, reach=0.35):
    """the height an object comes to rest at: rays cast down at its footprint onto whatever is below (not itself)"""
    sc = bpy.context.scene
    coll = ob.users_collection[0]; coll.objects.unlink(ob); bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    x0, _, z0, x1, _, z1 = bbox3(ob)
    hits = []
    for fx, fz in ((0.5, 0.5), (0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
        px, pz = x0 + (x1 - x0) * fx, z0 + (z1 - z0) * fz
        hit, loc, *_ = sc.ray_cast(dg, bl((px, y_hint + reach, pz)), Vector((0, 0, -1)), distance=reach * 2 + 0.2)
        hits.append(loc.z if hit and loc.z > y_hint - reach - 0.1 else None)
    # it rests on the highest support under it, but not on an edge well above its middle (the next step, a wall's lip)
    c = hits[0] if hits[0] is not None else max([h for h in hits if h is not None], default=None)
    best = None if c is None else max(h for h in hits if h is not None and h < c + 0.05)
    coll.objects.link(ob); bpy.context.view_layer.update()
    return best

def place(key, x, z, y=0.0, ry=0.0, scale=1.0, name=None, atlas='int', collide=True, settle=True, wall=None, tilt=(0.0, 0.0), pick=None):
    """a scanned piece: imported, joined, decimated to its budget, turned (ry about the vertical, tilt = small leans),
    set down at (x, z) on whatever surface is under it near height y; with wall=('x'|'z', c, sign) pushed flat to a wall"""
    path = os.path.join(FURN_DIR, key + '.glb')
    if not os.path.exists(path): print('missing', key); return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']; empties = [o.name for o in new if o.type != 'MESH']
    if pick:   # (a model holding several variants side by side: keep one)
        import re
        drop = [o for o in meshes if not re.search(pick, o.name)]
        meshes = [o for o in meshes if re.search(pick, o.name)]
        for o in drop: bpy.data.objects.remove(o)
    if not meshes: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for nm in empties:
        e = bpy.data.objects.get(nm)
        if e: bpy.data.objects.remove(e)
    budget = BUDGET.get(key, 5000); tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris > budget:
        md = ob.modifiers.new('Dec', 'DECIMATE'); md.ratio = budget / tris; md.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=md.name)
    ob.rotation_mode = 'XYZ'                   # (the glTF importer leaves objects in quaternion mode: euler angles would be ignored)
    ob.scale = (scale, scale, scale); ob.rotation_euler = (tilt[0], tilt[1], ry)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    x0, y0, z0, x1, y1, z1 = bbox3(ob)
    ob.location = (x - (x0 + x1) / 2, -(z - (z0 + z1) / 2), y - y0)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    if wall:
        ax, c, sg = wall; x0, y0, z0, x1, y1, z1 = bbox3(ob)
        if ax == 'x': d = (c - z0) if sg > 0 else (c - z1); ob.location = (0, -d, 0)
        else: d = (c - x0) if sg > 0 else (c - x1); ob.location = (d, 0, 0)
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    elif settle:
        h = rest_height(ob, x, z, y)
        if h is not None:
            ob.location = (0, 0, h - y + 0.001); bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    ob.name = name or ('f_' + key)
    # small things and plants keep real-time light (their islands would only crowd the lightmap)
    x0, y0, z0, x1, y1, z1 = bbox3(ob)
    if atlas == 'int' and (max(x1 - x0, y1 - y0, z1 - z0) < 0.32 or any(w in key for w in ('plant', 'pachira', 'anthurium', 'calathea', 'shrub', 'frame', 'clock', 'bottle', 'lemon', 'onion', 'spoon', 'mousetrap', 'Ukulele', 'Lantern', 'thermos', 'hat', 'binoculars', 'spectacles', 'camera', 'kettle', 'broom', 'dustpan', 'jug', 'bowl', 'plate', 'pot', 'chess', 'gamepad', 'cleaner', 'bleach', 'gallon', 'laptop', 'notebook', 'cassette', 'candle'))):
        atlas = 'none'
    ob['atlas'] = atlas; ob['collide'] = 1 if collide else 0; ob['key'] = key
    if len(ob.data.uv_layers): ob.data.uv_layers[0].name = 'UVMap'
    return ob

def top_of(ob):
    return max(v.co.z for v in ob.data.vertices) if ob else 0.0

def bevel(ob, w, seg=2, angle=40):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    md = ob.modifiers.new('Bev', 'BEVEL'); md.width = w; md.segments = seg; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(angle)
    md.harden_normals = True; md.use_clamp_overlap = True
    bpy.ops.object.modifier_apply(modifier=md.name)

# ------------------------------------------------------------------------------------------------ soft things (cloth)
def proxy_box(c, size, ry=0.0, bev=0.03):
    """an invisible stand-in for the cloth to fall on (removed before export)"""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=bl(c)); ob = bpy.context.active_object
    ob.scale = (size[0], size[2], size[1]); ob.rotation_euler = (0, 0, ry); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bev: bevel(ob, bev, seg=3, angle=60)
    ob['proxy'] = 1; return ob

def proxy_ball(c, r):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1.0, location=bl(c)); ob = bpy.context.active_object
    ob.scale = (r[0], r[2], r[1]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True); ob['proxy'] = 1; return ob

def cloth(name, w, h, res, c, colliders, mat_name, frames=50, rot=(0.0, 0.0, 0.0), pin=None, tube=None, mass=0.3, stiff=10, bend=0.2,
          friction=10, thick=0.005, noise=0.0, self_col=False):
    """a piece of cloth dropped (or hung, with pin = a test on its rest positions) and let to settle on the colliders"""
    sc = bpy.context.scene
    if tube:   # an open tube (a coat or a shirt hanging): radius, length
        bpy.ops.mesh.primitive_cylinder_add(vertices=res[0], radius=tube[0], depth=tube[1], end_fill_type='NOTHING', location=bl(c))
        ob = bpy.context.active_object; bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.subdivide(number_cuts=res[1]); bpy.ops.object.mode_set(mode='OBJECT')
    else:
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=res[0], y_subdivisions=res[1], size=1.0, location=bl(c))
        ob = bpy.context.active_object; ob.scale = (w, h, 1)
    ob.rotation_euler = rot; bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if noise:
        for v in ob.data.vertices: v.co.z += (RND.random() - 0.5) * noise; v.co.x += (RND.random() - 0.5) * noise * 0.5
    ob.name = name
    if pin:
        vg = ob.vertex_groups.new(name='pin')
        idx = [v.index for v in ob.data.vertices if pin(ob.matrix_world @ v.co)]
        vg.add(idx, 1.0, 'REPLACE')
    md = ob.modifiers.new('Cloth', 'CLOTH'); st = md.settings
    st.quality = 6; st.mass = mass; st.tension_stiffness = stiff; st.compression_stiffness = stiff; st.shear_stiffness = stiff * 0.5
    st.bending_stiffness = bend; st.air_damping = 2.0
    if pin: st.vertex_group_mass = 'pin'
    cs = md.collision_settings; cs.distance_min = 0.004; cs.collision_quality = 3; cs.use_self_collision = self_col
    if self_col: cs.self_distance_min = 0.004
    for co in colliders:
        cm = co.modifiers.new('Col', 'COLLISION'); co.collision.thickness_outer = 0.006; co.collision.cloth_friction = friction
    md.point_cache.frame_start = 1; md.point_cache.frame_end = frames
    sc.frame_start = 1; sc.frame_end = frames
    for f in range(1, frames + 1): sc.frame_set(f)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier='Cloth')
    for co in colliders:
        for m in list(co.modifiers):
            if m.type == 'COLLISION': co.modifiers.remove(m)
    sc.frame_set(1)
    sol = ob.modifiers.new('Sol', 'SOLIDIFY'); sol.thickness = thick; sol.offset = 0; bpy.ops.object.modifier_apply(modifier=sol.name)
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.clear(); ob.data.materials.append(mat(mat_name)); world_uv(ob.data)
    ob['atlas'] = 'int'; ob['collide'] = 0; ob['soft'] = 1
    return ob

# ------------------------------------------------------------------------------------------------ small made things
def book(P, x, y, z, w, h, d, ry=0.0, cover='cover_red', lying=False):
    """a hardback: covers, spine and a cream page block set in from them"""
    if lying: P.obox((x, y + d / 2, z), (w, d, h), cover, ry=ry); P.obox((x + 0.004 * math.cos(ry), y + d / 2, z - 0.004 * math.sin(ry)), (w - 0.006, d - 0.006, h - 0.008), 'book_page', ry=ry); return
    P.obox((x, y + h / 2, z), (w, h, d), cover, ry=ry); P.obox((x, y + h / 2, z), (w + 0.002, h - 0.008, d - 0.006), 'book_page', ry=ry)

def book_row(P, x0, y, z, n, dirx=1.0, along='x', ry=0.0, seed=1):
    r = random.Random(seed); a = 0.0
    for i in range(n):
        th = 0.022 + r.random() * 0.03; hh = 0.18 + r.random() * 0.08; dd = 0.13 + r.random() * 0.06
        cov = r.choice(['cover_red', 'cover_blue', 'cover_green', 'cover_tan'])
        lean = (r.random() - 0.5) * 0.06
        if along == 'x': book(P, x0 + dirx * (a + th / 2), y, z, th, hh, dd, ry=ry, cover=cov)
        else: book(P, x0, y, z + dirx * (a + th / 2), dd, hh, th, ry=ry, cover=cov)
        a += th + 0.002

def book_stack(P, x, y, z, n, seed=3):
    r = random.Random(seed); yy = y
    for i in range(n):
        w = 0.15 + r.random() * 0.06; h = 0.21 + r.random() * 0.05; d = 0.025 + r.random() * 0.02
        book(P, x + (r.random() - 0.5) * 0.02, yy, z + (r.random() - 0.5) * 0.02, w, h, d, ry=(r.random() - 0.5) * 0.4, cover=r.choice(['cover_red', 'cover_blue', 'cover_green', 'cover_tan']), lying=True)
        yy += d

def storage_bin(P, x, y, z, w, h, d, ry=0.0, m='bin_plastic'):
    """an under-bed storage box: a tapered tub, its lid with a lip, clip handles at the ends"""
    P.obox((x, y + h * 0.45, z), (w - 0.02, h * 0.9, d - 0.02), m, ry=ry)
    P.obox((x, y + h * 0.93, z), (w, h * 0.12, d), m, ry=ry)
    for s in (-1, 1):
        c, sn = math.cos(ry), math.sin(ry)
        hx, hz = x + s * (w / 2 + 0.005) * c, z - s * (w / 2 + 0.005) * sn
        P.obox((hx, y + h * 0.8, hz), (0.012, h * 0.3, d * 0.4), m, ry=ry)

def mug(P, x, y, z, m='mug_blue', ry=0.0):
    P.cyl((x, y + 0.048, z), 0.04, 0.096, m, seg=20); P.cyl((x, y + 0.092, z), 0.034, 0.01, 'soot', seg=16)
    P.sweep([(math.cos(t) * 0.007, math.sin(t) * 0.007) for t in [i * math.pi / 3 for i in range(6)]],
            (x + 0.04 * math.cos(ry), y + 0.075, z - 0.04 * math.sin(ry)), (x + 0.065 * math.cos(ry), y + 0.05, z - 0.065 * math.sin(ry)), (0, 0, 1), (0, 1, 0), m)

def table_lamp(P, x, y, z, h=0.55, shade='shade', base='ceramic'):
    P.cyl((x, y + 0.01, z), 0.075, 0.02, 'brass', seg=20); P.cyl((x, y + 0.13, z), 0.06, 0.22, base, seg=20, r2=0.045)
    P.cyl((x, y + 0.3, z), 0.008, 0.16, 'brass', seg=8); P.cyl((x, y + h - 0.1, z), 0.17, 0.2, shade, seg=28, r2=0.11)

def coat_hooks(P, wall_x, z0, z1, y, n):
    P.box(wall_x, y - 0.05, z0, wall_x + 0.02, y + 0.05, z1, 'rail')
    hooks = []
    for i in range(n):
        z = z0 + (z1 - z0) * (i + 0.5) / n
        P.cyl((wall_x + 0.045, y + 0.0, z), 0.007, 0.06, 'brass', seg=8, axis='x'); P.cyl((wall_x + 0.07, y + 0.02, z), 0.009, 0.04, 'brass', seg=8)
        hooks.append((wall_x + 0.07, y + 0.04, z))
    return hooks

def wainscot(P, ax, c, sg, a0, a1, y0=0.0, h=0.9, panel=0.6):
    """a chair rail with raised-panel mouldings below it on a wall face (sg: the room side)"""
    def B(a, b, ya, yb, d0, d1, m='trim'):
        if ax == 'x': P.box(a, ya, c + sg * d0, b, yb, c + sg * d1, m)
        else: P.box(c + sg * d0, ya, a, c + sg * d1, yb, b, m)
    B(a0, a1, y0 + h - 0.02, y0 + h + 0.045, 0, 0.022)
    B(a0, a1, y0 + h + 0.045, y0 + h + 0.06, 0, 0.014)
    n = max(1, round((a1 - a0) / panel)); w = (a1 - a0) / n
    for i in range(n):
        pa, pb = a0 + i * w + 0.08, a0 + (i + 1) * w - 0.08; ya, yb = y0 + 0.24, y0 + h - 0.12
        if pb - pa < 0.12: continue
        for (q0, q1, r0, r1) in ((pa, pb, ya, ya + 0.022), (pa, pb, yb - 0.022, yb), (pa, pa + 0.022, ya, yb), (pb - 0.022, pb, ya, yb)):
            B(q0, q1, r0, r1, 0, 0.012)

def walls_dressing(P):
    # the hall: wainscot on its walls (round the openings), a thermostat, smoke detectors on the ceilings
    wainscot(P, 'z', PART + T / 2, 1, -4.0 + 0.02, -2.6 - 0.08); wainscot(P, 'z', PART + T / 2, 1, -1.0 + 0.08, 0.3 - 0.08)
    wainscot(P, 'x', Z0, 1, PART + T / 2, 2.3 - 0.08); wainscot(P, 'x', HZ - T / 2, -1, PART + T / 2 + 0.02, 2.2 - 0.08)
    P.box(PART + T / 2, 1.42, -1.04, PART + T / 2 + 0.025, 1.54, -0.95, 'plastic_white')
    for (x, y, z) in ((3.0, HG, -2.0), (2.7, TOP, -1.5), (-2.4, TOP, -2.0)):
        P.cyl((x, y - 0.015, z), 0.065, 0.03, 'plastic_white', seg=24)
    # the dining end of the kitchen: beadboard to a cap rail
    for ax, c, sg, a0, a1 in (('z', PART - T / 2, -1, KZ + T / 2, Z1), ('x', KZ + T / 2, 1, -1.0 - 0.2, PART - T / 2)):
        # one panel, V-grooved every 8 cm (the grooves are shallow slots cut into its face)
        if ax == 'z': P.box(c - 0.012, 0.12, a0, c, 0.9, a1, 'beadboard')
        else: P.box(a0, 0.12, c, a1, 0.9, c + 0.012, 'beadboard')
        for k in range(1, int((a1 - a0) / 0.08)):
            a = a0 + k * 0.08
            if ax == 'z': P.box(c - 0.0135, 0.12, a - 0.0025, c - 0.0105, 0.9, a + 0.0025, 'soot')
            else: P.box(a - 0.0025, 0.12, c + 0.0105, a + 0.0025, 0.9, c + 0.0135, 'soot')
        if ax == 'z': P.box(c - 0.03, 0.9, a0, c, 0.94, a1, 'trim')
        else: P.box(a0, 0.9, c, a1, 0.94, c + 0.03, 'trim')
    # picture rails in the living room and the bedroom
    for y, faces in ((2.2, (('x', Z0, 1, X0, PART - T / 2), ('x', KZ - T / 2, -1, X0, PART - T / 2), ('z', X0, 1, Z0, KZ - T / 2))),
                     (U + 2.05, (('x', Z0, 1, X0, PART - T / 2), ('x', KZ - T / 2, -1, X0, PART - T / 2), ('z', X0, 1, Z0, KZ - T / 2)))):
        for ax, c, sg, a0, a1 in faces:
            if ax == 'x': P.box(a0, y, c + (0 if sg > 0 else -0.02), a1, y + 0.035, c + (0.02 if sg > 0 else 0), 'trim')
            else: P.box(c, y, a0, c + 0.02, y + 0.035, a1, 'trim')
    # the ceiling medallion over the fan
    P.cyl((-2.75, HG - 0.012, -2.2), 0.28, 0.024, 'trim', seg=40); P.cyl((-2.75, HG - 0.03, -2.2), 0.2, 0.02, 'trim', seg=40)
def furnish():
    """the house as lived in: each room arranged as a real one, the gameplay pieces where the game expects them,
    small things set down on whatever surface is under them"""
    F = []
    def add(*a, **k):
        o = place(*a, **k)
        if o: F.append(o)
        return o
    Pp = Part('props_int')        # small made things (books, bins, mugs...): collide
    # ---- living room: the sofa faces the fire across the rug and the coffee table; the armchair and the ottoman close
    # the group; the television on a cabinet in the corner by the hearth; the bookcase on the back wall; the cat tree
    # by the window; lamps at the sofa's end; pictures; plants
    add('Sofa_01', -1.45, -2.2, ry=-math.pi / 2)
    ct = add('CoffeeTable_01', -2.75, -2.2, ry=math.pi / 2, scale=0.8)
    add('ArmChair_01', -3.25, -3.45, ry=0.42)
    add('Ottoman_01', -3.3, -0.95, ry=-0.25, scale=0.72)
    cab = add('side_table_01', -4.5, -3.5, ry=math.pi / 4)
    add('television_02', -4.5, -3.5, y=top_of(cab), ry=math.pi / 4)
    add('boombox', -3.85, -3.85, ry=0.12, scale=0.65)
    add('wooden_bookshelf_worn', -3.3, KZ - T / 2 - 0.2, ry=math.pi, wall=('x', KZ - T / 2, -1))
    add('book_encyclopedia_set_01', -3.45, KZ - T / 2 - 0.2, y=1.0, ry=math.pi, collide=False)
    add('side_table_01', -1.45, -3.42, ry=0.0)
    add('anthurium_botany_01', -1.42, -3.42, y=0.55, collide=False, pick='_b$')
    add('side_table_01', -1.45, -0.98, ry=0.4)
    add('throw_pillows_01', -1.4, -2.75, y=0.4, ry=-math.pi / 2 + 0.2, collide=False)
    add('chess_set', -2.85, -2.45, y=0.45, ry=0.35, scale=0.75, collide=False)
    add('gamepad', -2.2, -1.55, y=0.0, ry=0.7, scale=0.8, collide=False)
    add('Ukulele_01', -3.55, Z0 + 0.09, y=0.0, ry=0.0, tilt=(-0.22, 0.0), collide=False, settle=False)
    add('pachira_aquatica_01', -4.5, -0.6, ry=0.4, pick='_b$')
    add('potted_plant_02', 1.15, -1.0 + 0.0, ry=0.5) if False else None
    add('cardboard_box_01', 0.9, -0.28, ry=0.15); add('cardboard_box_01', 1.2, -0.75, ry=-0.3, scale=0.8)
    add('fancy_picture_frame_02', X0 + 0.42, -2.2, y=1.62, ry=math.pi / 2, collide=False, wall=('z', X0 + fd_breast(), 1))
    add('mantel_clock_01', X0 + 0.5, -2.65, y=1.285, ry=math.pi / 2, collide=False)
    add('brass_candleholders', X0 + 0.5, -1.7, y=1.285, ry=math.pi / 2, scale=0.5, collide=False)
    add('hanging_picture_frame_01', 0.35, Z0 + 0.02, y=1.45, ry=0.0, collide=False, wall=('x', Z0, 1))
    add('hanging_picture_frame_02', -0.35, Z0 + 0.02, y=1.65, ry=0.0, collide=False, wall=('x', Z0, 1))
    add('ceiling_fan', -2.75, -2.2, y=HG - 0.5, collide=False, settle=False)
    add('mousetrap', 1.42, -2.95, ry=math.pi / 2, collide=False)
    table_lamp(Pp, -1.45, 0.55, -0.98)
    mug(Pp, -2.45, 0.452, -2.05, ry=0.6)
    # the cat's bed by the hearth
    Pp.cyl((0.72, 0.05, 3.38), 0.27, 0.1, 'carpet_grey', seg=28); Pp.cyl((0.72, 0.07, 3.38), 0.21, 0.06, 'linen', seg=28)      # (the cat's bed, by the warm radiator)
    # ---- the hall: a console with the mirror over it, the coat hooks by the door, the boots, the suitcase and the gear
    add('side_table_01', PART + T / 2 + 0.25, -0.35, ry=math.pi / 2)
    add('wooden_bowl_02', PART + T / 2 + 0.25, -0.25, y=0.6, collide=False)
    add('ornate_mirror_01', PART + T / 2, -0.35, y=1.15, ry=math.pi / 2, collide=False, wall=('z', PART + T / 2, 1))
    hooks = coat_hooks(Pp, PART + T / 2, -3.75, -3.0, 1.72, 4)
    add('fishermans_hat', hooks[3][0] + 0.06, hooks[3][2], y=hooks[3][1] - 0.13, ry=0.3, collide=False, settle=False)
    add('rubber_boots', 2.7, -3.55, ry=0.4, collide=False)
    sc_ = add('vintage_suitcase', 4.3, -3.72, ry=0.08, pick='_01_')
    add('binoculars', 4.3, -3.72, y=0.6, ry=1.3, collide=False)
    add('plastic_thermos', 3.72, -3.8, ry=0.2, collide=False)
    add('Lantern_01', 1.75, -3.45, ry=0.6, collide=False)
    add('wicker_basket_01', 4.6, 0.375, y=0.39, ry=0.1, scale=0.8, name='f_basket_stairs')
    for (z, y, k) in ((0.3, 1.55, 'hanging_picture_frame_03'), (-0.45, 2.05, 'fancy_picture_frame_01'), (-2.35, 3.45, 'hanging_picture_frame_02'), (-2.85, 3.95, 'hanging_picture_frame_01')):
        add(k, X1 - 0.02, z, y=y, ry=-math.pi / 2, collide=False, wall=('z', X1, -1))
    # ---- the kitchen: the round table in the middle of the dining end, chairs at ease round it; things on the counters
    tb = add('round_wooden_table_01', -2.5, 1.85, ry=0.3, scale=0.75)
    for x, z, r in ((-2.5, 1.08, 0.12), (-3.28, 1.9, math.pi / 2 - 0.1), (-2.45, 2.66, math.pi + 0.05), (-1.62, 1.72, -math.pi / 2 + 0.35)):
        add('painted_wooden_chair_01', x, z, ry=r)
    add('wooden_bowl_01', -2.55, 1.85, y=0.7, collide=False)
    for dx, dz in ((0.0, 0.0), (0.05, 0.04), (-0.04, 0.05)): add('lemon', -2.55 + dx, 1.85 + dz, y=0.78, ry=dx * 20, collide=False)
    mug(Pp, -2.2, 0.0, 1.62); Pp.box(-2.85, 0.0, 1.95, -2.62, 0.0, 2.25, 'shade') if False else None
    add('electric_stove', X0 + 0.34, 2.05, ry=math.pi / 2)
    add('vintage_electric_kettle', X0 + 0.32, 2.85, y=0.9, ry=-0.8, collide=False)
    add('jug_01', X0 + 0.3, 1.25, y=0.9, collide=False); add('wooden_spoon', X0 + 0.3, 1.25, y=1.0, tilt=(0.25, 0.0), collide=False, settle=False)
    add('vintage_microwave', X0 + 0.34, Z1 - 0.34, y=0.9, ry=math.pi * 0.75, scale=0.62, collide=False)
    add('wooden_cutting_board', -2.7, Z1 - 0.28, y=0.9, ry=0.2, collide=False)
    add('yellow_onion', -2.65, Z1 - 0.3, y=0.92, collide=False)
    add('wine_bottles_01', -4.0, Z1 - 0.18, y=0.9, collide=False)
    add('multi_cleaner_bottle', -3.75, Z1 - 0.12, y=0.9, collide=False)
    add('vintage_telephone_wall_clock', PART - T / 2, 3.55, y=1.35, ry=-math.pi / 2, collide=False, wall=('z', PART - T / 2, -1))
    add('wall_clock', -0.85, Z1, y=2.2, ry=math.pi, collide=False, wall=('x', Z1, -1))
    add('plastic_broom', X0 + 0.85, KZ + T / 2 + 0.12, ry=0.3, tilt=(0.12, 0.0), collide=False, settle=False)
    add('dustpan', X0 + 0.95, KZ + T / 2 + 0.2, ry=0.8, collide=False)
    add('folding_wooden_stool', -3.95, 3.0, ry=0.4, scale=0.72)
    add('mousetrap', X0 + 0.85, 3.25, ry=0.0, collide=False)
    add('modern_ceiling_lamp_01', -2.5, 1.85, y=HG - 0.95, collide=False, settle=False)
    # a pedal bin, a towel rail on the sink cabinet, magnets and notes on the fridge
    Pp.cyl((1.2, 0.3, 3.65), 0.15, 0.6, 'steel', seg=24); Pp.cyl((1.2, 0.61, 3.65), 0.152, 0.02, 'steel', seg=24); Pp.box(1.17, 0.0, 3.47, 1.23, 0.03, 3.53, 'black_metal')
    Pp.cyl((-3.3, 0.72, Z1 - 0.65), 0.008, 0.45, 'steel', seg=8, axis='x')
    for i, (y, z, m) in enumerate(((1.55, 0.5, 'cover_red'), (1.62, 0.66, 'cover_blue'), (1.32, 0.8, 'cover_green'), (0.85, 0.48, 'cover_tan'))):
        Pp.cyl((X0 + 0.765, y, z), 0.015, 0.008, m, seg=12, axis='x')
    for (y, z, w, h) in ((1.47, 0.62, 0.1, 0.13), (0.92, 0.6, 0.15, 0.1)): Pp.box(X0 + 0.762, y - h / 2, z - w / 2, X0 + 0.764, y + h / 2, z + w / 2, 'book_page')
    # ---- the laundry: bottles on the shelf, the gallon jug, the broom
    for i, k in enumerate(('bleach_bottle', 'all_purpose_cleaner', 'multi_cleaner_bottle')):
        add(k, 2.65 + i * 0.22, HZ + T / 2 + 0.15, y=1.73, ry=i * 0.6, collide=False)
    add('plastic_bottle_gallon', 4.25, HZ + T / 2 + 0.25, ry=0.4, collide=False)
    # ---- the bedroom: the bed's two nightstands with their things, a picture over the bed, the dresser (the basket is
    # the game's), the chair, the hamper, the box with the camera, books
    ns = add('ClassicNightstand_01', -4.45, KZ - 0.32, y=U, ry=math.pi)
    add('desk_lamp_arm_01', -4.45, KZ - 0.45, y=top_of(ns), ry=math.pi * 0.6, scale=0.75, collide=False)
    add('round_spectacles', -4.4, KZ - 0.22, y=top_of(ns), ry=2.2, collide=False)
    add('alarm_clock_01', -4.5, KZ - 0.62, y=top_of(ns), ry=1.2, collide=False)
    ns2 = add('painted_wooden_nightstand', -1.95, KZ - 0.32, y=U, ry=math.pi)
    book_stack(Pp, -1.95, top_of(ns2), KZ - 0.28, 3, seed=5)
    add('standing_picture_frame_01', -1.85, KZ - 0.42, y=top_of(ns2), ry=math.pi + 0.3, collide=False)
    add('hanging_picture_frame_03', -3.2, KZ - T / 2, y=U + 1.45, ry=math.pi, collide=False, wall=('x', KZ - T / 2, -1))
    dr = add('ClassicConsole_01', -0.4, Z0 + 0.32, y=U, ry=0.0)
    add('standing_picture_frame_02', -0.05, Z0 + 0.25, y=top_of(dr), ry=0.25, collide=False)
    add('portable_cassette_player', 0.12, Z0 + 0.35, y=top_of(dr), ry=-0.4, collide=False)
    ch = add('GreenChair_01', 0.75, -3.1, y=U, ry=-math.pi / 2 - 0.5)
    Ph = Part('f_hamper')
    Ph.cyl((1.15, U + 0.28, -1.78), 0.2, 0.56, 'sisal', seg=24, r2=0.22); Ph.cyl((1.15, U + 0.565, -1.78), 0.205, 0.012, 'cover_tan', seg=24)
    Ph.obox((1.2, U + 0.6, -1.86), (0.42, 0.02, 0.42), 'sisal', rx=0.5)
    ho = Ph.finish(smooth_angle=40); ho['atlas'] = 'int'; ho['collide'] = 1; ho['key'] = 'hamper'; F.append(ho)
    cb = add('cardboard_box_01', -4.4, -3.55, y=U, ry=0.3)
    add('vintage_video_camera', -4.38, -3.52, y=U + 0.4, ry=0.9, collide=False)
    add('modern_ceiling_lamp_01', -2.5, -1.7, y=TOP - 0.95, collide=False, settle=False)
    book_stack(Pp, -2.3, U, -2.75, 4, seed=9)
    # under the bed: two storage bins, a shoebox, the bat and the ball, a book face down
    storage_bin(Pp, -3.55, U, -1.45, 0.8, 0.17, 0.55, ry=0.05); storage_bin(Pp, -2.75, U, -1.55, 0.6, 0.15, 0.45, ry=-0.12, m='plastic_white')
    Pp.obox((-2.65, U + 0.055, -0.55), (0.34, 0.11, 0.21), 'cardboard', ry=0.4); Pp.obox((-2.65, U + 0.115, -0.55), (0.345, 0.02, 0.215), 'cardboard', ry=0.4)
    add('baseball_bat', -3.2, -0.5, y=U, ry=1.25, collide=False)
    add('football', -2.3, -1.95, y=U, collide=False, pick='_inflated')
    book(Pp, -3.85, U, -0.75, 0.16, 0.23, 0.025, ry=0.7, cover='cover_blue', lying=True)
    # the bed's pillows (soft, rounded)
    for k, (x, z, r) in enumerate(((-3.6, KZ - 0.3, 0.06), (-2.8, KZ - 0.28, -0.05))):
        po = proxy_box((x, U + 0.69, z), (0.66, 0.15, 0.44), ry=r, bev=0.06); po['proxy'] = 0; po.name = 'soft_pillow%d' % k
        po.data.materials.append(mat('linen')); world_uv(po.data); po['atlas'] = 'int'; po['collide'] = 0; po['soft'] = 1
        for p_ in po.data.polygons: p_.use_smooth = True
        F.append(po)
    # ---- filling the rooms' empty halves, as a household fills them
    # living room, east: a console behind the sofa with a lamp and photos; a rocking chair by the window with a floor
    # lamp and a stack of books (a reading corner)
    con = add('chinese_console_table', -0.84, -2.2, ry=-math.pi / 2)
    table_lamp(Pp, -0.86, top_of(con) if con else 0.66, -2.75, h=0.5)
    add('standing_picture_frame_02', -0.86, -1.95, y=0.66, ry=-math.pi / 2 + 0.3, collide=False)
    add('carved_wooden_plate', -0.86, -1.6, y=0.66, ry=-math.pi / 2, collide=False)
    add('Rockingchair_01', 0.25, -3.1, ry=-0.55)
    Pp.cyl((-0.25, 0.015, -3.72), 0.15, 0.03, 'black_metal', seg=20); Pp.cyl((-0.25, 0.78, -3.72), 0.012, 1.5, 'brass', seg=8)
    Pp.cyl((-0.25, 1.55, -3.72), 0.2, 0.26, 'shade', seg=28, r2=0.14)
    book_stack(Pp, 0.75, 0.0, -2.45, 5, seed=21)
    add('mousetrap', 1.4, -1.3, ry=0.4, collide=False)
    # kitchen, east: a painted cupboard with the brass pot and a plate on it, a radiator, the recycling crate, a plant,
    # a runner at the sink, a mat at the back door
    cup = add('painted_wooden_cabinet', PART - T / 2 - 0.31, 2.45, ry=-math.pi / 2)
    add('brass_pot_01', PART - T / 2 - 0.3, 2.1, y=1.18, collide=False); add('carved_wooden_plate', PART - T / 2 - 0.12, 2.65, y=1.18, ry=-math.pi / 2, tilt=(0.0, -1.3), collide=False, settle=False)
    add('jug_01', PART - T / 2 - 0.3, 2.85, y=1.18, collide=False)
    radiator(Pp, 0.7, 0, Z1 - 0.12, 0.9)
    add('plastic_crate_01', 0.0, 3.62, ry=0.2, scale=0.8)
    add('wine_bottles_01', 0.0, 3.62, y=0.3, collide=False)
    add('calathea_orbifolia_01', 1.25, 0.55, ry=0.6, pick='_b$')
    Pp.box(-4.2, 0.004, 2.92, -2.7, 0.014, 3.32, 'runner'); Pp.box(-1.3, 0.004, 3.45, -0.42, 0.016, 3.92, 'carpet_grey')
    # the laundry room: steel shelves with the household's stores, the water heater, the electrical panel, a bucket, an
    # ironing board against the wall, a crate
    add('steel_frame_shelves_01', 4.1, Z1 - 0.3, ry=math.pi, scale=0.085)
    for i, k in enumerate(('multi_cleaner_bottle', 'bleach_bottle', 'cardboard_box_01', 'wooden_crate_02')):
        add(k, 3.8 + (i % 2) * 0.45, Z1 - 0.3, y=[0.45, 0.45, 0.95, 1.4][i], scale=[1, 1, 0.6, 0.5][i], collide=False)
    Pp.cyl((4.62, 0.8, 1.72), 0.28, 1.5, 'enamel', seg=28); Pp.cyl((4.62, 1.57, 1.72), 0.26, 0.04, 'steel', seg=28)
    cable(Pp, [(4.55, 1.59, 1.72), (4.55, 2.2, 1.72), (4.55, HG, 1.72)], 0.018, 'brass'); cable(Pp, [(4.7, 1.59, 1.72), (4.7, 2.2, 1.6), (4.7, HG, 1.6)], 0.018, 'brass')
    Pp.box(2.0, 1.35, Z1 - 0.12, 2.5, 2.0, Z1, 'iron'); Pp.box(2.03, 1.38, Z1 - 0.125, 2.47, 1.97, Z1 - 0.12, 'plastic_dark')
    add('wooden_bucket_02', 2.25, 3.55, ry=0.4, scale=0.7)
    Pp.obox((1.82, 0.78, 3.6), (0.035, 1.5, 0.36), 'shade', ry=0.0, rz=0.12)
    # the hall: an umbrella stand by the door
    Pp.cyl((3.62, 0.25, -3.72), 0.11, 0.5, 'brass', seg=20)
    for k in range(3): Pp.cyl((3.6 + 0.03 * k, 0.6, -3.72 + 0.02 * (k - 1)), 0.03, 0.75, ['black_metal', 'cover_red', 'cover_blue'][k], seg=8, r2=0.008)
    # the bedroom: a writing desk by the door wall with its chair, laptop, papers and a mug; a tall chest of drawers;
    # the hamper by the desk
    dk = add('SchoolDesk_01', PART - T / 2 - 0.27, -2.4, y=U, ry=-math.pi / 2, scale=0.86)
    add('painted_wooden_chair_02', 0.82, -2.38, y=U, ry=math.pi / 2 - 0.2, scale=0.74)
    add('classic_laptop', PART - T / 2 - 0.27, -2.45, y=U + 0.76, ry=-math.pi / 2 + 0.15, scale=0.6, collide=False)
    add('binder_notebook', PART - T / 2 - 0.22, -2.15, y=U + 0.76, ry=-0.3, scale=0.6, collide=False)
    mug(Pp, PART - T / 2 - 0.2, U + 0.76, -2.66)
    add('drawer_cabinet', X0 + 0.22, -2.4, y=U, ry=math.pi / 2, scale=0.8)
    # the landing: a runner, a bookcase, a small table with a plant, a photo
    Pp.box(2.3, U + 0.004, -3.7, 3.15, U + 0.014, 0.85, 'runner')
    add('Shelf_01', PART + T / 2 + 0.13, -3.1, y=U, ry=math.pi / 2)
    for k, y in enumerate((0.42, 0.85, 1.28)): book_row(Pp, PART + T / 2 + 0.15, U + y, -3.5, 10 + k * 2, along='z', ry=0.0, seed=30 + k)
    add('side_table_tall_01', PART + T / 2 + 0.25, 0.6, y=U, ry=math.pi / 2)
    add('calathea_orbifolia_01', PART + T / 2 + 0.25, 0.6, y=U + 0.7, ry=1.2, pick='_d$', collide=False)
    add('hanging_picture_frame_02', PART + T / 2, -0.1, y=U + 1.45, ry=math.pi / 2, collide=False, wall=('z', PART + T / 2, 1))
    o_props = Pp.finish(smooth_angle=40); bevel(o_props, 0.003, seg=2); o_props['atlas'] = 'int'
    # ---- outside
    add('covered_car', 6.9, -4.5, y=GRADE, ry=0.0, atlas='ext')
    add('metal_trash_can', 8.0, 2.4, y=GRADE, atlas='ext', pick='^metal_trash_can(?!_rust)'); add('metal_trash_can', 8.05, 1.75, y=GRADE, ry=1.0, atlas='ext', pick='_rust')
    add('exterior_aircon_unit', X1 + T + 0.45, 2.6, y=GRADE, ry=math.pi / 2, atlas='ext', pick='^exterior_aircon_unit$')
    add('garden_hose_wall_mounted_01', 1.6, Z1 + T + 0.08, y=0.15, ry=0.0, atlas='ext', collide=False, settle=False)
    for i, (x, z) in enumerate(((-4.4, -4.7), (-3.2, -4.75), (-1.9, -4.7), (-0.6, -4.72), (5.35, -4.7), (-5.6, -3.6), (-5.7, 1.0))):
        k_ = 1 + i % 4; add('shrub_0%d' % k_, x, z, y=GRADE, ry=i * 1.3, atlas='ext', collide=False, pick={2: '_b$', 3: '_a$'}.get(k_))
    add('outdoor_table_chair_set_01', 3.4, 9.5, y=GRADE, ry=0.4, atlas='ext')
    add('planter_box_01', 0.6, Z1 + T + 0.3, y=DECK, ry=0.0, atlas='ext')
    add('watering_can_metal_01', -2.35, Z1 + T + 0.35, y=DECK, ry=1.2, atlas='ext', collide=False)
    F.append(o_props)
    if '--nocloth' not in FLAGS: F += soft_things(ch, hooks)
    return F

def fd_breast():
    return 0.4

def soft_things(chair, hooks):
    """the duvet over the sleeper, the throw on the armchair, a sweater on the bedroom chair, jeans on the floor,
    a towel on the rail, coats on the hooks, clothes in the closet, laundry in the baskets"""
    S = []
    arm = bpy.data.objects.get('f_ArmChair_01')
    # the duvet: over the mattress and the sleeper (the shape the game breathes), down over the sides
    bx, bz, BW, BL = -3.2, -0.95, 1.6, 2.1
    mt = proxy_box((bx, U + 0.52, bz), (BW - 0.04, 0.2, BL - 0.04), bev=0.05)
    body = [[-0.12, 0.72, 0.17, 0.24, 0.2], [-0.1, 0.35, 0.15, 0.22, 0.32], [-0.06, -0.05, 0.19, 0.26, 0.28], [0.0, -0.48, 0.12, 0.2, 0.3], [0.12, -0.62, 0.1, 0.2, 0.2]]
    balls = [proxy_ball((bx + cx, U + 0.62 + hh * 0.2, bz + cz), (rx * 0.85, hh * 0.85, rz * 0.9)) for cx, cz, hh, rx, rz in body]
    pil = [o for o in bpy.data.objects if o.name.startswith('soft_pillow')]
    du = cloth('soft_duvet', BW + 0.5, BL - 0.3, (46, 40), (bx, U + 1.05, bz - 0.2), [mt] + balls + pil, 'duvet', frames=45, rot=(0, 0, math.pi / 2), mass=0.4, stiff=12, bend=0.5)
    S.append(du)
    for o in [mt] + balls: bpy.data.objects.remove(o)
    if arm:
        S.append(cloth('soft_throw', 1.1, 1.3, (30, 34), (-3.25, 1.25, -3.4), [arm], 'throw', frames=45, rot=(0.0, 0.0, 0.7), mass=0.3, stiff=8, bend=0.3))
    if chair:
        S.append(cloth('soft_sweater', 0.55, 0.75, (20, 26), (0.75, U + 1.15, -3.1), [chair], 'knit', frames=40, rot=(0.0, 0.0, 0.5), mass=0.25, stiff=6, bend=0.2))
    fl = proxy_box((-2.0, U - 0.05, -2.3), (2.0, 0.1, 2.0), bev=0)
    S.append(cloth('soft_jeans', 0.42, 1.0, (14, 32), (-2.05, U + 0.2, -2.35), [fl], 'jeans', frames=50, rot=(0.0, 0.0, 1.1), mass=0.35, stiff=12, bend=1.0, noise=0.035))
    bpy.data.objects.remove(fl)
    rail = proxy_box((-3.3, 0.72, Z1 - 0.65), (0.45, 0.016, 0.016), bev=0)
    S.append(cloth('soft_towel', 0.36, 0.5, (16, 22), (-3.3, 0.74, Z1 - 0.66), [rail], 'towel', frames=40, rot=(math.pi / 2, 0, 0) if False else (0.0, 0.0, 0.0), pin=lambda v: abs(-v.y - (Z1 - 0.66)) < 0.02, mass=0.2, stiff=8, bend=0.2))
    bpy.data.objects.remove(rail)
    # coats on two hooks: open tubes gathered at the hook
    wallp = proxy_box((PART + T / 2 - 0.05, 1.2, -3.4), (0.1, 2.0, 1.2), bev=0)
    for i, hk in enumerate((hooks[0], hooks[2])):
        hx, hy, hz = hk
        # a jacket hung by its loop: a cloth across the hook, held at the middle of its top edge, falling in folds
        S.append(cloth('soft_coat%d' % i, 0.95, 0.55, (34, 22), (hx + 0.46, hy, hz), [wallp], 'coat' if i == 0 else 'throw', frames=80,
                       rot=(0.0, 0.0, 0.0), pin=lambda v, hx=hx, hz=hz: v.x < hx + 0.04 and abs(-v.y - hz) < 0.06, mass=0.45, stiff=10, bend=0.4))
    bpy.data.objects.remove(wallp)
    # laundry in the baskets (the dryer's and the hamper)
    for bn, c in (('f_wicker_basket_01', None), ('f_hamper', None)):
        b = bpy.data.objects.get(bn)
        if not b: continue
        x0, y0, z0, x1, y1, z1 = bbox3(b)
        for k in range(2):
            S.append(cloth('soft_laundry_%s_%d' % (bn, k), 0.55, 0.45, (18, 16), ((x0 + x1) / 2 + (k - 0.5) * 0.05, y1 + 0.15 + k * 0.08, (z0 + z1) / 2), [b], ['towel', 'knit'][k],
                           frames=40, rot=(0.3 * k, 0.2, 0.7 * k), mass=0.3, stiff=6, bend=0.1, noise=0.08))
    return S

# ------------------------------------------------------------------------------------------------ lights (for the bake)
def lights():
    sc = bpy.context.scene
    w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    mad = nt.nodes.new('ShaderNodeMath'); mad.operation = 'MULTIPLY_ADD'; mad.inputs[1].default_value = 0.5; mad.inputs[2].default_value = 0.5
    # sky: city glow at the horizon, deep blue above
    ramp.color_ramp.elements[0].position = 0.5; ramp.color_ramp.elements[0].color = (0.05, 0.032, 0.02, 1)
    ramp.color_ramp.elements[1].position = 0.62; ramp.color_ramp.elements[1].color = (0.006, 0.009, 0.02, 1)
    nt.links.new(sep.outputs['Z'], mad.inputs[0]); nt.links.new(mad.outputs[0], ramp.inputs[0]); nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 1.0
    def L(kind, name, p, energy, color, size=0.05, spot=None, aim=None):
        ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
        if kind in ('POINT', 'SPOT'): ld.shadow_soft_size = size
        if kind == 'SPOT': ld.spot_size = spot; ld.spot_blend = 0.6
        ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob); ob.location = bl(p)
        if aim:
            d = bl(aim) - bl(p); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return ob
    sodium = (1.0, 0.62, 0.3)
    for x in range(-36, 37, 18):
        L('SPOT', 'street%d' % x, (x, 6.6, -14.1), 2600, sodium, 0.15, math.radians(130), (x, 0, -15.5))
    # (the street lamp's beam through the front window and the light over the stove stay real-time in the game)
    L('POINT', 'porch', (2.05, 1.75, Z0 - T - 0.12), 18, (1.0, 0.72, 0.42), 0.04)
    L('POINT', 'night_landing', (3.6, U + 0.3, Z0 + 0.08), 1.2, (1.0, 0.6, 0.32), 0.02)
    L('POINT', 'night_hall', (PART + 0.12, 0.3, 0.8), 1.2, (1.0, 0.6, 0.32), 0.02)
    L('POINT', 'stove_clock', (X0 + 0.7, 0.85, 2.05), 0.15, (0.3, 1.0, 0.5), 0.01)
    L('POINT', 'neighbour_porch', (-6, 1.6, -30.5 + 5.4), 30, (1.0, 0.72, 0.42), 0.05)

# ------------------------------------------------------------------------------------------------ main
def door_test():
    P, G = Part('door_t'), Part('glass')
    door_leaf(P, Frame3((0.0, 0, 0.0), 0.0), 0.98, 2.08, m='door_front', glass_top=True, G=G)
    door_leaf(P, Frame3((1.3, 0, 0.0), 0.0), 0.78, 2.03)
    o = P.finish(smooth_angle=35); G.finish()
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = True; sc.render.resolution_x, sc.render.resolution_y = 900, 900
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sun = bpy.data.objects.new('s', bpy.data.lights.new('s', 'SUN')); sun.data.energy = 3; sc.collection.objects.link(sun); sun.rotation_euler = (0.9, 0.0, 0.4)
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = bl((1.05, 1.1, 3.2)); cam.rotation_euler = (bl((1.05, 1.0, 0)) - bl((1.05, 1.1, 3.2))).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 35
    sc.render.filepath = os.path.join(OUT, 'door_test.png'); bpy.ops.render.render(write_still=True)

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if '--door' in FLAGS: door_test(); return
    P_int, P_ext, G = Part('arch_int'), Part('arch_ext'), Part('glass')
    M = P_int
    ext_open = build_walls(P_int, M)
    build_floors(P_int); build_stairs(P_int); build_doors(P_int, G); build_rooms(P_int, G); build_dungeon(P_int, G); walls_dressing(P_int)
    for w, a0, a1, s, h, units, grid, shade, sh in WINDOWS: window(P_int, G, w, a0, a1, s, h, units, grid, shade, sh)
    siding(P_ext, ext_open); foundation(P_ext); roof(P_ext); chimney(P_ext); porch(P_ext); deck(P_ext); yard(P_ext)
    o_int = P_int.finish(smooth_angle=35); o_ext = P_ext.finish(smooth_angle=35); o_gl = G.finish()
    o_int['atlas'] = 'int'; o_ext['atlas'] = 'ext'; o_gl['atlas'] = 'none'
    bevel(o_int, 0.004, seg=1)
    furn = furnish()
    rep_ = sorted(((sum(len(p.vertices) - 2 for p in o.data.polygons), o.name) for o in bpy.data.objects if o.type == 'MESH'), reverse=True)
    print('tris', sum(t for t, _ in rep_)); print('top', rep_[:16])
    if '--counts' in FLAGS: return
    if '--dump' in FLAGS:
        for o in furn:
            if o.name.startswith('f_'):
                x0, y0, z0, x1, y1, z1 = bbox3(o); print('DUMP %-34s x %.2f..%.2f  z %.2f..%.2f  y %.2f..%.2f' % (o.name, x0, x1, z0, z1, y0, y1))
        return
    if '--plan' in FLAGS: plan(); return
    if '--preview' in FLAGS: preview()
    if '--bake' in FLAGS:
        lights(); bake([o_int] + [f for f in furn if f['atlas'] == 'int'], 'int', opt('--size', 2048), opt('--samples', 64))
        bake([o_ext] + [f for f in furn if f['atlas'] == 'ext'], 'ext', opt('--size', 2048) // 2, opt('--samples', 64))
    export()

def lightmap_uv(objs, margin):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        if 'lightmap' not in o.data.uv_layers: o.data.uv_layers.new(name='lightmap')
        o.data.uv_layers.active = o.data.uv_layers['lightmap']
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers['UVMap'] if 'UVMap' in o.data.uv_layers else o.data.uv_layers[0]
        o.data.uv_layers['lightmap'].active_render = False

def bake(objs, tag, size, samples):
    import numpy as np, time
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    sc.cycles.use_denoising = False; sc.render.bake.margin = 6; sc.render.bake.use_clear = True
    lightmap_uv(objs, 0.004)
    img = bpy.data.images.new('lm_' + tag, size, size, float_buffer=True)
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes: continue
            nd = m.node_tree.nodes.get('__bake') or m.node_tree.nodes.new('ShaderNodeTexImage'); nd.name = '__bake'
            nd.image = img; m.node_tree.nodes.active = nd
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    glass = bpy.data.objects.get('glass')
    if glass: glass.visible_shadow = False; glass.visible_diffuse = False; glass.visible_glossy = False
    t0 = time.time()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='lightmap', margin=6)
    print('baked', tag, size, samples, '%.0fs' % (time.time() - t0))
    px = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
    np.save(os.path.join(OUT, 'lm_%s.npy' % tag), px[::-1, :, :3])
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            if m and m.use_nodes and m.node_tree.nodes.get('__bake'): m.node_tree.nodes.remove(m.node_tree.nodes['__bake'])

VIEWS = {
    'front': ((4.5, 1.7, -17.0), (0.0, 3.6, -4.0), 40), 'back': ((-7.5, 1.9, 13.5), (0.0, 3.2, 4.0), 42),
    'living': ((1.0, 1.25, -0.4), (-4.0, 0.9, -2.6), 62), 'stairs': ((2.2, 1.5, -3.6), (4.4, 1.2, 1.0), 62), 'landing': ((2.0, U + 1.5, 0.9), (4.4, U - 0.5, -2.4), 66),
    'kitchen': ((-0.4, 1.35, 0.9), (-4.6, 1.0, 3.4), 64), 'bedroom': ((1.2, U + 1.5, -2.6), (-3.6, U + 0.5, -0.8), 64),
    'robot_bed': ((-2.2, U + 0.18, -0.2), (-3.6, U + 0.12, -1.6), 70), 'robot_hall': ((2.4, 0.2, -0.9), (4.4, 0.6, -2.4), 72),
    'dining': ((-0.6, 1.45, 0.9), (-2.6, 0.75, 2.1), 55), 'hall': ((3.4, 1.4, 0.6), (1.7, 1.0, -3.2), 64), 'closet': ((-0.2, U + 1.2, -1.6), (-0.6, U + 0.8, 0.1), 66),
    'living_east': ((-3.6, 1.35, -1.0), (0.6, 0.8, -3.0), 66), 'kitchen_east': ((-3.0, 1.4, 1.2), (1.2, 0.9, 3.2), 64), 'laundry': ((2.0, 1.5, 1.6), (4.3, 0.8, 3.4), 70),
    'bed_desk': ((-2.2, U + 1.4, -1.2), (1.3, U + 0.7, -2.6), 64), 'landing2': ((3.4, U + 1.45, 0.7), (1.8, U + 0.6, -3.2), 66)
}
def preview():
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = opt('--psamples', 24)
    sc.cycles.use_denoising = True
    try: sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 640, 360; sc.view_settings.view_transform = 'AgX'; sc.view_settings.exposure = 0.6
    w = bpy.data.worlds.new('day'); sc.world = w; w.use_nodes = True
    env = w.node_tree.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(os.path.join(REPO, 'public', 'hdri', 'forest_slope_1k.hdr'))
    w.node_tree.links.new(env.outputs[0], w.node_tree.nodes['Background'].inputs['Color'])
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sc.collection.objects.link(sun); sun.rotation_euler = (math.radians(50), 0, math.radians(200))
    # glass lets the light through; a soft ceiling light in each room so the forms can be judged
    gm = MATS.get('glass')
    if gm:
        nt = gm.node_tree; tr = nt.nodes.new('ShaderNodeBsdfTransparent'); nt.links.new(tr.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    fills = []
    for (x, y, z) in ((-2.2, HG - 0.1, -2.0), (-2.4, HG - 0.1, 2.0), (3.0, HG - 0.1, -1.5), (-2.0, TOP - 0.1, -1.8), (2.8, TOP - 0.1, -1.0), (3.4, HG - 0.1, 2.6)):
        ld = bpy.data.lights.new('fill', 'AREA'); ld.energy = 120; ld.size = 1.6; o = bpy.data.objects.new('fill', ld); sc.collection.objects.link(o); o.location = bl((x, y, z)); fills.append(o)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    only = opt('--views', '')
    for name, (p, t, fov) in VIEWS.items():
        if only and name not in only.split(','): continue
        cam.location = bl(p); cam.rotation_euler = (bl(t) - bl(p)).to_track_quat('-Z', 'Y').to_euler(); cam.data.angle = math.radians(fov); cam.data.clip_start = 0.02
        sc.render.filepath = os.path.join(OUT, 'prev_%s.png' % name); bpy.ops.render.render(write_still=True); print('preview', name)
    bpy.data.objects.remove(sun); bpy.data.objects.remove(cam)
    for o in fills: bpy.data.objects.remove(o)
    if gm: gm.node_tree.links.new(gm.node_tree.nodes['Principled BSDF'].outputs[0], gm.node_tree.nodes['Material Output'].inputs['Surface'])

def plan():
    """top-down views of each floor (the camera just under the ceiling, so the furniture's fronts can be checked)"""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 12; sc.cycles.use_denoising = True
    w = bpy.data.worlds.new('day'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.0; sun.data.angle = 0.6; sc.collection.objects.link(sun); sun.rotation_euler = (0.15, 0.1, 0.3)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 10.6
    sc.render.resolution_x, sc.render.resolution_y = 1060, 860
    for name, y in (('ground', HG - 0.05), ('upper', TOP - 0.05)):
        cam.location = bl((0.0, y, 0.0)); cam.rotation_euler = (0, 0, 0); cam.data.clip_start = 0.01; cam.data.clip_end = 3.5
        for o in [o for o in bpy.data.objects if o.name.startswith('planlight')]: bpy.data.objects.remove(o)
        ld = bpy.data.lights.new('planlight', 'AREA'); ld.shape = 'RECTANGLE'; ld.size = 10.5; ld.size_y = 8.5; ld.energy = 3500
        lo = bpy.data.objects.new('planlight', ld); sc.collection.objects.link(lo); lo.location = bl((0.0, y - 0.08, 0.0))
        sc.render.filepath = os.path.join(OUT, 'plan_%s.png' % name); bpy.ops.render.render(write_still=True); print('plan', name)

def export():
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for uvl in o.data.uv_layers: pass
    # the glass and the lights stay out of the lightmaps; lights are not exported
    strip_textures()
    # one copy of each image: a piece placed several times was imported several times (name.001, name.002...)
    import re
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                base = bpy.data.images.get(re.sub(r'\.\d+$', '', n.image.name))
                if base and base is not n.image and tuple(base.size) == tuple(n.image.size): n.image = base
    for im in list(bpy.data.images):
        if im.users == 0: bpy.data.images.remove(im)
    for o in list(bpy.data.objects):
        if o.type == 'LIGHT' or o.get('proxy'): bpy.data.objects.remove(o)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'house_arch.glb'), export_format='GLB', export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_image_format='JPEG', export_image_quality=85, export_extras=True, export_apply=True, export_lights=False, export_cameras=False)
    print('exported', os.path.join(OUT, 'house_arch.glb'))

main()
