"""Swaps the procedural texture sets for photoscanned CC0 materials
(ambientCG and Poly Haven, see assets/CREDITS.md) where we have them.

    python blender/photo_textures.py <starter_1984 dir>

Each source folder holds color.jpg, normal_gl.(png|jpg) and either
roughness.jpg or arm.jpg (AO, roughness, metal). Output follows the game's
convention: <set>_c.jpg, <set>_n.jpg (OpenGL), <set>_r.jpg with R = AO,
G = roughness, B = metal, or for ground sets B = puddle mask.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import numpy as np
import textures as T

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'textures')

# game set: (source folder, colour multiplier, puddles?)
MAP = {
    'brick': ('Bricks082C', (1.0, 1.0, 1.0), False),
    'concrete_grey': ('dirty_concrete', (0.92, 0.92, 0.92), False),
    'concrete_white': ('dirty_concrete', (1.25, 1.25, 1.22), False),
    'plaster': ('damaged_plaster', (1.0, 1.0, 1.0), False),
    'slate': ('roof_slates_02', (0.62, 0.64, 0.70), False),
    'asphalt': ('asphalt_02', (0.85, 0.85, 0.85), True),
    'cobble': ('cobblestone_floor_08', (0.85, 0.85, 0.85), True),
    'wood': ('worn_planks', (1.0, 1.0, 1.0), False),
    'board': ('worn_planks', (0.75, 0.74, 0.70), False),
    'wallpaper': ('decrepit_wallpaper', (1.0, 1.0, 1.0), False),
    'tile_white': ('Tiles036', (1.0, 1.0, 1.0), False),
    'grass': ('Grass004', (1.0, 1.0, 1.0), False),
    'dirt': ('Ground037', (1.0, 1.0, 1.0), False),
    'bark': ('tree_bark_03', (0.8, 0.8, 0.8), False),
    'plaster_peeling': ('preconcrete_wall_001', (0.9, 0.9, 0.88), False),
    'brick_dark': ('dark_brick_wall', (1.0, 1.0, 1.0), False),
    'rust': ('rusty_metal_02', (1.0, 1.0, 1.0), False),
}
SIZE = 1024


def load(path, size=SIZE):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'   # keep raw values
    if img.size[0] != size or img.size[1] != size:
        img.scale(size, size)
    a = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(size, size, 4)[::-1]          # top row first, like textures.py


def first(d, *names):
    for n in names:
        p = os.path.join(d, n)
        if os.path.exists(p):
            return p
    return None


def main(src):
    T.OUT = OUT
    os.makedirs(OUT, exist_ok=True)
    for name, (folder, mul, puddles) in MAP.items():
        d = os.path.join(src, folder)
        if not os.path.isdir(d):
            print('missing', d); continue
        col = load(first(d, 'color.jpg'))[..., :3] * np.array(mul)
        nrm = load(first(d, 'normal_gl.png', 'normal_gl.jpg'))[..., :3]
        arm = first(d, 'arm.jpg')
        if arm:
            orm = load(arm)[..., :3]
        else:
            r = load(first(d, 'roughness.jpg'))[..., 0]
            orm = np.stack([np.ones_like(r), r, np.zeros_like(r)], -1)
        if puddles:
            big = T.fbm(SIZE, 3, 5, 77)
            orm[..., 2] = np.clip((big - 0.6) * 6, 0, 1)
        T.save(name + '_c', np.clip(col, 0, 1))
        T.save(name + '_n', nrm)
        T.save(name + '_r', orm)
        print('ok', name, '<-', folder)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    main(args[0])
