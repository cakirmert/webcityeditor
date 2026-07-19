/** Flat LoD0 footprints are the only building geometry below this zoom. */
export const BUILDING_BLOCK_MIN_ZOOM = 14;
export const BUILDING_BLOCK_FULL_ZOOM = 15.25;

/** Source LoD2 replaces the cheap blocks progressively through the middle range. */
export const BUILDING_DETAIL_MIN_ZOOM = 15.25;
export const BUILDING_DETAIL_FULL_ZOOM = 18;

/** Textured Hamburg LoD3 is deliberately reserved for a very close street view. */
export const BUILDING_LOD3_MIN_ZOOM = 18.25;

/** Official Hamburg 3D street trees are useful only once individual streets are legible. */
export const HAMBURG_TREE_MIN_ZOOM = 16.5;

export function smoothZoomStep(min: number, max: number, zoom: number): number {
  const progress = Math.max(0, Math.min(1, (zoom - min) / (max - min)));
  return progress * progress * (3 - 2 * progress);
}
