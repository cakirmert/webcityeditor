import { describe, expect, it } from 'vitest';
import {
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MAX_OBJECTS,
  BUILDING_DETAIL_MIN_ZOOM,
  BUILDING_DETAIL_MIN_OBJECTS,
  BUILDING_LOD3_MIN_ZOOM,
  buildingMapDetailMode,
  buildingDetailObjectLimit,
  editorAssetMapDetailMode,
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

  it('widens LoD2 from a neighbourhood to the broader visible city gradually', () => {
    expect(buildingDetailObjectLimit(0)).toBe(BUILDING_DETAIL_MIN_OBJECTS);
    expect(buildingDetailObjectLimit(0.5)).toBe(
      (BUILDING_DETAIL_MIN_OBJECTS + BUILDING_DETAIL_MAX_OBJECTS) / 2
    );
    expect(buildingDetailObjectLimit(1)).toBe(BUILDING_DETAIL_MAX_OBJECTS);
    expect(buildingDetailObjectLimit(-1)).toBe(BUILDING_DETAIL_MIN_OBJECTS);
    expect(buildingDetailObjectLimit(2)).toBe(BUILDING_DETAIL_MAX_OBJECTS);
  });

  it('uses untextured LoD3 first and requests textured LoD3 only after opt-in', () => {
    expect(buildingMapDetailMode(BUILDING_DETAIL_MIN_ZOOM - 0.01, false)).toBe('lod0');
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM - 0.01, false)).toBe('lod2');
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM, false)).toBe(
      'lod3-untextured'
    );
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM, true)).toBe(
      'lod3-textured'
    );
  });

  it('keeps LoD3-only editor assets visible throughout the source-LoD2 range', () => {
    expect(editorAssetMapDetailMode(BUILDING_DETAIL_MIN_ZOOM - 0.01, false)).toBe(
      'block'
    );
    expect(editorAssetMapDetailMode(BUILDING_DETAIL_MIN_ZOOM, false)).toBe(
      'lod3-untextured'
    );
    expect(
      editorAssetMapDetailMode(BUILDING_LOD3_MIN_ZOOM - 0.01, true)
    ).toBe('lod3-untextured');
    expect(editorAssetMapDetailMode(BUILDING_LOD3_MIN_ZOOM, true)).toBe(
      'lod3-textured'
    );
  });
});
