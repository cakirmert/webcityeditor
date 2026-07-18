import proj4 from 'proj4';
import type { JsonValue } from '../types';
import './projection';
import type {
  OsmRoadFeature,
  RoadBand,
  RoadBandKind,
  RoadDirection,
  RoadDraft,
} from './transportation';
import { DEFAULT_ROAD_CURVE, inferRoadVerticalProfileFromOsmTags } from './transportation';
import type { Osm2StreetsFeature, Osm2StreetsResult, Osm2StreetsSelection } from './osm2streets';

export interface Osm2StreetsDraftBuildResult {
  draft: RoadDraft;
  matchedOsmRoad: OsmRoadFeature | null;
}

export interface TrafficAreaPolygonAsset {
  id: string;
  name?: string;
  source: 'osm2streets';
  crsUri: string;
  roadId: string;
  sectionId: string;
  trafficSpaceId: string;
  trafficAreaId: string;
  laneType: string;
  trafficDirection: RoadDirection;
  granularity: 'lane' | 'road_section' | 'intersection';
  centerLineRole: 'derived_from_osm' | 'derived_from_osm2streets' | 'manual';
  centerLine: [number, number, number][];
  widthMeters?: number;
  surfacePolygon: [number, number, number][];
  surfaceHoles?: [number, number, number][][];
  functionCode: string;
  functionLabel: string;
  usageCode: string;
  usageLabel: string;
  osmWayIds?: string[];
  osmNodeIds?: string[];
  osm2streetsRoadId?: string;
  osm2streetsLaneIndex?: number;
  tags?: Record<string, string>;
}

export interface Osm2StreetsRoadLaneAsset extends TrafficAreaPolygonAsset {
  laneIndex: number;
  band: RoadBand;
  ringsWgs84: [number, number][][];
  properties: Record<string, JsonValue>;
}

export interface Osm2StreetsRoadAssets {
  roadId: string;
  matchedOsmRoad: OsmRoadFeature | null;
  sourceOsmWayIds: Array<string | number>;
  lanes: Osm2StreetsRoadLaneAsset[];
}

export interface Osm2StreetsRoadAssetOptions {
  crsCode: string;
  elevationM?: number;
}

interface Osm2StreetsRoadSourceLane {
  id: string;
  roadId: number | string;
  laneIndex: number;
  band: RoadBand;
  ringsWgs84: [number, number][][];
  sourceOsmWayIds: Array<string | number>;
  properties: Record<string, JsonValue>;
}

interface Osm2StreetsRoadSourceAssets {
  roadId: number | string;
  matchedOsmRoad: OsmRoadFeature | null;
  sourceOsmWayIds: Array<string | number>;
  lanes: Osm2StreetsRoadSourceLane[];
}

export function buildRoadDraftFromOsm2StreetsSelection(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult,
  osmRoads: OsmRoadFeature[]
): Osm2StreetsDraftBuildResult {
  if (!selection || selection.kind !== 'lane') {
    throw new Error('Select an osm2streets lane before creating an editable road draft.');
  }
  const roadAssets = collectOsm2StreetsRoadSourceAssets(selection, result, osmRoads);
  const siblingLanes = collectSiblingLaneFeatures(selection, result);
  const selectedProps = selection?.feature.properties ?? {};
  const matchedOsmRoad = roadAssets.matchedOsmRoad;
  const centerlineWgs84 =
    matchedOsmRoad?.path ?? centerlineFromFeature(selection.feature) ?? centerlineFromFeature(siblingLanes[0]);

  if (!centerlineWgs84 || centerlineWgs84.length < 2) {
    throw new Error('Could not derive an editable centerline from the selected osm2streets lane.');
  }

  if (roadAssets.lanes.length === 0) {
    throw new Error('Selected osm2streets road did not contain editable lane bands.');
  }

  const maxspeedKmh = parseSpeedKmh(selectedProps.speed_limit);
  const sourceOsmWayId = roadAssets.sourceOsmWayIds[0] ?? matchedOsmRoad?.osmWayId;

  return {
    matchedOsmRoad,
    draft: {
      id: `osm2streets-road-${roadAssets.roadId}`,
      name: matchedOsmRoad?.tags.name ?? `osm2streets road ${roadAssets.roadId}`,
      source: 'osm',
      sourceOsmWayId,
      osmTags: matchedOsmRoad?.tags,
      vertical: inferRoadVerticalProfileFromOsmTags(matchedOsmRoad?.tags ?? {}),
      userVerified: false,
      sections: [
        {
          id: `osm2streets-road-${roadAssets.roadId}-section-1`,
          centerlineWgs84,
          maxspeedKmh,
          curve: { ...DEFAULT_ROAD_CURVE },
          bands: roadAssets.lanes.map((lane) => lane.band),
        },
      ],
    },
  };
}

