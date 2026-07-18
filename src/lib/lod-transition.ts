export const BUILDING_BLOCK_MIN_ZOOM = 13.25;
export const BUILDING_BLOCK_FULL_ZOOM = 15.25;
export const BUILDING_DETAIL_MIN_ZOOM = 14.75;
export const BUILDING_DETAIL_FULL_ZOOM = 18.25;

export function smoothZoomStep(min: number, max: number, zoom: number): number {
  const progress = Math.max(0, Math.min(1, (zoom - min) / (max - min)));
  return progress * progress * (3 - 2 * progress);
}
