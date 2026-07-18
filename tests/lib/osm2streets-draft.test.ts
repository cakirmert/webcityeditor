import { describe, expect, it } from 'vitest';
import {
  buildOsm2StreetsRoadAssets,
  buildRoadDraftFromOsm2StreetsSelection,
} from '../../src/lib/osm2streets-draft';
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
    expect(draft.sections[0].bands.map((band) => band.sourceType)).toEqual([
      'Driving',
      'Biking',
      'Sidewalk',
      'Parking(Parallel)',
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

  it('normalizes sibling lane polygons into reusable road surface assets', () => {
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[1] };

    const assets = buildOsm2StreetsRoadAssets(selection, result, [osmRoad], {
      crsCode: 'EPSG:25832',
      elevationM: 7.5,
    });

    expect(assets.roadId).toBe('7');
    expect(assets.matchedOsmRoad).toBe(osmRoad);
    expect(assets.sourceOsmWayIds).toEqual([3100]);
    expect(assets.lanes.map((lane) => lane.band.kind)).toEqual([
      'car_lane',
      'bike_lane',
      'sidewalk',
      'parking',
    ]);
    expect(assets.lanes[0].ringsWgs84[0]).toEqual([
      [9.992, 53.549],
      [9.993, 53.549],
      [9.993, 53.55],
      [9.992, 53.55],
    ]);
    expect(assets.lanes[0]).toMatchObject({
      source: 'osm2streets',
      crsUri: 'https://www.opengis.net/def/crs/EPSG/0/25832',
      sectionId: 'osm2streets-road-7-section-1',
      trafficSpaceId: 'osm2streets-road-7',
      trafficAreaId: 'osm2streets-road-7-lane-0',
      laneType: 'Driving',
      trafficDirection: 'forward',
      granularity: 'lane',
      centerLineRole: 'derived_from_osm',
      widthMeters: 3.25,
      functionCode: 'driving_lane',
      functionLabel: 'Driving lane',
      usageCode: 'car_lane',
      usageLabel: 'Motor vehicle traffic',
      osmWayIds: ['3100'],
      osm2streetsRoadId: '7',
      osm2streetsLaneIndex: 0,
    });
    expect(assets.lanes[0].surfacePolygon).toHaveLength(5);
    expect(assets.lanes[0].surfacePolygon[0]).toEqual(
      assets.lanes[0].surfacePolygon[assets.lanes[0].surfacePolygon.length - 1]
    );
    expect(assets.lanes[0].surfacePolygon[0][0]).toBeGreaterThan(500_000);
    expect(assets.lanes[0].surfacePolygon[0][2]).toBe(7.5);
    expect(assets.lanes[0].centerLine).toHaveLength(osmRoad.path.length);
    expect(assets.lanes[0].centerLine[0][2]).toBe(7.5);
    expect(assets.lanes[0].properties.osm_way_ids).toEqual([3100]);
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
