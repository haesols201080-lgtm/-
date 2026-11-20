"""Builds forest environment meshes in Blender and exports them as GLB (geometry + UVs + baked AO vertex colors).
Materials are only named; the game binds the baked texture sets by material name.

  rocks:   faceted boulders (random plane chipping + fbm), AO baked to vertex colors
  trees:   trunk with buttress flare + surface roots + branches (bark UVs), leaf cards (atlas UVs)
  logs/stumps, outcrop with a walk-through tunnel cave (voxel remeshed), mushrooms

usage: python build_env.py <out_dir> [only ...]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix, noise
from common import *

OUT = sys.argv[1]
ONLY = sys.argv[2:]
os.makedirs(OUT, exist_ok=True)

def named_mat(name):
    return bpy.data.materials.get(name) or bpy.data.materials.new(name)

def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

def bake_ao_vcol(objs, dist=0.6, samples=48):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples
    for o in objs:
        me = o.data
        ca = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
        try: me.color_attributes.render_color_index = me.color_attributes.active_color_index
        except Exception: pass
    w = bpy.data.worlds.new('AOW'); sc.world = w
    try: w.light_settings.distance = dist
    except Exception: pass
    for o in objs:
        select_only([o])
        if not o.data.materials:
            o.data.materials.append(named_mat('tmp'))
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

def export_glb(objs, path):
    select_only(objs)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_materials='PLACEHOLDER', export_vertex_color='ACTIVE', export_yup=True,
                              export_normals=True, export_tangents=False, export_animations=False, export_skins=False)
    print('exported', path)

def apply_all(ob):
    select_only([ob])
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def decimate(ob, ratio):
    m = ob.modifiers.new('Dec', 'DECIMATE'); m.ratio = ratio
    apply_all(ob)

def smart_uv(ob, angle=66, margin=0.01):
    select_only([ob])
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')

def fbm3(p, oct=5, lac=2.0, gain=0.5, seed=0.0):
    s, a, f, nrm = 0.0, 1.0, 1.0, 0.0
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    for _ in range(oct):
        s += a * noise.noise(p * f + off); nrm += a; a *= gain; f *= lac
    return s / nrm

# ------------------------------------------------------------------ rocks
def make_rock(name, seed, size=(1, 1, 0.7), planes=14, detail=6):
    rnd = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail, radius=1)
    ob = bpy.context.active_object; ob.name = name
    pls = []
    for _ in range(planes):
        n_ = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.6, 1))).normalized()
        pls.append((n_, rnd.uniform(0.62, 0.9)))
    for v in ob.data.vertices:
        p = v.co.copy()
        r = 1 + 0.18 * fbm3(p * 1.3, 4, seed=seed) + 0.04 * fbm3(p * 6, 3, seed=seed + 1)
        p *= r
        for n_, d in pls:
            k = p.dot(n_)
            if k > d:
                p -= n_ * (k - d) * rnd.uniform(0.9, 1.0) if False else n_ * (k - d)
        p += p.normalized() * (0.012 * fbm3(p * 14, 3, seed=seed + 2))
        v.co = Vector((p.x * size[0], p.y * size[1], max(p.z * size[2], -0.25 * size[2])))
    smooth(ob)
    decimate(ob, 0.18)
    smart_uv(ob)
    ob.data.materials.append(named_mat('Rock'))
    # origin at bottom center
    zmin = min(v.co.z for v in ob.data.vertices)
    for v in ob.data.vertices: v.co.z -= zmin + 0.05 * size[2]
    return ob

def build_rocks():
    reset_scene()
    specs = [(1, (1.0, 0.9, 0.62)), (2, (1.2, 0.8, 0.55)), (3, (0.9, 0.9, 0.85)), (4, (1.3, 1.0, 0.5)), (5, (0.8, 0.7, 0.6))]
    for i, (seed, size) in enumerate(specs):
        reset_scene()
        r = make_rock(f'rock_{i}', seed * 7, size)
        bake_ao_vcol([r], dist=0.5)
        export_glb([r], os.path.join(OUT, f'rock_{i}.glb'))

# ------------------------------------------------------------------ generalized tubes
def tube_mesh(name, spine, radius_fn, radial=16, uv_density=1.0, cap=False, flare_fn=None):
    """spine: list of Vector points; radius_fn(t, theta) -> r. Bark UVs: u around (wraps at 1), v along length."""
    verts, faces, uvs = [], [], []
    n = len(spine)
    # parallel-transport frames
    tangents = []
    for i in range(n):
        a = spine[max(0, i - 1)]; b = spine[min(n - 1, i + 1)]
        tangents.append((b - a).normalized())
    up = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.95 else Vector((1, 0, 0))
    nrm = tangents[0].cross(up).normalized()
    frames = []
    for i in range(n):
        if i > 0:
            t0, t1 = tangents[i - 1], tangents[i]
            ax = t0.cross(t1)
            if ax.length > 1e-6:
                ang = t0.angle(t1)
                nrm = (Matrix.Rotation(ang, 3, ax.normalized()) @ nrm).normalized()
        frames.append((nrm.copy(), tangents[i].cross(nrm).normalized()))
    length = 0.0
    circ0 = 2 * math.pi * radius_fn(0, 0)
    for i in range(n):
        if i > 0: length += (spine[i] - spine[i - 1]).length
        t = i / (n - 1)
        N_, Bn = frames[i]
        for j in range(radial + 1):
            th = j / radial * 2 * math.pi
            r = radius_fn(t, th)
            p = spine[i] + (N_ * math.cos(th) + Bn * math.sin(th)) * r
            verts.append(p)
            uvs.append((j / radial * max(1, round(circ0 * uv_density)), length * uv_density))
    for i in range(n - 1):
        for j in range(radial):
            a = i * (radial + 1) + j; b = a + 1; c = a + radial + 1; d = c + 1
            faces.append((a, b, d, c))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def join(objs, name):
    select_only(objs)
    bpy.ops.object.join()
    ob = bpy.context.active_object; ob.name = name
    return ob

def make_tree(name, seed, height=11, r0=0.55, lod=0):
    rnd = random.Random(seed)
    radial = [20, 10][lod]
    rings = [44, 16][lod]
    parts = []
    lean = Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0))
    spine = []
    for i in range(rings):
        t = (i / (rings - 1)) ** 1.35
        z = t * height
        off = lean * t * t + Vector((math.sin(t * 5 + seed) * 0.12, math.cos(t * 4 + seed) * 0.12, 0)) * t
        spine.append(Vector((off.x, off.y, z - 0.25)))
    nb = rnd.randint(4, 6)
    roots_th = [i / nb * 2 * math.pi + rnd.uniform(-0.3, 0.3) for i in range(nb)]
    def trunk_r(t, th):
        z = t * height
        base = r0 * (1 - 0.72 * t ** 0.8)
        flare = math.exp(-z / 0.9) * 0.9
        b = sum(max(0.0, math.cos(th - a)) ** 6 for a in roots_th)
        bark = 0.04 * noise.noise(Vector((math.cos(th) * 3, math.sin(th) * 3, z * 1.5 + seed)))
        return base * (1 + flare * (0.35 + b) + bark)
    trunk = tube_mesh('trunk', spine, trunk_r, radial, uv_density=0.8)
    parts.append(trunk)
    # surface roots
    if lod == 0:
        for a in roots_th:
            L_ = rnd.uniform(1.4, 2.6) * r0 / 0.55
            pts = []
            for k in range(14):
                t = k / 13
                d = r0 * 0.6 + t * L_
                wob = 0.25 * math.sin(t * 6 + a * 3) * t
                pts.append(Vector((math.cos(a + wob * 0.3) * d, math.sin(a + wob * 0.3) * d, 0.35 * r0 * (1 - t) ** 1.5 - 0.06 - 0.05 * t)))
            rr = rnd.uniform(0.22, 0.32) * r0
            parts.append(tube_mesh('root', pts, lambda t, th, rr=rr: rr * (1 - 0.85 * t) * (1 + 0.25 * max(0, math.sin(th)) ), 10, uv_density=0.8))
    # branches + leaf clusters
    leaf_centers = []
    nbranch = rnd.randint(6, 9)
    for i in range(nbranch):
        t0 = rnd.uniform(0.5, 0.9)
        idx = int(t0 * (rings - 1)); p0 = spine[idx]
        az = i / nbranch * 2 * math.pi + rnd.uniform(-0.4, 0.4)
        L_ = rnd.uniform(2.5, 4.8) * (1.1 - t0 * 0.4) * height / 11
        br = r0 * 0.28 * (1 - t0 * 0.6)
        pts = []
        for k in range(10):
            t = k / 9
            pts.append(p0 + Vector((math.cos(az) * L_ * t, math.sin(az) * L_ * t, L_ * (0.55 * t - 0.1 * t * t))))
        parts.append(tube_mesh('branch', pts, lambda t, th, br=br: br * (1 - 0.8 * t), max(6, radial // 2), uv_density=0.8))
        tip = pts[-1]
        leaf_centers.append(tip)
        for k in range(rnd.randint(1, 3)):
            tt = rnd.uniform(0.4, 0.8); q = pts[int(tt * 9)]
            az2 = az + rnd.uniform(-1.0, 1.0); L2 = L_ * rnd.uniform(0.35, 0.55)
            pts2 = [q + Vector((math.cos(az2) * L2 * s, math.sin(az2) * L2 * s, L2 * 0.5 * s)) for s in [m / 5 for m in range(6)]]
            parts.append(tube_mesh('twig', pts2, lambda t, th, b2=br * 0.5: b2 * (1 - 0.8 * t), 6, uv_density=0.8))
            leaf_centers.append(pts2[-1])
    leaf_centers.append(spine[-1] + Vector((0, 0, 0.6)))
    bark = join(parts, name + '_bark')
    bark.data.materials.append(named_mat('Bark'))
    # leaf cards
    verts, faces, uvs = [], [], []
    ncards = [9, 5][lod]
    for c in leaf_centers:
        for k in range(ncards):
            s = rnd.uniform(1.3, 2.2)
            cen = c + Vector((rnd.uniform(-1.1, 1.1), rnd.uniform(-1.1, 1.1), rnd.uniform(-0.5, 0.8)))
            rot = Euler((rnd.uniform(-1.2, 1.2), rnd.uniform(-1.2, 1.2), rnd.uniform(0, 6.28))).to_matrix()
            cell = rnd.randint(0, 3); cu, cv = (cell % 2) * 0.5, (cell // 2) * 0.5
            base = len(verts)
            for (x, y, u, v) in ((-0.5, -0.5, 0, 0), (0.5, -0.5, 1, 0), (0.5, 0.5, 1, 1), (-0.5, 0.5, 0, 1)):
                verts.append(cen + rot @ Vector((x * s, y * s, 0)))
                uvs.append((cu + u * 0.5, cv + v * 0.5))
            faces.append((base, base + 1, base + 2, base + 3))
    me = bpy.data.meshes.new(name + '_leaves'); me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            uvl.data[li].uv = uvs[me.loops[li].vertex_index]
    # normals pointing away from the canopy center: spherical normals read as a soft volume
    leaves = bpy.data.objects.new(name + '_leaves', me); bpy.context.scene.collection.objects.link(leaves)
    leaves.data.materials.append(named_mat('Leaves'))
    return bark, leaves

from mathutils import Euler

def build_trees():
    specs = [(1, 12, 0.62), (2, 10, 0.5), (3, 13, 0.7), (4, 9, 0.42), (5, 11.5, 0.58), (6, 8, 0.36)]
    for i, (seed, h, r0) in enumerate(specs):
        for lod in (0, 1):
            reset_scene()
            bark, leaves = make_tree(f'tree_{i}', seed * 31, h, r0, lod)
            if lod == 0:
                bake_ao_vcol([bark], dist=0.8, samples=32)
            export_glb([bark, leaves], os.path.join(OUT, f'tree_{i}{"_lod1" if lod else ""}.glb'))

# ------------------------------------------------------------------ logs and stumps
def build_logs():
    reset_scene()
    rnd = random.Random(5)
    def log(name, L_, r, hollow=False, seed=0):
        pts = [Vector((x, 0.03 * math.sin(x * 2 + seed), 0)) for x in [(-L_ / 2) + L_ * k / 30 for k in range(31)]]
        ob = tube_mesh(name, pts, lambda t, th: r * (1 + 0.06 * noise.noise(Vector((math.cos(th) * 2, math.sin(th) * 2, t * 6 + seed)))) * (1 + 0.15 * max(0, 1 - t * 8)), 24, uv_density=0.8)
        ob.data.materials.append(named_mat('Bark'))
        objs = [ob]
        if hollow:
            inner = tube_mesh(name + '_in', pts, lambda t, th: r * 0.72, 24, uv_density=0.8)
            select_only([inner]); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode='OBJECT')
            inner.data.materials.append(named_mat('Wood'))
            objs.append(inner)
            # end rings
            for sgn in (-1, 1):
                bpy.ops.mesh.primitive_circle_add(vertices=24, radius=r, location=(sgn * L_ / 2, 0, 0), rotation=(0, math.pi / 2, 0), fill_type='NOTHING')
                ring = bpy.context.active_object
                select_only([ring]); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
                bpy.ops.mesh.extrude_region_shrink_fatten(TRANSFORM_OT_shrink_fatten={'value': 0})
                bpy.ops.transform.resize(value=(1, 0.72, 0.72))
                bpy.ops.object.mode_set(mode='OBJECT')
                ring.data.materials.append(named_mat('Wood')); objs.append(ring)
        else:
            for sgn in (-1, 1):
                bpy.ops.mesh.primitive_circle_add(vertices=24, radius=r * 1.0, location=(sgn * L_ / 2, 0, 0), rotation=(0, math.pi / 2, 0), fill_type='TRIFAN')
                cap = bpy.context.active_object; cap.data.materials.append(named_mat('Wood')); objs.append(cap)
        ob = join(objs, name)
        return ob
    for name, L_, r, hol in (('log_bridge', 6.6, 0.28, False), ('log_hollow', 5.2, 0.36, True), ('log_small', 4.5, 0.3, False)):
        reset_scene()
        o = log(name, L_, r, hol, rnd.random() * 10)
        bake_ao_vcol([o], 0.4, 32)
        export_glb([o], os.path.join(OUT, name + '.glb'))
    # stumps: short buttressed trunk with a flat cut top
    for i, (r0, h) in enumerate(((0.75, 1.15), (0.5, 0.5), (0.45, 0.35), (0.42, 0.62))):
        reset_scene()
        rnd2 = random.Random(i * 9 + 1)
        th_r = [k / 5 * 2 * math.pi + rnd2.uniform(-0.3, 0.3) for k in range(5)]
        spine = [Vector((0, 0, -0.2 + h * 1.2 * (k / 12))) for k in range(13)]
        def sr(t, th):
            z = -0.2 + t * h * 1.2
            b = sum(max(0.0, math.cos(th - a)) ** 6 for a in th_r)
            return r0 * (1 + math.exp(-max(0, z) / 0.35) * 0.5 * (0.3 + b)) * (1 + 0.04 * noise.noise(Vector((math.cos(th) * 3, math.sin(th) * 3, z * 3))))
        st = tube_mesh(f'stump_{i}', spine, sr, 24, uv_density=0.8)
        st.data.materials.append(named_mat('Bark'))
        # top cap
        top = spine[-1]
        bpy.ops.mesh.primitive_circle_add(vertices=24, radius=sr(1, 0) * 0.98, location=top, fill_type='TRIFAN')
        cap = bpy.context.active_object
        for v in cap.data.vertices:
            v.co.z += 0.02 * noise.noise(Vector((v.co.x * 6, v.co.y * 6, i)))
        cap.data.materials.append(named_mat('Wood'))
        o = join([st, cap], f'stump_{i}')
        bake_ao_vcol([o], 0.4, 32)
        export_glb([o], os.path.join(OUT, f'stump_{i}.glb'))

# ------------------------------------------------------------------ rock outcrop with tunnel cave
def despike(ob, passes=4, k=1.6):
    """displacing along vertex normals pushes creases out into thin spikes: pull every vertex that sits far off its
    neighbours' average back onto it, then relax the surface lightly"""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    for _ in range(passes):
        moved = 0
        for v in bm.verts:
            nb = [e.other_vert(v) for e in v.link_edges]
            if len(nb) < 3: continue
            avg = sum((n.co for n in nb), Vector()) / len(nb)
            el = sum((n.co - v.co).length for n in nb) / len(nb)
            if (v.co - avg).length > k * el * 0.5 or any(f.calc_area() < 1e-7 for f in v.link_faces):
                v.co = avg; moved += 1
        print('despike moved', moved)
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.35, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()

