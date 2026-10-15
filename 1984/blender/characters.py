"""Skinned people of Oceania with a shared skeleton and animation set.

The body is lofted along the bones, ring by ring, and every ring carries its
own bone weights, so knees, elbows and the waist bend smoothly. Faces -Y.
"""
import bpy, bmesh, math
from mathutils import Vector, Quaternion, Matrix
from lib import Mesh, material

BONES = [
    ('hips', (0, 0, 0.95), (0, 0, 1.05), None),
    ('spine', (0, 0, 1.05), (0, 0, 1.25), 'hips'),
    ('chest', (0, 0, 1.25), (0, 0, 1.45), 'spine'),
    ('neck', (0, 0, 1.45), (0, 0, 1.56), 'chest'),
    ('head', (0, 0, 1.56), (0, 0, 1.78), 'neck'),
]
for s, x in (('L', 1), ('R', -1)):
    BONES += [
        (f'upperarm.{s}', (0.185 * x, 0.0, 1.415), (0.235 * x, 0.02, 1.13), 'chest'),
        (f'forearm.{s}', (0.235 * x, 0.02, 1.13), (0.255 * x, -0.02, 0.88), f'upperarm.{s}'),
        (f'hand.{s}', (0.255 * x, -0.02, 0.88), (0.26 * x, -0.03, 0.78), f'forearm.{s}'),
        (f'thigh.{s}', (0.095 * x, 0.0, 0.93), (0.1 * x, -0.01, 0.5), 'hips'),
        (f'shin.{s}', (0.1 * x, -0.01, 0.5), (0.1 * x, 0.02, 0.09), f'thigh.{s}'),
        (f'foot.{s}', (0.1 * x, 0.02, 0.09), (0.1 * x, -0.13, 0.03), f'shin.{s}'),
    ]
BONE_NAMES = [b[0] for b in BONES]
J = {b[0]: (Vector(b[1]), Vector(b[2])) for b in BONES}


class Body(Mesh):
    def __init__(self, name):
        super().__init__(name)
        self.dl = self.bm.verts.layers.deform.verify()
        self.mark = 0

    def begin(self):
        self.bm.verts.ensure_lookup_table()
        self.mark = len(self.bm.verts)

    def weight(self, w):
        self.bm.verts.ensure_lookup_table()
        for v in self.bm.verts[self.mark:]:
            for bname, val in w.items():
                v[self.dl][BONE_NAMES.index(bname)] = val
        self.begin()

    def loft(self, pts, rads, mat, weights, seg=12, cap0=True, cap1=True, offs=None):
        """Rings perpendicular to the path. rads: (rx, ry) per ring;
        weights: {bone: w} per ring; offs: optional per-ring (dx, dy)."""
        self.begin()
        rings = []
        n = len(pts)
        for i, p in enumerate(pts):
            p = Vector(p)
            a = Vector(pts[max(0, i - 1)]); b = Vector(pts[min(n - 1, i + 1)])
            t = (b - a).normalized()
            ref = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((0, 0, 1))
            a1 = ref.cross(t).normalized()
            a2 = t.cross(a1).normalized()
            if offs:
                p = p + Vector((offs[i][0], offs[i][1], 0))
            rx, ry = rads[i]
            ring = []
            for j in range(seg):
                th = math.tau * j / seg
                v = self.bm.verts.new(p + a1 * math.cos(th) * rx + a2 * math.sin(th) * ry)
                for bname, val in weights[i].items():
                    v[self.dl][BONE_NAMES.index(bname)] = val
                ring.append(v)
            rings.append(ring)
        mi = self.mi(mat)
        for i in range(n - 1):
            for j in range(seg):
                k = (j + 1) % seg
                f = self.bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
                f.material_index = mi; f.smooth = True
        if cap0:
            f = self.bm.faces.new(list(reversed(rings[0]))); f.material_index = mi; f.smooth = True
        if cap1:
            f = self.bm.faces.new(rings[-1]); f.material_index = mi; f.smooth = True
        self.begin()
        return rings


