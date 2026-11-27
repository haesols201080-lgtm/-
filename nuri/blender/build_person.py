"""The stranger: a grown man of about 45, built from MakeHuman's CC0 data (the base mesh, its shape targets, the
game-engine rig with its weights, the eyes) read here directly - none of MakeHuman's or MPFB's code is run.

Stages: the body (macro shape: gender, age, muscle, weight, height, proportions, a mix of ethnicities; a few face
and body details that make him someone in particular), the rig built on the shaped body (its joints at the means of
MakeHuman's joint helpers, so they follow the shape) and skinned with MakeHuman's weights, eye-closure and a few
expression shape keys, the eyes fitted to the sockets; then MakeHuman's own assets fitted to him as proxies (the
skin photo with his brows painted into it, short hair, teeth and tongue; a field jacket and jeans, with Poly Haven's scanned rubber
boots, for the forest; a T-shirt and jeans for bed), the body under each outfit cut where it can't be seen.

usage: python -I blender/build_person.py <data dir> [--tex dir] [--bake dir --size N] [--preview png] [--export glb]
                                         [--save blend] [--boots rubber_boots.glb]
  the data dir (blender/fetch_person_data.sh fetches it) holds mpfb/ (MPFB2's src/mpfb/data: 3dobjs, targets, rigs),
  eyes/ (MakeHuman's makehuman/data/eyes) and assets/ (MakeHuman's system assets: skins, clothes, hair, eyebrows).
  Then blender/animate_person.py gives him his clips."""
import bpy, gzip, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix

ARGS = sys.argv[1:]
DATA = ARGS[0]
def opt(name, default=None):
    return ARGS[ARGS.index(name) + 1] if name in ARGS and ARGS.index(name) + 1 < len(ARGS) else default
MPFB = os.path.join(DATA, 'mpfb')        # (MPFB2's data folder: 3dobjs, targets, rigs, textures)
ASSETS = os.path.join(DATA, 'assets')    # (MakeHuman's system assets, CC0: skins/, clothes/, hair/, eyebrows/, eyelashes/)
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
def read_mhclo(path, with_delete=False):
    scales, refs, dele, mode = {}, [], set(), None
    for line in open(path, encoding='utf-8', errors='replace'):
        p = line.split()
        if not p or line.startswith('#'): continue
        if p[0] in ('x_scale', 'y_scale', 'z_scale'): scales[p[0][0]] = (int(p[1]), int(p[2]), float(p[3])); continue
        if p[0] == 'verts': mode = 'verts'; continue
        if p[0] == 'delete_verts': mode = 'delete'; continue
        if not p[0].lstrip('-').replace('.', '').isdigit(): mode = None; continue
        if mode == 'verts':
            if len(p) == 1: refs.append(([int(p[0])], [1.0], [0, 0, 0]))
            elif len(p) >= 9: refs.append(([int(p[0]), int(p[1]), int(p[2])], [float(p[3]), float(p[4]), float(p[5])], [float(p[6]), float(p[7]), float(p[8])]))
        elif mode == 'delete':
            i = 0
            while i < len(p):
                if i + 2 < len(p) and p[i + 1] == '-': dele.update(range(int(p[i]), int(p[i + 2]) + 1)); i += 3
                else: dele.add(int(p[i])); i += 1
    return (scales, refs, dele) if with_delete else (scales, refs)

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

# ---------------------------------------------------------------- where his hair grows (the skin's scalp, darkened)
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

# ---------------------------------------------------------------- his bones by region
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

# ---------------------------------------------------------------- the boots
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

# ---------------------------------------------------------------- MakeHuman's assets fitted to him (clothes, hair, brows, lashes)
def skin_standoff(P, X, faces, s, exact=False):
    """how far to move each point (MakeHuman units) so it sits at least s off the skin (exactly s: laid on it), along
    the skin's normal at the nearest skin vertex (an asset whose fitting leaves it under the shaped skin shows only
    in pieces; one that stands well off it shows as a ledge from the side)"""
    from mathutils.kdtree import KDTree
    used = sorted({i for f in faces for i in f}); N = np.zeros_like(X)
    for f in faces:
        a, b, c = X[f[0]], X[f[1]], X[f[2]]; n = np.cross(b - a, c - a)
        for i in f: N[i] += n
    N /= np.maximum(np.linalg.norm(N, axis=1)[:, None], 1e-12)
    kd = KDTree(len(used))
    for k, i in enumerate(used): kd.insert(X[i], i)
    kd.balance()
    D = np.zeros_like(P)
    for k, p in enumerate(P):
        _, i, _ = kd.find(p); d = float(np.dot(p - X[i], N[i]))
        if d < s or exact: D[k] = N[i] * (s - d)
    return D

