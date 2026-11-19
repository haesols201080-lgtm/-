"""Red squirrel for the game, modelled in Blender from metaballs (anatomy: arched torso, heavy haunches with long
hind feet, slim forelegs, short neck, rounded head with snout, tufted ears, long S-curled tail).
The fur itself is rendered in the game with shells; this script exports the skin mesh with
  * TEXCOORD_0 in metres (uniform density) for the strand pattern,
  * TEXCOORD_1 = (fur length factor, body zone/4) per vertex, zones: 0 body, 1 belly, 2 head, 3 tail, 4 ear tuft,
  * COLOR_0 = coat colour (rufous back and tail, cream belly and chest, darker tufts),
plus glossy eyes and a nose as separate meshes.
usage: python build_squirrel.py <out.glb>"""
import sys, math
import bpy, bmesh
from mathutils import Vector, Euler

OUT = sys.argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

PARTS = []  # (name, centre, radii, rotation, zone, fur)
def ell(name, co, radii, rot=(0, 0, 0), zone=0, fur=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=co, segments=32, ring_count=16)
    o = bpy.context.active_object; o.scale = radii; o.rotation_euler = Euler(rot); o.name = name
    PARTS.append((name, Vector(co), Vector(radii), Euler(rot), zone, fur)); return o
def chain(name, pts, r0, r1, zone, fur, step=0.006):
    out = []
    for i in range(len(pts) - 1):
        a, b = Vector(pts[i]), Vector(pts[i + 1]); n = max(1, int((b - a).length / step))
        for k in range(n):
            t = (i + k / n) / (len(pts) - 1); p = a.lerp(b, k / n); r = r0 + (r1 - r0) * t
            out.append(ell(name, tuple(p), (r, r, r), zone=zone, fur=fur))
    return out
# forward = -Y, up = Z (exported as +Z forward / +Y up in glTF); sizes of a red squirrel (body ~19 cm, tail ~17 cm)
ell('torso', (0, 0.0, 0.064), (0.032, 0.058, 0.034), (0.2, 0, 0), 0, 1.0)
ell('back', (0, 0.018, 0.074), (0.03, 0.04, 0.03), (0.3, 0, 0), 0, 1.0)
for s in (-1, 1):
    ell('haunch', (s * 0.02, 0.034, 0.05), (0.022, 0.032, 0.03), (0.4, 0, 0), 0, 1.0)
    ell('hindfoot', (s * 0.023, -0.004, 0.009), (0.009, 0.03, 0.007), (0.08, 0, 0), 0, 0.35)
    chain('shank', [(s * 0.022, 0.036, 0.034), (s * 0.023, 0.03, 0.016), (s * 0.023, 0.018, 0.009)], 0.011, 0.008, 0, 0.6, step=0.004)
    chain('foreleg', [(s * 0.013, -0.05, 0.05), (s * 0.014, -0.06, 0.022), (s * 0.014, -0.066, 0.008)], 0.0085, 0.0065, 0, 0.5)
    ell('paw', (s * 0.014, -0.071, 0.005), (0.0075, 0.009, 0.005), zone=0, fur=0.25)
ell('chest', (0, -0.038, 0.07), (0.026, 0.03, 0.03), (0.4, 0, 0), 1, 0.85)
ell('belly', (0, 0.006, 0.05), (0.027, 0.045, 0.022), (0.15, 0, 0), 1, 0.8)
ell('neck', (0, -0.06, 0.092), (0.019, 0.02, 0.022), (0.6, 0, 0), 2, 0.7)
ell('head', (0, -0.082, 0.111), (0.024, 0.029, 0.024), (0, 0, 0), 2, 0.55)
ell('cheek', (0, -0.094, 0.104), (0.022, 0.02, 0.018), (0, 0, 0), 2, 0.5)
ell('snout', (0, -0.11, 0.103), (0.0115, 0.017, 0.0115), (-0.3, 0, 0), 2, 0.3)
for s in (-1, 1):
    ell('ear', (s * 0.016, -0.076, 0.138), (0.0065, 0.004, 0.0135), (0.15, s * 0.25, 0), 4, 0.45)
