import sys
sys.path.insert(0, r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender')
import importlib, common
importlib.reload(common)
from common import *
import numpy as np


def pages_image():
    n = 256; a = np.ones((n, 8, 4), dtype=np.float32)
    for y in range(n):
        v = 0.93 - (0.07 if y % 5 == 0 else 0)
        a[y, :, :3] = (v, v * 0.97, v * 0.9)
    im = bpy.data.images.new('PagesEdge', 8, n); im.pixels = a.flatten().tolist(); im.pack(); return im


def build_book():
    W, D = 3.0, 4.0
    cloth = mat('Cloth', '#0e8f6a', 0.62, 0, 0.0, Sheen_Weight=0.6)
    cloth.node_tree.nodes['Principled BSDF'].inputs['Sheen Roughness'].default_value = 0.5
    nt = cloth.node_tree; n = nt.nodes; l = nt.links
    wave = n.new('ShaderNodeTexNoise'); wave.inputs['Scale'].default_value = 260; wave.inputs['Detail'].default_value = 8
    bump = n.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.18; bump.inputs['Distance'].default_value = 0.01
    l.new(wave.outputs['Fac'], bump.inputs['Height']); l.new(bump.outputs['Normal'], n['Principled BSDF'].inputs['Normal'])
    paper = mat('Paper', '#f3ecdc', 0.9)
    edge = mat('PagesEdge', '#ffffff', 0.92)
    et = edge.node_tree.nodes.new('ShaderNodeTexImage'); et.image = pages_image(); et.extension = 'EXTEND'
    edge.node_tree.links.new(et.outputs['Color'], edge.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    foil = mat('Foil', '#e8c872', 0.28, 1.0)
    root = empty('Book', (0, 0, 0))
    box('Back', (W + 0.07, D + 0.12, 0.07), ((W + 0.07) / 2 + 0.01, 0, 0.035), 0.022, 4, cloth, root)
    box('Spine', (0.13, D + 0.12, 0.52), (-0.05, 0, 0.26), 0.05, 5, cloth, root)
    box('Block', (W - 0.02, D - 0.06, 0.38), (W / 2, 0, 0.26), 0.012, 3, edge, root)
    cp = empty('CoverPivot', (0, 0, 0.485), root)
    box('Cover', (W + 0.07, D + 0.12, 0.07), ((W + 0.07) / 2 + 0.01, 0, 0.0), 0.022, 4, cloth, cp)
    for txt, size, y in (('TYT', 0.62, 0.35), ('DENEME DEFTERİ', 0.2, -0.45)):
        bpy.ops.object.text_add(location=(W / 2 + 0.02, y, 0.036)); t = bpy.context.active_object
        t.data.body = txt; t.data.size = size; t.data.extrude = 0.006; t.data.align_x = 'CENTER'; t.data.bevel_depth = 0.002
        t.name = 'Title_' + txt[:3]; t.data.materials.append(foil); t.parent = cp
    for i in range(3):
        pv = empty(f'PagePivot{i + 1}', (0, 0, 0.455 - i * 0.004), root)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(W / 2 + 0.01, 0, 0)); p = bpy.context.active_object; p.name = f'Page{i + 1}'
        p.scale = (W - 0.06, D - 0.1, 1); bpy.ops.object.transform_apply(scale=True)
        sol = p.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.004; bpy.ops.object.modifier_apply(modifier='s')
        p.data.materials.append(paper); p.parent = pv
    return root


clear(); setup_render(1280, 720, 48); studio(); ground()
book = build_book()
book.rotation_euler = (0, 0, math.radians(-14)); book.location = (-1.4, 0, 0)
camera((1.6, -8.4, 5.6), (0, 0, 0.3), 50)
render(r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender\out\book_0.png')
print('ok')
