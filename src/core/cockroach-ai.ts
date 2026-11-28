import { clamp, distance, dot, lerp, lerpVec3, normalize, quadraticBezier, scale, subtract } from '../utils/math-utils';
import { CRAWLING_HITBOX_RADIUS, FLYING_HITBOX_RADIUS } from './hit-detection';
import type { Aabb, BezierCurve, MapData, Cockroach, GameMode, SurfacePoint, Vec3 } from './types';

const ADJACENT_WAYPOINT_DISTANCE = 1.25;
const MAX_GROUND_LEG = 2;
const FACE_EPSILON = 1e-5;
const AXES = ['x', 'y', 'z'] as const;
const SURFACE_SWITCH_CHANCE = 0.1;
const PREFLIGHT_MS = 1_500;
const FLIGHT_MS = 2_000;
const FLIGHT_INITIAL_RATE = 0.25;
const DEFAULT_PLAYER_POSITION = { x: 0, y: 1.6, z: 0 };

interface CockroachMotion {
  idleRemainingMs: number;
  support: SurfacePoint;
  previous: SurfacePoint | null;
  leg: GroundLeg | null;
  flightPhaseRemainingMs: number;
  spawnIndex: number;
  landing: SurfacePoint | null;
  flightDurationMs: number;
}

interface GroundRoute {
  target: SurfacePoint;
  seam?: Vec3;
}

interface GroundLeg {
  start: Vec3;
  end: Vec3;
  elapsedMs: number;
  durationMs: number;
  peakSpeed: number;
  route: GroundRoute;
}

function contains(face: Aabb, point: Vec3): boolean {
  return AXES.every(axis => point[axis] >= face.min[axis] - FACE_EPSILON
    && point[axis] <= face.max[axis] + FACE_EPSILON);
}

// Intersect the whole flight arc with each box face so a long tick cannot skip a thin obstacle.
function firstContact(curve: BezierCurve, room: Aabb, colliders: readonly Aabb[]) {
  const hit: { progress: number; surface: SurfacePoint | null } = { progress: Infinity, surface: null };
  function inspect(box: Aabb, supportId?: number) {
    for (const axis of AXES) {
      const start = curve.start[axis];
      const b = 2 * (curve.control[axis] - start);
      const a = curve.end[axis] - start - b;
      for (const side of ['min', 'max'] as const) {
        const plane = box[side][axis];
        const c = start - plane;
        const normal = (side === 'min' ? 1 : -1) * (supportId === undefined ? 1 : -1);
        const discriminant = b * b - 4 * a * c;
        const roots = Math.abs(a) < 1e-10 ? [-c / b]
          : [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)];
        for (const t of roots) {
          if (!(t >= 0 && t <= 1 && t < hit.progress) || normal * (2 * a * t + b) >= 0) continue;
          const position = quadraticBezier(curve, t);
          if (!contains(box, position)) continue;
          position[axis] = plane;
          const surfaceNormal = { x: 0, y: 0, z: 0 };
          surfaceNormal[axis] = normal;
          const supportBounds = { min: { ...box.min }, max: { ...box.max } };
          supportBounds.min[axis] = supportBounds.max[axis] = plane;
          const surfaceType = supportId !== undefined ? 'furniture'
            : axis !== 'y' ? 'wall' : normal > 0 ? 'floor' : 'ceiling';
          hit.surface = { position, surfaceNormal, surfaceType, supportBounds, supportId };
          hit.progress = t;
        }
      }
    }
  }
  inspect(room);
  colliders.forEach((box, index) => inspect(box, index));
  return hit;
}
function supportedRoute(from: SurfacePoint, target: SurfacePoint): GroundRoute | null {
  const range = distance(from.position, target.position);
  if (range <= FACE_EPSILON || range > MAX_GROUND_LEG) return null;
  if (from.supportId !== undefined && target.supportId !== undefined && from.supportId !== target.supportId) return null;
  const alignment = dot(from.surfaceNormal, target.surfaceNormal);
  const coplanar = alignment > 1 - FACE_EPSILON && from.surfaceType === target.surfaceType
    && Math.abs(dot(subtract(target.position, from.position), from.surfaceNormal)) < FACE_EPSILON;
  const a = from.supportBounds;
  const b = target.supportBounds;
  if ((a && !contains(a, from.position)) || (b && !contains(b, target.position))) return null;
  if (coplanar && ((!a && !b) || (a && contains(a, target.position)) || (b && contains(b, from.position)))) {
    return { target };
  }
  if (!a || !b || (!coplanar && (Math.abs(alignment) > FACE_EPSILON || range > ADJACENT_WAYPOINT_DISTANCE))) {
    return null;
  }

  // A point in the intersection splits travel into two segments inside convex faces.
  const seam = lerpVec3(from.position, target.position, 0.5);
  for (const axis of AXES) {
    const min = Math.max(a.min[axis], b.min[axis]);
    const max = Math.min(a.max[axis], b.max[axis]);
    if (min > max + FACE_EPSILON) return null;
    seam[axis] = clamp(seam[axis], min, max);
  }
  return { target, seam };
}

