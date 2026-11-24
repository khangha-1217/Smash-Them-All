import { describe, expect, it } from 'vitest';
import { RoundController } from '../../src/core/round';
import type { RoundOptions } from '../../src/core/round';
import { COMBO_WINDOW_MS, ROUND_DURATION_MS, SWING_DURATION_MS } from '../../src/core/types';
import type { MapData, RoundConfig, Vec3 } from '../../src/core/types';
import { EventEmitter } from '../../src/utils/event-emitter';
import type { GameEvents } from '../../src/utils/event-emitter';

const selection: RoundConfig = { mapId: 'kitchen', mode: 'normal', weaponId: 'slipper' };
const origin = { x: 0, y: 0, z: 0 };
const forward = { x: 0, y: 0, z: 1 };
const backward = { x: 0, y: 0, z: -1 };
const target = { x: 0, y: 0, z: 1 };
const contactMs = 100;

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
  function start(data = mapData, mode = selection.mode, weaponId = selection.weaponId) {
    expect(round.configure({ ...selection, mode, weaponId })).toBe(true);
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
    round.tick(400);
    round.swing(origin, forward);
    round.tick(contactMs);

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

  it('lets a swing hit a replacement after flight arrival regardless of tick size', () => {
    function contactAfter(ticks: number[]) {
      const { record, round, start } = setup({ hellPoolSize: 25, random: () => 0 });
      const contacts = record('WEAPON_CONTACT');
      const hits = record('COCKROACH_HIT');
      start(mapData, 'hell');
      for (const tick of ticks) round.tick(tick);

      expect(round.swing(origin, forward)).toBe(true);
      round.tick(contactMs);

      return { contacts, hits };
    }

    const partitioned = contactAfter([6_500, 350, 150]);

    expect(partitioned.contacts).toEqual([{ outcome: 'hit' }]);
    expect(partitioned.hits).toEqual([
      expect.objectContaining({ position: target, points: 100, comboMultiplier: 1 }),
    ]);
    expect(contactAfter([7_000])).toEqual(partitioned);
  });
});

