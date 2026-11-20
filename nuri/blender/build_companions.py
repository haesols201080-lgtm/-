"""Companion robots (original designs) as real hard-surface models, built the same way as Nuri: superellipsoid
shells with panel grooves, bevelled parts, screws, joints, glass lenses; ambient occlusion baked into vertex colours.
Mesh names tell the game which material to use: shell_*, dark_*, eye_*, glass_*, rubber_*; moving parts are
separate objects (toto_wheel, mina_rotor_L/R).
Blender: Z up, -Y forward (game +Z). usage: python build_companions.py <out_dir>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from common import superellipsoid, B

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
MATS = {}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear()
    try: bpy.ops.preferences.addon_enable(module='cycles')
    except Exception: pass

def mat(name):
    if name not in MATS:
        m = bpy.data.materials.new(name); m.use_nodes = True; MATS[name] = m
    return MATS[name]

def ob_bm(name, bm, mname):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat(mname)); return o

def xf(loc=(0, 0, 0), rot=(0, 0, 0)):
    return Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')

def box(name, size, loc, mname, rot=(0, 0, 0), bevel=0.002, segs=3):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    bm.transform(xf(loc, rot)); return ob_bm(name, bm, mname)

def cyl(name, r, h, loc, mname, rot=(0, 0, 0), seg=32, r2=None, bevel=0.0, cap=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if bevel:
        ed = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > 0.6]
        if ed: bmesh.ops.bevel(bm, geom=ed, offset=bevel, segments=2, affect='EDGES')
    bm.transform(xf(loc, rot)); return ob_bm(name, bm, mname)

def torus(name, R, r, loc, mname, rot=(0, 0, 0), seg=48, rs=12):
    bm = bmesh.new(); verts = []
    for i in range(seg):
        a = i / seg * 2 * math.pi
        ring = []
        for j in range(rs):
            b = j / rs * 2 * math.pi
            ring.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        verts.append(ring)
    for i in range(seg):
        for j in range(rs):
            bm.faces.new((verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % rs], verts[i][(j + 1) % rs]))
    bm.transform(xf(loc, rot)); return ob_bm(name, bm, mname)

def sphere(name, r, loc, mname, scale=(1, 1, 1), seg=24, ring=16):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    for v in bm.verts: v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    bm.transform(xf(loc)); return ob_bm(name, bm, mname)

def screw(loc, normal, mname='dark'):
    n = Vector(normal).normalized(); e = n.to_track_quat('Z', 'Y').to_euler()
    o = cyl('screw', 0.0028, 0.0015, Vector(loc) + n * 0.0006, mname, rot=(e.x, e.y, e.z), seg=8)
    s2 = box('slot', (0.004, 0.0006, 0.0008), (0, 0, 0), mname); s2.data.transform(xf(Vector(loc) + n * 0.0014, (e.x, e.y, e.z))); return [o, s2]

def shell(name, rx, ry, rz, e1, e2, center, grooves=(), mname='shell'):
    o = superellipsoid(name, rx, ry, rz, e1=e1, e2=e2, nu=72, nv=44, grooves=grooves, center=(0, 0, 0))
    o.data.transform(Matrix.Translation(center)); o.location = (0, 0, 0)
    o.data.materials.append(mat(mname)); return o

def finish(objs, name, keep_separate=()):
    """smooth + AO bake into vertex colours, join by material (moving parts stay separate), export"""
    for o in objs:
        for p in o.data.polygons: p.use_smooth = True
        try: o.data.set_sharp_from_angle(angle=math.radians(40))
        except Exception: pass
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    w = bpy.data.worlds.new('AOW'); sc.world = w
    try: w.light_settings.distance = 0.03
    except Exception: pass
    for o in objs:
        ca = o.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); o.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)
    groups = {}
    for o in objs:
        key = o.name if any(o.name.startswith(k) for k in keep_separate) else o.data.materials[0].name
        groups.setdefault(key, []).append(o)
    out = []
    for key, lst in groups.items():
        sep = len(lst) == 1 and lst[0].name == key
        bpy.ops.object.select_all(action='DESELECT')
        for o in lst: o.select_set(True)
        bpy.context.view_layer.objects.active = lst[0]
        if len(lst) > 1: bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active; j.name = key if sep else f'{key}_{name}'; out.append(j)
    bpy.ops.object.select_all(action='DESELECT')
    for o in out: o.select_set(True)
    path = f'{OUT}/{name}.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='EXPORT', export_yup=True,
                              export_normals=True, export_vertex_color='ACTIVE', export_apply=True)
    print('COMPANION', name, [o.name for o in out], round(os.path.getsize(path) / 1e3), 'kB')

# ------------------------------------------------------------------ Toto: barrel body on one wheel, big camera eye
def build_toto():
    reset(); O = []
    gr = [{'kind': 'v', 'at': 0.32, 'w': 0.035, 'd': 0.0018}, {'kind': 'v', 'at': -0.45, 'w': 0.035, 'd': 0.0018},
          {'kind': 'u', 'at': 1.2, 'from': -0.45, 'to': 0.32, 'w': 0.03, 'd': 0.0014}, {'kind': 'u', 'at': -1.9, 'from': -0.45, 'to': 0.32, 'w': 0.03, 'd': 0.0014}]
    body = shell('shell_body', 0.062, 0.062, 0.066, 0.35, 1.0, (0, 0, 0.115), gr); O.append(body)
    O.append(cyl('dark_waist', 0.0605, 0.012, (0, 0, 0.07), 'dark', seg=48, bevel=0.002))
    O.append(sphere('shell_cap', 0.05, (0, 0, 0.168), 'shell', scale=(1, 1, 0.42), seg=40, ring=20))
    O.append(cyl('dark_stub', 0.006, 0.02, (0.02, 0.01, 0.193), 'dark', seg=12)); O.append(sphere('eye_tip', 0.0055, (0.02, 0.01, 0.205), 'eye'))
    # camera eye: housing, focus rings, glass, iris
    eye_y = -0.064
    O.append(cyl('dark_housing', 0.034, 0.026, (0, eye_y - 0.004, 0.125), 'dark', rot=(math.pi / 2, 0, 0), seg=40, bevel=0.003))
    O.append(torus('shell_ring', 0.031, 0.0035, (0, eye_y - 0.018, 0.125), 'shell', rot=(math.pi / 2, 0, 0)))
    O.append(torus('dark_ring2', 0.024, 0.0025, (0, eye_y - 0.017, 0.125), 'dark', rot=(math.pi / 2, 0, 0)))
    O.append(cyl('eye_iris', 0.012, 0.003, (0, eye_y - 0.014, 0.125), 'eye', rot=(math.pi / 2, 0, 0), seg=24))
    O.append(sphere('glass_lens', 0.022, (0, eye_y - 0.012, 0.125), 'glass', scale=(1, 0.35, 1), seg=32, ring=16))
    for a in range(6):
        t = a / 6 * 2 * math.pi; O += screw((math.cos(t) * 0.029, eye_y - 0.0175, 0.125 + math.sin(t) * 0.029), (0, -1, 0))
    # side vents and a small antenna mic grille
    for s in (-1, 1):
        for k in range(4): O.append(box('dark_vent', (0.002, 0.018, 0.003), (s * 0.061, 0.01, 0.1 + k * 0.007), 'dark', bevel=0.0007, segs=1))
    # fork + axle + wheel
    for s in (-1, 1):
        O.append(box('dark_fork', (0.008, 0.02, 0.05), (s * 0.03, 0, 0.045), 'dark', bevel=0.002))
        O.append(cyl('dark_hubcap', 0.012, 0.008, (s * 0.026, 0, 0.034), 'dark', rot=(0, math.pi / 2, 0), seg=20, bevel=0.0015))
    W = []
    W.append(torus('rubber_tire', 0.026, 0.0115, (0, 0, 0), 'rubber', rot=(0, math.pi / 2, 0), seg=48, rs=14))
    for k in range(24):
        a = k / 24 * 2 * math.pi
        W.append(box('rubber_tread', (0.018, 0.004, 0.003), (0, math.cos(a) * 0.0372, math.sin(a) * 0.0372), 'rubber', rot=(a, 0, 0), bevel=0.0008, segs=1))
    W.append(cyl('shell_hub', 0.017, 0.02, (0, 0, 0), 'shell', rot=(0, math.pi / 2, 0), seg=32, bevel=0.002))
    for k in range(5):
        a = k / 5 * 2 * math.pi; W += screw((0.0105, math.cos(a) * 0.009, math.sin(a) * 0.009), (1, 0, 0))
    for w in W: w.data.transform(Matrix.Translation((0, 0, 0.034)))
    bpy.ops.object.select_all(action='DESELECT')
    for w in W: w.select_set(True)
    bpy.context.view_layer.objects.active = W[0]; bpy.ops.object.join(); wheel = bpy.context.active_object; wheel.name = 'toto_wheel'
    wheel.data.transform(Matrix.Translation((0, 0, -0.034))); wheel.location = (0, 0, 0.034)
    finish(O + [wheel], 'toto', keep_separate=('toto_wheel',))

# ------------------------------------------------------------------ Bori: boxy lantern bot with slot eyes, handle, legs
def build_bori():
    reset(); O = []
    gr = [{'kind': 'v', 'at': 0.55, 'w': 0.03, 'd': 0.0016}, {'kind': 'v', 'at': -0.62, 'w': 0.03, 'd': 0.0016}]
    O.append(shell('shell_body', 0.061, 0.051, 0.061, 0.22, 0.22, (0, 0, 0.11), gr))
    # visor recess with two slot eyes
    O.append(box('dark_visor', (0.088, 0.012, 0.034), (0, -0.054, 0.13), 'dark', bevel=0.006))
    O.append(box('glass_visor', (0.082, 0.004, 0.028), (0, -0.0605, 0.13), 'glass', bevel=0.004))
    for s in (-1, 1): O.append(box('eye_slot', (0.024, 0.003, 0.0065), (s * 0.019, -0.0595, 0.13), 'eye', bevel=0.0025))
    # chest grille and a status light
    O.append(box('dark_grillebase', (0.05, 0.006, 0.026), (0, -0.0525, 0.083), 'dark', bevel=0.003))
    for k in range(5): O.append(box('shell_slat', (0.046, 0.004, 0.0026), (0, -0.0565, 0.073 + k * 0.005), 'shell', bevel=0.0009, segs=1))
    O.append(sphere('eye_status', 0.003, (0.034, -0.053, 0.083), 'eye'))
    # lantern windows on the sides (glowing core behind glass, cage bars)
    for s in (-1, 1):
        O.append(box('eye_core', (0.003, 0.03, 0.036), (s * 0.058, 0.004, 0.098), 'eye', bevel=0.002))
        O.append(box('glass_window', (0.003, 0.036, 0.042), (s * 0.0615, 0.004, 0.098), 'glass', bevel=0.003))
        for k in (-1, 0, 1): O.append(box('dark_bar', (0.004, 0.003, 0.046), (s * 0.064, 0.004 + k * 0.012, 0.098), 'dark', bevel=0.001, segs=1))
    # handle: bent tube on two hinge mounts
    pts = [(-0.035, 0, 0.168), (-0.034, 0, 0.19), (-0.02, 0, 0.205), (0.02, 0, 0.205), (0.034, 0, 0.19), (0.035, 0, 0.168)]
    for i in range(len(pts) - 1):
        a, b = Vector(pts[i]), Vector(pts[i + 1]); d = b - a; e = d.to_track_quat('Z', 'Y').to_euler()
        O.append(cyl('dark_handle', 0.0045, d.length + 0.004, (a + b) / 2, 'dark', rot=(e.x, e.y, e.z), seg=12))
    for s in (-1, 1): O.append(box('shell_mount', (0.014, 0.014, 0.012), (s * 0.035, 0, 0.166), 'shell', bevel=0.003))
    for (x, z) in ((-0.05, 0.155), (0.05, 0.155), (-0.05, 0.065), (0.05, 0.065)): O += screw((x, -0.0505, z), (0, -1, 0))
    # legs with knee joints and flat feet
    for s in (-1, 1):
        O.append(cyl('dark_hip', 0.011, 0.012, (s * 0.034, 0, 0.052), 'dark', rot=(0, math.pi / 2, 0), seg=20, bevel=0.002))
        O.append(box('shell_leg', (0.016, 0.018, 0.03), (s * 0.034, 0, 0.035), 'shell', bevel=0.004))
        O.append(box('rubber_foot', (0.024, 0.034, 0.01), (s * 0.034, -0.004, 0.006), 'rubber', bevel=0.003))
    finish(O, 'bori')

# ------------------------------------------------------------------ Mina: hovering scout drone with two rotors
def build_mina():
    reset(); O = []
    gr = [{'kind': 'v', 'at': 0.0, 'w': 0.04, 'd': 0.0016}]
    O.append(shell('shell_body', 0.056, 0.056, 0.042, 0.55, 1.0, (0, 0, 0), gr))
    O.append(sphere('glass_visor', 0.04, (0, -0.03, 0.004), 'glass', scale=(1.0, 0.75, 0.7), seg=40, ring=20))
    O.append(sphere('dark_visorback', 0.038, (0, -0.027, 0.004), 'dark', scale=(1.0, 0.72, 0.68), seg=32, ring=16))
    for s in (-1, 1): O.append(sphere('eye_eye', 0.0075, (s * 0.014, -0.052, 0.006), 'eye', scale=(1, 0.5, 1.15)))
    O.append(box('eye_strip', (0.05, 0.003, 0.003), (0, 0.0, -0.041), 'eye', bevel=0.001, segs=1))
    rotors = []
    for s in (-1, 1):
        O.append(box('dark_arm', (0.06, 0.012, 0.007), (s * 0.075, 0, 0.012), 'dark', bevel=0.003))
        O.append(cyl('shell_motor', 0.013, 0.018, (s * 0.105, 0, 0.016), 'shell', seg=28, bevel=0.002))
        O.append(cyl('dark_shaft', 0.003, 0.012, (s * 0.105, 0, 0.03), 'dark', seg=10))
        O.append(torus('dark_guard', 0.042, 0.0022, (s * 0.105, 0, 0.032), 'dark'))
        for k in range(4):
            a = k / 4 * 2 * math.pi
            O.append(box('dark_strut', (0.03, 0.002, 0.0015), (s * 0.105 + math.cos(a) * 0.027, math.sin(a) * 0.027, 0.032), 'dark', rot=(0, 0, a), bevel=0.0005, segs=1))
        # two-blade propeller with twist
        bl = []
        for k in (0, 1):
            bm = bmesh.new(); vs = []
            for i in range(9):
                t = i / 8; r = 0.004 + t * 0.034; c = 0.009 * (1 - 0.55 * t) + 0.002; tw = 0.45 * (1 - t) + 0.1
                for side in (-1, 1): vs.append(bm.verts.new((r, side * c / 2 * math.cos(tw), side * c / 2 * math.sin(tw))))
            for i in range(8): bm.faces.new((vs[2 * i], vs[2 * i + 2], vs[2 * i + 3], vs[2 * i + 1]))
            bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.0012)
            bm.transform(Matrix.Rotation(k * math.pi, 4, 'Z')); bl.append(ob_bm(f'mina_rotor_{"L" if s < 0 else "R"}', bm, 'dark'))
        bl.append(cyl(f'mina_rotor_{"L" if s < 0 else "R"}', 0.005, 0.005, (0, 0, 0), 'dark', seg=12))
        bpy.ops.object.select_all(action='DESELECT')
        for b in bl: b.select_set(True)
        bpy.context.view_layer.objects.active = bl[0]; bpy.ops.object.join(); r = bpy.context.active_object; r.name = f'mina_rotor_{"L" if s < 0 else "R"}'
        r.location = (s * 0.105, 0, 0.037); rotors.append(r)
    for s in (-1, 1):
        O.append(box('dark_skid', (0.004, 0.06, 0.004), (s * 0.03, 0, -0.05), 'dark', bevel=0.0015))
        for y in (-0.02, 0.02): O.append(box('dark_skidleg', (0.003, 0.003, 0.016), (s * 0.03, y, -0.042), 'dark', bevel=0.001, segs=1))
    for r in rotors:
        bpy.ops.object.select_all(action='DESELECT'); r.select_set(True); bpy.context.view_layer.objects.active = r
    finish(O + rotors, 'mina', keep_separate=('mina_rotor',))

def hexprism(name, r, h, z, mname, bevel=0.006, segs=3, inset=None):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=r, radius2=r, depth=h)
    if bevel: bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.calc_face_angle(0) > 0.5], offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    bm.transform(Matrix.Translation((0, 0, z)) @ Matrix.Rotation(math.pi / 6, 4, 'Z')); return ob_bm(name, bm, mname)

def finish_static(objs, name):
    for o in objs:
        for p in o.data.polygons: p.use_smooth = True
        try: o.data.set_sharp_from_angle(angle=math.radians(40))
        except Exception: pass
    finish(objs, name)

# ------------------------------------------------------------------ pressure pad, same design language as the robots
def build_plate_sf():
    reset(); B_ = []
    B_.append(hexprism('dark_housing', 0.36, 0.08, -0.02, 'dark', bevel=0.012))
    B_.append(hexprism('shell_collar', 0.335, 0.03, 0.035, 'shell', bevel=0.008))
    for k in range(6):                                    # screws on the collar corners, vents between
        a = k / 6 * 2 * math.pi
        B_ += screw((math.cos(a) * 0.3, math.sin(a) * 0.3, 0.051), (0, 0, 1))
        a2 = a + math.pi / 6
        for q in (-1, 0, 1):
            B_.append(box('dark_vent', (0.004, 0.05, 0.004), (math.cos(a2) * 0.335, math.sin(a2) * 0.335 + 0, 0.01 + q * 0.012), 'dark', rot=(0, 0, a2), bevel=0.001, segs=1))
    B_.append(box('dark_conduit', (0.06, 0.12, 0.04), (0, 0.36, -0.02), 'dark', bevel=0.008))   # cable duct toward the gate
    B_.append(torus('eye_ring', 0.27, 0.006, (0, 0, 0.052), 'eye', seg=6 * 12, rs=8))
    finish_static(B_, 'plate_sf_base')
    reset(); T = []
    T.append(hexprism('shell_pad', 0.255, 0.035, 0.0, 'shell', bevel=0.01))
    T.append(hexprism('dark_inset', 0.2, 0.012, 0.02, 'dark', bevel=0.004))
    # rubber tread segments (six wedges) and a centre emblem
    for k in range(6):
        a = k / 6 * 2 * math.pi + math.pi / 6
        T.append(box('rubber_tread', (0.11, 0.05, 0.008), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.03), 'rubber', rot=(0, 0, a + math.pi / 2), bevel=0.003))
    T.append(cyl('shell_hub', 0.045, 0.012, (0, 0, 0.03), 'shell', seg=6, bevel=0.004))
    T.append(cyl('eye_core', 0.022, 0.004, (0, 0, 0.037), 'eye', seg=24))
    finish_static(T, 'plate_sf_top')

ONLY = sys.argv[2:]
for f in (build_toto, build_bori, build_mina, build_plate_sf):
    if ONLY and f.__name__[6:] not in ONLY: continue
    try: f()
    except Exception:
        import traceback; traceback.print_exc(); print('FAILED', f.__name__)
