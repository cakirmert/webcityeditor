import type { RoadArea, RoadVerticalProfile } from './transportation';

export type RoadRenderPosition = [number, number, number];

export const ROAD_SURFACE_CLEARANCE_M = 0.12;

/**
 * Lift a road ring just above the terrain while preserving explicit bridge or
 * tunnel elevations. The clearance prevents z-fighting without making a road
 * appear above buildings, trees, or other real 3D geometry.
 */
export function elevateRoadPolygon(
  area: RoadArea,
  elevationAt: (lngLat: [number, number]) => number | null,
  clearanceM = ROAD_SURFACE_CLEARANCE_M
): RoadRenderPosition[] {
  return elevateRoadPath(area.polygon, area.vertical, elevationAt, clearanceM);
}

export function elevateRoadPath(
  path: readonly [number, number][],
  vertical: RoadVerticalProfile | undefined,
  elevationAt: (lngLat: [number, number]) => number | null,
  clearanceM = ROAD_SURFACE_CLEARANCE_M
): RoadRenderPosition[] {
  return path.map(([lng, lat]) => {
    const sampledElevation = elevationAt([lng, lat]);
    const explicitElevation = Number.isFinite(vertical?.elevationM)
      ? (vertical?.elevationM as number)
      : null;
    const baseElevation = vertical?.placement === 'elevated' || vertical?.placement === 'underground'
      ? explicitElevation ?? sampledElevation ?? 0
      : vertical?.placement === 'surface'
        ? sampledElevation ?? explicitElevation ?? 0
        : explicitElevation ?? sampledElevation ?? 0;
    return [lng, lat, baseElevation + clearanceM];
  });
}

/** Saved roads respect scene depth unless the road workspace is active. */
export function roadDepthTestEnabled(roadWorkspaceOpen: boolean): boolean {
  return !roadWorkspaceOpen;
}
