export interface ParcelZone {
  id: string;
  polygon: [number, number][];
  allowedTypes: string[];
  label: string;
  color: [number, number, number, number];
  source?: string;
  details?: string;
}

/** WGS84 bbox as [west, south, east, north]. All planning providers use this shape. */
export type Wgs84Bbox = [number, number, number, number];

export type PlanningSource = 'hamburg-xplan-baugebiet' | 'hamburg-fnp-nutzung';
export type HamburgPlanningSource = PlanningSource;
export type PlanningProviderId = 'hamburg';

export interface PlanningProvider {
  id: PlanningProviderId;
  label: string;
  coverageLabel: string;
  supportsBbox: (bbox: Wgs84Bbox) => boolean;
  fetchZones: (bbox: Wgs84Bbox, fetchImpl?: typeof fetch) => Promise<ParcelZone[]>;
}

export const HAMBURG_XPLAN_BAUGEBIET_URL =
  'https://api.hamburg.de/datasets/v1/xplan/collections/bp_baugebietsteilflaeche/items';

export const HAMBURG_FNP_WFS_URL = 'https://geodienste.hamburg.de/HH_WFS_FNP';

const HAMBURG_WGS84_BBOX: Wgs84Bbox = [8.1, 53.35, 10.4, 54.05];
export const PLANNING_PAGE_SIZE = 250;
export const MAX_PLANNING_VIEWPORT_SPAN_METERS = 4_500;
export const MAX_PLANNING_FEATURES_PER_SOURCE = 20_000;

export interface PlanningFetchOptions {
  pageSize?: number;
  maxFeatures?: number;
}

const ALL_BUILDING_TYPES = ['residential', 'commercial', 'industrial', 'mixed', 'public'];

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  links?: Array<{
    rel?: unknown;
    href?: unknown;
  }>;
  numberMatched?: unknown;
  numberReturned?: unknown;
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
  bbox: Wgs84Bbox,
  limit = PLANNING_PAGE_SIZE,
  offset = 0
): string {
  const params = new URLSearchParams({
    f: 'json',
    bbox: bbox.join(','),
    limit: String(limit),
  });
  if (offset > 0) params.set('offset', String(offset));
  return `${HAMBURG_XPLAN_BAUGEBIET_URL}?${params.toString()}`;
}

export function buildHamburgFnpNutzungUrl(
  bbox: Wgs84Bbox,
  count = PLANNING_PAGE_SIZE,
  startIndex = 0
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
  if (startIndex > 0) params.set('STARTINDEX', String(startIndex));
  return `${HAMBURG_FNP_WFS_URL}?${params.toString()}`;
}

export function isBboxNearHamburg(bbox: Wgs84Bbox): boolean {
  const [w, s, e, n] = bbox;
  const [hw, hs, he, hn] = HAMBURG_WGS84_BBOX;
  return w <= he && e >= hw && s <= hn && n >= hs;
}

export function planningBboxSizeMeters(
  bbox: Wgs84Bbox
): { widthMeters: number; heightMeters: number } {
  const [west, south, east, north] = bbox;
  const latitude = (south + north) / 2;
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos((latitude * Math.PI) / 180);
  return {
    widthMeters: Math.abs(east - west) * Math.abs(metersPerDegreeLongitude),
    heightMeters: Math.abs(north - south) * metersPerDegreeLatitude,
  };
}

export function isPlanningBboxLoadable(
  bbox: Wgs84Bbox,
  maxSpanMeters = MAX_PLANNING_VIEWPORT_SPAN_METERS
): boolean {
  const { widthMeters, heightMeters } = planningBboxSizeMeters(bbox);
  return widthMeters <= maxSpanMeters && heightMeters <= maxSpanMeters;
}

function assertPlanningBboxLoadable(bbox: Wgs84Bbox): void {
  if (isPlanningBboxLoadable(bbox)) return;
  const { widthMeters, heightMeters } = planningBboxSizeMeters(bbox);
  throw new Error(
    `Planning view is ${(widthMeters / 1_000).toFixed(1)} x ${(heightMeters / 1_000).toFixed(1)} km. ` +
      `Zoom in below ${(MAX_PLANNING_VIEWPORT_SPAN_METERS / 1_000).toFixed(1)} km per side and click Planning again.`
  );
}

