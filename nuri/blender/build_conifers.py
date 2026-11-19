"""Game-ready conifers built in Blender from Poly Haven's scanned fir twig atlas + pine bark (CC0).
Trunk: tapered generalized cylinder with root flare, bark UVs in metres. Crown: whorls of drooping branches,
each carrying alpha-tested twig cards (sprites detected automatically from the atlas alpha), plus dead stubs.
Variants: tall pines (high crown), firs (conical), and understory saplings. LOD0 + LOD1.
usage: python build_conifers.py <polyhaven_dl_dir> <out_dir>"""
import sys, os, math, random, json
from sdf_roots import RootField, plan_roots
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, Euler, noise
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- twig sprites from the alpha atlas
def find_sprites(alpha_path, size=512):
    a = np.asarray(Image.open(alpha_path).convert('L').resize((size, size))) > 110
    lab = np.zeros(a.shape, np.int32); n = 0; boxes = []
    for y in range(size):
        for x in range(size):
            if a[y, x] and not lab[y, x]:
                n += 1; stack = [(y, x)]; lab[y, x] = n; ys, xs = [], []
                while stack:
                    cy, cx = stack.pop(); ys.append(cy); xs.append(cx)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = cy + dy, cx + dx
                        if 0 <= yy < size and 0 <= xx < size and a[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; stack.append((yy, xx))
                x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
                area = len(xs)
                if area < 300 or x0 <= 2 or y0 <= 2 or x1 >= size - 3 or y1 >= size * 0.86: continue
                if (x1 - x0) > size * 0.45 or (y1 - y0) < size * 0.06: continue
                boxes.append((x0 / size, y0 / size, (x1 + 1) / size, (y1 + 1) / size, area))
    boxes.sort(key=lambda b: -b[4])
    return boxes

SPRITES = find_sprites(f'{SRC}/tex/fir_tree_01/twig_alpha_2k.jpg')
print('twig sprites:', len(SPRITES), [tuple(round(v, 2) for v in b[:4]) for b in SPRITES])
BIG = [s for s in SPRITES if (s[3] - s[1]) > 0.2] or SPRITES
SMALL = [s for s in SPRITES if s not in BIG] or SPRITES

# ---------------------------------------------------------------- mesh builders
class MB:
    def __init__(self): self.v, self.uv, self.f = [], [], []
    def quad(self, a, b, c, d, uvs):
        i = len(self.v); self.v += [a, b, c, d]; self.uv += uvs; self.f.append((i, i + 1, i + 2, i + 3))
    def obj(self, name, mat):
        me = bpy.data.meshes.new(name); me.from_pydata([tuple(p) for p in self.v], [], self.f)
        ul = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices: ul.data[li].uv = self.uv[me.loops[li].vertex_index]
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons)); me.update()
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(bpy.data.materials.get(mat) or bpy.data.materials.new(mat))
        return ob

def tube(mb_v, mb_f, mb_uv, spine, rfn, radial, tile=1.2, v0=0.0, ku=None):
    """append a generalized cylinder to raw lists; UVs in metres / tile"""
    n = len(spine)
    tang = [(spine[min(n - 1, i + 1)] - spine[max(0, i - 1)]).normalized() for i in range(n)]
    up = Vector((1, 0, 0)) if abs(tang[0].z) > 0.9 else Vector((0, 0, 1))
    nrm = tang[0].cross(up).normalized(); frames = []
    for i in range(n):
        if i:
            ax = tang[i - 1].cross(tang[i])
            if ax.length > 1e-6: nrm = (Matrix.Rotation(tang[i - 1].angle(tang[i]), 3, ax.normalized()) @ nrm).normalized()
        frames.append((nrm.copy(), tang[i].cross(nrm).normalized()))
    base = len(mb_v); L = 0.0
    r0 = rfn(0, 0); k = ku or max(1, round(2 * math.pi * r0 / tile))
    for i in range(n):
        if i: L += (spine[i] - spine[i - 1]).length
        t = i / (n - 1); N_, Bn = frames[i]
        for j in range(radial + 1):
            th = j / radial * 2 * math.pi
            mb_v.append(spine[i] + (N_ * math.cos(th) + Bn * math.sin(th)) * rfn(t, th))
            if ku is not None and j == 0:
                q0 = N_ * rfn(t, 0.0)
                un = ((math.atan2(q0.y, q0.x) - math.pi / 2) % (2 * math.pi)) / (2 * math.pi) * k
                if i: un += round((uprev - un) / k) * k      # stay continuous from ring to ring (no wrap jumps)
                uoff = uprev = un
            mb_uv.append(((uoff if ku is not None else 0.0) + j / radial * k, v0 + L / tile))
    for i in range(n - 1):
        for j in range(radial):
            a = base + i * (radial + 1) + j
            mb_f.append((a, a + 1, a + radial + 2, a + radial + 1))

