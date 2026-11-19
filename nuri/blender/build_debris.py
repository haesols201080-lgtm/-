"""Forest-floor detail for the robot's eye level, built in Blender: pine cones (phyllotaxis scales), mushrooms
(red-capped amanita with warts and gills, bolete, a cluster of small caps, shelf fungus for logs) and moss cushions.
AO is baked into vertex colors; base colors are material factors.  usage: python build_debris.py <out_dir>"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix, Euler, noise

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try: bpy.ops.preferences.addon_enable(module='cycles')
    except Exception: pass

def mat(name, color, rough=0.7, sss=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    return m

def sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def join(objs, name):
    sel(objs); bpy.ops.object.join(); o = bpy.context.active_object; o.name = name; return o

def smooth(o):
    o.data.polygons.foreach_set('use_smooth', [True] * len(o.data.polygons)); o.data.update(); return o

def bake_ao(objs, dist=0.05):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32
    sc.world = bpy.data.worlds.new('W')
    try: sc.world.light_settings.distance = dist
    except Exception: pass
    for o in objs:
        ca = o.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); o.data.color_attributes.active_color = ca
    sel(objs); bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)
    for o in objs:
        ca = o.data.color_attributes.active_color
        for d in ca.data:
            c = d.color; k = 0.5 + 0.5 * c[0]
            d.color = (k, k, k, 1.0)

def export(objs, path):
    sel(objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_yup=True)
    print('DEBRIS', os.path.basename(path), round(os.path.getsize(path) / 1e3), 'KB')

def apply(o):
    sel([o])
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

# ---------------------------------------------------------------- pine cones
def pine_cone(name, seed, length=0.08, open_=0.6, weather=0.0):
    rnd = random.Random(seed)
    parts = []
    n = 70
    ga = math.pi * (3 - math.sqrt(5))
    m_scale = mat('ConeScale', (0.24 - weather * 0.06, 0.14 - weather * 0.02, 0.07 + weather * 0.03), 0.78)
    for i in range(n):
        t = i / (n - 1)                       # 0 base -> 1 tip
        z = length * (0.05 + 0.9 * t)
        rad = length * 0.3 * math.sin(math.pi * min(1, 0.15 + t * 0.95)) ** 0.8
        a = i * ga
        size = length * (0.11 + 0.12 * math.sin(math.pi * min(1, t * 1.1 + 0.05)))
        # rounded woody scale: flattened ellipsoid whose base tucks into the core and whose tip flares outward
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
        s = bpy.context.active_object
        for v in s.data.vertices:
            u = v.co.y  # -1 base .. 1 tip
            th = 0.32 + 0.22 * max(0.0, u)          # thicker apophysis at the tip
            v.co = Vector((v.co.x * size * 0.62, (u + 1) * 0.5 * size * 1.05, v.co.z * size * th))
            v.co.z += size * 0.12 * max(0.0, u) ** 2  # tip curls up
        tilt = (0.35 + open_ * 0.75) * (1 - t * 0.45) + rnd.uniform(-0.1, 0.1)
        # local +y points outward from the axis, tilted toward the tip
        s.rotation_euler = Euler((tilt - math.pi / 2 + math.pi / 2, 0, a - math.pi / 2), 'XYZ')
        s.location = (math.cos(a) * rad * 0.55, math.sin(a) * rad * 0.55, z)
        apply(s)
        for v in s.data.vertices:
            v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * size * 0.02
        s.data.materials.append(m_scale); parts.append(s)
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=length * 0.12, depth=length * 0.85, location=(0, 0, length * 0.45))
    core = bpy.context.active_object; core.data.materials.append(m_scale); parts.append(core)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=length * 0.05, depth=length * 0.12, location=(0, 0, -length * 0.02))
    stalk = bpy.context.active_object; stalk.data.materials.append(m_scale); parts.append(stalk)
    o = join(parts, name); smooth(o)
    # lie the cone on its side, resting on the ground (y=0 after export)
    o.rotation_euler = (math.pi / 2 + rnd.uniform(-0.2, 0.2), 0, 0); sel([o]); bpy.ops.object.transform_apply(rotation=True)
    zmin = min(v.co.z for v in o.data.vertices)
    for v in o.data.vertices: v.co.z -= zmin + length * 0.04
    return o

# ---------------------------------------------------------------- mushrooms
def cap_mesh(name, r, h, flat=0.3, gills=True, m_cap=None, m_gill=None):
    """dome cap: lathe profile; underside with radial gill ridges"""
    bm = bmesh.new()
    seg, rings = 36, 10
    verts = []
    for j in range(rings + 1):
        t = 0.06 + 0.94 * j / rings          # start just below the apex so the top closes with a clean fan
        ang = t * math.pi / 2
        rr = r * math.sin(ang) ** (0.7 + flat)
        zz = h * math.cos(ang) ** (1.0 + flat)
        row = []
        for i in range(seg):
            a = i / seg * 2 * math.pi
            row.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, zz)))
        verts.append(row)
    for j in range(rings):
        for i in range(seg):
            bm.faces.new((verts[j][i], verts[j][(i + 1) % seg], verts[j + 1][(i + 1) % seg], verts[j + 1][i]))
    top = bm.verts.new((0, 0, h))
    for i in range(seg): bm.faces.new((top, verts[0][i], verts[0][(i + 1) % seg]))
    # underside: slightly concave disc with ridges
    under = []
    for i in range(seg * 2):
        a = i / (seg * 2) * 2 * math.pi
        ridge = 0.0 if not gills else (0.006 * r / 0.04 if i % 2 else 0)
        under.append(bm.verts.new((math.cos(a) * r * 0.97, math.sin(a) * r * 0.97, -0.002 + ridge * 0)))
    center = bm.verts.new((0, 0, h * 0.15))
    for i in range(seg * 2):
        f = bm.faces.new((center, under[i], under[(i + 1) % (seg * 2)]))
        if gills and i % 2: f.verts[1].co.z += r * 0.04
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(m_cap); o.data.materials.append(m_gill)
    # underside faces use the gill material
    for p in o.data.polygons:
        if p.center.z < h * 0.18 and all(o.data.vertices[v].co.z < h * 0.2 for v in p.vertices) and p.normal.z < 0: p.material_index = 1
    return smooth(o)

def stem(name, r0, r1, h, m, bend=0.0, seed=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1, depth=1)
    o = bpy.context.active_object; o.name = name
    for v in o.data.vertices:
        t = v.co.z + 0.5
        rr = r0 + (r1 - r0) * t
        v.co.x *= rr; v.co.y *= rr; v.co.z = t * h
        v.co.x += bend * t * t * h
    o.data.materials.append(m); return smooth(o)

def amanita(name, seed, s=1.0):
    rnd = random.Random(seed)
    mc = mat('AmanitaCap', (0.62, 0.05, 0.02), 0.45); mg = mat('Gills', (0.86, 0.82, 0.72), 0.8); ms = mat('StemWhite', (0.85, 0.82, 0.74), 0.7)
    mw = mat('Warts', (0.92, 0.9, 0.82), 0.85)
    h = 0.11 * s
    st = stem(name + '_stem', 0.011 * s, 0.008 * s, h, ms, rnd.uniform(-0.1, 0.1))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.016 * s, location=(0, 0, 0.008 * s))
    bulb = bpy.context.active_object; bulb.scale.z = 0.6; bulb.data.materials.append(ms); smooth(bulb)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.011 * s, minor_radius=0.003 * s, location=(0, 0, h * 0.75))
    ringo = bpy.context.active_object; ringo.data.materials.append(ms); smooth(ringo)
    cap = cap_mesh(name + '_cap', 0.045 * s, 0.022 * s, flat=0.35, m_cap=mc, m_gill=mg); cap.location.z = h - 0.004 * s
    parts = [st, bulb, ringo, cap]
    for i in range(26):
        a = rnd.uniform(0, 6.28); t = math.sqrt(rnd.random()) * 0.9
        ang = t * math.pi / 2
        rr = 0.045 * s * math.sin(ang) ** 1.05; zz = 0.022 * s * math.cos(ang) ** 1.35
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.0025 * s * rnd.uniform(0.6, 1.3), location=(math.cos(a) * rr, math.sin(a) * rr, h - 0.004 * s + zz + 0.001))
        w = bpy.context.active_object; w.scale.z = 0.55; w.data.materials.append(mw); parts.append(w)
    return join(parts, name)

def bolete(name, seed, s=1.0):
    rnd = random.Random(seed)
    mc = mat('BoleteCap', (0.32, 0.17, 0.07), 0.5); mg = mat('Pores', (0.72, 0.62, 0.32), 0.85); ms = mat('BoleteStem', (0.72, 0.62, 0.48), 0.75)
    h = 0.06 * s
    st = stem(name + '_stem', 0.016 * s, 0.012 * s, h, ms, rnd.uniform(-0.05, 0.05))
    for v in st.data.vertices:
        t = v.co.z / h; f = 1 + 0.6 * math.sin(t * math.pi) * (1 - t)
        v.co.x *= f; v.co.y *= f
    cap = cap_mesh(name + '_cap', 0.04 * s, 0.026 * s, flat=0.0, gills=False, m_cap=mc, m_gill=mg); cap.location.z = h - 0.006 * s
    return join([st, cap], name)

def small_cluster(name, seed):
    rnd = random.Random(seed)
    mc = mat('SmallCap', (0.55, 0.42, 0.26), 0.55); mg = mat('SmallGills', (0.8, 0.72, 0.58), 0.85); ms = mat('SmallStem', (0.62, 0.52, 0.38), 0.7)
    parts = []
    for i in range(7):
        a = rnd.uniform(0, 6.28); d = rnd.uniform(0, 0.025)
        h = rnd.uniform(0.03, 0.065); r = rnd.uniform(0.008, 0.014)
        st = stem(f'{name}_s{i}', 0.0025, 0.002, h, ms, rnd.uniform(-0.25, 0.25)); st.location = (math.cos(a) * d, math.sin(a) * d, 0)
        st.rotation_euler = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), 0)
        cap = cap_mesh(f'{name}_c{i}', r, r * 0.9, flat=-0.2, m_cap=mc, m_gill=mg)
        cap.parent = st; cap.location = (0, 0, h - 0.002)
        sel([st, cap]); bpy.context.view_layer.objects.active = st
        parts += [st, cap]
    for p in parts:
        mw = p.matrix_world.copy(); p.parent = None; p.matrix_world = mw
    return join(parts, name)

def bracket(name, seed):
    rnd = random.Random(seed)
    mc = mat('ShelfTop', (0.42, 0.33, 0.24), 0.75); mg = mat('ShelfUnder', (0.82, 0.76, 0.64), 0.85)
    parts = []
    for i in range(3):
        r = 0.06 - i * 0.012
        c = cap_mesh(f'{name}_{i}', r, r * 0.3, flat=0.6, gills=False, m_cap=mc, m_gill=mg)
        for v in c.data.vertices:
            if v.co.y < 0: v.co.y *= 0.15   # half shelf against the bark (bark side = -y)
            v.co.z += 0.004 * math.sin(math.atan2(v.co.y, v.co.x) * 9) * (math.hypot(v.co.x, v.co.y) / r)
        c.location = (rnd.uniform(-0.02, 0.02), 0, i * 0.035)
        parts.append(c)
    return join(parts, name)

# ---------------------------------------------------------------- moss cushions
def moss_cushion(name, seed, r=0.12):
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, radius=r)
    o = bpy.context.active_object; o.name = name
    mm = mat('MossCushion', (0.16, 0.26, 0.05), 0.95)
    o.data.materials.append(mm)
    for v in o.data.vertices:
        p = v.co.copy()
        n_ = p.normalized()
        bump = 0.25 * noise.noise(p * (8 / r) + Vector((seed, 0, 0))) + 0.08 * noise.noise(p * (40 / r))
        lob = 1 + 0.3 * noise.noise(Vector((n_.x * 2, n_.y * 2, seed)))
        p = n_ * r * lob * (1 + bump)
        p.z = max(p.z * 0.45, -r * 0.05)
        v.co = p
    smooth(o)
    return o

def build():
    reset()
    for i, (op, w) in enumerate(((0.75, 0.0), (0.25, 0.0), (0.9, 0.7))):
        reset(); o = pine_cone(f'pinecone_{i}', i * 7 + 1, 0.075 + i * 0.01, op, w); bake_ao([o], 0.02); export([o], f'{OUT}/pinecone_{i}.glb')
    reset(); o = amanita('mush_amanita', 3, 1.0); bake_ao([o], 0.03); export([o], f'{OUT}/mush_amanita.glb')
    reset(); o = bolete('mush_bolete', 5, 1.0); bake_ao([o], 0.03); export([o], f'{OUT}/mush_bolete.glb')
    reset(); o = small_cluster('mush_cluster', 7); bake_ao([o], 0.02); export([o], f'{OUT}/mush_cluster.glb')
    reset(); o = bracket('mush_bracket', 9); bake_ao([o], 0.03); export([o], f'{OUT}/mush_bracket.glb')

build()
