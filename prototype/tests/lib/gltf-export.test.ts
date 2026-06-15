import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from '../../src/lib/generator';
import { exportToGltf } from '../../src/lib/gltf-export';
import '../../src/lib/projection';

interface GltfJson {
  asset: { version: string; generator?: string };
  scene: number;
  scenes: Array<{ name?: string; nodes: number[] }>;
  nodes: Array<{ mesh: number; name?: string }>;
  meshes: Array<{
    name?: string;
    primitives: Array<{
      attributes: { POSITION: number; NORMAL?: number; COLOR_0?: number };
      indices?: number;
      material?: number;
    }>;
  }>;
  materials: Array<unknown>;
  accessors: Array<{
    bufferView: number;
    componentType: number;
    count: number;
    type: string;
    normalized?: boolean;
    min?: number[];
    max?: number[];
  }>;
  bufferViews: Array<{ byteOffset: number; byteLength: number }>;
  buffers: Array<{ byteLength: number }>;
  extras?: { cityjson?: unknown };
}

function parseGlb(glb: Uint8Array): { json: GltfJson; bin: Uint8Array } {
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  // Header
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
  expect(dv.getUint32(4, true)).toBe(2);
  expect(dv.getUint32(8, true)).toBe(glb.byteLength);
  // JSON chunk
  const jsonLen = dv.getUint32(12, true);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // 'JSON'
  const jsonBytes = glb.subarray(20, 20 + jsonLen);
  const jsonStr = new TextDecoder().decode(jsonBytes);
  const json: GltfJson = JSON.parse(jsonStr);
  // BIN chunk
  const binChunkOffset = 20 + jsonLen;
  const binLen = dv.getUint32(binChunkOffset, true);
  expect(dv.getUint32(binChunkOffset + 4, true)).toBe(0x004e4942); // 'BIN\0'
  const bin = glb.subarray(binChunkOffset + 8, binChunkOffset + 8 + binLen);
  return { json, bin };
}

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const r = generateBuilding(doc, {
    targetCrs: 'EPSG:28992',
    footprintWgs84: [
      [4.3571, 52.0116],
      [4.35725, 52.0116],
      [4.35725, 52.0117],
      [4.3571, 52.0117],
    ],
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  });
  insertBuilding(doc, r);
  return doc;
}

