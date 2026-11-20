"""Moss micro-geometry -> tileable texture set for the in-game moss layer.

A 12 x 12 cm tile of forest-floor moss is modelled stem by stem: haircap moss (upright stems carrying whorls of narrow
leaves that read as little stars from above, gathered in domed cushions), feather moss fronds creeping underneath,
and a few spore capsules on red-brown setae. Stems near the border are repeated across it so the tile wraps.
The tile is rendered top-down with an orthographic camera in Cycles:
  * diffuse colour pass x ambient occlusion  -> albedo (RGB)
  * depth pass                              -> height (A), 0 = soil, 1 = tallest tips
  * normal pass                             -> tangent-space normal map
usage: python build_moss.py <out_dir>
"""
import sys, os, math, random
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, noise

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
S = 0.12          # tile size (m)
HMAX = 0.024      # height range mapped to 0..1
RES = int(os.environ.get('MOSS_RES', 1024))
rnd = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
bm = bmesh.new()
col_layer = bm.loops.layers.color.new('Col')

def wrap_noise(x, y, f, seed):
    """tileable 2D noise: sample a 4D-ish torus by mixing four periodic copies"""
    u, v = x / S, y / S
    a = noise.noise(Vector((math.cos(u * 2 * math.pi) * f, math.sin(u * 2 * math.pi) * f, math.cos(v * 2 * math.pi) * f + seed)))
    b = noise.noise(Vector((math.sin(v * 2 * math.pi) * f + seed * 0.37, math.cos(u * 2 * math.pi) * f * 0.7, math.sin(u * 2 * math.pi) * f * 0.7)))
    return 0.5 * (a + b)

def add_tri(p0, p1, p2, c0, c1=None, c2=None):
    vs = [bm.verts.new(p) for p in (p0, p1, p2)]
    try: f = bm.faces.new(vs)
    except ValueError: return
    for l, c in zip(f.loops, (c0, c1 or c0, c2 or c1 or c0)): l[col_layer] = (*c, 1.0)

def add_quad(p0, p1, p2, p3, c0, c1):
    vs = [bm.verts.new(p) for p in (p0, p1, p2, p3)]
    try: f = bm.faces.new(vs)
    except ValueError: return
    for l, c in zip(f.loops, (c0, c0, c1, c1)): l[col_layer] = (*c, 1.0)

