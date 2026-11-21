import { AnimationMixer, Euler, Group, Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three';
import type { AnimationAction, Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { CockroachState, SurfacePoint, Vec3 } from '../core/types';
import type { GameEvents } from '../utils/event-emitter';
import { disposeModel } from './map-loader';
import { shadeModel } from './scene-manager';

interface RoachView {
  mesh: Object3D;
  root: Group;
  mixer: AnimationMixer;
  idle: AnimationAction;
  crawl: AnimationAction;
  active: AnimationAction;
  position: Vector3;
  facing: Vector3;
  up: Vector3;
  orientation: Quaternion;
}

const MODEL_FOOT_OFFSET = 0.006;
const FLOOR_NORMAL = new Vector3(0, 1, 0);
const CRAWL_FORWARD = new Vector3(0, 0, -1);

export class CockroachRenderer {
  readonly group = new Group();
  private readonly views: RoachView[] = [];
  private readonly byId = new Map<number, RoachView>();
  private readonly basis = new Matrix4();
  private readonly right = new Vector3();
  private readonly back = new Vector3();
  private readonly move = new Vector3();
  private readonly tilt = new Euler();

  constructor(private readonly model: GLTF, count: number, private readonly spawns: SurfacePoint[]) {
    const idleClip = model.animations.find(clip => clip.name === 'idle');
    const crawlClip = model.animations.find(clip => clip.name === 'crawl');
    if (!idleClip || !crawlClip) throw new Error('Cockroach is missing idle or crawl animation');

    shadeModel(model.scene);
    for (let index = 0; index < count; index++) {
      const root = new Group();
      const mesh = clone(model.scene);
      root.add(mesh);
      root.visible = false;
      this.group.add(root);

      const mixer = new AnimationMixer(mesh);
      const idle = mixer.clipAction(idleClip);
      const crawl = mixer.clipAction(crawlClip);
      this.views.push({
        mesh, root, mixer, idle, crawl, active: idle,
        position: new Vector3(), facing: CRAWL_FORWARD.clone(), up: FLOOR_NORMAL.clone(),
        orientation: new Quaternion(),
      });
    }
  }

  spawn({ cockroachId, position }: GameEvents['COCKROACH_SPAWNED']): void {
    const view = this.views.find(candidate => !candidate.root.visible);
    if (!view) return;

    const start = this.spawns.find(point => point.position.x === position.x
      && point.position.y === position.y && point.position.z === position.z);
    view.facing.copy(CRAWL_FORWARD);
    this.setPose(view, position, start?.surfaceNormal ?? FLOOR_NORMAL);
    view.root.position.copy(view.position);
    view.root.quaternion.copy(view.orientation);
    view.root.visible = true;
    view.active = view.idle.reset().play();
    view.mixer.update(0);
    this.byId.set(cockroachId, view);
  }

  moveTo({ cockroachId, position, rotation, state }: GameEvents['COCKROACH_MOVED']): void {
    const view = this.byId.get(cockroachId);
    if (!view) return;

    this.tilt.set(rotation.x, rotation.y, rotation.z);
    view.up.copy(FLOOR_NORMAL).applyEuler(this.tilt);
    this.move.set(position.x, position.y, position.z).addScaledVector(view.up, MODEL_FOOT_OFFSET)
      .sub(view.position).projectOnPlane(view.up);
    if (this.move.lengthSq() > 1e-8) view.facing.copy(this.move).normalize();
    this.setPose(view, position, view.up);
    this.animate(view, state);
  }

  despawn({ cockroachId }: GameEvents['COCKROACH_DESPAWNED']): void {
    const view = this.byId.get(cockroachId);
    if (!view) return;

    view.root.visible = false;
    view.mixer.stopAllAction();
    this.byId.delete(cockroachId);
  }

  update(seconds: number): void {
    const blend = 1 - Math.exp(-35 * seconds);
    for (const view of this.byId.values()) {
      view.root.position.lerp(view.position, blend);
      view.root.quaternion.slerp(view.orientation, blend);
      view.mixer.update(seconds);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const { mixer, mesh } of this.views) {
      mixer.stopAllAction().uncacheRoot(mesh);
      mesh.traverse(node => {
        if (node instanceof SkinnedMesh) node.skeleton.dispose();
      });
    }
    this.byId.clear();
    disposeModel(this.model.scene);
  }

  private setPose(view: RoachView, position: Vec3, normal: Vec3): void {
    view.up.copy(normal);
    view.position.copy(position).addScaledVector(view.up, MODEL_FOOT_OFFSET);
    view.facing.projectOnPlane(view.up);
    if (view.facing.lengthSq() < 1e-8) {
      if (Math.abs(view.up.x) > 0.7) view.facing.copy(CRAWL_FORWARD);
      else view.facing.set(1, 0, 0);
      view.facing.projectOnPlane(view.up);
    }
    view.facing.normalize();
    this.back.copy(view.facing).negate();
    this.right.crossVectors(view.up, this.back).normalize();
    this.basis.makeBasis(this.right, view.up, this.back);
    view.orientation.setFromRotationMatrix(this.basis);
  }

  private animate(view: RoachView, state: CockroachState): void {
    const action = state === 'crawling' ? view.crawl : view.idle;
    if (view.active === action) return;

    view.active.fadeOut(0.1);
    action.reset().fadeIn(0.1).play();
    view.active = action;
  }
}
