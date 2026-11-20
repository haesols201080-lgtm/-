"""Relics of the giants: small photoscanned human objects (Poly Haven, CC0) prepared for the game —
kept at real size, decimated to a small budget, textures resized to 512 px (they are small on screen), and each
model's pieces joined into one object per material. usage: python process_relics.py <src_dir> <out_dir>"""
import sys, os
import bpy

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
IDS = ['pocket_watch', 'seadogs_compass', 'rubber_duck_toy', 'can_rusted', 'garden_gloves_01', 'digital_wrist_watch', 'baseball_01',
       'measuring_tape_01', 'screwdriver', 'Camera_01']
BUDGET = 6000

for pid in IDS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = os.path.join(SRC, pid)
    gl = next(f for f in os.listdir(d) if f.endswith('.gltf'))
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, gl))
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
    if tris > BUDGET:
        r = BUDGET / tris
        for o in obs:
            m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = r; m.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='dec')
    for im in bpy.data.images:
        if im.size[0] > 512: im.scale(512, 512)
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    out = os.path.join(OUT, f'{pid}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_materials='EXPORT', export_image_format='JPEG',
                              export_image_quality=85, export_yup=True, export_apply=True)
    after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
    print('RELIC', pid, tris, '->', after, round(os.path.getsize(out) / 1e3), 'kB')
