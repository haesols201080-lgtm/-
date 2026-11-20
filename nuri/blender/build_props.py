"""Gameplay props modelled in Blender with scanned (Poly Haven, CC0) materials instead of primitive boxes/cylinders.
Every object has bevelled edges, real construction details, and texture coordinates in metres so the scans keep their
real scale (plank grain runs along each board, each board sits inside one scanned plank).
Coordinates: Blender Z up, -Y forward (= game +Z after glTF export).
usage: python build_props.py <polyhaven_tex_dir> <out_dir>"""
import sys, os, math, random
import bpy, bmesh
from mathutils import Vector, Matrix

TEX, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
R = random.Random(5)
_mats = {}
TEX_M = {'rock_face_03': 2.0, 'mossy_rock': 2.0, 'weathered_planks': 2.0, 'wood_planks_grey': 1.5, 'rusty_metal_04': 2.0, 'green_metal_rust': 1.0, 'metal_plate': 0.5, 'rusty_metal_02': 1.0}
# plank columns of the plank scans (u ranges of single boards, from the seam positions)
PLANKS = {'weathered_planks': [(0.0605 + 0.1115 * k + 0.012, 0.168 + 0.1115 * k - 0.012) for k in range(8)],
          'wood_planks_grey': [(0.2 + 0.2 * k + 0.015, 0.4 + 0.2 * k - 0.015) for k in range(3)]}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); _mats.clear()

