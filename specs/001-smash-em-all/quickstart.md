# Smash 'Em All quickstart and validation

## Prerequisites

- Node.js 18.12+ and the repository's pinned pnpm 10.33.0, or npm.
- A browser with WebGL 2. For release checks use Chrome, Firefox, Safari and Edge on desktop, and Safari on iOS and Chrome on Android.
- The committed GLB files in `public/assets/models/` for the asset contract suite.

## Setup

```bash
pnpm install

# Development at http://localhost:5173
pnpm dev --strictPort

# Production preview at http://localhost:4173
pnpm build
pnpm exec vite preview --strictPort
```

Run the commands from the repository root. If using npm instead, use `npm install --no-package-lock`, `npm run dev -- --strictPort`, `npm run build` and `npm exec -- vite preview --strictPort`.
Use the dev server for the optional event probes and the production preview for the release build checks.

## Validation Scenarios

### V1 Core game loop (US1, P1)

For the US1 checkpoint at T048, run Kitchen, Normal and Slipper with desktop controls. Check the preview, load progress, swing audio, pause/resume and replay. Room, mode and weapon selectors, the trophy cabinet, the language and sound controls, and results confetti can be absent until their respective increments land. At release, exercise the available selectors and verify the end-of-round effects.

**Steps:**
1. Open `http://localhost:5173` in Chrome
2. Verify start screen loads with 3D kitchen scene in background
3. Select Kitchen map, Normal mode, Slipper weapon
4. Click "BẮT ĐẦU" / "START"
5. Verify the load progress, pointer lock on desktop and a countdown starting at `01:00` at top-center.
6. Use WASD to move around the kitchen
7. Click to swing slipper at a cockroach
8. Verify the cockroach is eliminated, the splat appears, the score increases, and exactly one smack plays
9. Hit 3 cockroaches within 2s each — verify combo badge shows x2, x3
10. Wait > 2s — verify combo resets
11. Swing close enough to get a near-miss. Verify the crosshair reacts, combo resets and exactly one whoosh plays. Swing at empty space and verify it also counts as a miss and plays exactly one whoosh.
12. Press Escape and switch away from the tab in separate checks. Verify the clock, score and spawns freeze while paused. Return and select Resume to continue.
13. Wait for the 60-second active-play clock to expire. Verify the results show score, rank (S/A/B/C), kills, best combo and accuracy. At release, confirm the results transition and confetti play once, and repeat with reduced motion enabled to verify the results appear immediately.
14. Click "CHƠI LẠI" / "PLAY AGAIN". Verify the countdown returns to `01:00` with the same room, mode and weapon, and the score, combo and effects reset.

**Expected:** Complete round plays through with all systems functional.

### V2 Hell mode flying cockroaches (US2, P1)

**Steps:**
1. From start screen, select Hell Mode
2. Start a round
3. For a newly spawned cockroach, measure from spawn to the preflight warning ("⚠️ Nó bay!" / "⚠️ It's flying!"). The game draws a random trigger delay of 3–8 seconds from that cockroach's spawn.
4. Measure from that same cockroach's preflight warning to takeoff. Expect 1.5 additional seconds of active play, within one rendered frame when uninterrupted. Follow the cockroach toward you. A second cockroach can start warning before the first takes off and keep the shared toast visible.
5. Hit a flying cockroach at ×1 to verify 250 points. Hit a crawling cockroach at ×1 to verify 100 points.
6. Let a flying cockroach reach you — verify it despawns (no damage, no health loss)
7. Complete the round. Compare the S/A/B thresholds of 12,000/8,000/5,000 in Hell with 8,000/5,000/3,000 in Normal.

For timing in the dev build, run this in the console before starting the round. Match the timestamps by `cockroachId` and use its latest spawn if an ID is reused. Keep the tab focused and repeat without swinging at the measured cockroach.

```js
const { game } = await import(document.querySelector('script[src*="/src/main.ts"]').src);
const stopFlightProbe = ['COCKROACH_SPAWNED', 'COCKROACH_PREFLIGHT', 'COCKROACH_FLYING']
  .map(event => game.events.on(event, ({ cockroachId }) => {
    console.log(event, cockroachId, performance.now());
  }));
// After the check: stopFlightProbe.forEach(unsubscribe => unsubscribe());
```

