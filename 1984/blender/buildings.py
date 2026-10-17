"""Buildings of Airstrip One. Every function builds one asset into the current
(empty) scene and returns the objects to export."""
import math
from mathutils import Vector, Matrix
from lib import Mesh, rng

UP = Vector((0, 0, 1))


def frame_fn(origin, right, out):
    inn = -out
    def P(u, v, w=0.0):
        return origin + right * u + UP * v + inn * w
    return P


def obox(m, P, u0, u1, v0, v1, w0, w1, mat, faces='all'):
    """Box in a facade frame (u right, w inward, v up), right handed."""
    c = [P(u0, v0, w0), P(u1, v0, w0), P(u1, v0, w1), P(u0, v0, w1),
         P(u0, v1, w0), P(u1, v1, w0), P(u1, v1, w1), P(u0, v1, w1)]
    sides = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4),
             '+y': (2, 3, 7, 6), '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
    for k, idx in sides.items():
        if faces != 'all' and k not in faces:
            continue
        m.quad([c[i] for i in idx], mat)


def facade(m, origin, right, out, width, height, wins, wall, depth=0.22,
           frame='iron_black', sills=True, mullions=True, frames=True):
    """A flat wall with recessed window openings.
    wins: list of (x0, z0, x1, z1, glass_material[, kind])"""
    P = frame_fn(origin, right, out)
    xs = sorted(set([0.0, width] + [w[0] for w in wins] + [w[2] for w in wins]))
    zs = sorted(set([0.0, height] + [w[1] for w in wins] + [w[3] for w in wins]))
    for i in range(len(xs) - 1):
        for j in range(len(zs) - 1):
            x0, x1, z0, z1 = xs[i], xs[i + 1], zs[j], zs[j + 1]
            cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
            if any(w[0] < cx < w[2] and w[1] < cz < w[3] for w in wins):
                continue
            m.quad([P(x0, z0), P(x1, z0), P(x1, z1), P(x0, z1)], wall)
    for w in wins:
        x0, z0, x1, z1, gm = w[:5]
        kind = w[5] if len(w) > 5 else 'window'
        d = depth
        m.quad([P(x0, z0, 0), P(x1, z0, 0), P(x1, z0, d), P(x0, z0, d)], wall)
        m.quad([P(x0, z1, 0), P(x0, z1, d), P(x1, z1, d), P(x1, z1, 0)], wall)
        m.quad([P(x0, z0, 0), P(x0, z0, d), P(x0, z1, d), P(x0, z1, 0)], wall)
        m.quad([P(x1, z0, 0), P(x1, z1, 0), P(x1, z1, d), P(x1, z0, d)], wall)
        m.quad([P(x0, z0, d), P(x1, z0, d), P(x1, z1, d), P(x0, z1, d)], gm)
        if kind == 'window':
            if frames and gm in ('glass', 'glass_lit'):
                # sash frame round the glass, set back in the reveal
                fw = 0.055
                obox(m, P, x0, x1, z0, z0 + fw, d - 0.08, d - 0.004, frame)
                obox(m, P, x0, x1, z1 - fw, z1, d - 0.08, d - 0.004, frame)
                obox(m, P, x0, x0 + fw, z0 + fw, z1 - fw, d - 0.08, d - 0.004, frame)
                obox(m, P, x1 - fw, x1, z0 + fw, z1 - fw, d - 0.08, d - 0.004, frame)
            if mullions and gm in ('glass', 'glass_lit'):
                mu = (x0 + x1) / 2
                obox(m, P, mu - 0.035, mu + 0.035, z0, z1, d - 0.07, d - 0.005, frame)
                tz = z0 + (z1 - z0) * 0.68
                obox(m, P, x0, x1, tz - 0.035, tz + 0.035, d - 0.07, d - 0.005, frame)
            if sills:
                obox(m, P, x0 - 0.07, x1 + 0.07, z0 - 0.09, z0, -0.1, 0.02, wall,
                     faces={'+z', '-y', '-x', '+x', '-z'})
        elif kind == 'door':
            obox(m, P, x0 - 0.12, x1 + 0.12, z1, z1 + 0.15, -0.08, 0.0, wall)


