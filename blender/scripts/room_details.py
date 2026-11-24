"""Shared room shell, furnishing profiles, and navigation markers."""

import math
import random

from asset_tools import Geometry, box_marker, empty, set_view


def ellipse(x, y, z, rx, ry, segments=24):
    return [(x + rx * math.cos(math.tau * i / segments),
             y + ry * math.sin(math.tau * i / segments), z) for i in range(segments)]


def rounded_box(g, center, size, corner, color):
    """An upholstered or wooden profile with soft corners and a bevel at its edges."""
    x, y, z = center
    a, b, c = (axis / 2 for axis in size)
    bevel = min(c * .38, corner * .44)
    outlines = []
    for height, inset in ((-c, bevel), (-c + bevel, 0), (c - bevel, 0), (c, bevel)):
        row = []
        for dx, dy, angle in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
            for step in range(4):
                t = math.radians(angle + 30 * step)
                row.append((x + dx * (a - corner) + (corner - inset) * math.cos(t),
                            y + dy * (b - corner) + (corner - inset) * math.sin(t), z + height))
        outlines.append(row)
    g.shape(outlines, color)


def room_shell(width, depth, height, colors, trim, boards, seed):
    g = Geometry()
    for side, color in zip((-1, 1), colors[:2]):
        g.box((0, side * (depth / 2 + .06), height / 2), (width + .24, .12, height), color)
        g.box((0, side * (depth / 2 - .018), .064), (width, .038, .128), trim)
    for side, color in zip((-1, 1), colors[2:4]):
        g.box((side * (width / 2 + .06), 0, height / 2), (.12, depth, height), color)
        g.box((side * (width / 2 - .018), 0, .064), (.038, depth, .128), trim)
    g.box((0, 0, height + .055), (width + .24, depth + .24, .11), colors[4])
    g.box((0, 0, -.061), (width + .20, depth + .20, .113), boards[0])

    rng = random.Random(seed)
    count = round(depth / .24)
    row_depth = depth / count
    for row in range(count):
        y = -depth / 2 + (row + .5) * row_depth
        seams = [-width / 2, *(-width / 2 + .55 + (row % 3) * .39 + i * 1.83 for i in range(3)), width / 2]
        for left, right in zip(seams, seams[1:]):
            g.box(((left + right) / 2, y, -.012), (right - left - .009, row_depth - .007, .024), rng.choice(boards))
            g.box(((left + right) / 2, y - row_depth * .30, .0003),
                  ((right - left) * .51, .004, .0006), rng.choice(boards))
    return g


def baked_shade(lamps, gains):
    def shade(rgb, normal, position):
        x, y, z = position
        warmth = sum(weight * math.exp(-((x - lx) ** 2 + (y - ly) ** 2 + .62 * (z - lz) ** 2) / radius)
                     for lx, ly, lz, radius, weight in lamps)
        gain = gains + .055 * max(0, normal.z) - .03 * normal.x - .024 * normal.y
        low_shadow = .037 * math.exp(-z * 9) * (abs(x) / 3.2 + abs(y) / 3)
        return tuple(min(1, value * (gain - low_shadow) + warmth * channel)
                     for value, channel in zip(rgb, (1, .53, .12)))
    return shade


def lamp(g, x, y, base, height, width, body, shade):
    g.tube((x, y, base), (x, y, base + .036), width * .49, body, 18)
    g.tube((x, y, base + .036), (x, y, base + height), width * .075, body, 10)
    bottom, top = base + height * .82, base + height
    g.tube((x, y, bottom), (x, y, top), width, shade, 20, width * .57, False)
    g.tube((x, y, bottom - .012), (x, y, bottom + .012), width * 1.013, "efc68f", 20, caps=False)
    g.tube((x, y, bottom - .009), (x, y, bottom - .005), width * .87, "ffe7ae", 20)
    g.tube((x, y, top - .008), (x, y, top + .009), width * .58, "e3bc91", 20)


def furnishings_window(g, x, y, z, width, height, frame, sky, hill, moon):
    """Back-wall window, facing the negative Blender Y direction."""
    g.box((x, y, z), (width + .16, .071, height + .16), frame)
    g.box((x, y - .041, z), (width, .015, height), sky)
    g.tube((x + width * .20, y - .051, z + height * .21),
           (x + width * .20, y - .057, z + height * .21), height * .105, moon, 20)
    for fraction, level in ((-.40, .24), (-.24, .33), (-.21, .13), (.40, .31)):
        g.box((x + width * fraction, y - .054, z + height * level), (.019, .006, .018), moon)
    for i, points in enumerate((
        [(-.5, -.5), (.5, -.5), (.5, -.21), (.14, -.13), (-.08, -.28), (-.36, -.17), (-.5, -.25)],
        [(-.5, -.5), (.5, -.5), (.5, -.36), (.21, -.34), (.02, -.43), (-.19, -.29), (-.5, -.36)],
    )):
        vertices = [(x + width * a, y - .057 - i * .002, z + height * b) for a, b in points]
        g.add(vertices, [tuple(range(len(vertices)))], hill[i])
    g.box((x, y - .076, z), (.041, .070, height), frame)
    g.box((x, y - .076, z), (width, .070, .042), frame)
    g.box((x, y - .084, z - height / 2 - .078), (width + .23, .233, .056), frame)


def markers(dimensions, start, surfaces, colliders):
    width, depth, height = dimensions
    empty("player_start", start)
    box_marker("room_bounds", (0, 0, height / 2), (width, depth, height))
    existing_markers = []
    for tag, normal, points, spawn_indices in surfaces:
        existing = sum(obj.name.startswith(f"waypoint_{tag}_") for obj in existing_markers)
        spawned = sum(obj.name.startswith(f"spawn_{tag}_") for obj in existing_markers)
        for index, point in enumerate(points, start=existing + 1):
            marker = empty(f"waypoint_{tag}_{index:02d}", point, normal)
            marker.empty_display_size = .19
            existing_markers.append(marker)
        for index, point_index in enumerate(spawn_indices, start=spawned + 1):
            marker = empty(f"spawn_{tag}_{index:02d}", points[point_index], normal)
            marker.empty_display_size = .24
            existing_markers.append(marker)
    for name, center, size in colliders:
        box_marker(f"collider_{name}", center, size)


def set_room_view(eye, focus, distance, markers=False):
    set_view(eye, focus, distance, markers, clip_start=.06)
