# Asset Contract: Smash 'Em All

**Purpose**: Defines the exact requirements for all GLB assets. Automated tests in `tests/assets/asset-contract.test.ts` validate every file against this contract.

> This contract is derived from Constitution §3. See `.specify/memory/constitution.md` for the authoritative source.

## General Standards

| Property | Value |
|----------|-------|
| Coordinate system | Y-up (glTF 2.0 standard) |
| Scale | 1 unit = 1 meter |
| Export format | GLB (binary glTF 2.0) |
| Compression | Meshopt |
| Texture max resolution | 1024 × 1024 |
| Texture format | PNG or embedded JPEG |
| Material style | Stylized flat/hand-painted (NOT PBR) |

## Asset Inventory

### Maps

| Asset | File Path | Max Triangles | Max Size | Required Empties | Required Animations |
|-------|-----------|---------------|----------|------------------|---------------------|
| Kitchen | `public/assets/models/maps/kitchen.glb` | 30,000 | 2 MB | spawn_*, waypoint_*, player_start | None |
| Living Room | `public/assets/models/maps/livingroom.glb` | 30,000 | 2 MB | spawn_*, waypoint_*, player_start | None |
| Bedroom | `public/assets/models/maps/bedroom.glb` | 30,000 | 2 MB | spawn_*, waypoint_*, player_start | None |

**Empty naming patterns:**
- `spawn_<surface>_<nn>` — cockroach spawn point (e.g., `spawn_floor_01`, `spawn_counter_03`)
- `waypoint_<surface>_<nn>` — navigation waypoint (e.g., `waypoint_wall_02`)
- `player_start` — initial camera position and orientation

**Surface tags:** `floor`, `counter`, `table`, `wall`, `ceiling`, `shelf`, `bed`, `desk`, `sink`, `chair`

**Empty orientation:** Local Z-axis (forward) = surface normal at that point.

**Minimum empties per map:** ≥ 8 spawn points, ≥ 15 waypoints, exactly 1 player_start.

### Cockroach

| Property | Value |
|----------|-------|
| File path | `public/assets/models/cockroach.glb` |
| Max triangles | 1,500 |
| Max size | 100 KB |
| Origin | Center of body |
| Required animations | `idle`, `crawl`, `fly` |
| Body length | ~0.04m (4cm) |

### Weapons

| Asset | File Path | Max Triangles | Max Size | Required Animations |
|-------|-----------|---------------|----------|---------------------|
| Slipper | `public/assets/models/weapons/slipper.glb` | 800 | 50 KB | `idle`, `swing` |
| Flyswatter | `public/assets/models/weapons/flyswatter.glb` | 800 | 50 KB | `idle`, `swing` |
| Cardboard | `public/assets/models/weapons/cardboard.glb` | 800 | 50 KB | `idle`, `swing` |

**Origin:** Grip point (where the hand holds it).

### Audio

| Category | Format | Channels | Sample Rate | Max Size |
|----------|--------|----------|-------------|----------|
| SFX | MP3 or OGG | Mono | 44.1 kHz | 50 KB each |
| Music | MP3 or OGG | Stereo | 44.1 kHz | 500 KB each |

**Required SFX files:**
- `public/assets/audio/sfx/hit.mp3` — weapon hits cockroach
- `public/assets/audio/sfx/miss.mp3` — weapon swings, misses
- `public/assets/audio/sfx/scurry.mp3` — cockroach crawling (ambient)
- `public/assets/audio/sfx/buzz.mp3` — cockroach flying
- `public/assets/audio/sfx/ui-click.mp3` — button interaction
- `public/assets/audio/sfx/combo-chime.mp3` — combo milestone
- `public/assets/audio/sfx/timer-tick.mp3` — last 10 seconds
- `public/assets/audio/sfx/gameover.mp3` — round ends

**Required music files:**
- `public/assets/audio/music/normal-bgm.mp3` — Normal mode background
- `public/assets/audio/music/hell-bgm.mp3` — Hell mode background

## Automated Validation

The asset contract test suite (`tests/assets/asset-contract.test.ts`) validates:

1. **File existence** — Every file listed above exists at its expected path
2. **File size** — Within the max size budget
3. **Triangle count** — Within polycount limit (parse GLB binary or use Three.js GLTFLoader in Node)
4. **Animation clips** — All required clips present with correct names (lowercase, snake_case)
5. **Map empties** — All required empties present with correct naming patterns, minimum counts met
6. **No unnamed meshes** — All meshes have descriptive names (no "Cube.001")
