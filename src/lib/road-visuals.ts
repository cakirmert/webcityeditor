import {
  normalizeRoadAllowedTurns,
  type RoadAllowedTurn,
  type RoadArea,
  type RoadDirection,
} from './transportation';

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
  path: [number, number][];
  polygon: [number, number][];
  angle: number;
  direction: RoadDirection;
  turn: RoadAllowedTurn | 'direction';
  shaftWidthM: number;
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
        directions.push(...directionMarkers(area, sourceCenterline));
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

function directionMarkers(
  area: RoadArea,
  roadCenterline: [number, number][] | null
): RoadDirectionMarker[] {
  const raw = String(area.attributes.trafficDirection ?? 'none').toLowerCase();
  const direction: RoadDirection = raw === 'forward' || raw === 'backward' || raw === 'both'
    ? raw
    : 'none';
  if (direction === 'none') return [];

  const laneCenterline = ribbonCenterline(area.polygon);
  if (laneCenterline.length < 2) return [];
  const laneLengthM = lineLengthMeters(laneCenterline);
  if (laneLengthM < 2.4) return [];
  const position = pointAtHalfLength(laneCenterline);
  const tangent = closestTangent(position, roadCenterline ?? laneCenterline);
  if (!tangent) return [];
  const nominalLengthM = isBikeLane(area) ? 3 : 5;
  const lengthM = Math.min(nominalLengthM, Math.max(2.4, laneLengthM * 0.64));
  const turns = allowedTurnsForArea(area);
  const travelTangents: Array<{ suffix: string; tangent: [number, number] }> =
    direction === 'both'
      ? [
          { suffix: 'forward', tangent },
          { suffix: 'backward', tangent: [-tangent[0], -tangent[1]] },
        ]
      : [
          {
            suffix: direction,
            tangent:
              direction === 'backward'
                ? [-tangent[0], -tangent[1]]
                : tangent,
          },
        ];
  const markers: RoadDirectionMarker[] = [];
  for (const travel of travelTangents) {
    const angle =
      (Math.atan2(travel.tangent[1], travel.tangent[0]) * 180) / Math.PI;
    for (const turn of turns) {
      const geometry = germanDirectionArrow(
        position,
        travel.tangent,
        turn,
        lengthM
      );
      markers.push({
        id: `${area.id}-direction-${travel.suffix}-${turn}`,
        roadId: area.roadId,
        position,
        path: geometry.path,
        polygon: geometry.head,
        angle,
        direction,
        turn,
        shaftWidthM: isBikeLane(area) ? 0.14 : 0.2,
      });
    }
  }
  return markers;
}

function allowedTurnsForArea(
  area: RoadArea
): Array<RoadAllowedTurn | 'direction'> {
  const semanticTurns = normalizeRoadAllowedTurns(area.attributes.allowedTurns);
  if (semanticTurns.length > 0) return semanticTurns;
  const sourceJson = area.attributes.osm2streetsPropertiesJson;
  if (typeof sourceJson === 'string') {
    try {
      const source = JSON.parse(sourceJson) as { allowed_turns?: unknown };
      const sourceTurns = normalizeRoadAllowedTurns(source.allowed_turns);
      if (sourceTurns.length > 0) return sourceTurns;
    } catch {
      // Invalid optional source provenance must not suppress the direction cue.
    }
  }
  return ['direction'];
}

