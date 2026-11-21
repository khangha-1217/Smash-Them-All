import { describe, expect, it } from 'vitest';
import { RoundController } from '../../src/core/round';
import type { RoundOptions } from '../../src/core/round';
import { COMBO_WINDOW_MS, SWING_DURATION_MS } from '../../src/core/types';
import type { MapData, RoundConfig, Vec3 } from '../../src/core/types';
import { EventEmitter } from '../../src/utils/event-emitter';
import type { GameEvents } from '../../src/utils/event-emitter';

const selection: RoundConfig = { mapId: 'kitchen', mode: 'normal', weaponId: 'slipper' };
const origin = { x: 0, y: 0, z: 0 };
const forward = { x: 0, y: 0, z: 1 };
const backward = { x: 0, y: 0, z: -1 };
const target = { x: 0, y: 0, z: 1 };

function point(position: Vec3) {
  return { position, surfaceType: 'floor', surfaceNormal: { x: 0, y: 1, z: 0 } };
}

const mapData: Pick<MapData, 'spawnPoints' | 'waypoints'> = {
  spawnPoints: [point(target)],
  waypoints: [],
};

function setup(options: RoundOptions = { random: () => 0 }, events = new EventEmitter()) {
  const round = new RoundController(events, options);
  function record<K extends keyof GameEvents>(name: K): GameEvents[K][] {
    const payloads: GameEvents[K][] = [];
    events.on(name, (payload) => payloads.push(payload));
    return payloads;
  }
  function start(data = mapData, mode = selection.mode) {
    expect(round.configure({ ...selection, mode })).toBe(true);
    expect(round.ready(data)).toBe(true);
    expect(round.start()).toBe(true);
  }
  return { events, record, round, start };
}

