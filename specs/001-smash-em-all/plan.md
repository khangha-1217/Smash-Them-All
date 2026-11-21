# Implementation Plan: Smash 'Em All

**Branch**: `001-smash-em-all` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-smash-em-all/spec.md`

## Summary

A browser-based 3D first-person arcade game where the player wields a slipper (or alternative cosmetic weapon) to smash cockroaches in domestic rooms within a 90-second time limit. Two game modes (Normal and Hell/flying cockroaches), three maps (kitchen, living room, bedroom), three weapons (cosmetic only), combo scoring system, humorous achievement badges, bilingual UI (Vietnamese/English). Built with Three.js + Vanilla TypeScript + Vite. All state in localStorage. No server backend. Ad-ready DOM overlay architecture.

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
│   │   ├── timer.ts              # 90s countdown, pause/resume, real elapsed time
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
