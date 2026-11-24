"""Rebuild the Slipper with Blender 5.3: blender -b --python blender/scripts/slipper.py."""

import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, empty, export_asset, reset_scene, set_view, studio_shade


FOOTPRINT = [
    (0, -.058), (.033, -.054), (.048, -.038), (.051, -.005), (.050, .032),
    (.052, .072), (.062, .112), (.066, .154), (.056, .187), (.031, .201),
    (-.003, .205), (-.036, .197), (-.061, .182), (-.074, .152), (-.070, .108),
    (-.058, .060), (-.048, .014), (-.050, -.023), (-.038, -.047),
]


def rubber_sole(g):
    rings = [(.91, -.020), (1.0, -.013), (1.0, -.004), (.995, .002), (.924, .012)]
    palette = ["315a5c", "4c7976", "e6a37a", "629993"]
    outlines = [[(x * scale, .073 + (y - .073) * scale, height)
                 for x, y in FOOTPRINT] for scale, height in rings]
    vertices = [point for outline in outlines for point in outline]
    sides = len(FOOTPRINT)
    g.add(outlines[0], [tuple(reversed(range(sides)))], "3e6563")
    for level, color in enumerate(palette):
        g.add(vertices[level * sides:(level + 2) * sides],
              [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)], color)
    g.add(outlines[-1], [tuple(range(sides))], "77a8a0")

    for row in range(6):
        y = -.027 + row * .023
        width = .024 if row < 4 else .034
        for side in (-1, 1):
            center = side * (width / 2 + .003)
            vertices = [(center - width / 2, y - .004, -.024), (center + width / 2, y + side * .004, -.024),
                        (center + width / 2, y + side * .004 + .008, -.024), (center - width / 2, y + .004, -.024)]
            g.shape([vertices, [(x, y, -.020) for x, y, _ in vertices]], "335856")

    # Baked diamonds give the heel a grippy texture without thickening the footbed.
    for row in range(5):
        for column in range(3):
            x = (column - 1) * .014
            y = -.024 + .015 * row
            vertices = [(x, y - .0035, .0123), (x + .0048, y, .0123),
                        (x, y + .0035, .0123), (x - .0048, y, .0123)]
            g.add(vertices, [(0, 1, 2, 3)], "89b8a7")


def rubber_strap(g):
    # Outside and inside follow an arch with broad side anchors and raised edges.
    arch = [(-.060, .003), (-.056, .031), (-.039, .052), (-.016, .063),
            (.009, .064), (.032, .055), (.049, .036), (.054, .008)]
    for i, (first, second) in enumerate(zip(arch, arch[1:])):
        x0, z0 = first
        x1, z1 = second
        front0, front1 = .104 + x0 * .24, .104 + x1 * .24
        back0, back1 = front0 + .052, front1 + .052
        outer = [(x0, front0, z0), (x1, front1, z1), (x1, back1, z1), (x0, back0, z0)]
        inner = [(x, y, z - .0075) for x, y, z in outer]
        g.add(outer, [(0, 1, 2, 3)], "7eb1aa")
        g.add(inner, [(3, 2, 1, 0)], "4b7471")
        g.add(outer + inner, [(0, 4, 5, 1), (2, 6, 7, 3)], "587e79")
        for fraction, width, color in ((.05, .06, "a5c4ad"), (.88, .06, "a5c4ad"), (.50, .10, "e6a37a")):
            a, b = front0 + .052 * fraction, front1 + .052 * fraction
            ridge = [(x0, a, z0 + .0006), (x1, b, z1 + .0006),
                     (x1, b + .052 * width, z1 + .0006), (x0, a + .052 * width, z0 + .0006)]
            g.add(ridge, [(0, 1, 2, 3)], color)
        if i == 3:
            x, y, z = -.004, .131, .066
            g.add([(x, y - .009, z), (x + .011, y, z), (x, y + .009, z), (x - .011, y, z)],
                  [(0, 1, 2, 3)], "f4c49d")


def rounded_chain(g, sections, sides, color):
    centers = [Vector(center) for center, _, _ in sections]
    outlines = []
    for i, (center, (_, width, depth)) in enumerate(zip(centers, sections)):
        before = centers[max(0, i - 1)]
        after = centers[min(len(centers) - 1, i + 1)]
        axis = (after - before).normalized()
        across = Vector((1, 0, 0))
        across = (across - across.dot(axis) * axis).normalized()
        normal = axis.cross(across)
        outlines.append([
            center + across * (width * math.cos(angle)) + normal * (depth * math.sin(angle))
            for angle in (math.tau * j / sides for j in range(sides))
        ])
    g.shape(outlines, color)


def right_hand(g):
    # The fingers come around the back of the heel. The thumb pinches from the near edge.
    rounded_chain(g, [
        ((.073, -.171, -.062), .022, .018),
        ((.058, -.123, -.052), .024, .019),
        ((.037, -.087, -.043), .032, .022),
        ((.012, -.059, -.039), .041, .020),
        ((.007, -.037, -.032), .031, .012),
    ], 8, "d99a6c")
    for x, heel_y, width in ((.038, -.050, .009), (.018, -.056, .009),
                            (-.002, -.057, .0085), (-.021, -.053, .0075)):
        rounded_chain(g, [
            ((x + .003, heel_y + .005, -.038), width, .010),
            ((x, heel_y - .010, -.015), width, .009),
            ((x, heel_y - .006, .009), width, .009),
            ((x, heel_y + .015, .017), width * .66, .005),
        ], 6, "d99a6c")
    rounded_chain(g, [
        ((.049, -.073, -.035), .015, .012),
        ((.064, -.053, -.016), .014, .013),
        ((.057, -.025, .010), .012, .010),
        ((.035, -.021, .017), .008, .005),
    ], 8, "e2a776")


def build():
    reset_scene()
    g = Geometry()
    rubber_sole(g)
    rubber_strap(g)
    right_hand(g)
    # Cant the toe up slightly while keeping the heel grip at the local origin.
    tilt = Matrix.Rotation(math.radians(13), 3, "X")
    wrist_pivot = tilt @ Vector((.055, -.119, -.051))
    g.vertices = [tuple(tilt @ Vector(point) - wrist_pivot) for point in g.vertices]
    wrist = g.build("Right hand, rubber sole and arch strap", studio_shade)
    wrist.name = "right_wrist"
    wrist.parent = empty("slipper_grip", (0, 0, 0))
    wrist.location = wrist_pivot
    add_track(wrist, "idle", {wrist: [
        (1, (0, 0, 0)), (25, (1.2, -.8, 1.1)), (49, (0, 0, 0)),
    ]})
    # At frame 4 the toe travels diagonally down and across the grip.
    add_track(wrist, "swing", {wrist: [
        (1, (0, 0, 0)), (2, (14, -12, -19)), (4, (-39, 18, 42)),
        (5, (-34, 15, 37)), (7, (-8, 4, 15)), (9, (2, -1, -2)), (10, (0, 0, 0)),
    ]})
    set_view((.28, -.23, .40), (0, .013, .015), .63)
    return wrist


def export():
    export_asset("blender/weapons/slipper.blend", "public/assets/models/weapons/slipper.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