export function buildOsm2StreetsRoadAssets(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult,
  osmRoads: OsmRoadFeature[],
  options: Osm2StreetsRoadAssetOptions
): Osm2StreetsRoadAssets {
  const sourceAssets = collectOsm2StreetsRoadSourceAssets(selection, result, osmRoads);
  const elevationM = Number.isFinite(options.elevationM) ? options.elevationM ?? 0 : 0;
  const roadId = String(sourceAssets.roadId);
  const sourceCenterlineWgs84 =
    sourceAssets.matchedOsmRoad?.path ??
    centerlineFromFeature(selection?.feature) ??
    centerlineFromFeature(result.lanes.features.find((feature) => feature.properties?.road === sourceAssets.roadId)) ??
    [];
  const centerLineRole = sourceAssets.matchedOsmRoad
    ? 'derived_from_osm'
    : 'derived_from_osm2streets';
  const centerLine = projectLineToCrs(sourceCenterlineWgs84, options.crsCode, elevationM);
  const sectionId = `osm2streets-road-${roadId}-section-1`;
  const crsUri = crsUriForCode(options.crsCode);
  const lanes = sourceAssets.lanes.map((lane) => {
    const projectedRings = lane.ringsWgs84.map((ring) =>
      projectClosedRingToCrs(ring, options.crsCode, elevationM)
    );
    const surfacePolygon = projectedRings[0];
    if (!surfacePolygon || surfacePolygon.length < 4) {
      throw new Error(`osm2streets lane ${lane.id} did not produce a valid metric surface polygon.`);
    }
    const laneType = String(lane.properties.type ?? lane.band.kind);
    const trafficAreaId = `osm2streets-road-${roadId}-lane-${lane.laneIndex}`;
    return {
      id: trafficAreaId,
      name: sourceAssets.matchedOsmRoad?.tags.name,
      source: 'osm2streets' as const,
      crsUri,
      roadId,
      sectionId,
      trafficSpaceId: `osm2streets-road-${roadId}`,
      trafficAreaId,
      laneType,
      trafficDirection: lane.band.direction ?? 'none',
      granularity: 'lane' as const,
      centerLineRole: centerLineRole as TrafficAreaPolygonAsset['centerLineRole'],
      centerLine,
      widthMeters: lane.band.widthM,
      surfacePolygon,
      ...(projectedRings.length > 1 ? { surfaceHoles: projectedRings.slice(1) } : {}),
      functionCode: functionCodeForBand(lane.band.kind),
      functionLabel: functionLabelForBand(lane.band.kind),
      usageCode: lane.band.kind,
      usageLabel: usageLabelForBand(lane.band.kind),
      ...(lane.sourceOsmWayIds.length > 0
        ? { osmWayIds: lane.sourceOsmWayIds.map(String) }
        : {}),
      ...osmNodeIdsFromProperties(lane.properties),
      osm2streetsRoadId: roadId,
      osm2streetsLaneIndex: lane.laneIndex,
      ...(sourceAssets.matchedOsmRoad?.tags
        ? { tags: { ...sourceAssets.matchedOsmRoad.tags } }
        : {}),
      laneIndex: lane.laneIndex,
      band: lane.band,
      ringsWgs84: lane.ringsWgs84,
      properties: lane.properties,
    };
  });

  return {
    roadId,
    matchedOsmRoad: sourceAssets.matchedOsmRoad,
    sourceOsmWayIds: sourceAssets.sourceOsmWayIds,
    lanes,
  };
}

