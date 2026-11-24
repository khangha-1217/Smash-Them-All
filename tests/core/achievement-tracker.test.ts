import { describe, expect, it } from 'vitest';
import { AchievementTracker } from '../../src/core/achievement-tracker';
import type { PlayerProfile, RoundResult } from '../../src/core/types';
import { EventEmitter } from '../../src/utils/event-emitter';
import { ProfileStorage } from '../../src/utils/storage';

const base: RoundResult = {
  mapId: 'kitchen', weaponId: 'slipper', mode: 'normal',
  timeRemaining: 0, score: 300, kills: 3, flyingKills: 0, swings: 4, hits: 3,
  nearMisses: 0, maxCombo: 1, rank: 'C', nextRank: null, accuracy: 0.75, misses: 1,
};

function setup(profile: Partial<PlayerProfile> = {}) {
  const fields = new Map<string, string>([
    ['smash_em_all_achievements', JSON.stringify(profile.achievements ?? {})],
    ['smash_em_all_total_rounds', JSON.stringify(profile.totalRounds ?? 0)],
    ['smash_em_all_weapons_used', JSON.stringify(profile.weaponsUsed ?? [])],
    ['smash_em_all_maps_played', JSON.stringify(profile.mapsPlayed ?? [])],
  ]);
  const backend = {
    getItem: (key: string) => fields.get(key) ?? null,
    setItem: (key: string, value: string) => { fields.set(key, value); },
  };
  const storage = new ProfileStorage(() => backend);
  const events = new EventEmitter();
  const tracker = new AchievementTracker(storage, events);
  return { tracker, storage, events, reload: () => new ProfileStorage(() => backend) };
}

describe('achievement tracker', () => {
  it.each<[Partial<RoundResult>, Partial<PlayerProfile>, string[]]>([
    [{ rank: 'S' }, {}, ['golden_slipper']],
    [{ nearMisses: 10, misses: 10, swings: 13 }, {}, ['near_miss_master']],
    [{ maxCombo: 10, kills: 10, hits: 10, swings: 11 }, {}, ['combo_machine']],
    [{ flyingKills: 5, kills: 5, hits: 5, swings: 6 }, {}, ['fly_swatter']],
    [{ misses: 0, kills: 15, hits: 15, swings: 15 }, {}, ['perfect_aim']],
    [{ kills: 2, hits: 2, swings: 3 }, {}, ['pacifist']],
    [{ weaponId: 'cardboard' }, { weaponsUsed: ['slipper', 'flyswatter'] }, ['collector']],
    [{ mapId: 'bedroom' }, { mapsPlayed: ['kitchen', 'livingroom'] }, ['tourist']],
    [{}, { totalRounds: 29 }, ['night_owl']],
    [{ rank: 'S', mode: 'hell' }, {}, ['golden_slipper', 'hell_lord']],
  ])('unlocks badges at their qualifying thresholds (%#)', (stats, profile, expected) => {
    const { tracker } = setup(profile);
    expect(tracker.completeRound({ ...base, ...stats })).toEqual(expected);
  });

  it.each<[Partial<RoundResult>, Partial<PlayerProfile>]>([
    [{ rank: 'A', mode: 'hell' }, {}],
    [{ nearMisses: 9, misses: 9, swings: 12 }, {}],
    [{ maxCombo: 9, kills: 9, hits: 9, swings: 10 }, {}],
    [{ flyingKills: 4, kills: 4, hits: 4, swings: 5 }, {}],
    [{ misses: 0, kills: 14, hits: 14, swings: 14 }, {}],
    [{ kills: 15, hits: 15, swings: 16 }, {}],
    [{ weaponId: 'flyswatter' }, { weaponsUsed: ['slipper', 'slipper'] }],
    [{ mapId: 'livingroom' }, { mapsPlayed: ['kitchen', 'kitchen'] }],
    [{}, { totalRounds: 28 }],
  ])('keeps a badge locked below the threshold (%#)', (stats, profile) => {
    expect(setup(profile).tracker.completeRound({ ...base, ...stats })).toEqual([]);
  });

  it('evaluates near-misses independently for each round', () => {
    const { tracker } = setup();
    const result = { ...base, nearMisses: 5, misses: 5, swings: 8 };
    expect(tracker.completeRound(result)).toEqual([]);
    expect(tracker.completeRound({ ...result })).toEqual([]);
  });

  it('persists history and emits an unlock only once, including across tracker recreation', () => {
    const { tracker, events, reload } = setup();
    const names: string[] = [];
    events.on('ACHIEVEMENT_UNLOCKED', ({ nameVi, nameEn, flavorVi, flavorEn }) => {
      expect(flavorVi).toBe('Đập trượt cũng là nghệ thuật');
      expect(flavorEn).toBeTruthy();
      names.push(nameVi, nameEn);
    });
    const result = { ...base, nearMisses: 10, misses: 10, swings: 13 };
    expect(tracker.completeRound(result)).toEqual(['near_miss_master']);
    expect(tracker.completeRound({ ...result })).toEqual([]);
    expect(new AchievementTracker(reload(), events).completeRound({ ...result })).toEqual([]);
    expect(names).toEqual(['Bậc thầy vẽ viền', 'Outline Artist']);
    expect(reload().load()).toMatchObject({
      achievements: { near_miss_master: true }, totalRounds: 3,
      weaponsUsed: ['slipper'], mapsPlayed: ['kitchen'],
    });
  });

  it('keeps unlocks and history in the current session if storage is unavailable', () => {
    const storage = new ProfileStorage(() => { throw new Error('storage denied'); });
    const tracker = new AchievementTracker(storage, new EventEmitter());
    expect(tracker.completeRound({ ...base, rank: 'S' })).toEqual(['golden_slipper']);
    expect(tracker.completeRound({ ...base, rank: 'S' })).toEqual([]);
    expect(storage.load()).toMatchObject({ achievements: { golden_slipper: true }, totalRounds: 2 });
  });

  it('counts both tabs’ completions and keeps their unlocked badges and selections', () => {
    const { tracker, reload } = setup({ totalRounds: 28 });
    const otherStorage = reload();
    otherStorage.load();
    const otherTab = new AchievementTracker(otherStorage, new EventEmitter());

    expect(tracker.completeRound({ ...base, rank: 'S' })).toEqual(['golden_slipper']);
    const unlocked = otherTab.completeRound({ ...base, rank: 'S', mapId: 'bedroom', weaponId: 'cardboard' });

    expect(reload().load()).toMatchObject({
      achievements: { golden_slipper: true, night_owl: true },
      totalRounds: 30,
      weaponsUsed: ['slipper', 'cardboard'],
      mapsPlayed: ['kitchen', 'bedroom'],
    });
    expect(unlocked).toEqual(['night_owl']);
  });

  it('compares a score to the latest personal best and preserves other boards', () => {
    const { storage, reload } = setup();
    const otherTab = reload();
    otherTab.load();
    storage.recordPersonalBest('kitchen', 'normal', 1_200);

    expect(otherTab.recordPersonalBest('kitchen', 'normal', 900)).toBe(1_200);
    otherTab.recordPersonalBest('bedroom', 'hell', 500);

    expect(reload().load().personalBests).toEqual({ kitchen_normal: 1_200, bedroom_hell: 500 });
  });
});
