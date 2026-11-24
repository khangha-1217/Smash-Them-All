# Tasks — Smash 'Em All

**Input** — [Specification](spec.md), [implementation plan](plan.md), [data model](data-model.md), [research](research.md), [asset contract](contracts/asset-contract.md), [event contract](contracts/event-bus.md), [storage schema](contracts/storage-schema.md), [quickstart](quickstart.md) [detailed design](../../docs/superpowers/specs/2026-11-20-smash-em-all-design.md) and [constitution](../../.specify/memory/constitution.md).

**Execution** — Each checkbox lists its direct prerequisites. Follow those task IDs across phases. `[P]` marks work that can run alongside the matching tasks in the parallel examples once their prerequisites pass. Paths are relative to the repository root.

**Tests** — Write the red cases before implementing the covered behavior. Run focused cases while each core module or asset is in progress, then run the full suite at the release checkpoint. The automated scope is Constitution §5.1. Use the story checks and quickstart for WebGL, UI, audio and input behavior.

**Shared asset contract** — For each model task, use Blender MCP and verify scale, materials, clips and empties from at least two viewport angles before exporting. Keep Y-up, meter units, baked map lighting, textures ≤1024×1024 and descriptive mesh names. Export Meshopt GLB and save the source and recreation script. Each room needs ≥8 `spawn_<surface>_<nn>`, ≥15 `waypoint_<surface>_<nn>` and exactly one `player_start` with eligible tags and local Z surface normals. Per-file caps are 30,000 triangles / 2 MB for maps, 1,500 / 100 KB for the cockroach and 800 / 50 KB for each weapon. The asset test task for each batch defines the red cases before modeling begins.

**Design reconciliation** — Use the current spec and detailed hit-detection contract for landscape-only play and 1.8× near-miss detection. Use a 0.06m crawling radius and compute the flying radius as 1.3× crawling (0.078m). Keep the design's Quit action from pause. A 2s combo uses the data model's inclusive boundary.

## Phase 1 — Setup

**Goal** — Establish the browser entry point and the development, production build and selective test commands.

- [X] T001 [P] Initialize Node 18+ and pnpm in `package.json` with ESM, Three.js r170+, matching `@types/three` typings, TypeScript 5.x, Vite 5.x, Vitest and its coverage provider. Add dev, build and test scripts and generate `pnpm-lock.yaml`.
- [X] T002 [P] Configure strict TypeScript, ES modules and bundler resolution in `tsconfig.json`.
- [X] T003 Configure Vite and Vitest in `vite.config.ts` for the single browser entry and Node-based core/asset suites. Enable branch reporting for the covered core modules. After T001.
- [X] T004 [P] Create `index.html` with `#game` canvas, `#ui` overlay and hidden `#ad-slot-top` / `#ad-slot-bottom` containers above the canvas.
- [X] T005 Create the bootstrap in `src/main.ts` and reference it as the Vite module entry in `index.html`. Verify `pnpm dev` serves the shell and `pnpm build` succeeds. After T004, T002, T003.

## Phase 2 — Foundational contracts

**Goal** — Define shared interfaces and cross-layer primitives before gameplay work.

- [X] T006 Define `Vec3`, round configuration, `GameState`, round data/result, combo, cockroach, weapon, achievement, profile, hit result and map metadata in `src/core/types.ts` using [data-model.md](data-model.md). Use the field constraints listed directly below. After T005.
  - Round and combo — `mapId` is `'kitchen' | 'livingroom' | 'bedroom'`, `mode` is `'normal' | 'hell'`, `weaponId` is `'slipper' | 'flyswatter' | 'cardboard'` and `rank` is `'S' | 'A' | 'B' | 'C' | null`. Use “Countdown from 90.0, based on real elapsed time”, `number (integer)` for score/counts, `hits / swings` (0 if no swings) and `swings - hits`. Use `number (integer, ≥ 1)`, `number (ms timestamp)` and `number (constant: 2000)` for the combo fields.
  - Cockroach — `state` is `'idle' | 'crawling' | 'preflight' | 'flying'`. `targetWaypoint` is `{x, y, z} | null` and `flightCurve` is `BezierCurve | null`. Use “Movement speed (0.5–1.2 for crawl)”, “0.06 crawling. Flying is 1.3× the crawling radius (0.078m).” and `number (0–1)` for flight progress.
  - Weapon — `swingStartTime` is `number | null` and `swingDurationMs` is `number (constant: 300)`. “No new swing accepted while `isSwinging && (now - swingStartTime < swingDurationMs)`.”
  - Achievement and profile — “`id` is unique across all achievements. Once unlocked, stays unlocked forever (until localStorage cleared). Duplicate unlock attempts are no-ops.” Use `Record<string, boolean>` for unlocks, `Record<string, number>` keyed by `${mapId}_${mode}` for best scores, `string[]` for played map/weapon IDs and `'vi' | 'en'` for language.
  - Hit and map — `type` is `'hit' | 'near_miss' | 'miss'`. `target` is `Cockroach | null` with “Hit cockroach (null if miss/near-miss)” and points are “Points awarded (0 if miss)”. `nearMiss` is `{cockroachId, position, distance} | null` and carries the qualifying cockroach and ray clearance on a near-miss. Carry `Array<{position, surfaceType, surfaceNormal}>` for spawns/waypoints, `{position, rotation}` for player start, `Array<{min, max}>` for colliders and `{min, max}` for room bounds.
- [X] T007 [P] Implement typed pub/sub in `src/utils/event-emitter.ts` using [the event contract](contracts/event-bus.md). Keep the Core independent of Three.js, DOM and Web Audio. Events notify other layers and input calls commands directly. After T006.
- [X] T008 [P] Add pure vector, clamp, lerp and quadratic Bézier helpers in `src/utils/math-utils.ts`. After T006.
- [X] T009 [P] Add `src/utils/storage.ts` for [the storage contract](contracts/storage-schema.md). Use the exact JSON keys and defaults, validate stored values on read and keep an in-memory profile for the current session when access, parsing or writes fail. After T006.

