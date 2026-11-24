# Implementation Plan: Smash 'Em All

**Branch**: `feat/smash-em-all` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Increment**: 2026-11-23 gameplay feel and 60-second countdown update

**Input**: Feature specification from `specs/001-smash-em-all/spec.md`

## Summary

A browser-based 3D first-person arcade game where the player wields a slipper (or alternative cosmetic weapon) to smash cockroaches in domestic rooms within a 60-second time limit. Two game modes (Normal and Hell/flying cockroaches), three maps (kitchen, living room, bedroom), three weapons (cosmetic only), combo scoring system, humorous achievement badges, bilingual UI (Vietnamese/English). Built with Three.js + Vanilla TypeScript + Vite. All state in localStorage. No server backend. Ad-ready DOM overlay architecture.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, ESM only)

**Primary Dependencies**: Three.js r170+ (3D rendering), Vite 5.x (build/dev), Vitest (testing)

**Storage**: Browser localStorage (achievements, personal bests, preferences)

**Testing**: Vitest — strict TDD for headless core modules + asset contract validation only. No WebGL/DOM/audio tests.

**Target Platform**: Desktop browsers (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+) + Mobile browsers (iOS Safari, Chrome Android) — landscape only

**Project Type**: Browser-based 3D game (single HTML entry point)

**Performance Goals**: 60 fps desktop, ≥ 55 fps mid-range mobile (Snapdragon 6-series), < 4 MB initial load (1 map + shared assets), < 50 draw calls/frame, < 35,000 triangles/frame

**Frame budget** — Count draw calls and triangles across all passes for one gameplay frame. A reference allocation for Hell Mode is 21,000 triangles for the room, 12,000 for 40 visible cockroaches at 300 each, 800 for the weapon and 1,000 for VFX (34,800 total). Use this allocation as an authoring target and adjust it if needed while keeping <35,000 triangles and <50 draw calls per frame. The asset-file caps are separate acceptance limits. Profile Kitchen in Normal at T048 and in Hell at T055, then verify all room/mode combinations in the production build at T096.

**Constraints**: No server backend, no React/framework, no physics engine (Rapier/Cannon), no navmesh library. Custom raycast cone + sphere collision. Baked lighting only (no real-time shadows). Meshopt-compressed GLB assets. Web Audio API for audio. Landscape-only on mobile.

**Runtime compatibility** — Check model-load cancellation with `AbortSignal.aborted` and dispose a decoded scene if its request became stale during decoding. The loader derives an optional support ID from each upward-facing furniture marker and its collider bounds. Ground AI uses known support IDs to avoid crawling directly between disconnected furniture pieces. GLB marker names and the asset contract remain the same.

**Audio and profile persistence** — Use Web Audio parameters for spatial position and orientation where available, with legacy listener and panner methods as a fallback. Play one short synthesized outcome cue if the hit or miss sample is still unavailable. Write language and sound preferences individually. Read the latest stored round progress and personal bests before updating those keys, and keep session progress in memory when storage fails. The read-merge-write sequence is best effort for simultaneous writes from separate tabs.

**Scale/Scope**: Single-player, 3 maps, 3 weapons (cosmetic), 2 modes, 10 achievements, 2 languages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| §2.1 Performance First | ✅ Pass | Custom lightweight collision (no physics engine), object pooling for cockroaches, baked lighting, draw call budget < 50, triangle budget < 35K, initial load < 4 MB |
| §2.2 Game Feel Over Realism | ✅ Pass | 25° cone hit detection, 1.3× flying hitbox, 300ms swing lockout, screen shake + particle VFX on hit |
| §2.3 Casual & Cozy, Not Horror | ✅ Pass | Stylized retro/cozy aesthetic, neo-comic UI, humorous achievements, cartoonish cockroaches |
| §2.4 Self-Contained & Ad-Ready | ✅ Pass | All state in localStorage, DOM overlay slots for future ads, no server backend |
| §2.5 No Unnecessary Dependencies | ✅ Pass | Three.js + Vanilla TS + Vite only. No React, no physics engine, no navmesh library |
| §3.x Asset Contract | ✅ Pass | Y-up, 1m scale, Meshopt, naming conventions for empties/animations defined |
| §5.x Selective TDD | ✅ Pass | Strict TDD for headless core + asset contract. Skip rendering/DOM/audio |
| §6.x Architecture Rules | ✅ Pass | Headless Core has zero Three.js imports. Event emitter decoupling. State machine owns transitions. Round owns lifecycle and combat events |

