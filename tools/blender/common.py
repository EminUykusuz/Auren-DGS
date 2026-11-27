import bpy, bmesh, math
from mathutils import Vector


def clear():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for b in list(c):
            if b.users == 0: c.remove(b)


def srgb(h):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b), 1)


def mat(name, color, rough=0.5, metal=0, clear=0, **kw):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else color
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if clear: b.inputs['Coat Weight'].default_value = clear; b.inputs['Coat Roughness'].default_value = 0.2
    for k, v in kw.items(): b.inputs[k.replace('_', ' ')].default_value = v
    return m


def box(name, size, loc, bevel=0.0, segs=3, m=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = segs; md.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier='bv')
    bpy.ops.object.shade_smooth()
    if m: o.data.materials.append(m)
    if parent: o.parent = parent
    return o


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e); e.location = loc
    if parent: e.parent = parent
    return e


def setup_render(w=1280, h=720, samples=48):
    s = bpy.context.scene; s.render.engine = 'CYCLES'
    p = bpy.context.preferences.addons['cycles'].preferences; p.compute_device_type = 'OPTIX'; p.get_devices()
    for d in p.devices: d.use = d.type == 'OPTIX'
    s.cycles.device = 'GPU'; s.cycles.samples = samples; s.cycles.use_denoising = True
    s.render.resolution_x, s.render.resolution_y = w, h; s.render.film_transparent = False
    s.view_settings.view_transform = 'AgX'; s.view_settings.look = 'AgX - Medium High Contrast'


def studio(bgcolor='#06161a'):
    w = bpy.context.scene.world or bpy.data.worlds.new('W'); bpy.context.scene.world = w; w.use_nodes = True
    n = w.node_tree.nodes; n['Background'].inputs['Color'].default_value = srgb(bgcolor); n['Background'].inputs['Strength'].default_value = 0.35

    def area(name, loc, energy, size, color='#ffffff'):
        bpy.ops.object.light_add(type='AREA', location=loc); l = bpy.context.active_object; l.name = name
        l.data.energy = energy; l.data.size = size; l.data.color = srgb(color)[:3]
        d = Vector((0, 0, 0.2)) - Vector(loc); l.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return l
    area('Key', (3, -5, 7), 900, 5, '#fff1de'); area('Rim', (-6, 4, 4), 500, 4, '#22d3ee'); area('Fill', (6, 3, 3), 120, 6, '#d6f5ea')


def camera(loc, target, lens=50):
    bpy.ops.object.camera_add(location=loc); c = bpy.context.active_object; c.data.lens = lens
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); bpy.context.scene.camera = c; return c


def ground(m=None):
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); g = bpy.context.active_object; g.name = 'Ground'
    g.data.materials.append(m or mat('GroundMat', '#071a1f', 0.35, 0.0)); return g


def render(path):
    bpy.context.scene.render.filepath = path; bpy.ops.render.render(write_still=True)
