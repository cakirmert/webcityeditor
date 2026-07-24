/** Flat LoD0 footprints are the only building geometry below this zoom. */
export const BUILDING_BLOCK_MIN_ZOOM = 14;
export const BUILDING_BLOCK_FULL_ZOOM = 15.25;

/** Source LoD2 replaces the cheap blocks progressively through the middle range. */
export const BUILDING_DETAIL_MIN_ZOOM = 15.25;
export const BUILDING_DETAIL_FULL_ZOOM = 18;

/** Streamed source LoD3 becomes useful once individual building detail is legible. */
export const BUILDING_LOD3_MIN_ZOOM = 17;

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