/**
 * Provider registry for planning overlays.
 *
 * XPlanung is a Germany-wide standard, but the actual public WFS/OGC API
 * endpoints are usually published by municipalities or states. Keeping a
 * provider list here lets the app stay generic while we add more regions one
 * at a time.
 */
export const PLANNING_PROVIDERS: readonly PlanningProvider[] = [
  {
    id: 'hamburg',
    label: 'Hamburg planning services',
    coverageLabel: 'Hamburg',
    supportsBbox: isBboxNearHamburg,
    fetchZones: fetchHamburgPlanningZones,
  },
];

export function getPlanningProviderForBbox(bbox: Wgs84Bbox): PlanningProvider | null {
  return PLANNING_PROVIDERS.find((provider) => provider.supportsBbox(bbox)) ?? null;
}

export function isPlanningBboxSupported(bbox: Wgs84Bbox): boolean {
  return getPlanningProviderForBbox(bbox) !== null;
}

export function planningCoverageSummary(): string {
  return PLANNING_PROVIDERS.map((provider) => provider.coverageLabel).join(', ');
}

export function planningSourceLabel(source?: string): string {
  if (source === 'hamburg-xplan-baugebiet') return 'XPlan land-use layer';
  if (source === 'hamburg-fnp-nutzung') return 'FNP land-use layer';
  return source ?? 'Unknown';
}

function planningSourcePriority(source?: string): number {
  if (source === 'hamburg-xplan-baugebiet') return 2;
  if (source === 'hamburg-fnp-nutzung') return 1;
  return 0;
}

export async function fetchPlanningZones(
  bbox: Wgs84Bbox,
  fetchImpl: typeof fetch = fetch
): Promise<ParcelZone[]> {
  const provider = getPlanningProviderForBbox(bbox);
  if (!provider) {
    throw new Error('No planning provider is available for this area.');
  }
  assertPlanningBboxLoadable(bbox);
  return provider.fetchZones(bbox, fetchImpl);
}

export async function fetchHamburgPlanningZones(
  bbox: Wgs84Bbox,
  fetchImpl: typeof fetch = fetch
): Promise<ParcelZone[]> {
  const [xplanZones, fnpZones] = await Promise.all([
    fetchHamburgXPlanZones(bbox, fetchImpl),
    fetchHamburgFnpZones(bbox, fetchImpl),
  ]);

  // Draw broad FNP coverage first and detailed XPlan polygons last. Point
  // queries apply their own source priority, so XPlan remains authoritative
  // wherever both sources overlap.
  return [...fnpZones, ...xplanZones];
}

export async function fetchHamburgXPlanZones(
  bbox: Wgs84Bbox,
  fetchImpl: typeof fetch = fetch,
  options: PlanningFetchOptions = {}
): Promise<ParcelZone[]> {
  const { pageSize, maxFeatures } = normalizePlanningFetchOptions(options);
  let nextUrl: string | null = buildHamburgXPlanBaugebietUrl(bbox, pageSize);
  const features: GeoJsonFeature[] = [];
  const seenUrls = new Set<string>();
  const seenPageSignatures = new Set<string>();

  while (nextUrl) {
    if (seenUrls.has(nextUrl)) {
      throw planningPaginationError('XPlan returned a repeated next-page URL');
    }
    seenUrls.add(nextUrl);

    const page = await fetchPlanningPage(nextUrl, 'XPlan', fetchImpl);
    assertPlanningPageProgress(page.features, 'hamburg-xplan-baugebiet', seenPageSignatures);
    appendPlanningFeatures(features, page.features, maxFeatures, 'XPlan');

    const linkedNext = nextPlanningLink(page, nextUrl);
    const numberMatched = finiteCount(page.numberMatched);
    const hasMoreByCount = numberMatched !== null && features.length < numberMatched;
    const hasPossiblyFullPage = numberMatched === null && page.features.length >= pageSize;
    if (linkedNext) {
      nextUrl = linkedNext;
    } else if (hasMoreByCount || hasPossiblyFullPage) {
      if (page.features.length === 0) {
        throw planningPaginationError('XPlan reported more features but returned an empty page');
      }
      nextUrl = buildHamburgXPlanBaugebietUrl(bbox, pageSize, features.length);
    } else {
      nextUrl = null;
    }
  }

  return zonesFromPlanningGeoJson(
    { type: 'FeatureCollection', features: dedupePlanningFeatures(features, 'hamburg-xplan-baugebiet') },
    'hamburg-xplan-baugebiet'
  );
}