def build_outcrop():
    reset_scene()
    rnd = random.Random(42)
    # main mass: union of displaced blobs
    blobs = []
    for (x, y, z, sx, sy, sz) in ((0, 0, 1.6, 6.5, 5.2, 3.6), (-3.2, 1.5, 1.0, 3.2, 3.0, 2.4), (3.0, -1.0, 1.2, 3.4, 3.4, 3.0), (0.5, 3.4, 0.8, 3.6, 2.4, 2.0)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1, location=(x, y, z))
        b = bpy.context.active_object; b.scale = (sx, sy, sz)
        select_only([b]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        blobs.append(b)
    mass = join(blobs, 'outcrop')
    m = mass.modifiers.new('Remesh', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.14
    apply_all(mass)
    # tunnel: a curved tube cutter running south -> north-east through the mass
    pts = [Vector((-0.5, -7, 0.55)), Vector((-0.2, -3.5, 0.6)), Vector((0.6, 0.0, 0.7)), Vector((2.0, 3.0, 0.75)), Vector((3.2, 7, 0.8))]
    curve_pts = []
    for k in range(40):
        t = k / 39 * (len(pts) - 1); i0 = min(len(pts) - 2, int(t)); f = t - i0
        curve_pts.append(pts[i0].lerp(pts[i0 + 1], f))
    cutter = tube_mesh('tunnel', curve_pts, lambda t, th: 1.05 + 0.15 * math.sin(th * 3 + t * 9), 24)
    # flatten the tunnel floor: push lower vertices up a little so the floor is walkable
    for v in cutter.data.vertices:
        if v.co.z < 0.2: v.co.z = 0.2 + (v.co.z - 0.2) * 0.15
    bpy.ops.object.select_all(action='DESELECT')
    bm_ = mass.modifiers.new('Tunnel', 'BOOLEAN'); bm_.operation = 'DIFFERENCE'; bm_.object = cutter; bm_.solver = 'EXACT'
    # floor cut: nothing below ground
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -2.5)); fl = bpy.context.active_object; fl.scale = (40, 40, 5)
    b2 = mass.modifiers.new('Floor', 'BOOLEAN'); b2.operation = 'DIFFERENCE'; b2.object = fl; b2.solver = 'EXACT'
    apply_all(mass)
    bpy.data.objects.remove(cutter); bpy.data.objects.remove(fl)
    m = mass.modifiers.new('Remesh', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.09
    apply_all(mass)
    # rocky displacement + strata + plane chipping
    pls = [(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.2, 0.6))).normalized(), rnd.uniform(0.0, 0.6)) for _ in range(30)]
    for v in mass.data.vertices:
        p = v.co.copy()
        if p.z < 0.05: continue
        d = 0.35 * fbm3(p * 0.35, 5, seed=1) + 0.08 * fbm3(p * 1.6, 4, seed=2)
        strata = 0.06 * math.sin(p.z * 5.5 + 0.8 * fbm3(p * 0.5, 2, seed=3))
        n_ = v.normal
        v.co = p + n_ * (d + strata)
    despike(mass)
    smooth(mass)
    decimate(mass, 0.22)
    despike(mass, passes=2)
    smart_uv(mass, 60, 0.004)
    mass.data.materials.append(named_mat('Rock'))
    bake_ao_vcol([mass], 1.5, 48)
    export_glb([mass], os.path.join(OUT, 'outcrop.glb'))

