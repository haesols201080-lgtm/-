"""Tileable PBR texture sets, generated with numpy and saved through Blender's
image API. Each set writes <name>_c.jpg (colour), <name>_n.jpg (OpenGL normal)
and <name>_r.jpg (R = ambient occlusion, G = roughness, B = metalness)."""
import bpy, os
import numpy as np

OUT = None


def _grid_noise(res, cells, rs):
    g = rs.random((cells, cells))
    x = np.arange(res) / res * cells
    i0 = np.floor(x).astype(int) % cells
    i1 = (i0 + 1) % cells
    f = x - np.floor(x)
    s = f * f * (3 - 2 * f)
    a = g[i0][:, i0]; b = g[i0][:, i1]; c = g[i1][:, i0]; d = g[i1][:, i1]
    top = a + (b - a) * s[None, :]
    bot = c + (d - c) * s[None, :]
    return top + (bot - top) * s[:, None]


def _aniso_noise(res, cx, cy, rs):
    """Value noise with different cell counts across and down (streaks)."""
    g = rs.random((cy, cx))
    def axis(n):
        x = np.arange(res) / res * n
        i0 = np.floor(x).astype(int) % n
        f = x - np.floor(x)
        return i0, (i0 + 1) % n, f * f * (3 - 2 * f)
    y0, y1, sy = axis(cy)
    x0, x1, sx = axis(cx)
    a = g[y0][:, x0]; b = g[y0][:, x1]; c = g[y1][:, x0]; d = g[y1][:, x1]
    top = a + (b - a) * sx[None, :]
    bot = c + (d - c) * sx[None, :]
    return top + (bot - top) * sy[:, None]


def fbm(res, base, octaves, seed, gain=0.5):
    rs = np.random.default_rng(seed)
    out = np.zeros((res, res)); amp = 1.0; tot = 0.0; cells = base
    for _ in range(octaves):
        if cells > res:
            break
        out += _grid_noise(res, cells, rs) * amp
        tot += amp; amp *= gain; cells *= 2
    return out / tot


def streaks(res, seed, cx=64, cy=3):
    rs = np.random.default_rng(seed)
    return _aniso_noise(res, cx, cy, rs) * 0.6 + _aniso_noise(res, cx * 2, cy * 2, rs) * 0.4


