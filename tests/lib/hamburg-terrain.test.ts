import { describe, expect, it } from 'vitest';
import {
  geographicTileBounds,
  hamburgTerrainSurfaceUrl,
  hamburgTerrainTilesForView,
  sampleHamburgTerrainElevation,
  terrainTextureCoordinates,
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

  it('builds terrain imagery URLs in each service axis order', () => {
    const [descriptor] = hamburgTerrainTilesForView([9.9899, 53.5499, 9.9901, 53.5501], 17);
    const topPlus = new URL(hamburgTerrainSurfaceUrl(descriptor, 'topplus'));
    const satellite = new URL(hamburgTerrainSurfaceUrl(descriptor, 'satellite'));
    const [west, south, east, north] = descriptor.bounds;

    expect(topPlus.searchParams.get('BBOX')).toBe(`${south},${west},${north},${east}`);
    expect(satellite.searchParams.get('bbox')).toBe(`${west},${south},${east},${north}`);
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
      texCoords: new Float32Array([0, 0, 1, 0, 0, 1]),
      minElevation: 7.25,
      maxElevation: 11.25,
    };

    expect(sampleHamburgTerrainElevation([tile], [10, 53.5])).toBe(7.25);
  });

  it('maps south-up quantized-mesh coordinates onto north-up map images', () => {
    const source = new Float32Array([0, 0, 0.25, 0.4, 1, 1]);
    const mapped = terrainTextureCoordinates(source);

    expect([mapped[0], mapped[1], mapped[2], mapped[4], mapped[5]]).toEqual([
      0, 1, 0.25, 1, 0,
    ]);
    expect(mapped[3]).toBeCloseTo(0.6);
    expect(source[3]).toBeCloseTo(0.4);
  });
});
