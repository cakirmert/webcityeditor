import { describe, expect, it } from 'vitest';
import { connectedRoadIdsForIntersection } from '../../src/lib/osm2streets-selection';
import type { Osm2StreetsResult, Osm2StreetsSelection } from '../../src/lib/osm2streets';

const result: Osm2StreetsResult = {
  engine: 'fork',
  diagnostics: [],
  lanes: { type: 'FeatureCollection', features: [] },
  laneMarkings: { type: 'FeatureCollection', features: [] },
  intersectionMarkings: { type: 'FeatureCollection', features: [] },
  plain: {
    type: 'FeatureCollection',
    features: [
      road(7, 1, 2),
      road(8, 2, 3),
      road(9, 4, 5),
      {
        type: 'Feature',
        properties: { id: 2, type: 'intersection' },
        geometry: null,
      },
    ],
  },
};

describe('connectedRoadIdsForIntersection', () => {
  it('finds plain road polygons connected to the selected intersection', () => {
    const selection: Osm2StreetsSelection = {
      kind: 'intersection',
      feature: {
        type: 'Feature',
        properties: { id: 2, type: 'intersection' },
        geometry: null,
      },
    };

    expect([...connectedRoadIdsForIntersection(selection, result)].sort()).toEqual([7, 8]);
  });

  it('returns no connected road ids for lane or empty selections', () => {
    expect(connectedRoadIdsForIntersection(null, result).size).toBe(0);
    expect(
      connectedRoadIdsForIntersection(
        { kind: 'lane', feature: { type: 'Feature', properties: { road: 7 }, geometry: null } },
        result
      ).size
    ).toBe(0);
  });
});

function road(id: number, src_i: number, dst_i: number) {
  return {
    type: 'Feature' as const,
    properties: { id, type: 'road', src_i, dst_i },
    geometry: null,
  };
}