def worley(res, n, seed, jitter=0.9):
    """Distance to nearest and second nearest jittered point, wrapping."""
    rs = np.random.default_rng(seed)
    pts = (np.stack(np.meshgrid(np.arange(n), np.arange(n), indexing='ij'), -1)
           + 0.5 + (rs.random((n, n, 2)) - 0.5) * jitter)
    ids = rs.random((n, n))
    y, x = np.mgrid[0:res, 0:res] / res * n
    cy = np.floor(y).astype(int); cx = np.floor(x).astype(int)
    d1 = np.full((res, res), 9.0); d2 = np.full((res, res), 9.0); idv = np.zeros((res, res))
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            gy = cy + oy; gx = cx + ox
            p = pts[gy % n, gx % n]
            py = p[..., 0] + (gy - gy % n); px = p[..., 1] + (gx - gx % n)
            d = np.sqrt((py - y) ** 2 + (px - x) ** 2)
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            idv = np.where(closer, ids[gy % n, gx % n], idv)
            d1 = np.where(closer, d, d1)
    return d1, d2, idv


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, 1, 0) - np.roll(h, -1, 0)) * strength
    n = np.stack([-dx, -dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save(name, rgb, fmt='JPEG', alpha=None):
    res_y, res_x = rgb.shape[:2]
    img = bpy.data.images.new(name, res_x, res_y, alpha=alpha is not None)
    a = alpha if alpha is not None else np.ones((res_y, res_x))
    px = np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)[::-1]
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    ext = 'jpg' if fmt == 'JPEG' else 'png'
    path = os.path.join(OUT, f'{name}.{ext}')
    img.filepath_raw = path
    img.file_format = fmt
    scene = bpy.context.scene
    scene.render.image_settings.quality = 86
    img.save(filepath=path, quality=86) if fmt == 'JPEG' else img.save()
    bpy.data.images.remove(img)


def save_set(name, col, height, rough, ao=None, metal=None, nstrength=4.0):
    res = col.shape[0]
    save(name + '_c', col)
    save(name + '_n', normal_from_height(height, nstrength * res / 512))
    ao = np.ones_like(height) if ao is None else ao * np.ones_like(height)
    metal = np.zeros_like(height) if metal is None else metal * np.ones_like(height)
    rough = rough * np.ones_like(height)
    save(name + '_r', np.stack([ao, rough, metal], -1))


def tint(v, c0, c1):
    v = v[..., None]
    return np.array(c0) * (1 - v) + np.array(c1) * v


def lin(c):  # sRGB-ish hex helper not needed; colours here are display values
    return c


# ---------------------------------------------------------------- materials

def concrete(name, base, dark, res, seed, seams=True):
    n1 = fbm(res, 4, 7, seed)
    n2 = fbm(res, 16, 5, seed + 1)
    st = streaks(res, seed + 2)
    pores = np.clip((fbm(res, 256, 2, seed + 3) - 0.74) * 8, 0, 1)
    v = 0.55 * n1 + 0.25 * n2 + 0.2 * st
    stain = np.clip((st - 0.45) * 2.2, 0, 1) * 0.55 + np.clip((n1 - 0.55) * 2, 0, 1) * 0.35
    col = tint(np.clip(v, 0, 1), dark, base)
    col *= (1 - stain[..., None] * np.array([0.42, 0.44, 0.48]))
    col *= (1 - pores[..., None] * 0.07)
    h = n2 * 0.4 + st * 0.2 - pores * 0.15
    ao = np.ones((res, res))
    if seams:
        y = np.arange(res)
        # formwork board marks every 1/8 tile, panel joints every 1/2
        board = (np.abs(((y / res * 8) % 1) - 0.5) > 0.485).astype(float)
        joint_y = (np.abs(((y / res * 2) % 1) - 0.5) > 0.494).astype(float)
        joint_x = (np.abs(((y / res * 2) % 1) - 0.5) > 0.494).astype(float)
        seam = np.maximum(board[:, None] * 0.35, np.maximum(joint_y[:, None], joint_x[None, :]))
        col *= (1 - seam[..., None] * 0.25)
        h -= seam * 0.6
        ao -= seam * 0.4
    rough = 0.78 + 0.18 * n2 - stain * 0.08
    save_set(name, col, h, rough, ao, nstrength=3.0)


def brick(res=1024, seed=10):
    courses, per_row = 26, 9
    y, x = np.mgrid[0:res, 0:res] / res
    row = np.floor(y * courses).astype(int)
    xo = x * per_row + (row % 2) * 0.5
    col_i = np.floor(xo).astype(int) % per_row
    fx = xo % 1; fy = (y * courses) % 1
    mortar_w = 0.045; mortar_h = 0.12
    edge = np.minimum(np.minimum(fx, 1 - fx) / mortar_w, np.minimum(fy, 1 - fy) / mortar_h)
    brick_mask = np.clip(edge - 0.6, 0, 1) ** 0.5
    rs = np.random.default_rng(seed)
    bc = rs.random((courses, per_row, 3))
    pal = np.array([[0.42, 0.18, 0.12], [0.36, 0.17, 0.12], [0.30, 0.14, 0.10],
                    [0.46, 0.25, 0.16], [0.22, 0.11, 0.08], [0.40, 0.22, 0.17]])
    pick = (bc[..., 0] * len(pal)).astype(int)
    bcol = pal[pick] * (0.85 + 0.3 * bc[..., 1:2])
    per_brick = bcol[row % courses, col_i]
    grain = fbm(res, 32, 5, seed + 1)
    soot = fbm(res, 3, 6, seed + 2)
    st = streaks(res, seed + 3, 48, 2)
    mortar = np.array([0.42, 0.40, 0.36]) * (0.8 + 0.3 * grain[..., None])
    col = per_brick * (0.8 + 0.35 * grain[..., None])
    col = col * brick_mask[..., None] + mortar * (1 - brick_mask[..., None])
    dirt = np.clip(soot * 1.3 - 0.35, 0, 1) * 0.65 + np.clip(st - 0.5, 0, 1) * 0.6
    col *= (1 - dirt[..., None] * 0.7)
    h = brick_mask * 0.8 + grain * 0.25
    rough = 0.85 + 0.1 * grain
    ao = 0.55 + 0.45 * brick_mask
    save_set('brick', col, h, rough, ao, nstrength=4.0)


def plaster(res=512, seed=20):
    n = fbm(res, 4, 7, seed); m = fbm(res, 8, 6, seed + 1)
    st = streaks(res, seed + 2, 40, 3)
    d1, d2, _ = worley(res, 6, seed + 3)
    crack = np.clip(1 - (d2 - d1) * 30, 0, 1) * (fbm(res, 8, 3, seed + 4) > 0.55)
    peel = np.clip((m - 0.62) * 12, 0, 1)
    base = tint(n, (0.46, 0.43, 0.37), (0.66, 0.62, 0.53))
    under = np.array([0.36, 0.22, 0.17]) * (0.8 + 0.3 * n[..., None])
    col = base * (1 - peel[..., None]) + under * peel[..., None]
    col *= 1 - (np.clip(st - 0.5, 0, 1) * 0.7)[..., None]
    col *= 1 - crack[..., None] * 0.5
    h = n * 0.3 + (1 - peel) * 0.5 - crack * 0.5
    save_set('plaster', col, h, 0.9 + 0.05 * n, 1 - crack * 0.4 - peel * 0.15)


def slate(res=512, seed=30):
    rows, per = 10, 6
    y, x = np.mgrid[0:res, 0:res] / res
    r = np.floor(y * rows).astype(int)
    xo = x * per + (r % 2) * 0.5
    fy = (y * rows) % 1; fx = xo % 1
    rs = np.random.default_rng(seed)
    v = rs.random((rows, per))[r % rows, np.floor(xo).astype(int) % per]
    n = fbm(res, 16, 5, seed + 1); moss = np.clip((fbm(res, 6, 6, seed + 2) - 0.6) * 4, 0, 1)
    col = tint(v * 0.5 + n * 0.5, (0.10, 0.11, 0.13), (0.24, 0.25, 0.28))
    col = col * (1 - moss[..., None] * 0.6) + np.array([0.22, 0.25, 0.12]) * moss[..., None] * 0.6
    gap = (np.minimum(fx, 1 - fx) < 0.02).astype(float)
    h = (1 - fy) * 0.7 - gap * 0.4 + n * 0.1
    col *= 1 - gap[..., None] * 0.5
    save_set('slate', col, h, 0.55 + 0.25 * n + moss * 0.2, 0.6 + 0.4 * (1 - fy))


def asphalt(res=1024, seed=40):
    n = fbm(res, 8, 8, seed); agg = fbm(res, 256, 2, seed + 1)
    big = fbm(res, 3, 5, seed + 2)
    d1, d2, _ = worley(res, 5, seed + 3)
    crack = np.clip(1 - (d2 - d1) * 40, 0, 1) * np.clip((fbm(res, 6, 3, seed + 4) - 0.62) * 5, 0, 1) * 0.7
    puddle = np.clip((big - 0.62) * 7, 0, 1)
    col = tint(n * 0.6 + agg * 0.4, (0.09, 0.09, 0.095), (0.25, 0.245, 0.24))
    col *= 1 - crack[..., None] * 0.6
    col *= 1 - puddle[..., None] * 0.18
    h = agg * 0.4 + n * 0.2 - crack * 0.6
    h = h * (1 - puddle) + puddle * 0.1
    rough = 0.72 + 0.2 * agg - puddle * 0.12
    # puddle mask goes in the blue channel; the game floods it when it rains
    save_set('asphalt', col, h, rough, 1 - crack * 0.5, puddle, nstrength=3.0)


def paving(res=1024, seed=50):
    nx = ny = 5
    y, x = np.mgrid[0:res, 0:res] / res
    fx = (x * nx) % 1; fy = (y * ny) % 1
    rs = np.random.default_rng(seed)
    v = rs.random((ny, nx))[np.floor(y * ny).astype(int) % ny, np.floor(x * nx).astype(int) % nx]
    n = fbm(res, 16, 6, seed + 1); big = fbm(res, 3, 5, seed + 2)
    d1, d2, _ = worley(res, 7, seed + 3)
    crack = np.clip(1 - (d2 - d1) * 30, 0, 1) * (fbm(res, 6, 3, seed + 4) > 0.6)
    joint = np.clip(1 - np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy)) * 120, 0, 1)
    puddle = np.clip((big - 0.6) * 8, 0, 1)
    col = tint(v * 0.3 + n * 0.7, (0.24, 0.23, 0.22), (0.47, 0.45, 0.42))
    col *= 1 - (joint * 0.6 + crack * 0.4)[..., None]
    col *= 1 - puddle[..., None] * 0.12
    h = 0.6 - joint * 0.6 + n * 0.2 - crack * 0.3 + v * 0.1
    rough = 0.8 + 0.15 * n - puddle * 0.1
    save_set('paving', col, h, rough, 1 - joint * 0.5, puddle)


