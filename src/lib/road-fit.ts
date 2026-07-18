import { footprintPolygonToWgs84, type Footprint } from './footprints';
import './projection';
import proj4 from 'proj4';
import {
  difference,
  intersection,
  type MultiPolygon,
  type Ring,
} from 'polygon-clipping';
import type { RoadArea, RoadVerticalProfile } from './transportation';
import type { ParcelZone } from './zoning';
import type { RoadAllowedCorridor } from './road-corridor';

export type RoadFitConflictKind =
  | 'outside_corridor'
  | 'building_overlap'
  | 'building_clearance'
  | 'vertical_uncertainty'
  | 'affected_land';

export interface RoadFitConflict {
  id: string;
  kind: RoadFitConflictKind;
  severity: 'warning' | 'error';
  roadAreaId: string;
  affectedId?: string;
  clearanceM?: number;
  label: string;
  polygon: [number, number][];
}

export interface RoadFitValidationContext {
  roadAreas: RoadArea[];
  buildingFootprints?: Footprint[];
  affectedLand?: Array<Pick<ParcelZone, 'id' | 'label' | 'polygon'>>;
  allowedCorridors?: RoadAllowedCorridor[];
  corridorSeverity?: 'warning' | 'error';
  metricCrs?: string;
  buildingClearanceBlockM?: number;
  buildingClearanceWarningM?: number;
  verticalClearanceM?: number;
}

interface MetricPoint {
  x: number;
  y: number;
}

type RingBbox = [west: number, south: number, east: number, north: number];

interface BooleanProjection {
  rings: Ring[];
  unprojectRing: (ring: Ring) => [number, number][];
}

