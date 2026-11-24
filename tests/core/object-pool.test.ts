import { describe, expect, it } from 'vitest';
import { ObjectPool } from '../../src/core/object-pool';

describe('ObjectPool', () => {
  it('preallocates slots once and returns null when exhausted', () => {
    const allocations: number[] = [];
    const pool = new ObjectPool(2, (id) => {
      allocations.push(id);
      return { id };
    });

    expect(allocations).toEqual([0, 1]);
    expect([...pool.active]).toEqual([]);
    const first = pool.acquire();
    const second = pool.acquire();

    expect(first).toEqual({ id: 0 });
    expect(second).toEqual({ id: 1 });
    expect([...pool.active]).toEqual([first, second]);
    expect(pool.acquire()).toBeNull();
    expect(allocations).toEqual([0, 1]);
  });

  it('releases and reuses the same object while ignoring duplicate and foreign releases', () => {
    const pool = new ObjectPool(1, (id) => ({ id, alive: false }), (slot) => {
      slot.alive = false;
    });
    const slot = pool.acquire()!;
    slot.alive = true;

    expect(pool.release({ id: 0, alive: true })).toBe(false);
    expect([...pool.active]).toEqual([slot]);
    expect(pool.release(slot)).toBe(true);
    expect(pool.release(slot)).toBe(false);
    expect([...pool.active]).toEqual([]);
    expect(slot.alive).toBe(false);
    expect(pool.acquire()).toBe(slot);
    expect(pool.acquire()).toBeNull();
  });

  it('resets all active objects without duplicating or reallocating any slot', () => {
    const pool = new ObjectPool(3, (id) => ({ id, position: 0 }), (slot) => {
      slot.position = 0;
    });
    const first = pool.acquire()!;
    const second = pool.acquire()!;
    first.position = 10;
    second.position = 20;

    pool.reset();

    expect([...pool.active]).toEqual([]);
    expect(first.position).toBe(0);
    expect(second.position).toBe(0);
    expect(pool.acquire()).toBe(first);
    expect(pool.acquire()).toBe(second);
    expect(pool.acquire()).toEqual({ id: 2, position: 0 });
    expect(pool.acquire()).toBeNull();
  });

  it('can recycle an object without a reset callback', () => {
    const pool = new ObjectPool(1, (id) => ({ id }));
    const slot = pool.acquire()!;

    pool.reset();

    expect(pool.acquire()).toBe(slot);
  });
});