def cobble(res=512, seed=60):
    d1, d2, idv = worley(res, 12, seed, 0.6)
    edge = np.clip((d2 - d1) * 6, 0, 1)
    n = fbm(res, 32, 4, seed + 1); big = fbm(res, 3, 5, seed + 2)
    col = tint(idv * 0.5 + n * 0.5, (0.16, 0.15, 0.14), (0.38, 0.36, 0.33))
    col *= (0.35 + 0.65 * edge[..., None])
    h = np.sqrt(edge) * 0.9 + n * 0.1
    wet = np.clip((big - 0.5) * 4, 0, 1) * (1 - edge * 0.6)
    rough = 0.7 + 0.25 * n
    save_set('cobble', col, h, rough, 0.4 + 0.6 * edge, wet)


def planks(name, res, seed, c0, c1, n_planks=6, weathered=False):
    y, x = np.mgrid[0:res, 0:res] / res
    p = np.floor(x * n_planks).astype(int)
    fx = (x * n_planks) % 1
    rs = np.random.default_rng(seed)
    pv = rs.random(n_planks)[p % n_planks]
    off = rs.random(n_planks)[p % n_planks]
    grain = streaks(res, seed + 1, 3 * n_planks * 4, 1) * 0.5 + fbm(res, 8, 5, seed + 2) * 0.5
    rings = 0.5 + 0.5 * np.sin((x * n_planks * 40 + grain * 6 + off * 10) * 2.0)
    v = 0.5 * pv + 0.3 * rings + 0.2 * grain
    col = tint(v, c0, c1)
    gap = (np.minimum(fx, 1 - fx) < 0.025).astype(float)
    endj = ((np.abs(((y + off) % 1) - 0.5) > 0.497)).astype(float)
    seam = np.maximum(gap, endj)
    col *= 1 - seam[..., None] * 0.6
    if weathered:
        g = fbm(res, 4, 6, seed + 3)
        col = col * 0.6 + np.array([0.35, 0.34, 0.32]) * g[..., None] * 0.5
    h = rings * 0.2 + grain * 0.3 - seam * 0.8
    save_set(name, col, h, 0.65 + 0.25 * grain, 1 - seam * 0.5)


