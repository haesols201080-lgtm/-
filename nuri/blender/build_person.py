"""The stranger: a grown man of about 45, built from MakeHuman's CC0 data (the base mesh, its shape targets, the
game-engine rig with its weights, the eyes) read here directly - none of MakeHuman's or MPFB's code is run.

Stages (each can be previewed): the body (macro shape: gender, age, muscle, weight, height, proportions, a mix of
ethnicities; a few face and body details that make him someone in particular), the rig built on the shaped body
(its joints at the means of MakeHuman's joint helpers, so they follow the shape) and skinned with MakeHuman's
weights, eye-closure and a few expression shape keys, the eyes fitted to the sockets.

usage: python -I blender/build_person.py <makehuman data dir> [--preview out.png]
  the data dir holds MPFB2's src/mpfb/data (3dobjs, targets, rigs) and MakeHuman's makehuman/data/eyes"""
import bpy, gzip, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[1:]
DATA = ARGS[0]
def opt(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS and ARGS.index(name) + 1 < len(ARGS) else default
MPFB = os.path.join(DATA, 'mpfb')        # (MPFB2's data folder: 3dobjs, targets, rigs, textures)
CLOTH = os.path.join(DATA, 'cloth')      # (Poly Haven fabrics: <id>/Diffuse_2k.jpg, nor_gl_2k.jpg, arm_2k.jpg)
TEXOUT = opt('--tex', '/tmp/stranger_tex')
EYES = os.path.join(DATA, 'eyes')        # (MakeHuman's eyes: high-poly mesh, its fitting, the iris texture)

# ---------------------------------------------------------------- reading MakeHuman's files
def read_obj(path):
    V, VT, F, FT, G = [], [], [], [], []
    cur = None
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('v '): V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '): VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('g '): cur = line.split()[1] if len(line.split()) > 1 else None
        elif line.startswith('f '):
            ids = [p.split('/') for p in line.split()[1:]]
            F.append([int(i[0]) - 1 for i in ids]); FT.append([int(i[1]) - 1 if len(i) > 1 and i[1] else -1 for i in ids]); G.append(cur)
    return np.array(V, np.float64), np.array(VT, np.float64), F, FT, G

def read_target(path):
    idx, off = [], []
    with gzip.open(path, 'rt') as f:
        for line in f:
            p = line.split()
            if len(p) == 4 and not line.startswith('#'): idx.append(int(p[0])); off.append([float(x) for x in p[1:]])
    return np.array(idx, np.int64), np.array(off, np.float64)

def tri(v, lo, hi):
    return {lo: 1 - v / 0.5, 'average': v / 0.5} if v < 0.5 else {'average': 1 - (v - 0.5) / 0.5, hi: (v - 0.5) / 0.5}

def macro_targets(gender, age, muscle, weight, height, proportions, race):
    """MakeHuman's macro modifier: the targets and their weights for a set of macro values (all 0..1)"""
    G = {'female': 1 - gender, 'male': gender}
    if age < 0.1875: A = {'baby': 1 - age / 0.1875, 'child': age / 0.1875}
    elif age < 0.5: A = {'child': 1 - (age - 0.1875) / 0.3125, 'young': (age - 0.1875) / 0.3125}
    else: A = {'young': 1 - (age - 0.5) / 0.5, 'old': (age - 0.5) / 0.5}
    MU = {k + 'muscle': x for k, x in tri(muscle, 'min', 'max').items()}
    WE = {k + 'weight': x for k, x in tri(weight, 'min', 'max').items()}
    H = {'minheight': 1 - height / 0.5} if height < 0.5 else {'maxheight': (height - 0.5) / 0.5}
    P = {'uncommonproportions': 1 - proportions / 0.5} if proportions < 0.5 else {'idealproportions': (proportions - 0.5) / 0.5}
    tot = sum(race.values()); race = {k: v / tot for k, v in race.items()}
    out = []
    for g, gw in G.items():
        for a, aw in A.items():
            for r, rw in race.items(): out.append((f'macrodetails/{r}-{g}-{a}', rw * gw * aw))
            for m, mw in MU.items():
                for w, ww in WE.items():
                    base = gw * aw * mw * ww
                    out.append((f'macrodetails/universal-{g}-{a}-{m}-{w}', base))
                    for h, hw in H.items(): out.append((f'macrodetails/height/{g}-{a}-{m}-{w}-{h}', base * hw))
                    for p, pw in P.items(): out.append((f'macrodetails/proportions/{g}-{a}-{m}-{w}-{p}', base * pw))
    return [(n, x) for n, x in out if x > 1e-5]

# ---------------------------------------------------------------- the man
# 45 (MakeHuman's age 0.5 is 25 and 1.0 is 90), a bit heavy, a bit taller than average, mostly European
AGE_YEARS = 45
MACRO = dict(gender=1.0, age=0.5 + (AGE_YEARS - 25) / (90 - 25) * 0.5, muscle=0.56, weight=0.62, height=0.52, proportions=0.6,
             race={'caucasian': 0.8, 'asian': 0.12, 'african': 0.08})
# what makes him himself: a long straight nose with a slight hump, heavy brows, bags under the eyes, a square jaw
# with a little softness under it, cheekbones, a thick neck, a bit of a belly
DETAIL = [('nose/nose-scale-vert-incr', 0.25), ('nose/nose-hump-incr', 0.35), ('nose/nose-width2-incr', 0.15),
          ('eyebrows/eyebrows-trans-down', 0.25), ('eyes/l-eye-bag-incr', 0.45), ('eyes/r-eye-bag-incr', 0.45),
          ('chin/chin-width-incr', 0.3), ('chin/chin-prominent-incr', 0.15), ('cheek/l-cheek-bones-incr', 0.25), ('cheek/r-cheek-bones-incr', 0.25),
          ('head/head-square', 0.25), ('neck/measure-neck-circ-incr', 0.35), ('stomach/stomach-pregnant-incr', 0.18),
          ('mouth/mouth-scale-horiz-incr', 0.15), ('mouth/mouth-lowerlip-volume-incr', 0.15)]
# expression units as shape keys (eyes shut for sleep and blinks, a slack mouth, brows)
EXPR = [('blink_L', 'eye-left-closure'), ('blink_R', 'eye-right-closure'), ('mouth_open', 'mouth-open'),
        ('brows_up_L', 'eyebrows-left-up'), ('brows_up_R', 'eyebrows-right-up'), ('brows_down_L', 'eyebrows-left-down'), ('brows_down_R', 'eyebrows-right-down'),
        ('squint_L', 'eye-left-slit'), ('squint_R', 'eye-right-slit')]

def build_shape():
    V, VT, F, FT, G = read_obj(os.path.join(MPFB, '3dobjs', 'base.obj'))
    X = V.copy(); used = []
    for name, w in macro_targets(**MACRO) + DETAIL:
        path = os.path.join(MPFB, 'targets', name + '.target.gz')
        if not os.path.exists(path): print('  (no target', name + ')'); continue
        i, o = read_target(path)
        if len(i): X[i] += o * w
        used.append(name)
    print(f'shape: {len(used)} targets')
    expr = {}
    for key, unit in EXPR:
        d = np.zeros_like(X)
        for race, rw in MACRO['race'].items():
            path = os.path.join(MPFB, 'targets', 'expression', 'units', race, unit + '.target.gz')
            if os.path.exists(path):
                i, o = read_target(path)
                if len(i): d[i] += o * rw / sum(MACRO['race'].values())
        expr[key] = d
    return V, X, VT, F, FT, G, expr

# MakeHuman: y up, decimetres, the face toward +z. Blender: z up, metres, the face toward -y.
def to_bl(a): a = np.asarray(a); return np.stack([a[..., 0], -a[..., 2], a[..., 1]], -1) * 0.1

def mesh_from(name, X, VT, F, FT, G, want, expr=None):
    """a mesh of the faces in the groups `want`, its vertices renumbered; returns the object and old->new indices"""
    faces = [(f, ft) for f, ft, g in zip(F, FT, G) if g in want]
    old = sorted({i for f, _ in faces for i in f}); remap = {o: n for n, o in enumerate(old)}
    me = bpy.data.meshes.new(name); P = to_bl(X[old])
    me.from_pydata(P.tolist(), [], [[remap[i] for i in f] for f, _ in faces])
    uv = me.uv_layers.new(name='UVMap'); li = 0
    for f, ft in faces:
        for k in range(len(f)): uv.data[li].uv = VT[ft[k]] if ft[k] >= 0 else (0, 0); li += 1
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if expr:
        ob.shape_key_add(name='Basis', from_mix=False)
        for key, d in expr.items():
            sk = ob.shape_key_add(name=key, from_mix=False); sk.data.foreach_set('co', to_bl((X + d)[old]).ravel()); sk.value = 0.0
    return ob, remap

def make_body(X, VT, F, FT, G, expr):
    groups = {}
    for f, g in zip(F, G): groups.setdefault(g, set()).update(f)
    ob, remap = mesh_from('stranger_body', X, VT, F, FT, G, {'body'}, expr)
    return ob, groups, remap

def joint(X, spec, groups):
    s = spec.get('strategy')
    if s == 'CUBE' and ('mh:' + spec['cube_name']) in groups_bl: return Vector(to_bl(X[sorted(groups[spec['cube_name']])].mean(0)))
    if s == 'MEAN': return Vector(to_bl(X[spec['vertex_indices']].mean(0)))
    if s == 'VERTEX': return Vector(to_bl(X[spec['vertex_index']]))
    return Vector(spec['default_position'])

def make_rig(ob, X, groups, remap, rig_name='game_engine'):
    global groups_bl
    groups_bl = {'mh:' + g for g in groups}
    R = json.load(open(os.path.join(MPFB, 'rigs', 'standard', f'rig.{rig_name}.json')))
    W = json.load(open(os.path.join(MPFB, 'rigs', 'standard', f'weights.{rig_name}.json')))['weights']
    arm = bpy.data.armatures.new('stranger_rig'); rig = bpy.data.objects.new('stranger_rig', arm); bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for name, b in R.items():
        e = arm.edit_bones.new(name); e.head = joint(X, b['head'], groups); e.tail = joint(X, b['tail'], groups)
        if (e.tail - e.head).length < 1e-4: e.tail = e.head + Vector((0, 0, 0.02))
        e.roll = b.get('roll', 0); eb[name] = e
    for name, b in R.items():
        if b.get('parent'): eb[name].parent = eb[b['parent']]; eb[name].use_connect = bool(b.get('use_connect'))
    bpy.ops.object.mode_set(mode='OBJECT')
    skin(ob, W, remap, rig)
    return rig, W

def skin(ob, W, remap, rig):
    for bone, pairs in W.items():
        for i, w in pairs:
            n = remap.get(int(i))
            if n is None: continue
            vg = ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            vg.add([n], float(w), 'REPLACE')
    ob.parent = rig
    mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig

def landmarks(X, groups):
    """named points on the shaped body (the joint helpers' centres), in Blender's frame, before the helpers go"""
    out = {}
    for g in groups:
        if g and g.startswith('joint-'): out[g[6:]] = Vector(to_bl(X[sorted(groups[g])].mean(0)))
    return out

# ---------------------------------------------------------------- the eyes (MakeHuman's high-poly eyes fitted to the shaped sockets)
def read_mhclo(path):
    scales, refs, in_verts = {}, [], False
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p or line.startswith('#'): continue
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): scales[p[0][0]] = (int(p[1]), int(p[2]), float(p[3])); continue
        if p[0] == 'verts': in_verts = True; continue
        if in_verts:
            if p[0] in ('delete_verts',) or not p[0].lstrip('-').replace('.', '').isdigit(): in_verts = False; continue
            if len(p) == 1: refs.append(([int(p[0])], [1.0], [0, 0, 0]))
            elif len(p) >= 9: refs.append(([int(p[0]), int(p[1]), int(p[2])], [float(p[3]), float(p[4]), float(p[5])], [float(p[6]), float(p[7]), float(p[8])]))
    return scales, refs