def sides(W, D):
    """(origin, right, out, width) for the four walls of a W x D footprint."""
    return {
        'front': (Vector((-W / 2, -D / 2, 0)), Vector((1, 0, 0)), Vector((0, -1, 0)), W),
        'back': (Vector((W / 2, D / 2, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), W),
        'right': (Vector((W / 2, -D / 2, 0)), Vector((0, 1, 0)), Vector((1, 0, 0)), D),
        'left': (Vector((-W / 2, D / 2, 0)), Vector((0, -1, 0)), Vector((-1, 0, 0)), D),
    }


def pick(r, mix):
    x = r.random(); acc = 0
    for mat, p in mix:
        acc += p
        if x <= acc:
            return mat
    return mix[0][0]


PARTY_MIX = [('glass', 0.72), ('glass_lit', 0.18), ('board', 0.06), ('cardboard', 0.04)]
PROLE_MIX = [('glass', 0.5), ('glass_lit', 0.2), ('cardboard', 0.17), ('board', 0.13)]


def window_grid(width, floors, fh, cols, ww, wh, sill, r, mix, skip=None, z_off=0.0):
    out = []
    sp = width / cols
    for f in range(floors):
        for c in range(cols):
            if skip and skip(f, c):
                continue
            cx = (c + 0.5) * sp
            z0 = z_off + f * fh + sill
            out.append((cx - ww / 2, z0, cx + ww / 2, z0 + wh, pick(r, mix)))
    return out


def roof_clutter(m, W, D, H, r, n=4):
    for _ in range(n):
        x = (r.random() - 0.5) * (W - 4); y = (r.random() - 0.5) * (D - 3)
        kind = r.random()
        if kind < 0.45:
            m.box((x - 0.5, y - 0.4, H), (x + 0.5, y + 0.4, H + 1.8), 'brick')
            for k in range(2):
                m.cyl((x - 0.2 + k * 0.4, y, H + 1.8), (x - 0.2 + k * 0.4, y, H + 2.2), 0.12, 0.1, 'brick', 8)
        elif kind < 0.7:
            # water tank up on two iron trestles (it used to start on the roof
            # with the trestles inside it, their feet sharing its floor)
            m.box((x - 1.4, y - 1.0, H + 0.3), (x + 1.4, y + 1.0, H + 2.4), 'metal')
            for sx in (-1.2, 1.2):
                m.box((x + sx - 0.08, y - 0.9, H), (x + sx + 0.08, y + 0.9, H + 0.3), 'iron_black')
        else:
            m.box((x - 0.8, y - 0.8, H), (x + 0.8, y + 0.8, H + 1.0), 'concrete_dark')


def party_block(name, W, D, floors, fh=3.0, seed=1, wall='concrete_grey', entrance=True,
                cols=None, side_cols=None, ww=1.3, wh=1.6, mix=PARTY_MIX):
    r = rng(seed)
    m = Mesh(name)
    H = floors * fh + 0.9
    cols = cols or max(3, int(W / 3.0))
    side_cols = side_cols or max(2, int(D / 3.2))
    dx = W / cols
    door_c = cols // 2
    for key, (o, right, out, width) in sides(W, D).items():
        nc = cols if key in ('front', 'back') else side_cols
        skip = None
        if key == 'front' and entrance:
            skip = lambda f, c: f == 0 and c == door_c
        wins = window_grid(width, floors, fh, nc, ww, wh, 0.95, r, mix, skip, 0.0)
        if key == 'front' and entrance:
            cx = (door_c + 0.5) * dx
            wins.append((cx - 1.1, 0.0, cx + 1.1, 2.6, 'glass', 'door'))
        facade(m, o, right, out, width, H, wins, wall)
        P = frame_fn(o, right, out)
        # string courses between floors and a cornice
        for f in range(1, floors):
            obox(m, P, -0.12, width + 0.12, f * fh - 0.12, f * fh + 0.02, -0.12, 0.0, wall,
                 faces={'+z', '-y', '-z', '-x', '+x'})
        obox(m, P, -0.25, width + 0.25, H - 0.55, H - 0.25, -0.3, 0.0, wall, faces={'+z', '-y', '-z', '-x', '+x'})
        obox(m, P, -0.05, width + 0.05, 0.0, 0.55, -0.08, 0.0, 'concrete_dark', faces={'+z', '-y', '-x', '+x'})
        if key in ('front', 'back'):
            for u in (0.35, width - 0.35):
                m.cyl(P(u, 0.0, -0.14), P(u, H - 0.3, -0.14), 0.055, 0.055, 'iron_black', 8)
                m.cyl(P(u, H - 0.3, -0.14), P(u, H - 0.2, 0.0), 0.055, 0.055, 'iron_black', 8)
                m.cyl(P(u - 0.1, 0.02, -0.14), P(u + 0.12, 0.02, -0.3), 0.06, 0.06, 'iron_black', 8)
    # roof with parapet
    m.box((-W / 2, -D / 2, H - 0.01), (W / 2, D / 2, H), 'concrete_dark', faces={'+z'})
    t = 0.25
    for (a, b) in [((-W / 2, -D / 2), (W / 2, -D / 2 + t)), ((-W / 2, D / 2 - t), (W / 2, D / 2)),
                   ((-W / 2, -D / 2), (-W / 2 + t, D / 2)), ((W / 2 - t, -D / 2), (W / 2, D / 2))]:
        m.box((a[0], a[1], H), (b[0], b[1], H + 0.9), wall)
    roof_clutter(m, W, D, H, r, n=int(W * D / 120) + 2)
    if entrance:
        cx = -W / 2 + (door_c + 0.5) * dx
        m.box((cx - 2.0, -D / 2 - 1.8, 2.9), (cx + 2.0, -D / 2, 3.15), 'concrete_dark')
        m.box((cx - 1.6, -D / 2 - 0.9, 0.0), (cx + 1.6, -D / 2, 0.15), 'concrete_dark')
    return [m.finish()]


def victory_mansions():
    return party_block('victory_mansions', 42, 14, 8, 3.0, seed=7, cols=14, side_cols=4,
                       mix=[('glass', 0.62), ('glass_lit', 0.18), ('board', 0.12), ('cardboard', 0.08)])


def gable_roof(m, x0, x1, D, H, rise, mat='slate', overhang=0.3, gable_mat='brick'):
    y0, y1 = -D / 2 - overhang, D / 2 + overhang
    zr = H + rise
    m.quad([(x0 - overhang, y0, H - 0.12), (x1 + overhang, y0, H - 0.12), (x1 + overhang, 0, zr), (x0 - overhang, 0, zr)], mat)
    m.quad([(x1 + overhang, y1, H - 0.12), (x0 - overhang, y1, H - 0.12), (x0 - overhang, 0, zr), (x1 + overhang, 0, zr)], mat)
    # undersides so the eaves are not see-through
    m.quad([(x0 - overhang, y0, H - 0.12), (x0 - overhang, 0, zr - 0.15), (x1 + overhang, 0, zr - 0.15), (x1 + overhang, y0, H - 0.12)], 'wood_dark')
    m.quad([(x1 + overhang, y1, H - 0.12), (x1 + overhang, 0, zr - 0.15), (x0 - overhang, 0, zr - 0.15), (x0 - overhang, y1, H - 0.12)], 'wood_dark')
    # gable triangles
    if gable_mat:
        m.quad([(x0, D / 2, H), (x0, -D / 2, H), (x0, 0, zr)], gable_mat)
        m.quad([(x1, -D / 2, H), (x1, D / 2, H), (x1, 0, zr)], gable_mat)


def prole_terrace(name='prole_terrace', n=4, seed=3, ruined=0, shop=False, pub=False):
    """A row of sooty two-storey Victorian houses, 5.2 m each."""
    r = rng(seed)
    m = Mesh(name)
    hw, D, fh, floors = 5.2, 8.0, 3.0, 2
    W = hw * n
    H = fh * floors + 0.4
    whole = n - ruined
    Wb = hw * whole
    x_start = -W / 2
    for key, (o, right, out, width) in sides(Wb, D).items():
        o = o + Vector((x_start + Wb / 2, 0, 0))
        wins = []
        if key in ('front', 'back'):
            for h in range(whole):
                hx = (h if key == 'front' else whole - 1 - h) * hw
                if key == 'front':
                    if shop and h == 0:
                        wins.append((hx + 0.4, 0.45, hx + 3.4, 2.7, 'glass', 'shop'))
                        wins.append((hx + 3.8, 0.0, hx + 4.8, 2.4, 'wood_dark', 'door'))
                    else:
                        wins.append((hx + 0.6, 0.0, hx + 1.6, 2.3, 'wood_dark', 'door'))
                        wins.append((hx + 2.4, 0.9, hx + 4.4, 2.5, pick(r, PROLE_MIX)))
                else:
                    wins.append((hx + 1.0, 0.0, hx + 1.9, 2.2, 'wood_dark', 'door'))
                    wins.append((hx + 2.9, 1.0, hx + 4.1, 2.4, pick(r, PROLE_MIX)))
                for k in range(2):
                    cx = hx + 1.4 + k * 2.4
                    wins.append((cx - 0.55, fh + 0.8, cx + 0.55, fh + 2.4, pick(r, PROLE_MIX)))
        else:
            if r.random() < 0.5:
                wins.append((D / 2 - 0.6, fh + 0.9, D / 2 + 0.6, fh + 2.3, pick(r, PROLE_MIX)))
        facade(m, o, right, out, width, H, wins, 'brick', depth=0.18, frame='wood_dark')
        P = frame_fn(o, right, out)
        obox(m, P, -0.05, width + 0.05, fh - 0.05, fh + 0.12, -0.1, 0.0, 'stone_dirty',
             faces={'+z', '-y', '-z', '-x', '+x'})
        # shop fascia and sign board
        if key == 'front' and (shop or pub):
            obox(m, P, 0.2, 4.95, 2.8, 3.3, -0.25, 0.0, 'wood_dark')
            # the signboard is fixed 4 cm proud of the fascia: a sheet 1 cm off
            # it flickered when the street was seen from far off
            obox(m, P, 0.3, 4.85, 2.85, 3.25, -0.29, -0.25, 'wood_dark', faces={'+z', '-z', '-x', '+x'})
            m.quad([P(0.3, 2.85, -0.29), P(4.85, 2.85, -0.29), P(4.85, 3.25, -0.29), P(0.3, 3.25, -0.29)],
                   'sign', uv_rect=(0, 0, 1, 1))
            if shop:
                for k in range(1, 6):
                    u = 0.4 + 3.0 * k / 6
                    obox(m, P, u - 0.03, u + 0.03, 0.45, 2.7, 0.08, 0.13, 'wood_dark')
                for k in range(1, 3):
                    v = 0.45 + 2.25 * k / 3
                    obox(m, P, 0.4, 3.4, v - 0.03, v + 0.03, 0.08, 0.13, 'wood_dark')
                obox(m, P, 0.3, 3.5, 0.0, 0.45, -0.05, 0.0, 'wood_dark')
        if key == 'front':
            for h in range(whole):
                if shop and h == 0:
                    continue
                obox(m, P, h * hw + 0.45, h * hw + 1.75, 0.0, 0.18, -0.45, 0.0, 'stone_dirty')
    gable_roof(m, x_start, x_start + Wb, D, H, 2.6)
    # cast-iron gutters along both eaves, downpipes between houses
    for y in (-D / 2 - 0.42, D / 2 + 0.42):
        m.cyl((x_start - 0.3, y, H - 0.2), (x_start + Wb + 0.3, y, H - 0.2), 0.07, 0.07, 'iron_black', 8)
        for h in range(whole + 1):
            if r.random() < 0.35:
                continue
            x = x_start + h * hw + (0.12 if h == 0 else -0.12 if h == whole else 0)
            m.cyl((x, y, H - 0.25), (x, (D / 2 + 0.14) * (1 if y > 0 else -1), H - 0.6), 0.045, 0.045, 'iron_black', 6)
            m.cyl((x, (D / 2 + 0.14) * (1 if y > 0 else -1), H - 0.6), (x, (D / 2 + 0.14) * (1 if y > 0 else -1), 0.05), 0.045, 0.045, 'iron_black', 6)
    # chimney stacks on party walls
    for h in range(whole + 1):
        x = x_start + h * hw
        if h in (0, whole) and r.random() < 0.5:
            continue
        m.box((x - 0.45, -0.5, H + 1.6), (x + 0.45, 0.5, H + 3.8), 'brick')
        m.box((x - 0.55, -0.6, H + 3.8), (x + 0.55, 0.6, H + 3.95), 'stone_dirty')
        for k in range(3):
            px = x - 0.3 + k * 0.3
            m.cyl((px, 0, H + 3.95), (px, 0, H + 4.35), 0.11, 0.09, 'rust' if k == 1 else 'brick', 8)
    # corrugated patches
    for _ in range(int(r.random() * 3) + 1):
        x = x_start + 1 + r.random() * (Wb - 3)
        z = H + 0.5 + r.random() * 1.2
        y = -(H + 2.6 - z) / 2.6 * D / 2
        m.quad([(x, y - 0.9 - 0.02, z - 0.35), (x + 1.8, y - 0.9 - 0.02, z - 0.35),
                (x + 1.8, y + 0.4, z + 0.32), (x, y + 0.4, z + 0.32)], 'corrugated')
    # timber baulks shoring up the end walls
    for end, sgn in ((x_start, -1), (x_start + Wb, 1)):
        if r.random() < 0.7:
            for k in range(2):
                y = -2.2 + k * 4.4
                base = Vector((end + sgn * 3.2, y, 0)); top = Vector((end + sgn * 0.12, y, 5.5))
                m.cyl(base, top, 0.14, 0.14, 'wood', 4, rot=math.pi / 4)
    # ruined houses: broken walls, rubble, joists
    if ruined:
        rx0 = x_start + Wb
        rx1 = x_start + W
        jag = [(rx0, -D / 2, 0)]
        steps = 12
        for k in range(steps + 1):
            x = rx0 + (rx1 - rx0) * k / steps
            z = 5.5 - k * 0.3 + (r.random() - 0.5) * 2.4
            jag.append((x, -D / 2, max(0.8, min(6.2, z))))
        jag.append((rx1, -D / 2, 0))
        mesh_poly_wall(m, jag, 0.3, 'brick')
        for k in range(4):
            y = -D / 2 + 1 + k * 1.8
            m.box((rx0, y, fh - 0.12), (rx0 + 2.5 + r.random() * 1.5, y + 0.18, fh + 0.1), 'wood')
        rubble_heap(m, (rx0 + (rx1 - rx0) / 2, 0.6, 0), 3.6, 1.6, r)
    return [m.finish()]


def mesh_poly_wall(m, pts, thick, mat):
    """Extrude a polygon in the XZ plane (y = pts' y) by thick along +y."""
    n = len(pts)
    front = [Vector(p) for p in pts]
    back = [p + Vector((0, thick, 0)) for p in front]
    m.quad(list(reversed(front)), mat)
    m.quad(back, mat)
    for i in range(n):
        j = (i + 1) % n
        m.quad([front[i], front[j], back[j], back[i]], mat)


def rubble_heap(m, c, rad, height, r, mat='rubble'):
    seg, rings = 14, 5
    cx, cy, cz = c
    rows = []
    for i in range(rings + 1):
        t = i / rings
        row = []
        for j in range(seg):
            a = math.tau * j / seg
            rr = rad * (1 - t) * (0.75 + 0.5 * r.random())
            z = cz + height * math.sin(t * math.pi / 2) * ((0.8 + 0.4 * r.random()) if i < rings else 1.0)
            row.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8, z if i else cz))
        rows.append(row)
    for i in range(rings):
        for j in range(seg):
            k = (j + 1) % seg
            m.quad([rows[i][j], rows[i][k], rows[i + 1][k], rows[i + 1][j]], mat)
    # brick chunks
    for _ in range(14):
        a = r.random() * math.tau; d = r.random() * rad
        x = cx + math.cos(a) * d; y = cy + math.sin(a) * d * 0.8
        s = 0.15 + r.random() * 0.25
        rot = Matrix.Rotation(r.random() * 3, 4, 'Z') @ Matrix.Rotation(r.random(), 4, 'X')
        M = Matrix.Translation((x, y, cz + (1 - d / rad) * height * 0.8)) @ rot
        m.box((-s, -s * 0.5, -s * 0.3), (s, s * 0.5, s * 0.3), 'brick', matrix=M)


