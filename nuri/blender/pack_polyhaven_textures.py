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
    'ph_floor': 'forest_leaves_04', 'ph_path': 'roots', 'ph_riverbed': 'river_small_rocks', 'ph_mud': 'brown_mud_leaves_01',
    'ph_rock': 'rock_face_03', 'ph_mossrock': 'mossy_rock', 'ph_lichen': 'lichen_rock', 'ph_bark': 'bark_brown_02', 'ph_gravel': 'rocky_trail',
    # chapter 2: the apartment (floor, walls, balcony tiles, bedding, rug), the car's seats, the stranger's jeans
    # (the game ships only the 1024 size of tile, linen, rug, seat and denim)
    'hs_floor': 'wood_floor', 'hs_wall': 'white_plaster_02', 'hs_tile': 'floor_tiles_06', 'hs_linen': 'rough_linen', 'hs_rug': 'curly_teddy_natural',
    'hs_seat': 'poly_wool_herringbone', 'hs_denim': 'denim_fabric', 'hs_brick': 'brick_wall_02',
    'hs_roof': 'grey_roof_01', 'hs_siding': 'white_planks_clean', 'hs_lawn': 'leafy_grass',
    'hs_asphalt': 'asphalt_01', 'hs_pavement': 'concrete_pavement',
    # the house for real: painted plaster, worn oak, linoleum, marble, subway tile, stained oak, veneer, jacquard, carpet, stucco
    'hs_paint': 'painted_plaster_wall', 'hs_oak': 'wood_floor_worn', 'hs_lino': 'old_linoleum_flooring_01', 'hs_marble': 'marble_01',
    'hs_subway': 'long_white_tiles', 'hs_stain': 'wood_table_worn', 'hs_veneer': 'mocha_oak_veneer', 'hs_jacquard': 'quatrefoil_jacquard_fabric',
    'hs_carpet': 'dirty_carpet', 'hs_stucco': 'white_stucco_02', 'hs_fabric': 'fabric_pattern_07',
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
