import { describe, expect, it } from 'vitest';
import { buildSampleCube } from './cityjson';
import { prepareValidatedCityJsonExport } from './export-validation';
import {
  buildRoadEditPayload,
  createManualRoadDraft,
  extractTransportationAreas,
  inferRoadDraftFromOsmRoad,
  insertRoadIntoCityJson,
  parseOsmRoadsFromOverpass,
  splitRoadSectionAtFraction,
} from './transportation';

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
