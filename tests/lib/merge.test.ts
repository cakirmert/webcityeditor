import { describe, expect, it } from 'vitest';
import { buildSampleCube } from '../../src/lib/cityjson';
import { mergeCityJson } from '../../src/lib/merge';
import type { CityJsonDocument, CityObject } from '../../src/types';
import { checkIntegrity } from '../../src/lib/integrity';

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('mergeCityJson', () => {
  it('appends the incoming doc and shifts its vertex indices by base.vertices.length', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube(); // 8 verts, one Building_A

    // Rename inc's only object so there's no id conflict for this test.
    (inc.CityObjects as Record<string, CityObject>).Building_B =
      inc.CityObjects.Building_A;
    delete inc.CityObjects.Building_A;

    const baseVertCount = base.vertices.length;
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    expect(r.added).toBe(1);
    expect(r.renamed).toBe(0);

    // Vertices appended
    expect(base.vertices.length).toBe(baseVertCount + inc.vertices.length);

    // Building_B's geometry must reference the SHIFTED range
    const geom = base.CityObjects.Building_B.geometry as Array<{
      boundaries: number[][][][];
    }>;
    const indices = new Set<number>();
    for (const shell of geom[0].boundaries)
      for (const face of shell)
        for (const ring of face) for (const idx of ring) indices.add(idx);
    for (const i of indices) {
      expect(i).toBeGreaterThanOrEqual(baseVertCount);
      expect(i).toBeLessThan(base.vertices.length);
    }
  });

  it('renames id conflicts with __mergeN suffix and rewrites parent/child references', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    // Both docs have a Building_A → conflict.

    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    expect(r.renamed).toBe(1);
    expect(r.renameMap).toEqual({ Building_A: 'Building_A__merge2' });
    expect(base.CityObjects['Building_A']).toBeDefined();
    expect(base.CityObjects['Building_A__merge2']).toBeDefined();
  });

  it('rewrites parent references to renamed ids', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    // Add a parent/child relationship in `inc` before merging.
    (inc.CityObjects as Record<string, CityObject>).Building_A_part = {
      type: 'BuildingPart',
      parents: ['Building_A'],
    };
    inc.CityObjects.Building_A.children = ['Building_A_part'];

    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);

    // Building_A in the incoming doc was renamed → its child's parents
    // reference must be rewritten to the new id.
    const part = base.CityObjects['Building_A_part'];
    expect(part.parents).toEqual(['Building_A__merge2']);
    expect(base.CityObjects['Building_A__merge2'].children).toEqual(['Building_A_part']);
  });

  it('refuses CRS mismatch with a friendly reason', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    if (base.metadata) base.metadata.referenceSystem = 'EPSG:28992';
    if (inc.metadata) inc.metadata.referenceSystem = 'EPSG:25832';
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/CRS mismatch/);
  });

  it('treats equivalent OGC http and https EPSG identifiers as the same CRS', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    if (base.metadata) {
      base.metadata.referenceSystem = 'https://www.opengis.net/def/crs/EPSG/0/25832';
    }
    if (inc.metadata) {
      inc.metadata.referenceSystem = 'http://www.opengis.net/def/crs/EPSG/0/25832';
    }

    expect(mergeCityJson(base, inc).ok).toBe(true);
  });

  it('re-encodes compatible transform mismatches onto the base integer grid', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    inc.transform = {
      scale: [0.001, 0.001, 0.001],
      translate: [85001, 447002, 0],
    };
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    expect(base.vertices.slice(8, 12)).toEqual([
      [1000, 2000, 0],
      [11000, 2000, 0],
      [11000, 10000, 0],
      [1000, 10000, 0],
    ]);
    expect(checkIntegrity(base).ok).toBe(true);
  });

  it('refuses transform mismatches that cannot be represented without precision loss', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    inc.transform = {
      scale: [0.001, 0.001, 0.001],
      translate: [85000.0004, 447000, 0],
    };
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/without precision loss/);
  });

  it('refuses an untransformed incoming doc when the base is integer-encoded', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    delete inc.transform;
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/incoming has no transform/);
  });

  it('inherits CRS from incoming when base has none', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    if (base.metadata) delete base.metadata.referenceSystem;
    if (inc.metadata) inc.metadata.referenceSystem = 'EPSG:25832';
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    expect(base.metadata?.referenceSystem).toBe('EPSG:25832');
  });

  it('preserves integrity after merge — every vertex index resolves, no semantics breakage', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    const integ = checkIntegrity(base);
    expect(integ.ok).toBe(true);
    expect(integ.counts.error).toBe(0);
  });

  it('does not mutate the incoming doc', () => {
    const base = buildSampleCube();
    const inc = buildSampleCube();
    const incCopy = deepClone(inc);
    mergeCityJson(base, inc);
    expect(inc).toEqual(incCopy);
  });

  it('merges texture atlases and shifts texture and UV indices', () => {
    const base = buildSampleCube() as CityJsonDocument & { appearance?: any };
    base.appearance = {
      textures: [{ image: 'base.jpg' }],
      'vertices-texture': [[0, 0]],
    };
    const inc = buildSampleCube() as CityJsonDocument & { appearance?: any };
    inc.CityObjects.Building_B = inc.CityObjects.Building_A;
    delete inc.CityObjects.Building_A;
    (inc.CityObjects.Building_B.geometry?.[0] as any).texture = {
      rgbTexture: { values: [[[[0, 0, 1, 2, 3]]]] },
    };
    inc.appearance = {
      textures: [{ image: 'incoming.jpg' }],
      'vertices-texture': [[0, 0], [1, 0], [1, 1], [0, 1]],
    };

    expect(mergeCityJson(base, inc).ok).toBe(true);
    expect(base.appearance.textures).toEqual([
      { image: 'base.jpg' },
      { image: 'incoming.jpg' },
    ]);
    expect(base.appearance['vertices-texture']).toHaveLength(5);
    expect((base.CityObjects.Building_B.geometry?.[0] as any).texture).toEqual({
      rgbTexture: { values: [[[[1, 1, 2, 3, 4]]]] },
    });
  });

  it('handles three-way conflicts (A, A__merge2 already exist → A becomes A__merge3)', () => {
    const base = buildSampleCube();
    // Pre-populate base with a Building_A__merge2 to force the next conflict
    // to land at __merge3.
    base.CityObjects['Building_A__merge2'] = base.CityObjects.Building_A;

    const inc = buildSampleCube();
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(true);
    expect(r.renameMap).toEqual({ Building_A: 'Building_A__merge3' });
  });

  it('ignores docs with type !== "CityJSON"', () => {
    const base = buildSampleCube();
    const inc = { ...buildSampleCube(), type: 'NotCityJSON' } as unknown as CityJsonDocument;
    const r = mergeCityJson(base, inc);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/CityJSON documents/);
  });
});
