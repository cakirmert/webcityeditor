import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { generateBuilding, insertBuilding, type NewBuildingParams } from './generator';
import { regenerateBuilding } from './regenerate';
import { checkIntegrity } from './integrity';
import type { CityJsonDocument } from '../types';
import './projection';

const FP_DELFT_A: [number, number][] = [
  [4.3571, 52.0116],
  [4.35725, 52.0116],
  [4.35725, 52.01172],
  [4.3571, 52.01172],
];

function makeBuilding(overrides: Partial<NewBuildingParams> = {}) {
  const doc = buildSampleCube();
  const r = generateBuilding(doc, {
    targetCrs: 'EPSG:28992',
    footprintWgs84: FP_DELFT_A,
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  });
  const id = insertBuilding(doc, r);
  return { doc, id };
}

describe('checkIntegrity', () => {
  it('reports a clean sample-cube doc as ok with no errors', () => {
    const doc = buildSampleCube();
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(true);
    expect(r.counts.error).toBe(0);
    // The sample cube has no orphans (all 8 verts referenced).
    expect(r.summary.orphanedVertices).toBe(0);
  });

  it('reports correct cityObjects and vertices counts', () => {
    const { doc } = makeBuilding();
    const r = checkIntegrity(doc);
    // sample-cube's Building_A + the new bld
    expect(r.summary.cityObjects).toBe(2);
    expect(r.summary.vertices).toBe(doc.vertices.length);
    expect(r.summary.referencedVertices).toBeLessThanOrEqual(r.summary.vertices);
  });

  it('flags an out-of-range vertex index as an error', () => {
    const { doc, id } = makeBuilding();
    // Corrupt one vertex index past the end.
    const geom = doc.CityObjects[id].geometry as Array<{ boundaries: number[][][][] }>;
    geom[0].boundaries[0][0][0][0] = doc.vertices.length + 100;
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(false);
    expect(r.counts.error).toBeGreaterThan(0);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('vertex-index-out-of-range');
  });

  it('flags a dangling parent reference', () => {
    const { doc, id } = makeBuilding();
    doc.CityObjects[id].parents = ['Building_NonExistent'];
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('dangling-parent');
  });

  it('warns on asymmetric parent/child links', () => {
    const { doc, id } = makeBuilding();
    // Make `id` reference Building_A as parent, but Building_A doesn't list id as child.
    doc.CityObjects[id].parents = ['Building_A'];
    const r = checkIntegrity(doc);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('asymmetric-parent-link');
  });

  it('reports orphaned vertices after regenerateBuilding (left-behind verts)', () => {
    const { doc, id } = makeBuilding();
    const r1 = checkIntegrity(doc);
    expect(r1.summary.orphanedVertices).toBe(0);

    // Regenerate with a different (larger) footprint — orphans the original
    // 8 vertices of the building.
    const newFp: [number, number][] = [
      [4.3573, 52.0116],
      [4.35745, 52.0116],
      [4.35745, 52.01172],
      [4.3573, 52.01172],
    ];
    const reg = regenerateBuilding(doc, id, newFp);
    expect(reg.ok).toBe(true);

    const r2 = checkIntegrity(doc);
    expect(r2.summary.orphanedVertices).toBeGreaterThan(0);
    const codes = r2.issues.map((i) => i.code);
    expect(codes).toContain('orphaned-vertices');
    // The orphan-vertex issue is informational — it doesn't break ok.
    expect(r2.ok).toBe(true);
  });

  it('flags a doc with mismatched vertices type as an error', () => {
    const doc = buildSampleCube() as unknown as CityJsonDocument;
    (doc as { vertices: unknown }).vertices = 'not an array';
    const r = checkIntegrity(doc as CityJsonDocument);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('missing-vertices');
  });

  it('flags an invalid (non-numeric) vertex tuple as an error', () => {
    const doc = buildSampleCube();
    doc.vertices.push([NaN, 0, 0] as [number, number, number]);
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('invalid-vertex');
  });

  it('flags out-of-range semantics index as an error', () => {
    const { doc, id } = makeBuilding();
    const geom = doc.CityObjects[id].geometry as Array<{
      semantics?: { values: number[][] };
    }>;
    if (geom[0].semantics) geom[0].semantics.values[0][0] = 99; // surface index out of range
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('semantics-index-out-of-range');
  });

  it('does not treat valid MultiSurface face semantics as Solid shell semantics', () => {
    const doc: CityJsonDocument = {
      type: 'CityJSON',
      version: '2.0',
      metadata: { referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/7415' },
      CityObjects: {
        multisurface_building: {
          type: 'Building',
          geometry: [
            {
              type: 'MultiSurface',
              lod: '2.0',
              boundaries: [
                [[0, 1, 2, 3]],
                [[4, 7, 6, 5]],
              ],
              semantics: {
                surfaces: [{ type: 'GroundSurface' }, { type: 'RoofSurface' }],
                values: [0, 1],
              },
            },
          ],
        },
      },
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    };

    const r = checkIntegrity(doc);
    expect(r.ok).toBe(true);
    expect(r.counts.error).toBe(0);
    expect(r.issues.map((i) => i.code)).not.toContain('semantics-shell-mismatch');
  });

  it('warns when transform is missing', () => {
    const doc = buildSampleCube();
    delete doc.transform;
    const r = checkIntegrity(doc);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('missing-transform');
    expect(r.counts.warning).toBeGreaterThan(0);
  });

  it('flags wrong top-level type', () => {
    const doc = buildSampleCube();
    (doc as unknown as { type: string }).type = 'NotCityJSON';
    const r = checkIntegrity(doc);
    expect(r.ok).toBe(false);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('wrong-type');
  });

  it('flags semantics shell-count mismatch', () => {
    const { doc, id } = makeBuilding();
    const geom = doc.CityObjects[id].geometry as Array<{
      semantics?: { values: number[][] };
    }>;
    if (geom[0].semantics) {
      geom[0].semantics.values.push([0, 1, 2]); // extra shell entry
    }
    const r = checkIntegrity(doc);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('semantics-shell-mismatch');
  });

  it('flags semantics face-count mismatch within a shell', () => {
    const { doc, id } = makeBuilding();
    const geom = doc.CityObjects[id].geometry as Array<{
      semantics?: { values: number[][] };
    }>;
    if (geom[0].semantics) {
      // Drop a face from the semantics array but leave boundaries intact.
      geom[0].semantics.values[0].pop();
    }
    const r = checkIntegrity(doc);
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('semantics-face-mismatch');
  });
});
