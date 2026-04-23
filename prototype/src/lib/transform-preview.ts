import proj4 from 'proj4';
import type { CityJsonDocument } from '../types';
import { extractFootprints } from './footprints';
import { detectCrs } from './projection';

export interface PendingTransform {
  id: string;
  dx: number; // CRS metres
  dy: number;
  angle: number; // degrees, CCW
}

/**
 * Compute where a building's footprint *would* land if the pending transform
 * were applied, returned as WGS84 lng/lat ring + height. Used by the map's
 * ghost-preview layer.
 *
 * Transforms in CRS metres, then unprojects back to WGS84 — symmetric with the
 * actual moveBuilding/rotateBuilding which work in CRS metres.
 */
export function computeTransformedFootprint(
  doc: CityJsonDocument,
  pending: PendingTransform
): { polygon: [number, number][]; height: number } | null {
  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  const fps = extractFootprints(doc);
  const fp = fps.find((f) => f.id === pending.id);
  if (!fp) return null;

  // Project the ring to CRS metres
  const projected: [number, number][] = fp.polygon.map(
    ([lng, lat]) => proj4('EPSG:4326', crs.code, [lng, lat]) as [number, number]
  );

  // Centroid of the bbox in CRS (used as rotation pivot)
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const rad = (pending.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const transformed: [number, number][] = projected.map(([x, y]) => {
    // rotate around centroid, then translate
    const rx = x - cx;
    const ry = y - cy;
    const rotX = cx + rx * cos - ry * sin;
    const rotY = cy + rx * sin + ry * cos;
    return [rotX + pending.dx, rotY + pending.dy];
  });

  // Unproject back to WGS84
  const polygon: [number, number][] = transformed.map(
    ([x, y]) => proj4(crs.code, 'EPSG:4326', [x, y]) as [number, number]
  );

  return { polygon, height: fp.height };
}
