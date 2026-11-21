# Quickstart Validation Guide: Smash 'Em All

**Purpose**: Runnable validation scenarios that prove the game works end-to-end after implementation.

## Prerequisites

- Node.js 18+ installed
- pnpm (or npm) package manager
- Modern browser (Chrome 90+ recommended for DevTools debugging)
- For asset contract tests: GLB files present in `public/assets/models/`

## Setup

```bash
# Clone and install
cd smash-em-all
pnpm install

# Start dev server
pnpm dev
# → Opens at http://localhost:5173
```

## Validation Scenarios

### V1: Core Game Loop (US1 — P1)

**Steps:**
1. Open `http://localhost:5173` in Chrome
2. Verify start screen loads with 3D kitchen scene in background
3. Select Kitchen map, Normal mode, Slipper weapon
4. Click "BẮT ĐẦU" / "START"
5. Verify 90-second countdown begins at top-center
6. Use WASD to move around the kitchen
7. Click to swing slipper at a cockroach
8. Verify the cockroach is eliminated, the splat appears, the score increases, and exactly one smack plays
9. Hit 3 cockroaches within 2s each — verify combo badge shows x2, x3
10. Wait > 2s — verify combo resets
11. Swing close enough to get a near-miss. Verify the crosshair reacts, combo resets and exactly one whoosh plays. Swing at empty space and verify it also counts as a miss and plays exactly one whoosh.
12. Wait for timer to reach 0:00
13. Verify game over screen shows: score, rank (S/A/B/C), kills, max combo, accuracy
14. Click "CHƠI LẠI" / "PLAY AGAIN" — verify new round starts

**Expected:** Complete round plays through with all systems functional.

### V2: Hell Mode Flying Cockroaches (US2 — P1)

**Steps:**
1. From start screen, select Hell Mode
2. Start a round
3. Wait for the warning toast "⚠️ Nó bay!" after a cockroach's 3–8s preflight trigger interval
4. Verify the warning precedes takeoff by 1.5 seconds, then look up to see the cockroach flying toward you
5. Swing to hit the flying cockroach — verify 250 base points (vs 100 for crawling)
6. Let a flying cockroach reach you — verify it despawns (no damage, no health loss)
7. Complete the round — verify rank thresholds are higher than Normal mode

**Expected:** Flying cockroaches spawn, warn, fly, and can be hit or dodge.

### V3: All Maps (US3 — P2)

