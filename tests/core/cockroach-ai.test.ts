import { describe, expect, it } from 'vitest';
import { CockroachAI, createCockroach } from '../../src/core/cockroach-ai';
import type { GameMode, SurfacePoint } from '../../src/core/types';

const floor = { x: 0, y: 1, z: 0 };
const wall = { x: -1, y: 0, z: 0 };
const start: SurfacePoint = { position: { x: 0, y: 0, z: 0 }, surfaceType: 'floor', surfaceNormal: floor };
const first: SurfacePoint = { ...start, position: { x: 0, y: 0, z: 1 } };
const second: SurfacePoint = { ...start, position: { x: 0, y: 0, z: 2 } };
const adjacent: SurfacePoint = { position: { x: 0.5, y: 0.5, z: 0 }, surfaceType: 'wall', surfaceNormal: wall };
const distant: SurfacePoint = { ...adjacent, position: { x: 8, y: 2, z: 0 } };

function draws(...values: number[]): () => number {
  return () => values.shift() ?? 0;
}

describe('CockroachAI', () => {
  it('chooses another same-surface waypoint when the transition roll is exactly 10%', () => {
    const ai = new CockroachAI([start], [start, first, second, adjacent], draws(0, 0, 0.1, 0.75, 0));
    const cockroach = createCockroach(42);

    expect(ai.spawn(cockroach)).toBe(true);
    ai.update(cockroach, 300);

    expect(cockroach.state).toBe('crawling');
    expect(cockroach.targetWaypoint).toEqual(second.position);
  });

  it('can switch to a nearby different surface with a roll below 10%', () => {
    const ai = new CockroachAI([start], [first, distant, adjacent], draws(0, 0, 0.099, 0, 0));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(adjacent.position);
    ai.update(cockroach, 1_500);
    expect(cockroach.position).toEqual(adjacent.position);
    expect(cockroach.surfaceType).toBe('wall');
    expect(cockroach.surfaceNormal).toEqual(wall);
    expect(cockroach.state).toBe('idle');
  });

  it('crawls by elapsed time and idles again upon reaching its waypoint', () => {
    const ai = new CockroachAI([start], [first], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 299);
    expect(cockroach.state).toBe('idle');
    ai.update(cockroach, 501);
    expect(cockroach.state).toBe('crawling');
    expect(cockroach.speed).toBe(0.5);
    expect(cockroach.position.z).toBeCloseTo(0.25);
    ai.update(cockroach, 1_500);
    expect(cockroach.position).toEqual(first.position);
    expect(cockroach.state).toBe('idle');
    expect(cockroach.speed).toBe(0);
    expect(cockroach.targetWaypoint).toBeNull();
  });

  it('uses the upper idle and speed ranges when the RNG is near one', () => {
    const ai = new CockroachAI([start], [first], () => 0.999);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 999);
    expect(cockroach.state).toBe('idle');
    ai.update(cockroach, 1);
    expect(cockroach.state).toBe('crawling');
    expect(cockroach.speed).toBeCloseTo(1.1993);
  });

  it('stays idle with only coincident or distant different-surface waypoints', () => {
    const ai = new CockroachAI([start], [start, distant], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 2_000);

    expect(cockroach.state).toBe('idle');
    expect(cockroach.targetWaypoint).toBeNull();
    expect(cockroach.position).toEqual(start.position);
  });

  it('does not crawl directly between opposite walls that share a tag', () => {
    const alongWall: SurfacePoint = { ...adjacent, position: { x: 0.5, y: 0.5, z: 2 } };
    const oppositeWall: SurfacePoint = {
      ...adjacent, position: { x: -3, y: 0.5, z: 0 }, surfaceNormal: { x: 1, y: 0, z: 0 },
    };
    const ai = new CockroachAI([adjacent], [alongWall, oppositeWall], draws(0, 0, 0.5, 0.75));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(alongWall.position);
  });

  it.each([0, 0.5])('keeps crawling on the same counter support at switch roll %s', (roll) => {
    const island = { ...start, surfaceType: 'counter', supportId: 0 };
    const alongIsland = { ...island, position: { x: 1, y: 0, z: 0 } };
    const backCounter = { ...island, position: { x: 0, y: 0, z: 1 }, supportId: 1 };
    const ai = new CockroachAI([island], [alongIsland, backCounter], draws(0, 0, roll, 0.75, 0));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(alongIsland.position);
  });

  it('uses the new support after moving from an unclassified surface', () => {
    const table = { ...first, surfaceType: 'table', supportId: 0 };
    const alongTable = { ...second, surfaceType: 'table', supportId: 0 };
    const otherTable = { ...alongTable, position: { x: 1, y: 0, z: 1 }, supportId: 1 };
    const ai = new CockroachAI([start], [table, alongTable, otherTable], draws(0, 0, 0, 0, 0, 0, 0.5, 0.75, 0));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 2_600);

    expect(cockroach.position).toEqual(table.position);
    expect(cockroach.targetWaypoint).toEqual(alongTable.position);
  });

  it('leaves an inactive cockroach untouched if no spawn is available', () => {
    const ai = new CockroachAI([], [], () => 0);
    const cockroach = createCockroach(12);

    expect(ai.spawn(cockroach)).toBe(false);
    ai.update(cockroach, 1_000);

    expect(cockroach.alive).toBe(false);
    expect(cockroach.targetWaypoint).toBeNull();
  });

  it('resets a pooled cockroach from a random tagged spawn without mutating map metadata', () => {
    const ai = new CockroachAI([start, adjacent], [first], () => 0.9);
    const cockroach = createCockroach(12);
    cockroach.state = 'flying';
    cockroach.targetWaypoint = first.position;
    cockroach.speed = 5;
    cockroach.hitboxRadius = 0.078;
    cockroach.flightCurve = { start: start.position, control: first.position, end: adjacent.position };
    cockroach.flightProgress = 0.75;

    expect(ai.spawn(cockroach)).toBe(true);
    ai.update(cockroach, 0);
    expect(cockroach).toMatchObject({
      id: 12, alive: true, state: 'idle', position: { x: 0.5, y: 0.5, z: 0 }, surfaceType: 'wall',
      surfaceNormal: wall, targetWaypoint: null, speed: 0, hitboxRadius: 0.06, flightCurve: null, flightProgress: 0,
    });
    expect(cockroach.position).not.toBe(adjacent.position);
    expect(cockroach.surfaceNormal).not.toBe(adjacent.surfaceNormal);
  });

  it('leaves a flying cockroach for the flight behavior to update', () => {
    const ai = new CockroachAI([start], [first], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);
    cockroach.state = 'flying';

    ai.update(cockroach, 1_000);

    expect(cockroach.state).toBe('flying');
    expect(cockroach.position).toEqual(start.position);
  });
});