## Phase 3 — US1 · Quick Stress-Relief Round (P1, MVP)

**Goal** — Deliver a complete Normal round on desktop with Kitchen and Slipper.

**Independent test** — Run V1 with Kitchen/Normal/Slipper. Verify live preview, loading, a 90-second round, hit/miss feedback, combo and stats, a frozen round on pause or tab blur, and clean replay with the same selections.

- [X] T010 [P] [US1] Write red tests in `tests/core/state-machine.test.ts` for the data-model transitions, silent invalid transitions, replay, `PAUSED → MENU` on Quit to Menu and `LOADING → MENU` on load failure. After T007, T008, T009.
- [X] T011 [US1] Implement authoritative flow and `STATE_CHANGED` publication in `src/core/state-machine.ts`. Accept `PAUSED → MENU` on Quit to Menu and `LOADING → MENU` on load failure, with completed results reserved for timer expiry. After T010.
- [X] T012 [P] [US1] Write red tests in `tests/core/timer.test.ts` for real elapsed time under slow frames, pause/resume, final 10 seconds, zero clamp and one expiry callback. After T007, T008, T009.
- [X] T013 [US1] Implement the 90-second timer and `TIMER_TICK` / `TIMER_WARNING` in `src/core/timer.ts`. After T012.
- [X] T014 [P] [US1] Write red tests in `tests/core/scoring.test.ts` for crawling/flying base points (100/250), multiplier, totals and reset. After T007, T008, T009.
- [X] T015 [US1] Implement scoring, total/flying kills and score/kill events in `src/core/scoring.ts`. After T014.
- [X] T016 [P] [US1] Write red tests in `tests/core/combo.test.ts` for x1 on first hit, consecutive hits including exactly 2000ms, later reset, miss reset and max combo. After T007, T008, T009.
- [X] T017 [US1] Implement combo using active round time and `COMBO_UPDATED` / `COMBO_RESET` in `src/core/combo.ts`. After T016.
- [X] T018 [P] [US1] Write red tests in `tests/core/hit-detection.test.ts` for nearest living target, 25° half-angle, 3m range, a 0.06m crawling radius, a 1.3× flying radius (0.078m, using float tolerance), the 1.8× near-miss boundary for each radius, near-miss ID/world position/ray distance and empty swings. After T007, T008, T009.
- [X] T019 [US1] Implement pure cone/sphere detection in `src/core/hit-detection.ts` with hit priority over near-miss. Return the nearest qualifying cockroach's ID, world position and distance from the aim ray in `HitResult.nearMiss` for near-misses. Keep weapon ID out of gameplay calculations. After T018.
- [X] T020 [P] [US1] Write red tests in `tests/core/object-pool.test.ts` for allocation, release, reuse, exhaustion, active set and full reset. After T007, T008, T009.
- [X] T021 [US1] Implement reusable pool and graceful exhaustion in `src/core/object-pool.ts`. After T020.
- [X] T022 [P] [US1] Write red tests in `tests/core/ranking.test.ts` for S/A/B edges (Normal 8000/5000/3000, Hell 12000/8000/5000), C and next-rank points including rank S. After T007, T008, T009.
- [X] T023 [US1] Implement mode-specific rank and next-rank hint data in `src/core/ranking.ts`. After T022.
- [X] T024 [P] [US1] Write red deterministic tests in `tests/core/cockroach-ai.test.ts` for waypoint selection, adjacent-surface transitions, idle and crawl lifecycle, empty candidates and spawn reset. After T007, T008, T009.
- [X] T025 [US1] Implement pooled ground behavior in `src/core/cockroach-ai.ts` with tagged spawn points, same-surface waypoints, adjacent surfaces around 10%, idle 0.3–1s and crawl 0.5–1.2m/s. After T024.
- [X] T026 [P] [US1] Write red round tests in `tests/core/round.test.ts` for accepted swings, the 300ms no-queue lockout, hit/near-miss/empty outcomes, pause preservation, zero-swing accuracy, no-input rank C, recycling and replay reset. Check `WEAPON_SWING` once per accepted swing and exactly one outcome event. Check that near-misses additionally emit `COCKROACH_NEAR_MISS` with its target data. Verify single `ROUND_STARTED` and `ROUND_ENDED` emissions on normal completion and absence of `ROUND_ENDED` after quit or load failure. After T007, T008, T009.
- [X] T027 [US1] Implement swing dispatch and round counters in `src/core/round.ts`. Publish `WEAPON_SWING` once per accepted swing. On hit, update the combo, award points, and publish one `COCKROACH_HIT`. On each failed swing, publish one `WEAPON_MISS` and reset the combo, with an additional `COCKROACH_NEAR_MISS` from `HitResult.nearMiss` where applicable. Guard against counting a recycled target twice. After T026, T011, T015, T017, T019.
- [X] T028 [US1] Complete round lifecycle in `src/core/round.ts`. Start only when ready, preallocate a tunable Normal pool (15–25), spawn and recycle cockroaches promptly, freeze all active clocks (timer, combo, AI, respawn and swing), emit spawn/move/despawn events and publish `ROUND_STARTED` once when play begins. Publish `ROUND_ENDED` once with the finalized result on timer expiry. Release round resources on Quit to Menu or failed load and reserve completion events and profile updates for a finished round. After T027, T013, T021, T025, T023.
- [X] T029 [P] [US1] Write red asset-contract cases in `tests/assets/asset-contract.test.ts` for Kitchen, cockroach and Slipper. Cover existence, budgets, clips, named meshes, Meshopt, textures and map empty patterns, tags and counts using the shared asset contract below. After T007, T008, T009.
- [X] T030 [P] [US1] Model the retro kitchen (island, cabinets, sink and appliances), place tagged floor/counter/sink/wall spawns and waypoints, and export `public/assets/models/maps/kitchen.glb`. Use the room allocation in [plan.md](plan.md#technical-context) as an authoring target. Save `blender/kitchen.blend` and `blender/scripts/kitchen.py`. After T029.
- [X] T031 [P] [US1] Model and rig the stylized 0.04m cockroach with visible wings, antennae and `idle`, `crawl`, `fly` NLA clips. Use the visible-cockroach allocation in [plan.md](plan.md#technical-context) as an authoring target. Export `public/assets/models/cockroach.glb` and save `blender/cockroach.blend` and `blender/scripts/cockroach.py`. After T029.
- [X] T032 [P] [US1] Model the rubber slipper at its grip origin with `idle` and `swing` NLA clips and export `public/assets/models/weapons/slipper.glb`. Save `blender/weapons/slipper.blend` and `blender/scripts/slipper.py`. After T029.
- [X] T033 [US1] Add red checks for the two swing audio files in `tests/assets/asset-contract.test.ts` per the [asset contract](contracts/asset-contract.md). After T029.
- [X] T034 [P] [US1] Source or create licensed swing cues at `public/assets/audio/sfx/hit.mp3` and `public/assets/audio/sfx/miss.mp3` (mono, 44.1kHz, <50 KB each). After T033.
- [X] T035 [P] [US1] In `src/audio/audio-manager.ts`, initialize Web Audio on the first interaction and play one smack from `COCKROACH_HIT` or one whoosh from `WEAPON_MISS`, including both near-misses and empty misses. `WEAPON_SWING` is the rendering trigger. Keep buffers and browser audio behind the audio layer. After T007, T008, T009.
- [X] T036 [P] [US1] Initialize and resize the Three.js camera and renderer in `src/rendering/scene-manager.ts`, with baked map lighting, subtle character/viewmodel shading and no real-time shadows. After T007, T008, T009.
- [X] T037 [P] [US1] Implement Meshopt GLB loading and progress in `src/rendering/map-loader.ts`. Extract map metadata as world transforms, including local Z surface normals, and room/furniture AABBs. Load only the selected room and expose its scene and metadata to the composition root. After T036.
- [X] T038 [US1] Implement player pose and FPS camera in `src/rendering/camera-controller.ts` with ±80° pitch and movement relative to the camera at 1.6m eye height. Use a ~0.3m player radius and slide along wall and furniture AABBs. After T037.
- [X] T039 [P] [US1] Implement `src/rendering/weapon-viewmodel.ts` with a lower-right separate pass, movement bob and accepted `WEAPON_SWING` animation. Keep the lockout in the Core. After T036, T007.
- [X] T040 [P] [US1] Implement `src/rendering/cockroach-renderer.ts` with pooled visual instances, idle/crawl clips and interpolated surface-normal alignment. Update poses from Core state and spawn/move/despawn events. After T036, T007.
- [X] T041 [P] [US1] Implement sprite splats, brief screen shake, hit/near-miss crosshair feedback and point/combo popups in `src/rendering/vfx.ts`. After T036, T007.
- [X] T042 [P] [US1] Implement WASD, mouse look, left click and Escape in `src/input/desktop-input.ts`. Acquire Pointer Lock from user activation and release it on pause or exit. After T007, T008, T009.
- [X] T043 [P] [US1] Route desktop commands through `src/input/input-manager.ts` and clear held input when disabled. Provide the command interface reused by mobile. After T042.
- [X] T044 [P] [US1] Create the start card and ready/loading progress UI in `src/ui/start-screen.ts` with Kitchen, Normal and Slipper available for this increment. After T007, T008, T009.
- [X] T045 [P] [US1] Create the mode badge, timer, score, combo, kill counter, reticle and desktop control hints in `src/ui/hud.ts`. Clear combo on `COMBO_RESET`. After T007, T008, T009.
- [X] T046 [P] [US1] Create the resume/quit card in `src/ui/pause-overlay.ts` and issue commands through the state-machine integration. After T007, T008, T009.
- [X] T047 [P] [US1] Create game-over UI in `src/ui/game-over-screen.ts` with animated score/rank, stats, previous/new personal best, next-rank hint, replay and menu actions. After T023, T009.
- [X] T048 [US1] Wire loading, ready, the live Kitchen preview, input commands, render/update loop and event subscribers in `src/main.ts`. Save personal best by map/mode through the profile adapter. On failed load, release the pending assets, preserve the selected configuration and allow Start to retry. Only completed rounds update personal bests. Pause on visibility loss or blur, release input, reset round-scoped effects on replay, and show results only after the completed round. Verify returning to menu from pause or after a failed load leaves the profile unchanged. Run V1 and the draw-call/triangle check in [quickstart.md](quickstart.md#frame-budget-check-p1-and-release) for Kitchen/Normal before closing US1. After T028, T030, T031, T032, T034, T035, T038, T039, T040, T041, T043, T044, T045, T046, T047.

## Phase 4 — US2 · Hell Mode (P1)

**Goal** — Add denser spawns, warning, flight and bonus scoring.

**Independent test** — Run V2 in Kitchen. Confirm the 1.5s warning, accelerating flight, 250 base points, higher rank thresholds and contact recycling without damage.

- [X] T049 [P] [US2] Extend `tests/core/cockroach-ai.test.ts` with red cases for Hell-only scheduling at 3–8s, 1.5s preflight, accelerating Bézier motion, jitter and curve completion. After T048.
- [X] T050 [P] [US2] Extend `tests/core/round.test.ts` with red cases for higher Hell density, the 1.3× radius (0.078m) when a cockroach enters `FLYING`, 250 base points, preflight/flight events and recycling on contact without a kill or damage. After T048.
- [X] T051 [US2] Implement preflight and flight behavior in `src/core/cockroach-ai.ts` using the elevated midpoint and jittered camera target. After T049.
- [X] T052 [US2] Extend `src/core/round.ts` with Hell spawn density (tunable pool of 25–40), `COCKROACH_PREFLIGHT` / `COCKROACH_FLYING`, the 1.3× hitbox radius for the `FLYING` state and `reached_player` despawn/recycling. After T051, T050.
- [X] T053 [P] [US2] Play wing/flight clips from Core state in `src/rendering/cockroach-renderer.ts` while consuming the position calculated by the Core. After T048.
- [X] T054 [P] [US2] Add the pink Hell badge and preflight warning to `src/ui/hud.ts`. After T048.
- [X] T055 [US2] Enable Normal/Hell selection in `src/ui/start-screen.ts` and pass the chosen mode through the existing round config. Run V2 and the draw-call/triangle check in [quickstart.md](quickstart.md#frame-budget-check-p1-and-release) for Kitchen/Hell before closing US2. After T052, T053, T054.

## Phase 5 — US3 · Exploring Different Rooms (P2)

**Goal** — Add Living Room and Bedroom with their own spawns, paths and boundaries.

**Independent test** — Run V3 in all three maps. Check distinct furniture and spawn positions, smooth collision, correct preview on map switches and a single selected map on a clean load.

- [X] T056 [US3] Add red asset-contract cases for Living Room and Bedroom in `tests/assets/asset-contract.test.ts` using the same map rules as Kitchen. After T048.
- [X] T057 [P] [US3] Model the cozy living room (sofa, table, shelf, rug and lamps), tag spawns and waypoints, and export `public/assets/models/maps/livingroom.glb`. Save `blender/livingroom.blend` and `blender/scripts/livingroom.py`. After T056.
- [X] T058 [P] [US3] Model the cozy bedroom (bed, nightstand, desk and wardrobe), tag spawns and waypoints, and export `public/assets/models/maps/bedroom.glb`. Save `blender/bedroom.blend` and `blender/scripts/bedroom.py`. After T056.
- [X] T059 [US3] Register the three room URLs in `src/rendering/map-loader.ts` and verify metadata and room/furniture collider extraction for each. After T057, T058.
- [X] T060 [US3] Enable three map cards from the start in `src/ui/start-screen.ts` with a selected state and map names. After T055, T059.
- [X] T061 [US3] Update `src/main.ts` so map changes update the slow-panning preview with latest-selection wins, dispose unused rooms, and reuse the selected preview scene at round start when ready. After T060.

## Phase 6 — US4 · Choosing Weapons (P2)

**Goal** — Add Flyswatter and Cardboard with distinct rendering and shared gameplay.

**Independent test** — Run V4 with all weapons. Compare bottom-right appearance, bob and swings, then verify equivalent range, cone, lockout and scoring.

- [X] T062 [US4] Add red contract cases for Flyswatter and Cardboard in `tests/assets/asset-contract.test.ts` using the same budgets and clips as Slipper. After T056.
- [X] T063 [P] [US4] Model the Flyswatter with distinct `idle` and `swing` clips and export `public/assets/models/weapons/flyswatter.glb`. Save `blender/weapons/flyswatter.blend` and `blender/scripts/flyswatter.py`. After T062.
- [X] T064 [P] [US4] Model the Cardboard with distinct `idle` and `swing` clips and export `public/assets/models/weapons/cardboard.glb`. Save `blender/weapons/cardboard.blend` and `blender/scripts/cardboard.py`. After T062.
- [X] T065 [US4] Preload and select the proper GLB by `weaponId` in `src/rendering/weapon-viewmodel.ts`. Preserve the Core rules shared by all weapons. After T063, T064.
- [X] T066 [US4] Display and enable three weapon icons in `src/ui/start-screen.ts` and pass the chosen weapon ID to the existing viewmodel flow. After T060, T065.

## Phase 7 — US5 · Mobile Touch Controls (P2)

**Goal** — Add automatic touch controls and enforce landscape.

**Independent test** — Run V5 on a phone. Verify joystick, swipe, tap, no start in portrait and automatic resumption after rotation with the same timer, score and spawns. Also verify rotation preserves an existing manual or focus-loss pause.

- [X] T067 [P] [US5] Implement a left virtual joystick, right-side swipe and outside-joystick tap in `src/input/mobile-input.ts`. Handle simultaneous touch and cancellation, and prevent drags from also triggering swings. After T048.
- [X] T068 [P] [US5] Expose portrait status and a blocking, bilingual-ready rotate prompt in `src/ui/orientation-prompt.ts`. After T048.
- [X] T069 [US5] Detect actual first input (touch vs mouse/keyboard) in `src/input/input-manager.ts` and activate only the matching handler. First input chooses the controls independently of device orientation. Request mobile fullscreen when supported without blocking gameplay if denied. After T067.
- [X] T070 [P] [US5] Adapt safe areas, controls and pause button for touch in `src/ui/hud.ts`. Suppress desktop hints on touch. After T054, T069.
- [X] T071 [P] [US5] Use a full-width bottom sheet with touch-sized selectors in `src/ui/start-screen.ts`. After T066, T069.
- [X] T072 [US5] In `src/main.ts`, check mobile-device orientation on Start and Play Again and again before `READY → PLAYING`, independently of the active input handler. In mobile portrait, show the rotate prompt and block gameplay, including when rotation occurs during loading. Pause mid-round via the state machine and only auto-resume a rotation-owned pause when visible and landscape. Preserve manual and focus-loss pause. After T061, T069, T068, T070, T071.

## Phase 8 — US6 · Earning Funny Achievements (P3)

**Goal** — Evaluate all ten badges, display unlocks and preserve them between sessions.

**Independent test** — Run V6 with fewer than three kills and with ten near-misses in one round. Check first unlock, no duplicates, trophy hints, refresh persistence and reset by clearing browser data. Verify all other conditions through core tests.

- [X] T073 [US6] Write red cases in `tests/core/achievement-tracker.test.ts` for all ten conditions in [spec.md](spec.md#achievements), including a near-miss unlock at 10 in one round, no unlock at 9 or at 10 spread across rounds, and the separate condition of 0 misses with ≥15 kills. Test idempotence and persistence via an injected storage double. After T048.
- [X] T074 [US6] Implement the ten unique IDs, bilingual names/flavor and condition evaluation in `src/core/achievement-tracker.ts`. Use a persistence interface and emit `ACHIEVEMENT_UNLOCKED` only for new IDs. After T073.
- [X] T075 [P] [US6] Build the ten-card trophy grid in `src/ui/trophy-cabinet.ts` with locked hints, colored unlocked cards and profile-backed refresh. After T074.
- [X] T076 [P] [US6] Render newly unlocked cards in `src/ui/game-over-screen.ts` using the completed-round result. After T074, T047.
- [X] T077 [US6] Add the trophy cabinet entry point in `src/ui/start-screen.ts`. After T075, T071.
- [X] T078 [US6] Update `src/main.ts` to increment completed rounds once, add the selected map/weapon IDs to the profile, then evaluate and persist unlocks before showing results. Preserve in-session behavior when storage is unavailable. Run the single-round V6 scenario in [quickstart.md](quickstart.md#v6-achievements-us6--p3) before closing US6. After T072, T052, T066, T076, T077.

## Phase 9 — US7 · Bilingual Experience (P3)

**Goal** — Switch all visible text instantly and remember the selected language.

**Independent test** — Run V7 in both languages. Verify every screen, feedback/rotation alert, badge/hint and dynamic value, and reopen the game to verify persistence.

- [X] T079 [US7] Write red tests for locale lookup, fallback, interpolation, key parity, switching and persistence in `tests/core/i18n.test.ts` per Constitution §5.1. After T048.
- [X] T080 [P] [US7] Create `src/i18n/locales/vi.json` with all menu, HUD, audio-control, alert, trophy, rank and result strings and interpolated values. After T079.
- [X] T081 [P] [US7] Create `src/i18n/locales/en.json` covering the same keys and placeholders as Vietnamese. After T079.
- [X] T082 [US7] Implement `t()`, synchronous switch, fallback to Vietnamese then key, persistence through the profile adapter and `LANGUAGE_CHANGED` in `src/i18n/i18n.ts`. After T080, T081.
- [X] T083 [P] [US7] Replace visible strings and accessible names in `src/ui/start-screen.ts`, `src/ui/hud.ts` and `src/ui/game-over-screen.ts` with locale keys. Add the menu toggle and refresh on `LANGUAGE_CHANGED` without resetting state. After T082, T077, T076, T072.
- [X] T084 [P] [US7] Localize and re-render `src/ui/pause-overlay.ts`, `src/ui/trophy-cabinet.ts` and `src/ui/orientation-prompt.ts` on `LANGUAGE_CHANGED`. After T082, T075, T076, T072.
- [X] T085 [P] [US7] Localize point/combo overlays in `src/rendering/vfx.ts`. After T082, T041.

## Phase 10 — US8 · Sound Control and Audio Feedback (P3)

**Goal** — Add positional SFX, mode music and persistent master mute.

**Independent test** — Run V8 in both modes. Hear immediate swing feedback, proximity/direction, combo and last-10s cues; mute during play, reopen muted, then enable sound again.

- [X] T086 [US8] Add red checks in `tests/assets/asset-contract.test.ts` for the remaining audio inventory, paths and size budgets. After T062, T033.
- [X] T087 [P] [US8] Source commercial-use or CC0 cues at `public/assets/audio/sfx/scurry.mp3`, `public/assets/audio/sfx/buzz.mp3`, `public/assets/audio/sfx/ui-click.mp3`, `public/assets/audio/sfx/combo-chime.mp3`, `public/assets/audio/sfx/timer-tick.mp3` and `public/assets/audio/sfx/gameover.mp3`. Keep mono, 44.1kHz and <50 KB per file. After T086.
- [X] T088 [P] [US8] Source commercial-use or CC0 loopable music at `public/assets/audio/music/normal-bgm.mp3` and `public/assets/audio/music/hell-bgm.mp3`. Keep stereo, 44.1kHz and <500 KB per file. After T086.
- [X] T089 [US8] Extend `src/audio/audio-manager.ts` to preload/decode sounds, switch mode music and manage category gains and immediate master mute. Initialize from `smash_em_all_sound` and persist changes via the storage adapter. After T035, T087, T088.
- [X] T090 [US8] Track listener pose and use bounded PannerNode sources for scurry/buzz in `src/audio/audio-manager.ts`. Update positions without starting new sources on every movement event and release sources on despawn, pause or round exit. After T089, T052.
- [X] T091 [P] [US8] In `src/main.ts` connect player pose, cockroach lifecycle, UI click, x5/x10 chimes, final-10s ticking, round jingle and mode music. Reset sources across pause, quit and replay. Apply `SOUND_TOGGLED` immediately and retain T035's single outcome cue per accepted swing. After T090, T078.
- [X] T092 [P] [US8] Add localized mute controls to `src/ui/start-screen.ts` and `src/ui/hud.ts`. Initialize from the stored preference and keep both controls synchronized via `SOUND_TOGGLED`. After T089, T083.

## Phase 11 — Polish and release validation

**Goal** — Verify the integrated experience, performance budgets and ad-ready layout.

- [X] T093 Finish the neo-comic theme, safe areas and responsive overlays in `src/ui/styles.css` and include it from `index.html`. After T084, T085, T083, T092, T091.
- [X] T094 Add the end-of-round visual transition and confetti in `src/ui/game-over-screen.ts`. Keep the 90-second simulation clock independent of presentation. After T093.
- [X] T095 Verify the DOM ad containers in `index.html` and their overlay rules in `src/ui/styles.css`. Keep them hidden by default and usable at menu or post-round breaks. After T093.
- [X] T096 Run `pnpm build` and profile `src/rendering/scene-manager.ts` and `src/rendering/cockroach-renderer.ts` in the production build. Tune culling, pooling and rendering as needed for <50 draw calls and <35,000 rendered triangles per frame across all render passes. Repeat the P1 frame-budget checks in the production build for all three rooms in both modes. After T094, T095.
- [X] T097 Align `specs/001-smash-em-all/quickstart.md` with the implementation. Keep pre-release variants for the US1 checkpoint. V2 measures the 1.5s warning after the 3–8s trigger range. After T055, T060, T066, T072, T078, T083, T084, T085, T091, T092.
- [ ] T098 Run core and asset suites and check 100% branch coverage for TDD Core modules. Run V1–V8 and edge cases in `specs/001-smash-em-all/quickstart.md` on Chrome, Firefox, Safari and Edge desktop plus iOS Safari and Android Chrome, including unavailable storage, slow frames and replay after switching selections. Run the documented SC-006 response measurements on desktop and a mid-range phone for hits, near-misses and empty misses. After T096, T097.
- [ ] T099 Use `specs/001-smash-em-all/quickstart.md` to measure a cold selected-map load under 4 MB, JS under 200 KB gzipped, 60 fps desktop and ≥55 fps on a mid-range mobile phone in gameplay. After T096, T097, T098.
- [ ] T100 Record the results of first-visit timing, one-press Start on a return visit, no-tutorial comprehension, first-session replay count and natural achievement reachability against SC-001, SC-004, SC-005 and SC-007 in `specs/001-smash-em-all/quickstart.md`. Use browser-local round counts and direct observation. After T098, T099.

## Dependencies and execution order

| Increment | Completion dependencies | Integration checkpoint |
|---|---|---|
| Setup | Start here | T005 |
| Foundation | Setup | T007–T009 |
| US1 | Foundation | T048 |
| US2 | US1 | T055 |
| US3 | US1 and the US2 mode-selector edit T055 before the map-selector edit | T061 |
| US4 | Asset-test edit T056 and map-selector edit T060 from US3 | T066 |
| US5 | US1 for input work. HUD, menu and round wiring wait for T054, T061 and T066 | T072 |
| US6 | US1 for tracker work. Integration waits for T052, T066 and T072 | T078 |
| US7 | US1 for locale work. Full screen wiring waits for US5 and US6 UI tasks | T083–T085 |
| US8 | Asset cases can start after T062. Event wiring waits for T078 and the controls wait for T083 | T091–T092 |
| Release | All story checkpoints via T093 and T097 | T100 |

## Parallel examples

| Phase | Tasks that can run together once ready |
|---|---|
| Setup | T001, T002 and T004 |
| Foundation | T007, T008 and T009 |
| US1 | T010, T012, T014, T016, T018, T020, T022, T024 and T026 for Core red cases. T030–T032 and T034 for separate MVP assets. T035, T036, T042 and T044–T046 can proceed alongside the initial Core cases. T037, T039–T041, T043 and T047 for separate modules once each prerequisite passes. |
| US2 | T049, T050, T053 and T054 after T048 |
| US3 | T057 and T058 after T056 |
| US4 | T063 and T064 after T062 |
| US5 | T067 and T068 after T048. T070 and T071 when their respective prerequisites pass. |
| US6 | T075 and T076 after T074 and the existing results UI |
| US7 | T080 and T081 after T079. T083–T085 when their respective UI prerequisites pass. |
| US8 | T087 and T088 after T086. T091 and T092 when their respective prerequisites pass. |

## Implementation strategy

1. Deliver US1 first with Kitchen, Slipper, Normal mode and desktop controls. Run V1 at T048, including swing audio, pause/resume and replay.
2. Add Hell Mode for the second P1 increment. Build the other rooms, cosmetics and touch support along the listed dependencies.
3. Add achievements, complete bilingual UI and remaining audio. Run the V1–V8 release checks after all increments land.

## Requirements coverage

| Requirements | Tasks |
|---|---|
| FR-001, FR-014, FR-015, FR-022, FR-023 | T037–T039, T044, T048, T055–T066 |
| FR-002–FR-008, FR-016, FR-017 | T012–T028, T034–T035, T041, T048–T055 |
| FR-009–FR-013, FR-025 | T042–T048, T054, T067–T072, T076 |
| FR-018–FR-021, FR-024 | T009, T048, T073–T092 |
| SC-001–SC-010 | T095–T100 and story checks V1–V8 |

## 2026-11-23 Gameplay and Countdown Update

Use the existing setup and foundation phases. This update implements only the changes in the [increment plan](plan.md#gameplay-feel-increment-2026-11-23) and the [60-second countdown](plan.md#60-second-countdown). Apply Red → Green → Refactor to headless changes and validate revised exports with the asset contract suite. In the new tasks, validate visuals with V9 and the countdown with V10. Use the updated build when running T098–T100 against acceptance criteria that depend on this increment.

### Phase 12 · US1 Quick Stress-Relief Round (P1)

**Goal** — Start each round at 01:00, make the crawl feel like a scurry, and resolve swings against live aim at contact.

**Independent test** — Run Kitchen/Normal/Slipper. Start at 01:00, watch a roach accelerate, slow and turn on a supported surface, then adjust aim during the windup to land a hit. Check the clock, pending swing and counters through pause and replay using V9 and V10 in `specs/001-smash-em-all/quickstart.md`.

- [X] T101 [P] [US1] Write failing tests in `tests/core/timer.test.ts` for the initial and reset values at 60 seconds, the final-ten-seconds warning, elapsed time across pause, expiry at 59,999 ms + 1 ms, and clamping at zero with one expiry on an oversized tick.
- [X] T102 [P] [US1] Write failing tests in `tests/core/round.test.ts` for a 60-second initial round and replay in Normal and Hell, including a paused tick that consumes no play time and one `ROUND_ENDED` notification at expiry.
- [X] T103 [US1] Define the shared `ROUND_DURATION_MS = 60_000` in `src/core/types.ts` and use it in `src/core/timer.ts` and the initial HUD value in `src/ui/hud.ts`. Preserve the zero tick before results and the last-ten-seconds warning. Run both headless suites from T101 and T102. After T101, T102.
- [X] T104 [US1] Write failing contact cases in `tests/core/round.test.ts` for aim changes and moving targets, no outcome before contact, one hit or miss at contact, near-miss counting, the shared 300 ms lockout, pause/resume and cancellation on quit/replay. Test a late update extending beyond expiry and the scheduled contact in separate runs at expiry minus 20 ms, at expiry, and at expiry plus 20 ms (59,980 ms, 60,000 ms, and 60,020 ms at the configured duration). Verify one game-over transition at expiry in all three cases. Only the first run emits contact and outcome events before `ROUND_ENDED` and counts in the final result. After T103.
- [X] T105 [US1] Implement one active swing in `src/core/round.ts` using the types in `src/core/types.ts` and events in `src/utils/event-emitter.ts`. Use active milliseconds for `startedAt`, `contactAt` (initially about 100 ms after start) and `availableAt` (300 ms after start), with `'windup' | 'recovery'` phases. Advance targets and their lifecycle through the contact boundary, resolve once using live aim and existing hit geometry, then advance remaining time. Expiry wins at or before contact. Update swing stats, score, combo, replacement scheduling and outcome events only when resolved. Run the T104 suite. After T104.
- [X] T106 [P] [US1] Write failing motion cases in `tests/core/cockroach-ai.test.ts` for initial acceleration, braking, turn hold and acceleration again, supported coplanar travel, a connected seam, rejection of disconnected or different-height routes, and large ticks carrying time across motion phases. Cover retained tangent heading during a hold and clean initialization when reusing a pooled roach.
- [X] T107 [US1] Implement elapsed-time crawl profiles, heading and support-aware waypoint travel in `src/core/cockroach-ai.ts` and `src/core/types.ts`. Keep `speed` as actual ground speed, zero when stopped, and `groundFacing` as a unit tangent heading retained during a hold. Use marker normals and support bounds from `src/rendering/map-loader.ts` to verify links. Split supported corners at the seam and turn back when a link has no continuous support. Keep Hell Mode's warning schedule and trajectory. Run the T106 suite. After T105, T106.
- [X] T108 [P] [US1] Rebuild the stylized cockroach in `blender/scripts/cockroach.py`, save `blender/cockroach.blend`, and export `public/assets/models/cockroach.glb`. Author a flattened reddish-brown shell, six splayed legs, two long antennae, tucked crawl wings, planted alternating tripod steps and subtle idle antenna motion. Keep `idle`, `crawl`, `fly` and the open-wing first pose for preflight, within the asset and frame budgets. Check two viewport angles and run the cockroach case in `tests/assets/asset-contract.test.ts`.
- [X] T109 [US1] Publish grounded heading and speed on `COCKROACH_MOVED` via `src/core/round.ts` and `src/utils/event-emitter.ts`. In `src/rendering/cockroach-renderer.ts`, align to the current support and drive gait cadence from travel speed. Keep planted feet on the support during near-edge turns and avoid interpolation through unsupported space. After T107, T108.
- [X] T110 [US1] Wire desktop and touch callbacks and frame advancement to the same monotonic timeline in `src/main.ts`. Advance through any due contact before applying newer look input and obtain unshaken aim through `src/rendering/camera-controller.ts`. In `src/rendering/weapon-viewmodel.ts`, sample strike time from the round, preserve the contact pose on the outcome frame and keep capped delta for cosmetic bob. In `src/rendering/vfx.ts` and `src/ui/styles.css`, add a distinct empty-miss cue. Keep existing hit/near-miss feedback and route exactly one outcome sound via `src/main.ts`. If a valid contact and expiry fall in the same update, draw its pending contact pose and outcome for one frame before displaying results. Keep round completion at expiry. After T105.
- [X] T111 [US1] Run the V9 grounded scurry, live aim and pause checks with the existing slipper in Normal, plus the Normal desktop portion of V10 in `specs/001-smash-em-all/quickstart.md`. Record the on-surface gait and near-edge turns. Check floor, counter and wall routes across the rooms using `src/rendering/map-loader.ts`. Where existing markers provide no supported route, correct the affected markers in `blender/scripts/kitchen.py`, `blender/scripts/livingroom.py` or `blender/scripts/bedroom.py`, save the matching `.blend` in `blender/`, and verify the re-export in `public/assets/models/maps/`. After T103, T109, T110.

### Phase 13 · US2 Hell Mode (P1)

**Goal** — Integrate the new grounded motion and delayed contact with the existing Hell Mode flight behavior.

**Independent test** — Run V2 and the Hell sections of V9 and V10. Observe wing opening and the 1.5-second warning, strike an in-range flying target at contact and verify the flying bonus.

- [X] T112 [US2] Run the existing Hell AI tests in `tests/core/cockroach-ai.test.ts` and the Hell validation in `specs/001-smash-em-all/quickstart.md`. Verify the wings open during the 1.5-second preflight hold, the flight trajectory and reached-player recycling still work, and a flying hit at contact awards 250 base points. Check the 60-second start, expiry and replay in Hell. Record outcomes in the guide. After T111.

### Phase 14 · US4 Choosing Weapons (P2)

**Goal** — Give the slipper a visible right-hand strike and calibrate the three weapon sizes while preserving combat parity.

**Independent test** — Run V9 screen-scale and weapon-parity checks. Measure a 25–33% body-to-slipper ratio and verify that the same contact aim and target state give the same outcome with all three weapons.

- [X] T113 [P] [US4] Extend `tests/assets/asset-contract.test.ts` with a failing GLB check for the slipper's animated hand/wrist in the `swing` export. Use the existing clip, compression, size and triangle limits for the combined export.
- [X] T114 [US4] Add the right-hand grip and wrist rotation in `blender/scripts/slipper.py`, save `blender/weapons/slipper.blend`, and export `public/assets/models/weapons/slipper.glb`. Author the diagonal contact pose and quick recovery in `swing`, and a stable grip in `idle`. Keep the combined hand and slipper within 800 triangles and 50 KB, using one mesh primitive where possible. Run the asset checks and capture two viewport angles. After T113.
- [X] T115 [P] [US4] Author the shared contact beat in `blender/scripts/flyswatter.py` and `blender/scripts/cardboard.py` while retaining their distinct strikes. Save `blender/weapons/flyswatter.blend` and `blender/weapons/cardboard.blend`. Re-export `public/assets/models/weapons/flyswatter.glb` and `public/assets/models/weapons/cardboard.glb`, capture two viewport angles and run their cases in `tests/assets/asset-contract.test.ts`.
- [X] T116 [US4] Align the normalized `swing` contact pose of all three weapons in `src/rendering/weapon-viewmodel.ts`. Use the fixed V9 Kitchen pose in `specs/001-smash-em-all/quickstart.md`, with 0.60 m horizontal offset and 0.40 m height above the stationary broadside cockroach. Calibrate the resting weapon mounts and adjust visual cockroach scale in `src/rendering/cockroach-renderer.ts` if needed to meet the 25–33% ratio at both 1280 × 720 and 844 × 390. Keep the shared contact timing and collision dimensions. Record the scene pose and projected dimensions, then obtain approval of the flyswatter and cardboard reference captures before T117. After T109, T110, T114, T115.
- [X] T117 [US4] Run the V9 screen-scale and weapon-parity checks in `specs/001-smash-em-all/quickstart.md` with the T116 pose and viewports. Verify the 25–33% ratio in both viewports, compare the resting flyswatter and cardboard with their approved captures, and check crosshair visibility with all three weapons. Capture the slipper at grip, contact and recovery. Confirm identical hit/miss results for the same aim and target positions at contact. After T116.

### Phase 15 · US5 Mobile Touch Controls (P2)

**Goal** — Keep touch aim responsive through the shared windup and start or resume the 60-second round at the correct time.

**Independent test** — In mobile landscape, tap and then swipe on the right during windup. Verify the new aim determines the result at contact. Rotate to portrait and back during a separate swing, then check the pause and replay scenarios.

- [ ] T118 [US5] Run V9 and V10 on a landscape touch device using the entry points in `src/input/mobile-input.ts` and `src/main.ts`. Verify a completed tap followed by a swipe changes aim before contact, a swipe after contact cannot alter the result, and portrait pause freezes elapsed time and the swing until landscape resumes. Record device, browser and outcome in `specs/001-smash-em-all/quickstart.md`. After T112, T117.

### Phase 16 · Increment Verification

- [X] T119 Run `pnpm test --coverage` and `pnpm build` from `package.json`. Verify the headless coverage target and asset limits, including any re-exported maps. Record results in `specs/001-smash-em-all/quickstart.md`. After T112, T117.
- [ ] T120 Run the synchronized desktop and physical-phone SC-006 capture procedure in `specs/001-smash-em-all/quickstart.md`. Measure input-to-visible-swing and contact-to-audio p95 separately for hit, near-miss and empty miss. Capture the V9 late-update cases at 59,980 ms, 60,000 ms, and 60,020 ms. Verify that only the first case shows a contact frame with its outcome before results and plays the outcome sound once when enabled. Record any unavailable device measurements as pending. After T118, T119.
- [ ] T121 Run the production frame and download checks in `specs/001-smash-em-all/quickstart.md` with the revised models, including a busy Hell view with preflight and strike effects. Record draw calls, triangle counts, cold transfer, desktop frame rate and physical-phone frame rate against the existing budgets. After T119.

### Increment Dependencies and Coverage

| Story or checkpoint | Dependencies and parallel work | Coverage |
|---|---|---|
| US1 | T101, T102, T106 and T108 can start together. Complete T103 before T104–T105. The grounded pipeline T107–T109 and contact presentation T110 converge at T111. | FR-002, FR-004, FR-006, FR-007, FR-010, FR-011, FR-016, FR-026, FR-027, FR-030. SC-009, SC-012, SC-013, SC-014 |
| US2 | T112 uses the integrated US1 build. Asset authoring in T108 covers the preflight pose. | FR-008, FR-026. Hell portions of SC-012 and SC-014 |
| US4 | T113–T114 and T115 can proceed independently of the US1 core work. T116–T117 need both weapon exports and the integrated renderer. | FR-015, FR-023, FR-028, FR-029. SC-011, SC-013 |
| US5 | T118 uses the integrated contact and weapon presentation. | FR-004, FR-010, FR-012. Touch portions of SC-009, SC-011, SC-013, SC-014 |
| Verification | T120 and T121 can run in separate validation sessions once their prerequisites pass. | SC-006, SC-009, SC-011–SC-014 and existing frame and download budgets |

**Increment delivery** — Start with Kitchen/Normal/Slipper on desktop at T111 as the first playable checkpoint. Bring in Hell validation, all weapon variants and mobile acceptance, then complete the cross-cutting verification. T111 uses the existing slipper while the new weapon assets and scale calibration are in progress.
