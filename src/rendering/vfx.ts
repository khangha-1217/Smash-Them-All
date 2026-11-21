import { BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import type { PerspectiveCamera, Scene } from 'three';
import type { GameEvents } from '../utils/event-emitter';

interface SplatParticle {
  position: Vector3;
  velocity: Vector3;
  age: number;
  size: number;
}

interface Popup {
  node: HTMLElement;
  position: Vector3;
  age: number;
}

const SPLAT_SECONDS = 0.4;
const POPUP_SECONDS = 0.68;
const PARTICLE_LIMIT = 35;

export class Vfx {
  private readonly particles: SplatParticle[] = [];
  private readonly popups: Popup[] = [];
  private readonly projected = new Vector3();
  private readonly geometry = new BufferGeometry();
  private readonly positions = new BufferAttribute(new Float32Array(PARTICLE_LIMIT * 3), 3);
  private readonly opacities = new BufferAttribute(new Float32Array(PARTICLE_LIMIT), 1);
  private readonly sizes = new BufferAttribute(new Float32Array(PARTICLE_LIMIT), 1);
  private shakeTime = 0;
  private feedbackTime = 0;

  constructor(
    scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly reticle: HTMLElement,
    private readonly overlay: HTMLElement,
  ) {
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('opacity', this.opacities);
    this.geometry.setAttribute('size', this.sizes);
    this.geometry.setDrawRange(0, 0);
    const points = new Points(this.geometry, new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float opacity;
        attribute float size;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = clamp(size / -viewPosition.z, 2.0, 24.0);
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        void main() {
          vec2 centered = gl_PointCoord - vec2(0.5);
          float edge = 1.0 - smoothstep(0.32, 0.5, length(centered * vec2(1.18, 1.0)));
          gl_FragColor = vec4(0.28, 0.13, 0.075, edge * vOpacity);
        }
      `,
    }));
    points.frustumCulled = false;
    scene.add(points);
  }

  hit({ position, points, comboMultiplier }: GameEvents['COCKROACH_HIT']): void {
    this.flash('hit');
    this.shakeTime = 0.1;

    for (let index = 0; index < 7; index++) {
      const direction = index / 7 * Math.PI * 2 + Math.random() * 0.6;
      if (this.particles.length === PARTICLE_LIMIT) this.particles.shift();
      this.particles.push({
        position: new Vector3().copy(position).add(new Vector3(0, 0.025, 0)),
        velocity: new Vector3(Math.cos(direction) * 0.44, 0.25 + Math.random() * 0.55, Math.sin(direction) * 0.44),
        age: 0,
        size: 11 + Math.random() * 11,
      });
    }

    const node = document.createElement('div');
    node.className = 'point-popup';
    node.textContent = comboMultiplier > 1 ? `+${points} ×${comboMultiplier}!` : `+${points}`;
    this.overlay.append(node);
    const popup = { node, position: new Vector3().copy(position), age: 0 };
    this.popups.push(popup);
    this.placePopup(popup);
  }

  nearMiss(): void {
    this.flash('near-miss');
  }

  reset(): void {
    this.shakeTime = 0;
    this.feedbackTime = 0;
    delete this.reticle.dataset.feedback;
    this.particles.length = 0;
    for (const { node } of this.popups) node.remove();
    this.popups.length = 0;
    this.geometry.setDrawRange(0, 0);
  }

  update(seconds: number, shake: (x: number, y: number) => void): void {
    this.shakeTime = Math.max(0, this.shakeTime - seconds);
    this.feedbackTime = Math.max(0, this.feedbackTime - seconds);
    if (this.feedbackTime === 0 && this.reticle.dataset.feedback) delete this.reticle.dataset.feedback;

    const strength = (this.shakeTime / 0.1) ** 2;
    const amplitude = 10 * Math.tan(this.camera.fov * Math.PI / 360) / Math.max(1, this.overlay.clientHeight);
    shake(Math.cos(this.shakeTime * 170) * strength * amplitude,
      Math.sin(this.shakeTime * 170) * strength * amplitude);

    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      particle.age += seconds;
      if (particle.age >= SPLAT_SECONDS) {
        this.particles.splice(index, 1);
      } else {
        particle.velocity.y -= seconds * 1.4;
        particle.position.addScaledVector(particle.velocity, seconds);
      }
    }
    this.particles.forEach(({ position, age, size }, index) => {
      this.positions.setXYZ(index, position.x, position.y, position.z);
      this.opacities.setX(index, 1 - age / SPLAT_SECONDS);
      this.sizes.setX(index, size);
    });
    this.positions.needsUpdate = this.opacities.needsUpdate = this.sizes.needsUpdate = this.particles.length > 0;
    this.geometry.setDrawRange(0, this.particles.length);

    this.camera.updateMatrixWorld();
    for (let index = this.popups.length - 1; index >= 0; index--) {
      const popup = this.popups[index];
      popup.age += seconds;
      if (popup.age >= POPUP_SECONDS) {
        popup.node.remove();
        this.popups.splice(index, 1);
      } else {
        this.placePopup(popup);
      }
    }
  }

  private flash(feedback: 'hit' | 'near-miss'): void {
    // Reassign the attribute after layout so consecutive outcomes restart the animation.
    delete this.reticle.dataset.feedback;
    void this.reticle.offsetWidth;
    this.reticle.dataset.feedback = feedback;
    this.feedbackTime = 0.19;
  }

  private placePopup({ node, position, age }: Popup): void {
    const progress = age / POPUP_SECONDS;
    this.projected.copy(position).project(this.camera);
    node.hidden = this.projected.z < -1 || this.projected.z > 1
      || Math.abs(this.projected.x) > 1.1 || Math.abs(this.projected.y) > 1.1;
    node.style.left = `${(this.projected.x + 1) * 50}%`;
    node.style.top = `${(1 - this.projected.y) * 50}%`;
    node.style.transform = `translate(-50%, ${-110 - progress * 180}%) rotate(-8deg)`;
    node.style.opacity = String(Math.min(1, 2.3 * (1 - progress)));
  }
}
