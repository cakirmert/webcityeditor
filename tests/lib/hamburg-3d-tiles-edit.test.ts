import { describe, expect, it } from 'vitest';
import proj4 from 'proj4';
import {
  convertHamburgTileBatchToCityJson,
  convertHamburgTileToCityJson,
  ensureHamburgEditableLodFallback,
  hideHamburgTileBuildings,
  pickHamburgBuildingForEditing,
  pickHamburgBuildingFromTilesForEditing,
  promoteHamburgTileSelectionProxy,
} from '../../src/lib/hamburg-3d-tiles-edit';
import { applyVertexTransform } from '../../src/lib/projection';
import { buildCityJsonMapMesh } from '../../src/lib/cityjson-map-mesh';
import { extractFootprints } from '../../src/lib/footprints';

type NumericArray = { length: number; [index: number]: number };

describe('Hamburg streamed building CityJSON handoff', () => {
  it('isolates a picked batch feature as editable CityJSON and hides only its remote mesh', () => {
    const tile = sampleTile();
    const converted = convertHamburgTileBatchToCityJson(tile, 1);
    expect(converted).not.toBeNull();
    expect(converted!.objectId).toBe('DEHHALKA_TEST_B');
    expect(converted!.sourceLod).toBe(2);

    const object = converted!.document.CityObjects.DEHHALKA_TEST_B;
    expect(object.type).toBe('Building');
    expect(object.attributes).toMatchObject({
      measuredHeight: 12,
      _createdBy: 'hamburg-3d-tiles-handoff',
      _hamburgTileFeatureId: 'DEHHALKA_TEST_B',
      _hamburgTileBatchId: 1,
      _hamburgTileSelectionProxy: true,
      _hamburgTileGeometryOverride: false,
    });
    const geometry = object.geometry![0] as any;
    expect(geometry.type).toBe('MultiSurface');
    expect(geometry.lod).toBe('2');
    expect(geometry.semantics.surfaces[0]).toEqual({ type: 'GroundSurface' });
    expect(geometry.semantics.values[0]).toBe(0);
    expect(geometry.boundaries[0][0]).toHaveLength(4);

    const decoded = converted!.document.vertices.map((vertex) =>
      applyVertexTransform(vertex, converted!.document)
    );
    expect(Math.max(...decoded.map((vertex) => vertex.z))).toBeCloseTo(12, 2);
    expect(Math.min(...decoded.map((vertex) => vertex.z))).toBe(0);

    const centerWgs84 = proj4('EPSG:25832', 'EPSG:4326', [
      average(decoded.map((vertex) => vertex.x)),
      average(decoded.map((vertex) => vertex.y)),
      0,
    ]);
    const project = (coordinate: number[]) => [
      coordinate[0] * 100_000,
      -coordinate[1] * 100_000,
      coordinate[2],
    ];
    const picked = pickHamburgBuildingForEditing(tile, {
      x: centerWgs84[0] * 100_000,
      y: -centerWgs84[1] * 100_000,
      viewport: { project },
    });
    expect(picked?.sourceFeatureId).toBe('DEHHALKA_TEST_B');
    const pickedFromLoadedTiles = pickHamburgBuildingFromTilesForEditing(
      [{ tile, sourceLod: 3, texturesAvailable: true }],
      {
        x: centerWgs84[0] * 100_000,
        y: -centerWgs84[1] * 100_000,
        viewport: { project },
      },
      6
    );
    expect(pickedFromLoadedTiles?.sourceFeatureId).toBe(
      'DEHHALKA_TEST_B'
    );
    expect(pickedFromLoadedTiles?.sourceLod).toBe(3);
    expect(pickedFromLoadedTiles?.texturesAvailable).toBe(true);
    expect(
      pickedFromLoadedTiles?.document.CityObjects.DEHHALKA_TEST_B.attributes
        ?._hamburgTileTexturesAvailable
    ).toBe(true);
    expect(pickedFromLoadedTiles?.screenDistance).toBe(0);
    expect(
      pickHamburgBuildingFromTilesForEditing(
        [{ tile, sourceLod: 2 }],
        {
          x: centerWgs84[0] * 100_000 + 50,
          y: -centerWgs84[1] * 100_000 + 50,
          viewport: { project },
        },
        6
      )
    ).toBeNull();

    const primitive = (tile.content.gltf.scene.nodes[0].mesh as any)
      .primitives[0];
    expect(
      hideHamburgTileBuildings(tile, new Set(['DEHHALKA_TEST_B']))
    ).toBeGreaterThan(0);
    const hiddenPositions = positionsForBatch(primitive, 1);
    expect(new Set(hiddenPositions.map((position) => position.join(':'))).size).toBe(1);
    const visiblePositions = positionsForBatch(primitive, 0);
    expect(new Set(visiblePositions.map((position) => position.join(':'))).size).toBeGreaterThan(1);
  });

  it('promotes a passive Hamburg selection proxy through a child edit', () => {
    const converted = convertHamburgTileBatchToCityJson(sampleTile(), 1)!;
    const building = converted.document.CityObjects.DEHHALKA_TEST_B;
    building.children = ['DEHHALKA_TEST_B-part'];
    converted.document.CityObjects['DEHHALKA_TEST_B-part'] = {
      type: 'BuildingPart',
      parents: ['DEHHALKA_TEST_B'],
      attributes: {},
      geometry: [],
    };

    expect(
      promoteHamburgTileSelectionProxy(
        converted.document,
        'DEHHALKA_TEST_B-part'
      )
    ).toBe('DEHHALKA_TEST_B');
    expect(building.attributes).toMatchObject({
      _hamburgTileSelectionProxy: false,
      _hamburgTileGeometryOverride: true,
    });
  });

  it('keeps LoD2 geometry when a passive edit proxy upgrades to LoD3', () => {
    const tile = sampleTile();
    const lod2 = convertHamburgTileBatchToCityJson(tile, 1, {
      sourceLod: 2,
    })!;
    const lod3 = convertHamburgTileBatchToCityJson(tile, 1, {
      sourceLod: 3,
      texturesAvailable: true,
    })!;
    const replacement = lod3.document.CityObjects.DEHHALKA_TEST_B;

    ensureHamburgEditableLodFallback(
      replacement,
      lod2.document.CityObjects.DEHHALKA_TEST_B,
      3
    );

    expect(
      replacement.geometry?.map((geometry) =>
        String((geometry as { lod?: unknown }).lod)
      )
    ).toEqual(['2', '3']);
    expect(replacement.attributes?._hamburgTileTexturesAvailable).toBe(true);
  });

  it('creates a semantic LoD2 fallback when LoD3 is selected first', () => {
    const converted = convertHamburgTileBatchToCityJson(sampleTile(), 1, {
      sourceLod: 3,
      texturesAvailable: true,
    })!;
    const replacement = converted.document.CityObjects.DEHHALKA_TEST_B;

    ensureHamburgEditableLodFallback(replacement, undefined, 3);

    expect(
      replacement.geometry?.map((geometry) =>
        String((geometry as { lod?: unknown }).lod)
      )
    ).toEqual(['2', '3']);
  });

  it('converts a whole tile to transient CityJSON for the normal footprint and mesh pipeline', () => {
    const tile = sampleTile();
    const converted = convertHamburgTileToCityJson(tile, { sourceLod: 2 });
    expect(converted).not.toBeNull();
    expect(converted!.buildings).toHaveLength(2);
    expect(new Set(converted!.buildings.map((building) => building.objectId)).size).toBe(2);
    expect(
      converted!.buildings.every((building) =>
        building.objectId.startsWith('hamburg-stream:')
      )
    ).toBe(true);
    expect(
      converted!.buildings.map((building) => building.sourceFeatureId)
    ).toEqual(['DEHHALKA_TEST_A', 'DEHHALKA_TEST_B']);

    const footprints = extractFootprints(converted!.document);
    expect(footprints).toHaveLength(2);
    expect(footprints.map((footprint) => footprint.height).sort((a, b) => a - b)).toEqual([
      9,
      12,
    ]);

    const mesh = buildCityJsonMapMesh(converted!.document, {
      maxOutputVertices: 10_000,
      maxLod: 2.9,
      groundObjectGroups: true,
      texturesEnabled: false,
    });
    expect(mesh).not.toBeNull();
    expect(mesh!.objectCount).toBe(2);
    expect(mesh!.triangleCount).toBeGreaterThan(0);
    const colors = new Set<string>();
    for (let index = 0; index < mesh!.colors.length; index += 3) {
      colors.add(
        [
          mesh!.colors[index].toFixed(2),
          mesh!.colors[index + 1].toFixed(2),
          mesh!.colors[index + 2].toFixed(2),
        ].join(':')
      );
    }
    expect(colors.has('0.56:0.23:0.18')).toBe(true);
    expect(colors.has('0.78:0.74:0.67')).toBe(true);
  });
});

