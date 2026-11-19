"""European robin (Erithacus rubecula) for the ground birds: body and head sculpted as signed-distance fields (each
with plumage data for the game's shell fur: short soft feathers, groomed backwards), a two-part beak, glossy eyes,
thin scaled legs with toes, and real feather blades for the tail fan, the folded wings and the spread wings
(primaries along the hand, secondaries along the forearm, a row of coverts over them).
Objects: bird_body, bird_head (origin at the neck joint), bird_beak, bird_eyes, bird_legs, bird_tail,
bird_wingfold, bird_wing_L / bird_wing_R (origin at the shoulder).
usage: python build_bird.py <out.glb>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector, Matrix
from sdf_sculpt import Sculpt

OUT = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
col_ = bpy.context.scene.collection
def srgb(c): return tuple(max(0.0, x) ** 2.2 for x in c)
def T(zone, fur, comb): return dict(zone=zone, fur=fur, comb=Vector(comb).normalized())
ORANGE, BROWN, WHITE, GREY = Vector((0.88, 0.42, 0.14)), Vector((0.45, 0.36, 0.22)), Vector((0.93, 0.91, 0.86)), Vector((0.62, 0.63, 0.64))

def skin_object(S, name, target, colour, origin=Vector()):
    V, F = S.mesh()
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.validate(); me.update()
    ob = bpy.data.objects.new(name, me); col_.objects.link(ob)
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    m = ob.modifiers.new('dc', 'DECIMATE'); m.ratio = min(1.0, target / max(1, len(me.polygons))); bpy.ops.object.modifier_apply(modifier='dc')
    me = ob.data
    for p in me.polygons: p.use_smooth = True
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    uvl = me.uv_layers[0]; uvl.name = 'Strands'
    a3 = sum(p.area for p in me.polygons); au = 0.0
    for p in me.polygons:
        uv = [uvl.data[li].uv for li in p.loop_indices]
        for k in range(1, len(uv) - 1): au += abs((uv[k].x - uv[0].x) * (uv[k + 1].y - uv[0].y) - (uv[k + 1].x - uv[0].x) * (uv[k].y - uv[0].y)) * 0.5
    sc = math.sqrt(a3 / max(1e-12, au))
    for d in uvl.data: d.uv = d.uv * sc
    P = np.array([tuple(v.co) for v in me.vertices], np.float32)
    tags, _, _ = S.nearest_tags(P)
    fl_ = me.uv_layers.new(name='Fur'); cA = me.uv_layers.new(name='CombXY'); cB = me.uv_layers.new(name='CombZ')
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    vd = []
    for i, v in enumerate(me.vertices):
        tg = tags[i]; c = colour(v.co, v.normal, tg['zone'])
        vd.append((tg['fur'], tg['zone'], tg['comb'], srgb(c)))
    for li, loop in enumerate(me.loops):
        fl, z, cb, c = vd[loop.vertex_index]
        fl_.data[li].uv = (fl, z / 8.0); cA.data[li].uv = (cb.x, cb.z); cB.data[li].uv = (-cb.y, 0.0)
        ca.data[li].color = (c[0], c[1], c[2], 1.0)
    ca_ = me.color_attributes; ca_.active_color = ca
    # move the origin (head pivots at the neck)
    me.transform(Matrix.Translation(-origin)); ob.location = origin
    return ob

# ---------------- body
S = Sculpt((-0.035, -0.05, 0.015), (0.035, 0.06, 0.08), 0.0007)
S.ellipsoid((0, 0.0, 0.048), (0.0205, 0.033, 0.0235), (0.35, 0, 0), k=0.01, tag=T(0, 1.0, (0, 1, -0.2)))
S.ellipsoid((0, -0.019, 0.05), (0.0195, 0.02, 0.0215), k=0.01, tag=T(1, 1.1, (0, 0.4, -1)))
S.ellipsoid((0, 0.027, 0.044), (0.0155, 0.02, 0.0155), (0.4, 0, 0), k=0.008, tag=T(0, 0.9, (0, 1, -0.1)))
S.ellipsoid((0, -0.026, 0.065), (0.0125, 0.012, 0.0135), k=0.008, tag=T(1, 0.9, (0, 0.6, -0.8)))
def body_colour(co, n, z):
    breast = max(0.0, min(1.0, (-n.y - 0.05) * 2.2)) * max(0.0, min(1.0, (co.z - 0.03) / 0.012)) * max(0.0, min(1.0, (0.012 - co.y) / 0.02))
    under = max(0.0, min(1.0, (-n.z - 0.2) * 2.0))
    back = max(0.0, min(1.0, (n.z + 0.1) * 2.0 + (co.y - 0.0) * 30))
    c = WHITE.lerp(BROWN, back)
    c = c.lerp(GREY, max(0.0, 1 - abs(breast - 0.5) * 4) * 0.5 * (1 - under) * (1 - back))
    c = c.lerp(ORANGE, breast * (1 - under * 0.7))
    return c
body = skin_object(S, 'bird_body', 7000, body_colour)

# ---------------- head (pivot at the neck joint)
S = Sculpt((-0.025, -0.065, 0.05), (0.025, -0.012, 0.1), 0.0005)
S.ellipsoid((0, -0.037, 0.0795), (0.0142, 0.0154, 0.0137), k=0.006, tag=T(2, 0.75, (0, 1, 0.1)))
S.ellipsoid((0, -0.029, 0.07), (0.012, 0.012, 0.0115), k=0.009, tag=T(2, 0.85, (0, 1, -0.3)))
S.ellipsoid((0, -0.0435, 0.0755), (0.0088, 0.0078, 0.0078), k=0.005, tag=T(2, 0.55, (0, 1, 0)))
for s in (-1, 1):
    S.ellipsoid((s * 0.0099, -0.0432, 0.0812), (0.0027, 0.0027, 0.0027), k=0.0012, op='sub')
def head_colour(co, n, z):
    face = max(0.0, min(1.0, (-n.y + 0.15) * 1.6)) * max(0.0, min(1.0, (0.0845 - co.z) / 0.005))
    c = BROWN.lerp(GREY, max(0.0, 1 - abs(face - 0.45) * 2.2) * 0.55)
    return c.lerp(ORANGE, face)
head = skin_object(S, 'bird_head', 3500, head_colour, origin=Vector((0, -0.03, 0.07)))

# ---------------- beak, eyes, legs
S = Sculpt((-0.006, -0.062, 0.07), (0.006, -0.04, 0.085), 0.00022)
S.capsule((0, -0.0465, 0.078), (0, -0.0575, 0.0763), 0.0023, 0.00035, k=0.0009)
S.capsule((0, -0.0465, 0.0762), (0, -0.0548, 0.0755), 0.0018, 0.00035, k=0.0009)
V, F = S.mesh(); me = bpy.data.meshes.new('bird_beak'); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.validate()
beak = bpy.data.objects.new('bird_beak', me); col_.objects.link(beak)
for p in me.polygons: p.use_smooth = True
eyes = []
for s in (-1, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0024, location=(s * 0.0094, -0.0434, 0.0813), segments=16, ring_count=10); eyes.append(bpy.context.active_object)
bpy.ops.object.select_all(action='DESELECT'); [e.select_set(True) for e in eyes]; bpy.context.view_layer.objects.active = eyes[0]; bpy.ops.object.join()
eye = eyes[0]; eye.name = 'bird_eyes'; bpy.ops.object.shade_smooth()
S = Sculpt((-0.02, -0.03, -0.002), (0.02, 0.02, 0.035), 0.0003)
for s in (-1, 1):
    S.capsule((s * 0.0075, 0.002, 0.03), (s * 0.0082, -0.002, 0.0025), 0.0013, 0.001, k=0.0006)
    for ang in (-0.45, 0.0, 0.45):
        S.capsule((s * 0.0082, -0.002, 0.0018), (s * 0.0082 + math.sin(ang) * 0.011, -0.002 - math.cos(ang) * 0.011, 0.0008), 0.0008, 0.0005, k=0.0005)
    S.capsule((s * 0.0082, -0.002, 0.0018), (s * 0.0082, 0.007, 0.0009), 0.0008, 0.0005, k=0.0005)
V, F = S.mesh(); me = bpy.data.meshes.new('bird_legs'); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.validate()
legs = bpy.data.objects.new('bird_legs', me); col_.objects.link(legs)
for p in me.polygons: p.use_smooth = True

# ---------------- feathers
def feather(verts, faces, cols, base, d, side, L, W, curl=0.15, edge=Vector((0.62, 0.52, 0.36)), dark=Vector((0.26, 0.21, 0.14)), seg=7, asym=0.35):
    """blade from base along direction d (unit), lying in the plane spanned by d and side; rounded tip, curved"""
    up = d.cross(side).normalized()
    i0 = len(verts)
    for k in range(seg + 1):
        t = k / seg
        w = W * math.sqrt(max(0.0, math.sin(math.pi * min(1.0, 0.18 + t * 0.95)))) * (1 - 0.15 * t)
        c = base + d * (L * t) + up * (curl * L * t * t)
        for j, (o, cc) in enumerate(((-w * (1 - asym), edge), (0.0, dark * 1.35), (w * (1 + asym * 0.4), edge * 0.92))):
            verts.append(c + side * o + up * (abs(o) * 0.15)); cols.append(dark.lerp(cc, 0.65 if j != 1 else 1.0))
    for k in range(seg):
        a = i0 + k * 3
        faces.append((a, a + 1, a + 4, a + 3)); faces.append((a + 1, a + 2, a + 5, a + 4))

def feather_object(name, build, origin=Vector()):
    verts, faces, cols = [], [], []
    build(verts, faces, cols)
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v - origin) for v in verts], [], faces); me.update()
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
    for i, c in enumerate(cols): ca.data[i].color = (*srgb(c), 1.0)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); ob.location = origin; col_.objects.link(ob); return ob

def tail(v, f, c):
    for i in range(10):
        a = (i - 4.5) / 4.5 * 0.32
        d = Vector((math.sin(a), math.cos(a), 0.3)).normalized()
        feather(v, f, c, Vector((0, 0.036, 0.045 + abs(i - 4.5) * 0.0004)), d, Vector((math.cos(a), -math.sin(a), 0)), 0.05 - abs(i - 4.5) * 0.002, 0.0075, curl=-0.06,
                edge=Vector((0.4, 0.31, 0.2)), dark=Vector((0.28, 0.21, 0.13)), asym=0.1)
tailo = feather_object('bird_tail', tail)

def wingfold(v, f, c):
    for s in (-1, 1):
        for i in range(7):    # primaries/secondaries stacked along the flank, tips toward the tail
            # folded wing lies flat against the flank: blades stand vertically, normals facing out
            base = Vector((s * (0.0226 - i * 0.0005), -0.012 + i * 0.0048, 0.062 - i * 0.0026))
            d = Vector((s * -0.12, 1.0, -0.16)).normalized()
            feather(v, f, c, base, d, (Vector((0, 0, s)) - d * d.z * s).normalized(), 0.05 - i * 0.003, 0.0105, curl=-0.03,
                    edge=Vector((0.5, 0.41, 0.27)), dark=Vector((0.3, 0.24, 0.15)))
        for i in range(6):    # coverts over the shoulder
            base = Vector((s * 0.0236, -0.016 + i * 0.005, 0.066 - i * 0.0016))
            d = Vector((s * -0.08, 1.0, -0.3)).normalized()
            feather(v, f, c, base, d, (Vector((0, 0, s)) - d * d.z * s).normalized(), 0.024, 0.0095, curl=-0.02,
                    edge=Vector((0.48, 0.39, 0.25)), dark=Vector((0.38, 0.31, 0.2)), seg=5)
fold = feather_object('bird_wingfold', wingfold)

def wing(side):
    sh = Vector((side * 0.019, -0.012, 0.06))
    def build(v, f, c):
        wrist = sh + Vector((side * 0.048, -0.004, 0.003)); tip = sh + Vector((side * 0.078, 0.004, 0.004))
        for i in range(9):    # primaries on the hand, fanning outward and back
            t = i / 8; p = wrist.lerp(tip, t)
            a = side * (0.35 + 0.9 * t); d = Vector((math.sin(a), math.cos(a), 0)).normalized()
            feather(v, f, c, p, d, Vector((0, 0, 1)).cross(d).normalized(), 0.05 + 0.012 * t, 0.0065, curl=0.03)
        for i in range(8):    # secondaries along the forearm, pointing back
            t = i / 7; p = sh.lerp(wrist, 0.15 + 0.85 * t)
            d = Vector((side * 0.12 * t, 1.0, 0)).normalized()
            feather(v, f, c, p, d, Vector((0, 0, 1)).cross(d).normalized(), 0.042, 0.0072, curl=0.03)
        for i in range(10):   # coverts
            t = i / 9; p = sh.lerp(tip, 0.1 + 0.8 * t) + Vector((0, 0, 0.0015))
            d = Vector((side * 0.25 * t, 1.0, 0)).normalized()
            feather(v, f, c, p, d, Vector((0, 0, 1)).cross(d).normalized(), 0.02, 0.0065, curl=0.02, edge=Vector((0.5, 0.43, 0.29)), dark=Vector((0.36, 0.3, 0.2)), seg=4)
    return feather_object('bird_wing_L' if side > 0 else 'bird_wing_R', build, origin=sh)
wl, wr = wing(1), wing(-1)
for o, n in ((body, 'Plumage'), (head, 'Plumage'), (beak, 'Beak'), (eye, 'Eye'), (legs, 'Leg'), (tailo, 'Feather'), (fold, 'Feather'), (wl, 'Feather'), (wr, 'Feather')):
    o.data.materials.clear(); o.data.materials.append(bpy.data.materials.get(n) or bpy.data.materials.new(n))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True, export_normals=True,
                          export_vertex_color='ACTIVE', export_texcoords=True)
print('exported', OUT, round(os.path.getsize(OUT) / 1e3), 'kB')
