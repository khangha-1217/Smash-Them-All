import type { GameMode, MapId, PlayerProfile, WeaponId } from '../core/types';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const MAP_IDS: Record<MapId, true> = { kitchen: true, livingroom: true, bedroom: true };
const WEAPON_IDS: Record<WeaponId, true> = { slipper: true, flyswatter: true, cardboard: true };
const GAME_MODES: Record<GameMode, true> = { normal: true, hell: true };
const PERSONAL_BEST_KEYS = new Set(
  Object.keys(MAP_IDS).flatMap((mapId) => Object.keys(GAME_MODES).map((mode) => `${mapId}_${mode}`)),
);

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseKnownIds(value: unknown, ids: Record<string, true>): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => (
    typeof entry === 'string' && Object.prototype.hasOwnProperty.call(ids, entry)
  ));
}

function parseRecord<T>(
  value: unknown,
  validateEntry: (entry: unknown, key: string) => entry is T,
): Record<string, T> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const entries: [string, unknown][] = Object.entries(value);
  const validEntries = entries.filter((entry): entry is [string, T] => validateEntry(entry[1], entry[0]));
  return Object.fromEntries(validEntries);
}

type ProfileFields = {
  [K in keyof PlayerProfile]: {
    key: string;
    parse: (value: unknown) => PlayerProfile[K] | undefined;
  };
};

const FIELDS: ProfileFields = {
  achievements: {
    key: 'smash_em_all_achievements',
    parse: (value) => parseRecord(value, (unlocked): unlocked is boolean => typeof unlocked === 'boolean'),
  },
  personalBests: {
    key: 'smash_em_all_personal_bests',
    parse: (value) => parseRecord(value, (score, key): score is number => (
      PERSONAL_BEST_KEYS.has(key) && isNonnegativeInteger(score)
    )),
  },
  totalRounds: {
    key: 'smash_em_all_total_rounds',
    parse: (value) => isNonnegativeInteger(value) ? value : undefined,
  },
  weaponsUsed: { key: 'smash_em_all_weapons_used', parse: (value) => parseKnownIds(value, WEAPON_IDS) },
  mapsPlayed: { key: 'smash_em_all_maps_played', parse: (value) => parseKnownIds(value, MAP_IDS) },
  language: { key: 'smash_em_all_language', parse: (value) => value === 'vi' || value === 'en' ? value : undefined },
  soundEnabled: { key: 'smash_em_all_sound', parse: (value) => typeof value === 'boolean' ? value : undefined },
};

const PROFILE_FIELDS = Object.keys(FIELDS) as (keyof PlayerProfile)[];

export function createDefaultProfile(): PlayerProfile {
  return {
    achievements: {},
    personalBests: {},
    totalRounds: 0,
    weaponsUsed: [],
    mapsPlayed: [],
    language: 'vi',
    soundEnabled: true,
  };
}

function copyProfile(profile: PlayerProfile): PlayerProfile {
  return {
    ...profile,
    achievements: { ...profile.achievements },
    personalBests: { ...profile.personalBests },
    weaponsUsed: [...profile.weaponsUsed],
    mapsPlayed: [...profile.mapsPlayed],
  };
}

function readField<K extends keyof PlayerProfile>(profile: PlayerProfile, storage: StorageBackend, field: K): void {
  const { key, parse } = FIELDS[field];

  try {
    const stored = storage.getItem(key);
    if (stored === null) return;

    const value = parse(JSON.parse(stored));
    if (value !== undefined) profile[field] = value;
  } catch {
    // Keep the default for this field and continue loading the other fields.
  }
}

export class ProfileStorage {
  private storage: StorageBackend | undefined;
  private profile: PlayerProfile | undefined;

  constructor(private readonly getStorage: () => StorageBackend | undefined = () => globalThis.localStorage) {}

  load(): PlayerProfile {
    return copyProfile(this.loadSession());
  }

  save(profile: PlayerProfile): void {
    this.loadSession();
    const snapshot = copyProfile(profile);
    this.profile = snapshot;
    for (const field of PROFILE_FIELDS) this.writeField(snapshot, field);
  }

  recordPersonalBest(mapId: MapId, mode: GameMode, score: number): number | undefined {
    const profile = this.loadSession();
    const key = `${mapId}_${mode}`;
    const previous = profile.personalBests[key];
    if (isNonnegativeInteger(score) && (previous === undefined || score > previous)) {
      profile.personalBests[key] = score;
      this.writeField(profile, 'personalBests');
    }
    return previous;
  }

  private writeField(profile: PlayerProfile, field: keyof PlayerProfile): void {
    try {
      this.storage?.setItem(FIELDS[field].key, JSON.stringify(profile[field]));
    } catch {
      // The session copy remains available if writing this field fails.
    }
  }

  private loadSession(): PlayerProfile {
    if (this.profile) return this.profile;

    const profile = createDefaultProfile();
    try {
      this.storage = this.getStorage();
    } catch {
      // Browser storage may throw when accessed.
    }

    if (this.storage) {
      for (const field of PROFILE_FIELDS) {
        readField(profile, this.storage, field);
      }
    }

    this.profile = profile;
    return profile;
  }
}
