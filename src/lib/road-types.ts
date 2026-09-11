// Shared road layout types; independent of the renderer and projection libraries.
export type RoadBandKind =
  | 'car_lane'
  | 'bike_lane'
  | 'sidewalk'
  | 'median'
  | 'green'
  | 'parking';

export type RoadDirection = 'forward' | 'backward' | 'both' | 'none';

export type RoadAllowedTurn =
  | 'through'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'uturn'
  | 'merge_left'
  | 'merge_right';

export type RoadIntersectionTurn =
  | 'through'
  | 'slight_left'
  | 'left'
  | 'sharp_left'
  | 'slight_right'
  | 'right'
  | 'sharp_right'
  | 'uturn';

export type RoadVerticalPlacement = 'surface' | 'underground' | 'elevated' | 'unknown';

export type RoadCurveMode = 'smooth' | 'straight';

export type RoadGeometryMode = 'exact' | 'generated';

export interface RoadCurveSettings {
  mode: RoadCurveMode;
  /** 0 follows straight anchor-to-anchor segments; 1 uses the full smooth spline. */
  strength: number;
}

export type RoadConnectionTarget = 'draft' | 'cityjson' | 'osm';

export interface RoadEndpointConnection {
  target: RoadConnectionTarget;
  targetId: string;
  targetSectionId?: string;
  targetEndpoint?: 'start' | 'end' | 'node';
  positionWgs84: [number, number];
  /** Connections are only stored after the user deliberately snaps an endpoint. */
  confirmed: true;
}

export interface RoadVerticalProfile {
  placement: RoadVerticalPlacement;
  source: 'manual' | 'osm_tags' | 'opendrive' | 'cityjson_geometry' | 'user' | 'unspecified';
  /** Absolute road-surface elevation in the document's vertical datum, when known. */
  elevationM?: number;
  /** OSM layer is an ordering hint, not a metric elevation. */
  osmLayer?: number;
}

export interface RoadBand {
  id?: string;
  kind: RoadBandKind;
  /** Original semantic lane type (for example Bus, SharedUse, or LightRail). */
  sourceType?: string;
  widthM: number;
  direction?: RoadDirection;
  surface?: string;
  allowedModes?: string[];
  /** Explicit OSM/osm2streets lane movements. Missing/empty means unknown. */
  allowedTurns?: RoadAllowedTurn[];
  maxspeedKmh?: number | null;
}

export interface RoadSectionDraft {
  id: string;
  /** User-facing anchors. Rendered and exported ribbons are sampled between them. */
  centerlineWgs84: [number, number][];
  bands: RoadBand[];
  /** Signed lateral offset from the directed centreline; positive is left. */
  offsetM?: number;
  /** User-defined corridor distances from that centreline, in metres. */
  extentLimits?: { left?: number; right?: number };
  maxspeedKmh?: number | null;
  curve?: RoadCurveSettings;
  connections?: {
    start?: RoadEndpointConnection;
    end?: RoadEndpointConnection;
  };
}

export interface RoadDraft {
  id?: string;
  name?: string;
  source: 'osm' | 'manual' | 'opendrive';
  sourceOsmWayId?: number | string;
  osmTags?: Record<string, string>;
  vertical?: RoadVerticalProfile;
  userVerified?: boolean;
  ruleProfile?: import('./road-rules.js').RoadRuleProfile;
  sections: RoadSectionDraft[];
}
