import { AnimationMixer, Group, LoopOnce, MathUtils } from 'three';
import type { AnimationAction, PerspectiveCamera, Scene } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { SWING_DURATION_MS } from '../core/types';
import type { WeaponId } from '../core/types';
import { disposeModel, loadModel } from './map-loader';
import { shadeModel } from './scene-manager';

const WEAPON_MODELS = {
  slipper: 'weapons/slipper',
  flyswatter: 'weapons/flyswatter',
  cardboard: 'weapons/cardboard',
} satisfies Record<WeaponId, string>;

export class WeaponViewmodel {
  static preload(weaponId: WeaponId, signal: AbortSignal, progress: (fraction: number) => void): Promise<GLTF> {
    return loadModel(WEAPON_MODELS[weaponId], signal, progress);
  }

  private readonly mount = new Group();
  private readonly mixer: AnimationMixer;
  private readonly idle: AnimationAction;
  private readonly strike: AnimationAction;
  private swingTime = SWING_DURATION_MS;
  private bobTime = 0;
  private bobWeight = 0;

  constructor(private readonly model: GLTF, scene: Scene, private readonly camera: PerspectiveCamera) {
    const idle = model.animations.find(clip => clip.name === 'idle');
    const swing = model.animations.find(clip => clip.name === 'swing');
    if (!idle || !swing) throw new Error('Weapon is missing idle or swing animation');

    shadeModel(model.scene);
    this.mount.add(model.scene);
    scene.add(this.mount);
    this.mixer = new AnimationMixer(model.scene);
    this.idle = this.mixer.clipAction(idle);
    this.strike = this.mixer.clipAction(swing).setLoop(LoopOnce, 1);
    this.strike.clampWhenFinished = true;
    this.reset();
  }

  swing(): void {
    this.swingTime = 0;
    this.idle.stop();
    this.strike.reset().setDuration(SWING_DURATION_MS / 1_000).play();
    this.mixer.update(0);
  }

  reset(): void {
    this.swingTime = SWING_DURATION_MS;
    this.bobTime = 0;
    this.bobWeight = 0;
    this.strike.stop();
    this.idle.reset().play();
    this.update(0, false);
  }

  update(seconds: number, walking: boolean): void {
    const lastSwing = this.swingTime;
    this.swingTime = Math.min(SWING_DURATION_MS, this.swingTime + seconds * 1_000);
    this.mixer.update(seconds);
    if (lastSwing < SWING_DURATION_MS && this.swingTime === SWING_DURATION_MS) {
      this.strike.stop();
      this.idle.reset().play();
      this.mixer.update(0);
    }

    if (walking) this.bobTime += seconds * 11;
    this.bobWeight = MathUtils.damp(this.bobWeight, Number(walking), 10, seconds);
    const depth = 0.47;
    const halfHeight = depth * Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const halfWidth = halfHeight * this.camera.aspect;
    const exertion = Math.sin(Math.PI * this.swingTime / SWING_DURATION_MS);
    this.mount.position.set(
      halfWidth * (0.72 - 0.74 * exertion) + 0.010 * Math.cos(this.bobTime) * this.bobWeight,
      halfHeight * (-0.83 + 0.35 * exertion) + 0.012 * Math.sin(this.bobTime) * this.bobWeight,
      -depth - 0.05 * exertion,
    );
    this.mount.rotation.set(0.31, 0.24 - 0.45 * exertion, -0.19);
  }

  dispose(): void {
    this.mixer.stopAllAction().uncacheRoot(this.model.scene);
    this.mount.removeFromParent();
    disposeModel(this.model.scene);
  }
}
