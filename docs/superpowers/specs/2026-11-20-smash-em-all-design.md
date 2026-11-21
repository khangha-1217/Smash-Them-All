# Smash 'Em All — Design Document

> **Date:** 2026-11-20
> **Status:** ✅ Approved (2026-11-20)
> **Stack:** Three.js + Vanilla TypeScript + Vite
> **Asset authoring:** Builder creates all 3D assets via Blender MCP, following the Asset Contract (§15)

---

## 1. Intent & Why

A browser-based 3D first-person arcade game where the player wields a slipper (or alternative weapon) to smash cockroaches inside domestic rooms within a 90-second time limit. The game is meant to be a quick, satisfying, stress-relief experience with high replay value, shareable funny achievements, and a path to web-ad monetization.

**Target audience:** Casual gamers on both desktop and mobile browsers.
**Success:** Players replay multiple times in one sitting, share achievements, game runs ≥ 55 fps on mid-range mobile.

---

## 2. Goals, Non-Goals, Anti-Goals

### Goals
- Fun, satisfying 90-second arcade loop with high replay value.
- Smooth 60 fps on desktop, ≥ 55 fps on mid-range mobile (e.g. Snapdragon 6-series).
- 3 fully-realized maps from day one (kitchen, living room, bedroom).
- Bilingual UI: Vietnamese and English.
- Ad-ready architecture (DOM overlay slots, non-intrusive placement points in game flow).
- Lightweight total download (target < 8 MB initial load across all assets for one map).

### Non-Goals
- Multiplayer or leaderboard server.
- Progression/unlock system (all maps & weapons available from start).
- Realistic graphics or PBR materials (stylized retro aesthetic).
- Native mobile app (browser-only, PWA optional later).

### Anti-Goals (would make this a failure even if it works)
- Laggy or janky on mobile — kills the casual appeal.
- Cockroaches that are impossible or trivial to hit — game feel must be tuned.
- Overly complex UI that breaks the "pick up and play in 5 seconds" promise.
- Horror-genre feel — this is funny/cozy, not scary.

---

## 3. Core Loop

```
[Select Map + Mode + Weapon] → [90s Countdown] → [Smash cockroaches for points & combos] → [Game Over: Score + Rank + Achievements] → [Replay / Change settings]
```

### Timing
- 90-second countdown timer per round.
- Swing lockout: 300ms per swing (prevents spam, creates rhythm).

### Scoring
- Crawling cockroach kill: **100 pts × combo multiplier**
- Flying cockroach kill: **250 pts × combo multiplier**
- Combo: consecutive hits within **2-second window** → x1, x2, x3... Resets on miss or timeout.
- Track a near-miss for achievements when a missed swing passes within 1.8× the current hitbox radius.

### Ranking (per round)

| Rank | Normal Mode | Hell Mode |
|------|-------------|-----------|
| S    | ≥ 8,000     | ≥ 12,000  |
| A    | ≥ 5,000     | ≥ 8,000   |
| B    | ≥ 3,000     | ≥ 5,000   |
| C    | < 3,000     | < 5,000   |

---

## 4. Two Game Modes

### Normal Mode ("Stress Relief")
- Cockroaches spawn and crawl across surfaces at various elevations: floor, chair legs, kitchen counter, sink area, toaster, coffee mug, cutting board, etc.
- Moderate spawn rate (details left to builder to tune).
- Cockroaches only crawl.

### Hell Mode ("Help! They Fly!")
- Higher cockroach density.
- Cockroaches can enter **flight state**: spread wings, hover, then dive toward the player's face.
- Pre-flight warning: 1.5s before takeoff, a toast alert "⚠️ Nó bay!" / "⚠️ It's flying!" appears on HUD.
- Flight path: Bézier spline from current position → elevated offset → accelerating dive toward camera position with slight random jitter.
- The flying cockroach hitbox radius is 1.3× the crawling radius.

---

