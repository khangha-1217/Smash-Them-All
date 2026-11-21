import { describe, expect, it } from 'vitest';
import { Timer } from '../../src/core/timer';
import { EventEmitter } from '../../src/utils/event-emitter';

describe('Timer', () => {
  it('uses real elapsed milliseconds even for slow frames', () => {
    const bus = new EventEmitter();
    const ticks: number[] = [];
    bus.on('TIMER_TICK', ({ timeRemaining }) => ticks.push(timeRemaining));
    const timer = new Timer(bus, () => undefined);

    timer.start();
    expect(timer.advance(1_234)).toBe(1_234);
    expect(timer.advance(350)).toBe(350);

    expect(timer.elapsedMs).toBe(1_584);
    expect(timer.timeRemaining).toBeCloseTo(88.416);
    expect(ticks).toEqual([90, 88.766, 88.416]);
  });

  it('freezes until started or while paused and ignores invalid deltas', () => {
    const timer = new Timer(new EventEmitter(), () => undefined);

    expect(timer.advance(5_000)).toBe(0);
    timer.resume();
    expect(timer.advance(1_000)).toBe(0);
    timer.start();
    timer.advance(1_000);
    timer.pause();
    expect(timer.advance(15_000)).toBe(0);
    expect(timer.timeRemaining).toBe(89);
    timer.resume();
    expect(timer.advance(0)).toBe(0);
    expect(timer.advance(-1)).toBe(0);
    expect(timer.advance(Number.NaN)).toBe(0);
    timer.advance(500);

    expect(timer.elapsedMs).toBe(1_500);
    expect(timer.timeRemaining).toBe(88.5);
  });

  it('warns once at each observed whole display second in the final ten seconds', () => {
    const bus = new EventEmitter();
    const warnings: number[] = [];
    bus.on('TIMER_WARNING', ({ timeRemaining }) => warnings.push(timeRemaining));
    const timer = new Timer(bus, () => undefined);

    timer.start();
    timer.advance(79_999);
    expect(warnings).toEqual([]);
    timer.advance(1);
    timer.advance(25);
    timer.advance(975);
    timer.advance(1_750);
    timer.advance(9_000);

    expect(warnings).toEqual([10, 9, 7.25]);
  });

  it('publishes a zero tick before a single expiry and can start another round', () => {
    const bus = new EventEmitter();
    const signals: Array<number | 'expired'> = [];
    bus.on('TIMER_TICK', ({ timeRemaining }) => signals.push(timeRemaining));
    const timer = new Timer(bus, () => signals.push('expired'));

    timer.start();
    expect(timer.advance(95_000)).toBe(90_000);
    expect(timer.advance(100)).toBe(0);
    timer.resume();
    expect(timer.advance(100)).toBe(0);
    expect(timer.timeRemaining).toBe(0);
    expect(timer.elapsedMs).toBe(90_000);
    expect(signals).toEqual([90, 0, 'expired']);

    timer.start();
    timer.advance(90_000);
    expect(signals).toEqual([90, 0, 'expired', 90, 0, 'expired']);
    timer.reset();
    expect(timer.timeRemaining).toBe(90);
    expect(timer.elapsedMs).toBe(0);
    expect(timer.advance(100)).toBe(0);
  });
});
