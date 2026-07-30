import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CATALOG_PATH = 'public/data/hamburg/buildings/catalog.json';

describe('Hamburg citywide LoD0 footprint catalog', () => {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

  it('packages the official ALKIS footprint and usage coverage compactly', () => {
    expect(catalog).toMatchObject({
      format: 'mvt',
      layer: 'buildings',
      featureCount: 453_216,
      minZoom: 8,
      rasterMaxZoom: 11,
      vectorMinZoom: 12,
      maxZoom: 14,
      rasterTileCount: 123,
      vectorTileCount: 5_116,
    });
    expect(
      Object.values(catalog.usageCounts as Record<string, number>).reduce(
        (sum, count) => sum + count,
        0
      )
    ).toBe(catalog.featureCount);
    expect(catalog.totalBytes).toBeLessThan(50 * 1024 * 1024);
  });

  it('contains both a browser-light overview tile and a non-empty vector tile', () => {
    const raster = readFileSync(
      'public/data/hamburg/buildings/raster/10/540/330.png'
    );
    const vector = readFileSync(
      'public/data/hamburg/buildings/tiles/12/2161/1323.pbf'
    );

    expect([...raster.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(vector.byteLength).toBeGreaterThan(100_000);
  });
});