def fit_proxy(X, obj_path, mhclo_path):
    V, VT, F, FT, G = read_obj(obj_path)
    scales, refs = read_mhclo(mhclo_path)
    s = [abs(X[scales[a][0]][k] - X[scales[a][1]][k]) / scales[a][2] if a in scales else 1.0 for k, a in enumerate('xyz')]
    P = np.array([sum(w * X[v] for v, w in zip(vs, ws)) + np.array(d) * s for vs, ws, d in refs])
    return P, VT, F, FT, G

def make_eyes(X, rig):
    obj = os.path.join(EYES, 'high-poly', 'high-poly.obj'); clo = os.path.join(EYES, 'high-poly', 'high-poly.mhclo')
    if not os.path.exists(obj): print('  (no eyes)'); return None
    P, VT, F, FT, G = fit_proxy(X, obj, clo)
    me = bpy.data.meshes.new('stranger_eyes'); me.from_pydata(to_bl(P).tolist(), [], F)
    uv = me.uv_layers.new(name='UVMap'); li = 0
    for f, ft in zip(F, FT):
        for k in range(len(f)): uv.data[li].uv = VT[ft[k]] if ft[k] >= 0 else (0, 0); li += 1
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('stranger_eyes', me); bpy.context.scene.collection.objects.link(ob)
    print(f'eyes: {len(P)} verts at {tuple(round(c, 3) for c in to_bl(P).mean(0))}')
    vg = ob.vertex_groups.new(name='head'); vg.add(list(range(len(P))), 1.0, 'REPLACE')
    ob.parent = rig; mod = ob.modifiers.new('rig', 'ARMATURE'); mod.object = rig
    return ob



# ---------------------------------------------------------------- eyes that turn, lashes, teeth
def split_eyes(eyes, rig, LM):
    """each eye is a ball (the iris texture) and a clear cornea over it; each gets a bone of its own to look with"""
    me = eyes.data
    m_c = bpy.data.materials.new('cornea'); m_c.use_nodes = True; b = m_c.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (1, 1, 1, 1); b.inputs['Roughness'].default_value = 0.0; b.inputs['Alpha'].default_value = 0.08
    b.inputs['Coat Weight'].default_value = 1.0; m_c.blend_method = 'BLEND' if hasattr(m_c, 'blend_method') else None
    me.materials.append(m_c)
    uv = me.uv_layers[0].data
    for p in me.polygons:
        u = sum(uv[li].uv.x for li in p.loop_indices) / len(p.loop_indices)
        if u > 0.85: p.material_index = 1
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='EDIT')
    for side, key in (('l', 'l-eye'), ('r', 'r-eye')):
        e = rig.data.edit_bones.new('eye_' + side); c = LM[key]; e.head = c; e.tail = c + Vector((0, -0.025, 0)); e.parent = rig.data.edit_bones['head']
    bpy.ops.object.mode_set(mode='OBJECT')
    eyes.vertex_groups.clear()
    for side in ('l', 'r'):
        vg = eyes.vertex_groups.new(name='eye_' + side)
        vg.add([v.index for v in me.vertices if (v.co.x > 0) == (side == 'l')], 1.0, 'REPLACE')

def helper_object(name, X, VT, F, FT, G, want, expr, W, rig, color, rough=0.5):
    ob, remap = mesh_from(name, X, VT, F, FT, G, want, expr)
    skin(ob, W, remap, rig)
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; ob.data.materials.append(m)
    return ob

def lash_alpha(lashes, body):
    """lashes: dark at the lid, fading to their tips (how far each vertex stands off the skin)"""
    from mathutils.kdtree import KDTree
    kd = KDTree(len(body.data.vertices))
    for v in body.data.vertices: kd.insert(v.co, v.index)
    kd.balance()
    d = np.array([kd.find(v.co)[2] for v in lashes.data.vertices])
    a = np.clip(1 - (d - 0.0008) / 0.0055, 0, 1) ** 0.8
    col = np.zeros((len(d), 4), np.float32); col[:, :3] = (0.035, 0.028, 0.024); col[:, 3] = a
    at = lashes.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); at.data.foreach_set('color', col.ravel())

