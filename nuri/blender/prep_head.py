"""The stranger's face: the Lee Perry-Smith head scan (Infinite-Realities, CC BY 3.0, via the three.js examples), decimated,
with its colour and tangent-space normal maps, scaled to a real head (23 cm chin to crown), facing +z, its neck at the
origin. usage: python prep_head.py <LeePerrySmith.glb> <col.jpg> <nrm.jpg> <out.glb>"""
import sys, bpy
src, col, nrm, out = sys.argv[1:5]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
for o in list(bpy.context.scene.objects):
    if o != ob: bpy.data.objects.remove(o)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
md = ob.modifiers.new('Dec', 'DECIMATE'); md.ratio = 7000 / len(ob.data.polygons); bpy.ops.object.modifier_apply(modifier=md.name)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# the scan is a bust: keep the head and a stub of neck (the hood covers the rest)
import bmesh
zs = [v.co.z for v in ob.data.vertices]; z0, z1 = min(zs), max(zs)
cut = z0 + (z1 - z0) * float(sys.argv[5] if len(sys.argv) > 5 else 0.3)
bm = bmesh.new(); bm.from_mesh(ob.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < cut], context='VERTS'); bm.to_mesh(ob.data); bm.free()
zs = [v.co.z for v in ob.data.vertices]; h = max(zs) - min(zs)
s = 0.25 / h
ob.scale = (s, s, s); bpy.ops.object.transform_apply(scale=True)
xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
ob.location = (-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)); bpy.ops.object.transform_apply(location=True)
m = bpy.data.materials.new('stranger_skin'); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = bpy.data.images.load(col); nt.links.new(tc.outputs[0], b.inputs['Base Color'])
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = bpy.data.images.load(nrm); tn.image.colorspace_settings.name = 'Non-Color'
nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
b.inputs['Roughness'].default_value = 0.55
ob.data.materials.clear(); ob.data.materials.append(m)
for p in ob.data.polygons: p.use_smooth = True
print('head dims', [round(d, 3) for d in ob.dimensions], 'faces', len(ob.data.polygons))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_materials='EXPORT', export_yup=True)