def lerp(a, b, t):
    return a + (b - a) * t


def seg_pts(p0, p1, ts):
    return [lerp(p0, p1, t) for t in ts]


def build_body(name, spec, joints=None):
    """spec keys: top, legs, sleeves, skin, hair, hair_style, shoes, width,
    depth, female, extras (list)."""
    jt = joints or J
    b = Body(name)
    W = spec.get('width', 1.0); Dp = spec.get('depth', 1.0)
    top = spec['top']; legs = spec.get('legs', top); sleeves = spec.get('sleeves', top)
    skin = spec.get('skin', 'skin')
    female = spec.get('female', False)
    hp = jt['hips'][0]; ch = jt['chest'][1]
    # torso
    zs = [0.80, 0.86, 0.93, 1.02, 1.12, 1.24, 1.34, 1.405, 1.445, 1.47]
    if female:
        rx = [0.10, 0.155, 0.168, 0.135, 0.138, 0.158, 0.165, 0.16, 0.12, 0.065]
        ry = [0.07, 0.10, 0.112, 0.095, 0.098, 0.118, 0.112, 0.088, 0.07, 0.052]
    else:
        rx = [0.10, 0.15, 0.162, 0.15, 0.155, 0.172, 0.183, 0.18, 0.13, 0.068]
        ry = [0.07, 0.095, 0.103, 0.10, 0.10, 0.11, 0.115, 0.092, 0.075, 0.055]
    wts = [{'hips': 1}, {'hips': 1}, {'hips': 1}, {'hips': 0.6, 'spine': 0.4}, {'spine': 1},
           {'spine': 0.5, 'chest': 0.5}, {'chest': 1}, {'chest': 1}, {'chest': 1}, {'chest': 0.5, 'neck': 0.5}]
    offs = [(0, 0.0), (0, 0.0), (0, 0.0), (0, 0.0), (0, -0.005), (0, -0.01), (0, -0.012), (0, 0.0), (0, 0.005), (0, 0.0)]
    b.loft([(0, 0, z) for z in zs], [(x * W, y * Dp) for x, y in zip(rx, ry)], top, wts, seg=16, offs=offs)
    if spec.get('coat'):
        cz = [1.0, 0.8, 0.6, 0.45]
        b.loft([(0, 0, z) for z in cz], [(0.18 * W, 0.13 * Dp), (0.2 * W, 0.15 * Dp), (0.22 * W, 0.17 * Dp), (0.24 * W, 0.18 * Dp)],
               top, [{'hips': 1}] * 4, seg=16, cap0=False, cap1=False)
    if spec.get('skirt'):
        cz = [1.0, 0.8, 0.6, 0.48]
        b.loft([(0, 0, z) for z in cz], [(0.16 * W, 0.12 * Dp), (0.2 * W, 0.15 * Dp), (0.23 * W, 0.18 * Dp), (0.25 * W, 0.19 * Dp)],
               spec['skirt'], [{'hips': 1}, {'hips': 0.8, 'thigh.L': 0.1, 'thigh.R': 0.1},
                               {'hips': 0.5, 'thigh.L': 0.25, 'thigh.R': 0.25}, {'hips': 0.4, 'thigh.L': 0.3, 'thigh.R': 0.3}],
               seg=16, cap0=False, cap1=False)
    # neck and head
    b.loft([(0, 0.0, 1.44), (0, 0.005, 1.53), (0, 0.01, 1.6)], [(0.05, 0.05), (0.047, 0.047), (0.05, 0.05)], skin,
           [{'neck': 1}, {'neck': 1}, {'head': 1}], seg=10)
    hc = Vector((0, -0.005, 1.665))
    b.begin()
    b.sphere(tuple(hc), 0.1, skin, 18, 12, (0.84, 0.97, 1.13))
    b.sphere((0, -0.035, 1.6), 0.07, skin, 14, 8, (0.95, 0.95, 0.75))  # jaw
    b.sphere((0, -0.098, 1.655), 0.02, skin, 8, 6, (0.7, 0.9, 1.4))   # nose
    for sx in (-1, 1):
        b.sphere((sx * 0.084, 0.0, 1.66), 0.026, skin, 8, 6, (0.4, 0.8, 1.2))   # ears
        b.sphere((sx * 0.033, -0.083, 1.682), 0.011, 'eye', 8, 6)                # eyes
        b.box((sx * 0.033 - 0.02, -0.093, 1.7), (sx * 0.033 + 0.02, -0.08, 1.707), spec.get('hair', 'hair_dark'))
    if spec.get('moustache'):
        b.sphere((0, -0.096, 1.628), 0.03, spec.get('hair', 'hair_dark'), 10, 6, (1.5, 0.55, 0.45))
    style = spec.get('hair_style', 'short')
    hair = spec.get('hair', 'hair_dark')
    if style == 'short':
        b.sphere((0, 0.012, 1.705), 0.1, hair, 16, 10, (0.9, 1.0, 0.72))
    elif style == 'thick':
        b.sphere((0, 0.008, 1.705), 0.106, hair, 16, 10, (0.93, 1.02, 0.78))
    elif style == 'long':
        b.sphere((0, 0.012, 1.7), 0.106, hair, 16, 10, (0.95, 1.03, 0.8))
        b.sphere((0, 0.05, 1.6), 0.09, hair, 14, 8, (1.0, 0.7, 1.15))
    elif style == 'bun':
        b.sphere((0, 0.012, 1.705), 0.102, hair, 16, 10, (0.92, 1.0, 0.75))
        b.sphere((0, 0.1, 1.69), 0.045, hair, 10, 6)
    elif style == 'bald':
        b.sphere((0, 0.04, 1.66), 0.1, hair, 14, 8, (0.88, 0.8, 0.5))
    if spec.get('cap') == 'police':
        b.cyl((0, 0.0, 1.73), (0, 0.0, 1.8), 0.1, 0.11, spec['top'], 16)
        b.box((-0.07, -0.16, 1.725), (0.07, -0.06, 1.735), 'shoe')
    elif spec.get('cap') == 'flat':
        b.sphere((0, -0.01, 1.73), 0.1, 'prole_jacket', 14, 6, (0.95, 1.08, 0.38))
        b.box((-0.07, -0.15, 1.715), (0.07, -0.06, 1.725), 'prole_jacket')
    if spec.get('spectacles'):
        for sx in (-1, 1):
            b.cyl((sx * 0.033, -0.1, 1.682), (sx * 0.033, -0.104, 1.682), 0.019, 0.019, 'lens', 10)
        b.box((-0.014, -0.103, 1.685), (0.014, -0.1, 1.689), 'iron_black')
    b.weight({'head': 1})
    # collar
    b.loft([(0, 0.0, 1.44), (0, 0.0, 1.49)], [(0.075, 0.065), (0.068, 0.06)], top,
           [{'chest': 0.5, 'neck': 0.5}] * 2, seg=12, cap0=False, cap1=False)
    # arms
    for s, x in (('L', 1), ('R', -1)):
        sh, el = jt[f'upperarm.{s}']
        _, wr = jt[f'forearm.{s}']
        _, hd = jt[f'hand.{s}']
        b.begin()
        b.sphere(tuple(sh + Vector((-0.012 * x, 0.0, -0.005))), 0.068, sleeves, 12, 8, (1.0 * W, 1.05, 0.9))
        b.weight({'chest': 0.5, f'upperarm.{s}': 0.5})
        arm_pts = [sh + Vector((0.0, 0, 0.02)), lerp(sh, el, 0.15), lerp(sh, el, 0.55), lerp(sh, el, 0.9),
                   lerp(el, wr, 0.1), lerp(el, wr, 0.45), lerp(el, wr, 0.85), wr]
        arm_r = [(0.045, 0.045), (0.058, 0.056), (0.052, 0.05), (0.045, 0.044),
                 (0.046, 0.044), (0.043, 0.039), (0.036, 0.031), (0.033, 0.029)]
        U, F, H_ = f'upperarm.{s}', f'forearm.{s}', f'hand.{s}'
        b.loft(arm_pts, [(rx_ * W ** 0.5, ry_) for rx_, ry_ in arm_r], sleeves,
               [{'chest': 0.4, U: 0.6}, {U: 1}, {U: 1}, {U: 0.7, F: 0.3}, {U: 0.35, F: 0.65}, {F: 1}, {F: 1}, {F: 0.75, H_: 0.25}], seg=10)
        b.begin()
        hc_ = lerp(wr, hd, 0.5)
        b.sphere(tuple(hc_), 0.05, skin, 10, 6, (0.45, 0.85, 1.0))
        b.sphere(tuple(lerp(wr, hd, 0.25) + Vector((0, -0.035, 0))), 0.02, skin, 6, 4, (1, 1, 1.4))
        b.weight({f'hand.{s}': 1})
        # legs
        hip, kn = jt[f'thigh.{s}']
        _, an = jt[f'shin.{s}']
        _, toe = jt[f'foot.{s}']
        lw = spec.get('leg_width', 1.0)
        T, S_, Fo = f'thigh.{s}', f'shin.{s}', f'foot.{s}'
        leg_pts = [hip + Vector((0, 0, 0.03)), lerp(hip, kn, 0.3), lerp(hip, kn, 0.7), lerp(hip, kn, 0.93),
                   lerp(kn, an, 0.07), lerp(kn, an, 0.3), lerp(kn, an, 0.75), an + Vector((0, 0, 0.03))]
        leg_r = [(0.088, 0.09), (0.083, 0.087), (0.066, 0.07), (0.056, 0.06),
                 (0.055, 0.06), (0.056, 0.062), (0.044, 0.045), (0.042, 0.043)]
        leg_w = [{'hips': 0.5, T: 0.5}, {T: 1}, {T: 1}, {T: 0.7, S_: 0.3}, {T: 0.35, S_: 0.65}, {S_: 1}, {S_: 1}, {S_: 0.7, Fo: 0.3}]
        lower = spec.get('lower_legs', legs)
        leg_r = [(x_ * lw, y_ * lw) for x_, y_ in leg_r]
        if lower == legs:
            b.loft(leg_pts, leg_r, legs, leg_w, seg=12)
        else:
            b.loft(leg_pts[:4], leg_r[:4], legs, leg_w[:4], seg=12)
            b.loft(leg_pts[3:], [(x_ * 0.92, y_ * 0.92) for x_, y_ in leg_r[3:]], lower, leg_w[3:], seg=12)
        # shoe
        heel = an + Vector((0, 0.05, -0.06))
        f_pts = [heel, an + Vector((0, 0.0, -0.04)), lerp(an, toe, 0.6) + Vector((0, 0, -0.035)), toe + Vector((0, -0.02, -0.012))]
        b.loft(f_pts, [(0.045, 0.035), (0.05, 0.045), (0.05, 0.035), (0.04, 0.022)], spec.get('shoes', 'shoe'),
               [{f'shin.{s}': 0.3, f'foot.{s}': 0.7}, {f'foot.{s}': 1}, {f'foot.{s}': 1}, {f'foot.{s}': 1}], seg=10)
    # extras
    for ex in spec.get('extras', []):
        if ex == 'sash':
            b.loft([(0, 0, 1.0), (0, 0, 1.06)], [(0.143 * W, 0.104 * Dp), (0.143 * W, 0.104 * Dp)], 'sash_red',
                   [{'hips': 0.6, 'spine': 0.4}] * 2, seg=16, cap0=False, cap1=False)
        elif ex == 'belt':
            b.loft([(0, 0, 1.0), (0, 0, 1.05)], [(0.158 * W, 0.108 * Dp), (0.158 * W, 0.108 * Dp)], 'shoe',
                   [{'hips': 0.6, 'spine': 0.4}] * 2, seg=16, cap0=False, cap1=False)
        elif ex == 'truncheon':
            b.begin()
            b.cyl((0.17 * W, -0.02, 1.0), (0.19 * W, -0.04, 0.62), 0.018, 0.016, 'shoe', 8)
            b.weight({'hips': 1})
        elif ex == 'neckerchief':
            b.loft([(0, -0.01, 1.43), (0, -0.01, 1.47)], [(0.08, 0.072), (0.075, 0.066)], 'sash_red',
                   [{'chest': 1}] * 2, seg=12, cap0=False, cap1=False)
        elif ex == 'apron':
            b.begin()
            b.quad([(-0.13, -0.135, 0.55), (0.13, -0.135, 0.55), (0.14, -0.125, 1.05), (-0.14, -0.125, 1.05)], 'apron')
            b.weight({'hips': 1})
        elif ex == 'pocket':
            b.begin()
            b.quad([(0.04, -0.131, 1.25), (0.12, -0.126, 1.25), (0.12, -0.129, 1.33), (0.04, -0.133, 1.33)], 'overalls_black' if top != 'overalls_black' else 'fabric_grey')
            b.weight({'chest': 1})
    return b


