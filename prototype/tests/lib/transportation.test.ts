import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from '../../src/lib/cityjson';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import {
  buildRoadEditPayload,
  createManualRoadDraft,
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  inferRoadDraftFromOsmRoad,
  inferRoadVerticalProfileFromOsmTags,
  insertRoadIntoCityJson,
  parseOsmRoadsFromOverpass,
  splitRoadSectionAtFraction,
  type RoadArea,
} from '../../src/lib/transportation';

const delftRoad: [number, number][] = [
  [4.35704, 52.01158],
  [4.35724, 52.01158],
  [4.35742, 52.01164],
];

describe('transportation roads', () => {
  it('parses OSM Overpass ways into selectable road features', () => {
    const roads = parseOsmRoadsFromOverpass({
      elements: [
        { type: 'node', id: 1, lon: 4.357, lat: 52.0116 },
        { type: 'node', id: 2, lon: 4.358, lat: 52.0116 },
        {
          type: 'way',
          id: 123,
          nodes: [1, 2],
          tags: {
            highway: 'residential',
            lanes: '2',
            sidewalk: 'both',
            maxspeed: '30',
          },
        },
      ],
    });

    expect(roads).toHaveLength(1);
    expect(roads[0].osmWayId).toBe(123);
    expect(roads[0].path).toEqual([
      [4.357, 52.0116],
      [4.358, 52.0116],
    ]);
    expect(roads[0].inferredDraft.sections[0].bands.map((band) => band.kind)).toEqual([
      'sidewalk',
      'car_lane',
      'car_lane',
      'sidewalk',
    ]);
  });

  it('infers two-way lanes, bike lanes, sidewalks, and speed from OSM tags', () => {
    const draft = inferRoadDraftFromOsmRoad({
      osmWayId: '42',
      path: delftRoad,
      tags: {
        highway: 'secondary',
        lanes: '2',
        sidewalk: 'both',
        cycleway: 'lane',
        maxspeed: '50 km/h',
      },
    });

    const section = draft.sections[0];
    expect(section.maxspeedKmh).toBe(50);
    expect(section.bands.map((band) => [band.kind, band.direction])).toEqual([
      ['sidewalk', 'none'],
      ['bike_lane', 'backward'],
      ['car_lane', 'backward'],
      ['car_lane', 'forward'],
      ['bike_lane', 'forward'],
      ['sidewalk', 'none'],
    ]);
  });

  it.each([
    ['footway', 'Footway', 'sidewalk'],
    ['pedestrian', 'Footway', 'sidewalk'],
    ['path', 'SharedUse', 'sidewalk'],
    ['cycleway', 'Biking', 'bike_lane'],
  ] as const)(
    'does not invent underground car lanes for highway=%s',
    (highway, sourceType, kind) => {
      const draft = inferRoadDraftFromOsmRoad({
        osmWayId: `underground-${highway}`,
        path: delftRoad,
        tags: { highway, tunnel: 'yes', layer: '-1' },
      });

      expect(draft.vertical?.placement).toBe('underground');
      expect(draft.sections[0].bands).toEqual([
        expect.objectContaining({ kind, sourceType }),
      ]);
      expect(draft.sections[0].bands.some((band) => band.kind === 'car_lane')).toBe(false);
    }
  );

  it.each([
    [{ tunnel: 'yes' }, 'underground'],
    [{ covered: 'yes' }, 'underground'],
    [{ layer: '-1' }, 'underground'],
    [{ bridge: 'yes' }, 'elevated'],
    [{ layer: '2' }, 'elevated'],
    [{ bridge: 'yes', layer: '-1' }, 'unknown'],
    [{ layer: 'not-a-number' }, 'surface'],
  ] as const)('infers %s OSM vertical hints as %s', (tags, placement) => {
    expect(inferRoadVerticalProfileFromOsmTags(tags)).toMatchObject({ placement });
  });

  it('inserts a valid CityJSON Road MultiSurface with transportation semantics', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    const result = insertRoadIntoCityJson(doc, draft, { id: 'road-test' });

    expect(result.id).toBe('road-test');
    expect(doc.CityObjects['road-test']?.type).toBe('Road');
    const geom = doc.CityObjects['road-test'].geometry![0] as {
      type: string;
      boundaries: number[][][];
      semantics: {
        surfaces: Array<{ type: string; function?: string }>;
        values: number[];
      };
    };
    expect(geom.type).toBe('MultiSurface');
    expect(geom.boundaries).toHaveLength(draft.sections[0].bands.length);
    expect(geom.semantics.values).toEqual([0, 1, 2, 3, 4]);
    expect(geom.semantics.surfaces.map((surface) => surface.type)).toContain('TrafficArea');
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
  });

  it('extracts inserted road areas for map rendering and picking', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, draft, { id: 'road-test' });

    const areas = extractTransportationAreas(doc);
    expect(areas).toHaveLength(draft.sections[0].bands.length);
    expect(areas[0].roadId).toBe('road-test');
    expect(areas[0].polygon.length).toBeGreaterThanOrEqual(4);
    expect(areas.some((area) => area.function === 'bike_lane')).toBe(true);
  });

  it('reopens inserted Road objects with editable _roadLayout metadata', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { name: 'Reopened road', maxspeedKmh: 30 });
    draft.sections[0].bands[1].sourceType = 'Bus';
    draft.sections[0].bands[1].allowedModes = ['bus'];
    draft.vertical = { placement: 'underground', source: 'user', elevationM: -4 };
    insertRoadIntoCityJson(doc, draft, { id: 'road-test' });

    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const parsed = parseCityJson(prepared.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const areas = extractTransportationAreas(parsed.doc).filter((area) => area.roadId === 'road-test');

    expect(areas[0].editableDraft).toMatchObject({
      name: 'Reopened road',
      source: 'manual',
      vertical: { placement: 'underground', source: 'user', elevationM: -4 },
    });
    expect(areas[0].editableDraft?.sections[0].centerlineWgs84).toEqual(draft.sections[0].centerlineWgs84);
    expect(areas[0].editableDraft?.sections[0].bands.map((band) => band.kind)).toEqual(
      draft.sections[0].bands.map((band) => band.kind)
    );
    expect(areas[0].editableDraft?.sections[0].bands[1]).toMatchObject({
      sourceType: 'Bus',
      allowedModes: ['bus'],
    });
    expect(areas.some((area) => area.attributes.sourceType === 'Bus')).toBe(true);
  });

  it('derives an editable draft from precomputed CityJSON road surfaces alone', () => {
    const areas: RoadArea[] = [
      {
        id: 'road-precomputed-surface-0',
        roadId: 'road-precomputed',
        sectionId: 'section-1',
        bandId: 'sidewalk-0',
        surfaceIndex: 0,
        surfaceType: 'TrafficArea',
        function: 'sidewalk',
        polygon: [
          [9.99, 53.55],
          [10, 53.55],
          [10, 53.55001],
          [9.99, 53.55001],
          [9.99, 53.55],
        ],
        vertical: { placement: 'surface', source: 'cityjson_geometry', elevationM: 0 },
        attributes: {
          source: 'osm2streets',
          roadName: 'Imported Rathausmarkt road',
          sourceType: 'Sidewalk',
          trafficDirection: 'backward',
          allowedModes: ['pedestrian'],
          osm2streetsLaneIndex: 0,
          osmWayIds: ['3100'],
          osm2streetsPropertiesJson: '{"type":"Sidewalk","width":1.5}',
        },
      },
      {
        id: 'road-precomputed-surface-1',
        roadId: 'road-precomputed',
        sectionId: 'section-1',
        bandId: 'driving-1',
        surfaceIndex: 1,
        surfaceType: 'TrafficArea',
        function: 'driving_lane',
        polygon: [
          [9.99, 53.54997],
          [10, 53.54997],
          [10, 53.55],
          [9.99, 53.55],
          [9.99, 53.54997],
        ],
        attributes: {
          source: 'osm2streets',
          sourceType: 'Driving',
          trafficDirection: 'forward',
          allowedModes: ['car'],
          maxspeed: 30,
          osm2streetsLaneIndex: 1,
          osmWayIds: ['3100'],
          osm2streetsPropertiesJson: '{"type":"Driving","width":3}',
        },
      },
    ];

    const draft = deriveEditableRoadDraftFromAreas(areas, 'road-precomputed');

    expect(draft).toMatchObject({
      id: 'road-precomputed',
      name: 'Imported Rathausmarkt road',
      source: 'osm',
      sourceOsmWayId: '3100',
      userVerified: false,
    });
    expect(draft.sections).toHaveLength(1);
    expect(draft.sections[0].centerlineWgs84).toHaveLength(2);
    expect(draft.sections[0].maxspeedKmh).toBe(30);
    expect(draft.sections[0].bands).toEqual([
      expect.objectContaining({ kind: 'sidewalk', widthM: 1.5, direction: 'backward' }),
      expect.objectContaining({ kind: 'car_lane', widthM: 3, direction: 'forward' }),
    ]);
  });

  it('uses a known draft elevation for geometry and preserves its vertical profile', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    draft.vertical = { placement: 'elevated', source: 'user', elevationM: 42 };

    const inserted = insertRoadIntoCityJson(doc, draft, { id: 'elevated-road' });
    const extracted = extractTransportationAreas(doc).filter(
      (area) => area.roadId === 'elevated-road'
    );

    expect(inserted.areas[0].vertical).toEqual(draft.vertical);
    expect(extracted[0].vertical).toEqual(draft.vertical);
    expect(doc.CityObjects['elevated-road'].attributes?._verticalProfile).toMatchObject({
      placement: 'elevated',
      source: 'user',
      elevationM: 42,
    });
  });

  it('splits a road section into two building-block sections while preserving bands', () => {
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    const split = splitRoadSectionAtFraction(draft, 'section-1', 0.5);

    expect(split.sections).toHaveLength(2);
    expect(split.sections[0].centerlineWgs84.at(-1)).toEqual(split.sections[1].centerlineWgs84[0]);
    expect(split.sections[0].bands).toHaveLength(draft.sections[0].bands.length);
    expect(split.sections[1].bands).toHaveLength(draft.sections[0].bands.length);
  });

  it('rejects self-intersecting generated road surfaces before mutating the document', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(
      [
        [4.357, 52.0116],
        [4.3572, 52.0116],
        [4.357, 52.0116],
        [4.3572, 52.0116],
      ],
      { maxspeedKmh: 30 }
    );
    const beforeVertices = doc.vertices.length;

    expect(() => insertRoadIntoCityJson(doc, draft, { id: 'bad-road' })).toThrow(
      /self-intersects|duplicate projected points|collapsed/
    );
    expect(doc.CityObjects['bad-road']).toBeUndefined();
    expect(doc.vertices).toHaveLength(beforeVertices);
  });

  it('builds a backend-ready payload from the same draft used for CityJSON insertion', () => {
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    const payload = buildRoadEditPayload(draft, 'road-test');

    expect(payload.schemaVersion).toBe('webcityeditor-road-edit-v1');
    expect(payload.target).toBe('cityjson-transportation');
    expect(payload.roadObjectId).toBe('road-test');
    expect(payload.draft.sections[0].bands.some((band) => band.kind === 'bike_lane')).toBe(true);
  });
});
