# Shared Blender helpers for the Nuri asset pipeline (Blender 5.x, run headless via the `bpy` module).
import bpy, bmesh, math
from mathutils import Vector, Matrix

# Game convention (three.js): x right, y up, z forward. Blender: z up, character faces -Y.
def B(x, y, z):
    return (x, -z, y)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.preferences.addon_enable(module='cycles')
    except Exception:
        pass


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, uvs=None, smooth=True, coll=None, merge=0.0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs is not None:
        uvl = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                uvl.data[li].uv = uvs[vi]
    me.update()
    if merge > 0:
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
        bm.to_mesh(me); bm.free()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.update()
    ob = bpy.data.objects.new(name, me)
    return link(ob, coll)


def sgnpow(v, e):
    return math.copysign(abs(v) ** e, v)


def se_point(rx, ry, rz, e1, e2, u, v, taper=0.0, front=0.0, taperZ=0.0):
    """Superellipsoid point in game coords; u = azimuth from +z (forward), v = elevation."""
    cv, sv, cu, su = math.cos(v), math.sin(v), math.cos(u), math.sin(u)
    x = rx * sgnpow(cv, e1) * sgnpow(su, e2)
    y = ry * sgnpow(sv, e1)
    z = rz * sgnpow(cv, e1) * sgnpow(cu, e2)
    ty = y / ry
    k = 1 + taper * ty
    x *= k; z *= k * (1 + taperZ * ty)
    if front and z > 0:
        z *= 1 + front * (1 - ty * ty)
    return x, y, z


def dense_samples(lo, hi, n, extras=()):
    vals = [lo + (hi - lo) * i / n for i in range(n + 1)]
    vals += [e for e in extras if lo < e < hi]
    vals = sorted(set(round(v, 7) for v in vals))
    return vals


def superellipsoid(name, rx, ry, rz, e1=0.7, e2=0.7, nu=64, nv=40, taper=0.0, front=0.0, taperZ=0.0,
                   grooves=(), center=(0, 0, 0), coll=None):
    """grooves: list of dicts {'kind':'v'|'u', 'at':angle, 'from':a, 'to':b, 'w':width(rad), 'd':depth(m)}"""
    u_extra, v_extra = [], []
    for g in grooves:
        for k in (-1.0, -0.66, -0.33, 0.0, 0.33, 0.66, 1.0):
            (v_extra if g['kind'] == 'v' else u_extra).append(g['at'] + k * g['w'])
        # make groove ends crisp
        for e in (g.get('from'), g.get('to')):
            if e is not None:
                for k in (-0.5, 0, 0.5):
                    (u_extra if g['kind'] == 'v' else v_extra).append(e + k * g['w'])
    us = dense_samples(-math.pi, math.pi, nu, u_extra)
    vs = dense_samples(-math.pi / 2, math.pi / 2, nv, v_extra)
    verts, uvs, faces = [], [], []
    NU = len(us)
    for j, v in enumerate(vs):
        for i, u in enumerate(us):
            x, y, z = se_point(rx, ry, rz, e1, e2, u, v, taper, front, taperZ)
            d = 0.0
            for g in grooves:
                if g['kind'] == 'v':
                    t, along = v - g['at'], u
                else:
                    t, along = u - g['at'], v
                lo, hi = g.get('from', -10), g.get('to', 10)
                if g['kind'] == 'v' and lo > hi:  # wraps around the back (through +-pi)
                    inside = along >= lo or along <= hi
                else:
                    inside = lo <= along <= hi
                if inside and abs(t) < g['w']:
                    q = t / g['w']
                    d = max(d, g['d'] * (1 - q * q) ** 2)
            if d > 0:
                L = math.sqrt(x * x + y * y + z * z) or 1
                s = (L - d) / L
                x, y, z = x * s, y * s, z * s
            verts.append(B(x, y, z))
            uvs.append(((u + math.pi) / (2 * math.pi), (v + math.pi / 2) / math.pi))
    for j in range(len(vs) - 1):
        for i in range(NU - 1):
            a = j * NU + i; b = a + 1; c = a + NU; d = c + 1
            faces.append((a, b, d, c))
    ob = mesh_obj(name, verts, faces, uvs, coll=coll, merge=1e-6)
    ob.location = B(*center)
    return ob