# ---------------------------------------------------------------- hair: the scalp the game grows short hair on
def hair_mask(co, LM):
    E = (LM['l-eye'] + LM['r-eye']) / 2; N = LM['neck']
    x, y, z = co[:, 0], co[:, 1], co[:, 2]; ax = np.abs(x)
    sm = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
    # the hairline: high at the front (receding a little at the temples), down to the top of the ear at the sides,
    # sideburns to mid-ear in front of it, low at the nape
    back = sm(E.y + 0.03, E.y + 0.11, y)                          # 0 at the face, 1 behind the ears
    temple = np.exp(-((ax - 0.045) / 0.018) ** 2)
    line = E.z + 0.088 + temple * 0.016
    line = line * (1 - sm(0.055, 0.075, ax)) + (E.z + 0.012) * sm(0.055, 0.075, ax)          # at the sides
    line = np.minimum(line, E.z + 0.012 - sm(0.05, 0.09, y - E.y) * 0)
    line = line * (1 - back) + (N.z + 0.055) * back                                          # the nape
    side = (ax > 0.062) & (y > E.y + 0.035) & (y < E.y + 0.085)
    line = np.where(side, np.minimum(line, E.z - 0.012), line)                                # sideburns
    m = sm(line - 0.004, line + 0.010, z)
    ear = (ax > 0.066) & (z < E.z + 0.035) & (z > E.z - 0.045) & (y > E.y + 0.06) & (y < E.y + 0.13)
    return np.where(ear, 0.0, m)

def make_scalp(body, LM, rig):
    co = np.array([v.co[:] for v in body.data.vertices]); h = hair_mask(co, LM)
    keep = [p.index for p in body.data.polygons if min(h[v] for v in p.vertices) > 0.03]
    sc = body.copy(); sc.data = body.data.copy(); sc.name = sc.data.name = 'stranger_hair'; bpy.context.scene.collection.objects.link(sc)
    if sc.data.shape_keys: sc.shape_key_clear()
    import bmesh
    bm = bmesh.new(); bm.from_mesh(sc.data); bm.faces.ensure_lookup_table(); ks = set(keep)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in ks], context='FACES'); bm.to_mesh(sc.data); bm.free()
    sc.data.materials.clear()
    m = bpy.data.materials.new('hair'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.03, 0.022, 0.018, 1); b.inputs['Roughness'].default_value = 0.6; sc.data.materials.append(m)
    # the fur data: length (by the mask, longer on top), comb (back and down over the crown, down at the sides and the
    # nape, forward and to the side at the front), in glTF's axes; the exporter turns v into 1 - v, so it is stored so
    me = sc.data; C = np.array([v.co[:] for v in me.vertices]); hm = hair_mask(C, LM)
    E = (LM['l-eye'] + LM['r-eye']) / 2
    top = np.clip((C[:, 2] - E.z) / 0.12, 0, 1)
    length = hm * (0.55 + 0.45 * top)
    me.normals_split_custom_set_from_vertices if False else None
    furl = me.uv_layers.new(name='Fur'); cA = me.uv_layers.new(name='CombXY'); cB = me.uv_layers.new(name='CombZ')
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index; v = me.vertices[vi]; n = v.normal; c = C[vi]
            want = Vector((np.sign(c[0]) * 0.25 * (1 - top[vi]), 0.55 + 0.4 * top[vi], -0.8 * (1 - top[vi]) - 0.15))
            if c[1] < E.y + 0.06 and c[2] > E.z + 0.05: want = Vector((np.sign(c[0]) * 0.5, -0.25, -0.2))   # (the front: forward and aside)
            t = (want - n * want.dot(n)); t = t.normalized() if t.length > 1e-6 else Vector((0, 0, -1))
            furl.data[li].uv = (float(length[vi]), 1.0 - 1.0 / 8.0)
            cA.data[li].uv = (t.x, 1.0 - t.z); cB.data[li].uv = (-t.y, 1.0)
    print(f'hair: {len(me.polygons)} faces of scalp')
    return sc

# ---------------------------------------------------------------- clothes: the body's own faces, stood off it
BONES = {'legs': ['thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r'],
         'torso': ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'],
         'arms': ['upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r'],
         'hands': ['hand_l', 'hand_r'] + [f'{f}_0{i}_{s}' for f in ('thumb', 'index', 'middle', 'ring', 'pinky') for i in (1, 2, 3) for s in 'lr'],
         'head': ['head', 'neck_01']}

def weight_sums(body):
    n = len(body.data.vertices); idx = {vg.index: vg.name for vg in body.vertex_groups}
    per = {k: np.zeros(n) for k in BONES}; bone = {}
    for v in body.data.vertices:
        for g in v.groups:
            name = idx[g.group]
            for k, bs in BONES.items():
                if name in bs: per[k][v.index] += g.weight
            bone.setdefault(name, np.zeros(n))[v.index] = g.weight
    return per, bone

def garment(body, name, sel, thick, mat, smooth=2, solid=0.0025, planes=(), relax=0):
    """the body's faces whose vertices are all selected, moved out along its normals by thick(v), cut clean along
    planes [(point, normal) - keeps the side the normal points to], then relaxed (the body's detail smoothed out of it)"""
    import bmesh
    me = body.data; co = np.array([v.co[:] for v in me.vertices]); nrm = np.array([v.normal[:] for v in me.vertices])
    faces = [p.index for p in me.polygons if all(sel[v] for v in p.vertices)]
    ob = body.copy(); ob.data = me.copy(); ob.name = ob.data.name = name; bpy.context.scene.collection.objects.link(ob)
    if ob.data.shape_keys: ob.shape_key_clear()
    ob.data.vertices.foreach_set('co', (co + nrm * thick[:, None]).ravel())
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table(); keep = set(faces)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
    for pl in planes:
        pt, n = pl[0], pl[1]; region = pl[2] if len(pl) > 2 else None
        fs = [f for f in bm.faces if region is None or region(f.calc_center_median())]
        geom = list({v for f in fs for v in f.verts}) + list({e for f in fs for e in f.edges}) + fs
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(pt), plane_no=-Vector(n).normalized(), clear_outer=True, dist=0.0005)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='VERTS')
    inner = [v for v in bm.verts if not v.is_boundary]
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices[:] for p in me.polygons])
    gap = float(np.percentile(thick, 30))
    for it in range(smooth + relax):
        bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        # (smoothing shrinks: push back out to keep the cloth off the skin)
        for v in bm.verts:
            hit = bvh.find_nearest(v.co)
            if hit[0] is None: continue
            d = v.co - hit[0]
            if d.dot(hit[1]) < gap: v.co = hit[0] + hit[1].normalized() * gap
    bm.to_mesh(ob.data); bm.free()
    for a in list(ob.data.color_attributes): ob.data.color_attributes.remove(a)
    ob.data.materials.clear(); ob.data.materials.append(mat)
    ob['solid'] = solid
    return ob, set(faces)

def finish_garment(ob):
    if ob.get('solid'):
        so = ob.modifiers.new('cloth_thickness', 'SOLIDIFY'); so.thickness = ob['solid']; so.offset = -1; so.use_rim = True
        ob.modifiers.move(len(ob.modifiers) - 1, 0)

def drape(garments, body, pins, frames=40):
    """gravity on the garments, against the body: the fabric settles and folds where it gathers. pins(ob) gives each
    garment's held vertices (shoulders, waistband) and how firmly"""
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = frames
    col = body.modifiers.new('collide', 'COLLISION'); body.collision.thickness_outer = 0.004; body.collision.cloth_friction = 6
    arm = body.modifiers.get('rig'); arm.show_viewport = False
    for ob in garments:
        a = ob.modifiers.get('rig')
        if a: a.show_viewport = False
        w = pins(ob); vg = ob.vertex_groups.new(name='pin')
        for i, x in enumerate(w):
            if x > 0: vg.add([i], float(x), 'REPLACE')
        c = ob.modifiers.new('drape', 'CLOTH'); st = c.settings
        st.quality = 6; st.mass = 0.25; st.air_damping = 2.0; st.tension_stiffness = 18; st.compression_stiffness = 18; st.shear_stiffness = 6; st.bending_stiffness = 0.6
        st.vertex_group_mass = 'pin'; st.pin_stiffness = 2.0
        c.collision_settings.use_self_collision = False; c.collision_settings.distance_min = 0.003
        c.point_cache.frame_start = 1; c.point_cache.frame_end = frames
    for f in range(1, frames + 1): sc.frame_set(f)
    for ob in garments:
        bpy.context.view_layer.objects.active = ob
        dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
        co = [v.co.copy() for v in ev.data.vertices]
        ob.modifiers.remove(ob.modifiers['drape'])
        for v, c_ in zip(ob.data.vertices, co): v.co = c_
        a = ob.modifiers.get('rig')
        if a: a.show_viewport = True
        ob.vertex_groups.remove(ob.vertex_groups['pin'])
    body.modifiers.remove(col); arm.show_viewport = True
    sc.frame_set(1)

