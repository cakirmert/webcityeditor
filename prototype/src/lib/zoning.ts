export interface ParcelZone {
  id: string;
  polygon: [number, number][];
  allowedTypes: string[];
  label: string;
  color: [number, number, number, number];
  source?: string;
  details?: string;
}

export type HamburgPlanningSource = 'hamburg-xplan-baugebiet' | 'hamburg-fnp-nutzung';

export const HAMBURG_XPLAN_BAUGEBIET_URL =
  'https://api.hamburg.de/datasets/v1/xplan/collections/bp_baugebietsteilflaeche/items';

export const HAMBURG_FNP_WFS_URL = 'https://geodienste.hamburg.de/HH_WFS_FNP';

const HAMBURG_WGS84_BBOX: [number, number, number, number] = [8.1, 53.35, 10.4, 54.05];

const ALL_BUILDING_TYPES = ['residential', 'commercial', 'industrial', 'mixed', 'public'];

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry?: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
}

type GeoJsonGeometry =
  | {
      type: 'Polygon';
      coordinates: unknown;
    }
  | {
      type: 'MultiPolygon';
      coordinates: unknown;
    };

export function buildHamburgXPlanBaugebietUrl(
  bbox: [number, number, number, number],
  limit = 250
): string {
  const params = new URLSearchParams({
    f: 'json',
    bbox: bbox.join(','),
    limit: String(limit),
  });
  return `${HAMBURG_XPLAN_BAUGEBIET_URL}?${params.toString()}`;
}

export function buildHamburgFnpNutzungUrl(
  bbox: [number, number, number, number],
  count = 250
): string {
  const params = new URLSearchParams({
    SERVICE: 'WFS',
    VERSION: '2.0.0',
    REQUEST: 'GetFeature',
    TYPENAMES: 'de.hh.up:fnp_nutzung',
    SRSNAME: 'EPSG:4326',
    OUTPUTFORMAT: 'application/geo+json',
    BBOX: `${bbox.join(',')},EPSG:4326`,
    COUNT: String(count),
  });
  return `${HAMBURG_FNP_WFS_URL}?${params.toString()}`;
}

export function isBboxNearHamburg(bbox: [number, number, number, number]): boolean {
  const [w, s, e, n] = bbox;
  const [hw, hs, he, hn] = HAMBURG_WGS84_BBOX;
  return w <= he && e >= hw && s <= hn && n >= hs;
}

export async function fetchHamburgPlanningZones(
  bbox: [number, number, number, number],
  fetchImpl: typeof fetch = fetch
): Promise<ParcelZone[]> {
  let firstError: unknown;
  try {
    const zones = await fetchPlanningSource(
      buildHamburgXPlanBaugebietUrl(bbox),
      'hamburg-xplan-baugebiet',
      fetchImpl
    );
    if (zones.length > 0) return zones;
  } catch (e) {
    firstError = e;
  }

  try {
    return await fetchPlanningSource(
      buildHamburgFnpNutzungUrl(bbox),
      'hamburg-fnp-nutzung',
      fetchImpl
    );
  } catch (e) {
    if (firstError) throw firstError;
    throw e;
  }
}

async function fetchPlanningSource(
  url: string,
  source: HamburgPlanningSource,
  fetchImpl: typeof fetch
): Promise<ParcelZone[]> {
  const resp = await fetchImpl(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const json = (await resp.json()) as unknown;
  return zonesFromPlanningGeoJson(json, source);
}

export function zonesFromPlanningGeoJson(
  input: unknown,
  source: HamburgPlanningSource
): ParcelZone[] {
  if (!isFeatureCollection(input)) return [];
  const zones: ParcelZone[] = [];

  input.features.forEach((feature, featureIndex) => {
    const rings = ringsFromGeometry(feature.geometry);
    rings.forEach((polygon, ringIndex) => {
      if (polygon.length < 4) return;
      zones.push(zoneFromFeature(feature, polygon, source, featureIndex, ringIndex));
    });
  });

  return zones;
}

export function findZoneForPoint(
  zones: ParcelZone[],
  point: [number, number]
): ParcelZone | null {
  for (const zone of zones) {
    if (pointInPolygon(point, zone.polygon)) return zone;
  }
  return null;
}

export function findNearestZoneForPoint(
  zones: ParcelZone[],
  point: [number, number],
  maxDistanceMeters: number
): ParcelZone | null {
  let bestZone: ParcelZone | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const distance = distanceToPolygonMeters(point, zone.polygon);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestZone = zone;
    }
  }

  return bestZone && bestDistance <= maxDistanceMeters ? bestZone : null;
}

export function validateBuildingType(
  zone: ParcelZone | null,
  buildingFunction: string
): { allowed: boolean; reason?: string } {
  if (!zone) return { allowed: true };
  if (zone.allowedTypes.includes(buildingFunction)) return { allowed: true };
  const allowed =
    zone.allowedTypes.length > 0 ? zone.allowedTypes.join(', ') : 'no mapped building types';
  return {
    allowed: false,
    reason: `"${buildingFunction}" buildings are not compatible with ${zone.label}. Allowed: ${allowed}.`,
  };
}

function zoneFromFeature(
  feature: GeoJsonFeature,
  polygon: [number, number][],
  source: HamburgPlanningSource,
  featureIndex: number,
  ringIndex: number
): ParcelZone {
  const props = feature.properties ?? {};
  const label = labelFromProperties(props, source);
  const allowedTypes = allowedTypesFromProperties(props);
  return {
    id: String(feature.id ?? `${source}-${featureIndex}-${ringIndex}`),
    polygon,
    allowedTypes,
    label,
    color: colorForAllowedTypes(allowedTypes, label),
    source,
    details: detailsFromProperties(props, source),
  };
}

