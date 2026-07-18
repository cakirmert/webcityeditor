import { describe, expect, it } from 'vitest';
import {
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MIN_ZOOM,
  smoothZoomStep,
} from '../../src/lib/lod-transition';

describe('building LoD zoom transition', () => {
  it('uses a long close-detail ramp instead of a one-wheel-step swap', () => {
    expect(BUILDING_DETAIL_FULL_ZOOM - BUILDING_DETAIL_MIN_ZOOM).toBe(3.5);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 14)).toBe(0);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 16.5)).toBe(0.5);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 19)).toBe(1);
  });
});