def tex_mat(pid, name=None):
    name = name or pid
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    d = f'{TEX}/{pid}'
    def img(fn, data):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(f'{d}/{fn}'); 
        if data: n.image.colorspace_settings.name = 'Non-Color'
        return n
    nt.links.new(img('Diffuse.jpg', False).outputs['Color'], b.inputs['Base Color'])
    arm = img('arm.jpg', True); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(arm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness']); nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(img('nor_gl.jpg', True).outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    _mats[name] = m; return m

def flat_mat(name, color, rough=0.5, metal=0.0, emit=None, estr=0.0, alpha=1.0, transmission=0.0):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    if transmission: b.inputs['Transmission Weight'].default_value = transmission
    _mats[name] = m; return m

def obj_from_bm(name, bm, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat); return ob

def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, bevel=0.002, segs=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0: bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bm.transform(M)
    return obj_from_bm(name, bm, mat)

def cyl(name, r, h, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, seg=24, bevel=0.0, r2=None, cap=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if bevel > 0: bmesh.ops.bevel(bm, geom=[e for e in bm.edges if not e.is_wire and abs(e.calc_face_angle(0)) > 0.6], offset=bevel, segments=2, affect='EDGES')
    M = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bm.transform(M)
    return obj_from_bm(name, bm, mat)

def box_uv(ob, tex_m, grain=None, off=(0.0, 0.0), plank=None):
    """metre-scaled box projection; `grain` = local axis index the texture's v (grain) follows;
    `plank` = (u0, u1) column the board's width is fitted into"""
    me = ob.data; uvl = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    lo = [min(v.co[i] for v in me.vertices) for i in range(3)]
    for p in me.polygons:
        n = p.normal; a = max(range(3), key=lambda i: abs(n[i])); others = [i for i in range(3) if i != a]
        if grain is not None and grain in others: va = grain; ua = others[0] if others[1] == grain else others[1]
        else: ua, va = others
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = (co[ua] - lo[ua]) / tex_m; v = (co[va] - lo[va]) / tex_m
            if plank: u = plank[0] + u % max(1e-4, plank[1] - plank[0])
            uvl.data[li].uv = (u + off[0], v + off[1])

def smooth_all(obs, angle=0.6):
    for ob in obs:
        for p in ob.data.polygons: p.use_smooth = True
        try:
            ob.data.set_sharp_from_angle(angle=angle)
        except Exception: pass

def export(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    path = f'{OUT}/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='EXPORT', export_image_format='NONE', export_yup=True, export_normals=True, export_apply=True)
    print('PROP', name, len(obs), 'objects', round(os.path.getsize(path) / 1e3), 'kB')

def by_mat(obs, mname):
    return [o for o in obs if o.data.materials and o.data.materials[0].name == mname]

def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join(); obs[0].name = name; return obs[0]

def board(name, L, W, T, axis, loc, pid='weathered_planks', bevel=0.0025):
    """a plank of length L along local `axis` (0 x, 1 y, 2 z), width W, thickness T"""
    size = [0, 0, 0]
    if axis == 0: size = (L, T, W)
    elif axis == 2: size = (W, T, L)
    else: size = (W, L, T)
    ob = box(name, size, loc, mat=tex_mat(pid), bevel=bevel)
    pl = R.choice(PLANKS[pid]); box_uv(ob, TEX_M[pid], grain=axis, off=(0, R.random()), plank=pl)
    # slight warp / unevenness: boards are never perfectly flat
    for v in ob.data.vertices:
        t = (v.co[axis] - loc[axis]) / max(L, 1e-3)
        v.co.y += 0.0012 * math.sin(t * 3.1 + R.random()) if axis != 1 else 0
    return ob

def nail(loc, normal, mat, r=0.0028):
    n = Vector(normal).normalized(); rot = n.to_track_quat('Z', 'Y').to_euler()
    return cyl('nail', r, 0.0016, loc=Vector(loc) + n * 0.0008, rot=(rot.x, rot.y, rot.z), mat=mat, seg=8)

# ------------------------------------------------------------------ crate (0.3 m)
def build_crate():
    reset(); s = 0.3; T = 0.016; obs = []
    rust = tex_mat('rusty_metal_04')
    for face in range(4):
        ang = face * math.pi / 2
        for k in range(3):
            h = (s - 0.004 * 4) / 3; z = -s / 2 + 0.004 + h / 2 + k * (h + 0.004)
            b = board('board', s - 0.006, h - 0.004, T, 0, (0, -s / 2 + T / 2, z))
            b.data.transform(Matrix.Rotation(ang, 4, 'Z')); obs.append(b)
        # diagonal brace
        d = math.hypot(s - 0.06, s - 0.06)
        br = board('brace', d, 0.05, 0.012, 0, (0, 0, 0)); br.data.transform(Matrix.Rotation(math.atan2(s - 0.06, s - 0.06), 4, 'Y'))
        br.data.transform(Matrix.Translation((0, -s / 2 - 0.006, 0))); br.data.transform(Matrix.Rotation(ang, 4, 'Z')); obs.append(br)
    for zz in (-1, 1):
        for k in range(3):
            w = (s - 0.012) / 3
            obs.append(board('lid', s - 0.004, w - 0.004, T, 1, (-s / 2 + 0.006 + w / 2 + k * w, 0, zz * (s / 2 - T / 2))))
            obs[-1].data.transform(Matrix.Identity(4))
    # lid boards lie flat: board() along y gives size (W, L, T) -> T is z thickness, good
    for cx in (-1, 1):
        for cy in (-1, 1):
            p = box('post', (0.028, 0.028, s - 0.002), (cx * (s / 2 - 0.012), cy * (s / 2 - 0.012), 0), mat=tex_mat('weathered_planks'), bevel=0.003)
            box_uv(p, 2.0, grain=2, off=(R.random(), R.random()), plank=R.choice(PLANKS['weathered_planks'])); obs.append(p)
            # rusty L corner brackets top and bottom, with nails
            for zz in (-1, 1):
                for ax in range(2):
                    sz = (0.06, 0.003, 0.05) if ax == 0 else (0.003, 0.06, 0.05)
                    off = (cx * (s / 2 - 0.03), cy * (s / 2 + 0.0015 + T * 0.0), zz * (s / 2 - 0.03)) if ax == 0 else (cx * (s / 2 + 0.0015), cy * (s / 2 - 0.03), zz * (s / 2 - 0.03))
                    bk = box('bracket', sz, off, mat=rust, bevel=0.001, segs=1); box_uv(bk, 2.0, off=(R.random(), R.random())); obs.append(bk)
                    nn = (0, cy, 0) if ax == 0 else (cx, 0, 0)
                    for q in (-0.015, 0.015):
                        pos = Vector(off) + Vector((q, 0, q * 0.6) if ax == 0 else (0, q, q * 0.6)) + Vector(nn) * 0.0015
                        obs.append(nail(pos, nn, rust))
    for o in obs:
        if o.name.startswith('nail'): box_uv(o, 2.0)
    smooth_all(obs); W, M = by_mat(obs, 'weathered_planks'), by_mat(obs, 'rusty_metal_04')
    export([join(W, 'crate_wood'), join(M, 'crate_metal')], 'crate')

# ------------------------------------------------------------------ fence: picket + rail + post
def build_fence():
    reset(); obs = []
    pid = 'wood_planks_grey'
    p = board('picket', 1.05, 0.09, 0.022, 2, (0, 0, 0.525), pid=pid, bevel=0.003)
    # pointed (dog-eared) top
    for v in p.data.vertices:
        if v.co.z > 1.0: v.co.z -= abs(v.co.x) * 0.9
        if v.co.z < 0.02: v.co.z += R.uniform(-0.005, 0.005)
    obs.append(p)
    for zz in (0.25, 0.75):
        for q in (-0.025, 0.025): obs.append(nail((q, -0.012, zz), (0, -1, 0), tex_mat('rusty_metal_04')))
    for o in obs[1:]: box_uv(o, 2.0)
    smooth_all(obs)
    P_, N_ = [o for o in obs if o.name.startswith('picket')], [o for o in obs if o.name.startswith('nail')]
    export([join(P_, 'fence_picket'), join(N_, 'fence_nails')], 'fence_picket')
    reset()
    r = board('rail', 1.0, 0.06, 0.03, 0, (0, 0, 0), pid=pid, bevel=0.004); smooth_all([r]); export([r], 'fence_rail')

# ------------------------------------------------------------------ wrought-iron gate parts
def build_gate():
    reset(); rust = tex_mat('rusty_metal_04'); obs = []
    # square bar with a forged spear tip and a collar
    b = box('bar', (0.016, 0.016, 1.0), (0, 0, 0.5), mat=rust, bevel=0.002); obs.append(b)
    c = box('collar', (0.026, 0.026, 0.02), (0, 0, 0.82), mat=rust, bevel=0.003); obs.append(c)
    bm = bmesh.new()
    # spear: diamond leaf shape
    pts = [(0, 0, 1.0), (0.022, 0, 1.04), (0, 0, 1.11), (-0.022, 0, 1.04)]
    for i, (x, y, z) in enumerate(pts): pass
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.024, radius2=0.0, depth=0.075)
    for v in bm.verts:
        if v.co.z < 0: v.co.z = -0.0375
        v.co.y *= 0.35
    bm.transform(Matrix.Translation((0, 0, 1.06)) @ Matrix.Rotation(math.pi / 4, 4, 'Z'))
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.0, radius2=0.024, depth=0.03)
    for v in bm.verts:
        if abs(v.co.z) <= 0.016 and v.co.z < 1.0 and v.co.z > -0.016: v.co.y *= 0.35
    bm.transform(Matrix.Identity(4))
    sp = obj_from_bm('spear', bm, rust)
    for v in sp.data.vertices:
        if v.co.z < 0.5: v.co.z += 1.008
    obs.append(sp)
    for o in obs: box_uv(o, 2.0, off=(R.random(), R.random()))
    smooth_all(obs, 0.5); export([join(obs, 'gate_bar')], 'gate_bar')
    reset(); rail = box('rail', (1.0, 0.012, 0.03), (0, 0, 0), mat=tex_mat('rusty_metal_04'), bevel=0.002); box_uv(rail, 2.0); smooth_all([rail]); export([rail], 'gate_rail')

# ------------------------------------------------------------------ pressure plate: stone ring + iron tread plate
def build_plate():
    reset()
    base = cyl('base', 0.37, 0.09, loc=(0, 0, -0.005), mat=tex_mat('rusty_metal_02', 'stone'), seg=48, r2=0.33)
    # hand-cut stone: irregular rim
    for v in base.data.vertices:
        a = math.atan2(v.co.y, v.co.x); rr = math.hypot(v.co.x, v.co.y)
        if rr > 0.05: k = 1 + 0.025 * math.sin(a * 5 + 1) + 0.015 * math.sin(a * 13); v.co.x *= k; v.co.y *= k
        if v.co.z > 0: v.co.z += 0.006 * math.sin(a * 7)
    # stone: rock texture comes from the game's rock material instead (assigned by name); keep projection uvs
    box_uv(base, 1.0)
    top = cyl('top', 0.28, 0.035, loc=(0, 0, 0.045), mat=tex_mat('metal_plate'), seg=48, bevel=0.004)
    box_uv(top, 0.5)
    bolts = []
    for i in range(8):
        a = i / 8 * math.pi * 2
        bolts.append(cyl('bolt', 0.011, 0.008, loc=(math.cos(a) * 0.245, math.sin(a) * 0.245, 0.064), mat=tex_mat('rusty_metal_04'), seg=6, bevel=0.0015))
    for o in bolts: box_uv(o, 2.0)
    smooth_all([base, top] + bolts, 0.7)
    export([base], 'plate_base'); 
    bpy.ops.object.select_all(action='DESELECT')
    export([join([top] + bolts, 'plate_top')], 'plate_top')

# ------------------------------------------------------------------ lift: deck, railing, I-beam
def build_lift():
    reset(); obs = []; green = tex_mat('green_metal_rust'); tread = tex_mat('metal_plate'); rust = tex_mat('rusty_metal_04')
    d = box('tread', (0.66, 0.66, 0.012), (0, 0, 0.019), mat=tread, bevel=0.002); box_uv(d, 0.5); obs.append(d)
    for (sx, sy, x, y) in ((0.7, 0.04, 0, 0.33), (0.7, 0.04, 0, -0.33), (0.04, 0.62, 0.33, 0), (0.04, 0.62, -0.33, 0)):
        f = box('frame', (sx, sy, 0.05), (x, y, 0), mat=green, bevel=0.004); box_uv(f, 1.0, off=(R.random(), R.random())); obs.append(f)
    for cx in (-1, 1):
        for cy in (-1, 1):
            p = cyl('post', 0.012, 0.33, loc=(cx * 0.31, cy * 0.31, 0.19), mat=green, seg=12); box_uv(p, 1.0); obs.append(p)
    for (a, b) in (((0.31, -0.31), (0.31, 0.31)), ((-0.31, 0.31), (-0.31, -0.31))):   # side rails only: on at the front, off at the back
        L = math.dist(a, b); ang = math.atan2(b[1] - a[1], b[0] - a[0])
        for zz in (0.35, 0.2):
            t = cyl('rail', 0.011, L + 0.02, loc=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zz), rot=(0, math.pi / 2, ang), mat=green, seg=12); box_uv(t, 1.0); obs.append(t)
    smooth_all(obs, 0.7)
    T_, G_ = by_mat(obs, 'metal_plate'), by_mat(obs, 'green_metal_rust')
    export([join(T_, 'lift_tread'), join(G_, 'lift_frame')], 'lift_deck')
    # I-beam 1 m (tower columns, scaled along z in game)
    reset(); parts = []
    for (sx, sy, z) in ((0.06, 0.008, 0), ):
        pass
    parts.append(box('web', (0.008, 0.05, 1.0), (0, 0, 0.5), mat=tex_mat('rusty_metal_04'), bevel=0.001, segs=1))
    for y in (-0.026, 0.026): parts.append(box('flange', (0.06, 0.006, 1.0), (0, y, 0.5), mat=tex_mat('rusty_metal_04'), bevel=0.0015, segs=1))
    for k in range(5):
        for y in (-0.03, 0.03): parts.append(cyl('rivet', 0.004, 0.004, loc=(0.018 * (1 if k % 2 else -1), y, 0.1 + k * 0.2), rot=(math.pi / 2, 0, 0), mat=tex_mat('rusty_metal_04'), seg=8))
    for o in parts: box_uv(o, 2.0, grain=2, off=(R.random(), 0))
    smooth_all(parts, 0.7); export([join(parts, 'ibeam')], 'ibeam')

