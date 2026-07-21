import { describe, expect, it } from 'vitest';
import type { CityJsonDocument } from '../../src/types';
import {
  buildCityJsonMapMesh,
  canonicalCityJsonMapOrigin,
} from '../../src/lib/cityjson-map-mesh';

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

  it('uses nearest-first object selection order before applying the vertex cap', () => {
    const doc = detailDocument();
    doc.CityObjects = {
      nearby: doc.CityObjects.nearby,
      detailed: doc.CityObjects.detailed,
    };

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed', 'nearby']),
      maxOutputVertices: 6,
      texturesEnabled: false,
    });

    expect(mesh?.objectCount).toBe(1);
    expect(mesh?.maxLod).toBe(3);
    expect(mesh?.triangleCount).toBe(2);
    expect(mesh?.truncated).toBe(true);
    expect(mesh?.droppedObjectCount).toBe(1);
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

  it('keeps a LoD3-only edited building visible in the middle zoom tier', () => {
    const doc = detailDocument();
    doc.CityObjects.detailed.geometry = [doc.CityObjects.detailed.geometry![1]];

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      maxLod: 2.9,
    });

    expect(mesh?.maxLod).toBe(3);
    expect(mesh?.objectCount).toBe(1);
    expect(mesh?.triangleCount).toBe(2);
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

  it('converts lower-left CityJSON UVs to browser image coordinates', () => {
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
    expect(mesh?.surfaceCount).toBe(2);
    expect(mesh?.availableTexturedSurfaceCount).toBe(2);
    expect(mesh?.texturedSurfaceCount).toBe(2);
    expect(mesh?.textures[0].image).toBe('/assets/sample.jpg');
    expect([...mesh!.textures[0].texCoords]).toEqual([
      0, 1, 1, 1, 0, 0,
      0, 1, 1, 1, 0, 0,
    ]);
  });

  it('keeps textured LoD3 faces but renders them with semantic colours when textures are off', () => {
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

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      texturesEnabled: false,
    });

    expect(mesh?.maxLod).toBe(3);
    expect(mesh?.triangleCount).toBe(2);
    expect(mesh?.textures).toHaveLength(0);
    expect(mesh?.indices).toHaveLength(6);
    expect(mesh?.surfaceCount).toBe(2);
    expect(mesh?.availableTexturedSurfaceCount).toBe(2);
    expect(mesh?.texturedSurfaceCount).toBe(0);
    expect(mesh?.explicitOpeningSurfaceCount).toBe(1);
  });

  it('keeps one canonical anchor across viewport subsets, LoDs, and texture states', () => {
    const doc = detailDocument();
    const detailed = doc.CityObjects.detailed.geometry as Array<Record<string, unknown>>;
    detailed.splice(1, 0, {
      type: 'MultiSurface',
      lod: '2.0',
      boundaries: [[[0, 1, 2]]],
    });
    doc.appearance = {
      textures: [{ type: 'JPG', image: '/assets/sample.jpg' }],
      'vertices-texture': [[0, 0], [1, 0], [0, 1]],
    };
    detailed[2].texture = {
      rgbTexture: { values: [[[0, 0, 1, 2]], [[0, 0, 1, 2]]] },
    };

    const origin = canonicalCityJsonMapOrigin(doc)!;
    const lod2 = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      maxLod: 2.9,
      originProjected: origin,
      groundObjectGroups: true,
    })!;
    const lod3Semantic = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      maxLod: 3.9,
      originProjected: origin,
      groundObjectGroups: true,
      texturesEnabled: false,
    })!;
    const lod3Textured = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed']),
      maxLod: 3.9,
      originProjected: origin,
      groundObjectGroups: true,
      texturesEnabled: true,
    })!;
    const otherSubset = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['nearby']),
      originProjected: origin,
      groundObjectGroups: true,
    })!;

    for (const mesh of [lod2, lod3Semantic, lod3Textured, otherSubset]) {
      expect(mesh.originProjected).toEqual([origin[0], origin[1], 0]);
      expect(mesh.anchorLngLat).toEqual(lod2.anchorLngLat);
    }
    expect(lod3Semantic.objectAnchors).toEqual(lod3Textured.objectAnchors);
    expect(lod3Semantic.triangleCount).toBe(lod3Textured.triangleCount);
    expect(lod3Semantic.surfaceCount).toBe(lod3Textured.surfaceCount);
    expect([...lod3Textured.textures[0].positions]).toEqual([...lod3Semantic.positions]);
  });

  it('normalizes every LoD tier to the same ground without vertical jumps', () => {
    const doc = detailDocument();
    doc.vertices = [
      [565000, 5935000, 10],
      [565010, 5935000, 10],
      [565000, 5935010, 15],
      [565000, 5935000, 12],
      [565010, 5935000, 12],
      [565000, 5935010, 17],
    ];
    doc.CityObjects = {
      stable: {
        type: 'Building',
        geometry: [
          { type: 'MultiSurface', lod: '2', boundaries: [[[0, 1, 2]]] },
          { type: 'MultiSurface', lod: '3', boundaries: [[[3, 4, 5]]] },
        ],
      },
    };
    const origin = canonicalCityJsonMapOrigin(doc)!;
    const lod2 = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['stable']),
      maxLod: 2.9,
      originProjected: origin,
      groundObjectGroups: true,
    })!;
    const lod3 = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['stable']),
      maxLod: 3.9,
      originProjected: origin,
      groundObjectGroups: true,
    })!;
    const xyz2 = [...lod2.positions];
    const xyz3 = [...lod3.positions];

    expect(xyz2.filter((_, index) => index % 3 !== 2)).toEqual(
      xyz3.filter((_, index) => index % 3 !== 2)
    );
    expect(xyz2.filter((_, index) => index % 3 === 2)).toEqual([0, 0, 5]);
    expect(xyz3.filter((_, index) => index % 3 === 2)).toEqual([0, 0, 5]);
    expect(lod2.objectAnchors).toEqual(lod3.objectAnchors);
  });

  it('clamps every LoD tier to one explicit terrain elevation', () => {
    const doc = detailDocument();
    doc.vertices = [
      [565000, 5935000, 10],
      [565010, 5935000, 10],
      [565000, 5935010, 15],
      [565000, 5935000, 12],
      [565010, 5935000, 12],
      [565000, 5935010, 17],
    ];
    doc.CityObjects = {
      stable: {
        type: 'Building',
        geometry: [
          { type: 'MultiSurface', lod: '2', boundaries: [[[0, 1, 2]]] },
          { type: 'MultiSurface', lod: '3', boundaries: [[[3, 4, 5]]] },
        ],
      },
    };
    const options = {
      objectIds: new Set(['stable']),
      groundElevationByObject: new Map([['stable', 6.5]]),
      originProjected: canonicalCityJsonMapOrigin(doc)!,
    };
    const lod2 = buildCityJsonMapMesh(doc, { ...options, maxLod: 2.9 })!;
    const lod3 = buildCityJsonMapMesh(doc, { ...options, maxLod: 3.9 })!;

    expect([...lod2.positions].filter((_, index) => index % 3 === 2)).toEqual([6.5, 6.5, 11.5]);
    expect([...lod3.positions].filter((_, index) => index % 3 === 2)).toEqual([6.5, 6.5, 11.5]);
    expect(lod2.originProjected[2]).toBe(0);
    expect(lod2.objectAnchors[0].projected[2]).toBe(6.5);
  });

  it('reports roots, installations, LoDs, and surfaces from the geometry actually drawn', () => {
    const doc = detailDocument();
    doc.CityObjects.detailed.children = ['detail-installation'];
    doc.CityObjects['detail-installation'] = {
      type: 'BuildingInstallation',
      parents: ['detailed'],
      geometry: [{ type: 'MultiSurface', lod: '3', boundaries: [[[0, 1, 2]]] }],
    };

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detailed', 'detail-installation']),
      maxLod: 3.9,
      texturesEnabled: false,
    })!;

    expect(mesh.rootObjectCount).toBe(1);
    expect(mesh.objectCount).toBe(2);
    expect(mesh.installationObjectCount).toBe(1);
    expect(mesh.objectCountByLod).toEqual({ '3': 2 });
    expect(mesh.surfaceCount).toBe(3);
    expect(mesh.truncated).toBe(false);
  });

  it('keeps a new untextured LoD3 building beside textured imported neighbors', () => {
    const doc = detailDocument();
    doc.vertices.push(
      [565040, 5935000, 0],
      [565050, 5935000, 0],
      [565040, 5935010, 6]
    );
    doc.CityObjects.created = {
      type: 'Building',
      attributes: { _createdBy: 'webcityeditor' },
      geometry: [{ type: 'MultiSurface', lod: '3', boundaries: [[[10, 11, 12]]] }],
    };
    doc.appearance = {
      textures: [{ type: 'JPG', image: '/assets/imported.jpg' }],
      'vertices-texture': [[0, 0], [1, 0], [0, 1]],
    };
    const importedGeometry = doc.CityObjects.detailed.geometry?.[1] as Record<string, unknown>;
    importedGeometry.texture = {
      rgbTexture: { values: [[[0, 0, 1, 2]], [[0, 0, 1, 2]]] },
    };
    const objectIds = new Set(['created', 'detailed']);

    const textured = buildCityJsonMapMesh(doc, {
      objectIds,
      maxLod: 3.9,
      texturesEnabled: true,
    })!;
    const semantic = buildCityJsonMapMesh(doc, {
      objectIds,
      maxLod: 3.9,
      texturesEnabled: false,
    })!;

    expect(textured.objectCount).toBe(2);
    expect(textured.textures).toHaveLength(1);
    expect(textured.indices).toHaveLength(3);
    expect(textured.triangleCount).toBe(semantic.triangleCount);
    expect(textured.objectAnchors).toEqual(semantic.objectAnchors);
    expect(textured.objectCountByLod).toEqual({ '3': 2 });
  });

  it('can colour close-range geometry by the root building usage', () => {
    const doc = detailDocument();
    doc.CityObjects.detailed.children = ['detail-installation'];
    doc.CityObjects['detail-installation'] = {
      type: 'BuildingInstallation',
      parents: ['detailed'],
      geometry: [{ type: 'MultiSurface', lod: '3', boundaries: [[[0, 1, 2]]] }],
    };
    const usageColor = [240 / 255, 220 / 255, 60 / 255] as const;

    const mesh = buildCityJsonMapMesh(doc, {
      objectIds: new Set(['detail-installation']),
      objectColors: new Map([['detailed', usageColor]]),
      texturesEnabled: false,
    });

    expect(mesh).not.toBeNull();
    expect(mesh!.colors).toHaveLength(9);
    [...mesh!.colors].forEach((value, index) => {
      expect(value).toBeCloseTo(usageColor[index % 3]);
    });
  });

  it('grounds each root object group independently on a flat map', () => {
    const doc = detailDocument();
    doc.vertices = [
      [565000, 5935000, 10],
      [565010, 5935000, 10],
      [565000, 5935010, 15],
      [565020, 5935000, 20],
      [565030, 5935000, 20],
      [565020, 5935010, 26],
      [565002, 5935002, 23],
      [565004, 5935002, 23],
      [565002, 5935004, 25],
    ];
    doc.CityObjects = {
      first: {
        type: 'Building',
        children: ['roof-installation'],
        geometry: [{ type: 'MultiSurface', lod: '2', boundaries: [[[0, 1, 2]]] }],
      },
      'roof-installation': {
        type: 'BuildingInstallation',
        parents: ['first'],
        geometry: [{ type: 'MultiSurface', lod: '2', boundaries: [[[6, 7, 8]]] }],
      },
      second: {
        type: 'Building',
        geometry: [{ type: 'MultiSurface', lod: '2', boundaries: [[[3, 4, 5]]] }],
      },
    };

    const mesh = buildCityJsonMapMesh(doc, { groundObjectGroups: true });
    const z = [...mesh!.positions].filter((_, index) => index % 3 === 2);

    expect(mesh?.originProjected[2]).toBe(0);
    expect(z).toEqual([0, 0, 5, 13, 13, 15, 0, 0, 6]);
  });
});
