import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCityJson } from '../../src/lib/cityjson';
import {
  deriveEditableRoadDraftFromAreas,
  extractTransportationAreas,
} from '../../src/lib/transportation';

const prototypeRoot = resolve(__dirname, '../..');
const scriptPath = resolve(prototypeRoot, 'scripts/osm2streets-lanes-to-cityjson.mjs');

describe('osm2streets-lanes-to-cityjson CLI', () => {
  it('converts osm2streets lane polygons to monolithic CityJSON and CityJSONSeq roads', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'webcityeditor-osm2streets-cityjson-'));
    try {
      const input = resolve(dir, 'lane-polygons.geojson');
      const output = resolve(dir, 'roads.city.json');
      const seqOutput = resolve(dir, 'roads.city.jsonl');
      writeFileSync(input, `${JSON.stringify(lanePolygonsFixture())}\n`);

      execFileSync(
        process.execPath,
        [
          scriptPath,
          '--lanes',
          input,
          '--output',
          output,
          '--seq-output',
          seqOutput,
          '--generated-at',
          '2026-01-01T00:00:00.000Z',
        ],
        { cwd: prototypeRoot, stdio: 'pipe' }
      );

      const doc = JSON.parse(readFileSync(output, 'utf8'));
      expect(doc.type).toBe('CityJSON');
      expect(doc.version).toBe('2.0');
      expect(doc.metadata.referenceSystem).toContain('EPSG/0/25832');
      expect(doc.transform.scale).toEqual([0.001, 0.001, 0.001]);
      expect(Object.keys(doc.CityObjects)).toEqual([
        'osm2streets-road-7',
        'osm2streets-road-9',
      ]);

      const road7 = doc.CityObjects['osm2streets-road-7'];
      expect(road7.type).toBe('Road');
      expect(road7.attributes).toMatchObject({
        _source: 'osm2streets',
        _osm2streetsRoadId: '7',
        _osmWayIds: ['3100'],
        _osm2streetsLaneCount: 4,
      });
      const road7Geometry = road7.geometry[0];
      expect(road7Geometry.boundaries).toHaveLength(4);
      expect(road7Geometry.semantics.values).toEqual([0, 1, 2, 3]);
      expect(road7Geometry.semantics.surfaces.map((surface: any) => surface.function)).toEqual([
        'driving_lane',
        'bike_lane',
        'sidewalk',
        'median',
      ]);
      expect(road7Geometry.semantics.surfaces[1]).toMatchObject({
        type: 'TrafficArea',
        sourceType: 'Biking',
        allowedModes: ['bicycle'],
        osm2streetsRoadId: '7',
        osmWayIds: ['3100'],
      });
      expect(road7Geometry.semantics.surfaces[1].osm2streetsPropertiesJson).toContain(
        '"type":"Biking"'
      );
      expect(road7Geometry.semantics.surfaces[3]).toMatchObject({
        type: 'AuxiliaryTrafficArea',
        function: 'median',
      });

      const parsed = parseCityJson(JSON.stringify(doc));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const areas = extractTransportationAreas(parsed.doc);
      expect(areas).toHaveLength(5);
      expect(areas.filter((area) => area.roadId === 'osm2streets-road-7')).toHaveLength(4);
      expect(
        areas
          .filter((area) => area.roadId === 'osm2streets-road-7')
          .sort((a, b) => a.surfaceIndex - b.surfaceIndex)
          .map((area) => area.attributes.sourceType)
      ).toEqual(['Driving', 'Biking', 'Sidewalk', 'Buffer']);

      const lines = readFileSync(seqOutput, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(lines).toHaveLength(3);
      expect(lines[0]).toMatchObject({
        type: 'CityJSON',
        version: '2.0',
        CityObjects: {},
        vertices: [],
      });
      expect(lines.slice(1).map((line) => line.id)).toEqual([
        'osm2streets-road-7',
        'osm2streets-road-9',
      ]);
      expect(lines[1].vertices).toHaveLength(16);
      expect(lines[2].vertices).toHaveLength(4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves real Hamburg osm2streets lane polygons and metadata after CityJSON import', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'webcityeditor-real-osm2streets-cityjson-'));
    try {
      const input = resolve(
        prototypeRoot,
        'test-fixtures/osm2streets/hamburg-short-intersection-lane-polygons.geojson'
      );
      const output = resolve(dir, 'hamburg-short-intersection.city.json');
      const source = JSON.parse(readFileSync(input, 'utf8'));

      execFileSync(
        process.execPath,
        [
          scriptPath,
          '--lanes',
          input,
          '--output',
          output,
          '--generated-at',
          '2026-07-03T12:00:00.000Z',
          '--source',
          'hamburg-short-intersection real native osm2streets fixture',
        ],
        { cwd: prototypeRoot, stdio: 'pipe' }
      );

      const doc = JSON.parse(readFileSync(output, 'utf8'));
      expect(Object.keys(doc.CityObjects)).toHaveLength(4);
      const surfaces = Object.values(doc.CityObjects).flatMap(
        (object: any) => object.geometry?.[0]?.semantics?.surfaces ?? []
      );
      expect(surfaces).toHaveLength(source.features.length);
      expect(JSON.parse(surfaces[0].osm2streetsPropertiesJson)).toMatchObject({
        road: 0,
        index: 0,
        type: 'Sidewalk',
        osm_way_ids: [3100],
      });
      expect(JSON.parse(surfaces[0].osm2streetsPropertiesJson).muv).toMatchObject({
        is_sidepath: true,
      });

      const parsed = parseCityJson(JSON.stringify(doc));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const importedAreas = extractTransportationAreas(parsed.doc);
      const areasByKey = new Map(importedAreas.map((area) => [areaKey(area), area]));
      expect(areasByKey.size).toBe(source.features.length);

      const editableRoad = deriveEditableRoadDraftFromAreas(
        importedAreas,
        'osm2streets-road-0'
      );
      expect(editableRoad.sections[0].centerlineWgs84).toHaveLength(2);
      expect(editableRoad.sections[0].bands.map((band) => band.kind)).toEqual([
        'sidewalk',
        'median',
        'car_lane',
        'car_lane',
        'median',
        'sidewalk',
      ]);

      for (const feature of source.features) {
        const key = featureKey(feature);
        const area = areasByKey.get(key);
        expect(area, `missing imported CityJSON area for ${key}`).toBeDefined();
        if (!area) continue;
        expect(area.attributes.source).toBe('osm2streets');
        expect(area.attributes.osmWayIds).toEqual(
          feature.properties.osm_way_ids.map((id: number) => String(id))
        );
        expect(area.attributes.sourceType).toBe(feature.properties.type);
        expect(area.attributes.osm2streetsPropertiesJson).toContain(
          `"type":"${feature.properties.type}"`
        );
        expectPolygonToMatch(area.polygon, feature.geometry.coordinates[0]);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('can emit only CityJSONSeq for a disk-efficient local catalog build', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'webcityeditor-osm2streets-seq-only-'));
    try {
      const input = resolve(dir, 'lane-polygons.geojson');
      const skippedOutput = resolve(dir, 'roads.city.json');
      const seqOutput = resolve(dir, 'roads.city.jsonl');
      writeFileSync(input, `${JSON.stringify(lanePolygonsFixture())}\n`);

      execFileSync(
        process.execPath,
        [
          scriptPath,
          '--lanes',
          input,
          '--output',
          skippedOutput,
          '--seq-output',
          seqOutput,
          '--seq-only',
        ],
        { cwd: prototypeRoot, stdio: 'pipe' }
      );

      expect(existsSync(skippedOutput)).toBe(false);
      expect(readFileSync(seqOutput, 'utf8')).toContain('"type":"CityJSONFeature"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function featureKey(feature: any): string {
  return [
    String(feature.properties.road),
    String(feature.properties.index),
    String(feature.properties.type),
  ].join(':');
}

function areaKey(area: ReturnType<typeof extractTransportationAreas>[number]): string {
  return [
    String(area.attributes.osm2streetsRoadId),
    String(area.attributes.osm2streetsLaneIndex),
    String(area.attributes.sourceType),
  ].join(':');
}

function expectPolygonToMatch(actual: [number, number][], expectedOpen: [number, number][]): void {
  const expected = closeRing(expectedOpen);
  expect(actual).toHaveLength(expected.length);
  for (const expectedPoint of expected) {
    const nearest = Math.min(
      ...actual.map((actualPoint) =>
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

function lanePolygonsFixture() {
  return {
    type: 'FeatureCollection',
    features: [
      lane(7, 0, 'Driving', 3.25, 'Forward', 'Kph(30)', [3100]),
      lane(7, 1, 'Biking', 1.75, 'Forward', 'None', [3100]),
      lane(7, 2, 'Sidewalk', 2, 'None', 'None', [3100]),
      lane(7, 3, 'Buffer', 1, 'None', 'None', [3100]),
      lane(9, 0, 'Parking(Parallel)', 2, 'None', 'None', [4100]),
    ],
  };
}

function lane(
  road: number,
  index: number,
  type: string,
  width: number,
  direction: string,
  speed: string,
  osmWayIds: number[]
) {
  const x = 9.992 + road * 0.001 + index * 0.0001;
  const y = 53.549 + road * 0.0001;
  return {
    type: 'Feature',
    properties: {
      road,
      index,
      type,
      width,
      direction,
      speed_limit: speed,
      osm_way_ids: osmWayIds,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [x, y],
          [x + 0.00008, y],
          [x + 0.00008, y + 0.0001],
          [x, y + 0.0001],
          [x, y],
        ],
      ],
    },
  };
}
