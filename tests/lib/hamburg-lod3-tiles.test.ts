import { describe, expect, it } from 'vitest';
import {
  groundHamburgLod3Tile,
  hamburgLod3TilesetUrl,
  HAMBURG_LOD1_TILESET_URL,
  HAMBURG_LOD2_TILESET_URL,
  HAMBURG_LOD3_TEXTURED_TILESET_URL,
  HAMBURG_LOD3_UNTEXTURED_TILESET_URL,
  HAMBURG_SEMANTIC_ROOF_COLOR,
  releaseHamburgTileDecodedImages,
  sRgbByteToLinear,
  styleHamburgBuildingTile,
} from '../../src/lib/hamburg-lod3-tiles';

describe('official Hamburg LoD3 tile sources', () => {
  it('exposes the official Hamburg citywide LoD1 overview tileset', () => {
    expect(HAMBURG_LOD1_TILESET_URL).toBe(
      'https://daten-hamburg.de/gdi3d/datasource-data/LoD1/tileset.json'
    );
  });

  it('exposes the official Hamburg citywide LoD2 tileset', () => {
    expect(HAMBURG_LOD2_TILESET_URL).toBe(
      'https://daten-hamburg.de/gdi3d/datasource-data/LoD2/tileset.json'
    );
  });

  it('uses full untextured LoD3 geometry before the texture opt-in', () => {
    expect(hamburgLod3TilesetUrl(false)).toBe(
      HAMBURG_LOD3_UNTEXTURED_TILESET_URL
    );
    expect(hamburgLod3TilesetUrl(true)).toBe(
      HAMBURG_LOD3_TEXTURED_TILESET_URL
    );
    expect(HAMBURG_LOD3_UNTEXTURED_TILESET_URL).not.toBe(
      HAMBURG_LOD3_TEXTURED_TILESET_URL
    );
  });
});

describe('official Hamburg LoD3 tile grounding', () => {
  it('releases decoded texture atlases exactly once when a tile unloads', () => {
    let closeCalls = 0;
    const tile = {
      content: {
        gltf: {
          images: [
            { image: { close: () => closeCalls++ } },
            { image: {} },
          ],
        },
      },
    };

    expect(releaseHamburgTileDecodedImages(tile)).toBe(2);
    expect(closeCalls).toBe(1);
    expect(tile.content.gltf.images).toEqual([
      { image: null },
      { image: null },
    ]);
    expect(releaseHamburgTileDecodedImages(tile)).toBe(0);
    expect(closeCalls).toBe(1);
  });

  it('uses each batch feature surveyed ground height without changing roof height', () => {
    const positions = new Float32Array([
      0, 5.25, 0,
      1, 15.25, 1,
      2, 8.5, 2,
      3, 20.5, 3,
    ]);
    const tile = {
      content: {
        batchTableJson: {
          attributes: [
            { 'Grundhöhe NN': 5.25 },
            { Grundhoehe: 8.5 },
          ],
        },
        gltf: {
          meshes: [{
            primitives: [{
              attributes: {
                POSITION: { value: positions },
                _BATCHID: { value: new Float32Array([0, 0, 1, 1]) },
              },
            }],
          }],
        },
      },
    };

    expect(groundHamburgLod3Tile(tile)).toEqual({
      featureCount: 2,
      shiftedVertexCount: 4,
    });
    expect([...positions]).toEqual([
      0, 0, 0,
      1, 10, 1,
      2, 0, 2,
      3, 12, 3,
    ]);
    expect(groundHamburgLod3Tile(tile)).toEqual({
      featureCount: 0,
      shiftedVertexCount: 0,
    });
  });

  it('falls back to the minimum feature vertex when metadata is missing', () => {
    const positions = new Float32Array([
      0, 12, 0,
      1, 18, 1,
      2, 14, 2,
    ]);
    const tile = {
      gltf: {
        meshes: [{
          primitives: [{
            attributes: {
              POSITION: { value: positions },
              _BATCHID: { value: new Float32Array([4, 4, 4]) },
            },
          }],
        }],
      },
    };

    expect(groundHamburgLod3Tile(tile)).toEqual({
      featureCount: 1,
      shiftedVertexCount: 3,
    });
    expect([...positions]).toEqual([0, 0, 0, 1, 6, 1, 2, 2, 2]);
  });

  it('restores semantic roof, wall, and ground colors on neutral b3dm meshes', () => {
    const material = {
      id: 'material-0',
      pbrMetallicRoughness: {
        baseColorFactor: [0.82, 0.82, 0.82, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    };
    const primitive = {
      mode: 4,
      attributes: {
        POSITION: {
          value: new Float32Array([
            0, 5, 0, 1, 5, 0, 0, 5, 1,
            0, 0, 0, 0, 4, 0, 0, 0, 1,
            0, 0, 0, 0, 0, 1, 1, 0, 0,
          ]),
        },
        NORMAL: {
          value: new Float32Array([
            0, 1, 0, 0, 1, 0, 0, 1, 0,
            1, 0, 0, 1, 0, 0, 1, 0, 0,
            0, -1, 0, 0, -1, 0, 0, -1, 0,
          ]),
        },
        _BATCHID: { value: new Float32Array(9).fill(0) },
      },
      indices: { value: new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8]) },
      material,
    };
    const tile = {
      batchTableJson: {
        attributes: [{ function: '31001_1000' }],
      },
      gltf: { meshes: [{ primitives: [primitive] }] },
    };
    const usageTile = structuredClone(tile);

    expect(styleHamburgBuildingTile(tile, 'roof')).toMatchObject({
      primitiveCount: 1,
      coloredVertexCount: 9,
      roofTriangleCount: 1,
      wallTriangleCount: 1,
      groundTriangleCount: 1,
    });
    const semanticPrimitives = tile.gltf.meshes[0].primitives;
    expect(semanticPrimitives).toHaveLength(3);
    expect(
      semanticPrimitives.every((value) => value.material?.id !== material.id)
    ).toBe(true);
    expect(
      semanticPrimitives.every(
        (value) =>
          (value.material as { unlit?: boolean } | undefined)?.unlit === true
      )
    ).toBe(true);
    expect(
      semanticPrimitives.map(
        (value) => value.material?.pbrMetallicRoughness?.baseColorFactor
      )
    ).toEqual(
      expect.arrayContaining([
        [...HAMBURG_SEMANTIC_ROOF_COLOR, 1],
        [
          sRgbByteToLinear(235),
          sRgbByteToLinear(220),
          sRgbByteToLinear(194),
          1,
        ],
        [
          sRgbByteToLinear(110),
          sRgbByteToLinear(104),
          sRgbByteToLinear(95),
          1,
        ],
      ])
    );
    expect(
      semanticPrimitives.map((value) => [
        ...(value.indices?.value ?? []),
      ])
    ).toEqual(
      expect.arrayContaining([
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ])
    );
    expect(material.pbrMetallicRoughness.baseColorFactor).toEqual([
      0.82, 0.82, 0.82, 1,
    ]);

    expect(styleHamburgBuildingTile(usageTile, 'usage')).toMatchObject({
      primitiveCount: 1,
      coloredVertexCount: 9,
    });
    expect(usageTile.gltf.meshes[0].primitives).toHaveLength(1);
    expect(
      usageTile.gltf.meshes[0].primitives[0].material
        ?.pbrMetallicRoughness?.baseColorFactor
    ).toEqual([
      expect.closeTo(sRgbByteToLinear(240)),
      expect.closeTo(sRgbByteToLinear(220)),
      expect.closeTo(sRgbByteToLinear(60)),
      1,
    ]);
  });
});
