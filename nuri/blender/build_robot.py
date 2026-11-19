"""Builds the original player robot "Nuri" (v2, mechanical hard-surface design) in Blender.
Painted-metal armor plates over an anodized frame, servo housings, clevis hinge joints, pistons,
cable hoses, bolts, vents and a sensor visor. Rigid parts are bone-parented; scarf tails are skinned.

usage: python build_robot.py <out_dir> [--q 0.5]   (q scales mesh density, 1.0 = film quality)
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from common import *

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
Q = float(sys.argv[sys.argv.index('--q') + 1]) if '--q' in sys.argv else 1.0
os.makedirs(OUT, exist_ok=True)
reset_scene()
col = bpy.data.collections.new('Nuri'); bpy.context.scene.collection.children.link(col)
PI = math.pi
def n(k):  # segment count scaled by quality
    return max(6, int(round(k * Q)))

# ------------------------------------------------------------------ face texture (rest expression)
def draw_face(w=512, h=320):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    img = np.zeros((h, w), np.float32)
    cx, cy, sep = w / 2, h * 0.5, w * 0.19
    for s in (-1, 1):
        ex = cx + s * sep
        d = ((xx - ex) / 40) ** 2 + ((yy - cy) / 52) ** 2
        img = np.maximum(img, np.clip((1 - d) * 6, 0, 1))
    glow = img.copy()
    for _ in range(4):
        glow = (np.roll(glow, 3, 0) + np.roll(glow, -3, 0) + np.roll(glow, 3, 1) + np.roll(glow, -3, 1) + glow) / 5
    dots = ((np.sin(xx * PI / 5) ** 2) * (np.sin(yy * PI / 5) ** 2)) ** 0.35
    scan = 0.92 + 0.08 * np.sin(yy * PI / 2.5)
    v = (img * (0.3 + 0.7 * dots) + glow * 0.3) * scan
    rgb = np.stack([v * 0.1, v * 0.82, v * 1.0], -1)
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1), np.float32)], -1)
    im = bpy.data.images.new('NuriFace', w, h, alpha=True)
    im.pixels.foreach_set(rgba[::-1].ravel()); im.pack()
    return im
face_img = draw_face()

# ------------------------------------------------------------------ materials
def link_(m, a, b):
    m.node_tree.links.new(a, b)

def painted_metal(name, paint_hex, rough=0.4, wear=0.55):
    """Painted metal: orange-peel micro bump, cavity grime, edge wear exposing aluminium, fine scratches."""
    m = principled(name, srgb(paint_hex), rough=rough, coat=0.15, coat_rough=0.2)
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-1600, 0))
    geo = node(m, 'ShaderNodeNewGeometry', (-1600, 400))
    aoi = node(m, 'ShaderNodeAmbientOcclusion', (-1500, 550)); aoi.inside = True; aoi.only_local = True; aoi.samples = 8
    aoi.inputs['Distance'].default_value = 0.004
    pr = node(m, 'ShaderNodeMapRange', (-1300, 500)); pr.inputs['From Min'].default_value = 0.92; pr.inputs['From Max'].default_value = 0.55
    link_(m, aoi.outputs['AO'], pr.inputs['Value'])
    nz = node(m, 'ShaderNodeTexNoise', (-1300, 250)); nz.inputs['Scale'].default_value = 260; nz.inputs['Detail'].default_value = 8; nz.inputs['Roughness'].default_value = 0.7
    link_(m, tc.outputs['Object'], nz.inputs['Vector'])
    mul = node(m, 'ShaderNodeMath', (-1050, 450)); mul.operation = 'MULTIPLY'
    link_(m, pr.outputs['Result'], mul.inputs[0]); link_(m, nz.outputs['Fac'], mul.inputs[1])
    wm = node(m, 'ShaderNodeMapRange', (-850, 450)); wm.inputs['From Min'].default_value = 0.3; wm.inputs['From Max'].default_value = 0.42
    link_(m, mul.outputs[0], wm.inputs['Value'])
    ao = node(m, 'ShaderNodeAmbientOcclusion', (-1300, 800)); ao.inputs['Distance'].default_value = 0.006; ao.samples = 8
    paint = node(m, 'ShaderNodeMix', (-850, 750)); paint.data_type = 'RGBA'
    paint.inputs['A'].default_value = (*[c * 0.28 for c in srgb(paint_hex)], 1); paint.inputs['B'].default_value = (*srgb(paint_hex), 1)
    g = node(m, 'ShaderNodeMath', (-1050, 800)); g.operation = 'POWER'; g.inputs[1].default_value = 0.7
    link_(m, ao.outputs['AO'], g.inputs[0]); link_(m, g.outputs[0], paint.inputs['Factor'])
    mp = node(m, 'ShaderNodeMapping', (-1300, -300)); mp.inputs['Scale'].default_value = (900, 25, 25)
    link_(m, tc.outputs['Object'], mp.inputs['Vector'])
    sn = node(m, 'ShaderNodeTexNoise', (-1100, -300)); sn.inputs['Scale'].default_value = 1; sn.inputs['Detail'].default_value = 2
    link_(m, mp.outputs['Vector'], sn.inputs['Vector'])
    sr = node(m, 'ShaderNodeMapRange', (-900, -300)); sr.inputs['From Min'].default_value = 0.72; sr.inputs['From Max'].default_value = 0.78
    link_(m, sn.outputs['Fac'], sr.inputs['Value'])
    scr = node(m, 'ShaderNodeMath', (-700, -300)); scr.operation = 'MULTIPLY'; scr.inputs[1].default_value = 0.35
    link_(m, sr.outputs['Result'], scr.inputs[0])
    wear_all = node(m, 'ShaderNodeMath', (-650, 450)); wear_all.operation = 'MAXIMUM'
    link_(m, wm.outputs['Result'], wear_all.inputs[0]); link_(m, scr.outputs[0], wear_all.inputs[1])
    col_mix = node(m, 'ShaderNodeMix', (-450, 600)); col_mix.data_type = 'RGBA'
    col_mix.inputs['B'].default_value = (*srgb('#a9adb3'), 1)
    link_(m, wear_all.outputs[0], col_mix.inputs['Factor']); link_(m, paint.outputs['Result'], col_mix.inputs['A'])
    link_(m, col_mix.outputs['Result'], bsdf.inputs['Base Color'])
    link_(m, wear_all.outputs[0], bsdf.inputs['Metallic'])
    rn = node(m, 'ShaderNodeTexNoise', (-1100, 100)); rn.inputs['Scale'].default_value = 40
    link_(m, tc.outputs['Object'], rn.inputs['Vector'])
    rr = node(m, 'ShaderNodeMapRange', (-900, 100)); rr.inputs['To Min'].default_value = rough - 0.07; rr.inputs['To Max'].default_value = rough + 0.1
    link_(m, rn.outputs['Fac'], rr.inputs['Value'])
    rmix = node(m, 'ShaderNodeMix', (-450, 200)); rmix.data_type = 'FLOAT'; rmix.inputs['B'].default_value = 0.28
    link_(m, wear_all.outputs[0], rmix.inputs['Factor']); link_(m, rr.outputs['Result'], rmix.inputs['A'])
    link_(m, rmix.outputs['Result'], bsdf.inputs['Roughness'])
    op = node(m, 'ShaderNodeTexNoise', (-1100, -600)); op.inputs['Scale'].default_value = 1400; op.inputs['Detail'].default_value = 1
    link_(m, tc.outputs['Object'], op.inputs['Vector'])
    hsum = node(m, 'ShaderNodeMath', (-800, -600)); hsum.operation = 'MULTIPLY_ADD'; hsum.inputs[1].default_value = 0.15
    link_(m, op.outputs['Fac'], hsum.inputs[0]); link_(m, wear_all.outputs[0], hsum.inputs[2])
    neg = node(m, 'ShaderNodeMath', (-650, -600)); neg.operation = 'MULTIPLY'; neg.inputs[1].default_value = -1
    link_(m, hsum.outputs[0], neg.inputs[0])
    bump = node(m, 'ShaderNodeBump', (-400, -500)); bump.inputs['Strength'].default_value = 0.25; bump.inputs['Distance'].default_value = 0.0003
    link_(m, neg.outputs[0], bump.inputs['Height']); link_(m, bump.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def anodized(name, hex_, rough=0.42, aniso=0.6):
    m = principled(name, srgb(hex_), rough=rough, metal=1.0)
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    if 'Anisotropic' in bsdf.inputs:
        bsdf.inputs['Anisotropic'].default_value = aniso
    tc = node(m, 'ShaderNodeTexCoord', (-1000, 0))
    mp = node(m, 'ShaderNodeMapping', (-850, 0)); mp.inputs['Scale'].default_value = (1, 1, 300)
    link_(m, tc.outputs['Object'], mp.inputs['Vector'])
    nz = node(m, 'ShaderNodeTexNoise', (-700, 0)); nz.inputs['Scale'].default_value = 50
    link_(m, mp.outputs['Vector'], nz.inputs['Vector'])
    mr = node(m, 'ShaderNodeMapRange', (-500, 0)); mr.inputs['To Min'].default_value = rough - 0.08; mr.inputs['To Max'].default_value = rough + 0.08
    link_(m, nz.outputs['Fac'], mr.inputs['Value']); link_(m, mr.outputs['Result'], bsdf.inputs['Roughness'])
    ao = node(m, 'ShaderNodeAmbientOcclusion', (-700, 300)); ao.inputs['Distance'].default_value = 0.008
    mix = node(m, 'ShaderNodeMix', (-450, 300)); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*[c * 0.4 for c in srgb(hex_)], 1); mix.inputs['B'].default_value = (*srgb(hex_), 1)
    link_(m, ao.outputs['AO'], mix.inputs['Factor']); link_(m, mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m

def knit_material():
    m = principled('Nuri_Scarf', srgb('#1d4cb3'), rough=0.85, sheen=0.8, sheen_tint=(*srgb('#9cc0ff'), 1))
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    tc = node(m, 'ShaderNodeTexCoord', (-1100, 0))
    wv = node(m, 'ShaderNodeTexWave', (-800, -100)); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
    wv.inputs['Scale'].default_value = 70; wv.inputs['Distortion'].default_value = 1.5; wv.inputs['Detail'].default_value = 2
    link_(m, tc.outputs['UV'], wv.inputs['Vector'])
    vn = node(m, 'ShaderNodeTexVoronoi', (-800, 200)); vn.inputs['Scale'].default_value = 260
    link_(m, tc.outputs['Object'], vn.inputs['Vector'])
    add = node(m, 'ShaderNodeMath', (-600, 0)); add.operation = 'ADD'
    link_(m, wv.outputs['Fac'], add.inputs[0]); link_(m, vn.outputs['Distance'], add.inputs[1])
    bump = node(m, 'ShaderNodeBump', (-400, -100)); bump.inputs['Strength'].default_value = 0.7; bump.inputs['Distance'].default_value = 0.001
    link_(m, add.outputs[0], bump.inputs['Height']); link_(m, bump.outputs['Normal'], bsdf.inputs['Normal'])
    mix = node(m, 'ShaderNodeMix', (-400, 300)); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*srgb('#143a8c'), 1); mix.inputs['B'].default_value = (*srgb('#2a5cc8'), 1)
    link_(m, wv.outputs['Fac'], mix.inputs['Factor']); link_(m, mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m

def screen_material():
    m = principled('Nuri_Screen', (0.002, 0.003, 0.004), rough=0.05, coat=1.0, coat_rough=0.02)
    nt = m.node_tree; bsdf = nt.nodes['Principled BSDF']
    tex = node(m, 'ShaderNodeTexImage', (-500, -200)); tex.image = face_img
    link_(m, tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 5.0
    return m

M = {
    'paint': painted_metal('Nuri_PaintWhite', '#dedbd3', 0.42),
    'teal': painted_metal('Nuri_PaintTeal', '#07839b', 0.38),
    'frame': anodized('Nuri_FrameGraphite', '#2b3037', 0.45),
    'alu': anodized('Nuri_Aluminium', '#c7cacf', 0.24, 0.3),
    'glow': principled('Nuri_Glow', srgb('#0a2a33'), rough=0.3, emission=srgb('#4fe8ff'), estr=10.0),
    'rubber': principled('Nuri_Rubber', srgb('#16181b'), rough=0.85),
    'glass': principled('Nuri_LensGlass', (0.01, 0.012, 0.015), rough=0.02, coat=1.0),
    'scarf': knit_material(),
    'screen': screen_material(),
    'decal': principled('Nuri_Decal', srgb('#3a3f45'), rough=0.5),
}

# ------------------------------------------------------------------ construction helpers (game coords)
parts = []
def P(ob, bone, mat):
    if ob.type == 'MESH':
        ob.data.materials.clear(); ob.data.materials.append(M[mat])
    parts.append((ob, bone)); return ob

AX = {'x': (0, PI / 2, 0), 'y': (0, 0, 0), 'z': (PI / 2, 0, 0)}
def cyl(name, c, r, depth, axis='y', verts=32, bone='spine', mat='frame', bevel=0.0012, segs=2, r2=None):
    if r2 is None:
        ob = prim('cyl', name, loc=B(*c), rot=AX[axis], vertices=n(verts), radius=r, depth=depth, coll=col)
    else:
        ob = prim('cone', name, loc=B(*c), rot=AX[axis], vertices=n(verts), radius1=r, radius2=r2, depth=depth, coll=col)
    if bevel: add_bevel(ob, bevel, segs, 30)
    smooth(ob)
    return P(ob, bone, mat)

def box(name, c, size, bone='spine', mat='frame', bevel=0.0015, segs=3, rot=(0, 0, 0)):
    ob = prim('cube', name, loc=B(*c), coll=col, size=1)
    ob.scale = (size[0], size[2], size[1])
    ob.rotation_euler = rot
    if bevel: add_bevel(ob, bevel, segs, 40)
    return P(ob, bone, mat)

def ball(name, c, r, bone, mat='frame', segs=32):
    ob = prim('sphere', name, loc=B(*c), segments=n(segs), ring_count=n(segs // 2), radius=r, coll=col)
    smooth(ob); return P(ob, bone, mat)

def strut(name, p0, p1, r, bone, mat='alu', verts=16):
    a, b = Vector(B(*p0)), Vector(B(*p1))
    d = b - a
    ob = prim('cyl', name, loc=(a + b) / 2, vertices=n(verts), radius=r, depth=d.length, coll=col)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    smooth(ob); return P(ob, bone, mat)

def bolt(c, axis, bone, r=0.0019):
    cyl('Bolt', c, r, 0.0016, axis, 6, bone, 'alu', bevel=0.0004, segs=1)

def ring(name, c, R, r, axis, bone, mat, seg=48):
    ob = prim('torus', name, loc=B(*c), rot=AX[axis], major_radius=R, minor_radius=r, major_segments=n(seg), minor_segments=n(10), coll=col)
    smooth(ob); return P(ob, bone, mat)

def cut(target, cutters):
    for c in cutters:
        m = target.modifiers.new('Cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = c; m.solver = 'EXACT'
    apply_modifiers(target)
    for c in cutters:
        bpy.data.objects.remove(c)
    smooth(target)

def cutter_box(c, size, rot=(0, 0, 0)):
    ob = prim('cube', 'cutter', loc=B(*c), coll=col, size=1); ob.scale = (size[0], size[2], size[1]); ob.rotation_euler = rot
    return ob

def text(name, s, c, size, rot, bone, mat='decal'):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = s; cu.size = size; cu.extrude = 0.00025
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name, cu); col.objects.link(ob); ob.location = B(*c); ob.rotation_euler = rot
    ob = to_mesh(ob)
    return P(ob, bone, mat)

def shell(name, rx, ry, rz, e1, e2, nu, nv, center, bone, mat='paint', **kw):
    ob = superellipsoid(name, rx, ry, rz, e1, e2, n(nu), n(nv), center=center, coll=col, **kw)
    return P(ob, bone, mat)

# ================================================================== BODY
shell('Pelvis', 0.044, 0.02, 0.038, 0.45, 0.55, 48, 20, (0, 0.104, 0), 'hips', 'frame')
for s in (1, -1):
    cyl('HipServo', (s * 0.036, 0.104, 0), 0.016, 0.014, 'x', 40, 'hips', 'frame')
    ring('HipBearing', (s * 0.044, 0.104, 0), 0.0135, 0.0018, 'x', 'hips', 'alu', 32)
cyl('WaistShaft', (0, 0.119, 0), 0.03, 0.014, 'y', 48, 'spine', 'frame')
cyl('WaistGear', (0, 0.124, 0), 0.036, 0.006, 'y', 64, 'spine', 'alu', bevel=0.0006, segs=1)
for i in range(n(36)):
    a = i / n(36) * 2 * PI
    box('GearTooth', (math.sin(a) * 0.0372, 0.124, math.cos(a) * 0.0372), (0.0032, 0.0058, 0.003), 'spine', 'alu', bevel=0.0004, segs=1, rot=(0, 0, -a))

shell('TorsoFrame', 0.06, 0.05, 0.05, 0.5, 0.6, 48, 28, (0, 0.165, 0), 'spine', 'frame')
chest = superellipsoid('ChestArmor', 0.066, 0.056, 0.057, 0.62, 0.7, n(96), n(56), center=(0, 0.164, 0.004), coll=col, taper=0.1,
    grooves=[{'kind': 'v', 'at': -0.45, 'w': 0.03, 'd': 0.0026},
             {'kind': 'u', 'at': 0.5 * PI, 'from': -0.45, 'to': 1.0, 'w': 0.024, 'd': 0.0026},
             {'kind': 'u', 'at': -0.5 * PI, 'from': -0.45, 'to': 1.0, 'w': 0.024, 'd': 0.0026},
             {'kind': 'v', 'at': 0.62, 'from': -0.5 * PI, 'to': 0.5 * PI, 'w': 0.03, 'd': 0.0024}])
cut(chest, [cutter_box((s * 0.07, 0.16, -0.004), (0.03, 0.05, 0.034)) for s in (1, -1)])
P(chest, 'spine', 'paint')
for s in (1, -1):
    for k in range(4):
        box('SideVent', (s * 0.056, 0.148 + k * 0.0075, -0.004), (0.004, 0.0028, 0.03), 'spine', 'frame', bevel=0.0008, segs=2)
    box('SideVentGlow', (s * 0.053, 0.159, -0.004), (0.002, 0.026, 0.026), 'spine', 'glow', bevel=0)
hexb = cyl('ChestBezel', (0, 0.172, 0.0622), 0.0225, 0.006, 'z', 6, 'spine', 'teal', bevel=0.0014, segs=3)
hexb.rotation_mode = 'ZXY'; hexb.rotation_euler = (PI / 2 - 0.2, 0, PI / 6)
hexl = cyl('ChestCore', (0, 0.1722, 0.0648), 0.0165, 0.003, 'z', 6, 'spine', 'glow', bevel=0.001)
hexl.rotation_mode = 'ZXY'; hexl.rotation_euler = (PI / 2 - 0.2, 0, PI / 6)
for i in range(6):
    a = i / 6 * 2 * PI + PI / 6
    b = cyl('ChestBolt', (math.cos(a) * 0.0196, 0.172 + math.sin(a) * 0.0196, 0.0657 - math.sin(a) * 0.004), 0.0016, 0.0016, 'z', 6, 'spine', 'alu', bevel=0.0003, segs=1)
    b.rotation_euler = (PI / 2 - 0.2, 0, 0)
box('BatteryPack', (0, 0.164, -0.054), (0.062, 0.058, 0.02), 'spine', 'paint', bevel=0.006, segs=4)
box('BatteryFrame', (0, 0.164, -0.0445), (0.05, 0.05, 0.006), 'spine', 'frame', bevel=0.002)
for k in range(4):
    box('PackVent', (0, 0.148 + k * 0.008, -0.0642), (0.04, 0.003, 0.0016), 'spine', 'frame', bevel=0.0007, segs=2)
box('PackGlow', (0, 0.18, -0.0642), (0.03, 0.0035, 0.0012), 'spine', 'glow', bevel=0.0005, segs=1)
strut('PackHandle', (-0.02, 0.194, -0.06), (0.02, 0.194, -0.06), 0.0026, 'spine', 'frame')
for s in (1, -1):
    strut('PackHandleLeg', (s * 0.02, 0.19, -0.058), (s * 0.02, 0.194, -0.06), 0.0026, 'spine', 'frame')
    for sy in (1, -1):
        bolt((s * 0.027, 0.164 + sy * 0.024, -0.0643), 'z', 'spine')
text('Label', 'NR-01', (0, 0.135, -0.0647), 0.0085, (PI / 2, 0, PI), 'spine', 'decal')
for (u, v) in ((0.35, 0.35), (-0.35, 0.35), (0.35, -0.25), (-0.35, -0.25), (0.78, 0.25), (-0.78, 0.25)):
    x, y, z = se_point(0.066, 0.056, 0.057, 0.62, 0.7, u, v, 0.1)
    p = Vector(B(x, y + 0.164, z + 0.004)); d = Vector(B(x, y, z)).normalized()
    bt = prim('cyl', 'ArmorBolt', loc=p + d * 0.0004, vertices=6, radius=0.0017, depth=0.0014, coll=col)
    bt.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); P(bt, 'spine', 'alu')
text('ChestText', 'N-01  UNIT', (0.036, 0.137, 0.0525), 0.0042, (PI / 2 - 0.25, 0, 0.35), 'spine', 'decal')

cyl('NeckColumn', (0, 0.212, 0), 0.016, 0.03, 'y', 32, 'neck', 'frame')
for k in range(3):
    ring('NeckRib', (0, 0.202 + k * 0.008, 0), 0.0165, 0.0018, 'y', 'neck', 'alu', 32)
for s in (1, -1):
    strut('NeckSleeve', (s * 0.022, 0.198, 0.012), (s * 0.02, 0.212, 0.01), 0.0034, 'neck', 'frame')
    strut('NeckRod', (s * 0.02, 0.21, 0.01), (s * 0.018, 0.228, 0.008), 0.0019, 'neck', 'alu')
hose_pts = []
for k in range(33):
    t = k / 32
    hose_pts.append(B(0.006 * math.sin(t * 3), 0.19 + t * 0.048, -0.026 - 0.008 * math.sin(t * PI)))
P(tube_from_points('CableHose', hose_pts, 0.0042, res=n(4), coll=col), 'neck', 'rubber')
for k in range(9):
    t = 0.1 + k * 0.1
    ring('HoseRib', (0.006 * math.sin(t * 3), 0.19 + t * 0.048, -0.026 - 0.008 * math.sin(t * PI)), 0.0044, 0.0011, 'y', 'neck', 'rubber', 16)
col_t = prim('torus', 'ScarfCollar', loc=B(0, 0.2, -0.002), major_radius=0.039, minor_radius=0.0115, major_segments=n(64), minor_segments=n(20), coll=col)
col_t.scale = (1.05, 1.0, 0.95); smooth(col_t); P(col_t, 'neck', 'scarf')
knot = prim('sphere', 'ScarfKnot', loc=B(0, 0.198, -0.044), segments=n(32), ring_count=n(16), radius=0.014, coll=col)
knot.scale = (1.25, 0.8, 0.9); smooth(knot); P(knot, 'neck', 'scarf')

HEAD_C = (0, 0.292, 0)
HS = (0.101, 0.08, 0.086, 0.55, 0.6, -0.06, 0.04)
head = superellipsoid('HeadShell', *HS[:5], n(140), n(96), taper=HS[5], front=HS[6],
    grooves=[{'kind': 'v', 'at': 0.12, 'from': 0.56 * PI, 'to': -0.56 * PI, 'w': 0.02, 'd': 0.0028},
             {'kind': 'u', 'at': 0.0, 'from': 0.66, 'to': 1.6, 'w': 0.018, 'd': 0.0024},
             {'kind': 'v', 'at': 0.66, 'from': -0.56 * PI, 'to': 0.56 * PI, 'w': 0.018, 'd': 0.0024},
             {'kind': 'u', 'at': 0.56 * PI, 'from': -0.75, 'to': 1.2, 'w': 0.016, 'd': 0.0026},
             {'kind': 'u', 'at': -0.56 * PI, 'from': -0.75, 'to': 1.2, 'w': 0.016, 'd': 0.0026},
             {'kind': 'v', 'at': -0.78, 'from': -PI, 'to': PI, 'w': 0.024, 'd': 0.0026}],
    center=HEAD_C, coll=col)
cutters = []
for s in (1, -1):
    for k in range(5):
        cutters.append(cutter_box((s * 0.1, 0.27 + k * 0.0065, -0.042), (0.03, 0.0026, 0.022)))
cut(head, cutters)
P(head, 'head', 'paint')
for s in (1, -1):
    box('GrilleBack', (s * 0.088, 0.283, -0.042), (0.012, 0.036, 0.026), 'head', 'frame', bevel=0.001)
screen, border = squircle_patch('FaceScreen', HS, 0.78, 0.5, -0.07, 1.006, seg=n(64), coll=col, center=HEAD_C)
P(screen, 'head', 'screen')
P(tube_from_points('VisorHousing', border, 0.0058, cyclic=True, res=n(5), coll=col), 'head', 'frame')
cen = Vector(B(*HEAD_C))
inner = [Vector(p) for p in border]
P(tube_from_points('VisorLip', [tuple(cen + (p - cen) * 0.998) for p in inner], 0.0022, cyclic=True, res=n(4), coll=col), 'head', 'teal')
for idx in (8, 56, 72, 120):
    p = Vector(border[idx]); d = (p - cen).normalized()
    bt = prim('cyl', 'VisorBolt', loc=p + d * 0.0052, vertices=6, radius=0.0017, depth=0.0016, coll=col)
    bt.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); P(bt, 'head', 'alu')
fx, fy, fz = se_point(*HS[:5], 0.0, 0.62, HS[5], HS[6])
lens_c = (0, HEAD_C[1] + fy, fz)
lb = cyl('SensorHousing', (0, lens_c[1], lens_c[2] - 0.002), 0.0068, 0.008, 'z', 32, 'head', 'frame', bevel=0.0012)
lb.rotation_euler = (PI / 2 - 0.65, 0, 0)
ball('SensorLens', (0, lens_c[1] + 0.0018, lens_c[2] + 0.0018), 0.0046, 'head', 'glass', 24)
ring('SensorRing', (0, lens_c[1] + 0.0016, lens_c[2] + 0.0014), 0.0058, 0.0009, 'z', 'head', 'glow', 32).rotation_euler = (PI / 2 - 0.65, 0, 0)
for s, side in ((1, 'L'), (-1, 'R')):
    ex = s * 0.099
    cyl(f'EarHousing.{side}', (ex + s * 0.004, 0.288, -0.004), 0.024, 0.016, 'x', 48, 'head', 'frame', bevel=0.002, segs=3)
    for k in range(4):
        cyl(f'EarFin.{side}', (ex + s * (0.0005 + k * 0.0034), 0.288, -0.004), 0.0265, 0.0011, 'x', 48, 'head', 'frame', bevel=0.0003, segs=1)
    ring(f'EarLight.{side}', (ex + s * 0.0125, 0.288, -0.004), 0.016, 0.0028, 'x', 'head', 'glow', 48)
    cyl(f'EarCap.{side}', (ex + s * 0.0128, 0.288, -0.004), 0.0118, 0.004, 'x', 40, 'head', 'teal', bevel=0.0012, segs=3)
    cyl(f'EarHub.{side}', (ex + s * 0.0152, 0.288, -0.004), 0.0042, 0.003, 'x', 6, 'head', 'alu', bevel=0.0006, segs=1)
    for i in range(4):
        a = i / 4 * 2 * PI + PI / 4
        bolt((ex + s * 0.0146, 0.288 + math.sin(a) * 0.0085, -0.004 + math.cos(a) * 0.0085), 'x', 'head', 0.0012)
cyl('AntennaMount', (0, 0.374, -0.01), 0.011, 0.007, 'y', 6, 'head', 'frame', bevel=0.0012)
cyl('AntennaBase', (0, 0.379, -0.01), 0.0065, 0.006, 'y', 24, 'antenna0', 'alu')
coil = []
NC = n(160)
for k in range(NC + 1):
    t = k / NC
    a = t * 2 * PI * 7
    coil.append(B(math.cos(a) * 0.0042, 0.382 + t * 0.018, -0.01 + math.sin(a) * 0.0042))
P(tube_from_points('AntennaCoil', coil, 0.0009, res=2, coll=col), 'antenna0', 'alu')
strut('AntennaRod0', (0, 0.38, -0.01), (0, 0.405, -0.01), 0.0019, 'antenna0', 'frame')
strut('AntennaRod1', (0, 0.405, -0.01), (0, 0.426, -0.01), 0.0016, 'antenna1', 'frame')
cyl('AntennaCollar', (0, 0.426, -0.01), 0.005, 0.004, 'y', 24, 'antenna1', 'alu')
ball('AntennaLED', (0, 0.433, -0.01), 0.0082, 'antenna1', 'glow', 32)

# ================================================================== ARMS (L = +x)
for s, side in ((1, 'L'), (-1, 'R')):
    sx = s * 0.074
    UA, FA, HD = f'upperArm.{side}', f'forearm.{side}', f'hand.{side}'
    cyl(f'ShoulderServo.{side}', (sx - s * 0.006, 0.186, 0), 0.0155, 0.02, 'x', 40, UA, 'frame', bevel=0.0018)
    for i in range(6):
        a = i / 6 * 2 * PI
        bolt((sx + s * 0.0045, 0.186 + math.sin(a) * 0.011, math.cos(a) * 0.011), 'x', UA, 0.0011)
    cap = superellipsoid(f'ShoulderCap.{side}', 0.019, 0.016, 0.021, 0.55, 0.6, n(40), n(24), center=(sx + s * 0.004, 0.19, 0), coll=col)
    cut(cap, [cutter_box((sx + s * 0.004, 0.172, 0), (0.06, 0.02, 0.06))])
    P(cap, UA, 'teal')
    cyl(f'UpperStrut.{side}', (sx, 0.163, 0), 0.0085, 0.036, 'y', 24, UA, 'frame')
    shell(f'UpperArmor.{side}', 0.0148, 0.0165, 0.0148, 0.6, 0.75, 32, 20, (sx, 0.165, 0), UA, 'paint')
    for k in (-1, 1):
        box(f'ElbowPlate.{side}', (sx + k * 0.0095, 0.143, 0), (0.003, 0.02, 0.018), UA, 'frame', bevel=0.0012, segs=2)
    cyl(f'ElbowAxle.{side}', (sx, 0.142, 0), 0.0072, 0.024, 'x', 24, FA, 'alu')
    cyl(f'ElbowHub.{side}', (sx, 0.142, 0), 0.0098, 0.014, 'x', 32, FA, 'frame')
    fa = superellipsoid(f'ForearmArmor.{side}', 0.0158, 0.019, 0.0162, 0.55, 0.7, n(40), n(24), taper=-0.12, center=(sx, 0.122, 0.001), coll=col,
        grooves=[{'kind': 'v', 'at': -0.35, 'w': 0.06, 'd': 0.0009}])
    P(fa, FA, 'paint')
    ring(f'ForearmBand.{side}', (sx, 0.128, 0.001), 0.0163, 0.0022, 'y', FA, 'teal', 40)
    cyl(f'Wrist.{side}', (sx, 0.103, 0.001), 0.0098, 0.006, 'y', 24, FA, 'frame')
    ring(f'WristBearing.{side}', (sx, 0.103, 0.001), 0.0102, 0.0012, 'y', FA, 'alu', 24)
    box(f'Palm.{side}', (sx, 0.092, 0.002), (0.02, 0.016, 0.017), HD, 'frame', bevel=0.003, segs=3)
    box(f'PalmPlate.{side}', (sx + s * 0.0002, 0.092, 0.0105), (0.017, 0.013, 0.003), HD, 'paint', bevel=0.0012, segs=2)
    for k, fxo in enumerate((-0.0058, 0.0058)):
        fx_ = sx + fxo
        cyl(f'Knuckle.{side}', (fx_, 0.0835, 0.004), 0.0032, 0.0058, 'x', 16, HD, 'alu', bevel=0.0004, segs=1)
        box(f'FingerA.{side}', (fx_, 0.0775, 0.0045), (0.0052, 0.009, 0.0062), HD, 'paint', bevel=0.0018, segs=3)
        cyl(f'FingerJoint.{side}', (fx_, 0.0722, 0.0045), 0.0024, 0.0052, 'x', 12, HD, 'frame', bevel=0.0003, segs=1)
        box(f'FingerB.{side}', (fx_, 0.0675, 0.005), (0.0048, 0.0075, 0.0058), HD, 'paint', bevel=0.0018, segs=3, rot=(math.radians(-12), 0, 0))
        box(f'FingerPad.{side}', (fx_, 0.0665, 0.0018), (0.0042, 0.006, 0.002), HD, 'rubber', bevel=0.0008, segs=2)
    box(f'Thumb.{side}', (sx - s * 0.0118, 0.088, 0.008), (0.0052, 0.011, 0.006), HD, 'paint', bevel=0.0018, segs=3, rot=(0, math.radians(-s * 30), 0))
    cyl(f'ThumbJoint.{side}', (sx - s * 0.0098, 0.093, 0.007), 0.0028, 0.006, 'z', 12, HD, 'alu', bevel=0.0004, segs=1)

# ================================================================== LEGS
for s, side in ((1, 'L'), (-1, 'R')):
    lx = s * 0.036
    TH, SH, FT = f'thigh.{side}', f'shin.{side}', f'foot.{side}'
    cyl(f'HipAxle.{side}', (lx, 0.104, 0), 0.0085, 0.022, 'x', 24, TH, 'alu')
    box(f'ThighFrame.{side}', (lx, 0.089, 0), (0.016, 0.03, 0.014), TH, 'frame', bevel=0.003, segs=3)
    strut(f'ThighPistonSleeve.{side}', (lx, 0.1, -0.011), (lx, 0.088, -0.011), 0.0035, TH, 'frame')
    strut(f'ThighPistonRod.{side}', (lx, 0.088, -0.011), (lx, 0.077, -0.0105), 0.002, TH, 'alu')
    shell(f'ThighArmor.{side}', 0.0125, 0.0145, 0.006, 0.45, 0.6, 28, 16, (lx, 0.09, 0.0085), TH, 'teal')
    for k in (-1, 1):
        box(f'KneePlate.{side}', (lx + k * 0.0098, 0.073, 0), (0.003, 0.018, 0.016), TH, 'frame', bevel=0.0012, segs=2)
    cyl(f'KneeAxle.{side}', (lx, 0.072, 0), 0.0068, 0.024, 'x', 24, SH, 'alu')
    cyl(f'KneeHub.{side}', (lx, 0.072, 0), 0.0098, 0.014, 'x', 32, SH, 'frame')
    shell(f'KneeCap.{side}', 0.0125, 0.012, 0.007, 0.5, 0.6, 28, 16, (lx, 0.073, 0.0105), SH, 'paint')
    sn = superellipsoid(f'ShinArmor.{side}', 0.0178, 0.019, 0.0175, 0.55, 0.65, n(40), n(24), taper=0.1, center=(lx, 0.054, 0.002), coll=col,
        grooves=[{'kind': 'u', 'at': 0.0, 'from': -0.6, 'to': 0.9, 'w': 0.05, 'd': 0.0008}])
    P(sn, SH, 'paint')
    strut(f'ShinPiston.{side}', (lx, 0.068, -0.016), (lx, 0.044, -0.017), 0.0024, SH, 'alu')
    strut(f'ShinPistonSleeve.{side}', (lx, 0.066, -0.0165), (lx, 0.054, -0.0168), 0.0036, SH, 'frame')
    cyl(f'Ankle.{side}', (lx, 0.038, 0), 0.0105, 0.02, 'x', 32, FT, 'frame', bevel=0.0015)
    boot = superellipsoid(f'Boot.{side}', 0.033, 0.023, 0.047, 0.42, 0.5, n(72), n(40), taper=-0.22, center=(lx, 0.028, 0.012), coll=col,
        grooves=[{'kind': 'v', 'at': -0.28, 'w': 0.06, 'd': 0.0014},
                 {'kind': 'u', 'at': 0.0, 'from': -0.28, 'to': 1.3, 'w': 0.04, 'd': 0.0012}])
    P(boot, FT, 'paint')
    P(superellipsoid(f'Sole.{side}', 0.035, 0.0075, 0.05, 0.25, 0.4, n(56), n(14), center=(lx, 0.0078, 0.012), coll=col), FT, 'rubber')
    toe = superellipsoid(f'ToeBumper.{side}', 0.03, 0.011, 0.014, 0.4, 0.6, n(40), n(16), center=(lx, 0.016, 0.052), coll=col)
    cut(toe, [cutter_box((lx, 0.016, 0.036), (0.08, 0.04, 0.03))]); P(toe, FT, 'rubber')
    box(f'HeelPlate.{side}', (lx, 0.024, -0.034), (0.03, 0.02, 0.006), FT, 'frame', bevel=0.002, segs=2)
    for sy in (-1, 1):
        bolt((lx + sy * 0.01, 0.024, -0.0375), 'z', FT, 0.0014)
    for ix in range(3):
        for iz in range(6):
            box(f'Lug.{side}', (lx + (ix - 1) * 0.019, 0.0012, 0.012 + (iz - 2.5) * 0.0155), (0.014, 0.0026, 0.011), FT, 'rubber', bevel=0.001, segs=2)
    pts = []
    NS = n(48)
    for k in range(NS + 1):
        u = -PI * 0.18 + (k / NS) * PI * 0.6
        uu = u if s > 0 else -u
        x, y, z = se_point(0.033, 0.023, 0.047, 0.42, 0.5, uu, -0.28, -0.22)
        pts.append(B(lx + x * 1.006, 0.028 + y, 0.012 + z * 1.006))
    P(tube_from_points(f'BootStrip.{side}', pts, 0.0016, res=2, coll=col), FT, 'glow')

# ================================================================== scarf tails (skinned)
def ribbon(name, length, width, segs, start, droop, twist=0.0):
    verts, faces, uvs = [], [], []
    W = 4
    for i in range(segs + 1):
        t = i / segs
        y = start[1] - length * t * 0.95
        z = start[2] - length * 0.25 * t - droop * t * t
        x = start[0] + twist * t
        for j in range(W + 1):
            q = j / W - 0.5
            ww = width * (1 - 0.25 * t)
            verts.append(B(x + q * ww, y, z - 0.002 * (1 - (2 * q) ** 2)))
            uvs.append((j / W, t))
    for i in range(segs):
        for j in range(W):
            a = i * (W + 1) + j
            faces.append((a, a + 1, a + W + 2, a + W + 1))
    ob = mesh_obj(name, verts, faces, uvs, coll=col)
    m = ob.modifiers.new('Solidify', 'SOLIDIFY'); m.thickness = 0.0028; m.offset = 0
    return ob, W
TAIL_SEGS = 12
tails = []
for k, (x0, L, wdt) in enumerate(((-0.011, 0.105, 0.026), (0.012, 0.092, 0.022))):
    ob, W = ribbon(f'ScarfTail{k}', L, wdt, TAIL_SEGS, (x0, 0.194, -0.05), 0.012, twist=0.006 * (1 if k else -1))
    assign(ob, M['scarf']); tails.append((ob, L, W, x0))

# ================================================================== armature
arm_data = bpy.data.armatures.new('NuriRig')
arm = bpy.data.objects.new('NuriRig', arm_data); col.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None, connect=False):
    b = eb.new(name); b.head = B(*head); b.tail = B(*tail)
    if parent: b.parent = eb[parent]; b.use_connect = connect
    return b
bone('root', (0, 0, 0), (0, 0.05, 0))
bone('hips', (0, 0.104, 0), (0, 0.118, 0), 'root')
bone('spine', (0, 0.118, 0), (0, 0.198, 0), 'hips')
bone('neck', (0, 0.198, 0), (0, 0.222, 0), 'spine', True)
bone('head', (0, 0.222, 0), (0, 0.372, 0), 'neck', True)
bone('antenna0', (0, 0.378, -0.01), (0, 0.405, -0.01), 'head')
bone('antenna1', (0, 0.405, -0.01), (0, 0.44, -0.01), 'antenna0', True)
for s, side in ((1, 'L'), (-1, 'R')):
    sx, lx = s * 0.074, s * 0.036
    bone(f'upperArm.{side}', (sx, 0.186, 0), (sx, 0.142, 0), 'spine')
    bone(f'forearm.{side}', (sx, 0.142, 0), (sx, 0.103, 0.001), f'upperArm.{side}', True)
    bone(f'hand.{side}', (sx, 0.103, 0.001), (sx, 0.066, 0.004), f'forearm.{side}', True)
    bone(f'thigh.{side}', (lx, 0.104, 0), (lx, 0.072, 0), 'hips')
    bone(f'shin.{side}', (lx, 0.072, 0), (lx, 0.038, 0), f'thigh.{side}', True)
    bone(f'foot.{side}', (lx, 0.038, 0), (lx, 0.008, 0.055), f'shin.{side}', True)
NB = 5
for k, (ob, L, W, x0) in enumerate(tails):
    prev = 'neck'
    for i in range(NB):
        t0, t1 = i / NB, (i + 1) / NB
        h0 = (x0, 0.194 - L * t0 * 0.95, -0.05 - L * 0.25 * t0 - 0.012 * t0 * t0)
        h1 = (x0, 0.194 - L * t1 * 0.95, -0.05 - L * 0.25 * t1 - 0.012 * t1 * t1)
        bone(f'scarf{k}.{i}', h0, h1, prev, i > 0); prev = f'scarf{k}.{i}'
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
for ob, bname in parts:
    pb = arm.pose.bones[bname]
    world = ob.matrix_world.copy()
    ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = bname
    ob.matrix_parent_inverse = (arm.matrix_world @ pb.matrix @ Matrix.Translation((0, pb.bone.length, 0))).inverted()
    ob.matrix_world = world
for k, (ob, L, W, x0) in enumerate(tails):
    vg = [ob.vertex_groups.new(name=f'scarf{k}.{i}') for i in range(NB)]
    vneck = ob.vertex_groups.new(name='neck')
    for v in ob.data.vertices:
        t = (v.index // (W + 1)) / TAIL_SEGS
        f = t * NB - 0.5
        if f < 0:
            vg[0].add([v.index], 1 - min(1, -f), 'REPLACE'); vneck.add([v.index], min(1, -f), 'REPLACE')
        else:
            i0 = min(NB - 1, int(f)); i1 = min(NB - 1, i0 + 1); w1 = f - int(f)
            vg[i0].add([v.index], 1 - w1, 'ADD'); vg[i1].add([v.index], w1, 'ADD')
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm

def tri_count():
    dg = bpy.context.evaluated_depsgraph_get(); tot = 0
    for ob in col.all_objects:
        if ob.type == 'MESH':
            e = ob.evaluated_get(dg); me = e.to_mesh(); me.calc_loop_triangles(); tot += len(me.loop_triangles); e.to_mesh_clear()
    return tot
print('NURI parts:', len(parts), 'triangles:', tri_count(), 'q=', Q)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'nuri.blend' if Q >= 1 else f'nuri_q{Q}.blend'))
