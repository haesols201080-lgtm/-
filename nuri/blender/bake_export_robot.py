"""Game export of Nuri WITH baked surface detail, so the robot carries the same kind of high-frequency
material information as the scanned forest around it.

Same assembly as export_robot.py (rigid parts -> 100% bone weights, joined per material, AO in vertex
colors), plus: every joined mesh gets its own UV atlas and the Blender procedural materials (orange-peel
paint, chipped edges exposing aluminium, scratches, cavity grime, brushed metal, knit fabric) are baked
with Cycles into base color / roughness+metal / normal textures that are exported in the GLB.

usage: python bake_export_robot.py <in.blend> <out.glb> [size]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
bpy.ops.wm.open_mainfile(filepath=src)
bpy.ops.preferences.addon_enable(module='cycles')
arm = bpy.data.objects['NuriRig']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'

def sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# 1) rigid parts -> world-space meshes with bone weights (as export_robot.py)
for o in meshes:
    if o.parent_type == 'BONE':
        bone = o.parent_bone; mw = o.matrix_world.copy()
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me; o.parent = None; o.matrix_world = mw
        sel([o]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        vg = o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    else:
        for m in [m for m in o.modifiers if m.type != 'ARMATURE']:
            sel([o]); bpy.ops.object.modifier_apply(modifier=m.name)
        for m in list(o.modifiers): o.modifiers.remove(m)
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        sel([o]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 2) AO into vertex colors (cavities between parts)
sc.cycles.samples = 64
w = bpy.data.worlds.new('AOW'); sc.world = w
try: w.light_settings.distance = 0.03
except Exception: pass
for o in meshes:
    ca = o.data.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); o.data.color_attributes.active_color = ca
sel(meshes); bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

# 3) join per material
by_mat = {}
for o in meshes:
    by_mat.setdefault(o.data.materials[0].name if o.data.materials else 'none', []).append(o)
joined = []
for name, objs in by_mat.items():
    sel(objs); bpy.ops.object.join()
    j = bpy.context.active_object; j.name = 'Nuri_' + name.replace('Nuri_', '')
    joined.append(j)

# 4) bake procedural materials to textures (skip emissive / screen parts: they stay procedural in the game)
SKIP = ('Glow', 'Screen', 'LensGlass', 'Decal')
sc.cycles.samples = 24
w.light_settings.distance = 0.006
def new_img(name, size, data=False):
    im = bpy.data.images.new(name, size, size, alpha=False, float_buffer=False)
    if data: im.colorspace_settings.name = 'Non-Color'
    return im

def bake_into(obj, mat, img, btype, **kw):
    nt = mat.node_tree
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; n.select = True; nt.nodes.active = n
    sel([obj])
    bpy.ops.object.bake(type=btype, margin=4, use_clear=True, **kw)
    nt.nodes.remove(n)

def emit_bake(obj, mat, sock, img):
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']; out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    em = nt.nodes.new('ShaderNodeEmission'); old = [l.from_socket for l in out.inputs['Surface'].links]
    inp = bsdf.inputs[sock]
    if inp.links: nt.links.new(inp.links[0].from_socket, em.inputs['Color'])
    else:
        v = inp.default_value
        try: em.inputs['Color'].default_value = (v[0], v[1], v[2], 1)
        except TypeError: em.inputs['Color'].default_value = (v, v, v, 1)
    em.inputs['Strength'].default_value = 1.0
    for l in list(out.inputs['Surface'].links): nt.links.remove(l)
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    bake_into(obj, mat, img, 'EMIT')
    for l in list(out.inputs['Surface'].links): nt.links.remove(l)
    if old: nt.links.new(old[0], out.inputs['Surface'])
    nt.nodes.remove(em)

for j in joined:
    tag = j.name.replace('Nuri_', '')
    if any(s in tag for s in SKIP):
        continue
    size = SIZE if tag in ('PaintWhite', 'FrameGraphite', 'PaintTeal') else SIZE // 2
    # dedicated UV atlas for baking (the authored UVs overlap between parts)
    me = j.data
    uv_bake = me.uv_layers.new(name='Bake')
    me.uv_layers.active = uv_bake
    sel([j]); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    mat = me.materials[0]
    col = new_img(f'{tag}_base', size); rgh = new_img(f'{tag}_rough', size, True); nrm = new_img(f'{tag}_normal', size, True); met = new_img(f'{tag}_metal', size, True)
    # base colour and metallic through the emission trick: a DIFFUSE/COLOR bake returns black on metallic
    # surfaces (frame, aluminium, chipped paint edges), the emission path returns the true albedo
    sc.cycles.samples = 4
    emit_bake(j, mat, 'Base Color', col)
    emit_bake(j, mat, 'Metallic', met)
    sc.cycles.samples = 24
    bake_into(j, mat, rgh, 'ROUGHNESS')
    bake_into(j, mat, nrm, 'NORMAL', normal_space='TANGENT')
    # glTF metallicRoughness texture: G = roughness, B = metal
    r = np.array(rgh.pixels[:], np.float32).reshape(-1, 4); m = np.array(met.pixels[:], np.float32).reshape(-1, 4)
    mr = new_img(f'{tag}_mr', size, True)
    px = np.ones((size * size, 4), np.float32); px[:, 1] = r[:, 0]; px[:, 2] = m[:, 0]
    mr.pixels.foreach_set(px.ravel())
    # replace the material with a plain glTF-friendly one that uses the baked maps on the Bake UVs
    gm = bpy.data.materials.new(mat.name + '_baked')
    try: gm.use_nodes = True
    except Exception: pass
    g = gm.node_tree; b = g.nodes['Principled BSDF']
    uvn = g.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Bake'
    tb = g.nodes.new('ShaderNodeTexImage'); tb.image = col
    tm = g.nodes.new('ShaderNodeTexImage'); tm.image = mr
    tn = g.nodes.new('ShaderNodeTexImage'); tn.image = nrm
    nm = g.nodes.new('ShaderNodeNormalMap'); nm.uv_map = 'Bake'
    sep = g.nodes.new('ShaderNodeSeparateColor')
    for t in (tb, tm, tn): g.links.new(uvn.outputs['UV'], t.inputs['Vector'])
    g.links.new(tb.outputs['Color'], b.inputs['Base Color'])
    g.links.new(tm.outputs['Color'], sep.inputs['Color'])
    g.links.new(sep.outputs['Green'], b.inputs['Roughness']); g.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    g.links.new(tn.outputs['Color'], nm.inputs['Color']); g.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    me.materials[0] = gm
    # keep only the bake UVs as the exported TEXCOORD_0
    for uvl in list(me.uv_layers):
        if uvl.name != 'Bake': me.uv_layers.remove(uvl)
    print('BAKED', tag, size)

for j in joined:
    j.parent = arm
    m = j.modifiers.new('Armature', 'ARMATURE'); m.object = arm
tot = 0
for j in joined:
    j.data.calc_loop_triangles(); tot += len(j.data.loop_triangles)
print('ROBOT meshes', len(joined), 'triangles', tot)
sel([arm] + joined)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=False, export_materials='EXPORT',
                          export_image_format='JPEG', export_image_quality=90, export_vertex_color='ACTIVE', export_yup=True,
                          export_skins=True, export_animations=False, export_normals=True, export_tangents=False)
print('exported', dst, round(os.path.getsize(dst) / 1e6, 2), 'MB')