def extrude_rim(ob, test, offset):
    """extrude the boundary edges whose vertices pass test(co) by offset(co) (a collar up from the neckline)"""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    edges = [e for e in bm.edges if e.is_boundary and all(test(v.co) for v in e.verts)]
    if not edges: bm.free(); return
    r = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co += offset(v.co)
    bm.to_mesh(ob.data); bm.free()

def cloth_material(name, src, tint=None, tile=8.0, size=2048):
    """a Poly Haven fabric (CC0): its colour (tinted if asked), normal, and AO/roughness/metal, tiled tile times"""
    from PIL import Image
    d = os.path.join(CLOTH, src); out = os.path.join(TEXOUT, name); os.makedirs(TEXOUT, exist_ok=True)
    alb = Image.open(os.path.join(d, 'Diffuse_2k.jpg')).convert('RGB')
    if tint:
        a = np.asarray(alb).astype(np.float32) / 255; lum = (a @ np.array([0.3, 0.59, 0.11]))[..., None]
        a = np.clip(lum / max(lum.mean(), 1e-3) * np.array(tint)[None, None, :], 0, 1); alb = Image.fromarray((a * 255).astype(np.uint8))
    alb.resize((size, size)).save(out + '_albedo.jpg', quality=92)
    Image.open(os.path.join(d, 'nor_gl_2k.jpg')).convert('RGB').resize((size, size)).save(out + '_normal.jpg', quality=92)
    Image.open(os.path.join(d, 'arm_2k.jpg')).convert('RGB').resize((size, size)).save(out + '_orm.jpg', quality=92)
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (tile, tile, 1); nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    def tex(path, cs):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path); t.image.colorspace_settings.name = cs; nt.links.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    ta = tex(out + '_albedo.jpg', 'sRGB'); nt.links.new(ta.outputs['Color'], b.inputs['Base Color'])
    tn = tex(out + '_normal.jpg', 'Non-Color'); nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    to = tex(out + '_orm.jpg', 'Non-Color'); sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs['Color'], sp.inputs[0])
    nt.links.new(sp.outputs[1], b.inputs['Roughness']); nt.links.new(sp.outputs[2], b.inputs['Metallic'])
    return m

def bone_points(rig):
    B = rig.data.bones
    return {n: (B[n].head_local.copy(), B[n].tail_local.copy()) for n in B.keys()}

def crotch_z(body, LM):
    """the lowest point of the body's midline just below the hips (where the legs part)"""
    co = np.array([v.co[:] for v in body.data.vertices]); zP = LM['pelvis'].z
    cand = co[(np.abs(co[:, 0]) < 0.012) & (co[:, 2] < zP + 0.05) & (co[:, 2] > zP - 0.3)]
    return float(cand[:, 2].min())

def make_clothes(body, rig, LM):
    me = body.data; co = np.array([v.co[:] for v in me.vertices]); x, y, z = co.T
    per, bone = weight_sums(body); BP = bone_points(rig)
    legs, torso, arms, hands, head = per['legs'], per['torso'], per['arms'], per['hands'], per['head']
    zP = LM['pelvis'].z; zN = LM['neck'].z; zC = crotch_z(body, LM); zA = (LM['l-ankle'].z + LM['r-ankle'].z) / 2
    sm = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1)
    def side(pt, n, margin=0.012, region=None):   # vertices on the kept side of a plane (a margin past it: the cut is clean)
        ok = ((co - np.array(pt)) @ np.array(n) / np.linalg.norm(n)) > -margin
        if region is not None: ok |= ~np.array([region(Vector(c)) for c in co])
        return ok
    ARM = {s_: (lambda c, s_=s_: c.x * (1 if s_ == 'l' else -1) > 0.2) for s_ in 'lr'}
    wrist, fore, arm_mid, arm_dir = {}, {}, {}, {}
    for s_ in 'lr':
        h0 = BP['hand_' + s_][0]; e0 = BP['lowerarm_' + s_][0]; u0, u1 = BP['upperarm_' + s_]
        fore[s_] = (h0 - e0).normalized(); wrist[s_] = h0; arm_dir[s_] = (u1 - u0).normalized(); arm_mid[s_] = u0 + (u1 - u0) * 0.5
    out, covered = {}, {}
    # --- the sweater: crew neck, over the hips, to the wrists
    hem = zC + 0.075
    neck_pt = Vector((0, LM['neck'].y - 0.03, zN - 0.012)); neck_n = Vector((0, 0.35, -1))            # (lower in front)
    planes = [((0, 0, hem), (0, 0, 1)), (neck_pt, neck_n)] + [(wrist[s_] - fore[s_] * 0.015, -fore[s_], ARM[s_]) for s_ in 'lr']
    sel = (torso + arms + head * (z < zN)) > 0.4
    for pl in planes: sel &= side(pl[0], pl[1], region=pl[2] if len(pl) > 2 else None)
    sel &= hands < 0.5
    th = np.where(arms > 0.5, 0.016, 0.024) + 0.01 * sm(zP + 0.12, hem, z)
    sw, cov = garment(body, 'stranger_sweater', sel, th, cloth_material('sweater', 'jersey_melange', (0.30, 0.27, 0.23), tile=16), smooth=3, solid=0.003, planes=planes, relax=10)
    out['sweater'] = sw; covered['sweater'] = cov
    # --- jeans: from the waist into the boots
    waist = zP + 0.075
    planes = [((0, 0, waist), (0, 0, -1)), ((0, 0, zA + 0.07), (0, 0, 1))]
    sel = (legs + torso) > 0.5
    for pt, n in planes: sel &= side(pt, n)
    th = 0.011 + 0.012 * sm(zP - 0.1, zP - 0.45, z)
    jn, cov = garment(body, 'stranger_jeans', sel, th, cloth_material('jeans', 'denim_fabric', (0.16, 0.2, 0.3), tile=12), smooth=2, solid=0.0025, planes=planes, relax=8)
    out['jeans'] = jn; covered['jeans'] = cov
    # --- gloves, with a short cuff past the wrist
    planes = [(wrist[s_] - fore[s_] * 0.05, fore[s_]) for s_ in 'lr']
    sel = (hands + arms) > 0.3
    sel &= np.array([side(planes[0][0], planes[0][1])[i] if x[i] > 0 else side(planes[1][0], planes[1][1])[i] for i in range(len(co))])
    th = 0.0028 + 0.003 * (hands < 0.5)
    gl, cov = garment(body, 'stranger_gloves', sel, th, cloth_material('gloves', 'brown_leather', None, tile=6), smooth=1, solid=0.0015,
                      planes=[], relax=0)
    out['gloves'] = gl; covered['gloves'] = cov
    # --- for bed: a T-shirt, sleeves to mid upper arm, over the hips
    planes = [((0, 0, zC + 0.07), (0, 0, 1)), (neck_pt + Vector((0, 0, 0.004)), neck_n)] + [(arm_mid[s_], -arm_dir[s_], ARM[s_]) for s_ in 'lr']
    sel = (torso + arms + head * (z < zN)) > 0.4
    for pl in planes: sel &= side(pl[0], pl[1], region=pl[2] if len(pl) > 2 else None)
    th = 0.011 + 0.01 * sm(zP + 0.2, zP, z)
    ts, cov = garment(body, 'stranger_tshirt', sel, th, cloth_material('tshirt', 'cotton_jersey', (0.52, 0.52, 0.55), tile=12), smooth=2, solid=0.002, planes=planes, relax=8)
    out['tshirt'] = ts; covered['tshirt'] = cov
    # gravity and the body under them
    def pins(ob):
        c = np.array([v.co[:] for v in ob.data.vertices])
        if ob.name == 'stranger_jeans': return sm(waist - 0.12, waist - 0.02, c[:, 2])
        top = sm(zN - 0.17, zN - 0.07, c[:, 2])
        ax = np.abs(c[:, 0]); sleeve_top = sm(0.12, 0.2, ax) * sm(-0.2, 0.0, c[:, 2] - (zN - 0.1)) * 0.5
        return np.clip(top + sleeve_top, 0, 1)
    drape([out['sweater'], out['jeans'], out['tshirt']], body, pins, frames=int(opt('--drape', 36)))
    # rib bands: the sweater's hem, cuffs and collar; the T-shirt's neck band
    rib = rib_material('rib', (0.2, 0.18, 0.15))
    for ob, test, off in (
            (out['sweater'], lambda c: c.z < hem + 0.02, lambda c: Vector((-c.x * 0.03, -(c.y - LM['pelvis'].y) * 0.04, -0.05))),
            (out['sweater'], lambda c: c.z > zN - 0.08, lambda c: Vector((-c.x * 0.1, -(c.y - LM['neck'].y) * 0.1, 0.018))),
            (out['tshirt'], lambda c: c.z > zN - 0.08, lambda c: Vector((-c.x * 0.08, -(c.y - LM['neck'].y) * 0.08, 0.01)))):
        band(ob, test, off, rib if ob is out['sweater'] else None)
    for s_ in 'lr':
        band(out['sweater'], lambda c, s_=s_: (c - wrist[s_]).length < 0.09 and ((c.x > 0) == (s_ == 'l')), lambda c, s_=s_: fore[s_] * 0.05 - (c - (wrist[s_] - fore[s_] * 0.015)) * 0.12, rib)
    for ob in out.values(): finish_garment(ob)
    print('clothes:', {k: len(v.data.polygons) for k, v in out.items()}, 'crotch', round(zC, 3))
    return out, covered