def wallpaper(res=512, seed=70):
    y, x = np.mgrid[0:res, 0:res] / res
    stripe = 0.5 + 0.5 * np.cos(x * np.pi * 2 * 8)
    motif = np.exp(-(((x * 8) % 1 - 0.5) ** 2 + ((y * 6 + (np.floor(x * 8) % 2) * 0.5) % 1 - 0.5) ** 2) * 30)
    n = fbm(res, 4, 6, seed); st = streaks(res, seed + 1, 30, 2)
    col = tint(stripe * 0.25 + motif * 0.4 + n * 0.35, (0.36, 0.33, 0.25), (0.58, 0.54, 0.42))
    damp = np.clip((fbm(res, 3, 5, seed + 2) - 0.55) * 3, 0, 1)
    col *= 1 - (damp * 0.4 + np.clip(st - 0.55, 0, 1) * 0.5)[..., None]
    save_set('wallpaper', col, n * 0.2 + motif * 0.1, 0.9 + 0.05 * n)


def tiles(res=512, seed=80):
    nn = 8
    y, x = np.mgrid[0:res, 0:res] / res
    fx = (x * nn) % 1; fy = (y * nn) % 1
    grout = np.clip(1 - np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy)) * 50, 0, 1)
    n = fbm(res, 8, 5, seed); rs = np.random.default_rng(seed)
    v = rs.random((nn, nn))[np.floor(y * nn).astype(int) % nn, np.floor(x * nn).astype(int) % nn]
    col = tint(0.6 + 0.2 * v + 0.2 * n, (0.70, 0.72, 0.70), (0.88, 0.89, 0.87))
    col = col * (1 - grout[..., None]) + np.array([0.45, 0.45, 0.42]) * grout[..., None]
    save_set('tile_white', col, 1 - grout, 0.15 + 0.6 * grout + 0.1 * n, 1 - grout * 0.4)


