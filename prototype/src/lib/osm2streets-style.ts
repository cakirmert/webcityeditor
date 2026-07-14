import type { RoadBandKind } from './transportation';

export type Rgba = [number, number, number, number];

const ASPHALT: Rgba = [55, 56, 62, 240];
const BIKE_GREEN: Rgba = [18, 136, 74, 215];
const SIDEWALK_GREY: Rgba = [184, 188, 196, 210];
const FOOTWAY_GREY: Rgba = [204, 207, 214, 205];
const SHARED_USE: Rgba = [144, 154, 82, 210];
const BUS_RED: Rgba = [172, 58, 58, 220];
const LIGHT_RAIL_BROWN: Rgba = [128, 86, 52, 220];
const CONSTRUCTION_ORANGE: Rgba = [218, 132, 52, 215];
const PARKING_GREY: Rgba = [104, 107, 114, 225];
const CURB_BUFFER: Rgba = [242, 244, 248, 210];
const PLANTER_BUFFER: Rgba = [72, 82, 76, 220];
const MEDIAN_GREY: Rgba = [124, 124, 132, 205];
const GREEN_VERGE: Rgba = [48, 120, 82, 205];
const UNKNOWN_LANE: Rgba = [93, 97, 108, 210];

const INTERSECTION: Rgba = [74, 76, 84, 184];
const INTERSECTION_CONNECTION: Rgba = [83, 88, 96, 172];
const INTERSECTION_FORK: Rgba = [86, 94, 105, 172];
const INTERSECTION_TERMINUS: Rgba = [100, 91, 72, 166];
const INTERSECTION_MAP_EDGE: Rgba = [80, 84, 92, 132];

const MARKING_WHITE: Rgba = [248, 250, 252, 232];
const MARKING_YELLOW: Rgba = [246, 203, 78, 235];
const MARKING_GREY: Rgba = [176, 180, 188, 220];
const MARKING_GREEN: Rgba = [64, 178, 103, 232];
const MARKING_BLACK: Rgba = [22, 24, 28, 225];

export function osm2streetsLaneFillColor(type: string): Rgba {
  const key = normalizeType(type);
  if (key.includes('parking')) return PARKING_GREY;
  if (key === 'driving' || key === 'car' || key === 'carlane' || key === 'drivinglane') {
    return ASPHALT;
  }
  if (key === 'biking' || key === 'bike' || key === 'bikelane' || key === 'cycleway') {
    return BIKE_GREEN;
  }
  if (key === 'sidewalk' || key === 'shoulder') return SIDEWALK_GREY;
  if (key === 'footway' || key === 'pedestrian') return FOOTWAY_GREY;
  if (key === 'shareduse' || key === 'shared') return SHARED_USE;
  if (key === 'bus' || key === 'buslane') return BUS_RED;
  if (key === 'lightrail' || key === 'tram') return LIGHT_RAIL_BROWN;
  if (key === 'construction') return CONSTRUCTION_ORANGE;
  if (key === 'buffercurb' || key === 'curbbuffer') return CURB_BUFFER;
  if (key === 'bufferplanters' || key === 'planterbuffer') return PLANTER_BUFFER;
  if (key === 'buffer' || key === 'verge') return PLANTER_BUFFER;
  return UNKNOWN_LANE;
}

export function osm2streetsIntersectionFillColor(kind: string): Rgba {
  switch (normalizeType(kind)) {
    case 'mapedge':
      return INTERSECTION_MAP_EDGE;
    case 'terminus':
      return INTERSECTION_TERMINUS;
    case 'connection':
      return INTERSECTION_CONNECTION;
    case 'fork':
      return INTERSECTION_FORK;
    case 'intersection':
      return INTERSECTION;
    default:
      return INTERSECTION_CONNECTION;
  }
}

export function osm2streetsLaneMarkingFillColor(type: string): Rgba {
  switch (normalizeType(type)) {
    case 'centerline':
      return MARKING_YELLOW;
    case 'laneseparator':
    case 'lanearrow':
    case 'bufferedge':
    case 'bufferstripe':
    case 'parkinghatch':
    case 'vehiclestopline':
      return MARKING_WHITE;
    case 'sidewalkline':
      return MARKING_GREY;
    case 'bikestopline':
      return MARKING_GREEN;
    case 'pathoutline':
      return MARKING_BLACK;
    default:
      return MARKING_WHITE;
  }
}

export function osm2streetsIntersectionMarkingFillColor(type: string): Rgba {
  switch (normalizeType(type)) {
    case 'sidewalkcorner':
      return SIDEWALK_GREY;
    case 'markedcrossingline':
      return MARKING_WHITE;
    case 'unmarkedcrossingoutline':
      return [248, 250, 252, 185];
    default:
      return MARKING_WHITE;
  }
}

export function roadBandFillColor(kind: RoadBandKind | string, sourceType?: string): Rgba {
  const key = normalizeType(sourceType ?? kind);
  if (key === 'carlane' || key === 'drivinglane') return osm2streetsLaneFillColor('Driving');
  if (key === 'bikelane') return osm2streetsLaneFillColor('Biking');
  if (key === 'sidewalk') return osm2streetsLaneFillColor('Sidewalk');
  if (key === 'parking' || key === 'parkinglane') {
    return osm2streetsLaneFillColor('Parking(Parallel)');
  }
  if (key === 'median') return MEDIAN_GREY;
  if (key === 'green' || key === 'greenverge' || key === 'verge') return GREEN_VERGE;
  return osm2streetsLaneFillColor(sourceType ?? kind);
}

export function withAlpha(color: Rgba, alpha: number): Rgba {
  return [color[0], color[1], color[2], alpha];
}

export function roadOverlayColor(
  color: Rgba,
  options: { basemap?: 'map' | 'satellite'; underground?: boolean } = {}
): Rgba {
  const satelliteFactor = options.basemap === 'satellite' ? 0.72 : 1;
  const undergroundFactor = options.underground ? 0.5 : 1;
  return withAlpha(
    color,
    Math.max(0, Math.min(255, Math.round(color[3] * satelliteFactor * undergroundFactor)))
  );
}

function normalizeType(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9]/g, '');
}
