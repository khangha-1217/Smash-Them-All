# Research: Smash 'Em All

**Phase**: 0 — Outline & Research
**Date**: 2026-11-21
**Status**: Complete — all decisions resolved during brainstorming

> All technology choices were evaluated, compared, and finalized during the brainstorming and design document phase. No NEEDS CLARIFICATION items remain. This document records the resolved decisions for traceability.

## Decision 1: Web 3D Stack

**Decision**: Three.js + Vanilla TypeScript + Vite

**Rationale**: Full control over game loop and render timing. Lightest bundle (~150 KB gzipped). Largest community and ecosystem for browser 3D. No framework overhead (React reconciler) interfering with 60 fps real-time game loop. Vite provides fast HMR during development and efficient tree-shaking for production.

**Alternatives considered**:
- React Three Fiber — React reconciler overhead per frame, complex real-time state management, heavier bundle. Rejected.
- Babylon.js — ~500 KB+ bundle, overkill for this scope, smaller community. Rejected.

## Decision 2: Physics / Collision

**Decision**: Custom raycast cone + sphere collision (no physics engine)

**Rationale**: Game has no real physics simulation needs. Cockroaches follow AI waypoint paths (not physics forces). Weapon swings are scripted animations. Only need: (a) cone-sphere hit detection for weapon strikes, (b) AABB player-environment collision for movement boundaries. Both are simple to implement, zero dependency, easy to tune for game feel.

**Alternatives considered**:
- Rapier WASM — 200 KB WASM overhead, full rigid body physics not needed. Rejected.

## Decision 3: Asset Strategy

**Decision**: Full GLB models for all visual assets (3 maps, 1 cockroach, 3 weapons), compressed with Meshopt

**Rationale**: Three detailed stylized room environments are impractical to generate procedurally. Cockroach requires rigging and baked animations (crawl, fly). GLB is the standard glTF binary format, natively supported by Three.js. Meshopt compression chosen over Draco for smaller decoder size and faster decode on mobile.

**Alternatives considered**:
- Procedural geometry (code-generated rooms) — Thousands of LOC for inferior visuals, animation nearly impossible. Rejected.
- Draco compression — Larger WASM decoder (~100 KB), slower decode, slight quality loss on low-poly stylized models. Rejected.

## Decision 4: Cockroach AI Navigation

**Decision**: Waypoint/spline system with surface tags, Bézier flight paths

**Rationale**: Cockroaches move on multiple surface types (floor, counter, wall, ceiling). Waypoints embedded as empties in GLB map files encode surface type in their name and surface normal in their orientation. Cockroaches lerp between waypoints on the same surface, with probability-based surface transitions. Flight uses 3-point Bézier curves (start → elevated midpoint → camera target with jitter). Simple, controllable, good gameplay feel.

**Alternatives considered**:
- Navmesh (recastnavigation) — WASM overhead, complex for multi-surface (floor + counter + wall), overkill. Rejected.
- Random walk — No purposeful movement, boring gameplay. Rejected.

## Decision 5: Audio Strategy

**Decision**: Preloaded audio files (MP3/OGG) played via Web Audio API AudioContext

**Rationale**: Consistent quality, easy authoring, small file sizes (< 50 KB per SFX, < 500 KB per music track). Web Audio API provides spatial audio (PannerNode for 3D-positioned cockroach sounds), independent volume control per category (GainNode for SFX vs Music), and handles browser autoplay policy (resume on first user interaction). Audio sourced from royalty-free libraries (CC0/commercial-use).

**Alternatives considered**:
- Pure Web Audio synthesis — Difficult to achieve natural smack/scurry sounds, more code for worse results. Rejected.

## Decision 6: Hit Detection Approach

**Decision**: Cone-shaped raycast (25° half-angle, 3m range) from camera center on swing, checked against cockroach sphere hitboxes. Nearest hit wins. Near-miss at 1.8× hitbox radius.

**Rationale**: "Generous hit" design principle (Constitution §2.2). 25° cone is wide enough to feel satisfying without being too easy. Flying cockroach hitbox is 1.3× crawling hitbox to compensate for increased difficulty. Swing lockout of 300ms prevents spam and creates rhythmic gameplay.

## Decision 7: Mobile Input

**Decision**: Virtual joystick (left) + swipe-to-look (right half) + tap-to-swing. Landscape-only enforcement.

**Rationale**: Standard FPS touch control pattern. Landscape-only avoids designing and testing two responsive UI layouts and prevents the cramped portrait FPS experience. Portrait displays a "Rotate your device" prompt.

## Decision 8: Miss Definition

**Decision**: Every swing that does not hit a cockroach counts as a miss (including swinging at empty space). Misses reset combo, lower accuracy, and count against "Perfect Aim" achievement.

**Rationale**: Simple mental model for players ("hit = good, miss = bad"). Creates strategic pressure to aim carefully rather than spam swings. Synergizes with 300ms swing lockout to create deliberate, satisfying gameplay rhythm.
