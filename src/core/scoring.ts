import type { EventEmitter } from '../utils/event-emitter';
import type { CockroachState } from './types';

export function basePointsFor(state: CockroachState): number {
  return state === 'flying' ? 250 : 100;
}

export class Scoring {
  private totalScore = 0;
  private totalKills = 0;
  private totalFlyingKills = 0;

  constructor(private readonly events: EventEmitter) {}

  get score(): number {
    return this.totalScore;
  }

  get kills(): number {
    return this.totalKills;
  }

  get flyingKills(): number {
    return this.totalFlyingKills;
  }

  awardKill(state: CockroachState, multiplier: number): number {
    const points = basePointsFor(state) * multiplier;
    this.totalScore += points;
    this.totalKills++;
    if (state === 'flying') this.totalFlyingKills++;

    this.events.emit('SCORE_UPDATED', { score: this.totalScore, delta: points });
    this.events.emit('KILL_COUNT_UPDATED', { kills: this.totalKills });
    return points;
  }

  reset(): void {
    this.totalScore = 0;
    this.totalKills = 0;
    this.totalFlyingKills = 0;
  }
}
