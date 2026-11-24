import type { GameMode, NextRankHint, Rank } from './types';

const thresholds: Record<GameMode, Record<Exclude<Rank, 'C'>, number>> = {
  normal: { S: 8_000, A: 5_000, B: 3_000 },
  hell: { S: 12_000, A: 8_000, B: 5_000 },
};

export function calculateRank(score: number, mode: GameMode): { rank: Rank; nextRank: NextRankHint | null } {
  const { S, A, B } = thresholds[mode];
  if (score >= S) return { rank: 'S', nextRank: null };
  if (score >= A) return { rank: 'A', nextRank: { rank: 'S', pointsNeeded: S - score } };
  if (score >= B) return { rank: 'B', nextRank: { rank: 'A', pointsNeeded: A - score } };
  return { rank: 'C', nextRank: { rank: 'B', pointsNeeded: B - score } };
}