def proxy(name, folder, X, expr, W, rig, rough=0.85, alpha=False, keys=False, standoff=0.0, skin=None, recolor=None, lay=False, anchor=False):
    """an asset fitted to the shaped body (each vertex hangs off three body vertices plus an offset scaled to the
    body's size), weighted from those vertices, given the expressions too if asked; with its own textures (passed
    through recolor(rgba array) -> rgba array if given); kept standoff off the skin (skin: the body's faces)"""
    mh = [f for f in os.listdir(folder) if f.endswith('.mhclo')][0]
    scales, refs, dele = read_mhclo(os.path.join(folder, mh), with_delete=True)
    objf = [l.split()[1] for l in open(os.path.join(folder, mh), errors='replace') if l.startswith('obj_file')][0]
    V, VT, F, FT, G = read_obj(os.path.join(folder, objf))
    def fit(XX):
        s = [abs(XX[scales[a][0]][k] - XX[scales[a][1]][k]) / scales[a][2] if a in scales else 1.0 for k, a in enumerate('xyz')]
        return np.array([sum(w * XX[v] for v, w in zip(vs, ws)) + (0 if anchor else np.array(d) * s) for vs, ws, d in refs])
    P = fit(X)
    D = skin_standoff(P, X, skin, standoff, exact=lay) if standoff and skin is not None else np.zeros_like(P)
    if standoff: print(f'  {name}: {int((np.linalg.norm(D, axis=1) > 0).sum())} of {len(P)} verts lifted off the skin, up to {np.linalg.norm(D, axis=1).max() * 100:.1f} mm')
    P = P + D
    me = bpy.data.meshes.new(name); me.from_pydata(to_bl(P).tolist(), [], F)
    uv = me.uv_layers.new(name='UVMap'); li = 0
    for f, ft in zip(F, FT):
        for k in range(len(f)): uv.data[li].uv = VT[ft[k]] if ft[k] >= 0 else (0, 0); li += 1
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if keys and expr:
        ob.shape_key_add(name='Basis', from_mix=False)
        for key, d in expr.items():
            sk = ob.shape_key_add(name=key, from_mix=False); sk.data.foreach_set('co', to_bl(fit(X + d) + D).ravel())
    # weights from the body vertices each proxy vertex hangs off
    inv = {}
    for bone, pairs in W.items():
        for i, w in pairs: inv.setdefault(int(i), []).append((bone, float(w)))
    groups = {}
    for pi, (vs, ws, _) in enumerate(refs):
        acc = {}
        for v, rw in zip(vs, ws):
            for bone, w in inv.get(v, []): acc[bone] = acc.get(bone, 0) + w * rw
        tot = sum(acc.values())
        for bone, w in acc.items():
            if w > 1e-4: groups.setdefault(bone, []).append((pi, w / tot))
    for bone, pairs in groups.items():
        vg = ob.vertex_groups.new(name=bone)
        for pi, w in pairs: vg.add([pi], w, 'REPLACE')
    ob.parent = rig; m = ob.modifiers.new('rig', 'ARMATURE'); m.object = rig
    # material from its .mhmat: the diffuse (and normal map) beside it
    mat = [l.split() for l in open(os.path.join(folder, [f for f in os.listdir(folder) if f.endswith('.mhmat')][0]), errors='replace')]
    tx = {l[0]: l[1] for l in mat if len(l) > 1 and l[0] in ('diffuseTexture', 'normalmapTexture')}
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    if 'diffuseTexture' in tx and os.path.exists(os.path.join(folder, tx['diffuseTexture'])):
        src = os.path.join(folder, tx['diffuseTexture'])
        if recolor:
            from PIL import Image
            os.makedirs(TEXOUT, exist_ok=True); out = os.path.join(TEXOUT, name + '_diffuse.png')
            Image.fromarray(recolor(np.asarray(Image.open(src).convert('RGBA')).astype(np.float64) / 255)).save(out); src = out
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(src)
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if alpha: nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
    if 'normalmapTexture' in tx and os.path.exists(os.path.join(folder, tx['normalmapTexture'])):
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(os.path.join(folder, tx['normalmapTexture'])); t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough
    if alpha: m.use_backface_culling = False
    me.materials.append(m)
    print(f'{name}: {len(P)} verts, hides {len(dele)} body verts')
    return ob, dele

