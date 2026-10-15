"""Converts Microsoft Rocketbox avatars (MIT licence) into the game's
characters: photo-textured, rigged people with retargeted animations.

    python blender/rocketbox.py <rocketbox checkout> [role ...]

The checkout must contain Assets/Avatars/<group>/<Name>/{Export,Textures}
for the avatars named in ROLES and the animation FBX files in CLIPS
(tools/fetch_rocketbox.sh fetches exactly those with a sparse checkout).
Writes assets/models/char_<role>.glb, replacing the procedural people.
"""
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'models')

# role: (avatar path under Assets/Avatars, sex, options)
ROLES = {
    'party_man': ('Professions/Construction_Male_02', 'm', {'tint': 'party'}),
    'party_man_b': ('Professions/Construction_Male_05', 'm', {'tint': 'party'}),
    'winston': ('Professions/Construction_Male_06', 'm', {'tint': 'party'}),
    'syme': ('Professions/Construction_Male_03', 'm', {'tint': 'party'}),
    'parsons': ('Professions/Construction_Male_04', 'm', {'tint': 'party'}),
    'party_woman': ('Professions/Business_Female_01', 'f', {'tint': 'navy'}),
    'julia': ('Professions/Business_Female_04', 'f', {'tint': 'navy'}),
    'obrien': ('Professions/Business_Male_03', 'm', {}),
    'thought_police': ('Professions/Police_Male_03', 'm', {'tint': 'police'}),
    'guard': ('Professions/Security_Male_01', 'm', {'tint': 'police'}),
    'prole_man': ('Professions/Gardener_Male_01', 'm', {'tint': 'worn'}),
    'prole_woman': ('Adults/Female_Adult_11', 'f', {'tint': 'worn'}),
    'charrington': ('Adults/Male_Adult_03', 'm', {'tint': 'worn'}),
    'child': ('Children/Male_Child_01', 'm', {'tint': 'worn'}),
}

A = 'Assets/Animations/all_animations_max_motextr_'
# game clip: (male file, female file); xy = horizontal motion removed
CLIPS = {
    'idle': (A + 'static/m_idle_neutral_01.max.fbx', A + 'static/f_idle_neutral_01.max.fbx'),
    'walk': (A + 'xy/m_walk_neutral.max.fbx', A + 'xy/f_walk_neutral_01.max.fbx'),
    'run': (A + 'xy/m_run_neutral.max.fbx', A + 'xy/f_run_neutral.max.fbx'),
    'sit': (A + 'static/m_sit_chair_idle_neutral_01.max.fbx', A + 'static/f_sit_chair_idle_neutral_01.max.fbx'),
    'shout': (A + 'static/m_cheer_01.max.fbx', A + 'static/f_cheer_01.max.fbx'),
    'talk': (A + 'static/m_gestic_talk_neutral_01.max.fbx', A + 'static/f_gestic_talk_neutral_01.max.fbx'),
    'kneel': (A + 'static/m_crouch_idle.max.fbx', A + 'static/f_crouch_idle.max.fbx'),
    'look': (A + 'static/m_idle_look_around_01.max.fbx', A + 'static/f_idle_look_around_01.max.fbx'),
}

# a few bones get short names so game code can find them (head look-at)
RENAME = {'Bip01 Head': 'head', 'Bip01 Neck': 'neck', 'Bip01 Pelvis': 'hips', 'Bip01 Spine2': 'chest'}

TEX_SIZE = {'color': 1024, 'normal': 512, 'opacity': 512}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def find_tex(texdir, prefix, kind):
    for f in os.listdir(texdir):
        lf = f.lower()
        if lf.startswith(prefix.lower()) and kind in lf:
            return os.path.join(texdir, f)
    return None


def load_px(path, size):
    img = bpy.data.images.load(path)
    if img.size[0] != size or img.size[1] != size:
        img.scale(size, size)
    a = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(size, size, 4)


