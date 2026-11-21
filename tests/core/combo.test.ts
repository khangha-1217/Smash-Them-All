import { describe, expect, it } from 'vitest';
import { ComboTracker } from '../../src/core/combo';
import { EventEmitter } from '../../src/utils/event-emitter';

describe('ComboTracker', () => {
  it('starts with x1 and continues at an exact 2,000 ms gap', () => {
    const bus = new EventEmitter();
    const updates: number[] = [];
    bus.on('COMBO_UPDATED', ({ multiplier }) => updates.push(multiplier));
    const combo = new ComboTracker(bus);

    expect(combo.hit(0)).toBe(1);
    combo.update(2_000);
    expect(combo.hit(2_000)).toBe(2);
    expect(combo.hit(2_100)).toBe(3);
    expect(combo.multiplier).toBe(3);
    expect(combo.maxCombo).toBe(3);
    expect(updates).toEqual([1, 2, 3]);
  });

  it('resets one time when the window expires and preserves the round maximum', () => {
    const bus = new EventEmitter();
    const resets: object[] = [];
    bus.on('COMBO_RESET', (event) => resets.push(event));
    const combo = new ComboTracker(bus);
    combo.hit(0);
    combo.hit(500);

    combo.update(2_500);
    expect(combo.multiplier).toBe(2);
    combo.update(2_501);
    combo.update(3_000);

    expect(combo.multiplier).toBe(1);
    expect(combo.maxCombo).toBe(2);
    expect(resets).toEqual([{}]);
    expect(combo.hit(3_000)).toBe(1);
  });

  it('starts a new streak when a hit arrives after the window without a frame update', () => {
    const combo = new ComboTracker(new EventEmitter());
    combo.hit(100);
    combo.hit(200);

    expect(combo.hit(2_201)).toBe(1);
    expect(combo.maxCombo).toBe(2);
  });

  it('breaks an x1 streak on a miss and clears round history on reset', () => {
    const bus = new EventEmitter();
    const resets: object[] = [];
    bus.on('COMBO_RESET', (event) => resets.push(event));
    const combo = new ComboTracker(bus);
    combo.hit(100);

    combo.miss();
    combo.miss();
    expect(resets).toEqual([{}]);
    expect(combo.hit(150)).toBe(1);
    expect(combo.hit(300)).toBe(2);

    combo.reset();
    expect(combo.multiplier).toBe(1);
    expect(combo.maxCombo).toBe(1);
    expect(combo.hit(0)).toBe(1);
  });
});
