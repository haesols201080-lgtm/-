"""Photoscanned rocks for the game: high -> low with re-baked normals.

Poly Haven ships each scan as a fairly heavy mesh plus a normal map made for that mesh. Decimating it and keeping the
old normal map gives the "crumpled foil" look (the map no longer matches the surface under it). Here every rock is
decimated to a game budget (UVs kept), then a new tangent-space normal map is baked from the full scan (its geometry
*and* its own normal map) onto the light mesh with Cycles (selected-to-active), so the light mesh shades like the scan.
Albedo and roughness keep the scan's UV layout and are reused as they are.

usage: python bake_rocks.py <src_dir (models2k)> <out_dir> [ids...]
"""
import sys, os, math
import bpy, bmesh

SRC, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3:]
os.makedirs(OUT, exist_ok=True)
# id: (target triangles for the largest piece, normal-map size)
JOBS = {'boulder_01': (22000, 2048), 'rock_moss_set_01': (5000, 2048), 'rock_moss_set_02': (5000, 2048), 'rock_07': (9000, 1024), 'rock_09': (8000, 1024)}

def tris(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def tex_node(nt, path, data):
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(path, check_existing=True)
    if data: n.image.colorspace_settings.name = 'Non-Color'
    return n

for pid, (budget, size) in JOBS.items():
    if ONLY and pid not in ONLY: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = os.path.join(SRC, pid)
    bpy.ops.import_scene.gltf(filepath=os.path.join(d, f'{pid}_2k.gltf'))
    his = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # bake world-space: apply all transforms so the pieces keep their relative layout
    bpy.ops.object.select_all(action='DESELECT')
    for o in his: o.select_set(True)
    bpy.context.view_layer.objects.active = his[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tex = os.path.join(d, 'textures')
    diff = next(os.path.join(tex, f) for f in os.listdir(tex) if '_diff_' in f)
    rough = next((os.path.join(tex, f) for f in os.listdir(tex) if '_arm_' in f or '_rough_' in f), None)
    big = max(tris(o) for o in his)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4; sc.render.bake.use_clear = False
    los = []
    img = bpy.data.images.new(f'{pid}_nrm', size, size, alpha=False); img.colorspace_settings.name = 'Non-Color'
    img.generated_color = (0.5, 0.5, 1.0, 1.0)
    for hi in his:
        lo = hi.copy(); lo.data = hi.data.copy(); lo.name = hi.name + '_lo'; sc.collection.objects.link(lo)
        ratio = min(1.0, budget * (tris(hi) / big) / max(1, tris(hi)))
        if ratio < 0.98:
            m = lo.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio; m.use_collapse_triangulate = True
            bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
            bpy.ops.object.modifier_apply(modifier='dec')
        for p in lo.data.polygons: p.use_smooth = True
        # new material for the light mesh: scan albedo + roughness, baked normal
        mat = bpy.data.materials.new(pid); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
        nt.links.new(tex_node(nt, diff, False).outputs['Color'], bsdf.inputs['Base Color'])
        if rough:
            r = tex_node(nt, rough, True)
            if '_arm_' in rough:
                sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(r.outputs['Color'], sep.inputs[0]); nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
            else: nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
        bsdf.inputs['Metallic'].default_value = 0.0
        tgt = nt.nodes.new('ShaderNodeTexImage'); tgt.image = img; nt.nodes.active = tgt
        lo.data.materials.clear(); lo.data.materials.append(mat)
        # bake from the full scan
        dim = max(hi.dimensions)
        bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
        bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True, cage_extrusion=0.012 * dim, max_ray_distance=0.06 * dim, margin=4)
        print('baked', pid, hi.name, tris(hi), '->', tris(lo))
        los.append((lo, mat, tgt))
    path = os.path.join(OUT, f'{pid}_nrm.png')
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    # wire the baked map in as the normal map and export the light meshes only
    for lo, mat, tgt in los:
        nt = mat.node_tree; nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(tgt.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    for hi in his: bpy.data.objects.remove(hi)
    bpy.ops.object.select_all(action='DESELECT')
    for lo, _, _ in los: lo.select_set(True)
    out = os.path.join(OUT, f'{pid}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_materials='EXPORT', export_image_format='JPEG',
                              export_image_quality=90, export_yup=True, export_normals=True, export_apply=True)
    print('EXPORT', pid, len(los), 'pieces', sum(tris(o) for o, _, _ in los), 'tris', round(os.path.getsize(out) / 1e6, 2), 'MB')
