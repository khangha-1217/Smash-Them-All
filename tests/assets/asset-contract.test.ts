import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface GlbDocument {
  asset: { version: string };
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  bufferViews: { byteOffset?: number; byteLength: number; extensions?: Record<string, unknown> }[];
  accessors: { count: number; bufferView: number }[];
  meshes: { name?: string; primitives: { indices?: number; mode?: number; attributes: { POSITION: number } }[] }[];
  animations?: { name?: string }[];
  images?: { bufferView?: number; mimeType?: string }[];
  nodes: { name?: string; mesh?: number; camera?: number; skin?: number }[];
}

const models = [
  { path: 'maps/kitchen.glb', maxBytes: 2_000_000, maxTriangles: 30_000, clips: [], surfaces: ['floor', 'counter', 'sink', 'wall'] },
  { path: 'maps/livingroom.glb', maxBytes: 2_000_000, maxTriangles: 30_000, clips: [], surfaces: ['floor', 'table', 'shelf', 'wall'] },
  { path: 'maps/bedroom.glb', maxBytes: 2_000_000, maxTriangles: 30_000, clips: [], surfaces: ['floor', 'bed', 'desk', 'wall'] },
  { path: 'cockroach.glb', maxBytes: 100_000, maxTriangles: 1_500, clips: ['idle', 'crawl', 'fly'] },
  { path: 'weapons/slipper.glb', maxBytes: 50_000, maxTriangles: 800, clips: ['idle', 'swing'] },
  { path: 'weapons/flyswatter.glb', maxBytes: 50_000, maxTriangles: 800, clips: ['idle', 'swing'] },
  { path: 'weapons/cardboard.glb', maxBytes: 50_000, maxTriangles: 800, clips: ['idle', 'swing'] },
];
const surfaceTags = ['floor', 'counter', 'table', 'wall', 'ceiling', 'shelf', 'bed', 'desk', 'sink', 'chair'];
const meshopt = 'EXT_meshopt_compression';

function assetBytes(path: string) {
  const url = new URL(`../../public/assets/${path}`, import.meta.url);
  expect(existsSync(url), `Missing public/assets/${path}`).toBe(true);
  return readFileSync(url);
}

function parseGlb(file: Buffer): { doc: GlbDocument; binary: Buffer } {
  expect(file.toString('ascii', 0, 4)).toBe('glTF');
  expect(file.readUInt32LE(4)).toBe(2);
  expect(file.readUInt32LE(8)).toBe(file.length);
  expect(file.toString('ascii', 16, 20)).toBe('JSON');
  const jsonEnd = 20 + file.readUInt32LE(12);
  expect(file.toString('ascii', jsonEnd + 4, jsonEnd + 8)).toBe('BIN\0');
  expect(jsonEnd + 8 + file.readUInt32LE(jsonEnd)).toBe(file.length);
  return { doc: JSON.parse(file.toString('utf8', 20, jsonEnd)), binary: file.subarray(jsonEnd + 8) };
}

function textureDimensions(bytes: Buffer, mimeType: string | undefined): [number, number] {
  if (mimeType === 'image/png') {
    expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }

  expect(mimeType).toBe('image/jpeg');
  expect(bytes.readUInt16BE(0)).toBe(0xffd8);
  const frameMarkers = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  let offset = 2;
  while (offset + 4 < bytes.length && bytes[offset] === 0xff) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (frameMarkers.includes(marker)) {
      return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
    }
    const segmentLength = bytes.readUInt16BE(offset);
    if (marker === 0xda || segmentLength < 2) break;
    offset += segmentLength;
  }
  throw new Error('JPEG is missing a start-of-frame segment');
}

function expectMapEmpties(nodes: GlbDocument['nodes'], surfaces: string[]) {
  const starts = nodes.filter(({ name }) => name === 'player_start');
  expect(starts).toHaveLength(1);
  const markers = [...starts];
  for (const [prefix, minimum] of [['spawn', 8], ['waypoint', 15]] as const) {
    const points = nodes.filter(({ name }) => name?.startsWith(`${prefix}_`));
    expect(points.length).toBeGreaterThanOrEqual(minimum);
    const tags = points.map(({ name }) => {
      const match = new RegExp(`^${prefix}_([a-z]+)_\\d{2}$`).exec(name ?? '');
      expect(match, `Invalid ${prefix} name: ${name}`).not.toBeNull();
      expect(surfaceTags).toContain(match?.[1]);
      return match?.[1];
    });
    expect(tags).toEqual(expect.arrayContaining(surfaces));
    markers.push(...points);
  }
  expect(new Set(markers.map(({ name }) => name)).size).toBe(markers.length);
  for (const { mesh, camera, skin } of markers) {
    expect(mesh).toBeUndefined();
    expect(camera).toBeUndefined();
    expect(skin).toBeUndefined();
  }
}

