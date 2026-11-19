"""Small periodic (tileable) noise helpers for vertex displacement inside Blender scripts."""
import math, random

_rnd = random.Random(1234)
_G = [(math.cos(a), math.sin(a)) for a in [_rnd.uniform(0, 2 * math.pi) for _ in range(512)]]
_P = list(range(256)); _rnd.shuffle(_P); _P = _P * 2


def _grad(ix, iy, px, py):
    g = _G[_P[(_P[ix % px % 256] + iy % py) % 512] % 512]
    return g


def pnoise(x, y, px, py):
    """Periodic gradient noise with integer periods px, py."""
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    def dot(gx, gy, dx, dy):
        g = _grad(gx, gy, px, py)
        return g[0] * dx + g[1] * dy
    u = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    v = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    a = dot(ix, iy, fx, fy); b = dot(ix + 1, iy, fx - 1, fy)
    c = dot(ix, iy + 1, fx, fy - 1); d = dot(ix + 1, iy + 1, fx - 1, fy - 1)
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v


def tor_fbm(u, v, base=4, octaves=5):
    """fbm over a unit tile (u, v in [0,1]) that tiles seamlessly."""
    s, amp, norm, f = 0.0, 1.0, 0.0, base
    for _ in range(octaves):
        s += amp * pnoise(u * f, v * f, f, f)
        norm += amp; amp *= 0.5; f *= 2
    return s / norm
