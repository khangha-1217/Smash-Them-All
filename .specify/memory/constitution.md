# Smash 'Em All — Constitution

> Project-wide principles, standards, and workflows.
> This file is the single source of truth for all builders working on this project.
> Approved: 2026-11-20

---

## 1. Project Identity

- **Name:** Smash 'Em All
- **Genre:** 3D First-Person Time-Attack Arcade (browser-based)
- **Stack:** Three.js + Vanilla TypeScript + Vite
- **Platforms:** Desktop browsers (Chrome, Firefox, Edge, Safari) + Mobile browsers (iOS Safari, Chrome Android)
- **Languages:** Vietnamese (default), English
- **Design Spec:** `docs/superpowers/specs/2026-11-20-smash-em-all-design.md`

---

## 2. Core Principles

### 2.1 Performance First
- Target: 60 fps desktop, ≥ 55 fps mid-range mobile.
- No real-time shadows. Baked lighting only.
- Object pooling mandatory for cockroaches (avoid GC spikes).
- Draw calls < 50 per frame. Triangles < 35,000 per frame.
- Initial load < 4 MB (1 map + shared assets).

### 2.2 Game Feel Over Realism
- Hit detection is generous (25° cone, expanded hitboxes).
- Flying cockroach hitbox is 1.3× crawling hitbox (compensation for difficulty).
- Satisfying feedback on every action: screen shake, particle burst, audio cue, combo popup.
- Swing lockout 300ms creates rhythm — no spam clicking.

### 2.3 Casual & Cozy, Not Horror
- Stylized retro/cozy aesthetic. Warm colors, soft lighting, slightly cartoonish.
- Cockroaches are funny-gross, not scary-realistic.
- UI is neo-comic/sticker card: rounded corners, pastel accents, bold outlines, hard drop shadows.
- Achievements are humorous and shareable.

### 2.4 Self-Contained & Ad-Ready
- No server backend. All state in `localStorage`.
- DOM overlay architecture for future ad slots.
- Ad break points: after Game Over, on start screen. Never during gameplay.

### 2.5 No Unnecessary Dependencies
- No React, no physics engine, no navmesh library.
- Custom collision (AABB + raycast cone + sphere).
- Vanilla TypeScript + Three.js + Vite only.
- Audio via native Web Audio API with preloaded files.

---

## 3. 3D Asset Standards (Asset Contract)

### 3.1 Coordinate System & Scale
| Property | Value |
|----------|-------|
| Coordinate system | Y-up (glTF 2.0 standard, Three.js default) |
| Scale | 1 Blender unit = 1 meter |
| Origin — Map | Center of room floor |
| Origin — Cockroach | Center of body |
| Origin — Weapon | Grip point |
| Export format | GLB (binary glTF 2.0) |
| Compression | Meshopt (NOT Draco) |

### 3.2 Polycount Limits
| Asset | Max Triangles |
|-------|---------------|
| Map (kitchen / living room / bedroom) | 30,000 |
| Cockroach | 1,500 |
| Weapon (each) | 800 |

### 3.3 Texture Standards
| Property | Value |
|----------|-------|
| Max resolution | 1024 × 1024 |
| Format | PNG or embedded JPEG |
| Style | Stylized flat/hand-painted, NOT PBR |
| Lighting | Baked via emissive/vertex color or lightmap texture |

### 3.4 Animation Clip Naming (NLA Tracks)
All clip names **lowercase, snake_case**. No spaces, no special characters.

| Asset | Required Clips |
|-------|----------------|
| Cockroach | `idle`, `crawl`, `fly` |
| Weapon (each) | `idle`, `swing` |

### 3.5 Embedded Empties (Map Metadata)
Empties embedded in map GLB files define spawn points, waypoints, and player start.

| Purpose | Naming Pattern | Example |
|---------|----------------|---------|
| Spawn point | `spawn_<surface>_<nn>` | `spawn_floor_01`, `spawn_counter_03` |
| Waypoint | `waypoint_<surface>_<nn>` | `waypoint_wall_02`, `waypoint_shelf_01` |
| Player start | `player_start` | `player_start` |

**Surface tags** (encoded in name): `floor`, `counter`, `table`, `wall`, `ceiling`, `shelf`, `bed`, `desk`, `sink`, `chair`.

