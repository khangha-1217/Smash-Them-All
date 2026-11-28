import type { EventEmitter } from '../utils/event-emitter';
import { clamp } from '../utils/math-utils';
import { CockroachAI, createCockroach } from './cockroach-ai';
import type { FlightPhaseChange } from './cockroach-ai';
import { ComboTracker } from './combo';
import { detectHit } from './hit-detection';
import { ObjectPool } from './object-pool';
import { calculateRank } from './ranking';
import { Scoring } from './scoring';
import { StateMachine } from './state-machine';
import { Timer } from './timer';
import { ROUND_DURATION_MS, SWING_CONTACT_MS, SWING_DURATION_MS } from './types';
import type { ActiveSwing, Cockroach, MapData, Rank, Round, RoundConfig, RoundResult, Vec3 } from './types';

const DEFAULT_NORMAL_POOL_SIZE = 20;
const DEFAULT_HELL_POOL_SIZE = 32;
const RESPAWN_DELAY_MS = 1_000;

export interface RoundOptions {
  normalPoolSize?: number;
  hellPoolSize?: number;
  random?: () => number;
}

interface RoundResources {
  ai: CockroachAI;
  pool: ObjectPool<Cockroach>;
  population: number;
}

type Navigation = Pick<MapData, 'spawnPoints' | 'waypoints'> & Partial<Pick<MapData, 'roomBounds' | 'colliders'>>;

export class RoundController {
  private readonly machine: StateMachine;
  private readonly timer: Timer;
  private readonly scoring: Scoring;
  private readonly combo: ComboTracker;
  private readonly normalPoolSize: number;
  private readonly hellPoolSize: number;
  private readonly random: () => number;
  private config: RoundConfig | null = null;
  private resources: RoundResources | null = null;
  private playerPosition?: Vec3;
  private readonly respawnsAt: number[] = [];
  private activeSwing: ActiveSwing | null = null;
  private swings = 0;
  private nearMisses = 0;
  private rank: Rank | null = null;
  private dispatching = false;

  constructor(private readonly events: EventEmitter, options: RoundOptions = {}) {
    const { normalPoolSize = DEFAULT_NORMAL_POOL_SIZE, hellPoolSize = DEFAULT_HELL_POOL_SIZE, random = Math.random } = options;
    this.normalPoolSize = Number.isFinite(normalPoolSize)
      ? clamp(Math.trunc(normalPoolSize), 15, 25)
      : DEFAULT_NORMAL_POOL_SIZE;
    this.hellPoolSize = Number.isFinite(hellPoolSize)
      ? clamp(Math.trunc(hellPoolSize), 25, 40)
      : DEFAULT_HELL_POOL_SIZE;
    this.random = random;
    this.machine = new StateMachine(events);
    this.timer = new Timer(events, () => this.finish());
    this.scoring = new Scoring(events);
    this.combo = new ComboTracker(events);
  }

  get state() {
    return this.machine.current;
  }

  get swingElapsedMs(): number | null {
    return this.activeSwing && this.timer.elapsedMs < this.activeSwing.availableAt
      ? this.timer.elapsedMs - this.activeSwing.startedAt
      : null;
  }

  get selection(): RoundConfig | null {
    return this.config && { ...this.config };
  }

  get stats(): Round | null {
    if (!this.config || this.state === 'MENU') return null;
    return {
      ...this.config,
      timeRemaining: this.timer.timeRemaining,
      score: this.scoring.score,
      kills: this.scoring.kills,
      flyingKills: this.scoring.flyingKills,
      swings: this.swings,
      hits: this.scoring.kills,
      nearMisses: this.nearMisses,
      maxCombo: this.combo.maxCombo,
      rank: this.rank,
    };
  }

  configure(config: RoundConfig): boolean {
    return this.command(() => {
      if (this.state !== 'MENU') return false;
      this.config = { ...config };
      return this.machine.transition('LOADING');
    });
  }

