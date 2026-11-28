"""The transport case's shell, as a texture set: moulded polypropylene in olive drab (a field case's), the fine
orange-peel stipple of the mould, a little mottling, scratches where it was dragged and dropped (lighter, smoother,
grooved), and dirt. 2048 px over half a metre (props' UVs are in metres: tex_m 0.5).
Writes <out>/pr_case_shell_{albedo,normal,orm}.jpg (orm: occlusion, roughness, metalness).
usage: python -I blender/case_textures.py <out dir>"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
N = 2048; rng = np.random.default_rng(11)

def noise(cells, seed):
    """tileable value noise: a random lattice of cells x cells, bicubic-upsampled with wrap"""
    r = np.random.default_rng(seed).random((cells, cells)).astype(np.float32)
    big = np.tile(r, (3, 3)); im = Image.fromarray((big * 255).astype(np.uint8)).resize((N * 3, N * 3), Image.BICUBIC)
    return np.asarray(im, np.float32)[N:2 * N, N:2 * N] / 255

def blur_wrap(a, rad):
    """a near-Gaussian blur that wraps (three box passes each way)"""
    a = a.astype(np.float32)
    for _ in range(3):
        for ax in (0, 1):
            acc = np.zeros_like(a)
            for k in range(-rad, rad + 1): acc += np.roll(a, k, ax)
            a = acc / (2 * rad + 1)
    return a

# heights: the mould's stipple (fine, even), a faint swirl of the moulding
stip = blur_wrap(rng.random((N, N)).astype(np.float32), 2) - 0.5
h = stip * 0.9 + (noise(24, 3) - 0.5) * 0.3
# scratches: thin strokes, mostly one way (dragged), some across
sc = Image.new('L', (N, N), 0); d = ImageDraw.Draw(sc)
for k in range(260):
    x, y = rng.uniform(0, N, 2); ang = rng.normal(0.35, 0.25) if rng.random() < 0.7 else rng.uniform(0, np.pi)
    L = rng.uniform(20, 340) * (1 if rng.random() < 0.8 else 2.2); w = int(rng.integers(1, 4))
    pts = [(x + np.cos(ang) * t * L + rng.normal(0, 1.2), y + np.sin(ang) * t * L + rng.normal(0, 1.2)) for t in np.linspace(0, 1, 6)]
    for dx in (-N, 0, N):
        for dy in (-N, 0, N):
            d.line([(px + dx, py + dy) for px, py in pts], fill=int(rng.uniform(90, 255)), width=w)
scr = np.asarray(sc.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
h = h - scr * 1.6
# colour: olive drab, mottled; scratches lighter (the paler plastic under the skin); dirt darker and browner
olive = np.array([0.255, 0.275, 0.205])
mott = (noise(10, 5) - 0.5) * 0.10 + (noise(48, 6) - 0.5) * 0.05
dirt = np.clip((noise(7, 8) - 0.45) * 2.2, 0, 1) ** 1.5 * 0.55 + np.clip((noise(30, 9) - 0.6) * 3, 0, 1) * 0.25
col = olive[None, None, :] * (1 + mott[..., None]) * (1 + stip[..., None] * 0.06)
col = col * (1 - dirt[..., None]) + np.array([0.20, 0.165, 0.11])[None, None, :] * dirt[..., None]
col = col * (1 - scr[..., None] * 0.55) + np.array([0.46, 0.47, 0.41])[None, None, :] * scr[..., None] * 0.55
Image.fromarray(np.clip(col * 255 + 0.5, 0, 255).astype(np.uint8)).save(f'{OUT}/pr_case_shell_albedo.jpg', quality=93)
# normals (OpenGL), from the heights
k = 2.4; gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * k; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * k
n = np.stack([-gx, gy, np.ones_like(h)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)).save(f'{OUT}/pr_case_shell_normal.jpg', quality=95)
# occlusion 1; roughness: satin moulding, rougher where dirty, smoother along the scratches; no metal
rough = np.clip(0.58 + (noise(20, 12) - 0.5) * 0.12 + dirt * 0.25 - scr * 0.18, 0.3, 0.95)
orm = np.stack([np.ones_like(rough), rough, np.zeros_like(rough)], -1)
Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).save(f'{OUT}/pr_case_shell_orm.jpg', quality=95)
print('case shell textures in', OUT)
