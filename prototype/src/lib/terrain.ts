import proj4 from 'proj4';
import type { CityJsonDocument } from '../types';
import { extractFootprints, footprintPolygonToWgs84, type Footprint } from './footprints';
import { detectCrs } from './projection';
import { computeTransformedFootprint, type PendingTransform } from './transform-preview';

export interface TerrainSnap {
  sourceBaseElevation: number;
  terrainElevation: number;
  requiredDz: number;
  currentGroundElevation: number;
  difference: number;
  terrainSource:
    | 'containing-building-ground'
    | 'nearest-building-ground'
    | 'current-building-ground';
  matchedBuildingId: string;
  distanceMeters: number;
}

interface ProjectedFootprint {
  id: string;
  baseElevation: number;
  polygon: [number, number][];
  centroid: [number, number];
}

const TERRAIN_MATCH_TOLERANCE_METERS = 0.01;

/**
 * Estimate the ground elevation for a pending building transform.
 *
 * The prototype does not have a dedicated DTM/terrain grid yet. The best
 * available terrain proxy is the CityJSON ground surface data already loaded:
 * first a footprint containing the moved building's centre, then the nearest
 * building ground, and finally the selected building's own current ground.
 */
export function estimateTerrainSnap(
  doc: CityJsonDocument,
  pending: PendingTransform
): TerrainSnap | null {
  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  const footprints = extractFootprints(doc);
  const source = footprints.find((fp) => fp.id === pending.id);
  if (!source) return null;

  const target = computeTransformedFootprint(doc, pending);
  if (!target) return null;

  const targetRing = projectRing(target.polygon, crs.code);
  if (!targetRing || targetRing.length < 3) return null;
  const targetCenter = centroid(targetRing);

  const samples = footprints
    .map((fp) => projectFootprint(fp, crs.code))
    .filter((fp): fp is ProjectedFootprint => fp !== null);

  const otherSamples = samples.filter((sample) => sample.id !== pending.id);
  const containing = nearestByDistance(
    otherSamples.filter((sample) => pointInPolygon(targetCenter, sample.polygon)),
    targetCenter
  );
  const nearest = containing ?? nearestByDistance(otherSamples, targetCenter);
  const own = samples.find((sample) => sample.id === pending.id);
  const matched = nearest ?? own;
  if (!matched) return null;

  const terrainElevation = matched.baseElevation;
  const requiredDz = terrainElevation - source.baseElevation;
  const currentDz = pending.dz ?? 0;
  const currentGroundElevation = source.baseElevation + currentDz;
  const difference = terrainElevation - currentGroundElevation;

  return {
    sourceBaseElevation: source.baseElevation,
    terrainElevation,
    requiredDz,
    currentGroundElevation,
    difference,
    terrainSource: containing
      ? 'containing-building-ground'
      : nearest
      ? 'nearest-building-ground'
      : 'current-building-ground',
    matchedBuildingId: matched.id,
    distanceMeters: distance(targetCenter, matched.centroid),
  };
}

export function snapTransformToTerrain(
  doc: CityJsonDocument,
  pending: PendingTransform
): PendingTransform {
  const snap = estimateTerrainSnap(doc, pending);
  if (!snap) return pending;
  return { ...pending, dz: snap.requiredDz, autoTerrain: true };
}

export function isTerrainMatched(snap: TerrainSnap | null): boolean {
  return !!snap && Math.abs(snap.difference) <= TERRAIN_MATCH_TOLERANCE_METERS;
}

/**
 * Estimate the terrain ground elevation at a given WGS84 point.
 * Used to snap newly imported IFC or created buildings to the local terrain level.
 */
export function estimateTerrainElevationAtPoint(
  doc: CityJsonDocument,
  lngLat: [number, number]
): number {
  const crs = detectCrs(doc);
  if (!crs.supported) return 0;

  const footprints = extractFootprints(doc);
  if (footprints.length === 0) return 0;

  try {
    const pointProjected = proj4('EPSG:4326', crs.code, lngLat) as [number, number];
    const samples = footprints
      .map((fp) => projectFootprint(fp, crs.code))
      .filter((fp): fp is ProjectedFootprint => fp !== null);

    if (samples.length === 0) return 0;

    const containing = nearestByDistance(
      samples.filter((sample) => pointInPolygon(pointProjected, sample.polygon)),
      pointProjected
    );
    const nearest = containing ?? nearestByDistance(samples, pointProjected);
    return nearest ? nearest.baseElevation : 0;
  } catch {
    return 0;
  }
}

function projectFootprint(fp: Footprint, crsCode: string): ProjectedFootprint | null {
  const polygon = projectRing(footprintPolygonToWgs84(fp.polygon), crsCode);
  if (!polygon || polygon.length < 3) return null;
  return {
    id: fp.id,
    baseElevation: fp.baseElevation,
    polygon,
    centroid: centroid(polygon),
  };
}

function projectRing(ring: [number, number][], crsCode: string): [number, number][] | null {
  try {
    const open = ring.slice();
    const first = open[0];
    const last = open[open.length - 1];
    if (first && last && first[0] === last[0] && first[1] === last[1]) open.pop();
    return open.map(
      ([lng, lat]) => proj4('EPSG:4326', crsCode, [lng, lat]) as [number, number]
    );
  } catch {
    return null;
  }
}

function nearestByDistance(
  samples: ProjectedFootprint[],
  target: [number, number]
): ProjectedFootprint | null {
  let best: ProjectedFootprint | null = null;
  let bestDistance = Infinity;
  for (const sample of samples) {
    const d = distance(target, sample.centroid);
    if (d < bestDistance) {
      best = sample;
      bestDistance = d;
    }
  }
  return best;
}

function centroid(ring: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
