"""The stranger's animations, posed on the rig frame by frame and keyed (blender/build_person.py makes the rig):
two-bone IK puts the feet and hands where they must be (feet planted on the ground, the hand round the robot,
the robot into the basket), fingers curl toward the palm, the head and eyes turn to what he looks at. Every
clip is timed to the game's own cutscenes and scenes. Positions below are in his own frame: metres, the ground
at z = 0, facing -y (Blender), his right hand on -x.

  capture  (13.5 s) the end of chapter 1: walks up the path behind the robot (3.78 m, root motion), stops, looks
           down at it, squats and reaches, closes his hand round it, stands up lifting it to his chest and looks at
           it, turns to the basket at his right side, crouches and sets it in, lets go, pushes the lid shut
  sleep    (4.2 s, loop) on his back in bed, forearms on the duvet, breathing
  stir     (3.0 s) turns his head, shifts, settles again
  wake     (2.2 s) lifts his head, his left hand goes out to the lamp on the nightstand and back
  look     (3.0 s, loop) head raised a little off the pillow, peering round the room
  settle   (2.4 s) the lamp off again, the head back down

usage: python -I blender/animate_person.py <character.blend> <out.glb> [--only capture,sleep]"""
import bpy, sys, math
from mathutils import Vector, Matrix, Quaternion

ARGS = sys.argv[1:]
BLEND, OUT = ARGS[0], ARGS[1]
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None
FPS = 30

bpy.ops.wm.open_mainfile(filepath=BLEND)
sc = bpy.context.scene; sc.render.fps = FPS
rig = bpy.data.objects['stranger_rig']; P = rig.pose.bones; B = rig.data.bones
G0 = B['Root'].head_local.z                     # the ground, in the armature's space
bpy.context.view_layer.objects.active = rig
for o in bpy.context.scene.objects: o.select_set(o == rig)
bpy.ops.object.mode_set(mode='POSE')
for pb in P: pb.rotation_mode = 'QUATERNION'

def upd(): bpy.context.view_layer.update()
def W(v): return Vector((v[0], v[1], v[2] + G0))            # his frame -> the armature's
def sm(a, b, t):
    if b == a: return 1.0 if t >= b else 0.0
    u = min(1.0, max(0.0, (t - a) / (b - a))); return u * u * (3 - 2 * u)
def lerp(a, b, u): return a + (b - a) * u
def vlerp(a, b, u): return Vector(a).lerp(Vector(b), u)

def reset():
    for pb in P: pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    upd()
def head(n): return P[n].head.copy()
def tail(n): return P[n].tail.copy()
def rotq(n, q, pivot=None):
    pb = P[n]; M = pb.matrix.copy(); c = pivot if pivot is not None else M.translation.copy()
    pb.matrix = Matrix.Translation(c) @ q.to_matrix().to_4x4() @ Matrix.Translation(-c) @ M; upd()
def rotw(n, axis, ang, pivot=None): rotq(n, Quaternion(Vector(axis).normalized(), ang), pivot)
def aim(n, d):
    cur = (tail(n) - head(n)).normalized(); q = cur.rotation_difference(Vector(d).normalized()); rotq(n, q)
def delta(n):
    """the bone's rotation now relative to its rest, in the armature's space"""
    return P[n].matrix.to_3x3() @ B[n].matrix_local.to_3x3().inverted()
def two_bone(up, lo, end, target, pole):
    a = head(up); b = head(lo); c = head(end); l1 = (b - a).length; l2 = (c - b).length
    t = Vector(target); d = max(0.05, min((t - a).length, l1 + l2 - 1e-3)); dv = (t - a).normalized()
    x = (l1 * l1 - l2 * l2 + d * d) / (2 * d); h = math.sqrt(max(0.0, l1 * l1 - x * x))
    pv = Vector(pole) - a; pv = (pv - dv * pv.dot(dv)); pv = pv.normalized() if pv.length > 1e-6 else Vector((0, -1, 0))
    e = a + dv * x + pv * h
    aim(up, e - a); aim(lo, (a + dv * d) - head(lo))