def tint(px, mode):
    """Recolour clothing in linear-ish RGB: modern royal blue becomes the
    dull navy of Party overalls, police text and stripes are blacked out."""
    rgb = px[..., :3]
    mx = rgb.max(-1); mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    hue_blue = (rgb[..., 2] > rgb[..., 0] * 1.25) & (rgb[..., 2] >= rgb[..., 1])
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    if mode == 'party':
        m = hue_blue & (sat > 0.25)
        grey = lum[..., None]
        navy = grey * np.array([0.62, 0.72, 0.95]) * 0.85
        rgb[m] = (rgb[m] * 0.3 + navy[m] * 0.7)
        # yellow-tan safety boots and belts read as modern: darken them
        tan = (rgb[..., 0] > rgb[..., 2] * 1.5) & (sat > 0.35) & (lum > 0.35)
        rgb[tan] = rgb[tan] * np.array([0.42, 0.36, 0.30])
    elif mode == 'navy':
        dark = (lum < 0.22) & (sat < 0.35)
        rgb[dark] = rgb[dark] * np.array([0.82, 0.92, 1.25])
    elif mode == 'police':
        bright = (lum > 0.45) & (sat < 0.35)
        rgb[bright] = rgb[bright] * 0.12
    elif mode == 'worn':
        grey = lum[..., None]
        rgb[:] = rgb * 0.7 + grey * 0.3 * np.array([1.0, 0.97, 0.92])
        rgb *= 0.92
    px[..., :3] = np.clip(rgb, 0, 1)
    return px


def save_jpg(name, px, outdir):
    h, w = px.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    path = os.path.join(outdir, name + '.jpg')
    img.filepath_raw = path
    img.file_format = 'JPEG'
    img.save(filepath=path, quality=84)
    bpy.data.images.remove(img)
    out = bpy.data.images.load(path)
    return out


