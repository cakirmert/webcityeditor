/** Flat LoD0 footprints are the only building geometry below this zoom. */
export const BUILDING_BLOCK_MIN_ZOOM = 14;
export const BUILDING_BLOCK_FULL_ZOOM = 15.25;

/** Source LoD2 replaces the cheap blocks progressively through the middle range. */
export const BUILDING_DETAIL_MIN_ZOOM = 15.25;
export const BUILDING_DETAIL_FULL_ZOOM = 18;

/** Textured Hamburg LoD3 is deliberately reserved for a very close street view. */
export const BUILDING_LOD3_MIN_ZOOM = 18.25;

export type BuildingMapDetailMode =
  | 'lod0'
  | 'lod2'
  | 'lod3-untextured'
  | 'lod3-textured';

/**
 * Close zoom always upgrades to the highest available LoD3 geometry. Photo
 * tiles are a separate, explicit opt-in so reaching LoD3 never starts their
 * network requests by itself.
 */
export function buildingMapDetailMode(
  zoom: number,
  texturesEnabled: boolean
): BuildingMapDetailMode {
  if (zoom < BUILDING_DETAIL_MIN_ZOOM) return 'lod0';
  if (zoom < BUILDING_LOD3_MIN_ZOOM) return 'lod2';
  return texturesEnabled ? 'lod3-textured' : 'lod3-untextured';
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
  texturesEnabled: boolean
): EditorAssetMapDetailMode {
  const mapMode = buildingMapDetailMode(zoom, texturesEnabled);
  if (mapMode === 'lod0') return 'block';
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
