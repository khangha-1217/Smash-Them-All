export interface MobileCommands {
  movement(right: number, forward: number): void;
  look(horizontal: number, vertical: number): void;
  swing(): void;
}

interface TouchGesture {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startedAt: number;
  canLook: boolean;
  dragged: boolean;
}

const TAP_SLOP = 10;
const TAP_TIME_MS = 300;
const SWIPE_SENSITIVITY = 2.4;

export class MobileInput {
  private enabled = false;
  private movementId?: number;
  private gesture?: TouchGesture;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly joystick: HTMLElement,
    private readonly commands: MobileCommands,
  ) {
    for (const target of [canvas, joystick]) {
      target.addEventListener('pointerdown', this.onDown);
      target.addEventListener('pointermove', this.onMove);
      target.addEventListener('pointerup', this.onUp);
      target.addEventListener('pointercancel', this.onCancel);
      target.addEventListener('lostpointercapture', this.onCancel);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) return;
    const movementId = this.movementId;
    const gestureId = this.gesture?.id;
    this.clearMovement();
    this.gesture = undefined;
    if (movementId !== undefined && this.joystick.hasPointerCapture(movementId)) {
      this.joystick.releasePointerCapture(movementId);
    }
    if (gestureId !== undefined && this.canvas.hasPointerCapture(gestureId)) {
      this.canvas.releasePointerCapture(gestureId);
    }
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerType !== 'touch') return;
    const target = event.currentTarget as HTMLElement;
    event.preventDefault();
    if (target === this.joystick) {
      if (this.movementId !== undefined) return;
      this.movementId = event.pointerId;
      this.moveJoystick(event);
    } else {
      if (this.gesture) return;
      this.gesture = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startedAt: event.timeStamp,
        canLook: event.clientX >= this.canvas.clientWidth / 2,
        dragged: false,
      };
    }
    target.setPointerCapture(event.pointerId);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.movementId) {
      this.moveJoystick(event);
      return;
    }
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    if (this.outsideTapSlop(gesture, event)) gesture.dragged = true;
    if (!gesture.dragged || !gesture.canLook) return;

    this.commands.look((event.clientX - gesture.lastX) * SWIPE_SENSITIVITY,
      (event.clientY - gesture.lastY) * SWIPE_SENSITIVITY);
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
  };

  private readonly onUp = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (gesture?.id === event.pointerId && !gesture.dragged
      && !this.outsideTapSlop(gesture, event) && event.timeStamp - gesture.startedAt <= TAP_TIME_MS) {
      this.commands.swing();
    }
    this.onCancel(event);
  };

  private readonly onCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.movementId) this.clearMovement();
    if (event.pointerId === this.gesture?.id) this.gesture = undefined;
  };

  private outsideTapSlop(gesture: TouchGesture, event: PointerEvent): boolean {
    return Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > TAP_SLOP;
  }

  private moveJoystick(event: PointerEvent): void {
    const { left, top, width, height } = this.joystick.getBoundingClientRect();
    const radius = width * 0.35;
    const x = event.clientX - (left + width / 2);
    const y = event.clientY - (top + height / 2);
    const scale = Math.max(radius, Math.hypot(x, y));
    this.joystick.style.setProperty('--stick-x', `${x * radius / scale}px`);
    this.joystick.style.setProperty('--stick-y', `${y * radius / scale}px`);
    this.commands.movement(x / scale, -y / scale);
  }

  private clearMovement(): void {
    this.movementId = undefined;
    this.joystick.style.removeProperty('--stick-x');
    this.joystick.style.removeProperty('--stick-y');
    this.commands.movement(0, 0);
  }
}
