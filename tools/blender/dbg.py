import bpy
from mathutils import Vector
bpy.context.view_layer.update()
o = bpy.data.objects['Endpaper']
print(o.location[:], o.parent.name, o.parent.location[:], [round(v,3) for v in o.matrix_world.translation], len(o.data.vertices), [round(v.co.z,3) for v in o.data.vertices])
