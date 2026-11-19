"""Imports downloaded Poly Haven (CC0) glTF models, decimates every mesh to a web/mobile triangle budget
(UVs preserved so the scanned normal/roughness maps still apply), and exports one GLB per asset with its
PBR textures embedded as JPEG.  usage: python process_polyhaven_models.py <polyhaven_dl_dir> <out_dir>"""
import sys, os, glob
import bpy

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# asset -> triangle budget per mesh object
BUDGET = {
    'rock_moss_set_01': 3500, 'rock_moss_set_02': 2500, 'boulder_01': 6000, 'rock_07': 1500, 'rock_09': 900, 'stone_01': 900,
    'rock_face_01': 6000, 'rock_face_02': 6000, 'tree_stump_01': 6000, 'tree_stump_02': 6000, 'dead_tree_trunk': 6000,
    'dead_tree_trunk_02': 8000, 'pine_roots': 6000, 'root_cluster_02': 2500, 'single_root': 3500, 'fern_02': 2400, 'moss_01': 400,
    'shrub_03': 1600, 'shrub_04': 4000, 'nettle_plant': 2000, 'dandelion_01': 3000, 'weed_plant_02': 1500,
    'dry_branches_medium_01': 2500, 'periwinkle_plant': 2500,
    'bark_debris_01': 1200, 'namaqualand_stones_01': 900, 'root_cluster_01': 3000,
    # understory: grasses, flowers, wood sorrel, low shrubs, real saplings
    'grass_medium_01': 1400, 'grass_medium_02': 1600, 'grass_bermuda_01': 300, 'celandine_01': 1800, 'shrub_01': 7000,
    'shrub_02': 4000, 'shrub_sorrel_01': 700, 'flower_heliophila': 3500, 'pine_sapling_small': 7000, 'fir_sapling': 7000,
    'flower_empodium': 2500, 'flower_stinkkruid': 2500, 'leipoldtia_schultzei': 3000, 'flower_ursinia': 2500,
}
ONLY = sys.argv[3:]
for d in sorted(glob.glob(f'{SRC}/models/*')):
    name = os.path.basename(d)
    if name not in BUDGET or (ONLY and name not in ONLY): continue
    g = glob.glob(d + '/*.gltf')[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=g)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tot = 0
    for o in obs:
        o.data.calc_loop_triangles(); n = len(o.data.loop_triangles)
        if n > BUDGET[name]:
            m = o.modifiers.new('Dec', 'DECIMATE'); m.ratio = BUDGET[name] / n; m.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.data.calc_loop_triangles(); tot += len(o.data.loop_triangles)
        # strip LOD suffixes so the game can address variants by stable names
        o.name = o.name.replace('_LOD0', '')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{name}.glb', export_format='GLB', use_selection=True, export_apply=True,
                              export_image_format='JPEG', export_image_quality=88, export_materials='EXPORT', export_yup=True)
    print('PH', name, len(obs), 'meshes', tot, 'tris', round(os.path.getsize(f'{OUT}/{name}.glb') / 1e6, 2), 'MB')
