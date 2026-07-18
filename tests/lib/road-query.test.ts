import { describe, expect, it } from 'vitest';
import { projectWgs84BboxToCrs } from '../../src/lib/projection';
import { limitRoadQueryBbox } from '../../src/lib/road-query';

describe('limitRoadQueryBbox', () => {
  it('leaves already-small WGS84 query boxes unchanged', () => {
    const bbox: [number, number, number, number] = [9.999, 53.549, 10.001, 53.551];
    const limited = limitRoadQueryBbox(bbox, {
      metricCrs: 'EPSG:25832',
      maxWidthMeters: 1600,
      maxHeightMeters: 1600,
    });

    expect(limited.wasLimited).toBe(false);
    expect(limited.bbox).toEqual(bbox);
  });

  it('limits large Hamburg boxes in EPSG:25832 metres before converting back to WGS84', () => {
    const limited = limitRoadQueryBbox([9.95, 53.52, 10.05, 53.6], {
      metricCrs: 'EPSG:25832',
      maxWidthMeters: 1600,
      maxHeightMeters: 1600,
    });

    expect(limited.wasLimited).toBe(true);
    expect(limited.bbox[0]).toBeGreaterThan(9.95);
    expect(limited.bbox[1]).toBeGreaterThan(53.52);
    expect(limited.bbox[2]).toBeLessThan(10.05);
    expect(limited.bbox[3]).toBeLessThan(53.6);

    const metric = projectWgs84BboxToCrs(limited.bbox, 'EPSG:25832');
    expect(metric[2] - metric[0]).toBeLessThanOrEqual(1610);
    expect(metric[3] - metric[1]).toBeLessThanOrEqual(1610);
  });

  it('rejects non-positive metric limits', () => {
    expect(() =>
      limitRoadQueryBbox([9.95, 53.52, 10.05, 53.6], {
        metricCrs: 'EPSG:25832',
        maxWidthMeters: 0,
        maxHeightMeters: 1600,
      })
    ).toThrow(/positive/);
  });
});
