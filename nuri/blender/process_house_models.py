"""Chapter 2 props: imports downloaded Poly Haven (CC0) glTF models, keeps the named objects, decimates each mesh to
a triangle budget and exports one GLB per asset (textures embedded as JPEG) into public/models/house/.
usage: python process_house_models.py <polyhaven_dl_dir> <out_dir> [only...]"""
import sys, os, glob
import bpy

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# asset -> (triangle budget per mesh, objects to keep or None for all)
ASSETS = {
    'rubber_boots': (6000, ['rubber_boots_dirty_l', 'rubber_boots_dirt_r']),   # the muddy pair: just back from the forest
    'wicker_basket_02': (6000, None), 'Sofa_01': (5000, None), 'ArmChair_01': (6000, None), 'CoffeeTable_01': (6000, None),
    'television_02': (3000, None), 'ClassicNightstand_01': (3000, None), 'GreenChair_01': (5000, None), 'WoodenTable_02': (2000, None),
    'desk_lamp_arm_01': (6000, None), 'potted_plant_02': (9000, None), 'potted_plant_04': (3000, None), 'Ottoman_01': (5000, None),
    'gamepad': (3500, None), 'ceramic_vase_01': (2500, None), 'cardboard_box_01': (4000, None), 'ClassicConsole_01': (8000, None),
    # the collector's things about the house
    'chess_set': (700, None), 'vintage_video_camera': (5000, None), 'binoculars': (4000, None), 'brass_candleholders': (2500, None),
    'pot_enamel_01': (3000, None), 'wine_bottles_01': (2500, None), 'modern_ceiling_lamp_01': (3000, None), 'round_spectacles': (2500, None),
    'boombox': (5000, None), 'marble_bust_01': (6000, None), 'vintage_suitcase': (5000, None),
    # the house furnished for real: living room, kitchen, bedroom, hall; outside: the yard and the street
    'side_table_01': (3000, None), 'wooden_bookshelf_worn': (6000, None), 'ornate_mirror_01': (5000, None), 'mantel_clock_01': (3000, None),
    'ceiling_fan': (4000, None), 'wall_clock': (2000, None), 'electric_stove': (8000, None), 'vintage_microwave': (4000, None),
    'wooden_cutting_board': (1000, None), 'dining_table': (5000, None), 'dining_chair_02': (4000, None), 'tea_set_01': (4000, None),
    'painted_wooden_nightstand': (4000, None), 'hanging_picture_frame_01': (1500, None), 'hanging_picture_frame_02': (1500, None),
    'hanging_picture_frame_03': (1500, None), 'fancy_picture_frame_01': (2500, None), 'throw_pillows_01': (4000, None),
    'book_encyclopedia_set_01': (4000, None), 'standing_picture_frame_01': (1500, None), 'wooden_bowl_01': (1500, None), 'jug_01': (2000, None),
    'covered_car': (9000, None), 'metal_trash_can': (3000, None), 'exterior_aircon_unit': (4000, None), 'garden_hose_wall_mounted_01': (5000, None),
    'shrub_01': (9000, None), 'shrub_02': (9000, None), 'shrub_03': (9000, None), 'shrub_04': (9000, None),
    'outdoor_table_chair_set_01': (8000, None), 'planter_box_01': (5000, None), 'watering_can_metal_01': (3000, None),
    'mousetrap': (2500, None), 'folding_wooden_stool': (3000, None), 'wicker_basket_01': (5000, None), 'plastic_crate_01': (3000, None),
    'drawer_cabinet': (6000, None), 'vintage_wooden_drawer_01': (5000, None), 'vintage_cabinet_01': (6000, None),
    # lived-in: things left about the house
    'classic_laptop': (3000, None), 'alarm_clock_01': (2000, None), 'Ukulele_01': (3000, None), 'baseball_bat': (1000, None), 'football': (1500, None),
    'fishermans_hat': (2500, None), 'postcard_set_01': (800, None), 'office_notepads': (1500, None), 'binder_notebook': (1500, None),
    'vintage_electric_kettle': (3000, None), 'wooden_spoon': (600, None), 'lemon': (600, None), 'yellow_onion': (800, None), 'wooden_bowl_02': (1500, None),
    'multi_cleaner_bottle': (1200, None), 'bleach_bottle': (1200, None), 'all_purpose_cleaner': (1200, None), 'dustpan': (1500, None),
    'plastic_broom': (2500, None), 'standing_picture_frame_02': (1500, None), 'fancy_picture_frame_02': (2500, None), 'pachira_aquatica_01': (9000, None),
    'calathea_orbifolia_01': (7000, None), 'anthurium_botany_01': (6000, None), 'Lantern_01': (3000, None), 'plastic_thermos': (1500, None),
    'portable_cassette_player': (2000, None), 'vintage_telephone_wall_clock': (3000, None), 'magnifying_glass_01': (1500, None),
    'plastic_bottle_gallon': (1500, None), 'stationery_supplies': (3000, None), 'croissant': (1000, None), 'Television_01': (4000, None),
    'round_wooden_table_01': (5000, None), 'round_wooden_table_02': (5000, None), 'painted_wooden_chair_01': (4000, None), 'painted_wooden_chair_02': (4000, None),
    'WoodenChair_01': (4000, None), 'painted_wooden_table': (4000, None), 'WoodenTable_01': (4000, None), 'gallinera_chair': (4000, None),
    'modern_wooden_cabinet': (4000, None), 'side_table_tall_01': (3000, None),
    'chinese_console_table': (4000, None), 'Rockingchair_01': (5000, None), 'SchoolDesk_01': (4000, None), 'Shelf_01': (3000, None),
    'steel_frame_shelves_01': (3000, None), 'wooden_display_shelves_01': (4000, None), 'painted_wooden_cabinet': (4000, None),
    'wooden_bucket_02': (2000, None), 'power_box_01': (2000, None), 'brass_pot_01': (2000, None), 'carved_wooden_plate': (1500, None), 'wooden_crate_02': (2000, None),
    'fire_hydrant': (3000, None), 'street_lamp_01': (4000, None), 'street_lamp_02': (4000, None), 'utility_box_01': (2000, None),
}
ONLY = sys.argv[3:]
for name, (budget, keep) in ASSETS.items():
    if ONLY and name not in ONLY: continue
    g = glob.glob(f'{SRC}/models/{name}/*.gltf')[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=g)
    if keep:
        for o in list(bpy.context.scene.objects):
            if o.type == 'MESH' and o.name not in keep: bpy.data.objects.remove(o, do_unlink=True)
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tot = 0
    for o in obs:
        o.data.calc_loop_triangles(); n = len(o.data.loop_triangles)
        if n > budget:
            m = o.modifiers.new('Dec', 'DECIMATE'); m.ratio = budget / n; m.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.data.calc_loop_triangles(); tot += len(o.data.loop_triangles)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{name}.glb', export_format='GLB', use_selection=True, export_apply=True,
                              export_image_format='JPEG', export_image_quality=88, export_materials='EXPORT', export_yup=True)
    print('HOUSE', name, len(obs), 'meshes', tot, 'tris', round(os.path.getsize(f'{OUT}/{name}.glb') / 1e6, 2), 'MB')