  ready({ spawnPoints, waypoints, roomBounds, colliders }: Navigation): boolean {
    return this.command(() => {
      if (this.state !== 'LOADING') return false;
      if (spawnPoints.length === 0) {
        this.reset();
        this.machine.transition('MENU');
        return false;
      }
      const mode = this.config!.mode;
      const population = mode === 'hell' ? this.hellPoolSize : this.normalPoolSize;
      this.resources = {
        ai: new CockroachAI([...spawnPoints], [...waypoints], this.random, mode,
          roomBounds && { roomBounds, colliders: colliders ?? [] }),
        pool: new ObjectPool(population, createCockroach, (slot) => { slot.alive = false; }),
        population,
      };
      return this.machine.transition('READY');
    });
  }

  start(): boolean {
    return this.command(() => {
      if (this.state !== 'READY') return false;
      // READY is entered only after a loaded configuration has a population pool.
      const resources = this.resources!;
      this.machine.transition('PLAYING');
      this.events.emit('ROUND_STARTED', { ...this.config! });
      this.timer.start();
      for (let count = 0; count < resources.population; count++) this.spawn(resources);
      return true;
    });
  }

  pause(): boolean {
    return this.command(() => {
      if (!this.machine.transition('PAUSED')) return false;
      this.timer.pause();
      return true;
    });
  }

  resume(): boolean {
    return this.command(() => {
      if (this.state !== 'PAUSED') return false;
      this.timer.resume();
      return this.machine.transition('PLAYING');
    });
  }

  quit(): boolean {
    return this.command(() => {
      if (this.state !== 'PAUSED' && this.state !== 'GAME_OVER') return false;
      this.reset();
      return this.machine.transition('MENU');
    });
  }

  failLoad(): boolean {
    return this.command(() => {
      if (this.state !== 'LOADING') return false;
      this.reset();
      return this.machine.transition('MENU');
    });
  }

  replay(): boolean {
    return this.command(() => {
      if (this.state !== 'GAME_OVER') return false;
      this.reset();
      return this.machine.transition('LOADING');
    });
  }

