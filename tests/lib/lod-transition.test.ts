import { describe, expect, it } from 'vitest';
import {
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MIN_ZOOM,
  BUILDING_LOD3_MIN_ZOOM,
  smoothZoomStep,
} from '../../src/lib/lod-transition';

describe('building LoD zoom transition', () => {
  it('uses separate overview, source-LoD2, and very-close textured-LoD3 ranges', () => {
    expect(BUILDING_DETAIL_FULL_ZOOM - BUILDING_DETAIL_MIN_ZOOM).toBe(2.75);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 15)).toBe(0);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 18)).toBe(1);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 19)).toBe(1);
    expect(BUILDING_LOD3_MIN_ZOOM).toBeGreaterThan(BUILDING_DETAIL_FULL_ZOOM);
  });
});
