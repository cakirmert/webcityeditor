import { describe, expect, it } from 'vitest';
import {
  BUILDING_BLOCK_MIN_ZOOM,
  BUILDING_DETAIL_FULL_ZOOM,
  BUILDING_DETAIL_MAX_OBJECTS,
  BUILDING_DETAIL_MIN_ZOOM,
  BUILDING_DETAIL_MIN_OBJECTS,
  BUILDING_LOD3_MIN_ZOOM,
  capBuildingMapDetailForRoadEditing,
  buildingMapDetailMode,
  buildingDetailObjectLimit,
  editorAssetMapDetailMode,
  smoothZoomStep,
} from '../../src/lib/lod-transition';

describe('building LoD zoom transition', () => {
  it('uses separate footprint, LoD1, LoD2, and very-close LoD3 ranges', () => {
    expect(BUILDING_DETAIL_FULL_ZOOM - BUILDING_DETAIL_MIN_ZOOM).toBe(2.75);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 15)).toBe(0);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 18)).toBe(1);
    expect(smoothZoomStep(BUILDING_DETAIL_MIN_ZOOM, BUILDING_DETAIL_FULL_ZOOM, 19)).toBe(1);
    expect(BUILDING_LOD3_MIN_ZOOM).toBe(18);
    expect(BUILDING_LOD3_MIN_ZOOM).toBeGreaterThanOrEqual(
      BUILDING_DETAIL_FULL_ZOOM
    );
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

  it('resolves every official tier at its exact zoom boundary', () => {
    expect(buildingMapDetailMode(BUILDING_BLOCK_MIN_ZOOM - 0.01, false)).toBe(
      'lod0'
    );
    expect(buildingMapDetailMode(BUILDING_BLOCK_MIN_ZOOM, false)).toBe('lod1');
    expect(buildingMapDetailMode(BUILDING_DETAIL_MIN_ZOOM - 0.001, false)).toBe(
      'lod1'
    );
    expect(buildingMapDetailMode(BUILDING_DETAIL_MIN_ZOOM, false)).toBe('lod2');
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM - 0.01, false)).toBe('lod2');
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM, false)).toBe(
      'lod3-untextured'
    );
    expect(buildingMapDetailMode(BUILDING_LOD3_MIN_ZOOM, true)).toBe(
      'lod3-textured'
    );
  });

  it('caps only LoD3 remote buildings while Roads is open', () => {
    expect(capBuildingMapDetailForRoadEditing('lod0', true)).toBe('lod0');
    expect(capBuildingMapDetailForRoadEditing('lod1', true)).toBe('lod1');
    expect(capBuildingMapDetailForRoadEditing('lod2', true)).toBe('lod2');
    expect(capBuildingMapDetailForRoadEditing('lod3-untextured', true)).toBe(
      'lod2'
    );
    expect(capBuildingMapDetailForRoadEditing('lod3-textured', true)).toBe(
      'lod2'
    );
    expect(capBuildingMapDetailForRoadEditing('lod3-textured', false)).toBe(
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
    expect(editorAssetMapDetailMode(BUILDING_LOD3_MIN_ZOOM, true, true)).toBe(
      'lod3-untextured'
    );
  });
});
