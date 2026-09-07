import type { RoadLaneContinuation } from './road-lane-continuations';
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
 * Expand a lane-centre continuation into a tapered WGS84 polygon.
 *
 * This is render-only geometry. It deliberately leaves exact imported
 * CityJSON/osm2streets polygons unchanged.
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

/** Shape controls modify tangent-constrained connectors, not their endpoints. */
export function curveJunctionMovement(movement: RoadLaneContinuation, factor: number): RoadLaneContinuation {
  if (Math.abs(factor - 1 / 3) < 1e-6 || movement.path.length < 4) return movement;
  const first = movement.path[0], last = movement.path.at(-1)!;
  const scaleX = Math.cos(first[1] * Math.PI / 180);
  const tangent = (a: [number, number], b: [number, number]) => {
    const dx = (b[0] - a[0]) * scaleX, dy = b[1] - a[1]; const length = Math.hypot(dx, dy) || 1;
    return [dx / length / scaleX, dy / length];
  };
  const start = tangent(first, movement.path[1]);
  const end = tangent(movement.path.at(-2)!, last);
  const reach = Math.hypot((last[0] - first[0]) * scaleX, last[1] - first[1]) * factor;
  const a = [first[0] + start[0] * reach, first[1] + start[1] * reach];
  const b = [last[0] - end[0] * reach, last[1] - end[1] * reach];
  const path = Array.from({ length: 25 }, (_, i): [number, number] => {
    const t = i / 24, u = 1 - t;
    return [0, 1].map((axis) => u ** 3 * first[axis] + 3 * u ** 2 * t * a[axis] + 3 * u * t ** 2 * b[axis] + t ** 3 * last[axis]) as [number, number];
  });
  return { ...movement, path, polygon: buildLaneConnectorSurface({ path, sourceWidthM: movement.sourceWidthM, targetWidthM: movement.targetWidthM }) };
}