def pyramid(name, base, tiers, th, step, seed=11, windows=True, slogans=True, top_block=True):
    """Terrace after terrace of glittering white concrete."""
    r = rng(seed)
    m = Mesh(name)
    for i in range(tiers):
        W = base - i * step * 2
        z0 = i * th
        for key, (o, right, out, width) in sides(W, W).items():
            o = o + Vector((0, 0, z0))
            wins = []
            if windows:
                cols = int(width / 5.5)
                for row in range(2):
                    for c in range(cols):
                        cx = (c + 0.5) * width / cols
                        if key == 'front' and slogans and 2 <= i <= 4 and abs(cx - width / 2) < width * 0.36:
                            continue
                        if key == 'front' and i == 0 and abs(cx - width / 2) < 9:
                            continue
                        zz = 1.6 + row * th / 2
                        wins.append((cx - 0.6, zz, cx + 0.6, zz + 2.4,
                                     'glass_lit' if r.random() < 0.25 else 'glass'))
            if key == 'front' and i == 0:
                wins.append((width / 2 - 6, 0.0, width / 2 + 6, 7.5, 'glass', 'door'))
            facade(m, o, right, out, width, th, wins, 'concrete_white', depth=0.35, sills=False, mullions=False, frames=False)
            P = frame_fn(o, right, out)
            if key == 'front' and slogans and 2 <= i <= 4:
                k = i - 2
                sw = width * 0.7
                u0 = width / 2 - sw / 2
                m.quad([P(u0, 1.0, -0.06), P(u0 + sw, 1.0, -0.06), P(u0 + sw, th - 1.2, -0.06), P(u0, th - 1.2, -0.06)],
                       'slogans', uv_rect=(0, (2 - k) / 3, 1, (3 - k) / 3))
            if key == 'front' and i == 0:
                for sx in (-8.5, 8.5):
                    obox(m, P, width / 2 + sx - 0.9, width / 2 + sx + 0.9, 0, 9.5, -1.2, 0, 'concrete_white')
                obox(m, P, width / 2 - 9.5, width / 2 + 9.5, 9.5, 10.4, -2.5, 0, 'concrete_white')
                for s in range(4):
                    obox(m, P, width / 2 - 12 - s, width / 2 + 12 + s, 0, 0.18 * (4 - s), -1.0 - s * 0.9, 0, 'concrete_white')
        # terrace floor
        Wn = W - step * 2 if i < tiers - 1 else 0
        z1 = z0 + th
        h, hn = W / 2, Wn / 2
        if Wn > 0:
            for (a, b, c, d) in [((-h, -h), (h, -h), (hn, -hn), (-hn, -hn)), ((h, -h), (h, h), (hn, hn), (hn, -hn)),
                                 ((h, h), (-h, h), (-hn, hn), (hn, hn)), ((-h, h), (-h, -h), (-hn, -hn), (-hn, hn))]:
                m.quad([(*a, z1), (*b, z1), (*c, z1), (*d, z1)], 'concrete_white')
            # parapet lip
            for key, (o, right, out, width) in sides(W, W).items():
                P = frame_fn(o + Vector((0, 0, z1)), right, out)
                obox(m, P, 0, width, 0, 0.9, 0, 0.3, 'concrete_white', faces={'+z', '-y', '+y'})
        else:
            m.box((-h, -h, z1 - 0.01), (h, h, z1), 'concrete_white', faces={'+z'})
    if top_block:
        ztop = tiers * th
        m.box((-6, -6, ztop), (6, 6, ztop + 8), 'concrete_white')
        m.cyl((0, 0, ztop + 8), (0, 0, ztop + 40), 0.6, 0.15, 'metal', 8)
        for k in range(3):
            z = ztop + 16 + k * 8
            m.box((-3 + k * 0.6, -0.08, z), (3 - k * 0.6, 0.08, z + 0.15), 'metal')
    return [m.finish()]


