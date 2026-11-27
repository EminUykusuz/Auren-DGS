import sys, os
sys.path.insert(0, r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender')
import importlib, common
importlib.reload(common)
from common import *
import builtins; builtins.NO_PREVIEW = True
import pencil, book2
importlib.reload(pencil); importlib.reload(book2)

OUT = r'C:\Users\msı\Desktop\Freelance\DGS-Touch\client\src\assets\models'
os.makedirs(OUT, exist_ok=True)


def export(root, name):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root)
    # metin/eğri nesneleri mesh'e çevrilir
    bpy.context.view_layer.objects.active = root
    for o in [o for o in bpy.context.selected_objects if o.type == 'FONT']:
        bpy.context.view_layer.objects.active = o; bpy.ops.object.convert(target='MESH'); o.select_set(True)
    path = os.path.join(OUT, name)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_materials='EXPORT', export_image_format='AUTO', export_cameras=False, export_lights=False,
                              export_animations=False, export_extras=False, export_texcoords=True, export_normals=True)
    print(name, os.path.getsize(path) // 1024, 'KB')


clear(); p = pencil.build_pencil(); export(p, 'pencil.glb')
clear(); b = book2.build_book(); export(b, 'book.glb')
bpy.ops.wm.save_as_mainfile(filepath=r'C:\Users\msı\Desktop\Freelance\DGS-Touch\tools\blender\auren-assets.blend')