def save_png(name, px, outdir):
    h, w = px.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(px.astype(np.float32).ravel())
    path = os.path.join(outdir, name + '.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    return bpy.data.images.load(path)


def build_material(role, slot_name, texdir, tmp, opts):
    """New Principled material from the avatar's colour/normal/opacity maps."""
    prefix = slot_name.split('_')[0] + '_' + slot_name.split('_')[1] if '_' in slot_name else slot_name
    part = slot_name.split('_')[1] if '_' in slot_name else 'body'
    m = bpy.data.materials.new(f'rb_{role}_{part}')
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    p.inputs['Roughness'].default_value = 0.5 if part == 'head' else 0.82
    col = find_tex(texdir, prefix, 'color')
    if col:
        px = load_px(col, TEX_SIZE['color'])
        if part == 'body' and opts.get('tint'):
            px = tint(px, opts['tint'])
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = save_jpg(f'{role}_{part}_c', px, tmp)
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
    nrm = find_tex(texdir, prefix, 'normal')
    if nrm:
        px = load_px(nrm, TEX_SIZE['normal'])
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = save_jpg(f'{role}_{part}_n', px, tmp)
        t.image.colorspace_settings.name = 'Non-Color'
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(t.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    opa = find_tex(texdir, prefix, 'opacity')
    if opa:
        cpx = load_px(col, TEX_SIZE['opacity']) if col else None
        apx = load_px(opa, TEX_SIZE['opacity'])
        rgba = np.concatenate([cpx[..., :3] if cpx is not None else apx[..., :3], apx[..., :1]], -1)
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = save_png(f'{role}_{part}_a', rgba, tmp)
        for l in list(p.inputs['Base Color'].links):
            nt.links.remove(l)
        nt.links.new(t.outputs['Color'], p.inputs['Base Color'])
        nt.links.new(t.outputs['Alpha'], p.inputs['Alpha'])
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else None
        try:
            m.surface_render_method = 'DITHERED'
        except Exception:
            pass
        p.inputs['Roughness'].default_value = 0.6
    return m


def add_sash(mesh, arm):
    """Julia's narrow scarlet sash, wound round the waist of her overalls."""
    bm = bmesh.new()
    bm.from_mesh(mesh.data)
    pelvis = arm.data.bones['hips'].head_local
    spine = arm.data.bones['Bip01 Spine'].head_local
    z = (pelvis.z * 0.35 + spine.z * 0.65)
    zmin, zmax = z - 0.03, z + 0.03
    # measure the waist from the body's own vertices
    pts = [arm.matrix_world.inverted() @ (mesh.matrix_world @ v.co) for v in bm.verts]
    ring = [p for p in pts if zmin < p.z < zmax]
    bm.free()
    if not ring:
        return
    cx = sum(p.x for p in ring) / len(ring); cy = sum(p.y for p in ring) / len(ring)
    seg = 24
    radii = []
    for k in range(seg):
        a = k / seg * math.tau
        d = Vector((math.cos(a), math.sin(a)))
        best = max((Vector((p.x - cx, p.y - cy)).dot(d) for p in ring), default=0.15)
        radii.append(best + 0.012)
    sm = bpy.data.meshes.new('sash')
    sb = bmesh.new()
    rows = []
    for zz in (zmin, zmax):
        rows.append([sb.verts.new((cx + math.cos(k / seg * math.tau) * radii[k], cy + math.sin(k / seg * math.tau) * radii[k], zz)) for k in range(seg)])
    for k in range(seg):
        j = (k + 1) % seg
        sb.faces.new((rows[0][k], rows[0][j], rows[1][j], rows[1][k]))
    sb.to_mesh(sm); sb.free()
    so = bpy.data.objects.new('sash', sm)
    bpy.context.scene.collection.objects.link(so)
    so.matrix_world = arm.matrix_world
    mat = bpy.data.materials.new('sash_red'); sm.materials.append(mat)
    vg = so.vertex_groups.new(name='Bip01 Spine')
    vg.add(list(range(len(sm.vertices))), 1.0, 'REPLACE')
    so.parent = arm
    so.matrix_parent_inverse = arm.matrix_world.inverted()
    mod = so.modifiers.new('rig', 'ARMATURE'); mod.object = arm
    bpy.ops.object.select_all(action='DESELECT')
    so.select_set(True); mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.join()


def fcurve_lists(act):
    try:
        return [act.fcurves]
    except AttributeError:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out.append(cb.fcurves)
        return out


def prune(arm, act):
    """Keep what reads on screen: bone rotations (hips also move), no
    face bones, no scale keys, every other frame on slow clips."""
    head = arm.data.bones['head']
    face = {b.name for b in head.children_recursive}
    slow = act.name not in ('walk', 'run')
    for fcs in fcurve_lists(act):
        for fc in list(fcs):
            path = fc.data_path
            bone = path.split('"')[1] if '"' in path else ''
            drop = (bone in face or path.endswith('scale') or
                    (path.endswith('location') and bone != 'hips'))
            if drop:
                fcs.remove(fc)
                continue
            if slow:
                kps = fc.keyframe_points
                n = len(kps)
                for i in range(n - 2, 0, -1):
                    if i % 2 == 1:
                        kps.remove(kps[i], fast=True)
                fc.update()


def retarget(arm, path, name, renamed):
    """Bake an animation FBX on the same Biped skeleton onto our armature."""
    before_objs = set(bpy.data.objects)
    before_acts = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path)
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    src = next((o for o in new_objs if o.type == 'ARMATURE'), None)
    acts = [a for a in bpy.data.actions if a not in before_acts]
    if not src or not acts:
        print('  no animation in', path)
        for o in new_objs:
            bpy.data.objects.remove(o, do_unlink=True)
        return None
    act = max(acts, key=lambda a: a.frame_range[1] - a.frame_range[0])
    src.animation_data.action = act
    try:
        src.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    back = {v: k for k, v in renamed.items()}
    cons = []
    for pb in arm.pose.bones:
        sname = back.get(pb.name, pb.name)
        if sname not in src.pose.bones:
            continue
        c = pb.constraints.new('COPY_ROTATION'); c.target = src; c.subtarget = sname
        cons.append((pb, c))
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    arm.animation_data_create()
    arm.animation_data.action = None
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True,
                     clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = arm.animation_data.action
    baked.name = name
    # The pelvis translation is copied straight from the source curves: both
    # rigs share the Biped rest frame and units, so no conversion is needed.
    for fcs in fcurve_lists(baked):
        for fc in list(fcs):
            if fc.data_path == 'pose.bones["hips"].location':
                fcs.remove(fc)
    for sfc in [fc for fcs in fcurve_lists(act) for fc in fcs]:
        if sfc.data_path == 'pose.bones["Bip01 Pelvis"].location':
            dst = baked.fcurve_ensure_for_datablock(arm, 'pose.bones["hips"].location', index=sfc.array_index)
            for kp in sfc.keyframe_points:
                dst.keyframe_points.insert(kp.co.x, kp.co.y, options={'FAST'})
            dst.update()
    prune(arm, baked)
    arm.animation_data.action = None
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    st = tr.strips.new(name, f0, baked)
    for o in new_objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)
    for a in acts:
        if a.name in bpy.data.actions and a is not baked:
            bpy.data.actions.remove(a)
    return baked


