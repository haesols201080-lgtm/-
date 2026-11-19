"""Cycles turnaround / pose renders of nuri.blend.  usage: python render_robot.py <blend> <out_dir> [samples] [mode]"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector, Euler
from common import *

BLEND, OUT = sys.argv[1], sys.argv[2]
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 64
MODE = sys.argv[4] if len(sys.argv) > 4 else 'turn'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
bpy.ops.wm.open_mainfile(filepath=BLEND)
bpy.ops.preferences.addon_enable(module='cycles')
sc = bpy.context.scene
world_hdri(os.path.join(ROOT, 'assets/hdri/forest.exr'), 0.9, math.radians(120))

# shadow-catcher floor + soft key/rim lights
bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0))
floor = bpy.context.active_object; floor.is_shadow_catcher = True
def area(name, loc, energy, size, color=(1, 1, 1)):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size; d.color = color
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0.2)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o
area('Key', (-0.9, -1.2, 1.4), 60, 0.8, (1.0, 0.96, 0.9))
area('Rim', (0.9, 1.1, 0.9), 45, 0.5, (0.75, 0.88, 1.0))
area('Fill', (1.2, -0.6, 0.3), 12, 1.2)

cam_d = bpy.data.cameras.new('Cam'); cam = bpy.data.objects.new('Cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.lens = 85
rig = bpy.data.objects['NuriRig']

def look(target, pos):
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()

def render(path, w, h):
    cycles_setup(SAMPLES, w, h, transparent=True)
    render_to(path)
    im = bpy.data.images.load(path)
    a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(im)
    return a

def background(h, w):
    yy = np.linspace(0, 1, h)[:, None, None]
    top, bot = np.array([0.075, 0.095, 0.13]), np.array([0.02, 0.028, 0.045])
    xx = np.linspace(-1, 1, w)[None, :, None]
    vign = 1 - 0.25 * xx ** 2
    return ((top * (1 - yy) + bot * yy) * vign) * np.ones((h, w, 3))

def save_png(arr, path):
    h, w = arr.shape[:2]
    im = bpy.data.images.new('out', w, h, alpha=False)
    rgba = np.concatenate([arr, np.ones((h, w, 1))], -1).astype(np.float32)
    im.pixels.foreach_set(rgba[::-1].ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()

def comp(fg):
    bg = background(*fg.shape[:2])
    a = fg[..., 3:4]
    # rendered pixels are display-referred already in PNG (AgX); bg in display space too
    return fg[..., :3] * a + bg * (1 - a)

os.makedirs(OUT, exist_ok=True)
if MODE == 'turn':
    views = [(0, '정면'), (35, '3/4 정면'), (90, '측면'), (145, '3/4 후면'), (180, '후면'), (-90, '반대측면')]
    tiles = []
    W, H = 420, 640
    cam_d.lens = 85
    for ang, label in views:
        rig.rotation_euler = (0, 0, math.radians(ang))
        bpy.context.view_layer.update()
        look((0, 0, 0.19), (0, -1.45, 0.3))
        p = os.path.join(OUT, f'_v{ang}.png')
        tiles.append(comp(render(p, W, H)))
        os.remove(p)
    sheet = np.concatenate(tiles, 1)
    save_png(np.clip(sheet, 0, 1), os.path.join(OUT, 'nuri_turnaround.png'))
elif MODE == 'hero':
    rig.rotation_euler = (0, 0, math.radians(28))
    pb = rig.pose.bones
    def rot(b, x=0, y=0, z=0):
        pb[b].rotation_mode = 'XYZ'; pb[b].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
    rot('upperArm.R', 0, 0, 0); rot('upperArm.R', -20, 0, -145); rot('forearm.R', -40, 0, 0)
    rot('upperArm.L', 15, 0, 25); rot('head', 8, 0, 12); rot('spine', -4, 0, -3)
    rot('thigh.L', -18); rot('shin.L', 25); rot('foot.L', -8)
    bpy.context.view_layer.update()
    look((0, 0, 0.2), (0.25, -1.25, 0.3))
    cam.data.lens = 70
    fg = render(os.path.join(OUT, '_hero.png'), 1000, 1000)
    save_png(np.clip(comp(fg), 0, 1), os.path.join(OUT, 'nuri_hero.png'))
    os.remove(os.path.join(OUT, '_hero.png'))
print('done')
if MODE == 'close':
    rig.rotation_euler = (0, 0, math.radians(float(os.environ.get('ANG', '30'))))
    bpy.context.view_layer.update()
    zc = float(os.environ.get('ZC', '0.2'))
    look((0, 0, zc), (0, -0.75, zc + 0.06))
    fg = render(os.path.join(OUT, '_c.png'), 800, 800)
    save_png(np.clip(comp(fg), 0, 1), os.path.join(OUT, 'close.png'))