# ---- the hands: curling fingers toward the palm, turning the palm
FINGERS = ('thumb', 'index', 'middle', 'ring', 'pinky')
def palm(s):
    """the palm's normal (out of the palm) and the knuckle line, as the hand is now"""
    i, p, h = head(f'index_01_{s}'), head(f'pinky_01_{s}'), head(f'hand_{s}')
    fd = ((i + p) / 2 - h).normalized(); kl = (p - i).normalized()
    n = fd.cross(kl) if s == 'r' else kl.cross(fd)
    th = tail(f'thumb_02_{s}') - (i + p) / 2
    if n.dot(th) < 0: n = -n                                   # (the palm is the side the thumb folds to)
    return n.normalized(), fd, kl
def curl(s, amount, spread=0.0):
    """amount 0 open .. 1 a loose fist; the thumb folds across"""
    n, fd, kl = palm(s)
    for f in FINGERS[1:]:
        for j, k in ((1, 0.9), (2, 1.0), (3, 0.7)):
            bn = f'{f}_0{j}_{s}'; d = (tail(bn) - head(bn)).normalized(); ax = d.cross(n)
            rotw(bn, ax, amount * k * (1.2 if f != 'index' else 1.0))
    for j, k in ((1, 0.35), (2, 0.5), (3, 0.6)):
        bn = f'thumb_0{j}_{s}'; d = (tail(bn) - head(bn)).normalized(); ax = d.cross(n)
        rotw(bn, ax, amount * k)
def palm_to(s, want):
    """turn the hand about its own length until the palm faces `want` (as near as the wrist allows)"""
    n, fd, _ = palm(s); w = Vector(want); w = (w - fd * w.dot(fd))
    if w.length < 1e-6: return
    w.normalize(); n2 = (n - fd * n.dot(fd)).normalized(); ang = n2.angle(w)
    if fd.dot(n2.cross(w)) < 0: ang = -ang
    rotw(f'hand_{s}', fd, ang)

# ---- the head and eyes: turn (neck 40 %, head 60 %) so the face looks at a point; the eyes finish the job
FACE0 = Vector((0, -1, 0))
def look_at(target, amount=1.0):
    t = W(target)
    for n, share in (('neck_01', 0.4), ('head', 1.0)):
        face = delta('head') @ FACE0; eye = (head('eye_l') + head('eye_r')) / 2
        want = (t - eye).normalized(); q = face.rotation_difference(want)
        q = Quaternion().slerp(q, share * amount); rotq(n, q)
    for s in 'lr':
        face = delta(f'eye_{s}') @ FACE0; want = (t - head(f'eye_{s}')).normalized()
        q = face.rotation_difference(want); q = Quaternion().slerp(q, 0.85 * amount); rotq(f'eye_{s}', q)

# ---- standing: the arms down from MakeHuman's A pose, a natural slight bend at the elbows
def arms_down(swing_l=0.0, swing_r=0.0, bend=0.25):
    for s, sw, x in (('l', swing_l, 1), ('r', swing_r, -1)):
        aim(f'upperarm_{s}', (0.13 * x, 0.02 + math.sin(sw) * 1.0, -1.0))
        aim(f'lowerarm_{s}', (0.06 * x, -math.sin(bend + max(0.0, sw) * 0.8), -math.cos(bend + max(0.0, sw) * 0.8)))
        aim(f'hand_{s}', (tail(f'lowerarm_{s}') - head(f'lowerarm_{s}')))
        palm_to(s, (-x, 0.15, 0)); curl(s, 0.22)

def place_pelvis(offset, pitch=0.0, yaw=0.0, roll=0.0):
    """move the hips by `offset` (his frame) and turn them about their own centre"""
    pb = P['pelvis']; c = B['pelvis'].head_local.copy()
    rest = B['pelvis'].matrix_local.copy()
    R = (Quaternion((0, 0, 1), yaw) @ Quaternion((1, 0, 0), pitch) @ Quaternion((0, 1, 0), roll)).to_matrix().to_4x4()
    pb.matrix = Matrix.Translation(c + Vector(offset)) @ R @ Matrix.Translation(-c) @ rest
    upd()
def root_at(y):
    P['Root'].matrix = Matrix.Translation((0, y, 0)) @ B['Root'].matrix_local; upd()

