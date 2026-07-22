import { describe, expect, it } from 'vitest';
import {
  geographicTileBounds,
  hamburgTerrainTilesForView,
  sampleHamburgTerrainElevation,
  type HamburgTerrainTile,
} from '../../src/lib/hamburg-terrain';

describe('Hamburg quantized-mesh terrain', () => {
  it('resolves geographic TMS tiles at the close-view source level', () => {
    const [tile] = hamburgTerrainTilesForView([9.9899, 53.5499, 9.9901, 53.5501], 17);

    expect(tile.key).toBe('16/69173/52264');
    expect(tile.bounds).toEqual(geographicTileBounds(16, 69173, 52264));
    expect(tile.bounds[0]).toBeLessThanOrEqual(9.99);
    expect(tile.bounds[2]).toBeGreaterThan(9.99);
    expect(tile.url).toContain('/Gelaende/16/69173/52264.terrain?v=');
  });

  it('samples the closest terrain vertex in the shared absolute datum', () => {
    const tile: HamburgTerrainTile = {
      descriptor: {
        key: 'test',
        level: 0,
        x: 0,
        y: 0,
        bounds: [9.9, 53.4, 10.1, 53.6],
        url: 'test.terrain',
      },
      anchorLngLat: [10, 53.5],
      positions: new Float32Array([
        0, 0, 7.25,
        100, 0, 9.5,
        0, 100, 11.25,
      ]),
      indices: new Uint16Array([0, 1, 2]),
      minElevation: 7.25,
      maxElevation: 11.25,
    };

    expect(sampleHamburgTerrainElevation([tile], [10, 53.5])).toBe(7.25);
  });
});
