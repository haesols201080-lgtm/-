"""Street furniture, vehicles and interior props."""
import bpy, math
from mathutils import Vector, Matrix
from lib import Mesh, rng


def anchor(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    bpy.context.scene.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


def telescreen_wall():
    m = Mesh('telescreen_wall')
    w, h, d = 1.7, 1.1, 0.09
    m.box((-w / 2 - 0.08, -d, -h / 2 - 0.08), (w / 2 + 0.08, 0, h / 2 + 0.08), 'screen_frame')
    m.quad([(-w / 2, -d - 0.004, -h / 2), (w / 2, -d - 0.004, -h / 2), (w / 2, -d - 0.004, h / 2), (-w / 2, -d - 0.004, h / 2)],
           'telescreen_screen', uv_rect=(0, 0, 1, 1))
    m.box((-0.5, -d - 0.02, -h / 2 - 0.07), (0.5, -d + 0.01, -h / 2 - 0.02), 'metal_dark')
    o = m.finish()
    anchor('eye', (0, -0.2, 0), o)
    return [o] + list(o.children)


def telescreen_pole():
    m = Mesh('telescreen_pole')
    m.cyl((0, 0, 0), (0, 0, 4.2), 0.12, 0.09, 'iron_black', 10)
    m.box((-1.0, -0.25, 3.0), (1.0, 0.25, 4.4), 'screen_frame')
    m.quad([(-0.85, -0.255, 3.12), (0.85, -0.255, 3.12), (0.85, -0.255, 4.28), (-0.85, -0.255, 4.28)],
           'telescreen_screen', uv_rect=(0, 0, 1, 1))
    m.cyl((0, 0, 4.4), (0, 0, 4.9), 0.06, 0.06, 'iron_black', 6)
    m.cyl((0, 0.1, 4.95), (0, -0.6, 5.1), 0.08, 0.38, 'metal_dark', 12, caps=False)
    m.box((-1.05, -0.3, 2.95), (1.05, 0.3, 3.0), 'iron_black')
    o = m.finish()
    anchor('eye', (0, -0.4, 3.7), o)
    return [o] + list(o.children)


def lamp_post():
    m = Mesh('lamp_post')
    m.cyl((0, 0, 0), (0, 0, 0.6), 0.22, 0.17, 'iron_black', 12)
    m.cyl((0, 0, 0.6), (0, 0, 5.2), 0.1, 0.07, 'iron_black', 10, flutes=8, flute_depth=0.15)
    m.cyl((0, 0, 5.2), (0, -0.9, 5.35), 0.04, 0.04, 'iron_black', 6)
    m.cyl((0, -0.9, 5.35), (0, -0.9, 5.15), 0.03, 0.03, 'iron_black', 6)
    m.cyl((0, -0.9, 5.15), (0, -0.9, 4.85), 0.32, 0.12, 'iron_black', 12)
    m.sphere((0, -0.9, 4.88), 0.1, 'lamp_bulb', 10, 6)
    o = m.finish()
    anchor('light', (0, -0.9, 4.75), o)
    return [o] + list(o.children)


def bench():
    m = Mesh('bench')
    for x in (-0.8, 0.8):
        m.box((x - 0.05, -0.25, 0), (x + 0.05, 0.25, 0.45), 'iron_black')
        m.box((x - 0.05, 0.18, 0.45), (x + 0.05, 0.25, 0.9), 'iron_black')
    for k in range(3):
        m.box((-1.0, -0.25 + k * 0.15, 0.45), (1.0, -0.13 + k * 0.15, 0.49), 'wood')
    for k in range(2):
        m.box((-1.0, 0.22, 0.58 + k * 0.17), (1.0, 0.26, 0.7 + k * 0.17), 'wood')
    return [m.finish()]


def bin_():
    m = Mesh('bin')
    m.cyl((0, 0, 0), (0, 0, 0.8), 0.25, 0.28, 'metal', 14)
    m.cyl((0, 0, 0.8), (0, 0, 0.86), 0.3, 0.3, 'metal', 14)
    return [m.finish()]


def poster_board():
    """Paper poster on a thin backing; the game sets the image per instance."""
    m = Mesh('poster')
    w, h = 1.0, 1.4
    m.quad([(-w / 2, -0.012, 0), (w / 2, -0.012, 0), (w / 2, -0.012, h), (-w / 2, -0.012, h)], 'poster_bb', uv_rect=(0, 0, 1, 1))
    return [m.finish(box_uv=False)]


def sandbags():
    m = Mesh('sandbags')
    r = rng(5)
    for layer in range(3):
        for k in range(6):
            x = -1.5 + k * 0.6 + (layer % 2) * 0.3
            M = Matrix.Translation((x, 0, layer * 0.22 + 0.11)) @ Matrix.Rotation((r.random() - 0.5) * 0.15, 4, 'Z')
            m.box((-0.3, -0.18, -0.11), (0.3, 0.18, 0.11), 'sandbag', matrix=M)
    return [m.finish()]


def rubble_pile():
    from buildings import rubble_heap
    m = Mesh('rubble_pile')
    rubble_heap(m, (0, 0, 0), 2.6, 1.1, rng(8))
    for k in range(3):
        a = k * 2.1
        m.cyl((math.cos(a) * 1.5, math.sin(a), 0.2), (math.cos(a) * 0.3, math.sin(a) * 0.2, 1.2), 0.08, 0.08, 'wood', 4)
    return [m.finish()]


def truck():
    """Army lorry for the convoy of Eurasian prisoners."""
    m = Mesh('truck')
    # chassis
    m.box((-1.1, -4.0, 0.7), (1.1, 3.4, 1.0), 'iron_black')
    for y in (-2.9, 1.2, 2.5):
        for sx in (-1.0, 1.0):
            m.cyl((sx * 1.0, y, 0.48), (sx * 1.25, y, 0.48), 0.48, 0.48, 'rubber', 16)
    # cab
    m.box((-1.15, -4.2, 1.0), (1.15, -2.0, 2.0), 'canvas')
    m.box((-1.1, -3.4, 2.0), (1.1, -2.0, 2.8), 'canvas')
    m.box((-1.05, -3.42, 2.1), (1.05, -3.38, 2.7), 'glass')
    m.box((-1.0, -4.25, 1.2), (1.0, -4.18, 1.9), 'iron_black')
    # open bed with slatted sides
    m.box((-1.25, -1.9, 1.0), (1.25, 3.5, 1.15), 'wood')
    for sx in (-1.22, 1.22):
        for k in range(3):
            m.box((sx - 0.03, -1.9, 1.3 + k * 0.32), (sx + 0.03, 3.5, 1.42 + k * 0.32), 'wood')
        for y in (-1.8, 0.5, 3.4):
            m.box((sx - 0.04, y - 0.05, 1.15), (sx + 0.04, y + 0.05, 2.1), 'wood')
    return [m.finish()]


def van():
    m = Mesh('van')
    m.box((-1.0, -2.6, 0.45), (1.0, 2.6, 2.3), 'iron_black')
    m.box((-0.95, -2.62, 1.4), (0.95, -2.58, 2.0), 'glass')
    for y in (-1.7, 1.7):
        for sx in (-0.95, 0.95):
            m.cyl((sx, y, 0.4), (sx * 1.15, y, 0.4), 0.4, 0.4, 'rubber', 14)
    return [m.finish()]


def helicopter():
    m = Mesh('helicopter')
    m.sphere((0, -0.6, 1.6), 1.0, 'metal_dark', 16, 10, (1.0, 1.9, 0.95))
    m.sphere((0, -2.0, 1.75), 0.75, 'glass', 14, 8, (1.05, 0.8, 0.9))
    m.cyl((0, 0.8, 1.9), (0, 6.5, 2.3), 0.38, 0.12, 'metal_dark', 10)
    m.box((-0.05, 6.2, 2.1), (0.05, 6.8, 3.2), 'metal_dark')
    for sx in (-0.9, 0.9):
        m.box((sx - 0.05, -2.2, 0.0), (sx + 0.05, 1.0, 0.08), 'iron_black')
        for y in (-1.5, 0.4):
            m.cyl((sx, y, 0.05), (sx * 0.6, y, 0.8), 0.04, 0.04, 'iron_black', 5)
    m.cyl((0, -0.4, 2.55), (0, -0.4, 2.95), 0.1, 0.1, 'iron_black', 8)
    body = m.finish()
    r = Mesh('rotor')
    for a in range(4):
        M = Matrix.Translation((0, 0, 0)) @ Matrix.Rotation(a * math.pi / 2, 4, 'Z')
        r.box((0.0, -0.13, -0.02), (5.2, 0.13, 0.02), 'iron_black', matrix=M)
    rotor = r.finish()
    rotor.location = (0, -0.4, 2.98)
    rotor.parent = body
    t = Mesh('tail_rotor')
    for a in range(2):
        M = Matrix.Rotation(a * math.pi / 2, 4, 'X')
        t.box((-0.02, -0.06, -0.7), (0.02, 0.06, 0.7), 'iron_black', matrix=M)
    tail = t.finish()
    tail.location = (0.12, 6.6, 2.7)
    tail.parent = body
    light = Mesh('searchlight')
    light.cyl((0, 0, 0), (0, -0.25, -0.15), 0.18, 0.22, 'metal_dark', 12)
    sl = light.finish()
    sl.location = (0, -2.4, 0.9)
    sl.parent = body
    return [body, rotor, tail, sl]


def train_carriage():
    m = Mesh('train')
    L = 18
    m.box((-1.45, -L / 2, 0.9), (1.45, L / 2, 3.8), 'wood_dark')
    m.cyl((-1.45, -L / 2, 3.6), (-1.45, L / 2, 3.6), 0.01, 0.01, 'iron_black', 3, caps=False)
    # curved roof
    for k in range(8):
        a0 = math.pi * k / 8; a1 = math.pi * (k + 1) / 8
        m.quad([(math.cos(a0) * 1.5, -L / 2, 3.8 + math.sin(a0) * 0.45), (math.cos(a0) * 1.5, L / 2, 3.8 + math.sin(a0) * 0.45),
                (math.cos(a1) * 1.5, L / 2, 3.8 + math.sin(a1) * 0.45), (math.cos(a1) * 1.5, -L / 2, 3.8 + math.sin(a1) * 0.45)], 'iron_black')
    for k in range(8):
        y = -L / 2 + 1.4 + k * 2.1
        for sx in (-1.46, 1.46):
            m.box((sx - 0.01, y, 2.2), (sx + 0.01, y + 1.2, 3.2), 'glass_lit')
    for y in (-L / 2 + 2.5, L / 2 - 2.5):
        for sx in (-0.8, 0.8):
            m.cyl((sx, y, 0.5), (sx * 1.2, y, 0.5), 0.45, 0.45, 'iron_black', 12)
    return [m.finish()]


# ---------------------------------------------------------------- interior

def bed_iron():
    m = Mesh('bed')
    for x in (-0.45, 0.45):
        for y in (-1.0, 1.0):
            m.cyl((x, y, 0), (x, y, 0.9 if y > 0 else 0.7), 0.025, 0.025, 'iron_black', 6)
    for y, hgt in ((-1.0, 0.7), (1.0, 0.9)):
        m.cyl((-0.45, y, hgt), (0.45, y, hgt), 0.02, 0.02, 'iron_black', 6)
        for k in range(5):
            x = -0.36 + k * 0.18
            m.cyl((x, y, 0.4), (x, y, hgt), 0.012, 0.012, 'iron_black', 4)
    m.box((-0.45, -1.0, 0.35), (0.45, 1.0, 0.4), 'iron_black')
    m.box((-0.43, -0.98, 0.4), (0.43, 0.98, 0.55), 'mattress')
    m.box((-0.42, -0.5, 0.55), (0.42, 0.98, 0.6), 'fabric_grey')
    m.box((-0.3, 0.65, 0.55), (0.3, 0.92, 0.68), 'mattress')
    return [m.finish()]


def bed_mahogany():
    m = Mesh('bed_old')
    m.box((-0.8, -1.05, 0.25), (0.8, 1.05, 0.5), 'wood_dark')
    m.box((-0.82, 1.0, 0), (0.82, 1.1, 1.3), 'wood_dark')
    m.box((-0.82, -1.1, 0), (0.82, -1.0, 0.75), 'wood_dark')
    m.box((-0.78, -1.0, 0.5), (0.78, 1.0, 0.72), 'mattress')
    m.box((-0.76, -0.4, 0.72), (0.76, 1.0, 0.78), 'fabric_red')
    for sx in (-0.4, 0.4):
        m.box((sx - 0.3, 0.65, 0.72), (sx + 0.3, 0.95, 0.88), 'paper')
    return [m.finish()]


def table_small():
    m = Mesh('table')
    m.box((-0.45, -0.3, 0.72), (0.45, 0.3, 0.76), 'wood')
    for x in (-0.4, 0.4):
        for y in (-0.25, 0.25):
            m.box((x - 0.025, y - 0.025, 0), (x + 0.025, y + 0.025, 0.72), 'wood')
    m.box((-0.38, -0.29, 0.6), (0.38, 0.2, 0.71), 'wood')
    return [m.finish()]


def gateleg_table():
    m = Mesh('gateleg')
    m.cyl((0, 0, 0.72), (0, 0, 0.76), 0.55, 0.55, 'wood_dark', 24)
    for a in range(4):
        x, y = math.cos(a * math.pi / 2 + 0.6) * 0.35, math.sin(a * math.pi / 2 + 0.6) * 0.35
        m.cyl((x, y, 0), (x, y, 0.72), 0.025, 0.03, 'wood_dark', 8)
    return [m.finish()]


def chair():
    m = Mesh('chair')
    m.box((-0.21, -0.21, 0.43), (0.21, 0.21, 0.47), 'wood')
    for x in (-0.18, 0.18):
        for y in (-0.18, 0.18):
            m.box((x - 0.02, y - 0.02, 0), (x + 0.02, y + 0.02, 0.43 if y < 0 else 0.92), 'wood')
    m.box((-0.2, 0.16, 0.7), (0.2, 0.2, 0.9), 'wood')
    return [m.finish()]


def armchair():
    m = Mesh('armchair')
    m.box((-0.42, -0.4, 0.2), (0.42, 0.4, 0.45), 'fabric_red')
    m.box((-0.42, 0.25, 0.45), (0.42, 0.42, 1.0), 'fabric_red')
    for sx in (-0.42, 0.32):
        m.box((sx, -0.4, 0.45), (sx + 0.1, 0.3, 0.65), 'fabric_red')
    for x in (-0.38, 0.38):
        for y in (-0.36, 0.36):
            m.box((x - 0.03, y - 0.03, 0), (x + 0.03, y + 0.03, 0.2), 'wood_dark')
    return [m.finish()]


def cubicle():
    """Winston's cubicle: speakwrite, two pneumatic tubes, a memory hole."""
    m = Mesh('cubicle')
    m.box((-0.8, -0.35, 0.72), (0.8, 0.35, 0.76), 'metal')
    for x in (-0.75, 0.75):
        m.box((x - 0.03, -0.3, 0), (x + 0.03, 0.3, 0.72), 'metal')
    # partitions
    m.box((-1.0, 0.45, 0), (1.0, 0.5, 1.7), 'concrete_grey')
    m.box((-1.0, -1.0, 0), (-0.95, 0.5, 1.7), 'concrete_grey')
    m.box((0.95, -1.0, 0), (1.0, 0.5, 1.7), 'concrete_grey')
    # speakwrite
    m.box((-0.15, 0.05, 0.76), (0.2, 0.3, 0.9), 'metal_dark')
    m.cyl((0.0, 0.05, 0.86), (-0.05, -0.15, 0.98), 0.03, 0.05, 'metal_dark', 8)
    # tubes in the back wall
    m.cyl((0.55, 0.46, 1.2), (0.55, 0.38, 1.2), 0.07, 0.07, 'brass', 12)
    m.cyl((-0.55, 0.46, 1.2), (-0.55, 0.36, 1.2), 0.13, 0.13, 'brass', 14)
    # memory hole in the side wall
    m.box((0.93, -0.55, 0.9), (0.95, -0.05, 1.25), 'iron_black')
    for k in range(6):
        y = -0.52 + k * 0.09
        m.box((0.92, y, 0.9), (0.935, y + 0.015, 1.25), 'metal')
    m.box((-0.2, -0.6, 0.0), (0.2, -0.2, 0.45), 'metal_dark')
    o = m.finish()
    anchor('memory_hole', (0.9, -0.3, 1.07), o)
    anchor('screen', (0.0, 0.42, 1.25), o)
    return [o] + list(o.children)


def canteen_table():
    m = Mesh('canteen_table')
    m.box((-1.4, -0.4, 0.72), (1.4, 0.4, 0.76), 'metal')
    for x in (-1.3, 1.3):
        m.box((x - 0.04, -0.35, 0), (x + 0.04, 0.35, 0.72), 'metal')
    for y in (-0.75, 0.75):
        m.box((-1.4, y - 0.18, 0.43), (1.4, y + 0.18, 0.47), 'metal')
        for x in (-1.2, 1.2):
            m.box((x - 0.03, y - 0.03, 0), (x + 0.03, y + 0.03, 0.43), 'metal')
    for x in (-0.8, 0.0, 0.8):
        m.box((x - 0.18, -0.3, 0.76), (x + 0.18, -0.05, 0.78), 'metal')
    return [m.finish()]


def diary():
    m = Mesh('diary')
    m.box((-0.11, -0.15, 0), (0.11, 0.15, 0.025), 'paper')
    m.box((-0.115, -0.155, -0.003), (0.115, 0.155, 0.0), 'diary_cover')
    m.box((-0.115, -0.155, 0.025), (0.115, 0.155, 0.028), 'diary_cover')
    m.box((-0.118, -0.155, -0.003), (-0.11, 0.155, 0.028), 'fabric_red')
    return [m.finish()]


def paperweight():
    m = Mesh('paperweight')
    m.sphere((0, 0, 0.045), 0.05, 'paperweight_glass', 24, 14, (1, 1, 0.9))
    m.sphere((0, 0, 0.03), 0.018, 'coral', 10, 6, (1.2, 0.8, 0.9))
    return [m.finish()]


def engraving():
    m = Mesh('engraving')
    m.box((-0.32, -0.02, -0.24), (0.32, 0.0, 0.24), 'wood_dark')
    m.quad([(-0.27, -0.022, -0.19), (0.27, -0.022, -0.19), (0.27, -0.022, 0.19), (-0.27, -0.022, 0.19)],
           'engraving', uv_rect=(0, 0, 1, 1))
    return [m.finish()]


def gin_bottle():
    m = Mesh('gin')
    m.cyl((0, 0, 0), (0, 0, 0.2), 0.04, 0.04, 'glass', 12)
    m.cyl((0, 0, 0.2), (0, 0, 0.26), 0.04, 0.015, 'glass', 12)
    m.cyl((0, 0, 0.26), (0, 0, 0.29), 0.015, 0.015, 'glass', 12)
    m.cyl((0, 0, 0.06), (0, 0, 0.14), 0.0405, 0.0405, 'paper', 12, caps=False)
    return [m.finish()]


def oil_stove():
    m = Mesh('oil_stove')
    m.cyl((0, 0, 0.0), (0, 0, 0.35), 0.16, 0.16, 'metal_dark', 14)
    m.cyl((0, 0, 0.35), (0, 0, 0.4), 0.18, 0.18, 'iron_black', 14)
    m.cyl((0, 0, 0.4), (0, 0, 0.55), 0.12, 0.1, 'metal', 14)
    return [m.finish()]


def shelf():
    m = Mesh('shelf')
    m.box((-0.6, -0.15, 0), (-0.57, 0.15, 1.8), 'wood_dark')
    m.box((0.57, -0.15, 0), (0.6, 0.15, 1.8), 'wood_dark')
    r = rng(4)
    for k in range(5):
        z = 0.05 + k * 0.42
        m.box((-0.6, -0.15, z), (0.6, 0.15, z + 0.03), 'wood_dark')
        if k < 4:
            x = -0.55
            while x < 0.5:
                w = 0.03 + r.random() * 0.12
                h = 0.12 + r.random() * 0.2
                mat = ['metal', 'paper', 'glass', 'wood', 'fabric_red'][int(r.random() * 5)]
                m.box((x, -0.1, z + 0.03), (x + w, 0.08, z + 0.03 + h), mat)
                x += w + 0.02 + r.random() * 0.1
    return [m.finish()]


def cage():
    """Room 101: the wire cage with a mask that fits over the face."""
    m = Mesh('cage')
    L, W, H = 0.6, 0.35, 0.35
    for k in range(9):
        x = -L / 2 + k * L / 8
        for y in (-W / 2, W / 2):
            m.cyl((x, y, 0), (x, y, H), 0.004, 0.004, 'iron_black', 3, caps=False)
    for z in (0.0, H / 3, 2 * H / 3, H):
        for y in (-W / 2, W / 2):
            m.cyl((-L / 2, y, z), (L / 2, y, z), 0.004, 0.004, 'iron_black', 3, caps=False)
        for x in (-L / 2, L / 2):
            m.cyl((x, -W / 2, z), (x, W / 2, z), 0.004, 0.004, 'iron_black', 3, caps=False)
    m.box((-L / 2, -W / 2, -0.01), (L / 2, W / 2, 0.0), 'metal')
    m.box((L / 2 - 0.01, -0.03, 0.15), (L / 2 + 0.05, 0.03, 0.2), 'iron_black')
    m.cyl((-L / 2 - 0.15, 0, 0.17), (-L / 2, 0, 0.17), 0.18, 0.13, 'iron_black', 14, caps=False)
    m.box((-0.05, -0.02, H), (0.05, 0.02, H + 0.08), 'iron_black')
    o = m.finish()
    for i in range(2):
        rat = Mesh(f'rat{i}')
        rat.sphere((0, 0, 0.04), 0.045, 'hair_grey', 10, 6, (2.2, 1.0, 0.9))
        rat.sphere((-0.1, 0, 0.045), 0.025, 'hair_grey', 8, 5, (1.4, 1.0, 1.0))
        rat.cyl((0.09, 0, 0.03), (0.25, 0.03, 0.01), 0.008, 0.003, 'skin', 4)
        ro = rat.finish()
        ro.location = (-0.12 + i * 0.2, -0.05 + i * 0.1, 0)
        ro.parent = o
    return [o] + list(o.children)


def interrogation_bed():
    m = Mesh('rack')
    m.box((-0.45, -1.05, 0.6), (0.45, 1.05, 0.7), 'metal')
    for x in (-0.4, 0.4):
        for y in (-1.0, 1.0):
            m.box((x - 0.03, y - 0.03, 0), (x + 0.03, y + 0.03, 0.6), 'metal')
    for y in (-0.8, -0.1, 0.6):
        m.box((-0.47, y, 0.62), (0.47, y + 0.08, 0.74), 'rubber')
    # dial machine
    m.box((0.7, -0.3, 0), (1.1, 0.3, 1.1), 'metal_dark')
    m.cyl((0.69, 0, 0.85), (0.66, 0, 0.85), 0.14, 0.14, 'paper', 20)
    m.box((0.66, -0.01, 0.84), (0.665, 0.11, 0.86), 'iron_black')
    return [m.finish()]


def cell_bench():
    m = Mesh('cell_bench')
    m.box((-2.0, -0.2, 0.42), (2.0, 0.2, 0.46), 'metal')
    m.box((-2.0, 0.15, 0), (2.0, 0.2, 0.42), 'metal')
    return [m.finish()]


def chess():
    m = Mesh('chess')
    for i in range(8):
        for j in range(8):
            x0 = -0.16 + i * 0.04; y0 = -0.16 + j * 0.04
            m.box((x0, y0, 0), (x0 + 0.04, y0 + 0.04, 0.012), 'paper' if (i + j) % 2 else 'wood_dark')
    r = rng(9)
    for k in range(10):
        i, j = int(r.random() * 8), int(r.random() * 8)
        x = -0.14 + i * 0.04; y = -0.14 + j * 0.04
        m.cyl((x, y, 0.012), (x, y, 0.04 + r.random() * 0.03), 0.012, 0.008, 'paper' if k % 2 else 'iron_black', 8)
    return [m.finish()]


def bulb_lamp():
    m = Mesh('bulb')
    m.cyl((0, 0, 0), (0, 0, -0.6), 0.005, 0.005, 'iron_black', 4, caps=False)
    m.cyl((0, 0, -0.6), (0, 0, -0.66), 0.02, 0.02, 'brass', 8)
    m.sphere((0, 0, -0.7), 0.04, 'lamp_bulb', 10, 6)
    o = m.finish()
    anchor('light', (0, 0, -0.75), o)
    return [o] + list(o.children)


def sink():
    m = Mesh('sink')
    m.box((-0.35, -0.25, 0.75), (0.35, 0.25, 0.9), 'tile_white')
    m.box((-0.3, -0.2, 0.8), (0.3, 0.2, 0.9), 'metal_dark', faces={'+z'})
    m.box((-0.05, -0.05, 0), (0.05, 0.05, 0.75), 'metal')
    m.cyl((0, 0.2, 0.9), (0, 0.2, 1.05), 0.012, 0.012, 'metal', 6)
    m.cyl((0, 0.2, 1.05), (0, 0.08, 1.02), 0.012, 0.01, 'metal', 6)
    return [m.finish()]


def cupboard():
    m = Mesh('cupboard')
    m.box((-0.5, -0.25, 0), (0.5, 0.25, 1.9), 'wood_dark')
    m.box((-0.01, -0.26, 0.1), (0.01, -0.25, 1.8), 'iron_black')
    for x in (-0.06, 0.06):
        m.box((x - 0.01, -0.29, 0.95), (x + 0.01, -0.26, 1.05), 'brass')
    return [m.finish()]


def briefcase():
    m = Mesh('briefcase')
    m.box((-0.22, -0.06, 0), (0.22, 0.06, 0.32), 'shoe')
    m.cyl((-0.06, 0, 0.36), (0.06, 0, 0.36), 0.012, 0.012, 'shoe', 6)
    return [m.finish()]


def coffee_tin():
    m = Mesh('tin')
    m.cyl((0, 0, 0), (0, 0, 0.14), 0.06, 0.06, 'metal', 14)
    return [m.finish()]


def hate_chairs():
    """A row of chairs dragged out of the cubicles for the Two Minutes Hate."""
    from props import chair as _c
    m = Mesh('chair_row')
    for k in range(8):
        x = -3.5 + k * 1.0
        m.box((x - 0.21, -0.21, 0.43), (x + 0.21, 0.21, 0.47), 'metal')
        for sx in (-0.18, 0.18):
            for y in (-0.18, 0.18):
                m.box((x + sx - 0.02, y - 0.02, 0), (x + sx + 0.02, y + 0.02, 0.43 if y < 0 else 0.92), 'metal')
        m.box((x - 0.2, 0.16, 0.7), (x + 0.2, 0.2, 0.9), 'metal')
    return [m.finish()]


ALL = {
    'telescreen_wall': telescreen_wall, 'telescreen_pole': telescreen_pole, 'lamp_post': lamp_post,
    'bench': bench, 'bin': bin_, 'poster': poster_board, 'sandbags': sandbags, 'rubble_pile': rubble_pile,
    'truck': truck, 'van': van, 'helicopter': helicopter, 'train': train_carriage,
    'bed': bed_iron, 'bed_old': bed_mahogany, 'table': table_small, 'gateleg': gateleg_table, 'chair': chair,
    'armchair': armchair, 'cubicle': cubicle, 'canteen_table': canteen_table, 'diary': diary,
    'paperweight': paperweight, 'engraving': engraving, 'gin': gin_bottle, 'oil_stove': oil_stove,
    'shelf': shelf, 'cage': cage, 'rack': interrogation_bed, 'cell_bench': cell_bench, 'chess': chess,
    'bulb': bulb_lamp, 'sink': sink, 'cupboard': cupboard, 'briefcase': briefcase, 'tin': coffee_tin,
    'chair_row': hate_chairs,
}