def miniluv():
    """The Ministry of Love: the same Party pyramid as the others, but with no
    windows at all. Fewer, taller terraces of stained grey concrete, ribbed
    like a fortress, a single steel door, searchlight masts on the top."""
    m = Mesh('miniluv')
    base, tiers, th, step = 160, 9, 19, 7.5
    for i in range(tiers):
        W = base - i * step * 2
        z0 = i * th
        for key, (o, right, out, width) in sides(W, W).items():
            o = o + Vector((0, 0, z0))
            wins = []
            if key == 'front' and i == 0:
                wins.append((width / 2 - 3.0, 0.0, width / 2 + 3.0, 6.5, 'metal_dark', 'door'))
            facade(m, o, right, out, width, th, wins, 'concrete_dark', depth=0.6, sills=False, mullions=False, frames=False)
            P = frame_fn(o, right, out)
            n = max(4, int(width / 9))
            for k in range(n + 1):
                u = k * width / n
                obox(m, P, u - 0.9, u + 0.9, 0, th - 1.0, -1.4, 0, 'concrete_grey')
            obox(m, P, -1.0, width + 1.0, th - 1.6, th, -2.0, 0, 'concrete_grey')
        Wn = W - step * 2 if i < tiers - 1 else 0
        z1 = z0 + th
        h, hn = W / 2, Wn / 2
        if Wn > 0:
            for (a, b, c, d) in [((-h, -h), (h, -h), (hn, -hn), (-hn, -hn)), ((h, -h), (h, h), (hn, hn), (hn, -hn)),
                                 ((h, h), (-h, h), (-hn, hn), (hn, hn)), ((-h, h), (-h, -h), (-hn, -hn), (-hn, hn))]:
                m.quad([(*a, z1), (*b, z1), (*c, z1), (*d, z1)], 'concrete_dark')
        else:
            m.box((-h, -h, z1 - 0.01), (h, h, z1), 'concrete_dark', faces={'+z'})
            for x, y in ((-6, -6), (6, -6), (-6, 6), (6, 6)):
                m.cyl((x, y, z1), (x, y, z1 + 14), 0.35, 0.25, 'iron_black', 6)
                m.box((x - 0.8, y - 0.8, z1 + 14), (x + 0.8, y + 0.8, z1 + 15.2), 'iron_black')
    return [m.finish()]