def hide_under(body, remap, dele, name):
    """the body without the vertices a garment hides (none of it pokes through)"""
    import bmesh
    gone = {remap[i] for i in dele if i in remap}
    ob = body.copy(); ob.data = body.data.copy(); ob.name = ob.data.name = name; bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in gone], context='VERTS'); bm.to_mesh(ob.data); bm.free()
    return ob

def trim_below(ob, zcut, region=None):
    """drop a garment's faces below a height (the jeans' legs inside the boots)"""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    gone = [f for f in bm.faces if all(v.co.z < zcut for v in f.verts) and (region is None or region(f.calc_center_median()))]
    bmesh.ops.delete(bm, geom=gone, context='FACES'); bm.to_mesh(ob.data); bm.free()

def clean_tshirt_logo(path_in, path_out):
    """MakeHuman's white tee carries its logo on the chest: painted out with the plain cloth around it"""
    from PIL import Image, ImageFilter
    im = Image.open(path_in).convert('RGB'); a = np.asarray(im).astype(np.float32)
    lum = a.mean(-1); H, Wd = lum.shape
    # the shirt pieces are the near-white part of the upper half; the logo the darker/coloured marks on them
    region = np.zeros_like(lum, bool); region[: H // 2, :] = True
    cloth = np.median(a[region & (lum > 200)], axis=0) if (region & (lum > 200)).any() else np.array([235, 235, 235])
    sat = a.max(-1) - a.min(-1)
    marks = region & (lum > 60) & ((lum < 215) | (sat > 25))
    m = Image.fromarray((marks * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(28))).astype(np.float32)
    mk = np.asarray(m).astype(np.float32)[..., None] / 255
    fill = blur * 0.3 + cloth * 0.7
    out = a * (1 - mk) + fill * mk
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(path_out)

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

def bake_skin(body, size, outdir, only=('albedo', 'rough', 'normal', 'ao')):
    """albedo, normal, and roughness + occlusion, baked from the material on the rest pose (kept in outdir: a
    rebuild reuses what is there; --rebake bakes again)"""
    have = {f'skin_{k}.png': os.path.join(outdir, f'skin_{k}.png') for k in only}
    if '--rebake' not in ARGS and all(os.path.exists(v) for v in have.values()): print('baked (kept)', sorted(have)); return have
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
        if name not in only: continue
        src = sock.links[0].from_socket; nt.links.new(src, em.inputs['Color']); nt.links.new(em.outputs[0], out.inputs[0])
        im, n = target('skin_' + name, cs); sc.cycles.bake_type = 'EMIT'
        bpy.ops.object.bake(type='EMIT', margin=16, use_clear=True); save(im, os.path.join(outdir, f'skin_{name}.png')); nt.nodes.remove(n)
    nt.links.new(keep, out.inputs[0]); nt.nodes.remove(em)
    if 'normal' in only:
        im, n = target('skin_normal', 'Non-Color'); bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=16, use_clear=True); save(im, os.path.join(outdir, 'skin_normal.png')); nt.nodes.remove(n)
    if 'ao' in only:
        sc.cycles.samples = 64
        im, n = target('skin_ao', 'Non-Color'); bpy.ops.object.bake(type='AO', margin=16, use_clear=True); save(im, os.path.join(outdir, 'skin_ao.png')); nt.nodes.remove(n)
    arm.show_render = True
    print('baked', sorted(res))
    return res