function tangent(normal: Vec3): Vec3 {
  const axis = Math.abs(normal.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  return normalize(subtract(axis, scale(normal, dot(axis, normal))));
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
    groundFacing: { x: 0, y: 0, z: 1 },
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
    private readonly geometry?: Pick<MapData, 'roomBounds' | 'colliders'>,
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
      leg: null,
      support: start,
      previous: null,
      flightPhaseRemainingMs: this.mode === 'hell' ? lerp(3_000, 8_000, this.random()) : Infinity,
      spawnIndex,
      landing: null,
      flightDurationMs: FLIGHT_MS,
    };
    this.motions.set(cockroach, motion);
    cockroach.alive = true;
    Object.assign(cockroach.position, start.position);
    Object.assign(cockroach.surfaceNormal, start.surfaceNormal);
    Object.assign(cockroach.groundFacing, tangent(start.surfaceNormal));
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
  ): void {
    const motion = this.motions.get(cockroach);
    if (!cockroach.alive || !motion || !Number.isFinite(deltaMs)) return;

    let timeLeft = deltaMs;
    while (timeLeft > 0) {
      const step = Math.min(timeLeft, motion.flightPhaseRemainingMs);
      timeLeft -= step;
      motion.flightPhaseRemainingMs -= step;
      if (cockroach.state === 'flying') {
        if (!cockroach.flightCurve) return;
        const elapsed = 1 - motion.flightPhaseRemainingMs / motion.flightDurationMs;
        const progress = elapsed * lerp(FLIGHT_INITIAL_RATE, 1, elapsed);
        cockroach.flightProgress = progress;
        Object.assign(cockroach.position, quadraticBezier(cockroach.flightCurve, progress));
        if (motion.flightPhaseRemainingMs === 0) {
          if (motion.landing) this.land(cockroach, motion, motion.landing);
          else this.descend(cockroach, motion);
        }
        continue;
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
  }

  private updateGround(cockroach: Cockroach, motion: CockroachMotion, deltaMs: number): void {
    let timeLeft = deltaMs;
    while (timeLeft > 0) {
      const leg = motion.leg;
      if (!leg) {
        const idleDelta = Math.min(timeLeft, motion.idleRemainingMs);
        timeLeft -= idleDelta;
        motion.idleRemainingMs -= idleDelta;
        if (motion.idleRemainingMs === 0) this.chooseWaypoint(cockroach, motion);
        continue;
      }

      const remainingMs = leg.durationMs - leg.elapsedMs;
      if (timeLeft < remainingMs) {
        leg.elapsedMs += timeLeft;
        const t = leg.elapsedMs / leg.durationMs;
        // Smoothstep displacement has derivative 6t(1-t), peaking halfway.
        Object.assign(cockroach.position, lerpVec3(leg.start, leg.end, t * t * (3 - 2 * t)));
        cockroach.speed = 4 * leg.peakSpeed * t * (1 - t);
        return;
      }

      timeLeft -= remainingMs;
      Object.assign(cockroach.position, leg.end);
      const target = leg.route.target;
      Object.assign(cockroach.surfaceNormal, target.surfaceNormal);
      cockroach.surfaceType = target.surfaceType;
      if (leg.route.seam && distance(leg.end, target.position) > FACE_EPSILON) {
        this.beginLeg(cockroach, motion, { target }, leg.peakSpeed);
        continue;
      }
      if (Math.abs(dot(cockroach.groundFacing, target.surfaceNormal)) > FACE_EPSILON) {
        Object.assign(cockroach.groundFacing, tangent(target.surfaceNormal));
      }
      motion.previous = motion.support;
      motion.support = target;
      this.beginIdle(cockroach, motion);
    }
  }

  private beginIdle(cockroach: Cockroach, motion: CockroachMotion): void {
    motion.idleRemainingMs = lerp(300, 1_000, this.random());
    motion.leg = null;
    cockroach.state = 'idle';
    cockroach.targetWaypoint = null;
    cockroach.speed = 0;
  }

  private chooseWaypoint(cockroach: Cockroach, motion: CockroachMotion): void {
    const sameSurface: GroundRoute[] = [];
    const adjacent: GroundRoute[] = [];
    for (const waypoint of this.waypoints) {
      const route = supportedRoute(motion.support, waypoint);
      if (!route) continue;
      const candidates = dot(motion.support.surfaceNormal, waypoint.surfaceNormal) > 0.95 ? sameSurface : adjacent;
      candidates.push(route);
    }

    const switchSurface = this.random() < SURFACE_SWITCH_CHANCE && adjacent.length > 0;
    const candidates = switchSurface ? adjacent : sameSurface;
    const route = candidates.length > 0 ? candidates[Math.floor(this.random() * candidates.length)]
      : motion.previous && supportedRoute(motion.support, motion.previous);
    if (!route) {
      this.beginIdle(cockroach, motion);
      return;
    }

    this.beginLeg(cockroach, motion, route, lerp(0.5, 1.2, this.random()));
  }

  private beginLeg(cockroach: Cockroach, motion: CockroachMotion, route: GroundRoute, peakSpeed: number): void {
    const start = { ...cockroach.position };
    const end = route.seam ?? route.target.position;
    const length = distance(start, end);
    // A marker may already sit on the seam. The zero-duration segment changes support immediately.
    motion.leg = { start, end, route, peakSpeed, durationMs: 1_500 * length / peakSpeed, elapsedMs: 0 };
    if (length > FACE_EPSILON) Object.assign(cockroach.groundFacing, normalize(subtract(end, start)));
    cockroach.targetWaypoint = route.target.position;
    cockroach.speed = 0;
    cockroach.state = 'crawling';
  }

  private beginPreflight(cockroach: Cockroach, motion: CockroachMotion): FlightPhaseChange {
    motion.leg = null;
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
    this.setFlightLeg(cockroach, motion, { start, control, end }, null);
    cockroach.state = 'flying';
    cockroach.hitboxRadius = FLYING_HITBOX_RADIUS;
    return { state: 'flying', cockroachId: cockroach.id, position: { ...start }, velocity };
  }

  private setFlightLeg(cockroach: Cockroach, motion: CockroachMotion, curve: BezierCurve, landing: SurfacePoint | null): void {
    const contact = this.geometry && firstContact(curve, this.geometry.roomBounds, this.geometry.colliders);
    let fraction = 1;
    if (contact?.surface) {
      fraction = contact.progress;
      landing = contact.surface;
      // Preserve the portion of the quadratic up to contact.
      curve = { start: curve.start, control: lerpVec3(curve.start, curve.control, fraction), end: landing.position };
    }
    motion.landing = landing;
    motion.flightDurationMs = Math.max(1, FLIGHT_MS * fraction);
    motion.flightPhaseRemainingMs = motion.flightDurationMs;
    cockroach.flightCurve = curve;
    cockroach.flightProgress = 0;
  }

  private descend(cockroach: Cockroach, motion: CockroachMotion): void {
    const start = { ...cockroach.position };
    const floor = this.geometry?.roomBounds.min.y;
    const landing: SurfacePoint = floor === undefined ? motion.support : {
      position: { ...start, y: floor }, surfaceType: 'floor', surfaceNormal: { x: 0, y: 1, z: 0 },
    };
    this.setFlightLeg(cockroach, motion, { start, control: lerpVec3(start, landing.position, 0.5), end: landing.position }, landing);
  }

  private land(cockroach: Cockroach, motion: CockroachMotion, point: SurfacePoint): void {
    // Reuse the authored surface type for crawling on a known furniture face.
    const marker = this.waypoints.find(candidate => candidate.supportBounds && point.supportBounds
      && candidate.supportId === point.supportId && dot(candidate.surfaceNormal, point.surfaceNormal) > 0.999
      && contains(candidate.supportBounds, point.position));
    motion.support = marker ? { ...point, surfaceType: marker.surfaceType } : point;
    motion.previous = null;
    motion.landing = null;
    motion.flightPhaseRemainingMs = lerp(3_000, 8_000, this.random());
    Object.assign(cockroach.position, point.position);
    Object.assign(cockroach.surfaceNormal, point.surfaceNormal);
    Object.assign(cockroach.groundFacing, tangent(point.surfaceNormal));
    cockroach.surfaceType = motion.support.surfaceType;
    cockroach.hitboxRadius = CRAWLING_HITBOX_RADIUS;
    cockroach.flightCurve = null;
    cockroach.flightProgress = 0;
    this.beginIdle(cockroach, motion);
  }
}
