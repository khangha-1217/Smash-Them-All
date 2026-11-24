import { dot, length, normalize, scale, subtract } from '../utils/math-utils';
import { basePointsFor } from './scoring';
import type { Cockroach, HitResult, Vec3 } from './types';

export const CRAWLING_HITBOX_RADIUS = 0.06;
export const FLYING_HITBOX_RADIUS = CRAWLING_HITBOX_RADIUS * 1.3;

const HALF_ANGLE = 25 * Math.PI / 180;
const SINE = Math.sin(HALF_ANGLE);
const COSINE = Math.cos(HALF_ANGLE);
const RANGE = 3;
const NEAR_MISS_FACTOR = 1.8;
const TOLERANCE = 1e-12;

export function detectHit(origin: Vec3, direction: Vec3, cockroaches: Iterable<Cockroach>): HitResult {
  const miss: HitResult = { type: 'miss', target: null, nearMiss: null, points: 0, distance: Infinity };
  const aim = normalize(direction);
  if (length(aim) === 0) return miss;

  let hit: Cockroach | null = null;
  let closestHit = Infinity;
  let nearMiss: Cockroach | null = null;
  let closestToRay = Infinity;

  for (const cockroach of cockroaches) {
    if (!cockroach.alive) continue;
    const offset = subtract(cockroach.position, origin);
    const axial = dot(offset, aim);
    const range = length(offset);
    if (axial < 0 || range > RANGE + TOLERANCE) continue;

    const rayClearance = length(subtract(offset, scale(aim, axial)));
    // The perpendicular distance to the cone edge in the plane through the target and aim axis.
    const coneClearance = rayClearance * COSINE - axial * SINE;
    const radius = cockroach.hitboxRadius;
    if (coneClearance <= radius + TOLERANCE) {
      if (range < closestHit) {
        hit = cockroach;
        closestHit = range;
      }
    } else if (rayClearance <= radius * NEAR_MISS_FACTOR + TOLERANCE && rayClearance < closestToRay) {
      nearMiss = cockroach;
      closestToRay = rayClearance;
    }
  }

  if (hit) {
    return {
      type: 'hit', target: hit, nearMiss: null, distance: closestHit, points: basePointsFor(hit.state),
    };
  }
  if (nearMiss) {
    return {
      type: 'near_miss',
      target: null,
      distance: closestToRay,
      points: 0,
      nearMiss: { cockroachId: nearMiss.id, position: { ...nearMiss.position }, distance: closestToRay },
    };
  }
  return miss;
}