describe('model asset contract', () => {
  it.each(models)('$path fits its geometry, compression and content budgets', ({ path, maxBytes, maxTriangles, clips, surfaces }) => {
    const file = assetBytes(`models/${path}`);
    expect(file.length).toBeLessThanOrEqual(maxBytes);
    const { doc, binary } = parseGlb(file);
    expect(doc.asset.version).toBe('2.0');
    expect(doc.extensionsUsed).toContain(meshopt);
    expect([...(doc.extensionsUsed ?? []), ...(doc.extensionsRequired ?? [])]).not.toContain('KHR_draco_mesh_compression');
    expect(doc.meshes.length).toBeGreaterThan(0);
    const triangles = doc.meshes.reduce((total, mesh) => {
      expect(mesh.name?.trim()).toBeTruthy();
      expect(mesh.name).not.toMatch(/^(Cube|Sphere|Cylinder|Plane|Cone|Circle|Torus)(\.\d+)?$/i);
      return total + mesh.primitives.reduce((count, primitive) => {
        expect(primitive.mode ?? 4).toBe(4);
        for (const index of [primitive.attributes.POSITION, primitive.indices]) {
          if (index === undefined) continue;
          const view = doc.bufferViews[doc.accessors[index].bufferView];
          expect(view.extensions?.[meshopt]).toBeDefined();
        }
        const indexCount = doc.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
        expect(indexCount % 3).toBe(0);
        return count + indexCount / 3;
      }, 0);
    }, 0);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(maxTriangles);

    const clipNames = (doc.animations ?? []).map(({ name }) => name);
    expect(clipNames).toEqual(expect.arrayContaining(clips));
    if (clips.length === 0) expect(clipNames).toHaveLength(0);
    expect(new Set(clipNames).size).toBe(clipNames.length);
    for (const name of clipNames) expect(name).toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);

    for (const { bufferView, mimeType } of doc.images ?? []) {
      expect(bufferView).toBeDefined();
      const { byteOffset = 0, byteLength } = doc.bufferViews[bufferView!];
      for (const dimension of textureDimensions(binary.subarray(byteOffset, byteOffset + byteLength), mimeType)) {
        expect(dimension).toBeGreaterThan(0);
        expect(dimension).toBeLessThanOrEqual(1024);
      }
    }

    if (surfaces) expectMapEmpties(doc.nodes, surfaces);
  });
});

const soundEffects = ['hit.mp3', 'miss.mp3'];

describe('sound effect asset contract', () => {
  it.each(soundEffects)('%s is a 44.1 kHz mono MP3 under 50 KB', (name) => {
    const file = assetBytes(`audio/sfx/${name}`);
    expect(file.length).toBeLessThan(50_000);

    // MPEG-1 Layer III at 44.1 kHz has sample-rate index 0 and mono channel mode 3.
    const hasId3 = file.toString('ascii', 0, 3) === 'ID3';
    const tagSize = hasId3
      ? file.subarray(6, 10).reduce((size, byte) => (size << 7) | (byte & 0x7f), 0)
      : 0;
    const footerSize = hasId3 && file[3] === 4 && (file[5] & 0x10) ? 10 : 0;
    const firstFrame = hasId3 ? 10 + tagSize + footerSize : 0;
    const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    let frames = 0;
    let offset = firstFrame;
    while (offset + 4 <= file.length && file.toString('ascii', offset, offset + 3) !== 'TAG') {
      const header = file.readUInt32BE(offset);
      expect(header >>> 21).toBe(0x7ff);
      expect((header >>> 17) & 0xf).toBe(0xd);
      expect((header >>> 10) & 0x3).toBe(0);
      expect((header >>> 6) & 0x3).toBe(3);
      const bitrate = bitrates[(header >>> 12) & 0xf];
      expect(bitrate).toBeGreaterThan(0);
      offset += Math.floor(144_000 * bitrate / 44_100) + ((header >>> 9) & 1);
      expect(offset).toBeLessThanOrEqual(file.length);
      frames += 1;
    }
    expect(frames).toBeGreaterThan(1);
    const trailingId3 = file.length - offset === 128 && file.toString('ascii', offset, offset + 3) === 'TAG';
    expect(offset === file.length || trailingId3).toBe(true);
  });
});