function isBikeLane(area: RoadArea): boolean {
  const key = normalize(
    `${String(area.attributes.transportationUsage ?? '')} ${area.function} ${String(area.attributes.sourceType ?? '')}`
  );
  return key.includes('bike') || key.includes('biking') || key.includes('cycle');
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

interface DirectionArrowGeometry {
  path: [number, number][];
  head: [number, number][];
}

interface LocalPoint {
  along: number;
  across: number;
}

/**
 * A lightweight approximation of German StVO Zeichen 297 / RMS lane arrows:
 * a long narrow stem, a compact triangular head, and a hooked 90-degree
 * branch for turns. Combined permissions are rendered as overlapping
 * components, matching the shared-stem markings used on German streets.
 */
function germanDirectionArrow(
  center: [number, number],
  tangent: [number, number],
  turn: RoadAllowedTurn | 'direction',
  lengthM: number
): DirectionArrowGeometry {
  const headLengthM = Math.min(0.76, lengthM * 0.18);
  const headHalfWidthM = Math.min(0.46, lengthM * 0.105);
  const start: LocalPoint = { along: -lengthM / 2, across: 0 };
  let tip: LocalPoint;
  let headDirection: LocalPoint;
  let localPath: LocalPoint[];

  if (
    turn === 'left' ||
    turn === 'right' ||
    turn === 'sharp_left' ||
    turn === 'sharp_right'
  ) {
    const side = turn === 'left' || turn === 'sharp_left' ? 1 : -1;
    const reachM = Math.min(1.18, Math.max(0.78, lengthM * 0.24));
    const isSharp = turn === 'sharp_left' || turn === 'sharp_right';
    tip = {
      along: isSharp ? lengthM * 0.04 : lengthM * 0.2,
      across: side * reachM,
    };
    headDirection = normalizeLocal({
      along: isSharp ? -0.28 : 0,
      across: side,
    });
    const base = subtractLocal(tip, scaleLocal(headDirection, headLengthM));
    localPath = cubicBezierLocal(
      start,
      { along: -lengthM * 0.02, across: 0 },
      { along: base.along, across: 0 },
      base,
      10
    );
  } else if (turn === 'slight_left' || turn === 'slight_right') {
    const side = turn === 'slight_left' ? 1 : -1;
    tip = {
      along: lengthM / 2,
      across: side * Math.min(0.92, lengthM * 0.19),
    };
    headDirection = normalizeLocal({ along: 0.84, across: side * 0.54 });
    const base = subtractLocal(tip, scaleLocal(headDirection, headLengthM));
    localPath = cubicBezierLocal(
      start,
      { along: -lengthM * 0.04, across: 0 },
      {
        along: base.along - lengthM * 0.16,
        across: base.across * 0.42,
      },
      base,
      8
    );
  } else if (turn === 'merge_left' || turn === 'merge_right') {
    const side = turn === 'merge_left' ? 1 : -1;
    tip = {
      along: lengthM / 2,
      across: side * Math.min(0.9, lengthM * 0.18),
    };
    headDirection = normalizeLocal({ along: 0.82, across: side * 0.58 });
    const base = subtractLocal(tip, scaleLocal(headDirection, headLengthM));
    localPath = cubicBezierLocal(
      start,
      { along: -lengthM * 0.06, across: 0 },
      {
        along: base.along - lengthM * 0.16,
        across: base.across * 0.45,
      },
      base,
      8
    );
  } else if (turn === 'uturn') {
    const reachM = Math.min(1.05, Math.max(0.72, lengthM * 0.22));
    tip = { along: -lengthM * 0.08, across: reachM };
    headDirection = { along: -1, across: 0 };
    const base = subtractLocal(tip, scaleLocal(headDirection, headLengthM));
    localPath = cubicBezierLocal(
      start,
      { along: lengthM * 0.24, across: 0 },
      { along: lengthM * 0.28, across: reachM },
      base,
      12
    );
  } else {
    tip = { along: lengthM / 2, across: 0 };
    headDirection = { along: 1, across: 0 };
    localPath = [
      start,
      subtractLocal(tip, scaleLocal(headDirection, headLengthM)),
    ];
  }

  return {
    path: localPath.map((point) =>
      offsetMeters(center, tangent, point.along, point.across)
    ),
    head: arrowHeadPolygon(
      center,
      tangent,
      tip,
      headDirection,
      headLengthM,
      headHalfWidthM
    ),
  };
}

function arrowHeadPolygon(
  center: [number, number],
  tangent: [number, number],
  tip: LocalPoint,
  direction: LocalPoint,
  headLengthM: number,
  headHalfWidthM: number
): [number, number][] {
  const normalizedDirection = normalizeLocal(direction);
  const base = subtractLocal(
    tip,
    scaleLocal(normalizedDirection, headLengthM)
  );
  const normal = {
    along: -normalizedDirection.across,
    across: normalizedDirection.along,
  };
  return closeArrow([
    offsetMeters(center, tangent, tip.along, tip.across),
    offsetMeters(
      center,
      tangent,
      base.along + normal.along * headHalfWidthM,
      base.across + normal.across * headHalfWidthM
    ),
    offsetMeters(
      center,
      tangent,
      base.along - normal.along * headHalfWidthM,
      base.across - normal.across * headHalfWidthM
    ),
  ]);
}

function cubicBezierLocal(
  start: LocalPoint,
  controlA: LocalPoint,
  controlB: LocalPoint,
  end: LocalPoint,
  steps: number
): LocalPoint[] {
  const points: LocalPoint[] = [];
  for (let index = 0; index <= steps; index++) {
    const t = index / steps;
    const inverse = 1 - t;
    points.push({
      along:
        inverse ** 3 * start.along +
        3 * inverse ** 2 * t * controlA.along +
        3 * inverse * t ** 2 * controlB.along +
        t ** 3 * end.along,
      across:
        inverse ** 3 * start.across +
        3 * inverse ** 2 * t * controlA.across +
        3 * inverse * t ** 2 * controlB.across +
        t ** 3 * end.across,
    });
  }
  return points;
}

function normalizeLocal(point: LocalPoint): LocalPoint {
  const length = Math.hypot(point.along, point.across);
  return length > 1e-9
    ? { along: point.along / length, across: point.across / length }
    : { along: 1, across: 0 };
}

function scaleLocal(point: LocalPoint, factor: number): LocalPoint {
  return { along: point.along * factor, across: point.across * factor };
}

function subtractLocal(left: LocalPoint, right: LocalPoint): LocalPoint {
  return {
    along: left.along - right.along,
    across: left.across - right.across,
  };
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

function lineLengthMeters(line: [number, number][]): number {
  let total = 0;
  for (let index = 0; index < line.length - 1; index++) {
    total += localMeters(line[index], line[index + 1]);
  }
  return total;
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
