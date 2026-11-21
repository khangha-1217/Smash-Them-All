# Feature Specification: Smash 'Em All — 3D First-Person Cockroach-Smashing Arcade Game

**Feature Branch**: `001-smash-em-all`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "Thiết kế và xây dựng tựa game 3D FPS arcade chạy trên trình duyệt, người chơi cầm dép lê (hoặc đồ vật khác) săn và đập gián trong nhà trong 90 giây, hai chế độ chơi, 3 map, song ngữ Việt–Anh, hướng tới gắn quảng cáo web."

## Clarifications

### Session 2026-11-21

- Q: What counts as a "miss" — swinging at empty space or only close-range failures? → A: Every swing that does not hit a cockroach counts as a miss, including swinging at empty space. Misses reset combo, lower accuracy, and count against the "Perfect Aim" achievement.
- Q: Should the game enforce landscape orientation on mobile, or support both? → A: Landscape only. If the device is in portrait, display a "Rotate your device" prompt and do not start gameplay until landscape is detected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Stress-Relief Round (Priority: P1)

A casual player opens the game in their browser, picks a room and a weapon, and jumps into a 90-second round of cockroach smashing. They swing their slipper at crawling cockroaches on floors, countertops, and walls, racking up points and combos. When time's up, they see their score, rank, and stats — and immediately hit "Play Again."

**Why this priority**: This is the core game loop. Without a satisfying 90-second smash-and-score experience, nothing else matters. It must feel fun, responsive, and rewarding on the very first play.

**Independent Test**: Can be fully tested by launching the game, selecting any map/weapon/mode, playing one full 90-second round, and verifying the score screen appears with correct stats. Delivers the complete core value proposition.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they select a map, weapon, and Normal mode and press "Start", **Then** a 90-second countdown begins and cockroaches appear crawling on various surfaces in the selected room.
2. **Given** the player is in a round, **When** they aim at a cockroach and swing their weapon, **Then** the cockroach is eliminated with a satisfying visual/audio feedback and points are added to the score.
3. **Given** the player hits multiple cockroaches within 2 seconds of each other, **When** each consecutive hit lands, **Then** the combo multiplier increases (x2, x3, x4...) and the multiplied points are displayed.
4. **Given** the combo timer is active, **When** the player misses a swing or 2 seconds pass without a hit, **Then** the combo resets to x1.
5. **Given** the timer reaches 0:00, **When** the round ends, **Then** the game over screen shows total score, rank (S/A/B/C), kill count, highest combo, and accuracy.
6. **Given** the game over screen is displayed, **When** the player presses "Play Again", **Then** a new round begins immediately with the same settings.

---

### User Story 2 - Hell Mode: Flying Cockroach Chaos (Priority: P1)

A player seeking a tougher challenge selects "Hell Mode." Cockroach density is higher and cockroaches periodically take flight — spreading their wings and dive-bombing toward the player's face. A warning alert flashes before each takeoff, forcing the player to look up and swat mid-air.

**Why this priority**: The two-mode system is a core differentiator. Hell Mode provides the escalation that keeps experienced players engaged and creates shareable "oh no!" moments. It's part of the initial launch promise.

**Independent Test**: Can be tested by playing a Hell Mode round and verifying that cockroaches fly, warnings appear, and flying kills award bonus points.

**Acceptance Scenarios**:

1. **Given** the player selects Hell Mode, **When** a cockroach prepares to fly, **Then** a visible warning alert appears on screen 1.5 seconds before takeoff.
2. **Given** a cockroach is in flight, **When** it is heading toward the player, **Then** it follows a curved trajectory with increasing speed and slight randomness.
3. **Given** the player swings at a flying cockroach, **When** the hit connects, **Then** the cockroach is eliminated and awards bonus points (higher than a crawling kill).
4. **Given** a flying cockroach reaches the player without being hit, **When** it arrives, **Then** it despawns and reappears at a new location (no damage to the player — there is no health system).
5. **Given** the player completes a Hell Mode round, **When** scoring is calculated, **Then** rank thresholds are adjusted to reflect the higher difficulty (higher point thresholds for each rank).

---

### User Story 3 - Exploring Different Rooms (Priority: P2)