def squircle_patch(name, shape, au, av, voff, lift, seg=48, coll=None, center=(0, 0, 0)):
    """Rounded-rectangle patch lying on a superellipsoid (the face display)."""
    rx, ry, rz, e1, e2, taper, front = shape
    verts, uvs, faces = [], [], []

    def mp(s, t):
        m = max(abs(s), abs(t))
        if m < 1e-9:
            return 0.0, 0.0
        dx, dy = s / m, t / m
        k = (abs(dx) ** 4 + abs(dy) ** 4) ** -0.25
        return s * k, t * k
    for j in range(seg + 1):
        for i in range(seg + 1):
            s, t = -1 + 2 * i / seg, -1 + 2 * j / seg
            ms, mt = mp(s, t)
            x, y, z = se_point(rx, ry, rz, e1, e2, ms * au, mt * av + voff, taper, front)
            verts.append(B(x * lift + center[0], y * lift + center[1], z * lift + center[2]))
            uvs.append(((ms + 1) / 2, (mt + 1) / 2))
    for j in range(seg):
        for i in range(seg):
            a = j * (seg + 1) + i; b = a + 1; c = a + seg + 1; d = c + 1
            faces.append((a, c, d, b))
    ob = mesh_obj(name, verts, faces, uvs, coll=coll)
    border = []
    N = 128
    for k in range(N):
        a = k / N * math.pi * 2
        ca, sa = math.cos(a), math.sin(a)
        r = (abs(ca) ** 4 + abs(sa) ** 4) ** -0.25
        x, y, z = se_point(rx, ry, rz, e1, e2, ca * r * au, sa * r * av + voff, taper, front)
        border.append(B(x * lift * 1.003 + center[0], y * lift * 1.003 + center[1], z * lift * 1.003 + center[2]))
    return ob, border


def tube_from_points(name, pts, radius, cyclic=False, res=4, coll=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1)
    sp.use_cyclic_u = cyclic
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    link(ob, coll)
    return to_mesh(ob)


def to_mesh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    new = bpy.data.objects.new(ob.name, me)
    for c in ob.users_collection:
        c.objects.link(new)
    new.matrix_world = ob.matrix_world.copy()
    data = ob.data
    bpy.data.objects.remove(ob)
    if isinstance(data, bpy.types.Curve):
        bpy.data.curves.remove(data)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    return new


def prim(kind, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), coll=None, **kw):
    fn = {'cyl': bpy.ops.mesh.primitive_cylinder_add, 'sphere': bpy.ops.mesh.primitive_uv_sphere_add,
          'torus': bpy.ops.mesh.primitive_torus_add, 'cube': bpy.ops.mesh.primitive_cube_add,
          'cone': bpy.ops.mesh.primitive_cone_add, 'ico': bpy.ops.mesh.primitive_ico_sphere_add}[kind]
    fn(location=loc, rotation=rot, **kw)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    if coll is not None:
        for c in list(ob.users_collection):
            c.objects.unlink(ob)
        coll.objects.link(ob)
    return ob


def smooth(ob):
    me = ob.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    me.update()
    return ob


def add_bevel(ob, width=0.002, segs=3, angle=40):
    m = ob.modifiers.new('Bevel', 'BEVEL')
    m.width = width; m.segments = segs; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
    m.harden_normals = True
    return m


def add_subsurf(ob, view=1, render=2):
    m = ob.modifiers.new('Subdivision', 'SUBSURF')
    m.levels = view; m.render_levels = render
    return m


def apply_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


# ---------------- materials ----------------
def principled(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emission=None, estr=0.0,
               sheen=0.0, sheen_tint=(1, 1, 1, 1), alpha=1.0, spec=0.5):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    def s(k, v):
        if k in bsdf.inputs:
            bsdf.inputs[k].default_value = v
    s('Base Color', (*color, 1) if len(color) == 3 else color)
    s('Roughness', rough); s('Metallic', metal)
    s('Coat Weight', coat); s('Coat Roughness', coat_rough)
    s('Specular IOR Level', spec)
    if emission is not None:
        s('Emission Color', (*emission, 1)); s('Emission Strength', estr)
    if sheen:
        s('Sheen Weight', sheen); s('Sheen Tint', sheen_tint)
    if alpha < 1:
        s('Alpha', alpha)
    m.diffuse_color = (*color[:3], 1)
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def assign(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    return ob


def node(m, kind, loc=(0, 0), **props):
    n = m.node_tree.nodes.new(kind)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n


def world_hdri(path, strength=1.0, rot=0.0):
    w = bpy.data.worlds.new('World')
    bpy.context.scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(path)
    mapping = nt.nodes.new('ShaderNodeMapping')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mapping.inputs['Rotation'].default_value = (0, 0, rot)
    nt.links.new(tc.outputs['Generated'], mapping.inputs['Vector'])
    nt.links.new(mapping.outputs['Vector'], env.inputs['Vector'])
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return w


def cycles_setup(samples=64, w=800, h=800, transparent=False):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.cycles.max_bounces = 8
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Base Contrast'
    except Exception:
        pass
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
