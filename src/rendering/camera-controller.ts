import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { MapData, Vec3 } from '../core/types';
import type { EventEmitter } from '../utils/event-emitter';

const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;
const UP = new Vector3(0, 1, 0);
const MOVE_SPEED = 2.7;
const MAX_PITCH = 80 * Math.PI / 180;
const LOOK_SENSITIVITY = 0.0022;

export class CameraController {
  private readonly position = new Vector3();
  private readonly velocity = new Vector3();
  private readonly direction = new Vector3();
  private pitch = 0;
  private yaw = 0;
  private map?: MapData;

  constructor(private readonly camera: PerspectiveCamera, private readonly events: EventEmitter) {
    camera.rotation.order = 'YXZ';
  }

  reset(map: MapData): void {
    this.map = map;
    this.position.set(map.playerStart.position.x, EYE_HEIGHT, map.playerStart.position.z);
    this.pitch = map.playerStart.rotation.x;
    this.yaw = map.playerStart.rotation.y;
    this.applyPose();
    this.notify();
  }

  preview(elapsed: number): void {
    if (!this.map) return;
    this.camera.rotation.set(
      this.pitch - 0.10 + Math.sin(elapsed * 0.29) * 0.035,
      this.yaw + 0.14 + Math.sin(elapsed * 0.24) * 0.18,
      0,
    );
  }

  look(horizontal: number, vertical: number): void {
    this.yaw -= horizontal * LOOK_SENSITIVITY;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch - vertical * LOOK_SENSITIVITY));
    this.applyPose();
    this.notify();
  }

  move(right: number, forward: number, seconds: number): boolean {
    if (!this.map || (!right && !forward)) return false;

    const { roomBounds } = this.map;
    this.velocity.set(right, 0, -forward).clampLength(0, 1);
    this.velocity.applyAxisAngle(UP, this.yaw).multiplyScalar(MOVE_SPEED * seconds);
    const { x, z } = this.position;
    const nextX = Math.max(roomBounds.min.x + PLAYER_RADIUS,
      Math.min(roomBounds.max.x - PLAYER_RADIUS, x + this.velocity.x));
    const nextZ = Math.max(roomBounds.min.z + PLAYER_RADIUS,
      Math.min(roomBounds.max.z - PLAYER_RADIUS, z + this.velocity.z));

    // Resolve each horizontal axis independently so the player can slide along an obstacle.
    if (!this.blocked(nextX, z)) this.position.x = nextX;
    if (!this.blocked(this.position.x, nextZ)) this.position.z = nextZ;
    if (x === this.position.x && z === this.position.z) return false;
    this.applyPose();
    this.notify();
    return true;
  }

  aim(): { position: Vec3; direction: Vec3 } {
    // The cosmetic camera shake never changes the hit ray.
    this.direction.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch));
    return { position: this.position, direction: this.direction };
  }

  shake(x: number, y: number): void {
    this.camera.rotation.set(this.pitch + y, this.yaw + x, 0);
  }

  private blocked(x: number, z: number): boolean {
    return this.map!.colliders.some(({ min, max }) => {
      if (min.y >= EYE_HEIGHT || max.y <= 0) return false;
      const closestX = Math.max(min.x, Math.min(max.x, x));
      const closestZ = Math.max(min.z, Math.min(max.z, z));
      return (x - closestX) ** 2 + (z - closestZ) ** 2 < PLAYER_RADIUS ** 2;
    });
  }

  private applyPose(): void {
    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private notify(): void {
    this.events.emit('PLAYER_MOVED', {
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: { x: this.pitch, y: this.yaw, z: 0 },
    });
  }
}