# ------------------------------------------------------------------ socket box with door, lamp cage, conduit
def build_socket():
    reset(); green = tex_mat('green_metal_rust'); rust = tex_mat('rusty_metal_04'); obs = []
    body = box('body', (0.16, 0.12, 0.22), (0, 0, 0), mat=green, bevel=0.008, segs=3); box_uv(body, 1.0); obs.append(body)
    door = box('door', (0.13, 0.008, 0.17), (0, -0.063, -0.01), mat=green, bevel=0.004); box_uv(door, 1.0, off=(0.3, 0.2)); obs.append(door)
    for z in (-0.07, 0.05): obs.append(cyl('hinge', 0.006, 0.03, loc=(-0.068, -0.066, z), mat=rust, seg=10))
    obs.append(box('latch', (0.012, 0.01, 0.03), (0.055, -0.069, -0.01), mat=rust, bevel=0.002))
    for (x, z) in ((-0.07, 0.1), (0.07, 0.1), (-0.07, -0.1), (0.07, -0.1)): obs.append(cyl('screw', 0.005, 0.004, loc=(x, -0.061, z), rot=(math.pi / 2, 0, 0), mat=rust, seg=8))
    obs.append(cyl('slot', 0.05, 0.022, loc=(0, 0, 0.121), mat=rust, seg=24, bevel=0.003))
    obs.append(cyl('conduit', 0.014, 0.14, loc=(0.05, 0.03, -0.17), mat=rust, seg=12))
    cage = []
    for k in range(4):
        a = k * math.pi / 2
        cage.append(cyl('cagebar', 0.0018, 0.032, loc=(math.cos(a) * 0.017, -0.066 + math.sin(a) * 0.0, 0.08 + math.sin(a) * 0.017), rot=(math.pi / 2, 0, 0), mat=rust, seg=6))
    obs += cage
    for o in obs[2:]: box_uv(o, 2.0)
    smooth_all(obs, 0.7)
    lamp = cyl('lamp', 0.014, 0.014, loc=(0, -0.07, 0.08), rot=(math.pi / 2, 0, 0), mat=flat_mat('lamp', (0.3, 0.02, 0.02), 0.1), seg=16, bevel=0.004)
    smooth_all([lamp], 1.5)
    G_, M_ = by_mat(obs, 'green_metal_rust'), by_mat(obs, 'rusty_metal_04')
    export([join(G_, 'socket_green'), join(M_, 'socket_metal'), lamp], 'socket')