def fence_wire():
    m = Mesh('fence_wire')
    L = 6.0
    for x in (-L / 2, L / 2):
        m.box((x - 0.1, -0.1, 0), (x + 0.1, 0.1, 3.2), 'concrete_dark')
        m.box((x - 0.05, -0.05, 3.2), (x + 0.05, 0.6, 3.25), 'iron_black',
              matrix=Matrix.Translation((0, 0, 0)))
    for k in range(7):
        z = 0.3 + k * 0.42
        m.cyl((-L / 2, 0, z), (L / 2, 0, z + 0.03 * ((k % 2) - 0.5)), 0.012, 0.012, 'iron_black', 4, caps=False)
    # concertina coil on top
    turns = 18
    pts = []
    for i in range(turns * 10 + 1):
        t = i / (turns * 10)
        a = t * turns * math.tau
        pts.append(Vector((-L / 2 + t * L, math.sin(a) * 0.35 + 0.25, 3.5 + math.cos(a) * 0.35)))
    m.tube(pts, 0.012, 'iron_black', 3)
    return [m.finish()]


def guard_tower():
    m = Mesh('guard_tower')
    for sx in (-1.6, 1.6):
        for sy in (-1.6, 1.6):
            m.cyl((sx * 1.1, sy * 1.1, 0), (sx, sy, 8), 0.14, 0.12, 'wood', 6)
    m.box((-2.2, -2.2, 8), (2.2, 2.2, 8.2), 'wood')
    for (a, b) in [((-2.2, -2.2), (2.2, -2.1)), ((-2.2, 2.1), (2.2, 2.2)), ((-2.2, -2.2), (-2.1, 2.2)), ((2.1, -2.2), (2.2, 2.2))]:
        m.box((a[0], a[1], 8.2), (b[0], b[1], 9.3), 'board')
    for sx in (-2.15, 2.15):
        for sy in (-2.15, 2.15):
            m.box((sx - 0.07, sy - 0.07, 9.3), (sx + 0.07, sy + 0.07, 10.6), 'wood')
    m.quad([(-2.6, -2.6, 10.6), (2.6, -2.6, 10.6), (0, 0, 11.6)], 'corrugated')
    m.quad([(2.6, -2.6, 10.6), (2.6, 2.6, 10.6), (0, 0, 11.6)], 'corrugated')
    m.quad([(2.6, 2.6, 10.6), (-2.6, 2.6, 10.6), (0, 0, 11.6)], 'corrugated')
    m.quad([(-2.6, 2.6, 10.6), (-2.6, -2.6, 10.6), (0, 0, 11.6)], 'corrugated')
    m.cyl((0, -2.0, 9.6), (0, -2.6, 9.7), 0.35, 0.4, 'metal_dark', 10)
    m.quad([(-0.38, -2.61, 9.32), (0.38, -2.61, 9.32), (0.38, -2.61, 10.08), (-0.38, -2.61, 10.08)], 'lamp_bulb')
    return [m.finish()]


