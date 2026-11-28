import { describe, expect, it } from 'vitest';
import { CockroachAI, createCockroach } from '../../src/core/cockroach-ai';
import type { Aabb, GameMode, SurfacePoint, Vec3 } from '../../src/core/types';

const floor = { x: 0, y: 1, z: 0 };
const wall = { x: -1, y: 0, z: 0 };
const floorBounds = {
  min: { x: -1, y: 0, z: -1 }, max: { x: 0.5, y: 0, z: 3 },
};
const wallBounds = {
  min: { x: 0.5, y: 0, z: -1 }, max: { x: 0.5, y: 2, z: 3 },
};
// Until the production contract is added, fixtures still carry the supporting face.
type SupportedPoint = SurfacePoint & { supportBounds: Aabb };
const start: SupportedPoint = {
  position: { x: 0, y: 0, z: 0 }, surfaceType: 'floor', surfaceNormal: floor,
  supportBounds: floorBounds,
};
const first: SupportedPoint = { ...start, position: { x: 0, y: 0, z: 1 } };
const second: SupportedPoint = { ...start, position: { x: 0, y: 0, z: 2 } };
const adjacent: SupportedPoint = {
  position: { x: 0.5, y: 0.5, z: 0 }, surfaceType: 'wall', surfaceNormal: wall,
  supportBounds: wallBounds,
};

function draws(...values: number[]): () => number {
  return () => values.shift() ?? 0;
}

function expectTangent(heading: Vec3, normal: Vec3) {
  expect(heading).toBeDefined();
  expect(Math.hypot(heading.x, heading.y, heading.z)).toBeCloseTo(1);
  expect(heading.x * normal.x + heading.y * normal.y + heading.z * normal.z).toBeCloseTo(0);
}

