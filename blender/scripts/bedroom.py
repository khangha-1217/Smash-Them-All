"""Rebuild Bedroom with Blender 5.3: blender -b --python blender/scripts/bedroom.py."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from asset_tools import Geometry, export_asset, reset_scene
from room_details import baked_shade, furnishings_window, lamp, markers, room_shell, rounded_box, set_room_view


SIZE = (6.36, 5.7, 2.76)
START = (.15, -2.34, 1.60)
SHADE = baked_shade([
    (-.25, 2.30, .98, 1.25, .22), (2.27, 2.46, 1.22, 1.6, .22),
    (-1.70, 1.15, 2.3, 4.2, .075),
], .895)


def bed(g):
    rounded_box(g, (-1.61, 1.43, .281), (1.80, 2.39, .40), .22, "695253")
    for x in (-2.35, -.87):
        for y in (.45, 2.40):
            g.tube((x, y, 0), (x, y, .14), .064, "684c47", 8, .082)
    rounded_box(g, (-1.61, 2.61, .82), (1.83, .30, 1.31), .14, "956858")
    rounded_box(g, (-1.61, 2.465, 1.04), (1.55, .18, .74), .085, "be9a86")
    for x in (-2.14, -1.88, -1.62, -1.36, -1.10):
        g.box((x, 2.364, 1.14), (.015, .019, .40), "ad8475")
    rounded_box(g, (-1.61, 1.36, .522), (1.73, 2.23, .27), .19, "e3c9b1")
    rounded_box(g, (-1.61, 1.03, .667), (1.80, 1.62, .22), .21, "8f7790")
    rounded_box(g, (-1.61, .25, .555), (1.73, .23, .36), .109, "8b7189")
    for x in (-2.43, -.79):
        rounded_box(g, (x, 1.03, .552), (.16, 1.47, .34), .076, "a0849b")
    # Narrow stitched bands on the quilt and a folded linen strip across its width.
    for y in (.54, .77, 1.0, 1.23, 1.46):
        g.box((-1.61, y, .778), (1.56, .013, .006), "ad93ad")
    for x in (-2.14, -1.88, -1.61, -1.34, -1.08):
        g.box((x, .99, .778), (.013, 1.19, .006), "9e879c")
    rounded_box(g, (-1.61, 1.73, .765), (1.69, .23, .076), .080, "d7b5ad")
    for x, color in ((-2.00, "eed2b4"), (-1.22, "e6c5aa")):
        rounded_box(g, (x, 2.13, .761), (.68, .44, .21), .16, color)
        rounded_box(g, (x, 2.12, .817), (.57, .36, .113), .14, "eacdad")
    rounded_box(g, (-2.13, 1.94, .83), (.32, .24, .13), .105, "9b6d7a")


def nightstand(g):
    g.box((-.19, 2.27, .337), (.55, .52, .60), "996e59")
    rounded_box(g, (-.19, 2.27, .662), (.62, .595, .079), .079, "c19874")
    for z in (.254, .479):
        rounded_box(g, (-.19, 1.984, z), (.483, .056, .198), .026, "bf9470")
        g.tube((-.19, 1.950, z), (-.19, 1.907, z), .023, "e0b47a", 10)
    for x in (-.38, 0):
        for y in (2.08, 2.47):
            g.box((x, y, .043), (.10, .085, .086), "785950")
    lamp(g, -.24, 2.34, .70, .58, .198, "b48162", "dca580")


def writing_desk(g):
    rounded_box(g, (1.88, 2.408, .789), (1.88, .737, .081), .10, "b88f6d")
    g.box((2.44, 2.49, .393), (.61, .52, .72), "9c755f")
    for z in (.15, .362, .58):
        rounded_box(g, (2.44, 2.20, z), (.578, .078, .195), .039, "be9878")
        g.box((2.44, 2.147, z + .04), (.125, .051, .032), "e3b88b")
    for y in (2.13, 2.68):
        g.tube((1.06, y, .005), (1.10, y, .754), .046, "806453", 8)
    g.box((1.41, 2.48, .852), (.43, .275, .044), "8b748c")
    g.box((1.41, 2.48, .875), (.413, .254, .031), "e1c7b5")
    for y in (2.415, 2.465, 2.515, 2.565):
        g.box((1.42, y, .893), (.29, .007, .005), "bda695")
    lamp(g, 2.46, 2.56, .831, .57, .188, "aa7c60", "d7a47c")
    # Tucked-in seat with a low curved back preserves access to the desktop.
    rounded_box(g, (1.55, 1.67, .436), (.54, .47, .124), .105, "857087")
    for x in (1.36, 1.74):
        for y in (1.50, 1.83):
            g.tube((x, y, .01), (x, y, .43), .032, "826555", 8, .037)
    for x in (1.35, 1.75):
        g.tube((x, 1.51, .46), (x, 1.54, .91), .031, "886b57", 8, .036)
    rounded_box(g, (1.55, 1.51, .875), (.54, .154, .234), .072, "9f8498")


def wardrobe(g):
    g.box((2.78, .55, 1.064), (.71, 1.53, 2.04), "98745e")
    g.box((2.80, .55, 2.115), (.74, 1.63, .10), "c6a080")
    g.box((2.78, .55, .09), (.77, 1.59, .18), "987760")
    for y in (.17, .93):
        g.box((2.397, y, 1.12), (.078, .73, 1.84), "bc977e")
        for z, height in ((.54, .43), (1.38, 1.04)):
            g.box((2.347, y, z), (.034, .555, height), "ab866f")
            g.box((2.324, y, z), (.021, .455, height - .11), "b68e76")
        inward = y + (.229 if y < .55 else -.229)
        g.tube((2.314, inward, .93), (2.314, inward, 1.11), .024, "c5a176", 10)


def rug_and_walls(g):
    for width, depth, z, color in ((2.75, 1.32, .009, "a08087"), (2.64, 1.20, .016, "dbc1a6"),
                                   (2.53, 1.08, .023, "b097a6")):
        rounded_box(g, (-.80, -.72, z), (width, depth, .012), .16, color)
    for i in range(17):
        x = -2.02 + i * .153
        g.box((x, -.72, .030), (.012, .82, .005), "c3abb3" if i % 2 else "a78e9d")
        for sign in (-1, 1):
            g.box((x, -.72 + .68 * sign, .007), (.025, .096, .011), "ddc1a9")
    furnishings_window(g, 1.68, 2.806, 1.91, 1.66, 1.01, "ab8975", "545a78",
                       ("706f89", "62677f"), "ecd2aa")
    for x in (.77, 2.59):
        for index in range(5):
            g.tube((x + index * .037 - .074, 2.665, 1.34),
                   (x + index * .028 - .056, 2.72, 2.49), .046,
                   "ad8ca0" if index % 2 else "bc9aad", 8, .031)
    g.tube((.62, 2.719, 2.49), (2.73, 2.719, 2.49), .023, "936e60", 10)
    # Framed moon print and a low painted dado.
    g.box((-1.63, 2.806, 2.06), (.83, .072, .69), "aa826f")
    g.box((-1.63, 2.762, 2.06), (.74, .029, .60), "e6c8b1")
    g.box((-1.63, 2.742, 2.06), (.61, .014, .46), "8f7f9c")
    g.tube((-1.61, 2.733, 2.108), (-1.61, 2.724, 2.108), .147, "efccaa", 24)
    for x, z in ((-1.85, 2.13), (-1.76, 2.25), (-1.44, 1.94), (-1.43, 2.19)):
        g.box((x, 2.721, z), (.016, .006, .017), "e7c7b5")
    g.box((-3.157, -.15, .38), (.037, 5.32, .65), "b1969d")
    g.box((-3.137, -.15, .72), (.067, 5.32, .055), "c8a9a9")
    g.box((3.152, -1.71, 1.08), (.062, 1.02, 2.16), "a58072")
    g.box((3.105, -1.71, 1.05), (.045, .88, 2.10), "bd9c89")
    for z in (.62, 1.49):
        g.box((3.073, -1.71, z), (.03, .66, .68), "ae8f80")
    g.tube((3.047, -1.40, 1.02), (2.967, -1.40, 1.02), .035, "b68768", 12)


def place_markers():
    up = (0, 0, 1)
    markers(SIZE, START, [
        ("floor", up, [(-2.57, -.37, 0), (-1.42, -.68, .033), (1.25, -.94, 0),
                       (1.31, .15, 0), (.27, .75, 0), (.22, 1.52, 0),
                       (2.49, -.78, 0), (-2.73, 1.32, 0)], (0, 1, 2, 4)),
        ("bed", up, [(-2.10, .56, .783), (-1.45, .77, .783), (-.99, .99, .783),
                     (-1.77, 1.30, .778), (-1.37, 1.51, .778)], (0, 2, 4)),
        ("desk", up, [(1.25, 2.17, .830), (1.84, 2.25, .830), (2.14, 2.46, .830),
                      (2.58, 2.14, .830)], (0, 2, 3)),
        ("wall", (1, 0, 0), [(-3.18, -1.25, .86), (-3.18, -.85, 1.37), (-3.18, -.35, 1.55)], (0, 2)),
        ("wall", (-1, 0, 0), [(3.18, -.46, 1.12), (3.18, -.34, .41), (3.18, 1.53, 1.14)], (0,)),
    ], [
        ("bed", (-1.61, 1.43, .388), (1.80, 2.40, .776)),
        ("bed_headboard", (-1.61, 2.615, .82), (1.84, .33, 1.32)),
        ("nightstand", (-.19, 2.27, .35), (.62, .595, .70)),
        ("desk", (1.88, 2.408, .415), (1.88, .737, .830)),
        ("desk_chair", (1.55, 1.665, .494), (.55, .48, .988)),
        ("wardrobe", (2.75, .55, 1.082), (.85, 1.63, 2.164)),
    ])


def build():
    scene = reset_scene()
    scene.world.color = (.075, .063, .080)
    room_shell(*SIZE, ("d6b5b4", "d3b0ac", "ccb0b5", "d5b2ab", "e4c6bb"), "9b7883",
               ("ad826c", "b38c75", "bc927a", "bd947e", "a87d6b"), 292).build(
                   "Bedroom plaster and oak floor", SHADE)
    decor = Geometry()
    bed(decor)
    nightstand(decor)
    writing_desk(decor)
    wardrobe(decor)
    rug_and_walls(decor)
    decor.build("Bedroom bed, nightstand, writing desk and wardrobe", SHADE)
    place_markers()
    set_room_view(START, (.10, 1.10, 1.33), 3.48)


def export():
    export_asset("blender/bedroom.blend", "public/assets/models/maps/bedroom.glb")


if __name__ == "__main__":
    build()
    export()