def sandbag_ring(name='mg_nest', R=2.0):
    m = Mesh(name)
    for layer in range(4):
        n = int(math.tau * R / 0.6)
        for k in range(n):
            a = (k + 0.5 * (layer % 2)) / n * math.tau
            if 0.2 < a < 1.0:
                continue
            c = Vector((math.cos(a) * R, math.sin(a) * R, layer * 0.22 + 0.11))
            M = Matrix.Translation(c) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
            m.box((-0.3, -0.17, -0.11), (0.3, 0.17, 0.11), 'sandbag', matrix=M)
    m.cyl((0, 0.0, 0.0), (0, 0, 0.8), 0.05, 0.05, 'iron_black', 6)
    m.cyl((0, 0.0, 0.85), (0.9, 0.0, 0.95), 0.05, 0.035, 'iron_black', 6)
    m.box((-0.2, -0.12, 0.75), (0.25, 0.12, 0.95), 'metal_dark')
    return [m.finish()]


def column_monument(statue_fn):
    """Victory Square: a fluted column, Big Brother on top, lions at the base."""
    m = Mesh('monument')
    for s in range(3):
        a = 11 - s * 1.2
        m.box((-a, -a, s * 0.35), (a, a, (s + 1) * 0.35), 'stone_dirty')
    m.box((-5, -5, 1.05), (5, 5, 7.0), 'stone_dirty')
    m.box((-5.4, -5.4, 6.8), (5.4, 5.4, 7.4), 'stone_dirty')
    m.box((-3.2, -3.2, 7.4), (3.2, 3.2, 9.6), 'stone_dirty')
    m.cyl((0, 0, 9.6), (0, 0, 46), 2.3, 1.95, 'stone_dirty', 40, flutes=20, flute_depth=0.06)
    m.cyl((0, 0, 9.6), (0, 0, 10.4), 2.8, 2.6, 'stone_dirty', 32)
    m.cyl((0, 0, 46), (0, 0, 47.2), 2.0, 2.8, 'stone_dirty', 32)
    m.box((-3, -3, 47.2), (3, 3, 48.4), 'stone_dirty')
    m.box((-2.2, -2.2, 48.4), (2.2, 2.2, 49.2), 'stone_dirty')
    # spiral poster up the column
    turns, z0, z1, wid = 3.2, 12.0, 34.0, 1.6
    steps = 120
    for i in range(steps):
        t0, t1 = i / steps, (i + 1) / steps
        def pt(t, dz):
            a = t * turns * math.tau
            z = z0 + (z1 - z0) * t + dz
            rr = 2.3 - (2.3 - 1.95) * (z - 9.6) / 36.4 + 0.04
            return (math.cos(a) * rr, math.sin(a) * rr, z)
        u0, u1 = t0 * 24, t1 * 24
        m.quad([pt(t0, 0), pt(t1, 0), pt(t1, wid), pt(t0, wid)], 'poster_spiral',
               uvs=[(u0, 0), (u1, 0), (u1, 1), (u0, 1)])
    # four lions couchant on plinths
    for ang in range(4):
        a = ang * math.pi / 2 + math.pi / 4
        cx, cy = math.cos(a) * 8.6, math.sin(a) * 8.6
        M = Matrix.Translation((cx, cy, 1.05)) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
        m.box((-1.4, -3.0, 0), (1.4, 3.0, 1.4), 'stone_dirty', matrix=M)
        lion(m, M @ Matrix.Translation((0, 0, 1.4)))
    objs = [m.finish()]
    st = statue_fn()
    st.location = (0, 0, 49.2)
    objs.append(st)
    return objs