**Expected** Both intervals fall in their specified ranges, the warning appears on preflight, and a flying cockroach can be hit or safely allowed to reach its target.

### V3 All rooms (US3, P2)

**Steps:**
1. Play one round in Kitchen — note furniture, spawn locations
2. Play one round in Living Room — verify different environment and spawns
3. Play one round in Bedroom — verify different environment and spawns
4. In each room, verify the menu previews the current selection and the game loads that room. Walk into walls and furniture to check collision.

**Expected:** Three visually distinct maps, each with working spawns and colliders.

### V4 Weapon variety (US4, P2)

**Steps:**
1. Play with Slipper — note visual appearance and swing animation
2. Play with Flyswatter — verify different appearance, same hit behavior
3. Play with Cardboard — verify different appearance, same hit behavior

**Expected:** Three visually distinct weapons, identical gameplay performance.

### V5 Mobile controls (US5, P2)

**Steps:**
1. Open the game on a mobile phone in landscape and tap Start.
2. Verify virtual joystick appears on the lower-left
3. Drag joystick — verify movement
4. Swipe right side — verify camera rotation
5. Tap — verify weapon swing
6. Rotate phone to portrait — verify "Rotate your device" prompt appears
7. Rotate back to landscape and verify the round resumes with the same timer, score and spawns.
8. Open the game in portrait. Verify the rotate prompt appears immediately and blocks access to Start. Try tapping, then repeat with an external mouse or keyboard on the phone. Return to landscape and verify Start is accessible.
9. Start in landscape, then rotate to portrait while the round is loading. Verify gameplay stays blocked until landscape returns. Repeat the orientation check on Play Again.
10. Pause manually in landscape, rotate to portrait, then return to landscape. Verify the game stays paused until the player resumes.

**Expected:** Touch controls work in landscape and the portrait restriction applies consistently across input methods.

### V6 Achievements (US6, P3)

**Steps:**
1. Use a fresh profile. Finish a normal round with fewer than three kills and verify "Thong thả" / "Taking It Easy" unlocks on the results screen.
2. Return to the menu and open the trophy cabinet. Verify the badge is unlocked and unearned badges show their locked status and hints.
3. Close and reopen the browser on the same origin. Verify the achievement persists.
4. With "Bậc thầy vẽ viền" / "Outline Artist" locked, register ten near-misses in one round and let the timer expire. Verify the badge appears in the results. In the dev build, `game.round.stats.nearMisses` can confirm the count after importing `game` as in V2.
5. Repeat the condition in another round. Verify there is no new results unlock for that badge and the cabinet contains a single entry for it.

A dev-only fixture can place a cockroach just outside the hit cone but inside the near-miss radius, then let real swings produce exactly ten near-miss events. Record such a run as fixture-assisted for the condition, results, persistence and duplicate checks. Use uninterrupted natural play and the full round timer for the SC-007 reachability check.

**Expected:** Achievements unlock, persist, and don't duplicate.

### V7 Language toggle (US7, P3)

**Steps:**
1. From the default Vietnamese menu, select the "English" button.
2. Verify menu, settings, achievements, locked hints and labels switch to English. Verify the current selections stay selected and the document language is `en`.
3. Play a round and verify HUD, pause, results and in-game warnings are in English.
4. Close and reopen — verify English persists
5. Toggle back to Vietnamese — verify all text reverts

**Expected:** Instant language switch, 100% coverage, persistent.

### V8 Sound control (US8, P3)

**Steps:**
1. Start with sound on. In both modes verify one smack on a hit, one whoosh on a near-miss and one whoosh on an empty miss. Move or turn near cockroaches to check scurry direction and distance, including the Hell-mode flight buzz. Listen for the mode music, combo cues at ×5 and ×10, last-ten-seconds tick and round-end cue.
2. During a round, press M on desktop or tap the HUD sound control on touch. Repeat all three swing outcomes. Verify the visual feedback still plays and all game audio is silent.
3. Close and reopen the same origin, then start another round. Verify the menu and HUD still show sound off and the round is silent.
4. Use the menu or HUD control or press M again during a round. Verify the music and sound cues are audible when their events occur.