describe('Hell rounds', () => {
  it.each([[5, 25], [32, 32], [55, 40], [NaN, 32]])('bounds the Hell pool at %s to %s active cockroaches', (hellPoolSize, expected) => {
    const { record, start } = setup({ hellPoolSize, random: () => 0 });
    const spawns = record('COCKROACH_SPAWNED');

    start(mapData, 'hell');

    expect(spawns).toHaveLength(expected);
  });

  it('warns before takeoff and freezes preflight and flight during pause', () => {
    const { record, round, start } = setup({ hellPoolSize: 25, random: () => 0 });
    const preflights = record('COCKROACH_PREFLIGHT');
    const flights = record('COCKROACH_FLYING');
    const movement = record('COCKROACH_MOVED');
    start(mapData, 'hell');
    round.updatePlayerPosition({ x: 0, y: 1.6, z: 3 });

    round.tick(2_999);
    expect(preflights).toHaveLength(0);
    round.tick(1);
    expect(preflights).toHaveLength(25);
    expect(preflights[0]).toEqual({ cockroachId: 0, position: target });
    round.tick(1_499);
    expect(flights).toHaveLength(0);
    round.pause();
    round.tick(5_000);
    expect(flights).toHaveLength(0);
    round.resume();
    round.tick(1);
    expect(flights).toHaveLength(25);
    expect(flights[0]).toMatchObject({ cockroachId: 0, position: target });
    expect(flights[0].velocity.y).toBeGreaterThan(0);

    round.tick(100);
    const flyingPosition = movement.at(-1);
    expect(flyingPosition?.state).toBe('flying');
    expect(flyingPosition?.position).not.toEqual(target);
    round.pause();
    round.tick(5_000);
    expect(movement.at(-1)).toEqual(flyingPosition);
  });

  it('accepts an edge hit only after takeoff and awards 250 base points', () => {
    const { record, round, start } = setup({ hellPoolSize: 25, random: () => 0 });
    const hits = record('COCKROACH_HIT');
    const spawnPoints = [point({ x: 0.08, y: 0, z: 0.001 })];
    start({ spawnPoints, waypoints: [] }, 'hell');

    round.tick(4_000);
    round.swing(origin, forward);
    expect(hits).toHaveLength(0);
    round.tick(500);
    round.swing(origin, forward);

    expect(hits).toEqual([expect.objectContaining({ points: 250, comboMultiplier: 1 })]);
    expect(round.stats).toMatchObject({ score: 250, kills: 1, flyingKills: 1 });
  });

  it('awards ground points for hitting a cockroach during preflight', () => {
    const { record, round, start } = setup();
    const hits = record('COCKROACH_HIT');
    const preflights = record('COCKROACH_PREFLIGHT');
    const flights = record('COCKROACH_FLYING');
    start(mapData, 'hell');

    round.tick(3_000);
    expect(preflights[0]?.cockroachId).toBe(0);
    round.swing(origin, forward);
    round.tick(1_500);

    expect(hits).toEqual([expect.objectContaining({ cockroachId: 0, points: 100 })]);
    expect(flights.some(({ cockroachId }) => cockroachId === 0)).toBe(false);
    expect(round.stats).toMatchObject({ score: 100, kills: 1, flyingKills: 0 });
  });

  it('recycles each completed flight once at another spawn without awarding a kill or points', () => {
    const { record, round, start } = setup({ hellPoolSize: 25, random: () => 0 });
    const contact = record('COCKROACH_DESPAWNED');
    const hits = record('COCKROACH_HIT');
    const scores = record('SCORE_UPDATED');
    const spawns = record('COCKROACH_SPAWNED');
    const moves = record('COCKROACH_MOVED');
    const secondSpawn = { x: 3, y: 0, z: 1 };
    start({ spawnPoints: [point(target), point(secondSpawn)], waypoints: [] }, 'hell');

    const camera = { x: 1, y: 1.6, z: 3 };
    round.updatePlayerPosition(camera);
    camera.x = 8;
    round.updatePlayerPosition({ x: 1, y: NaN, z: 3 });
    round.tick(6_499);
    expect(contact).toHaveLength(0);
    round.tick(1);
    expect(contact).toHaveLength(25);
    expect(contact[0]).toEqual({ cockroachId: 0, reason: 'reached_player' });
    expect(new Set(contact.map(event => event.cockroachId)).size).toBe(25);
    expect(hits).toEqual([]);
    expect(scores).toEqual([]);
    expect(round.stats).toMatchObject({ score: 0, kills: 0, flyingKills: 0 });
    expect(round.state).toBe('PLAYING');
    expect(moves.at(-1)?.position).toEqual({ x: 0.84, y: 1.5, z: 2.84 });

    round.tick(350);
    expect(spawns).toHaveLength(50);
    expect(spawns.slice(25).every(({ position }) => position.x === secondSpawn.x)).toBe(true);
    expect(contact).toHaveLength(25);
  });
});

