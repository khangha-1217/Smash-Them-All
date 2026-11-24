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

**Decision**: Cone-shaped raycast (25° half-angle, 3m range) from camera center at the contact beat, checked against cockroach sphere hitboxes. Nearest hit wins. Near-miss at 1.8× hitbox radius.

**Rationale**: "Generous hit" design principle (Constitution §2.2). 25° cone is wide enough to feel satisfying without being too easy. Flying cockroach hitbox is 1.3× crawling hitbox to compensate for increased difficulty. Swing lockout of 300ms prevents spam and creates rhythmic gameplay.

## Decision 7: Mobile Input

**Decision**: Virtual joystick (left) + swipe-to-look (right half) + tap-to-swing. Landscape-only enforcement.

**Rationale**: Standard FPS touch control pattern. Landscape-only avoids designing and testing two responsive UI layouts and prevents the cramped portrait FPS experience. Portrait displays a "Rotate your device" prompt.

## Decision 8: Miss Definition

**Decision**: Every resolved swing that does not hit a cockroach counts as a miss, including an empty swing. Misses reset combo, lower accuracy, and count against "Perfect Aim" achievement. A swing canceled before contact contributes no outcome.

**Rationale**: Simple mental model for players ("hit = good, miss = bad"). Creates strategic pressure to aim carefully rather than spam swings. Synergizes with 300ms swing lockout to create deliberate, satisfying gameplay rhythm.

## Gameplay Feel Increment (2026-11-23)

### Shared Contact Timeline

**Decision** — Keep a pending contact on the round's active clock. Split an update at the contact deadline so the cockroach world is advanced through that instant before testing. Order newly processed aim changes on the same timeline. If a frame spans contact and expiry, compare the actual deadlines. Expiry wins a tie. Use the active swing timeline and a contact notification to synchronize the visible strike and feedback.

**Rationale** — The current input handler samples aim and the round resolves damage on press. The round timer uses full elapsed time, while the viewmodel advances with a delta capped at 50 ms. Resolving against the final state of a long frame can turn an eligible hit into a cancellation or use aim from after contact.

**Alternatives considered** — Starting a wall-clock timeout would require separate pause and expiry coordination. Resolving on animation completion would move gameplay authority into rendering. Polling for contact once at the end of each frame would use targets from the wrong time on long frames.

### Supported Scurry and Gait

**Decision** — Use short supported waypoint legs with an elapsed-time acceleration and braking profile. Retain heading through the turn hold and supply surface orientation, facing and speed to the existing renderer for an alternating tripod gait. Separate supported corner crossings at their seam and stay on the current surface if continuity cannot be established.

**Rationale** — The current AI selects a constant 0.5–1.2 m/s for each trip and snaps to the destination surface normal at arrival. The renderer infers heading from displacement and runs the crawl clip at a fixed rate. The loader assigns furniture support IDs only to upward-facing markers, so shared IDs or nearby waypoints alone cannot establish continuity at a corner. Supported legs and consistent gait timing improve pursuit without a new navigation system.

**Alternatives considered** — Animation-only changes would leave target motion unchanged. Per-foot collision or a new runtime navigation mesh would add CPU cost and authoring complexity for mostly planar surfaces.

### Weapon Scale and Hand

**Decision** — Calibrate projected body and slipper lengths using a repeatable Kitchen countertop view based on 0:06–0:08 of the workspace reference clip. Adjust per-weapon display mounts first. Tune visual cockroach scale as needed to preserve a large enough readable slipper, while retaining the 0.06 m ground and 0.078 m flight collision radii. Budget the new hand and slipper together and reuse the existing material and asset pipeline.

**Rationale** — The baseline slipper is about 26 cm long and is mounted near the camera at 0.47 m depth. The cockroach body is about 4 cm. World dimensions alone cannot yield the required on-screen ratio. The baseline exports are one primitive each and use 272 triangles for the cockroach, 682 for the slipper, 744 for the flyswatter, and 504 for the cardboard. This leaves 118 triangles for the hand with the existing slipper mesh, so simplify the slipper as needed within the 800-triangle combined cap.

**Alternatives considered** — Uniform scaling in world units ignores camera depth and pose. Separate hand and weapon assets add a load and another draw. Scaling collision with the art would change the accepted combat range or aim behavior.

### Round Duration

**Decision** — Use one shared 60,000 ms duration for the round timer and HUD initialization. Use the existing active-play clock and seconds-based event payloads. Keep the warning threshold at ten seconds remaining.

**Rationale** — `src/core/timer.ts` currently supplies the starting and reset duration. `src/ui/hud.ts` also supplies a literal when resetting the display. A shared value keeps start, replay and the first HUD frame in agreement across both modes.

**Alternatives considered** — Editing two independent literals leaves room for the display and timer to drift. Letting the HUD own the timer would tie expiry to presentation.
