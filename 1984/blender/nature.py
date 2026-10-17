"""Trees and the Golden Country: chestnut, elm, hazel, the dead tree with
moss on it, and the gate with the top bar missing."""
import math
from mathutils import Vector, Matrix, Quaternion
from lib import Mesh, rng


def branch(m, r, p, d, length, rad, depth, cfg, tips):
    end = p + d * length
    m.cyl(p, end, rad, rad * cfg['taper'], cfg['bark'], max(4, int(6 + depth * 1.5)), caps=False)
    if depth == 0 or rad < 0.025:
        tips.append((end, d))
        return
    n = cfg['split'] if depth > 1 else cfg['split'] + 1
    kids = []
    for k in range(n):
        ang = cfg['spread'] * (0.6 + 0.8 * r.random())
        az = (k / n) * math.tau + r.random() * 1.2
        side = d.orthogonal().normalized()
        side = Quaternion(d, az) @ side
        nd = (Quaternion(side, ang) @ d)
        nd = (nd + Vector((0, 0, cfg['up']))).normalized()
        kids.append(nd)
        # a fork starts a little inside the parent's end along its own bearing:
        # sibling limbs from one centre each had a face in one shared plane there
        base = end - nd * rad * cfg['taper'] * 0.7
        branch(m, r, base, nd, length * cfg['shrink'] * (0.8 + 0.4 * r.random()), rad * cfg['taper'], depth - 1, cfg, tips)
    if cfg.get('leader') and depth > 1:
        # bend the leader away from a sibling it nearly follows: two limbs
        # leaving one joint at almost the same bearing share faces there
        ld = (d + Vector((0, 0, 0.3))).normalized()
        for _ in range(6):
            near = [k for k in kids if ld.angle(k) < 0.2]
            if not near:
                break
            ld = (ld + (ld - near[0]).normalized() * 0.1).normalized()
        branch(m, r, end, ld, length * 0.8, rad * cfg['taper'], depth - 1, cfg, tips)


def _card_clash(pts, cards):
    """How badly would this leaf card z-fight with those already placed?
    0 when it cannot, else the |cos| of the angle to the most parallel card
    it clashes with. The leaves are double sided, so either facing counts: a
    clash is a card within 6 deg of parallel, overlapping, whose plane comes
    within 2 cm of this one."""
    n = (pts[1] - pts[0]).cross(pts[3] - pts[0]).normalized()
    c = sum(pts, Vector()) / 4
    rad = (pts[0] - c).length
    worst = 0.0
    for n2, c2, rad2, pts2 in cards:
        dot = abs(n.dot(n2))
        if dot < 0.9945 or dot <= worst or (c2 - c).length > rad + rad2:
            continue
        da = [n2.dot(p - c2) for p in pts]
        db = [n.dot(p - c) for p in pts2]
        if min(da) * max(da) <= 0 or min(map(abs, da)) < 0.02 or min(db) * max(db) <= 0 or min(map(abs, db)) < 0.02:
            worst = dot
    return worst


def foliage(m, r, tips, size, mat, per_tip=1, droop=0.0):
    cards = []
    def place(make, turn):
        # turn a card that would lie in another's plane by 12 deg steps (half a
        # turn at most, then the least parallel try); the random draws are
        # already made, so the rest of the tree stays as it was
        best = None
        for k in range(16):
            cand = make(k * turn)
            bad = _card_clash(cand, cards)
            if best is None or bad < best[0]:
                best = (bad, cand)
            if not bad:
                break
        pts = best[1]
        n = (pts[1] - pts[0]).cross(pts[3] - pts[0]).normalized()
        c = sum(pts, Vector()) / 4
        cards.append((n, c, (pts[0] - c).length, pts))
        m.quad(pts, mat, uv_rect=(0, 0, 1, 1))
    for (p, d) in tips:
        for _ in range(per_tip):
            c = p + Vector(((r.random() - 0.5) * size * 0.6, (r.random() - 0.5) * size * 0.6, (r.random() - 0.5) * size * 0.4 - droop))
            s = size * (0.75 + 0.5 * r.random())
            rot = r.random() * math.pi
            for k in range(3):
                if k < 2:
                    def vert(extra, a=rot + k * math.pi / 2):
                        ax = Vector((math.cos(a + extra), math.sin(a + extra), 0)) * s / 2
                        up = Vector((0, 0, s / 2))
                        return [c - ax - up, c + ax - up, c + ax + up, c - ax + up]
                    place(vert, 0.21)
                else:
                    def flat(extra, t=r.random() * 0.6):
                        ax = Vector((s / 2, 0, 0)); ay = Vector((0, s / 2, 0))
                        tilt = Matrix.Rotation(t + extra, 3, 'X')
                        ax, ay = tilt @ ax, tilt @ ay
                        return [c - ax - ay, c + ax - ay, c + ax + ay, c - ax + ay]
                    place(flat, -0.21)


