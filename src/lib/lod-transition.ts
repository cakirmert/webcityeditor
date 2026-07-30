/** Flat LoD0 footprints are the only building geometry below this zoom. */
export const BUILDING_BLOCK_MIN_ZOOM = 14;
export const BUILDING_BLOCK_FULL_ZOOM = 15.25;

/** Source LoD2 replaces the cheap LoD1 blocks at this zoom. */
export const BUILDING_DETAIL_MIN_ZOOM = 15.25;
export const BUILDING_DETAIL_FULL_ZOOM = 18;

/**
 * Keep true LoD3 just beyond the completed LoD2 transition. This avoids
 * starting the high-detail/photo stream while the user is still navigating
 * the ordinary semantic city view.
 */
export const BUILDING_LOD3_MIN_ZOOM = 18;

export type BuildingMapDetailMode =
  | 'lod0'
  | 'lod1'
  | 'lod2'
  | 'lod3-untextured'
  | 'lod3-textured';

/**
 * Close zoom always upgrades to the highest available LoD3 geometry. The map
 * defaults its texture control on, while this pure resolver still supports an
 * explicit untextured choice.
 */
export function buildingMapDetailMode(
  zoom: number,
  texturesEnabled: boolean
): BuildingMapDetailMode {
  if (zoom < BUILDING_BLOCK_MIN_ZOOM) return 'lod0';
  if (zoom < BUILDING_DETAIL_MIN_ZOOM) return 'lod1';
  if (zoom < BUILDING_LOD3_MIN_ZOOM) return 'lod2';
  return texturesEnabled ? 'lod3-textured' : 'lod3-untextured';
}

/**
 * Road editing prioritises the lighter semantic city context. Preserve the
 * saved texture preference so closing Roads immediately restores LoD3.
 */
export function capBuildingMapDetailForRoadEditing(
  mode: BuildingMapDetailMode,
  roadEditing: boolean
): BuildingMapDetailMode {
  if (
    roadEditing &&
    (mode === 'lod3-untextured' || mode === 'lod3-textured')
  ) {
    return 'lod2';
  }
  return mode;
}

export type EditorAssetMapDetailMode =
  | 'block'
  | 'lod3-untextured'
  | 'lod3-textured';

/**
 * Ready-made editor assets currently ship with LoD3 geometry only. Promote
 * that local geometry as soon as the ordinary map enters its LoD2 range, but
 * keep it untextured until the close-zoom texture control is explicitly on.
 */
export function editorAssetMapDetailMode(
  zoom: number,
  texturesEnabled: boolean,
  roadEditing = false
): EditorAssetMapDetailMode {
  const mapMode = buildingMapDetailMode(zoom, texturesEnabled);
  if (mapMode === 'lod0' || mapMode === 'lod1') return 'block';
  if (roadEditing) return 'lod3-untextured';
  return mapMode === 'lod3-textured'
    ? 'lod3-textured'
    : 'lod3-untextured';
}

/**
 * A pitched map has a much larger visible footprint than a top-down map. Start
 * with a useful neighbourhood instead of a tiny 24-building island, then widen
 * the detailed LoD2 region smoothly as the camera moves closer.
 */
export const BUILDING_DETAIL_MIN_OBJECTS = 120;
export const BUILDING_DETAIL_MAX_OBJECTS = 720;

export function buildingDetailObjectLimit(detailOpacity: number): number {
  const progress = Math.max(0, Math.min(1, detailOpacity));
  return Math.round(
    BUILDING_DETAIL_MIN_OBJECTS +
      progress * (BUILDING_DETAIL_MAX_OBJECTS - BUILDING_DETAIL_MIN_OBJECTS)
  );
}

/** Official Hamburg 3D street trees are useful only once individual streets are legible. */
export const HAMBURG_TREE_MIN_ZOOM = 16.5;

export function smoothZoomStep(min: number, max: number, zoom: number): number {
  const progress = Math.max(0, Math.min(1, (zoom - min) / (max - min)));
  return progress * progress * (3 - 2 * progress);
}
