import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';

function detailDocument(): CityJsonDocument {
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [1, 1, 1], translate: [0, 0, 0] },
    metadata: {
      referenceSystem: 'https://www.opengis.net/def/crs/EPSG/0/25832',
    },
    vertices: [
      [565000, 5935000, 0],
      [565010, 5935000, 0],
      [565000, 5935010, 0],
      [565000, 5935000, 4],
      [565010, 5935000, 4],
      [565010, 5935010, 7],
      [565000, 5935010, 7],
      [565020, 5935000, 0],
      [565030, 5935000, 0],
      [565020, 5935010, 5],
    ],
    CityObjects: {
      detailed: {
        type: 'Building',
        geometry: [
          {
            type: 'MultiSurface',
            lod: '1.0',
            boundaries: [[[0, 1, 2]]],
          },
          {
            type: 'MultiSurface',
            lod: '3.0',
            boundaries: [
              [[3, 4, 5]],
              [[3, 5, 6]],
            ],
            semantics: {
              surfaces: [{ type: 'Window' }, { type: 'RoofSurface' }],
              values: [0, 1],
            },
          },
        ],
      },
      nearby: {
        type: 'Building',
        geometry: [
          {
            type: 'MultiSurface',
            lod: '2.0',
            boundaries: [[[7, 8, 9]]],
          },
        ],
      },
    },
  };
}

describe('CityJSON close-range map mesh', () => {
  it('renders only the highest available geometry for each building', () => {
    const mesh = buildCityJsonMapMesh(detailDocument(), {
      objectIds: new Set(['detailed']),
    });

    expect(mesh).not.toBeNull();
    expect(mesh?.maxLod).toBe(3);
    expect(mesh?.objectCount).toBe(1);
    expect(mesh?.triangleCount).toBe(2);
    expect(mesh?.positions.length).toBe(18);
    expect(mesh?.colors.length).toBe(18);
  });

  it('selects source LoD2 without overlapping the available LoD3 geometry', () => {
    const doc = detailDocument();
    const detailed = doc.CityObjects.detailed.geometry as Array<Record<string, unknown>>;
    detailed.splice(1, 0, {
      type: 'MultiSurface',
      lod: '2.0',
      boundaries: [[[0, 1, 2]]],
    });

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      maxLod: 2.9,
    });

    expect(mesh?.maxLod).toBe(2);
    expect(mesh?.triangleCount).toBe(1);
    expect(mesh?.explicitOpeningSurfaceCount).toBe(0);
  });

  it('builds viewport subsets without rejecting a larger source document', () => {
    const doc = detailDocument();
    doc.vertices.push(...Array.from({ length: 60_000 }, () => [0, 0, 0] as [number, number, number]));

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['nearby']),
      maxOutputVertices: 20,
    });

    expect(mesh).not.toBeNull();
    expect(mesh?.maxLod).toBe(2);
    expect(mesh?.objectCount).toBe(1);
    expect(mesh?.triangleCount).toBe(1);
  });

  it('preserves CityJSON face textures and UV coordinates for the close map view', () => {
    const doc = detailDocument();
    doc.appearance = {
      textures: [{ type: 'JPG', image: '/assets/sample.jpg' }],
      'vertices-texture': [[0, 0], [1, 0], [0, 1]],
    };
    const geometry = doc.CityObjects.detailed.geometry?.[1] as Record<string, unknown>;
    geometry.texture = {
      rgbTexture: {
        values: [
          [[0, 0, 1, 2]],
          [[0, 0, 1, 2]],
        ],
      },
    };

    const mesh = buildCityJsonMapMesh(doc, { objectIds: new Set(['detailed']) });

    expect(mesh?.triangleCount).toBe(2);
    expect(mesh?.indices).toHaveLength(0);
    expect(mesh?.textures).toHaveLength(1);
    expect(mesh?.textures[0].image).toBe('/assets/sample.jpg');
    expect([...mesh!.textures[0].texCoords]).toEqual([
      0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1,
    ]);
  });
});
