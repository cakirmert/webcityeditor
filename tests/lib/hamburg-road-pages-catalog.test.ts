import { afterEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const projectRoot = resolve('.');
const scriptPath = resolve(
  projectRoot,
  'scripts/build-hamburg-road-pages-catalog.mjs'
);
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('Hamburg road Pages catalog packaging', () => {
  it('retiles complete CityJSONSeq roads into relative 1 km gzip tiles', () => {
    const root = mkdtempSync(join(tmpdir(), 'hamburg-road-pages-'));
    temporaryDirectories.push(root);
    const inputDirectory = join(root, 'input');
    const outputDirectory = join(root, 'output');
    mkdirSync(inputDirectory, { recursive: true });

    const sourceTransform = {
      scale: [0.001, 0.001, 0.001],
      translate: [565000, 5936000, 0],
    };
    const featureA = roadFeature('road-a', [
      [100, 200, 0],
      [900, 200, 0],
      [900, 700, 0],
    ]);
    const featureB = roadFeature('road-b', [
      [1200100, 1100200, 0],
      [1200900, 1100200, 0],
      [1200900, 1100700, 0],
    ]);
    const sourceFile = 'source.city.jsonl';
    writeFileSync(
      join(inputDirectory, sourceFile),
      [
        JSON.stringify({
          type: 'CityJSON',
          version: '2.0',
          CityObjects: {},
          vertices: [],
          transform: sourceTransform,
          metadata: {
            referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
          },
        }),
        JSON.stringify(featureA),
        JSON.stringify(featureB),
        '',
      ].join('\n'),
      'utf8'
    );
    writeFileSync(
      join(inputDirectory, 'catalog.json'),
      `${JSON.stringify(
        {
          type: 'HamburgOsm2StreetsRoadCityJSONSeqCatalog',
          generatedAt: '2026-07-14T19:05:00.000Z',
          crs: 'EPSG:25832',
          summary: {
            tiles: 1,
            empty: 0,
            failed: 0,
            features: 2,
          },
          tiles: [{ id: 'source', file: sourceFile }],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--input-dir',
        inputDirectory,
        '--output-dir',
        outputDirectory,
        '--generated-at',
        '2026-07-29T00:00:00.000Z',
      ],
      { cwd: projectRoot, encoding: 'utf8' }
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const catalog = JSON.parse(
      readFileSync(join(outputDirectory, 'catalog.json'), 'utf8')
    );
    expect(catalog.summary).toMatchObject({
      tiles: 2,
      failed: 0,
      features: 2,
      cityObjects: 2,
      vertices: 6,
    });
    expect(catalog.tiles).toHaveLength(2);
    expect(
      catalog.tiles.every(
        (tile: { url: string; compressedBytes: number; uncompressedBytes: number }) =>
          tile.url.startsWith('tiles/') &&
          tile.url.endsWith('.city.jsonl.gz') &&
          tile.compressedBytes > 0 &&
          tile.uncompressedBytes > tile.compressedBytes
      )
    ).toBe(true);

    const decoded = catalog.tiles.map(
      (tile: { file: string }) =>
        gunzipSync(readFileSync(join(outputDirectory, tile.file))).toString('utf8')
    );
    const parsed: Array<Array<Record<string, any>>> = decoded.map((text: string) =>
      text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
    );
    const reconstructed: Array<{ id: string; vertices: number[][] }> = parsed
      .map(([header, feature]) => ({
        id: String(feature.id),
        vertices: feature.vertices.map(
          (vertex: number[]) =>
            vertex.map(
              (coordinate, axis) =>
                coordinate * header.transform.scale[axis] +
                header.transform.translate[axis]
            )
        ),
      }))
      .sort(
        (
          left: { id: string; vertices: number[][] },
          right: { id: string; vertices: number[][] }
        ) => left.id.localeCompare(right.id)
      );

    expect(reconstructed).toEqual([
      {
        id: 'road-a',
        vertices: [
          [565000.1, 5936000.2, 0],
          [565000.9, 5936000.2, 0],
          [565000.9, 5936000.7, 0],
        ],
      },
      {
        id: 'road-b',
        vertices: [
          [566200.1, 5937100.2, 0],
          [566200.9, 5937100.2, 0],
          [566200.9, 5937100.7, 0],
        ],
      },
    ]);
  });

  it('records exact cross-tile dependencies for native MapEdge seam pairs', () => {
    const root = mkdtempSync(join(tmpdir(), 'hamburg-road-pages-seams-'));
    temporaryDirectories.push(root);
    const inputDirectory = join(root, 'input');
    const outputDirectory = join(root, 'output');
    mkdirSync(inputDirectory, { recursive: true });
    const sourceFile = 'source.city.jsonl';
    const westId = 'network-west-osm2streets-road-1';
    const eastId = 'network-east-osm2streets-road-8';
    const sharedSeam = [10, 53.55];
    const featureWest = roadFeature(
      westId,
      [
        [100, 200, 0],
        [900, 200, 0],
        [900, 700, 0],
      ],
      {
        _sourceCenterlineWgs84: [[9.999, 53.55], [9.9999, 53.55]],
        _sourceMapEdgeEndpointsWgs84: { end: sharedSeam },
        _osmWayIds: ['3100'],
      }
    );
    const featureEast = roadFeature(
      eastId,
      [
        [3100100, 200, 0],
        [3100900, 200, 0],
        [3100900, 700, 0],
      ],
      {
        _sourceCenterlineWgs84: [[10.0001, 53.55], [10.001, 53.55]],
        _sourceMapEdgeEndpointsWgs84: { start: sharedSeam },
        _osmWayIds: ['3100'],
      }
    );
    writeFileSync(
      join(inputDirectory, sourceFile),
      [
        JSON.stringify({
          type: 'CityJSON',
          version: '2.0',
          CityObjects: {},
          vertices: [],
          transform: {
            scale: [0.001, 0.001, 0.001],
            translate: [565000, 5936000, 0],
          },
          metadata: {
            referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
          },
        }),
        JSON.stringify(featureWest),
        JSON.stringify(featureEast),
        '',
      ].join('\n'),
      'utf8'
    );
    writeFileSync(
      join(inputDirectory, 'catalog.json'),
      `${JSON.stringify({
        type: 'HamburgOsm2StreetsRoadCityJSONSeqCatalog',
        generatedAt: '2026-07-14T19:05:00.000Z',
        crs: 'EPSG:25832',
        summary: {
          tiles: 1,
          empty: 0,
          failed: 0,
          features: 2,
        },
        tiles: [{ id: 'source', file: sourceFile }],
      })}\n`,
      'utf8'
    );

    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--input-dir',
        inputDirectory,
        '--output-dir',
        outputDirectory,
        '--generated-at',
        '2026-07-29T00:00:00.000Z',
      ],
      { cwd: projectRoot, encoding: 'utf8' }
    );
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const catalog = JSON.parse(
      readFileSync(join(outputDirectory, 'catalog.json'), 'utf8')
    );
    expect(catalog.packaging.sourceSeams).toEqual({
      junctions: 1,
      crossTileJunctions: 1,
      dependencyLinks: 1,
      maxReferenceDistanceM: 0.5,
      maxInwardDot: -0.8,
    });
    expect(catalog.tiles).toHaveLength(2);
    expect(catalog.tiles[0].dependencies).toEqual([catalog.tiles[1].id]);
    expect(catalog.tiles[1].dependencies).toEqual([catalog.tiles[0].id]);
  });
});

function roadFeature(
  id: string,
  vertices: number[][],
  attributes: Record<string, unknown> = {}
) {
  return {
    type: 'CityJSONFeature',
    id,
    CityObjects: {
      [id]: {
        type: 'Road',
        attributes: { _source: 'osm2streets', ...attributes },
        geometry: [
          {
            type: 'MultiSurface',
            lod: '2',
            boundaries: [[[0, 1, 2]]],
          },
        ],
      },
    },
    vertices,
  };
}
