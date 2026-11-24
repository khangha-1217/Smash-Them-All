"""Rebuild Cardboard with Blender 5.3: blender -b --python blender/scripts/cardboard.py."""

import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, export_asset, reset_scene, set_view, studio_shade


PROFILE = [(-.10, -.046), (.091, -.043), (.103, -.013), (.111, .172), (.096, .216),
           (.064, .224), (.057, .219), (-.041, .225), (-.051, .216), (-.093, .219), (-.110, .179)]


def board(g):
    # Shape the kraft liner sheets around an exposed, folded corrugated core.
    for z, half, color in ((-.012, .0016, "c59b71"), (.012, .0016, "cfaa7f")):
        g.shape([[(x, y, z - half) for x, y in PROFILE],
                 [(x, y, z + half) for x, y in PROFILE]], color)
    inset = [(x * .991, .080 + (y - .080) * .991) for x, y in PROFILE]
    g.shape([[(x, y, -.0104) for x, y in inset], [(x, y, .0104) for x, y in inset]], "745340")
    for start, end in zip(PROFILE, PROFILE[1:] + PROFILE[:1]):
        dx, dy = end[0] - start[0], end[1] - start[1]
        length = math.hypot(dx, dy)
        count = max(1, round(length / .022))
        for i in range(count):
            u, v = (i + .21) / count, (i + .77) / count
            nx, ny = dy / length * .0005, -dx / length * .0005
            a = (start[0] + dx * u + nx, start[1] + dy * u + ny, -.009)
            b = (start[0] + dx * v + nx, start[1] + dy * v + ny, .009)
            g.add([a, (a[0] + dx * .2 / count, a[1] + dy * .2 / count, a[2]),
                   (b[0] + dx * .2 / count, b[1] + dy * .2 / count, b[2]), b],
                  [(0, 1, 2, 3)], "ac7955")
    # A small crease and tape bands from the original shipping carton.
    for y, width, color in ((.008, .184, "ad865e"), (.014, .185, "dfb68c"),
                            (.173, .208, "bd946a"), (.177, .208, "dfb68c")):
        g.box((0, y, .0138), (width, .003, .0005), color)
    g.box((.072, .078, .014), (.049, .18, .0018), "dbb879")
    g.box((.072, .082, .015), (.038, .158, .0010), "e5c18b")
    for y in (.012, .030, .163):
        g.box((.072, y, .016), (.031, .003, .0005), "c99e70")
    g.box((.072, .074, -.014), (.047, .23, .001), "ceab75")


def shipping_marks(g):
    g.box((-.032, .12, .014), (.092, .066, .0013), "e9d4b1")
    for index, width in enumerate((.0028, .0016, .0041, .0018, .0021, .004, .0015, .0027, .0034)):
        x = -.066 + index * .008
        g.box((x, .112, .015), (width, .027, .001), "775e52")
    for x in (-.054, -.036):
        g.box((x, .138, .015), (.061 if x == -.036 else .028, .0024, .001), "aa866b")
    # Ink stamp on the liner, separate from the label.
    g.box((-.031, .052, .014), (.048, .004, .001), "876a56")
    for x in (-.047, -.017):
        g.box((x, .063, .014), (.005, .02, .001), "876a56")
        g.add([(x - .009, .071, .015), (x + .009, .071, .015), (x, .081, .015)], [(0, 1, 2)], "876a56")


def build():
    reset_scene()
    g = Geometry()
    board(g)
    shipping_marks(g)
    tilt = Matrix.Rotation(math.radians(25), 3, "X")
    g.vertices = [tuple(tilt @ Vector(point)) for point in g.vertices]
    mesh = g.build("Cardboard kraft liner, corrugated edge and shipping label", studio_shade)
    add_track(mesh, "idle", {mesh: [
        (1, (0, 0, 0)), (24, (1.5, 1.7, -2.2)), (47, (0, 0, 0)),
    ]})
    # Frame 4 is one third through the 1-10 swing, the shared 100 ms contact.
    add_track(mesh, "swing", {mesh: [
        (1, (0, 0, 0)), (2, (-18, -20, -28)), (4, (-37, 19, 47)),
        (8, (16, -8, 17)), (10, (0, 0, 0)),
    ]})
    set_view((.24, -.20, .41), (0, .071, .043), .424)
    return mesh


def export():
    export_asset("blender/weapons/cardboard.blend", "public/assets/models/weapons/cardboard.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
