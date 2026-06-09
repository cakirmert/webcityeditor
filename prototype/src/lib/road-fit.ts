import { footprintPolygonToWgs84, type Footprint } from './footprints';
import type { RoadArea } from './transportation';
import type { ParcelZone } from './zoning';

export type RoadFitConflictKind =
  | 'outside_corridor'
  | 'building_overlap'
  | 'affected_land';

export interface RoadFitConflict {
  id: string;
  kind: RoadFitConflictKind;
  severity: 'warning' | 'error';
  roadAreaId: string;
  affectedId?: string;
  label: string;
  polygon: [number, number][];
}

export interface RoadFitValidationContext {
  roadAreas: RoadArea[];
  buildingFootprints?: Footprint[];
  affectedLand?: Array<Pick<ParcelZone, 'id' | 'label' | 'polygon'>>;
  allowedCorridors?: Array<{ id: string; label?: string; polygon: [number, number][] }>;
}

export function validateRoadFit(context: RoadFitValidationContext): RoadFitConflict[] {
  const conflicts: RoadFitConflict[] = [];
  const seen = new Set<string>();
  const buildings = context.buildingFootprints ?? [];
  const affectedLand = context.affectedLand ?? [];
  const corridors = context.allowedCorridors ?? [];

  for (const roadArea of context.roadAreas) {
    const roadPolygon = cleanRing(roadArea.polygon);
    if (roadPolygon.length < 3) continue;

    if (corridors.length > 0 && !polygonInsideAny(roadPolygon, corridors)) {
      addConflict(conflicts, seen, {
        id: `road-fit-outside-${roadArea.id}`,
        kind: 'outside_corridor',
        severity: 'warning',
        roadAreaId: roadArea.id,
        label: `${roadArea.id} leaves the available road corridor.`,
        polygon: roadPolygon,
      });
    }

    for (const footprint of buildings) {
      const buildingPolygon = cleanRing(footprintPolygonToWgs84(footprint.polygon));
      if (buildingPolygon.length < 3) continue;
      if (!polygonsIntersect(roadPolygon, buildingPolygon)) continue;
      addConflict(conflicts, seen, {
        id: `road-fit-building-${footprint.id}`,
        kind: 'building_overlap',
        severity: 'error',
        roadAreaId: roadArea.id,
        affectedId: footprint.id,
        label: `Road overlaps building ${footprint.id}.`,
        polygon: buildingPolygon,
      });
    }

    for (const land of affectedLand) {
      const landPolygon = cleanRing(land.polygon);
      if (landPolygon.length < 3) continue;
      if (!polygonsIntersect(roadPolygon, landPolygon)) continue;
      addConflict(conflicts, seen, {
        id: `road-fit-land-${land.id}`,
        kind: 'affected_land',
        severity: 'warning',
        roadAreaId: roadArea.id,
        affectedId: land.id,
        label: `Road affects ${land.label}.`,
        polygon: landPolygon,
      });
    }
  }

  return conflicts;
}

function addConflict(
  conflicts: RoadFitConflict[],
  seen: Set<string>,
  conflict: RoadFitConflict
): void {
  const key = `${conflict.kind}:${conflict.affectedId ?? conflict.roadAreaId}`;
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
    return ring.length >= 3 && polygon.every((point) => pointInPolygon(point, ring));
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
