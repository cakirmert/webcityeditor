export interface LaneConnectorSurfaceInput {
  path: [number, number][];
  sourceWidthM: number;
  targetWidthM: number;
}

interface LocalPoint {
  x: number;
  y: number;
}

/**
 * Expand a lane-centre movement path into a tapered WGS84 polygon.
 *
 * This is intentionally a render-time surface: confirmed movements can be
 * inspected at their actual lane widths without modifying the exact imported
 * CityJSON road polygons or claiming a persisted junction geometry.
 */
export function buildLaneConnectorSurface({
  path,
  sourceWidthM,
  targetWidthM,
}: LaneConnectorSurfaceInput): [number, number][] {
  const clean = removeConsecutiveDuplicates(path);
  if (
    clean.length < 2 ||
    !Number.isFinite(sourceWidthM) ||
    !Number.isFinite(targetWidthM) ||
    sourceWidthM <= 0 ||
    targetWidthM <= 0
  ) {
    return [];
  }

  const origin = clean[0];
  const meanLatitude =
    clean.reduce((sum, point) => sum + point[1], 0) / clean.length;
  const metresPerLng =
    111_320 * Math.max(0.2, Math.cos((meanLatitude * Math.PI) / 180));
  const metresPerLat = 110_540;
  const local = clean.map(([lng, lat]) => ({
    x: (lng - origin[0]) * metresPerLng,
    y: (lat - origin[1]) * metresPerLat,
  }));
  const distances = cumulativeDistances(local);
  const totalLength = distances[distances.length - 1];
  if (totalLength < 0.05) return [];

  const left: LocalPoint[] = [];
  const right: LocalPoint[] = [];
  for (let index = 0; index < local.length; index += 1) {
    const previous = local[Math.max(0, index - 1)];
    const next = local[Math.min(local.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return [];
    const progress = distances[index] / totalLength;
    const halfWidth =
      (sourceWidthM + (targetWidthM - sourceWidthM) * progress) / 2;
    const normalX = -dy / length;
    const normalY = dx / length;
    left.push({
      x: local[index].x + normalX * halfWidth,
      y: local[index].y + normalY * halfWidth,
    });
    right.push({
      x: local[index].x - normalX * halfWidth,
      y: local[index].y - normalY * halfWidth,
    });
  }

  const ring = [...left, ...right.reverse(), left[0]].map(
    ({ x, y }) =>
      [
        origin[0] + x / metresPerLng,
        origin[1] + y / metresPerLat,
      ] as [number, number]
  );
  return Math.abs(signedArea(ring)) > 1e-14 ? ring : [];
}

function removeConsecutiveDuplicates(
  path: [number, number][]
): [number, number][] {
  const clean: [number, number][] = [];
  for (const point of path) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const previous = clean[clean.length - 1];
    if (
      previous &&
      Math.abs(previous[0] - point[0]) < 1e-12 &&
      Math.abs(previous[1] - point[1]) < 1e-12
    ) {
      continue;
    }
    clean.push(point);
  }
  return clean;
}

function cumulativeDistances(points: LocalPoint[]): number[] {
  const result = [0];
  for (let index = 1; index < points.length; index += 1) {
    result.push(
      result[index - 1] +
        Math.hypot(
          points[index].x - points[index - 1].x,
          points[index].y - points[index - 1].y
        )
    );
  }
  return result;
}

function signedArea(ring: [number, number][]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area +=
      ring[index][0] * ring[index + 1][1] -
      ring[index + 1][0] * ring[index][1];
  }
  return area / 2;
}
