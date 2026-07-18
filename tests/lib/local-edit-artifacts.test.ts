import { describe, expect, it } from 'vitest';
import { buildSampleCube, parseCityJson, setAttribute } from '../../src/lib/cityjson';
import { commitBuildingTransformFromEditor } from '../../src/lib/editor-actions';
import {
  buildCityJsonChangeReport,
  prepareLocalEditArtifacts,
  type VisualDiffGeoJson,
} from '../../src/lib/local-edit-artifacts';
import { insertOsm2StreetsRoadIntoCityJson } from '../../src/lib/osm2streets-cityjson';
import type { Osm2StreetsResult, Osm2StreetsSelection } from '../../src/lib/osm2streets';
import type { OsmRoadFeature } from '../../src/lib/transportation';
import type { CityJsonDocument } from '../../src/types';

describe('local edit artifacts', () => {
  it('prepares saveable CityJSON, semantic report, and visual diff for a building edit', () => {
    const before = buildSampleCube();
    const after = clone(before);

    setAttribute(after, 'Building_A', 'function', 'commercial');
    commitBuildingTransformFromEditor(after, {
      id: 'Building_A',
      dx: 2,
      dy: 3,
      angle: 0,
    });

    const bundle = prepareLocalEditArtifacts(before, after, {
      baseName: 'sample.city.json',
      sourceName: 'sample.city.json',
      generatedAt: '2026-07-03T00:00:00.000Z',
    });

    expect(bundle.artifacts.map((artifact) => artifact.fileName)).toEqual([
      'sample.modified.city.json',
      'sample.change-report.json',
      'sample.visual-diff.geojson',
    ]);

    const cityJsonArtifact = bundle.artifacts.find((artifact) => artifact.kind === 'cityjson');
    expect(cityJsonArtifact?.mediaType).toBe('application/city+json');
    const reopened = parseCityJson(cityJsonArtifact?.text ?? '');
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.doc.CityObjects.Building_A.attributes?.function).toBe('commercial');

    const change = bundle.report.objects.find((entry) => entry.objectId === 'Building_A');
    expect(change).toMatchObject({
      status: 'modified',
      typeBefore: 'Building',
      typeAfter: 'Building',
      geometry: { changed: true },
      semantics: { changed: false },
    });
    expect(change?.attributeChanges).toEqual([
      {
        objectId: 'Building_A',
        key: 'function',
        before: 'residential',
        after: 'commercial',
      },
    ]);
    expect(bundle.report.totals).toMatchObject({
      modifiedObjects: 1,
      addedObjects: 0,
      attributeChanges: 1,
      geometryChanges: 1,
      semanticChanges: 0,
    });

    const visualDiff = JSON.parse(
      bundle.artifacts.find((artifact) => artifact.kind === 'visual-diff')?.text ?? ''
    ) as VisualDiffGeoJson;
    expect(visualDiff.type).toBe('FeatureCollection');
    expect(visualDiff.features.some((feature) => feature.properties.state === 'before')).toBe(true);
    expect(visualDiff.features.some((feature) => feature.properties.state === 'after')).toBe(true);
    expect(
      visualDiff.features.every((feature) => feature.properties.objectId === 'Building_A')
    ).toBe(true);
  });

  it('reports inserted osm2streets roads as semantic and visual output artifacts', () => {
    const before = emptyHamburgDoc();
    const after = clone(before);
    const osm2streets = osm2streetsResult();
    const selection: Osm2StreetsSelection = {
      kind: 'lane',
      feature: osm2streets.lanes.features[0],
    };

    insertOsm2StreetsRoadIntoCityJson(after, selection, osm2streets, [osmRoad()], {
      id: 'osm2streets-road-proof',
    });

    const report = buildCityJsonChangeReport(before, after, {
      generatedAt: '2026-07-03T00:00:00.000Z',
    });
    const roadChange = report.objects.find(
      (entry) => entry.objectId === 'osm2streets-road-proof'
    );

    expect(roadChange).toMatchObject({
      status: 'added',
      typeAfter: 'Road',
      geometry: { changed: true },
      semantics: { changed: true },
    });
    expect(roadChange?.semantics.after.map((surface) => surface.function)).toEqual([
      'driving_lane',
      'bike_lane',
      'sidewalk',
      'median',
    ]);

    const bundle = prepareLocalEditArtifacts(before, after, {
      baseName: 'hamburg-road',
      generatedAt: '2026-07-03T00:00:00.000Z',
    });
    const exported = parseCityJson(
      bundle.artifacts.find((artifact) => artifact.kind === 'cityjson')?.text ?? ''
    );
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.doc.CityObjects['osm2streets-road-proof']?.type).toBe('Road');

    const reportArtifact = JSON.parse(
      bundle.artifacts.find((artifact) => artifact.kind === 'change-report')?.text ?? ''
    ) as ReturnType<typeof buildCityJsonChangeReport>;
    expect(reportArtifact.totals).toMatchObject({
      addedObjects: 1,
      geometryChanges: 1,
      semanticChanges: 1,
    });

    const visualDiff = JSON.parse(
      bundle.artifacts.find((artifact) => artifact.kind === 'visual-diff')?.text ?? ''
    ) as VisualDiffGeoJson;
    const afterRoadFeatures = visualDiff.features.filter(
      (feature) =>
        feature.properties.objectId === 'osm2streets-road-proof' &&
        feature.properties.state === 'after'
    );
    expect(afterRoadFeatures).toHaveLength(4);
    expect(afterRoadFeatures.map((feature) => feature.properties.surfaceFunction)).toEqual([
      'driving_lane',
      'bike_lane',
      'sidewalk',
      'median',
    ]);
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

function osmRoad(): OsmRoadFeature {
  return {
    id: 'osm-way-3100',
    osmWayId: 3100,
    tags: { highway: 'residential', name: 'Proof Street' },
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
}

function osm2streetsResult(): Osm2StreetsResult {
  return {
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