def twig_card(mb, base, direction, side_hint, length, sprite, droop=0.15, fold=0.35, rnd=None):
    """V-folded card: sprite stem at base, tip along `direction`."""
    x0, y0, x1, y1 = sprite[:4]
    aspect = (x1 - x0) / max(1e-6, (y1 - y0))
    w = length * aspect
    d = direction.normalized()
    s = d.cross(side_hint); s = s.normalized() if s.length > 1e-6 else Vector((1, 0, 0))
    up = s.cross(d).normalized()
    tip = base + d * length - up * droop * length
    mid_b, mid_t = base, tip
    # uv: v=1 top of image (glTF flips later); stem at bottom of sprite
    u0, u1, uc = x0, x1, (x0 + x1) / 2
    vb, vt = 1 - y1, 1 - y0
    lift = up * fold * w * 0.5
    lb = base - s * w * 0.5 + lift; rb = base + s * w * 0.5 + lift
    lt = tip - s * w * 0.5 + lift; rt = tip + s * w * 0.5 + lift
    mb.quad(lb, mid_b, mid_t, lt, [(u0, vb), (uc, vb), (uc, vt), (u0, vt)])
    mb.quad(mid_b, rb, rt, mid_t, [(uc, vb), (u1, vb), (u1, vt), (uc, vt)])

