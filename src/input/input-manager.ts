import { DesktopInput } from './desktop-input';
import { MobileInput } from './mobile-input';

export type InputMode = 'desktop' | 'touch';

export interface InputCommands {
  move(right: number, forward: number, seconds: number): boolean;
  look(horizontal: number, vertical: number): void;
  swing(): void;
  pause(): void;
  lockChanged(locked: boolean): void;
  modeChanged(mode: InputMode): void;
}

export class InputManager {
  private desktop?: DesktopInput;
  private mobile?: MobileInput;
  private mode?: InputMode;
  private enabled = false;
  private right = 0;
  private forward = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly joystick: HTMLElement,
    private readonly commands: InputCommands,
  ) {
    window.addEventListener('pointerdown', this.selectPointer, true);
    window.addEventListener('keydown', this.selectKeyboard, true);
  }

  get touch(): boolean {
    return this.mode === 'touch';
  }

  get locked(): boolean {
    return this.desktop?.locked ?? false;
  }

  get lockPending(): boolean {
    return this.desktop?.pending ?? false;
  }

  acquire(): void {
    if (this.touch) {
      // Fullscreen is optional and some mobile browsers do not expose the API.
      try {
        if (document.fullscreenEnabled && !document.fullscreenElement) {
          void document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {
        // Some implementations throw synchronously.
      }
    } else {
      this.desktop?.acquire();
    }
  }

  release(): void {
    this.desktop?.release();
  }

  private readonly selectPointer = (event: PointerEvent): void => {
    if (event.isTrusted) this.select(event.pointerType === 'touch' ? 'touch' : 'desktop');
  };

  private readonly selectKeyboard = (event: KeyboardEvent): void => {
    if (event.isTrusted) this.select('desktop');
  };

  private select(mode: InputMode): void {
    window.removeEventListener('pointerdown', this.selectPointer, true);
    window.removeEventListener('keydown', this.selectKeyboard, true);
    this.mode = mode;
    const gameplay = {
      movement: (right, forward) => this.movement(right, forward),
      look: (horizontal, vertical) => this.look(horizontal, vertical),
      swing: () => this.swing(),
    } satisfies import('./mobile-input').MobileCommands;

    if (this.touch) this.mobile = new MobileInput(this.canvas, this.joystick, gameplay);
    else {
      this.desktop = new DesktopInput(this.canvas, {
        ...gameplay,
        pause: () => this.commands.pause(),
        lockChanged: locked => this.commands.lockChanged(locked),
      });
    }
    this.setEnabled(this.enabled);
    this.commands.modeChanged(mode);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.desktop?.setEnabled(enabled);
    this.mobile?.setEnabled(enabled);
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
