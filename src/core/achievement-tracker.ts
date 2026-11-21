import type { Achievement, MapId, PlayerProfile, RoundResult, WeaponId } from './types';
import en from '../i18n/locales/en.json';
import vi from '../i18n/locales/vi.json';
import type { EventEmitter } from '../utils/event-emitter';
import type { ProfilePersistence } from '../utils/storage';

const WEAPONS: readonly WeaponId[] = ['slipper', 'flyswatter', 'cardboard'];
const MAPS: readonly MapId[] = ['kitchen', 'livingroom', 'bedroom'];

const CONDITIONS = {
  golden_slipper: (round) => round.rank === 'S',
  near_miss_master: (round) => round.nearMisses >= 10,
  combo_machine: (round) => round.maxCombo >= 10,
  fly_swatter: (round) => round.flyingKills >= 5,
  perfect_aim: (round) => round.misses === 0 && round.kills >= 15,
  pacifist: (round) => round.kills < 3,
  collector: (_round, profile) => WEAPONS.every(id => profile.weaponsUsed.includes(id)),
  tourist: (_round, profile) => MAPS.every(id => profile.mapsPlayed.includes(id)),
  night_owl: (_round, profile) => profile.totalRounds >= 30,
  hell_lord: (round) => round.rank === 'S' && round.mode === 'hell',
} satisfies Record<string, (round: RoundResult, profile: PlayerProfile) => boolean>;

export type AchievementId = keyof typeof CONDITIONS;

type Badge = Omit<Achievement, 'id' | 'condition' | 'unlocked'> & {
  id: AchievementId;
  condition: (round: RoundResult, profile: PlayerProfile) => boolean;
};

const BADGES: readonly Badge[] = (Object.keys(CONDITIONS) as AchievementId[]).map(id => ({
  id,
  nameVi: vi[`achievement.${id}.name`],
  nameEn: en[`achievement.${id}.name`],
  flavorVi: vi[`achievement.${id}.flavor`],
  flavorEn: en[`achievement.${id}.flavor`],
  condition: CONDITIONS[id],
}));

export const ACHIEVEMENT_IDS: readonly AchievementId[] = BADGES.map(badge => badge.id);

export class AchievementTracker {
  constructor(private readonly storage: ProfilePersistence, private readonly events: EventEmitter) {}

  completeRound(result: RoundResult): AchievementId[] {
    const profile = this.storage.load();
    profile.totalRounds++;
    profile.weaponsUsed = [...new Set([...profile.weaponsUsed, result.weaponId])];
    profile.mapsPlayed = [...new Set([...profile.mapsPlayed, result.mapId])];

    const newlyUnlocked = BADGES.filter(badge => (
      !profile.achievements[badge.id] && badge.condition(result, profile)
    ));
    for (const { id } of newlyUnlocked) profile.achievements[id] = true;
    this.storage.save(profile);

    for (const { id, nameVi, nameEn, flavorVi, flavorEn } of newlyUnlocked) {
      this.events.emit('ACHIEVEMENT_UNLOCKED', { achievementId: id, nameVi, nameEn, flavorVi, flavorEn });
    }
    return newlyUnlocked.map(badge => badge.id);
  }
}
