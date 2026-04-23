import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from './cityjson';
import {
  generateBuilding,
  insertBuilding,
  validateStoreyHeight,
  type NewBuildingParams,
} from './generator';
import { extractFootprints } from './footprints';
import { detectCrs } from './projection';

function baseParams(overrides: Partial<NewBuildingParams> = {}): NewBuildingParams {
  return {
    targetCrs: 'EPSG:28992',
    footprintWgs84: [
      [4.3571, 52.0116],
      [4.35724, 52.0116],
      [4.35724, 52.01168],
      [4.3571, 52.01168],
    ],
    storeys: 3,
    eaveHeight: 9,
    ridgeHeight: 9,
    roofType: 'flat',
    ...overrides,
  };
}

describe('generateBuilding - flat', () => {
  it('produces a solid with ground, roof, and 4 walls', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams());
    const geom = r.cityObject.geometry![0] as {
      type: string;
      boundaries: number[][][][];
      semantics: { surfaces: Array<{ type: string }>; values: number[][] };
    };
    expect(geom.type).toBe('Solid');
    expect(geom.boundaries[0]).toHaveLength(6);
    expect(geom.semantics.values[0]).toEqual([0, 1, 2, 2, 2, 2]);
    expect(r.newVertices).toHaveLength(8);
  });

  it('measuredHeight attribute matches ridgeHeight', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams({ eaveHeight: 12, ridgeHeight: 12 }));
    expect(r.cityObject.attributes?.measuredHeight).toBe(12);
  });
});

describe('generateBuilding - pyramid', () => {
  it('produces 1 ground + N triangular roofs + N walls', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ roofType: 'pyramid', eaveHeight: 6, ridgeHeight: 9 })
    );
    const geom = r.cityObject.geometry![0] as {
      boundaries: number[][][][];
      semantics: { values: number[][] };
    };
    // 4-sided footprint: 1 ground + 4 roof triangles + 4 walls = 9 faces
    expect(geom.boundaries[0]).toHaveLength(9);
    // Vertices: 4 ground + 4 eave + 1 apex = 9
    expect(r.newVertices).toHaveLength(9);
    // Semantic order: ground, roof×4, wall×4
    expect(geom.semantics.values[0]).toEqual([0, 1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('works on a triangular (3-sided) footprint', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({
        footprintWgs84: [
          [4.3571, 52.0116],
          [4.35724, 52.0116],
          [4.35717, 52.01168],
        ],
        roofType: 'pyramid',
        eaveHeight: 6,
        ridgeHeight: 9,
      })
    );
    // 3 + 3 + 1 = 7 vertices, 1 + 3 + 3 = 7 faces
    expect(r.newVertices).toHaveLength(7);
    const geom = r.cityObject.geometry![0] as { boundaries: number[][][][] };
    expect(geom.boundaries[0]).toHaveLength(7);
  });
});

describe('generateBuilding - gable', () => {
  it('produces 1 ground + 2 roof slopes + 4 walls (rectangle)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ roofType: 'gable', eaveHeight: 6, ridgeHeight: 9 })
    );
    const geom = r.cityObject.geometry![0] as {
      boundaries: number[][][][];
      semantics: { values: number[][] };
    };
    // 1 ground + 2 roof + 4 walls = 7 faces
    expect(geom.boundaries[0]).toHaveLength(7);
    // 4 ground + 4 eave + 2 ridge = 10 vertices
    expect(r.newVertices).toHaveLength(10);
    expect(geom.semantics.values[0]).toEqual([0, 1, 1, 2, 2, 2, 2]);
  });

  it('rejects non-rectangular (triangular) footprint for gable', () => {
    const doc = buildSampleCube();
    expect(() =>
      generateBuilding(
        doc,
        baseParams({
          footprintWgs84: [
            [4.3571, 52.0116],
            [4.35724, 52.0116],
            [4.35717, 52.01168],
          ],
          roofType: 'gable',
          eaveHeight: 6,
          ridgeHeight: 9,
        })
      )
    ).toThrow(/rectangular/);
  });
});

describe('generateBuilding - input validation', () => {
  it('rejects fewer than 3 footprint vertices', () => {
    const doc = buildSampleCube();
    expect(() =>
      generateBuilding(
        doc,
        baseParams({
          footprintWgs84: [
            [4.3571, 52.0116],
            [4.35724, 52.0116],
          ],
        })
      )
    ).toThrow(/at least 3/);
  });

  it('rejects flat roof with ridge != eave', () => {
    const doc = buildSampleCube();
    expect(() =>
      generateBuilding(doc, baseParams({ eaveHeight: 6, ridgeHeight: 9 }))
    ).toThrow(/flat/i);
  });

  it('rejects pitched roof with ridge <= eave', () => {
    const doc = buildSampleCube();
    expect(() =>
      generateBuilding(
        doc,
        baseParams({ roofType: 'pyramid', eaveHeight: 9, ridgeHeight: 9 })
      )
    ).toThrow(/ridgeHeight > eaveHeight/);
  });
});

