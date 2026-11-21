import type { EventEmitter } from '../utils/event-emitter';

const DURATION_MS = 90_000;
const WARNING_SECONDS = 10;

export class Timer {
  private remainingMs = DURATION_MS;
  private phase: 'idle' | 'running' | 'paused' = 'idle';

  constructor(
    private readonly events: EventEmitter,
    private readonly onExpire: () => void,
  ) {}

  get timeRemaining(): number {
    return this.remainingMs / 1_000;
  }

  get elapsedMs(): number {
    return DURATION_MS - this.remainingMs;
  }

  start(): void {
    this.remainingMs = DURATION_MS;
    this.phase = 'running';
    this.events.emit('TIMER_TICK', { timeRemaining: this.timeRemaining });
  }

  pause(): void {
    if (this.phase === 'running') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'running';
  }

  reset(): void {
    this.remainingMs = DURATION_MS;
    this.phase = 'idle';
  }

  advance(deltaMs: number): number {
    if (this.phase !== 'running' || !Number.isFinite(deltaMs) || deltaMs <= 0) return 0;

    const previousSecond = Math.ceil(this.timeRemaining);
    const activeDeltaMs = Math.min(deltaMs, this.remainingMs);
    this.remainingMs -= activeDeltaMs;
    const timeRemaining = this.timeRemaining;
    if (timeRemaining === 0) this.phase = 'idle';

    this.events.emit('TIMER_TICK', { timeRemaining });
    if (timeRemaining === 0) {
      this.onExpire();
    } else if (timeRemaining <= WARNING_SECONDS && Math.ceil(timeRemaining) < previousSecond) {
      this.events.emit('TIMER_WARNING', { timeRemaining });
    }
    return activeDeltaMs;
  }
}
