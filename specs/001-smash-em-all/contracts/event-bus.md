# Event Bus Contract: Smash 'Em All

**Purpose**: Defines all events emitted by the Headless Core that other layers (Rendering, UI, Audio) subscribe to. This is the sole communication channel between layers per Constitution §6.1.

## Event Naming Convention

All event names are `UPPER_SNAKE_CASE` string constants.

## Events

### Game Flow Events

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `STATE_CHANGED` | `{ from: GameState, to: GameState }` | state-machine | UI, Rendering, Audio, Input |
| `ROUND_STARTED` | `{ mapId, mode, weaponId }` | round | Rendering, Audio, UI |
| `ROUND_ENDED` | `{ roundResult: RoundResult }` | round | UI, Audio |
| `TIMER_TICK` | `{ timeRemaining: number }` | timer | UI |
| `TIMER_WARNING` | `{ timeRemaining: number }` | timer (at ≤ 10s) | UI, Audio |

`TIMER_TICK.timeRemaining` is measured in seconds. Each round, including replay, begins with a tick at 60. Pause suspends countdown advancement. The zero tick precedes the single `ROUND_ENDED` notification. `TIMER_WARNING` uses the final ten seconds of the active clock.

### Combat Events

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `WEAPON_SWING` | `{ position, direction }` | round | Rendering (animation start, with the aim at input for context) |
| `WEAPON_CONTACT` | `{ outcome: 'hit' \| 'near_miss' \| 'miss' }` | round | Rendering (contact pose and empty-miss cue) |
| `COCKROACH_HIT` | `{ cockroachId, position, points, comboMultiplier }` | round | Rendering (splat VFX), Audio (smack), UI (score update) |
| `COCKROACH_NEAR_MISS` | `{ cockroachId, position, distance }` | round | Rendering (crosshair shake), UI (near-miss counter) |
| `WEAPON_MISS` | `{ position, direction }` | round | Audio (one whoosh). Payload uses aim at contact |
| `COMBO_UPDATED` | `{ multiplier: number }` | combo | UI (combo badge), Audio (chime at x5, x10) |
| `COMBO_RESET` | `{}` | combo | UI (combo badge hide) |
| `SCORE_UPDATED` | `{ score: number, delta: number }` | scoring | UI (score display) |

### Cockroach Events

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `COCKROACH_SPAWNED` | `{ cockroachId, position, surfaceType }` | round | Rendering (show mesh) |
| `COCKROACH_MOVED` | `{ cockroachId, position, rotation, state, groundFacing, speed }` | round | Rendering (transform, grounded heading and gait cadence). Flying views use flight motion |
| `COCKROACH_PREFLIGHT` | `{ cockroachId, position }` | round | UI (warning toast), Audio (wing sound) |
| `COCKROACH_FLYING` | `{ cockroachId, position, velocity }` | round | Rendering (flight animation), Audio (buzz) |
| `COCKROACH_DESPAWNED` | `{ cockroachId, reason: 'killed' \| 'reached_player' }` | round | Rendering (hide), Audio (release spatial source) |
| `KILL_COUNT_UPDATED` | `{ kills: number }` | scoring | UI (kill counter) |

### Achievement Events

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `ACHIEVEMENT_UNLOCKED` | `{ achievementId, nameVi, nameEn, flavorVi, flavorEn }` | achievement-tracker | UI (game-over screen card) |

### Player Events

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `PLAYER_MOVED` | `{ position, rotation }` | input-manager → core | Rendering (camera), Audio (listener position) |
| `LANGUAGE_CHANGED` | `{ language: 'vi' \| 'en' }` | i18n | UI (all text) |
| `SOUND_TOGGLED` | `{ enabled: boolean }` | UI | Audio (mute/unmute) |

## Rules

- The state machine owns state transitions and emits `STATE_CHANGED`. The round owns lifecycle and combat notifications. Input supplies commands, while hit detection and cockroach AI supply calculation results.
- An accepted input emits `WEAPON_SWING` once. At contact, the round emits `WEAPON_CONTACT` followed by exactly one of `COCKROACH_HIT` and `WEAPON_MISS`, with `COCKROACH_NEAR_MISS` also emitted for a near-miss. Hit/near-miss visual cues keep their existing outcome subscriptions. Outcome audio listens to hit or miss only. Rejected inputs emit no combat events, and a swing canceled before contact emits only its earlier start notification.
- The viewmodel uses the round's active swing time for the strike pose. Pause holds the pose. When `WEAPON_CONTACT` precedes `ROUND_ENDED` in the same update and the outcome has yet to be drawn, the presentation retains the contact pose and outcome effect until it draws one gameplay frame. It plays one outcome sound when enabled, then shows the results screen and clears the retained presentation state. The core still transitions to game over and emits `ROUND_ENDED` at expiry.
- If a pending swing's scheduled contact is at or after expiry, cancel that swing and show results without its contact frame or outcome sound. Clear swing presentation on reset or after the final outcome frame, if any.
- `ROUND_STARTED` fires once when the round starts. `ROUND_ENDED` fires once on normal completion and carries the finalized result. Quitting or abandoning a failed load does not emit `ROUND_ENDED`.

1. **Core emits, others listen.** The Headless Core never imports from Rendering, UI, or Audio. It only emits events.
2. **Input pushes commands.** Input layer calls core methods directly (e.g., `core.swing()`, `core.move(dx, dz)`). These are method calls, not events.
3. **No event chaining in Core.** Core modules may call each other directly (e.g., hit-detection calls scoring). Events are for cross-layer communication only.
4. **Typed events.** All event payloads are typed interfaces. No `any` payloads.