describe('exportToGltf', () => {
  it('produces a syntactically-valid .glb (magic, version, total length)', () => {
    const doc = buildSampleCube();
    const glb = exportToGltf(doc);
    expect(glb).toBeInstanceOf(Uint8Array);
    expect(glb.length).toBeGreaterThan(20); // at least a header + chunks
    // parseGlb's expects() validate magic + version + total length match.
    parseGlb(glb);
  });

  it('asset.version is "2.0" and generator names the editor', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    expect(json.asset.version).toBe('2.0');
    expect(json.asset.generator).toBe('webcityeditor');
  });

  it('each non-empty CityObject becomes a mesh + node with the same name', () => {
    const doc = buildSampleCube(); // 1 building
    const glb = exportToGltf(doc);
    const { json } = parseGlb(glb);
    expect(json.meshes).toHaveLength(1);
    expect(json.nodes).toHaveLength(1);
    expect(json.nodes[0].name).toBe('Building_A');
    expect(json.scenes[0].nodes).toEqual([0]);
  });

  it('every primitive has POSITION, NORMAL, COLOR_0, indices accessors', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    const prim = json.meshes[0].primitives[0];
    expect(prim.attributes.POSITION).toBeGreaterThanOrEqual(0);
    expect(prim.attributes.NORMAL).toBeGreaterThanOrEqual(0);
    expect(prim.attributes.COLOR_0).toBeGreaterThanOrEqual(0);
    expect(prim.indices).toBeGreaterThanOrEqual(0);
  });

  it('accessor counts match flat-shaded triangle vertex count (3 verts per triangle, no sharing)', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    const prim = json.meshes[0].primitives[0];
    const indices = json.accessors[prim.indices!];
    const positions = json.accessors[prim.attributes.POSITION];
    const normals = json.accessors[prim.attributes.NORMAL!];
    const colors = json.accessors[prim.attributes.COLOR_0!];
    // All four agree on the vertex count
    expect(indices.count).toBe(positions.count);
    expect(indices.count).toBe(normals.count);
    expect(indices.count).toBe(colors.count);
    // Vertex count is divisible by 3 (each triangle contributes 3 unique verts).
    expect(indices.count % 3).toBe(0);
  });

  it('accessor componentTypes are correct (u32 indices, f32 positions/normals, u8 colors normalized)', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    const prim = json.meshes[0].primitives[0];
    expect(json.accessors[prim.indices!].componentType).toBe(5125); // u32
    expect(json.accessors[prim.indices!].type).toBe('SCALAR');
    expect(json.accessors[prim.attributes.POSITION].componentType).toBe(5126); // f32
    expect(json.accessors[prim.attributes.POSITION].type).toBe('VEC3');
    expect(json.accessors[prim.attributes.NORMAL!].componentType).toBe(5126);
    expect(json.accessors[prim.attributes.COLOR_0!].componentType).toBe(5121); // u8
    expect(json.accessors[prim.attributes.COLOR_0!].normalized).toBe(true);
  });

  it('positions accessor includes valid min/max bounding box', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    const pos = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    expect(pos.min).toHaveLength(3);
    expect(pos.max).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(pos.max![i]).toBeGreaterThanOrEqual(pos.min![i]);
    }
  });

  it('every bufferView is 4-byte aligned (so accessors with f32/u32 types stay valid)', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    for (const bv of json.bufferViews) {
      expect(bv.byteOffset % 4).toBe(0);
    }
  });

  it('buffer byteLength matches the binary chunk size', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json, bin } = parseGlb(glb);
    expect(json.buffers[0].byteLength).toBe(bin.length);
  });

  it('extras.cityjson includes the centroid + reference system + object count', () => {
    const glb = exportToGltf(buildSampleCube());
    const { json } = parseGlb(glb);
    const extras = json.extras?.cityjson as
      | {
          centroid?: number[];
          referenceSystem?: string | null;
          objectCount?: number;
        }
      | undefined;
    expect(extras).toBeDefined();
    expect(extras!.centroid).toHaveLength(3);
    expect(typeof extras!.referenceSystem === 'string' || extras!.referenceSystem === null).toBe(
      true
    );
    expect(extras!.objectCount).toBe(1);
  });

  it('handles a building with windows + doors (LoD 2.2 features) without crashing', () => {
    const doc = makeBuilding({
      openings: { windows: true, door: true },
    });
    const glb = exportToGltf(doc);
    const { json } = parseGlb(glb);
    // Two CityObjects in the doc now (the sample-cube's Building_A + the new one).
    expect(json.meshes.length).toBeGreaterThanOrEqual(2);
    // Every primitive still has a valid accessor count
    for (const m of json.meshes) {
      const prim = m.primitives[0];
      expect(json.accessors[prim.attributes.POSITION].count).toBeGreaterThan(0);
    }
  });

  it('exports MultiSurface geometry using face-level semantic values', () => {
    const doc = buildSampleCube();
    doc.CityObjects.Building_A.geometry = [
      {
        type: 'MultiSurface',
        lod: '2.0',
        boundaries: [
          [[0, 3, 2, 1]],
          [[4, 5, 6, 7]],
          [[0, 1, 5, 4]],
          [[1, 2, 6, 5]],
          [[2, 3, 7, 6]],
          [[3, 0, 4, 7]],
        ],
        semantics: {
          surfaces: [{ type: 'GroundSurface' }, { type: 'RoofSurface' }, { type: 'WallSurface' }],
          values: [0, 1, 2, 2, 2, 2],
        },
      },
    ];

    const glb = exportToGltf(doc);
    const { json } = parseGlb(glb);
    const prim = json.meshes[0].primitives[0];

    expect(json.meshes).toHaveLength(1);
    expect(json.accessors[prim.attributes.POSITION].count).toBeGreaterThan(0);
  });

  it('refuses to export a doc with no triangulatable geometry', () => {
    const doc = buildSampleCube();
    // Strip the geometry so nothing is triangulatable.
    delete (doc.CityObjects.Building_A as { geometry?: unknown }).geometry;
    expect(() => exportToGltf(doc)).toThrow(/no triangulatable geometry/);
  });

  it('total file length in the glb header matches the actual byte length', () => {
    const glb = exportToGltf(buildSampleCube());
    const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
    expect(dv.getUint32(8, true)).toBe(glb.byteLength);
  });
});