def metal(res=512, seed=90):
    n = fbm(res, 6, 7, seed); scratches = streaks(res, seed + 1, 200, 2)
    rust = np.clip((fbm(res, 5, 6, seed + 2) - 0.58) * 5, 0, 1)
    col = tint(n, (0.22, 0.23, 0.24), (0.36, 0.37, 0.38))
    col = col * (1 - rust[..., None]) + np.array([0.32, 0.16, 0.08]) * rust[..., None]
    rough = 0.4 + 0.25 * n + 0.4 * rust - 0.1 * (scratches > 0.7)
    metal = 0.85 * (1 - rust)
    save_set('metal', col, n * 0.1 + rust * 0.3, rough, None, metal)


def ground(name, res, seed, c0, c1, c2):
    n = fbm(res, 6, 8, seed); m = fbm(res, 24, 5, seed + 1); big = fbm(res, 2, 4, seed + 2)
    col = tint(n, c0, c1)
    patches = np.clip((big - 0.5) * 4, 0, 1)
    col = col * (1 - patches[..., None] * 0.5) + np.array(c2) * patches[..., None] * 0.5
    col *= (0.8 + 0.3 * m[..., None])
    save_set(name, col, m * 0.5 + n * 0.3, 0.85 + 0.1 * m)


def rubble(res=512, seed=100):
    d1, d2, idv = worley(res, 10, seed, 1.0)
    edge = np.clip((d2 - d1) * 4, 0, 1)
    n = fbm(res, 16, 5, seed + 1)
    brickish = (idv > 0.7)[..., None]
    col = np.where(brickish, np.array([0.38, 0.2, 0.15]), np.array([0.42, 0.40, 0.37])) * (0.6 + 0.5 * n[..., None])
    col *= (0.3 + 0.7 * edge[..., None])
    save_set('rubble', col, edge * 0.8 + n * 0.2, 0.95 - 0.05 * n, 0.3 + 0.7 * edge, nstrength=6.0)


def bark(name, res, seed, moss=False):
    st = streaks(res, seed, 24, 4); n = fbm(res, 16, 5, seed + 1)
    v = st * 0.7 + n * 0.3
    col = tint(v, (0.08, 0.065, 0.05), (0.30, 0.25, 0.20))
    if moss:
        m = np.clip((fbm(res, 6, 6, seed + 2) - 0.4) * 3, 0, 1)
        col = col * (1 - m[..., None]) + np.array([0.20, 0.28, 0.10]) * (0.6 + 0.6 * n[..., None]) * m[..., None]
    save_set(name, col, v, 0.9, 0.6 + 0.4 * v, nstrength=6.0)


