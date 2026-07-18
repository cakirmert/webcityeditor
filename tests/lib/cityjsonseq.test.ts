import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto, parseCityJsonSeq } from '../../src/lib/cityjson';

function makeSeq(): string {
  const header = {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [0.001, 0.001, 0.001], translate: [0, 0, 0] },
    CityObjects: {},
    vertices: [],
  };
  const feat1 = {
    type: 'CityJSONFeature',
    id: 'Building_1',
    CityObjects: {
      Building_1: {
        type: 'Building',
        attributes: { measuredHeight: 10 },
        geometry: [
          {
            type: 'Solid',
            lod: '2.0',
            boundaries: [[[[0, 1, 2, 3]]]],
          },
        ],
      },
    },
    vertices: [
      [0, 0, 0],
      [10, 0, 0],
      [10, 10, 0],
      [0, 10, 0],
    ],
  };
  const feat2 = {
    type: 'CityJSONFeature',
    id: 'Building_2',
    CityObjects: {
      Building_2: {
        type: 'Building',
        attributes: { measuredHeight: 5 },
        geometry: [
          {
            type: 'Solid',
            lod: '2.0',
            // Indices start from 0 again — should be shifted by 4 after merge
            boundaries: [[[[0, 1, 2, 3]]]],
          },
        ],
      },
    },
    vertices: [
      [20, 20, 0],
      [30, 20, 0],
      [30, 30, 0],
      [20, 30, 0],
    ],
  };
  return [header, feat1, feat2].map((x) => JSON.stringify(x)).join('\n');
}

describe('parseCityJsonSeq', () => {
  it('merges CityJSONFeatures into a single CityJSON document', () => {
    const result = parseCityJsonSeq(makeSeq());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.doc.CityObjects).sort()).toEqual(['Building_1', 'Building_2']);
    expect(result.doc.vertices).toHaveLength(8);
  });

  it('rewrites vertex indices so boundaries point to the combined array', () => {
    const result = parseCityJsonSeq(makeSeq());
    if (!result.ok) throw new Error(result.error);
    const b2 = result.doc.CityObjects.Building_2;
    const geom = b2.geometry![0] as { boundaries: number[][][][] };
    // Original [[[[0,1,2,3]]]] for building 2 should become [[[[4,5,6,7]]]]
    expect(geom.boundaries[0][0][0]).toEqual([4, 5, 6, 7]);
  });

  it('preserves header metadata and transform', () => {
    const result = parseCityJsonSeq(makeSeq());
    if (!result.ok) throw new Error(result.error);
    expect(result.doc.version).toBe('2.0');
    expect(result.doc.transform?.scale).toEqual([0.001, 0.001, 0.001]);
  });

  it('respects limitFeatures', () => {
    const result = parseCityJsonSeq(makeSeq(), 1);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects)).toEqual(['Building_1']);
    expect(result.doc.vertices).toHaveLength(4);
  });

  it('skips malformed lines without aborting', () => {
    const seq = makeSeq();
    const withGarbage = seq + '\n{not-json}\n';
    const result = parseCityJsonSeq(withGarbage);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.doc.CityObjects)).toHaveLength(2);
  });
});

describe('parseCityJsonSeq viewport filter', () => {
  it('keeps only features inside the requested viewport bbox', () => {
    // feat1 vertices are 0..10 (decoded ×0.001 + 0 → 0..0.01); feat2 are 20..30
    // (decoded → 0.02..0.03). A viewport bbox of [0, 0, 0.015, 0.015] should
    // include feat1 and exclude feat2.
    const result = parseCityJsonSeq(makeSeq(), undefined, [0, 0, 0.015, 0.015]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects).sort()).toEqual(['Building_1']);
    // Building_2's vertices must not have been copied either.
    expect(result.doc.vertices).toHaveLength(4);
  });

  it('keeps features overlapping the bbox even partially', () => {
    // bbox [0.005, 0.005, 0.025, 0.025] straddles both feat1 (0..0.01) and
    // feat2 (0.02..0.03), so both are kept.
    const result = parseCityJsonSeq(makeSeq(), undefined, [0.005, 0.005, 0.025, 0.025]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects).sort()).toEqual(['Building_1', 'Building_2']);
  });

  it('drops all features when the bbox is far from the data', () => {
    const result = parseCityJsonSeq(makeSeq(), undefined, [1000, 1000, 2000, 2000]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects)).toEqual([]);
    expect(result.doc.vertices).toHaveLength(0);
  });

  it('treats edge-touching bboxes as intersecting (inclusive)', () => {
    // feat1 maxX = 0.01 exactly; a bbox starting at 0.01 should still match.
    const result = parseCityJsonSeq(makeSeq(), undefined, [0.01, 0.01, 0.02, 0.02]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects).sort()).toEqual(['Building_1', 'Building_2']);
  });

  it('combines viewport filter with limitFeatures', () => {
    // Both feat1 and feat2 intersect this bbox, but limit=1 takes only feat1.
    const result = parseCityJsonSeq(makeSeq(), 1, [0, 0, 1, 1]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects)).toEqual(['Building_1']);
  });

  it('parseCityJsonAuto forwards the viewport bbox to the seq parser', () => {
    const result = parseCityJsonAuto(makeSeq(), undefined, [0, 0, 0.015, 0.015]);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.doc.CityObjects)).toEqual(['Building_1']);
  });
});

describe('parseCityJsonAuto', () => {
  it('routes CityJSONSeq to the seq parser', () => {
    const result = parseCityJsonAuto(makeSeq());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.doc.CityObjects).sort()).toEqual(['Building_1', 'Building_2']);
  });

  it('routes monolithic CityJSON through the regular parser', () => {
    const mono = JSON.stringify({
      type: 'CityJSON',
      version: '2.0',
      CityObjects: { A: { type: 'Building' } },
      vertices: [[0, 0, 0]],
    });
    const result = parseCityJsonAuto(mono);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.doc.CityObjects)).toEqual(['A']);
  });
});