# ------------------------------------------------------------------ power cell
def build_cell():
    reset(); steel = flat_mat('cell_steel', (0.55, 0.56, 0.58), 0.35, 1.0); dark = flat_mat('cell_dark', (0.05, 0.055, 0.06), 0.45, 0.6)
    glass = flat_mat('cell_glass', (0.8, 0.95, 0.85), 0.05, 0.0, transmission=0.0); obs = []
    for z in (-1, 1):
        obs.append(cyl('cap', 0.043, 0.02, loc=(0, 0, z * 0.046), mat=steel, seg=32, bevel=0.004))
        for k in range(3): obs.append(cyl('rib', 0.044, 0.003, loc=(0, 0, z * (0.03 - k * 0.0) + z * k * 0.004), mat=dark, seg=32))
    obs.append(cyl('contact', 0.012, 0.01, loc=(0, 0, 0.06), mat=steel, seg=16, bevel=0.002))
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        obs.append(box('strut', (0.008, 0.008, 0.07), (math.cos(a) * 0.04, math.sin(a) * 0.04, 0), mat=dark, bevel=0.0015))
    smooth_all(obs, 0.7)
    core = cyl('core', 0.031, 0.072, mat=flat_mat('cell_core', (0.1, 0.4, 0.1), 0.2, emit=(0.5, 1.0, 0.4), estr=3.0), seg=24); smooth_all([core], 1.5)
    shell = cyl('window', 0.037, 0.072, mat=flat_mat('cell_window', (0.7, 0.9, 0.8), 0.04), seg=32, cap=False); smooth_all([shell], 1.5)
    export([join(obs, 'cell_body'), core, shell], 'cell')

