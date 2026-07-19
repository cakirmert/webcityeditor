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
  polygon: [number, number][];
  angle: number;
  direction: RoadDirection;
}

export interface RoadVisuals {
  dividers: RoadLaneDivider[];
  directions: RoadDirectionMarker[];
}

/**
 * Reconstruct osm2streets' essential visual language from the editable
 * CityJSON Transportation surfaces. Shared lane edges become markings and the
 * stored road centerline gives arrows a stable map/travel orientation.
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
    const sourceCenterline = roadSourceCenterline(group);
    for (let index = 0; index < group.length; index++) {
      const area = group[index];
      if (isTravelLane(area)) {
        const marker = directionMarker(area, sourceCenterline);
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

function directionMarker(
  area: RoadArea,
  roadCenterline: [number, number][] | null
): RoadDirectionMarker | null {
  const raw = String(area.attributes.trafficDirection ?? 'none').toLowerCase();
  const direction: RoadDirection = raw === 'forward' || raw === 'backward' || raw === 'both'
    ? raw
    : 'none';
  if (direction === 'none') return null;

  const laneCenterline = ribbonCenterline(area.polygon);
  if (laneCenterline.length < 2) return null;
  const position = pointAtHalfLength(laneCenterline);
  const tangent = closestTangent(position, roadCenterline ?? laneCenterline);
  if (!tangent) return null;
  const travelTangent: [number, number] = direction === 'backward'
    ? [-tangent[0], -tangent[1]]
    : tangent;
  const angle = (Math.atan2(travelTangent[1], travelTangent[0]) * 180) / Math.PI;
  return {
    id: `${area.id}-direction`,
    roadId: area.roadId,
    position,
    polygon: direction === 'both'
      ? doubleArrowPolygon(position, travelTangent)
      : forwardArrowPolygon(position, travelTangent),
    angle,
    direction,
  };
}

function roadSourceCenterline(areas: RoadArea[]): [number, number][] | null {
  for (const area of areas) {
    const value = area.attributes.sourceCenterlineWgs84;
    if (!Array.isArray(value)) continue;
    const line: [number, number][] = [];
    let valid = true;
    for (const point of value) {
      if (
        !Array.isArray(point) ||
        typeof point[0] !== 'number' ||
        typeof point[1] !== 'number' ||
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1])
      ) {
        valid = false;
        break;
      }
      line.push([point[0], point[1]]);
    }
    if (valid && line.length >= 2) return line;
  }
  return null;
}

function pointAtHalfLength(line: [number, number][]): [number, number] {
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index < line.length - 1; index++) {
    const length = localMeters(line[index], line[index + 1]);
    lengths.push(length);
    total += length;
  }
  let remaining = total / 2;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      const fraction = length > 0 ? Math.max(0, Math.min(1, remaining / length)) : 0;
      return [
        line[index][0] + (line[index + 1][0] - line[index][0]) * fraction,
        line[index][1] + (line[index + 1][1] - line[index][1]) * fraction,
      ];
    }
    remaining -= length;
  }
  return [...line[0]];
}

function closestTangent(
  position: [number, number],
  line: [number, number][]
): [number, number] | null {
  const latitudeRadians = (position[1] * Math.PI) / 180;
  const metersPerLng = 111_320 * Math.max(0.1, Math.cos(latitudeRadians));
  const metersPerLat = 111_320;
  let best: { distance: number; tangent: [number, number] } | null = null;
  for (let index = 0; index < line.length - 1; index++) {
    const ax = (line[index][0] - position[0]) * metersPerLng;
    const ay = (line[index][1] - position[1]) * metersPerLat;
    const bx = (line[index + 1][0] - position[0]) * metersPerLng;
    const by = (line[index + 1][1] - position[1]) * metersPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 1e-8) continue;
    const fraction = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const px = ax + fraction * dx;
    const py = ay + fraction * dy;
    const distance = px * px + py * py;
    if (!best || distance < best.distance) {
      const length = Math.sqrt(lengthSquared);
      best = { distance, tangent: [dx / length, dy / length] };
    }
  }
  return best?.tangent ?? null;
}

function forwardArrowPolygon(
  center: [number, number],
  tangent: [number, number]
): [number, number][] {
  const length = 2.4;
  const headLength = 0.82;
  const headHalfWidth = 0.58;
  const shaftHalfWidth = 0.14;
  return closeArrow([
    offsetMeters(center, tangent, -length / 2, shaftHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, shaftHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, headHalfWidth),
    offsetMeters(center, tangent, length / 2, 0),
    offsetMeters(center, tangent, length / 2 - headLength, -headHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, -shaftHalfWidth),
    offsetMeters(center, tangent, -length / 2, -shaftHalfWidth),
  ]);
}

function doubleArrowPolygon(
  center: [number, number],
  tangent: [number, number]
): [number, number][] {
  const length = 2.8;
  const headLength = 0.78;
  const headHalfWidth = 0.52;
  const shaftHalfWidth = 0.13;
  return closeArrow([
    offsetMeters(center, tangent, length / 2, 0),
    offsetMeters(center, tangent, length / 2 - headLength, headHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, shaftHalfWidth),
    offsetMeters(center, tangent, -length / 2 + headLength, shaftHalfWidth),
    offsetMeters(center, tangent, -length / 2 + headLength, headHalfWidth),
    offsetMeters(center, tangent, -length / 2, 0),
    offsetMeters(center, tangent, -length / 2 + headLength, -headHalfWidth),
    offsetMeters(center, tangent, -length / 2 + headLength, -shaftHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, -shaftHalfWidth),
    offsetMeters(center, tangent, length / 2 - headLength, -headHalfWidth),
  ]);
}

function offsetMeters(
  center: [number, number],
  tangent: [number, number],
  along: number,
  across: number
): [number, number] {
  const x = tangent[0] * along - tangent[1] * across;
  const y = tangent[1] * along + tangent[0] * across;
  const metersPerLng = 111_320 * Math.max(0.1, Math.cos((center[1] * Math.PI) / 180));
  return [center[0] + x / metersPerLng, center[1] + y / 111_320];
}

function closeArrow(points: [number, number][]): [number, number][] {
  return [...points, [...points[0]]];
}

function localMeters(a: [number, number], b: [number, number]): number {
  const latitudeRadians = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const x = (b[0] - a[0]) * 111_320 * Math.cos(latitudeRadians);
  const y = (b[1] - a[1]) * 111_320;
  return Math.hypot(x, y);
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