## 5. Maps

Three maps, each a separate `.glb` file with embedded spawn-point empties and waypoint empties:

1. **Kitchen** — Retro/cozy: warm cream walls, sage green cabinets, blue-cream checkered tile floor, dark wood island with light countertop, pendant warm lighting (late-night ambiance), fridge, sink, toaster, fruit bowl.
2. **Living Room** — Cozy: fabric sofa, coffee table, TV stand, bookshelf, floor lamp, rug, potted plants. Warm-toned walls, wooden floor.
3. **Bedroom** — Cozy: bed with rumpled sheets, nightstand, desk with lamp, wardrobe, slippers on floor, curtained window with moonlight.

All maps share the retro/cozy stylized aesthetic. Specific visual details of living room and bedroom are **left to the builder** within this aesthetic direction.

### Map Data Contract
Each map GLB contains:
- Room geometry and furniture (baked lighting via emissive/vertex color or lightmap texture).
- Empty objects as **spawn points**, named `spawn_<surface>_<nn>` (e.g. `spawn_floor_01`, `spawn_counter_03`, `spawn_wall_02`).
- Empty objects as **waypoints** for cockroach navigation, named `waypoint_<surface>_<nn>`.
- A `player_start` empty defining initial camera position and orientation.
- Surface tag is encoded in the name: `floor`, `counter`, `table`, `wall`, `ceiling`, `shelf`, `bed`, `desk`, etc.

---

## 6. Weapons

Three weapons, each a separate `.glb` with a `swing` animation:

1. **Slipper (Dép lê)** — Default. Held at bottom-right of screen (first-person viewmodel).
2. **Flyswatter (Vợt)** — Longer reach visual, same gameplay hitbox.
3. **Cardboard (Giấy cứng)** — Flat, wide visual, same gameplay hitbox.

All weapons share identical gameplay stats (hit cone, swing duration, hitbox). The difference is purely visual/cosmetic. Player selects freely on the start screen.

**Viewmodel rendering:** Weapon is rendered in a separate render pass (or separate camera layer) so it doesn't clip into environment geometry. Positioned bottom-right, slightly bobbing with player movement.

---

## 7. Cockroach AI

