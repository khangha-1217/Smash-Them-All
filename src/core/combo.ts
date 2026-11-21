import type { EventEmitter } from '../utils/event-emitter';
import { COMBO_WINDOW_MS } from './types';

export class ComboTracker {
  private currentMultiplier = 1;
  private lastHitTime: number | null = null;
  private maximum = 1;

  constructor(private readonly events: EventEmitter) {}

  get multiplier(): number {
    return this.currentMultiplier;
  }

  get maxCombo(): number {
    return this.maximum;
  }

  hit(activeMs: number): number {
    this.update(activeMs);
    if (this.lastHitTime !== null) this.currentMultiplier++;
    this.lastHitTime = activeMs;
    this.maximum = Math.max(this.currentMultiplier, this.maximum);
    this.events.emit('COMBO_UPDATED', { multiplier: this.currentMultiplier });
    return this.currentMultiplier;
  }

  update(activeMs: number): void {
    if (this.lastHitTime !== null && activeMs - this.lastHitTime > COMBO_WINDOW_MS) this.miss();
  }

  miss(): void {
    if (this.lastHitTime === null) return;

    this.lastHitTime = null;
    this.currentMultiplier = 1;
    this.events.emit('COMBO_RESET', {});
  }

  reset(): void {
    this.lastHitTime = null;
    this.currentMultiplier = 1;
    this.maximum = 1;
  }
}
