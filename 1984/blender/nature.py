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
    for k in range(n):
        ang = cfg['spread'] * (0.6 + 0.8 * r.random())
        az = (k / n) * math.tau + r.random() * 1.2
        side = d.orthogonal().normalized()
        side = Quaternion(d, az) @ side
        nd = (Quaternion(side, ang) @ d)
        nd = (nd + Vector((0, 0, cfg['up']))).normalized()
        branch(m, r, end, nd, length * cfg['shrink'] * (0.8 + 0.4 * r.random()), rad * cfg['taper'], depth - 1, cfg, tips)
    if cfg.get('leader') and depth > 1:
        branch(m, r, end, (d + Vector((0, 0, 0.3))).normalized(), length * 0.8, rad * cfg['taper'], depth - 1, cfg, tips)


def foliage(m, r, tips, size, mat, per_tip=1, droop=0.0):
    for (p, d) in tips:
        for _ in range(per_tip):
            c = p + Vector(((r.random() - 0.5) * size * 0.6, (r.random() - 0.5) * size * 0.6, (r.random() - 0.5) * size * 0.4 - droop))
            s = size * (0.75 + 0.5 * r.random())
            rot = r.random() * math.pi
            for k in range(3):
                if k < 2:
                    a = rot + k * math.pi / 2
                    ax = Vector((math.cos(a), math.sin(a), 0)) * s / 2
                    up = Vector((0, 0, s / 2))
                    pts = [c - ax - up, c + ax - up, c + ax + up, c - ax + up]
                else:
                    ax = Vector((s / 2, 0, 0)); ay = Vector((0, s / 2, 0))
                    tilt = Matrix.Rotation(r.random() * 0.6, 3, 'X')
                    ax, ay = tilt @ ax, tilt @ ay
                    pts = [c - ax - ay, c + ax - ay, c + ax + ay, c - ax + ay]
                m.quad(pts, mat, uv_rect=(0, 0, 1, 1))


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
        a = k / 5 * math.tau + r.random()
        m.cyl(Vector((0, 0, 0.3)), Vector((math.cos(a) * 1.0, math.sin(a) * 1.0, -0.1)), cfg['trunk'] * 0.45, 0.04, cfg['bark'], 6)
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
