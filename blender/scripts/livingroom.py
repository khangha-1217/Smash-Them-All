"""Rebuild Living Room with Blender 5.3: blender -b --python blender/scripts/livingroom.py."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, export_asset, reset_scene
from room_details import baked_shade, ellipse, furnishings_window, lamp, markers, room_shell, rounded_box, set_room_view


SIZE = (6.6, 5.8, 2.85)
START = (.17, -2.38, 1.6)
SHADE = baked_shade([
    (-2.52, 2.15, 1.48, 2.0, .18), (2.20, 2.27, 1.46, 2.1, .15),
    (-.19, .90, 2.55, 5.0, .077),
], .90)


def sofa(g):
    rounded_box(g, (-.53, 1.98, .27), (2.77, 1.10, .38), .17, "964b48")
    rounded_box(g, (-.53, 2.35, .76), (2.71, .33, .91), .14, "ae5953")
    for x in (-1.18, .12):
        rounded_box(g, (x, 1.94, .48), (1.14, .78, .23), .135, "c17664")
        rounded_box(g, (x, 2.205, .84), (1.10, .28, .61), .13, "b66b60")
    for x in (-1.76, .70):
        rounded_box(g, (x, 1.94, .65), (.31, 1.03, .47), .145, "bb6f5d")
        for y in (1.58, 2.30):
            g.tube((x, y, .02), (x, y, .14), .057, "624040", 8, .072)
    for x, y, color in ((-1.35, 2.02, "d6aa68"), (.34, 2.00, "6e8c7d")):
        rounded_box(g, (x, y, .78), (.44, .21, .38), .097, color)
        g.box((x, y - .107, .79), (.21, .008, .025), "dfba94")
    # A soft throw drapes over the front lip of the left seat.
    for index, y in enumerate((1.53, 1.58, 1.63, 1.68)):
        g.box((-1.23, y, .598), (.41, .046, .013), "e4c697" if index % 2 else "ca9868")
    for index, z in enumerate((.46, .50, .54, .58)):
        g.box((-1.23, 1.527, z), (.41, .014, .037), "ca9868" if index % 2 else "e4c697")


def table_and_rug(g):
    # Layer the rug's border and central weave into its silhouette.
    for index, (rx, ry, color) in enumerate((
        (1.87, 1.26, "785650"), (1.84, 1.23, "d0ab86"), (1.72, 1.115, "9e655c"),
        (1.69, 1.087, "e4c4a0"), (1.63, 1.02, "b78070"),
    )):
        z = .003 + index * .002
        g.shape([ellipse(-.32, .04, z, rx, ry, 32),
                 ellipse(-.32, .04, z + .0015, rx, ry, 32)], color)
    for index in range(14):
        x = -.32 + (index - 6.5) * .229
        half = max(.10, (1.02 ** 2 * (1 - ((x + .32) / 1.62) ** 2)) ** .5)
        g.box((x, .04, .013), (.011, 1.75 * half, .003),
              "cb9982" if index % 2 else "ad7665")
    for x in (-1.02, .28):
        for y in (-.24, .34):
            g.tube((x * 1.04, y * 1.24, .015), (x, y, .475), .036, "775141", 8, .052)
    rounded_box(g, (-.37, .05, .496), (1.68, .94, .115), .29, "80543d")
    rounded_box(g, (-.37, .05, .561), (1.62, .90, .042), .28, "bd8b61")
    for y, width in ((-.21, 1.16), (.045, 1.47), (.30, 1.22)):
        g.box((-.37, y, .583), (width, .008, .002), "b17b54")
    g.box((-1.00, .10, .61), (.27, .32, .056), "5d7e70")
    g.box((-1.005, .098, .614), (.259, .30, .029), "e6c5a0")
    g.box((-.995, .092, .648), (.26, .30, .014), "6d9081")
    for z, width, color in ((.585, .108, "a86755"), (.607, .124, "c68865"), (.670, .163, "e0ad7d")):
        g.tube((-.32, .24, z), (-.32, .24, z + .021), width, color, 18)


def bookcase(g):
    g.box((2.30, 2.68, .99), (1.34, .083, 1.94), "714c45")
    for x in (1.65, 2.95):
        g.box((x, 2.48, 1.005), (.095, .51, 1.99), "906246")
    for z in (.10, .48, .94, 1.41, 1.98):
        g.box((2.30, 2.477, z), (1.37, .535, .10), "ac7a54")
        g.box((2.30, 2.199, z), (1.37, .036, .048), "c28e62")
    colors = ("b16a58", "e0b278", "729291", "b18a5f", "7d6a83")
    for row, z in enumerate((.53, .99, 1.46)):
        for i in range(5):
            size = .22 + .04 * ((row + i) % 4)
            x = (2.29 if row == 1 else 1.78) + i * .104
            g.box((x, 2.547, z + size / 2), (.094, .244, size), colors[(row + i) % len(colors)])
            g.box((x, 2.421, z + size * .81), (.080, .009, .017), "dfba8c")
    g.box((2.67, 2.49, .255), (.39, .36, .22), "9a7753")
    for i in range(5):
        g.box((2.67, 2.305, .16 + i * .039), (.39, .012, .010), "b29165")
    g.tube((1.89, 2.49, 1.001), (1.89, 2.49, 1.228), .105, "d39278", 14, .067)
    g.tube((1.89, 2.49, 1.228), (1.89, 2.49, 1.249), .073, "e7b384", 14)


def wall_and_lamps(g):
    furnishings_window(g, -.54, 2.858, 1.93, 2.01, 1.06, "c8946c", "4d5775", ("5a7280", "4b5d71"), "f4d99e")
    lamp(g, -2.54, 2.05, .0, 1.91, .32, "a88156", "d6a16a")
    rounded_box(g, (1.24, 2.09, .54), (.50, .53, .077), .085, "ba895d")
    for x in (1.07, 1.41):
        for y in (1.92, 2.26):
            g.tube((x, y, .02), (x, y, .52), .032, "8f624e", 8)
    lamp(g, 1.24, 2.10, .58, .62, .192, "ac7c57", "e6b881")
    # Layered oval motif on the left wall.
    for y, z, height, face in ((.97, 1.59, .65, "dca575"), (.16, 1.81, .47, "78a09a")):
        g.box((-3.27, y, z), (.075, .55, height), "ab7959")
        g.box((-3.224, y, z), (.02, .47, height - .08), "e9cba2")
        g.tube((-3.211, y, z), (-3.203, y, z), .16, face, 24)
        for index in range(3):
            g.box((-3.199, y, z - .10 + .033 * index), (.007, .34, .014), "f4d7aa")
    # Paneled side wall gives the room a lower rail and a clear route above it.
    g.box((3.284, .42, .45), (.025, 4.91, .80), "bd9073")
    g.box((3.259, .42, .858), (.065, 4.91, .065), "d4a586")
    for y in (-1.75, -.87, .01, .89, 1.77, 2.65):
        g.box((3.268, y, .44), (.028, .041, .76), "ab7e67")


def place_markers():
    up = (0, 0, 1)
    markers(SIZE, START, [
        ("floor", up, [(-2.46, -.84, 0), (1.21, -.86, 0), (1.45, .42, 0),
                       (2.39, -.03, 0), (2.46, 1.33, 0), (-2.43, .64, 0),
                       (-.34, -.84, .0145), (-1.55, .68, .0145)], (0, 1, 4, 6)),
        ("table", up, [(-.77, -.23, .585), (-.31, -.20, .585), (.20, .09, .583),
                       (-.56, .31, .584), (.13, .27, .583)], (0, 2, 3)),
        ("shelf", up, [(2.42, 2.28, .53), (2.03, 2.29, .99),
                       (2.50, 2.31, 1.46), (1.85, 2.46, 2.03)], (0, 2)),
        ("wall", (1, 0, 0), [(-3.3, -.83, .42), (-3.3, -.79, .97), (-3.3, -.24, 1.43)], (0, 1)),
        ("wall", (-1, 0, 0), [(3.3, 1.62, 1.07), (3.3, 1.05, 1.33), (3.3, .39, 1.16)], (0,)),
    ], [
        ("sofa", (-.53, 1.98, .598), (2.77, 1.10, 1.196)),
        ("coffee_table", (-.37, .05, .291), (1.68, .94, .582)),
        ("bookshelf", (2.30, 2.465, 1.015), (1.40, .60, 2.03)),
        ("floor_lamp", (-2.54, 2.05, .96), (.64, .64, 1.92)),
        ("side_table", (1.24, 2.09, .29), (.50, .53, .58)),
    ])


def build():
    scene = reset_scene()
    scene.world.color = (.08, .065, .062)
    room_shell(*SIZE, ("dbad9c", "d2a28f", "d9ae99", "cc9d87", "e4bea8"), "a17361",
               ("9e7159", "a77a61", "b28364", "ac7c5e", "bc8c6b"), 415).build(
                   "Living Room plaster and walnut floor", SHADE)
    decor = Geometry()
    sofa(decor)
    table_and_rug(decor)
    bookcase(decor)
    wall_and_lamps(decor)
    decor.build("Living Room sofa, coffee table, shelf, rug and lamps", SHADE)
    place_markers()
    set_room_view(START, (.14, 1.23, 1.30), 3.62)


def export():
    export_asset("blender/livingroom.blend", "public/assets/models/maps/livingroom.glb")


if __name__ == "__main__":
    build()
    export()
