export interface DesktopCommands {
  movement(right: number, forward: number): void;
  look(horizontal: number, vertical: number): void;
  swing(): void;
  pause(): void;
  lockChanged(locked: boolean): void;
}

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

export class DesktopInput {
  private readonly held = new Set<string>();
  private enabled = false;
  private requestPending = false;
  private wantsLock = false;

  constructor(private readonly target: HTMLCanvasElement, private readonly commands: DesktopCommands) {
    document.addEventListener('keydown', this.keyDown);
    document.addEventListener('keyup', this.keyUp);
    document.addEventListener('mousemove', event => {
      if (this.enabled && this.locked) this.commands.look(event.movementX, event.movementY);
    });
    document.addEventListener('mousedown', event => {
      if (this.enabled && this.locked && event.button === 0) {
        event.preventDefault();
        this.commands.swing();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.requestPending = false;
      if (this.locked && !this.wantsLock) {
        document.exitPointerLock();
        return;
      }
      if (!this.locked) this.clear();
      this.commands.lockChanged(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.rejectRequest());
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  get pending(): boolean {
    return this.requestPending;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  acquire(): void {
    this.wantsLock = true;
    if (this.locked || this.requestPending) return;

    try {
      this.requestPending = true;
      const request = this.target.requestPointerLock();
      if (request) void request.catch(() => this.rejectRequest());
    } catch {
      this.rejectRequest();
    }
  }

  release(): void {
    this.wantsLock = false;
    this.clear();
    if (this.locked) document.exitPointerLock();
  }

  clear(): void {
    this.held.clear();
    this.commands.movement(0, 0);
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;

    if (event.code === 'Escape') {
      this.commands.pause();
    } else if (MOVEMENT_KEYS.has(event.code)) {
      event.preventDefault();
      this.held.add(event.code);
      this.updateMovement();
    }
  };

  private readonly keyUp = (event: KeyboardEvent): void => {
    if (this.held.delete(event.code)) this.updateMovement();
  };

  private updateMovement(): void {
    this.commands.movement(
      Number(this.held.has('KeyD')) - Number(this.held.has('KeyA')),
      Number(this.held.has('KeyW')) - Number(this.held.has('KeyS')),
    );
  }

  private rejectRequest(): void {
    if (!this.requestPending) return;
    this.requestPending = false;
    this.wantsLock = false;
    this.commands.lockChanged(false);
  }
}
