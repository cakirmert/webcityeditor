import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson } from '../../src/lib/cityjson';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import {
  buildRoadEditPayload,
  buildOverpassRoadQuery,
  buildExactRoadAttributePreviewAreas,
  buildRoadPreviewAreas,
  createManualRoadDraft,
  clearStaleReciprocalRoadConnections,
  deleteRoadFromCityJson,
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
  findStaleReciprocalRoadConnections,
  inferRoadDraftFromOsmRoad,
  inferRoadVerticalProfileFromOsmTags,
  insertRoadIntoCityJson,
  parseOsmPointFeaturesFromXml,
  parseOsmRoadsFromOverpass,
  readEditableRoadDraftFromCityObject,
  roadDraftPreservesExactGeometry,
  splitRoadSectionAtFraction,
  synchronizeRoadConnectionMetadata,
  updateExactRoadAttributesInCityJson,
  type RoadArea,
} from '../../src/lib/transportation';

const delftRoad: [number, number][] = [
  [4.35704, 52.01158],
  [4.35724, 52.01158],
  [4.35742, 52.01164],
];

describe('transportation roads', () => {
  it('queries road ways and the supported tagged street-point nodes', () => {
    const query = buildOverpassRoadQuery([9.98, 53.54, 10.01, 53.56], 'xml', 30);

    expect(query).toContain('way["highway"](53.54,9.98,53.56,10.01);');
    expect(query).toContain('node["traffic_sign"](53.54,9.98,53.56,10.01);');
    expect(query).toContain('node["natural"="tree"](53.54,9.98,53.56,10.01);');
    expect(query).toContain('node["highway"~"^(street_lamp|traffic_signals)$"]');
    expect(query).toContain('node["barrier"="bollard"](53.54,9.98,53.56,10.01);');
  });

  it('parses supported OSM point features while ignoring ordinary way nodes', () => {
    const points = parseOsmPointFeaturesFromXml(`
      <osm version="0.6">
        <node id="1" lat="53.55" lon="9.99"><tag k="natural" v="tree"/></node>
        <node id="2" lat="53.551" lon="9.991"><tag k="highway" v="traffic_signals"/></node>
        <node id="3" lat="53.552" lon="9.992"><tag k="traffic_sign" v="DE:205"/></node>
        <node id="4" lat="53.553" lon="9.993"><tag k="highway" v="street_lamp"/></node>
        <node id="5" lat="53.554" lon="9.994"><tag k="barrier" v="bollard"/></node>
        <node id="6" lat="53.555" lon="9.995"/>
      </osm>
    `);

    expect(points.map((point) => point.kind)).toEqual([
      'tree',
      'traffic_signals',
      'traffic_sign',
      'street_lamp',
      'bollard',
    ]);
    expect(points[0]).toMatchObject({
      id: 'osm-node-1',
      osmNodeId: '1',
      position: [9.99, 53.55],
      tags: { natural: 'tree' },
    });
  });

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

  it('uses the same sampled smooth curve for preview and saved CityJSON ribbons', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    draft.sections[0].curve = { mode: 'smooth', strength: 1 };

    const preview = buildRoadPreviewAreas(doc, draft);
    const inserted = insertRoadIntoCityJson(doc, draft, { id: 'curved-road' });
    const geometry = doc.CityObjects['curved-road'].geometry?.[0] as {
      boundaries: number[][][];
    };

    expect(preview[0].polygon.length).toBeGreaterThan(draft.sections[0].centerlineWgs84.length * 2);
    expect(inserted.areas[0].polygon).toHaveLength(preview[0].polygon.length);
    expect(geometry.boundaries[0][0]).toHaveLength(preview[0].polygon.length);
  });

  it('reopens inserted Road objects with editable _roadLayout metadata', () => {
    const doc = buildSampleCube();
    const draft = createManualRoadDraft(delftRoad, { name: 'Reopened road', maxspeedKmh: 30 });
    draft.sections[0].bands[1].sourceType = 'Bus';
    draft.sections[0].bands[1].allowedModes = ['bus'];
    draft.sections[0].connections = {
      end: {
        target: 'osm',
        targetId: 'osm-way-42',
        targetEndpoint: 'start',
        positionWgs84: draft.sections[0].centerlineWgs84.at(-1)!,
        confirmed: true,
      },
    };
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
    expect(areas[0].editableDraft?.sections[0]).toMatchObject({
      curve: { mode: 'smooth', strength: 0.72 },
      connections: {
        end: { target: 'osm', targetId: 'osm-way-42', confirmed: true },
      },
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
          sourceCenterlineWgs84: [[9.99, 53.54999], [10, 53.54999]],
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
    expect(draft.sections[0].centerlineWgs84).toEqual([
      [9.99, 53.54999],
      [10, 53.54999],
    ]);
    expect(draft.sections[0].maxspeedKmh).toBe(30);
    expect(draft.sections[0].bands).toEqual([
      expect.objectContaining({ kind: 'sidewalk', widthM: 1.5, direction: 'backward' }),
      expect.objectContaining({ kind: 'car_lane', widthM: 3, direction: 'forward' }),
    ]);

    const reordered = JSON.parse(JSON.stringify(draft)) as typeof draft;
    reordered.sections[0].bands.reverse();
    const reorderedPreview = buildRoadPreviewAreas(buildSampleCube(), reordered);
    expect(
      reorderedPreview.every((area) =>
        JSON.stringify(area.attributes.sourceCenterlineWgs84) ===
        JSON.stringify(draft.sections[0].centerlineWgs84)
      )
    ).toBe(true);
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

  it('preserves imported exact polygons for attribute-only road edits', () => {
    const doc = buildSampleCube();
    const sourceDraft = createManualRoadDraft(delftRoad, { maxspeedKmh: 30 });
    insertRoadIntoCityJson(doc, sourceDraft, { id: 'exact-road' });
    const object = doc.CityObjects['exact-road'];
    delete object.attributes?._roadLayout;
    if (object.attributes) {
      object.attributes._roadGeometryMode = 'exact';
      object.attributes._source = 'osm2streets';
    }

    const sourceAreas = extractTransportationAreas(doc).filter(
      (area) => area.roadId === 'exact-road'
    );
    const draft = deriveEditableRoadDraftFromAreas(sourceAreas, 'exact-road');
    const beforeBoundaries = JSON.stringify(
      (object.geometry?.[0] as { boundaries?: unknown }).boundaries
    );
    const beforeVertices = JSON.stringify(doc.vertices);

    draft.sections[0].bands[0].surface = 'paving_stones';
    draft.sections[0].bands[0].direction = 'both';
    draft.sections[0].bands[0].allowedModes = ['pedestrian'];
    expect(roadDraftPreservesExactGeometry(
      deriveEditableRoadDraftFromAreas(sourceAreas, 'exact-road'),
      draft
    )).toBe(true);

    const preview = buildExactRoadAttributePreviewAreas(sourceAreas, 'exact-road', draft);
    expect(preview[0].polygon).toEqual(sourceAreas[0].polygon);
    expect(preview[0].attributes.surfaceMaterial).toBe('paving_stones');

    const updated = updateExactRoadAttributesInCityJson(doc, 'exact-road', draft);
    expect(updated.vertexCount).toBe(0);
    expect(
      JSON.stringify((object.geometry?.[0] as { boundaries?: unknown }).boundaries)
    ).toBe(beforeBoundaries);
    expect(JSON.stringify(doc.vertices)).toBe(beforeVertices);
    expect(updated.areas[0].attributes.surfaceMaterial).toBe('paving_stones');
    expect(object.attributes?._roadGeometryMode).toBe('exact');
    expect(readEditableRoadDraftFromCityObject(object)).toMatchObject({ id: 'exact-road' });

    const widthEdit = JSON.parse(JSON.stringify(draft)) as typeof draft;
    widthEdit.sections[0].bands[0].widthM += 0.5;
    expect(roadDraftPreservesExactGeometry(draft, widthEdit)).toBe(false);
  });

  it('stores reciprocal metadata when a user connects two editable CityJSON roads', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(delftRoad);
    insertRoadIntoCityJson(doc, target, { id: 'target-road' });

    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      delftRoad[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'target-road',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: delftRoad[0],
        laneConnections: [
          {
            sourceBandId: source.sections[0].bands[0].id,
            sourceBandIndex: 0,
            targetBandId: target.sections[0].bands[1].id,
            targetBandIndex: 1,
            sourceMode: 'pedestrian',
            targetMode: 'bicycle',
          },
        ],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'source-road' });

    expect(synchronizeRoadConnectionMetadata(doc, 'source-road', source)).toEqual([
      'target-road',
    ]);
    expect(readEditableRoadDraftFromCityObject(doc.CityObjects['target-road'])).toMatchObject({
      sections: [
        {
          connections: {
            start: {
              target: 'cityjson',
              targetId: 'source-road',
              targetEndpoint: 'end',
              laneConnections: [
                {
                  sourceBandId: target.sections[0].bands[1].id,
                  sourceBandIndex: 1,
                  targetBandId: source.sections[0].bands[0].id,
                  targetBandIndex: 0,
                  sourceMode: 'bicycle',
                  targetMode: 'pedestrian',
                },
              ],
              confirmed: true,
            },
          },
        },
      ],
    });
  });

  it('adds reciprocal metadata to an exact imported target without changing its polygons', () => {
    const doc = buildSampleCube();
    const targetSeed = createManualRoadDraft(delftRoad);
    insertRoadIntoCityJson(doc, targetSeed, { id: 'exact-target-road' });
    const targetObject = doc.CityObjects['exact-target-road'];
    delete targetObject.attributes?._roadLayout;
    if (targetObject.attributes) {
      targetObject.attributes._roadGeometryMode = 'exact';
      targetObject.attributes._source = 'osm2streets';
    }
    const targetDraft = deriveEditableRoadDraftFromAreas(
      extractTransportationAreas(doc),
      'exact-target-road'
    );
    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      delftRoad[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'exact-target-road',
        targetSectionId: targetDraft.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: delftRoad[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'source-road' });
    const targetGeometry = targetObject.geometry?.[0] as { boundaries?: unknown };
    const boundariesBefore = JSON.stringify(targetGeometry.boundaries);
    const verticesBefore = JSON.stringify(doc.vertices);

    expect(synchronizeRoadConnectionMetadata(doc, 'source-road', source)).toEqual([
      'exact-target-road',
    ]);

    expect(targetObject.attributes?._roadGeometryMode).toBe('exact');
    expect(readEditableRoadDraftFromCityObject(targetObject)).toMatchObject({
      id: 'exact-target-road',
      sections: [{
        connections: {
          start: expect.objectContaining({
            targetId: 'source-road',
            targetEndpoint: 'end',
            confirmed: true,
          }),
        },
      }],
    });
    expect(JSON.stringify(targetGeometry.boundaries)).toBe(boundariesBefore);
    expect(JSON.stringify(doc.vertices)).toBe(verticesBefore);
  });

  it('deletes a road and clears reciprocal endpoint metadata on surviving roads', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(delftRoad);
    insertRoadIntoCityJson(doc, target, { id: 'target-road' });

    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      delftRoad[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'target-road',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: delftRoad[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'source-road' });
    synchronizeRoadConnectionMetadata(doc, 'source-road', source);

    expect(deleteRoadFromCityJson(doc, 'target-road')).toEqual({
      deleted: true,
      disconnectedRoadIds: ['source-road'],
    });
    expect(doc.CityObjects['target-road']).toBeUndefined();
    expect(
      readEditableRoadDraftFromCityObject(doc.CityObjects['source-road'])?.sections[0].connections
    ).toBeUndefined();
    expect(doc.CityObjects['source-road'].attributes?._updatedAt).toEqual(expect.any(String));
  });

  it('finds and clears a stale reciprocal link after a connected endpoint moves away', () => {
    const doc = buildSampleCube();
    const target = createManualRoadDraft(delftRoad);
    insertRoadIntoCityJson(doc, target, { id: 'target-road' });

    const source = createManualRoadDraft([
      [4.3568, 52.0115],
      delftRoad[0],
    ]);
    source.sections[0].connections = {
      end: {
        target: 'cityjson',
        targetId: 'target-road',
        targetSectionId: target.sections[0].id,
        targetEndpoint: 'start',
        positionWgs84: delftRoad[0],
        confirmed: true,
      },
    };
    insertRoadIntoCityJson(doc, source, { id: 'source-road' });
    synchronizeRoadConnectionMetadata(doc, 'source-road', source);

    const movedSource = JSON.parse(JSON.stringify(source)) as typeof source;
    movedSource.sections[0].centerlineWgs84.at(-1)![0] += 0.0001;
    delete movedSource.sections[0].connections;

    expect(findStaleReciprocalRoadConnections(doc, 'source-road', movedSource)).toEqual([
      {
        roadId: 'target-road',
        sectionId: target.sections[0].id,
        endpoint: 'start',
      },
    ]);
    expect(clearStaleReciprocalRoadConnections(doc, 'source-road', movedSource)).toEqual({
      disconnectedRoadIds: ['target-road'],
      disconnectedConnectionCount: 1,
    });
    expect(
      readEditableRoadDraftFromCityObject(doc.CityObjects['target-road'])?.sections[0].connections
    ).toBeUndefined();
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
