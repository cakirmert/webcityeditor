import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from './cityjson';
import { extractFootprints } from './footprints';
import { convertIfcToCityJsonBuilding } from './ifc-to-cityjson';
import { checkIntegrity } from './integrity';
import type { IfcImportResult } from './ifc-import';
import './projection';

/**
 * Synthetic IFC mesh fixture: a 10 × 6 × 4 m box, centred on (0, 0) in XY,
 * Z ∈ [0, 4]. 8 vertices, 12 triangles (2 per face × 6 faces). Triangle
 * normals are computed by the caller of parseIfc — we set them by hand here.
 */
function syntheticBoxMesh(): IfcImportResult {
  // 8 corners (centred on XY centre, Z ∈ [0,4])
  // 0: (-5,-3,0)  1: (5,-3,0)  2: (5,3,0)  3: (-5,3,0)
  // 4: (-5,-3,4)  5: (5,-3,4)  6: (5,3,4)  7: (-5,3,4)
  const vertices = new Float32Array([
    -5, -3, 0,
    5, -3, 0,
    5, 3, 0,
    -5, 3, 0,
    -5, -3, 4,
    5, -3, 4,
    5, 3, 4,
    -5, 3, 4,
  ]);
  // 12 triangles (CCW from outside on each face)
  // ground (z=0, normal -Z): 0-2-1 + 0-3-2
  // roof   (z=4, normal +Z): 4-5-6 + 4-6-7
  // wall +Y: 3-7-6 + 3-6-2
  // wall -Y: 0-1-5 + 0-5-4
  // wall +X: 1-2-6 + 1-6-5
  // wall -X: 0-4-7 + 0-7-3
  const indices = new Uint32Array([
    0, 2, 1,
    0, 3, 2,
    4, 5, 6,
    4, 6, 7,
    3, 7, 6,
    3, 6, 2,
    0, 1, 5,
    0, 5, 4,
    1, 2, 6,
    1, 6, 5,
    0, 4, 7,
    0, 7, 3,
  ]);
  // Normals correspond to face orientation
  const triangleNormals = new Float32Array([
    0, 0, -1, // ground
    0, 0, -1,
    0, 0, 1, // roof
    0, 0, 1,
    0, 1, 0, // wall +Y
    0, 1, 0,
    0, -1, 0, // wall -Y
    0, -1, 0,
    1, 0, 0, // wall +X
    1, 0, 0,
    -1, 0, 0, // wall -X
    -1, 0, 0,
  ]);
  return {
    globalId: 'test-guid',
    name: 'TestBox',
    bbox: { minX: -5, minY: -3, minZ: 0, maxX: 5, maxY: 3, maxZ: 4 },
    width: 10,
    depth: 6,
    height: 4,
    storeyCount: 1,
    refLat: null,
    refLon: null,
    refElevation: null,
    entityCount: 100,
    parseMs: 1,
    vertices,
    indices,
    triangleNormals,
    triangleSourceClass: new Array(12).fill('other') as Array<'other'>,
    storeyElevations: [0],
  };
}

