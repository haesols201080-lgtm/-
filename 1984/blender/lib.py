"""Shared helpers for the 1984 asset scripts.

Geometry is built with bmesh in Blender's Z-up space. Every asset faces -Y
(its front), which the glTF exporter turns into +Z in three.js. Origins sit at
ground level in the middle of the footprint.

Materials are named slots. The game swaps each name for its own textured
material, so the colours set here are only a fallback and a preview.
"""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

# name: (base colour, roughness, metallic, emission)
PALETTE = {
    'concrete_white': ((0.80, 0.80, 0.77), 0.85, 0.0, None),
    'concrete_grey':  ((0.42, 0.41, 0.39), 0.9, 0.0, None),
    'concrete_dark':  ((0.25, 0.25, 0.24), 0.9, 0.0, None),
    'stone_dirty':    ((0.45, 0.43, 0.38), 0.9, 0.0, None),
    'brick':          ((0.38, 0.20, 0.14), 0.9, 0.0, None),
    'plaster':        ((0.62, 0.58, 0.50), 0.95, 0.0, None),
    'slate':          ((0.16, 0.17, 0.19), 0.7, 0.0, None),
    'corrugated':     ((0.33, 0.30, 0.27), 0.6, 0.6, None),
    'wood':           ((0.30, 0.20, 0.12), 0.8, 0.0, None),
    'wood_dark':      ((0.16, 0.09, 0.05), 0.6, 0.0, None),
    'board':          ((0.36, 0.30, 0.22), 0.9, 0.0, None),
    'cardboard':      ((0.48, 0.40, 0.28), 1.0, 0.0, None),
    'glass':          ((0.05, 0.06, 0.07), 0.08, 0.0, None),
    'glass_lit':      ((0.05, 0.06, 0.07), 0.1, 0.0, (1.0, 0.75, 0.42)),
    'metal':          ((0.30, 0.31, 0.32), 0.45, 0.9, None),
    'metal_dark':     ((0.10, 0.10, 0.11), 0.5, 0.8, None),
    'rust':           ((0.30, 0.16, 0.09), 0.85, 0.3, None),
    'iron_black':     ((0.04, 0.04, 0.045), 0.5, 0.7, None),
    'brass':          ((0.55, 0.42, 0.18), 0.35, 1.0, None),
    'rubber':         ((0.03, 0.03, 0.03), 0.9, 0.0, None),
    'fabric_grey':    ((0.28, 0.28, 0.27), 1.0, 0.0, None),
    'fabric_red':     ((0.45, 0.06, 0.05), 1.0, 0.0, None),
    'mattress':       ((0.55, 0.52, 0.45), 1.0, 0.0, None),
    'paper':          ((0.86, 0.82, 0.70), 0.9, 0.0, None),
    'tile_white':     ((0.85, 0.86, 0.84), 0.3, 0.0, None),
    'canvas':         ((0.35, 0.34, 0.26), 1.0, 0.0, None),
    'sandbag':        ((0.45, 0.40, 0.30), 1.0, 0.0, None),
    'bark':           ((0.18, 0.14, 0.11), 0.95, 0.0, None),
    'bark_moss':      ((0.20, 0.24, 0.13), 0.95, 0.0, None),
    'leaves':         ((0.20, 0.30, 0.12), 0.8, 0.0, None),
    'leaves_elm':     ((0.18, 0.27, 0.10), 0.8, 0.0, None),
    'rubble':         ((0.40, 0.36, 0.32), 1.0, 0.0, None),
    'lamp_bulb':      ((1.0, 0.9, 0.7), 0.3, 0.0, (1.0, 0.78, 0.45)),
    'screen_frame':   ((0.20, 0.21, 0.22), 0.3, 0.9, None),
    # slots the game fills with generated textures
    'telescreen_screen': ((0.10, 0.14, 0.13), 0.2, 0.0, (0.25, 0.4, 0.38)),
    'poster_bb':      ((0.6, 0.55, 0.45), 0.9, 0.0, None),
    'poster_ingsoc':  ((0.6, 0.15, 0.1), 0.9, 0.0, None),
    'poster_spiral':  ((0.7, 0.65, 0.5), 0.9, 0.0, None),
    'slogans':        ((0.9, 0.9, 0.88), 0.8, 0.0, None),
    'sign':           ((0.2, 0.15, 0.1), 0.8, 0.0, None),
    'engraving':      ((0.75, 0.70, 0.60), 0.8, 0.0, None),
    'diary_cover':    ((0.35, 0.05, 0.04), 0.6, 0.0, None),
    'paperweight_glass': ((0.9, 0.9, 0.85), 0.02, 0.0, None),
    'coral':          ((0.8, 0.25, 0.25), 0.5, 0.0, None),
    # characters
    'skin':           ((0.62, 0.45, 0.36), 0.6, 0.0, None),
    'hair_dark':      ((0.04, 0.03, 0.025), 0.6, 0.0, None),
    'hair_fair':      ((0.45, 0.36, 0.22), 0.6, 0.0, None),
    'hair_grey':      ((0.45, 0.44, 0.42), 0.6, 0.0, None),
    'overalls_blue':  ((0.10, 0.15, 0.24), 0.95, 0.0, None),
    'overalls_black': ((0.025, 0.025, 0.03), 0.8, 0.0, None),
    'uniform_black':  ((0.02, 0.02, 0.022), 0.7, 0.0, None),
    'sash_red':       ((0.55, 0.03, 0.03), 0.8, 0.0, None),
    'prole_jacket':   ((0.22, 0.17, 0.12), 1.0, 0.0, None),
    'prole_trousers': ((0.18, 0.18, 0.17), 1.0, 0.0, None),
    'prole_dress':    ((0.30, 0.22, 0.20), 1.0, 0.0, None),
    'apron':          ((0.55, 0.52, 0.45), 1.0, 0.0, None),
    'shoe':           ((0.05, 0.04, 0.035), 0.5, 0.0, None),
    'eye':            ((0.02, 0.02, 0.02), 0.1, 0.0, None),
    'stone_statue':   ((0.36, 0.36, 0.34), 0.8, 0.0, None),
    'lens':           ((0.6, 0.7, 0.7), 0.05, 0.0, None),
}