function collectOsm2StreetsRoadSourceAssets(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult,
  osmRoads: OsmRoadFeature[]
): Osm2StreetsRoadSourceAssets {
  if (!selection || selection.kind !== 'lane') {
    throw new Error('Select an osm2streets lane before converting it to road surfaces.');
  }

  const selectedProps = selection.feature.properties ?? {};
  const roadId = selectedProps.road;
  if (roadId === undefined || roadId === null) {
    throw new Error('Selected osm2streets lane has no road id.');
  }

  const siblingLanes = collectSiblingLaneFeatures(selection, result);
  const sourceOsmWayIds = collectOsmWayIds(siblingLanes.length ? siblingLanes : [selection.feature]);
  const matchedOsmRoad = findMatchingOsmRoad(osmRoads, sourceOsmWayIds);
  const lanes = siblingLanes
    .map((feature, index) => {
      const band = roadBandFromLaneFeature(feature, index);
      const ringsWgs84 = ringsFromPolygonFeature(feature);
      if (!band || ringsWgs84.length === 0) return null;
      const laneIndex = numberValue(feature.properties?.index);
      return {
        id: `${roadId}-lane-${laneIndex || index}`,
        roadId,
        laneIndex,
        band,
        ringsWgs84,
        sourceOsmWayIds: collectOsmWayIds([feature]),
        properties: jsonRecord(feature.properties ?? {}),
      };
    })
    .filter((lane): lane is Osm2StreetsRoadSourceLane => !!lane);

  if (lanes.length === 0) {
    throw new Error('Selected osm2streets road did not contain convertible lane polygons.');
  }

  return {
    roadId,
    matchedOsmRoad,
    sourceOsmWayIds,
    lanes,
  };
}

export function roadBandFromLaneFeature(feature: Osm2StreetsFeature, index: number): RoadBand | null {
  const props = feature.properties ?? {};
  const sourceType = String(props.type ?? '');
  const kind = roadBandKindFromLaneType(sourceType);
  if (!kind) return null;
  const widthM = typeof props.width === 'number' && Number.isFinite(props.width) ? props.width : 1;
  const maxspeedKmh = parseSpeedKmh(props.speed_limit);

  return {
    id: `osm2streets-${kind}-${index}`,
    kind,
    sourceType,
    widthM: Math.max(0.4, widthM),
    direction: roadDirectionFromLaneDirection(String(props.direction ?? '')),
    allowedModes: allowedModesForLaneType(String(props.type ?? '')),
    maxspeedKmh: kind === 'car_lane' ? maxspeedKmh : undefined,
  };
}

function collectSiblingLaneFeatures(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult
): Osm2StreetsFeature[] {
  if (!selection || selection.kind !== 'lane') return [];
  const roadId = selection.feature.properties?.road;
  return result.lanes.features
    .filter((feature) => feature.properties?.road === roadId)
    .sort((a, b) => numberValue(a.properties?.index) - numberValue(b.properties?.index));
}

function roadBandKindFromLaneType(type: string): RoadBandKind | null {
  const key = normalizeType(type);
  if (key === 'driving' || key === 'bus' || key === 'lightrail' || key === 'construction') {
    return 'car_lane';
  }
  if (key === 'biking' || key === 'bike' || key === 'cycleway') return 'bike_lane';
  if (key === 'sidewalk' || key === 'footway' || key === 'shoulder' || key === 'shareduse') {
    return 'sidewalk';
  }
  if (key.includes('parking')) return 'parking';
  if (key.includes('buffer')) return 'median';
  return null;
}

function roadDirectionFromLaneDirection(direction: string): RoadDirection {
  switch (normalizeType(direction)) {
    case 'forward':
      return 'forward';
    case 'backward':
      return 'backward';
    case 'both':
    case 'bidirectional':
      return 'both';
    default:
      return 'none';
  }
}

function allowedModesForLaneType(type: string): string[] {
  const key = normalizeType(type);
  if (key === 'biking' || key === 'bike' || key === 'cycleway') return ['bicycle'];
  if (key === 'sidewalk' || key === 'footway' || key === 'shoulder') return ['pedestrian'];
  if (key === 'shareduse') return ['pedestrian', 'bicycle'];
  if (key === 'bus') return ['bus'];
  if (key.includes('parking')) return ['car'];
  if (key === 'lightrail' || key === 'tram') return ['rail'];
  if (key === 'driving') return ['car'];
  return [];
}

function collectOsmWayIds(features: Osm2StreetsFeature[]): Array<string | number> {
  const ids = new Map<string, string | number>();
  for (const feature of features) {
    const raw = feature.properties?.osm_way_ids;
    const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
    for (const value of values) {
      ids.set(String(value), value as string | number);
    }
  }
  return [...ids.values()];
}

function ringsFromPolygonFeature(feature: Osm2StreetsFeature): [number, number][][] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return ringsFromPolygonCoordinates(geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      ? geometry.coordinates.flatMap(ringsFromPolygonCoordinates)
      : [];
  }
  return [];
}

function ringsFromPolygonCoordinates(value: unknown): [number, number][][] {
  if (!Array.isArray(value)) return [];
  return value
    .map((ring) => cleanRing(ring))
    .filter((ring): ring is [number, number][] => ring.length >= 3);
}