**Steps:**
1. Play one round in Kitchen — note furniture, spawn locations
2. Play one round in Living Room — verify different environment and spawns
3. Play one round in Bedroom — verify different environment and spawns
4. In each map, walk to walls/furniture — verify collision (can't walk through)

**Expected:** Three visually distinct maps, each with working spawns and colliders.

### V4: Weapon Variety (US4 — P2)

**Steps:**
1. Play with Slipper — note visual appearance and swing animation
2. Play with Flyswatter — verify different appearance, same hit behavior
3. Play with Cardboard — verify different appearance, same hit behavior

**Expected:** Three visually distinct weapons, identical gameplay performance.

### V5: Mobile Controls (US5 — P2)

**Steps:**
1. Open game on a mobile phone in landscape orientation
2. Verify virtual joystick appears on the lower-left
3. Drag joystick — verify movement
4. Swipe right side — verify camera rotation
5. Tap — verify weapon swing
6. Rotate phone to portrait — verify "Rotate your device" prompt appears
7. Rotate back to landscape and verify the round resumes with the same timer, score and spawns.
8. Open the game in portrait and make Start the first interaction. Verify the rotate prompt appears and gameplay stays blocked. Repeat with an external mouse or keyboard on the phone.
9. Start in landscape, then rotate to portrait while the round is loading. Verify gameplay stays blocked until landscape returns. Repeat the orientation check on Play Again.
10. Pause manually in landscape, rotate to portrait, then return to landscape. Verify the game stays paused until the player resumes.

**Expected:** Touch controls work in landscape and the portrait restriction applies consistently across input methods.

### V6: Achievements (US6 — P3)

**Steps:**
1. Play a round with < 3 kills — verify "Thong thả" / "Taking It Easy" unlocks
2. Open trophy cabinet — verify achievement displayed, others greyed
3. Close and reopen browser — verify achievement persists
4. With "Bậc thầy vẽ viền" still locked, register exactly 10 near-misses in one round and let the timer expire. Verify the badge appears in the results.
5. Repeat the condition in another round. Verify the results show no new unlock for that badge and the trophy cabinet still contains a single entry for it.

**Expected:** Achievements unlock, persist, and don't duplicate.

### V7: Language Toggle (US7 — P3)

**Steps:**
1. On start screen, tap language toggle (🇻🇳 → 🇬🇧)
2. Verify ALL text changes to English (button labels, mode names, achievement names)
3. Play a round — verify HUD text, game over text all in English
4. Close and reopen — verify English persists
5. Toggle back to Vietnamese — verify all text reverts

**Expected:** Instant language switch, 100% coverage, persistent.

### V8: Sound Control (US8 — P3)

**Steps:**
1. Play with sound on. Verify one smack on a hit, one whoosh on a near-miss and one whoosh on an empty miss. Also verify spatial scurry/buzz and mode music.
2. Toggle sound off and repeat all three swing outcomes. Verify the visual feedback still plays and all game audio is silent.
3. Close and reopen — verify remains muted
4. Toggle on — verify all sounds resume

**Expected:** Sound toggle works immediately, persists.

## Automated Tests

```bash
# Run headless core unit tests (TDD)
pnpm test

# Run asset contract validation
pnpm test -- tests/assets/asset-contract.test.ts

# Run all tests with coverage
pnpm test -- --coverage
# Expected: 100% branch coverage for src/core/ modules
```

## Performance Validation

### Frame Budget Check (P1 and Release)

1. At T048, profile Kitchen/Normal. At T055, profile Kitchen/Hell. At T096, repeat in the production build for all three rooms in both modes.
2. Capture gameplay from a viewpoint showing many cockroaches and pieces of furniture. Include a swing and its effects while the scene is busy. In Hell, include preflight and flight.
3. Count draw calls and rendered triangles across all passes within each sampled frame, including the weapon and VFX. Record the highest value for each metric, together with the room, mode and visible cockroach count.
4. Each measured frame must stay below 50 draw calls and below 35,000 triangles. Address overages before closing the applicable checkpoint.

### Start Experience (SC-001)

- First visit — Use a fresh browser profile and open the game with the default selections. Press Start as soon as the controls are available. Measure from opening the page to the first accepted swing. The target is under 10 seconds.
- Return visit — Reopen with the same browser profile. Verify one press on Start enters the default round. Record device, browser, network conditions and cache state for each run.

### Swing Response (SC-006)

1. On desktop and on a mid-range phone, enable sound and use synchronized video and audio to capture the press or tap, the first visible frame of the swing and the onset of the outcome sound. Record the device, browser and capture resolution in time.
2. Measure at least 20 accepted swings for each outcome on each device. Calculate the 95th percentile separately for hit, near-miss and empty miss, and separately for input-to-visual and input-to-audio delay. Use the measured end-to-end delays, including display and audio output.
3. Each reported 95th percentile must be at most 100 ms. Confirm the expected outcome cue plays once using V1 and V8.

### Build, Download and Frame Rate

```bash
# Production build
pnpm build

# Check bundle size
ls -la dist/assets/*.js  # Should be < 200 KB gzipped

# Check asset sizes
ls -la public/assets/models/maps/*.glb  # Each < 2 MB
ls -la public/assets/models/cockroach.glb  # < 100 KB
ls -la public/assets/models/weapons/*.glb  # Each < 50 KB
```

**In-browser (Chrome DevTools):**
1. Open Performance tab → Record a 10-second gameplay session
2. Verify: frame rate stays at 60 fps on desktop
3. Open Network tab → Hard refresh → Verify total transfer < 4 MB (1 map)
4. Mobile: Connect via Chrome Remote Debugging → verify ≥ 55 fps on mid-range device
