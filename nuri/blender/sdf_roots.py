"""Root systems for the conifers as one continuous surface.

The trunk base and every root are signed-distance primitives (a lathe for the stem with its flare lobes, tapered and
flattened capsule chains for roots), combined with a smooth minimum so the stem flows into its roots and roots into
each other with natural fillets instead of tubes stuck into a cylinder. The field is polygonised with marching cubes.

Root types (as seen on forest pines and spruces):
  * buttress  - from each flare lobe: a tall wedge that drops quickly and runs on as a surface root
  * surface   - meandering, half-sunk, forking roots that ride the ground and dive away
  * arch      - a surface root that lifts clear of the soil for a short span and goes back in
  * lateral   - thin side roots off the larger ones, mostly buried, showing in places
"""
import math, random
import numpy as np
from skimage import measure

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)

class RootField:
    def __init__(self, extent, z0, z1, vox):
        self.vox = vox
        n = int(math.ceil(2 * extent / vox)) + 1
        nz = int(math.ceil((z1 - z0) / vox)) + 1
        self.x = np.linspace(-extent, extent, n, dtype=np.float32)
        self.y = np.linspace(-extent, extent, n, dtype=np.float32)
        self.z = np.linspace(z0, z1, nz, dtype=np.float32)
        self.d = np.full((n, n, nz), 10.0, dtype=np.float32)
        self.ext, self.z0, self.z1 = extent, z0, z1

    def _box(self, lo, hi):
        def rng(axis, a, b):
            i0 = max(0, int(np.searchsorted(axis, a)) - 1); i1 = min(len(axis), int(np.searchsorted(axis, b)) + 1)
            return slice(i0, i1)
        return rng(self.x, lo[0], hi[0]), rng(self.y, lo[1], hi[1]), rng(self.z, lo[2], hi[2])

    def stem(self, centre_at, radius_at, k):
        """lathe around a (slightly wandering) axis: centre_at(z)->(cx,cy), radius_at(z, theta)->r"""
        X, Y = np.meshgrid(self.x, self.y, indexing='ij')
        for iz, z in enumerate(self.z):
            cx, cy = centre_at(float(z))
            dx, dy = X - cx, Y - cy
            th = np.arctan2(dy, dx)
            r = radius_at(float(z), th)
            d = np.sqrt(dx * dx + dy * dy) - r
            self.d[:, :, iz] = smin(self.d[:, :, iz], d.astype(np.float32), k)

    def capsule_chain(self, pts, rads, flat, k):
        """tapered capsules through pts with radii rads; flat < 1 squashes the section vertically"""
        for i in range(len(pts) - 1):
            a, b = np.array(pts[i], np.float32), np.array(pts[i + 1], np.float32)
            ra, rb = rads[i], rads[i + 1]
            fa, fb = flat[i], flat[i + 1]
            m = max(ra, rb) / min(fa, fb) + k
            lo = np.minimum(a, b) - m; hi = np.maximum(a, b) + m
            sx, sy, sz = self._box(lo, hi)
            if sx.stop <= sx.start or sy.stop <= sy.start or sz.stop <= sz.start: continue
            X, Y, Z = np.meshgrid(self.x[sx], self.y[sy], self.z[sz], indexing='ij')
            ab = b - a; L2 = float(ab @ ab) + 1e-9
            t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2, 0, 1)
            px, py, pz = X - (a[0] + ab[0] * t), Y - (a[1] + ab[1] * t), Z - (a[2] + ab[2] * t)
            f = fa + (fb - fa) * t
            r = ra + (rb - ra) * t
            d = np.sqrt(px * px + py * py + (pz / f) ** 2) * np.minimum(1.0, f + 0.25) - r
            sub = self.d[sx, sy, sz]
            self.d[sx, sy, sz] = smin(sub, d.astype(np.float32), k)

    def mesh(self):
        # close the volume just under the ground (the soil hides the rest) and at the top cut
        Z = self.z[None, None, :]
        d = np.maximum(self.d, -(Z - (self.z0 + self.vox * 1.5)))
        d = np.maximum(d, Z - (self.z1 - self.vox * 1.5))
        verts, faces, normals, _ = measure.marching_cubes(d, level=0.0, spacing=(self.vox, self.vox, self.vox))
        verts[:, 0] += self.x[0]; verts[:, 1] += self.y[0]; verts[:, 2] += self.z[0]
        return verts, faces


