# Data Model: Smash 'Em All

**Phase**: 1 — Design & Contracts
**Date**: 2026-11-21

## Entities

### GameState (State Machine)

The central authority for all game flow. No other system may change game phase.

```
States: MENU | LOADING | READY | PLAYING | PAUSED | GAME_OVER

Transitions:
  MENU      → LOADING     (player presses Start)
  LOADING   → READY       (all assets for selected map loaded)
  LOADING   → MENU        (loading the current round fails)
  READY     → PLAYING     (countdown complete or immediate)
  PLAYING   → PAUSED      (Esc key / pause button / tab blur / portrait rotation)
  PAUSED    → PLAYING     (resume)
  PAUSED    → MENU        (player chooses Quit to Menu)
  PLAYING   → GAME_OVER   (timer reaches 0)
  GAME_OVER → MENU        (player returns to menu)
  GAME_OVER → LOADING     (player presses Play Again — reloads same map)

Invalid transitions are rejected silently. Both exit paths release resources owned by the pending or abandoned round. Profile updates to lifetime rounds, personal bests and achievements are reserved for normally completed rounds. After a load failure, the menu retains the previous selections and allows a retry.
```

### Round

Represents one 90-second gameplay session.

| Field | Type | Description |
|-------|------|-------------|
| mapId | `'kitchen' \| 'livingroom' \| 'bedroom'` | Selected map |
| mode | `'normal' \| 'hell'` | Selected game mode |
| weaponId | `'slipper' \| 'flyswatter' \| 'cardboard'` | Selected weapon |
| timeRemaining | `number` (seconds, float) | Countdown from 90.0, based on real elapsed time |
| score | `number` (integer) | Accumulated score |
| kills | `number` (integer) | Total cockroaches eliminated |
| swings | `number` (integer) | Total weapon swings |
| hits | `number` (integer) | Swings that connected with a cockroach |
| nearMisses | `number` (integer) | Swings that passed within 1.8× hitbox radius |
| maxCombo | `number` (integer) | Highest combo multiplier achieved |
| rank | `'S' \| 'A' \| 'B' \| 'C' \| null` | Computed at game over |

**Derived fields:**
- `accuracy`: `hits / swings` (0 if no swings)
- `misses`: `swings - hits`

### Combo

Tracks the current hit streak.

| Field | Type | Description |
|-------|------|-------------|
| multiplier | `number` (integer, ≥ 1) | Current combo multiplier |
| lastHitTime | `number` (ms timestamp) | Time of last successful hit |
| windowMs | `number` (constant: 2000) | Max time between hits to maintain combo |

**State transitions:**
- Hit → `multiplier++`, `lastHitTime = now`
- Miss (any swing not hitting) → `multiplier = 1`
- Timeout (now - lastHitTime > windowMs) → `multiplier = 1`

### Cockroach

Represents one cockroach instance (pooled).

| Field | Type | Description |
|-------|------|-------------|
| id | `number` | Pool index |
| alive | `boolean` | Whether active in the scene |
| state | `'idle' \| 'crawling' \| 'preflight' \| 'flying'` | Current behavior state |
| position | `{x, y, z}` | World position |
| surfaceType | `string` | Current surface tag (floor, counter, wall, etc.) |
| surfaceNormal | `{x, y, z}` | Normal of current surface (for body orientation) |
| targetWaypoint | `{x, y, z} \| null` | Current movement target |
| speed | `number` (m/s) | Movement speed (0.5–1.2 for crawl) |
| hitboxRadius | `number` (meters) | 0.06 crawling. Flying is 1.3× the crawling radius (0.078m). |
| flightCurve | `BezierCurve \| null` | Flight path (Hell Mode only) |
| flightProgress | `number` (0–1) | Progress along flight curve |

**State transitions:**
```
idle → crawling         (after idle duration 0.3–1s)
crawling → idle         (reached waypoint)
crawling → preflight    (Hell Mode, random interval 3–8s)
preflight → flying      (after 1.5s warning)
flying → [recycled]     (hit by player OR reached camera)
[any alive] → [recycled] (hit by player)
```

### Weapon

Represents the player's held weapon (cosmetic only).

| Field | Type | Description |
|-------|------|-------------|
| id | `'slipper' \| 'flyswatter' \| 'cardboard'` | Weapon identifier |
| isSwinging | `boolean` | Whether swing animation is active |
| swingStartTime | `number \| null` | Timestamp of swing start |
| swingDurationMs | `number` (constant: 300) | Lockout duration |

**Validation:** No new swing accepted while `isSwinging && (now - swingStartTime < swingDurationMs)`.

### Achievement

Represents one achievement definition and its unlock state.

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | Unique identifier (e.g., `golden_slipper`) |
| nameVi | `string` | Vietnamese display name |
| nameEn | `string` | English display name |
| flavorVi | `string` | Vietnamese flavor text |
| flavorEn | `string` | English flavor text |
| condition | `(round: RoundResult) => boolean` | Evaluation function |
| unlocked | `boolean` | Persistent unlock state (from localStorage) |

**Identity/uniqueness:** `id` is unique across all achievements. Once unlocked, stays unlocked forever (until localStorage cleared). Duplicate unlock attempts are no-ops.

### PlayerProfile

Persistent data stored in localStorage.

| Field | Type | Description |
|-------|------|-------------|
| achievements | `Record<string, boolean>` | Achievement ID → unlocked |
| personalBests | `Record<string, number>` | `${mapId}_${mode}` → best score |
| totalRounds | `number` | Lifetime round count |
| weaponsUsed | `string[]` | List of weapon IDs used at least once |
| mapsPlayed | `string[]` | List of map IDs played at least once |
| language | `'vi' \| 'en'` | Selected language |
| soundEnabled | `boolean` | Sound preference |

### HitResult

Output of hit detection calculation.

| Field | Type | Description |
|-------|------|-------------|
| type | `'hit' \| 'near_miss' \| 'miss'` | Result classification |
| target | `Cockroach \| null` | Hit cockroach (null if miss/near-miss) |
| nearMiss | `{cockroachId, position, distance} \| null` | Nearest qualifying cockroach ID, world position and distance from the aim ray for a near-miss (null for hit or empty miss) |
| distance | `number` | Distance used to select the nearest hit target. For a near-miss, use the ray clearance in `nearMiss.distance`. |
| points | `number` | Points awarded (0 if miss) |

### MapData

Extracted from loaded GLB file.

| Field | Type | Description |
|-------|------|-------------|
| id | `string` | Map identifier |
| spawnPoints | `Array<{position, surfaceType, surfaceNormal, supportId?}>` | Cockroach spawn locations |
| waypoints | `Array<{position, surfaceType, surfaceNormal, supportId?}>` | Navigation waypoints |
| playerStart | `{position, rotation}` | Initial camera placement |
| colliders | `Array<{min, max}>` | AABB boxes for walls and furniture |
| roomBounds | `{min, max}` | Outer room boundary AABB |

## Relationships

```
Round ──has──→ MapData (1:1, selected map)
Round ──has──→ Weapon (1:1, selected weapon)
Round ──tracks──→ Combo (1:1, current streak)
Round ──contains──→ Cockroach[] (1:N, pooled instances)
Round ──produces──→ RoundResult (1:1, at game over)
RoundResult ──evaluates──→ Achievement[] (1:N, check conditions)
PlayerProfile ──stores──→ Achievement[].unlocked (persistent)
PlayerProfile ──stores──→ personalBests per mapId+mode (persistent)
MapData ──contains──→ SpawnPoint[] + Waypoint[] (embedded in GLB)
```
