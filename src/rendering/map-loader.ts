import { Box3, Euler, Mesh, Object3D, Quaternion, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { Aabb, MapData, MapId, Pose, SurfacePoint } from '../core/types';
import { assetUrl } from '../utils/asset-url';

export interface LoadedMap {
  scene: Object3D;
  data: MapData;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const MAP_MODELS = {
  kitchen: 'maps/kitchen',
  livingroom: 'maps/livingroom',
  bedroom: 'maps/bedroom',
} satisfies Record<MapId, string>;
const SUPPORT_TOLERANCE = 0.05;

export async function loadModel(
  path: string,
  signal: AbortSignal,
  progress: (fraction: number) => void = () => {},
): Promise<GLTF> {
  const url = assetUrl(`models/${path}.glb`);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Model request failed (${response.status}): ${path}`);

  const size = Number(response.headers.get('Content-Length'));
  const reader = response.body?.getReader();
  let buffer: ArrayBuffer;
  if (reader && size > 0) {
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        progress(Math.min(0.9, 0.9 * received / size));
      }
    } finally {
      reader.releaseLock();
    }
    const joined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    buffer = joined.buffer;
  } else {
    reader?.releaseLock();
    buffer = await response.arrayBuffer();
  }

  if (signal.aborted) throw new DOMException('Model load aborted', 'AbortError');
  const model = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
  if (signal.aborted) {
    disposeModel(model.scene);
    throw new DOMException('Model load aborted', 'AbortError');
  }
  progress(1);
  return model;
}

function boundsFrom(node: Object3D): Aabb {
  // The exported extent is stored in world axes. The empty supplies the transformed center.
  const halfExtents: unknown = node.userData.halfExtents;
  if (!Array.isArray(halfExtents) || halfExtents.length !== 3
    || !halfExtents.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    throw new Error(`Invalid halfExtents for ${node.name}`);
  }

  const [x, y, z] = halfExtents;
  const center = node.getWorldPosition(new Vector3());
  const box = new Box3().setFromCenterAndSize(center, new Vector3(2 * x, 2 * y, 2 * z));
  return { min: box.min, max: box.max };
}

function setSupportId(point: SurfacePoint, colliders: readonly Aabb[]): void {
  if (point.surfaceType === 'floor' || point.surfaceNormal.y <= 0.5) return;
  const { x, y, z } = point.position;
  // Shelves can sit inside furniture bounds, and upholstered surfaces can sit just above them.
  const supportId = colliders.findIndex(({ min, max }) => (
    x >= min.x - SUPPORT_TOLERANCE && x <= max.x + SUPPORT_TOLERANCE
    && y >= min.y && y <= max.y + SUPPORT_TOLERANCE
    && z >= min.z - SUPPORT_TOLERANCE && z <= max.z + SUPPORT_TOLERANCE
  ));
  if (supportId !== -1) point.supportId = supportId;
}

export async function loadMap(
  mapId: MapId,
  signal: AbortSignal,
  progress?: (fraction: number) => void,
): Promise<LoadedMap> {
  const { scene } = await loadModel(MAP_MODELS[mapId], signal, progress);
  const spawnPoints: SurfacePoint[] = [];
  const waypoints: SurfacePoint[] = [];
  const colliders: Aabb[] = [];
  let playerStart: Pose | undefined;
  let roomBounds: Aabb | undefined;

  try {
    scene.updateMatrixWorld(true);
    scene.traverse(node => {
      const match = /^(spawn|waypoint)_([a-z]+)_\d+$/.exec(node.name);
      if (match) {
        const point: SurfacePoint = {
          position: node.getWorldPosition(new Vector3()),
          surfaceType: match[2],
          surfaceNormal: new Vector3(0, 0, 1).applyQuaternion(node.getWorldQuaternion(new Quaternion())).normalize(),
        };
        (match[1] === 'spawn' ? spawnPoints : waypoints).push(point);
      } else if (node.name === 'player_start') {
        const angle = new Euler().setFromQuaternion(node.getWorldQuaternion(new Quaternion()), 'YXZ');
        playerStart = {
          position: node.getWorldPosition(new Vector3()),
          rotation: { x: angle.x, y: angle.y, z: angle.z },
        };
      } else if (node.name === 'room_bounds') {
        roomBounds = boundsFrom(node);
      } else if (node.name.startsWith('collider_')) {
        colliders.push(boundsFrom(node));
      }
    });

    if (!playerStart || !roomBounds || !spawnPoints.length || !waypoints.length) {
      throw new Error(`Incomplete map metadata for ${mapId}`);
    }
    for (const point of spawnPoints) setSupportId(point, colliders);
    for (const point of waypoints) setSupportId(point, colliders);
    return { scene, data: { id: mapId, spawnPoints, waypoints, playerStart, colliders, roomBounds } };
  } catch (error) {
    disposeModel(scene);
    throw error;
  }
}

export function disposeModel(scene: Object3D): void {
  scene.removeFromParent();
  const geometries = new Set<Mesh['geometry']>();
  const materials = new Set<Exclude<Mesh['material'], unknown[]>>();
  const textures = new Set<Texture>();

  scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    const applied = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of applied) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value);
      }
    }
  });

  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
}