# ------------------------------------------------------------------ crystal shard cluster
def build_shard():
    reset(); m = flat_mat('shard', (0.6, 0.95, 1.0), 0.08); parts = []
    for i, (h, r, tx, ty) in enumerate(((0.11, 0.019, 0, 0), (0.075, 0.014, 0.02, 0.008), (0.06, 0.012, -0.018, -0.006), (0.045, 0.01, 0.004, -0.02))):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r, depth=h)
        top = [v for v in bm.verts if v.co.z > 0]
        for v in top: v.co.z = h / 2 - 0.0 
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=0.0, depth=r * 2.2)
        for v in bm.verts:
            if v.co.z > -r * 1.2 and v.co.z < r * 1.2 and len(v.link_edges) and v.co.z != 0: pass
        # move the pyramid on top of the prism
        new = [v for v in bm.verts if v not in top and v.co.z >= -r * 1.1 - 1e-6 and v.co.z <= r * 1.1 + 1e-6 and abs(math.hypot(v.co.x, v.co.y) - r) > 1e-5 or (abs(v.co.z - r * 1.1) < 1e-6)]
        ob = obj_from_bm(f'xtal{i}', bm, m)
        for v in ob.data.vertices:
            if v.co.z > h / 2 + 1e-6 or (abs(v.co.z) <= r * 1.1 + 1e-6 and v.index >= 14):
                pass
        parts.append(ob)
    # simpler and robust: rebuild crystals explicitly
    for p in parts: bpy.data.objects.remove(p)
    parts = []
    for i, (h, r, tx, ty, lean) in enumerate(((0.1, 0.017, 0, 0, 0.0), (0.07, 0.013, 0.019, 0.007, 0.35), (0.055, 0.011, -0.017, -0.006, -0.4), (0.04, 0.009, 0.003, -0.018, 0.5))):
        verts, faces = [], []
        for k in range(6):
            a = k / 6 * math.pi * 2 + i; rr = r * (1 + 0.15 * math.sin(k * 2.3 + i))
            verts.append((math.cos(a) * rr, math.sin(a) * rr, 0)); verts.append((math.cos(a) * rr * 0.95, math.sin(a) * rr * 0.95, h))
        verts.append((0, 0, h + r * 2.0)); verts.append((0, 0, -0.004))
        for k in range(6):
            a0, b0, a1, b1 = 2 * k, 2 * k + 1, 2 * ((k + 1) % 6), 2 * ((k + 1) % 6) + 1
            faces.append((a0, a1, b1, b0)); faces.append((b0, b1, 12)); faces.append((a1, a0, 13))
        me = bpy.data.meshes.new(f'xtal{i}'); me.from_pydata(verts, [], faces); me.update()
        ob = bpy.data.objects.new(f'xtal{i}', me); bpy.context.scene.collection.objects.link(ob); ob.data.materials.append(m)
        ob.data.transform(Matrix.Translation((tx, ty, -0.05)) @ Matrix.Rotation(lean, 4, Vector((ty, -tx, 0)).normalized() if (tx or ty) else Vector((1, 0, 0))))
        parts.append(ob)
    export([join(parts, 'shard')], 'shard')

# ------------------------------------------------------------------ booster module
def build_booster():
    reset(); steel = flat_mat('b_steel', (0.6, 0.62, 0.64), 0.3, 1.0); dark = flat_mat('b_dark', (0.06, 0.065, 0.07), 0.4, 0.8); obs = []
    obs.append(box('housing', (0.07, 0.05, 0.08), (0, 0, 0), mat=steel, bevel=0.012, segs=4))
    for x in (-0.024, 0.024):
        obs.append(cyl('nozzle', 0.013, 0.03, loc=(x, 0.0, -0.05), mat=dark, seg=24, r2=0.009, bevel=0.002))
        obs.append(cyl('ring', 0.015, 0.006, loc=(x, 0, -0.037), mat=steel, seg=24))
    for s in (-1, 1): obs.append(box('fin', (0.004, 0.035, 0.05), (s * 0.04, 0.008, 0.005), mat=dark, bevel=0.0015))
    for z in (-0.025, 0, 0.025): obs.append(box('vent', (0.05, 0.004, 0.004), (0, -0.026, z), mat=dark, bevel=0.001))
    smooth_all(obs, 0.7)
    core = cyl('core', 0.012, 0.004, loc=(0, -0.0265, 0.0), rot=(math.pi / 2, 0, 0), mat=flat_mat('b_core', (0.1, 0.3, 0.4), 0.2, emit=(0.3, 0.9, 1.0), estr=4.0), seg=24)
    export([join(obs, 'booster_body'), core], 'booster')

# ------------------------------------------------------------------ rubber ball with seams
def build_ball():
    reset(); bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=0.075)
    for v in bm.verts:
        p = v.co.normalized()
        seam = min(abs(p.z), abs(p.x * 0.7071 + p.y * 0.7071), abs(p.x * 0.7071 - p.y * 0.7071))
        v.co = p * (0.075 - 0.0018 * math.exp(-(seam / 0.03) ** 2))
    ob = obj_from_bm('ball', bm, flat_mat('ball_rubber', (0.55, 0.08, 0.05), 0.55))
    smooth_all([ob], 1.5); export([ob], 'ball')

def stone_block(name, size, loc, pid='rock_face_03', rough=0.012, seed=0):
    """a roughly dressed stone: bevelled block, faces slightly bulged and chipped"""
    rr = random.Random(seed)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    for v in bm.verts:
        p = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        n = Vector((v.co.x, v.co.y, v.co.z)); bulge = 1 - max(abs(n.x), abs(n.y), abs(n.z)) * 0.0
        p += n.normalized() * rough * (rr.random() - 0.35)
        v.co = p
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.calc_face_angle(0) > 0.5], offset=min(size) * 0.12, segments=2, affect='EDGES')
    bm.transform(Matrix.Translation(loc))
    ob = obj_from_bm(name, bm, tex_mat(pid)); box_uv(ob, TEX_M[pid], off=(rr.random(), rr.random())); return ob