def paint_brows(skin_png, out_png, folder, X, VT, F, FT, G, color=(0.27, 0.19, 0.135), strength=0.8, ss=4):
    """the brows drawn into the skin itself (on the skin whatever the light or the angle: the brow asset's cards
    stood off it, a ledge from the side and a second outline from the front): each triangle of the brow asset, as
    fitted to him, laid into the skin texture by the skin UVs of the body vertices it hangs off, its hairs
    composited there in his brow colour"""
    from PIL import Image
    mh = [f for f in os.listdir(folder) if f.endswith('.mhclo')][0]
    _, refs, _ = read_mhclo(os.path.join(folder, mh), with_delete=True)
    objf = [l.split()[1] for l in open(os.path.join(folder, mh), errors='replace') if l.startswith('obj_file')][0]
    _, BVT, BF, BFT, _ = read_obj(os.path.join(folder, objf))
    tex = np.asarray(Image.open(os.path.join(folder, objf.replace('.obj', '.png'))).convert('RGBA')).astype(np.float64) / 255
    uvb = {}
    for f, ft, g in zip(F, FT, G):
        if g != 'body': continue
        for v, t in zip(f, ft):
            if t >= 0: uvb.setdefault(v, VT[t])
    suv = []
    for vs, ws, _ in refs:
        acc, wt = np.zeros(2), 0.0
        for v, w in zip(vs, ws):
            if v in uvb: acc += w * uvb[v]; wt += w
        suv.append(acc / wt if wt else acc)
    suv = np.array(suv)
    skin = np.asarray(Image.open(skin_png).convert('RGB')).astype(np.float64) / 255; H, Wd = skin.shape[:2]; th, tw = tex.shape[:2]
    col = np.array(color); acc = np.zeros((H, Wd))
    for f, ft in zip(BF, BFT):
        for a, b, c in ((0, 1, 2), (0, 2, 3)) if len(f) == 4 else ((0, 1, 2),):
            P = np.array([[suv[f[k]][0] * Wd, (1 - suv[f[k]][1]) * H] for k in (a, b, c)]); T = np.array([BVT[ft[k]] for k in (a, b, c)])
            x0, y0 = np.floor(P.min(0)).astype(int); x1, y1 = np.ceil(P.max(0)).astype(int)
            if x1 <= x0 or y1 <= y0: continue
            yy, xx = np.mgrid[y0 * ss:(y1 + 1) * ss, x0 * ss:(x1 + 1) * ss] / ss + 0.5 / ss
            m = np.array([[P[1, 0] - P[0, 0], P[2, 0] - P[0, 0]], [P[1, 1] - P[0, 1], P[2, 1] - P[0, 1]]])
            if abs(np.linalg.det(m)) < 1e-9: continue
            l12 = np.linalg.solve(m, np.stack([(xx - P[0, 0]).ravel(), (yy - P[0, 1]).ravel()]))
            l0 = 1 - l12[0] - l12[1]; ins = (l0 >= -0.01) & (l12[0] >= -0.01) & (l12[1] >= -0.01)
            if not ins.any(): continue
            uv = l0[ins, None] * T[0] + l12[0][ins, None] * T[1] + l12[1][ins, None] * T[2]
            # (bilinear in the brow's texture; each skin pixel the mean of its ss x ss samples)
            fx = np.clip(uv[:, 0] * tw - 0.5, 0, tw - 1.001); fy = np.clip((1 - uv[:, 1]) * th - 0.5, 0, th - 1.001)
            ix, iy = fx.astype(int), fy.astype(int); u, v = (fx - ix)[:, None], (fy - iy)[:, None]
            s4 = (tex[iy, ix] * (1 - u) + tex[iy, ix + 1] * u) * (1 - v) + (tex[iy + 1, ix] * (1 - u) + tex[iy + 1, ix + 1] * u) * v
            al = np.clip(s4[:, 3] * strength, 0, 1)
            # (each pixel's cover by this triangle; where triangles meet, the greater, not the sum)
            px = np.clip(xx.ravel()[ins].astype(int), x0, x1) - x0; py = np.clip(yy.ravel()[ins].astype(int), y0, y1) - y0
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            cov = np.bincount(py * bw + px, weights=al, minlength=bw * bh).reshape(bh, bw) / (ss * ss)
            ya, yb, xa, xb = max(y0, 0), min(y1 + 1, H), max(x0, 0), min(x1 + 1, Wd)
            if yb > ya and xb > xa: acc[ya:yb, xa:xb] = np.maximum(acc[ya:yb, xa:xb], cov[ya - y0:yb - y0, xa - x0:xb - x0])
    al = np.clip(acc, 0, 1)[..., None]
    skin = skin * (1 - al) + col * al
    Image.fromarray(np.clip(skin * 255 + 0.5, 0, 255).astype(np.uint8)).save(out_png)
    print('  brows painted into the skin from', os.path.basename(folder))
    return out_png

