"""The stranger's cat: a domestic shorthair, brown mackerel tabby with a white chest, muzzle and paws. Sculpted
standing (as a smooth signed-distance field, like the squirrel) so it can be posed and animated: a deep chest and
shoulder blades, a long loin, heavy haunches, forelegs with elbows, hind legs with knees and hocks, round paws with
toes, a short neck, a rounded skull with cheeks, whisker pads, chin and nose leather, cupped ears, eye sockets, and a
long tail. Rigged with a skeleton (spine, neck, head, ears, legs, a five-bone tail) and skinned with automatic
weights; its eyes are separate (glossy, gold-green with slit pupils, drawn in the game).
Exports the skin with the data the game's shell fur needs: TEXCOORD_0 strand UVs (metres), TEXCOORD_1 (fur length,
zone/8), TEXCOORD_2/3 comb direction (glTF space), COLOR_0 coat colour.
Frame: forward = -Y, up = Z (glTF: +Z forward, +Y up); the paws stand on z = 0.
usage: python build_cat.py <out.glb> [--preview out.png]"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector
from sdf_sculpt import Sculpt

OUT = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
S = Sculpt((-0.09, -0.36, -0.004), (0.09, 0.5, 0.36), 0.0021)
def T(zone, fur, comb): return dict(zone=zone, fur=fur, comb=Vector(comb).normalized())
BODY, BELLY, HEAD, TAIL, EAR, CLAW, NOSE, LIMB = 0, 1, 2, 3, 4, 5, 6, 7
back = (0, 1, -0.15)
# torso: withers to rump, a deep chest, the belly and its loose skin, shoulder blades, haunches
spine = [(0, -0.13, 0.2), (0, -0.04, 0.197), (0, 0.05, 0.198), (0, 0.13, 0.196), (0, 0.18, 0.19)]
S.chain(spine, [0.056, 0.058, 0.056, 0.057, 0.052], k=0.022, tag=T(BODY, 1.0, back))
S.ellipsoid((0, -0.115, 0.158), (0.047, 0.07, 0.066), k=0.02, tag=T(BELLY, 0.9, (0, 0.6, -1)))
S.ellipsoid((0, 0.03, 0.15), (0.052, 0.12, 0.056), k=0.025, tag=T(BELLY, 1.1, (0, 0.4, -1)))
S.ellipsoid((0, 0.11, 0.137), (0.04, 0.05, 0.03), k=0.02, tag=T(BELLY, 1.2, (0, 0.3, -1)))
for s in (-1, 1):
    S.ellipsoid((s * 0.03, -0.125, 0.192), (0.022, 0.045, 0.05), (0.35, 0, 0), k=0.015, tag=T(BODY, 0.9, (0, 0.6, -0.6)))     # shoulder blade
    S.ellipsoid((s * 0.036, 0.15, 0.158), (0.028, 0.055, 0.062), (-0.3, 0, 0), k=0.02, tag=T(BODY, 1.0, (0, 0.5, -0.8)))     # haunch
    # foreleg: upper arm back to the elbow, forearm down to the wrist, the paw and its toes
    sh, el, wr = (s * 0.034, -0.145, 0.155), (s * 0.033, -0.118, 0.098), (s * 0.03, -0.13, 0.03)
    S.capsule(sh, el, 0.024, 0.019, k=0.012, tag=T(LIMB, 0.7, (0, 0.3, -1)))
    S.capsule(el, wr, 0.0175, 0.0135, k=0.006, tag=T(LIMB, 0.5, (0, -0.1, -1)))
    S.ellipsoid((s * 0.03, -0.143, 0.0135), (0.019, 0.024, 0.0135), k=0.006, tag=T(LIMB, 0.35, (0, -1, -0.3)))
    for i in range(4):
        S.ellipsoid((s * 0.029 + (i - 1.5) * 0.0085, -0.16 + abs(i - 1.5) * 0.003, 0.009), (0.006, 0.0075, 0.0075), k=0.003, tag=T(LIMB, 0.25, (0, -1, 0)))
    # hind leg: thigh down to the knee, shin back to the hock, the long foot down to the paw
    hp, kn, ho = (s * 0.04, 0.15, 0.16), (s * 0.043, 0.105, 0.095), (s * 0.038, 0.19, 0.06)
    S.capsule(hp, kn, 0.03, 0.02, k=0.014, tag=T(LIMB, 0.8, (0, 0.4, -1)))
    S.capsule(kn, ho, 0.018, 0.013, k=0.006, tag=T(LIMB, 0.55, (0, 0.6, -0.8)))
    S.capsule(ho, (s * 0.035, 0.172, 0.014), 0.0125, 0.0115, k=0.004, tag=T(LIMB, 0.4, (0, -0.2, -1)))
    S.ellipsoid((s * 0.035, 0.162, 0.0135), (0.018, 0.026, 0.0135), k=0.006, tag=T(LIMB, 0.35, (0, -1, -0.3)))
    for i in range(4):
        S.ellipsoid((s * 0.035 + (i - 1.5) * 0.008, 0.143 + abs(i - 1.5) * 0.003, 0.009), (0.0058, 0.0072, 0.0072), k=0.003, tag=T(LIMB, 0.25, (0, -1, 0)))
# neck and head
hc = Vector((0, -0.228, 0.25))
S.capsule((0, -0.13, 0.2), (0, -0.2, 0.238), 0.054, 0.046, k=0.026, tag=T(BODY, 1.1, (0, 1, -0.4)))
S.ellipsoid(tuple(hc), (0.047, 0.045, 0.041), k=0.012, tag=T(HEAD, 0.5, (0, 1, 0.1)))
for s in (-1, 1): S.ellipsoid((s * 0.03, -0.248, 0.237), (0.025, 0.022, 0.022), k=0.01, tag=T(HEAD, 0.6, (s * 0.6, 1, -0.2)))   # cheeks
S.ellipsoid((0, -0.268, 0.235), (0.018, 0.016, 0.0145), k=0.008, tag=T(HEAD, 0.3, (0, 1, 0)))                                     # muzzle
for s in (-1, 1): S.ellipsoid((s * 0.0098, -0.277, 0.232), (0.011, 0.0095, 0.0098), k=0.004, tag=T(HEAD, 0.25, (s, 0.4, 0)))     # whisker pads
S.ellipsoid((0, -0.27, 0.218), (0.0095, 0.01, 0.0075), k=0.005, tag=T(BELLY, 0.4, (0, 0.5, -1)))                                 # chin
S.ellipsoid((0, -0.284, 0.244), (0.0058, 0.0042, 0.0045), k=0.003, tag=T(NOSE, 0.0, (0, -1, 0)))                                  # nose leather
S.ellipsoid((0, -0.2855, 0.2345), (0.0007, 0.003, 0.004), k=0.0012, op='sub')                                                     # philtrum
S.ellipsoid((0, -0.277, 0.224), (0.011, 0.006, 0.0012), k=0.0012, op='sub')                                                       # mouth line
for s in (-1, 1):
    S.ellipsoid((s * 0.021, -0.262, 0.258), (0.0098, 0.0058, 0.008), k=0.003, op='sub')                                          # eye socket
    base, tip = Vector((s * 0.031, -0.224, 0.282)), Vector((s * 0.043, -0.218, 0.314))
    S.capsule(tuple(base), tuple(tip), 0.0155, 0.0028, k=0.007, tag=T(EAR, 0.25, (0, 0, 1)))
    S.ellipsoid(tuple(base.lerp(tip, 0.42) + Vector((0, -0.009, 0))), (0.0095, 0.004, 0.015), k=0.002, op='sub')                  # the ear's hollow
# the tail, carried low behind
tail = [(0, 0.18, 0.19), (0, 0.235, 0.188), (0, 0.29, 0.172), (0, 0.345, 0.15), (0, 0.395, 0.132), (0, 0.44, 0.122), (0, 0.475, 0.12)]
for i in range(len(tail) - 1):
    a, b = Vector(tail[i]), Vector(tail[i + 1])
    S.capsule(tail[i], tail[i + 1], 0.018 - 0.0012 * i, 0.018 - 0.0012 * (i + 1), k=0.008, tag=T(TAIL, 1.25, tuple(b - a)))

V, F = S.mesh()
me = bpy.data.meshes.new('cat_body'); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.validate(); me.update()
body = bpy.data.objects.new('cat_body', me); bpy.context.scene.collection.objects.link(body)
bpy.context.view_layer.objects.active = body; body.select_set(True)
m = body.modifiers.new('dc', 'DECIMATE'); m.ratio = min(1.0, 16000 / len(me.polygons)); bpy.ops.object.modifier_apply(modifier='dc')
me = body.data
for p in me.polygons: p.use_smooth = True
print('cat tris', len(me.polygons))
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

# the coat: brown mackerel tabby; white chest, belly, chin, muzzle and paws
P = np.array([tuple(v.co) for v in me.vertices], np.float32)
tags, dist, idx = S.nearest_tags(P)
furl = me.uv_layers.new(name='Fur'); cA = me.uv_layers.new(name='CombXY'); cB = me.uv_layers.new(name='CombZ')
col = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
def srgb(c): return tuple(max(0.0, x) ** 2.2 for x in c)
rng = np.random.default_rng(3)
ground = Vector((0.62, 0.53, 0.42)); dark = Vector((0.12, 0.095, 0.075)); white = Vector((0.94, 0.93, 0.9))
def noise(x, y, z): return 0.5 * math.sin(x * 61 + z * 37) + 0.3 * math.sin(y * 47 + x * 23) + 0.2 * math.sin(z * 83 + y * 29)
vdat = []
for i, v in enumerate(me.vertices):
    tg = tags[i]; z = tg['zone']; fl = tg['fur']; comb = tg['comb'].copy(); n = v.normal; co = v.co
    c = ground * (0.86 + 0.14 * max(0.0, n.z))
    side = abs(co.x)
    if z == BODY:
        # stripes run down the flanks from the dark spine line, a little wavy
        s_ = math.sin(co.y * 150 + noise(co.x, co.y, co.z) * 1.6 + side * 30)
        if s_ > 0.42: c = c.lerp(dark, min(1.0, (s_ - 0.42) * 2.5) * (0.8 if n.z > -0.3 else 0.3))
        c = c * (0.9 + 0.12 * math.sin(co.x * 400 + co.y * 330 + co.z * 270))                                           # agouti flecks
        if co.z > 0.235 and side < 0.022: c = c.lerp(dark, 0.85)
    if z == LIMB:
        if math.sin(co.z * 120 + noise(co.x, co.y, co.z)) > 0.45 and co.z > 0.04: c = c.lerp(dark, 0.7)
        if co.z < 0.035: c = white
    if z == TAIL:
        if math.sin(co.y * 75) > 0.15: c = c.lerp(dark, 0.85)
        if co.y > 0.44: c = dark
    if z == HEAD:
        rel = co - hc
        if rel.z > 0.024 and abs(rel.x) < 0.024 and math.sin(rel.x * 230) > 0.15: c = c.lerp(dark, 0.8)                         # the "M"
        if rel.z > 0.0 and abs(rel.x) > 0.02 and abs(rel.x) < 0.04 and math.sin(rel.y * 300 + rel.z * 120) > 0.5: c = c.lerp(dark, 0.6)   # cheek lines
        if co.y < -0.262 and co.z < 0.238: c = white
    under = max(0.0, min(1.0, (-n.z - 0.6) * 3.0))
    if z == BELLY: under = max(under, 0.85)
    if co.y < -0.13 and co.z < 0.19 and co.z > 0.1 and n.y < -0.3: under = max(under, 0.8)                                    # white bib
    c = c.lerp(white, under)
    if z == EAR: c = Vector((0.55, 0.42, 0.38)) if n.y < -0.3 else dark.lerp(ground, 0.35)
    if z == NOSE: c = Vector((0.78, 0.46, 0.45))
    c = c * (0.93 + 0.12 * rng.random())
    vdat.append((fl, z, comb, srgb(c)))
for li, loop in enumerate(me.loops):
    fl, z, comb, c = vdat[loop.vertex_index]
    furl.data[li].uv = (fl, z / 8.0)
    gx, gy, gz = comb.x, comb.z, -comb.y
    cA.data[li].uv = (gx, gy); cB.data[li].uv = (gz, 0.0)
    col.data[li].color = (c[0], c[1], c[2], 1.0)
me.color_attributes.active_color = col
body.data.materials.clear(); body.data.materials.append(bpy.data.materials.new('Fur'))

# the skeleton
arm_d = bpy.data.armatures.new('cat_rig'); rig = bpy.data.objects.new('cat_rig', arm_d); bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig; bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_d.edit_bones
def bone(name, h, t, parent=None, connect=False):
    b = eb.new(name); b.head = h; b.tail = t
    if parent: b.parent = eb[parent]; b.use_connect = connect
    return b
bone('root', (0, 0.02, 0.0), (0, -0.04, 0.0))
bone('pelvis', (0, 0.17, 0.19), (0, 0.06, 0.197), 'root')
bone('spine', (0, 0.06, 0.197), (0, -0.05, 0.198), 'pelvis', True)
bone('chest', (0, -0.05, 0.198), (0, -0.14, 0.2), 'spine', True)
bone('neck', (0, -0.14, 0.2), (0, -0.2, 0.238), 'chest', True)
bone('head', (0, -0.2, 0.238), (0, -0.286, 0.25), 'neck', True)
for s, sfx in ((1, 'L'), (-1, 'R')):
    bone('ear.' + sfx, (s * 0.031, -0.224, 0.282), (s * 0.043, -0.218, 0.314), 'head')
    bone('arm.' + sfx, (s * 0.034, -0.145, 0.155), (s * 0.032, -0.115, 0.1), 'chest')
    bone('fore.' + sfx, (s * 0.032, -0.115, 0.1), (s * 0.029, -0.13, 0.03), 'arm.' + sfx, True)
    bone('hand.' + sfx, (s * 0.029, -0.13, 0.03), (s * 0.029, -0.165, 0.008), 'fore.' + sfx, True)
    bone('thigh.' + sfx, (s * 0.04, 0.15, 0.16), (s * 0.043, 0.105, 0.095), 'pelvis')
    bone('shin.' + sfx, (s * 0.043, 0.105, 0.095), (s * 0.038, 0.19, 0.06), 'thigh.' + sfx, True)
    bone('foot.' + sfx, (s * 0.038, 0.19, 0.06), (s * 0.035, 0.168, 0.012), 'shin.' + sfx, True)
    bone('toe.' + sfx, (s * 0.035, 0.168, 0.012), (s * 0.035, 0.138, 0.008), 'foot.' + sfx, True)
prev = 'pelvis'
for i in range(5):
    bone('tail%d' % i, tail[i], tail[i + 1] if i < 4 else tail[6], prev, i > 0); prev = 'tail%d' % i
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print('skinned', len(body.vertex_groups), 'groups')

if '--preview' in sys.argv:
    out = sys.argv[sys.argv.index('--preview') + 1]
    mt = body.data.materials[0]; mt.use_nodes = True; nt = mt.node_tree
    a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'; nt.links.new(a.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.render.resolution_x, sc.render.resolution_y = 900, 600
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sun = bpy.data.objects.new('s', bpy.data.lights.new('s', 'SUN')); sun.data.energy = 3; sc.collection.objects.link(sun); sun.rotation_euler = (0.7, 0.2, 0.8)
    cam = bpy.data.objects.new('c', bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0.62, -0.5, 0.3); cam.rotation_euler = (Vector((0, -0.02, 0.15)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = 50
    sc.render.filepath = out; bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True, export_skins=True,
                          export_normals=True, export_vertex_color='ACTIVE', export_texcoords=True, export_animations=False)
print('exported', OUT, round(os.path.getsize(OUT) / 1e3), 'kB')