describe('Hell flight', () => {
  const player = { x: 0, y: 1.6, z: 3 };

  function spawn(mode: GameMode, random: () => number) {
    const ai = new CockroachAI([start], [], random, mode);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);
    return { ai, cockroach };
  }

  it.each([[0, 3_000], [0.5, 5_500], [0.999, 7_995]])('waits for the Hell takeoff interval at draw %s', (roll, interval) => {
    const { ai, cockroach } = spawn('hell', () => roll);

    ai.update(cockroach, interval - 1, player);
    expect(cockroach.state).toBe('idle');
    ai.update(cockroach, 1, player);
    expect(cockroach.state).toBe('preflight');
  });

  it('keeps Normal cockroaches grounded after the longest Hell interval', () => {
    const { ai, cockroach } = spawn('normal', () => 0);

    ai.update(cockroach, 10_000, player);

    expect(cockroach.state).toBe('idle');
    expect(cockroach.flightCurve).toBeNull();
  });

  it('holds position for 1.5 seconds before snapshotting the current camera target', () => {
    const { ai, cockroach } = spawn('hell', draws(0, 0, 0, ...Array(20).fill(0.5)));
    ai.update(cockroach, 3_000, player);
    ai.update(cockroach, 1_499, player);
    expect(cockroach.state).toBe('preflight');
    expect(cockroach.position).toEqual(start.position);
    expect(cockroach.hitboxRadius).toBe(0.06);

    const currentCamera = { x: 1, y: 1.6, z: 3 };
    ai.update(cockroach, 1, currentCamera);
    expect(cockroach.state).toBe('flying');
    expect(cockroach.flightCurve?.end).toEqual(currentCamera);
    expect(cockroach.flightCurve?.control).toMatchObject({ x: 0.5, z: 1.5 });
    expect(cockroach.flightCurve?.control.y).toBeGreaterThan(1.6);
  });

  it('jitter varies the target and an advancing curve accelerates toward its fixed endpoint', () => {
    const { ai, cockroach } = spawn('hell', () => 0);
    ai.update(cockroach, 4_500, player);
    expect(cockroach.flightCurve).not.toBeNull();
    const end = cockroach.flightCurve!.end;
    expect(end.x).toBeLessThan(player.x);
    expect(end.x).toBeGreaterThan(player.x - 0.3);

    const distanceToCamera = () => Math.hypot(cockroach.position.x, cockroach.position.y, cockroach.position.z);
    ai.update(cockroach, 300, player);
    const firstStep = distanceToCamera();
    ai.update(cockroach, 300, player);
    expect(distanceToCamera() - firstStep).toBeGreaterThan(firstStep);

    expect(ai.update(cockroach, 2_000, { x: 8, y: 3, z: -3 })).toBe(true);
    expect(cockroach.flightProgress).toBe(1);
    expect(cockroach.position).toEqual(end);
  });
});