def natural_eye(src, out):
    """MakeHuman's only iris is a saturated red-brown: each iris (found as the red in each eyeball) is recoloured from
    its own fibres into a dark hazel-brown (amber round the pupil, a dark limbal ring at the edge); the whites are
    toned down, warmed, and darkened away from the iris as the lids and the eye's curve shade them"""
    from PIL import Image
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float64) / 255; H, Wd = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:Wd] / np.array([H, Wd])[:, None, None]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; lum = a @ [0.3, 0.59, 0.11]
    red = (r - np.maximum(g, b) > 0.12) & (lum < 0.75)
    out_a = a.copy()
    for side in (xx > yy, xx <= yy):                                   # (the two eyeballs lie either side of the diagonal)
        m = red & side
        if m.sum() < 50: continue
        cy, cx = yy[m].mean(), xx[m].mean(); dist = np.hypot(yy - cy, xx - cx); R = np.percentile(dist[m], 99.5)
        t = dist / R; ref = lum[m].mean()
        inner, outer, ring = np.array([0.40, 0.26, 0.11]), np.array([0.19, 0.12, 0.06]), np.array([0.07, 0.045, 0.03])
        k = np.clip((t - 0.3) / 0.5, 0, 1)[..., None]; col = inner * (1 - k) + outer * k
        col = col * (1 - np.clip((t - 0.82) / 0.16, 0, 1)[..., None]) + ring * np.clip((t - 0.82) / 0.16, 0, 1)[..., None]
        col = col * np.clip(lum / ref, 0.35, 1.6)[..., None] ** 0.9
        reddish = (r - np.maximum(g, b) > 0.04) & (t < 1.1) & (lum < 0.55)   # (the red's soft fringe too)
        pupil = (lum < 0.09) & (t < 0.42) & (r - np.maximum(g, b) < 0.025)
        iris = ((t < 1.0) | reddish) & ~pupil                            # (the pupil stays black)
        edge = np.where(reddish[..., None], 1.0, np.clip((1.06 - t) / 0.12, 0, 1)[..., None])
        w = np.where(iris[..., None], 1.0, 0.0) * edge
        out_a = out_a * (1 - w) + col * w
        # the white: a little darker and warmer, darker still away from the iris
        white = side & (t >= 1.0) & (lum > 0.35)
        shade = 0.84 * (1 - 0.5 * np.clip((t - 1.6) / 1.6, 0, 1))
        out_a = np.where(white[..., None], out_a * shade[..., None] * np.array([1.0, 0.965, 0.93]), out_a)
    Image.fromarray(np.clip(out_a * 255 + 0.5, 0, 255).astype(np.uint8)).save(out)
    return out