# ------------------------------------------------------------------ gate: dry-stone pillars, two hinged wrought-iron leaves
def build_gate2():
    reset(); rust = tex_mat('rusty_metal_04')
    # pillar 0.34 x 0.34 x 1.25 of coursed stones + a mossy cap stone
    P = []; z = 0.0; k = 0
    while z < 1.15:
        h = R.uniform(0.13, 0.19); z1 = min(1.15, z + h)
        if k % 2 == 0: P.append(stone_block('stone', (0.34, 0.34, z1 - z - 0.012), (0, 0, (z + z1) / 2), seed=k))
        else:
            for sx in (-1, 1): P.append(stone_block('stone', (0.168, 0.34, z1 - z - 0.012), (sx * 0.086, 0, (z + z1) / 2), seed=k * 7 + sx))
        z = z1; k += 1
    P.append(stone_block('cap', (0.42, 0.42, 0.1), (0, 0, 1.2), pid='mossy_rock', seed=99))
    # mortar core so no light leaks between stones
    P.append(box('core', (0.3, 0.3, 1.15), (0, 0, 0.575), mat=tex_mat('rock_face_03'), bevel=0.0)); box_uv(P[-1], 2.0)
    pins = [cyl('pintle', 0.012, 0.05, loc=(0.0, -0.0, zz), mat=rust, seg=12) for zz in (0.18, 0.88)]
    for pn in pins: pn.data.transform(Matrix.Translation((0.18, 0, 0))); box_uv(pn, 2.0)
    smooth_all(P + pins, 0.7)
    S_, C_ = by_mat(P, 'rock_face_03'), by_mat(P, 'mossy_rock')
    export([join(S_, 'pillar_stone'), join(C_, 'pillar_cap'), join(pins, 'pillar_pins')], 'gate_pillar')
    # one gate leaf, 1 m wide (scaled in x by the game), hinge at x = 0, opening toward -y
    reset(); rust = tex_mat('rusty_metal_04'); L = []
    W, H = 1.0, 0.95
    for (zz, t) in ((0.08, 0.035), (H * 0.52, 0.03), (H - 0.03, 0.035)):
        L.append(box('rail', (W, 0.014, t), (W / 2, 0, zz), mat=rust, bevel=0.002))
    for xx in (0.015, W - 0.015): L.append(box('stile', (0.03, 0.02, H), (xx, 0, H / 2), mat=rust, bevel=0.003))
    n = 9
    for i in range(1, n):
        x = i * W / n
        L.append(box('bar', (0.014, 0.014, H + 0.04), (x, 0, (H + 0.04) / 2), mat=rust, bevel=0.0015))
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.02, radius2=0.0, depth=0.06)
        for v in bm.verts: v.co.y *= 0.4
        bm.transform(Matrix.Translation((x, 0, H + 0.07)) @ Matrix.Rotation(math.pi / 4, 4, 'Z')); L.append(obj_from_bm('spear', bm, rust))
        L.append(box('collar', (0.022, 0.02, 0.014), (x, 0, H * 0.52 + 0.03), mat=rust, bevel=0.002))
    # scrolls in the top panel
    for i in range(n - 1):
        cx = (i + 0.5) * W / (n - 1) + 0.02
        pts = [(cx + 0.03 * math.cos(a) * (1 - a / 9), 0, H * 0.78 + 0.03 * math.sin(a) * (1 - a / 9)) for a in [k * 0.45 for k in range(16)]]
        for a_, b_ in zip(pts, pts[1:]):
            a_, b_ = Vector(a_), Vector(b_); d = b_ - a_; e = d.to_track_quat('Z', 'Y').to_euler()
            L.append(cyl('scroll', 0.0035, d.length + 0.002, loc=(a_ + b_) / 2, rot=(e.x, e.y, e.z), mat=rust, seg=6))
    for zz in (0.18, 0.88): L.append(cyl('eye', 0.02, 0.045, loc=(0, 0, zz), mat=rust, seg=16))
    L.append(box('latch', (0.07, 0.012, 0.022), (W - 0.02, -0.016, H * 0.52), mat=rust, bevel=0.002))
    for o in L: box_uv(o, 2.0, off=(R.random(), R.random()))
    smooth_all(L, 0.6); export([join(L, 'gate_leaf')], 'gate_leaf')

# ------------------------------------------------------------------ pressure plate: cast-iron plate set in a dressed-stone frame
def build_plate2():
    reset(); F = []
    for k in range(4):
        a = k * math.pi / 2
        s_ = stone_block('frame', (0.72, 0.16, 0.12), (0, 0.3, -0.03), seed=k + 11)
        s_.data.transform(Matrix.Rotation(a, 4, 'Z')); F.append(s_)
    F.append(box('pit', (0.48, 0.48, 0.02), (0, 0, -0.06), mat=tex_mat('rock_face_03'), bevel=0.0)); box_uv(F[-1], 2.0)
    smooth_all(F, 0.7); export([join(F, 'plate_frame')], 'plate_base')
    reset(); rust = tex_mat('rusty_metal_04'); T = []
    T.append(box('plate', (0.43, 0.43, 0.03), (0, 0, 0.045), mat=rust, bevel=0.005))
    # cast relief: border, cross ribs, raised studs
    for (sx, sy, x, y) in ((0.4, 0.016, 0, 0.19), (0.4, 0.016, 0, -0.19), (0.016, 0.4, 0.19, 0), (0.016, 0.4, -0.19, 0), (0.37, 0.014, 0, 0), (0.014, 0.37, 0, 0)):
        T.append(box('rib', (sx, sy, 0.008), (x, y, 0.063), mat=rust, bevel=0.003))
    for i in range(4):
        for j in range(4):
            x = -0.135 + i * 0.09; y = -0.135 + j * 0.09
            if abs(x) < 0.03 or abs(y) < 0.03: continue
            T.append(cyl('stud', 0.012, 0.007, loc=(x, y, 0.063), mat=rust, seg=12, bevel=0.002))
    for o in T: box_uv(o, 2.0, off=(R.random() * 0.2, R.random() * 0.2))
    smooth_all(T, 0.6); export([join(T, 'plate_top')], 'plate_top')