def tree(name, seed, cfg, leaf_mat, leaf_size, height, per_tip=1):
    r = rng(seed)
    m = Mesh(name)
    tips = []
    base = Vector((0, 0, 0))
    # flared trunk
    m.cyl(base, Vector((0, 0, 0.5)), cfg['trunk'] * 1.35, cfg['trunk'], cfg['bark'], 12, caps=False)
    branch(m, r, Vector((0, 0, 0.45)), Vector((0, 0, 1)), height, cfg['trunk'], cfg['depth'], cfg, tips)
    if leaf_mat:
        foliage(m, r, tips, leaf_size, leaf_mat, per_tip, cfg.get('droop', 0.0))
    # roots
    for k in range(5):
        # at most 0.5 rad off an even fan, each starting a little out along its
        # own bearing inside the trunk: roots that all began at one point, some
        # at nearly the same bearing, had faces in one plane there
        a = k / 5 * math.tau + r.random() * 0.5
        d = Vector((math.cos(a), math.sin(a), 0))
        m.cyl(d * cfg['trunk'] * 0.4 + Vector((0, 0, 0.3)), d * 1.0 + Vector((0, 0, -0.1)), cfg['trunk'] * 0.45, 0.04, cfg['bark'], 6)
    return [m.finish()]


def chestnut():
    cfg = dict(bark='bark', trunk=0.42, depth=4, split=3, spread=0.75, shrink=0.72, taper=0.62, up=0.18, leader=False)
    return tree('chestnut', 21, cfg, 'leaves', 2.6, 3.4, per_tip=2)


def elm():
    cfg = dict(bark='bark', trunk=0.38, depth=5, split=2, spread=0.42, shrink=0.78, taper=0.68, up=0.35, leader=True, droop=0.3)
    return tree('elm', 22, cfg, 'leaves_elm', 2.2, 4.2, per_tip=1)


def hazel():
    r = rng(23)
    m = Mesh('hazel')
    tips = []
    cfg = dict(bark='bark', trunk=0.05, depth=2, split=2, spread=0.4, shrink=0.75, taper=0.7, up=0.2, leader=False)
    for k in range(7):
        a = k / 7 * math.tau
        d = Vector((math.cos(a) * 0.35, math.sin(a) * 0.35, 1)).normalized()
        branch(m, r, Vector((math.cos(a) * 0.2, math.sin(a) * 0.2, 0)), d, 1.4, 0.05, 2, cfg, tips)
    foliage(m, r, tips, 1.3, 'leaves', 2)
    return [m.finish()]


def dead_tree():
    cfg = dict(bark='bark_moss', trunk=0.3, depth=3, split=2, spread=0.7, shrink=0.7, taper=0.6, up=0.05, leader=False)
    return tree('dead_tree', 24, cfg, None, 0, 2.6)


def gate():
    """'A gate with the top bar missing.'"""
    m = Mesh('gate')
    for x in (-1.8, 1.8):
        m.box((x - 0.1, -0.1, 0), (x + 0.1, 0.1, 1.4), 'wood')
    for k in range(3):
        z = 0.3 + k * 0.28
        m.box((-1.7, -0.04, z), (1.7, 0.04, z + 0.1), 'wood')
    m.box((-1.7, -0.045, 0.3), (-1.55, 0.045, 1.0), 'wood')
    m.box((1.55, -0.045, 0.3), (1.7, 0.045, 1.0), 'wood')
    M = Matrix.Translation((0, 0, 0.6)) @ Matrix.Rotation(0.55, 4, 'Y')
    m.box((-1.8, -0.04, -0.05), (1.8, 0.04, 0.05), 'wood', matrix=M)
    return [m.finish()]


def hedge():
    r = rng(25)
    m = Mesh('hedge')
    tips = []
    for k in range(6):
        x = -4 + k * 1.6 + r.random() * 0.4
        tips.append((Vector((x, 0, 0.6 + r.random() * 0.6)), Vector((0, 0, 1))))
        tips.append((Vector((x + 0.5, 0, 1.4 + r.random() * 0.5)), Vector((0, 0, 1))))
    foliage(m, r, tips, 1.8, 'leaves_elm', 2)
    return [m.finish()]


ALL = {'chestnut': chestnut, 'elm': elm, 'hazel': hazel, 'dead_tree': dead_tree, 'gate': gate, 'hedge': hedge}
