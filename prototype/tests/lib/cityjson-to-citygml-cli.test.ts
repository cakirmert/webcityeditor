import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const converter = path.resolve('..', 'tools', 'citygml-tools-2.4.0', 'citygml-tools.bat');

describe('cityjson-to-citygml CLI', () => {
  it.skipIf(!existsSync(converter))(
    'converts a CityJSON Road into schema-valid CityGML 3 Transportation XML',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'webcityeditor-citygml-'));
      const input = path.join(dir, 'road.city.json');
      writeFileSync(input, JSON.stringify(roadCityJson()), 'utf8');

      const output = execFileSync(
        process.execPath,
        [
          path.resolve('scripts/cityjson-to-citygml.mjs'),
          input,
          '--output-dir',
          dir,
          '--require-road',
        ],
        { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
      );
      const summary = JSON.parse(output);

      expect(summary.cityjson).toMatchObject({
        cityObjects: 1,
        roads: 1,
        vertices: 8,
      });
      expect(summary.citygml).toMatchObject({
        roads: 1,
        trafficAreas: 2,
        polygons: 2,
        hasTransportationNamespace: true,
      });
      expect(summary.validation).toEqual({ ran: true, ok: true });
      expect(summary.output).toBe(path.join(dir, 'road.city.gml'));

      const xml = readFileSync(summary.output, 'utf8');
      expect(xml).toContain('<tran:Road gml:id="road-fixture">');
      expect(xml).toContain('<tran:TrafficArea>');
      expect(xml).toContain('<tran:AuxiliaryTrafficArea>');
      expect(xml).toContain('srsName="https://www.opengis.net/def/crs/EPSG/0/25832"');
      expect(xml).toContain('<tran:function>bike_lane</tran:function>');
      expect(xml).toContain('<tran:function>median</tran:function>');
    },
    30_000
  );
});

function roadCityJson() {
  return {
    type: 'CityJSON',
    version: '2.0',
    metadata: {
      referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    },
    transform: {
      scale: [0.001, 0.001, 0.001],
      translate: [565000, 5935000, 0],
    },
    CityObjects: {
      'road-fixture': {
        type: 'Road',
        attributes: {
          class: 'transportation',
          function: 'road',
          name: 'Fixture Street',
        },
        geometry: [
          {
            type: 'MultiSurface',
            lod: '2',
            boundaries: [
              [[0, 1, 2, 3]],
              [[4, 5, 6, 7]],
            ],
            semantics: {
              surfaces: [
                { type: 'TrafficArea', function: 'bike_lane' },
                { type: 'AuxiliaryTrafficArea', function: 'median' },
              ],
              values: [0, 1],
            },
          },
        ],
      },
    },
    vertices: [
      [0, 0, 0],
      [8000, 0, 0],
      [8000, 2500, 0],
      [0, 2500, 0],
      [0, 3000, 0],
      [8000, 3000, 0],
      [8000, 4000, 0],
      [0, 4000, 0],
    ],
  };
}
