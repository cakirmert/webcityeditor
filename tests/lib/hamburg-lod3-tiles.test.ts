import { describe, expect, it } from 'vitest';
import { groundHamburgLod3Tile } from '../../src/lib/hamburg-lod3-tiles';

describe('official Hamburg LoD3 tile grounding', () => {
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
});