export async function fetchHamburgFnpZones(
  bbox: Wgs84Bbox,
  fetchImpl: typeof fetch = fetch,
  options: PlanningFetchOptions = {}
): Promise<ParcelZone[]> {
  const { pageSize, maxFeatures } = normalizePlanningFetchOptions(options);
  const features: GeoJsonFeature[] = [];
  const seenPageSignatures = new Set<string>();
  let startIndex = 0;

  while (true) {
    const url = buildHamburgFnpNutzungUrl(bbox, pageSize, startIndex);
    const page = await fetchPlanningPage(url, 'FNP', fetchImpl);
    assertPlanningPageProgress(page.features, 'hamburg-fnp-nutzung', seenPageSignatures);
    appendPlanningFeatures(features, page.features, maxFeatures, 'FNP');
    if (page.features.length < pageSize) break;
    startIndex += page.features.length;
  }

  return zonesFromPlanningGeoJson(
    { type: 'FeatureCollection', features: dedupePlanningFeatures(features, 'hamburg-fnp-nutzung') },
    'hamburg-fnp-nutzung'
  );
}

async function fetchPlanningPage(
  url: string,
  label: string,
  fetchImpl: typeof fetch
): Promise<GeoJsonFeatureCollection> {
  const resp = await fetchImpl(url);
  if (!resp.ok) throw new Error(`${label} planning request failed: HTTP ${resp.status} ${resp.statusText}`);
  const json = (await resp.json()) as unknown;
  if (!isFeatureCollection(json)) {
    throw new Error(`${label} planning response was not a GeoJSON FeatureCollection.`);
  }
  return json;
}

function normalizePlanningFetchOptions(
  options: PlanningFetchOptions
): { pageSize: number; maxFeatures: number } {
  const pageSize = Math.floor(options.pageSize ?? PLANNING_PAGE_SIZE);
  const maxFeatures = Math.floor(options.maxFeatures ?? MAX_PLANNING_FEATURES_PER_SOURCE);
  if (!Number.isFinite(pageSize) || pageSize < 1) {
    throw new Error('Planning page size must be a positive integer.');
  }
  if (!Number.isFinite(maxFeatures) || maxFeatures < 1) {
    throw new Error('Planning feature limit must be a positive integer.');
  }
  return { pageSize, maxFeatures };
}

function appendPlanningFeatures(
  target: GeoJsonFeature[],
  page: GeoJsonFeature[],
  maxFeatures: number,
  label: string
): void {
  if (target.length + page.length > maxFeatures) {
    throw planningPaginationError(
      `${label} matched more than ${maxFeatures.toLocaleString()} features`
    );
  }
  target.push(...page);
}

function planningPaginationError(reason: string): Error {
  return new Error(`${reason}. Zoom in and click Planning again; no partial planning layer was loaded.`);
}

function assertPlanningPageProgress(
  features: GeoJsonFeature[],
  source: HamburgPlanningSource,
  seenPageSignatures: Set<string>
): void {
  if (features.length === 0) return;
  const identities = features.map((feature) => planningFeatureIdentity(feature)).join('\u001f');
  const signature = `${features.length}:${hashString(`${source}:${identities}`)}`;
  if (seenPageSignatures.has(signature)) {
    throw planningPaginationError(`${planningSourceLabel(source)} returned a repeated page`);
  }
  seenPageSignatures.add(signature);
}

