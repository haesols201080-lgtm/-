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
