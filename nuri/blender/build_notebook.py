"""Renders the field-notebook UI pieces with Cycles (top-down, orthographic, transparent background):
  spread.png      the notebook opened flat: stitched leather cover, two page blocks with a curved gutter and
                  splayed page edges, an elastic band and a satin ribbon marker
  pocket_open.png the small notebook in the HUD, opened to the current page (top binding)
  pocket_shut.png the same notebook closed: stitched cover, debossed lettering, a paper label
  disc.png        a domed leather button with a stitched rim (touch controls)
  ring.png        a stitched leather ring (frame of the round map)
Real units: metres at the notebook's scale. Leather: Poly Haven 'brown_leather' (CC0). Paper: tools/make_paper.py.
  /tmp/claude-0/bl/bin/python blender/build_notebook.py <leather_dir> <paper.png> <out_dir> [which,...]"""
import sys, math, bpy, bmesh
from mathutils import Vector

LD, PAPER, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
WHICH = sys.argv[4].split(',') if len(sys.argv) > 4 else ['spread', 'pocket_open', 'pocket_shut', 'disc', 'ring']

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(__import__('os').environ.get('SAMPLES', 96)); sc.cycles.use_denoising = True
    sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.03, 0.028, 0.025, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    return sc

def img(path, colour=True):
    im = bpy.data.images.load(path, check_existing=True)
    if not colour: im.colorspace_settings.name = 'Non-Color'
    return im

