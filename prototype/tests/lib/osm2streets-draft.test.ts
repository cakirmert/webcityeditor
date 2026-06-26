import { describe, expect, it } from 'vitest';
import { buildRoadDraftFromOsm2StreetsSelection } from '../../src/lib/osm2streets-draft';
import type { Osm2StreetsResult, Osm2StreetsSelection } from '../../src/lib/osm2streets';
import type { OsmRoadFeature } from '../../src/lib/transportation';

const result: Osm2StreetsResult = {
  engine: 'fork',
  diagnostics: [],
  plain: { type: 'FeatureCollection', features: [] },
  intersectionMarkings: { type: 'FeatureCollection', features: [] },
  laneMarkings: { type: 'FeatureCollection', features: [] },
  lanes: {
    type: 'FeatureCollection',
    features: [
      lane(2, 'Sidewalk', 2, 'None'),
      lane(0, 'Driving', 3.25, 'Forward', 'Kph(30)'),
      lane(1, 'Biking', 1.75, 'Forward'),
      lane(3, 'Parking(Parallel)', 2.1, 'None'),
    ],
  },
};

const osmRoad: OsmRoadFeature = {
  id: 'osm-way-3100',
  osmWayId: 3100,
  tags: { highway: 'residential', name: 'Fixture Street' },
  path: [
    [9.992, 53.549],
    [9.996, 53.551],
  ],
  inferredDraft: {
    source: 'osm',
    sourceOsmWayId: 3100,
    sections: [],
  },
};

describe('buildRoadDraftFromOsm2StreetsSelection', () => {
  it('seeds an editable RoadDraft from sibling osm2streets lanes', () => {
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[1] };

    const { draft, matchedOsmRoad } = buildRoadDraftFromOsm2StreetsSelection(selection, result, [
      osmRoad,
    ]);

    expect(matchedOsmRoad).toBe(osmRoad);
    expect(draft.name).toBe('Fixture Street');
    expect(draft.sourceOsmWayId).toBe(3100);
    expect(draft.sections[0].centerlineWgs84).toEqual(osmRoad.path);
    expect(draft.sections[0].bands.map((band) => band.kind)).toEqual([
      'car_lane',
      'bike_lane',
      'sidewalk',
      'parking',
    ]);
    expect(draft.sections[0].bands.map((band) => band.widthM)).toEqual([3.25, 1.75, 2, 2.1]);
    expect(draft.sections[0].bands[0]).toMatchObject({
      direction: 'forward',
      maxspeedKmh: 30,
      allowedModes: ['car'],
    });
  });

  it('falls back to the selected lane polygon when the OSM source way is unavailable', () => {
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[1] };

    const { draft, matchedOsmRoad } = buildRoadDraftFromOsm2StreetsSelection(selection, result, []);

    expect(matchedOsmRoad).toBeNull();
    expect(draft.sections[0].centerlineWgs84).toHaveLength(2);
    expect(draft.sections[0].bands[1]).toMatchObject({
      kind: 'bike_lane',
      allowedModes: ['bicycle'],
    });
  });
});

function lane(index: number, type: string, width: number, direction = 'Forward', speed = 'None') {
  return {
    type: 'Feature' as const,
    properties: {
      road: 7,
      index,
      type,
      width,
      direction,
      speed_limit: speed,
      osm_way_ids: [3100],
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [9.992 + index * 0.001, 53.549],
          [9.993 + index * 0.001, 53.549],
          [9.993 + index * 0.001, 53.55],
          [9.992 + index * 0.001, 53.55],
          [9.992 + index * 0.001, 53.549],
        ],
      ],
    },
  };
}
