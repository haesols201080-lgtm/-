"""Red squirrel (Sciurus vulgaris), sculpted as a smooth signed-distance field: arched torso over heavy haunches,
shoulders and elbows, slim forearms with four-fingered hands, long hind feet with five toes, claws, short neck,
rounded cranium with bulging eyes in their sockets, cheeks, a muzzle with split upper lip and a bare nose pad, thin
cupped ears, and an S-curled tail. Exports the skin with the data the game's shell fur needs:
  TEXCOORD_0 strand UVs in metres, TEXCOORD_1 (fur length, zone/8), TEXCOORD_2/3 comb direction (glTF space),
  COLOR_0 coat colour; plus glossy eyes.
usage: python build_squirrel.py <out.glb>"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector
from sdf_sculpt import Sculpt

OUT = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
# forward = -Y, up = Z (exported as glTF +Z forward / +Y up)
S = Sculpt((-0.06, -0.135, -0.004), (0.06, 0.145, 0.26), 0.001)
def T(zone, fur, comb): return dict(zone=zone, fur=fur, comb=Vector(comb).normalized())
BODY, BELLY, HEAD, TAIL, EAR, CLAW, NOSE, LIMB = 0, 1, 2, 3, 4, 5, 6, 7
# torso: arched spine from neck to pelvis
spine = [(0, -0.056, 0.084), (0, -0.036, 0.08), (0, -0.008, 0.083), (0, 0.022, 0.079), (0, 0.046, 0.066)]
S.chain(spine, [0.021, 0.027, 0.029, 0.028, 0.025], k=0.012, tag=T(BODY, 1.0, (0, 1, -0.25)))
S.ellipsoid((0, 0.004, 0.06), (0.024, 0.04, 0.018), k=0.01, tag=T(BELLY, 0.8, (0, 1, -0.7)))
S.ellipsoid((0, -0.038, 0.066), (0.02, 0.022, 0.024), (0.3, 0, 0), k=0.01, tag=T(BELLY, 0.85, (0, 0.3, -1)))
for s in (-1, 1):
    S.ellipsoid((s * 0.016, -0.038, 0.079), (0.011, 0.019, 0.016), (0.2, 0, 0), k=0.008, tag=T(BODY, 0.9, (0, 0.8, -0.6)))      # shoulder
    S.ellipsoid((s * 0.019, 0.038, 0.056), (0.016, 0.027, 0.025), (0.55, 0, 0), k=0.01, tag=T(BODY, 1.0, (0, 0.6, -0.8)))      # haunch
    # foreleg: upper arm, elbow, forearm, hand, fingers + claws
    sh, el, wr = (s * 0.018, -0.042, 0.066), (s * 0.017, -0.034, 0.038), (s * 0.015, -0.056, 0.011)
    S.capsule(sh, el, 0.0075, 0.0058, k=0.005, tag=T(LIMB, 0.7, (0, 0.3, -1)))
    S.capsule(el, wr, 0.0055, 0.0039, k=0.003, tag=T(LIMB, 0.55, (0, -0.4, -1)))
    S.ellipsoid((s * 0.015, -0.062, 0.0055), (0.0052, 0.0075, 0.0033), k=0.003, tag=T(LIMB, 0.3, (0, -1, -0.2)))
    for i in range(4):
        b = (s * 0.015 + (i - 1.5) * 0.0024, -0.066, 0.0048); t = (s * 0.015 + (i - 1.5) * 0.0034, -0.0745 + abs(i - 1.5) * 0.0012, 0.0022)
        S.capsule(b, t, 0.0013, 0.001, k=0.0012, tag=T(LIMB, 0.15, (0, -1, 0)))
        S.capsule(t, (t[0], t[1] - 0.0028, t[2] - 0.0018), 0.00075, 0.00022, k=0.0005, tag=T(CLAW, 0.0, (0, -1, 0)))
    # hind leg: shank down from the haunch, long flat foot pointing forward, five toes + claws
    kn, ho = (s * 0.024, 0.03, 0.03), (s * 0.023, 0.052, 0.011)
    S.capsule(kn, ho, 0.0095, 0.0058, k=0.006, tag=T(LIMB, 0.7, (0, 0.4, -1)))
    S.capsule((s * 0.023, 0.054, 0.0075), (s * 0.022, 0.006, 0.0045), 0.0062, 0.0046, k=0.004, tag=T(LIMB, 0.35, (0, -1, -0.2)))
    for i in range(5):
        b = (s * 0.022 + (i - 2) * 0.0025, 0.005, 0.0042); t = (s * 0.022 + (i - 2) * 0.0034, -0.0065 + abs(i - 2) * 0.0016, 0.0024)
        S.capsule(b, t, 0.0014, 0.001, k=0.0012, tag=T(LIMB, 0.15, (0, -1, 0)))
        S.capsule(t, (t[0], t[1] - 0.003, t[2] - 0.0018), 0.00075, 0.00022, k=0.0005, tag=T(CLAW, 0.0, (0, -1, 0)))
# neck and head
S.capsule((0, -0.054, 0.086), (0, -0.07, 0.101), 0.02, 0.0175, k=0.01, tag=T(HEAD, 0.75, (0, 1, -0.2)))
S.ellipsoid((0, -0.083, 0.113), (0.0205, 0.025, 0.0195), k=0.008, tag=T(HEAD, 0.55, (0, 1, 0.15)))
for s in (-1, 1):
    S.ellipsoid((s * 0.0115, -0.095, 0.102), (0.0115, 0.0135, 0.0115), k=0.006, tag=T(HEAD, 0.5, (0, 1, -0.4)))           # cheek
S.ellipsoid((0, -0.106, 0.1005), (0.0102, 0.0138, 0.0092), (-0.3, 0, 0), k=0.005, tag=T(HEAD, 0.3, (0, 1, 0)))           # muzzle
S.ellipsoid((0, -0.1, 0.0925), (0.0052, 0.0065, 0.0038), k=0.004, tag=T(BELLY, 0.3, (0, 1, -0.3)))                          # chin
S.ellipsoid((0, -0.1185, 0.1018), (0.0044, 0.0038, 0.0036), k=0.002, tag=T(NOSE, 0.0, (0, 1, 0)))                           # nose pad
S.ellipsoid((0, -0.1175, 0.0955), (0.0006, 0.0035, 0.0032), k=0.0012, op='sub')                                              # philtrum
S.ellipsoid((0, -0.1075, 0.0935), (0.0085, 0.008, 0.0011), k=0.0012, op='sub')                                               # mouth line
for s in (-1, 1):
    S.ellipsoid((s * 0.0168, -0.097, 0.1135), (0.0052, 0.006, 0.0054), k=0.0025, op='sub')                                  # eye socket
    # ear: a thin cupped plate leaning back and out
    S.ellipsoid((s * 0.0128, -0.077, 0.1365), (0.0058, 0.0021, 0.0106), (0.15, s * 0.32, 0), k=0.004, tag=T(EAR, 0.4, (0, 0.2, 1)))
    S.ellipsoid((s * 0.0122, -0.0795, 0.139), (0.0042, 0.0016, 0.0085), (0.15, s * 0.32, 0), k=0.0012, op='sub')
# tail: thin core along an S curve rising behind the back
tail = [(0, 0.062, 0.062), (0, 0.084, 0.07), (0, 0.104, 0.09), (0, 0.117, 0.12), (0, 0.12, 0.155), (0, 0.112, 0.19), (0, 0.095, 0.216), (0, 0.072, 0.229), (0, 0.05, 0.226)]
for i in range(len(tail) - 1):
    a, b = Vector(tail[i]), Vector(tail[i + 1])
    S.capsule(tail[i], tail[i + 1], 0.009 - 0.0004 * i, 0.009 - 0.0004 * (i + 1), k=0.004, tag=T(TAIL, 6.4, tuple(b - a)))

V, F = S.mesh()
me = bpy.data.meshes.new('squirrel_body'); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.validate(); me.update()
body = bpy.data.objects.new('squirrel_body', me); bpy.context.scene.collection.objects.link(body)
bpy.context.view_layer.objects.active = body; body.select_set(True)
m = body.modifiers.new('dc', 'DECIMATE'); m.ratio = min(1.0, 11000 / len(me.polygons)); bpy.ops.object.modifier_apply(modifier='dc')
me = body.data
for p in me.polygons: p.use_smooth = True
print('squirrel tris', len(me.polygons))

# strand UVs in metres
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
uvl = me.uv_layers[0]; uvl.name = 'Strands'
a3 = sum(p.area for p in me.polygons)
def uv_area():
    tot = 0.0
    for p in me.polygons:
        uv = [uvl.data[li].uv for li in p.loop_indices]
        for k in range(1, len(uv) - 1): tot += abs((uv[k].x - uv[0].x) * (uv[k + 1].y - uv[0].y) - (uv[k + 1].x - uv[0].x) * (uv[k].y - uv[0].y)) * 0.5
    return tot
sc_ = math.sqrt(a3 / max(1e-12, uv_area()))
for d in uvl.data: d.uv = d.uv * sc_

# per-vertex fur data from the nearest primitive (comb blended with the second nearest for smooth flow)
P = np.array([tuple(v.co) for v in me.vertices], np.float32)
tags, dist, idx = S.nearest_tags(P)
eye = [Vector((s * 0.0172, -0.097, 0.1135)) for s in (-1, 1)]
furl = me.uv_layers.new(name='Fur'); cA = me.uv_layers.new(name='CombXY'); cB = me.uv_layers.new(name='CombZ')
col = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
def srgb(c): return tuple(x ** 2.2 for x in c)
vdat = []
for i, v in enumerate(me.vertices):
    tg = tags[i]; z = tg['zone']; fl = tg['fur']; comb = tg['comb'].copy(); n = v.normal; co = v.co
    if z == EAR and co.z > 0.143: fl = 1.6 + 70 * (co.z - 0.143)                                  # ear tufts
    if z == TAIL: fl *= 0.75 + 0.25 * math.sin(min(1.0, (co.z - 0.06) / 0.16) * math.pi * 0.9)    # fullest mid-tail
    ed = min((co - e).length for e in eye)
    if ed < 0.0085: fl *= 0.35                                                                     # short fur around the eye
    # coat: rufous back, warmer flanks, cream belly / chest / throat / chin, pale eye ring, dark tufts, nose and claws
    rufous = Vector((0.58, 0.29, 0.12)); flank = Vector((0.66, 0.38, 0.2)); cream = Vector((0.94, 0.9, 0.82))
    c = rufous.lerp(flank, max(0.0, min(1.0, abs(n.x) * 1.5 - 0.5)))
    under = max(0.0, min(1.0, (-n.z - 0.1) * 2.5))
    if z == BELLY: under = max(under, 0.85)
    if z == HEAD and co.z < 0.1 and n.z < 0.3: under = max(under, 0.7)
    c = c.lerp(cream, under)
    if ed < 0.0095: c = c.lerp(Vector((0.86, 0.74, 0.6)), 0.6)
    if z == TAIL: c = Vector((0.5, 0.22, 0.08)) * (0.92 + 0.15 * max(0.0, n.z))
    if z == EAR: c = Vector((0.5, 0.24, 0.1)) if co.z < 0.143 else Vector((0.24, 0.11, 0.05))
    if z == LIMB: c = c.lerp(Vector((0.5, 0.33, 0.22)), 0.4)
    if z == CLAW: c = Vector((0.07, 0.05, 0.04))
    if z == NOSE: c = Vector((0.11, 0.07, 0.06))
    vdat.append((fl, z, comb, srgb(c)))
for li, loop in enumerate(me.loops):
    fl, z, comb, c = vdat[loop.vertex_index]
    furl.data[li].uv = (fl, z / 8.0)
    gx, gy, gz = comb.x, comb.z, -comb.y                     # comb in glTF space (y up, z forward=-blender y)
    cA.data[li].uv = (gx, gy); cB.data[li].uv = (gz, 0.0)
    col.data[li].color = (c[0], c[1], c[2], 1.0)
me.color_attributes.active_color = col

# eyes: glossy, slightly bulging out of the sockets
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0047, location=(-0.0162, -0.0972, 0.1137), segments=20, ring_count=12)
e1 = bpy.context.active_object
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0047, location=(0.0162, -0.0972, 0.1137), segments=20, ring_count=12)
e2 = bpy.context.active_object
bpy.ops.object.select_all(action='DESELECT'); e1.select_set(True); e2.select_set(True); bpy.context.view_layer.objects.active = e1
bpy.ops.object.join(); e1.name = 'squirrel_eyes'; bpy.ops.object.shade_smooth()
for o, n in ((body, 'Fur'), (e1, 'Eye')):
    o.data.materials.clear(); o.data.materials.append(bpy.data.materials.new(n))
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); e1.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True,
                          export_normals=True, export_vertex_color='ACTIVE', export_texcoords=True)
print('exported', OUT, round(os.path.getsize(OUT) / 1e3), 'kB')