export function validateRoadFit(context: RoadFitValidationContext): RoadFitConflict[] {
  const conflicts: RoadFitConflict[] = [];
  const seen = new Set<string>();
  const buildings = context.buildingFootprints ?? [];
  const affectedLand = context.affectedLand ?? [];
  const corridors = context.allowedCorridors ?? [];
  const buildingClearanceWarningM =
    Number.isFinite(context.buildingClearanceWarningM) &&
    (context.buildingClearanceWarningM ?? 0) > 0
      ? context.buildingClearanceWarningM ?? 0
      : 0;
  const buildingClearanceBlockM =
    Number.isFinite(context.buildingClearanceBlockM) &&
    (context.buildingClearanceBlockM ?? 0) > 0
      ? context.buildingClearanceBlockM ?? 0
      : 0;
  const buildingClearanceCheckM = Math.max(
    buildingClearanceWarningM,
    buildingClearanceBlockM
  );
  const verticalClearanceM =
    Number.isFinite(context.verticalClearanceM) && (context.verticalClearanceM ?? 0) >= 0
      ? context.verticalClearanceM ?? 0
      : 0.5;

  for (const roadArea of context.roadAreas) {
    const roadPolygon = cleanRing(roadArea.polygon);
    if (roadPolygon.length < 3) continue;
    const roadBbox = ringBbox(roadPolygon);
    const nearbyRoadBbox = roadBbox
      ? expandBboxByMeters(roadBbox, buildingClearanceCheckM)
      : null;

    if (corridors.length > 0) {
      const corridorPolygons = corridors
        .map((corridor) => cleanRing(corridor.polygon))
        .filter((ring) => ring.length >= 3);
      const overflowPolygon =
        polygonDifference(roadPolygon, corridorPolygons, context.metricCrs) ??
        (!polygonInsideAny(roadPolygon, corridors) ? roadPolygon : null);
      if (overflowPolygon) {
        addConflict(conflicts, seen, {
          id: `road-fit-outside-${roadArea.id}`,
          kind: 'outside_corridor',
          severity: context.corridorSeverity ?? 'warning',
          roadAreaId: roadArea.id,
          label: `${roadArea.id} leaves the available road corridor.`,
          polygon: overflowPolygon,
        });
      }
    }

    for (const footprint of buildings) {
      const buildingPolygon = cleanRing(footprintPolygonToWgs84(footprint.polygon));
      if (buildingPolygon.length < 3) continue;
      const buildingBbox = ringBbox(buildingPolygon);
      if (
        nearbyRoadBbox &&
        buildingBbox &&
        !bboxesOverlap(nearbyRoadBbox, buildingBbox)
      ) {
        continue;
      }
      const verticalRelation = classifyVerticalRelation(
        roadArea.vertical,
        footprint,
        verticalClearanceM
      );
      if (verticalRelation === 'separated') continue;
      const overlapsInPlan =
        (!roadBbox || !buildingBbox || bboxesOverlap(roadBbox, buildingBbox)) &&
        polygonsIntersect(roadPolygon, buildingPolygon);
      if (overlapsInPlan) {
        // Polygon clipping and CRS projection are intentionally delayed until
        // the cheap bbox/edge tests confirm a real local overlap. This removes
        // thousands of boolean operations from every road-handle release.
        const overlapPolygon = polygonIntersection(
          roadPolygon,
          buildingPolygon,
          context.metricCrs
        );
        if (verticalRelation === 'uncertain') {
          const placement = roadArea.vertical?.placement ?? 'unknown';
          const layer = roadArea.vertical?.osmLayer;
          addConflict(conflicts, seen, {
            id: `road-fit-building-vertical-${roadArea.id}-${footprint.id}`,
            kind: 'vertical_uncertainty',
            severity: 'warning',
            roadAreaId: roadArea.id,
            affectedId: footprint.id,
            label: `Road area ${roadArea.id} overlaps building ${footprint.id} in plan, but its ${placement} vertical position${
              Number.isFinite(layer) ? ` (OSM layer ${layer})` : ''
            } lacks enough elevation data to confirm a 3D collision.`,
            polygon: overlapPolygon ?? buildingPolygon,
          });
          continue;
        }
        addConflict(conflicts, seen, {
          id: `road-fit-building-${roadArea.id}-${footprint.id}`,
          kind: 'building_overlap',
          severity: 'error',
          roadAreaId: roadArea.id,
          affectedId: footprint.id,
          label:
            roadArea.vertical && roadArea.vertical.placement !== 'surface'
              ? `Road area ${roadArea.id} elevation intersects the vertical range of building ${footprint.id}.`
              : `Road area ${roadArea.id} overlaps building ${footprint.id}.`,
          polygon: overlapPolygon ?? buildingPolygon,
        });
        continue;
      }

      if (buildingClearanceCheckM > 0) {
        const metric = projectRingPairToMeters(roadPolygon, buildingPolygon, context.metricCrs);
        if (!metric) continue;
        const clearanceM = polygonDistanceMeters(metric.a, metric.b);
        if (clearanceM < buildingClearanceCheckM) {
          const blocksInsertion =
            buildingClearanceBlockM > 0 && clearanceM < buildingClearanceBlockM;
          const thresholdM = blocksInsertion
            ? buildingClearanceBlockM
            : buildingClearanceWarningM;
          addConflict(conflicts, seen, {
            id: `road-fit-building-clearance-${roadArea.id}-${footprint.id}`,
            kind: 'building_clearance',
            severity: blocksInsertion ? 'error' : 'warning',
            roadAreaId: roadArea.id,
            affectedId: footprint.id,
            clearanceM,
            label: blocksInsertion
              ? `Road area ${roadArea.id} violates the ${thresholdM.toFixed(
                  2
                )} m hard clearance around building ${footprint.id} (${clearanceM.toFixed(
                  2
                )} m clearance).`
              : `Road area ${roadArea.id} is within ${thresholdM.toFixed(
                  2
                )} m of building ${footprint.id} (${clearanceM.toFixed(2)} m clearance).`,
            polygon: buildingPolygon,
          });
        }
      }
    }

    for (const land of affectedLand) {
      const landPolygon = cleanRing(land.polygon);
      if (landPolygon.length < 3) continue;
      const landBbox = ringBbox(landPolygon);
      if (roadBbox && landBbox && !bboxesOverlap(roadBbox, landBbox)) continue;
      const overlapPolygon = polygonIntersection(roadPolygon, landPolygon, context.metricCrs);
      if (!overlapPolygon && !polygonsIntersect(roadPolygon, landPolygon)) continue;
      addConflict(conflicts, seen, {
        id: `road-fit-land-${roadArea.id}-${land.id}`,
        kind: 'affected_land',
        severity: 'warning',
        roadAreaId: roadArea.id,
        affectedId: land.id,
        label: `Road area ${roadArea.id} affects ${land.label}.`,
        polygon: overlapPolygon ?? landPolygon,
      });
    }
  }

  return conflicts;
}

function ringBbox(ring: [number, number][]): RingBbox | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  return Number.isFinite(west) ? [west, south, east, north] : null;
}

