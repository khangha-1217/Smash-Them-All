import { DesktopInput } from './desktop-input';

// Desktop and future touch adapters produce the same gameplay commands.
export interface InputCommands {
  move(right: number, forward: number, seconds: number): boolean;
  look(horizontal: number, vertical: number): void;
  swing(): void;
  pause(): void;
  lockChanged(locked: boolean): void;
}

export class InputManager {
  readonly desktop: DesktopInput;
  private enabled = false;
  private right = 0;
  private forward = 0;

  constructor(canvas: HTMLCanvasElement, private readonly commands: InputCommands) {
    this.desktop = new DesktopInput(canvas, {
      movement: (right, forward) => this.movement(right, forward),
      look: (horizontal, vertical) => this.look(horizontal, vertical),
      swing: () => this.swing(),
      pause: () => this.commands.pause(),
      lockChanged: locked => this.commands.lockChanged(locked),
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.desktop.setEnabled(enabled);
  }

  movement(right: number, forward: number): void {
    this.right = this.enabled ? right : 0;
    this.forward = this.enabled ? forward : 0;
  }

  look(horizontal: number, vertical: number): void {
    if (this.enabled) this.commands.look(horizontal, vertical);
  }

  swing(): void {
    if (this.enabled) this.commands.swing();
  }

  update(seconds: number): boolean {
    return this.enabled && this.commands.move(this.right, this.forward, seconds);
  }
}