describe('CockroachAI', () => {
  it('chooses another same-surface waypoint when the transition roll is exactly 10%', () => {
    const ai = new CockroachAI([start], [start, first, second, adjacent], draws(0, 0, 0.1, 0.75, 0));
    const cockroach = createCockroach(42);

    expect(ai.spawn(cockroach)).toBe(true);
    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(second.position);
  });

  it('accelerates and brakes on the same support before holding its heading and moving back', () => {
    const ai = new CockroachAI([start], [start, first], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 299);
    expect(cockroach.state).toBe('idle');
    expect(cockroach.speed).toBe(0);
    expect(cockroach.position).toEqual(start.position);

    const samples = Array.from({ length: 700 }, () => {
      ai.update(cockroach, 10);
      return {
        position: { ...cockroach.position },
        speed: cockroach.speed,
        heading: cockroach.groundFacing && { ...cockroach.groundFacing },
      };
    });
    expect(samples.every(({ position }) => position.x === 0 && position.y === 0
      && position.z >= 0 && position.z <= 1)).toBe(true);

    const arrival = samples.findIndex(({ position, speed }) => position.z === 1 && speed === 0);
    expect(arrival).toBeGreaterThan(2);
    const outgoing = samples.slice(0, arrival).filter(({ speed }) => speed > 0);
    const peakSpeed = Math.max(...outgoing.map(({ speed }) => speed));
    expect(outgoing[0].speed).toBeLessThan(outgoing[1].speed);
    expect(outgoing[outgoing.length - 1].speed).toBeLessThan(peakSpeed);
    expect(peakSpeed).toBeLessThanOrEqual(1.2);

    const restart = samples.findIndex(({ position }, index) => index > arrival && position.z < 1);
    expect(restart).toBeGreaterThan(arrival + 1);
    const held = samples.slice(arrival, restart);
    expectTangent(held[0].heading, floor);
    expect(held[0].heading.z).toBeCloseTo(1);
    expect(held.every(({ speed, heading }) => speed === 0
      && heading.x === held[0].heading.x && heading.y === held[0].heading.y
      && heading.z === held[0].heading.z)).toBe(true);

    expect(samples[restart].speed).toBeGreaterThan(0);
    expect(samples[restart + 1].speed).toBeGreaterThan(samples[restart].speed);
    expect(samples[restart].heading.z).toBeCloseTo(-1);
  });

  it('uses the upper idle range and stays inside the crawl speed envelope at a high draw', () => {
    const ai = new CockroachAI([start], [second], () => 0.999);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 999);
    expect(cockroach.state).toBe('idle');
    ai.update(cockroach, 1);
    const firstSpeed = cockroach.speed;
    const speeds = Array.from({ length: 200 }, () => {
      ai.update(cockroach, 10);
      return cockroach.speed;
    });

    expect(firstSpeed).toBeLessThan(Math.max(...speeds));
    expect(Math.max(...speeds)).toBeGreaterThanOrEqual(0.5);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(1.2);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(0);
  });

  it('reaches the wall through the shared edge of its face and the floor face', () => {
    const wallEntry = { ...adjacent, supportId: 1 };
    const alongWall = { ...wallEntry, position: { x: 0.5, y: 0.5, z: 0.75 } };
    const ai = new CockroachAI([start], [wallEntry, alongWall], draws(0, 0, 0.099, 0, 0));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    const stepMs = 10;
    const maxStepDistance = 1.2 * stepMs / 1_000;
    let crossedSeam = false;
    for (let elapsed = 0; elapsed < 5_000; elapsed += stepMs) {
      const previousFace = cockroach.surfaceType;
      const previousX = cockroach.position.x;
      ai.update(cockroach, stepMs);
      const { x, y, z } = cockroach.position;
      expect(z).toBeCloseTo(0, 6);
      if (cockroach.surfaceType === 'floor') {
        expect(y).toBeCloseTo(0, 6);
        expect(cockroach.surfaceNormal).toEqual(floor);
      } else {
        expect(cockroach.surfaceType).toBe('wall');
        expect(x).toBeCloseTo(0.5, 6);
        expect(cockroach.surfaceNormal).toEqual(wall);
        if (previousFace === 'floor') {
          expect(Math.abs(0.5 - previousX) + Math.abs(y)).toBeLessThanOrEqual(maxStepDistance + 1e-6);
          crossedSeam = true;
        }
      }
      if (cockroach.surfaceType === 'wall' && y === wallEntry.position.y) break;
    }

    expect(crossedSeam).toBe(true);
    expect(cockroach.position).toEqual(wallEntry.position);
    expect(cockroach.surfaceType).toBe('wall');
    expectTangent(cockroach.groundFacing, wall);

    for (let elapsed = 0; elapsed < 3_000 && cockroach.position.z === 0; elapsed += stepMs) {
      ai.update(cockroach, stepMs);
    }
    expect(cockroach.targetWaypoint).toEqual(alongWall.position);
    expect(cockroach.position.x).toBeCloseTo(0.5, 6);
    expect(cockroach.position.y).toBeCloseTo(0.5, 6);
    expect(cockroach.position.z).toBeGreaterThan(0);
  });

  it('rests parallel to the wall when its destination is on the floorâ€“wall seam', () => {
    const seamMarker = { ...adjacent, position: { x: 0.5, y: 0, z: 0 } };
    const ai = new CockroachAI([start], [seamMarker], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 1_800);

    expect(cockroach).toMatchObject({
      state: 'idle', position: seamMarker.position, surfaceType: 'wall', surfaceNormal: wall, speed: 0,
    });
    expectTangent(cockroach.groundFacing, wall);
  });

  it.each([
    ['an unknown wall support', {
      position: adjacent.position, surfaceType: 'wall', surfaceNormal: wall,
    }],
    ['a disconnected wall face', {
      ...adjacent,
      supportBounds: { ...wallBounds, min: { ...wallBounds.min, y: 0.2 } },
    }],
    ['a different-height floor', {
      ...first,
      position: { x: 0, y: 0.2, z: 1 },
      supportBounds: { min: { ...floorBounds.min, y: 0.2 }, max: { ...floorBounds.max, y: 0.2 } },
    }],
    ['a disconnected coplanar face', {
      ...first,
      supportBounds: { min: { x: -1, y: 0, z: 0.5 }, max: { x: -0.1, y: 0, z: 2 } },
      position: { x: -0.15, y: 0, z: 1 },
    }],
    ['a waypoint outside its own support bounds', {
      ...first,
      supportBounds: { ...floorBounds, max: { ...floorBounds.max, z: 0.25 } },
    }],
  ])('falls back to a supported leg instead of selecting %s', (_label, blocked) => {
    // Keep the fallback fixture's bounds short enough to leave a gap to the coplanar face.
    const nearSupport = {
      min: floorBounds.min, max: { ...floorBounds.max, z: 0.25 },
    };
    const floorStart: SupportedPoint = { ...start, supportBounds: nearSupport };
    const fallback: SupportedPoint = { ...floorStart, position: { x: 0.25, y: 0, z: 0 } };
    const ai = new CockroachAI([floorStart], [fallback, blocked], draws(0, 0, 0, 0.99, 0.99));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);
    expect(cockroach.targetWaypoint).toEqual(fallback.position);
  });

  it.each([-1, 1])('spawns with a unit heading on a wall with z normal %s', (z) => {
    const normal = { x: 0, y: 0, z };
    const wallSpawn = { position: { x: 0, y: 0.5, z: 1 }, surfaceType: 'wall', surfaceNormal: normal };
    const ai = new CockroachAI([wallSpawn], [], () => 0);
    const cockroach = createCockroach(0);

    expect(ai.spawn(cockroach)).toBe(true);

    expectTangent(cockroach.groundFacing, normal);
  });

  it('does not crawl between opposite walls that share a tag', () => {
    const alongWall = { ...adjacent, position: { x: 0.5, y: 0.5, z: 2 } };
    const oppositeWall: SurfacePoint = {
      surfaceType: 'wall', position: { x: -0.5, y: 0.5, z: 0 }, surfaceNormal: { x: 1, y: 0, z: 0 },
    };
    const ai = new CockroachAI([adjacent], [alongWall, oppositeWall], draws(0, 0, 0.5, 0.75));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(alongWall.position);
  });

  it.each([0, 0.5])('keeps crawling on the same counter support at switch roll %s', (roll) => {
    const island = { ...start, surfaceType: 'counter', supportId: 0 };
    const alongIsland = { ...island, position: { x: 0.25, y: 0, z: 0 } };
    const backCounter: SurfacePoint = {
      position: { x: 0, y: 0, z: 1 }, surfaceType: 'counter', surfaceNormal: floor, supportId: 1,
    };
    const ai = new CockroachAI([island], [alongIsland, backCounter], draws(0, 0, roll, 0.75, 0));
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 300);

    expect(cockroach.targetWaypoint).toEqual(alongIsland.position);
  });

  it('carries a large tick across an outbound leg, the turn hold and the next leg', () => {
    const nearby = { ...start, position: { x: 0, y: 0, z: 0.4 } };
    const waypoints = [start, nearby];
    const smallTicks = new CockroachAI([start], waypoints, () => 0);
    const largeTick = new CockroachAI([start], waypoints, () => 0);
    const sampled = createCockroach(1);
    const stepped = createCockroach(2);
    smallTicks.spawn(sampled);
    largeTick.spawn(stepped);

    let elapsed = 0;
    let reachedEnd = false;
    while (elapsed < 5_000) {
      smallTicks.update(sampled, 10);
      elapsed += 10;
      if (sampled.position.z === nearby.position.z && sampled.speed === 0) reachedEnd = true;
      if (reachedEnd && sampled.position.z < 0.35) break;
    }
    expect(reachedEnd).toBe(true);
    expect(sampled.position.z).toBeGreaterThan(0);
    expect(sampled.position.z).toBeLessThan(0.35);

    largeTick.update(stepped, elapsed);
    expect(stepped.position.z).toBeCloseTo(sampled.position.z);
    expect(stepped.speed).toBeCloseTo(sampled.speed);
    expect(stepped.state).toBe(sampled.state);
    expect(stepped.targetWaypoint).toEqual(start.position);
    expectTangent(stepped.groundFacing, floor);
    expect(stepped.groundFacing.z).toBeCloseTo(-1);
  });

  it('returns to the previous support when its spawn marker is absent from the waypoints', () => {
    const ai = new CockroachAI([start], [first], () => 0);
    const cockroach = createCockroach(0);
    ai.spawn(cockroach);

    ai.update(cockroach, 3_300);
    expect(cockroach.position).toEqual(first.position);
    expect(cockroach.state).toBe('idle');

    ai.update(cockroach, 300);
    expect(cockroach.targetWaypoint).toEqual(start.position);
    ai.update(cockroach, 3_000);
    expect(cockroach.position).toEqual(start.position);
    expect(cockroach.state).toBe('idle');
  });

  it('clears the previous ground leg and heading when reusing a pool slot on another face', () => {
    let roll = 0;
    const ai = new CockroachAI([start, adjacent], [first], () => roll);
    const cockroach = createCockroach(12);
    ai.spawn(cockroach);
    ai.update(cockroach, 500);
    expect(cockroach.speed).toBeGreaterThan(0);
    expect(cockroach.groundFacing).toEqual({ x: 0, y: 0, z: 1 });

    cockroach.state = 'flying';
    cockroach.hitboxRadius = 0.078;
    cockroach.flightCurve = { start: start.position, control: first.position, end: adjacent.position };
    cockroach.flightProgress = 0.75;
    // Set the previous tangent heading to a direction that is invalid on the new support.
    cockroach.groundFacing = { x: 1, y: 0, z: 0 };
    roll = 0.99;

    expect(ai.spawn(cockroach)).toBe(true);
    ai.update(cockroach, 100);
    expect(cockroach).toMatchObject({
      id: 12, alive: true, state: 'idle', position: adjacent.position, surfaceType: 'wall',
      surfaceNormal: wall, targetWaypoint: null, speed: 0, hitboxRadius: 0.06, flightCurve: null, flightProgress: 0,
    });
    expectTangent(cockroach.groundFacing, wall);
    expect(cockroach.position).not.toBe(adjacent.position);
    expect(cockroach.surfaceNormal).not.toBe(adjacent.surfaceNormal);
  });

  it('leaves an inactive cockroach untouched if no spawn is available', () => {
    const ai = new CockroachAI([], [], () => 0);
    const cockroach = createCockroach(12);

    expect(ai.spawn(cockroach)).toBe(false);
    ai.update(cockroach, 1_000);

    expect(cockroach.alive).toBe(false);
    expect(cockroach.targetWaypoint).toBeNull();
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

    ai.update(cockroach, 1_400, { x: 8, y: 3, z: -3 });
    expect(cockroach.position).toEqual(end);
    expect(cockroach.flightCurve?.start).toEqual(end);
    expect(cockroach.alive).toBe(true);
  });

  it.each([
    { surface: 'wall', cameraX: 5, plane: 2, axis: 'x' as const, normal: -1 },
    { surface: 'furniture', cameraX: 1.5, plane: 0.8, axis: 'x' as const, normal: -1 },
    { surface: 'floor', cameraX: 0, plane: 0, axis: 'y' as const, normal: 1 },
  ])('lands alive on the $surface even in one long tick', ({ surface, cameraX, plane, axis, normal }) => {
    const roomBounds = { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 4, z: 4 } };
    const colliders = surface === 'furniture'
      ? [{ min: { x: plane, y: 0, z: -2 }, max: { x: plane + 0.02, y: 3, z: 4 } }]
      : [];
    const ai = new CockroachAI([start], [], () => 0.5, 'hell', { roomBounds, colliders });
    const roach = createCockroach(0);
    ai.spawn(roach);
    ai.update(roach, 11_000, { x: cameraX, y: 1.6, z: 1 });
    expect(roach).toMatchObject({ alive: true, surfaceType: surface, flightCurve: null, hitboxRadius: 0.06 });
    expect(roach.position[axis]).toBeCloseTo(plane);
    expect(roach.surfaceNormal[axis]).toBe(normal);
  });
});