def feet(lf, rf, pitch_l=0.0, pitch_r=0.0, yaw_l=0.0, yaw_r=0.0):
    """the legs to their ankles (his frame), the feet flat (or rolled by pitch: + toes up)"""
    for s, f, pt, yw in (('l', lf, pitch_l, yaw_l), ('r', rf, pitch_r, yaw_r)):
        x = 1 if s == 'l' else -1
        kne = W((f[0] + 0.1 * x, f[1] - 0.6, f[2] + 0.5))
        two_bone(f'thigh_{s}', f'calf_{s}', f'foot_{s}', W(f), kne)
        # the foot back to its rest orientation in the world (flat), then rolled and turned
        pb = P[f'foot_{s}']; h = head(f'foot_{s}')
        R = (Quaternion((0, 0, 1), yw) @ Quaternion((1, 0, 0), pt)).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-B[f'foot_{s}'].head_local) @ B[f'foot_{s}'].matrix_local; upd()

def spine(pitch=0.0, yaw=0.0, roll=0.0):
    for n, k in (('spine_01', 0.3), ('spine_02', 0.3), ('spine_03', 0.4)):
        c = head(n)
        rotw(n, (0, 0, 1), yaw * k, c); rotw(n, (1, 0, 0), pitch * k, c); rotw(n, (0, 1, 0), roll * k, c)

def key(frame):
    for pb in P:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        if pb.name in ('Root', 'pelvis'): pb.keyframe_insert('location', frame=frame)

def clip(name, seconds, pose, loop=False):
    act = bpy.data.actions.new(name); rig.animation_data_create(); rig.animation_data.action = act
    n = int(round(seconds * FPS))
    for f in range(0, n + 1):
        t = f / FPS if not loop or f < n else 0.0
        reset(); pose(t); key(f)
    # every clip its own NLA track (the glTF exporter writes each as an animation)
    tr = rig.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, act); rig.animation_data.action = None
    print(f'clip {name}: {n} frames')

# ---------------------------------------------------------------- chapter 1: the capture
ANK = 0.083                                     # (the ankle's height over the ground, standing)
FOOT_X = 0.11
ROBOT = Vector((0.0, -0.5, 0.0)); ROBOT_H = 0.37
BASKET = Vector((-0.42, -0.12, 0.0))
def walk_path(t):
    """distance still to go (along +y; he walks toward -y): 1.3 m/s, slowing over the last second to a stop at 3.4 s"""
    v = 1.3
    if t <= 2.4: s = v * t
    else: u = min(1.0, (t - 2.4) / 1.0); s = v * 2.4 + v * (u - u * u / 2)
    return max(0.0, 3.775 - s)   # (he stops 0.5 m behind the robot: the game puts his mark there)
STEPS = []
def plan_steps():
    """heel strikes along the path: alternate feet, the landing foot a little ahead of the hips; the last brings
    the feet together beside each other"""
    t, side = 0.0, 'l'
    while t < 3.0:
        y = walk_path(t) - 0.3 * (1 - sm(2.4, 3.4, t)) - 0.05
        STEPS.append((t, side, max(0.0, y)))
        t += 0.53 + 0.25 * sm(2.2, 3.4, t); side = 'r' if side == 'l' else 'l'
    STEPS.append((3.4, side, 0.0))
plan_steps()
def foot_state(s, t):
    """where a foot is (his frame) and its roll: planted between landings, swung in an arc to the next"""
    mine = [(tt, y) for tt, ss, y in STEPS if ss == s]
    other = [tt for tt, ss, y in STEPS if ss != s]
    x = FOOT_X if s == 'l' else -FOOT_X
    if t <= mine[0][0]:
        y0 = mine[0][1] + 0.68; prev_land = -1.0
        return Vector((x, walk_path(0) + (0.33 if s == 'r' else -0.3), ANK)), 0.0
    for i, (tt, y) in enumerate(mine):
        nxt = mine[i + 1] if i + 1 < len(mine) else None
        if nxt is None or t < nxt[0]:
            if nxt is None: return Vector((x, y, ANK)), 0.0
            lift = [o for o in other if tt < o < nxt[0]]
            t_off = (lift[0] + 0.08) if lift else tt + 0.25
            if t < t_off - 0.12: return Vector((x, y, ANK)), 0.0                                   # stance
            if t < t_off: return Vector((x, y, ANK + 0.03 * sm(t_off - 0.12, t_off, t))), -0.35 * sm(t_off - 0.12, t_off, t)   # heel off
            u = sm(t_off, nxt[0], t); arc = math.sin(math.pi * min(1, (t - t_off) / max(1e-3, nxt[0] - t_off)))
            pos = Vector((x, lerp(y, nxt[1], u), ANK + 0.03 * (1 - u) + 0.08 * arc))
            pitch = lerp(-0.35, 0.25, u) if u < 0.95 else 0.25 * (1 - (u - 0.95) / 0.05)
            return pos, pitch
    return Vector((x, mine[-1][1], ANK)), 0.0

