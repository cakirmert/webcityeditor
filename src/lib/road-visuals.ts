import type { RoadArea, RoadDirection } from './transportation';

export interface RoadLaneDivider {
  id: string;
  roadId: string;
  path: [number, number][];
  kind: 'lane-divider' | 'edge-line';
}

export interface RoadDirectionMarker {
  id: string;
  roadId: string;
  position: [number, number];
  angle: number;
  direction: RoadDirection;
  label: string;
}

export interface RoadVisuals {
  dividers: RoadLaneDivider[];
  directions: RoadDirectionMarker[];
}

/**
 * Reconstruct osm2streets' essential visual language from the editable
 * CityJSON Transportation surfaces. No XML/GeoJSON sidecar is needed after
 * import: shared lane edges become markings and lane semantics drive arrows.
 */
export function buildRoadVisuals(areas: RoadArea[]): RoadVisuals {
  const groups = new Map<string, RoadArea[]>();
  for (const area of areas) {
    if (isIntersection(area)) continue;
    const key = `${area.roadId}\u0000${area.sectionId}`;
    const group = groups.get(key) ?? [];
    group.push(area);
    groups.set(key, group);
  }

  const dividers: RoadLaneDivider[] = [];
  const directions: RoadDirectionMarker[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => laneIndex(a) - laneIndex(b));
    for (let index = 0; index < group.length; index++) {
      const area = group[index];
      if (isTravelLane(area)) {
        const marker = directionMarker(area);
        if (marker) directions.push(marker);
      }
      const next = group[index + 1];
      if (!next) continue;
      const path = sharedBoundaryPath(area.polygon, next.polygon);
      if (path.length < 2) continue;
      const laneDivider = isTravelLane(area) && isTravelLane(next);
      if (!laneDivider && !isTravelLane(area) && !isTravelLane(next)) continue;
      dividers.push({
        id: `${area.id}--${next.id}`,
        roadId: area.roadId,
        path,
        kind: laneDivider ? 'lane-divider' : 'edge-line',
      });
    }
  }
  return { dividers, directions };
}

function isIntersection(area: RoadArea): boolean {
  return normalize(String(area.attributes.transportationUsage ?? area.function)) === 'intersection';
}

function isTravelLane(area: RoadArea): boolean {
  const key = normalize(
    `${String(area.attributes.transportationUsage ?? '')} ${area.function} ${String(area.attributes.sourceType ?? '')}`
  );
  return key.includes('carlane') || key.includes('drivinglane') || key.includes('bikelane') ||
    key.includes('biking') || key.includes('buslane');
}

function laneIndex(area: RoadArea): number {
  const value = area.attributes.osm2streetsLaneIndex;
  return typeof value === 'number' && Number.isFinite(value) ? value : area.surfaceIndex;
}

function directionMarker(area: RoadArea): RoadDirectionMarker | null {
  const raw = String(area.attributes.trafficDirection ?? 'none').toLowerCase();
  const direction: RoadDirection = raw === 'forward' || raw === 'backward' || raw === 'both'
    ? raw
    : 'none';
  if (direction === 'none') return null;
  const centerline = ribbonCenterline(area.polygon);
  if (centerline.length < 2) return null;
  const middle = Math.floor((centerline.length - 1) / 2);
  const a = centerline[middle];
  const b = centerline[Math.min(centerline.length - 1, middle + 1)];
  const position: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  if (direction === 'backward') angle += 180;
  return {
    id: `${area.id}-direction`,
    roadId: area.roadId,
    position,
    angle,
    direction,
    label: direction === 'both' ? '↔' : '➤',
  };
}

function ribbonCenterline(polygon: [number, number][]): [number, number][] {
  const ring = openRing(polygon);
  if (ring.length < 4 || ring.length % 2 !== 0) return [];
  const half = ring.length / 2;
  const centerline: [number, number][] = [];
  for (let index = 0; index < half; index++) {
    const opposite = ring[ring.length - 1 - index];
    centerline.push([(ring[index][0] + opposite[0]) / 2, (ring[index][1] + opposite[1]) / 2]);
  }
  return centerline;
}

function sharedBoundaryPath(
  leftPolygon: [number, number][],
  rightPolygon: [number, number][]
): [number, number][] {
  const left = openRing(leftPolygon);
  const right = openRing(rightPolygon);
  const rightEdges = new Set<string>();
  for (let index = 0; index < right.length; index++) {
    rightEdges.add(edgeKey(right[index], right[(index + 1) % right.length]));
  }
  const segments: Array<[[number, number], [number, number]]> = [];
  for (let index = 0; index < left.length; index++) {
    const a = left[index];
    const b = left[(index + 1) % left.length];
    if (rightEdges.has(edgeKey(a, b))) segments.push([a, b]);
  }
  if (segments.length === 0) return [];

  const first = segments.shift()!;
  const path: [number, number][] = [[...first[0]], [...first[1]]];
  const remaining = segments;
  while (remaining.length > 0) {
    const tail = path[path.length - 1];
    const match = remaining.findIndex(([a, b]) => pointKey(a) === pointKey(tail) || pointKey(b) === pointKey(tail));
    if (match < 0) break;
    const [a, b] = remaining.splice(match, 1)[0];
    path.push(pointKey(a) === pointKey(tail) ? [...b] : [...a]);
  }
  return path;
}

function openRing(ring: [number, number][]): [number, number][] {
  const result = ring.map((point) => [point[0], point[1]] as [number, number]);
  if (result.length > 1 && pointKey(result[0]) === pointKey(result[result.length - 1])) result.pop();
  return result;
}

function edgeKey(a: [number, number], b: [number, number]): string {
  const left = pointKey(a);
  const right = pointKey(b);
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function pointKey(point: [number, number]): string {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
