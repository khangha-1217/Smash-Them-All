"""Rebuild the Slipper with Blender 5.3: blender -b --python blender/scripts/slipper.py."""

import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, export_asset, reset_scene, set_view, studio_shade


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

    for row in range(9):
        y = -.027 + row * .023
        width = .024 if row < 4 else .034
        for side in (-1, 1):
            center = side * (width / 2 + .003)
            vertices = [(center - width / 2, y - .004, -.024), (center + width / 2, y + side * .004, -.024),
                        (center + width / 2, y + side * .004 + .008, -.024), (center - width / 2, y + .004, -.024)]
            g.shape([vertices, [(x, y, -.020) for x, y, _ in vertices]], "335856")

    # Raised diamond shapes give the heel a grippy texture and a readable color accent.
    for row in range(5):
        for column in range(3):
            x = (column - 1) * .014
            y = -.024 + .015 * row
            vertices = [(x, y - .0035, .012), (x + .0048, y, .012),
                        (x, y + .0035, .012), (x - .0048, y, .012)]
            g.shape([vertices, [(a, b, .0134) for a, b, _ in vertices]], "89b8a7")


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


def build():
    reset_scene()
    g = Geometry()
    rubber_sole(g)
    rubber_strap(g)
    # Cant the toe up slightly while keeping the heel grip at the local origin.
    tilt = Matrix.Rotation(math.radians(13), 3, "X")
    g.vertices = [tuple(tilt @ Vector(point)) for point in g.vertices]
    slipper = g.build("Slipper grip, rubber sole and arch strap", studio_shade)
    add_track(slipper, "idle", {slipper: [
        (1, (0, 0, 0)), (23, (2.6, -2.1, 1.5)), (45, (0, 0, 0)),
    ]})
    add_track(slipper, "swing", {slipper: [
        (1, (0, 0, 0)), (3, (-20, -18, -22)), (6, (-42, 16, 64)),
        (8, (17, -8, 28)), (10, (0, 0, 0)),
    ]})
    set_view((.30, -.20, .40), (0, .07, .020), .437)
    return slipper


def export():
    export_asset("blender/weapons/slipper.blend", "public/assets/models/weapons/slipper.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
