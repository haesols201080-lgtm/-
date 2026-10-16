"""Builds every model and texture for the game.

    pip install bpy            # Blender as a Python module (5.x)
    python blender/build_assets.py [--only name,name] [--no-textures] [--preview DIR]

or inside Blender:  blender -b -P blender/build_assets.py -- [same flags]

Writes assets/models/*.glb and assets/textures/*. Run tools/pack_assets.mjs
afterwards to bundle them for the browser."""
import os, sys, math, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from mathutils import Vector
import lib, textures, buildings, props, characters, nature, monument

ROOT = os.path.dirname(HERE)
MODELS = os.path.join(ROOT, 'assets', 'models')
TEXTURES = os.path.join(ROOT, 'assets', 'textures')


def buildings_table():
    b = buildings
    return {
        'victory_mansions': b.victory_mansions,
        'party_block_a': lambda: b.party_block('party_block_a', 30, 12, 6, seed=12),
        'party_block_b': lambda: b.party_block('party_block_b', 22, 14, 5, seed=13, cols=6, ww=1.5, wh=1.8),
        'party_block_c': lambda: b.party_block('party_block_c', 48, 14, 9, seed=14, cols=16, entrance=True),
        'inner_block': b.inner_party_house,
        'prole_terrace': lambda: b.prole_terrace('prole_terrace', 4, seed=3),
        'prole_terrace_b': lambda: b.prole_terrace('prole_terrace_b', 5, seed=4),
        'prole_ruin': lambda: b.prole_terrace('prole_ruin', 4, seed=5, ruined=2),
        'shop': lambda: b.prole_terrace('shop', 2, seed=6, shop=True),
        'pub': lambda: b.prole_terrace('pub', 2, seed=9, pub=True),
        'minitrue': lambda: b.pyramid('minitrue', 170, 13, 11, 5.6),
        'pyramid_far': lambda: b.pyramid('pyramid_far', 170, 13, 11, 5.6, windows=False, slogans=False),
        'miniluv': b.miniluv,
        'fence_wire': b.fence_wire,
        'guard_tower': b.guard_tower,
        'mg_nest': b.sandbag_ring,
        'monument': lambda: monument.monument(characters.statue),
        'church': b.st_martins,
        'station': b.station,
        'community_centre': b.community_centre,
        'cafe': b.cafe,
    }


def table():
    t = {}
    t.update(buildings_table())
    t.update(props.ALL)
    t.update(nature.ALL)
    for name, spec in characters.CHARACTERS.items():
        t['char_' + name] = (lambda n=name, s=spec: characters.build_character(n, s))
    return t


def preview(objs, path):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.device = 'CPU'
    scene.render.resolution_x, scene.render.resolution_y = 640, 480
    world = bpy.data.worlds.new('w'); scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.58, 0.62, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    bpy.context.view_layer.update()
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    ctr = (mn + mx) / 2; size = (mx - mn).length
    cam_d = bpy.data.cameras.new('c'); cam_d.lens = 35
    cam = bpy.data.objects.new('c', cam_d); scene.collection.objects.link(cam)
    cam.location = ctr + Vector((size * 0.55, -size * 0.85, size * 0.35))
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    sun_d = bpy.data.lights.new('s', 'SUN'); sun_d.energy = 3
    sun = bpy.data.objects.new('s', sun_d); scene.collection.objects.link(sun)
    sun.rotation_euler = (0.8, 0.2, 0.6)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main(argv):
    only = None; do_tex = True; prev = None
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    if '--no-textures' in argv:
        do_tex = False
    if '--preview' in argv:
        prev = argv[argv.index('--preview') + 1]
        os.makedirs(prev, exist_ok=True)
    os.makedirs(MODELS, exist_ok=True)
    if do_tex and not only:
        lib.reset()
        t0 = time.time()
        textures.build_all(TEXTURES)
        print(f'textures {time.time() - t0:.1f}s')
    for name, fn in table().items():
        if only and name not in only:
            continue
        lib.reset()
        t0 = time.time()
        objs = fn()
        is_char = name.startswith('char_')
        bpy.context.view_layer.update()
        path = os.path.join(MODELS, name + '.glb')
        sel = []
        for o in objs:
            sel.append(o)
            sel.extend(o.children_recursive)
        lib.export(path, list(dict.fromkeys(sel)), anim=is_char)
        tris = sum(len(o.data.polygons) for o in sel if o.type == 'MESH')
        print(f'{name:22s} {os.path.getsize(path) / 1024:8.1f} KB  {tris:6d} faces  {time.time() - t0:.1f}s')
        if prev:
            for o in sel:
                if o.type == 'ARMATURE' and o.animation_data:
                    for tr in o.animation_data.nla_tracks:
                        tr.mute = tr.name != os.environ.get('POSE', 'idle')
            preview(sel, os.path.join(prev, name + '.png'))


if __name__ == '__main__':
    argv = sys.argv
    argv = argv[argv.index('--') + 1:] if '--' in argv else argv[1:]
    main(argv)