describe('convertIfcToCityJsonBuilding', () => {
  it('produces a Building with two geometries — LoD 1 footprint + LoD 3 mesh', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    expect(result.cityObject.type).toBe('Building');
    const geoms = result.cityObject.geometry as Array<{ type: string; lod: string }>;
    expect(geoms).toHaveLength(2);
    expect(geoms[0]).toMatchObject({ type: 'MultiSurface', lod: '1.0' });
    expect(geoms[1]).toMatchObject({ type: 'MultiSurface', lod: '3.0' });
  });

  it('LoD 1 footprint has exactly one GroundSurface face (4 vertices CCW)', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod1 = (result.cityObject.geometry as Array<{
      boundaries: number[][][];
      semantics: { surfaces: Array<{ type: string }>; values: number[] };
    }>)[0];
    expect(lod1.boundaries).toHaveLength(1);
    expect(lod1.boundaries[0]).toHaveLength(1); // one ring
    expect(lod1.boundaries[0][0]).toHaveLength(4); // four corners
    expect(lod1.semantics.surfaces).toEqual([{ type: 'GroundSurface' }]);
    expect(lod1.semantics.values).toEqual([0]);
  });

  it('LoD 3 mesh preserves all 12 triangles', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod3 = (result.cityObject.geometry as Array<{
      boundaries: number[][][];
      semantics: { surfaces: Array<{ type: string }>; values: number[] };
    }>)[1];
    expect(lod3.boundaries).toHaveLength(12);
    for (const face of lod3.boundaries) {
      expect(face).toHaveLength(1); // one ring per triangle
      expect(face[0]).toHaveLength(3); // 3 verts
    }
    // Surfaces array always has the same 5 types in fixed order so the
    // index mapping is stable across IFCs (Window/Door are always reachable
    // even if no triangle of that class exists).
    expect(lod3.semantics.surfaces).toEqual([
      { type: 'GroundSurface' },
      { type: 'RoofSurface' },
      { type: 'WallSurface' },
      { type: 'Window' },
      { type: 'Door' },
    ]);
    // With cls='other' for every triangle and 'other' falling back to
    // normal-only classification, the counts match the previous behaviour:
    // 2 ground (0), 2 roof (1), 8 wall (2).
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const v of lod3.semantics.values) counts[v]++;
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(8);
    expect(counts[3]).toBe(0);
    expect(counts[4]).toBe(0);
  });

  it('extractFootprints renders the LoD 1 rectangle on the map (not a tiny mesh tri)', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    // Insert manually — the converter's contract is: caller appends verts +
    // CityObject. extractFootprints walks the doc and finds our building.
    doc.vertices.push(...result.newVertices);
    doc.CityObjects[result.id] = result.cityObject;

    const fps = extractFootprints(doc);
    const ours = fps.find((f) => f.id === result.id);
    expect(ours).toBeDefined();
    expect(ours!.polygon.length).toBeGreaterThan(3); // closed rectangle
    // The polygon should be roughly centred on the placement point.
    const lngs = ours!.polygon.map((p) => p[0]);
    const lats = ours!.polygon.map((p) => p[1]);
    const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    expect(cx).toBeCloseTo(4.3571, 4);
    expect(cy).toBeCloseTo(52.0116, 4);
  });

  it('records IFC provenance attributes', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const a = result.cityObject.attributes!;
    expect(a._ifcSource).toBe('box.ifc');
    expect(a._ifcGlobalId).toBe('test-guid');
    expect(a._ifcWidth).toBe(10);
    expect(a._ifcDepth).toBe(6);
    expect(a._ifcHeight).toBe(4);
    expect(a._ifcTriangleCount).toBe(12);
    expect(a._createdBy).toBe('city-editor-prototype');
  });

  it('passes integrity check after insertion', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    doc.vertices.push(...result.newVertices);
    doc.CityObjects[result.id] = result.cityObject;
    const integ = checkIntegrity(doc);
    expect(integ.ok).toBe(true);
    expect(integ.counts.error).toBe(0);
  });

  it('survives JSON round-trip', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    doc.vertices.push(...result.newVertices);
    doc.CityObjects[result.id] = result.cityObject;
    const parsed = parseCityJson(JSON.stringify(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const reloaded = parsed.doc.CityObjects[result.id];
    expect(reloaded).toBeDefined();
    expect((reloaded.geometry as unknown[]).length).toBe(2);
  });

  it('refuses placement when doc CRS is not supported', () => {
    const doc = buildSampleCube();
    if (doc.metadata) doc.metadata.referenceSystem = 'EPSG:99999';
    const ifc = syntheticBoxMesh();
    expect(() =>
      convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc')
    ).toThrow(/CRS/);
  });

  it('IfcWindow triangles tag as Window regardless of normal direction', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    // Tag every triangle as window
    ifc.triangleSourceClass = new Array(12).fill('window') as Array<'window'>;
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod3 = (result.cityObject.geometry as Array<{
      semantics: { values: number[] };
    }>)[1];
    // All 12 should map to Window (index 3 in the fixed surfaces array).
    expect(lod3.semantics.values.every((v) => v === 3)).toBe(true);
  });

  it('IfcDoor triangles tag as Door', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    ifc.triangleSourceClass = new Array(12).fill('door') as Array<'door'>;
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod3 = (result.cityObject.geometry as Array<{
      semantics: { values: number[] };
    }>)[1];
    expect(lod3.semantics.values.every((v) => v === 4)).toBe(true);
  });

  it('IfcWall triangles tag as WallSurface even for ground/roof-facing tris', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    ifc.triangleSourceClass = new Array(12).fill('wall') as Array<'wall'>;
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod3 = (result.cityObject.geometry as Array<{
      semantics: { values: number[] };
    }>)[1];
    // All 12 → WallSurface (index 2), no GroundSurface/RoofSurface even
    // though 4 of them have ±Z normals.
    expect(lod3.semantics.values.every((v) => v === 2)).toBe(true);
  });

  it('IfcSlab triangles use elevation: top → Roof, ground → Ground, mid → Wall', () => {
    const doc = buildSampleCube();
    const ifc = syntheticBoxMesh();
    ifc.triangleSourceClass = new Array(12).fill('slab') as Array<'slab'>;
    // Two storeys: ground=0, roof=4. The synthetic box has Z ∈ [0, 4],
    // so slab triangles at z=0 → Ground, at z=4 → Roof, walls (mid Z) → Wall.
    ifc.storeyElevations = [0, 4];
    const result = convertIfcToCityJsonBuilding(doc, ifc, [4.3571, 52.0116], 'box.ifc');
    const lod3 = (result.cityObject.geometry as Array<{
      semantics: { values: number[] };
    }>)[1];
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const v of lod3.semantics.values) counts[v]++;
    // 2 ground tris (z=0, normal -Z) → Ground (0)
    // 2 roof tris  (z=4, normal +Z) → Roof  (1)
    // 8 wall tris  (z mid)         → Wall  (2)
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(2);
    expect(counts[2]).toBe(8);
  });
});
