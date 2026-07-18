import { describe, expect, it } from 'vitest';
import proj4 from 'proj4';
import type { CityJsonDocument } from '../../src/types';
import type { Osm2StreetsResult, Osm2StreetsSelection } from '../../src/lib/osm2streets';
import { insertOsm2StreetsRoadIntoCityJson } from '../../src/lib/osm2streets-cityjson';
import { prepareValidatedCityJsonExport } from '../../src/lib/export-validation';
import { parseCityJson } from '../../src/lib/cityjson';
import { buildOsm2StreetsRoadAssets } from '../../src/lib/osm2streets-draft';
import { osm2streetsLaneFillColor, roadBandFillColor } from '../../src/lib/osm2streets-style';
import { extractTransportationAreas, type OsmRoadFeature } from '../../src/lib/transportation';

const result: Osm2StreetsResult = {
  engine: 'fork',
  diagnostics: [],
  plain: { type: 'FeatureCollection', features: [] },
  intersectionMarkings: { type: 'FeatureCollection', features: [] },
  laneMarkings: { type: 'FeatureCollection', features: [] },
  lanes: {
    type: 'FeatureCollection',
    features: [
      lane(0, 'Driving', 3.25, 'Forward', 'Kph(30)'),
      lane(1, 'Biking', 1.75, 'Forward'),
      lane(2, 'Sidewalk', 2, 'None'),
      lane(3, 'Buffer', 1, 'None'),
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

describe('insertOsm2StreetsRoadIntoCityJson', () => {
  it('writes selected osm2streets lane polygons as CityJSON Road surfaces', () => {
    const doc = emptyHamburgDoc();
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[0] };

    const inserted = insertOsm2StreetsRoadIntoCityJson(doc, selection, result, [osmRoad], {
      id: 'osm2streets-road-test',
    });

    expect(inserted.id).toBe('osm2streets-road-test');
    expect(inserted.areas).toHaveLength(4);
    expect(inserted.vertexCount).toBe(16);
    expect(doc.CityObjects['osm2streets-road-test']?.type).toBe('Road');
    expect(doc.CityObjects['osm2streets-road-test']?.attributes).toMatchObject({
      name: 'Fixture Street',
      _source: 'osm2streets',
      _osmWayIds: ['3100'],
      _osm2streetsLaneCount: 4,
    });

    const geometry = doc.CityObjects['osm2streets-road-test'].geometry?.[0] as {
      type: string;
      boundaries: number[][][];
      semantics: {
        surfaces: Array<Record<string, unknown>>;
        values: number[];
      };
    };
    expect(geometry.type).toBe('MultiSurface');
    expect(geometry.boundaries).toHaveLength(4);
    expect(geometry.semantics.values).toEqual([0, 1, 2, 3]);
    expect(geometry.semantics.surfaces.map((surface) => surface.function)).toEqual([
      'driving_lane',
      'bike_lane',
      'sidewalk',
      'median',
    ]);
    expect(geometry.semantics.surfaces[1]).toMatchObject({
      type: 'TrafficArea',
      bandId: 'osm2streets-road-7-lane-1',
      allowedModes: ['bicycle'],
      osm2streetsRoadId: '7',
      osmWayIds: ['3100'],
    });
    expect(geometry.semantics.surfaces[3]).toMatchObject({
      type: 'AuxiliaryTrafficArea',
      function: 'median',
    });
    expect(geometry.semantics.surfaces[3]).not.toHaveProperty('allowedModes');
    expect(prepareValidatedCityJsonExport(doc).ok).toBe(true);
  });

  it('re-imports as renderable road areas matching osm2streets polygons, colors, and semantics', () => {
    const doc = emptyHamburgDoc();
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[0] };
    const assets = buildOsm2StreetsRoadAssets(selection, result, [osmRoad], {
      crsCode: 'EPSG:25832',
      elevationM: 0,
    });

    insertOsm2StreetsRoadIntoCityJson(doc, selection, result, [osmRoad], {
      id: 'osm2streets-road-test',
    });

    const prepared = prepareValidatedCityJsonExport(doc);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const parsed = parseCityJson(prepared.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const importedRoad = parsed.doc.CityObjects['osm2streets-road-test'];
    const importedGeometry = importedRoad.geometry?.[0] as {
      semantics: {
        surfaces: Array<Record<string, unknown>>;
      };
    };
    expect(importedGeometry.semantics.surfaces.map((surface) => surface.type)).toEqual([
      'TrafficArea',
      'TrafficArea',
      'TrafficArea',
      'AuxiliaryTrafficArea',
    ]);
    expect(
      importedGeometry.semantics.surfaces.map((surface) => {
        const props = surface.osm2streetsProperties as Record<string, unknown>;
        return props.type;
      })
    ).toEqual(['Driving', 'Biking', 'Sidewalk', 'Buffer']);

    const renderedAreas = extractTransportationAreas(parsed.doc).sort(
      (a, b) => a.surfaceIndex - b.surfaceIndex
    );
    expect(renderedAreas).toHaveLength(assets.lanes.length);

    for (let index = 0; index < assets.lanes.length; index++) {
      const sourceLane = assets.lanes[index];
      const renderedArea = renderedAreas[index];
      const sourceType = String(sourceLane.properties.type ?? '');

      expect(renderedArea.function).toBe(expectedFunction(sourceType));
      expect(renderedArea.attributes.transportationUsage).toBe(sourceLane.band.kind);
      expect(renderedArea.attributes.sourceType).toBe(sourceType);
      expect(renderedArea.attributes.osm2streetsRoadId).toBe(String(sourceLane.roadId));
      expect(renderedArea.attributes.osm2streetsLaneIndex).toBe(sourceLane.laneIndex);
      expect(renderedArea.attributes.osmWayIds).toEqual(['3100']);
      expect(renderedArea.attributes.allowedModes).toEqual(
        sourceLane.band.allowedModes && sourceLane.band.allowedModes.length > 0
          ? sourceLane.band.allowedModes
          : null
      );
      expectPolygonToMatch(renderedArea.polygon, sourceLane.ringsWgs84[0]);
      expect(
        roadBandFillColor(String(renderedArea.attributes.transportationUsage), sourceType)
      ).toEqual(osm2streetsLaneFillColor(sourceType));
    }
  });

  it('preserves OSM tunnel hints without inventing a metric elevation', () => {
    const doc = emptyHamburgDoc();
    const selection: Osm2StreetsSelection = { kind: 'lane', feature: result.lanes.features[0] };
    const tunnelRoad: OsmRoadFeature = {
      ...osmRoad,
      tags: { ...osmRoad.tags, tunnel: 'yes', layer: '-1' },
    };

    const inserted = insertOsm2StreetsRoadIntoCityJson(
      doc,
      selection,
      result,
      [tunnelRoad],
      { id: 'tunnel-road' }
    );

    expect(inserted.areas[0].vertical).toEqual({
      placement: 'underground',
      source: 'osm_tags',
      osmLayer: -1,
    });
    expect(doc.CityObjects['tunnel-road'].attributes?._verticalProfile).toMatchObject({
      placement: 'underground',
      source: 'osm_tags',
      elevationM: null,
      osmLayer: -1,
    });
    expect(extractTransportationAreas(doc)[0].vertical).toEqual(inserted.areas[0].vertical);
  });

  it('uses osm2streets lane layer metadata when no matching OSM way is loaded', () => {
    const doc = emptyHamburgDoc();
    const layeredResult: Osm2StreetsResult = {
      ...result,
      lanes: {
        ...result.lanes,
        features: result.lanes.features.map((feature) => ({
          ...feature,
          properties: { ...feature.properties, layer: -2 },
        })),
      },
    };
    const selection: Osm2StreetsSelection = {
      kind: 'lane',
      feature: layeredResult.lanes.features[0],
    };

    const inserted = insertOsm2StreetsRoadIntoCityJson(
      doc,
      selection,
      layeredResult,
      [],
      { id: 'layered-road' }
    );

    expect(inserted.areas[0].vertical).toMatchObject({
      placement: 'underground',
      osmLayer: -2,
    });
  });

  it('places exact imported surfaces on the local building ground instead of the document minimum', () => {
    const doc = localGroundHamburgDoc();
    const selection: Osm2StreetsSelection = {
      kind: 'lane',
      feature: result.lanes.features[0],
    };

    const inserted = insertOsm2StreetsRoadIntoCityJson(
      doc,
      selection,
      result,
      [osmRoad],
      { id: 'locally-grounded-road' }
    );

    expect(inserted.areas[0].vertical).toMatchObject({
      placement: 'surface',
      elevationM: 12,
    });
    const roadGeometry = doc.CityObjects['locally-grounded-road'].geometry?.[0] as {
      boundaries: number[][][];
    };
    const roadVertexIndices = roadGeometry.boundaries.flat(2);
    expect(
      roadVertexIndices.every(
        (vertexIndex) =>
          doc.vertices[vertexIndex][2] * doc.transform!.scale[2] +
            doc.transform!.translate[2] ===
          12
      )
    ).toBe(true);
  });
});

function emptyHamburgDoc(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: {
      scale: [0.001, 0.001, 0.001],
      translate: [565000, 5935000, 0],
    },
    metadata: {
      referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    },
    CityObjects: {},
    vertices: [],
  };
}

function localGroundHamburgDoc(): CityJsonDocument {
  const doc = emptyHamburgDoc();
  addGroundBuilding(doc, 'near-road', [9.99204, 53.54905], 12);
  addGroundBuilding(doc, 'distant-low-point', [9.98, 53.54], -8);
  return doc;
}

function addGroundBuilding(
  doc: CityJsonDocument,
  id: string,
  center: [number, number],
  elevationM: number
): void {
  const [x, y] = proj4('EPSG:4326', 'EPSG:25832', center) as [number, number];
  const t = doc.transform!;
  const firstVertex = doc.vertices.length;
  for (const [dx, dy] of [
    [-15, -15],
    [15, -15],
    [15, 15],
    [-15, 15],
  ] as [number, number][]) {
    doc.vertices.push([
      Math.round((x + dx - t.translate[0]) / t.scale[0]),
      Math.round((y + dy - t.translate[1]) / t.scale[1]),
      Math.round((elevationM - t.translate[2]) / t.scale[2]),
    ]);
  }
  doc.CityObjects[id] = {
    type: 'Building',
    geometry: [
      {
        type: 'MultiSurface',
        lod: '2',
        boundaries: [[[firstVertex, firstVertex + 1, firstVertex + 2, firstVertex + 3]]],
        semantics: {
          surfaces: [{ type: 'GroundSurface' }],
          values: [0],
        },
      },
    ],
  };
}

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
          [9.992 + index * 0.0001, 53.549],
          [9.99208 + index * 0.0001, 53.549],
          [9.99208 + index * 0.0001, 53.5491],
          [9.992 + index * 0.0001, 53.5491],
          [9.992 + index * 0.0001, 53.549],
        ],
      ],
    },
  };
}

function expectedFunction(type: string): string {
  if (type === 'Driving') return 'driving_lane';
  if (type === 'Biking') return 'bike_lane';
  if (type === 'Sidewalk') return 'sidewalk';
  if (type === 'Buffer') return 'median';
  throw new Error(`Unexpected lane type ${type}`);
}

function expectPolygonToMatch(actual: [number, number][], expectedOpen: [number, number][]): void {
  const expected = closeRing(expectedOpen);
  expect(actual).toHaveLength(expected.length);
  for (const expectedPoint of expected) {
    const nearest = Math.min(
      ...actual.map(
        (actualPoint) =>
          Math.hypot(actualPoint[0] - expectedPoint[0], actualPoint[1] - expectedPoint[1])
      )
    );
    expect(nearest).toBeLessThan(2e-7);
  }
}

function closeRing(ring: [number, number][]): [number, number][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first) return [];
  if (last && first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, [first[0], first[1]]];
}