# ------------------------------------------------------------------ materials
def leather_mat(name='leather', tile=0.11, tint=(0.80, 0.70, 0.60), wear_sdf=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1 / tile)
    Lk.new(tc.outputs['Object'], mp.inputs['Vector'])
    def tex(f, colour=True):
        t = N.new('ShaderNodeTexImage'); t.image = img(f'{LD}/{f}', colour); Lk.new(mp.outputs['Vector'], t.inputs['Vector']); return t
    alb, nor, rgh = tex('brown_leather_albedo_2k.jpg'), tex('brown_leather_nor_gl_2k.jpg', False), tex('brown_leather_rough_2k.jpg', False)
    mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1.0
    Lk.new(alb.outputs['Color'], mul.inputs['A']); mul.inputs['B'].default_value = (*tint, 1)
    col = mul.outputs['Result']
    if wear_sdf:
        # worn edges: the last 2.5 mm before the edge is rubbed lighter and smoother
        hx, hy, r = wear_sdf
        sep = N.new('ShaderNodeSeparateXYZ'); Lk.new(tc.outputs['Object'], sep.inputs[0])
        def mth(op, a, b=None, v=None):
            n = N.new('ShaderNodeMath'); n.operation = op
            if isinstance(a, (int, float)): n.inputs[0].default_value = a
            else: Lk.new(a, n.inputs[0])
            if b is not None:
                if isinstance(b, (int, float)): n.inputs[1].default_value = b
                else: Lk.new(b, n.inputs[1])
            return n.outputs[0]
        qx = mth('SUBTRACT', mth('ABSOLUTE', sep.outputs['X']), hx - r); qy = mth('SUBTRACT', mth('ABSOLUTE', sep.outputs['Y']), hy - r)
        ox = mth('MAXIMUM', qx, 0.0); oy = mth('MAXIMUM', qy, 0.0)
        outside = mth('SQRT', mth('ADD', mth('MULTIPLY', ox, ox), mth('MULTIPLY', oy, oy)))
        inside = mth('MINIMUM', mth('MAXIMUM', qx, qy), 0.0)
        d = mth('SUBTRACT', mth('ADD', outside, inside), r)            # < 0 inside
        wear = N.new('ShaderNodeMapRange'); Lk.new(d, wear.inputs['Value']); wear.inputs['From Min'].default_value = -0.0026; wear.inputs['From Max'].default_value = -0.0002
        noise = N.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 900; Lk.new(tc.outputs['Object'], noise.inputs['Vector'])
        wf = N.new('ShaderNodeMath'); wf.operation = 'MULTIPLY'; Lk.new(wear.outputs['Result'], wf.inputs[0]); Lk.new(noise.outputs['Fac'], wf.inputs[1])
        wf2 = N.new('ShaderNodeMath'); wf2.operation = 'MULTIPLY'; wf2.inputs[1].default_value = 1.6; Lk.new(wf.outputs[0], wf2.inputs[0]); wf2.use_clamp = True
        light = N.new('ShaderNodeMix'); light.data_type = 'RGBA'; light.blend_type = 'SCREEN'; Lk.new(wf2.outputs[0], light.inputs['Factor'])
        Lk.new(col, light.inputs['A']); light.inputs['B'].default_value = (0.22, 0.15, 0.10, 1)
        col = light.outputs['Result']
    Lk.new(col, bsdf.inputs['Base Color'])
    rr = N.new('ShaderNodeMapRange'); Lk.new(rgh.outputs['Color'], rr.inputs['Value']); rr.inputs['To Min'].default_value = 0.42; rr.inputs['To Max'].default_value = 0.78
    Lk.new(rr.outputs['Result'], bsdf.inputs['Roughness'])
    nm = N.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.3; Lk.new(nor.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Specular IOR Level'].default_value = 0.45
    return m

def paper_mat(name='paper', tile=0.06, age=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1 / tile, 1 / tile, 1)
    Lk.new(tc.outputs['Object'], mp.inputs['Vector'])
    t = N.new('ShaderNodeTexImage'); t.image = img(PAPER); Lk.new(mp.outputs['Vector'], t.inputs['Vector'])
    Lk.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.92
    bmp = N.new('ShaderNodeBump'); bmp.inputs['Strength'].default_value = 0.08; bmp.inputs['Distance'].default_value = 0.0002
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2600; nz.inputs['Detail'].default_value = 6; Lk.new(tc.outputs['Object'], nz.inputs['Vector'])
    Lk.new(nz.outputs['Fac'], bmp.inputs['Height']); Lk.new(bmp.outputs['Normal'], bsdf.inputs['Normal'])
    return m

def flat_mat(name, rgb, rough=0.6, sheen=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    if sheen: b.inputs['Sheen Weight'].default_value = sheen
    return m

def band_mat():
    m = bpy.data.materials.new('band'); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; Lk = nt.links; b = N['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.03, 0.024, 0.02, 1); b.inputs['Roughness'].default_value = 0.8; b.inputs['Sheen Weight'].default_value = 0.8
    tc = N.new('ShaderNodeTexCoord'); wv = N.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 900; wv.wave_type = 'BANDS'; wv.bands_direction = 'Y'
    Lk.new(tc.outputs['Object'], wv.inputs['Vector']); bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.35; Lk.new(wv.outputs['Fac'], bp.inputs['Height']); Lk.new(bp.outputs['Normal'], b.inputs['Normal'])
    return m

def thread_mat():
    return flat_mat('thread', (0.62, 0.50, 0.33), rough=0.7, sheen=0.5)

# ------------------------------------------------------------------ geometry helpers
def rounded_rect(hx, hy, r, n=10):
    pts = []
    for cx, cy, a0 in [(hx - r, hy - r, 0), (-hx + r, hy - r, 90), (-hx + r, -hy + r, 180), (hx - r, -hy + r, 270)]:
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts

def slab(name, hx, hy, r, z0, z1, mat, bevel=0.0009):
    """a rounded-rectangle slab with rounded edges (curve extrude + bevel)"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    sp = cu.splines.new('POLY'); P = rounded_rect(hx - bevel, hy - bevel, max(r - bevel, 0.0005), 12); sp.points.add(len(P) - 1)
    for i, (x, y) in enumerate(P): sp.points[i].co = (x, y, 0, 1)
    sp.use_cyclic_u = True
    cu.extrude = max((z1 - z0) / 2 - bevel, 0.00005); cu.bevel_depth = bevel; cu.bevel_resolution = 4
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob); ob.location.z = (z0 + z1) / 2
    ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    return ob

def stitches(path, z, spacing=0.0037, length=0.0024, mat=None, inset_holes=True):
    """thread stitches along a closed path [(x,y)...] lying on a surface at height z"""
    # resample the path by arc length
    seg = [(path[i], path[(i + 1) % len(path)]) for i in range(len(path))]
    total = sum(math.dist(a, b) for a, b in seg)
    n = int(total / spacing)
    bm = bmesh.new()
    def point_at(s):
        for a, b in seg:
            L = math.dist(a, b)
            if s <= L: t = s / L if L else 0; return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), math.atan2(b[1] - a[1], b[0] - a[0])
            s -= L
        return seg[-1][1], 0
    for k in range(n):
        (x, y), ang = point_at(k * total / n)
        res = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0)
        vs = res['verts']
        for v in vs:
            v.co.x *= length / 2; v.co.y *= 0.00042; v.co.z *= 0.00026
            c, s_ = math.cos(ang), math.sin(ang)
            v.co.x, v.co.y = v.co.x * c - v.co.y * s_ + x, v.co.x * s_ + v.co.y * c + y
            v.co.z += z + 0.00008
    me = bpy.data.meshes.new('stitches'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('stitches', me); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat or thread_mat())
    return ob

def grid_sheet(name, x0, x1, y0, y1, zf, mat, nx=90, ny=40, corners=(), r=0.0):
    """a page surface z = zf(x, y); corners: which corners to round, as (sx, sy) signs, radius r"""
    bm = bmesh.new(); V = []
    def clip(x, y):
        for sx, sy in corners:
            cx = (x1 - r) if sx > 0 else (x0 + r); cy = (y1 - r) if sy > 0 else (y0 + r)
            if (x - cx) * sx > 0 and (y - cy) * sy > 0:
                d = math.hypot(x - cx, y - cy)
                if d > r: x, y = cx + (x - cx) * r / d, cy + (y - cy) * r / d
        return x, y
    for j in range(ny + 1):
        row = []
        for i in range(nx + 1):
            x, y = clip(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny)
            row.append(bm.verts.new((x, y, zf(x, y))))
        V.append(row)
    for j in range(ny):
        for i in range(nx): bm.faces.new((V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]))
    # a little thickness so the edges catch light
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); ob.data.materials.append(mat)
    sol = ob.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.00025; sol.offset = -1
    return ob

def camera(sc, cx, cy, width, res_x, res_y):
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = width
    ob = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(ob); ob.location = (cx, cy, 1.0); sc.camera = ob
    sc.render.resolution_x = res_x; sc.render.resolution_y = res_y; sc.render.resolution_percentage = int(__import__('os').environ.get('PCT', 100))

def lights(strength=1.0):
    def area(loc, size, energy, col=(1, 0.96, 0.9)):
        L = bpy.data.lights.new('a', 'AREA'); L.size = size; L.energy = energy; L.color = col
        ob = bpy.data.objects.new('a', L); bpy.context.collection.objects.link(ob); ob.location = loc
        d = Vector((0, 0, 0)) - Vector(loc); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    area((-0.32, 0.36, 0.55), 0.45, 4.2 * strength)
    area((0.4, -0.2, 0.4), 0.6, 0.8 * strength, (1, 0.97, 0.92))

def render(sc, name):
    sc.render.filepath = f'{OUT}/{name}.png'; bpy.ops.render.render(write_still=True); print('rendered', name)

# ------------------------------------------------------------------ the open notebook spread
def build_spread():
    sc = reset()
    PW, PH = 0.118, 0.150                        # one page
    CM = 0.0092                                  # cover margin around the pages
    hx, hy = PW + CM, PH / 2 + CM
    slab('cover', hx, hy, 0.009, 0.0, 0.0024, leather_mat(wear_sdf=(hx, hy, 0.009)))
    # stitching 3.4 mm in from the cover edge (only the margin shows: the pages lie over the rest)
    stitches(rounded_rect(hx - 0.0034, hy - 0.0034, 0.0058, 10), 0.0024)
    paper = paper_mat()
    ztop = 0.0105
    def page_z(side, lift):
        # pages rise from the gutter and settle flat; each lower sheet sits a little lower
        return lambda x, y: ztop - lift - 0.0085 * math.exp(-abs(x) / 0.0085) + 0.0009 * math.exp(-((abs(x) - 0.028) / 0.018) ** 2)
    for side in (-1, 1):
        for k in range(6):                       # splayed page edges: lower sheets show a hair beyond the top one
            e = 0.00045 * k
            x0, x1 = (0.0, PW + e) if side > 0 else (-PW - e, 0.0)
            grid_sheet(f'sheet{side}{k}', x0, x1, -PH / 2 - e * 0.8, PH / 2 + e * 0.8, page_z(side, 0.00045 * k), paper, nx=140, ny=70,
                       corners=[(side, 1), (side, -1)], r=0.0045 + e)
    # a satin ribbon marker lying in the gutter and hanging out over the bottom edge
    rib = flat_mat('ribbon', (0.30, 0.045, 0.035), rough=0.3, sheen=0.35)
    bm = bmesh.new(); rows = []
    ys = [PH / 2 + 0.0006 - k * (PH / 2 + 0.0006 + hy + 0.0045) / 80 for k in range(81)]
    for y in ys:
        t = max(0.0, (PH / 2 - y) / PH)
        cx = 0.0004 + 0.0078 * t * t                       # out of the gutter at the head, drifting right as it falls
        def zz(x, y=y):
            pz = ztop - 0.0085 * math.exp(-abs(x) / 0.0085) + 0.00045
            if y > PH / 2: return max(0.0026, pz - (y - PH / 2) * 1.1) + 0.0002     # over the head edge, onto the cover
            if y > -PH / 2: return pz
            return max(0.0026, pz - (-PH / 2 - y) * 1.1) + 0.0002
        rows.append([bm.verts.new((cx + dx, y, zz(cx + dx))) for dx in (-0.0021, 0.0, 0.0021)])
    for j in range(len(rows) - 1):
        for i in range(2): bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    me = bpy.data.meshes.new('ribbon'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ro = bpy.data.objects.new('ribbon', me); bpy.context.collection.objects.link(ro); ro.data.materials.append(rib)
    ro.modifiers.new('s', 'SOLIDIFY').thickness = 0.0002
    # head and tail bands at the ends of the spine: the striped silk the ribbon is sewn under
    hb = bpy.data.materials.new('headband'); hb.use_nodes = True; hn = hb.node_tree.nodes; hl = hb.node_tree.links; hbsdf = hn['Principled BSDF']
    htc = hn.new('ShaderNodeTexCoord'); hw = hn.new('ShaderNodeTexWave'); hw.wave_type = 'BANDS'; hw.bands_direction = 'X'; hw.inputs['Scale'].default_value = 1500
    hl.new(htc.outputs['Object'], hw.inputs['Vector']); hr = hn.new('ShaderNodeValToRGB'); hr.color_ramp.elements[0].color = (0.42, 0.06, 0.04, 1); hr.color_ramp.elements[1].color = (0.82, 0.74, 0.58, 1)
    hr.color_ramp.interpolation = 'CONSTANT'; hl.new(hw.outputs['Fac'], hr.inputs['Fac']); hl.new(hr.outputs['Color'], hbsdf.inputs['Base Color']); hbsdf.inputs['Roughness'].default_value = 0.45
    for sy in (1, -1):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0011, depth=0.0085, location=(0, sy * (PH / 2 + 0.0006), 0.0036), rotation=(0, math.pi / 2, 0))
        o = bpy.context.object; o.scale = (0.8, 1, 1); o.data.materials.append(hb); bpy.ops.object.shade_smooth()
    # V-notch at the ribbon's end
    # (cut by deleting the lowest row's middle: approximate with a dark small triangle is not needed at this size)
    # elastic band down the right edge of the cover
    band = band_mat()
    grid_sheet('band', hx - 0.0062, hx + 0.0006, -hy - 0.001, hy + 0.001, lambda x, y: 0.0026 + 0.0006 * math.sin(min(1, (hx - x) / 0.006) * math.pi), band, nx=8, ny=40)
    W = 2 * hx + 0.012
    H = 2 * hy + 0.012
    camera(sc, 0, -0.002, W, 2000, int(2000 * H / W))
    lights()
    render(sc, 'spread')
    print('SPREAD', dict(W=W, H=H, PW=PW, PH=PH, hx=hx, hy=hy, cy=-0.002))

# ------------------------------------------------------------------ the pocket notebook (HUD)
def build_pocket(open_):
    sc = reset()
    PW, PH = 0.104, 0.060                        # landscape page, bound along the top
    CM = 0.0062
    hx, hy = PW / 2 + CM, PH / 2 + CM + 0.004
    slab('cover', hx, hy, 0.0075, 0.0, 0.0022, leather_mat(tile=0.09, wear_sdf=(hx, hy, 0.0075)))
    stitches(rounded_rect(hx - 0.003, hy - 0.003, 0.0048, 10), 0.0022)
    band = band_mat()
    if open_:
        paper = paper_mat(tile=0.05)
        top = hy - CM - 0.004
        for k in range(4):
            e = 0.0003 * k
            grid_sheet(f'p{k}', -PW / 2 - e, PW / 2 + e, -PH / 2 - 0.004 + 0.0 - e, top,
                       lambda x, y, k=k: 0.0058 - 0.0004 * k - 0.004 * math.exp(-(top - y) / 0.006), paper, nx=50, ny=30)
        # the binding: the flipped pages' fold seen along the top edge
        grid_sheet('fold', -PW / 2, PW / 2, top - 0.0005, top + 0.0032, lambda x, y: 0.0062 + 0.0015 * math.sin((y - top) / 0.0037 * math.pi), paper, nx=30, ny=8)
        grid_sheet('band', hx - 0.0062, hx + 0.0006, -hy - 0.001, hy + 0.001, lambda x, y: 0.0068 + 0.0005 * math.sin(min(1, (hx - x) / 0.006) * math.pi), band, nx=8, ny=30)
    else:
        # a paper label glued to the cover (counters are written on it) and the unit's name debossed
        lab = paper_mat('label', tile=0.05)
        grid_sheet('label', 0.004, hx - 0.016, -hy + 0.011, -hy + 0.029, lambda x, y: 0.0024, lab, nx=10, ny=6)
        txt = bpy.data.curves.new('t', 'FONT'); txt.body = 'SV-7  FIELD NOTES'; txt.size = 0.0058; txt.extrude = 0.0002; txt.align_x = 'LEFT'
        try: txt.font = bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf')
        except Exception: pass
        to = bpy.data.objects.new('t', txt); bpy.context.collection.objects.link(to); to.location = (-hx + 0.012, hy - 0.019, 0.00215)
        deb = flat_mat('foil', (0.62, 0.46, 0.22), rough=0.38); deb.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.85; to.data.materials.append(deb)
        grid_sheet('band', hx - 0.0062, hx + 0.0006, -hy - 0.001, hy + 0.001, lambda x, y: 0.0026 + 0.0006 * math.sin(min(1, (hx - x) / 0.006) * math.pi), band, nx=8, ny=30)
    W = 2 * hx + 0.008; H = 2 * hy + 0.008
    camera(sc, 0, 0, W, 900, int(900 * H / W))
    lights()
    render(sc, 'pocket_open' if open_ else 'pocket_shut')
    print('POCKET', dict(W=W, H=H, PW=PW, PH=PH, hx=hx, hy=hy, open=open_))

# ------------------------------------------------------------------ touch disc and map ring
def build_disc():
    sc = reset()
    R = 0.012
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1)
    ob = bpy.context.object; ob.scale = (R, R, 0.0032); ob.data.materials.append(leather_mat(tile=0.06))
    bpy.ops.object.shade_smooth()
    ring = [(math.cos(a) * R * 0.8, math.sin(a) * R * 0.8) for a in [i / 120 * math.tau for i in range(120)]]
    stitches(ring, 0.0032 * math.sqrt(1 - 0.64) - 0.0001, spacing=0.0022, length=0.0014)
    camera(sc, 0, 0, 2 * R + 0.002, 384, 384); lights()
    render(sc, 'disc')

def build_ring():
    sc = reset()
    Ro, Ri = 0.0175, 0.0145
    # a flat band between two circles
    bm = bmesh.new(); n = 160; vo = []; vi = []
    for i in range(n):
        a = i / n * math.tau
        vo.append(bm.verts.new((math.cos(a) * Ro, math.sin(a) * Ro, 0.0012))); vi.append(bm.verts.new((math.cos(a) * Ri, math.sin(a) * Ri, 0.0012)))
    for i in range(n): bm.faces.new((vo[i], vo[(i + 1) % n], vi[(i + 1) % n], vi[i]))
    me = bpy.data.meshes.new('ring'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('ring', me); bpy.context.collection.objects.link(ob); ob.data.materials.append(leather_mat(tile=0.06))
    sol = ob.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.0012; bev = ob.modifiers.new('b', 'BEVEL'); bev.width = 0.0005; bev.segments = 3
    for p in me.polygons: p.use_smooth = True
    ring = [(math.cos(a) * (Ro + Ri) / 2, math.sin(a) * (Ro + Ri) / 2) for a in [i / 160 * math.tau for i in range(160)]]
    stitches(ring, 0.0012, spacing=0.0021, length=0.0013)
    camera(sc, 0, 0, 2 * Ro + 0.0015, 512, 512); lights()
    render(sc, 'ring')

if 'spread' in WHICH: build_spread()
if 'pocket_open' in WHICH: build_pocket(True)
if 'pocket_shut' in WHICH: build_pocket(False)
if 'disc' in WHICH: build_disc()
if 'ring' in WHICH: build_ring()