R0_LAST = [0.0]
def make_conifer(name, kind, seed, lod=0, opt=None):
    opt = opt or {}
    rnd = random.Random(seed)
    if kind == 'pine':
        H = rnd.uniform(16, 24); R0 = rnd.uniform(0.26, 0.46); crown0 = rnd.uniform(0.55, 0.7)
        H = opt.get('H', H); R0 = opt.get('R0', R0); crown0 = opt.get('crown0', crown0)
    elif kind == 'snag':
        H = rnd.uniform(7, 13); R0 = rnd.uniform(0.24, 0.34); crown0 = 2.0
    elif kind == 'fir':
        H = rnd.uniform(10, 14); R0 = rnd.uniform(0.22, 0.32); crown0 = rnd.uniform(0.24, 0.32)   # lower branches shed in a stand
    else:  # sapling
        H = rnd.uniform(0.9, 2.6); R0 = H * 0.012 + 0.008; crown0 = 0.02
    rings = [56, 24][lod] if kind != 'sapling' else [10, 6][lod]
    radial = [24, 12][lod] if kind != 'sapling' else 6
    # real stems are never plumb lines: a lean (up to ~2.5 deg), a butt sweep near the ground that bends back
    # toward vertical, and small kinks along the bole
    la = rnd.uniform(0, 6.28)
    lean = Vector((math.cos(la), math.sin(la), 0)) * (rnd.uniform(0.01, 0.045) * H if kind != 'sapling' else 0.012 * H)
    sweep = -lean.normalized() * (rnd.uniform(0.05, 0.16) if kind in ('pine', 'snag') else 0.03) if kind != 'sapling' else Vector()
    curve = opt.get('curve', rnd.uniform(0.04, 0.14)); cph = rnd.uniform(0, 6.28)
    perp = Vector((-lean.y, lean.x, 0)).normalized() if lean.length > 1e-6 else Vector((1, 0, 0))
    perp = (perp + lean.normalized() * rnd.uniform(-0.6, 0.6)).normalized()
    oval, ovph = rnd.uniform(0.03, 0.08), rnd.uniform(0, 3.14)
    spine = []
    for i in range(rings):
        t = (i / (rings - 1)) ** 1.25
        z = t * H
        kink = 0.03 + 0.004 * z if kind != 'sapling' else 0.01 * H
        wob = Vector((noise.noise(Vector((t * 5.0, seed, 0))), noise.noise(Vector((0, t * 5.0, seed))), 0)) * kink
        # slender stems wander more: a slow S-bend grown in toward the light
        bend = perp * (curve * math.sin(math.pi * t * 1.4 + cph) * min(1.0, z / 3.0)) if kind in ('pine', 'snag') else Vector()
        spine.append(Vector((0, 0, z - (0.3 if kind != 'sapling' else 0.02))) + lean * t ** 1.5 + sweep * (1 - math.exp(-z / 1.6)) + wob + bend)
    nb = rnd.randint(5, 7); ths = [i / nb * 2 * math.pi + rnd.uniform(-0.3, 0.3) for i in range(nb)]
    def rfn(t, th):
        z = t * H
        if kind == 'pine':  # slow taper along the clear bole, faster inside the crown
            r = R0 * ((1 - 0.42 * t) if t < crown0 else (1 - 0.42 * crown0) * (1 - 0.92 * ((t - crown0) / (1 - crown0)) ** 0.85))
        else:
            r = R0 * (1 - (0.45 if kind == 'snag' else 0.88) * t ** 0.9)
        if kind == 'snag' and t > 0.97: r *= 0.6 + 0.4 * abs(math.sin(th * 3 + seed))  # splintered break
        if kind != 'sapling':
            fl = math.exp(-z / 0.7)
            b = sum(max(0.0, math.cos(th - a)) ** 8 for a in ths)
            r *= 1 + fl * ((0.16 + 0.22 * b) if kind != 'sapling' else (0.45 + 0.9 * b))   # the SDF roots make the real flare
            # not a lathe: slightly oval, with long vertical bark ridges and fissures breaking the silhouette
            r *= 1 + oval * math.cos(2 * (th - ovph))
            r *= 1 + 0.045 * noise.noise(Vector((math.cos(th) * 3.2, math.sin(th) * 3.2, z * 0.3 + seed))) \
                   + 0.022 * noise.noise(Vector((math.cos(th) * 8.0, math.sin(th) * 8.0, z * 0.7 + seed * 2)))
        return max(r, 0.004)
    bv, bf, buv = [], [], []
    has_roots = kind != 'sapling'
    tlin = lambda z: min(1.0, max(0.0, (z + 0.3) / H)) ** 0.8          # ring parameter rfn sees at height z
    if not has_roots:
        tube(bv, bf, buv, spine, rfn, radial)
    else:
        ku = max(1, round(2 * math.pi * rfn(tlin(1.0), 0) / 1.2))
        tube(bv, bf, buv, spine, rfn, radial, ku=ku)
    # fused stem base + root system (signed distance field, marching cubes): see sdf_roots.py
    roots_out = []; base_obj = None; base_tints = []; base_w = []
    if has_roots:
        rr_ = random.Random(seed * 31 + 5)
        plan = plan_roots(rr_, R0, ths, kind, lod == 0)
        ext = R0 * 6.4 + 0.12
        vox = max(0.008, R0 * 0.045) * (1.0 if lod == 0 else 1.7)
        ztop = R0 * 2.4 + 0.2          # roots and their fillets live below this
        F = RootField(ext, -0.26, ztop, vox)
        zs = [p.z for p in spine]
        def centre_at(z):
            for k in range(len(spine) - 1):
                if zs[k + 1] >= z: f = (z - zs[k]) / max(1e-6, zs[k + 1] - zs[k]); p = spine[k].lerp(spine[k + 1], max(0, min(1, f))); return (p.x, p.y)
            return (spine[-1].x, spine[-1].y)
        TH = np.linspace(-math.pi, math.pi, 181)
        def radius_at(z, th):
            t = tlin(max(z, -0.29))
            tab = np.array([rfn(t, a - math.pi / 2) for a in TH])
            return np.interp(th, TH, tab)
        F.stem(centre_at, radius_at, 0.04 * R0)
        for r in plan:
            k = {'buttress': 0.26 * R0, 'surface': 0.08 * R0, 'lateral': 0.03 * R0}[r['type']]
            F.capsule_chain(r['pts'], r['rads'], r['flat'], k)
            roots_out.append([[round(p[0], 3), round(p[2], 3), round(-p[1], 3), round(rd * fl, 3)] for p, rd, fl in zip(r['pts'], r['rads'], r['flat'])])
        V, Fc = F.mesh()
        # distance of every vertex from the analytic stem surface (oval section, ridges, flare lobes)
        cxy = np.array([centre_at(float(z)) for z in np.clip(V[:, 2], -0.29, None)])
        dxv, dyv = V[:, 0] - cxy[:, 0], V[:, 1] - cxy[:, 1]
        radv = np.hypot(dxv, dyv); angv = np.arctan2(dyv, dxv)
        rtv = np.zeros(len(V))
        for zk in np.unique(np.round(V[:, 2], 2)):
            m = np.round(V[:, 2], 2) == zk
            rtv[m] = radius_at(max(float(zk), -0.29), angv[m])
        off = radv - rtv
        on_stem = off < 0.6 * vox
        top = V[:, 2] > ztop - 2.5 * vox
        keep = [f for f in Fc if not (on_stem[f[0]] and on_stem[f[1]] and on_stem[f[2]]) and not (top[f[0]] or top[f[1]] or top[f[2]])
                and max(V[f[0], 2], V[f[1], 2], V[f[2], 2]) > -0.07]
        # the fillet edge settles exactly onto the stem surface, so roots grow out of the bark tangentially
        for i in set(i for f in keep for i in f):
            if off[i] < 1.2 * vox:
                k = min(1.0, max(0.0, off[i] / (1.2 * vox)))
                rn = rtv[i] + max(0.0, off[i]) * k
                V[i, 0] = cxy[i, 0] + math.cos(angv[i]) * rn; V[i, 1] = cxy[i, 1] + math.sin(angv[i]) * rn
        bm_ = bpy.data.meshes.new(f'{name}_base'); bm_.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in keep]); bm_.update()
        base_obj = bpy.data.objects.new(f'{name}_base', bm_); bpy.context.scene.collection.objects.link(base_obj)
        bpy.context.view_layer.objects.active = base_obj; base_obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.delete_loose(); bpy.ops.mesh.remove_doubles(threshold=vox * 0.05)
        bpy.ops.object.mode_set(mode='OBJECT')
        target = (5000 + 9000 * R0) if lod == 0 else (1100 + 2600 * R0)
        if len(base_obj.data.polygons) > target:
            m_ = base_obj.modifiers.new('dc', 'DECIMATE'); m_.ratio = target / len(base_obj.data.polygons)
            bpy.ops.object.modifier_apply(modifier='dc')
        base_obj.select_set(False)
        me_ = base_obj.data
        for pgn in me_.polygons: pgn.use_smooth = True
        # bark UVs continuous with the trunk: u around the stem (scaled by distance so roots keep texel density),
        # v up the stem and then out along each root, so bark fissures run down the stem and along the roots
        ul = me_.uv_layers.new(name='UVMap')
        # the stem radius at this height *in this direction* (oval section, flare lobes), so on the stem surface the
        # mapping is exactly the trunk tube's: u from the true angle, v from the height
        cache = {}
        def rz(z, phi):
            key = round(z, 2)
            if key not in cache: cache[key] = (np.linspace(-math.pi, math.pi, 181), radius_at(z, np.linspace(-math.pi, math.pi, 181)))
            ths_, rs_ = cache[key]
            return float(np.interp((phi + math.pi) % (2 * math.pi) - math.pi, ths_, rs_))
        for pgn in me_.polygons:
            us, vs = [], []
            for li in pgn.loop_indices:
                co = me_.vertices[me_.loops[li].vertex_index].co
                cx, cy = centre_at(max(co.z, -0.29)); dx, dy = co.x - cx, co.y - cy
                rad = math.hypot(dx, dy); ang = math.atan2(dy, dx); phi = ang - math.pi / 2
                rt = rz(max(co.z, -0.29), ang)
                us.append((phi % (2 * math.pi)) / (2 * math.pi) * ku * max(1.0, rad / max(rt, 1e-3)))
                vs.append((co.z + 0.3 - max(0.0, rad - rt)) / 1.2)   # keeps running down the stem and out along the root
            if max(us) - min(us) > ku * 0.5:
                us = [u + ku if u < ku * 0.5 else u for u in us]
            for li, u, v in zip(pgn.loop_indices, us, vs): ul.data[li].uv = (u, v)
        # second UV set that follows each root (v along its length, u around it) + per-vertex blend weight:
        # the game samples the bark with both and blends by weight, so roots never show a stretched stem mapping
        segs = []   # (a, b, ra, rb, s0) over all roots
        for r in plan:
            acc = 0.0
            for k in range(len(r['pts']) - 1):
                a_, b_ = np.array(r['pts'][k]), np.array(r['pts'][k + 1]); L_ = float(np.linalg.norm(b_ - a_))
                segs.append((a_, b_, r['rads'][k] * r['flat'][k], r['rads'][k + 1] * r['flat'][k + 1], acc, len(segs) and r is not None)); acc += L_
        SA = np.array([q[0] for q in segs]); SB = np.array([q[1] for q in segs]); RA = np.array([q[2] for q in segs]); RB = np.array([q[3] for q in segs]); S0 = np.array([q[4] for q in segs])
        P = np.array([tuple(v.co) for v in me_.vertices])
        AB = SB - SA; L2 = np.maximum((AB * AB).sum(1), 1e-9)
        best_d = np.full(len(P), 1e9); best = np.zeros(len(P), int); best_t = np.zeros(len(P))
        for k in range(len(segs)):
            t = np.clip(((P - SA[k]) @ AB[k]) / L2[k], 0, 1)
            q = P - (SA[k] + np.outer(t, AB[k]))
            d = np.sqrt((q * q).sum(1)) - (RA[k] + (RB[k] - RA[k]) * t)
            m = d < best_d; best_d[m] = d[m]; best[m] = k; best_t[m] = t[m]
        ruv = me_.uv_layers.new(name='RootUV')
        vu = np.zeros(len(P)); vv = np.zeros(len(P)); vr = np.zeros(len(P))
        for i in range(len(P)):
            k = best[i]; t = best_t[i]; dvec = AB[k] / math.sqrt(L2[k])
            c = SA[k] + AB[k] * t
            side = np.cross(dvec, [0, 0, 1.0]); n_ = np.linalg.norm(side); side = side / n_ if n_ > 1e-6 else np.array([1.0, 0, 0])
            upv = np.cross(side, dvec)
            q = P[i] - c; psi = math.atan2(float(q @ side), float(q @ upv))
            rl = RA[k] + (RB[k] - RA[k]) * t
            vr[i] = max(rl, 0.01); vu[i] = psi * vr[i] / 1.2; vv[i] = (S0[k] + t * math.sqrt(L2[k])) / 1.2
        for pgn in me_.polygons:
            idx = [me_.loops[li].vertex_index for li in pgn.loop_indices]
            us_ = [vu[i] for i in idx]
            if max(us_) - min(us_) > math.pi * max(vr[i] for i in idx) / 1.2:      # wrap seam on the underside
                us_ = [u + (2 * math.pi * vr[i] / 1.2 if u < 0 else 0) for u, i in zip(us_, idx)]
            for li, i, u in zip(pgn.loop_indices, idx, us_): ruv.data[li].uv = (u, vv[i])
        # weight: 0 on the stem surface, 1 once clearly on a root
        base_w = []
        for v in me_.vertices:
            cx, cy = centre_at(max(v.co.z, -0.29)); dx, dy = v.co.x - cx, v.co.y - cy
            o = math.hypot(dx, dy) - rz(max(v.co.z, -0.29), math.atan2(dy, dx))
            base_w.append(min(1.0, max(0.0, (o - 0.012) / (0.06 + 0.15 * R0))))
    n_trunk = len(bv)
    cards = MB()
    def trunk_at(h):
        t = min(1, max(0, (h + 0.3) / H)); i = t * (rings - 1); i0 = int(min(rings - 2, i)); f = i - i0
        return spine[i0].lerp(spine[i0 + 1], f), rfn(t, 0)
    # self-pruned lower bole: whorls of dead branches (longer and more complete toward the crown, broken to
    # stubs and knots lower down) with bare side twigs; every LOD keeps them, they are what the eye reads
    if kind in ('pine', 'snag', 'fir'):
        # as in a real stand: the lower bole is nearly clean (a few knots and short snapped stubs); dead branches
        # gather in the zone below the living crown, droop, and carry a clutter of fine dead twigs
        z = rnd.uniform(0.9, 1.6); top = min(crown0, 0.95) * H
        while z < top:
            u = z / top
            if rnd.random() < 0.2 + 0.8 * u * u:
                p, r = trunk_at(z)
                nw = rnd.randint(1, 2) if u < 0.5 else rnd.randint(2, 4)
                a0 = rnd.uniform(0, 6.28)
                for k in range(nw):
                    a = a0 + k / nw * 6.28 + rnd.uniform(-0.6, 0.6)
                    stub = u < 0.45 or rnd.random() > 0.15 + 0.85 * (u - 0.45) / 0.55
                    if stub:
                        L = rnd.uniform(0.02, 0.1) if u < 0.45 else rnd.uniform(0.06, 0.25)
                        d = Vector((math.cos(a), math.sin(a), rnd.uniform(-0.05, 0.25))).normalized()
                        br = rnd.uniform(0.012, 0.022)
                        pts = [p + d * (r * 0.85 + L * s) for s in (0, 0.5, 1)]
                        tube(bv, bf, buv, pts, lambda t, th, br=br: br * (1 - 0.4 * t), 5 if lod == 0 else 4, tile=0.5)
                        continue
                    L = rnd.uniform(0.35, 0.6) + 1.3 * (u - 0.45) / 0.55 * rnd.uniform(0.6, 1.0)
                    d = Vector((math.cos(a), math.sin(a), rnd.uniform(-0.45, 0.05))).normalized()
                    br = rnd.uniform(0.011, 0.02) + 0.01 * u
                    seg = 4 if lod == 0 else 3
                    side0 = d.cross(Vector((0, 0, 1))).normalized()
                    pts = []
                    for si in range(seg + 1):
                        f = si / seg
                        jit = side0 * (rnd.uniform(-0.04, 0.04) * L * f) + Vector((0, 0, rnd.uniform(-0.03, 0.03) * L * f))
                        pts.append(p + d * (r * 0.85 + L * f) - Vector((0, 0, 0.28 * L * f * f)) + jit)
                    tube(bv, bf, buv, pts, lambda t, th, br=br: br * (1 - 0.85 * t), 5 if lod == 0 else 4, tile=0.5)
                    for tw in range(rnd.randint(4, 9) if lod == 0 else rnd.randint(1, 3)):
                        f = rnd.uniform(0.25, 0.95); i0 = min(seg - 1, int(f * seg)); bp = pts[i0].lerp(pts[i0 + 1], f * seg - i0)
                        side = side0 * (1 if tw % 2 else -1)
                        td = (d * 0.5 + side * 0.8 + Vector((0, 0, rnd.uniform(-0.6, 0.15)))).normalized()
                        tl = rnd.uniform(0.1, 0.35) * (1.2 - f * 0.6)
                        tube(bv, bf, buv, [bp, bp + td * tl * 0.5 + Vector((0, 0, rnd.uniform(-0.02, 0.02))), bp + td * tl - Vector((0, 0, 0.08 * tl))],
                             lambda t, th, tr=br * 0.35: max(0.0025, tr * (1 - 0.8 * t)), 3, tile=0.4)
            z += rnd.uniform(0.35, 0.75)
    # living crown: whorls
    z = crown0 * H
    step = 0.55 if kind != 'sapling' else 0.16 * H / 1.5
    while z < H * 0.97:
        t = z / H
        p, r = trunk_at(z)
        nwh = rnd.randint(4, 6) if kind != 'sapling' else rnd.randint(3, 5)
        if kind == 'pine': L = (0.6 + 2.4 * math.sin(math.pi * min(1, (t - crown0) / (1 - crown0) * 0.9 + 0.1))) * rnd.uniform(0.8, 1.1)
        else: L = (1 - t) * (0.3 * H if kind == 'fir' else 0.45 * H) + 0.1 * H * 0.1
        rot0 = rnd.uniform(0, 6.28)
        for k in range(nwh):
            a = rot0 + k / nwh * 2 * math.pi + rnd.uniform(-0.25, 0.25)
            up_ang = (0.12 if kind == 'pine' else -0.05) + rnd.uniform(-0.1, 0.1)
            d = Vector((math.cos(a), math.sin(a), up_ang)).normalized()
            seg = 7 if lod == 0 else 4
            pts = []
            for s in range(seg + 1):
                u = s / seg
                if kind == 'pine': droop = 0.12 * L * u * u
                else:   # spruce/fir: the branch sags from its own weight and turns up again toward the tip
                    droop = 0.26 * L * u ** 1.5 - 0.13 * L * u ** 4
                side = d.cross(Vector((0, 0, 1))).normalized() * (0.04 * L * math.sin(u * 3.0 + k) * u)
                pts.append(p + d * (r * 0.7 + L * u) - Vector((0, 0, droop)) + side)
            br = max(0.006, (0.04 if kind == 'pine' else 0.022) * (L / 2.5) + (0 if kind == 'pine' else 0.005)) if kind != 'sapling' else 0.004 + 0.006 * L
            if lod == 0 or kind != 'sapling':
                tube(bv, bf, buv, pts, lambda tt, th, br=br: br * (1 - 0.85 * tt), 6 if lod == 0 else 5)
            # twig cards along the branch (denser toward the tip), alternating sides
            ncard = max(2, int(L * (10.5 if lod == 0 else 6.0) * (1.0 if kind == 'pine' else 1.35 if kind == 'fir' else 2.2)))
            for c in range(ncard):
                u = 0.15 + 0.85 * (c + rnd.random() * 0.5) / ncard
                i0 = min(seg - 1, int(u * seg)); f = u * seg - i0
                bp = pts[i0].lerp(pts[i0 + 1], f)
                bd = (pts[i0 + 1] - pts[i0]).normalized()
                side = 1 if c % 2 else -1
                sd = bd.cross(Vector((0, 0, 1))).normalized() * side
                dirc = (bd * 0.55 + sd * 0.8 + Vector((0, 0, rnd.uniform(-0.1, 0.25)))).normalized()
                clen = (0.4 + 0.55 * rnd.random()) * (0.55 if kind == 'sapling' else 1.0) * min(1.3, 0.55 + L * 0.38)
                twig_card(cards, bp, dirc, Vector((0, 0, 1)), clen, rnd.choice(BIG if clen > 0.4 else SMALL), droop=0.18, fold=0.35, rnd=rnd)
            # tip card continues the branch
            twig_card(cards, pts[-1], d + Vector((0, 0, 0.05)), Vector((0, 0, 1)), 0.45 * (0.6 if kind == 'sapling' else 1), rnd.choice(BIG), droop=0.2, rnd=rnd)
        z += step * rnd.uniform(0.8, 1.2)
    # leader at the top
    top = spine[-1]
    twig_card(cards, top - Vector((0, 0, 0.3 if kind != 'sapling' else 0.08)), Vector((0.05, 0.02, 1)), Vector((1, 0, 0)), 0.8 if kind != 'sapling' else 0.25, rnd.choice(BIG), droop=0.02)
    R0_LAST[0] = R0
    bark = MB(); bark.v, bark.f, bark.uv = bv, bf, buv
    bo = bark.obj(f'{name}_bark', 'BarkSnag' if kind == 'snag' else 'Bark')
    if base_obj is not None: bo.data.uv_layers.new(name='RootUV')
    if roots_out: bo['roots'] = json.dumps(roots_out)
    n_bark = len(bo.data.vertices)
    if base_obj is not None:
        bpy.ops.object.select_all(action='DESELECT'); bo.select_set(True); base_obj.select_set(True)
        bpy.context.view_layer.objects.active = bo; bpy.ops.object.join()
    # bark colour by position (multiplies the scanned bark): pines have thick dark grey-brown plates low on the
    # stem and thin orange flaking bark higher up; dead and living branches are weathered grey; snags bleached
    base_t = rnd.choice([(0.86, 0.84, 0.82), (0.8, 0.76, 0.72), (0.9, 0.88, 0.88), (0.76, 0.72, 0.68)])
    def tint(i, co):
        if kind == 'snag': return (0.92, 0.9, 0.88)
        if i >= n_trunk: return (0.95, 0.94, 0.93)     # dead branches: weathered silver-grey
        k = min(1.0, max(0.0, co.z / 2.5))               # the base is darker (soil splash, damp)
        n = 1 + 0.08 * noise.noise(Vector((co.x * 1.3, co.y * 1.3, co.z * 0.4 + seed)))
        return tuple(base_t[c] * (0.78 + 0.22 * k) * n for c in range(3))
    bo['tints'] = [c for i, v in enumerate(bo.data.vertices) for c in tint(i if i < n_bark else 0, v.co)]
    bo['rootw'] = [0.0] * n_bark + (base_w if base_obj is not None else [])
    if kind == 'snag':
        return bo, None, H
    co = cards.obj(f'{name}_twigs', 'Twig')
    zs = [v.co.z for v in co.data.vertices]
    zmid = (min(zs) + max(zs)) / 2 if zs else H * 0.7
    nrm = []
    for v in co.data.vertices:
        d = Vector((v.co.x, v.co.y, (v.co.z - zmid) * 0.55))
        if d.length < 1e-4: d = Vector((0, 0, 1))
        nrm.append((d.normalized() + Vector((0, 0, 0.35))).normalized())
    co.data.normals_split_custom_set_from_vertices(nrm)
    return bo, co, H

