"""Packs downloaded Poly Haven (CC0) texture sets into the game's format.
   <name>_albedo.jpg (sRGB), <name>_normal.jpg (OpenGL), <name>_orm.jpg (R=AO, G=roughness, B=height)
   Foliage atlases get RGBA albedo PNGs. Two sizes: 2048 and 1024 (_1024 suffix).
usage: python pack_polyhaven_textures.py <polyhaven_dl_dir> <out_dir> [only_name,...]"""
import sys, os
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
os.makedirs(OUT, exist_ok=True)
SETS = {  # game name -> poly haven id
    'ph_floor': 'forest_leaves_04', 'ph_path': 'forest_ground_04', 'ph_riverbed': 'river_small_rocks', 'ph_mud': 'brown_mud_leaves_01',
    'ph_rock': 'rock_face_03', 'ph_mossrock': 'mossy_rock', 'ph_lichen': 'lichen_rock', 'ph_bark': 'bark_brown_02', 'ph_gravel': 'rocky_trail',
}
def L(p, mode):
    return Image.open(p).convert(mode)
for name, pid in SETS.items():
    if ONLY and name not in ONLY: continue
    d = f'{SRC}/tex/{pid}'
    alb = L(f'{d}/Diffuse_2k.jpg', 'RGB'); nrm = L(f'{d}/nor_gl_2k.jpg', 'RGB')
    ao = L(f'{d}/AO_2k.jpg', 'L') if os.path.exists(f'{d}/AO_2k.jpg') else Image.new('L', alb.size, 255)
    rg = L(f'{d}/Rough_2k.jpg', 'L')
    hg = L(f'{d}/Displacement_2k.jpg', 'L') if os.path.exists(f'{d}/Displacement_2k.jpg') else Image.new('L', alb.size, 128)
    orm = Image.merge('RGB', (ao, rg.resize(alb.size), hg.resize(alb.size)))
    for s, suf in ((2048, ''), (1024, '_1024')):
        for img, k, q in ((alb, 'albedo', 88), (nrm, 'normal', 92), (orm, 'orm', 88)):
            img.resize((s, s), Image.LANCZOS).save(f'{OUT}/{name}{suf}_{k}.jpg', quality=q)
    print('packed', name)
# fir twig atlas (RGBA) and grass atlas
for name, pid, pre in (('ph_twig', 'fir_tree_01', 'twig_'), ('ph_grass', 'grass_medium_01', '')):
    if ONLY and name not in ONLY: continue
    d = f'{SRC}/tex/{pid}'
    diff = L(f'{d}/{pre}diff_2k.jpg' if pre else f'{d}/Diffuse_2k.jpg', 'RGB')
    alpha = L(f'{d}/{pre}alpha_2k.jpg' if pre else f'{d}/Alpha_2k.jpg', 'L')
    nrm = L(f'{d}/{pre}nor_gl_2k.jpg' if pre else f'{d}/nor_gl_2k.jpg', 'RGB')
    rg = L(f'{d}/{pre}rough_2k.jpg' if pre else f'{d}/Rough_2k.jpg', 'L')
    rgba = diff.copy(); rgba.putalpha(alpha.resize(diff.size))
    for s, suf in ((2048, ''), (1024, '_1024')):
        rgba.resize((s, s), Image.LANCZOS).save(f'{OUT}/{name}{suf}_albedo.png', optimize=True)
        nrm.resize((s, s), Image.LANCZOS).save(f'{OUT}/{name}{suf}_normal.jpg', quality=92)
        Image.merge('RGB', (Image.new('L', (s, s), 255), rg.resize((s, s)), Image.new('L', (s, s), 128))).save(f'{OUT}/{name}{suf}_orm.jpg', quality=88)
    print('packed', name)