def lerpc(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def stem(base, height, lean, cfresh, cold):
    """haircap stem: tapered square stem + 4 whorls of 5-7 narrow leaves angled up, longest mid-stem"""
    top = base + lean * height + Vector((0, 0, height))
    w0, w1 = 0.00035, 0.0002
    side = Vector((1, 0, 0)) if abs(lean.x) < 0.9 else Vector((0, 1, 0))
    ax = (top - base).normalized(); s1 = ax.cross(side).normalized(); s2 = ax.cross(s1).normalized()
    for k in range(4):
        a, b = s1 if k % 2 == 0 else s2, (s1 if k % 2 == 0 else s2) * (-1 if k > 1 else 1)
        d0 = (s1, s2, -s1, -s2)[k]; d1 = (s1, s2, -s1, -s2)[(k + 1) % 4]
        add_quad(base + d0 * w0, base + d1 * w0, top + d1 * w1, top + d0 * w1, cold, cfresh)
    nwh = 4
    for wi in range(nwh):
        t = 0.45 + 0.55 * (wi + 0.5) / nwh
        c = base.lerp(top, t)
        L = height * (0.22 + 0.18 * math.sin(math.pi * (0.3 + 0.7 * (1 - t)))) * rnd.uniform(0.8, 1.15)
        nl = rnd.randint(5, 7); ph = rnd.random() * 6.28
        col = lerpc(cold, cfresh, min(1.0, t * 1.15))
        for li in range(nl):
            ang = ph + li * 2 * math.pi / nl
            out = (s1 * math.cos(ang) + s2 * math.sin(ang))
            elev = rnd.uniform(0.55, 1.0) * (1.25 - t * 0.6)        # upper leaves stand up more
            d = (out + ax * elev).normalized()
            tip = c + d * L
            wv = out.cross(d).normalized() * 0.00042
            add_tri(c - wv, c + wv, tip, col, col, lerpc(col, (0.85, 0.8, 0.45), 0.25))
    # top bud
    return top

def frond(base, ang, L, colA, colB):
    """feather moss frond: a creeping main axis with alternating side branchlets, all leafy (thin blades)"""
    d = Vector((math.cos(ang), math.sin(ang), 0.12))
    n = 9
    pts = [base + d * (L * i / n) + Vector((0, 0, 0.0012 * math.sin(i / n * math.pi))) for i in range(n + 1)]
    for i in range(n):
        p, q = pts[i], pts[i + 1]
        side = Vector((-d.y, d.x, 0)) * 0.0003
        add_quad(p - side, p + side, q + side, q - side, colA, colB)
        if i > 0 and i < n - 1:
            for sd in (-1, 1):
                bl = L * 0.32 * (1 - i / n) * rnd.uniform(0.7, 1.1)
                bd = (d * 0.5 + Vector((-d.y, d.x, 0)) * sd).normalized()
                bt = p + bd * bl + Vector((0, 0, 0.0008))
                w = Vector((-bd.y, bd.x, 0)) * 0.00035
                add_tri(p - w, p + w, bt, colA, colA, colB)

def capsule(base, height, lean):
    """sporophyte: red-brown seta with a tilted capsule"""
    top = base + lean * height + Vector((0, 0, height))
    w = Vector((0.00012, 0, 0)); w2 = Vector((0, 0.00012, 0))
    seta = (0.42, 0.16, 0.08)
    add_quad(base - w, base + w, top + w, top - w, seta, (0.55, 0.25, 0.1))
    add_quad(base - w2, base + w2, top + w2, top - w2, seta, (0.55, 0.25, 0.1))
    cap = (0.55, 0.42, 0.18)
    c = top + Vector((0.0006, 0, -0.0004))
    r = 0.0007
    for k in range(6):
        a0, a1 = k * math.pi / 3, (k + 1) * math.pi / 3
        p0 = c + Vector((0, math.cos(a0) * r, math.sin(a0) * r)); p1 = c + Vector((0, math.cos(a1) * r, math.sin(a1) * r))
        add_tri(top, p0, p1, cap); add_tri(c + Vector((0.0028, 0, 0)), p1, p0, cap)

# ---------------------------------------------------------------- populate
SP = 0.00145
nside = int(S / SP)
stems = 0
for i in range(nside):
    for j in range(nside):
        x = (i + 0.5 + rnd.uniform(-0.45, 0.45)) * SP; y = (j + 0.5 + rnd.uniform(-0.45, 0.45)) * SP
        cush = 0.5 + 0.5 * wrap_noise(x, y, 1.6, 3.0)                       # cushions
        fine = 0.5 + 0.5 * wrap_noise(x, y, 6.0, 11.0)
        if cush < 0.3 and rnd.random() < 0.65: continue                       # gaps between cushions
        h = (0.006 + 0.016 * cush ** 1.3) * (0.75 + 0.5 * fine) * rnd.uniform(0.85, 1.15)
        # stems lean outward from the cushion centre (follow the noise gradient)
        e = 0.002
        gx = wrap_noise(x + e, y, 1.6, 3.0) - wrap_noise(x - e, y, 1.6, 3.0); gy = wrap_noise(x, y + e, 1.6, 3.0) - wrap_noise(x, y - e, 1.6, 3.0)
        lean = Vector((-gx, -gy, 0)) * 4.0 + Vector((rnd.uniform(-0.12, 0.12), rnd.uniform(-0.12, 0.12), 0))
        hue = rnd.random()
        fresh = lerpc((0.36, 0.5, 0.1), (0.5, 0.56, 0.14), hue) if fine > 0.35 else (0.42, 0.44, 0.16)
        old = lerpc((0.16, 0.14, 0.06), (0.22, 0.2, 0.08), hue)
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                bx, by = x + ox, y + oy
                if -0.004 < bx < S + 0.004 and -0.004 < by < S + 0.004:
                    stem(Vector((bx, by, 0.0005)), h, lean, fresh, old)
        stems += 1
        if rnd.random() < 0.012:
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    bx, by = x + ox, y + oy
                    if -0.006 < bx < S + 0.006 and -0.006 < by < S + 0.006:
                        capsule(Vector((bx, by, 0)), h + rnd.uniform(0.006, 0.012), lean * 0.6)
# feather moss underneath
for k in range(260):
    x, y = rnd.random() * S, rnd.random() * S
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            bx, by = x + ox, y + oy
            if -0.01 < bx < S + 0.01 and -0.01 < by < S + 0.01:
                frond(Vector((bx, by, 0.0006)), rnd.random() * 6.28, rnd.uniform(0.01, 0.022), (0.3, 0.36, 0.1), (0.48, 0.5, 0.16))
print('stems', stems, 'faces', len(bm.faces))

me = bpy.data.meshes.new('moss'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('moss', me); bpy.context.scene.collection.objects.link(ob)
mat = bpy.data.materials.new('moss'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.85
ob.data.materials.append(mat)
# soil under the moss
bpy.ops.mesh.primitive_plane_add(size=S * 3, location=(S / 2, S / 2, 0))
soil = bpy.context.active_object
sm = bpy.data.materials.new('soil'); sm.use_nodes = True; sm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.06, 0.045, 0.03, 1)
soil.data.materials.append(sm)

sc = bpy.context.scene
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = S; cam.location = (S / 2, S / 2, 0.2); cam.data.clip_start = 0.05; cam.data.clip_end = 0.5
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.0; sc.world = w
w.light_settings.distance = 0.005
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.render.resolution_x = sc.render.resolution_y = RES
sc.cycles.pixel_filter_type = 'BOX'; sc.cycles.filter_width = 1.0
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'; sc.render.image_settings.color_mode = 'RGB'

def emit_setup(m, kind):
    """replace the material output with an unlit emission of: albedo x AO, height, or normal"""
    nt = m.node_tree
    for n in [n for n in nt.nodes if n.type not in ('VERTEX_COLOR',)]: nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(em.outputs[0], out.inputs['Surface'])
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    if kind == 'albedo':
        vc = next((n for n in nt.nodes if n.type == 'VERTEX_COLOR'), None)
        ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.005; ao.samples = 16
        mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
        if vc: nt.links.new(vc.outputs['Color'], mul.inputs['A'])
        else: mul.inputs['A'].default_value = (0.06, 0.045, 0.03, 1)
        # soften the AO a little (sky light reaches into the cushion)
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.35
        nt.links.new(ao.outputs['AO'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], mul.inputs['B'])
        nt.links.new(mul.outputs['Result'], em.inputs['Color'])
    elif kind == 'height':
        sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
        dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'DIVIDE'; dv.inputs[1].default_value = HMAX; dv.use_clamp = True
        nt.links.new(sep.outputs['Z'], dv.inputs[0]); nt.links.new(dv.outputs[0], em.inputs['Color'])
    else:
        # world normal (= tangent space for a top-down tile), facing the camera on back faces
        vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY_ADD'
        vm.inputs[1].default_value = (0.5, 0.5, 0.5); vm.inputs[2].default_value = (0.5, 0.5, 0.5)
        flip = nt.nodes.new('ShaderNodeVectorMath'); flip.operation = 'SCALE'
        bf = nt.nodes.new('ShaderNodeMath'); bf.operation = 'MULTIPLY_ADD'; bf.inputs[1].default_value = -2.0; bf.inputs[2].default_value = 1.0
        nt.links.new(geo.outputs['Backfacing'], bf.inputs[0]); nt.links.new(geo.outputs['Normal'], flip.inputs[0]); nt.links.new(bf.outputs[0], flip.inputs['Scale'])
        nt.links.new(flip.outputs[0], vm.inputs[0]); nt.links.new(vm.outputs[0], em.inputs['Color'])

for kind, spp in (('albedo', int(os.environ.get('MOSS_SPP', 32))), ('height', 4), ('normal', 8)):
    for m in (mat, sm): emit_setup(m, kind)
    sc.cycles.samples = spp
    sc.render.filepath = os.path.join(OUT, f'_moss_{kind}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', kind)
