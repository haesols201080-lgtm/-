"""Tileable notebook paper (fibre, faint mottling) and a tileable leather swatch for the UI.
python3 tools/make_paper.py <leather_albedo.jpg> <out_dir>"""
import sys, numpy as np
from PIL import Image
rng = np.random.default_rng(7)
N = 512

def periodic_noise(n, power, seed):
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((n, n)))
    ky, kx = np.meshgrid(np.fft.fftfreq(n), np.fft.fftfreq(n), indexing='ij')
    k = np.sqrt(kx * kx + ky * ky); k[0, 0] = 1
    out = np.real(np.fft.ifft2(f / k ** power))
    return (out - out.mean()) / out.std()

# paper: cream base, soft cloudy mottling, fine tooth, short fibres (wrapping at the tile edges)
base = np.array([240, 230, 206], np.float32) / 255
cloud = periodic_noise(N, 1.2, 1) * 0.007
tooth = periodic_noise(N, 0.3, 2) * 0.011
fib = np.zeros((N, N), np.float32)
for _ in range(900):
    x, y = rng.uniform(0, N, 2); a = rng.uniform(0, np.pi); L = rng.uniform(4, 16); s = rng.choice([-1, 1]) * rng.uniform(0.01, 0.035)
    for t in np.linspace(0, 1, int(L * 2)):
        px, py = int(x + np.cos(a) * L * t) % N, int(y + np.sin(a) * L * t) % N
        fib[py, px] += s
img = base[None, None, :] * (1 + cloud[..., None] + tooth[..., None] + fib[..., None]) 
Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(f'{sys.argv[2]}/paper.png', optimize=True)

# leather swatch for small CSS pieces: the scanned albedo, darkened toward a tobacco brown
L = Image.open(sys.argv[1]).convert('RGB').resize((640, 640), Image.LANCZOS)
a = np.asarray(L).astype(np.float32) / 255
a = a * np.array([0.82, 0.72, 0.62]) * 0.92
Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(f'{sys.argv[2]}/leather.jpg', quality=84, optimize=True)
print('ok')
