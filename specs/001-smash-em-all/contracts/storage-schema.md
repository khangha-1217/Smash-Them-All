# Storage Schema: Smash 'Em All

**Purpose**: Defines the localStorage schema for persistent player data. All keys are prefixed with `smash_em_all_` to avoid collision with other apps on the same domain.

## Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `smash_em_all_achievements` | `Record<string, boolean>` | `{}` | Achievement ID → unlocked status |
| `smash_em_all_personal_bests` | `Record<string, number>` | `{}` | `${mapId}_${mode}` → highest score |
| `smash_em_all_total_rounds` | `number` | `0` | Lifetime round count |
| `smash_em_all_weapons_used` | `string[]` | `[]` | Weapon IDs used at least once |
| `smash_em_all_maps_played` | `string[]` | `[]` | Map IDs played at least once |
| `smash_em_all_language` | `'vi' \| 'en'` | `'vi'` | Selected language |
| `smash_em_all_sound` | `boolean` | `true` | Sound enabled/disabled |

## Serialization

All values are JSON-serialized via `JSON.stringify()` / `JSON.parse()`.

## Personal Best Key Format

Composite key: `${mapId}_${mode}`

Examples:
- `kitchen_normal` → 7500
- `bedroom_hell` → 11200
- `livingroom_normal` → 4300

## Graceful Degradation

If `localStorage` is unavailable (private browsing, storage full, disabled):
- Game plays normally with all features functional
- No achievements persist between sessions
- No personal bests, preferences, or round counts saved
- No error messages shown to the player
- Detection: wrap `localStorage.setItem()` in try/catch on first access

## Data Reset

Clearing browser data / localStorage removes all game progress. No confirmation prompt — this is standard browser behavior. No cloud backup or export/import functionality.

## Schema Migration

For v1, no migration needed. If schema changes in future versions:
- Check for a `smash_em_all_version` key
- If absent, treat as v1 schema
- Migrate data in-place on first load of new version