def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_yup=True, export_normals=True,
                              export_vertex_color='ACTIVE', export_extras=True)

def bake_ao(ob):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
    sc.world = bpy.data.worlds.new('W')
    try: sc.world.light_settings.distance = 1.0
    except Exception: pass
    ca = ob.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); ob.data.color_attributes.active_color = ca
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

# girth classes as in a real stand: dominant, co-dominant, intermediate and a slender suppressed pole
SPECS = [('pine', 11, {'R0': 0.44, 'H': 23}), ('pine', 22, {'R0': 0.31, 'H': 21}), ('pine', 33, {'R0': 0.21, 'H': 18, 'curve': 0.32, 'crown0': 0.66}),
         ('pine', 44, {'R0': 0.13, 'H': 15, 'curve': 0.5, 'crown0': 0.72}), ('fir', 55, {}), ('fir', 66, {}),
         ('sapling', 77, {}), ('sapling', 88, {}), ('sapling', 99, {}), ('snag', 111, {}), ('snag', 122, {})]
ONLY = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
for i, (kind, seed, opt) in enumerate(SPECS):
    if ONLY is not None and i not in ONLY: continue
    for lod in ((0, 1) if kind != 'sapling' else (0,)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        try: bpy.ops.preferences.addon_enable(module='cycles')
        except Exception: pass
        b, c, H = make_conifer(f'{kind}{i}', kind, seed, lod, opt)
        if lod == 0: bake_ao(b)
        # vertex colour = baked AO x bark tint (LOD1 / saplings: tint only)
        me = b.data; tints = list(b['tints']); rootw = list(b['rootw'])
        ca = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
        me.color_attributes.active_color = ca
        for li, loop in enumerate(me.loops):
            vi = loop.vertex_index; ao = ca.data[li].color[0] if lod == 0 else 1.0
            f = 1.0 - 0.6 * (1.0 - ao)   # AO goes into the albedo at partial strength (the game multiplies vertex colour)
            ca.data[li].color = (f * tints[vi * 3], f * tints[vi * 3 + 1], f * tints[vi * 3 + 2], 1)
        # root blend weight goes to a third UV set (glTF drops vertex colour alpha)
        if 'RootUV' in me.uv_layers:
            wl = me.uv_layers.new(name='RootW')
            for li, loop in enumerate(me.loops): wl.data[li].uv = (rootw[loop.vertex_index] if loop.vertex_index < len(rootw) else 0.0, 0.0)
        del b['tints']; del b['rootw']
        if b.get('roots') is None and 'roots' in b: del b['roots']
        path = f'{OUT}/{kind}_{i}{"_lod1" if lod else ""}.glb'
        export([b] + ([c] if c else []), path)
        b.data.calc_loop_triangles()
        if c: c.data.calc_loop_triangles()
        print('TREE', os.path.basename(path), 'H=%.1f' % H, 'R0=%.3f' % R0_LAST[0], 'bark', len(b.data.loop_triangles), 'cards', len(c.data.loop_triangles) if c else 0, round(os.path.getsize(path) / 1e6, 2), 'MB')