# ------------------------------------------------------------------ mushrooms
def build_mushrooms():
    reset_scene()
    objs = []
    rnd = random.Random(8)
    for i in range(3):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.05, location=(i * 0.3, 0, 0.11))
        cap = bpy.context.active_object
        for v in cap.data.vertices:
            if v.co.z < 0: v.co.z *= 0.15
            else: v.co.z *= 0.75
        cap.data.materials.append(named_mat('MushCap'))
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.014, depth=0.11, location=(i * 0.3, 0, 0.055))
        st = bpy.context.active_object
        for v in st.data.vertices:
            if v.co.z < 0: v.co.x *= 1.3; v.co.y *= 1.3
        st.data.materials.append(named_mat('MushStem'))
        o = join([cap, st], f'mushroom_{i}'); smooth(o)
        s = (0.8, 1.2, 1.6)[i]
        o.scale = (s, s, s * rnd.uniform(0.9, 1.2)); o.location = (0, 0, 0)
        export_glb([o], os.path.join(OUT, f'mushroom_{i}.glb'))
        bpy.data.objects.remove(o)

# ------------------------------------------------------------------ rounded field boulders
def build_boulders():
    """weathered field boulders: a lumpy ellipsoid cut by a few broad, softly rounded fracture planes, voxel-remeshed
    to an even surface, then given knobbly mid-frequency relief; the bottom sinks below grade"""
    os.makedirs(os.path.join(OUT, 'rocks'), exist_ok=True)
    specs = [(3, (1.0, 0.82, 0.7), 9), (11, (1.15, 0.9, 0.62), 10), (19, (0.95, 0.9, 0.8), 8), (27, (1.2, 0.78, 0.58), 11)]
    for i, (seed, size, nplanes) in enumerate(specs):
        reset_scene()
        rnd = random.Random(seed)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6, radius=1)
        ob = bpy.context.active_object; ob.name = f'boulder_{i}'
        pls = []
        for _ in range(nplanes):
            n_ = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.9))).normalized()
            pls.append((n_, rnd.uniform(0.7, 0.9)))
        for v in ob.data.vertices:
            p = v.co.copy()
            p *= 1 + 0.16 * fbm3(p * 0.9, 4, seed=seed) + 0.05 * fbm3(p * 2.6, 3, seed=seed + 4)
            for n_, d in pls:
                k = p.dot(n_) - d
                if k > 0: p -= n_ * k * (0.92 + 0.08 * fbm3(p * 3, 2, seed=seed + 5))
            v.co = Vector((p.x * size[0], p.y * size[1], p.z * size[2]))
        m = ob.modifiers.new('Remesh', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.026
        apply_all(ob)
        m = ob.modifiers.new('Sm', 'SMOOTH'); m.factor = 0.5; m.iterations = 2
        apply_all(ob)
        ob.data.update()
        for v in ob.data.vertices:
            p = v.co.copy()
            d = 0.05 * fbm3(p * 2.6, 4, seed=seed + 7) + 0.016 * fbm3(p * 8.0, 3, seed=seed + 9)
            # hairline joints: thin valleys where a noise field crosses zero
            d -= 0.035 * (1 - min(1.0, abs(fbm3(p * 1.3, 3, seed=seed + 21)) * 9)) ** 2
            # shallow weathering pits and a few lamination grooves
            d -= 0.012 * max(0.0, fbm3(p * 7.0, 2, seed=seed + 13) - 0.3) * 4
            d += 0.022 * (1 - abs(fbm3(p * 2.2, 3, seed=seed + 17))) ** 3
            d += 0.006 * math.sin((p.z + 0.25 * fbm3(p * 1.5, 2, seed=seed + 2)) * 38)
            v.co = p + v.normal * d
        despike(ob, passes=2)
        decimate(ob, 0.14)
        despike(ob, passes=1)
        smooth(ob)
        zmin = min(v.co.z for v in ob.data.vertices)
        for v in ob.data.vertices: v.co.z -= zmin + 0.12 * size[2]
        ob.data.materials.append(named_mat('Rock'))
        bake_ao_vcol([ob], dist=0.45, samples=64)
        print('boulder', i, len(ob.data.polygons), 'faces')
        export_glb([ob], os.path.join(OUT, 'rocks', f'boulder_{i}.glb'))

BUILDERS = {'boulders': build_boulders, 'rocks': build_rocks, 'trees': build_trees, 'logs': build_logs, 'outcrop': build_outcrop, 'mushrooms': build_mushrooms}
for k, f in BUILDERS.items():
    if ONLY and k not in ONLY: continue
    f()
