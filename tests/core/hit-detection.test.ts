import { describe, expect, it } from 'vitest';
import { CRAWLING_HITBOX_RADIUS, FLYING_HITBOX_RADIUS, detectHit } from '../../src/core/hit-detection';
import type { Cockroach, Vec3 } from '../../src/core/types';

const origin = { x: 0, y: 0, z: 0 };
const forward = { x: 0, y: 0, z: 2 };

function cockroach(id: number, position: Vec3, flying = false): Cockroach {
  return {
    id,
    position,
    alive: true,
    state: flying ? 'flying' : 'crawling',
    surfaceType: 'floor',
    surfaceNormal: { x: 0, y: 1, z: 0 },
    groundFacing: { x: 0, y: 0, z: 1 },
    targetWaypoint: null,
    speed: 0,
    hitboxRadius: flying ? FLYING_HITBOX_RADIUS : CRAWLING_HITBOX_RADIUS,
    flightCurve: null,
    flightProgress: 0,
  };
}

describe('detectHit', () => {
  it('hits the nearest living cockroach in the cone and reports its distance and base points', () => {
    const nearest = cockroach(1, { x: 0, y: 0, z: 1 });
    const dead = { ...cockroach(2, { x: 0, y: 0, z: 0.5 }), alive: false };
    const farther = cockroach(3, { x: 0, y: 0, z: 2 });

    expect(detectHit(origin, forward, new Set([farther, dead, nearest]))).toEqual({
      type: 'hit', target: nearest, nearMiss: null, distance: 1, points: 100,
    });
  });

  it('uses a 25 degree 3D cone and detects sphere overlap even when its center falls outside', () => {
    const angle = 25 * Math.PI / 180;
    const edge = { x: 0, y: 2 * Math.sin(angle), z: 2 * Math.cos(angle) };
    const tangent = {
      x: 0,
      y: edge.y + 0.06 * Math.cos(angle),
      z: edge.z - 0.06 * Math.sin(angle),
    };

    expect(detectHit(origin, forward, [cockroach(1, edge)]).type).toBe('hit');
    expect(detectHit(origin, forward, [cockroach(1, tangent)]).type).toBe('hit');
    expect(detectHit(origin, forward, [cockroach(1, { ...tangent, y: tangent.y + 0.001 })]).type).toBe('miss');
  });

  it('limits target centers to a 3 meter radial range and the front hemisphere', () => {
    expect(detectHit(origin, forward, [cockroach(1, { x: 0, y: 0, z: 3 })]).type).toBe('hit');
    expect(detectHit(origin, forward, [cockroach(1, { x: 0.8, y: 0, z: 2.9 })]).type).toBe('miss');
    expect(detectHit(origin, forward, [cockroach(1, { x: 0, y: 0, z: 3.001 })]).type).toBe('miss');
    expect(detectHit(origin, forward, [cockroach(1, { x: 0, y: 0, z: -0.01 })]).type).toBe('miss');
  });

  it('gives flying targets a 1.3× hitbox and 250 base points', () => {
    expect(CRAWLING_HITBOX_RADIUS).toBeCloseTo(0.06, 10);
    expect(FLYING_HITBOX_RADIUS).toBeCloseTo(0.078, 10);
    const position = { x: 0.6 * Math.tan(25 * Math.PI / 180) + 0.077, y: 0, z: 0.6 };
    const flying = cockroach(2, position, true);

    expect(detectHit(origin, forward, [cockroach(1, position)]).type).toBe('miss');
    expect(detectHit(origin, forward, [flying])).toMatchObject({ type: 'hit', target: flying, points: 250 });
  });

  it.each([[false, 0.108], [true, 0.1404]])('classifies the inclusive near-miss ray boundary (flying %s)', (flying, clearance) => {
    const position = { x: 1 + clearance, y: 2, z: 3.03 };
    const from = { x: 1, y: 2, z: 3 };
    const target = cockroach(4, position, flying);

    const result = detectHit(from, forward, [target]);

    expect(result).toMatchObject({
      type: 'near_miss', target: null, points: 0, nearMiss: { cockroachId: 4, position },
    });
    expect(result.distance).toBeCloseTo(clearance, 10);
    expect(result.nearMiss?.distance).toBeCloseTo(clearance, 10);
    expect(detectHit(from, forward, [cockroach(4, { ...position, x: position.x + 0.001 }, flying)]).type).toBe('miss');
  });

  it('prioritizes a distant hit over a nearer near-miss and selects the closest near-miss to the ray', () => {
    const wide = cockroach(1, { x: 0.107, y: 0, z: 0.02 });
    const close = cockroach(2, { x: 0.095, y: 0, z: 0.04 });
    const hit = cockroach(3, { x: 0, y: 0, z: 1 });

    expect(detectHit(origin, forward, [wide, close]).nearMiss?.cockroachId).toBe(2);
    expect(detectHit(origin, forward, [wide, hit, close]).target).toBe(hit);
  });

  it('reports a miss for empty swings or a zero-length aim direction', () => {
    const miss = { type: 'miss', target: null, nearMiss: null, points: 0, distance: Infinity };

    expect(detectHit(origin, forward, [])).toEqual(miss);
    expect(detectHit(origin, origin, [cockroach(1, { x: 0, y: 0, z: 1 })])).toEqual(miss);
  });
});