def fabric(res=256, seed=110):
    y, x = np.mgrid[0:res, 0:res] / res
    w = 0.5 + 0.25 * np.sin(x * np.pi * 2 * 64) + 0.25 * np.sin(y * np.pi * 2 * 64)
    n = fbm(res, 8, 5, seed)
    col = tint(0.75 + 0.15 * w + 0.1 * n, (0.6, 0.6, 0.6), (1, 1, 1))
    save_set('fabric', col, w * 0.5 + n * 0.5, 0.9 + 0.05 * n, nstrength=2.0)


def leaves(name, res, seed, c0, c1):
    """Alpha-tested leaf atlas for foliage cards (PNG with alpha)."""
    rs = np.random.default_rng(seed)
    col = np.zeros((res, res, 3)); a = np.zeros((res, res))
    y, x = np.mgrid[0:res, 0:res] / res
    for _ in range(260):
        cx, cy = rs.random(2) * 0.8 + 0.1
        ang = rs.random() * np.pi * 2
        L = 0.05 + rs.random() * 0.05; W = L * (0.38 + rs.random() * 0.15)
        dx = x - cx; dy = y - cy
        u = dx * np.cos(ang) + dy * np.sin(ang)
        v = -dx * np.sin(ang) + dy * np.cos(ang)
        shape = (u / L) ** 2 + (v / (W * (1 - np.clip(u / L, -1, 1) ** 2 * 0.4))) ** 2
        m = shape < 1
        shade = 0.6 + 0.4 * rs.random()
        vein = np.exp(-(v / (W * 0.08)) ** 2) * 0.15
        c = np.array(c0) * (1 - shade) + np.array(c1) * shade
        col[m] = c * (0.85 + 0.15 * (1 - shape[m, None])) - vein[m, None]
        a[m] = 1
    # soft circular falloff keeps card edges hidden
    r = np.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
    a *= (r < 0.48)
    save(name, col, 'PNG', a)
    nrm = np.zeros((res, res, 3)) + np.array([0.5, 0.5, 1.0])
    save(name + '_n', nrm)


def grass_blade(res=128):
    """Narrow grass blade strip texture with alpha (used for instanced grass)."""
    yy = np.mgrid[0:res * 2, 0:res][0] / (res * 2)
    xx = np.mgrid[0:res * 2, 0:res][1] / res
    col = tint(1 - yy, (0.12, 0.17, 0.06), (0.42, 0.45, 0.20))
    a = (np.abs(xx - 0.5) < 0.45 * (yy ** 0.7)).astype(float)
    save('grass_blade', col, 'PNG', a)


def build_all(out_dir):
    global OUT
    OUT = out_dir
    os.makedirs(OUT, exist_ok=True)
    concrete('concrete_white', (0.86, 0.86, 0.83), (0.62, 0.62, 0.60), 1024, 1)
    concrete('concrete_grey', (0.50, 0.49, 0.46), (0.27, 0.27, 0.26), 1024, 2)
    brick()
    plaster()
    slate()
    asphalt()
    paving()
    cobble()
    planks('wood', 512, 120, (0.16, 0.09, 0.05), (0.40, 0.27, 0.16), 6)
    planks('board', 512, 121, (0.20, 0.17, 0.13), (0.42, 0.38, 0.31), 5, weathered=True)
    wallpaper()
    tiles()
    metal()
    ground('grass', 512, 130, (0.13, 0.17, 0.06), (0.32, 0.36, 0.14), (0.40, 0.36, 0.18))
    ground('dirt', 512, 131, (0.17, 0.13, 0.09), (0.33, 0.27, 0.20), (0.25, 0.25, 0.22))
    rubble()
    bark('bark', 512, 140)
    bark('bark_moss', 512, 141, moss=True)
    fabric()
    leaves('leaves', 512, 150, (0.10, 0.17, 0.05), (0.30, 0.40, 0.12))
    leaves('leaves_elm', 512, 151, (0.08, 0.13, 0.04), (0.24, 0.33, 0.10))
    grass_blade()