def capture_pose(t):
    # --- the body's root travels with the walk
    y = walk_path(t); root_at(0.0)
    # crouching: down to the robot (5.8-6.9), up lifting it (7.6-9.2), down beside the basket (9.8-10.9), up (12.4-13.3)
    c1 = sm(5.8, 6.9, t) * (1 - sm(7.6, 9.2, t)); c2 = sm(9.8, 10.9, t) * (1 - sm(12.4, 13.3, t))
    crouch = max(c1, c2 * 0.78)
    turn = -0.95 * sm(9.7, 10.8, t) * (1 - sm(12.6, 13.4, t))          # (toward the basket on his right)
    walking = 1 - sm(3.2, 3.6, t)
    # hips: along the path, bobbing and swaying with the steps; down for the crouch
    lf, pl = foot_state('l', t); rf, pr = foot_state('r', t)
    stance_x = (lf.x if lf.z < ANK + 0.01 else rf.x) if walking > 0 else 0.0
    bob = (0.012 * math.cos(2 * math.pi * (t / 0.53)) - 0.01) * walking
    hip_y = lerp(0.0, y + 0.02, walking) if t < 3.6 else 0.0
    hip_y += 0.12 * crouch * (1 - abs(turn) / 0.95) + 0.06 * c2
    place_pelvis((stance_x * 0.25 * walking + 0.05 * c2 * 0 , hip_y - B['pelvis'].head_local.y, bob - 0.44 * crouch),
                 pitch=0.22 * crouch, yaw=turn * 0.35 + 0.06 * math.sin(2 * math.pi * t / 1.06) * walking)
    # legs: walking footsteps, then planted where the last step left them
    if t < 3.6: feet(lf, rf, pl, pr)
    else:
        feet(Vector((FOOT_X + 0.03 * crouch, 0.0, ANK)), Vector((-FOOT_X - 0.03 * crouch, 0.0, ANK)), yaw_l=0.25 * crouch, yaw_r=-0.25 * crouch + turn * 0.15)
    # spine: leaning into the reach, turned toward the basket
    reach_lean = 0.75 * c1 + 0.6 * c2
    spine(pitch=0.05 + reach_lean, yaw=turn * 0.65 + 0.07 * math.sin(2 * math.pi * t / 1.06 + math.pi) * walking, roll=-0.12 * c2)
    # arms: swinging while he walks; then the right hand's journey and the left hand on the knee
    sw = 0.32 * math.sin(2 * math.pi * t / 1.06) * walking
    arms_down(sw, -sw)
    if t > 5.6:
        # the right hand: down over the robot's head, round it, up to his chest, over to the basket, in, out, the lid
        top = ROBOT + Vector((0, 0.0, ROBOT_H + 0.07))
        grip = ROBOT + Vector((0, 0.02, ROBOT_H - 0.02))
        chest = Vector((-0.06, -0.36, 1.25))
        over_b = BASKET + Vector((0.02, 0.0, 0.75)); in_b = BASKET + Vector((0.0, 0.0, 0.05 + ROBOT_H + 0.0)); lid = BASKET + Vector((0.0, -0.05, 0.47))
        if t < 7.2: tgt = vlerp(vlerp((-0.25, -0.15, 0.85), (0, -0.3, 0.75), sm(5.6, 6.4, t)), top, sm(6.2, 7.2, t))
        elif t < 7.6: tgt = vlerp(top, grip, sm(7.2, 7.6, t))
        elif t < 9.8: tgt = vlerp(grip, chest, sm(7.7, 9.4, t)) + Vector((0, 0, 0.04 * math.sin(math.pi * sm(7.7, 9.4, t))))
        elif t < 11.6: tgt = vlerp(vlerp(chest, over_b, sm(9.8, 10.9, t)), in_b, sm(10.7, 11.6, t))
        elif t < 12.3: tgt = vlerp(in_b, in_b + Vector((0.03, 0.06, 0.3)), sm(11.9, 12.3, t))
        elif t < 13.1: tgt = vlerp(in_b + Vector((0.03, 0.06, 0.3)), lid, sm(12.3, 12.9, t))
        else: tgt = vlerp(lid, (-0.25, -0.05, 0.85), sm(13.1, 13.5, t))
        wgt = sm(5.6, 6.2, t) * (1 - sm(13.2, 13.5, t))
        h0 = tail('lowerarm_r'); target = W(tgt) * wgt + h0 * (1 - wgt) if wgt < 1 else W(tgt)
        # (the wrist sits a hand's length behind where the fingers close)
        two_bone('upperarm_r', 'lowerarm_r', 'hand_r', target + Vector((0.0, 0.03, 0.07)) * wgt, W((-0.6, 0.3, 0.9)))
        aim('hand_r', vlerp((tail('lowerarm_r') - head('lowerarm_r')).normalized(), (0, -0.25, -1), wgt * (0.8 if t < 9.8 or t > 10.9 else 0.6)))
        palm_to('r', (0.0, 0.25, -1.0) if t < 9.6 or t > 10.8 else (0.3, 0.2, -1.0))
        g = sm(6.9, 7.6, t) * (1 - sm(11.6, 12.1, t))
        curl('r', 0.05 + 0.8 * g - 0.2 * (sm(6.0, 6.6, t) * (1 - sm(6.9, 7.3, t))))
    if c1 > 0.01 or c2 > 0.01:
        k = max(c1, c2)
        knee = (head('calf_l') + Vector((0.0, -0.05, 0.06)))
        two_bone('upperarm_l', 'lowerarm_l', 'hand_l', head('lowerarm_l').lerp(knee, k) if k < 1 else knee, W((0.6, 0.3, 0.9)))
        palm_to('l', (0, 0, -1)); curl('l', 0.45)
    # the head: ahead while walking, down at the robot, at the robot in his hand, at the basket
    if t < 3.4: look_at((0.0, y - 4.0, 1.2), 0.6)
    elif t < 7.7: look_at(ROBOT + Vector((0, 0, ROBOT_H)), sm(3.4, 4.0, t))
    elif t < 9.9: look_at(head('hand_r') - Vector((0, 0, G0)), 1.0)
    else: look_at(BASKET + Vector((0, 0, 0.45)), 1.0)
    # (the hips and feet are placed where they are in his frame: the clip walks him in from 3.78 m behind his
    # mark to it; the game puts the mark 0.42 m behind the robot)