def band(ob, test, offset, mat):
    """a ribbed band from a garment's open edge (hem, cuff, collar)"""
    import bmesh
    if mat and mat.name not in [m.name for m in ob.data.materials if m]: ob.data.materials.append(mat)
    mi = [m.name for m in ob.data.materials].index(mat.name) if mat else 0
    bm = bmesh.new(); bm.from_mesh(ob.data)
    edges = [e for e in bm.edges if e.is_boundary and all(test(v.co) for v in e.verts)]
    if not edges: bm.free(); return
    r = bmesh.ops.extrude_edge_only(bm, edges=edges)
    for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co += offset(v.co)
    for f in [g for g in r['geom'] if isinstance(g, bmesh.types.BMFace)]: f.material_index = mi
    bm.to_mesh(ob.data); bm.free()

def rib_material(name, color):
    """a knit rib: vertical ridges every few millimetres (a normal map drawn here), the yarn's colour"""
    from PIL import Image
    os.makedirs(TEXOUT, exist_ok=True); W = 512
    u = np.arange(W) / W; ridge = np.sin(u * 2 * np.pi * 24)
    nx = np.tile(((ridge * 0.6) * 0.5 + 0.5)[None, :], (W, 1)); ny = np.full((W, W), 0.5); nz = np.sqrt(np.clip(1 - (nx * 2 - 1) ** 2, 0, 1)) * 0.5 + 0.5
    Image.fromarray((np.stack([nx, ny, nz], -1) * 255).astype(np.uint8)).save(os.path.join(TEXOUT, name + '_normal.png'))
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = 0.9
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (12, 12, 1); nt.links.new(tc.outputs['UV'], mp.inputs['Vector'])
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(TEXOUT, name + '_normal.png')); t.image.colorspace_settings.name = 'Non-Color'; nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    return m

