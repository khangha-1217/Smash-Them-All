"""Rebuild the Slipper with Blender 5.3: blender -b --python blender/scripts/slipper.py."""

import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, empty, export_asset, reset_scene, set_view, studio_shade


# Cross-sections of the footbed, from the narrow heel to the rounded toe.
# Each station describes the outline center and half-width.
STATIONS = [
    (-.058, .003, .009), (-.054, .003, .022), (-.045, .003, .034),
    (-.031, .003, .041), (-.004, .003, .043), (.032, .002, .041),
    (.060, .000, .041), (.086, -.002, .045), (.116, -.004, .049),
    (.148, -.005, .051), (.173, -.005, .050), (.187, -.005, .045),
    (.198, -.005, .035), (.205, -.004, .022), (.209, -.004, .009),
]


def sole_height(y):
    # A shallow toe spring lifts the front lip above the scooped footbed.
    return .013 * (max(0, y - .12) / .09) ** 2 + .003 * (max(0, .01 - y) / .07) ** 2


def rubber_sole(g):
    outline = [(x + w, y) for y, x, w in STATIONS]
    outline += [(x - w, y) for y, x, w in reversed(STATIONS)]
    # Turn the sidewall inward at the lip and back down into the footbed.
    profile = [(.95, .98, -.011), (1, 1, -.007), (1, 1, .006),
               (.96, .989, .009), (.90, .966, .003)]
    rings = [[(x * width, .075 + (y - .075) * length, z + sole_height(y))
              for x, y in outline] for width, length, z in profile]
    count = len(outline)
    for low, high, color in zip(rings, rings[1:], ("d991a0", "e8a6b3", "f7c8cf", "e8afbb")):
        g.add(low + high, [(i, (i+1) % count, (i+1) % count + count, i + count)
                           for i in range(count)], color)
    # Crosswise quads follow the toe spring on both broad faces.
    for ring, color, bottom in ((rings[0], "dd9daa", True), (rings[-1], "f8d1d5", False)):
        faces = [(i, i+1, count-i-2, count-i-1) for i in range(len(STATIONS)-1)]
        g.add(ring, [face[::-1] if bottom else face for face in faces], color)


def rubber_strap(g):
    # A plain, broad molded band flares into the sidewalls at both anchors.
    outer, inner = [], []
    for step in range(15):
        angle = math.pi * step / 14
        across, height = -math.cos(angle), math.sin(angle)
        y_back = .058 + .018 * height
        y_front = .148 - .007 * height
        for band, inset in ((outer, 0), (inner, .003)):
            band.extend([
                (-.001 + (.043 - inset) * across, y_back, .003 + (.046 - inset) * height),
                (-.005 + (.051 - inset) * across, y_front, .004 + (.047 - inset) * height),
            ])
    faces = [(i, i+2, i+3, i+1) for i in range(0, len(outer)-2, 2)]
    g.add(outer, faces, "f1b8c3")
    g.add(inner, [face[::-1] for face in faces], "dda0ae")
    n = len(outer)
    edges = []
    for edge in range(0, n-2, 2):
        edges.extend([(edge, edge+n, edge+n+2, edge+2),
                              (edge+1, edge+3, edge+n+3, edge+n+1)])
    g.add(outer + inner, edges, "f7cbd2")


def build():
    reset_scene()
    g = Geometry()
    rubber_sole(g)
    rubber_strap(g)
    # Cant the toe up slightly while keeping the heel grip at the local origin.
    tilt = Matrix.Rotation(math.radians(13), 3, "X")
    swing_pivot = tilt @ Vector((.015, -.076, .021))
    g.vertices = [tuple(tilt @ Vector(point) - swing_pivot) for point in g.vertices]
    slipper = g.build("Pink slide", studio_shade)
    slipper.name = "slipper"
    slipper.parent = empty("slipper_grip", (0, 0, 0))
    slipper.location = swing_pivot
    add_track(slipper, "idle", {slipper: [
        (1, (0, 0, 0)), (25, (1.2, -.8, 1.1)), (49, (0, 0, 0)),
    ]})
    # At frame 4 the toe travels diagonally down and across the grip.
    add_track(slipper, "swing", {slipper: [
        (1, (0, 0, 0)), (2, (14, -12, -19)), (4, (-39, 18, 42)),
        (5, (-34, 15, 37)), (7, (-8, 4, 15)), (9, (2, -1, -2)), (10, (0, 0, 0)),
    ]})
    set_view((.28, -.23, .40), (0, .013, .015), .63)
    return slipper


def export():
    export_asset("blender/weapons/slipper.blend", "public/assets/models/weapons/slipper.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