# ---------------------------------------------------------------- chapter 2: the bed
# He lies on his back, head toward +y (the headboard), on a mattress whose top is at z = 0 in this frame (the game
# puts this frame's origin on the mattress under his hips); forearms on the duvet over his belly.
DUVET = 0.17
def lying(t, head_lift=0.0, head_turn=0.0, lamp=0.0, breath=0.0, shift=0.0):
    root_at(0.0)
    # the hips on the mattress, the body tipped back to lie along +y
    hips = Vector((0.0, 0.0, 0.11)) - Vector((0, 0, G0)) - B['pelvis'].head_local + Vector((0, 0, G0))
    place_pelvis((0.0 + shift * 0.03, -B['pelvis'].head_local.y, 0.11 - (B['pelvis'].head_local.z - G0)), pitch=-math.pi / 2 + 0.06, roll=0.12 * shift - 0.08 * lamp)
    # legs straight down the bed, a little apart, the feet falling outward
    for s, x in (('l', 1), ('r', -1)):
        aim(f'thigh_{s}', (0.06 * x, -1.0, -0.03)); aim(f'calf_{s}', (0.04 * x, -1.0, 0.02))
        rotw(f'foot_{s}', (0, 1, 0), 0.9 * x)
    # the chest breathing, the upper back resting on the pillow's slope
    spine(pitch=0.18 + 0.025 * breath, yaw=0.08 * shift - 0.35 * lamp)
    # head on the pillow, turned a little to his right; raised and turned as asked
    for n in ('neck_01', 'head'):
        rotw(n, (1, 0, 0), 0.12 + head_lift * 0.5, head(n))
    hd = head('head'); rotw('neck_01', (0, 1, 0) if False else (delta('head') @ Vector((0, 0, 1))), -0.25 + head_turn, head('neck_01'))
    # arms: forearms across the belly, on top of the duvet; the left one goes out to the lamp
    belly = W((0.0, 0.2, DUVET + 0.03 + 0.006 * breath))
    for s, x in (('l', 1), ('r', -1)):
        if s == 'l' and lamp > 0:
            lampp = W((1.1, 0.75, 0.14))
            tgt = belly + Vector((0.05 * x, 0.0, 0.0))
            tgt = tgt.lerp(W((0.35, 0.45, DUVET + 0.14)), sm(0.0, 0.35, lamp)).lerp(lampp, sm(0.3, 1.0, lamp))
            two_bone(f'upperarm_{s}', f'lowerarm_{s}', f'hand_{s}', tgt, W((0.9, 0.3, 0.6)))
            aim(f'hand_{s}', (0.6, 0.6, -0.3)); palm_to(s, (0, 0, -1)); curl(s, 0.25 + 0.2 * sm(0.85, 1.0, lamp))
        else:
            two_bone(f'upperarm_{s}', f'lowerarm_{s}', f'hand_{s}', belly + Vector((0.08 * x, 0.06 if s == 'r' else -0.04, 0.0)), W((0.5 * x, 0.6, 0.2)))
            aim(f'hand_{s}', (-0.9 * x, 0.1, -0.15)); palm_to(s, (0, 0, -1)); curl(s, 0.35)