# tail: thin core along an S curve that rises behind the back; the long fur makes it bushy
tail = [(0, 0.07, 0.058), (0, 0.098, 0.074), (0, 0.118, 0.104), (0, 0.124, 0.146), (0, 0.116, 0.186), (0, 0.096, 0.216), (0, 0.07, 0.23), (0, 0.048, 0.226)]
chain('tail', tail, 0.012, 0.007, 3, 6.2, step=0.005)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
body = bpy.context.active_object; body.name = 'squirrel_body'
m = body.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.0022
bpy.ops.object.modifier_apply(modifier='rm')
m = body.modifiers.new('sm', 'LAPLACIANSMOOTH'); m.iterations = 12; m.lambda_factor = 0.8
bpy.ops.object.modifier_apply(modifier='sm')
me = body.data
m = body.modifiers.new('dc', 'DECIMATE'); m.ratio = min(1.0, 7000 / max(1, len(me.polygons) * 2))
bpy.ops.object.modifier_apply(modifier='dc')
me = body.data
for p in me.polygons: p.use_smooth = True
print('squirrel tris ~', sum(len(p.vertices) - 2 for p in me.polygons))

# UV in metres (uniform density) for the strand pattern
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
uvl = me.uv_layers[0]; uvl.name = 'Strands'
a3 = sum(p.area for p in me.polygons)
def uv_area():
    tot = 0.0
    for p in me.polygons:
        uv = [uvl.data[li].uv for li in p.loop_indices]
        for k in range(1, len(uv) - 1):
            tot += abs((uv[k].x - uv[0].x) * (uv[k + 1].y - uv[0].y) - (uv[k + 1].x - uv[0].x) * (uv[k].y - uv[0].y)) * 0.5
    return tot
k = math.sqrt(a3 / max(1e-9, uv_area()))
for d in uvl.data: d.uv = d.uv * k

# per-vertex zone / fur length (nearest metaball element, distance normalised by its size) and coat colour
fur = me.uv_layers.new(name='Fur')
col = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
vz, vl = [], []
for v in me.vertices:
    best = None
    for name, c, radii, rot, zone, fl in PARTS:
        q = rot.to_matrix().inverted() @ (v.co - c)
        d = Vector((q.x / radii.x, q.y / radii.y, q.z / radii.z)).length
        if best is None or d < best[0]: best = (d, zone, fl, name)
    d, zone, fl, name = best
    if name == 'ear' and v.co.z > 0.144: zone, fl = 4, 2.0 + 60 * (v.co.z - 0.144)  # tufts on the ear tips
    vz.append(zone); vl.append(fl)
def coat(v, zone):
    n = v.normal
    rufous = Vector((0.56, 0.27, 0.11)); flank = Vector((0.6, 0.36, 0.2)); cream = Vector((0.93, 0.88, 0.78))
    if zone == 3: return Vector((0.5, 0.23, 0.09)) * (0.9 + 0.2 * max(0.0, n.z))
    if zone == 4: return Vector((0.36, 0.17, 0.07))
    belly = max(0.0, min(1.0, (-n.z - 0.15) * 2.2))                     # under side
    if v.co.y < -0.02: belly = max(belly, max(0.0, min(1.0, (-n.y - 0.35) * 2.0)) * (1.0 if v.co.z < 0.1 else 0.0))  # chest, throat
    if zone == 2 and v.co.z < 0.106 and n.y < -0.2: belly = max(belly, 0.8)  # chin / lips
    c = rufous.lerp(flank, max(0.0, min(1.0, abs(n.x) * 1.4 - 0.4)))
    return c.lerp(cream, belly)
for li, loop in enumerate(me.loops):
    vi = loop.vertex_index; z = vz[vi]
    c = coat(me.vertices[vi], z)
    col.data[li].color = (c.x ** 2.2, c.y ** 2.2, c.z ** 2.2, 1.0)   # coat colours are written as sRGB; glTF wants linear
    fur.data[li].uv = (vl[vi], z / 4.0)
me.color_attributes.active_color = col
uvl.active_render = True

# glossy eyes and the nose
def sphere(name, loc, r, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True); bpy.ops.object.shade_smooth(); return o
eyes = [sphere(f'squirrel_eye{s}', (s * 0.0185, -0.096, 0.118), 0.0058, (0.85, 0.95, 1.0)) for s in (-1, 1)]
bpy.ops.object.select_all(action='DESELECT')
for e in eyes: e.select_set(True)
bpy.context.view_layer.objects.active = eyes[0]; bpy.ops.object.join(); eyes[0].name = 'squirrel_eyes'
nose = sphere('squirrel_nose', (0, -0.126, 0.104), 0.0042, (1.25, 0.8, 0.9))
for o, n in ((body, 'Fur'), (eyes[0], 'Eye'), (nose, 'Nose')):
    o.data.materials.clear(); o.data.materials.append(bpy.data.materials.new(n))
bpy.ops.object.select_all(action='DESELECT')
for o in (body, eyes[0], nose): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True,
                          export_normals=True, export_vertex_color='ACTIVE', export_texcoords=True)
import os; print('exported', OUT, round(os.path.getsize(OUT) / 1e3), 'kB')
