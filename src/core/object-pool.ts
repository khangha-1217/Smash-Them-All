export class ObjectPool<T extends object> {
  private readonly slots: T[];
  private readonly available: T[];
  private readonly inUse = new Set<T>();

  constructor(
    capacity: number,
    create: (id: number) => T,
    private readonly resetSlot?: (slot: T) => void,
  ) {
    this.slots = Array.from({ length: capacity }, (_, id) => create(id));
    this.available = [...this.slots].reverse();
  }

  get active(): ReadonlySet<T> {
    return this.inUse;
  }

  acquire(): T | null {
    const slot = this.available.pop();
    if (!slot) return null;
    this.inUse.add(slot);
    return slot;
  }

  release(slot: T): boolean {
    if (!this.inUse.delete(slot)) return false;
    this.resetSlot?.(slot);
    this.available.push(slot);
    return true;
  }

  reset(): void {
    for (const slot of this.inUse) this.resetSlot?.(slot);
    this.inUse.clear();
    this.available.length = 0;
    for (let index = this.slots.length - 1; index >= 0; index--) {
      this.available.push(this.slots[index]);
    }
  }
}
