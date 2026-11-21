import { distance, lerp } from '../utils/math-utils';
import { CRAWLING_HITBOX_RADIUS } from './hit-detection';
import type { Cockroach, SurfacePoint } from './types';

const ADJACENT_WAYPOINT_DISTANCE = 1.25;
const SURFACE_SWITCH_CHANCE = 0.1;

interface GroundMotion {
  idleRemainingMs: number;
  destination: SurfacePoint | null;
}

export function createCockroach(id: number): Cockroach {
  return {
    id,
    alive: false,
    state: 'idle',
    position: { x: 0, y: 0, z: 0 },
    surfaceType: '',
    surfaceNormal: { x: 0, y: 1, z: 0 },
    targetWaypoint: null,
    speed: 0,
    hitboxRadius: CRAWLING_HITBOX_RADIUS,
    flightCurve: null,
    flightProgress: 0,
  };
}

export class CockroachAI {
  private readonly motions = new WeakMap<Cockroach, GroundMotion>();

  constructor(
    private readonly spawnPoints: readonly SurfacePoint[],
    private readonly waypoints: readonly SurfacePoint[],
    private readonly random: () => number = Math.random,
  ) {}

  spawn(cockroach: Cockroach): boolean {
    if (this.spawnPoints.length === 0) return false;

    const start = this.spawnPoints[Math.floor(this.random() * this.spawnPoints.length)];
    const motion = this.motions.get(cockroach) ?? { idleRemainingMs: 0, destination: null };
    this.motions.set(cockroach, motion);
    cockroach.alive = true;
    Object.assign(cockroach.position, start.position);
    Object.assign(cockroach.surfaceNormal, start.surfaceNormal);
    cockroach.surfaceType = start.surfaceType;
    cockroach.hitboxRadius = CRAWLING_HITBOX_RADIUS;
    cockroach.flightCurve = null;
    cockroach.flightProgress = 0;
    this.beginIdle(cockroach, motion);
    return true;
  }

  update(cockroach: Cockroach, deltaMs: number): void {
    const motion = this.motions.get(cockroach);
    if (!cockroach.alive || !motion || !Number.isFinite(deltaMs)) return;

    let timeLeft = deltaMs;
    while (timeLeft > 0) {
      if (cockroach.state === 'idle') {
        const idleDelta = Math.min(timeLeft, motion.idleRemainingMs);
        timeLeft -= idleDelta;
        motion.idleRemainingMs -= idleDelta;
        if (motion.idleRemainingMs === 0) this.chooseWaypoint(cockroach, motion);
        continue;
      }

      const target = motion.destination;
      if (cockroach.state !== 'crawling' || !target) return;

      const position = cockroach.position;
      const remainingDistance = distance(position, target.position);
      const travelMs = 1_000 * remainingDistance / cockroach.speed;
      if (timeLeft < travelMs) {
        const fraction = timeLeft / travelMs;
        position.x = lerp(position.x, target.position.x, fraction);
        position.y = lerp(position.y, target.position.y, fraction);
        position.z = lerp(position.z, target.position.z, fraction);
        return;
      }

      timeLeft -= travelMs;
      Object.assign(position, target.position);
      Object.assign(cockroach.surfaceNormal, target.surfaceNormal);
      cockroach.surfaceType = target.surfaceType;
      this.beginIdle(cockroach, motion);
    }
  }

  private beginIdle(cockroach: Cockroach, motion: GroundMotion): void {
    motion.idleRemainingMs = lerp(300, 1_000, this.random());
    motion.destination = null;
    cockroach.state = 'idle';
    cockroach.targetWaypoint = null;
    cockroach.speed = 0;
  }

  private chooseWaypoint(cockroach: Cockroach, motion: GroundMotion): void {
    const sameSurface: SurfacePoint[] = [];
    const adjacent: SurfacePoint[] = [];
    for (const waypoint of this.waypoints) {
      const range = distance(cockroach.position, waypoint.position);
      if (range === 0) continue;
      if (waypoint.surfaceType === cockroach.surfaceType) {
        sameSurface.push(waypoint);
      } else if (range <= ADJACENT_WAYPOINT_DISTANCE) {
        adjacent.push(waypoint);
      }
    }

    const switchSurface = this.random() < SURFACE_SWITCH_CHANCE && adjacent.length > 0;
    const candidates = switchSurface ? adjacent : sameSurface;
    if (candidates.length === 0) {
      this.beginIdle(cockroach, motion);
      return;
    }

    motion.destination = candidates[Math.floor(this.random() * candidates.length)];
    cockroach.targetWaypoint = motion.destination.position;
    cockroach.speed = lerp(0.5, 1.2, this.random());
    cockroach.state = 'crawling';
  }
}