A returning player wants variety. They switch between three different rooms — a kitchen, a living room, and a bedroom — each with its own layout, furniture, and cockroach hiding spots. All rooms are available from the start with no unlocking required.

**Why this priority**: Three maps at launch provide immediate variety and replay value. Without map diversity, the 90-second loop risks feeling repetitive after a few rounds.

**Independent Test**: Can be tested by playing one round in each of the three maps and verifying each has a unique environment, different cockroach spawn positions, and correct navigation boundaries.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they view the map selector, **Then** all three rooms (kitchen, living room, bedroom) are available and selectable.
2. **Given** the player selects the kitchen, **When** the round starts, **Then** the environment shows a retro/cozy kitchen with appropriate furniture and cockroaches spawn on kitchen-specific surfaces (countertops, sink area, floor, etc.).
3. **Given** the player selects the living room, **When** the round starts, **Then** the environment shows a cozy living room with different furniture and spawn locations (sofa, coffee table, bookshelf, etc.).
4. **Given** the player selects the bedroom, **When** the round starts, **Then** the environment shows a cozy bedroom with its own furniture and spawn locations (bed, nightstand, desk, etc.).
5. **Given** the player is walking in any room, **When** they approach walls or large furniture, **Then** they cannot walk through them and are gently blocked.

---

### User Story 4 - Choosing Weapons (Priority: P2)

A player wants to try different "weapons." They choose between a slipper, a flyswatter, or a stiff piece of cardboard. Each looks and feels different in hand, but all perform identically in gameplay — the choice is purely cosmetic and personal.

**Why this priority**: Weapon variety adds personality and self-expression to the experience. It's low complexity (cosmetic only) but high engagement value.

**Independent Test**: Can be tested by playing one round with each weapon and verifying each has a distinct visual appearance and swing animation while producing the same gameplay results.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they view the weapon selector, **Then** all three weapons (slipper, flyswatter, cardboard) are available and visually distinguishable.
2. **Given** the player selects any weapon, **When** the round starts, **Then** the selected weapon is visible at the bottom-right of the screen in first-person view.
3. **Given** the player swings any weapon, **When** the swing animation plays, **Then** the animation is unique to that weapon but the hit area, range, and timing are identical across all weapons.

---

### User Story 5 - Mobile Touch Controls (Priority: P2)

A player opens the game on their phone. They see a virtual joystick on the left for movement, swipe on the right side to look around, and tap to swing their weapon. The experience is smooth and intuitive without any tutorial needed.

**Why this priority**: Mobile is a primary platform. The game must feel natural on touchscreens to reach the widest casual audience. Without good mobile controls, half the target audience is lost.

**Independent Test**: Can be tested by opening the game on a mobile device, verifying the joystick appears, camera responds to swipes, tapping triggers weapon swing, and gameplay runs smoothly.

**Acceptance Scenarios**:

1. **Given** the player opens the game on a touch device, **When** the game detects touch input, **Then** a semi-transparent virtual joystick appears on the lower-left of the screen.
2. **Given** the joystick is visible, **When** the player drags it in any direction, **Then** the character moves smoothly in that direction.
3. **Given** the player touches and drags on the right side of the screen, **When** they swipe in any direction, **Then** the camera rotates accordingly (look around).
4. **Given** the player taps anywhere outside the joystick area, **When** the tap is registered, **Then** the weapon swings at whatever is in the crosshair.
5. **Given** the game is running on a mid-range mobile device, **When** gameplay is active with multiple cockroaches, **Then** the game maintains a smooth, playable frame rate.

---

### User Story 6 - Earning Funny Achievements (Priority: P3)

A player who has played several rounds starts unlocking humorous achievements based on their behavior — whether they're a deadly accurate slapper, a serial near-misser, or someone who barely touches a cockroach. These achievements persist across sessions and can be viewed in a trophy cabinet.

**Why this priority**: Achievements add long-term engagement and shareability. They reward different playstyles and encourage experimentation, but the game is fully playable and fun without them.

**Independent Test**: Can be tested by deliberately triggering specific achievement conditions and verifying they appear on the game over screen and persist in the trophy cabinet.

**Acceptance Scenarios**:

1. **Given** the player meets an achievement condition during a round (e.g., 10 near-misses), **When** the round ends, **Then** the newly unlocked achievement is prominently displayed on the game over screen with its humorous name and description.
2. **Given** the player has unlocked achievements in previous sessions, **When** they open the trophy cabinet from the start screen, **Then** all previously earned achievements are displayed, with locked ones shown as greyed out with hint text.
3. **Given** the player has already unlocked an achievement, **When** they meet the same condition again, **Then** the achievement is not re-awarded or duplicated.
4. **Given** the player clears their browser data, **When** they return to the game, **Then** all achievements are reset (local storage only — no cloud backup).

---

### User Story 7 - Bilingual Experience (Priority: P3)

A player who prefers English switches the language from the default Vietnamese. All interface text, achievement names and descriptions, gameplay alerts, and control hints switch to English. Their preference is remembered for future visits.

**Why this priority**: Bilingual support broadens the audience beyond Vietnamese speakers. It's essential for shareability and international reach, but the game functions fully in either language alone.

**Independent Test**: Can be tested by switching languages on the start screen and verifying all visible text across all screens updates correctly, then closing and reopening the game to confirm the preference persists.

**Acceptance Scenarios**:

1. **Given** the player is on the start screen, **When** they tap the language toggle, **Then** all UI text switches between Vietnamese and English.
2. **Given** the player switches to English, **When** they play a round and reach the game over screen, **Then** all text (rank labels, achievement names, button labels, stat labels) is displayed in English.
3. **Given** the player has selected English, **When** they close and reopen the game, **Then** the game loads in English without requiring manual switching.
4. **Given** an in-game alert appears (e.g., flying cockroach warning), **When** the alert displays, **Then** it uses the currently selected language.

---

### User Story 8 - Sound Control and Audio Feedback (Priority: P3)

A player enjoys the satisfying audio feedback — the smack of a hit, the scurrying of cockroaches, the lo-fi background music. Another player is in a quiet office and mutes everything. Both should have good experiences.

**Why this priority**: Audio dramatically enhances game feel, but many casual/mobile players play muted. Sound must be a delightful bonus, not a requirement.

**Independent Test**: Can be tested by playing with sound on (verify all sound categories play at appropriate moments), then toggling sound off (verify complete silence), then reopening the game (verify preference persists).

**Acceptance Scenarios**:

1. **Given** the player has sound enabled, **When** they hit a cockroach, **Then** a satisfying impact sound plays.
2. **Given** the player has sound enabled, **When** cockroaches are nearby, **Then** ambient scurrying/buzzing sounds play with spatial positioning (louder when closer).
3. **Given** the player toggles sound off, **When** gameplay continues, **Then** all audio stops immediately and the game remains fully playable.
4. **Given** the player muted the game, **When** they reopen the game later, **Then** the game remains muted.
5. **Given** the timer reaches the last 10 seconds, **When** sound is enabled, **Then** an audible ticking/warning sound emphasizes urgency.

---

### Edge Cases