def build_armature(name):
    arm_data = bpy.data.armatures.new(name + '_rig')
    arm = bpy.data.objects.new(name + '_rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for bname, h, t, parent in BONES:
        e = arm_data.edit_bones.new(bname)
        e.head = h; e.tail = t
        if parent:
            e.parent = eb[parent]
            e.use_connect = False
        eb[bname] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


# ---------------------------------------------------------------- animation

AX = Vector((1, 0, 0)); AY = Vector((0, 1, 0)); AZ = Vector((0, 0, 1))


def qrot(arm, bname, rots):
    """rots: list of (global axis, degrees) applied in order, expressed in
    the bone's rest frame so signs are predictable (-X pitch = forward)."""
    R = arm.data.bones[bname].matrix_local.to_3x3()
    Ri = R.inverted()
    q = Quaternion()
    for axis, deg in rots:
        q = Quaternion(Ri @ axis, math.radians(deg)) @ q
    return q


def keyframes(arm, keys, length, hips_z=None):
    """keys: {bone: {frame: [(axis, deg), ...]}}; every bone gets keys."""
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    frames_all = set([0, length])
    for v in keys.values():
        frames_all |= set(v.keys())
    for pb in arm.pose.bones:
        bk = keys.get(pb.name)
        if not bk:
            pb.rotation_quaternion = Quaternion()
            pb.keyframe_insert('rotation_quaternion', frame=0)
            pb.keyframe_insert('rotation_quaternion', frame=length)
            continue
        for f, rots in sorted(bk.items()):
            pb.rotation_quaternion = qrot(arm, pb.name, rots)
            pb.keyframe_insert('rotation_quaternion', frame=f)
    hb = arm.pose.bones['hips']
    if hips_z:
        for f, dz in hips_z.items():
            hb.location = (0, dz, 0)
            hb.keyframe_insert('location', frame=f)
    else:
        hb.location = (0, 0, 0)
        hb.keyframe_insert('location', frame=0)
        hb.keyframe_insert('location', frame=length)


def cyc(vals, length, shift=0):
    """vals: {frame: deg} for a cycle; shift by half a cycle for the other side."""
    out = {}
    for f, v in vals.items():
        out[(f + shift) % length] = v
    if 0 in out:
        out[length] = out[0]
    elif length in out:
        out[0] = out[length]
    return out


def gait(L, thigh, shin, foot, arm_sw, fore, lean, bob, twist):
    keys = {}
    for s, sh in (('L', 0), ('R', L // 2)):
        keys[f'thigh.{s}'] = {f: [(AX, v)] for f, v in cyc(thigh, L, sh).items()}
        keys[f'shin.{s}'] = {f: [(AX, v)] for f, v in cyc(shin, L, sh).items()}
        keys[f'foot.{s}'] = {f: [(AX, v)] for f, v in cyc(foot, L, sh).items()}
        sgn = 1 if s == 'L' else -1
        keys[f'upperarm.{s}'] = {f: [(AY, -sgn * 6), (AX, v)] for f, v in cyc(arm_sw, L, sh).items()}
        keys[f'forearm.{s}'] = {f: [(AX, v)] for f, v in cyc(fore, L, sh).items()}
    keys['hips'] = {f: [(AZ, v)] for f, v in cyc(twist, L).items()}
    keys['chest'] = {f: [(AX, lean), (AZ, -v * 1.5)] for f, v in cyc(twist, L).items()}
    keys['head'] = {0: [(AX, -lean * 0.6)], L: [(AX, -lean * 0.6)]}
    return keys, {f: v for f, v in cyc(bob, L).items()}


def make_actions(arm):
    arm.animation_data_create()
    acts = []

    def act(name, keys, length, hips=None):
        a = bpy.data.actions.new(name)
        arm.animation_data.action = a
        keyframes(arm, keys, length, hips)
        tr = arm.animation_data.nla_tracks.new(); tr.name = name
        tr.strips.new(name, 0, a)
        arm.animation_data.action = None
        acts.append(a)

    rest_arms = {}
    for s, sg in (('L', 1), ('R', -1)):
        rest_arms[f'upperarm.{s}'] = [(AY, -sg * 6)]
        rest_arms[f'forearm.{s}'] = [(AX, -12)]

    # walk: 32 frames at 30 fps, about 1.4 m/s
    L = 32
    keys, bob = gait(L, {0: -24, 8: -6, 16: 18, 24: 2},
                     {0: 4, 6: 14, 10: 6, 16: 10, 21: 52, 26: 30},
                     {0: -12, 6: 4, 14: 8, 18: 22, 22: -4},
                     {0: 16, 16: -16}, {0: -14, 16: -24}, -3, {0: -0.02, 8: 0.015, 16: -0.02, 24: 0.015}, {0: 5, 16: -5})
    act('walk', keys, L, bob)
    # run: 20 frames
    L = 20
    keys, bob = gait(L, {0: -40, 5: -15, 10: 30, 15: -10},
                     {0: 12, 4: 30, 8: 20, 12: 85, 16: 70},
                     {0: -10, 4: 10, 9: 30, 13: 0},
                     {0: 40, 10: -45}, {0: -60, 10: -85}, -12, {0: -0.04, 5: 0.03, 10: -0.04, 15: 0.03}, {0: 8, 10: -8})
    act('run', keys, L, bob)
    # idle: breathing
    L = 90
    keys = {k: {0: v, L: v} for k, v in rest_arms.items()}
    keys['chest'] = {0: [(AX, 0)], 45: [(AX, -1.6)], L: [(AX, 0)]}
    keys['head'] = {0: [(AZ, 0)], 30: [(AZ, 3), (AX, 2)], 70: [(AZ, -2)], L: [(AZ, 0)]}
    keys['spine'] = {0: [(AY, 0)], 45: [(AY, 0.8)], L: [(AY, 0)]}
    act('idle', keys, L)
    # sit on a chair (seat 0.45 m)
    L = 30
    keys = {}
    for s, sg in (('L', 1), ('R', -1)):
        keys[f'thigh.{s}'] = {0: [(AZ, sg * 4), (AX, -88)], L: [(AZ, sg * 4), (AX, -88)]}
        keys[f'shin.{s}'] = {0: [(AX, 88)], L: [(AX, 88)]}
        keys[f'upperarm.{s}'] = {0: [(AY, -sg * 4), (AX, -18)], L: [(AY, -sg * 4), (AX, -18)]}
        keys[f'forearm.{s}'] = {0: [(AX, -55)], L: [(AX, -55)]}
    keys['chest'] = {0: [(AX, 4)], 15: [(AX, 3)], L: [(AX, 4)]}
    act('sit', keys, L, {0: -0.45, L: -0.45})
    # shout: the Hate. Fists up, pumping
    L = 24
    keys = {}
    for s, sg, ph in (('L', 1, 0), ('R', -1, 12)):
        keys[f'upperarm.{s}'] = {f: [(AY, sg * 10), (AX, v)] for f, v in cyc({0: -150, 6: -120, 12: -150, 18: -125}, L, ph).items()}
        keys[f'forearm.{s}'] = {f: [(AX, v)] for f, v in cyc({0: -20, 6: -70, 12: -20, 18: -65}, L, ph).items()}
    keys['chest'] = {0: [(AX, -6)], 6: [(AX, 2)], 12: [(AX, -6)], 18: [(AX, 2)], L: [(AX, -6)]}
    keys['head'] = {0: [(AX, -14)], 12: [(AX, -6)], L: [(AX, -14)]}
    act('shout', keys, L, {0: 0.0, 6: 0.03, 12: 0.0, 18: 0.03, L: 0.0})
    # talk: small hand gestures
    L = 80
    keys = dict((k, {0: v, L: v}) for k, v in rest_arms.items())
    keys['forearm.R'] = {0: [(AX, -20)], 20: [(AX, -60), (AZ, 10)], 40: [(AX, -45)], 60: [(AX, -65), (AZ, -10)], L: [(AX, -20)]}
    keys['upperarm.R'] = {0: [(AY, 6)], 20: [(AY, 10), (AX, -12)], 60: [(AY, 8), (AX, -18)], L: [(AY, 6)]}
    keys['head'] = {0: [(AZ, 0)], 25: [(AX, 4), (AZ, 4)], 50: [(AX, -2)], L: [(AZ, 0)]}
    keys['chest'] = {0: [(AZ, 0)], 30: [(AZ, 2)], L: [(AZ, 0)]}
    act('talk', keys, L)
    # kneel / fallen: Julia stumbles in the corridor
    L = 30
    keys = {}
    for s, sg in (('L', 1), ('R', -1)):
        keys[f'thigh.{s}'] = {0: [(AX, -20 if s == 'L' else 70)], L: [(AX, -20 if s == 'L' else 70)]}
        keys[f'shin.{s}'] = {0: [(AX, 110 if s == 'L' else 100)], L: [(AX, 110 if s == 'L' else 100)]}
        keys[f'upperarm.{s}'] = {0: [(AX, -40), (AY, -sg * 10)], L: [(AX, -40), (AY, -sg * 10)]}
        keys[f'forearm.{s}'] = {0: [(AX, -30)], L: [(AX, -30)]}
    keys['chest'] = {0: [(AX, -20)], L: [(AX, -20)]}
    keys['head'] = {0: [(AX, 15)], L: [(AX, 15)]}
    act('kneel', keys, L, {0: -0.48, L: -0.48})
    # hands raised: the arrest
    L = 30
    keys = {}
    for s, sg in (('L', 1), ('R', -1)):
        keys[f'upperarm.{s}'] = {0: [(AY, sg * 70), (AX, -40)], L: [(AY, sg * 70), (AX, -40)]}
        keys[f'forearm.{s}'] = {0: [(AX, -90)], L: [(AX, -90)]}
    act('hands_up', keys, L)
    return acts


CHARACTERS = {
    'party_man': dict(top='overalls_blue', hair='hair_dark', hair_style='short', extras=['pocket']),
    'party_man_b': dict(top='overalls_blue', hair='hair_fair', hair_style='short', width=0.94, extras=['pocket']),
    'party_woman': dict(top='overalls_blue', hair='hair_dark', hair_style='bun', female=True, width=0.92, leg_width=0.92),
    'winston': dict(top='overalls_blue', hair='hair_fair', hair_style='short', width=0.9, extras=['pocket']),
    'julia': dict(top='overalls_blue', hair='hair_dark', hair_style='thick', female=True, width=0.9, leg_width=0.9, extras=['sash']),
    'obrien': dict(top='overalls_black', hair='hair_grey', hair_style='short', width=1.18, depth=1.15, leg_width=1.12,
                   spectacles=True, extras=['pocket']),
    'syme': dict(top='overalls_blue', hair='hair_dark', hair_style='thick', width=0.85, leg_width=0.88),
    'parsons': dict(top='overalls_blue', hair='hair_fair', hair_style='short', width=1.15, depth=1.25, leg_width=1.1, extras=['pocket']),
    'thought_police': dict(top='uniform_black', hair='hair_dark', hair_style='short', cap='police', width=1.12, depth=1.05,
                           leg_width=1.05, extras=['belt', 'truncheon']),
    'prole_man': dict(top='prole_jacket', legs='prole_trousers', hair='hair_grey', hair_style='short', cap='flat', coat=True, width=1.05),
    'prole_woman': dict(top='prole_dress', legs='skin', lower_legs='skin', skirt='prole_dress', hair='hair_dark', hair_style='bun',
                        female=True, width=1.2, depth=1.2, leg_width=1.05, extras=['apron'], shoes='shoe'),
    'charrington': dict(top='prole_jacket', legs='prole_trousers', hair='hair_grey', hair_style='bald', spectacles=True,
                        width=0.95, coat=True),
    'child': dict(top='fabric_grey', legs='overalls_blue', lower_legs='skin', hair='hair_fair', hair_style='short',
                  extras=['neckerchief'], scale=0.66),
    'guard': dict(top='uniform_black', hair='hair_dark', hair_style='short', width=1.25, depth=1.15, leg_width=1.15, extras=['belt', 'truncheon']),
}


def build_character(name, spec):
    arm = build_armature(name)
    body = build_body(name, spec)
    ob = body.finish(box_uv=False)
    for bn in BONE_NAMES:
        ob.vertex_groups.new(name=bn)
    ob.parent = arm
    mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = arm
    make_actions(arm)
    sc = spec.get('scale', 1.0)
    if sc != 1.0:
        arm.scale = (sc, sc, sc)
        bpy.context.view_layer.update()
    return [arm, ob]


def statue():
    """Big Brother in a greatcoat, right hand in his coat, gazing south."""
    jt = dict(J)
    jt['forearm.R'] = (Vector((-0.235, -0.07, 1.13)), Vector((-0.05, -0.17, 1.22)))
    jt['upperarm.R'] = (Vector((-0.185, 0, 1.415)), Vector((-0.235, -0.07, 1.13)))
    jt['hand.R'] = (Vector((-0.05, -0.17, 1.22)), Vector((0.03, -0.16, 1.26)))
    jt['thigh.L'] = (Vector((0.095, 0, 0.93)), Vector((0.13, -0.08, 0.5)))
    jt['shin.L'] = (Vector((0.13, -0.08, 0.5)), Vector((0.14, -0.1, 0.09)))
    jt['foot.L'] = (Vector((0.14, -0.1, 0.09)), Vector((0.15, -0.25, 0.03)))
    spec = dict(top='stone_statue', skin='stone_statue', hair='stone_statue', hair_style='thick', coat=True,
                width=1.15, depth=1.1, moustache=True, shoes='stone_statue')
    b = build_body('statue', spec, jt)
    ob = b.finish(box_uv=False)
    for bn in BONE_NAMES:
        ob.vertex_groups.new(name=bn)
    ob.scale = (4.2, 4.2, 4.2)
    return ob
