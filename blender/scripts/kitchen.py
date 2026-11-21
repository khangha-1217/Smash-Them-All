"""Rebuild Kitchen with Blender 5.3: blender -b --python blender/scripts/kitchen.py."""

import math
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, box_marker, empty, export_asset, reset_scene, set_view


def ellipse(cx, cy, z, rx, ry, segments=20):
    return [
        (cx + rx * math.cos(2 * math.pi * i / segments),
         cy + ry * math.sin(2 * math.pi * i / segments), z)
        for i in range(segments)
    ]


def room_shade(rgb, normal, position):
    x, y, z = position
    warmth = max(
        math.exp(-((x - lamp_x) ** 2 + (y + .30) ** 2) / 4.8) * (0.080 + z * .012)
        for lamp_x in (-1.55, .08)
    )
    direction = 0.93 + .06 * normal.z - .025 * normal.x - .025 * normal.y
    shadow = 0.035 * math.exp(-z * 8) * (abs(x) / 3.2 + max(y, 0) / 2.8)
    return tuple(min(1, component * (direction - shadow) + warmth * heat)
                 for component, heat in zip(rgb, (.95, .54, .14)))


def build_shell():
    shell = Geometry()
    box = shell.box
    box((0, 0, -.068), (6.46, 5.66, .13), "636b70")
    box((0, 2.86, 1.375), (6.56, .12, 2.75), "ecc99e")
    box((0, -2.86, 1.375), (6.56, .12, 2.75), "eac79e")
    box((-3.26, 0, 1.375), (.12, 5.6, 2.75), "e2bb91")
    box((3.26, 0, 1.375), (.12, 5.6, 2.75), "ebcda6")
    box((0, 0, 2.805), (6.56, 5.84, .11), "e4c7a8")

    rng = random.Random(728)
    creams = ["f2e6ca", "eee3c8", "f6e9cb", "ede0c3"]
    blues = ["64818a", "6c8890", "617c86", "6f8d95"]
    width, depth = 6.4 / 16, 5.6 / 14
    for column in range(16):
        for row in range(14):
            center = (-3.2 + (column + .5) * width, -2.8 + (row + .5) * depth, -.011)
            box(center, (width - .007, depth - .007, .022),
                rng.choice(creams if (column + row) % 2 == 0 else blues))

    for side in (-1, 1):
        for y, z, height in ((2.79 * side, .066, .132), (2.78 * side, 2.68, .11)):
            box((0, y, z), (6.4, .04, height), "b68b67" if z < 1 else "d5a78a")
        for x, z, height in ((3.19 * side, .066, .132), (3.18 * side, 2.68, .11)):
            box((x, 0, z), (.04, 5.6, height), "b68b67" if z < 1 else "d5a78a")
    return shell


def back_counter(g):
    box = g.box
    sage, trim, panel = "839b80", "617a68", "a7b29a"
    box((.41, 2.45, .46), (3.89, .64, .89), trim)
    box((.41, 2.47, .073), (3.87, .57, .14), "535a4e")
    for index in range(7):
        x = -1.256 + .555 * index
        box((x, 2.104, .446), (.526, .067, .68), sage)
        box((x, 2.063, .408), (.42, .02, .43), panel)
        box((x, 2.026, .67), (.192, .068, .033), "a87249")
        box((x, 2.098, .82), (.526, .072, .133), panel)
        box((x, 2.038, .82), (.103, .046, .025), "b88758")

    # Four limestone pieces leave a real opening above the sink basin.
    for center, size in (
        ((-.176, 2.42, .925), (2.767, .76, .078)),
        ((2.241, 2.42, .925), (.292, .76, .078)),
        ((1.665, 2.10, .925), (.914, .118, .078)),
        ((1.665, 2.704, .925), (.914, .179, .078)),
    ):
        box(center, size, "f0dcc0")
    # Tile backsplash with a two-tone accent band.
    box((.4, 2.782, 1.233), (3.95, .027, .52), "c89f7f")
    for column in range(20):
        for row in range(4):
            tile = "f1dcc0" if row != 2 else ("6f9390" if column % 2 else "80a39a")
            box((-1.478 + .198 * column, 2.760, 1.006 + .129 * row), (.191, .026, .122), tile)

    # Basin floor sits just below countertop height while the rim reads from the player aisle.
    box((1.665, 2.40, .915), (.93, .472, .021), "5f777e")
    for x in (1.203, 2.124):
        box((x, 2.40, .961), (.048, .495, .015), "d4ddcf")
    for y in (2.159, 2.638):
        box((1.665, y, .961), (.963, .036, .015), "d4ddcf")
    g.tube((1.665, 2.40, .927), (1.665, 2.40, .932), .064, "364d56", 12)
    for x in (1.49, 1.84):
        g.tube((x, 2.703, .962), (x, 2.703, 1.003), .062, "a0a89d", 10)
        box((x, 2.703, 1.011), (.15, .035, .025), "e1dfce")
    arc = [(1.665, 2.705, .97), (1.665, 2.705, 1.19)]
    arc.extend((1.665, 2.604 + .101 * math.cos(math.pi * step / 8),
                1.19 + .115 * math.sin(math.pi * step / 8)) for step in range(1, 9))
    arc.append((1.665, 2.503, 1.155))
    for start, end in zip(arc, arc[1:]):
        g.tube(start, end, .020, "c2d2ca", 8)
    box((2.23, 2.5, .979), (.15, .087, .026), "e3ae63")