**Waypoint orientation:** The empty's local Z-axis (forward) defines the surface normal at that point. Builder must orient empties correctly when placing on walls/ceilings so cockroaches align properly.

### 3.6 File Size Budget
| Asset | Max Size (Meshopt compressed) |
|-------|-------------------------------|
| Map GLB (each) | 2 MB |
| Cockroach GLB | 100 KB |
| Weapon GLB (each) | 50 KB |
| SFX file (each) | 50 KB |
| Music track (each) | 500 KB |
| JS bundle (gzipped) | 200 KB |

---

## 4. Blender MCP Workflow

### 4.1 Asset Creation Process
```
1. Model & rig in Blender via MCP commands
2. Set up materials (stylized, baked lighting for maps)
3. Create animations (NLA tracks, correct naming)
4. Place empties (spawn points, waypoints, player_start) for maps
5. Capture viewport screenshots → visual verification
6. Export GLB with Meshopt compression
7. Run automated Asset Contract tests
8. Save .blend source + Python recreation script
```

### 4.2 Visual Verification Protocol
Before exporting any asset:
- Capture viewport screenshot from at least 2 angles.
- Verify: scale looks correct (compare to 1m reference), colors match palette, animations play correctly.
- For maps: verify empties are visible and correctly placed/oriented.

### 4.3 Version Control
- `.blend` source files stored in `blender/` directory.
- Each `.blend` has a companion Python script in `blender/scripts/` that can recreate the asset from scratch.
- Exported `.glb` files stored in `public/assets/models/`.
- Both source and export are committed to version control.

### 4.4 Asset Checklist (per asset)
- [ ] Polycount within limit
- [ ] Y-up orientation
- [ ] Correct scale (1 unit = 1 meter)
- [ ] Required animation clips present and correctly named
- [ ] Textures ≤ 1024×1024
- [ ] Meshopt compression applied
- [ ] File size within budget
- [ ] Viewport screenshots captured
- [ ] For maps: all empties present and correctly named/oriented
- [ ] Python recreation script saved
- [ ] Asset Contract tests pass

---

## 5. TDD Standards (Selective TDD)

### 5.1 STRICT TDD — Tests First, Always
Write failing tests BEFORE implementation for these modules:

**Headless Core (`src/core/`):**
- `state-machine` — All transitions: MENU → LOADING → READY → PLAYING ⇄ PAUSED → GAME_OVER → MENU. Invalid transitions rejected.
- `scoring` — Base points (100 crawling, 250 flying), combo multiplier application.
- `combo` — Multiplier increment on hit, reset on miss, reset on 2s timeout. Edge cases: rapid hits, hit at exact timeout boundary.
- `timer` — 90s countdown, pause/resume, game-over trigger at 0.
- `hit-detection` — Cone-sphere intersection math, nearest-hit selection when multiple in cone, near-miss detection (1.8× radius), out-of-range rejection.
- `cockroach-ai` — Waypoint selection logic, surface-switching probability, flight Bézier curve generation, pre-flight timing.
- `object-pool` — Allocate, release, recycle, pool-exhaustion behavior (no crash, graceful).
- `achievement-tracker` — Each achievement's condition evaluation, unlock persistence (mock localStorage), no duplicate unlocks.
- `ranking` — Score-to-rank mapping for both Normal and Hell modes, boundary values.
- `i18n` — Locale key lookup, missing key fallback, language switching.

**Asset Contract Validation (`tests/assets/`):**
- GLB file exists at expected path.
- File size within budget.
- Triangle count within limit (parse GLB or use Three.js loader in Node).
- Required animation clips present and correctly named.
- Required empties present and correctly named (for maps).

### 5.2 NO TESTS — Explicitly Skipped
Never write tests for these. Do not mock WebGL.

- Three.js scene, camera, lights, renderer, materials, shaders.
- `AnimationMixer` playback.
- DOM/HTML/CSS UI rendering.
- WebGL context creation or capabilities.
- Game feel constants (swing duration, screen shake magnitude, particle count, speed curves) — tuned by playtesting.
- Audio playback (`AudioContext`, `GainNode`).
- Touch/mouse input event wiring.
- Visual effects (particles, decals, combo popups).

