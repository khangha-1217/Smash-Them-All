import { describe, expect, it } from 'vitest';
import { calculateRank } from '../../src/core/ranking';
import type { GameMode, Rank } from '../../src/core/types';

const examples: Array<[GameMode, number, Rank, Exclude<Rank, 'C'> | null, number]> = [
  ['normal', 0, 'C', 'B', 3_000],
  ['normal', 2_999, 'C', 'B', 1],
  ['normal', 3_000, 'B', 'A', 2_000],
  ['normal', 4_999, 'B', 'A', 1],
  ['normal', 5_000, 'A', 'S', 3_000],
  ['normal', 7_999, 'A', 'S', 1],
  ['normal', 8_000, 'S', null, 0],
  ['normal', 10_000, 'S', null, 0],
  ['hell', 0, 'C', 'B', 5_000],
  ['hell', 4_999, 'C', 'B', 1],
  ['hell', 5_000, 'B', 'A', 3_000],
  ['hell', 7_999, 'B', 'A', 1],
  ['hell', 8_000, 'A', 'S', 4_000],
  ['hell', 11_999, 'A', 'S', 1],
  ['hell', 12_000, 'S', null, 0],
  ['hell', 15_000, 'S', null, 0],
];

describe('calculateRank', () => {
  it.each(examples)('classifies %s score %i as %s with its next-rank points', (mode, score, rank, next, pointsNeeded) => {
    expect(calculateRank(score, mode)).toEqual({
      rank,
      nextRank: next ? { rank: next, pointsNeeded } : null,
    });
  });
});