describe('RoundController', () => {
  it('starts only from READY, then emits one start and one completed result on expiry', () => {
    const { record, round } = setup();
    const started = record('ROUND_STARTED');
    const ended = record('ROUND_ENDED');

    expect(round.start()).toBe(false);
    expect(round.pause()).toBe(false);
    expect(round.resume()).toBe(false);
    expect(round.configure(selection)).toBe(true);
    expect(round.configure({ ...selection, weaponId: 'flyswatter' })).toBe(false);
    expect(round.start()).toBe(false);
    expect(round.ready(mapData)).toBe(true);
    expect(round.start()).toBe(true);
    expect(round.start()).toBe(false);
    round.tick(89_999);
    expect(round.state).toBe('PLAYING');
    expect(ended).toEqual([]);
    round.tick(500);
    round.tick(500);

    expect(round.state).toBe('GAME_OVER');
    expect(round.swing(origin, forward)).toBe(false);
    expect(started).toEqual([selection]);
    expect(ended).toEqual([{
      roundResult: {
        ...selection, timeRemaining: 0, score: 0, kills: 0, flyingKills: 0, swings: 0,
        hits: 0, nearMisses: 0, maxCombo: 1, rank: 'C', accuracy: 0, misses: 0,
        nextRank: { rank: 'B', pointsNeeded: 3_000 },
      },
    }]);
  });

  it('rejects swings during lockout and never queues rejected input', () => {
    const { record, round, start } = setup();
    const swings = record('WEAPON_SWING');
    const misses = record('WEAPON_MISS');
    const hits = record('COCKROACH_HIT');
    const nearMisses = record('COCKROACH_NEAR_MISS');

    expect(round.swing(origin, backward)).toBe(false);
    start();
    expect(round.swing(origin, backward)).toBe(true);
    expect(round.swing(origin, forward)).toBe(false);
    round.tick(SWING_DURATION_MS - 1);
    expect(round.swing(origin, forward)).toBe(false);
    round.tick(1);
    expect(swings).toEqual([{ position: origin, direction: backward }]);
    expect(round.swing(origin, backward)).toBe(true);

    expect(swings).toEqual(Array(2).fill({ position: origin, direction: backward }));
    expect(misses).toEqual(swings);
    expect(hits).toEqual([]);
    expect(nearMisses).toEqual([]);
    expect(round.stats).toMatchObject({ swings: 2, hits: 0, nearMisses: 0, score: 0 });
  });

  it('emits one hit outcome per accepted hit and scores consecutive hits with the current combo', () => {
    const { events, record, round, start } = setup();
    const order: string[] = [];
    events.on('WEAPON_SWING', () => order.push('swing'));
    events.on('COCKROACH_HIT', () => order.push('hit'));
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    const dropped = record('COCKROACH_DESPAWNED');
    start();

    expect(round.swing(origin, forward)).toBe(true);
    round.tick(SWING_DURATION_MS);
    expect(round.swing(origin, forward)).toBe(true);

    expect(order).toEqual(['swing', 'hit', 'swing', 'hit']);
    expect(hits).toEqual([
      { cockroachId: 0, position: target, points: 100, comboMultiplier: 1 },
      { cockroachId: 1, position: target, points: 200, comboMultiplier: 2 },
    ]);
    expect(dropped).toEqual([
      { cockroachId: 0, reason: 'killed' }, { cockroachId: 1, reason: 'killed' },
    ]);
    expect(misses).toEqual([]);
    expect(round.stats).toMatchObject({ score: 300, kills: 2, swings: 2, hits: 2, maxCombo: 2 });
  });

  it('emits near-miss target data in addition to a single miss and breaks the combo', () => {
    const { events, record, round, start } = setup();
    const ended = record('ROUND_ENDED');
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    const nearMisses = record('COCKROACH_NEAR_MISS');
    const order: string[] = [];
    events.on('WEAPON_SWING', () => order.push('swing'));
    events.on('WEAPON_MISS', () => order.push('miss'));
    events.on('COCKROACH_NEAR_MISS', () => order.push('near'));
    const almost = { x: -0.1, y: 0, z: 0.98 };
    start();

    round.swing(origin, forward);
    round.tick(SWING_DURATION_MS);
    round.swing(almost, forward);
    round.tick(SWING_DURATION_MS);
    round.swing(origin, forward);
    round.tick(90_000);

    expect(order).toEqual(['swing', 'swing', 'miss', 'near', 'swing']);
    expect(misses).toEqual([{ position: almost, direction: forward }]);
    expect(nearMisses).toEqual([{ cockroachId: 1, position: target, distance: 0.1 }]);
    expect(hits.map(({ comboMultiplier }) => comboMultiplier)).toEqual([1, 1]);
    expect(ended[0].roundResult).toMatchObject({
      hits: 2, swings: 3, nearMisses: 1, misses: 1, accuracy: 2 / 3, score: 200,
    });
  });

  it('recycles only the eliminated slot and cannot score it while it is inactive', () => {
    let draws = 0;
    const { record, round, start } = setup({ random: () => draws++ === 0 ? 0 : 0.75 });
    const spawned = record('COCKROACH_SPAWNED');
    const moves = record('COCKROACH_MOVED');
    const hits = record('COCKROACH_HIT');
    const distant = point({ x: 0, y: 0, z: 5 });
    start({ ...mapData, spawnPoints: [point(target), distant] });
    const initialCount = spawned.length;

    round.swing(origin, forward);
    round.tick(SWING_DURATION_MS);
    round.swing(origin, forward);
    expect(hits).toHaveLength(1);
    round.tick(1_000);

    expect(spawned).toHaveLength(initialCount + 1);
    expect(spawned.at(-1)).toEqual({ cockroachId: 0, position: distant.position, surfaceType: 'floor' });
    expect(moves.every(({ cockroachId }) => cockroachId !== 0)).toBe(true);
    expect(round.stats).toMatchObject({ kills: 1, swings: 2, hits: 1, score: 100 });
  });

  it('freezes timer, combo, movement, pending respawns and swing lockout while paused', () => {
    const { record, round, start } = setup();
    const spawned = record('COCKROACH_SPAWNED');
    const moved = record('COCKROACH_MOVED');
    const resets = record('COMBO_RESET');
    const ticks = record('TIMER_TICK');
    const hits = record('COCKROACH_HIT');
    start({ ...mapData, waypoints: [point({ x: 1, y: 0, z: 1 })] });
    round.swing(origin, forward);
    round.tick(SWING_DURATION_MS - 1);
    const beforePause = round.stats;
    const countsBeforePause = [spawned.length, moved.length, ticks.length];

    expect(round.pause()).toBe(true);
    round.tick(10_000);
    expect(round.swing(origin, forward)).toBe(false);
    expect(round.stats).toEqual(beforePause);
    expect([spawned.length, moved.length, ticks.length]).toEqual(countsBeforePause);
    expect(resets).toEqual([]);
    expect(round.resume()).toBe(true);
    expect(round.swing(origin, forward)).toBe(false);
    round.tick(1);
    expect(round.swing(origin, forward)).toBe(true);
    expect(hits.at(-1)?.comboMultiplier).toBe(2);

    round.tick(100);
    expect(moved.some(({ position, state }) => position.x > 0 && state === 'crawling')).toBe(true);
    round.tick(COMBO_WINDOW_MS + 1);
    expect(resets).toHaveLength(1);
    expect(spawned.length).toBeGreaterThan(countsBeforePause[0]);
  });

  it('uses a tunable Normal pool and resets score, timers and pending respawns on replay', () => {
    const { record, round, start } = setup({ random: () => 0, normalPoolSize: 15 });
    const spawned = record('COCKROACH_SPAWNED');
    const started = record('ROUND_STARTED');
    const hits = record('COCKROACH_HIT');
    start();
    expect(new Set(spawned.map(({ cockroachId }) => cockroachId)).size).toBe(15);
    expect(round.replay()).toBe(false);
    round.swing(origin, forward);
    round.tick(90_000);

    expect(round.replay()).toBe(true);
    expect(round.ready(mapData)).toBe(true);
    expect(round.start()).toBe(true);

    expect(started).toEqual([selection, selection]);
    expect(spawned).toHaveLength(30);
    expect(round.stats).toMatchObject({
      ...selection, timeRemaining: 90, score: 0, kills: 0, swings: 0, hits: 0, nearMisses: 0,
      maxCombo: 1, rank: null,
    });
    expect(round.swing(origin, forward)).toBe(true);
    expect(hits.at(-1)).toMatchObject({ cockroachId: 0, points: 100, comboMultiplier: 1 });
  });

  it('falls back to a playable population when the Normal pool setting is nonfinite', () => {
    const { record, start } = setup({ random: () => 0, normalPoolSize: Number.NaN });
    const spawned = record('COCKROACH_SPAWNED');
    start();

    expect(spawned.length).toBeGreaterThanOrEqual(15);
    expect(spawned.length).toBeLessThanOrEqual(25);
  });

  it('quits a paused run without completing it and starts cleanly with a new selection', () => {
    const { record, round, start } = setup();
    const ended = record('ROUND_ENDED');
    const spawned = record('COCKROACH_SPAWNED');
    start();
    const initialCount = spawned.length;
    expect(initialCount).toBeGreaterThanOrEqual(15);
    expect(initialCount).toBeLessThanOrEqual(25);
    expect(round.quit()).toBe(false);
    round.swing(origin, forward);
    round.pause();

    expect(round.quit()).toBe(true);
    expect(round.state).toBe('MENU');
    expect(round.stats).toBeNull();
    round.tick(100_000);
    expect(spawned).toHaveLength(initialCount);
    expect(ended).toEqual([]);

    expect(round.configure({ ...selection, weaponId: 'flyswatter' })).toBe(true);
    round.ready(mapData);
    round.start();
    expect(spawned).toHaveLength(initialCount * 2);
    expect(round.stats).toMatchObject({ weaponId: 'flyswatter', kills: 0, score: 0 });
  });

  it('returns to the menu after a failed load, preserving selection for a retry', () => {
    const { record, round } = setup();
    const started = record('ROUND_STARTED');
    const ended = record('ROUND_ENDED');

    expect(round.configure(selection)).toBe(true);
    expect(round.failLoad()).toBe(true);
    expect(round.state).toBe('MENU');
    expect(round.selection).toEqual(selection);
    expect(round.ready(mapData)).toBe(false);
    round.tick(90_000);
    expect(started).toEqual([]);
    expect(ended).toEqual([]);

    expect(round.configure(selection)).toBe(true);
    expect(round.ready({ ...mapData, spawnPoints: [] })).toBe(false);
    expect(round.state).toBe('MENU');
    expect(round.failLoad()).toBe(false);
  });

  it('delivers the accepted swing and its hit when a swing listener throws', () => {
    const errors: Array<{ error: unknown; event: string }> = [];
    const failure = new Error('weapon animation failed');
    const events = new EventEmitter((error, event) => errors.push({ error, event }));
    events.on('WEAPON_SWING', () => { throw failure; });
    const { record, round, start } = setup(undefined, events);
    const swings = record('WEAPON_SWING');
    const hits = record('COCKROACH_HIT');
    start();

    expect(round.swing(origin, forward)).toBe(true);

    expect(errors).toEqual([{ error: failure, event: 'WEAPON_SWING' }]);
    expect(swings).toEqual([{ position: origin, direction: forward }]);
    expect(hits).toHaveLength(1);
    expect(round.stats).toMatchObject({ swings: 1, hits: 1, kills: 1 });
  });

  it('completes once at zero when the timer listener and its error reporter throw', () => {
    const failure = new Error('timer display failed');
    const errors: unknown[] = [];
    const events = new EventEmitter((error) => {
      errors.push(error);
      throw new Error('error reporter failed');
    });
    events.on('TIMER_TICK', ({ timeRemaining }) => {
      if (timeRemaining === 0) throw failure;
    });
    const { record, round, start } = setup(undefined, events);
    const ticks = record('TIMER_TICK');
    const ended = record('ROUND_ENDED');
    start();

    round.tick(90_000);
    round.tick(90_000);

    expect(errors).toEqual([failure]);
    expect(ticks.at(-1)).toEqual({ timeRemaining: 0 });
    expect(round.state).toBe('GAME_OVER');
    expect(ended).toHaveLength(1);
    expect(ended[0].roundResult.timeRemaining).toBe(0);
  });
  it('finishes the accepted swing if an event subscriber tries to advance or interrupt it', () => {
    const { events, record, round, start } = setup();
    const hits = record('COCKROACH_HIT');
    const ended = record('ROUND_ENDED');
    events.on('WEAPON_SWING', () => {
      round.tick(90_000);
      round.swing(origin, forward);
      round.pause();
    });
    start();

    expect(round.swing(origin, forward)).toBe(true);
    expect(round.state).toBe('PLAYING');
    expect(hits).toHaveLength(1);
    expect(round.stats).toMatchObject({ hits: 1, swings: 1, timeRemaining: 90 });
    expect(ended).toEqual([]);
  });
});
