import type {
  CockroachState,
  GameState,
  HitResult,
  Language,
  NearMiss,
  Pose,
  RoundConfig,
  RoundResult,
  Vec3,
} from '../core/types';

interface SwingEvent {
  position: Vec3;
  direction: Vec3;
}

interface CockroachPositionEvent {
  cockroachId: number;
  position: Vec3;
}

export interface GameEvents {
  STATE_CHANGED: { from: GameState; to: GameState };
  ROUND_STARTED: RoundConfig;
  ROUND_ENDED: { roundResult: RoundResult };
  TIMER_TICK: { timeRemaining: number };
  TIMER_WARNING: { timeRemaining: number };
  WEAPON_SWING: SwingEvent;
  WEAPON_CONTACT: { outcome: HitResult['type'] };
  COCKROACH_HIT: CockroachPositionEvent & { points: number; comboMultiplier: number };
  COCKROACH_NEAR_MISS: NearMiss;
  WEAPON_MISS: SwingEvent;
  COMBO_UPDATED: { multiplier: number };
  COMBO_RESET: Record<string, never>;
  SCORE_UPDATED: { score: number; delta: number };
  COCKROACH_SPAWNED: CockroachPositionEvent & { surfaceType: string };
  COCKROACH_MOVED: Pose & { cockroachId: number; state: CockroachState; groundFacing: Vec3; speed: number };
  COCKROACH_PREFLIGHT: CockroachPositionEvent;
  COCKROACH_FLYING: CockroachPositionEvent & { velocity: Vec3 };
  COCKROACH_DESPAWNED: { cockroachId: number; reason: 'killed' | 'reached_player' };
  KILL_COUNT_UPDATED: { kills: number };
  ACHIEVEMENT_UNLOCKED: {
    achievementId: string;
    nameVi: string;
    nameEn: string;
    flavorVi: string;
    flavorEn: string;
  };
  PLAYER_MOVED: Pose;
  LANGUAGE_CHANGED: { language: Language };
  SOUND_TOGGLED: { enabled: boolean };
}

type EventName = keyof GameEvents;
type Listener<K extends EventName> = (payload: GameEvents[K]) => void;
type ListenerErrorReporter = (error: unknown, event: EventName) => void;

export class EventEmitter {
  private readonly listeners = new Map<EventName, Set<(payload: never) => void>>();

  constructor(private readonly reportListenerError: ListenerErrorReporter = (error, event) => {
    console.error('Game event listener failed', event, error);
  }) {}

  on<K extends EventName>(event: K, listener: Listener<K>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<(payload: never) => void>();
    // Give each registration an independent subscription.
    const subscription = (payload: GameEvents[K]) => listener(payload);
    listeners.add(subscription);
    this.listeners.set(event, listeners);

    return () => {
      listeners.delete(subscription);
    };
  }

  emit<K extends EventName>(event: K, payload: GameEvents[K]): void {
    // Each set contains only subscriptions registered for this event's payload.
    const listeners = this.listeners.get(event) as Set<Listener<K>> | undefined;
    if (!listeners?.size) return;

    for (const listener of [...listeners]) {
      try {
        listener(payload);
      } catch (error) {
        try {
          this.reportListenerError(error, event);
        } catch {
          // Error reporting must also leave event delivery and the producer intact.
        }
      }
    }
  }
}