describe('RoundController', () => {
  it('publishes actual ground speed and a held heading without mutating earlier movement events', () => {
    const { record, round, start } = setup();
    const moves = record('COCKROACH_MOVED');
    start({ ...mapData, waypoints: [point({ x: 1, y: 0, z: 1 }), point(target)] });

    round.tick(300);
    round.tick(1_500);
    const moving = moves.filter(event => event.cockroachId === 0).at(-1);
    round.tick(1_500);
    const parked = moves.filter(event => event.cockroachId === 0).at(-1);
    round.tick(300);
    round.tick(1_500);
    const returning = moves.filter(event => event.cockroachId === 0).at(-1);

    expect(moving).toMatchObject({ state: 'crawling', groundFacing: { x: 1, y: 0, z: 0 }, speed: 0.5 });
    expect(parked).toMatchObject({ state: 'idle', groundFacing: { x: 1, y: 0, z: 0 }, speed: 0 });
    expect(returning).toMatchObject({ state: 'crawling', groundFacing: { x: -1, y: 0, z: 0 }, speed: 0.5 });
  });

  it.each([
    { mode: 'normal', run: 'initial' },
    { mode: 'hell', run: 'initial' },
    { mode: 'normal', run: 'replay' },
    { mode: 'hell', run: 'replay' },
  ] as const)('gives the $mode $run round exactly 60 seconds of active play', ({ mode, run }) => {
    const { record, round, start } = setup();
    start(mapData, mode);
    if (run === 'replay') {
      round.tick(100_000);
      expect(round.replay()).toBe(true);
      expect(round.ready(mapData)).toBe(true);
      expect(round.start()).toBe(true);
    }

    const ended = record('ROUND_ENDED');
    const ticks = record('TIMER_TICK');
    expect(round.stats?.timeRemaining).toBe(60);
    round.tick(59_999);
    expect(round.state).toBe('PLAYING');
    expect(round.stats?.timeRemaining).toBeCloseTo(0.001, 6);
    expect(ended).toHaveLength(0);

    expect(round.pause()).toBe(true);
    const tickCount = ticks.length;
    round.tick(10_000);
    expect(round.stats?.timeRemaining).toBeCloseTo(0.001, 6);
    expect(ticks).toHaveLength(tickCount);
    expect(ended).toHaveLength(0);

    expect(round.resume()).toBe(true);
    round.tick(1);
    expect(round.state).toBe('GAME_OVER');
    expect(ended).toMatchObject([{ roundResult: { ...selection, mode, timeRemaining: 0 } }]);
    round.tick(1_000);
    expect(ended).toHaveLength(1);
  });

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
    round.tick(100_000);
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

  it.each(['slipper', 'flyswatter', 'cardboard'] as const)('applies the 300 ms lockout to %s without queuing rejected input', (weaponId) => {
    const { record, round, start } = setup();
    const swings = record('WEAPON_SWING');
    const contacts = record('WEAPON_CONTACT');
    const misses = record('WEAPON_MISS');
    const hits = record('COCKROACH_HIT');
    const nearMisses = record('COCKROACH_NEAR_MISS');

    expect(round.swing(origin, backward)).toBe(false);
    start(mapData, 'normal', weaponId);
    expect(round.swing(origin, backward)).toBe(true);
    expect(misses).toEqual([]);
    expect(round.swing(origin, forward)).toBe(false);
    round.tick(299);
    expect(round.swing(origin, forward)).toBe(false);
    round.tick(1);
    expect(swings).toEqual([{ position: origin, direction: backward }]);
    expect(round.swing(origin, backward)).toBe(true);
    round.tick(contactMs);

    expect(swings).toEqual(Array(2).fill({ position: origin, direction: backward }));
    expect(contacts).toEqual([{ outcome: 'miss' }, { outcome: 'miss' }]);
    expect(misses).toEqual(swings);
    expect(hits).toEqual([]);
    expect(nearMisses).toEqual([]);
    expect(round.stats).toMatchObject({ swings: 2, hits: 0, nearMisses: 0, score: 0 });
  });

  it.each([
    { direction: forward, outcome: 'hit', hitsAtContact: 1, missesAtContact: 0 },
    { direction: backward, outcome: 'miss', hitsAtContact: 0, missesAtContact: 1 },
  ])('resolves one $outcome at contact after windup', ({ direction, outcome, hitsAtContact, missesAtContact }) => {
    const { events, record, round, start } = setup();
    const swings = record('WEAPON_SWING');
    const contacts = record('WEAPON_CONTACT');
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    const score = record('SCORE_UPDATED');
    const order: string[] = [];
    events.on('WEAPON_CONTACT', () => order.push('contact'));
    events.on('COCKROACH_HIT', () => order.push('hit'));
    events.on('WEAPON_MISS', () => order.push('miss'));
    start();

    expect(round.swing(origin, direction)).toBe(true);
    expect(swings).toEqual([{ position: origin, direction }]);
    round.tick(contactMs - 1);
    expect(hits).toEqual([]);
    expect(misses).toEqual([]);
    expect(contacts).toEqual([]);
    expect(score).toEqual([]);
    expect(round.stats).toMatchObject({ swings: 0, hits: 0, nearMisses: 0, score: 0 });

    round.tick(1);
    expect(contacts).toEqual([{ outcome }]);
    expect(hits).toHaveLength(hitsAtContact);
    expect(misses).toHaveLength(missesAtContact);
    expect(order).toEqual(['contact', outcome]);
    expect(round.stats).toMatchObject({ swings: 1, hits: hitsAtContact });

    round.tick(SWING_DURATION_MS);
    expect(order).toEqual(['contact', outcome]);
    expect(round.stats?.swings).toBe(1);
  });

  it('resolves at 100 active milliseconds reached in two fractional ticks', () => {
    const { record, round, start } = setup();
    const contacts = record('WEAPON_CONTACT');
    const hits = record('COCKROACH_HIT');
    start();
    round.swing(origin, forward);
    round.tick(40.333);
    round.tick(59.667);

    expect(round.swingElapsedMs).toBe(100);
    expect(contacts).toEqual([{ outcome: 'hit' }]);
    round.updateAim(origin, backward);
    round.tick(1);
    expect(hits).toHaveLength(1);
    expect(contacts).toHaveLength(1);
  });

  it('uses the latest aim position and direction to resolve a swing', () => {
    const { record, round, start } = setup();
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    start();

    expect(round.swing(origin, backward)).toBe(true);
    round.tick(contactMs - 1);
    expect(misses).toEqual([]);
    round.updateAim({ x: 1, y: 0, z: 2 }, { x: -1, y: 0, z: -1 });
    round.tick(1);

    expect(hits).toEqual([expect.objectContaining({ cockroachId: 0, position: target })]);
    expect(misses).toEqual([]);
  });

  it('uses moving target positions at the contact boundary within a long tick', () => {
    const { record, round, start } = setup();
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    const moves = record('COCKROACH_MOVED');
    start({ spawnPoints: [point({ x: 0, y: 0, z: 3.04 })], waypoints: [] }, 'hell');
    round.updatePlayerPosition({ x: 0.16, y: 0.1, z: -1.84 });
    round.tick(4_500);

    expect(round.swing(origin, forward)).toBe(true);
    round.tick(1_600);

    expect(hits).toHaveLength(1);
    expect(hits[0].cockroachId).toBe(0);
    expect(hits[0].position.z).toBeCloseTo(2.968, 3);
    expect(misses).toEqual([]);
    expect(moves.filter(({ cockroachId }) => cockroachId === 1).at(-1)?.position.z).toBeLessThan(0);
  });

  it('holds pending contact during pause and resolves it after the remaining active time', () => {
    const { record, round, start } = setup();
    const contacts = record('WEAPON_CONTACT');
    const hits = record('COCKROACH_HIT');
    start();
    expect(round.swing(origin, forward)).toBe(true);
    round.tick(40);

    expect(round.pause()).toBe(true);
    round.tick(5_000);
    expect(hits).toEqual([]);
    expect(contacts).toEqual([]);
    expect(round.swingElapsedMs).toBe(40);
    expect(round.resume()).toBe(true);
    round.tick(59);
    expect(contacts).toEqual([]);
    round.tick(1);

    expect(contacts).toEqual([{ outcome: 'hit' }]);
    expect(hits).toHaveLength(1);
    expect(round.swingElapsedMs).toBe(contactMs);
  });

  it.each([
    { contactAt: ROUND_DURATION_MS - 20, order: ['swing', 'contact', 'hit', 'game over', 'ended'], hits: 1, score: 100 },
    // One floating-point step below 60,000 ms.
    { contactAt: ROUND_DURATION_MS - 2 ** -37, order: ['swing', 'contact', 'hit', 'game over', 'ended'], hits: 1, score: 100 },
    { contactAt: ROUND_DURATION_MS, order: ['swing', 'game over', 'ended'], hits: 0, score: 0 },
    { contactAt: ROUND_DURATION_MS + 20, order: ['swing', 'game over', 'ended'], hits: 0, score: 0 },
  ])('expires once when a late update spans the $contactAt ms contact', ({ contactAt, order, hits, score }) => {
    const { events, record, round, start } = setup();
    const actualOrder: string[] = [];
    events.on('WEAPON_SWING', () => actualOrder.push('swing'));
    events.on('WEAPON_CONTACT', () => actualOrder.push('contact'));
    events.on('COCKROACH_HIT', () => actualOrder.push('hit'));
    events.on('WEAPON_MISS', () => actualOrder.push('miss'));
    events.on('COCKROACH_NEAR_MISS', () => actualOrder.push('near miss'));
    events.on('STATE_CHANGED', ({ to }) => {
      if (to === 'GAME_OVER') actualOrder.push('game over');
    });
    events.on('ROUND_ENDED', () => actualOrder.push('ended'));
    const ended = record('ROUND_ENDED');
    const ticks = record('TIMER_TICK');
    start();

    const swingStartedAt = contactAt - contactMs;
    round.tick(swingStartedAt);
    expect(round.swing(origin, forward)).toBe(true);
    round.tick(ROUND_DURATION_MS + 100 - swingStartedAt);
    round.tick(1_000);

    expect(round.state).toBe('GAME_OVER');
    expect(ticks.at(-1)).toEqual({ timeRemaining: 0 });
    expect(actualOrder).toEqual(order);
    expect(ended).toMatchObject([{ roundResult: {
      timeRemaining: 0, swings: hits, hits, kills: hits, score, misses: 0, nearMisses: 0,
    } }]);
  });

  it('starts a replay without contact or lockout carried over from an expired swing', () => {
    const { record, round, start } = setup();
    const contacts = record('WEAPON_CONTACT');
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    start();
    round.tick(ROUND_DURATION_MS - 50);
    expect(round.swing(origin, forward)).toBe(true);
    round.tick(50);
    expect(hits).toEqual([]);

    expect(round.replay()).toBe(true);
    expect(round.ready(mapData)).toBe(true);
    expect(round.start()).toBe(true);
    expect(round.swingElapsedMs).toBeNull();
    expect(round.swing(origin, backward)).toBe(true);
    round.tick(contactMs);

    expect(contacts).toEqual([{ outcome: 'miss' }]);
    expect(hits).toEqual([]);
    expect(misses).toEqual([{ position: origin, direction: backward }]);
    expect(round.stats).toMatchObject({ swings: 1, hits: 0, score: 0 });
  });

  it('emits one hit outcome per accepted hit and scores consecutive hits with the current combo', () => {
    const { events, record, round, start } = setup();
    const order: string[] = [];
    events.on('WEAPON_SWING', () => order.push('swing'));
    events.on('WEAPON_CONTACT', ({ outcome }) => order.push(`contact:${outcome}`));
    events.on('COCKROACH_HIT', () => order.push('hit'));
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
    const dropped = record('COCKROACH_DESPAWNED');
    start();

    expect(round.swing(origin, forward)).toBe(true);
    round.tick(SWING_DURATION_MS);
    expect(round.swing(origin, forward)).toBe(true);
    round.tick(contactMs + 100);

    expect(order).toEqual(['swing', 'contact:hit', 'hit', 'swing', 'contact:hit', 'hit']);
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
    events.on('WEAPON_CONTACT', ({ outcome }) => order.push(outcome));
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

    expect(order).toEqual(['swing', 'hit', 'swing', 'near_miss', 'miss', 'near', 'swing', 'hit']);
    expect(misses).toEqual([{ position: almost, direction: forward }]);
    expect(nearMisses).toEqual([{ cockroachId: 1, position: target, distance: 0.1 }]);
    expect(hits.map(({ comboMultiplier }) => comboMultiplier)).toEqual([1, 1]);
    expect(ended[0].roundResult).toMatchObject({
      hits: 2, swings: 3, nearMisses: 1, misses: 1, accuracy: 2 / 3, score: 200,
    });
  });

  it('recycles only the eliminated slot and cannot score it while it is inactive', () => {
    let draws = 0;
    const { events, record, round, start } = setup({ random: () => draws++ === 0 ? 0 : 0.75 });
    const spawned = record('COCKROACH_SPAWNED');
    const moves = record('COCKROACH_MOVED');
    const hits = record('COCKROACH_HIT');
    const distant = point({ x: 0, y: 0, z: 5 });
    start({ ...mapData, spawnPoints: [point(target), distant] });
    const initialCount = spawned.length;
    let inactiveFrom = 0;
    let inactiveUntil = 0;
    events.on('COCKROACH_HIT', ({ cockroachId }) => {
      if (cockroachId === 0) inactiveFrom = moves.length;
    });
    events.on('COCKROACH_SPAWNED', ({ cockroachId }) => {
      if (cockroachId === 0) inactiveUntil = moves.length;
    });

    round.swing(origin, forward);
    round.tick(SWING_DURATION_MS);
    round.swing(origin, forward);
    expect(hits).toHaveLength(1);
    round.tick(1_000);

    expect(spawned).toHaveLength(initialCount + 1);
    expect(spawned.at(-1)).toEqual({ cockroachId: 0, position: distant.position, surfaceType: 'floor' });
    expect(moves.slice(inactiveFrom, inactiveUntil).some(({ cockroachId }) => cockroachId === 0)).toBe(false);
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
    round.tick(contactMs);
    expect(hits.at(-1)?.comboMultiplier).toBe(2);

    expect(moved.some(({ position, state }) => position.x > 0 && state === 'crawling')).toBe(true);
    round.tick(COMBO_WINDOW_MS + 1);
    expect(resets).toHaveLength(1);
    expect(spawned.length).toBeGreaterThan(countsBeforePause[0]);
  });

  it('uses a tunable Normal pool and resets score and pending respawns on replay', () => {
    const { record, round, start } = setup({ random: () => 0, normalPoolSize: 15 });
    const spawned = record('COCKROACH_SPAWNED');
    const started = record('ROUND_STARTED');
    const hits = record('COCKROACH_HIT');
    start();
    expect(new Set(spawned.map(({ cockroachId }) => cockroachId)).size).toBe(15);
    expect(round.replay()).toBe(false);
    round.tick(ROUND_DURATION_MS - contactMs - 1);
    round.swing(origin, forward);
    round.tick(90_000);
    expect(spawned).toHaveLength(15);

    expect(round.replay()).toBe(true);
    expect(round.ready(mapData)).toBe(true);
    expect(round.start()).toBe(true);

    expect(started).toEqual([selection, selection]);
    expect(spawned).toHaveLength(30);
    expect(round.stats).toMatchObject({
      ...selection, score: 0, kills: 0, swings: 0, hits: 0, nearMisses: 0,
      maxCombo: 1, rank: null,
    });
    expect(round.swing(origin, forward)).toBe(true);
    round.tick(contactMs);
    expect(hits.at(-1)).toMatchObject({ cockroachId: 0, points: 100, comboMultiplier: 1 });
    round.tick(350);
    expect(spawned).toHaveLength(31);
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
    const contacts = record('WEAPON_CONTACT');
    const hits = record('COCKROACH_HIT');
    const misses = record('WEAPON_MISS');
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
    round.tick(contactMs);
    expect(round.stats).toMatchObject({ weaponId: 'flyswatter', swings: 0, kills: 0, score: 0 });
    expect(contacts).toEqual([]);
    expect(hits).toEqual([]);
    expect(misses).toEqual([]);
    expect(round.swing(origin, forward)).toBe(true);
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
    round.tick(contactMs);
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
    const timeRemaining = round.stats?.timeRemaining;

    expect(round.swing(origin, forward)).toBe(true);
    expect(round.state).toBe('PLAYING');
    expect(hits).toHaveLength(0);
    expect(round.stats).toMatchObject({ hits: 0, swings: 0, timeRemaining });
    expect(ended).toEqual([]);
    round.tick(contactMs);
    expect(hits).toHaveLength(1);
    expect(round.stats).toMatchObject({ hits: 1, swings: 1 });
  });
});