def plan_roots(rng, R0, lobes, kind, detail):
    """centre lines (x, y, z), radii and vertical flattening for every root of one tree"""
    roots = []  # dicts: pts, rads, flat, type
    def path(a, start, L, r0, z_start, seg, sink, wander, arch=None):
        pts, rads, flat = [], [], []
        ang = a; bend = rng.uniform(-0.4, 0.4)
        for i in range(seg + 1):
            f = i / seg
            ang = a + bend * f + wander * math.sin(f * 5.0 + a * 3.0) * f
            d = start + L * f
            # thick where it leaves the stem, thinning once clear of it, with knobbly swellings along the way
            out = max(0.0, d - R0 * 1.05) / max(1e-3, L)
            r = r0 * (0.24 + 0.76 * math.exp(-out * 5.5)) * (1 + 0.16 * math.sin(f * 17 + a * 5) * f + 0.08 * math.sin(f * 41 + a))
            z = z_start * (1 - f) ** 3.2 + r * (0.1 - sink * f ** 1.3)
            if arch and arch[0] < f < arch[1]:
                s = math.sin(math.pi * (f - arch[0]) / (arch[1] - arch[0]))
                z += s * (r * 1.1 + 0.012)
            pts.append((math.cos(ang) * d, math.sin(ang) * d, z)); rads.append(max(0.006, r))
            flat.append(0.95 - 0.35 * min(1.0, f * 2.5))
        return pts, rads, flat
    # buttresses: one per flare lobe, continuing as a surface root (sometimes arching, sometimes forking)
    for a in lobes:
        L = R0 * rng.uniform(1.6, 2.5)
        r0 = R0 * rng.uniform(0.36, 0.46)
        arch = None
        pts, rads, flat = path(a, R0 * 0.35, L, r0, R0 * rng.uniform(0.6, 0.85), 12 if detail else 8, 2.6, 0.12, arch)
        roots.append(dict(pts=pts, rads=rads, flat=flat, type='buttress'))
        if rng.random() < 0.2:  # occasional Y fork near the middle
            i = int(len(pts) * rng.uniform(0.45, 0.6)); p = pts[i]
            a2 = math.atan2(p[1], p[0]) + rng.choice([-1, 1]) * rng.uniform(0.35, 0.7)
            fp, fr, ff = path(a2, math.hypot(p[0], p[1]), L * rng.uniform(0.35, 0.55), rads[i] * 0.85, max(p[2], 0.0), 7 if detail else 5, 1.9, 0.2)
            roots.append(dict(pts=fp, rads=fr, flat=ff, type='surface'))
    # smaller surface roots between the buttresses
    for k in range(rng.randint(0, 1)):
        a = rng.uniform(0, 2 * math.pi)
        pts, rads, flat = path(a, R0 * 0.5, R0 * rng.uniform(1.6, 2.8), R0 * rng.uniform(0.2, 0.3), R0 * 0.25, 9 if detail else 6, 1.9, 0.25,
                               (0.25, 0.42) if rng.random() < 0.1 else None)
        roots.append(dict(pts=pts, rads=rads, flat=flat, type='surface'))
    # thin laterals off the big roots
    if detail:
        for r in [r for r in roots if r['type'] == 'buttress']:
            low = [i for i in range(3, len(r['pts']) - 2) if r['pts'][i][2] < 0.03]   # only where the root lies on the soil
            for k in range(rng.randint(0, 1) if low else 0):
                i = rng.choice(low); p = r['pts'][i]
                a = math.atan2(p[1], p[0]) + rng.choice([-1, 1]) * rng.uniform(0.8, 1.5)
                q = []; rr = []; ff = []
                L = R0 * rng.uniform(0.8, 1.6); n = 5
                for j in range(n + 1):
                    f = j / n
                    rl = max(0.005, r['rads'][i] * 0.38 * (1 - 0.6 * f))
                    q.append((p[0] + math.cos(a + 0.4 * f) * L * f, p[1] + math.sin(a + 0.4 * f) * L * f, min(p[2], 0.0) - rl * (0.2 + 1.2 * f) + 0.012 * math.sin(f * 9)))
                    rr.append(rl); ff.append(0.8)
                roots.append(dict(pts=q, rads=rr, flat=ff, type='lateral'))
    return roots