def wall_details(g):
    box = g.box
    for x in (-1.05, -.19):
        box((x, 2.584, 2.094), (.812, .385, .86), "839881")
        box((x, 2.37, 2.095), (.766, .062, .771), "a7b49b")
        box((x, 2.333, 2.095), (.62, .027, .62), "919f83")
        box((x + .22, 2.298, 1.833), (.137, .046, .027), "b28254")
    # Layered midnight panes and shutters establish a warm interior against the cool window.
    box((1.557, 2.762, 2.035), (1.61, .09, 1.10), "aa7658")
    box((1.557, 2.699, 2.035), (1.47, .047, .931), "354b68")
    box((1.557, 2.672, 1.83), (1.43, .004, .48), "415f79")
    for x, z, width, height in ((1.04, 1.70, .25, .23), (1.28, 1.69, .26, .18),
                                (1.75, 1.77, .25, .35), (2.05, 1.72, .37, .28)):
        box((x, 2.665, z), (width, .006, height), "354a62")
    g.tube((1.866, 2.664, 2.285), (1.866, 2.659, 2.285), .105, "f1dca6", 20)
    for x, z in ((1.08, 2.313), (1.34, 2.221), (1.14, 2.11), (2.13, 2.22)):
        box((x, 2.66, z), (.019, .005, .019), "c9d2ce")
    box((1.557, 2.635, 2.035), (.052, .095, 1.01), "dbb190")
    box((1.557, 2.635, 2.035), (1.49, .095, .047), "dbb190")
    box((1.557, 2.618, 1.512), (1.71, .30, .071), "e7c3a0")
    for x in (.783, 2.33):
        box((x, 2.661, 2.035), (.076, .114, 1.05), "d6b092")

    # Simple side-wall door, wall clock and matching ceramic print.
    box((3.177, -.74, 1.083), (.051, .99, 2.16), "bd8b68")
    box((3.142, -.74, 1.05), (.04, .86, 2.08), "d4a481")
    for z, height in ((.52, .71), (1.48, .89)):
        box((3.117, -.74, z), (.019, .66, height), "c39470")
    g.tube((3.132, -1.035, 1.024), (3.061, -1.035, 1.024), .038, "8b684d", 12)
    g.tube((-3.185, .285, 1.977), (-3.115, .285, 1.977), .226, "ad6b57", 28)
    g.tube((-3.115, .285, 1.977), (-3.109, .285, 1.977), .196, "f6dfb9", 28)
    for step in range(12):
        angle = step * math.tau / 12
        box((-3.103, .285 + math.cos(angle) * .159, 1.977 + math.sin(angle) * .159),
            (.012, .015, .015), "715b58")
    g.tube((-3.096, .285, 1.977), (-3.096, .192, 2.064), .011, "705654", 6)
    g.tube((-3.093, .285, 1.977), (-3.093, .342, 2.102), .008, "a46858", 6)
    box((-3.163, 1.25, 1.672), (.09, .49, .60), "876451")
    box((-3.114, 1.25, 1.672), (.017, .405, .504), "eddab5")
    g.tube((-3.103, 1.25, 1.667), (-3.098, 1.25, 1.667), .125, "bc7260", 14)
    for i in range(4):
        box((-3.096, 1.25, 1.61 + i * .04), (.013, .28, .01), "f1ddb5")