# ------------------------------------------------------------------ lift: guided platform on a hoist (deck with carriages and bridle, head beam with pulley, counterweight)
def build_lift2():
    reset(); green = tex_mat('green_metal_rust'); tread = tex_mat('metal_plate'); rust = tex_mat('rusty_metal_04'); D = []
    D.append(box('tread', (0.66, 0.66, 0.012), (0, 0, -0.006), mat=tread, bevel=0.002)); box_uv(D[-1], 0.5)
    for (sx, sy, x, y) in ((0.7, 0.05, 0, 0.33), (0.7, 0.05, 0, -0.33), (0.05, 0.62, 0.33, 0), (0.05, 0.62, -0.33, 0)):
        D.append(box('frame', (sx, sy, 0.06), (x, y, -0.03), mat=green, bevel=0.004))
    for x in (-0.34, 0.34):          # guide carriages riding on the columns (at x = +-0.42)
        s = 1 if x > 0 else -1
        D.append(box('arm', (0.06, 0.08, 0.04), (s * 0.375, 0, -0.01), mat=green, bevel=0.004))
        D.append(box('shoe', (0.03, 0.1, 0.12), (s * 0.385, 0, 0.02), mat=rust, bevel=0.004))
        for zz in (-0.02, 0.06): D.append(cyl('roller', 0.018, 0.03, loc=(s * 0.4, -0.045, zz), rot=(0, math.pi / 2, 0), mat=rust, seg=16))
        D.append(cyl('upright', 0.014, 0.5, loc=(s * 0.33, 0, 0.25), mat=green, seg=12))
    # bridle: arch from upright to upright with the hoist eye at the top
    for i in range(10):
        a0, a1 = i / 10 * math.pi, (i + 1) / 10 * math.pi
        p0 = Vector((math.cos(a0) * 0.33, 0, 0.5 + math.sin(a0) * 0.12)); p1 = Vector((math.cos(a1) * 0.33, 0, 0.5 + math.sin(a1) * 0.12))
        d = p1 - p0; e = d.to_track_quat('Z', 'Y').to_euler(); D.append(cyl('bridle', 0.013, d.length + 0.006, loc=(p0 + p1) / 2, rot=(e.x, e.y, e.z), mat=green, seg=10))
    D.append(cyl('eye', 0.022, 0.012, loc=(0, 0, 0.64), rot=(math.pi / 2, 0, 0), mat=rust, seg=16))
    for x in (-0.33, 0.33): D.append(cyl('rail', 0.011, 0.66, loc=(x, 0, 0.3), rot=(math.pi / 2, 0, 0), mat=green, seg=10))
    for (x, y) in ((-0.33, 0.33), (0.33, 0.33), (-0.33, -0.33), (0.33, -0.33)): D.append(cyl('post', 0.011, 0.3, loc=(x, y, 0.15), mat=green, seg=10))
    for o in D:
        if o.data.materials[0].name != 'metal_plate': box_uv(o, 1.0 if o.data.materials[0].name == 'green_metal_rust' else 2.0, off=(R.random(), R.random()))
    smooth_all(D, 0.7)
    T_, G_, M_ = by_mat(D, 'metal_plate'), by_mat(D, 'green_metal_rust'), by_mat(D, 'rusty_metal_04')
    export([join(T_, 'lift_tread'), join(G_, 'lift_frame'), join(M_, 'lift_iron')], 'lift_deck')
    # head beam with sheave (pulley) block, 0.84 m between column centres
    reset(); rust = tex_mat('rusty_metal_04'); Hd = []
    Hd.append(box('web', (0.96, 0.008, 0.07), (0, 0, 0), mat=rust, bevel=0.001, segs=1))
    for zz in (-0.032, 0.032): Hd.append(box('flange', (0.96, 0.06, 0.006), (0, 0, zz), mat=rust, bevel=0.0015, segs=1))
    for s_ in (-1, 1): Hd.append(box('cleat', (0.08, 0.08, 0.1), (s_ * 0.42, 0, 0), mat=rust, bevel=0.004))
    Hd.append(box('block', (0.05, 0.1, 0.12), (0, 0, -0.09), mat=rust, bevel=0.005))
    for yy in (-0.03, 0.03): Hd.append(cyl('cheek', 0.07, 0.008, loc=(0, yy, -0.12), rot=(math.pi / 2, 0, 0), mat=rust, seg=32))
    sheave = cyl('sheave', 0.06, 0.03, loc=(0, 0, -0.12), rot=(math.pi / 2, 0, 0), mat=tex_mat('green_metal_rust'), seg=32, bevel=0.006)
    Hd.append(cyl('axle', 0.012, 0.09, loc=(0, 0, -0.12), rot=(math.pi / 2, 0, 0), mat=rust, seg=12))
    for o in Hd + [sheave]: box_uv(o, 2.0, off=(R.random(), R.random()))
    smooth_all(Hd + [sheave], 0.7); export([join(Hd, 'head_iron'), sheave], 'lift_head')
    # counterweight: stacked cast blocks on a hanger
    reset(); rust = tex_mat('rusty_metal_04'); C = []
    for k in range(4): C.append(box('weight', (0.16, 0.08, 0.05), (0, 0, -0.06 - k * 0.055), mat=rust, bevel=0.006))
    C.append(cyl('rod', 0.008, 0.28, loc=(0, 0, -0.13), mat=rust, seg=10)); C.append(cyl('hook', 0.015, 0.02, loc=(0, 0, 0), mat=rust, seg=12))
    for o in C: box_uv(o, 2.0, off=(R.random(), R.random()))
    smooth_all(C, 0.7); export([join(C, 'counterweight')], 'lift_counter')

