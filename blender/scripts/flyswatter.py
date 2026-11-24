"""Rebuild Flyswatter with Blender 5.3: blender -b --python blender/scripts/flyswatter.py."""

import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, add_track, export_asset, reset_scene, set_view, studio_shade


HEAD = [(-.046, .186), (.047, .184), (.062, .199), (.068, .278), (.058, .301),
        (.035, .311), (-.039, .309), (-.061, .297), (-.070, .275), (-.065, .201)]


def grip(g):
    g.tube((0, -.048, 0), (0, .061, 0), .016, "244f59", 10, .012)
    g.tube((0, .061, 0), (0, .17, 0), .011, "358e91", 10, .008)
    g.tube((0, .16, 0), (0, .201, 0), .014, "4ea8a0", 10, .027)
    for y, width in ((-.043, .018), (-.028, .016), (-.013, .015), (.002, .015), (.017, .014), (.034, .014)):
        g.tube((0, y, 0), (0, y + .003, 0), width, "6bb6a3" if y < -.039 else "3b7580", 8)
    for sign in (-1, 1):
        g.tube((sign * .009, .157, .002), (sign * .037, .191, .002), .005, "387278", 7)


def grid_head(g):
    cy = .247
    shape = ((.98, -.006), (1, -.003), (1, .004), (.98, .007),
             (.87, .007), (.85, .004), (.85, -.003), (.87, -.006))
    colors = ("25616a", "429c98", "66b5a4", "7ac5ad", "429c98", "347c7e", "25616a", "388989")
    sides = len(HEAD)
    faces = [(i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)]
    for index, color in enumerate(colors):
        rings = shape[index], shape[(index + 1) % len(shape)]
        points = [(x * scale, cy + (y - cy) * scale, z) for scale, z in rings for x, y in HEAD]
        g.add(points, faces, color)

    for x, bottom, top in ((-.049, .205, .290), (-.036, .193, .299), (-.024, .192, .303),
                           (-.012, .191, .303), (0, .191, .305), (.012, .191, .305),
                           (.024, .191, .304), (.036, .191, .301), (.049, .202, .291)):
        g.box((x, (bottom + top) / 2, 0), (.0035, top - bottom, .0057), "4ca49b")
    for index in range(8):
        y = .204 + index * .013
        g.box((0, y, .0004), (.104 if index in (0, 7) else .116, .0038, .0062), "69b9a8")
    for x in (-.019, .019):
        g.tube((x, .191, .003), (x, .191, .009), .0048, "efc787", 8)


def build():
    reset_scene()
    g = Geometry()
    grip(g)
    grid_head(g)
    tilt = Matrix.Rotation(math.radians(26), 3, "X")
    g.vertices = [tuple(tilt @ Vector(point)) for point in g.vertices]
    mesh = g.build("Flyswatter rubber grip, turquoise stem and open lattice", studio_shade)
    add_track(mesh, "idle", {mesh: [
        (1, (0, 0, 0)), (18, (-1.8, 1.8, -3.2)), (34, (1.3, -.9, 1.0)), (53, (0, 0, 0)),
    ]})
    # Frame 4 is one third through the 1-10 swing, the shared 100 ms contact.
    add_track(mesh, "swing", {mesh: [
        (1, (0, 0, 0)), (2, (-21, -9, -22)), (4, (-59, 20, 62)),
        (8, (13, -15, 28)), (10, (0, 0, 0)),
    ]})
    set_view((.21, -.16, .46), (0, .118, .064), .48)
    return mesh


def export():
    export_asset("blender/weapons/flyswatter.blend", "public/assets/models/weapons/flyswatter.glb", animated=True)


if __name__ == "__main__":
    build()
    export()