function nextPlanningLink(page: GeoJsonFeatureCollection, currentUrl: string): string | null {
  const link = page.links?.find(
    (candidate) => typeof candidate.rel === 'string' && candidate.rel.toLowerCase() === 'next'
  );
  return typeof link?.href === 'string' && link.href.trim()
    ? new URL(link.href, currentUrl).toString()
    : null;
}

function finiteCount(value: unknown): number | null {
  const count = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(count) && count >= 0 ? count : null;
}

function dedupePlanningFeatures(
  features: GeoJsonFeature[],
  source: HamburgPlanningSource
): GeoJsonFeature[] {
  const seen = new Set<string>();
  const unique: GeoJsonFeature[] = [];
  for (const feature of features) {
    const key = `${source}:${planningFeatureIdentity(feature)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(feature);
  }
  return unique;
}

function planningFeatureIdentity(feature: GeoJsonFeature): string {
  if (typeof feature.id === 'string' || typeof feature.id === 'number') {
    return String(feature.id);
  }
  const props = feature.properties ?? {};
  for (const key of ['gml_id', 'gml:id', 'fid', 'id', 'objectid', 'OBJECTID', 'uuid', 'UUID']) {
    const value = props[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return `anonymous-${hashString(stableSerialize({ geometry: feature.geometry, properties: props }))}`;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
      .join(',')}}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return 'null';
}

export function zonesFromPlanningGeoJson(
  input: unknown,
  source: HamburgPlanningSource
): ParcelZone[] {
  if (!isFeatureCollection(input)) return [];
  const zones: ParcelZone[] = [];
  const seenFeatures = new Set<string>();

  input.features.forEach((feature) => {
    const featureIdentity = planningFeatureIdentity(feature);
    if (seenFeatures.has(featureIdentity)) return;
    seenFeatures.add(featureIdentity);
    const rings = ringsFromGeometry(feature.geometry);
    rings.forEach((polygon, ringIndex) => {
      if (polygon.length < 4) return;
      zones.push(
        zoneFromFeature(feature, polygon, source, featureIdentity, ringIndex, rings.length)
      );
    });
  });

  return zones;
}

export function findZoneForPoint(
  zones: ParcelZone[],
  point: [number, number]
): ParcelZone | null {
  let bestZone: ParcelZone | null = null;
  for (const zone of zones) {
    if (!pointInPolygon(point, zone.polygon)) continue;
    if (!bestZone || planningSourcePriority(zone.source) > planningSourcePriority(bestZone.source)) {
      bestZone = zone;
    }
  }
  return bestZone;
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
    if (
      distance < bestDistance - 1e-6 ||
      (Math.abs(distance - bestDistance) <= 1e-6 &&
        planningSourcePriority(zone.source) > planningSourcePriority(bestZone?.source))
    ) {
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
  featureIdentity: string,
  ringIndex: number,
  ringCount: number
): ParcelZone {
  const props = feature.properties ?? {};
  const label = labelFromProperties(props, source);
  const allowedTypes = allowedTypesFromProperties(props);
  return {
    id: `${source}:${featureIdentity}${ringCount > 1 ? `:polygon-${ringIndex + 1}` : ''}`,
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
  source: PlanningSource
): string {
  if (source === 'hamburg-fnp-nutzung') {
    return getStringProp(props, ['nutzungstext', 'nutzung', 'prae']) ?? 'FNP planning area';
  }

  return (
    getStringProp(props, [
      'besondereArtDerBaulNutzungWert',
      'allgArtDerBaulNutzungWert',
      'xpPlanName',
    ]) ?? 'XPlan planning area'
  );
}

function detailsFromProperties(
  props: Record<string, unknown>,
  source: PlanningSource
): string {
  const parts: string[] = [
    source === 'hamburg-fnp-nutzung'
      ? 'FNP land-use layer'
      : 'XPlan BP_BaugebietsTeilFlaeche',
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
  // The source services expose German planning terms, not CityJSON functions.
  // Keep this mapping conservative: unknown built-up uses allow all building
  // types, while parks/water/transport map to an empty allow-list.
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