function labelFromProperties(
  props: Record<string, unknown>,
  source: HamburgPlanningSource
): string {
  if (source === 'hamburg-fnp-nutzung') {
    return getStringProp(props, ['nutzungstext', 'nutzung', 'prae']) ?? 'Hamburg FNP area';
  }

  return (
    getStringProp(props, [
      'besondereArtDerBaulNutzungWert',
      'allgArtDerBaulNutzungWert',
      'xpPlanName',
    ]) ?? 'Hamburg XPlan area'
  );
}

function detailsFromProperties(
  props: Record<string, unknown>,
  source: HamburgPlanningSource
): string {
  const parts: string[] = [
    source === 'hamburg-fnp-nutzung'
      ? 'Hamburg FNP land-use layer'
      : 'Hamburg XPlan BP_BaugebietsTeilFlaeche',
  ];

  for (const key of ['xpPlanName', 'xpPlanDate', 'rechtsstandWert', 'GRZ', 'GFZ', 'Z']) {
    const value = props[key];
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${key}: ${String(value)}`);
    }
  }

  return parts.join(' | ');
}

function allowedTypesFromProperties(props: Record<string, unknown>): string[] {
  const text =
    getStringProp(props, [
      'besondereArtDerBaulNutzungWert',
      'allgArtDerBaulNutzungWert',
      'nutzungstext',
      'nutzung',
      'prae',
    ]) ?? '';

  const value = normalizePlanningText(text);
  if (/(grun|wald|wasser|verkehr|bahn|landwirtschaft|park|natur|freiraum|schutz)/.test(value)) {
    return [];
  }
  if (/(industrie|hafen|logistik)/.test(value)) return ['industrial', 'commercial'];
  if (/(gewerb|geschaft|handel)/.test(value)) return ['commercial', 'mixed'];
  if (/(gemeinbedarf|schule|kirche|sport|kultur|verwaltung)/.test(value)) return ['public'];
  if (/(kerngebiet|gemischt|mischgebiet|urban|dorfgebiet)/.test(value)) {
    return ['mixed', 'commercial', 'residential', 'public'];
  }
  if (/(wohnen|wohn)/.test(value)) return ['residential', 'mixed'];

  return ALL_BUILDING_TYPES;
}

function normalizePlanningText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .toLowerCase();
}

function colorForAllowedTypes(
  allowedTypes: string[],
  label: string
): [number, number, number, number] {
  const text = normalizePlanningText(label);
  if (allowedTypes.length === 0) return [80, 115, 115, 75];
  if (allowedTypes.includes('industrial')) return [190, 125, 75, 85];
  if (allowedTypes.includes('commercial') && !allowedTypes.includes('residential')) {
    return [215, 165, 75, 85];
  }
  if (allowedTypes.includes('public')) return [125, 145, 205, 85];
  if (allowedTypes.includes('mixed') || /kerngebiet|gemischt|misch/.test(text)) {
    return [90, 135, 200, 85];
  }
  if (allowedTypes.includes('residential')) return [90, 170, 115, 85];
  return [150, 150, 150, 75];
}

function getStringProp(props: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function isFeatureCollection(input: unknown): input is GeoJsonFeatureCollection {
  return (
    typeof input === 'object' &&
    input !== null &&
    (input as { type?: unknown }).type === 'FeatureCollection' &&
    Array.isArray((input as { features?: unknown }).features)
  );
}

function ringsFromGeometry(geometry: GeoJsonFeature['geometry']): [number, number][][] {
  if (!geometry || typeof geometry !== 'object') return [];
  if (geometry.type === 'Polygon') {
    const ring = normalizeRing(firstPolygonRing(geometry.coordinates));
    return ring ? [ring] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates)) return [];
    return geometry.coordinates
      .map((polygon) => normalizeRing(firstPolygonRing(polygon)))
      .filter((ring): ring is [number, number][] => !!ring);
  }
  return [];
}

function firstPolygonRing(value: unknown): unknown {
  if (!Array.isArray(value)) return null;
  return value[0];
}

function normalizeRing(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const ring: [number, number][] = [];

  for (const raw of value) {
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const [lng, lat] = raw;
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    const prev = ring[ring.length - 1];
    if (prev && prev[0] === lng && prev[1] === lat) continue;
    ring.push([lng, lat]);
  }

  if (ring.length < 3) return null;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring.length >= 4 ? ring : null;
}

function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToPolygonMeters(point: [number, number], polygon: [number, number][]): number {
  if (polygon.length === 0) return Number.POSITIVE_INFINITY;
  const p = toLocalMeters(point, point[1]);
  let best = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polygon.length; i++) {
    const aRaw = polygon[i];
    const bRaw = polygon[(i + 1) % polygon.length];
    if (!aRaw || !bRaw) continue;
    const a = toLocalMeters(aRaw, point[1]);
    const b = toLocalMeters(bRaw, point[1]);
    best = Math.min(best, distancePointToSegmentMeters(p, a, b));
  }

  return best;
}

function toLocalMeters(point: [number, number], latRef: number): [number, number] {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((latRef * Math.PI) / 180);
  return [point[0] * mPerDegLng, point[1] * mPerDegLat];
}

function distancePointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const wx = p[0] - a[0];
  const wy = p[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  const x = a[0] + t * vx;
  const y = a[1] + t * vy;
  return Math.hypot(p[0] - x, p[1] - y);
}

export function getZoneCenter(zones: ParcelZone[]): [number, number] | null {
  if (zones.length === 0) return null;
  let sx = 0,
    sy = 0,
    n = 0;
  for (const z of zones) {
    for (const [x, y] of z.polygon) {
      sx += x;
      sy += y;
      n++;
    }
  }
  return n > 0 ? [sx / n, sy / n] : null;
}
