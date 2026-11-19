"""Bakes seamless PBR texture sets for the forest in Blender.

Two kinds of sources:
  * scatter sets  - real 3D objects (leaves, twigs, pebbles, soil) scattered on a 2 m tile with wrap-around
                    copies, rendered top-down with an orthographic camera.
  * procedural    - Blender noise/voronoi evaluated on a 4D torus (perfectly tileable) on a plane.
Each set is rendered as several emission passes: albedo (sRGB), normal (tangent = world for a top view),
roughness, AO and height, then packed into  <name>_albedo.jpg, <name>_normal.png, <name>_orm.jpg
(R = AO, G = roughness, B = height).

usage: python bake_textures.py <out_dir> [size] [only_name ...]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Euler
from common import *

OUT = sys.argv[1]
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
ONLY = sys.argv[3:]
os.makedirs(OUT, exist_ok=True)
TILE = 2.0  # metres covered by one tile for scatter sets

def L(m, a, b):
    m.node_tree.links.new(a, b)

# ---------------------------------------------------------------- pass-switchable materials
def pass_material(name):
    """Material with named source nodes so render passes can be swapped:
       ALB (color), RGH (float), NRM (vector normal), plus BSDF."""
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    return m, nt, bsdf

def finish(m, alb_socket, rgh_socket, nrm_socket=None, alpha_socket=None):
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    L(m, alb_socket, bsdf.inputs['Base Color'])
    L(m, rgh_socket, bsdf.inputs['Roughness'])
    if nrm_socket is not None:
        L(m, nrm_socket, bsdf.inputs['Normal'])
    m['alb'] = alb_socket.node.name + '|' + alb_socket.identifier
    m['rgh'] = rgh_socket.node.name + '|' + rgh_socket.identifier
    m['nrm'] = (nrm_socket.node.name + '|' + nrm_socket.identifier) if nrm_socket is not None else ''
    if alpha_socket is not None:
        L(m, alpha_socket, bsdf.inputs['Alpha'])
        m['alpha'] = alpha_socket.node.name + '|' + alpha_socket.identifier
    return m

def sock(nt, ref):
    nn, ident = ref.split('|')
    for s in nt.nodes[nn].outputs:
        if s.identifier == ident:
            return s

def set_pass(mode, hmin=-0.01, hmax=0.05):
    for m in bpy.data.materials:
        if 'alb' not in m:
            continue
        nt = m.node_tree
        out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        bsdf = nt.nodes['Principled BSDF']
        em = nt.nodes.get('PASS_EM') or nt.nodes.new('ShaderNodeEmission'); em.name = 'PASS_EM'
        for l in list(out.inputs['Surface'].links):
            nt.links.remove(l)
        # helpers built once
        if 'PASS_GEO' not in nt.nodes:
            g = nt.nodes.new('ShaderNodeNewGeometry'); g.name = 'PASS_GEO'
            sep = nt.nodes.new('ShaderNodeSeparateXYZ'); sep.name = 'PASS_SEP'
            mr = nt.nodes.new('ShaderNodeMapRange'); mr.name = 'PASS_H'
            L(m, g.outputs['Position'], sep.inputs[0]); L(m, sep.outputs['Z'], mr.inputs['Value'])
            vm = nt.nodes.new('ShaderNodeVectorMath'); vm.name = 'PASS_NM'; vm.operation = 'MULTIPLY_ADD'
            vm.inputs[1].default_value = (0.5, 0.5, 0.5); vm.inputs[2].default_value = (0.5, 0.5, 0.5)
            ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.name = 'PASS_AO'; ao.samples = 4
            ao.inputs['Distance'].default_value = 0.03
            mix = nt.nodes.new('ShaderNodeMixShader'); mix.name = 'PASS_MIX'
            tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.name = 'PASS_TR'
        mr = nt.nodes['PASS_H']; mr.inputs['From Min'].default_value = hmin; mr.inputs['From Max'].default_value = hmax
        vm, ao = nt.nodes['PASS_NM'], nt.nodes['PASS_AO']
        for l in list(em.inputs['Color'].links): nt.links.remove(l)
        for l in list(vm.inputs[0].links): nt.links.remove(l)
        for l in list(ao.inputs['Normal'].links): nt.links.remove(l)
        nrm = sock(nt, m['nrm']) if m['nrm'] else nt.nodes['PASS_GEO'].outputs['Normal']
        if mode == 'beauty':
            target = bsdf.outputs[0]
        else:
            if mode == 'albedo': L(m, sock(nt, m['alb']), em.inputs['Color'])
            elif mode == 'rough': L(m, sock(nt, m['rgh']), em.inputs['Color'])
            elif mode == 'height': L(m, mr.outputs['Result'], em.inputs['Color'])
            elif mode == 'normal': L(m, nrm, vm.inputs[0]); L(m, vm.outputs[0], em.inputs['Color'])
            elif mode == 'ao': L(m, nrm, ao.inputs['Normal']); L(m, ao.outputs['AO'], em.inputs['Color'])
            target = em.outputs[0]
        if 'alpha' in m and mode != 'beauty':
            mix = nt.nodes['PASS_MIX']
            for l in list(mix.inputs[0].links): nt.links.remove(l)
            L(m, sock(nt, m['alpha']), mix.inputs[0])
            L(m, nt.nodes['PASS_TR'].outputs[0], mix.inputs[1]); L(m, target, mix.inputs[2])
            target = mix.outputs[0]
        L(m, target, out.inputs['Surface'])

def torus_vector(m, scale_u=1.0, scale_v=1.0, loc=(-1400, 0)):
    """UV -> (cos u, sin u, cos v) and W = sin v on a 4D torus => seamless noise. Returns (vector, w) sockets."""
    nt = m.node_tree
    tc = nt.nodes.new('ShaderNodeTexCoord'); tc.location = loc
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(m, tc.outputs['UV'], sep.inputs[0])
    def f(op, a, k=None):
        n_ = nt.nodes.new('ShaderNodeMath'); n_.operation = op
        if isinstance(a, float): n_.inputs[0].default_value = a
        else: L(m, a, n_.inputs[0])
        if k is not None: n_.inputs[1].default_value = k
        return n_.outputs[0]
    au = f('MULTIPLY', sep.outputs['X'], 2 * math.pi); av = f('MULTIPLY', sep.outputs['Y'], 2 * math.pi)
    ru, rv = scale_u / (2 * math.pi), scale_v / (2 * math.pi)
    cu = f('MULTIPLY', f('COSINE', au), ru); su = f('MULTIPLY', f('SINE', au), ru)
    cv = f('MULTIPLY', f('COSINE', av), rv); sv = f('MULTIPLY', f('SINE', av), rv)
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    L(m, cu, comb.inputs[0]); L(m, su, comb.inputs[1]); L(m, cv, comb.inputs[2])
    return comb.outputs[0], sv

def noise4(m, vec, w, scale, detail=6, rough=0.55, distortion=0.0):
    n_ = m.node_tree.nodes.new('ShaderNodeTexNoise'); n_.noise_dimensions = '4D'
    L(m, vec, n_.inputs['Vector']); L(m, w, n_.inputs['W'])
    n_.inputs['Scale'].default_value = scale; n_.inputs['Detail'].default_value = detail
    n_.inputs['Roughness'].default_value = rough; n_.inputs['Distortion'].default_value = distortion
    return n_

def voronoi4(m, vec, w, scale, feature='F1', rand=1.0):
    n_ = m.node_tree.nodes.new('ShaderNodeTexVoronoi'); n_.voronoi_dimensions = '4D'; n_.feature = feature
    L(m, vec, n_.inputs['Vector']); L(m, w, n_.inputs['W'])
    n_.inputs['Scale'].default_value = scale; n_.inputs['Randomness'].default_value = rand
    return n_

def ramp(m, inp, stops):
    r = m.node_tree.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    while len(els) > 1: els.remove(els[-1])
    els[0].position = stops[0][0]; els[0].color = (*stops[0][1], 1)
    for p, c in stops[1:]:
        e = els.new(p); e.color = (*c, 1)
    L(m, inp, r.inputs['Fac'])
    return r

def maprange(m, inp, a, b, c, d):
    r = m.node_tree.nodes.new('ShaderNodeMapRange')
    L(m, inp, r.inputs['Value'])
    r.inputs['From Min'].default_value = a; r.inputs['From Max'].default_value = b
    r.inputs['To Min'].default_value = c; r.inputs['To Max'].default_value = d
    return r.outputs['Result']

def math_(m, op, a, b):
    n_ = m.node_tree.nodes.new('ShaderNodeMath'); n_.operation = op
    for i, x in enumerate((a, b)):
        if isinstance(x, (int, float)): n_.inputs[i].default_value = x
        else: L(m, x, n_.inputs[i])
    return n_.outputs[0]

def mixc(m, fac, a, b):
    n_ = m.node_tree.nodes.new('ShaderNodeMix'); n_.data_type = 'RGBA'
    for k, x in (('Factor', fac), ('A', a), ('B', b)):
        if isinstance(x, tuple): n_.inputs[k].default_value = (*x, 1) if len(x) == 3 else x
        elif isinstance(x, float): n_.inputs[k].default_value = x
        else: L(m, x, n_.inputs[k])
    return n_.outputs['Result']

def bump(m, h, strength, dist=0.002, normal=None):
    b = m.node_tree.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength; b.inputs['Distance'].default_value = dist
    L(m, h, b.inputs['Height'])
    if normal is not None: L(m, normal, b.inputs['Normal'])
    return b.outputs['Normal']

# ---------------------------------------------------------------- render plumbing
def setup_render(size, ortho_scale, center, alpha=False):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
    sc.render.resolution_x = sc.render.resolution_y = size; sc.render.resolution_percentage = 100
    sc.render.film_transparent = alpha
    sc.cycles.pixel_filter_type = 'BLACKMAN_HARRIS'; sc.cycles.filter_width = 1.2
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 4
    w = bpy.data.worlds.new('W'); sc.world = w
    try: w.use_nodes = True
    except Exception: pass
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
    cam_d = bpy.data.cameras.new('TopCam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = ortho_scale
    cam_d.clip_start = 0.01; cam_d.clip_end = 10
    cam = bpy.data.objects.new('TopCam', cam_d); sc.collection.objects.link(cam)
    cam.location = (center[0], center[1], 2.0); cam.rotation_euler = (0, 0, 0)
    sc.camera = cam

def render_pass(mode, path, samples, data=True, alpha=False, hmin=-0.01, hmax=0.05):
    sc = bpy.context.scene
    set_pass(mode, hmin, hmax)
    sc.cycles.samples = samples
    try:
        sc.view_settings.view_transform = 'Raw' if data else 'Standard'
    except Exception:
        sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if alpha else 'RGB'
    sc.render.image_settings.color_depth = '16' if mode in ('height', 'normal') else '8'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def pack(name, size_out=None, alpha=False):
    from PIL import Image
    p = lambda k: os.path.join(OUT, f'_{name}_{k}.png')
    alb = Image.open(p('albedo')).convert('RGBA' if alpha else 'RGB')
    nrm = Image.open(p('normal')).convert('RGB')
    rgh = Image.open(p('rough')).convert('L')
    ao = Image.open(p('ao')).convert('L')
    hgt = Image.open(p('height')).convert('L') if os.path.exists(p('height')) else Image.new('L', alb.size, 128)
    orm = Image.merge('RGB', (ao, rgh, hgt))
    sizes = [alb.size[0]] + ([size_out] if size_out and size_out != alb.size[0] else [])
    for s in sizes:
        suf = '' if s == alb.size[0] else f'_{s}'
        a2 = alb.resize((s, s), Image.LANCZOS) if s != alb.size[0] else alb
        n2 = nrm.resize((s, s), Image.LANCZOS) if s != alb.size[0] else nrm
        o2 = orm.resize((s, s), Image.LANCZOS) if s != alb.size[0] else orm
        if alpha:
            a2.save(os.path.join(OUT, f'{name}{suf}_albedo.png'), optimize=True)
        else:
            a2.save(os.path.join(OUT, f'{name}{suf}_albedo.jpg'), quality=90)
        n2.save(os.path.join(OUT, f'{name}{suf}_normal.png' if alpha else f'{name}{suf}_normal.jpg'), **({} if alpha else {'quality': 92}))
        o2.save(os.path.join(OUT, f'{name}{suf}_orm.jpg'), quality=90)
    for k in ('albedo', 'normal', 'rough', 'ao', 'height', 'beauty'):
        if os.path.exists(p(k)): os.remove(p(k))

def bake_set(name, size, ortho, center, samples=24, alpha=False, hmin=-0.01, hmax=0.05, beauty=False):
    setup_render(size, ortho, center, alpha)
    base = lambda k: os.path.join(OUT, f'_{name}_{k}.png')
    render_pass('albedo', base('albedo'), samples, data=False, alpha=alpha)
    render_pass('normal', base('normal'), samples, alpha=False)
    render_pass('rough', base('rough'), max(8, samples // 2), alpha=False)
    render_pass('ao', base('ao'), samples, alpha=False)
    render_pass('height', base('height'), max(8, samples // 2), alpha=False, hmin=hmin, hmax=hmax)
    pack(name, size // 2 if size >= 2048 else None, alpha)
    print('baked', name)

def wrap_copies(objs, tile=TILE, margin=0.25):
    """Duplicate objects close to the tile border on the opposite side so the render tiles seamlessly."""
    out = []
    for ob in objs:
        x, y = ob.location.x, ob.location.y
        for dx in (-tile, 0, tile):
            for dy in (-tile, 0, tile):
                if dx == 0 and dy == 0: continue
                nx, ny = x + dx, y + dy
                if -margin <= nx <= tile + margin and -margin <= ny <= tile + margin:
                    c = ob.copy(); c.location = (nx, ny, ob.location.z)
                    bpy.context.scene.collection.objects.link(c); out.append(c)
    return out

# ---------------------------------------------------------------- scatter building blocks
def leaf_mesh(name, length, width, lobes=0, seed=0):
    rnd = random.Random(seed)
    nu, nv = 10, 6
    verts, faces, uvs = [], [], []
    for i in range(nu + 1):
        t = i / nu
        w = width * (math.sin(math.pi * t) ** 0.75) * (1 + (0.18 * math.sin(t * math.pi * 2 * lobes) if lobes else 0))
        for j in range(nv + 1):
            q = j / nv - 0.5
            x = (t - 0.5) * length
            y = q * w
            z = 0.12 * width * (2 * q) ** 2 + 0.05 * length * (2 * t - 1) ** 2 + rnd.uniform(-0.0005, 0.0005)
            verts.append((x, y, z)); uvs.append((t, j / nv))
    for i in range(nu):
        for j in range(nv):
            a = i * (nv + 1) + j
            faces.append((a, a + nv + 1, a + nv + 2, a + 1))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    # stem
    return me

def leaf_material(name, palette):
    """palette: list of (r,g,b) picked per object through Object Info Random."""
    m, nt, bsdf = pass_material(name)
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    stops = [(i / max(1, len(palette) - 1), c) for i, c in enumerate(palette)]
    base = ramp(m, oi.outputs['Random'], stops)
    # veins: midrib + side veins from UV
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(m, tc.outputs['UV'], sep.inputs[0])
    mid = maprange(m, math_(m, 'ABSOLUTE', math_(m, 'SUBTRACT', sep.outputs['Y'], 0.5), 0), 0.0, 0.035, 1.0, 0.0)
    side = nt.nodes.new('ShaderNodeTexWave'); side.wave_type = 'BANDS'; side.bands_direction = 'DIAGONAL'
    side.inputs['Scale'].default_value = 9; L(m, tc.outputs['UV'], side.inputs['Vector'])
    sv = maprange(m, side.outputs['Fac'], 0.85, 1.0, 0.0, 0.6)
    veins = math_(m, 'MAXIMUM', mid, sv)
    spots = nt.nodes.new('ShaderNodeTexNoise'); spots.inputs['Scale'].default_value = 18; spots.inputs['Detail'].default_value = 6
    L(m, tc.outputs['Object'], spots.inputs['Vector'])
    dark = mixc(m, maprange(m, spots.outputs['Fac'], 0.45, 0.75, 0.0, 0.6), base.outputs['Color'], (0.06, 0.035, 0.015))
    col = mixc(m, math_(m, 'MULTIPLY', veins, 0.35), dark, (0.55, 0.45, 0.3))
    rough = maprange(m, spots.outputs['Fac'], 0.3, 0.7, 0.55, 0.85)
    nrm = bump(m, math_(m, 'ADD', math_(m, 'MULTIPLY', veins, -1.0), math_(m, 'MULTIPLY', spots.outputs['Fac'], 0.3)), 0.35, 0.0006)
    bsdf.inputs['Subsurface Weight'].default_value = 0.0
    return finish(m, col, rough, nrm)

def simple_material(name, color_a, color_b, rough=(0.6, 0.85), scale=30, bump_s=0.4):
    m, nt, bsdf = pass_material(name)
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8
    L(m, tc.outputs['Object'], nz.inputs['Vector'])
    fac = math_(m, 'MULTIPLY', math_(m, 'ADD', nz.outputs['Fac'], oi.outputs['Random']), 0.5)
    col = mixc(m, fac, color_a, color_b)
    rg = maprange(m, nz.outputs['Fac'], 0.3, 0.7, rough[0], rough[1])
    nrm = bump(m, nz.outputs['Fac'], bump_s, 0.002)
    return finish(m, col, rg, nrm)

def soil_plane(name, tile, mat_cols, roughness=(0.75, 0.95), disp=0.006, res=256):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=res, y_subdivisions=res, size=tile, location=(tile / 2, tile / 2, 0))
    ob = bpy.context.active_object; ob.name = name
    m, nt, bsdf = pass_material(name + '_mat')
    vec, w = torus_vector(m, 1, 1)
    n1 = noise4(m, vec, w, 3.0, 8, 0.6)
    n2 = noise4(m, vec, w, 18.0, 6, 0.6)
    vor = voronoi4(m, vec, w, 40.0)
    clump = maprange(m, n1.outputs['Fac'], 0.35, 0.7, 0, 1)
    col = mixc(m, clump, mat_cols[0], mat_cols[1])
    col = mixc(m, maprange(m, n2.outputs['Fac'], 0.55, 0.75, 0, 0.5), col, mat_cols[2])
    specks = maprange(m, vor.outputs['Distance'], 0.0, 0.12, 1.0, 0.0)
    col = mixc(m, math_(m, 'MULTIPLY', specks, 0.5), col, (0.32, 0.29, 0.25))
    rg = maprange(m, n2.outputs['Fac'], 0.3, 0.7, roughness[0], roughness[1])
    h = math_(m, 'ADD', math_(m, 'MULTIPLY', n1.outputs['Fac'], 1.0), math_(m, 'MULTIPLY', specks, 0.3))
    nrm = bump(m, math_(m, 'ADD', h, math_(m, 'MULTIPLY', n2.outputs['Fac'], 0.5)), 0.5, 0.004)
    finish(m, col, rg, nrm)
    ob.data.materials.append(m)
    # real displacement for height/AO (torus noise is evaluated in Python to keep tiling)
    from common import B as _B
    import util_noise
    me = ob.data
    for v in me.vertices:
        u = (v.co.x + tile / 2) / tile; vv = (v.co.y + tile / 2) / tile
        v.co.z = disp * util_noise.tor_fbm(u, vv, 4, 5)
    me.update()
    smooth(ob)
    return ob

def pebble(name, r, seed, flat=0.55):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r)
    ob = bpy.context.active_object; ob.name = name
    rnd = random.Random(seed)
    k = [rnd.uniform(0.75, 1.25) for _ in range(3)]
    for v in ob.data.vertices:
        n_ = v.co.normalized()
        d = 1 + 0.08 * math.sin(n_.x * 5 + seed) * math.cos(n_.y * 4 + seed * 1.3)
        v.co = Vector((v.co.x * k[0] * d, v.co.y * k[1] * d, v.co.z * flat * d))
    smooth(ob)
    return ob

def twig_mesh(name, length, r, seed):
    rnd = random.Random(seed)
    pts = []
    x = y = 0.0; a = 0.0
    for i in range(9):
        t = i / 8
        pts.append((x, y, r * 0.9 + 0.002 * math.sin(t * 7 + seed)))
        a += rnd.uniform(-0.35, 0.35)
        x += math.cos(a) * length / 8; y += math.sin(a) * length / 8
    ob = tube_from_points(name, pts, r, res=2)
    return ob

# ---------------------------------------------------------------- texture sets
def clear():
    reset_scene()

def set_forest_floor(name='forest_floor', n_leaves=2600, size=SIZE, green=0.15, twigs=60, pebbles=40, seed=3):
    clear()
    rnd = random.Random(seed)
    soil = soil_plane('Soil', TILE, [(0.035, 0.022, 0.012), (0.075, 0.05, 0.03), (0.11, 0.085, 0.06)])
    leaf_pal_dry = [(0.30, 0.13, 0.04), (0.42, 0.22, 0.06), (0.11, 0.07, 0.035), (0.24, 0.14, 0.06), (0.52, 0.34, 0.1), (0.07, 0.05, 0.03), (0.18, 0.1, 0.05), (0.36, 0.25, 0.12), (0.14, 0.1, 0.06)]
    leaf_pal_green = [(0.12, 0.17, 0.04), (0.22, 0.25, 0.06), (0.3, 0.3, 0.08)]
    mat_dry = leaf_material('LeafDry', leaf_pal_dry)
    mat_green = leaf_material('LeafGreen', leaf_pal_green)
    mat_twig = simple_material('Twig', (0.08, 0.055, 0.035), (0.2, 0.15, 0.1), scale=60)
    mat_peb = simple_material('Pebble', (0.18, 0.17, 0.15), (0.42, 0.39, 0.34), (0.45, 0.8), 25)
    shapes = [leaf_mesh(f'leafA{i}', rnd.uniform(0.06, 0.13), rnd.uniform(0.03, 0.06), lobes=rnd.choice([0, 0, 3, 4]), seed=i) for i in range(8)]
    objs = []
    for i in range(n_leaves):
        me = rnd.choice(shapes)
        ob = bpy.data.objects.new(f'leaf{i}', me)
        ob.data.materials.clear() if False else None
        bpy.context.scene.collection.objects.link(ob)
        ob.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), 0.003 + i * 0.000012 + rnd.uniform(0, 0.002))
        ob.rotation_euler = (rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35), rnd.uniform(0, 2 * math.pi))
        s = rnd.uniform(0.6, 1.3); ob.scale = (s, s, s)
        ob.material_slots and None
        ob.active_material = None
        mat = mat_green if rnd.random() < green else mat_dry
        if len(ob.data.materials) == 0: ob.data.materials.append(mat_dry)
        ob.material_slots[0].link = 'OBJECT'; ob.material_slots[0].material = mat
        objs.append(ob)
    for i in range(twigs):
        t = twig_mesh(f'twig{i}', rnd.uniform(0.08, 0.3), rnd.uniform(0.0025, 0.006), i)
        t.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), rnd.uniform(0.004, 0.02)); t.rotation_euler = (0, 0, rnd.uniform(0, 6.3))
        t.data.materials.append(mat_twig); objs.append(t)
    for i in range(pebbles):
        p = pebble(f'peb{i}', rnd.uniform(0.006, 0.02), i)
        p.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), rnd.uniform(0.0, 0.006)); p.rotation_euler = (0, 0, rnd.uniform(0, 6.3))
        p.data.materials.append(mat_peb); objs.append(p)
    wrap_copies(objs)
    bake_set(name, size, TILE, (TILE / 2, TILE / 2), samples=24, hmin=-0.006, hmax=0.04)

def set_dirt(name='dirt_path', size=SIZE, seed=5):
    clear()
    rnd = random.Random(seed)
    soil_plane('Soil', TILE, [(0.07, 0.048, 0.03), (0.13, 0.095, 0.065), (0.19, 0.15, 0.11)], (0.8, 0.97), disp=0.01)
    mat_peb = simple_material('Pebble', (0.22, 0.2, 0.17), (0.5, 0.46, 0.4), (0.5, 0.85), 25)
    mat_twig = simple_material('Twig', (0.1, 0.07, 0.045), (0.22, 0.17, 0.11), scale=60)
    mat_dry = leaf_material('LeafDry', [(0.3, 0.16, 0.06), (0.45, 0.3, 0.12), (0.22, 0.14, 0.07)])
    shapes = [leaf_mesh(f'leafA{i}', rnd.uniform(0.05, 0.08), rnd.uniform(0.03, 0.04), seed=i) for i in range(3)]
    objs = []
    for i in range(420):
        p = pebble(f'peb{i}', rnd.uniform(0.003, 0.016) if rnd.random() < 0.9 else rnd.uniform(0.02, 0.035), i, rnd.uniform(0.4, 0.8))
        p.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), rnd.uniform(-0.004, 0.004)); p.rotation_euler = (0, 0, rnd.uniform(0, 6.3))
        p.data.materials.append(mat_peb); objs.append(p)
    for i in range(70):
        ob = bpy.data.objects.new(f'leaf{i}', rnd.choice(shapes)); bpy.context.scene.collection.objects.link(ob)
        if len(ob.data.materials) == 0: ob.data.materials.append(mat_dry)
        ob.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), 0.006 + rnd.uniform(0, 0.003))
        ob.rotation_euler = (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), rnd.uniform(0, 6.3)); objs.append(ob)
    for i in range(25):
        t = twig_mesh(f'twig{i}', rnd.uniform(0.05, 0.18), rnd.uniform(0.002, 0.004), i)
        t.location = (rnd.uniform(0, TILE), rnd.uniform(0, TILE), 0.005); t.rotation_euler = (0, 0, rnd.uniform(0, 6.3))
        t.data.materials.append(mat_twig); objs.append(t)
    wrap_copies(objs)
    bake_set(name, size, TILE, (TILE / 2, TILE / 2), samples=24, hmin=-0.012, hmax=0.03)

def set_riverbed(name='riverbed', size=SIZE, seed=7):
    clear()
    rnd = random.Random(seed)
    soil_plane('Sand', TILE, [(0.16, 0.14, 0.11), (0.24, 0.21, 0.16), (0.3, 0.27, 0.22)], (0.55, 0.85), disp=0.006)
    mats = [simple_material(f'Peb{i}', a, b, (0.3, 0.6), 20) for i, (a, b) in enumerate([
        ((0.2, 0.19, 0.17), (0.38, 0.36, 0.32)), ((0.25, 0.2, 0.15), (0.45, 0.38, 0.3)), ((0.14, 0.14, 0.14), (0.3, 0.3, 0.29))])]
    objs = []
    placed = []
    for i in range(1400):
        r = rnd.choice([rnd.uniform(0.008, 0.02), rnd.uniform(0.02, 0.045), rnd.uniform(0.045, 0.07)]) if rnd.random() < 0.7 else rnd.uniform(0.004, 0.012)
        x, y = rnd.uniform(0, TILE), rnd.uniform(0, TILE)
        p = pebble(f'p{i}', r, i, rnd.uniform(0.35, 0.65))
        p.location = (x, y, rnd.uniform(-0.3, 0.1) * r); p.rotation_euler = (0, 0, rnd.uniform(0, 6.3))
        p.data.materials.append(rnd.choice(mats)); objs.append(p)
    wrap_copies(objs, margin=0.1)
    bake_set(name, size, TILE, (TILE / 2, TILE / 2), samples=24, hmin=-0.02, hmax=0.05)

def procedural_plane(name, build, size, scale=1.0):
    clear()
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0.5, 0.5, 0))
    ob = bpy.context.active_object
    m, nt, bsdf = pass_material(name)
    h_socket = build(m, nt)
    ob.data.materials.append(m)
    # height pass reads from the material instead of geometry: route via displacement-free emission
    m['hsrc'] = h_socket.node.name + '|' + h_socket.identifier
    setup_render(size, 1.0, (0.5, 0.5))
    base = lambda k: os.path.join(OUT, f'_{name}_{k}.png')
    render_pass('albedo', base('albedo'), 8, data=False)
    render_pass('normal', base('normal'), 8)
    render_pass('rough', base('rough'), 8)
    # AO + height from the procedural height signal
    nt2 = m.node_tree
    out = next(n for n in nt2.nodes if n.type == 'OUTPUT_MATERIAL')
    em = nt2.nodes['PASS_EM']
    for l in list(em.inputs['Color'].links): nt2.links.remove(l)
    L(m, sock(nt2, m['hsrc']), em.inputs['Color'])
    for l in list(out.inputs['Surface'].links): nt2.links.remove(l)
    L(m, em.outputs[0], out.inputs['Surface'])
    sc = bpy.context.scene; sc.render.filepath = base('height'); sc.render.image_settings.color_depth = '16'; bpy.ops.render.render(write_still=True)
    # AO approximated from height (cavity) in numpy
    from PIL import Image, ImageFilter
    h = np.asarray(Image.open(base('height')).convert('L'), np.float32) / 255
    blur = np.asarray(Image.fromarray((h * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size / 96)), np.float32) / 255
    ao = np.clip(1 - (blur - h) * 4, 0.35, 1)
    ao = ao * (0.75 + 0.25 * h)
    Image.fromarray((ao * 255).astype(np.uint8)).save(base('ao'))
    pack(name, size // 2 if size >= 2048 else None)
    print('baked', name)

def build_rock(m, nt):
    vec, w = torus_vector(m, 1, 1)
    n1 = noise4(m, vec, w, 2.0, 10, 0.62)
    n2 = noise4(m, vec, w, 9, 8, 0.6)
    # domain-warped sparse cracks
    warp = noise4(m, vec, w, 2.5, 4, 0.5)
    wv = nt.nodes.new('ShaderNodeVectorMath'); wv.operation = 'MULTIPLY_ADD'
    L(m, warp.outputs['Color'], wv.inputs[0]); wv.inputs[1].default_value = (0.35, 0.35, 0.35); L(m, vec, wv.inputs[2])
    vor = voronoi4(m, wv.outputs[0], w, 2.2, 'DISTANCE_TO_EDGE')
    mask = noise4(m, vec, w, 3.0, 3, 0.5)
    crack_line = maprange(m, vor.outputs['Distance'], 0.0, 0.012, 1.0, 0.0)
    crack = math_(m, 'MULTIPLY', crack_line, maprange(m, mask.outputs['Fac'], 0.45, 0.6, 0.0, 1.0))
    # mineral grain
    g1 = voronoi4(m, vec, w, 160.0)
    g2 = voronoi4(m, vec, w, 70.0)
    base = ramp(m, n1.outputs['Fac'], [(0.25, (0.16, 0.155, 0.145)), (0.5, (0.3, 0.29, 0.27)), (0.75, (0.43, 0.42, 0.39))])
    col = mixc(m, maprange(m, n2.outputs['Fac'], 0.35, 0.65, 0.0, 0.55), base.outputs['Color'], (0.09, 0.087, 0.082))
    col = mixc(m, math_(m, 'MULTIPLY', maprange(m, g1.outputs['Distance'], 0.0, 0.3, 1.0, 0.0), 0.5), col, (0.06, 0.06, 0.06))
    col = mixc(m, math_(m, 'MULTIPLY', maprange(m, g2.outputs['Distance'], 0.0, 0.18, 1.0, 0.0), 0.35), col, (0.6, 0.57, 0.53))
    lich = noise4(m, vec, w, 5.0, 6, 0.7)
    lm = maprange(m, lich.outputs['Fac'], 0.55, 0.64, 0.0, 0.85)
    col = mixc(m, lm, col, (0.4, 0.44, 0.28))
    lich2 = noise4(m, vec, w, 18.0, 4, 0.6)
    col = mixc(m, maprange(m, lich2.outputs['Fac'], 0.68, 0.72, 0.0, 0.7), col, (0.62, 0.62, 0.55))
    col = mixc(m, crack, col, (0.035, 0.033, 0.03))
    h = math_(m, 'SUBTRACT', math_(m, 'ADD', math_(m, 'MULTIPLY', n1.outputs['Fac'], 0.75), math_(m, 'MULTIPLY', n2.outputs['Fac'], 0.25)), math_(m, 'MULTIPLY', crack, 0.35))
    rg = maprange(m, n2.outputs['Fac'], 0.3, 0.7, 0.6, 0.88)
    finish(m, col, rg, bump(m, math_(m, 'ADD', h, math_(m, 'MULTIPLY', g1.outputs['Distance'], 0.03)), 0.8, 0.02))
    return h

def build_moss(m, nt):
    vec, w = torus_vector(m, 1, 1)
    n1 = noise4(m, vec, w, 4, 6, 0.6)
    v1 = voronoi4(m, vec, w, 60.0)
    v2 = voronoi4(m, vec, w, 16.0)
    fuzz = noise4(m, vec, w, 160, 3, 0.7)
    tufts = math_(m, 'ADD', math_(m, 'MULTIPLY', maprange(m, v1.outputs['Distance'], 0.0, 0.6, 1.0, 0.0), 0.6), math_(m, 'MULTIPLY', maprange(m, v2.outputs['Distance'], 0.0, 0.7, 1.0, 0.0), 0.4))
    h = math_(m, 'ADD', tufts, math_(m, 'MULTIPLY', fuzz.outputs['Fac'], 0.25))
    base = ramp(m, n1.outputs['Fac'], [(0.3, (0.05, 0.09, 0.015)), (0.55, (0.12, 0.2, 0.03)), (0.75, (0.22, 0.3, 0.05))])
    col = mixc(m, maprange(m, h, 0.2, 1.0, 0.0, 1.0), (0.025, 0.04, 0.01), base.outputs['Color'])
    col = mixc(m, maprange(m, fuzz.outputs['Fac'], 0.6, 0.75, 0.0, 0.4), col, (0.35, 0.42, 0.12))
    rg = maprange(m, fuzz.outputs['Fac'], 0.3, 0.7, 0.85, 1.0)
    finish(m, col, rg, bump(m, h, 0.9, 0.01))
    return maprange(m, h, 0.0, 1.25, 0.0, 1.0)

def build_bark(m, nt):
    vec, w = torus_vector(m, 1, 1)  # tile spans 1 x 1; u around trunk, v along trunk
    # stretched sample space: high frequency around, low along
    sep_vec = nt.nodes.new('ShaderNodeVectorMath'); sep_vec.operation = 'MULTIPLY'
    sep_vec.inputs[1].default_value = (1.0, 1.0, 0.25); L(m, vec, sep_vec.inputs[0])
    wv = math_(m, 'MULTIPLY', w, 0.25)
    n1 = noise4(m, sep_vec.outputs[0], wv, 6, 8, 0.6, distortion=0.4)
    vor = voronoi4(m, sep_vec.outputs[0], wv, 7.0, 'DISTANCE_TO_EDGE')
    fiss = maprange(m, vor.outputs['Distance'], 0.0, 0.08, 0.0, 1.0)
    plates = math_(m, 'MULTIPLY', fiss, maprange(m, n1.outputs['Fac'], 0.3, 0.7, 0.6, 1.0))
    fine = noise4(m, vec, w, 60, 6, 0.6)
    h = math_(m, 'ADD', plates, math_(m, 'MULTIPLY', fine.outputs['Fac'], 0.15))
    base = ramp(m, n1.outputs['Fac'], [(0.3, (0.09, 0.07, 0.055)), (0.55, (0.18, 0.15, 0.12)), (0.8, (0.27, 0.24, 0.2))])
    col = mixc(m, math_(m, 'SUBTRACT', 1.0, fiss), base.outputs['Color'], (0.03, 0.022, 0.016))
    moss = noise4(m, vec, w, 3.0, 5, 0.6)
    col = mixc(m, math_(m, 'MULTIPLY', maprange(m, moss.outputs['Fac'], 0.55, 0.68, 0.0, 0.8), fiss), col, (0.12, 0.17, 0.04))
    col = mixc(m, maprange(m, fine.outputs['Fac'], 0.62, 0.7, 0.0, 0.35), col, (0.38, 0.38, 0.33))
    rg = maprange(m, fine.outputs['Fac'], 0.3, 0.7, 0.75, 0.95)
    finish(m, col, rg, bump(m, h, 1.0, 0.02))
    return maprange(m, h, 0.0, 1.15, 0.0, 1.0)

def set_leaf_atlas(name='leaf_atlas', size=SIZE, seed=11):
    """Alpha-tested foliage cards: 2x2 atlas of leafy twigs (top-down render with transparency)."""
    clear()
    rnd = random.Random(seed)
    green = [(0.06, 0.11, 0.02), (0.1, 0.16, 0.03), (0.14, 0.2, 0.04), (0.08, 0.14, 0.035)]
    mat = leaf_material('Leaf', green)
    mat_tw = simple_material('Twig', (0.08, 0.06, 0.04), (0.16, 0.12, 0.08), scale=80)
    for cell in range(4):
        cx, cy = (cell % 2) + 0.5, (cell // 2) + 0.5
        shapes = [leaf_mesh(f'l{cell}{i}', rnd.uniform(0.11, 0.16), rnd.uniform(0.05, 0.075), seed=cell * 10 + i) for i in range(3)]
        # main twig from bottom of the cell upward
        pts = []
        for k in range(12):
            t = k / 11
            pts.append((cx + 0.04 * math.sin(t * 3 + cell), cy - 0.45 + t * 0.85, 0.01))
        tw = tube_from_points(f'tw{cell}', pts, 0.006, res=2); tw.data.materials.append(mat_tw)
        nleaf = 26 + cell * 4
        for i in range(nleaf):
            t = 0.12 + 0.88 * i / nleaf
            px, py = cx + 0.04 * math.sin(t * 3 + cell), cy - 0.45 + t * 0.85
            side = 1 if i % 2 else -1
            ang = math.pi / 2 + side * rnd.uniform(0.6, 1.2) * (1 - 0.4 * t)
            L_ = 0.14 * (1 - 0.35 * t)
            ob = bpy.data.objects.new(f'leaf{cell}_{i}', rnd.choice(shapes)); bpy.context.scene.collection.objects.link(ob)
            if len(ob.data.materials) == 0: ob.data.materials.append(mat)
            ob.location = (px + math.cos(ang) * L_ * 0.5, py + math.sin(ang) * L_ * 0.5, 0.02 + i * 0.001)
            ob.rotation_euler = (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), ang)
            s = rnd.uniform(0.8, 1.15) * (1 - 0.3 * t); ob.scale = (s, s, s)
    # alpha: leaves are opaque cut-outs against a transparent film
    bpy.context.scene.render.film_transparent = True
    bake_set(name, size, 2.0, (1.0, 1.0), samples=16, alpha=True, hmin=0.0, hmax=0.05)

def set_fern(name='fern', size=SIZE // 2, seed=13):
    clear()
    rnd = random.Random(seed)
    mat = leaf_material('Fern', [(0.07, 0.13, 0.025), (0.12, 0.19, 0.035), (0.09, 0.16, 0.03)])
    mat_tw = simple_material('Stem', (0.08, 0.1, 0.03), (0.12, 0.15, 0.05), scale=80)
    pts = [(0.5 + 0.03 * math.sin(t * 2.5), 0.02 + t * 0.95, 0.01) for t in [k / 15 for k in range(16)]]
    st = tube_from_points('stem', pts, 0.006, res=2); st.data.materials.append(mat_tw)
    shape = leaf_mesh('pinna', 0.2, 0.05, seed=3)
    for i in range(34):
        t = 0.05 + 0.92 * i / 34
        for side in (-1, 1):
            Lp = 0.2 * math.sin(math.pi * min(1, t * 1.08)) * (1.05 - t * 0.5) + 0.02
            px, py = 0.5 + 0.03 * math.sin(t * 2.5), 0.02 + t * 0.95
            ob = bpy.data.objects.new('p', shape); bpy.context.scene.collection.objects.link(ob)
            if len(ob.data.materials) == 0: ob.data.materials.append(mat)
            ang = (0 if side > 0 else math.pi) + side * (0.35 + 0.2 * t)
            ob.location = (px + math.cos(ang) * Lp * 0.5, py + math.sin(ang) * Lp * 0.5, 0.02)
            ob.rotation_euler = (0, 0, ang); s = Lp / 0.2; ob.scale = (s, s * 0.9, s)
    bpy.context.scene.render.film_transparent = True
    bake_set(name, size, 1.0, (0.5, 0.5), samples=16, alpha=True, hmin=0.0, hmax=0.05)

SETS = {
    'forest_floor': lambda: set_forest_floor(size=SIZE),
    'dirt_path': lambda: set_dirt(size=SIZE),
    'riverbed': lambda: set_riverbed(size=SIZE),
    'rock': lambda: procedural_plane('rock', build_rock, SIZE),
    'moss': lambda: procedural_plane('moss', build_moss, SIZE),
    'bark': lambda: procedural_plane('bark', build_bark, SIZE),
    'leaf_atlas': lambda: set_leaf_atlas(size=SIZE),
    'fern': lambda: set_fern(size=max(512, SIZE // 2)),
}
for k, fn in SETS.items():
    if ONLY and k not in ONLY:
        continue
    fn()
