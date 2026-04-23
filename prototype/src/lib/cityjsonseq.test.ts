import { describe, expect, it } from 'vitest';
import { parseCityJsonAuto, parseCityJsonSeq } from './cityjson';

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