def sleep_pose(t): lying(t, breath=math.sin(2 * math.pi * t / 4.2))
def stir_pose(t):
    k = math.sin(math.pi * sm(0.0, 3.0, t))
    lying(t, head_turn=0.45 * k, shift=k, breath=math.sin(2 * math.pi * t / 4.2))
def wake_pose(t):
    lying(t, head_lift=0.35 * sm(0.0, 0.8, t), head_turn=0.55 * sm(0.2, 0.9, t) * (1 - sm(1.4, 2.2, t)) - 0.2 * sm(1.4, 2.2, t),
          lamp=sm(0.2, 1.1, t) * (1 - sm(1.3, 2.1, t)), breath=0.3)
def look_pose(t):
    lying(t, head_lift=0.35, head_turn=-0.2 - 0.35 * math.sin(2 * math.pi * t / 3.0), breath=0.3)
def settle_pose(t):
    lying(t, head_lift=0.35 * (1 - sm(0.9, 2.4, t)), head_turn=-0.2 * (1 - sm(0.6, 1.4, t)) + 0.5 * sm(0.2, 0.7, t) * (1 - sm(1.0, 1.6, t)),
          lamp=sm(0.1, 0.8, t) * (1 - sm(0.9, 1.6, t)), breath=0.0)

CLIPS = [('capture', 13.5, capture_pose, False), ('sleep', 4.2, sleep_pose, True), ('stir', 3.0, stir_pose, False),
         ('wake', 2.2, wake_pose, False), ('look', 3.0, look_pose, True), ('settle', 2.4, settle_pose, False)]
for name, sec, fn, loop in CLIPS:
    if ONLY and name not in ONLY: continue
    clip(name, sec, fn, loop)
reset(); bpy.ops.object.mode_set(mode='OBJECT')
for o in bpy.context.scene.objects: o.select_set(True)
bpy.context.view_layer.objects.active = rig
keep = [o for o in bpy.context.scene.objects if o.name != 'stranger_body']
for o in bpy.context.scene.objects: o.select_set(o in keep)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_skins=True, export_morph=True,
                          export_morph_normal=False, export_apply=True, export_texcoords=True, export_normals=True, export_vertex_color='NONE',
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1,
                          export_image_format='AUTO', export_jpeg_quality=92)
import os
print('exported', OUT, round(os.path.getsize(OUT) / 1e6, 1), 'MB')
