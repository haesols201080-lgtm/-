"""Small signed-distance sculpting kit (numpy + marching cubes) for organic models: tapered capsules, rotated
ellipsoids, smooth union / smooth subtraction, evaluated in sub-boxes of a regular grid. Each primitive carries a tag
(zone, fur length, comb direction...) so per-vertex data can be transferred from the nearest primitive afterwards."""
import math
import numpy as np
from mathutils import Euler, Vector
from skimage import measure

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)

def smax(a, b, k):
    return -smin(-a, -b, k)

class Sculpt:
    def __init__(self, lo, hi, vox):
        self.vox = vox
        self.ax = [np.arange(lo[i], hi[i] + vox, vox, dtype=np.float32) for i in range(3)]
        self.d = np.full([len(a) for a in self.ax], 1.0, dtype=np.float32)
        self.prims = []   # (kind, params, tag)

    def _sub(self, lo, hi):
        sl = []
        for i in range(3):
            a = self.ax[i]; i0 = max(0, int(np.searchsorted(a, lo[i])) - 1); i1 = min(len(a), int(np.searchsorted(a, hi[i])) + 1)
            sl.append(slice(i0, i1))
        return sl

    def _apply(self, sl, d, k, op):
        sub = self.d[sl[0], sl[1], sl[2]]
        self.d[sl[0], sl[1], sl[2]] = smin(sub, d, k) if op == 'add' else smax(sub, -d, k)

    def ellipsoid(self, c, r, rot=(0, 0, 0), k=0.004, op='add', tag=None):
        c = np.array(c, np.float32); r = np.array(r, np.float32); m = max(r) + k * 2
        sl = self._sub(c - m, c + m)
        X, Y, Z = np.meshgrid(self.ax[0][sl[0]], self.ax[1][sl[1]], self.ax[2][sl[2]], indexing='ij')
        R = np.array(Euler(rot).to_matrix(), np.float32).T     # world -> local
        P = np.stack([X - c[0], Y - c[1], Z - c[2]], -1) @ R.T
        k0 = np.linalg.norm(P / r, axis=-1); k1 = np.linalg.norm(P / (r * r), axis=-1)
        d = k0 * (k0 - 1.0) / np.maximum(k1, 1e-6)
        self._apply(sl, d.astype(np.float32), k, op)
        if tag is not None and op == 'add': self.prims.append(('ell', (c, r, np.array(Euler(rot).to_matrix(), np.float32)), tag))

    def capsule(self, a, b, ra, rb, k=0.004, op='add', tag=None):
        a = np.array(a, np.float32); b = np.array(b, np.float32); m = max(ra, rb) + k * 2
        sl = self._sub(np.minimum(a, b) - m, np.maximum(a, b) + m)
        X, Y, Z = np.meshgrid(self.ax[0][sl[0]], self.ax[1][sl[1]], self.ax[2][sl[2]], indexing='ij')
        ab = b - a; L2 = float(ab @ ab) + 1e-12
        t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2, 0, 1)
        dx, dy, dz = X - (a[0] + ab[0] * t), Y - (a[1] + ab[1] * t), Z - (a[2] + ab[2] * t)
        d = np.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t)
        self._apply(sl, d.astype(np.float32), k, op)
        if tag is not None and op == 'add': self.prims.append(('cap', (a, b, ra, rb), tag))

    def chain(self, pts, rads, k=0.004, tag=None):
        for i in range(len(pts) - 1):
            self.capsule(pts[i], pts[i + 1], rads[i], rads[i + 1], k, tag=tag)

    def mesh(self):
        v, f, n, _ = measure.marching_cubes(self.d, 0.0, spacing=(self.vox,) * 3)
        v[:, 0] += self.ax[0][0]; v[:, 1] += self.ax[1][0]; v[:, 2] += self.ax[2][0]
        return v, f

    def nearest_tags(self, P):
        """per point: (tag of the closest primitive surface, distance)"""
        best = np.full(len(P), 1e9); idx = np.zeros(len(P), int)
        for i, (kind, prm, tag) in enumerate(self.prims):
            if kind == 'cap':
                a, b, ra, rb = prm; ab = b - a; L2 = float(ab @ ab) + 1e-12
                t = np.clip(((P - a) @ ab) / L2, 0, 1); q = P - (a + np.outer(t, ab)); d = np.linalg.norm(q, axis=1) - (ra + (rb - ra) * t)
            else:
                c, r, M = prm; L = (P - c) @ M; k0 = np.linalg.norm(L / r, axis=1); k1 = np.linalg.norm(L / (r * r), axis=1); d = k0 * (k0 - 1) / np.maximum(k1, 1e-6)
            d = np.abs(d); m = d < best; best[m] = d[m]; idx[m] = i
        return [self.prims[i][2] for i in idx], best, idx
