import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';

function addCharacterLights(scene: Scene): void {
  scene.add(new AmbientLight(0xffffff, 1.35));
  const key = new DirectionalLight(0xffebd3, 1.55);
  key.position.set(-2, 5, 3);
  scene.add(key);
}

// Environment meshes retain their baked unlit materials. Characters use the same
// palette and vertex colors with soft lighting so they read against the room.
export function shadeModel(model: Object3D): void {
  const replacements = new Map<MeshBasicMaterial, MeshLambertMaterial>();

  function shade(material: Mesh['material'] & { isMaterial?: boolean }) {
    if (!(material instanceof MeshBasicMaterial)) return material;

    const existing = replacements.get(material);
    if (existing) return existing;

    const shaded = new MeshLambertMaterial({
      color: material.color,
      emissive: 0x292323,
      map: material.map,
      vertexColors: material.vertexColors,
      side: material.side,
      transparent: material.transparent,
      opacity: material.opacity,
      alphaTest: material.alphaTest,
    });
    replacements.set(material, shaded);
    material.dispose();
    return shaded;
  }

  model.traverse(node => {
    if (!(node instanceof Mesh)) return;
    node.material = Array.isArray(node.material) ? node.material.map(shade) : shade(node.material);
  });
}

export class SceneManager {
  readonly world = new Scene();
  readonly viewmodel = new Scene();
  readonly camera = new PerspectiveCamera(65, 1, 0.02, 30);
  readonly weaponCamera = new PerspectiveCamera(48, 1, 0.01, 3);
  readonly renderer: WebGLRenderer;
  private width = 0;
  private height = 0;
  private pixelRatio = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.world.background = new Color(0x9caa92);
    addCharacterLights(this.world);
    addCharacterLights(this.viewmodel);
    this.resize();
  }

  resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    if (!width || !height || (width === this.width && height === this.height && this.pixelRatio === pixelRatio)) return;

    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.weaponCamera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.weaponCamera.updateProjectionMatrix();
  }

  render(showWeapon: boolean): void {
    this.resize();
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.world, this.camera);
    if (showWeapon) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewmodel, this.weaponCamera);
    }
  }
}
