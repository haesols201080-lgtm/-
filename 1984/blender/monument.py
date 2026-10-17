"""The Big Brother Monument in Victory Square. Whatever stood here before
has been taken over: the fluted column now carries Big Brother gazing
south 'towards the skies where he had vanquished the Eurasian aeroplanes
in the Battle of Airstrip One', the pedestal's bronze reliefs show that
battle, and the four lions at the base were recast in the Party's own
hard monumental manner. Telescreens are set all round the pediment."""
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
    """The lions at the base, recast by the Party in its own monumental
    manner: planar, stepped and hard-edged, the old imperial beasts made
    into Big Brother's. Bevelled blocks and wedges, about 6 m long."""
    m = Mesh(name)
    B = 'bronze'

    def blk(c, size, rx=0.0, rz=0.0):
        M = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X')
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        m.box((-hx, -hy, -hz), (hx, hy, hz), B, matrix=M)

    # hindquarters and the long low back, stepping up to the chest
    blk((0, -2.0, 0.75), (1.45, 1.6, 1.5))
    blk((0, -0.75, 0.82), (1.4, 1.5, 1.5), rx=0.04)
    blk((0, 0.35, 1.05), (1.55, 1.2, 1.95), rx=0.06)
    # the mane: three stepped collars round the neck and chest
    for i, (y, z, w, h, d) in enumerate([(0.55, 1.55, 2.05, 2.1, 1.0), (0.95, 1.7, 1.85, 1.9, 0.6), (1.25, 1.75, 1.55, 1.65, 0.45)]):
        blk((0, y, z), (w, d, h), rx=-0.05 * i)
    # head: brow, face, muzzle, jaw
    blk((0, 1.55, 2.05), (1.0, 0.75, 0.85))
    blk((0, 1.98, 1.9), (0.62, 0.55, 0.55))
    blk((0, 2.22, 1.72), (0.42, 0.35, 0.28))
    blk((0, 1.95, 1.5), (0.5, 0.45, 0.22))
    for sx in (-1, 1):
        blk((sx * 0.36, 1.5, 2.5), (0.2, 0.14, 0.22), rz=sx * 0.3)            # ears
        # forelegs straight out, broad paws with the toes cut in
        blk((sx * 0.45, 1.45, 0.42), (0.5, 1.6, 0.7))
        blk((sx * 0.45, 2.45, 0.2), (0.6, 0.75, 0.38))
        for t in (-0.2, 0, 0.2):
            blk((sx * 0.45 + t, 2.86, 0.14), (0.16, 0.12, 0.26))
        # haunch and the hind paw tucked forward
        blk((sx * 0.6, -1.85, 0.72), (0.45, 1.45, 1.25))
        blk((sx * 0.68, -0.95, 0.18), (0.36, 1.0, 0.34))
    # tail laid along the plinth and round
    blk((0.35, -2.95, 0.16), (0.3, 0.7, 0.28), rz=0.5)
    blk((0.85, -2.75, 0.14), (0.26, 0.7, 0.26), rz=-0.9)
    ob = m.finish(box_uv=True)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = 0.05; bv.segments = 2; bv.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier='bevel')
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
        # in relief: the Battle of Airstrip One. Big Brother stands in the
        # middle, enemy aircraft fall about him, searchlight beams cross
        m.box((-0.35, -5.0, PED[0] + 1.5), (0.35, -4.84, PED[0] + 3.9), 'bronze', matrix=R)
        m.sphere((0, -4.92, PED[0] + 4.1), 0.24, 'bronze', 10, 8, matrix=R)
        for i in range(6):
            x = -2.4 + i * 0.96 if i < 3 else -2.4 + (i - 3) * 0.96 + 3.0
            if abs(x) < 0.7:
                continue
            z = PED[0] + 2.2 + (i % 3) * 0.7
            ang = 0.6 + (i % 3) * 0.3
            M2 = R @ Matrix.Translation((x, -4.92, z)) @ Matrix.Rotation(ang * (1 if x < 0 else -1), 4, 'Y')
            m.box((-0.42, -0.06, -0.06), (0.42, 0.06, 0.06), 'bronze', matrix=M2)    # fuselage
            m.box((-0.1, -0.06, -0.38), (0.1, 0.06, 0.38), 'bronze', matrix=M2)     # wings
        for sgn in (-1, 1):
            M3 = R @ Matrix.Translation((sgn * 1.2, -4.9, PED[0] + 3.0)) @ Matrix.Rotation(sgn * 0.5, 4, 'Y')
            m.box((-0.05, -0.04, -1.5), (0.05, 0.04, 1.5), 'bronze', matrix=M3)
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
