import { describe, expect, it } from 'vitest';
import { basemapLayerComposition } from '../../src/lib/basemap';

describe('basemap layer composition', () => {
  it('removes inactive imagery from the raster stack', () => {
    expect(basemapLayerComposition('topplus', 0.82)).toEqual({
      topplusVisibility: 'visible',
      satelliteVisibility: 'none',
      satelliteOpacity: 0.82,
    });
    expect(basemapLayerComposition('satellite', 0.82)).toEqual({
      topplusVisibility: 'none',
      satelliteVisibility: 'visible',
      satelliteOpacity: 0.82,
    });
  });

  it('clamps satellite opacity to a valid paint value', () => {
    expect(basemapLayerComposition('satellite', 2).satelliteOpacity).toBe(1);
    expect(basemapLayerComposition('satellite', -1).satelliteOpacity).toBe(0);
    expect(basemapLayerComposition('satellite', Number.NaN).satelliteOpacity).toBe(1);
  });
});