TEX_SCALE = {  # metres covered by one texture tile, per material
    'concrete_white': 4.0, 'concrete_grey': 4.0, 'concrete_dark': 4.0, 'stone_dirty': 3.0,
    'brick': 2.0, 'plaster': 2.5, 'slate': 2.0, 'corrugated': 2.0, 'wood': 1.5, 'wood_dark': 1.0,
    'board': 1.2, 'tile_white': 1.0, 'rubble': 2.0, 'sandbag': 1.0, 'bark': 1.0, 'bark_moss': 1.0,
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)


def material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m
    col, rough, metal, emit = PALETTE.get(name, ((0.5, 0.5, 0.5), 0.8, 0.0, None))
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*col, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = 2.0
    if name in ('glass', 'paperweight_glass', 'lens'):
        p.inputs['Alpha'].default_value = 0.35 if name != 'glass' else 1.0
    m.diffuse_color = (*col, 1)
    return m


class Mesh:
    """Accumulates geometry in one bmesh with per-face material slots."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []
        self.uv = self.bm.loops.layers.uv.new('UVMap')
        self.keep_uv = set()

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def quad(self, pts, mat, flip=False, uv_rect=None, uvs=None):
        vs = [self.bm.verts.new(p) for p in pts]
        if flip:
            vs.reverse()
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(mat)
        if uv_rect is not None:
            plane_uv(f, self.uv, uv_rect)
            self.keep_uv.add(f)
        if uvs is not None:
            for l, c in zip(f.loops, uvs):
                l[self.uv].uv = c
            self.keep_uv.add(f)
        return f

    def poly(self, pts, mat):
        return self.quad(pts, mat)

    def box(self, mn, mx, mat, faces='all', matrix=None):
        """Axis aligned box from min to max corner. faces: 'all' or a set of
        '+x','-x','+y','-y','+z','-z'."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        c = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        if matrix is not None:
            c = [tuple(matrix @ Vector(p)) for p in c]
        sides = {
            '-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7),
            '-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6),
            '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5),
        }
        out = []
        for k, idx in sides.items():
            if faces != 'all' and k not in faces:
                continue
            out.append(self.quad([c[i] for i in idx], mat))
        return out

    def cyl(self, base, top, r0, r1, mat, seg=12, caps=True, rot=0.0, flutes=0, flute_depth=0.0):
        """Cylinder or cone between two points (any direction)."""
        a = Vector(base); b = Vector(top)
        axis = (b - a)
        L = axis.length
        axis.normalize()
        q = axis.to_track_quat('Z', 'Y')
        M = q.to_matrix()
        ring0, ring1 = [], []
        n = seg
        for i in range(n):
            t = rot + i / n * math.tau
            fl = 1.0
            if flutes:
                fl = 1.0 - flute_depth * (0.5 + 0.5 * math.cos(t * flutes))
            d = Vector((math.cos(t), math.sin(t), 0))
            ring0.append(self.bm.verts.new(a + M @ (d * r0 * fl)))
            ring1.append(self.bm.verts.new(a + M @ (d * r1 * fl + Vector((0, 0, L)))))
        mi = self.mi(mat)
        for i in range(n):
            j = (i + 1) % n
            f = self.bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
            f.material_index = mi
            f.smooth = True
        if caps:
            if r0 > 0:
                f = self.bm.faces.new(list(reversed(ring0))); f.material_index = mi
            if r1 > 0:
                f = self.bm.faces.new(ring1); f.material_index = mi
        return ring0, ring1

    def sphere(self, c, r, mat, seg=12, rings=8, scale=(1, 1, 1), smooth=True, matrix=None):
        cx, cy, cz = c
        sx, sy, sz = scale
        T = matrix if matrix is not None else Matrix.Identity(4)
        _new = self.bm.verts.new
        newv = lambda p: _new(T @ Vector(p))
        top = newv((cx, cy, cz + r * sz))
        bot = newv((cx, cy, cz - r * sz))
        rows = []
        for i in range(1, rings):
            phi = math.pi * i / rings
            row = []
            for j in range(seg):
                th = math.tau * j / seg
                row.append(newv((cx + math.sin(phi) * math.cos(th) * r * sx,
                                              cy + math.sin(phi) * math.sin(th) * r * sy,
                                              cz + math.cos(phi) * r * sz)))
            rows.append(row)
        mi = self.mi(mat)
        def add(vs):
            f = self.bm.faces.new(vs); f.material_index = mi; f.smooth = smooth
        for j in range(seg):
            k = (j + 1) % seg
            add((top, rows[0][j], rows[0][k]))
            add((bot, rows[-1][k], rows[-1][j]))
        for i in range(len(rows) - 1):
            for j in range(seg):
                k = (j + 1) % seg
                add((rows[i][j], rows[i + 1][j], rows[i + 1][k], rows[i][k]))
        return rows

    def finish(self, box_uv=True, smooth_angle=None, link=True):
        bm = self.bm
        if box_uv:
            uv_box(bm, self.uv, self.mats, self.keep_uv)
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(material(m))
        ob = bpy.data.objects.new(self.name, me)
        if link:
            bpy.context.scene.collection.objects.link(ob)
        return ob


def uv_box(bm, uv, mats, keep=()):
    """World-scale box projection so tiling textures keep a constant size."""
    for f in bm.faces:
        if f in keep:
            continue
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        s = TEX_SCALE.get(mats[f.material_index] if f.material_index < len(mats) else '', 2.0)
        for l in f.loops:
            p = l.vert.co
            if ax == 0:
                u, v = (p.y if n.x > 0 else -p.y), p.z
            elif ax == 1:
                u, v = (-p.x if n.y > 0 else p.x), p.z
            else:
                u, v = p.x, (p.y if n.z > 0 else -p.y)
            l[uv].uv = (u / s, v / s)


def plane_uv(face, uv, rect):
    """Map a quad face's 4 loops to a full 0..1 rect (for posters, screens)."""
    u0, v0, u1, v1 = rect
    coords = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    for l, c in zip(face.loops, coords):
        l[uv].uv = c


def export(path, objects=None, anim=False):
    bpy.ops.object.select_all(action='DESELECT')
    objs = objects or list(bpy.context.scene.objects)
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
              export_yup=True, export_extras=True)
    if anim:
        kw.update(export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True)
    else:
        kw.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kw)


def rng(seed):
    return random.Random(seed)