# ------------------------------------------------------------------ dry-stone wall, 1.2 m segment, ~0.95 m high
def rubble_stone(name, size, loc, pid='rock_face_03', seed=0, rot=(0, 0, 0)):
    """a field stone: rounded superellipsoid block, lumpy fbm surface, one or two broken faces"""
    from mathutils import noise, Euler
    rr = random.Random(seed); off = Vector((rr.random() * 90, rr.random() * 90, rr.random() * 90))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
    e = rr.uniform(4.0, 7.0)
    pls = [(Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-1, 1))).normalized(), rr.uniform(0.82, 0.96)) for _ in range(rr.randint(0, 2))]
    for v in bm.verts:
        d = v.co.normalized()
        r = (abs(d.x) ** e + abs(d.y) ** e + abs(d.z) ** e) ** (-1 / e)
        p = d * r
        p += d * (0.06 * noise.noise(p * 1.4 + off) + 0.025 * noise.noise(p * 4.0 + off))
        for n_, dd in pls:
            k = p.dot(n_) - dd
            if k > 0: p -= n_ * k
        v.co = Vector((p.x * size[0] / 2, p.y * size[1] / 2, p.z * size[2] / 2))
    bm.transform(Matrix.Translation(loc) @ Euler(rot).to_matrix().to_4x4())
    ob = obj_from_bm(name, bm, tex_mat(pid)); box_uv(ob, TEX_M[pid], off=(rr.random(), rr.random()))
    for f in ob.data.polygons: f.use_smooth = True
    return ob

def build_wall():
    """1.2 m dry-stone wall segment ~0.95 m high: random rubble in rough courses, battered (0.5 m wide at the foot,
    0.34 m at the top), occasional through-stones and pinning stones, and a cope of upright stones on edge"""
    for var in range(2):
        reset(); S = []; rr = random.Random(40 + var)
        z = 0.0; row = 0; H = 0.74
        while z < H - 0.05:
            hrow = rr.uniform(0.11, 0.22); x = -0.6 - rr.uniform(0, 0.12)
            while x < 0.6:
                L = rr.uniform(0.18, 0.46) * (1.25 if row == 0 else 1.0); x1 = min(0.66, x + L)
                h = min(hrow * rr.uniform(0.75, 1.05), H - z + 0.02)
                if h > 0.05 and x1 - x > 0.07:
                    zc = z + h / 2; wd = 0.5 - 0.16 * zc / H
                    through = rr.random() < 0.12
                    pid = 'rock_face_03'
                    S.append(rubble_stone('stone', (x1 - x - 0.01, wd * (1.12 if through else rr.uniform(0.86, 1.0)), h),
                                          ((x + x1) / 2, rr.uniform(-0.025, 0.025), zc), pid, seed=var * 1000 + len(S),
                                          rot=(rr.uniform(-0.04, 0.04), rr.uniform(-0.07, 0.07), rr.uniform(-0.05, 0.05))))
                    if rr.random() < 0.3 and h > 0.12:                     # pinning stone wedged into the joint
                        for sy in (-1, 1):
                            S.append(rubble_stone('pin', (0.07, 0.08, 0.05), (x1, sy * (wd / 2 - 0.03), z + h * rr.uniform(0.25, 0.75)), 'rock_face_03', seed=var * 3000 + len(S)))
                x = x1
            z += hrow; row += 1
        x = -0.6
        while x < 0.6:                                   # cope: upright stones on edge, leaning a little
            t = rr.uniform(0.06, 0.11); x1 = min(0.6, x + t)
            hc = rr.uniform(0.17, 0.26)
            S.append(rubble_stone('cope', (x1 - x - 0.006, rr.uniform(0.3, 0.38), hc), ((x + x1) / 2, rr.uniform(-0.02, 0.02), z + hc / 2 - 0.03), 'mossy_rock' if rr.random() < 0.35 else 'rock_face_03',
                                  seed=var * 2000 + len(S), rot=(0, rr.uniform(-0.18, 0.18), rr.uniform(-0.05, 0.05))))
            x = x1
        # hearting: a dark recessed core so no light shows between stones
        S.append(box('core', (1.2, 0.2, z), (0, 0, z / 2), mat=flat_mat('hearting', (0.035, 0.03, 0.025), rough=1.0), bevel=0.0))
        A_, C_, H_ = by_mat(S, 'rock_face_03'), by_mat(S, 'mossy_rock'), by_mat(S, 'hearting')
        print('wall', var, len(S), 'stones')
        export([join(A_, 'wall_stone'), join(C_, 'wall_cope'), join(H_, 'wall_core')], f'wall_{var}')

ONLY = sys.argv[3:]
for f in (build_crate, build_fence, build_gate, build_plate, build_lift, build_socket, build_cell, build_shard, build_booster, build_ball, build_gate2, build_plate2, build_lift2, build_wall):
    if ONLY and f.__name__ not in ONLY: continue
    try: f()
    except Exception as e:
        import traceback; traceback.print_exc(); print('FAILED', f.__name__)