function cleanRing(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  const ring: [number, number][] = [];
  for (const point of value) {
    if (
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
    ) {
      const prev = ring[ring.length - 1];
      if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
        ring.push([point[0], point[1]]);
      }
    }
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring;
}

function findMatchingOsmRoad(
  roads: OsmRoadFeature[],
  osmWayIds: Array<string | number>
): OsmRoadFeature | null {
  const wanted = new Set(osmWayIds.map(String));
  return roads.find((road) => wanted.has(String(road.osmWayId))) ?? null;
}

function centerlineFromFeature(feature: Osm2StreetsFeature | undefined): [number, number][] | null {
  const points = collectLngLatPoints(feature?.geometry?.coordinates);
  if (points.length < 2) return null;
  let best: [[number, number], [number, number]] | null = null;
  let bestDistance = -Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance =
        (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [points[i], points[j]];
      }
    }
  }
  return best;
}

function collectLngLatPoints(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [[value[0], value[1]]];
  }
  return value.flatMap(collectLngLatPoints);
}

function parseSpeedKmh(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.toLowerCase() === 'none') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const speed = Number(match[0]);
  if (/\bSpeed\s*\(/i.test(value)) return Math.round(speed * 3_600) / 1_000;
  if (/\bMph\s*\(/i.test(value)) return Math.round(speed * 1_609.344) / 1_000;
  return speed;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeType(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function projectLineToCrs(
  line: [number, number][],
  crsCode: string,
  elevationM: number
): [number, number, number][] {
  return line.map(([lng, lat]) => projectPointToCrs(lng, lat, crsCode, elevationM));
}

function projectClosedRingToCrs(
  ring: [number, number][],
  crsCode: string,
  elevationM: number
): [number, number, number][] {
  const projected = ring.map(([lng, lat]) => projectPointToCrs(lng, lat, crsCode, elevationM));
  const first = projected[0];
  const last = projected[projected.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1] || first[2] !== last[2])) {
    projected.push([...first]);
  }
  if (projected.length < 4 || Math.abs(signedArea3dRing(projected)) < 0.01) {
    throw new Error('osm2streets lane polygon collapsed while projecting to the active metric CRS.');
  }
  return projected;
}

function projectPointToCrs(
  lng: number,
  lat: number,
  crsCode: string,
  elevationM: number
): [number, number, number] {
  const [x, y] = proj4('EPSG:4326', crsCode, [lng, lat]) as [number, number];
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Could not project osm2streets geometry into ${crsCode}.`);
  }
  return [x, y, elevationM];
}

function signedArea3dRing(ring: [number, number, number][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function crsUriForCode(crsCode: string): string {
  const match = crsCode.match(/^EPSG:(\d+)$/i);
  return match ? `https://www.opengis.net/def/crs/EPSG/0/${match[1]}` : crsCode;
}

function functionCodeForBand(kind: RoadBandKind): string {
  if (kind === 'car_lane') return 'driving_lane';
  if (kind === 'bike_lane') return 'bike_lane';
  if (kind === 'sidewalk') return 'sidewalk';
  if (kind === 'parking') return 'parking_lane';
  if (kind === 'median') return 'median';
  if (kind === 'green') return 'green_verge';
  return 'road_surface';
}

function functionLabelForBand(kind: RoadBandKind): string {
  if (kind === 'car_lane') return 'Driving lane';
  if (kind === 'bike_lane') return 'Bike lane';
  if (kind === 'sidewalk') return 'Sidewalk';
  if (kind === 'parking') return 'Parking lane';
  if (kind === 'median') return 'Median';
  if (kind === 'green') return 'Green verge';
  return 'Road surface';
}

function usageLabelForBand(kind: RoadBandKind): string {
  if (kind === 'car_lane') return 'Motor vehicle traffic';
  if (kind === 'bike_lane') return 'Bicycle traffic';
  if (kind === 'sidewalk') return 'Pedestrian traffic';
  if (kind === 'parking') return 'Parking';
  if (kind === 'median') return 'Traffic separation';
  if (kind === 'green') return 'Roadside greenery';
  return 'Transportation';
}

function osmNodeIdsFromProperties(
  properties: Record<string, JsonValue>
): Pick<TrafficAreaPolygonAsset, 'osmNodeIds'> {
  const raw = properties.osm_node_ids;
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const ids = values
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map(String);
  return ids.length > 0 ? { osmNodeIds: ids } : {};
}

function jsonRecord(record: Record<string, unknown>): Record<string, JsonValue> {
  const result: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = toJsonValue(value);
  }
  return result;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === 'object') return jsonRecord(value as Record<string, unknown>);
  return String(value);
}
