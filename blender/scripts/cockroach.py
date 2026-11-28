"""Run from any directory with Blender 5.3: blender -b --python blender/scripts/cockroach.py."""

import json
import struct
from math import cos, pi, radians, sin
from pathlib import Path
from shutil import which
from subprocess import run
from tempfile import TemporaryDirectory

import bpy
from mathutils import Quaternion, Vector


packer = which("gltfpack")
if not packer:
    raise RuntimeError("Asset export requires gltfpack 1.0 on PATH")

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
# The source uses 30 fps with the folded-wing pose on frame 1.
scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(ROOT / "sample/cockroach-v2.glb"))
rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
animation = rig.animation_data
flight = bpy.data.actions["Take 001"]
flight.name = "fly"
animation.nla_tracks[0].name = "fly"
scene.frame_set(1)

# Capture the authored ground pose, including the leg and wing offsets from bind pose.
ground_pose = {bone.name: bone.matrix_basis.copy() for bone in rig.pose.bones}
vertical = Vector((0, 0, 1))
up_axes = {
    bone.name: (rig.matrix_world @ bone.matrix).to_quaternion().inverted() @ vertical
    for bone in rig.pose.bones
}
animation.action = None


def ground_clip(name, period):
    for bone in rig.pose.bones:
        bone.matrix_basis = ground_pose[bone.name]
        for path in ("location", "rotation_quaternion", "scale"):
            bone.keyframe_insert(path, frame=1, group=bone.name)

    for step in range(9):
        phase = step * pi / 4
        frame = 1 + period * step / 8
        for side in ("L", "R"):
            # Both antenna chains are labeled L in the source rig.
            antenna, sign = ("Antenna_L1_", 1) if side == "L" else ("Antenna_L14_", -1)
            swings = {antenna: sign * 5 * sin(phase)}
            if name == "crawl":
                # Alternate the front and rear legs with the opposite middle leg.
                rear = "Right" if side == "R" else "L"
                for prefix, tripod in ((f"Frontal_{side}", 1), (f"Middle_{side}", -1),
                                       (f"Back_{rear}", 1)):
                    swings[f"Leg_{prefix}1_"] = 18 * tripod * cos(phase)
            for prefix, degrees in swings.items():
                bone = next(b for b in rig.pose.bones if b.name.startswith(prefix))
                rotation = Quaternion(up_axes[bone.name], radians(degrees))
                bone.rotation_quaternion = ground_pose[bone.name].to_quaternion() @ rotation
                bone.keyframe_insert("rotation_quaternion", frame=frame, group=bone.name)

    action = animation.action
    action.name = name
    slot = animation.action_slot
    animation.action = None
    track = animation.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action).action_slot = slot
    track.mute = True
    return track


idle = ground_clip("idle", 48)
ground_clip("crawl", 12)
idle.mute = False
scene.frame_set(1)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blender/cockroach.blend"))
# Keep the full-resolution rig in the .blend; simplify only the runtime export.
mesh = next(obj for obj in scene.objects if obj.type == "MESH")
lod = mesh.modifiers.new("Game mesh", "DECIMATE")
lod.ratio = 1450 / len(mesh.data.polygons)
bpy.context.view_layer.objects.active = mesh
# Decimate the base mesh before skinning.
bpy.ops.object.modifier_move_to_index(modifier=lod.name, index=0)
bpy.ops.object.modifier_apply(modifier=lod.name)
texture = next(image for image in bpy.data.images if image.packed_file)
texture.scale(176, 176)
texture.file_format = "JPEG"
texture.pack()


def read_glb(path):
    data = path.read_bytes()
    end = 20 + struct.unpack_from("<I", data, 12)[0]
    return json.loads(data[20:end]), data[end + 8:]


def write_glb(path, document, binary):
    metadata = json.dumps(document, separators=(",", ":")).encode()
    metadata += b" " * (-len(metadata) % 4)
    header = struct.pack("<4sIII4s", b"glTF", 2, 28 + len(metadata) + len(binary), len(metadata), b"JSON")
    path.write_bytes(header + metadata + struct.pack("<I4s", len(binary), b"BIN\0") + binary)


with TemporaryDirectory() as temporary:
    intermediate = Path(temporary) / "cockroach.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(intermediate),
        export_image_format="JPEG",
        export_jpeg_quality=72,
        export_animation_mode="NLA_TRACKS",
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
        export_frame_range=False,
        export_copyright="Cockroach by kenchoo, CC BY-NC-ND 4.0. https://sketchfab.com/3d-models/cockroach-64ec45b65a224895b1d4ee5fd4f0ee42",
    )
    # Make the folded pose the default. The packer can then discard constant keys
    # and the mixer restores folded wings whenever flight fades out.
    document, binary = read_glb(intermediate)
    idle_clip = next(clip for clip in document["animations"] if clip["name"] == "idle")
    def samples(clip, channel):
        sampler = clip["samplers"][channel["sampler"]]
        accessor = document["accessors"][sampler["output"]]
        view = document["bufferViews"][accessor["bufferView"]]
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        fmt = "<4f" if channel["target"]["path"] == "rotation" else "<3f"
        stride = view.get("byteStride", struct.calcsize(fmt))
        for key in range(accessor["count"]):
            yield struct.unpack_from(fmt, binary, offset + key * stride)

    for channel in idle_clip["channels"]:
        target = channel["target"]
        document["nodes"][target["node"]][target["path"]] = next(samples(idle_clip, channel))

    for clip in document["animations"]:
        animated = []
        for channel in clip["channels"]:
            target = channel["target"]
            rest = document["nodes"][target["node"]][target["path"]]
            if any(abs(a - b) > 1e-5 for value in samples(clip, channel) for a, b in zip(value, rest)):
                animated.append(channel)
        clip["channels"] = animated
    write_glb(intermediate, document, binary)

    packed = Path(temporary) / "cockroach-packed.glb"
    run([packer, "-i", str(intermediate), "-o", str(packed),
         "-cc", "-ce", "ext", "-kn", "-af", "24"], check=True)

    document, binary = read_glb(packed)
    source, _ = read_glb(ROOT / "sample/cockroach-v2.glb")
    document["asset"]["extras"] = source["asset"]["extras"]
    document["meshes"][0]["name"] = "Cockroach"
    write_glb(ROOT / "public/assets/models/cockroach.glb", document, binary)
