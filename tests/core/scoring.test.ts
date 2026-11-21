import { describe, expect, it } from 'vitest';
import { Scoring } from '../../src/core/scoring';
import { EventEmitter, type GameEvents } from '../../src/utils/event-emitter';

describe('Scoring', () => {
  it('awards base points, multiplied points and flying kill totals', () => {
    const events = new EventEmitter();
    const scoreUpdates: GameEvents['SCORE_UPDATED'][] = [];
    const killUpdates: GameEvents['KILL_COUNT_UPDATED'][] = [];
    events.on('SCORE_UPDATED', (event) => scoreUpdates.push(event));
    events.on('KILL_COUNT_UPDATED', (event) => killUpdates.push(event));
    const scoring = new Scoring(events);

    expect(scoring.awardKill('crawling', 1)).toBe(100);
    expect(scoring.awardKill('flying', 1)).toBe(250);
    expect(scoring.awardKill('flying', 3)).toBe(750);
    expect(scoring.awardKill('preflight', 2)).toBe(200);
    expect(scoring.awardKill('idle', 1)).toBe(100);

    expect(scoring.score).toBe(1_400);
    expect(scoring.kills).toBe(5);
    expect(scoring.flyingKills).toBe(2);
    expect(scoreUpdates).toEqual([
      { score: 100, delta: 100 },
      { score: 350, delta: 250 },
      { score: 1_100, delta: 750 },
      { score: 1_300, delta: 200 },
      { score: 1_400, delta: 100 },
    ]);
    expect(killUpdates).toEqual([{ kills: 1 }, { kills: 2 }, { kills: 3 }, { kills: 4 }, { kills: 5 }]);
  });

  it('resets all counters before the next round', () => {
    const scoring = new Scoring(new EventEmitter());
    scoring.awardKill('flying', 2);

    scoring.reset();

    expect(scoring.score).toBe(0);
    expect(scoring.kills).toBe(0);
    expect(scoring.flyingKills).toBe(0);
    expect(scoring.awardKill('crawling', 1)).toBe(100);
    expect(scoring.kills).toBe(1);
  });
});
