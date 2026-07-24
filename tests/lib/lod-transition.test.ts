import { describe, expect, it } from 'vitest';
import {
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MAX_OBJECTS,
  BUILDING_DETAIL_MIN_ZOOM,
  BUILDING_DETAIL_MIN_OBJECTS,
  BUILDING_LOD3_MIN_ZOOM,
  buildingDetailObjectLimit,
  smoothZoomStep,
} from '../../src/lib/lod-transition';

describe('building LoD zoom transition', () => {
  it('uses separate overview, source-LoD2, and close streamed-LoD3 ranges', () => {
    expect(BUILDING_DETAIL_FULL_ZOOM - BUILDING_DETAIL_MIN_ZOOM).toBe(2.75);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 15)).toBe(0);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 18)).toBe(1);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 19)).toBe(1);
    expect(BUILDING_LOD3_MIN_ZOOM).toBeGreaterThan(BUILDING_DETAIL_MIN_ZOOM);
    expect(BUILDING_LOD3_MIN_ZOOM).toBeLessThanOrEqual(BUILDING_DETAIL_FULL_ZOOM);
  });

  it('widens LoD2 from a neighbourhood to the broader visible city gradually', () => {
    expect(buildingDetailObjectLimit(0)).toBe(BUILDING_DETAIL_MIN_OBJECTS);
    expect(buildingDetailObjectLimit(0.5)).toBe(
      (BUILDING_DETAIL_MIN_OBJECTS + BUILDING_DETAIL_MAX_OBJECTS) / 2
    );
    expect(buildingDetailObjectLimit(1)).toBe(BUILDING_DETAIL_MAX_OBJECTS);
    expect(buildingDetailObjectLimit(-1)).toBe(BUILDING_DETAIL_MIN_OBJECTS);
    expect(buildingDetailObjectLimit(2)).toBe(BUILDING_DETAIL_MAX_OBJECTS);
  });
});