describe('insertBuilding', () => {
  it('appends vertices and inserts CityObject in-place', () => {
    const doc = buildSampleCube();
    const beforeV = doc.vertices.length;
    const beforeO = Object.keys(doc.CityObjects).length;
    const r = generateBuilding(doc, baseParams());
    const id = insertBuilding(doc, r);
    expect(doc.vertices.length).toBe(beforeV + 8);
    expect(Object.keys(doc.CityObjects).length).toBe(beforeO + 1);
    expect(doc.CityObjects[id]).toBeDefined();
  });

  it('new building appears in extractFootprints', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(doc, baseParams({ eaveHeight: 12, ridgeHeight: 12 }));
    const id = insertBuilding(doc, r);
    const fps = extractFootprints(doc);
    const created = fps.find((f) => f.id === id);
    expect(created).toBeDefined();
    expect(created!.height).toBeCloseTo(12, 3);
  });
});

describe('generateBuilding - hip', () => {
  it('produces 1 ground + 4 roof faces + 4 walls (rectangle)', () => {
    const doc = buildSampleCube();
    const r = generateBuilding(
      doc,
      baseParams({ roofType: 'hip', eaveHeight: 6, ridgeHeight: 9 })
    );
    const geom = r.cityObject.geometry![0] as {
      boundaries: number[][][][];
      semantics: { values: number[][] };
    };
    // 1 ground + 4 roof + 4 walls = 9 faces
    expect(geom.boundaries[0]).toHaveLength(9);
    // 4 ground + 4 eave + 2 ridge = 10 vertices
    expect(r.newVertices).toHaveLength(10);
    expect(geom.semantics.values[0]).toEqual([0, 1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it('rejects non-rectangular footprint for hip', () => {
    const doc = buildSampleCube();
    expect(() =>
      generateBuilding(
        doc,
        baseParams({
          footprintWgs84: [
            [4.3571, 52.0116],
            [4.35724, 52.0116],
            [4.35717, 52.01168],
          ],
          roofType: 'hip',
          eaveHeight: 6,
          ridgeHeight: 9,
        })
      )
    ).toThrow(/rectangular/);
  });
});

describe('round-trip: new building survives JSON.stringify → parse', () => {
  it('all four roof types preserve geometry and semantics after round-trip', () => {
    for (const roofType of ['flat', 'pyramid', 'gable', 'hip'] as const) {
      const doc = buildSampleCube();
      const crs = detectCrs(doc).code;
      const r = generateBuilding(doc, {
        ...baseParams(),
        targetCrs: crs,
        roofType,
        eaveHeight: 6,
        ridgeHeight: roofType === 'flat' ? 6 : 9,
      });
      const id = insertBuilding(doc, r);

      const text = JSON.stringify(doc);
      const parsed = parseCityJson(text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;

      // 1. The new building still exists by id
      const reloaded = parsed.doc.CityObjects[id];
      expect(reloaded).toBeDefined();
      expect(reloaded.type).toBe('Building');

      // 2. All vertex indices reference the full (extended) vertex array
      const totalVertices = parsed.doc.vertices.length;
      const geom = reloaded.geometry![0] as {
        boundaries: number[][][][];
        semantics: { surfaces: Array<{ type: string }>; values: number[][] };
      };
      for (const face of geom.boundaries[0]) {
        for (const ring of face) {
          for (const vIdx of ring) {
            expect(vIdx).toBeGreaterThanOrEqual(0);
            expect(vIdx).toBeLessThan(totalVertices);
          }
        }
      }

      // 3. Semantic values still line up with face count
      expect(geom.semantics.values[0].length).toBe(geom.boundaries[0].length);

      // 4. No duplicate / corrupted vertex entries at the new-building range
      for (let i = r.vertexOffset; i < r.vertexOffset + r.newVertices.length; i++) {
        const v = parsed.doc.vertices[i];
        expect(Array.isArray(v)).toBe(true);
        expect(v.length).toBe(3);
        expect(Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2])).toBe(
          true
        );
      }

      // 5. extractFootprints still finds the reloaded building
      const fps = extractFootprints(parsed.doc);
      const found = fps.find((f) => f.id === id);
      expect(found, `footprint lost after round-trip for ${roofType}`).toBeDefined();
    }
  });
});

describe('validateStoreyHeight', () => {
  it('warns when storey height is below habitable minimum', () => {
    const v = validateStoreyHeight(5, 3, 0); // 5m total / 3 storeys = 1.67m each
    expect(v.storeyHeight).toBeCloseTo(1.67, 2);
    expect(v.warnings.some((w) => w.includes('below 2.4'))).toBe(true);
  });

  it('warns when storey height is unusually tall', () => {
    const v = validateStoreyHeight(18, 3, 0); // 6m each
    expect(v.warnings.some((w) => w.includes('unusually tall'))).toBe(true);
  });

  it('subtracts roof height from wall height before computing storey height', () => {
    const v = validateStoreyHeight(12, 3, 3); // wall = 9m, storey = 3m
    expect(v.storeyHeight).toBeCloseTo(3, 5);
    expect(v.warnings).toHaveLength(0);
  });

  it('warns if roof height exceeds total', () => {
    const v = validateStoreyHeight(5, 2, 6); // no walls fit
    expect(v.warnings.some((w) => w.includes('no walls'))).toBe(true);
  });
});
