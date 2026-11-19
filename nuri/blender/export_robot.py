"""Converts nuri_q*.blend (bone-parented hard-surface parts) into a game-ready GLB:
every part gets a rigid (100%) weight to its bone, AO is baked into vertex colors (cavities between parts),
then parts are joined per material into a handful of skinned meshes (few draw calls, mobile friendly).

usage: python export_robot.py <in.blend> <out.glb>
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Matrix
from common import *

src, dst = sys.argv[1], sys.argv[2]
bpy.ops.wm.open_mainfile(filepath=src)
bpy.ops.preferences.addon_enable(module='cycles')
arm = bpy.data.objects['NuriRig']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']

def sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# 1) make every rigid part a real mesh in world space with a 100% weight to its bone
for o in meshes:
    if o.parent_type == 'BONE':
        bone = o.parent_bone
        mw = o.matrix_world.copy()
        # apply modifiers (bevels, solidify) into the mesh
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        o.modifiers.clear(); o.data = me
        o.parent = None; o.matrix_world = mw
        sel([o]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        vg = o.vertex_groups.new(name=bone)
        vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    else:  # scarf tails: already skinned, bake solidify but keep groups
        mods = [m for m in o.modifiers if m.type != 'ARMATURE']
        for m in mods:
            sel([o]); bpy.ops.object.modifier_apply(modifier=m.name)
        for m in list(o.modifiers): o.modifiers.remove(m)
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        sel([o]); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 2) bake ambient occlusion into vertex colors across the assembled robot
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 64
w = bpy.data.worlds.new('AOW'); sc.world = w
try: w.light_settings.distance = 0.03
except Exception: pass
for o in meshes:
    me = o.data
    ca = me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = ca
sel(meshes)
bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)

# 3) join per material
by_mat = {}
for o in meshes:
    key = o.data.materials[0].name if o.data.materials else 'none'
    by_mat.setdefault(key, []).append(o)
joined = []
for name, objs in by_mat.items():
    sel(objs); bpy.ops.object.join()
    j = bpy.context.active_object; j.name = 'Nuri_' + name.replace('Nuri_', '')
    j.parent = arm
    m = j.modifiers.new('Armature', 'ARMATURE'); m.object = arm
    joined.append(j)
# simplify materials to plain factors for export (game rebuilds them by name)
tot = 0
for j in joined:
    j.data.calc_loop_triangles(); tot += len(j.data.loop_triangles)
print('ROBOT meshes', len(joined), 'triangles', tot)
sel([arm] + joined)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=False,
                          export_materials='PLACEHOLDER', export_vertex_color='ACTIVE', export_yup=True,
                          export_skins=True, export_animations=False, export_normals=True)
print('exported', dst)