### 5.3 Test Runner & Conventions
- **Runner:** Vitest (native Vite integration, TypeScript-first).
- **Location:** `tests/` directory, mirroring `src/` structure.
- **Naming:** `<module>.test.ts`.
- **Style:** Arrange-Act-Assert. Descriptive `describe`/`it` blocks in English.
- **No mocks of Three.js or WebGL.** Core logic must be pure functions/classes with no rendering dependency.
- **Coverage target:** 100% branch coverage for `src/core/` modules under TDD.

---

## 6. Architecture Rules

### 6.1 Layer Separation
```
DOM/UI Layer  →  calls  →  Headless Core  ←  reads  ←  Rendering Layer
                              ↑
                         Event Emitter
                        (decoupled pub/sub)
```

- **Headless Core** has ZERO imports from Three.js, DOM, or Web Audio API.
- **Rendering Layer** reads state from Core and translates to Three.js visuals.
- **UI Layer** reads state from Core and updates DOM elements.
- Communication via a simple event emitter pattern (no framework).

### 6.2 No Circular Dependencies
- Core depends on nothing.
- Rendering depends on Core + Three.js.
- UI depends on Core + DOM.
- Audio depends on Core (listens to events) + Web Audio API.
- Input depends on DOM/Touch APIs, pushes commands into Core.

### 6.3 State Machine is the Authority
- All game flow decisions go through the state machine.
- UI and rendering react to state changes, never drive them.
- Input handlers dispatch commands; the state machine decides whether to accept them based on current state.

---

## 7. Code Conventions

### 7.1 Language & Style
- TypeScript strict mode (`"strict": true` in tsconfig).
- No `any` type except in Three.js interop boundaries (and must be commented why).
- ESM imports only (no CommonJS).
- Prefer `const` over `let`. Never `var`.

### 7.2 Naming
| Entity | Convention | Example |
|--------|------------|---------|
| Files | kebab-case | `state-machine.ts` |
| Classes | PascalCase | `ObjectPool` |
| Functions | camelCase | `calculateScore()` |
| Constants | UPPER_SNAKE | `MAX_COMBO_WINDOW_MS` |
| Types/Interfaces | PascalCase, prefix I for interfaces optional | `GameState`, `CockroachConfig` |
| Events | UPPER_SNAKE | `COCKROACH_KILLED`, `COMBO_UPDATED` |

### 7.3 Project Structure
```
smash-em-all/
├── src/
│   ├── main.ts           # Entry point
│   ├── core/             # Headless core (TDD, no Three.js imports)
│   ├── rendering/        # Three.js layer (no tests)
│   ├── input/            # Input handling
│   ├── audio/            # Audio system
│   ├── ui/               # DOM UI
│   ├── i18n/             # Localization
│   └── utils/            # Shared pure utilities
├── tests/                # Vitest (core + asset contract only)
├── public/assets/        # GLB models, audio files
├── blender/              # .blend sources + scripts
└── docs/                 # Specs
```

---

## 8. Audio Standards

### 8.1 Format
- SFX: MP3 or OGG, mono, 44.1 kHz, < 50 KB each.
- Music: MP3 or OGG, stereo, 44.1 kHz, < 500 KB each.

### 8.2 Sourcing
- Royalty-free libraries: Freesound.org, Pixabay Audio, OpenGameArt.
- License: CC0 or royalty-free commercial-use only.
- Fallback: simple synthesis via Web Audio API for UI sounds.

### 8.3 Implementation
- Web Audio API `AudioContext` (not `<audio>` element).
- Spatial audio for cockroach sounds (panner nodes positioned in 3D).
- Separate `GainNode` per category (SFX, Music) for independent volume.
- Resume `AudioContext` on first user interaction (browser autoplay policy).
- Sound preference persisted in `localStorage`.

---

## 9. Git Conventions

### 9.1 Commit Messages
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `asset`, `docs`, `chore`
- Scope: module name (`core`, `rendering`, `ui`, `audio`, `blender`, `i18n`)
- Example: `feat(core): add combo timeout reset logic`
- Example: `asset(blender): export kitchen map v1 with spawn points`

### 9.2 Branch Strategy
- `main` — stable, playable builds only.
- `dev` — integration branch.
- Feature branches: `feat/<short-description>`.
- Asset branches: `asset/<asset-name>`.
