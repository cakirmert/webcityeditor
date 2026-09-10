import type { RoadArea } from './transportation';

export interface RailwayContext {
  id: string;
  path: [number, number][];
  layer: number;
  placement: 'elevated' | 'underground' | 'ground';
  bounds: [number, number, number, number];
}

/** Relative OSM layers are not measured elevations. These heights belong only
 * to the explicitly labelled schematic viewer and never enter CityJSON. */
export function schematicRoadHeight(area?: RoadArea): number {
  if (!area) return 0;
  const vertical = area.vertical;
  if (vertical?.osmLayer) return vertical.osmLayer * 6;
  if (vertical?.placement === 'elevated') return 6;
  if (vertical?.placement === 'underground') return -6;
  return 0;
}

export function readRailwayContext(value: unknown): RailwayContext[] {
  const features = (value as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((item: any) => {
    const path = item?.geometry?.coordinates;
    if (item?.geometry?.type !== 'LineString' || !Array.isArray(path) || path.length < 2 || !path.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return [];
    const tags = item.properties ?? {}, tagged = (value: unknown) => !!value && !['no', 'false', '0'].includes(String(value));
    const layer = Number(tags.layer) || (tagged(tags.bridge) ? 1 : tagged(tags.tunnel) ? -1 : 0);
    return [{ id: String(item.id), path, layer,
      placement: tagged(tags.bridge) || layer > 0 ? 'elevated' as const : tagged(tags.tunnel) || layer < 0 ? 'underground' as const : 'ground' as const,
      bounds: [Math.min(...path.map((p: number[]) => p[0])), Math.min(...path.map((p: number[]) => p[1])), Math.max(...path.map((p: number[]) => p[0])), Math.max(...path.map((p: number[]) => p[1]))] as [number, number, number, number] }];
  });
}

export function railwayInBounds(railway: RailwayContext, bounds: [number, number, number, number]): boolean {
  const b = railway.bounds;
  return b[0] <= bounds[2] && b[2] >= bounds[0] && b[1] <= bounds[3] && b[3] >= bounds[1];
}