def convert(role, repo, tmp):
    path, sex, opts = ROLES[role]
    name = os.path.basename(path)
    base = os.path.join(repo, 'Assets', 'Avatars', path)
    fbx = os.path.join(base, 'Export', name + '.fbx')
    texdir = os.path.join(base, 'Textures')
    if not os.path.exists(fbx):
        print('missing', fbx); return False
    reset()
    bpy.ops.import_scene.fbx(filepath=fbx)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mesh = max(meshes, key=lambda o: len(o.data.vertices))
    for o in meshes:
        if o is not mesh:
            bpy.data.objects.remove(o, do_unlink=True)
    # drop helmets, hard hats and other modern kit
    bad = [i for i, m in enumerate(mesh.data.materials) if m and any(k in m.name.lower() for k in ('helmet', 'equip', 'glasses', 'cap_'))]
    if bad:
        bm = bmesh.new(); bm.from_mesh(mesh.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in bad], context='FACES')
        bm.to_mesh(mesh.data); bm.free()
    # fresh materials from the textures
    for i, slot in enumerate(mesh.material_slots):
        if not slot.material:
            continue
        slot.material = build_material(role, slot.material.name, texdir, tmp, opts)
    # short names for the bones game code looks for
    renamed = {}
    for old, new in RENAME.items():
        b = arm.data.bones.get(old)
        if b:
            b.name = new
            renamed[old] = new
    if opts.get('sash'):
        add_sash(mesh, arm)
    for clip, files in CLIPS.items():
        f = files[0] if sex == 'm' else files[1]
        p = os.path.join(repo, f)
        if not os.path.exists(p):
            p = os.path.join(repo, files[0])
        if os.path.exists(p):
            retarget(arm, p, clip, renamed)
        else:
            print('  missing clip', f)
    # FBX brings the rig in centimetres under a 0.01 object scale. Retargeting
    # ran in those units; now bake the scale into the data and scale the
    # hips' location keys to match, so the glTF is in metres at unit scale.
    arm.animation_data.action = None
    k = arm.scale.x
    if os.environ.get('RB_APPLY') and abs(k - 1) > 1e-4:
        bpy.ops.object.select_all(action='DESELECT')
        arm.select_set(True)
        for o in bpy.data.objects:
            if o.parent == arm:
                o.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        for act in bpy.data.actions:
            for fcs in fcurve_lists(act):
                for fc in fcs:
                    if fc.data_path.endswith('location'):
                        for kp in fc.keyframe_points:
                            kp.co.y *= k; kp.handle_left.y *= k; kp.handle_right.y *= k
                        fc.update()
    # Rocketbox faces +Y; the game's models face -Y (+Z in three.js)
    arm.rotation_euler.z += math.pi
    out = os.path.join(OUT, f'char_{role}.glb')
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True); mesh.select_set(True)
    for o in bpy.data.objects:
        if o.parent == arm and o.type == 'MESH':
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True,
                              export_animation_mode='NLA_TRACKS', export_skins=True, export_image_format='JPEG',
                              export_optimize_animation_size=True, export_apply=False, export_yup=True)
    dims = mesh.dimensions
    print(f'{role:16s} {os.path.getsize(out) / 1024:8.1f} KB  verts {len(mesh.data.vertices)} dims {tuple(round(d, 2) for d in dims)}')
    return True


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    repo = args[0]
    roles = args[1:] or list(ROLES)
    tmp = os.path.join(os.path.dirname(repo.rstrip('/')), 'rb_tex')
    os.makedirs(tmp, exist_ok=True)
    for r in roles:
        convert(r, repo, tmp)