  updatePlayerPosition({ x, y, z }: Vec3): void {
    this.command(() => {
      if (this.state !== 'PLAYING' || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
      this.playerPosition = { x, y, z };
    });
  }

  updateAim(position: Vec3, direction: Vec3): void {
    this.command(() => {
      if (this.state !== 'PLAYING' || this.activeSwing?.phase !== 'windup') return;
      this.activeSwing.position = { ...position };
      this.activeSwing.direction = { ...direction };
    });
  }

  swing(position: Vec3, direction: Vec3): boolean {
    return this.command(() => {
      if (this.state !== 'PLAYING' || this.activeSwing) return false;
      const startedAt = this.timer.elapsedMs;
      this.activeSwing = {
        startedAt,
        contactAt: startedAt + SWING_CONTACT_MS,
        availableAt: startedAt + SWING_DURATION_MS,
        phase: 'windup',
        position: { ...position },
        direction: { ...direction },
      };
      this.events.emit('WEAPON_SWING', { position: { ...position }, direction: { ...direction } });
      return true;
    });
  }

  tick(deltaMs: number): void {
    this.command(() => {
      if (this.state !== 'PLAYING' || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
      let remainingMs = deltaMs;
      const swing = this.activeSwing;
      // At an expiry tie the timer ends the round with the swing still pending.
      if (swing?.phase === 'windup' && swing.contactAt < ROUND_DURATION_MS) {
        const untilContact = swing.contactAt - this.timer.elapsedMs;
        const windupMs = Math.min(remainingMs, untilContact);
        this.advance(windupMs);
        remainingMs -= windupMs;
        // Fractional deltas can round onto the deadline in the timer's subtraction.
        if (windupMs === untilContact || this.timer.elapsedMs >= swing.contactAt) this.resolveContact(swing);
      }
      if (remainingMs > 0) this.advance(remainingMs);
      if (swing && this.timer.elapsedMs >= swing.availableAt) this.activeSwing = null;
    });
  }

  private resolveContact(swing: ActiveSwing): void {
    const activeMs = swing.contactAt;
    const { pool } = this.resources!;
    const hit = detectHit(swing.position, swing.direction, pool.active);
    swing.phase = 'recovery';
    this.swings++;
    this.events.emit('WEAPON_CONTACT', { outcome: hit.type });
    if (hit.target) {
      const { id: cockroachId, position: targetPosition, state } = hit.target;
      // Release the target before exposing its outcome and schedule one replacement.
      pool.release(hit.target);
      this.respawnsAt.push(activeMs + RESPAWN_DELAY_MS);
      const comboMultiplier = this.combo.hit(activeMs);
      const points = this.scoring.awardKill(state, comboMultiplier);
      this.events.emit('COCKROACH_HIT', { cockroachId, position: { ...targetPosition }, points, comboMultiplier });
      this.events.emit('COCKROACH_DESPAWNED', { cockroachId, reason: 'killed' });
    } else {
      if (hit.nearMiss) this.nearMisses++;
      this.combo.miss();
      this.events.emit('WEAPON_MISS', { position: { ...swing.position }, direction: { ...swing.direction } });
      if (hit.nearMiss) this.events.emit('COCKROACH_NEAR_MISS', hit.nearMiss);
    }
  }

  private advance(deltaMs: number): void {
    const resources = this.resources!;
    let remainingMs = deltaMs;
    while (remainingMs > 0) {
      const nextRespawnAt = this.respawnsAt[0] ?? Infinity;
      const stepMs = Math.min(remainingMs, nextRespawnAt - this.timer.elapsedMs);

      this.timer.advance(stepMs);
      if (this.timer.timeRemaining === 0) return;
      remainingMs -= stepMs;
      const activeMs = this.timer.elapsedMs;
      this.advanceCockroaches(resources, stepMs, activeMs);
      while (this.respawnsAt.length && this.respawnsAt[0] <= activeMs) {
        this.respawnsAt.shift();
        this.spawn(resources);
      }
    }
  }

  private advanceCockroaches(resources: RoundResources, elapsedMs: number, activeMs: number): void {
    this.combo.update(activeMs);
    for (const cockroach of resources.pool.active) {
      resources.ai.update(cockroach, elapsedMs, this.playerPosition, this.emitFlightPhase);
      const { x, y, z } = cockroach.surfaceNormal;
      this.events.emit('COCKROACH_MOVED', {
        cockroachId: cockroach.id,
        position: { ...cockroach.position },
        // Tilt the local up axis to the surface normal.
        rotation: { x: Math.atan2(z, y), y: 0, z: Math.atan2(-x, Math.hypot(y, z)) },
        state: cockroach.state,
        groundFacing: { ...cockroach.groundFacing },
        speed: cockroach.speed,
      });
    }
  }

  private readonly emitFlightPhase = (change: FlightPhaseChange): void => {
    const { cockroachId, position } = change;
    if (change.state === 'preflight') {
      this.events.emit('COCKROACH_PREFLIGHT', { cockroachId, position });
    } else {
      this.events.emit('COCKROACH_FLYING', { cockroachId, position, velocity: change.velocity });
    }
  };

  private command<T>(action: () => T): T | false {
    // Listeners can read state during a notification. Mutating commands are applied between notifications.
    if (this.dispatching) return false;
    this.dispatching = true;
    try {
      return action();
    } finally {
      this.dispatching = false;
    }
  }

  private spawn({ ai, pool }: RoundResources): void {
    // The start loop fills the pool and each scheduled respawn corresponds to a release.
    const cockroach = pool.acquire()!;
    ai.spawn(cockroach);
    this.events.emit('COCKROACH_SPAWNED', {
      cockroachId: cockroach.id,
      position: { ...cockroach.position },
      surfaceType: cockroach.surfaceType,
    });
  }

  private finish(): void {
    this.activeSwing = null;
    const stats = this.stats!;
    const placement = calculateRank(stats.score, stats.mode);
    const roundResult: RoundResult = {
      ...stats,
      ...placement,
      accuracy: stats.swings === 0 ? 0 : stats.hits / stats.swings,
      misses: stats.swings - stats.hits,
    };
    this.rank = roundResult.rank;
    this.machine.transition('GAME_OVER');
    this.events.emit('ROUND_ENDED', { roundResult });
  }

  private reset(): void {
    this.resources = null;
    this.playerPosition = undefined;
    this.respawnsAt.length = 0;
    this.activeSwing = null;
    this.swings = 0;
    this.nearMisses = 0;
    this.rank = null;
    this.timer.reset();
    this.scoring.reset();
    this.combo.reset();
  }
}