function bboxesOverlap(a: RingBbox, b: RingBbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function expandBboxByMeters(bbox: RingBbox, meters: number): RingBbox {
  if (!(meters > 0)) return bbox;
  const latitude = (bbox[1] + bbox[3]) / 2;
  const latPadding = meters / 111_320;
  const lngPadding =
    meters /
    (111_320 * Math.max(0.01, Math.cos((latitude * Math.PI) / 180)));
  return [
    bbox[0] - lngPadding,
    bbox[1] - latPadding,
    bbox[2] + lngPadding,
    bbox[3] + latPadding,
  ];
}

function classifyVerticalRelation(
  profile: RoadVerticalProfile | undefined,
  footprint: Footprint,
  clearanceM: number
): 'collision' | 'separated' | 'uncertain' {
  // Existing callers without vertical metadata remain surface-level and retain
  // the original blocking behavior.
  if (!profile || profile.placement === 'surface') return 'collision';

  const elevation = profile.elevationM;
  const buildingMin = footprint.baseElevation;
  const buildingMax = footprint.baseElevation + Math.max(0, footprint.height);
  const hasVerticalRange =
    Number.isFinite(elevation) &&
    Number.isFinite(buildingMin) &&
    Number.isFinite(buildingMax);

  if (hasVerticalRange) {
    if (
      (elevation as number) < buildingMin - clearanceM ||
      (elevation as number) > buildingMax + clearanceM
    ) {
      return 'separated';
    }
    return 'collision';
  }

  return 'uncertain';
}

function projectRingPairToMeters(
  a: [number, number][],
  b: [number, number][],
  metricCrs?: string
): { a: MetricPoint[]; b: MetricPoint[] } | null {
  if (metricCrs) {
    try {
      return {
        a: projectRingToCrs(a, metricCrs),
        b: projectRingToCrs(b, metricCrs),
      };
    } catch {
      // Fall through to the local tangent-plane approximation so validation
      // still works for unsupported or malformed CRS metadata.
    }
  }
  return projectRingPairToLocalMeters(a, b);
}

function projectRingToCrs(ring: [number, number][], metricCrs: string): MetricPoint[] {
  return ring.map(([lng, lat]) => {
    const [x, y] = proj4('EPSG:4326', metricCrs, [lng, lat]) as [number, number];
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`Could not project road-fit point into ${metricCrs}`);
    }
    return { x, y };
  });
}

function projectRingPairToLocalMeters(
  a: [number, number][],
  b: [number, number][]
): { a: MetricPoint[]; b: MetricPoint[] } | null {
  const points = [...a, ...b];
  if (points.length === 0) return null;
  const origin = points.reduce(
    (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
    { lng: 0, lat: 0 }
  );
  origin.lng /= points.length;
  origin.lat /= points.length;

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.max(0.01, Math.cos((origin.lat * Math.PI) / 180));
  const project = ([lng, lat]: [number, number]): MetricPoint => ({
    x: (lng - origin.lng) * metersPerDegreeLng,
    y: (lat - origin.lat) * metersPerDegreeLat,
  });
  return { a: a.map(project), b: b.map(project) };
}

function polygonDistanceMeters(a: MetricPoint[], b: MetricPoint[]): number {
  let min = Infinity;
  for (const point of a) {
    min = Math.min(min, distancePointToRingMeters(point, b));
  }
  for (const point of b) {
    min = Math.min(min, distancePointToRingMeters(point, a));
  }
  return min;
}

function distancePointToRingMeters(point: MetricPoint, ring: MetricPoint[]): number {
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    min = Math.min(min, distancePointToSegmentMeters(point, ring[i], ring[(i + 1) % ring.length]));
  }
  return min;
}

function distancePointToSegmentMeters(
  point: MetricPoint,
  a: MetricPoint,
  b: MetricPoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= Number.EPSILON) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function polygonIntersection(
  subject: [number, number][],
  clip: [number, number][],
  metricCrs?: string
): [number, number][] | null {
  const projected = projectRingsForBoolean([subject, clip], metricCrs);
  if (!projected) return null;
  const [subjectRing, clipRing] = projected.rings;
  try {
    return largestExteriorRing(
      intersection(ringToPolygon(subjectRing), ringToPolygon(clipRing)),
      projected.unprojectRing
    );
  } catch {
    return null;
  }
}

function polygonDifference(
  subject: [number, number][],
  clips: [number, number][][],
  metricCrs?: string
): [number, number][] | null {
  if (clips.length === 0) return subject;
  const projected = projectRingsForBoolean([subject, ...clips], metricCrs);
  if (!projected) return null;
  const [subjectRing, ...clipRings] = projected.rings;
  try {
    return largestExteriorRing(
      difference(ringToPolygon(subjectRing), ...clipRings.map(ringToPolygon)),
      projected.unprojectRing
    );
  } catch {
    return null;
  }
}

