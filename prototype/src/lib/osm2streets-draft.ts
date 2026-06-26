import type { OsmRoadFeature, RoadBand, RoadBandKind, RoadDirection, RoadDraft } from './transportation';
import type { Osm2StreetsFeature, Osm2StreetsResult, Osm2StreetsSelection } from './osm2streets';

export interface Osm2StreetsDraftBuildResult {
  draft: RoadDraft;
  matchedOsmRoad: OsmRoadFeature | null;
}

export function buildRoadDraftFromOsm2StreetsSelection(
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult,
  osmRoads: OsmRoadFeature[]
): Osm2StreetsDraftBuildResult {
  if (!selection || selection.kind !== 'lane') {
    throw new Error('Select an osm2streets lane before creating an editable road draft.');
  }

  const selectedProps = selection.feature.properties ?? {};
  const roadId = selectedProps.road;
  if (roadId === undefined || roadId === null) {
    throw new Error('Selected osm2streets lane has no road id.');
  }

  const siblingLanes = result.lanes.features
    .filter((feature) => feature.properties?.road === roadId)
    .sort((a, b) => numberValue(a.properties?.index) - numberValue(b.properties?.index));
  const sourceOsmWayIds = collectOsmWayIds(siblingLanes.length ? siblingLanes : [selection.feature]);
  const matchedOsmRoad = findMatchingOsmRoad(osmRoads, sourceOsmWayIds);
  const centerlineWgs84 =
    matchedOsmRoad?.path ?? centerlineFromFeature(selection.feature) ?? centerlineFromFeature(siblingLanes[0]);

  if (!centerlineWgs84 || centerlineWgs84.length < 2) {
    throw new Error('Could not derive an editable centerline from the selected osm2streets lane.');
  }

  const bands = siblingLanes
    .map((feature, index) => roadBandFromLaneFeature(feature, index))
    .filter((band): band is RoadBand => !!band);

  if (bands.length === 0) {
    throw new Error('Selected osm2streets road did not contain editable lane bands.');
  }

  const maxspeedKmh = parseSpeedKmh(selectedProps.speed_limit);
  const sourceOsmWayId = sourceOsmWayIds[0] ?? matchedOsmRoad?.osmWayId;

  return {
    matchedOsmRoad,
    draft: {
      id: `osm2streets-road-${roadId}`,
      name: matchedOsmRoad?.tags.name ?? `osm2streets road ${roadId}`,
      source: 'osm',
      sourceOsmWayId,
      osmTags: matchedOsmRoad?.tags,
      userVerified: false,
      sections: [
        {
          id: `osm2streets-road-${roadId}-section-1`,
          centerlineWgs84,
          maxspeedKmh,
          bands,
        },
      ],
    },
  };
}

function roadBandFromLaneFeature(feature: Osm2StreetsFeature, index: number): RoadBand | null {
  const props = feature.properties ?? {};
  const kind = roadBandKindFromLaneType(String(props.type ?? ''));
  if (!kind) return null;
  const widthM = typeof props.width === 'number' && Number.isFinite(props.width) ? props.width : 1;
  const maxspeedKmh = parseSpeedKmh(props.speed_limit);

  return {
    id: `osm2streets-${kind}-${index}`,
    kind,
    widthM: Math.max(0.4, widthM),
    direction: roadDirectionFromLaneDirection(String(props.direction ?? '')),
    allowedModes: allowedModesForLaneType(String(props.type ?? '')),
    maxspeedKmh: kind === 'car_lane' ? maxspeedKmh : undefined,
  };
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
  if (key === 'driving' || key === 'lightrail' || key === 'construction') return ['car'];
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
  return match ? Number(match[0]) : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeType(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]/g, '');
}