def appliances(g):
    box = g.box
    # Tall corner refrigerator with rubber seams, enamel doors and chrome pulls.
    box((-2.36, 2.34, 1.025), (1.08, .86, 2.04), "a87264")
    box((-2.36, 1.872, .763), (1.037, .104, 1.432), "cc947e")
    box((-2.36, 1.872, 1.763), (1.037, .104, .523), "d6a18a")
    box((-2.36, 1.82, 1.495), (.997, .027, .029), "804c4c")
    for z, height in ((1.214, .329), (1.709, .17)):
        g.tube((-1.996, 1.765, z - height / 2), (-1.996, 1.765, z + height / 2),
               .028, "dcd8c0", 10)
        for end in (-1, 1):
            g.tube((-1.996, 1.774, z + end * height / 2),
                   (-1.996, 1.82, z + end * height / 2), .031, "b5a998", 10)
    box((-2.54, 1.811, 1.164), (.179, .024, .192), "f2ddac")
    box((-2.54, 1.793, 1.26), (.060, .019, .040), "7c9a86")
    for x in (-2.65, -2.075):
        box((x, 2.08, .031), (.22, .43, .062), "534f4c")

    # A two-slot toaster, one cup, and cutting board sit on the clear counter.
    box((-1.15, 2.47, 1.064), (.47, .235, .206), "c2876b")
    box((-1.15, 2.47, 1.174), (.437, .215, .041), "e5af8d")
    for x in (-1.238, -1.064):
        box((x, 2.48, 1.197), (.064, .155, .011), "685458")
    g.tube((-1.03, 2.344, 1.055), (-1.03, 2.319, 1.055), .035, "e9d2b1", 10)
    g.tube((.312, 2.493, .965), (.312, 2.493, 1.112), .076, "b36d5f", 12)
    g.tube((.312, 2.493, 1.112), (.312, 2.493, 1.115), .064, "6a4c49", 12)
    for z in (1.02, 1.083):
        g.tube((.368, 2.493, z), (.431, 2.493, z), .016, "b36d5f", 6)
    g.tube((.431, 2.493, 1.02), (.431, 2.493, 1.083), .016, "b36d5f", 6)
    box((-.40, 2.43, .976), (.41, .30, .033), "c59362")


def island(g):
    box = g.box
    box((-.73, -.30, .429), (2.39, 1.12, .858), "75554a")
    box((-.73, -.30, .069), (2.28, 1.062, .14), "5e4943")
    box((-.73, -.30, .877), (2.59, 1.30, .077), "e3c4a0")
    box((-.73, -.30, .92), (2.54, 1.25, .034), "f2dfbf")
    for x in (-1.53, -.73, .07):
        box((x, -.861, .451), (.769, .038, .682), "9c6c56")
        box((x, -.888, .427), (.625, .020, .498), "8e6250")
        box((x, -.916, .690), (.154, .045, .027), "dab88a")
    for y in (-.686, -.298, .089):
        box((.474, y, .445), (.029, .35, .68), "976b56")

    # Glazed terracotta fruit bowl has a real inner wall and a raised ring foot.
    bowl_x, bowl_y = -.87, -.16
    outlines = [ellipse(bowl_x, bowl_y, z, width, width * .9, 24)
                for z, width in ((.936, .126), (.971, .139), (1.031, .236),
                                 (1.076, .255), (1.076, .229), (1.040, .213), (.985, .106))]
    g.shape(outlines, "b97760", caps=False)
    g.tube((bowl_x, bowl_y, .977), (bowl_x, bowl_y, .987), .108, "a45d50", 24)
    for x, y, z, width, color in (
        (-.955, -.195, 1.055, .080, "e6ad53"), (-.817, -.23, 1.06, .077, "d18057"),
        (-.787, -.083, 1.069, .075, "e8b650"), (-.92, -.082, 1.113, .082, "b77d59"),
    ):
        g.shape([ellipse(x, y, z + height * width, scale * width, scale * width, 10)
                 for height, scale in ((-.72, .55), (-.2, .99), (.55, .90), (.83, .52))], color)
        g.tube((x, y, z + width * .77), (x + .011, y, z + width), .007, "6d6042", 6)
    box((.14, -.36, .948), (.43, .32, .023), "be986f")
    for row in range(4):
        box((.14, -.47 + row * .07, .962), (.37, .009, .004), "d7b089")

    for x in (-1.55, .08):
        g.tube((x, -.30, 2.35), (x, -.30, 2.75), .018, "7a6657", 10)
        g.tube((x, -.30, 2.715), (x, -.30, 2.748), .104, "a48a69", 16)
        g.tube((x, -.30, 2.115), (x, -.30, 2.362), .265, "bd8062", 24, .085, False)
        g.tube((x, -.30, 2.111), (x, -.30, 2.133), .268, "d69f70", 24, caps=False)
        g.tube((x, -.30, 2.116), (x, -.30, 2.121), .230, "ffe3a1", 24)