- What happens when the player does nothing for the entire 90 seconds? → Timer runs out normally, score is 0, rank is C, possible "pacifist" achievement unlock.
- What happens when all pooled cockroaches are eliminated faster than respawn? → Cockroaches respawn from the pool at spawn points; there should never be an empty room for more than a brief moment.
- What happens when the player rapidly taps/clicks during the swing lockout? → Additional inputs during the 300ms lockout are ignored; no queuing.
- What happens on a very slow device where frame rate drops significantly? → Game timer is based on real elapsed time (not frame count), so the round is always exactly 90 seconds regardless of frame rate.
- What happens if localStorage is unavailable or full? → Game plays normally but achievements and preferences are not saved; no error shown to the player.
- What happens when the player rotates their phone mid-game? → If rotated to portrait, the game pauses and displays a "Rotate your device" prompt; gameplay resumes automatically when landscape is restored, with no loss of game state.
- What happens when the browser tab loses focus during gameplay? → Game automatically pauses and shows the pause overlay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present a start screen with map selection (3 rooms), mode selection (Normal/Hell), weapon selection (3 weapons), and a prominent Start button.
- **FR-002**: System MUST run a 90-second countdown timer per round that freezes on pause and triggers game-over at 0.
- **FR-003**: System MUST spawn cockroaches that crawl across multiple surface types (floors, countertops, walls, shelves, furniture) within each room.
- **FR-004**: System MUST detect weapon-to-cockroach hits based on the player's aim direction when they swing, with a generous detection area to ensure satisfying gameplay.
- **FR-005**: System MUST award 100 base points for eliminating a crawling cockroach and 250 base points for a flying cockroach.
- **FR-006**: System MUST track consecutive hits within a 2-second window as a combo, multiplying points by the combo count (x1, x2, x3...), resetting on miss (any swing that does not hit a cockroach, including swinging at empty space) or timeout (2 seconds without a hit).
- **FR-007**: System MUST enforce a brief lockout after each weapon swing to prevent input spam and create a rhythmic gameplay feel.
- **FR-008**: In Hell Mode, system MUST cause cockroaches to periodically take flight on a curved trajectory toward the player's face, with a visible warning 1.5 seconds before takeoff.
- **FR-009**: System MUST display an in-game HUD showing: mode badge, countdown timer, current score, combo indicator, kill count, and a crosshair.
- **FR-010**: System MUST allow the player to pause the game (via Esc key or pause button) which freezes the timer and shows a pause overlay.
- **FR-011**: System MUST display a game-over screen with: total score, rank (S/A/B/C based on defined thresholds), kills, highest combo, accuracy (hits ÷ total swings, where any swing not hitting a cockroach counts as a miss), personal best comparison, newly unlocked achievements, next rank hint, and replay button.
- **FR-012**: System MUST provide first-person movement controls for desktop (keyboard + mouse with pointer capture) and mobile (virtual joystick + swipe + tap). On mobile, the game MUST enforce landscape orientation; if the device is in portrait, a "Rotate your device" / "Xoay điện thoại" prompt MUST be shown and gameplay MUST NOT start until landscape is detected.
- **FR-013**: System MUST auto-detect the input method (touch vs. mouse/keyboard) on first interaction and display appropriate control schemes.
- **FR-014**: System MUST prevent the player from walking through room walls and major furniture pieces.
- **FR-015**: System MUST provide three visually distinct weapons (slipper, flyswatter, cardboard) that the player can freely select, all with identical gameplay performance.
- **FR-016**: System MUST provide visual and audio feedback on every hit (impact effect, particle burst, screen shake, sound) and on near-misses (crosshair feedback).
- **FR-017**: System MUST track near-miss events (swings that pass very close to a cockroach without hitting) for the achievement system.
- **FR-018**: System MUST maintain a trophy cabinet of achievements, viewable from the start screen, showing unlocked achievements in color and locked ones as greyed with hints.
- **FR-019**: System MUST persist all achievements, personal best scores (per map + mode), and player preferences (language, sound) in local browser storage.
- **FR-020**: System MUST support two languages (Vietnamese and English) with a toggle on the start screen, applying to all UI text, achievements, and in-game alerts.
- **FR-021**: System MUST provide a sound toggle that immediately mutes/unmutes all game audio, with the preference persisted across sessions.
- **FR-022**: System MUST display the 3D room scene live behind the start screen UI (camera slowly panning) so the player can preview the selected map.
- **FR-023**: System MUST render the selected weapon in first-person view at the bottom-right of the screen, slightly bobbing with player movement, without clipping into the environment.
- **FR-024**: System MUST provide spatial audio positioning for cockroach sounds (crawling/flying), making sounds louder and directional based on proximity and position.
- **FR-025**: System MUST automatically pause the game when the browser tab loses focus.

### Rank Thresholds

| Rank | Normal Mode | Hell Mode |
|------|-------------|-----------|
| S    | ≥ 8,000     | ≥ 12,000  |
| A    | ≥ 5,000     | ≥ 8,000   |
| B    | ≥ 3,000     | ≥ 5,000   |
| C    | < 3,000     | < 5,000   |

### Achievements

