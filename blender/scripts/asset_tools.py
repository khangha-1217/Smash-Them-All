"""Shared geometry, rigging and glTF export for the Blender source assets."""

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
COLOR_LAYER = "BakedPalette"


def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.actions, bpy.data.armatures):
        for data in list(collection):
            collection.remove(data)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 60
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.frame_set(1)
    return scene


def palette_material(name):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = True
    nodes = material.node_tree.nodes
    nodes.clear()
    vertex_color = nodes.new("ShaderNodeVertexColor")
    vertex_color.layer_name = COLOR_LAYER
    emission = nodes.new("ShaderNodeEmission")
    light_path = nodes.new("ShaderNodeLightPath")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    output = nodes.new("ShaderNodeOutputMaterial")
    links = material.node_tree.links
    links.new(vertex_color.outputs["Color"], emission.inputs["Color"])
    links.new(light_path.outputs["Is Camera Ray"], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs[0])
    return material


class Geometry:
    """Accumulate opaque surfaces with face colors in one render primitive."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colors = []

    def add(self, vertices, faces, color):
        start = len(self.vertices)
        self.vertices.extend(map(tuple, vertices))
        self.faces.extend(tuple(start + index for index in face) for face in faces)
        self.colors.extend([color] * len(faces))
        return range(start, len(self.vertices))

    def box(self, center, size, color):
        x, y, z = center
        a, b, c = (dimension / 2 for dimension in size)
        vertices = [
            (x - a, y - b, z - c), (x + a, y - b, z - c),
            (x + a, y + b, z - c), (x - a, y + b, z - c),
            (x - a, y - b, z + c), (x + a, y - b, z + c),
            (x + a, y + b, z + c), (x - a, y + b, z + c),
        ]
        faces = [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5),
                 (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
        return self.add(vertices, faces, color)

    def tube(self, start, end, radius, color, sides=10, end_radius=None, caps=True):
        start, end = Vector(start), Vector(end)
        axis = (end - start).normalized()
        tangent = axis.cross(Vector((0, 0, 1)))
        if tangent.length < 0.01:
            tangent = axis.cross(Vector((0, 1, 0)))
        tangent.normalize()
        bitangent = axis.cross(tangent)
        vertices = []
        for center, width in ((start, radius), (end, end_radius if end_radius is not None else radius)):
            for i in range(sides):
                angle = 2 * math.pi * i / sides
                vertices.append(center + width * (tangent * math.cos(angle) + bitangent * math.sin(angle)))
        faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)]
        if caps:
            faces.extend([tuple(reversed(range(sides))), tuple(range(sides, sides * 2))])
        return self.add(vertices, faces, color)

    def shape(self, outlines, color, caps=True):
        """Connect counterclockwise XY outlines from bottom to top."""
        sides = len(outlines[0])
        faces = []
        for lower in range(0, sides * (len(outlines) - 1), sides):
            upper = lower + sides
            for i in range(sides):
                following = (i + 1) % sides
                faces.append((lower + i, lower + following, upper + following, upper + i))
        if caps:
            faces.extend([tuple(reversed(range(sides))), tuple(range(upper, upper + sides))])
        return self.add([point for outline in outlines for point in outline], faces, color)

    def build(self, name, bake):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        mesh.materials.append(palette_material(f"{name} baked palette"))
        colors = mesh.color_attributes.new(name=COLOR_LAYER, type="BYTE_COLOR", domain="CORNER")
        for face, hex_color in zip(mesh.polygons, self.colors):
            rgb = tuple(int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))
            for index in face.loop_indices:
                vertex = mesh.vertices[mesh.loops[index].vertex_index]
                colors.data[index].color_srgb = (*bake(rgb, face.normal, vertex.co), 1)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj


def studio_shade(rgb, normal, _position):
    light = Vector((-0.35, -0.5, 0.8)).normalized()
    gain = 0.72 + 0.31 * max(0, normal.dot(light))
    return tuple(min(1, component * gain) for component in rgb)


def empty(name, position, normal=None):
    marker = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(marker)
    marker.location = position
    if normal is not None:
        marker.rotation_mode = "QUATERNION"
        marker.rotation_quaternion = Vector(normal).to_track_quat("-Y", "Z" if abs(normal[2]) < .99 else "X")
    marker.empty_display_size = 0.12
    marker.empty_display_type = "ARROWS"
    return marker


def box_marker(name, center, size):
    marker = empty(name, center)
    marker.empty_display_type = "CUBE"
    marker["halfExtents"] = [size[0] / 2, size[2] / 2, size[1] / 2]
    return marker


def add_track(target, name, keyframes):
    """Keyframe object or bone Euler poses, then place the action on an NLA track."""
    animation = target.animation_data_create()
    for subject, samples in keyframes.items():
        subject.rotation_mode = "XYZ"
        for frame, angles in samples:
            subject.rotation_euler = tuple(math.radians(angle) for angle in angles)
            subject.keyframe_insert("rotation_euler", frame=frame, group=subject.name)
        subject.rotation_euler = (0, 0, 0)

    action = animation.action
    action.name = name
    slot = animation.action_slot
    animation.action = None
    track = animation.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_slot = slot
    track.mute = True
    return track


def set_view(eye, focus, distance, markers=False, clip_start=0.0003):
    rotation = (Vector(focus) - Vector(eye)).to_track_quat("-Z", "Y")
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type != "VIEW_3D":
                continue
            space = area.spaces.active
            space.clip_start = clip_start
            space.lens = 36
            space.shading.type = "SOLID"
            space.shading.light = "FLAT"
            space.shading.color_type = "VERTEX"
            space.shading.background_type = "WORLD"
            space.shading.show_cavity = False
            space.shading.show_shadows = False
            space.overlay.show_overlays = markers
            space.overlay.show_floor = False
            space.overlay.show_axis_x = False
            space.overlay.show_axis_y = False
            region = space.region_3d
            region.view_perspective = "PERSP"
            region.view_rotation = rotation
            region.view_location = focus
            region.view_distance = distance
            if not bpy.app.background and screen == bpy.context.screen:
                viewport = next((window for window in area.regions if window.type == "WINDOW"), None)
                with bpy.context.temp_override(area=area, region=viewport):
                    region.update()


def export_asset(blend_path, glb_path, animated=False):
    scene = bpy.context.scene
    for obj in scene.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = track.name != "idle"
    scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.preferences.filepaths.save_version = 0
    blend_file, glb_file = ROOT / blend_path, ROOT / glb_path
    blend_file.parent.mkdir(parents=True, exist_ok=True)
    glb_file.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_file))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_file),
        export_format="GLB",
        export_yup=True,
        export_normals=False,
        export_texcoords=False,
        export_vertex_color="NAME",
        export_vertex_color_name=COLOR_LAYER,
        export_extras=True,
        export_animations=animated,
        export_animation_mode="NLA_TRACKS",
        export_anim_slide_to_zero=True,
        export_frame_range=False,
        export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression",
        export_draco_mesh_compression_enable=False,
    )