def lion(m, M):
    def S(c, r, sc):
        m.sphere((0, 0, 0), r, 'stone_statue', 12, 8, sc, matrix=M @ Matrix.Translation(c))
    S((0, 0.6, 0.65), 1.0, (0.85, 1.9, 0.6))
    S((0, -1.4, 1.25), 0.85, (1.0, 0.9, 1.0))
    S((0, -2.1, 1.1), 0.45, (0.8, 1.0, 0.85))
    for sx in (-0.55, 0.55):
        S((sx, -2.1, 0.22), 0.3, (0.8, 2.0, 0.6))


def st_martins():
    m = Mesh('church')
    W, D, H = 22, 40, 16
    for key, (o, right, out, width) in sides(W, D).items():
        wins = []
        if key in ('left', 'right'):
            for k in range(6):
                u = 3 + k * (width - 6) / 5
                wins.append((u - 0.9, 3, u + 0.9, 7.5, 'glass'))
                wins.append((u - 0.9, 9, u + 0.9, 13, 'glass'))
        if key == 'front':
            wins.append((width / 2 - 1.5, 0, width / 2 + 1.5, 5, 'wood_dark', 'door'))
        facade(m, o, right, out, width, H, wins, 'stone_dirty', depth=0.5)
    # eaves only: the 1 cm gables would lie on the sides of the roof slab
    gable_roof(m, -W / 2, W / 2, D, H, 0.01, 'slate', 0.4, None)
    m.box((-W / 2, -D / 2, H), (W / 2, D / 2, H + 0.6), 'slate')
    # portico
    for k in range(6):
        x = -9 + k * 3.6
        m.cyl((x, -D / 2 - 5, 1.2), (x, -D / 2 - 5, 13.5), 0.75, 0.65, 'stone_dirty', 16, flutes=12, flute_depth=0.05)
    for s in range(4):
        m.box((-12 - s * 0.5, -D / 2 - 6.6 - s * 0.5, s * 0.3), (12 + s * 0.5, -D / 2, (s + 1) * 0.3), 'stone_dirty')
    m.box((-11.5, -D / 2 - 6.2, 13.5), (11.5, -D / 2, 15.2), 'stone_dirty')
    y0 = -D / 2 - 6.2
    m.quad([(-11.5, y0, 15.2), (11.5, y0, 15.2), (0, y0, 19.0)], 'stone_dirty')
    m.quad([(11.5, y0, 15.2), (11.5, -D / 2, 15.2), (0, -D / 2, 19.0), (0, y0, 19.0)], 'slate')
    m.quad([(-11.5, -D / 2, 15.2), (-11.5, y0, 15.2), (0, y0, 19.0), (0, -D / 2, 19.0)], 'slate')
    # steeple
    zs = [16.6, 24, 30, 35, 39]
    sizes = [5, 4.2, 3.4, 2.6]
    for i, s in enumerate(sizes):
        m.box((-s / 2, -D / 2 + 2 - s / 2, zs[i]), (s / 2, -D / 2 + 2 + s / 2, zs[i + 1]), 'stone_dirty')
        m.box((-s / 2 - 0.3, -D / 2 + 2 - s / 2 - 0.3, zs[i + 1] - 0.4), (s / 2 + 0.3, -D / 2 + 2 + s / 2 + 0.3, zs[i + 1]), 'stone_dirty')
    m.box((-1.0, -D / 2 + 2 - 2.51, 26), (1.0, -D / 2 + 2 - 2.0, 28.5), 'glass')
    m.cyl((0, -D / 2 + 2, 39), (0, -D / 2 + 2, 52), 1.5, 0.05, 'stone_dirty', 8)
    return [m.finish()]