**No violations. No complexity tracking required.**

## Gameplay Feel Increment (2026-11-23)

### Scope and Technical Context

Implement the 2026-11-23 specification additions for US1, US2, US4 and US5. Cover FR-004, FR-006, FR-007, FR-010, FR-011, FR-016 and FR-026–FR-030, and validate against SC-006, SC-009 and SC-011–SC-013. Use the existing TypeScript, Three.js, Blender and Vitest workflow. Changes are local to active-round state, grounded cockroach motion, asset authoring, first-person presentation and their validation. The storage schema has no changes.

### Design and Implementation Order

1. **Shared swing clock and contact.** Extend `src/core/round.ts` with one pending contact and keep the 300 ms lockout on the active-round clock. Start with a shared contact offset of about 100 ms. Resolve at the contact boundary, splitting a tick if needed so target movement and lifecycle events are evaluated through contact before hit detection and before processing the remainder. An expiry at or before contact wins. Use the existing hit geometry and nearest-target selection. Count swings and update score, combo, replacement scheduling and feedback only on resolution. Keep time and pending contact frozen during pause. Clear them on round end, quit or replay as appropriate. Add headless timing and lifecycle regression coverage in `tests/core/round.test.ts`.
2. **Live aim and synchronized presentation.** In `src/main.ts`, coordinate frame updates and desktop/touch commands on one monotonic timeline. Advance through an intervening contact before applying a newer look command, so delayed frames cannot apply late aim retroactively. Use the current unshaken aim from `CameraController.aim()` and pass plain vectors to the core. Drive the strike pose in `src/rendering/weapon-viewmodel.ts` from active swing time, with a visible contact pose when a frame spans that beat. Keep the capped render delta for cosmetic bob. At contact, route the existing hit/near-miss cues and one outcome sound, plus a subtle distinct visual cue for an empty miss. Follow the [event contract](./contracts/event-bus.md).
3. **Grounded motion and gait.** In `src/core/cockroach-ai.ts`, use short supported waypoint legs with an elapsed-time speed profile, braking at turns and a brief turn hold. Carry remaining time across leg boundaries and keep current support and heading when stopped. Use the map's marker normals and available bounds to reject unsupported links, with a two-segment seam route only where both supports meet. Verify the floor, counter and wall routes on all rooms, and adjust affected waypoint metadata only if an existing marker offers no usable supported route. In `src/rendering/cockroach-renderer.ts`, use the published heading and actual ground speed to align the body and drive alternating leg cadence. Author planted feet on the contact plane and test edge turns. Keep the existing Hell Mode preflight timing and flight path. Add headless tests in `tests/core/cockroach-ai.test.ts` for speed, turns, supported segments and large ticks.
4. **Author and calibrate assets.** Redesign the cockroach and animate its legs and antennae in `blender/scripts/cockroach.py`. In `blender/scripts/slipper.py`, simplify the slipper mesh where needed to fit the low-poly hand, and animate its grip, wrist rotation, diagonal strike and recovery. Author the contact pose for all three weapon clips at the shared beat, preserving their distinct poses. Start scale calibration with the per-weapon viewmodel mounts and adjust visual cockroach scale if needed, leaving gameplay hitboxes independent. Update the matching Blender sources and GLBs and validate them against the [asset contract](./contracts/asset-contract.md).
5. **Integrate and validate.** After the core timing and grounded motion are in place, exercise the three weapons on desktop and landscape touch. Use the new [validation scenarios](./quickstart.md#v9-gameplay-feel-increment) to confirm the ratio, gait, preflight, live aim, cancellation and outcome timing. Run the headless and asset suites and a production build. Profile busy Normal and Hell views within the existing performance budgets. Record capture evidence and keep unmeasured physical device results open.

**Contact and expiry in the same update** — When a contact precedes expiry, the core records its outcome and finalizes the round at 60 seconds of active play. If the impact has yet to be drawn, the presentation retains the strike pose and outcome effect for one rendered gameplay frame and plays one outcome sound when enabled. It then shows the results screen and clears the retained impact. Contact at or after expiry is canceled. V9 checks this ordering at 59,980 ms, 60,000 ms, and 60,020 ms of active play.

**Fixed scale calibration** — Use the [V9 Kitchen view](./quickstart.md#v9-gameplay-feel-increment) at 0.60 m horizontal offset and 0.40 m height above the stationary broadside cockroach. Verify a 25–33% body-to-slipper ratio in both the 1280 × 720 and 844 × 390 viewports. Approve the T116 flyswatter and cardboard captures against the calibrated slipper before the T117 comparison.

### Constitution Check for the Increment

| Principle | Pre-research gate | Post-design evidence |
|-----------|-------------------|----------------------|
| §2.1 Performance First | Pass | Pooled roaches, lightweight waypoint math, short-lived swing state, combined hand/weapon primitive, existing frame and download budgets |
| §2.2 Game Feel Over Realism | Pass | Shared 25° cone, 3 m range, 1.3× flying hitbox and 300 ms lockout with feedback synchronized to contact |
| §2.3 Casual & Cozy | Pass | Stylized silhouette and baked materials paired with readable motion |
| §2.4–2.5 Dependencies and Storage | Pass | Existing local storage format, asset pipeline and runtime stack |
| §3 and §4 Asset Contract | Pass | Existing paths, units, Meshopt, clip names and budgets. Visual capture and asset checks apply to revised models |
| §5 Selective TDD | Pass | Red–Green–Refactor for core timing and motion. Contract checks for exports and playtesting for visual timing and gait |
| §6 Architecture | Pass | State machine and round own timing and outcomes. Rendering and audio consume state and events |

See [research decisions](./research.md#gameplay-feel-increment-2026-11-23) and the [runtime data model](./data-model.md#active-swing).

### 60-Second Countdown

FR-002 and SC-014 apply to initial rounds and replays in both modes. Use a shared `ROUND_DURATION_MS` of 60,000 in `src/core/types.ts`. Wire `src/core/timer.ts` and the initial HUD value in `src/ui/hud.ts` to that value. Continue to start the active clock on entry to play and emit countdown seconds through the existing events. The HUD's zero-padded format displays `01:00` at start and `00:00` at expiry. The warning still starts in the final ten seconds. See the [duration decision](./research.md#round-duration) and [timer event contract](./contracts/event-bus.md#game-flow-events).

Apply Constitution §5.1 with headless tests first. Update the elapsed-time, warning, pause and reset assertions in `tests/core/timer.test.ts`. Exercise `59,999 ms + 1 ms` and a single oversized tick to verify one expiry in both cases. Cover initial rounds, pause/resume, single results emission and replay in `tests/core/round.test.ts`. For the swing-contact work above, derive expiry cases from the configured duration so the contact-before-expiry and exact-tie rules are exercised at the new boundary.

Constitution §5.1 requires tests for the round duration in FR-002, pause/resume and a single game-over transition at zero. Use [V10](./quickstart.md#v10-60-second-countdown-sc-014) for the desktop and mobile acceptance run.

## Project Structure

### Documentation (this feature)

```text
specs/001-smash-em-all/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology decisions
├── data-model.md        # Phase 1 output — entities & state
├── quickstart.md        # Phase 1 output — validation guide
├── contracts/           # Phase 1 output — internal contracts
│   ├── event-bus.md     # Core ↔ Rendering/UI/Audio event contract
│   ├── asset-contract.md # GLB asset requirements (from constitution §3)
│   └── storage-schema.md # localStorage schema
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
smash-em-all/
├── index.html                    # Single HTML entry point
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
│           ├── sfx/              # Hit, miss, scurry, buzz, UI, combo, tick, gameover
│           └── music/            # normal-bgm.mp3, hell-bgm.mp3
├── src/
│   ├── main.ts                   # Entry point — wires layers together
│   ├── core/                     # Headless Core (TDD, ZERO Three.js imports)
│   │   ├── state-machine.ts      # MENU→LOADING→READY→PLAYING⇄PAUSED→GAME_OVER→MENU
│   │   ├── round.ts              # Active round, combat outcomes, lifecycle events
│   │   ├── scoring.ts            # Base points, combo-applied score calculation
│   │   ├── combo.ts              # Streak tracking, 2s window, multiplier
│   │   ├── timer.ts              # 60s countdown, pause/resume, real elapsed time
│   │   ├── hit-detection.ts      # Cone-sphere math, nearest hit, near-miss
│   │   ├── cockroach-ai.ts       # Waypoint selection, surface switching, Bézier flight
│   │   ├── object-pool.ts        # Generic pool: allocate, release, recycle
│   │   ├── achievement-tracker.ts # Condition eval, unlock, dedup, persistence interface
│   │   ├── ranking.ts            # Score→rank mapping (S/A/B/C) per mode
│   │   └── types.ts              # Shared types, enums, interfaces
│   ├── rendering/                # Three.js layer (NO tests)
│   │   ├── scene-manager.ts      # Scene, camera, renderer, lights, resize
│   │   ├── camera-controller.ts  # FPS camera, pitch/yaw, pointer lock
│   │   ├── weapon-viewmodel.ts   # Weapon display, swing animation, bob
│   │   ├── cockroach-renderer.ts # Instanced cockroach meshes, animation mixer
│   │   ├── vfx.ts                # Kill splat, screen shake, combo popup, crosshair
│   │   └── map-loader.ts         # GLB load, extract empties, collider setup
│   ├── input/                    # Input handling
│   │   ├── input-manager.ts      # Auto-detect touch/mouse, dispatch commands
│   │   ├── desktop-input.ts      # WASD + mouse + pointer lock + Esc
│   │   └── mobile-input.ts       # Virtual joystick + swipe + tap + orientation check
│   ├── audio/                    # Audio system
│   │   └── audio-manager.ts      # AudioContext, spatial panner, gain per category
│   ├── ui/                       # DOM UI
│   │   ├── hud.ts                # Timer, score, combo, kills, mode badge, crosshair
│   │   ├── start-screen.ts       # Map/mode/weapon selector, start button, settings
│   │   ├── game-over-screen.ts   # Score, rank stamp, stats, achievements, replay
│   │   ├── pause-overlay.ts      # Pause card, resume/quit buttons
│   │   ├── trophy-cabinet.ts     # Achievement grid
│   │   └── orientation-prompt.ts # "Rotate your device" prompt for portrait
│   ├── i18n/                     # Localization
│   │   ├── i18n.ts               # Locale loader, key lookup, fallback, switch
│   │   └── locales/
│   │       ├── vi.json
│   │       └── en.json
│   └── utils/                    # Shared pure utilities
│       ├── event-emitter.ts      # Typed pub/sub
│       └── math-utils.ts         # Vector helpers, clamp, lerp, Bézier
├── tests/                        # Vitest (core + asset contract ONLY)
│   ├── core/
│   │   ├── state-machine.test.ts
│   │   ├── round.test.ts
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
├── blender/                      # Blender source files
│   ├── kitchen.blend
│   ├── livingroom.blend
│   ├── bedroom.blend
│   ├── cockroach.blend
│   ├── weapons.blend
│   └── scripts/                  # Python recreation scripts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-11-20-smash-em-all-design.md
```

**Structure Decision**: Single project structure at repository root. No backend/frontend split needed — this is a client-side-only browser game. The `src/` tree follows the architecture layers defined in Constitution §6: `core/` (headless, testable), `rendering/` (Three.js, no tests), `input/`, `audio/`, `ui/` (DOM), `i18n/`. Tests mirror `src/core/` only.
