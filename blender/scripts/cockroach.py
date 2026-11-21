"""Rebuild the rigged cockroach with Blender 5.3: blender -b --python blender/scripts/cockroach.py."""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, export_asset, reset_scene, set_view, studio_shade


def shell(g, cx, cy, width, length, rings, color):
    return g.shape([
        [(cx + width * scale * math.cos(i * math.tau / 8),
          cy + length * scale * math.sin(i * math.tau / 8), z) for i in range(8)]
        for z, scale in rings
    ], color)


def tapered_joint(g, points, radii, color):
    """One triangular tube follows each kink in a leg or feeler."""
    outlines = []
    for i, (point, radius) in enumerate(zip(points, radii)):
        center = Vector(point)
        direction = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])
        direction.normalize()
        tangent = direction.cross(Vector((0, 0, 1))).normalized()
        bitangent = direction.cross(tangent)
        outlines.append([center + radius * (
            math.cos(side * math.tau / 3) * tangent + math.sin(side * math.tau / 3) * bitangent
        ) for side in range(3)])
    return g.shape(outlines, color)


def wing(g, side):
    # The raised center and split amber tips distinguish the two wings when closed.
    outline = [(0.0010, -.0208, .0078), (.0049, -.0183, .0076), (.0078, -.0081, .0076),
               (.0056, .0022, .0084), (.0021, .0033, .0089), (.00037, -.0059, .0093)]
    if side < 0:
        outline.reverse()
    brim = [(side * x, y, z) for x, y, z in outline]
    lower = [(x, y, z - .0009) for x, y, z in brim]
    rim_faces = [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)]
    g.add(lower + brim, rim_faces + [(5, 4, 3, 2, 1, 0)], "63392e")
    center = (side * .0039, -.0071, .0108)
    first = len(g.vertices) - 12
    for i, color in enumerate(("b9703e", "cc8a49", "c38342", "df9d57", "e3a963", "c38249")):
        g.add([brim[i], brim[(i + 1) % 6], center], [(0, 1, 2)], color)
    return range(first, len(g.vertices))


def geometry():
    g = Geometry()
    groups = {"body": []}
    pivots = {"body": (0, 0, 0)}
    groups["body"].extend(shell(g, 0, -.0095, .0075, .0125,
                                ((.0027, .63), (.0055, 1), (.0083, .68)), "744437"))
    groups["body"].extend(shell(g, 0, .0042, .0065, .0075,
                                ((.0040, .84), (.0096, 1)), "9b5941"))
    groups["body"].extend(shell(g, 0, .0124, .0047, .0056,
                                ((.0046, .8), (.0090, 1)), "794839"))

    for side, suffix in ((-1, "l"), (1, "r")):
        name = f"wing_{suffix}"
        pivots[name] = (side * .0022, .0022, .0081)
        groups[name] = wing(g, side)
        for number, (y, elbow_y, toe_y, width) in enumerate(
            ((.0067, .009, .0118, .0116), (-.001, -.0030, -.0062, .0132), (-.0087, -.012, -.0182, .0118)),
            start=1,
        ):
            name = f"leg_{number}_{suffix}"
            pivot = (side * .0041, y, .0053)
            pivots[name] = pivot
            groups[name] = tapered_joint(g,
                [pivot, (side * width * .69, elbow_y, .0056), (side * width, toe_y, .00065)],
                [.00115, .00081, .00030], "a77854")

        name = f"antenna_{suffix}"
        pivot = (side * .0029, .0158, .0072)
        pivots[name] = pivot
        groups[name] = tapered_joint(g,
            [pivot, (side * .0058, .0250, .0128), (side * .0098, .0352, .0112)],
            [.00073, .00050, .00016], "d2a66e")
        groups["body"].extend(g.tube((side * .0036, .0138, .0087),
                                     (side * .0039, .0148, .0097), .00145, "342a2b", 3, .001))
    # Center the asset on the body for placement and rotation in the game.
    def center(point):
        x, y, z = point
        return (x, y + .002, z - .006)

    g.vertices = [center(point) for point in g.vertices]
    pivots = {name: center(point) for name, point in pivots.items()}
    pivots["body"] = (0, 0, 0)
    return g, pivots, groups


def rig(mesh, pivots, groups):
    armature = bpy.data.armatures.new("Cockroach articulated skeleton")
    obj = bpy.data.objects.new("Cockroach rig", armature)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, pivot in pivots.items():
        bone = armature.edit_bones.new(name)
        bone.head = pivot
        bone.tail = (pivot[0], pivot[1] + .006, pivot[2])
        if name != "body":
            bone.parent = armature.edit_bones["body"]
    bpy.ops.object.mode_set(mode="OBJECT")
    mesh.parent = obj
    for name, indices in groups.items():
        mesh.vertex_groups.new(name=name).add(list(indices), 1.0, "REPLACE")
    skin = mesh.modifiers.new("Rigid shell pieces", "ARMATURE")
    skin.object = obj
    obj.select_set(False)
    return obj


def animate(roach):
    bones = roach.pose.bones
    idle = {bones["body"]: [(1, (0, 0, 0)), (20, (3, 0, 0)), (40, (0, 0, 0))]}
    crawl = {bones["body"]: [(1, (0, 0, 0)), (7, (0, 0, 4)),
                             (13, (0, 0, 0)), (19, (0, 0, -4)), (25, (0, 0, 0))]}
    fly = {bones["body"]: [(1, (-12, 0, 0)), (7, (-6, 0, 0)), (13, (-12, 0, 0))]}
    for side, suffix in ((-1, "l"), (1, "r")):
        antenna = bones[f"antenna_{suffix}"]
        idle[antenna] = [(1, (0, 0, 0)), (20, (13, 0, side * 17)), (40, (0, 0, 0))]
        crawl[antenna] = [(1, (0, 0, 0)), (13, (-12, 0, side * 10)), (25, (0, 0, 0))]
        fly[antenna] = [(1, (-14, 0, 0)), (7, (-22, 0, side * 13)), (13, (-14, 0, 0))]
        wing_bone = bones[f"wing_{suffix}"]
        fly[wing_bone] = [
            (frame, (0, side * tilt, side * spread))
            for frame, tilt, spread in ((1, -17, 67), (4, -58, 75), (7, -17, 67),
                                        (10, -58, 75), (13, -17, 67))
        ]
        for number in range(1, 4):
            leg = bones[f"leg_{number}_{suffix}"]
            gait = side * (-1 if number % 2 else 1)
            crawl[leg] = [
                (1, (0, 0, -gait * 18)), (7, (0, -side * 19 if gait > 0 else 0, 0)),
                (13, (0, 0, gait * 18)), (19, (0, -side * 19 if gait < 0 else 0, 0)),
                (25, (0, 0, -gait * 18)),
            ]
            fly[leg] = [(1, (0, side * 10, -side * 24)), (7, (0, side * 20, -side * 29)),
                        (13, (0, side * 10, -side * 24))]
    add_track(roach, "idle", idle)
    add_track(roach, "crawl", crawl)
    add_track(roach, "fly", fly)


def build():
    reset_scene()
    g, pivots, groups = geometry()
    mesh = g.build("Cockroach shell, wings, legs and feelers", studio_shade)
    roach = rig(mesh, pivots, groups)
    animate(roach)
    set_view((.052, .037, .065), (0, .005, 0), .070)
    return roach


def export():
    export_asset("blender/cockroach.blend", "public/assets/models/cockroach.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