### Crawling
- Cockroach spawns at a random spawn point tagged for a surface type.
- Selects a random waypoint on the **same surface** and moves toward it via lerp/slerp at a randomized speed (base 0.5–1.2 m/s).
- On reaching the waypoint, idles briefly (0.3–1s), then picks a new waypoint. With a small probability (tunable, ~10%), may switch to a waypoint on an adjacent surface (e.g. floor → counter edge, counter → wall).
- Animation state: `idle` while stopped, `crawl` while moving.
- **Surface-normal alignment:** Cockroaches orient along their movement direction, with body aligned to the surface normal. When transitioning between surfaces (e.g. floor → wall), the cockroach's up-vector is smoothly interpolated (quaternion slerp over ~0.3s) from the old surface normal to the new one, creating a visual "climbing up" effect. This means cockroaches on walls appear to crawl vertically, and on ceilings appear inverted — this is intentional and adds to the creepy/funny factor.
- **Builder's call:** Surface normal per waypoint is derived from the waypoint's local Z-axis in Blender (the empty's forward axis). The builder orients empties accordingly when placing waypoints on walls/ceilings.

### Flying (Hell Mode only)
- After spawning and crawling for a random interval (3–8s), cockroach enters pre-flight.
- Pre-flight: 1.5s warning toast, cockroach plays `fly` animation (wings spread).
- Flight: follows a 3-point Bézier curve (start position → elevated midpoint with lateral offset → camera position with jitter). Speed accelerates over the curve.
- If not hit during flight, cockroach "lands" near the player (despawns and respawns at a new spawn point) — it does NOT damage the player (no health system).
- If hit during flight, cockroach is killed (splat VFX + bonus points).

### Object Pooling
- Cockroach instances are pooled (pre-allocated, recycled on kill/despawn).
- Pool size: tunable, suggested 15–25 for Normal, 25–40 for Hell.

---

## 8. Controls

### Desktop (Keyboard + Mouse)
| Input | Action |
|-------|--------|
| WASD | Move (relative to camera facing) |
| Mouse move | Rotate camera (yaw + pitch, pitch clamped ±80°) |
| Left click | Swing weapon |
| Esc | Pause |

- Pointer Lock API for mouse capture during gameplay.
- On pause: release pointer lock, show pause overlay.

### Mobile (Touch)
| Input | Action |
|-------|--------|
| Left virtual joystick | Move (always visible during gameplay, left side of screen) |
| Right-side swipe/drag | Rotate camera |
| Tap (anywhere not on joystick) | Swing weapon |

- Joystick: semi-transparent circular pad, ~100px radius, bottom-left with safe margin.
- Camera swipe zone: entire right half of screen.
- Fullscreen API requested on game start (mobile).
- Mobile gameplay requires landscape regardless of input method. In portrait, show the rotate prompt and block Start and Play Again or pause an active round.

### Input Detection
- Auto-detect touch vs mouse on first interaction.
- Show appropriate control hints in HUD.

---

## 9. Player-Environment Collision

The player moves freely in first-person (WASD / mobile joystick). To prevent walking through walls and furniture, a lightweight custom collision system is used:

- **Room boundary:** Invisible AABB box matching the room's inner walls. Player position is clamped inside.
- **Furniture obstacles:** Each major piece of furniture has a simplified AABB collider (box, defined as metadata in the map GLB or hardcoded per map). Player movement is blocked by these via simple AABB-vs-sphere check (player = sphere, radius ~0.3m).
- **No vertical collision:** Player stays at a fixed Y height (standing eye level, ~1.6m). No jumping, no crouching, no stairs.
- **Implementation:** Each frame, compute desired new position from input, test against all colliders, slide along surfaces if blocked (simple projection). Collider count per map is small (< 20 boxes), so brute-force check is fine.

> **Builder's call:** Collider shapes are intentionally simplified (axis-aligned boxes only). Exact collider placement is left to the builder based on map geometry. No physics engine needed — this is pure position clamping.

---

## 10. Hit Detection

- **Mechanism:** On swing, cast a cone-shaped raycast check from camera center forward.
  - Cone half-angle: **25°** (generous).
  - Max range: **3 meters**.
  - Check against all alive cockroach sphere hitboxes.
  - If multiple cockroaches in cone, hit the **nearest** one.
- **Cockroach hitbox:**
  - Crawling: sphere radius **0.06m** (slightly larger than visual model).
  - Flying: sphere radius **0.078m** (1.3× crawling).
- **Near-miss detection:** If no hit but a cockroach is within **1.8× hitbox radius** of the ray, register a near-miss event.
- **Swing lockout:** 300ms after swing start, no new swing accepted. Visual weapon animation plays during this window.

---

## 10. Visual Style

### Environment
- **Aesthetic:** Retro/cozy stylized — NOT photorealistic. Soft colors, slightly exaggerated proportions.
- **Palette:** Warm cream base, sage green accents, pastel blue, dark wood, yellow-warm lighting.
- **Lighting:** Baked into assets (emissive/lightmap). One ambient light + one directional/point light in Three.js for subtle real-time shading on cockroaches and weapon.
- **Late-night ambiance:** Warm pendant lights, slight vignette post-process (optional, perf permitting).

### Cockroach
- Stylized, slightly cartoonish (not photorealistic disgusting).
- Brown/dark brown, visible wings, twitchy antennae.
- Size: ~4cm body length (0.04m in world scale).

### VFX
- **Kill splat:** 6–8 sprite particles (brown/dark), burst outward from hit point, fade over 400ms. Optional: small decal on surface (texture stamp, limited to last N decals for perf).
- **Screen shake:** 5px offset, 100ms duration, ease-out.
- **Crosshair flash:** Brief white flash on hit, brief red shake on near-miss.
- **Combo popup:** Floating "+250 x3!" text at hit position, drifts up and fades, neo-comic style.

---

## 11. UI / UX

### Visual Language (Neo-Comic / Sticker Card)
- Rounded-corner cards, cream/off-white background.
- Bold dark outlines (2–3px).
- Hard drop shadows (offset, no blur).
- Accent colors: pastel green (Normal mode), pastel pink (Hell mode & combo), bright yellow (CTA buttons).
- Font: rounded sans-serif (e.g. Nunito or Quicksand from Google Fonts).

### Screen Flow

#### 1. Start Screen
- 3D scene renders live in background (selected map, camera slowly panning).
- **Left card overlay:**
  - Game title "Smash 'Em All" with comic-style lettering.
  - Map selector (3 thumbnails or card row).
  - Mode selector: Normal / Hell (toggle/pill switch, color-coded).
  - Weapon selector (3 icons).
  - **"BẮT ĐẦU" / "START"** button (bright yellow, prominent).
- **Top-right corner:** Language toggle (🇻🇳/🇬🇧), Sound on/off, Trophy cabinet button.
- Mobile: card is full-width bottom sheet instead of left panel.

#### 2. In-Game HUD
- **Top-left:** Mode badge (green "THƯỜNG" or pink "ĐỊA NGỤC").
- **Top-center:** Timer `01:30` countdown + Score (large, bold).
- **Top-right:** Sound toggle + Combo badge (animated on combo, shows "x3!" etc.).
- **Bottom-left:** Kill counter with roach icon (e.g. "🪳 × 12").
- **Bottom-right:** Control hints (desktop: "WASD Move | Click Smash | Esc Pause"; mobile: hidden, joystick is self-explanatory).
- **Center:** Minimal crosshair (thin cross or dot, white with slight dark outline).
- **Toast area** (top-center below timer): flying cockroach warnings, combo milestones.
- Weapon viewmodel: bottom-right, slightly transparent when aiming near surfaces.

#### 3. Pause Overlay
- Semi-transparent dark overlay.
- Card center: "TẠM DỪNG" / "PAUSED", Resume button, Quit to menu button.
- Timer and game state frozen.

#### 4. Game Over Screen
- Transition: brief slow-mo on last second, then screen wipe.
- **Confetti particle effect** (DOM canvas or CSS animation).
- **Center card:**
  - "HẾT GIỜ!" / "TIME'S UP!" header.
  - Total score (large, animated counting up).
  - Rank stamp (S/A/B/C) — rubber stamp animation (slam + slight rotation).
  - Stats row: kills, combo max, accuracy (hits/swings).
  - Personal best indicator (if new record: "KỶ LỤC MỚI! 🎉" / "NEW RECORD! 🎉").
  - Newly unlocked achievement cards (if any), horizontal scroll.
  - Next rank hint: "Cần X điểm nữa để đạt hạng A" / "X more points for rank A".
  - **"CHƠI LẠI" / "PLAY AGAIN"** button (bright yellow).
  - **"VỀ MENU" / "MENU"** button (secondary).

#### 5. Trophy Cabinet
- Accessible from start screen (top-right button).
- Grid of achievement cards, unlocked ones colorful, locked ones greyed with "?" and hint text.
- Data persisted in `localStorage` under key `smash_em_all_achievements`.
- Personal best scores per map+mode also stored in `localStorage`.

---

## 12. Achievements

All achievements persist in `localStorage`, unlocked permanently.

| ID | Name (VI) | Name (EN) | Condition | Flavor (VI) |
|----|-----------|-----------|-----------|-------------|
| `golden_slipper` | Tay dép vàng | Golden Slipper | First S rank | "Gián nghe tên bạn là chạy" |
| `near_miss_master` | Bậc thầy vẽ viền | Outline Artist | 10 near-misses in 1 round | "Đập trượt cũng là nghệ thuật" |
| `combo_machine` | Combo Machine | Combo Machine | Combo ≥ x10 | "Không ngừng tay!" |
| `fly_swatter` | Trời ơi nó bay! | Oh No It Flies! | Kill 5 flying roaches in 1 round | "Bình tĩnh, chuyện nhỏ" |
| `perfect_aim` | Xạ thủ hoàn hảo | Perfect Aim | 0 misses, ≥ 15 kills in 1 round | "Phát nào trúng phát đó" |
| `pacifist` | Thong thả | Taking It Easy | < 3 kills in 1 round | "Chắc bạn thương gián?" |
| `collector` | Sưu tầm gia | Collector | Use all 3 weapons (across rounds) | "Đồ đập nào cũng thử" |
| `tourist` | Du khách | Tourist | Play all 3 maps | "Gián ở đâu cũng không thoát" |
| `night_owl` | Cú đêm | Night Owl | Play 30 total rounds | "Đập gián thay ngủ" |
| `hell_lord` | Chúa tể Địa Ngục | Lord of Hell | S rank in Hell mode | "Bay cũng không thoát tay bạn" |

---

## 13. Localization (i18n)

- Two languages: Vietnamese (vi) and English (en).
- Implementation: JSON locale files (`locales/vi.json`, `locales/en.json`) with flat key-value structure.
- UI reads from current locale object; language toggle on start screen switches and persists choice in `localStorage`.
- All UI strings, achievement names, flavor text, toast messages, and control hints are localized.
- Default language: Vietnamese. Fallback: English.

---

## 14. Technical Architecture

### Stack
- **Runtime:** Three.js (r170+) + TypeScript
- **Build:** Vite (dev server + production build)
- **Collision:** Custom raycast cone + sphere (no physics engine)
- **Audio:** Web Audio API (`AudioContext`) with preloaded MP3/OGG files
- **Assets:** GLB with Meshopt compression
- **State:** No framework — vanilla TS with simple event emitter pattern

### Architecture Layers

```
┌──────────────────────────────────────────┐
│           DOM / HTML / CSS UI            │  ← HUD, menus, overlays, ad slots
├──────────────────────────────────────────┤
│        Three.js Rendering Layer          │  ← Scene, Camera, Lights, Renderer,
│    (NO unit tests for this layer)        │     AnimationMixer, post-processing
├──────────────────────────────────────────┤
│        Headless Core (testable)          │  ← Game state machine, scoring,
│    (strict TDD for this layer)           │     combo, hit detection math,
│                                          │     cockroach AI logic, object pool,
│                                          │     timer, achievement tracker
├──────────────────────────────────────────┤
│          Asset / Data Layer              │  ← GLB loader, locale JSON loader,
│                                          │     localStorage persistence,
│                                          │     asset contract validation
└──────────────────────────────────────────┘
```

### Game State Machine

```
MENU → LOADING → READY → PLAYING ⇄ PAUSED → GAME_OVER → MENU
```

- `MENU`: Start screen active, 3D scene renders in background.
- `LOADING`: Assets for selected map loading (show progress bar).
- `READY`: Brief "3-2-1" countdown (optional, left to builder).
- `PLAYING`: 90s timer running, input active, cockroaches spawning.
- `PAUSED`: Timer frozen, overlay shown, input suppressed.
- `GAME_OVER`: Score calculated, achievements checked, results displayed.

### Asset Loading Strategy
- **Lazy per-map:** Only load the selected map's GLB on game start. Weapons and cockroach GLB are preloaded (small files).
- **Loading screen:** Show progress bar during map load.
- **Cache:** Browser cache headers + service worker (optional, for PWA later).

### Performance Budget
| Metric | Target |
|--------|--------|
| Initial JS bundle (gzipped) | < 200 KB |
| Map GLB (Meshopt compressed) | < 2 MB each |
| Cockroach GLB | < 100 KB |
| Weapon GLB (each) | < 50 KB |
| Total first-load (1 map) | < 4 MB |
| Frame rate desktop | 60 fps |
| Frame rate mobile (mid-range) | ≥ 55 fps |
| Draw calls per frame | < 50 |
| Triangles per frame | < 35,000 |

### Render Optimization
- Frustum culling (Three.js default).
- Object pooling for cockroaches (avoid GC spikes).
- Instanced rendering for cockroaches if same model (InstancedMesh).
- Sprite particles for VFX (no mesh particles).
- Weapon rendered on separate camera layer (avoid z-fighting).
- No real-time shadows (baked lighting only).
- Optional: half-resolution rendering on low-end mobile with CSS upscale.

---

## 15. 3D Asset Contract

### Standards

| Property | Value |
|----------|-------|
| Coordinate system | Y-up (glTF standard) |
| Scale | 1 unit = 1 meter |
| Origin | Map: center of room floor. Cockroach: center of body. Weapon: grip point. |
| Export format | GLB (binary glTF 2.0) |
| Compression | Meshopt |
| Texture max resolution | 1024 × 1024 |
| Texture format | PNG or embedded JPEG |

### Polycount Limits

| Asset | Max triangles |
|-------|---------------|
| Map (kitchen/living/bedroom) | 30,000 |
| Cockroach | 1,500 |
| Weapon (each) | 800 |

### Animation Clip Naming (NLA Tracks)

| Asset | Required clips |
|-------|---------------|
| Cockroach | `idle`, `crawl`, `fly` |
| Weapon (each) | `idle`, `swing` |

All clip names lowercase, snake_case.

### Embedded Empties Naming

| Purpose | Pattern | Example |
|---------|---------|---------|
| Spawn point | `spawn_<surface>_<nn>` | `spawn_floor_01` |
| Waypoint | `waypoint_<surface>_<nn>` | `waypoint_counter_03` |
| Player start | `player_start` | `player_start` |

### Blender MCP Workflow
1. Model and rig in Blender via MCP commands.
2. Capture viewport screenshots for visual verification.
3. Export GLB with Meshopt compression.
4. Run automated Asset Contract tests (file exists, file size, triangle count, animation clip names, empty naming).
5. Save `.blend` source file + Python recreation script for version control.

---

## 16. Selective TDD Strategy

### STRICT TDD (write tests first)

**Headless Core:**
- Game state machine transitions (MENU → LOADING → READY → PLAYING ⇄ PAUSED → GAME_OVER).
- Scoring: base points, combo multiplier calculation, combo timeout reset, combo break on miss.
- Hit detection math: cone-sphere intersection, nearest-hit selection, near-miss detection.
- Timer: countdown logic, pause/resume.
- Cockroach AI logic: waypoint selection, surface switching probability, flight Bézier curve generation, pre-flight timing.
- Object pool: allocate, release, recycle, pool exhaustion behavior.
- Achievement tracker: condition evaluation, unlock persistence, duplicate prevention.
- Ranking: score-to-rank mapping for both modes.
- i18n: locale key lookup, fallback, language switching.

**Asset Contract Validation:**
- GLB file exists and is loadable.
- File size within budget.
- Triangle count within limits.
- Required animation clips present and correctly named.
- Required empties present and correctly named.
- Y-up orientation verified.

### NO TESTS (explicitly skipped)

- Three.js scene setup, camera, lights, renderer configuration.
- Shader/material code.
- AnimationMixer playback.
- DOM/HTML/CSS UI rendering.
- WebGL context.
- Game feel constants (swing duration, screen shake magnitude, particle count) — these are tuned by playtesting, not tests.
- Audio playback.
- Touch/mouse input event wiring (tested manually).

### Test Runner
- **Vitest** (native Vite integration, fast, TypeScript-first).

---

## 17. Ad Integration Readiness

No ads in v1, but architecture supports future integration:
- DOM overlay structure: designated `<div>` slots above the Three.js canvas for banner ads.
- Natural ad break points in game flow: after Game Over (before showing results), and on the start screen.
- No in-game 3D ads (keep the aesthetic clean).
- Ad SDK loading deferred and optional (feature-flagged).

---

## 18. Audio Design

### Sound Effects (preloaded MP3/OGG, < 50 KB each)
| Sound | Trigger |
|-------|---------|
| Smack (hit) | Weapon hits cockroach |
| Whoosh (miss) | Weapon swings, misses |
| Scurry | Cockroach crawling (ambient, spatial) |
| Buzz/flutter | Cockroach flying (spatial, Doppler-like via playback rate) |
| UI click | Button interactions |
| Combo chime | Combo milestone (x5, x10) |
| Timer warning | Last 10 seconds (ticking) |
| Game over jingle | Round ends |

### Music
- Lo-fi / chill background track, looping, low volume.
- One track for Normal, one for Hell (slightly more intense).
- Compressed, < 500 KB each.

### Audio Sourcing (Builder's call)
- SFX and music are sourced from **royalty-free libraries** (e.g. Freesound.org, Pixabay Audio, OpenGameArt) or generated using simple tools.
- All assets must be CC0 or royalty-free commercial-use licensed.
- If suitable free assets are unavailable for a specific sound, the builder may synthesize simple SFX using Web Audio API oscillators as a fallback (e.g. UI clicks, timer ticks).

### Implementation
- Web Audio API `AudioContext` for spatial audio (cockroach sounds positioned in 3D).
- `GainNode` per category (SFX, music) for independent volume control.
- Sound toggle persisted in `localStorage`.
- Audio context resumed on first user interaction (browser autoplay policy).

---

## 19. Approaches Considered

### Web 3D Stack
| Option | Verdict | Reason |
|--------|---------|--------|
| **Three.js + Vanilla TS** | ✅ Chosen | Full game loop control, lightest bundle (~150 KB gz), largest community, easy DOM ad overlay integration |
| React Three Fiber | ❌ | React reconciler overhead per frame, complex real-time state management, heavier bundle |
| Babylon.js | ❌ | ~500 KB+ bundle, overkill for this scope |

### Physics / Collision
| Option | Verdict | Reason |
|--------|---------|--------|
| **Custom raycast + AABB/Sphere** | ✅ Chosen | Game needs only hit detection (no rigid body physics), zero dependency, easy to tune for game feel |
| Rapier WASM | ❌ | 200 KB WASM overhead, cockroaches follow AI paths not physics, slipper is animation-driven |

### Asset Strategy
| Option | Verdict | Reason |
|--------|---------|--------|
| **Full GLB models** | ✅ Chosen | 3 detailed maps impractical as procedural, cockroach rigging needs Blender, visual quality far superior |
| Procedural geometry | ❌ | Thousands of LOC for inferior visuals, animation nearly impossible |
| Hybrid | ❌ | No meaningful procedural needs beyond particle sprites |

### GLB Compression
| Option | Verdict | Reason |
|--------|---------|--------|
| **Meshopt** | ✅ Chosen | Smaller decoder than Draco, faster decode on mobile, good compression ratio |
| Draco | ❌ | Larger WASM decoder (~100 KB), slower decode, slight quality loss on low-poly stylized models |

### Cockroach AI Navigation
| Option | Verdict | Reason |
|--------|---------|--------|
| **Waypoint/Spline + surface tags** | ✅ Chosen | Fits multi-surface movement, waypoints embeddable in GLB via Blender, Bézier flight paths natural |
| Navmesh (recast) | ❌ | WASM overhead, complex for multi-surface (floor + counter + wall), overkill |
| Random walk | ❌ | No purposeful movement, boring gameplay |

### Audio
| Option | Verdict | Reason |
|--------|---------|--------|
| **Preloaded audio files + Web Audio API** | ✅ Chosen | Consistent quality, easy authoring, spatial audio support, small files |
| Pure Web Audio synthesis | ❌ | Difficult to achieve natural smack/scurry sounds, more code for worse results |

---

## 20. What's Left to the Builder

The following are explicitly left to the builder to decide during implementation:

- Exact cockroach spawn rates and density curves per mode (tune by playtesting).
- Exact timing constants for game feel (screen shake curve, particle velocities, combo popup animation).
- Living room and bedroom specific furniture/prop details (within the retro/cozy aesthetic).
- Exact waypoint placement in maps (follows naming convention, density informed by playtesting).
- Whether to include a "3-2-1 GO" countdown before gameplay starts (recommended but optional).
- Specific lo-fi music tracks (source or compose).
- Service worker / PWA setup (optional, future).
- Exact ad SDK and placement (future, architecture is ready).
- Color-exact values for UI (follow the pastel neo-comic direction described).

---

## 21. Project Structure (Recommended)

```
smash-em-all/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── assets/
│       ├── models/
│       │   ├── maps/
│       │   │   ├── kitchen.glb
│       │   │   ├── livingroom.glb
│       │   │   └── bedroom.glb
│       │   ├── cockroach.glb
│       │   └── weapons/
│       │       ├── slipper.glb
│       │       ├── flyswatter.glb
│       │       └── cardboard.glb
│       └── audio/
│           ├── sfx/
│           └── music/
├── src/
│   ├── main.ts                  # Entry point
│   ├── core/                    # Headless Core (TDD)
│   │   ├── state-machine.ts
│   │   ├── scoring.ts
│   │   ├── combo.ts
│   │   ├── timer.ts
│   │   ├── hit-detection.ts
│   │   ├── cockroach-ai.ts
│   │   ├── object-pool.ts
│   │   ├── achievement-tracker.ts
│   │   └── ranking.ts
│   ├── rendering/               # Three.js layer (NO tests)
│   │   ├── scene-manager.ts
│   │   ├── camera-controller.ts
│   │   ├── weapon-viewmodel.ts
│   │   ├── cockroach-renderer.ts
│   │   ├── vfx.ts
│   │   └── map-loader.ts
│   ├── input/                   # Input handling
│   │   ├── desktop-input.ts
│   │   ├── mobile-input.ts
│   │   └── input-manager.ts
│   ├── audio/                   # Audio system
│   │   └── audio-manager.ts
│   ├── ui/                      # DOM UI
│   │   ├── hud.ts
│   │   ├── start-screen.ts
│   │   ├── game-over-screen.ts
│   │   ├── pause-overlay.ts
│   │   └── trophy-cabinet.ts
│   ├── i18n/                    # Localization
│   │   ├── i18n.ts
│   │   └── locales/
│   │       ├── vi.json
│   │       └── en.json
│   └── utils/                   # Shared utilities
│       ├── event-emitter.ts
│       └── math-utils.ts
├── tests/                       # Vitest tests (core + asset contract only)
│   ├── core/
│   │   ├── state-machine.test.ts
│   │   ├── scoring.test.ts
│   │   ├── combo.test.ts
│   │   ├── timer.test.ts
│   │   ├── hit-detection.test.ts
│   │   ├── cockroach-ai.test.ts
│   │   ├── object-pool.test.ts
│   │   ├── achievement-tracker.test.ts
│   │   └── ranking.test.ts
│   └── assets/
│       └── asset-contract.test.ts
├── blender/                     # Blender source files
│   ├── kitchen.blend
│   ├── livingroom.blend
│   ├── bedroom.blend
│   ├── cockroach.blend
│   ├── weapons.blend
│   └── scripts/                 # Python recreation scripts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-11-20-smash-em-all-design.md
```