def station():
    """Paddington: an iron and glass train shed with a platform."""
    m = Mesh('station')
    L, W = 60, 26
    ribs = 11
    for i in range(ribs):
        y = -L / 2 + i * L / (ribs - 1)
        # each rib is one bent tube (16 straight pieces overlapped at the joints)
        m.tube([(math.cos(math.pi * k / 16) * W / 2, y, 6 + math.sin(math.pi * k / 16) * 7) for k in range(17)],
               0.12, 'iron_black', 5)
        for sx in (-W / 2, W / 2):
            # feet 5 cm into the ground, off the platform's underside
            m.cyl((sx, y, -0.05), (sx, y, 6), 0.22, 0.22, 'iron_black', 8)
    for k in range(16):
        a0, a1 = math.pi * k / 16, math.pi * (k + 1) / 16
        p0 = (math.cos(a0) * W / 2, math.sin(a0) * 7 + 6)
        p1 = (math.cos(a1) * W / 2, math.sin(a1) * 7 + 6)
        mat = 'glass' if 4 <= k <= 11 else 'corrugated'
        m.quad([(p0[0], -L / 2, p0[1]), (p0[0], L / 2, p0[1]), (p1[0], L / 2, p1[1]), (p1[0], -L / 2, p1[1])], mat)
    # platforms and track bed
    m.box((-W / 2, -L / 2 - 4, 0), (-3, L / 2, 1.0), 'concrete_grey')
    m.box((3.5, -L / 2 - 4, 0), (W / 2, L / 2, 1.0), 'concrete_grey')
    for x in (-1.5, 1.5):
        for rail in (-0.72, 0.72):
            m.box((x * 0 + rail - 0.04, -L / 2 - 4, 0.15), (rail + 0.04, L / 2, 0.3), 'metal')
    for k in range(40):
        y = -L / 2 - 4 + k * 1.6
        m.box((-1.4, y, 0.0), (1.4, y + 0.3, 0.15), 'wood_dark')
    # facade with clock
    m.box((-W / 2 - 2, -L / 2 - 6, 0), (W / 2 + 2, -L / 2 - 4, 14), 'brick')
    m.cyl((0, -L / 2 - 6.05, 10.5), (0, -L / 2 - 6.25, 10.5), 1.4, 1.4, 'paper', 24)
    # doors 10 cm proud of the brickwork (the box ran through the wall and its
    # back showed through the brick inside the shed)
    m.box((-2.5, -L / 2 - 6.1, 0), (2.5, -L / 2 - 5.9, 4), 'wood_dark', faces={'-y', '-x', '+x', '+z'})
    m.quad([(-5, -L / 2 - 6.3, 6.5), (5, -L / 2 - 6.3, 6.5), (5, -L / 2 - 6.3, 7.6), (-5, -L / 2 - 6.3, 7.6)],
           'sign', uv_rect=(0, 0, 1, 1))
    return [m.finish()]


def community_centre():
    objs = party_block('community_centre', 34, 18, 2, 4.0, seed=21, cols=8, side_cols=4, ww=2.0, wh=2.6)
    return objs


def cafe():
    m = Mesh('cafe')
    W, D, H = 12, 10, 4.2
    for key, (o, right, out, width) in sides(W, D).items():
        wins = []
        if key == 'front':
            wins = [(0.6, 0.6, 4.6, 3.2, 'glass_lit'), (5.2, 0, 6.8, 2.8, 'glass', 'door'), (7.4, 0.6, 11.4, 3.2, 'glass_lit')]
        facade(m, o, right, out, width, H, wins, 'plaster', depth=0.2, frame='wood_dark')
        P = frame_fn(o, right, out)
        if key == 'front':
            m.quad([P(1, 3.45, -0.06), P(11, 3.45, -0.06), P(11, 4.05, -0.06), P(1, 4.05, -0.06)], 'sign', uv_rect=(0, 0, 1, 1))
    gable_roof(m, -W / 2, W / 2, D, H, 2.2, 'slate', 0.3, 'plaster')
    m.quad([(-W / 2, -D / 2, 3.35), (W / 2, -D / 2, 3.35), (W / 2, -D / 2 - 1.6, 2.7), (-W / 2, -D / 2 - 1.6, 2.7)], 'canvas')
    m.quad([(-W / 2, -D / 2 - 1.6, 2.7), (W / 2, -D / 2 - 1.6, 2.7), (W / 2, -D / 2, 3.35), (-W / 2, -D / 2, 3.35)], 'canvas')
    return [m.finish()]


def inner_party_house():
    """A cleaner, taller block for the Inner Party quarter."""
    return party_block('inner_block', 24, 16, 5, 3.4, seed=31, wall='concrete_white', cols=6, side_cols=4,
                       ww=1.6, wh=2.0, mix=[('glass', 0.55), ('glass_lit', 0.45)])