def eye_material(eyes):
    m = bpy.data.materials.new('eye'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    os.makedirs(TEXOUT, exist_ok=True)
    tex = natural_eye(os.path.join(EYES, 'materials', 'brown_eye.png'), os.path.join(TEXOUT, 'eye_natural.png'))
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(tex)
    # (the eyeball itself is moist but not a mirror: the clear cornea over it gives the catchlights)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color']); b.inputs['Roughness'].default_value = 0.3
    eyes.data.materials.append(m)

# ---------------------------------------------------------------- export

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

def skin_photo_material(body, baked, diffuse=None):
    """the photographed skin (MakeHuman's middle-aged lightskinned male, CC0; his brows painted in) with the baked
    pores and fine lines on it"""
    m = bpy.data.materials.new('skin_game'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(diffuse or os.path.join(ASSETS, 'skins', 'middleage_lightskinned_male_diffuse.png'))
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if baked:
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(baked['skin_normal.png']); tn.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
        tr = nt.nodes.new('ShaderNodeTexImage'); tr.image = bpy.data.images.load(baked['skin_rough.png']); tr.image.colorspace_settings.name = 'Non-Color'
        nt.links.new(tr.outputs['Color'], b.inputs['Roughness'])
    else: b.inputs['Roughness'].default_value = 0.5
    b.inputs['Subsurface Weight'].default_value = 0.15; b.inputs['Subsurface Radius'].default_value = (0.012, 0.005, 0.003); b.inputs['Subsurface Scale'].default_value = 0.4
    return m

if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    V, X, VT, F, FT, G, expr = build_shape()
    body, groups, remap = make_body(X, VT, F, FT, G, expr)
    rig, W = make_rig(body, X, groups, remap)
    eyes = make_eyes(X, rig)
    LM = landmarks(X, groups)
    zmin = min((body.matrix_world @ v.co).z for v in body.data.vertices); rig.location.z -= zmin
    bpy.context.view_layer.update()
    zs = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    print(f'body: {len(body.data.vertices)} verts, height {max(zs) - min(zs):.3f} m, bones {len(rig.data.bones)}, shape keys {len(body.data.shape_keys.key_blocks) - 1}')
    # the skin: the photograph; pores and the forehead's lines baked from the procedural material as a normal map
    face_masks(body, LM)
    proc = bpy.data.materials.new('skin'); proc.use_nodes = True; body.data.materials.append(proc)
    skin_nodes(proc, os.path.join(MPFB, 'textures'))
    baked = bake_skin(body, int(opt('--size', 2048)), opt('--bake'), only=('rough', 'normal')) if opt('--bake') else None
    BROWS = opt('--brows', 'eyebrow012')
    os.makedirs(TEXOUT, exist_ok=True)
    painted = paint_brows(os.path.join(ASSETS, 'skins', 'middleage_lightskinned_male_diffuse.png'), os.path.join(TEXOUT, 'skin_brows.png'),
                          os.path.join(ASSETS, 'eyebrows', BROWS), X, VT, F, FT, G)
    skin_m = skin_photo_material(body, baked, painted); body.data.materials.clear(); body.data.materials.append(skin_m)
    if eyes: eye_material(eyes); split_eyes(eyes, rig, LM)
    teeth = helper_object('stranger_teeth', X, VT, F, FT, G, {'helper-upper-teeth', 'helper-lower-teeth'}, expr, W, rig, (0.78, 0.74, 0.66), 0.25)
    tongue = helper_object('stranger_tongue', X, VT, F, FT, G, {'helper-tongue'}, expr, W, rig, (0.55, 0.25, 0.24), 0.4)
    A = ASSETS
    hair, _ = proxy('stranger_hair', os.path.join(A, 'hair', 'short02'), X, expr, W, rig, rough=0.5, alpha=True)
    # (the brow is painted into the skin, above: a card over it, however it is laid, shows as a ledge from the side
    # and a second outline from the front)
    brows = None
    lashes = None                                     # (no lash cards: fitted to his lids they stood off them)
    outfit, del_out = proxy('stranger_outfit', os.path.join(A, 'clothes', 'male_casualsuit05'), X, expr, W, rig, rough=0.85)
    tee_dir = os.path.join(A, 'clothes', 'male_casualsuit06'); clean = os.path.join(tee_dir, 'male_casualsuit06_clean.png')
    if not os.path.exists(clean): clean_tshirt_logo(os.path.join(tee_dir, 'male_casualsuit06_diffuse.png'), clean)
    sleep, del_bed = proxy('stranger_sleepwear', tee_dir, X, expr, W, rig, rough=0.85)
    for n in sleep.data.materials[0].node_tree.nodes:
        if n.type == 'TEX_IMAGE' and 'diffuse' in n.image.name: n.image = bpy.data.images.load(clean)
    boots = make_boots(body, rig, LM, opt('--boots', os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'house', 'rubber_boots.glb')))
    # the jeans' legs and the feet go inside the boots
    if boots:
        btop = min(max(v.co.z for v in b.data.vertices) for b in boots) - 0.03
        trim_below(outfit, btop, lambda c: abs(c.x) < 0.3)
    body_out = hide_under(body, remap, del_out, 'stranger_body_out')
    if boots:
        import bmesh
        bm = bmesh.new(); bm.from_mesh(body_out.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if all(v.co.z < btop for v in f.verts)], context='FACES'); bm.to_mesh(body_out.data); bm.free()
    body_bed = hide_under(body, remap, del_bed, 'stranger_body_bed')
    OUTDOOR = [o for o in (body_out, eyes, lashes, brows, teeth, tongue, hair, outfit, *boots) if o]
    BED = [o for o in (body_bed, eyes, lashes, brows, teeth, tongue, hair, sleep) if o]
    body.hide_render = True
    def show(objs):
        for o in bpy.context.scene.objects:
            if o.type == 'MESH': o.hide_render = o not in objs
    if opt('--preview'):
        show(OUTDOOR); preview(opt('--preview').replace('.png', '_out.png'), OUTDOOR)
        show(BED); preview(opt('--preview').replace('.png', '_bed.png'), BED)
    if opt('--export'):
        for o in [*OUTDOOR, *BED]:
            if o and o.type == 'MESH':
                for a in list(o.data.color_attributes): o.data.color_attributes.remove(a)
        bpy.data.objects.remove(body)
        export(opt('--export'), rig, list({*OUTDOOR, *BED}))
    if opt('--save'): bpy.ops.wm.save_as_mainfile(filepath=opt('--save'))