def place_markers():
    # Coordinates here are Blender XYZ. Local Blender -Y becomes the glTF +Z normal.
    floor = [(1.18, -1.72, 0), (2.36, -.40, 0), (1.38, 1.16, 0),
             (-.43, 1.26, 0), (-2.62, -.75, 0), (-1.88, -1.77, 0)]
    counter = [(-1.41, -.34, .937), (-.42, -.53, .937), (.25, -.63, .937),
               (-.74, .19, .937), (-.63, 2.22, .964), (.72, 2.23, .964)]
    sink = [(1.38, 2.32, .926), (1.91, 2.47, .926), (1.69, 2.26, .926)]
    west_wall = [(-3.2, -.76, .35), (-3.2, -.51, .92), (-3.2, -.04, 1.28)]
    east_wall = [(3.2, 1.43, .28), (3.2, 1.66, .71), (3.2, 1.19, 1.24)]
    for tag, points, normals, spawn_indices in (
        ("floor", floor, [(0, 0, 1)] * len(floor), (0, 2, 4)),
        ("counter", counter, [(0, 0, 1)] * len(counter), (1, 2, 5)),
        ("sink", sink, [(0, 0, 1)] * len(sink), (0, 1)),
        ("wall", west_wall + east_wall, [(1, 0, 0)] * len(west_wall) + [(-1, 0, 0)] * len(east_wall), (0, 2, 3)),
    ):
        for index, (point, normal) in enumerate(zip(points, normals), start=1):
            empty(f"waypoint_{tag}_{index:02d}", point, normal)
        for index, point_index in enumerate(spawn_indices, start=1):
            empty(f"spawn_{tag}_{index:02d}", points[point_index], normals[point_index])

    empty("player_start", (0, -2.30, 1.60))
    box_marker("room_bounds", (0, 0, 1.375), (6.4, 5.6, 2.75))
    box_marker("collider_island", (-.73, -.30, .4685), (2.59, 1.30, .937))
    box_marker("collider_back_counter", (.411, 2.42, .482), (3.94, .76, .964))
    box_marker("collider_fridge", (-2.36, 2.292, 1.025), (1.08, 1.064, 2.05))


def build():
    scene = reset_scene()
    scene.world.color = (.08, .08, .08)
    build_shell().build("Kitchen shell and checkerboard", room_shade)
    furnishings = Geometry()
    back_counter(furnishings)
    wall_details(furnishings)
    appliances(furnishings)
    island(furnishings)
    furnishings.build("Kitchen cabinetry, island and fixtures", room_shade)
    place_markers()
    set_view((0, -2.30, 1.60), (0, 1.28, 1.43), 3.58)


def export():
    export_asset("blender/kitchen.blend", "public/assets/models/maps/kitchen.glb")


if __name__ == "__main__":
    build()
    export()
