import sys
sys.path.insert(0, r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender')
import importlib, common
importlib.reload(common)
from common import *


def lathe(name, profile, segs=48, m=None, smooth=True, parent=None, caps=True, offset_angle=0.0):
    """x ekseni etrafında dönel yüzey: profile = [(x, yarıçap), ...]"""
    bm = bmesh.new(); rings = []
    for x, r in profile:
        ring = [bm.verts.new((x, r * math.cos(offset_angle + 2 * math.pi * i / segs), r * math.sin(offset_angle + 2 * math.pi * i / segs))) for i in range(segs)]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if caps:
        for ring in (rings[0], rings[-1]):
            if profile[0][1] > 0 and ring is rings[0] or profile[-1][1] > 0 and ring is rings[-1]:
                bm.faces.new(ring[::-1] if ring is rings[0] else ring)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    if m: o.data.materials.append(m)
    if parent: o.parent = parent
    return o


def bevel(o, width, segs=2, angle=0.5):
    bpy.context.view_layer.objects.active = o
    md = o.modifiers.new('bv', 'BEVEL'); md.width = width; md.segments = segs; md.limit_method = 'ANGLE'; md.angle_limit = angle
    bpy.ops.object.modifier_apply(modifier='bv')


def build_pencil():
    root = empty('Pencil', (0, 0, 0))
    paint = mat('PencilPaint', '#0b9468', 0.26, 0, 0.9, Specular_IOR_Level=0.6)
    gold = mat('PencilGold', '#d9b65c', 0.24, 1.0)
    wood = mat('PencilWood', '#e6c597', 0.72)
    lead = mat('PencilLead', '#22252d', 0.32, 0.5)
    rub = mat('PencilEraser', '#ec8da2', 0.82)
    ink = mat('PencilInk', '#f4fff9', 0.4)
    # grafit uç
    lathe('Lead', [(0, 0), (0.008, 0.013), (0.05, 0.026), (0.2, 0.037)], 24, lead, parent=root)
    # açılmış ahşap koni (altıgen gövdeyle kesişen kısım için hafif girinti)
    wd = lathe('Wood', [(0.17, 0.034), (0.34, 0.054), (0.66, 0.0885)], 36, wood, parent=root)
    # altıgen gövde
    body = lathe('Body', [(0.65, 0.1), (3.66, 0.1)], 6, paint, smooth=False, parent=root, offset_angle=math.pi / 2)
    bevel(body, 0.012, 3, 0.5)
    for p in body.data.polygons: p.use_smooth = True
    # ince altın şeritler
    for i, x in enumerate((3.34, 3.44)):
        s = lathe(f'Stripe{i}', [(x, 0.1015), (x + 0.04, 0.1015)], 6, gold, smooth=False, parent=root, offset_angle=math.pi / 2); bevel(s, 0.004, 2, 0.5)
    # yazı (bir yüzde)
    bpy.ops.object.text_add(location=(2.0, 0, 0.0872)); t = bpy.context.active_object; t.name = 'PencilText'
    t.data.body = 'AUREN STUDY  ·  TYT  ·  AYT  ·  DGS'; t.data.size = 0.062; t.data.extrude = 0.0012; t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
    t.data.materials.append(ink); t.parent = root
    # metal kelepçe (oluklu)
    prof = [(3.65, 0.1), (3.664, 0.108), (3.70, 0.110), (3.72, 0.100), (3.76, 0.100), (3.78, 0.110), (3.84, 0.110), (3.86, 0.100), (3.90, 0.100), (3.92, 0.110), (3.97, 0.110), (3.99, 0.102), (4.0, 0.094)]
    lathe('Ferrule', prof, 48, gold, parent=root)
    # silgi
    lathe('Eraser', [(3.99, 0.094), (4.18, 0.094), (4.23, 0.086), (4.255, 0.066), (4.268, 0.036), (4.272, 0)], 40, rub, parent=root)
    return root


if not getattr(__import__('builtins'), 'NO_PREVIEW', False):
    clear(); setup_render(1280, 640, 48); studio(); ground()
    p = build_pencil(); p.rotation_euler = (0, 0, math.radians(8)); p.location = (-2.2, 0, 0.25)
    camera((-0.3, -4.6, 3.4), (-0.1, 0, 0.1), 50)
    render(r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender\out\pencil_0.png')
    print('ok')
