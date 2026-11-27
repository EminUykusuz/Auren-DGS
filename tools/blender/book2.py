import sys
sys.path.insert(0, r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender')
import importlib, common
importlib.reload(common)
from common import *
import numpy as np

W, D = 3.0, 4.0          # bir yarının genişliği, derinlik
TB = 0.07                # kapak kalınlığı
HB = 0.38                # sayfa bloğu yüksekliği
TOP = TB + HB            # blok üst yüzü (0.45)


def stripes_image():
    n = 256; a = np.ones((8, n, 4), dtype=np.float32)
    rng = np.random.default_rng(3)
    for y in range(n):
        v = 0.95 - (0.075 if y % 4 == 0 else 0) - rng.random() * 0.02
        a[:, y, :3] = (v, v * 0.975, v * 0.92)
    im = bpy.data.images.new('PagesEdge', n, 8); im.pixels = a.flatten().tolist(); im.pack(); return im


def cloth_normal_image(size=256):
    """Kumaş dokusu: çapraz dokuma normal haritası (karo olarak tekrar eder)"""
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    weave = (np.sin(x * 2 * np.pi / 8) * np.sin(y * 2 * np.pi / 8)) * 0.5 + (np.sin(x * 2 * np.pi / 2) + np.sin(y * 2 * np.pi / 2)) * 0.12
    rng = np.random.default_rng(1); weave += rng.random((size, size)).astype(np.float32) * 0.18
    gx = np.roll(weave, -1, 1) - np.roll(weave, 1, 1); gy = np.roll(weave, -1, 0) - np.roll(weave, 1, 0)
    k = 0.9; nx, ny, nz = -gx * k, -gy * k, np.ones_like(gx); l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    img = np.stack([nx / l * .5 + .5, ny / l * .5 + .5, nz / l * .5 + .5, np.ones_like(gx)], -1).astype(np.float32)
    im = bpy.data.images.new('ClothNormal', size, size); im.colorspace_settings.name = 'Non-Color'; im.pixels = img.flatten().tolist(); im.pack(); return im


def build_book():
    cloth = mat('Cloth', '#05704f', 0.62, 0, 0.0)
    nt = cloth.node_tree; n = nt.nodes; l = nt.links
    t = n.new('ShaderNodeTexImage'); t.image = cloth_normal_image(); t.extension = 'REPEAT'
    mp = n.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (14, 14, 14); tc = n.new('ShaderNodeTexCoord')
    nm = n.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 0.6
    l.new(tc.outputs['UV'], mp.inputs['Vector']); l.new(mp.outputs['Vector'], t.inputs['Vector']); l.new(t.outputs['Color'], nm.inputs['Color']); l.new(nm.outputs['Normal'], n['Principled BSDF'].inputs['Normal'])
    edge = mat('PagesEdge', '#ffffff', 0.93)
    et = edge.node_tree.nodes.new('ShaderNodeTexImage'); et.image = stripes_image(); et.extension = 'EXTEND'
    edge.node_tree.links.new(et.outputs['Color'], edge.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    foil = mat('Foil', '#f6d77c', 0.24, 0.92)
    fb = foil.node_tree.nodes['Principled BSDF']; fb.inputs['Emission Color'].default_value = srgb('#f2b93b'); fb.inputs['Emission Strength'].default_value = 0.22
    endp = mat('Endpaper', '#f4efe0', 0.85)
    ribbon = mat('Ribbon', '#d84a5c', 0.55, 0, 0.0, Sheen_Weight=0.4)

    root = empty('Book', (0, 0, 0))
    # arka kapak
    box('Back', (W + 0.07, D + 0.12, TB), ((W + 0.07) / 2 + 0.005, 0, TB / 2), 0.02, 4, cloth, root)
    # omurga: bloğun sol kenarını saran ince şerit (kapaklarla aynı kumaş)
    box('Spine', (0.05, D + 0.12, TOP + TB), (-0.04, 0, (TOP + TB) / 2), 0.022, 4, cloth, root)
    # sayfa bloğu (kenarda sayfa çizgileri)
    box('Block', (W - 0.02, D - 0.07, HB), (W / 2 - 0.0, 0, TB + HB / 2), 0.008, 2, edge, root)
    # kapak (menteşe omurga ön-üstünde): CoverPivot kapalıyken y = TOP + TB/2
    cp = empty('CoverPivot', (0, 0, TOP + TB / 2), root)
    box('Cover', (W + 0.07, D + 0.12, TB), ((W + 0.07) / 2 + 0.005, 0, 0), 0.02, 4, cloth, cp)
    # iç kapak kâğıdı
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0)); ep = bpy.context.active_object; ep.name = 'Endpaper'
    ep.scale = (W - 0.04, D + 0.02, 1); bpy.ops.object.transform_apply(scale=True); ep.rotation_euler = (math.pi, 0, 0); bpy.ops.object.transform_apply(rotation=True)
    ep.data.materials.append(endp); ep.parent = cp; ep.location = ((W - 0.04) / 2 + 0.02, 0, -TB / 2 - 0.0015)
    # ön kapak: ince altın çerçeve + yazılar (gerçek geometri)
    fw, fd, th = W - 0.5, D - 0.5, 0.012
    for nm_, size, loc in (('FrameT', (fw, 0.025, th), (W / 2 + 0.005, fd / 2, TB / 2 + th / 2 - 0.002)), ('FrameB', (fw, 0.025, th), (W / 2 + 0.005, -fd / 2, TB / 2 + th / 2 - 0.002)),
                           ('FrameL', (0.025, fd, th), (W / 2 + 0.005 - fw / 2, 0, TB / 2 + th / 2 - 0.002)), ('FrameR', (0.025, fd, th), (W / 2 + 0.005 + fw / 2, 0, TB / 2 + th / 2 - 0.002))):
        box(nm_, size, loc, 0.004, 2, foil, cp)
    for txt, size, y in (('TYT', 0.78, 0.45), ('DENEME DEFTERİ', 0.21, -0.55), ('AUREN STUDY', 0.14, -1.35)):
        bpy.ops.object.text_add(location=(W / 2 + 0.005, y, TB / 2 - 0.001)); tt = bpy.context.active_object
        tt.data.body = txt; tt.data.size = size; tt.data.extrude = 0.006; tt.data.align_x = 'CENTER'; tt.data.align_y = 'CENTER'; tt.data.bevel_depth = 0.0018; tt.data.bevel_resolution = 1
        tt.name = 'Title_' + txt.split()[0]; tt.data.materials.append(foil); tt.parent = cp
    # omurga şeritleri (altın bantlar)
    for i, z in enumerate((0.12, 0.26, 0.40, 0.52)):
        box(f'SpineBand{i}', (0.058, D + 0.13, 0.014), (-0.04, 0, z * 0.9 + 0.02), 0.004, 2, foil, root)
    # şerit işaret (kenardan sarkan)
    box('RibbonTail', (0.09, 0.9, 0.006), (W * 0.55, -D / 2 - 0.4, TOP - 0.03), 0.002, 2, ribbon, root)
    return root


if not getattr(__import__('builtins'), 'NO_PREVIEW', False):
    clear(); setup_render(1280, 720, 64); studio(); ground()
    b = build_book(); b.rotation_euler = (0, 0, math.radians(-16)); b.location = (-1.4, 0, 0)
    camera((1.6, -8.2, 6.2), (0, 0, 0.2), 50)
    render(r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender\out\book_1.png')
    print('ok')
