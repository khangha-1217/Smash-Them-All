import { AnimationMixer, Group, LoopOnce, MathUtils } from 'three';
import type { AnimationAction, PerspectiveCamera, Scene } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { SWING_CONTACT_MS, SWING_DURATION_MS } from '../core/types';
import type { WeaponId } from '../core/types';
import { disposeModel, loadModel } from './map-loader';
import { shadeModel } from './scene-manager';

const WEAPON_MODELS = {
  slipper: 'weapons/slipper',
  flyswatter: 'weapons/flyswatter',
  cardboard: 'weapons/cardboard',
} satisfies Record<WeaponId, string>;

const WEAPON_MOUNTS = {
  slipper: {
    rest: { x: 0.64, y: -0.43, depth: 0.47, pitch: 0.80, yaw: 0.24, roll: -0.21, scale: 1 },
    contact: { x: 0.80, y: 0.28 },
  },
  flyswatter: {
    rest: { x: 0.68, y: -0.59, depth: 0.48, pitch: 0.54, yaw: 0.24, roll: -0.18, scale: 0.91 },
    contact: { x: 0.82, y: 0.16 },
  },
  cardboard: {
    rest: { x: 0.68, y: -0.58, depth: 0.48, pitch: 0.59, yaw: 0.24, roll: -0.13, scale: 0.90 },
    contact: { x: 0.33, y: -0.12 },
  },
};
const CONTACT_MOUNT = { depth: 0.52, pitch: 0.31, yaw: -0.21, roll: -0.19 };
const CONTACT_PHASE = SWING_CONTACT_MS / SWING_DURATION_MS;

export class WeaponViewmodel {
  static preload(weaponId: WeaponId, signal: AbortSignal, progress: (fraction: number) => void): Promise<GLTF> {
    return loadModel(WEAPON_MODELS[weaponId], signal, progress);
  }

  private readonly mount = new Group();
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly strike: AnimationAction;
  private readonly poses: (typeof WEAPON_MOUNTS)[WeaponId];
  private striking = false;
  private bobTime = 0;
  private bobWeight = 0;

  constructor(private readonly model: GLTF, scene: Scene, private readonly camera: PerspectiveCamera, weaponId: WeaponId) {
    const idle = model.animations.find(clip => clip.name === 'idle');
    const swing = model.animations.find(clip => clip.name === 'swing');
    if (!idle || !swing) throw new Error('Weapon is missing idle or swing animation');

    this.poses = WEAPON_MOUNTS[weaponId];
    this.mount.scale.setScalar(this.poses.rest.scale);
    shadeModel(model.scene);
    this.mount.add(model.scene);
    scene.add(this.mount);
    this.mixer = new AnimationMixer(model.scene);
    this.idle = this.mixer.clipAction(idle);
    this.strike = this.mixer.clipAction(swing).setLoop(LoopOnce, 1);
    this.strike.clampWhenFinished = true;
    this.reset();
  }

  reset(): void {
    this.striking = false;
    this.bobTime = 0;
    this.bobWeight = 0;
    this.strike.stop();
    this.idle.reset().play();
    this.update(0, false, null);
  }

  update(seconds: number, walking: boolean, swingElapsedMs: number | null): void {
    const progress = (swingElapsedMs ?? 0) / SWING_DURATION_MS;
    if (swingElapsedMs !== null) {
      if (!this.striking) {
        this.idle.stop();
        this.strike.reset().play();
        this.striking = true;
      }
      this.strike.time = progress * this.strike.getClip().duration;
      this.mixer.update(0);
    } else {
      if (this.striking) {
        this.strike.stop();
        this.idle.reset().play();
        this.striking = false;
      }
      this.mixer.update(seconds);
    }

    if (walking) this.bobTime += seconds * 11;
    this.bobWeight = MathUtils.damp(this.bobWeight, Number(walking), 10, seconds);
    // The authored clips reach contact one third of the way through the swing.
    const approach = progress <= CONTACT_PHASE
      ? progress / CONTACT_PHASE
      : (1 - progress) / (1 - CONTACT_PHASE);
    const exertion = Math.sin(approach * Math.PI / 2);
    const { lerp } = MathUtils;
    const { rest, contact } = this.poses;
    const depth = lerp(rest.depth, CONTACT_MOUNT.depth, exertion);
    const halfHeight = depth * Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const halfWidth = halfHeight * this.camera.aspect;
    // Anchor the rest to the right side and keep the strike offsets independent of aspect ratio.
    this.mount.position.set(
      lerp(halfWidth * rest.x, halfHeight * contact.x, exertion) + 0.010 * Math.cos(this.bobTime) * this.bobWeight,
      halfHeight * lerp(rest.y, contact.y, exertion) + 0.012 * Math.sin(this.bobTime) * this.bobWeight,
      -depth,
    );
    this.mount.rotation.set(
      lerp(rest.pitch, CONTACT_MOUNT.pitch, exertion),
      lerp(rest.yaw, CONTACT_MOUNT.yaw, exertion),
      lerp(rest.roll, CONTACT_MOUNT.roll, exertion),
    );
  }

  dispose(): void {
    this.mixer.stopAllAction().uncacheRoot(this.model.scene);
    this.mount.removeFromParent();
    disposeModel(this.model.scene);
  }
}
