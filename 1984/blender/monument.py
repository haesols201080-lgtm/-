"""The column in Victory Square (Nelson's Column in Trafalgar Square, with
Big Brother on top): real proportions, a stepped granite base, a pedestal
with bronze relief panels, a fluted granite shaft with a bronze capital,
and four couchant bronze lions on their plinths, modelled as sculpture
(skin-modifier armatures, subdivided, with a carved mane) rather than
assembled from spheres."""
import math
import bpy, bmesh
from mathutils import Vector, Matrix, noise
from lib import Mesh, material

# heights (metres above the pavement)
STEP_H, STEPS = 0.3, 4
BASE = STEP_H * STEPS                     # top of the steps: 1.2
PED = (BASE, BASE + 5.4)                  # pedestal body
DIE = (PED[1] + 0.9, PED[1] + 3.2)        # upper die
SHAFT = (DIE[1] + 1.6, DIE[1] + 31.5)     # fluted shaft
CAP = (SHAFT[1], SHAFT[1] + 4.2)          # bronze capital
TOP = CAP[1] + 2.0                        # where the statue stands


def lion(name, mirror=False):
    """A couchant lion like Landseer's at Trafalgar Square: forelegs straight
    out, the chest high under a heavy mane, the head raised, the hind legs
    folded with the tail curled round. Blocked out of ellipsoids and limb
    capsules the way a sculptor blocks a maquette, fused with a voxel
    remesh, smoothed, and the mane carved with flowing noise.
    Units are metres for the real size (about 6 m nose to rump)."""
    parts = []

    def ell(c, r, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=c, rotation=rot)
        o = bpy.context.active_object
        o.scale = r
        parts.append(o)

    def cap(a, b, ra, rb):
        a, b = Vector(a), Vector(b)
        n = 6
        for i in range(n + 1):
            t = i / n
            p = a.lerp(b, t)
            r = ra + (rb - ra) * t
            ell(tuple(p), (r, r, r))

    # trunk: rump, belly, chest
    ell((0, -1.95, 0.88), (0.74, 0.82, 0.78))
    ell((0, -0.75, 0.95), (0.74, 1.3, 0.8))
    ell((0, 0.45, 1.18), (0.82, 0.85, 0.98))
    # the mane: over the shoulders, up the neck, falling down the chest
    ell((0, 0.85, 1.78), (0.98, 0.92, 0.95))
    ell((0, 1.22, 1.15), (0.74, 0.55, 0.92))
    ell((0, 0.2, 1.55), (0.8, 0.7, 0.75))
    # head and muzzle, chin
    ell((0, 1.58, 2.02), (0.5, 0.58, 0.54))
    ell((0, 2.04, 1.86), (0.33, 0.38, 0.3))
    ell((0, 1.98, 1.62), (0.24, 0.3, 0.16))
    for sx in (-1, 1):
        ell((sx * 0.3, 1.5, 2.46), (0.13, 0.09, 0.15))                 # ears
        ell((sx * 0.26, 1.92, 2.08), (0.16, 0.18, 0.12))               # brows
        # forelegs, straight out, big paws
        cap((sx * 0.44, 0.95, 0.8), (sx * 0.43, 2.25, 0.24), 0.32, 0.22)
        ell((sx * 0.43, 2.5, 0.18), (0.3, 0.4, 0.19))
        # hind leg folded: thigh, shank along the ground, paw beside the belly
        ell((sx * 0.55, -1.75, 0.72), (0.42, 0.78, 0.62))
        cap((sx * 0.6, -2.2, 0.2), (sx * 0.64, -0.95, 0.16), 0.2, 0.16)
        ell((sx * 0.64, -0.75, 0.15), (0.24, 0.33, 0.16))
    # tail curled round the right hind paw
    cap((0.1, -2.6, 0.7), (0.55, -2.95, 0.14), 0.12, 0.09)
    cap((0.55, -2.95, 0.14), (1.0, -2.25, 0.11), 0.09, 0.08)
    cap((1.0, -2.25, 0.11), (0.95, -1.45, 0.11), 0.08, 0.09)
    ell((0.95, -1.35, 0.12), (0.13, 0.2, 0.12))

    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    ob = bpy.context.active_object
    ob.name = name
    rm = ob.modifiers.new('remesh', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.045
    bpy.ops.object.modifier_apply(modifier='remesh')
    sm = ob.modifiers.new('smooth', 'LAPLACIANSMOOTH'); sm.iterations = 18; sm.lambda_factor = 0.9
    bpy.ops.object.modifier_apply(modifier='smooth')
    # carve the mane in locks that flow down and back; leave the face smooth
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.normal_update()
    for v in bm.verts:
        p = v.co
        dm = Vector((p.x / 1.05, (p.y - 0.85) / 1.0, (p.z - 1.55) / 0.95)).length
        mane = max(0.0, min(1.0, 1.25 - dm))
        face = Vector((p.x / 0.42, (p.y - 1.85) / 0.5, (p.z - 1.95) / 0.5)).length
        if face < 1.0:
            mane *= face ** 2
        # locks: stretched noise, long along the fall of the hair
        q = Vector((p.x * 9.0, p.y * 2.2 + p.z * 1.4, p.z * 3.0 - p.y * 1.2))
        locks = noise.turbulence(q, 3, True, noise_basis='PERLIN_ORIGINAL')
        hide = noise.noise(p * 1.8) * 0.015
        v.co += v.normal * (mane * (0.02 + locks * 0.075) + hide)
        if v.co.z < 0.02:
            v.co.z = 0.02
    bm.to_mesh(ob.data); bm.free()
    dec = ob.modifiers.new('dec', 'DECIMATE'); dec.ratio = 0.12
    bpy.ops.object.modifier_apply(modifier='dec')
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.clear()
    ob.data.materials.append(material('bronze'))
    ob.select_set(False)
    return ob


def moulding(m, z, half0, half1, h, mat):
    """A square moulding stepping from half-width half0 at z to half1 at z+h."""
    n = 4
    for i in range(n):
        a = half0 + (half1 - half0) * (i / n)
        m.box((-a, -a, z + h * i / n), (a, a, z + h * (i + 1) / n), mat)


def monument(statue_fn):
    m = Mesh('monument')
    # the broad granite steps
    for s in range(STEPS):
        a = 9.6 - s * 0.45
        m.box((-a, -a, s * STEP_H), (a, a, (s + 1) * STEP_H), 'granite')
    # lion plinths at the four corners, long side north-south
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 6.6, sy * 6.0
            m.box((cx - 1.7, cy - 3.6, BASE), (cx + 1.7, cy + 3.6, BASE + 1.9), 'granite')
            m.box((cx - 1.85, cy - 3.75, BASE + 1.9), (cx + 1.85, cy + 3.75, BASE + 2.1), 'granite')
    # pedestal with a plinth course, bronze reliefs on four faces, a cornice
    moulding(m, PED[0], 5.2, 4.7, 0.6, 'granite')
    m.box((-4.7, -4.7, PED[0] + 0.6), (4.7, 4.7, PED[1]), 'granite')
    for k in range(4):
        R = Matrix.Rotation(k * math.pi / 2, 4, 'Z')
        # recessed frame and the bronze relief panel standing in it
        m.box((-3.0, -4.78, PED[0] + 1.2), (3.0, -4.7, PED[0] + 4.6), 'granite', matrix=R)
        m.box((-2.8, -4.84, PED[0] + 1.35), (2.8, -4.78, PED[0] + 4.45), 'bronze', matrix=R)
        # figures in relief: a march of the Party, rows of raised forms
        for i in range(9):
            x = -2.5 + i * 0.62
            hgt = 1.6 + 0.4 * math.sin(i * 1.7)
            m.box((x - 0.16, -4.98, PED[0] + 1.5), (x + 0.16, -4.84, PED[0] + 1.5 + hgt), 'bronze', matrix=R)
            m.sphere((x, -4.9, PED[0] + 1.62 + hgt), 0.14, 'bronze', 8, 6, matrix=R)
    moulding(m, PED[1] - 0.2, 4.7, 5.1, 0.6, 'granite')
    moulding(m, PED[1] + 0.4, 5.1, 3.9, 0.5, 'granite')
    m.box((-3.6, -3.6, PED[1] + 0.9), (3.6, 3.6, DIE[1]), 'granite')
    moulding(m, DIE[1], 3.6, 3.9, 0.4, 'granite')
    # base of the column: plinth, torus mouldings
    m.box((-3.0, -3.0, DIE[1] + 0.4), (3.0, 3.0, DIE[1] + 1.0), 'granite')
    m.cyl((0, 0, DIE[1] + 1.0), (0, 0, DIE[1] + 1.3), 2.45, 2.45, 'granite', 40)
    m.cyl((0, 0, DIE[1] + 1.3), (0, 0, DIE[1] + 1.6), 2.2, 1.95, 'granite', 40)
    # the fluted shaft, tapering a little
    m.cyl((0, 0, SHAFT[0]), (0, 0, SHAFT[1]), 1.85, 1.6, 'granite', 64, flutes=24, flute_depth=0.045)
    m.cyl((0, 0, SHAFT[1] - 0.3), (0, 0, SHAFT[1]), 1.7, 1.7, 'granite', 40)
    # bronze Corinthian capital: bell, two rows of acanthus, volutes, abacus
    m.cyl((0, 0, CAP[0]), (0, 0, CAP[0] + 3.4), 1.6, 2.2, 'bronze', 40)
    for row, (z0, hh, rr, n) in enumerate([(CAP[0] + 0.2, 1.6, 1.75, 16), (CAP[0] + 1.3, 1.8, 2.0, 16)]):
        for i in range(n):
            a = (i + row * 0.5) / n * math.tau
            c, s = math.cos(a), math.sin(a)
            base = Vector((c * rr, s * rr, z0))
            # a leaf: a curled wedge bending out at the top
            m.cyl(tuple(base), tuple(base + Vector((c * 0.45, s * 0.45, hh))), 0.24, 0.1, 'bronze', 6)
    for i in range(4):
        a = i / 4 * math.tau + math.pi / 4
        c, s = math.cos(a), math.sin(a)
        m.sphere((c * 2.55, s * 2.55, CAP[1] - 0.6), 0.42, 'bronze', 10, 8, (1, 1, 1))
    m.box((-2.9, -2.9, CAP[1] - 0.3), (2.9, 2.9, CAP[1] + 0.3), 'bronze')
    # the drum Big Brother stands on
    m.cyl((0, 0, CAP[1] + 0.3), (0, 0, TOP), 1.45, 1.35, 'granite', 32)
    # the poster that runs spirally up the column (the novel)
    turns, z0, z1, wid = 3.0, SHAFT[0] + 2.0, SHAFT[0] + 22.0, 1.5
    steps = 140
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        def pt(t, dz):
            a = t * turns * math.tau
            z = z0 + (z1 - z0) * t + dz
            rr = 1.85 - 0.25 * (z - SHAFT[0]) / (SHAFT[1] - SHAFT[0]) + 0.03
            return (math.cos(a) * rr, math.sin(a) * rr, z)
        u0, u1 = t0 * 24, t1 * 24
        m.quad([pt(t0, 0), pt(t1, 0), pt(t1, wid), pt(t0, wid)], 'poster_spiral', uvs=[(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
    objs = [m.finish()]
    # the lions, facing north and south off their plinths
    for sx in (-1, 1):
        for sy in (-1, 1):
            L = lion('lion')
            L.location = (sx * 6.6, sy * 6.0 + sy * 0.4, BASE + 2.1)
            # Blender +Y is north in the game: the north pair look north, the south pair south
            L.rotation_euler = (0, 0, 0 if sy > 0 else math.pi)
            objs.append(L)
    st = statue_fn()
    st.location = (0, 0, TOP)
    objs.append(st)
    return objs