function sampleTile() {
  const positions: number[] = [];
  const batchIds: number[] = [];
  appendBox(positions, batchIds, 0, 0, 0, 20, 14, 9, 0);
  appendBox(positions, batchIds, 40, 0, 0, 58, 16, 12, 1);
  return {
    id: 'synthetic-hamburg-tile',
    contentUrl: 'https://example.test/15/1/2.b3dm',
    content: {
      cartesianModelMatrix: eastNorthUpToEcef(9.9937, 53.5511, 0),
      batchTableJson: {
        id: ['DEHHALKA_TEST_A', 'DEHHALKA_TEST_B'],
        attributes: [
          { measuredHeight: 9, Adresse: 'Teststraße 1' },
          { measuredHeight: 12, Adresse: 'Teststraße 2' },
        ],
      },
      gltf: {
        scene: {
          nodes: [
            {
              matrix: identityMatrix(),
              mesh: {
                primitives: [
                  {
                    mode: 4,
                    attributes: {
                      POSITION: { value: new Float64Array(positions) },
                      _BATCHID: { value: new Uint16Array(batchIds) },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };
}

function appendBox(
  positions: number[],
  batchIds: number[],
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  batchId: number
) {
  const vertices = [
    [minX, minY, minZ],
    [maxX, minY, minZ],
    [maxX, maxY, minZ],
    [minX, maxY, minZ],
    [minX, minY, maxZ],
    [maxX, minY, maxZ],
    [maxX, maxY, maxZ],
    [minX, maxY, maxZ],
  ];
  const triangles = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [1, 2, 6], [1, 6, 5],
    [2, 3, 7], [2, 7, 6],
    [3, 0, 4], [3, 4, 7],
  ];
  for (const triangle of triangles) {
    for (const index of triangle) {
      positions.push(...vertices[index]);
      batchIds.push(batchId);
    }
  }
}

function eastNorthUpToEcef(
  longitudeDegrees: number,
  latitudeDegrees: number,
  height: number
): number[] {
  const [tx, ty, tz] = proj4('EPSG:4326', 'EPSG:4978', [
    longitudeDegrees,
    latitudeDegrees,
    height,
  ]);
  const longitude = (longitudeDegrees * Math.PI) / 180;
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const sinLongitude = Math.sin(longitude);
  const cosLongitude = Math.cos(longitude);
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  return [
    -sinLongitude,
    cosLongitude,
    0,
    0,
    -sinLatitude * cosLongitude,
    -sinLatitude * sinLongitude,
    cosLatitude,
    0,
    cosLatitude * cosLongitude,
    cosLatitude * sinLongitude,
    sinLatitude,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function positionsForBatch(
  primitive: any,
  batchId: number
): number[][] {
  const positions = primitive.attributes.POSITION.value as NumericArray;
  const batches = primitive.attributes._BATCHID.value as NumericArray;
  const result: number[][] = [];
  for (let index = 0; index < batches.length; index++) {
    if (batches[index] !== batchId) continue;
    result.push([
      positions[index * 3],
      positions[index * 3 + 1],
      positions[index * 3 + 2],
    ]);
  }
  return result;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