# ---------------------------------------------------------------- hair cards
def make_hair_cards(body, LM, strands):
    """short hair as cards: strips carrying the strand texture, rooted over the scalp in layers, each following the
    comb and the curve of the head (re-projected onto it as it goes): longer on top, combed back from a side parting,
    short at the sides and the nape"""
    from mathutils.bvhtree import BVHTree
    from mathutils.kdtree import KDTree
    rnd = np.random.default_rng(11)
    me = body.data; co = np.array([v.co[:] for v in me.vertices]); hm = hair_mask(co, LM)
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    E = (LM['l-eye'] + LM['r-eye']) / 2; part = 0.028
    # root points: scattered over the scalp faces by area, where the mask says hair grows
    tris = [(p.vertices[0], p.vertices[i], p.vertices[i + 1]) for p in me.polygons for i in range(1, len(p.vertices) - 1)]
    tris = [t for t in tris if hm[list(t)].mean() > 0.35]
    A = np.array([0.5 * np.linalg.norm(np.cross(co[b] - co[a], co[c] - co[a])) for a, b, c in tris]); cdf = np.cumsum(A) / A.sum()
    def comb(p, n):
        # how far up the head (0 at the ear tops, 1 on the crown) and how far back (0 at the face, 1 at the back)
        up = float(np.clip((p.z - E.z - 0.02) / 0.07, 0, 1)); back = float(np.clip((p.y - E.y - 0.10) / 0.07, 0, 1))
        top = Vector((np.sign(p.x - part) * 0.3, 1.0, 0.9))                       # (back over the top, away from the parting: up the forehead)
        side = Vector((0, 0.55, -1.0))                                             # (the sides: down and back)
        nape = Vector((0, 0.1, -1.0))                                              # (the back: straight down)
        d = side.lerp(top, up); d = d.lerp(nape, back * (1 - up) ** 0.5)
        t = d - n * d.dot(n); return t.normalized() if t.length > 1e-6 else Vector((0, 0, -1))
    verts, faces, uvs = [], [], []
    for layer, (count, lift, lscale) in enumerate(((1500, 0.0012, 0.8), (1200, 0.003, 0.95), (800, 0.0048, 1.05))):
        for _ in range(count):
            t = tris[int(np.searchsorted(cdf, rnd.random()))]; r1, r2 = rnd.random(), rnd.random()
            if r1 + r2 > 1: r1, r2 = 1 - r1, 1 - r2
            p = Vector(co[t[0]] + r1 * (co[t[1]] - co[t[0]]) + r2 * (co[t[2]] - co[t[0]]))
            loc, n, _, _ = bvh.find_nearest(p); n = n.normalized()
            top = np.clip((p.z - E.z - 0.06) / 0.05, 0, 1); back = np.clip((p.y - E.y - 0.09) / 0.06, 0, 1)
            L = (0.014 + 0.022 * top) * (1 - 0.25 * back * (1 - top)) * lscale * rnd.uniform(0.8, 1.15)
            if p.z < LM['neck'].z + 0.09: L *= 0.6
            W = rnd.uniform(0.007, 0.011) * (0.85 + 0.3 * top)
            segs = 4; pts = []; cur = loc - n * 0.001; nn = n
            for k in range(segs + 1):
                if k:
                    d = comb(cur, nn); step = d * (L / segs)
                    cur = cur + step
                    hit = bvh.find_nearest(cur)
                    if hit[0] is not None:
                        nn = hit[1].normalized(); h = lift * min(1, k / 1.5) + 0.0015 * layer * (k / segs)
                        cur = hit[0] + nn * h
                pts.append((cur.copy(), nn.copy()))
            col = int(rnd.integers(0, 4)); u0 = col / 4 + 0.01; u1 = (col + 1) / 4 - 0.01; vmax = min(1.0, L / 0.04)
            base = len(verts)
            for k, (q, nq) in enumerate(pts):
                d = comb(q, nq); side = nq.cross(d).normalized() * (W / 2) * (1 - 0.3 * k / segs)
                tw = nq * (rnd.uniform(-0.3, 0.3) * W * 0.2)
                verts += [q - side + tw, q + side - tw]; v = k / segs * vmax
                uvs += [(u0, 1 - v), (u1, 1 - v)]
            for k in range(segs): faces.append((base + 2 * k, base + 2 * k + 1, base + 2 * k + 3, base + 2 * k + 2))
    mh = bpy.data.meshes.new('stranger_hair'); mh.from_pydata([v[:] for v in verts], [], faces)
    uv = mh.uv_layers.new(name='UVMap')
    for p in mh.polygons:
        for li, vi in zip(p.loop_indices, p.vertices): uv.data[li].uv = uvs[vi]
    for p in mh.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('stranger_hair', mh); bpy.context.scene.collection.objects.link(ob)
    m = bpy.data.materials.new('hair'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = bpy.data.images.load(strands + '_albedo.png')
    nt.links.new(ta.outputs['Color'], b.inputs['Base Color']); nt.links.new(ta.outputs['Alpha'], b.inputs['Alpha'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(strands + '_normal.png'); tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = 0.45; b.inputs['Coat Weight'].default_value = 0.0
    try: m.blend_method = 'CLIP'
    except Exception: pass
    m.use_backface_culling = False
    mh.materials.append(m)
    vg = ob.vertex_groups.new(name='head'); vg.add(list(range(len(verts))), 1.0, 'REPLACE')
    print(f'hair: {len(faces)} card segments, {len(faces) // 4} cards')
    return ob

def make_boots(body, rig, LM, boots_path):
    """the scanned rubber boots (Poly Haven, CC0) on the feet: sized to them, sole to sole, weighted from the leg"""
    if not os.path.exists(boots_path): print('  (no boots)'); return []
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=boots_path)
    new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in meshes:
        if o.parent: mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    # one mesh with both boots: split by which side of the scan's own centre each piece sits
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes: o.select_set(True)
    if len(meshes) > 1: bpy.ops.object.join()
    src = bpy.context.view_layer.objects.active; src.select_set(True); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    cx = np.mean([np.array([(o.matrix_world @ v.co)[:] for v in o.data.vertices]).mean(0)[0] for o in parts])
    sides = {'l': [o for o in parts if np.array([v.co[:] for v in o.data.vertices]).mean(0)[0] > cx], 'r': [o for o in parts if np.array([v.co[:] for v in o.data.vertices]).mean(0)[0] <= cx]}
    per, bone = weight_sums(body); bco = np.array([v.co[:] for v in body.data.vertices])
    from mathutils.kdtree import KDTree
    out = []
    for s_, ps in sides.items():
        for o in bpy.context.selected_objects: o.select_set(False)
        for o in ps: o.select_set(True)
        bpy.context.view_layer.objects.active = ps[0]
        if len(ps) > 1: bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active; ob.name = 'stranger_boot_' + s_
        P = np.array([v.co[:] for v in ob.data.vertices])
        foot = (bone.get('foot_' + s_, 0) + bone.get('ball_' + s_, 0)) > 0.5
        F = bco[foot]; flen = np.ptp(F[:, 1]); fmin = F.min(0); fmax = F.max(0)
        # the scan's long axis is its length; its lowest points the sole
        ext = np.ptp(P, 0); ax = int(np.argmax(ext[:2]))
        k = flen * 1.12 / ext[ax]
        Q = (P - P.min(0)) * k
        if ax == 0: Q = Q[:, [1, 0, 2]]
        # heel to the back of the heel, toe forward (-y), centred on the foot
        Q[:, 0] += (fmin[0] + fmax[0]) / 2 - (Q[:, 0].min() + Q[:, 0].max()) / 2
        Q[:, 1] += fmin[1] - 0.012 - Q[:, 1].min()
        Q[:, 2] += fmin[2] - 0.012
        # (point the toe forward: if the toe end is the taller end, turn it round)
        hi = Q[:, 2] > Q[:, 2].min() + 0.6 * np.ptp(Q[:, 2])
        if Q[hi, 1].mean() < Q[:, 1].mean():
            Q[:, 1] = (Q[:, 1].max() + Q[:, 1].min()) - Q[:, 1]
        ob.data.vertices.foreach_set('co', Q.ravel()); ob.matrix_world = Matrix.Identity(4); ob.data.update()
        # weights: each boot vertex takes those of the nearest leg vertex below the knee
        legv = np.where((bco[:, 2] < LM[s_ + '-knee'].z) & ((bco[:, 0] > 0) == (s_ == 'l')))[0]
        kd = KDTree(len(legv))
        for j, i in enumerate(legv): kd.insert(bco[i], j)
        kd.balance()
        groups = {}
        for v in ob.data.vertices:
            _, j, _ = kd.find(v.co); bi = legv[j]
            for g in body.data.vertices[bi].groups:
                name = body.vertex_groups[g.group].name
                groups.setdefault(name, []).append((v.index, g.weight))
        ob.vertex_groups.clear()
        for name, pairs in groups.items():
            vg = ob.vertex_groups.new(name=name)
            for vi, w in pairs: vg.add([vi], w, 'REPLACE')
        ob.parent = rig; m = ob.modifiers.new('rig', 'ARMATURE'); m.object = rig
        out.append(ob)
    for o in list(bpy.data.objects):
        if o not in out and o.type == 'EMPTY' and not o.children: bpy.data.objects.remove(o)
    print('boots:', [(o.name, len(o.data.vertices)) for o in out])
    return out

def dressed_body(body, covered, name='stranger_body_out'):
    """the body with the skin under the clothes taken away (no poking through), for the outdoor outfit"""
    import bmesh
    ob = body.copy(); ob.data = body.data.copy(); ob.name = ob.data.name = name; bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.faces.ensure_lookup_table()
    gone = [f for f in bm.faces if f.index in covered]
    # keep a ring under each garment's edge
    edge = {v for f in bm.faces if f.index not in covered for v in f.verts}
    gone = [f for f in gone if not any(v in edge for v in f.verts)]
    bmesh.ops.delete(bm, geom=gone, context='FACES'); bm.to_mesh(ob.data); bm.free()
    return ob

# ---------------------------------------------------------------- the skin, baked
def face_masks(body, LM):
    """per-vertex masks on the head, from the landmarks: R the beard (jaw, chin, upper lip, under the jaw), G the
    flush (cheeks, nose), B the forehead (where its lines are), A the brows"""
    E = (LM['l-eye'] + LM['r-eye']) / 2; M = LM['mouth']; J = LM['jaw']; H2 = LM['head-2']
    out = np.zeros((len(body.data.vertices), 4), np.float32)
    sm = lambda e0, e1, x: np.clip((x - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((x - e0) / (e1 - e0), 0, 1))
    co = np.array([v.co[:] for v in body.data.vertices]); x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    front = sm(E.y + 0.10, E.y + 0.045, y)                       # (forward of the ears)
    # beard: from below the cheekbones down over the jaw and under it, the upper lip; not the lips themselves
    top = 1 - sm(E.z - 0.055, E.z - 0.035, z)
    bottom = sm(J.z - 0.075, J.z - 0.035, z)
    side = 1 - sm(0.062, 0.075, ax)
    beard = top * bottom * side * front
    out[:, 0] = beard
    # flush: the cheeks and the tip of the nose
    ch = np.exp(-(((ax - 0.045) / 0.022) ** 2 + ((z - (E.z - 0.035)) / 0.022) ** 2)) * front
    nose = np.exp(-((ax / 0.012) ** 2 + ((z - (E.z - 0.045)) / 0.015) ** 2 + ((y - (E.y - 0.05)) / 0.02) ** 2))
    out[:, 1] = np.clip(ch * 0.9 + nose * 0.7, 0, 1)
    # forehead
    out[:, 2] = sm(E.z + 0.03, E.z + 0.045, z) * (1 - sm(H2.z - 0.06, H2.z - 0.035, z)) * (1 - sm(0.045, 0.06, ax)) * front
    # brows: an arc over each eye, thick at the inner end
    for s_ in (1, -1):
        ex = LM['l-eye'].x if s_ > 0 else LM['r-eye'].x
        u = (x * s_ - (abs(ex) - 0.018)) / 0.05                     # 0 at the inner end, 1 at the outer
        arc = E.z + 0.024 + 0.006 * np.sin(np.clip(u, 0, 1) * math.pi * 0.8) - 0.004 * np.clip(u, 0, 1)
        thick = 0.0075 * (1 - 0.45 * np.clip(u, 0, 1))
        b = np.exp(-((z - arc) / thick) ** 4) * sm(-0.08, 0.05, u) * (1 - sm(0.9, 1.08, u)) * front * (x * s_ > 0)
        out[:, 3] = np.maximum(out[:, 3], b)
    attr = body.data.color_attributes.new('masks', 'FLOAT_COLOR', 'POINT')
    attr.data.foreach_set('color', out.ravel())
    hm = hair_mask(co, LM); h4 = np.zeros((len(co), 4), np.float32); h4[:, 0] = hm; h4[:, 3] = 1
    ha = body.data.color_attributes.new('hairmask', 'FLOAT_COLOR', 'POINT'); ha.data.foreach_set('color', h4.ravel())
    return out

def skin_nodes(m, masks_dir):
    nt = m.node_tree; N, L = nt.nodes, nt.links
    for n in list(N): N.remove(n)
    def node(t, **kw):
        n = N.new(t)
        for k, v in kw.items():
            if k.startswith('i_'): n.inputs[k[2:].replace('_', ' ')].default_value = v
            else: setattr(n, k, v)
        return n
    def img(name):
        n = node('ShaderNodeTexImage'); n.image = bpy.data.images.load(os.path.join(masks_dir, name)); n.image.colorspace_settings.name = 'Non-Color'; return n.outputs['Color']
    def mix(a, b, f):
        n = node('ShaderNodeMix', data_type='RGBA')
        if isinstance(f, (int, float)): n.inputs[0].default_value = f
        else: L.new(f, n.inputs[0])
        for sock, v in ((n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, tuple): sock.default_value = (*v, 1.0) if len(v) == 3 else v
            else: L.new(v, sock)
        return n.outputs[2]
    def math_(op, a, b=None, clamp=False):
        n = node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]
    tc = node('ShaderNodeTexCoord'); obj = tc.outputs['Object']
    attr = node('ShaderNodeAttribute', attribute_name='masks'); sep = node('ShaderNodeSeparateColor'); L.new(attr.outputs['Color'], sep.inputs[0])
    beard, flush, fore = sep.outputs[0], sep.outputs[1], sep.outputs[2]; brow = attr.outputs['Alpha']
    face, lips, lids, ears = img('mpfb_face.jpg'), img('mpfb_lips.jpg'), img('mpfb_eyelids.jpg'), img('mpfb_ears.jpg')
    nails = math_('MAXIMUM', img('mpfb_fingernails.jpg'), img('mpfb_toenails.jpg'))
    def noise(scale, detail=4, rough=0.55, vec=None):
        n = node('ShaderNodeTexNoise', i_Scale=scale, i_Detail=detail, i_Roughness=rough); L.new(vec or obj, n.inputs['Vector']); return n.outputs['Fac']
    def vor(scale, feature='F1', vec=None):
        n = node('ShaderNodeTexVoronoi', feature=feature, i_Scale=scale); L.new(vec or obj, n.inputs['Vector']); return n
    # albedo (linear): a light, warm skin; blotchy at two scales; the flush; lips, lids, nails; a few moles; the
    # beard's shadow and its stubble (some of it grey); the brows as strokes
    col = mix((0.47, 0.27, 0.18), (0.54, 0.33, 0.235), noise(28, 6))
    col = mix(col, (0.55, 0.27, 0.19), math_('MULTIPLY', noise(5, 3), 0.55))
    col = mix(col, (0.62, 0.25, 0.19), math_('ADD', math_('MULTIPLY', flush, 0.45), math_('ADD', math_('MULTIPLY', ears, 0.3), math_('MULTIPLY', face, 0.05))), )
    col = mix(col, (0.45, 0.20, 0.18), math_('MULTIPLY', lips, 0.85))
    col = mix(col, (0.50, 0.30, 0.27), math_('MULTIPLY', lids, 0.5))
    col = mix(col, (0.72, 0.52, 0.47), math_('MULTIPLY', nails, 0.8))
    mv = vor(160)
    sepc = node('ShaderNodeSeparateColor'); L.new(mv.outputs['Color'], sepc.inputs[0])
    mole = math_('MULTIPLY', math_('LESS_THAN', mv.outputs['Distance'], 0.07), math_('GREATER_THAN', sepc.outputs[0], 0.965))
    col = mix(col, (0.24, 0.13, 0.09), math_('MULTIPLY', mole, 0.7))
    col = mix(col, (0.30, 0.25, 0.24), math_('MULTIPLY', beard, 0.38))
    sv = vor(1300); sep2 = node('ShaderNodeSeparateColor'); L.new(sv.outputs['Color'], sep2.inputs[0])
    dot = math_('MULTIPLY', math_('LESS_THAN', sv.outputs['Distance'], 0.32), beard)
    grey = math_('GREATER_THAN', sep2.outputs[1], 0.8)
    col = mix(col, (0.055, 0.045, 0.04), math_('MULTIPLY', math_('MULTIPLY', dot, math_('SUBTRACT', 1, grey)), 0.75))
    col = mix(col, (0.36, 0.34, 0.32), math_('MULTIPLY', math_('MULTIPLY', dot, grey), 0.65))
    # brows: hair strokes (noise stretched along the brow), darker where it is thick
    mp = node('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (60, 900, 2400); L.new(obj, mp.inputs['Vector'])
    strokes = noise(1.0, 2, 0.5, mp.outputs['Vector'])
    bf = math_('MULTIPLY', brow, math_('ADD', 0.35, math_('MULTIPLY', math_('GREATER_THAN', strokes, 0.45), 0.6)))
    col = mix(col, (0.045, 0.035, 0.03), math_('MINIMUM', bf, 0.92))
    hattr = node('ShaderNodeAttribute', attribute_name='hairmask'); hs = node('ShaderNodeSeparateColor'); L.new(hattr.outputs['Color'], hs.inputs[0])
    col = mix(col, (0.05, 0.036, 0.028), math_('MULTIPLY', hs.outputs[0], 0.88))
    # roughness: oilier on the forehead and nose, smoother lips, a bit dull under the stubble
    rough = math_('ADD', 0.5, math_('MULTIPLY', math_('SUBTRACT', noise(40, 3), 0.5), 0.08))
    rough = math_('SUBTRACT', rough, math_('MULTIPLY', math_('ADD', fore, math_('MULTIPLY', flush, 0.5)), 0.08))
    rough = math_('SUBTRACT', rough, math_('MULTIPLY', lips, 0.12))
    rough = math_('ADD', rough, math_('MULTIPLY', beard, 0.08), clamp=True)
    # bump: pores everywhere (finer on the face), fine wrinkling, the forehead's lines
    pores = vor(2200, 'SMOOTH_F1').outputs['Distance']
    fine = noise(600, 2)
    lines = math_('MULTIPLY', math_('SINE', math_('MULTIPLY', node_sep_z(N, L, obj), 2 * math.pi / 0.0085)), fore)
    h = math_('ADD', math_('MULTIPLY', pores, 0.6), math_('ADD', math_('MULTIPLY', fine, 0.3), math_('MULTIPLY', lines, 0.35)))
    bump = node('ShaderNodeBump', i_Strength=0.35, i_Distance=0.0004); L.new(h, bump.inputs['Height'])
    bsdf = node('ShaderNodeBsdfPrincipled'); L.new(col, bsdf.inputs['Base Color']); L.new(rough, bsdf.inputs['Roughness']); L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Subsurface Weight'].default_value = 0.25; bsdf.inputs['Subsurface Radius'].default_value = (0.012, 0.005, 0.003); bsdf.inputs['Subsurface Scale'].default_value = 0.5
    out = node('ShaderNodeOutputMaterial'); L.new(bsdf.outputs[0], out.inputs[0])
    return bsdf, col, rough

def node_sep_z(N, L, vec):
    s = N.new('ShaderNodeSeparateXYZ'); L.new(vec, s.inputs[0]); return s.outputs['Z']

def bake_skin(body, size, outdir):
    """albedo, normal, and roughness + occlusion, baked from the material on the rest pose"""
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
    m = body.data.materials[0]; nt = m.node_tree; bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'); out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    for o in bpy.context.scene.objects: o.select_set(False)
    body.select_set(True); bpy.context.view_layer.objects.active = body
    arm = body.modifiers.get('rig'); arm.show_render = False
    res = {}
    def target(name, colorspace):
        im = bpy.data.images.new(name, size, size, float_buffer=False); im.colorspace_settings.name = colorspace
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = im; nt.nodes.active = n; return im, n
    def save(im, path, mode='RGB'):
        im.filepath_raw = path; im.file_format = 'PNG'; im.save(); res[os.path.basename(path)] = path
    # colour and roughness: through an emission shader (exact values, no lighting)
    em = nt.nodes.new('ShaderNodeEmission'); keep = out.inputs[0].links[0].from_socket
    for name, sock, cs in (('albedo', bsdf.inputs['Base Color'], 'sRGB'), ('rough', bsdf.inputs['Roughness'], 'Non-Color')):
        src = sock.links[0].from_socket; nt.links.new(src, em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs[0])
        im, n = target('skin_' + name, cs); sc.cycles.bake_type = 'EMIT'
        bpy.ops.object.bake(type='EMIT', margin=16, use_clear=True); save(im, os.path.join(outdir, f'skin_{name}.png')); nt.nodes.remove(n)
    nt.links.new(keep, out.inputs[0]); nt.nodes.remove(em)
    im, n = target('skin_normal', 'Non-Color'); bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=16, use_clear=True); save(im, os.path.join(outdir, 'skin_normal.png')); nt.nodes.remove(n)
    sc.cycles.samples = 64
    im, n = target('skin_ao', 'Non-Color'); bpy.ops.object.bake(type='AO', margin=16, use_clear=True); save(im, os.path.join(outdir, 'skin_ao.png')); nt.nodes.remove(n)
    arm.show_render = True
    print('baked', sorted(res))
    return res

def eye_material(eyes):
    m = bpy.data.materials.new('eye'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(EYES, 'materials', 'brown_eye.png'))
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.05; b.inputs['Coat Weight'].default_value = 1.0; b.inputs['Coat Roughness'].default_value = 0.02
    eyes.data.materials.append(m)


# ---------------------------------------------------------------- export
def skin_export_material(body, baked):
    """the body's material for the game: the baked maps (occlusion folded into the colour, cavities darker)"""
    from PIL import Image
    alb = np.asarray(Image.open(baked['skin_albedo.png']).convert('RGB')).astype(np.float32)
    ao = np.asarray(Image.open(baked['skin_ao.png']).convert('L')).astype(np.float32)[..., None] / 255
    out = os.path.join(TEXOUT, 'skin')
    Image.fromarray(np.clip(alb * (0.5 + 0.5 * ao), 0, 255).astype(np.uint8)).save(out + '_albedo.jpg', quality=93)
    Image.open(baked['skin_normal.png']).convert('RGB').save(out + '_normal.jpg', quality=95)
    r = Image.open(baked['skin_rough.png']).convert('L'); Image.merge('RGB', (Image.fromarray((ao[..., 0] * 255).astype(np.uint8)), r, Image.new('L', r.size, 0))).save(out + '_orm.jpg', quality=93)
    m = bpy.data.materials.new('skin_game'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    def tex(path, cs):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path); t.image.colorspace_settings.name = cs; return t
    nt.links.new(tex(out + '_albedo.jpg', 'sRGB').outputs['Color'], b.inputs['Base Color'])
    nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tex(out + '_normal.jpg', 'Non-Color').outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    sp = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(tex(out + '_orm.jpg', 'Non-Color').outputs['Color'], sp.inputs[0]); nt.links.new(sp.outputs[1], b.inputs['Roughness'])
    b.inputs['Metallic'].default_value = 0
    return m

def export(path, rig, objs):
    for o in bpy.context.scene.objects: o.select_set(False)
    rig.select_set(True)
    for o in objs:
        if o: o.select_set(True); o.hide_render = False; o.hide_set(False)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_skins=True, export_morph=True,
                              export_morph_normal=False, export_apply=True, export_texcoords=True, export_normals=True, export_tangents=False,
                              export_vertex_color='ACTIVE', export_animations=bool(opt('--anim')), export_image_format='AUTO', export_jpeg_quality=92)
    print('exported', path, round(os.path.getsize(path) / 1e6, 1), 'MB')

# ---------------------------------------------------------------- preview
def preview(path, objs):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = int(opt('--psamples', 32)); sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 600, 1000
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.42, 0.44, 0.48, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
    m = bpy.data.materials.new('clay'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.62, 0.48, 0.42, 1); b.inputs['Roughness'].default_value = 0.55
    for o in objs:
        if o and o.type == 'MESH' and not o.data.materials: o.data.materials.append(m)
    for loc, en in (((3, -4, 4), 900), ((-4, -2, 2), 300)):
        L = bpy.data.lights.new('l', 'AREA'); L.energy = en; L.size = 2; lo = bpy.data.objects.new('l', L); lo.location = loc; sc.collection.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, 1)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.0
    shots = []
    zh = max((o.matrix_world @ v.co).z for o in objs if o and o.type == 'MESH' for v in o.data.vertices)
    for ang in (0, 90, 35):
        a = math.radians(ang); cam.data.type = 'ORTHO'; cam.location = (math.sin(a) * 6, -math.cos(a) * 6, zh / 2); cam.rotation_euler = (math.radians(90), 0, a)
        f = path.replace('.png', f'_{ang}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True); shots.append(f)
    # the face, close: front, three-quarter, profile, and from below (as the robot sees it)
    sc.render.resolution_x, sc.render.resolution_y = 700, 800
    cam.data.type = 'PERSP'; cam.data.lens = 85
    for name, ang, dz, pitch in (('face0', 0, 0, 90), ('face35', 35, 0, 90), ('face90', 90, 0, 90), ('facelow', 20, -0.55, 62)):
        a = math.radians(ang); hc = Vector((0, 0, zh - 0.12))
        cam.location = hc + Vector((math.sin(a) * 1.3, -math.cos(a) * 1.3, dz)); d = hc - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        f = path.replace('.png', f'_{name}.png'); sc.render.filepath = f; bpy.ops.render.render(write_still=True); shots.append(f)
    print('preview', shots)

if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    V, X, VT, F, FT, G, expr = build_shape()
    body, groups, remap = make_body(X, VT, F, FT, G, expr)
    rig, W = make_rig(body, X, groups, remap)
    eyes = make_eyes(X, rig)
    LM = landmarks(X, groups)
    for k in ('head', 'head-2', 'neck', 'jaw', 'mouth', 'l-eye', 'r-eye'): print('  landmark', k, tuple(round(c, 3) for c in LM[k]))
    # feet on the ground
    zmin = min((body.matrix_world @ v.co).z for v in body.data.vertices); rig.location.z -= zmin
    bpy.context.view_layer.update()
    zs = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    print(f'body: {len(body.data.vertices)} verts, height {max(zs) - min(zs):.3f} m, bones {len(rig.data.bones)}, shape keys {len(body.data.shape_keys.key_blocks) - 1}')
    masks = face_masks(body, LM)
    sm_ = bpy.data.materials.new('skin'); sm_.use_nodes = True; body.data.materials.append(sm_)
    skin_nodes(sm_, os.path.join(MPFB, 'textures'))
    if eyes: eye_material(eyes); split_eyes(eyes, rig, LM)
    baked = bake_skin(body, int(opt('--size', 4096)), opt('--bake')) if opt('--bake') else None
    lashes = helper_object('stranger_lashes', X, VT, F, FT, G, {g for g in groups if g and 'eyelashes' in g}, expr, W, rig, (0.035, 0.028, 0.024), 0.6)
    lash_alpha(lashes, body)
    teeth = helper_object('stranger_teeth', X, VT, F, FT, G, {'helper-upper-teeth', 'helper-lower-teeth'}, expr, W, rig, (0.78, 0.74, 0.66), 0.25)
    tongue = helper_object('stranger_tongue', X, VT, F, FT, G, {'helper-tongue'}, expr, W, rig, (0.55, 0.25, 0.24), 0.4)
    strands = os.path.join(TEXOUT, 'hair')
    if not os.path.exists(strands + '_albedo.png'): os.system(f'"{sys.executable}" -I "{os.path.join(os.path.dirname(__file__), "hair_strands.py")}" "{strands}" 1024 1024')
    hair = make_hair_cards(body, LM, strands); hair.parent = rig; hm_ = hair.modifiers.new('rig', 'ARMATURE'); hm_.object = rig
    clothes, covered = make_clothes(body, rig, LM)
    boots = make_boots(body, rig, LM, opt('--boots', os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'house', 'rubber_boots.glb')))
    cover = covered['jeans'] | covered['sweater'] | covered['gloves']
    body_out = dressed_body(body, cover)
    OUTDOOR = [body_out, eyes, lashes, teeth, tongue, hair, clothes['jeans'], clothes['sweater'], clothes['gloves'], *boots]
    BED = [body, eyes, lashes, teeth, tongue, hair, clothes['tshirt']]
    def show(objs):
        for o in bpy.context.scene.objects:
            if o.type == 'MESH': o.hide_render = o not in objs
    if opt('--preview'):
        show(OUTDOOR); preview(opt('--preview').replace('.png', '_out.png'), OUTDOOR)
        show(BED); preview(opt('--preview').replace('.png', '_bed.png'), BED)
    if opt('--export'):
        if baked:
            gm = skin_export_material(body, baked)
            for o in (body, body_out): o.data.materials.clear(); o.data.materials.append(gm)
        for o in (body, body_out, hair, *clothes.values(), *boots, teeth, tongue, eyes):
            for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)
        for o in (body, body_out, hair, *clothes.values()):
            for uvn in ('Fur', 'CombXY', 'CombZ'):
                if uvn in o.data.uv_layers: o.data.uv_layers.remove(o.data.uv_layers[uvn])
        export(opt('--export'), rig, list({*OUTDOOR, *BED}))
    if opt('--save'): bpy.ops.wm.save_as_mainfile(filepath=opt('--save'))