function projectRingsForBoolean(
  rings: [number, number][][],
  metricCrs?: string
): BooleanProjection | null {
  const cleaned = rings.map(cleanRing).filter((ring) => ring.length >= 3);
  if (cleaned.length !== rings.length) return null;

  if (metricCrs) {
    try {
      const projected = cleaned.map((ring) =>
        ring.map(([lng, lat]) => {
          const [x, y] = proj4('EPSG:4326', metricCrs, [lng, lat]) as [number, number];
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`Could not project road-fit point into ${metricCrs}`);
          }
          return [x, y] as [number, number];
        })
      );
      const unprojectRing = (ring: Ring): [number, number][] =>
        ring.map(([x, y]) => {
          const [lng, lat] = proj4(metricCrs, 'EPSG:4326', [x, y]) as [number, number];
          return [lng, lat];
        });
      return { rings: projected, unprojectRing };
    } catch {
      // Fall back to a local tangent-plane projection so conflict rendering
      // remains available for unsupported CRS metadata.
    }
  }

  const points = cleaned.flat();
  if (points.length === 0) return null;
  const origin = points.reduce(
    (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
    { lng: 0, lat: 0 }
  );
  origin.lng /= points.length;
  origin.lat /= points.length;

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    metersPerDegreeLat * Math.max(0.01, Math.cos((origin.lat * Math.PI) / 180));
  const project = ([lng, lat]: [number, number]): [number, number] => [
    (lng - origin.lng) * metersPerDegreeLng,
    (lat - origin.lat) * metersPerDegreeLat,
  ];
  const unprojectRing = (ring: Ring): [number, number][] =>
    ring.map(([x, y]) => [
      origin.lng + x / metersPerDegreeLng,
      origin.lat + y / metersPerDegreeLat,
    ]);

  return { rings: cleaned.map((ring) => ring.map(project)), unprojectRing };
}

function ringToPolygon(ring: Ring): [Ring] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return [ring];
  if (first[0] === last[0] && first[1] === last[1]) return [ring];
  return [[...ring, first]];
}

function largestExteriorRing(
  multiPolygon: MultiPolygon,
  unprojectRing: (ring: Ring) => [number, number][]
): [number, number][] | null {
  let best: { area: number; ring: [number, number][] } | null = null;
  for (const polygon of multiPolygon) {
    const exterior = polygon[0];
    if (!exterior || exterior.length < 4) continue;
    const area = Math.abs(signedArea(exterior));
    if (area <= Number.EPSILON) continue;
    const ring = cleanRing(unprojectRing(exterior));
    if (ring.length < 3) continue;
    if (!best || area > best.area) best = { area, ring };
  }
  return best?.ring ?? null;
}

function signedArea(ring: Ring): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function addConflict(
  conflicts: RoadFitConflict[],
  seen: Set<string>,
  conflict: RoadFitConflict
): void {
  const key = `${conflict.kind}:${conflict.roadAreaId}:${conflict.affectedId ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);
  conflicts.push(conflict);
}

function polygonInsideAny(
  polygon: [number, number][],
  containers: Array<{ polygon: [number, number][] }>
): boolean {
  return containers.some((container) => {
    const ring = cleanRing(container.polygon);
    return ring.length >= 3 && polygon.every((point) => pointInOrOnPolygon(point, ring));
  });
}

export function polygonsIntersect(a: [number, number][], b: [number, number][]): boolean {
  const ringA = cleanRing(a);
  const ringB = cleanRing(b);
  if (ringA.length < 3 || ringB.length < 3) return false;

  for (const point of ringA) {
    if (pointInPolygon(point, ringB)) return true;
  }
  for (const point of ringB) {
    if (pointInPolygon(point, ringA)) return true;
  }

  for (let i = 0; i < ringA.length; i++) {
    const a1 = ringA[i];
    const a2 = ringA[(i + 1) % ringA.length];
    for (let j = 0; j < ringB.length; j++) {
      const b1 = ringB[j];
      const b2 = ringB[(j + 1) % ringB.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  return false;
}

function cleanRing(ring: [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  for (const point of ring) {
    if (!Array.isArray(point) || point.length !== 2) continue;
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const prev = result[result.length - 1];
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
      result.push([point[0], point[1]]);
    }
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) result.pop();
  return result;
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInOrOnPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (pointOnPolygonBoundary(point, polygon)) return true;
  return pointInPolygon(point, polygon);
}

function pointOnPolygonBoundary(point: [number, number], polygon: [number, number][]): boolean {
  for (let i = 0; i < polygon.length; i++) {
    if (pointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length])) return true;
  }
  return false;
}

function pointOnSegment(
  point: [number, number],
  a: [number, number],
  b: [number, number]
): boolean {
  const crossValue = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  if (Math.abs(crossValue) > 1e-12) return false;
  const minX = Math.min(a[0], b[0]) - 1e-12;
  const maxX = Math.max(a[0], b[0]) + 1e-12;
  const minY = Math.min(a[1], b[1]) - 1e-12;
  const maxY = Math.max(a[1], b[1]) + 1e-12;
  return point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
}

function segmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number]
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orientation(
  a: [number, number],
  b: [number, number],
  c: [number, number]
): number {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : -1;
}
