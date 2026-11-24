import type { BezierCurve, Vec3 } from '../core/types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(vector: Vec3, scalar: number): Vec3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function lengthSquared(vector: Vec3): number {
  return dot(vector, vector);
}

export function length(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalize(vector: Vec3): Vec3 {
  const magnitude = length(vector);
  if (magnitude === 0) return { x: 0, y: 0, z: 0 };

  return { x: vector.x / magnitude, y: vector.y / magnitude, z: vector.z / magnitude };
}

export function lerpVec3(start: Vec3, end: Vec3, t: number): Vec3 {
  return { x: lerp(start.x, end.x, t), y: lerp(start.y, end.y, t), z: lerp(start.z, end.z, t) };
}

export function quadraticBezier({ start, control, end }: BezierCurve, t: number): Vec3 {
  const inverse = 1 - t;
  const startWeight = inverse * inverse;
  const controlWeight = 2 * inverse * t;
  const endWeight = t * t;

  return {
    x: startWeight * start.x + controlWeight * control.x + endWeight * end.x,
    y: startWeight * start.y + controlWeight * control.y + endWeight * end.y,
    z: startWeight * start.z + controlWeight * control.z + endWeight * end.z,
  };
}