**Expected:** Sound toggle works immediately, persists.

### V9 Gameplay Feel Increment

Use the setup above and run the following checks after implementing the [increment plan](./plan.md#gameplay-feel-increment-2026-11-23). The visual reference is `sample/Smash 'Em All (cut).mp4` at 0:06–0:08 in the workspace.

1. **Screen scale and poses.** In Kitchen, mark a fixed countertop position for the cockroach and record its position, orientation and the camera pose in the calibration record. Position the camera 0.60 m away horizontally and 0.40 m above the center of its body. Aim at the center with the cockroach stationary and its body broadside across the frame. Keep the player stationary and the weapon in its resting pose. Capture at 1280 × 720 and 844 × 390. Measure the projected head-to-abdomen length excluding legs and antennae, and the slipper's toe-to-heel length excluding the hand. The body is 25–33% of the slipper length in both captures. Record the on-screen dimensions of the flyswatter and cardboard alongside the slipper in the same view. Approve those reference captures at T116 before comparing against them at T117. Verify that the crosshair stays visible with each resting weapon in both viewports. Capture the slipper grip, diagonal strike and recovery.
2. **Grounded scurry.** In each mode, record a run-and-turn on a floor, countertop and wall, including a turn near an edge. Compare successive frames for acceleration, braking, body turn and acceleration again. Confirm the alternating gait follows speed, planted legs appear to stay on the surface and the idle antennae move. Check route continuity in the other rooms and confirm the Hell Mode warning, wing opening and flight using V2.
3. **Live aim and weapon parity.** With each weapon, start a swing just off an in-range target and aim onto it before contact. Repeat with the aim moving off target and with a target moving out of range before contact. Confirm a hit, then misses where no other target qualifies. Use the same controlled aim and target positions for all weapons. On touch, finish the tap and start a right-side swipe during windup. Trying to drag the original tap is a look gesture.
4. **Pause and round boundary.** Pause before contact and check the pose and counters while paused. Resume and confirm one outcome after the remaining windup. In separate controlled runs, use one late update that spans both the scheduled contact and expiry with contacts at 59,980 ms, 60,000 ms, and 60,020 ms of active play. At 59,980 ms, verify one outcome in the final stats, one visible frame showing the contact pose and outcome before the results screen, and one outcome sound when enabled. At 60,000 ms and 60,020 ms, expect a canceled swing and results without contact feedback. Verify one game-over transition at 60,000 ms in all three cases. Repeat the core timing checks in the headless round tests and confirm replay accepts the first swing.
5. **Feedback and budgets.** Run the Swing Response procedure below. Profile production Normal and Hell scenes with revised roaches, a swing and its effects. Compare the results to the existing frame, load and asset limits.

### V10 60-Second Countdown (SC-014)

1. Run V1 in Normal and repeat the timer checks in Hell. On desktop and on a landscape phone, verify that a fresh round and a replay both start at `01:00`. Begin timing when play becomes active.
2. In a continuous run, verify results appear once after 60 seconds of active play. With sound enabled, check that the first final-ten-seconds warning occurs at `00:10` when that second is observed.
3. In a second run, pause partway through and wait several seconds. Verify the displayed time is frozen. Resume and confirm the countdown expires after a total of 60 active seconds, plus the paused interval in wall-clock time.
4. Use the slow-frame release check below and the headless timer and round suites to verify that a tick crossing zero clamps there, emits one result and leaves replay ready to start from `01:00`.

## Automated Tests

```bash
# Run headless core unit tests
pnpm test tests/core

# Run asset contract validation
pnpm test tests/assets/asset-contract.test.ts

# Run both suites with coverage
pnpm test --coverage
# Expected: 100% branch coverage for src/core/ modules
```

With npm use `npm test -- tests/core`, `npm test -- tests/assets/asset-contract.test.ts` and `npm test -- --coverage`.

## Release edge cases

- Deny access to browser storage before opening the game. Confirm a round can start, finish and replay, and sound and language can be changed without an error. Restore storage and use a new page for persistence checks.
- With visible-tab CPU throttling or a deliberate slow frame, time an uninterrupted round. Verify the countdown uses 60 seconds of elapsed active play and the game reaches results once. Separately verify tab blur pauses the clock.
- Complete a round and return to the menu. Change room, mode and weapon, then start. Replay from those results and verify it retains the new selections with reset score, spawns and timer.
- Tab through radio groups and menu actions and use the arrow keys to change radio selections. From Pause, Game Over and the trophy cabinet verify keyboard focus remains within the active dialog and its actions work. Confirm the menu and dialogs scroll to all their actions in short landscape.
- The ad slots start hidden. In DevTools, temporarily remove their `hidden` attributes and insert inert text or blocks. Verify the slots reserve space at the upper and lower edges during the menu and results breaks, leave the canvas dimensions intact and allow all controls to be reached. Check that oversized content is clipped and the slots stay hidden during gameplay, pause, loading and the trophy or orientation prompts.

## Performance Validation

### Frame Budget Check (P1 and Release)

1. At T048, profile Kitchen/Normal. At T055, profile Kitchen/Hell. At T096, repeat in the production build for all three rooms in both modes.
2. Capture gameplay from a viewpoint showing many cockroaches and pieces of furniture. Include a swing and its effects while the scene is busy. In Hell, include preflight and flight.
3. Count draw calls and rendered triangles across all passes within each sampled frame, including the weapon and VFX. Record the highest value for each metric, together with the room, mode and visible cockroach count.
4. Each measured frame must stay below 50 draw calls and below 35,000 triangles. Address overages before closing the applicable checkpoint.

### Start Experience (SC-001)

- First visit — Use a fresh browser profile and open the game with the default selections. Press Start as soon as the controls are available. Measure from opening the page to the first accepted swing. The target is under 10 seconds.
- Return visit — Reopen with the same browser profile. Verify one press on Start enters the default round. Record device, browser, network conditions and cache state for each run.

### First-session play and achievements (SC-004, SC-005, SC-007)

- Observe first-time players without providing instructions. Record whether they find Start and use the controls to play. At least 90% should do so unaided.
- Record the starting and ending values of `smash_em_all_total_rounds` in each participant's browser storage. Use the difference and direct observation to count completed replays separately from the initial round. Compare the session average with the target of three replays.
- For all ten badges, record the room, mode, weapon and completed round outcome where the badge unlocks through natural gameplay. Use the trophy cabinet to track the remaining conditions and include cumulative badges that require several rounds.

### Swing Response (SC-006)

1. On desktop and a mid-range phone, enable sound and use synchronized video and audio. Mark accepted input (click or touch release), first visible swing frame, visible contact pose, visual outcome and audible outcome onset. Record device, browser and capture resolution in time.
2. Measure at least 20 accepted swings for each outcome on each device. For each outcome, report input-to-visible-swing and contact-to-audio p95. Both measures must be at most 100 ms. Also report the observed input-to-contact interval against the initial playtest target of about 100 ms.
3. Confirm the visual outcome appears on the contact frame, including the distinct empty-miss cue, and exactly one outcome sound is audible with audio enabled. Record any missing physical capture as pending.

### Build, Download and Frame Rate

```bash
# Report total gzip bytes across emitted JavaScript after pnpm build
node --input-type=module -e "import {readdirSync, readFileSync} from 'node:fs'; import {gzipSync} from 'node:zlib'; const files = readdirSync('dist/assets').filter(file => file.endsWith('.js')); console.log(files.reduce((bytes, file) => bytes + gzipSync(readFileSync('dist/assets/' + file)).length, 0));"
```

Verify the emitted JavaScript totals less than 200 KB gzipped. The asset suite checks the individual GLB limits of 2 MB per map, 100 KB for the cockroach and 50 KB per weapon.

1. In the production preview, record at least 10 seconds of active gameplay in the Performance panel and verify 60 fps on desktop.
2. For each cold selected-map sample use a fresh profile or disable cache and clear network entries before navigating. Measure the total transferred bytes from navigation through the first playable frame with one room selected. Keep the selected room, preload/preview traffic and network settings in the record and verify the combined transfer is below 4 MB.
3. Repeat the frame rate capture on a mid-range physical phone using remote debugging and verify at least 55 fps. Record the room, mode, device and browser with the readings.

## Current Validation Record

### Gameplay feel and countdown update (2026-11-23)

- The Normal room audit loaded the exported GLBs and found a supported crawl route from all 36 spawn markers: 11 in Kitchen, 12 in Living Room, and 13 in Bedroom. Four added waypoints restored routes on the Living Room shelves and table and the Bedroom rug. The Normal Chrome capture covered acceleration, braking, turning, and acceleration again on the Kitchen floor, counter, and wall, plus the Living Room shelf near its side panel.
- Normal mode in desktop Chrome reached results after 60.073 s uninterrupted and 63.079 s with a 3.049 s pause. Both runs started and replayed at `01:00`, emitted one result at zero, and triggered the first warning cue at `00:10` with sound enabled.
- Desktop Chrome also tested Normal live aim and a mid-swing pause with the original slipper GLB. A deliberate 450 ms main-thread stall crossed the round deadline from `00:01` and produced one result at `00:00`. Switching tabs froze the timer until explicit Resume.
- Hell mode in desktop Chrome measured 60.042 s of active play during a pause and resume run, with one result, a warning cue at `00:10`, and replay at `01:00`. A controlled browser probe showed both wings held open through the 1.500 s preflight, a 2.000 s curved flight, and 250 base points for a flying hit at the 100 ms contact beat. The round suite also verified one replacement per completed flight.
- In the late-frame Hell regression, one 7,000 ms update and updates of 6,500 ms, 350 ms, and 150 ms produced the same recycling and swing result. The first flyers reached the player at 6,500 ms, returned at 6,850 ms, and one replacement was hit at 7,100 ms.
- A controlled Chrome fixture verified live aim, pause during windup, and the round-end cases. Contact at 59,980 ms displayed its pose and cue for one frame before results. Contacts at 60,000 ms and 60,020 ms canceled. A rotation-triggered expiry retained the final contact and its sound cue until the first landscape frame, then displayed results on the following frame.
- Controlled Chrome gameplay produced the same hit, near-miss, and empty-miss outcomes for the same aim and target positions with all three weapons. Each case produced its cue at 100 ms and one audio request.
- Landscape touch emulation verified that a swipe during windup changed a predicted miss into a hit. Rotation to portrait at 35 ms froze the pose, clock, and counters. Returning to landscape resumed automatically and resolved the swing once after the remaining 65 ms. A late swipe left the outcome unchanged. Physical touch, synchronized audio/video delay, and mid-range phone frame rate remain open.
- The final run on 2026-11-24 passed 162 tests across 12 files with `pnpm test --coverage`, including 18 asset contract tests and the size and geometry limits for all three room GLBs. V8 reported 100% branch coverage for the headless core and i18n. The production build passed with 196,456 bytes of gzipped JavaScript and Vite's chunk-size advisory.

#### V9 weapon calibration

The Kitchen fixture places the cockroach at ground contact `(-0.45, 0.937202, 0.55)` m, facing +X. The camera at `(-0.45, 1.360002, 1.15)` aims at body center `(-0.45, 0.960002, 0.55)`. The measured resting shell-to-slipper ratios were 29.21% and 28.52% at desktop and landscape sizes, respectively. The reticle remained clear for all three resting weapons in both sizes. At 100 ms, all three poses were within 1.81% of viewport height from reticle center.

| Weapon | Projected length at 1280 × 720 | Projected length at 844 × 390 |
|---|---:|---:|
| Slipper | [409.14 px](reference/weapon-calibration/slipper-1280x720.png) | [226.96 px](reference/weapon-calibration/slipper-844x390.png) |
| Flyswatter | [451.84 px](reference/weapon-calibration/flyswatter-1280x720.png) | [250.37 px](reference/weapon-calibration/flyswatter-844x390.png) |
| Cardboard | [376.24 px](reference/weapon-calibration/cardboard-1280x720.png) | [206.84 px](reference/weapon-calibration/cardboard-844x390.png) |

The [measurement record](reference/weapon-calibration/measurements.json) contains the projected endpoints and camera pose for every capture. The user approved the four flyswatter and cardboard captures above as the T117 comparison references on 2026-11-24.

T117 reproduced all six resting captures byte for byte and matched the projected measurements in both viewports. It also captured the slipper [grip](reference/weapon-calibration/slipper-1280x720.png), [contact at 100 ms](reference/weapon-calibration/slipper-contact-1280x720.png), and [recovery at 245 ms](reference/weapon-calibration/slipper-recovery-1280x720.png). All nine Chrome gameplay parity cases passed on a fresh run.

#### Production desktop profiling

Headless Chrome 157 used the production bundle, a fresh profile for each run, the Intel UHD Graphics Direct3D 11 renderer, and a 1280 × 720 viewport. Touch input emulation selected the menus and sent swings. Draw totals include the world and weapon passes. Each run collected more than ten seconds of gameplay with repeated strikes. The Hell samples include the preflight interval. The frame rate is measured from desktop animation-frame timestamps.

| Room | Cold transfer | Normal max draws / triangles | Hell max draws / triangles |
|---|---:|---:|---:|
| Kitchen | 1,829,142 bytes | 17 / 13,072 | 28 / 16,768 |
| Living Room | 2,006,030 bytes | 20 / 13,662 | 30 / 17,022 |
| Bedroom | 2,033,218 bytes | 16 / 13,534 | 27 / 17,230 |

All six runs on the build with the late-frame Hell fix recorded a median of about 164 fps, a p95 frame interval of at most 6.4 ms, and zero page exceptions. The mobile performance target still requires a mid-range physical phone.

### Pre-increment verification

The following records describe the 90-second baseline before this update.

The isolated Windows worktree was verified with Chrome 157 and Chrome Android-device emulation. Chrome runs covered V1–V8 across the implementation, including a full 90-second Normal round. The V6 near-miss badge and some result and failure cases used development fixtures. The browser also reached results and replayed with storage access denied. Asset and headless checks passed with 131 tests across 12 suites and 100% branch coverage for the configured Core and i18n modules. Current Chrome was also used to confirm cancellation and model loading with `AbortSignal.throwIfAborted` unavailable, and to exercise the legacy Web Audio positioning fallback.

### Production render sample

Draw calls and triangles include the room, effects and weapon passes. The final Chrome run covered all six combinations on the production build with `AbortSignal.throwIfAborted` disabled. It reported no runtime exceptions.

| Room | Normal draw calls | Normal triangles | Hell draw calls | Hell triangles |
| --- | ---: | ---: | ---: | ---: |
| Kitchen | 15 | 11,606 | 21 | 13,238 |
| Living Room | 16 | 11,522 | 20 | 12,610 |
| Bedroom | 14 | 11,954 | 21 | 13,858 |

A cache-disabled Kitchen run transferred 1,261,730 bytes over local loopback. The largest room-switch sample, which included the initial Kitchen preview, transferred 1,460,354 bytes. Vite reported 194.74 kB of gzipped JavaScript. In an earlier local headless run, the first accepted swing scheduled its cue 194 ms after a cache-disabled navigation and 188 ms on a return visit. Each took one Start activation. These timings measure browser scheduling and loopback delivery.

### Acceptance still open

- **T098** — Actual Firefox, Safari desktop, iOS Safari and Android Chrome runs remain open. Installed Edge rendered the menu and room preview, then its headless runtime returned an internal Chromium error on a trusted pointer lock request, preventing an Edge desktop round. A separate Edge touch-emulated smoke reached gameplay and scored a hit. The end-to-end display and audio-output p95 requires synchronized physical capture.
- **T099** — Transfer and JavaScript-size samples passed locally. Physical desktop and mid-range mobile frame-rate measurements remain open.
- **T100** — The local one-click startup smoke passed. First-time player comprehension, average first-session replay count and natural unlocks for all ten badges still require direct playtest evidence.
