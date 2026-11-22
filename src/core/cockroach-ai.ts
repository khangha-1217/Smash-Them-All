import { distance, dot, lerp, lerpVec3, quadraticBezier, scale, subtract } from '../utils/math-utils';
import { CRAWLING_HITBOX_RADIUS, FLYING_HITBOX_RADIUS } from './hit-detection';
import type { Cockroach, GameMode, SurfacePoint, Vec3 } from './types';

const ADJACENT_WAYPOINT_DISTANCE = 1.25;
const SURFACE_SWITCH_CHANCE = 0.1;
const PREFLIGHT_MS = 1_500;
const FLIGHT_MS = 2_000;
const FLIGHT_INITIAL_RATE = 0.25;
const DEFAULT_PLAYER_POSITION = { x: 0, y: 1.6, z: 0 };

interface CockroachMotion {
  idleRemainingMs: number;
  destination: SurfacePoint | null;
  supportId: number | undefined;
  flightPhaseRemainingMs: number;
  spawnIndex: number;
}

export type FlightPhaseChange =
  | { state: 'preflight'; cockroachId: number; position: Vec3 }
  | { state: 'flying'; cockroachId: number; position: Vec3; velocity: Vec3 };

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
  private readonly motions = new WeakMap<Cockroach, CockroachMotion>();

  constructor(
    private readonly spawnPoints: readonly SurfacePoint[],
    private readonly waypoints: readonly SurfacePoint[],
    private readonly random: () => number = Math.random,
    private readonly mode: GameMode = 'normal',
  ) {}

  spawn(cockroach: Cockroach): boolean {
    if (this.spawnPoints.length === 0) return false;

    const previous = this.motions.get(cockroach);
    const skipPrevious = this.mode === 'hell' && previous !== undefined && this.spawnPoints.length > 1;
    let spawnIndex = Math.floor(this.random() * (this.spawnPoints.length - Number(skipPrevious)));
    if (skipPrevious && spawnIndex >= previous.spawnIndex) spawnIndex++;
    const start = this.spawnPoints[spawnIndex];
    const motion: CockroachMotion = {
      idleRemainingMs: 0,
      destination: null,
      supportId: start.supportId,
      flightPhaseRemainingMs: this.mode === 'hell' ? lerp(3_000, 8_000, this.random()) : Infinity,
      spawnIndex,
    };
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

  update(
    cockroach: Cockroach,
    deltaMs: number,
    playerPosition: Vec3 = DEFAULT_PLAYER_POSITION,
    onPhaseChange?: (change: FlightPhaseChange) => void,
  ): boolean {
    const motion = this.motions.get(cockroach);
    if (!cockroach.alive || !motion || !Number.isFinite(deltaMs)) return false;

    let timeLeft = deltaMs;
    while (timeLeft > 0) {
      const step = Math.min(timeLeft, motion.flightPhaseRemainingMs);
      timeLeft -= step;
      motion.flightPhaseRemainingMs -= step;
      if (cockroach.state === 'flying') {
        if (!cockroach.flightCurve) return false;
        const elapsed = 1 - motion.flightPhaseRemainingMs / FLIGHT_MS;
        const progress = elapsed * lerp(FLIGHT_INITIAL_RATE, 1, elapsed);
        cockroach.flightProgress = progress;
        Object.assign(cockroach.position, quadraticBezier(cockroach.flightCurve, progress));
        return elapsed === 1;
      }

      if (cockroach.state === 'idle' || cockroach.state === 'crawling') {
        this.updateGround(cockroach, motion, step);
      }
      if (motion.flightPhaseRemainingMs > 0) continue;

      const change = cockroach.state === 'preflight'
        ? this.beginFlight(cockroach, motion, playerPosition)
        : this.beginPreflight(cockroach, motion);
      onPhaseChange?.(change);
    }
    return false;
  }

  private updateGround(cockroach: Cockroach, motion: CockroachMotion, deltaMs: number): void {
    let timeLeft = deltaMs;
    while (timeLeft > 0) {
      const target = motion.destination;
      if (!target) {
        const idleDelta = Math.min(timeLeft, motion.idleRemainingMs);
        timeLeft -= idleDelta;
        motion.idleRemainingMs -= idleDelta;
        if (motion.idleRemainingMs === 0) this.chooseWaypoint(cockroach, motion);
        continue;
      }

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
      motion.supportId = target.supportId;
      this.beginIdle(cockroach, motion);
    }
  }

  private beginIdle(cockroach: Cockroach, motion: CockroachMotion): void {
    motion.idleRemainingMs = lerp(300, 1_000, this.random());
    motion.destination = null;
    cockroach.state = 'idle';
    cockroach.targetWaypoint = null;
    cockroach.speed = 0;
  }

  private chooseWaypoint(cockroach: Cockroach, motion: CockroachMotion): void {
    const sameSurface: SurfacePoint[] = [];
    const adjacent: SurfacePoint[] = [];
    for (const waypoint of this.waypoints) {
      if (motion.supportId !== undefined && waypoint.supportId !== undefined && motion.supportId !== waypoint.supportId) {
        continue;
      }
      const range = distance(cockroach.position, waypoint.position);
      if (range === 0) continue;
      const sameTag = waypoint.surfaceType === cockroach.surfaceType;
      const alignment = dot(cockroach.surfaceNormal, waypoint.surfaceNormal);
      if (sameTag && alignment > 0.95) {
        sameSurface.push(waypoint);
      } else if ((!sameTag || alignment > -0.95) && range <= ADJACENT_WAYPOINT_DISTANCE) {
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

  private beginPreflight(cockroach: Cockroach, motion: CockroachMotion): FlightPhaseChange {
    motion.destination = null;
    motion.flightPhaseRemainingMs = PREFLIGHT_MS;
    cockroach.state = 'preflight';
    cockroach.speed = 0;
    cockroach.targetWaypoint = null;
    return { state: 'preflight', cockroachId: cockroach.id, position: { ...cockroach.position } };
  }

  private beginFlight(cockroach: Cockroach, motion: CockroachMotion, player: Vec3): FlightPhaseChange {
    const start = { ...cockroach.position };
    const end = {
      x: player.x + lerp(-0.16, 0.16, this.random()),
      y: player.y + lerp(-0.10, 0.10, this.random()),
      z: player.z + lerp(-0.16, 0.16, this.random()),
    };
    const control = lerpVec3(start, end, 0.5);
    control.y += 0.9;
    const velocity = scale(subtract(control, start), 2 * FLIGHT_INITIAL_RATE * 1_000 / FLIGHT_MS);
    cockroach.flightCurve = { start, control, end };
    cockroach.state = 'flying';
    cockroach.hitboxRadius = FLYING_HITBOX_RADIUS;
    motion.flightPhaseRemainingMs = FLIGHT_MS;
    return { state: 'flying', cockroachId: cockroach.id, position: { ...start }, velocity };
  }
}