| ID | Name (VI) | Name (EN) | Condition |
|----|-----------|-----------|-----------|
| `golden_slipper` | Tay dép vàng | Golden Slipper | First S rank |
| `near_miss_master` | Bậc thầy vẽ viền | Outline Artist | 10 near-misses in 1 round |
| `combo_machine` | Combo Machine | Combo Machine | Combo ≥ x10 |
| `fly_swatter` | Trời ơi nó bay! | Oh No It Flies! | Kill 5 flying cockroaches in 1 round |
| `perfect_aim` | Xạ thủ hoàn hảo | Perfect Aim | 0 misses, ≥ 15 kills in 1 round |
| `pacifist` | Thong thả | Taking It Easy | < 3 kills in 1 round |
| `collector` | Sưu tầm gia | Collector | Use all 3 weapons (across rounds) |
| `tourist` | Du khách | Tourist | Play all 3 maps |
| `night_owl` | Cú đêm | Night Owl | Play 30 total rounds |
| `hell_lord` | Chúa tể Địa Ngục | Lord of Hell | S rank in Hell Mode |

### Key Entities

- **Round**: A single 90-second gameplay session characterized by a selected map, mode, and weapon. Produces a score, rank, kill count, combo record, and accuracy rate.
- **Cockroach**: An in-game enemy that spawns at designated points, moves along surfaces or flies toward the player (Hell Mode). Has states: idle, crawling, flying. Can be eliminated by a weapon hit.
- **Weapon**: The player's tool for eliminating cockroaches. Three variants (slipper, flyswatter, cardboard) with identical performance but distinct visual appearance and animations.
- **Map/Room**: A 3D environment where gameplay takes place. Three rooms (kitchen, living room, bedroom) each with unique layout, furniture, and cockroach spawn/navigation points.
- **Combo**: A streak counter that increases with each consecutive hit within a 2-second window, multiplying points earned.
- **Achievement**: A persistent badge unlocked by meeting specific behavioral conditions during gameplay. Stored locally, displayed in the trophy cabinet.
- **Player Profile**: Locally-stored data including: achievements, personal best scores (per map + mode combination), language preference, and sound preference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a first visit, fewer than 10 seconds elapse between opening the page and the first accepted swing when the player starts as soon as the controls are available. On a return visit, the player can start a round with the default selections by pressing Start once.
- **SC-002**: The game maintains smooth, playable performance on mid-range mobile devices (2023-era phones) and all modern desktop browsers.
- **SC-003**: The total initial download size for playing one map is under 4 MB, ensuring fast load times on mobile connections.
- **SC-004**: 90% of first-time players can understand the controls and start playing without any tutorial or instructions.
- **SC-005**: The average player replays at least 3 rounds in their first session (measured by local round counter — indicates the core loop is engaging).
- **SC-006**: Every accepted swing gives visual feedback and, when sound is enabled, one outcome sound. For hits, near-misses and empty misses measured separately on desktop and a mid-range phone, the 95th-percentile delay from input to visible feedback and from input to audible feedback is at most 100 ms for each.
- **SC-007**: All 10 achievements are achievable through natural gameplay without requiring exploits or unnatural behavior.
- **SC-008**: Language switching updates 100% of visible UI text immediately with no page reload required.
- **SC-009**: Game state (timer, score, spawns) is fully preserved through pause/resume cycles with no discrepancies.
- **SC-010**: The game's UI and ad-slot architecture supports future integration of web advertisements at natural break points (start screen, post-game) without requiring structural changes.

## Assumptions

- Players have a modern web browser with hardware-accelerated graphics support (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+).
- Players on mobile have devices from 2023 or newer with adequate GPU capability for basic 3D rendering.
- No server-side infrastructure is needed — all game logic, scoring, and persistence run entirely in the browser.
- No multiplayer or online leaderboard is in scope; the game is a single-player local experience.
- All game maps and weapons are available immediately — there is no progression or unlock system.
- Ad integration is a future concern; the initial build only needs to include the structural hooks (empty DOM slots) without any actual ad SDK.
- Audio assets will be sourced from royalty-free libraries; no original music composition or voice acting is required.
- The game does not need to work offline (no PWA/service worker requirement for v1), though the architecture should not preclude it.
- The retro/cozy stylized visual aesthetic applies consistently across all three rooms; each room varies in furniture and layout but shares the same artistic direction.
- Cockroaches have no damage mechanic — they don't harm the player. The only pressure is the 90-second time limit.
