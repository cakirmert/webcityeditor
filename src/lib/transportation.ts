import proj4 from 'proj4';
import type { CityJsonDocument, CityObject, JsonValue } from '../types';
import {
  applyVertexTransform,
  computeBbox,
  detectCrs,
  projectToWgs84,
} from './projection';

export type RoadBandKind =
  | 'car_lane'
  | 'bike_lane'
  | 'sidewalk'
  | 'median'
  | 'green'
  | 'parking';

export type RoadDirection = 'forward' | 'backward' | 'both' | 'none';

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
  maxspeedKmh?: number | null;
}

export interface RoadSectionDraft {
  id: string;
  /** User-facing anchors. Rendered and exported ribbons are sampled between them. */
  centerlineWgs84: [number, number][];
  bands: RoadBand[];
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
  sections: RoadSectionDraft[];
}

export interface OsmRoadFeature {
  id: string;
  osmWayId: number | string;
  tags: Record<string, string>;
  path: [number, number][];
  inferredDraft: RoadDraft;
}

export type OsmPointFeatureKind =
  | 'traffic_sign'
  | 'tree'
  | 'street_lamp'
  | 'traffic_signals'
  | 'bollard';

export interface OsmPointFeature {
  id: string;
  osmNodeId: string;
  kind: OsmPointFeatureKind;
  position: [number, number];
  tags: Record<string, string>;
}

export interface RoadArea {
  id: string;
  roadId: string;
  sectionId: string;
  bandId: string;
  surfaceIndex: number;
  surfaceType: 'TrafficArea' | 'AuxiliaryTrafficArea';
  function: string;
  polygon: [number, number][];
  vertical?: RoadVerticalProfile;
  /** Exact polygons are preserved for attribute-only edits. */
  geometryMode?: RoadGeometryMode;
  editableDraft?: RoadDraft;
  attributes: Record<string, JsonValue>;
}

export interface InsertRoadResult {
  id: string;
  areas: RoadArea[];
  vertexCount: number;
}

export interface RoadPreviewOptions {
  id?: string;
  baseElevation?: number;
}

export interface RoadEditPayload {
  schemaVersion: 'webcityeditor-road-edit-v1';
  target: 'cityjson-transportation';
  roadObjectId?: string;
  draft: RoadDraft;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

interface ProjectedRoadArea extends Omit<RoadArea, 'polygon'> {
  polygon: ProjectedPoint[];
}

interface DraftBandAssignment {
  section: RoadSectionDraft;
  band: RoadBand;
}

const DEFAULT_WIDTHS: Record<RoadBandKind, number> = {
  car_lane: 3.25,
  bike_lane: 1.75,
  sidewalk: 2,
  median: 1,
  green: 1,
  parking: 2.1,
};

export const DEFAULT_ROAD_CURVE: RoadCurveSettings = {
  mode: 'smooth',
  strength: 0.72,
};

const ROAD_CURVE_SAMPLE_METERS = 3;
const ROAD_CURVE_MIN_STEPS = 3;
const ROAD_CURVE_MAX_STEPS = 28;

const TRAFFIC_FUNCTIONS: Record<RoadBandKind, string> = {
  car_lane: 'driving_lane',
  bike_lane: 'bike_lane',
  sidewalk: 'sidewalk',
  median: 'median',
  green: 'green_verge',
  parking: 'parking_lane',
};

export function defaultRoadBands(maxspeedKmh: number | null = 50): RoadBand[] {
  return [
    {
      id: 'sidewalk-left',
      kind: 'sidewalk',
      widthM: DEFAULT_WIDTHS.sidewalk,
      direction: 'none',
      allowedModes: ['pedestrian'],
    },
    {
      id: 'car-backward',
      kind: 'car_lane',
      widthM: DEFAULT_WIDTHS.car_lane,
      direction: 'backward',
      allowedModes: ['car'],
      maxspeedKmh,
    },
    {
      id: 'car-forward',
      kind: 'car_lane',
      widthM: DEFAULT_WIDTHS.car_lane,
      direction: 'forward',
      allowedModes: ['car'],
      maxspeedKmh,
    },
    {
      id: 'bike-forward',
      kind: 'bike_lane',
      widthM: DEFAULT_WIDTHS.bike_lane,
      direction: 'forward',
      allowedModes: ['bicycle'],
    },
    {
      id: 'sidewalk-right',
      kind: 'sidewalk',
      widthM: DEFAULT_WIDTHS.sidewalk,
      direction: 'none',
      allowedModes: ['pedestrian'],
    },
  ];
}

export function createManualRoadDraft(
  centerlineWgs84: [number, number][],
  options: { name?: string; maxspeedKmh?: number | null; bands?: RoadBand[] } = {}
): RoadDraft {
  return {
    id: makeStableId('road-draft'),
    name: options.name ?? 'Manual road edit',
    source: 'manual',
    vertical: {
      placement: 'surface',
      source: 'manual',
    },
    userVerified: true,
    sections: [
      {
        id: 'section-1',
        centerlineWgs84: normaliseWgs84Line(centerlineWgs84),
        maxspeedKmh: options.maxspeedKmh ?? 50,
        curve: { ...DEFAULT_ROAD_CURVE },
        bands: cloneBands(options.bands ?? defaultRoadBands(options.maxspeedKmh ?? 50)),
      },
    ],
  };
}

export function buildOverpassRoadQuery(
  bbox: [number, number, number, number],
  format: 'json' | 'xml' = 'json',
  timeoutSeconds = 25
): string {
  const [west, south, east, north] = bbox;
  const timeout = Math.max(1, Math.round(timeoutSeconds));
  const header =
    format === 'json'
      ? `[out:json][timeout:${timeout}];`
      : `[out:xml][timeout:${timeout}];`;
  return [
    header,
    '(',
    `  way["highway"](${south},${west},${north},${east});`,
    `  node["traffic_sign"](${south},${west},${north},${east});`,
    `  node["natural"="tree"](${south},${west},${north},${east});`,
    `  node["highway"~"^(street_lamp|traffic_signals)$"](${south},${west},${north},${east});`,
    `  node["barrier"="bollard"](${south},${west},${north},${east});`,
    ');',
    '(._;>;);',
    'out body;',
  ].join('\n');
}

export function parseOsmPointFeaturesFromXml(xmlText: string): OsmPointFeature[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const features: OsmPointFeature[] = [];
  const nodeEls = doc.getElementsByTagName('node');

  for (let i = 0; i < nodeEls.length; i++) {
    const element = nodeEls[i];
    const id = element.getAttribute('id');
    const lat = parseFloat(element.getAttribute('lat') || '');
    const lon = parseFloat(element.getAttribute('lon') || '');
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const tags: Record<string, string> = {};
    const tagEls = element.getElementsByTagName('tag');
    for (let j = 0; j < tagEls.length; j++) {
      const key = tagEls[j].getAttribute('k');
      const value = tagEls[j].getAttribute('v');
      if (key && value) tags[key] = value;
    }

    const kind = osmPointFeatureKind(tags);
    if (!kind) continue;
    features.push({
      id: `osm-node-${id}`,
      osmNodeId: id,
      kind,
      position: [lon, lat],
      tags,
    });
  }

  return features;
}

function osmPointFeatureKind(tags: Record<string, string>): OsmPointFeatureKind | null {
  if (tags.traffic_sign) return 'traffic_sign';
  if (tags.natural === 'tree') return 'tree';
  if (tags.highway === 'traffic_signals') return 'traffic_signals';
  if (tags.highway === 'street_lamp') return 'street_lamp';
  if (tags.barrier === 'bollard') return 'bollard';
  return null;
}

export function parseOsmRoadsFromXml(xmlText: string): OsmRoadFeature[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const nodes = new Map<string, [number, number]>();

  // Extract nodes
  const nodeEls = doc.getElementsByTagName('node');
  for (let i = 0; i < nodeEls.length; i++) {
    const el = nodeEls[i];
    const id = el.getAttribute('id');
    const lat = parseFloat(el.getAttribute('lat') || '');
    const lon = parseFloat(el.getAttribute('lon') || '');
    if (id && Number.isFinite(lat) && Number.isFinite(lon)) {
      nodes.set(id, [lon, lat]);
    }
  }

  // Extract ways
  const wayEls = doc.getElementsByTagName('way');
  const roads: OsmRoadFeature[] = [];

  for (let i = 0; i < wayEls.length; i++) {
    const el = wayEls[i];
    const id = el.getAttribute('id');
    if (!id) continue;

    // Get tags
    const tags: Record<string, string> = {};
    const tagEls = el.getElementsByTagName('tag');
    for (let j = 0; j < tagEls.length; j++) {
      const k = tagEls[j].getAttribute('k');
      const v = tagEls[j].getAttribute('v');
      if (k && v) {
        tags[k] = v;
      }
    }

    if (!tags.highway || tags.area === 'yes') continue;

    // Get node path
    const path: [number, number][] = [];
    const ndEls = el.getElementsByTagName('nd');
    for (let j = 0; j < ndEls.length; j++) {
      const ref = ndEls[j].getAttribute('ref');
      if (ref) {
        const coords = nodes.get(ref);
        if (coords) {
          path.push(coords);
        }
      }
    }

    if (path.length < 2) continue;

    const featureBase = {
      id: `osm-way-${id}`,
      osmWayId: id,
      tags,
      path,
    };

    roads.push({
      ...featureBase,
      inferredDraft: inferRoadDraftFromOsmRoad(featureBase),
    });
  }

  return roads;
}

export function parseOsmRoadsFromOverpass(payload: unknown): OsmRoadFeature[] {
  const elements = (payload as { elements?: unknown[] })?.elements;
  if (!Array.isArray(elements)) return [];

  const nodes = new Map<number | string, [number, number]>();
  for (const element of elements) {
    const el = element as { type?: string; id?: number | string; lon?: number; lat?: number };
    if (
      el.type === 'node' &&
      el.id !== undefined &&
      Number.isFinite(el.lon) &&
      Number.isFinite(el.lat)
    ) {
      nodes.set(el.id, [el.lon as number, el.lat as number]);
    }
  }

  const roads: OsmRoadFeature[] = [];
  for (const element of elements) {
    const way = element as {
      type?: string;
      id?: number | string;
      nodes?: Array<number | string>;
      tags?: Record<string, string>;
    };
    if (way.type !== 'way' || way.id === undefined || !way.tags?.highway) continue;
    if (way.tags.area === 'yes') continue;
    const path = (way.nodes ?? [])
      .map((id) => nodes.get(id))
      .filter((p): p is [number, number] => !!p);
    if (path.length < 2) continue;
    const featureBase = {
      id: `osm-way-${String(way.id)}`,
      osmWayId: way.id,
      tags: { ...way.tags },
      path,
    };
    roads.push({
      ...featureBase,
      inferredDraft: inferRoadDraftFromOsmRoad(featureBase),
    });
  }
  return roads;
}

export function inferRoadDraftFromOsmRoad(
  road: Pick<OsmRoadFeature, 'osmWayId' | 'tags' | 'path'>
): RoadDraft {
  const tags = road.tags ?? {};
  const maxspeedKmh = parseMaxspeed(tags.maxspeed);
  const lanes = clampInt(parsePositiveNumber(tags.lanes) ?? (isOneway(tags) ? 1 : 2), 1, 8);
  const oneway = isOneway(tags);
  const dedicatedNonMotorBand = inferDedicatedNonMotorBand(tags);
  const bands: RoadBand[] = dedicatedNonMotorBand ? [dedicatedNonMotorBand] : [];

  if (!dedicatedNonMotorBand) {
    if (hasSidewalk(tags, 'left')) {
      bands.push({
        id: 'osm-sidewalk-left',
        kind: 'sidewalk',
        sourceType: 'Sidewalk',
        widthM: DEFAULT_WIDTHS.sidewalk,
        direction: 'none',
        allowedModes: ['pedestrian'],
      });
    }
    if (hasCycleway(tags, 'left')) {
      bands.push({
        id: 'osm-bike-left',
        kind: 'bike_lane',
        sourceType: 'Biking',
        widthM: DEFAULT_WIDTHS.bike_lane,
        direction: oneway ? 'forward' : 'backward',
        allowedModes: ['bicycle'],
      });
    }

    if (oneway) {
      for (let i = 0; i < lanes; i++) {
        bands.push({
          id: `osm-car-forward-${i + 1}`,
          kind: 'car_lane',
          sourceType: 'Driving',
          widthM: DEFAULT_WIDTHS.car_lane,
          direction: 'forward',
          allowedModes: ['car'],
          maxspeedKmh,
        });
      }
    } else {
      const backward = Math.floor(lanes / 2);
      const forward = Math.max(1, lanes - backward);
      for (let i = 0; i < backward; i++) {
        bands.push({
          id: `osm-car-backward-${i + 1}`,
          kind: 'car_lane',
          sourceType: 'Driving',
          widthM: DEFAULT_WIDTHS.car_lane,
          direction: 'backward',
          allowedModes: ['car'],
          maxspeedKmh,
        });
      }
      for (let i = 0; i < forward; i++) {
        bands.push({
          id: `osm-car-forward-${i + 1}`,
          kind: 'car_lane',
          sourceType: 'Driving',
          widthM: DEFAULT_WIDTHS.car_lane,
          direction: 'forward',
          allowedModes: ['car'],
          maxspeedKmh,
        });
      }
    }

    if (hasCycleway(tags, 'right')) {
      bands.push({
        id: 'osm-bike-right',
        kind: 'bike_lane',
        sourceType: 'Biking',
        widthM: DEFAULT_WIDTHS.bike_lane,
        direction: 'forward',
        allowedModes: ['bicycle'],
      });
    }
    if (hasSidewalk(tags, 'right')) {
      bands.push({
        id: 'osm-sidewalk-right',
        kind: 'sidewalk',
        sourceType: 'Sidewalk',
        widthM: DEFAULT_WIDTHS.sidewalk,
        direction: 'none',
        allowedModes: ['pedestrian'],
      });
    }
  }

  if (bands.length === 0) bands.push(...defaultRoadBands(maxspeedKmh));

  return {
    id: makeStableId('road-draft'),
    name: tags.name,
    source: 'osm',
    sourceOsmWayId: road.osmWayId,
    osmTags: { ...tags },
    vertical: inferRoadVerticalProfileFromOsmTags(tags),
    userVerified: false,
    sections: [
      {
        id: 'section-1',
        centerlineWgs84: normaliseWgs84Line(road.path),
        maxspeedKmh,
        curve: { ...DEFAULT_ROAD_CURVE },
        bands,
      },
    ],
  };
}

function inferDedicatedNonMotorBand(tags: Record<string, string>): RoadBand | null {
  const highway = tags.highway?.trim().toLowerCase();
  const widthM = Math.max(
    0.4,
    Math.min(12, parsePositiveNumber(tags.width) ?? DEFAULT_WIDTHS.sidewalk)
  );
  if (highway === 'cycleway') {
    const shared = isAllowedAccess(tags.foot);
    return {
      id: 'osm-dedicated-cycleway',
      kind: shared ? 'sidewalk' : 'bike_lane',
      sourceType: shared ? 'SharedUse' : 'Biking',
      widthM,
      direction: shared ? 'none' : isOneway(tags) ? 'forward' : 'both',
      allowedModes: shared ? ['pedestrian', 'bicycle'] : ['bicycle'],
    };
  }
  if (highway === 'path' || highway === 'bridleway') {
    const allowedModes = [
      ...(tags.foot === 'no' ? [] : ['pedestrian']),
      ...(tags.bicycle === 'no' ? [] : ['bicycle']),
    ];
    return {
      id: 'osm-dedicated-shared-path',
      kind: 'sidewalk',
      sourceType: allowedModes.length > 1 ? 'SharedUse' : 'Footway',
      widthM,
      direction: 'none',
      allowedModes: allowedModes.length > 0 ? allowedModes : ['pedestrian'],
    };
  }
  if (
    highway === 'footway' ||
    highway === 'pedestrian' ||
    highway === 'steps' ||
    highway === 'corridor' ||
    highway === 'platform'
  ) {
    return {
      id: 'osm-dedicated-footway',
      kind: 'sidewalk',
      sourceType: isAllowedAccess(tags.bicycle) ? 'SharedUse' : 'Footway',
      widthM,
      direction: 'none',
      allowedModes: isAllowedAccess(tags.bicycle)
        ? ['pedestrian', 'bicycle']
        : ['pedestrian'],
    };
  }
  return null;
}

function isAllowedAccess(value: string | undefined): boolean {
  return value === 'yes' || value === 'designated' || value === 'permissive';
}

export function inferRoadVerticalProfileFromOsmTags(
  tags: Record<string, string> = {}
): RoadVerticalProfile {
  const layer = parseSignedNumber(tags.layer);
  const location = tags.location?.trim().toLowerCase();
  const undergroundEvidence =
    isTruthyOsmTag(tags.tunnel) ||
    isTruthyOsmTag(tags.covered) ||
    location === 'underground' ||
    (layer !== null && layer < 0);
  const elevatedEvidence =
    isTruthyOsmTag(tags.bridge) ||
    location === 'overground' ||
    location === 'elevated' ||
    location === 'overhead' ||
    (layer !== null && layer > 0);

  let placement: RoadVerticalPlacement;
  if (undergroundEvidence && elevatedEvidence) placement = 'unknown';
  else if (undergroundEvidence) placement = 'underground';
  else if (elevatedEvidence) placement = 'elevated';
  else placement = 'surface';

  return {
    placement,
    source: 'osm_tags',
    ...(layer === null ? {} : { osmLayer: layer }),
  };
}

export function roadVerticalProfileForDraft(draft: RoadDraft): RoadVerticalProfile {
  if (draft.vertical) return { ...draft.vertical };
  if (draft.source === 'manual') return { placement: 'surface', source: 'manual' };
  if (draft.source === 'osm') return inferRoadVerticalProfileFromOsmTags(draft.osmTags);
  if (draft.source === 'opendrive') return { placement: 'unknown', source: 'opendrive' };
  return { placement: 'unknown', source: 'unspecified' };
}

export function splitRoadSectionAtFraction(
  draft: RoadDraft,
  sectionId: string,
  fraction: number
): RoadDraft {
  if (!(fraction > 0 && fraction < 1)) {
    throw new Error('Road split fraction must be between 0 and 1.');
  }
  const sectionIndex = draft.sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex < 0) throw new Error(`Road section "${sectionId}" was not found.`);
  const section = draft.sections[sectionIndex];
  // Split the displayed curve rather than the coarse anchor chords. A light
  // simplification keeps the resulting touch handles manageable while the two
  // lane-layout sections retain the road shape the user already confirmed.
  const splitSampled = splitLineAtFraction(
    sampleRoadSectionCenterlineWgs84(section),
    fraction
  );
  const split: [[number, number][], [number, number][]] = [
    simplifyWgs84Line(splitSampled[0], 0.25),
    simplifyWgs84Line(splitSampled[1], 0.25),
  ];
  const sectionAId = `${section.id}-a`;
  const sectionBId = `${section.id}-b`;
  const join = split[0].at(-1)!;
  const aConnections: RoadSectionDraft['connections'] = {
    ...(section.connections?.start ? { start: section.connections.start } : {}),
    end: {
      target: 'draft',
      targetId: sectionBId,
      targetSectionId: sectionBId,
      targetEndpoint: 'start',
      positionWgs84: join,
      confirmed: true,
    },
  };
  const bConnections: RoadSectionDraft['connections'] = {
    start: {
      target: 'draft',
      targetId: sectionAId,
      targetSectionId: sectionAId,
      targetEndpoint: 'end',
      positionWgs84: join,
      confirmed: true,
    },
    ...(section.connections?.end ? { end: section.connections.end } : {}),
  };
  const sections = draft.sections.slice();
  sections.splice(
    sectionIndex,
    1,
    {
      ...section,
      id: sectionAId,
      centerlineWgs84: split[0],
      bands: cloneBands(section.bands),
      connections: aConnections,
    },
    {
      ...section,
      id: sectionBId,
      centerlineWgs84: split[1],
      bands: cloneBands(section.bands),
      connections: bConnections,
    }
  );
  return { ...draft, sections };
}

export function insertRoadIntoCityJson(
  doc: CityJsonDocument,
  draft: RoadDraft,
  options: { id?: string; baseElevation?: number } = {}
): InsertRoadResult {
  const crs = detectCrs(doc);
  if (!crs.supported) {
    throw new Error(`Cannot create road: CRS ${crs.code} is not supported by proj4.`);
  }
  const id = options.id ?? uniqueRoadId(doc);
  const existingRoad = doc.CityObjects[id];
  const existingAttributes = existingRoad?.type === 'Road' ? existingRoad.attributes ?? {} : {};
  const changedAt = new Date().toISOString();
  const draftVertical = roadVerticalProfileForDraft(draft);
  const baseElevation =
    options.baseElevation ??
    (Number.isFinite(draftVertical.elevationM)
      ? draftVertical.elevationM ?? computeBbox(doc).min.z
      : computeBbox(doc).min.z);
  const vertical = resolveRoadVerticalProfile(draftVertical, baseElevation, {
    fallbackIsExplicit: Number.isFinite(options.baseElevation),
  });
  const projectedAreas = buildProjectedRoadAreas(doc, draft, crs.code);

  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  if (
    !t.scale.every((value) => Number.isFinite(value) && value !== 0) ||
    !t.translate.every((value) => Number.isFinite(value))
  ) {
    throw new Error('Cannot create road: CityJSON transform is invalid.');
  }

  const boundaries: number[][][] = [];
  const surfaces: Array<Record<string, JsonValue>> = [];
  const vertices: [number, number, number][] = [];
  const toCityVertex = (point: ProjectedPoint): [number, number, number] => [
    Math.round((point.x - t.translate[0]) / t.scale[0]),
    Math.round((point.y - t.translate[1]) / t.scale[1]),
    Math.round((baseElevation - t.translate[2]) / t.scale[2]),
  ];

  for (const area of projectedAreas) {
    const ringIndices: number[] = [];
    for (const point of area.polygon) {
      ringIndices.push(doc.vertices.length + vertices.length);
      vertices.push(toCityVertex(point));
    }
    boundaries.push([ringIndices]);
    surfaces.push({
      type: area.surfaceType,
      function: area.function,
      usage: area.attributes.transportationUsage,
      sourceType: area.attributes.sourceType ?? null,
      trafficDirection: area.attributes.trafficDirection,
      allowedModes: area.attributes.allowedModes ?? null,
      surfaceMaterial: area.attributes.surfaceMaterial,
      maxspeed: area.attributes.maxspeed ?? null,
      sourceCenterlineWgs84: area.attributes.sourceCenterlineWgs84 ?? null,
      verticalPlacement: vertical.placement,
      roadElevation: vertical.elevationM ?? null,
    });
  }

  const cityObject: CityObject = {
    type: 'Road',
    attributes: {
      ...existingAttributes,
      class: 'transportation',
      function: 'road',
      name: draft.name ?? existingAttributes.name ?? null,
      _createdBy: existingAttributes._createdBy ?? 'city-editor-prototype',
      _createdAt: existingAttributes._createdAt ?? changedAt,
      ...(existingRoad?.type === 'Road' ? { _updatedAt: changedAt } : {}),
      _source: draft.source,
      _osmWayId: draft.sourceOsmWayId ?? existingAttributes._osmWayId ?? null,
      _osmTags: draft.osmTags
        ? jsonRecord(draft.osmTags)
        : (existingAttributes._osmTags ?? null),
      _verticalProfile: roadVerticalProfileToJson(vertical),
      _roadGeometryMode: 'generated',
      _sourceCenterlineWgs84:
        projectedAreas[0]?.attributes.sourceCenterlineWgs84 ?? null,
      _roadLayout: roadDraftToJson(draft),
    },
    geometry: [
      {
        type: 'MultiSurface',
        lod: '2',
        boundaries,
        semantics: {
          surfaces,
          values: surfaces.map((_, index) => index),
        },
      },
    ],
  };

  doc.vertices.push(...vertices);
  doc.CityObjects[id] = cityObject;

  return {
    id,
    areas: projectedAreas.map((area) => ({
      ...area,
      roadId: id,
      vertical,
      polygon: area.polygon.map((point) =>
        projectToWgs84(crs.code, { x: point.x, y: point.y, z: baseElevation })
      ),
    })),
    vertexCount: vertices.length,
  };
}

/**
 * Generate the same semantic polygons used by insertion without cloning or
 * mutating the CityJSON document. This is the edit-time hot path.
 */
export function buildRoadPreviewAreas(
  doc: CityJsonDocument,
  draft: RoadDraft,
  options: RoadPreviewOptions = {}
): RoadArea[] {
  const crs = detectCrs(doc);
  if (!crs.supported) {
    throw new Error(`Cannot preview road: CRS ${crs.code} is not supported by proj4.`);
  }
  const draftVertical = roadVerticalProfileForDraft(draft);
  const baseElevation =
    options.baseElevation ??
    (Number.isFinite(draftVertical.elevationM)
      ? draftVertical.elevationM ?? computeBbox(doc).min.z
      : computeBbox(doc).min.z);
  const vertical = resolveRoadVerticalProfile(draftVertical, baseElevation, {
    fallbackIsExplicit: Number.isFinite(options.baseElevation),
  });
  return buildProjectedRoadAreas(doc, draft, crs.code).map((area) => ({
    ...area,
    roadId: options.id ?? draft.id ?? '__road_preview__',
    vertical,
    polygon: area.polygon.map((point) =>
      projectToWgs84(crs.code, { x: point.x, y: point.y, z: baseElevation })
    ),
  }));
}

/**
 * Attribute-only edits can stay on the imported polygons when the edit has not
 * changed any value that controls their shape. Semantic kind, direction,
 * material, access and speed are intentionally excluded from this comparison.
 */
export function roadDraftPreservesExactGeometry(
  baseline: RoadDraft,
  next: RoadDraft
): boolean {
  if (baseline.sections.length !== next.sections.length) return false;
  if (!sameFiniteNumber(baseline.vertical?.elevationM, next.vertical?.elevationM)) return false;

  for (let sectionIndex = 0; sectionIndex < baseline.sections.length; sectionIndex++) {
    const before = baseline.sections[sectionIndex];
    const after = next.sections[sectionIndex];
    if (before.id !== after.id) return false;
    if (before.centerlineWgs84.length !== after.centerlineWgs84.length) return false;
    for (let pointIndex = 0; pointIndex < before.centerlineWgs84.length; pointIndex++) {
      const beforePoint = before.centerlineWgs84[pointIndex];
      const afterPoint = after.centerlineWgs84[pointIndex];
      if (
        Math.abs(beforePoint[0] - afterPoint[0]) > 1e-10 ||
        Math.abs(beforePoint[1] - afterPoint[1]) > 1e-10
      ) {
        return false;
      }
    }
    const beforeCurve = before.curve ?? DEFAULT_ROAD_CURVE;
    const afterCurve = after.curve ?? DEFAULT_ROAD_CURVE;
    if (
      beforeCurve.mode !== afterCurve.mode ||
      Math.abs(beforeCurve.strength - afterCurve.strength) > 1e-9
    ) {
      return false;
    }
    if (before.bands.length !== after.bands.length) return false;
    for (let bandIndex = 0; bandIndex < before.bands.length; bandIndex++) {
      const beforeBand = before.bands[bandIndex];
      const afterBand = after.bands[bandIndex];
      if ((beforeBand.id ?? '') !== (afterBand.id ?? '')) return false;
      if (Math.abs(beforeBand.widthM - afterBand.widthM) > 1e-6) return false;
    }
  }
  return true;
}

/** Keep the imported polygon coordinates while previewing edited semantics. */
export function buildExactRoadAttributePreviewAreas(
  areas: RoadArea[],
  roadId: string,
  draft: RoadDraft
): RoadArea[] {
  const sourceAreas = areas
    .filter((area) => area.roadId === roadId)
    .sort((left, right) => left.surfaceIndex - right.surfaceIndex);
  const assignments = matchDraftBandsToAreas(sourceAreas, draft);
  return sourceAreas.map((area, index) => {
    const { section, band } = assignments[index];
    return {
      ...area,
      id: `__road_preview__-exact-${index}`,
      roadId: '__road_preview__',
      sectionId: section.id,
      bandId: band.id ?? `band-${index + 1}`,
      surfaceType: roadSurfaceTypeForBand(band),
      function: TRAFFIC_FUNCTIONS[band.kind],
      geometryMode: 'exact',
      editableDraft: undefined,
      attributes: {
        ...area.attributes,
        ...roadBandAttributeValues(section, band),
      },
    };
  });
}

/**
 * Update Transportation semantics and persisted layout metadata in place.
 * Boundaries and vertices are never replaced by this function.
 */
export function updateExactRoadAttributesInCityJson(
  doc: CityJsonDocument,
  roadId: string,
  draft: RoadDraft
): InsertRoadResult {
  const object = doc.CityObjects[roadId];
  if (!object || object.type !== 'Road') {
    throw new Error(`Cannot update exact road attributes: ${roadId} is not a CityJSON Road.`);
  }

  const assignments = flattenDraftBandAssignments(draft);
  let assignmentIndex = 0;
  for (const geometryValue of object.geometry ?? []) {
    const geometry = geometryValue as {
      type?: string;
      boundaries?: unknown[];
      semantics?: {
        surfaces?: Array<Record<string, JsonValue>>;
        values?: unknown[];
      };
    };
    if (geometry.type !== 'MultiSurface' || !Array.isArray(geometry.boundaries)) continue;
    const surfaces = geometry.semantics?.surfaces;
    if (!surfaces || surfaces.length === 0) {
      throw new Error(`Cannot preserve ${roadId}: its exact surfaces have no semantics.`);
    }
    const values = geometry.semantics?.values;
    for (let boundaryIndex = 0; boundaryIndex < geometry.boundaries.length; boundaryIndex++) {
      const assignment = assignments[assignmentIndex++];
      if (!assignment) {
        throw new Error(`Cannot preserve ${roadId}: the draft has fewer bands than exact surfaces.`);
      }
      const semanticValue = Array.isArray(values) ? values[boundaryIndex] : boundaryIndex;
      const semanticIndex = typeof semanticValue === 'number' ? semanticValue : boundaryIndex;
      const surface = surfaces[semanticIndex];
      if (!surface) {
        throw new Error(`Cannot preserve ${roadId}: surface ${boundaryIndex} has no semantic record.`);
      }
      applyBandAttributesToSemanticSurface(surface, assignment.section, assignment.band);
    }
  }
  if (assignmentIndex !== assignments.length) {
    throw new Error(`Cannot preserve ${roadId}: the draft has more bands than exact surfaces.`);
  }

  object.attributes = {
    ...(object.attributes ?? {}),
    name: draft.name ?? object.attributes?.name ?? null,
    _roadGeometryMode: 'exact',
    _roadLayout: roadDraftToJson(draft),
    _updatedAt: new Date().toISOString(),
    _userVerified: draft.userVerified ?? object.attributes?._userVerified ?? false,
  };
  return {
    id: roadId,
    areas: extractTransportationAreas(doc).filter((area) => area.roadId === roadId),
    vertexCount: 0,
  };
}

export function extractTransportationAreas(doc: CityJsonDocument): RoadArea[] {
  const crs = detectCrs(doc);
  if (!crs.supported) return [];
  const areas: RoadArea[] = [];
  for (const [roadId, object] of Object.entries(doc.CityObjects)) {
    if (object.type !== 'Road') continue;
    const objectVertical = roadVerticalProfileFromCityObject(object);
    const editableDraft = readEditableRoadDraftFromCityObject(object);
    const geometryMode = roadGeometryModeFromCityObject(object, editableDraft);
    for (const geometry of object.geometry ?? []) {
      const geom = geometry as {
        type?: string;
        boundaries?: unknown;
        semantics?: {
          surfaces?: Array<Record<string, JsonValue>>;
          values?: unknown;
        };
      };
      if (geom.type !== 'MultiSurface' || !Array.isArray(geom.boundaries)) continue;
      const surfaces = geom.semantics?.surfaces ?? [];
      const values = geom.semantics?.values;
      for (let surfaceIndex = 0; surfaceIndex < geom.boundaries.length; surfaceIndex++) {
        const face = readFace(geom.boundaries[surfaceIndex]);
        const ring = face[0] ?? [];
        if (ring.length < 3) continue;
        const semanticIndex = Array.isArray(values) ? values[surfaceIndex] : surfaceIndex;
        const surface =
          typeof semanticIndex === 'number' ? surfaces[semanticIndex] ?? {} : {};
        const polygon: [number, number][] = [];
        let minElevation = Infinity;
        let maxElevation = -Infinity;
        for (const vertexIndex of ring) {
          const vertex = doc.vertices[vertexIndex];
          if (!vertex) continue;
          const c = applyVertexTransform(vertex, doc);
          polygon.push(projectToWgs84(crs.code, c));
          minElevation = Math.min(minElevation, c.z);
          maxElevation = Math.max(maxElevation, c.z);
        }
        if (polygon.length < 3) continue;
        closeLngLatRing(polygon);
        const surfaceType =
          surface.type === 'AuxiliaryTrafficArea' ? 'AuxiliaryTrafficArea' : 'TrafficArea';
        const osm2streetsProperties = jsonObject(surface.osm2streetsProperties);
        areas.push({
          id: `${roadId}-surface-${surfaceIndex}`,
          roadId,
          sectionId: String(surface.sectionId ?? ''),
          bandId: String(surface.bandId ?? ''),
          surfaceIndex,
          surfaceType,
          function: String(surface.function ?? 'road_surface'),
          polygon,
          vertical: objectVertical
            ? resolveRoadVerticalProfile(
                objectVertical,
                Number.isFinite(minElevation) &&
                Number.isFinite(maxElevation) &&
                  maxElevation - minElevation <= 0.01
                  ? (minElevation + maxElevation) / 2
                  : undefined,
                { fallbackIsExplicit: objectVertical.source === 'cityjson_geometry' }
              )
            : {
                placement: 'unknown',
                source: 'cityjson_geometry',
                ...(Number.isFinite(minElevation) &&
                Number.isFinite(maxElevation) &&
                maxElevation - minElevation <= 0.01
                  ? { elevationM: (minElevation + maxElevation) / 2 }
                  : {}),
              },
          ...(editableDraft ? { editableDraft: cloneDraft(editableDraft) } : {}),
          geometryMode,
          attributes: {
            function: String(surface.function ?? 'road_surface'),
            transportationUsage: (surface.transportationUsage ?? null) as JsonValue,
            trafficDirection: (surface.trafficDirection ?? null) as JsonValue,
            allowedModes: (surface.allowedModes ?? null) as JsonValue,
            surfaceMaterial: (surface.surfaceMaterial ?? null) as JsonValue,
            maxspeed: (surface.maxspeed ?? null) as JsonValue,
            source: (surface.source ?? object.attributes?._source ?? null) as JsonValue,
            roadName: (object.attributes?.name ?? null) as JsonValue,
            sourceType: (surface.sourceType ?? osm2streetsProperties?.type ?? null) as JsonValue,
            osm2streetsRoadId: (
              surface.osm2streetsRoadId ?? object.attributes?._osm2streetsRoadId ?? null
            ) as JsonValue,
            sourceCenterlineWgs84: (
              surface.sourceCenterlineWgs84 ?? object.attributes?._sourceCenterlineWgs84 ?? null
            ) as JsonValue,
            osm2streetsLaneIndex: (surface.osm2streetsLaneIndex ?? null) as JsonValue,
            osm2streetsIntersectionId: (surface.osm2streetsIntersectionId ?? null) as JsonValue,
            connectedRoadIds: (surface.connectedRoadIds ?? null) as JsonValue,
            osmNodeIds: (surface.osmNodeIds ?? null) as JsonValue,
            osmWayIds: (
              surface.osmWayIds ??
              object.attributes?._osmWayIds ??
              object.attributes?._osmWayId ??
              null
            ) as JsonValue,
            osm2streetsPropertiesJson: (surface.osm2streetsPropertiesJson ?? null) as JsonValue,
          },
        });
      }
    }
  }
  return areas;
}

/**
 * Build the editable ribbon model from an imported CityJSON Road that only
 * carries exact Transportation surfaces. The original polygons stay untouched
 * until the caller explicitly saves the derived draft back to the document.
 */
export function deriveEditableRoadDraftFromAreas(
  areas: RoadArea[],
  roadId: string
): RoadDraft {
  const roadAreas = areas.filter((area) => area.roadId === roadId);
  if (roadAreas.length === 0) {
    throw new Error(`Could not find CityJSON Transportation surfaces for ${roadId}.`);
  }

  const sectionGroups = new Map<string, RoadArea[]>();
  for (const area of roadAreas) {
    const sectionId = area.sectionId || `${roadId}-section-1`;
    const current = sectionGroups.get(sectionId) ?? [];
    current.push(area);
    sectionGroups.set(sectionId, current);
  }

  const sections = [...sectionGroups.entries()]
    .sort(([, a], [, b]) => minimumSurfaceIndex(a) - minimumSurfaceIndex(b))
    .map(([sectionId, sectionAreas]) => {
      const orderedAreas = uniqueImportedBandAreas(sectionAreas);
      const bands = orderedAreas.map((area, index) => importedRoadBand(area, index));
      const centerlineWgs84 =
        importedSourceCenterline(sectionAreas) ?? deriveCenterlineFromImportedAreas(sectionAreas);
      const maxspeedKmh = bands.find((band) => Number.isFinite(band.maxspeedKmh))
        ?.maxspeedKmh;
      return {
        id: sectionId,
        centerlineWgs84,
        curve: { ...DEFAULT_ROAD_CURVE },
        bands,
        ...(maxspeedKmh === undefined ? {} : { maxspeedKmh }),
      };
    });

  const sourceOsmWayId = firstImportedOsmWayId(roadAreas);
  const vertical = roadAreas.find((area) => area.vertical)?.vertical;
  const isOsmDerived = roadAreas.some(
    (area) => String(area.attributes.source ?? '').toLowerCase() === 'osm2streets'
  );
  return {
    id: roadId,
    name:
      roadAreas
        .map((area) => stringValue(area.attributes.roadName))
        .find((value) => value !== undefined) ?? roadId,
    source: isOsmDerived ? 'osm' : 'manual',
    ...(sourceOsmWayId === undefined ? {} : { sourceOsmWayId }),
    ...(vertical ? { vertical: { ...vertical } } : {}),
    userVerified: false,
    sections,
  };
}

function minimumSurfaceIndex(areas: RoadArea[]): number {
  return Math.min(...areas.map((area) => area.surfaceIndex));
}

function flattenDraftBandAssignments(draft: RoadDraft): DraftBandAssignment[] {
  return draft.sections.flatMap((section) =>
    section.bands.map((band) => ({ section, band }))
  );
}

function matchDraftBandsToAreas(
  areas: RoadArea[],
  draft: RoadDraft
): DraftBandAssignment[] {
  const assignments = flattenDraftBandAssignments(draft);
  if (assignments.length !== areas.length) {
    throw new Error(
      `Exact road attribute preview needs one draft band per surface; found ${assignments.length} bands and ${areas.length} surfaces.`
    );
  }
  const unused = new Set(assignments.map((_, index) => index));
  return areas.map((area) => {
    let match = assignments.findIndex(
      ({ section, band }, index) =>
        unused.has(index) &&
        section.id === area.sectionId &&
        (band.id ?? '') === area.bandId
    );
    if (match < 0) match = [...unused][0] ?? -1;
    if (match < 0) throw new Error('Could not match an exact road surface to its draft band.');
    unused.delete(match);
    return assignments[match];
  });
}

function roadSurfaceTypeForBand(
  band: RoadBand
): RoadArea['surfaceType'] {
  return band.kind === 'median' || band.kind === 'green'
    ? 'AuxiliaryTrafficArea'
    : 'TrafficArea';
}

function roadBandAttributeValues(
  section: RoadSectionDraft,
  band: RoadBand
): Record<string, JsonValue> {
  return {
    transportationUsage: band.kind,
    sourceType: band.sourceType ?? null,
    trafficDirection: band.direction ?? defaultDirectionForBand(band.kind),
    surfaceMaterial: band.surface ?? defaultSurfaceForBand(band.kind),
    allowedModes: [...(band.allowedModes ?? defaultModesForBand(band.kind))],
    maxspeed: band.maxspeedKmh ?? section.maxspeedKmh ?? null,
  };
}

function applyBandAttributesToSemanticSurface(
  surface: Record<string, JsonValue>,
  section: RoadSectionDraft,
  band: RoadBand
): void {
  const attributes = roadBandAttributeValues(section, band);
  surface.type = roadSurfaceTypeForBand(band);
  surface.function = TRAFFIC_FUNCTIONS[band.kind];
  surface.transportationUsage = attributes.transportationUsage;
  surface.sourceType = attributes.sourceType;
  surface.trafficDirection = attributes.trafficDirection;
  surface.surfaceMaterial = attributes.surfaceMaterial;
  surface.allowedModes = attributes.allowedModes;
  surface.maxspeed = attributes.maxspeed;
  surface.sectionId = section.id;
  surface.bandId = band.id ?? null;
}

function roadGeometryModeFromCityObject(
  object: CityObject,
  editableDraft: RoadDraft | null
): RoadGeometryMode {
  const explicit = object.attributes?._roadGeometryMode;
  if (explicit === 'exact' || explicit === 'generated') return explicit;
  return editableDraft ? 'generated' : 'exact';
}

function sameFiniteNumber(left: number | undefined, right: number | undefined): boolean {
  const leftFinite = Number.isFinite(left);
  const rightFinite = Number.isFinite(right);
  if (!leftFinite || !rightFinite) return leftFinite === rightFinite;
  return Math.abs((left ?? 0) - (right ?? 0)) <= 1e-6;
}

function uniqueImportedBandAreas(areas: RoadArea[]): RoadArea[] {
  const bands = new Map<string, RoadArea>();
  for (const area of [...areas].sort(importedAreaOrder)) {
    const laneIndex = finiteNumber(area.attributes.osm2streetsLaneIndex);
    const key =
      laneIndex !== null
        ? `lane:${laneIndex}`
        : area.bandId
          ? `band:${area.bandId}`
          : `surface:${area.surfaceIndex}`;
    if (!bands.has(key)) bands.set(key, area);
  }
  return [...bands.values()];
}

function importedAreaOrder(a: RoadArea, b: RoadArea): number {
  const aLane = finiteNumber(a.attributes.osm2streetsLaneIndex);
  const bLane = finiteNumber(b.attributes.osm2streetsLaneIndex);
  return (aLane ?? a.surfaceIndex) - (bLane ?? b.surfaceIndex);
}

function importedRoadBand(area: RoadArea, index: number): RoadBand {
  const sourceProperties = importedOsm2StreetsProperties(area);
  const sourceType = stringValue(area.attributes.sourceType) ?? stringValue(sourceProperties?.type);
  const kind = importedRoadBandKind(area, sourceType);
  const widthM =
    finiteNumber(area.attributes.widthMeters) ??
    finiteNumber(area.attributes.width) ??
    finiteNumber(sourceProperties?.width) ??
    DEFAULT_WIDTHS[kind];
  const maxspeedKmh =
    finiteNumber(area.attributes.maxspeed) ?? finiteNumber(sourceProperties?.speed_limit);
  const allowedModes = stringArray(area.attributes.allowedModes);

  return {
    id: area.bandId || `imported-${kind}-${index}`,
    kind,
    ...(sourceType ? { sourceType } : {}),
    widthM: Math.max(0.4, Math.min(12, widthM)),
    direction: importedRoadDirection(area.attributes.trafficDirection),
    ...(allowedModes.length > 0 ? { allowedModes } : {}),
    ...(maxspeedKmh === null ? {} : { maxspeedKmh }),
  };
}

function importedRoadBandKind(area: RoadArea, sourceType?: string): RoadBandKind {
  const key = normalizeImportedRoadValue(
    `${String(area.attributes.transportationUsage ?? '')} ${area.function} ${sourceType ?? ''}`
  );
  if (key.includes('bike') || key.includes('biking') || key.includes('cycle')) return 'bike_lane';
  if (key.includes('sidewalk') || key.includes('foot') || key.includes('shoulder') || key.includes('shareduse')) {
    return 'sidewalk';
  }
  if (key.includes('parking')) return 'parking';
  if (key.includes('green') || key.includes('planter') || key.includes('verge')) return 'green';
  if (key.includes('median') || key.includes('buffer') || key.includes('curb')) return 'median';
  return area.surfaceType === 'AuxiliaryTrafficArea' ? 'median' : 'car_lane';
}

function importedRoadDirection(value: unknown): RoadDirection {
  const direction = normalizeImportedRoadValue(String(value ?? ''));
  if (direction === 'forward' || direction === 'backward' || direction === 'both') return direction;
  if (direction === 'bidirectional') return 'both';
  return 'none';
}

function importedOsm2StreetsProperties(area: RoadArea): Record<string, unknown> | null {
  const value = area.attributes.osm2streetsPropertiesJson;
  if (typeof value !== 'string') return null;
  try {
    return unknownRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function deriveCenterlineFromImportedAreas(areas: RoadArea[]): [number, number][] {
  let best: [[number, number], [number, number]] | null = null;
  let bestDistance = -Infinity;
  for (const area of areas) {
    const pair = farthestLngLatPair(area.polygon);
    if (!pair) continue;
    const distance = squaredLngLatDistance(pair[0], pair[1]);
    if (distance > bestDistance) {
      best = pair;
      bestDistance = distance;
    }
  }
  if (!best || bestDistance <= 0) {
    throw new Error('Could not derive an editable centerline from the imported CityJSON road surfaces.');
  }
  return best;
}

function importedSourceCenterline(areas: RoadArea[]): [number, number][] | null {
  for (const area of areas) {
    const line = readWgs84Line(area.attributes.sourceCenterlineWgs84);
    if (line) return line;
  }
  return null;
}

function farthestLngLatPair(
  polygon: [number, number][]
): [[number, number], [number, number]] | null {
  const first = polygon[0];
  if (!first || polygon.length < 2) return null;
  const endA = farthestPointFrom(first, polygon);
  const endB = farthestPointFrom(endA, polygon);
  return squaredLngLatDistance(endA, endB) > 0 ? [[...endA], [...endB]] : null;
}

function farthestPointFrom(
  origin: [number, number],
  points: [number, number][]
): [number, number] {
  let farthest = origin;
  let distance = -Infinity;
  for (const point of points) {
    const candidate = squaredLngLatDistance(origin, point);
    if (candidate > distance) {
      farthest = point;
      distance = candidate;
    }
  }
  return farthest;
}

function squaredLngLatDistance(a: [number, number], b: [number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function firstImportedOsmWayId(areas: RoadArea[]): string | number | undefined {
  for (const area of areas) {
    const value = area.attributes.osmWayIds;
    if (Array.isArray(value)) {
      const first = value.find((entry) => typeof entry === 'string' || typeof entry === 'number');
      if (typeof first === 'string' || typeof first === 'number') return first;
    }
    if (typeof value === 'string' || typeof value === 'number') return value;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeImportedRoadValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildRoadEditPayload(
  draft: RoadDraft,
  roadObjectId?: string
): RoadEditPayload {
  return {
    schemaVersion: 'webcityeditor-road-edit-v1',
    target: 'cityjson-transportation',
    roadObjectId,
    draft: cloneDraft(draft),
  };
}

export function summarizeRoadDraft(draft: RoadDraft): string {
  const first = draft.sections[0];
  if (!first) return 'Empty road draft';
  const specialMotorTypes = new Set(['bus', 'buslane', 'lightrail', 'tram', 'construction']);
  const lanes = first.bands.filter(
    (band) =>
      band.kind === 'car_lane' &&
      !specialMotorTypes.has(normalizeSemanticType(band.sourceType ?? ''))
  ).length;
  const bus = first.bands.filter((band) =>
    ['bus', 'buslane'].includes(normalizeSemanticType(band.sourceType ?? ''))
  ).length;
  const rail = first.bands.filter((band) =>
    ['lightrail', 'tram'].includes(normalizeSemanticType(band.sourceType ?? ''))
  ).length;
  const bike = first.bands.filter((band) => band.kind === 'bike_lane').length;
  const sidewalks = first.bands.filter((band) => band.kind === 'sidewalk').length;
  const speed = first.maxspeedKmh ? `, ${first.maxspeedKmh} km/h` : '';
  const special = [
    bus > 0 ? `${bus} bus lane${bus === 1 ? '' : 's'}` : null,
    rail > 0 ? `${rail} light-rail lane${rail === 1 ? '' : 's'}` : null,
  ].filter((label): label is string => !!label);
  return `${lanes} car lane${lanes === 1 ? '' : 's'}, ${bike} bike lane${
    bike === 1 ? '' : 's'
  }, ${sidewalks} sidewalk${sidewalks === 1 ? '' : 's'}${
    special.length > 0 ? `, ${special.join(', ')}` : ''
  }${speed}`;
}

function buildProjectedRoadAreas(
  doc: CityJsonDocument,
  draft: RoadDraft,
  crsCode: string
): ProjectedRoadArea[] {
  const areas: ProjectedRoadArea[] = [];
  for (const section of draft.sections) {
    validateSection(section);
    const centerlineWgs84 = sampleRoadSectionCenterlineWgs84(section);
    const centerline = normaliseProjectedLine(
      centerlineWgs84.map(([lng, lat]) => {
        const [x, y] = proj4('EPSG:4326', crsCode, [lng, lat]) as [number, number];
        return { x, y };
      })
    );
    const totalWidth = section.bands.reduce((sum, band) => sum + band.widthM, 0);
    let offset = totalWidth / 2;
    for (let i = 0; i < section.bands.length; i++) {
      const band = section.bands[i];
      const leftOffset = offset;
      const rightOffset = offset - band.widthM;
      offset = rightOffset;
      const polygon = buildRibbonPolygon(centerline, leftOffset, rightOffset);
      validateProjectedPolygon(polygon, `${section.id}.${band.id ?? `band-${i + 1}`}`);
      const surfaceType =
        band.kind === 'median' || band.kind === 'green'
          ? 'AuxiliaryTrafficArea'
          : 'TrafficArea';
      areas.push({
        id: `${section.id}-${band.id ?? `band-${i + 1}`}`,
        roadId: '',
        sectionId: section.id,
        bandId: band.id ?? `band-${i + 1}`,
        surfaceIndex: areas.length,
        surfaceType,
        function: TRAFFIC_FUNCTIONS[band.kind],
        polygon,
        attributes: {
          transportationUsage: band.kind,
          sourceType: band.sourceType ?? null,
          trafficDirection: band.direction ?? defaultDirectionForBand(band.kind),
          surfaceMaterial: band.surface ?? defaultSurfaceForBand(band.kind),
          allowedModes: band.allowedModes ?? defaultModesForBand(band.kind),
          maxspeed: band.maxspeedKmh ?? section.maxspeedKmh ?? null,
          sourceCenterlineWgs84: centerlineWgs84.map(([lng, lat]) => [lng, lat]),
        },
      });
    }
  }
  if (areas.length === 0) {
    throw new Error('Cannot create road: draft has no road bands.');
  }
  // Touch the doc param so strict/noUnused stays happy when options grow.
  void doc;
  return areas;
}

function validateSection(section: RoadSectionDraft): void {
  if (normaliseWgs84Line(section.centerlineWgs84).length < 2) {
    throw new Error(`Road section "${section.id}" needs at least two centerline points.`);
  }
  if (section.bands.length === 0) {
    throw new Error(`Road section "${section.id}" needs at least one lane/sidewalk band.`);
  }
  for (const band of section.bands) {
    if (!Number.isFinite(band.widthM) || band.widthM <= 0) {
      throw new Error(
        `Road section "${section.id}" has invalid width for ${band.kind}: ${band.widthM}`
      );
    }
  }
}

function buildRibbonPolygon(
  centerline: ProjectedPoint[],
  leftOffset: number,
  rightOffset: number
): ProjectedPoint[] {
  const left = offsetPolyline(centerline, leftOffset);
  const right = offsetPolyline(centerline, rightOffset).reverse();
  let polygon = removeConsecutiveProjectedDuplicates([...left, ...right]);
  if (signedAreaProjected(polygon) < 0) polygon = polygon.reverse();
  return polygon;
}

function offsetPolyline(points: ProjectedPoint[], offset: number): ProjectedPoint[] {
  if (points.length < 2) throw new Error('Cannot offset a road with fewer than two points.');
  if (Math.abs(offset) < 1e-9) return points.map((point) => ({ ...point }));

  const result: ProjectedPoint[] = [];
  const normals: ProjectedPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) throw new Error('Road centerline has duplicate projected points.');
    normals.push({ x: -dy / len, y: dx / len });
  }

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      result.push(addNormal(points[i], normals[0], offset));
      continue;
    }
    if (i === points.length - 1) {
      result.push(addNormal(points[i], normals[normals.length - 1], offset));
      continue;
    }
    const prevNormal = normals[i - 1];
    const nextNormal = normals[i];
    const prevA = addNormal(points[i - 1], prevNormal, offset);
    const prevB = addNormal(points[i], prevNormal, offset);
    const nextA = addNormal(points[i], nextNormal, offset);
    const nextB = addNormal(points[i + 1], nextNormal, offset);
    const intersection = lineIntersection(prevA, prevB, nextA, nextB);
    if (intersection && distance(intersection, points[i]) <= Math.max(4, Math.abs(offset) * 6)) {
      result.push(intersection);
    } else {
      const nx = prevNormal.x + nextNormal.x;
      const ny = prevNormal.y + nextNormal.y;
      const len = Math.hypot(nx, ny);
      result.push(
        len < 1e-9
          ? addNormal(points[i], nextNormal, offset)
          : {
              x: points[i].x + (nx / len) * offset,
              y: points[i].y + (ny / len) * offset,
            }
      );
    }
  }
  return result;
}

function validateProjectedPolygon(polygon: ProjectedPoint[], label: string): void {
  if (polygon.length < 3) {
    throw new Error(`Road band ${label} generated fewer than three polygon points.`);
  }
  if (!polygon.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))) {
    throw new Error(`Road band ${label} generated non-finite coordinates.`);
  }
  if (Math.abs(signedAreaProjected(polygon)) < 0.05) {
    throw new Error(`Road band ${label} is too small or collapsed.`);
  }
  if (selfIntersects(polygon)) {
    throw new Error(
      `Road band ${label} self-intersects. Redraw the centerline or reduce the lane widths.`
    );
  }
}

function normaliseWgs84Line(line: [number, number][]): [number, number][] {
  const result: [number, number][] = [];
  for (const point of line) {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    ) {
      continue;
    }
    const prev = result[result.length - 1];
    if (!prev || Math.hypot(prev[0] - point[0], prev[1] - point[1]) > 1e-12) {
      result.push([point[0], point[1]]);
    }
  }
  return result;
}

/**
 * Sample the visible/exported centerline from a small set of touch-friendly
 * anchors. The same samples drive the map path and CityJSON ribbons so the
 * saved road matches what the user edited.
 */
export function sampleRoadSectionCenterlineWgs84(
  section: RoadSectionDraft
): [number, number][] {
  const points = normaliseWgs84Line(section.centerlineWgs84);
  const curve = normaliseRoadCurve(section.curve);
  if (points.length < 3 || curve.mode === 'straight' || curve.strength <= 0) {
    return points;
  }

  const sampled: [number, number][] = [];
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex++) {
    const lengthM = haversine(points[segmentIndex], points[segmentIndex + 1]);
    const steps = Math.max(
      ROAD_CURVE_MIN_STEPS,
      Math.min(ROAD_CURVE_MAX_STEPS, Math.ceil(lengthM / ROAD_CURVE_SAMPLE_METERS))
    );
    for (let step = 0; step <= steps; step++) {
      if (segmentIndex > 0 && step === 0) continue;
      sampled.push(
        roadSectionPointAt(section, segmentIndex, step / steps, points, curve)
      );
    }
  }
  return normaliseWgs84Line(sampled);
}

/** Return a point on one anchor span; used for the white add-anchor handles. */
export function roadSectionPointAt(
  section: RoadSectionDraft,
  segmentIndex: number,
  fraction: number,
  normalizedPoints = normaliseWgs84Line(section.centerlineWgs84),
  normalizedCurve = normaliseRoadCurve(section.curve)
): [number, number] {
  const points = normalizedPoints;
  const index = Math.max(0, Math.min(points.length - 2, segmentIndex));
  const p1 = points[index];
  const p2 = points[index + 1];
  const u = Math.max(0, Math.min(1, fraction));
  if (
    points.length < 3 ||
    normalizedCurve.mode === 'straight' ||
    normalizedCurve.strength <= 0
  ) {
    return lerpLngLat(p1, p2, u);
  }

  const p0 =
    index > 0
      ? points[index - 1]
      : ([2 * p1[0] - p2[0], 2 * p1[1] - p2[1]] as [number, number]);
  const p3 =
    index + 2 < points.length
      ? points[index + 2]
      : ([2 * p2[0] - p1[0], 2 * p2[1] - p1[1]] as [number, number]);
  const smooth = centripetalCatmullRom(p0, p1, p2, p3, u);
  const linear = lerpLngLat(p1, p2, u);
  return lerpLngLat(linear, smooth, normalizedCurve.strength);
}

function normaliseRoadCurve(curve: RoadCurveSettings | undefined): RoadCurveSettings {
  if (!curve) return { ...DEFAULT_ROAD_CURVE };
  return {
    mode: curve.mode === 'straight' ? 'straight' : 'smooth',
    strength: Number.isFinite(curve.strength)
      ? Math.max(0, Math.min(1, curve.strength))
      : DEFAULT_ROAD_CURVE.strength,
  };
}

function centripetalCatmullRom(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  fraction: number
): [number, number] {
  const t0 = 0;
  const t1 = t0 + catmullInterval(p0, p1);
  const t2 = t1 + catmullInterval(p1, p2);
  const t3 = t2 + catmullInterval(p2, p3);
  const t = t1 + (t2 - t1) * fraction;
  const a1 = interpolateCatmull(p0, p1, t0, t1, t);
  const a2 = interpolateCatmull(p1, p2, t1, t2, t);
  const a3 = interpolateCatmull(p2, p3, t2, t3, t);
  const b1 = interpolateCatmull(a1, a2, t0, t2, t);
  const b2 = interpolateCatmull(a2, a3, t1, t3, t);
  return interpolateCatmull(b1, b2, t1, t2, t);
}

function catmullInterval(a: [number, number], b: [number, number]): number {
  // sqrt(distance) is the centripetal alpha=0.5 parameterisation. A tiny
  // floor keeps reflected/near-duplicate endpoints numerically stable.
  return Math.max(1e-6, Math.sqrt(Math.max(1e-9, haversine(a, b))));
}

function interpolateCatmull(
  a: [number, number],
  b: [number, number],
  ta: number,
  tb: number,
  t: number
): [number, number] {
  const span = Math.max(1e-9, tb - ta);
  const wa = (tb - t) / span;
  const wb = (t - ta) / span;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb];
}

function lerpLngLat(
  a: [number, number],
  b: [number, number],
  t: number
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function normaliseProjectedLine(line: ProjectedPoint[]): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];
  for (const point of line) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const prev = result[result.length - 1];
    if (!prev || distance(prev, point) > 1e-6) result.push(point);
  }
  return result;
}

function splitLineAtFraction(
  line: [number, number][],
  fraction: number
): [[number, number][], [number, number][]] {
  const clean = normaliseWgs84Line(line);
  if (clean.length < 2) throw new Error('Road centerline needs at least two points to split.');
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < clean.length - 1; i++) {
    const len = haversine(clean[i], clean[i + 1]);
    lengths.push(len);
    total += len;
  }
  const target = total * fraction;
  let walked = 0;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i];
    if (walked + len >= target) {
      const local = len > 0 ? (target - walked) / len : 0;
      const split: [number, number] = [
        clean[i][0] + (clean[i + 1][0] - clean[i][0]) * local,
        clean[i][1] + (clean[i + 1][1] - clean[i][1]) * local,
      ];
      return [
        [...clean.slice(0, i + 1), split],
        [split, ...clean.slice(i + 1)],
      ];
    }
    walked += len;
  }
  const last = clean[clean.length - 1];
  return [clean.slice(0, -1), [clean[clean.length - 2], last]];
}

function simplifyWgs84Line(
  line: [number, number][],
  toleranceMeters: number
): [number, number][] {
  const clean = normaliseWgs84Line(line);
  if (clean.length <= 2) return clean;
  const keep = new Set<number>([0, clean.length - 1]);
  const stack: Array<[number, number]> = [[0, clean.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let bestIndex = -1;
    let bestDistance = toleranceMeters;
    for (let index = start + 1; index < end; index++) {
      const candidate = pointToLngLatSegmentDistanceMeters(
        clean[index],
        clean[start],
        clean[end]
      );
      if (candidate > bestDistance) {
        bestDistance = candidate;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) {
      keep.add(bestIndex);
      stack.push([start, bestIndex], [bestIndex, end]);
    }
  }
  return [...keep]
    .sort((a, b) => a - b)
    .map((index) => clean[index]);
}

function pointToLngLatSegmentDistanceMeters(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  const latitude = ((point[1] + start[1] + end[1]) / 3) * (Math.PI / 180);
  const metersPerLng = 111_320 * Math.max(0.01, Math.cos(latitude));
  const metersPerLat = 110_540;
  const px = (point[0] - start[0]) * metersPerLng;
  const py = (point[1] - start[1]) * metersPerLat;
  const ex = (end[0] - start[0]) * metersPerLng;
  const ey = (end[1] - start[1]) * metersPerLat;
  const lengthSquared = ex * ex + ey * ey;
  if (lengthSquared < 1e-9) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));
  return Math.hypot(px - ex * t, py - ey * t);
}

function isOneway(tags: Record<string, string>): boolean {
  const value = tags.oneway?.toLowerCase();
  return value === 'yes' || value === '1' || value === 'true';
}

function hasSidewalk(tags: Record<string, string>, side: 'left' | 'right'): boolean {
  const sidewalk = tags.sidewalk?.toLowerCase();
  const sideValue = tags[`sidewalk:${side}`]?.toLowerCase();
  if (sideValue && sideValue !== 'no' && sideValue !== 'none') return true;
  return sidewalk === 'yes' || sidewalk === 'both' || sidewalk === side;
}

function hasCycleway(tags: Record<string, string>, side: 'left' | 'right'): boolean {
  const values = [
    tags.cycleway,
    tags[`cycleway:${side}`],
    tags[`cycleway:both`],
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return values.some((value) =>
    ['lane', 'track', 'opposite_lane', 'shared_lane', 'separate'].includes(value)
  );
}

function parseMaxspeed(value: string | undefined): number | null {
  if (!value) return null;
  if (/mph/i.test(value)) {
    const mph = parsePositiveNumber(value);
    return mph ? Math.round(mph * 1.60934) : null;
  }
  return parsePositiveNumber(value);
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSignedNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isTruthyOsmTag(value: string | undefined): boolean {
  if (!value) return false;
  return !['no', 'false', '0', 'none'].includes(value.trim().toLowerCase());
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function addNormal(point: ProjectedPoint, normal: ProjectedPoint, offset: number): ProjectedPoint {
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

function lineIntersection(
  a: ProjectedPoint,
  b: ProjectedPoint,
  c: ProjectedPoint,
  d: ProjectedPoint
): ProjectedPoint | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denom = cross(r, s);
  if (Math.abs(denom) < 1e-9) return null;
  const t = cross({ x: c.x - a.x, y: c.y - a.y }, s) / denom;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function removeConsecutiveProjectedDuplicates(points: ProjectedPoint[]): ProjectedPoint[] {
  const result: ProjectedPoint[] = [];
  for (const point of points) {
    const prev = result[result.length - 1];
    if (!prev || distance(prev, point) > 1e-6) result.push(point);
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (first && last && distance(first, last) < 1e-6) result.pop();
  return result;
}

function selfIntersects(points: ProjectedPoint[]): boolean {
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j++) {
      const adjacent =
        j === i ||
        j === (i + 1) % points.length ||
        i === (j + 1) % points.length ||
        (i === 0 && j === points.length - 1);
      if (adjacent) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function segmentsIntersect(
  a: ProjectedPoint,
  b: ProjectedPoint,
  c: ProjectedPoint,
  d: ProjectedPoint
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orientation(a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint): number {
  const value = cross({ x: b.x - a.x, y: b.y - a.y }, { x: c.x - a.x, y: c.y - a.y });
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : -1;
}

function cross(a: ProjectedPoint, b: ProjectedPoint): number {
  return a.x * b.y - a.y * b.x;
}

function distance(a: ProjectedPoint, b: ProjectedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function signedAreaProjected(points: ProjectedPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function haversine(a: [number, number], b: [number, number]): number {
  const radius = 6_371_000;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function defaultDirectionForBand(kind: RoadBandKind): RoadDirection {
  if (kind === 'car_lane' || kind === 'bike_lane') return 'forward';
  return 'none';
}

function defaultSurfaceForBand(kind: RoadBandKind): string {
  if (kind === 'green') return 'grass';
  if (kind === 'sidewalk' || kind === 'bike_lane') return 'asphalt';
  return 'asphalt';
}

function defaultModesForBand(kind: RoadBandKind): string[] {
  if (kind === 'sidewalk') return ['pedestrian'];
  if (kind === 'bike_lane') return ['bicycle'];
  if (kind === 'car_lane' || kind === 'parking') return ['car'];
  return [];
}

function normalizeSemanticType(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cloneBands(bands: RoadBand[]): RoadBand[] {
  return bands.map((band) => ({
    ...band,
    allowedModes: band.allowedModes ? [...band.allowedModes] : undefined,
  }));
}

function cloneDraft(draft: RoadDraft): RoadDraft {
  return JSON.parse(JSON.stringify(draft)) as RoadDraft;
}

function roadDraftToJson(draft: RoadDraft): JsonValue {
  return cloneDraft(draft) as unknown as JsonValue;
}

function jsonRecord(record: Record<string, string>): JsonValue {
  return { ...record } as JsonValue;
}

function resolveRoadVerticalProfile(
  profile: RoadVerticalProfile,
  fallbackSurfaceElevation?: number,
  options: { fallbackIsExplicit?: boolean } = {}
): RoadVerticalProfile {
  if (Number.isFinite(profile.elevationM)) return { ...profile };
  if (
    Number.isFinite(fallbackSurfaceElevation) &&
    (profile.placement === 'surface' || options.fallbackIsExplicit)
  ) {
    return { ...profile, elevationM: fallbackSurfaceElevation };
  }
  const withoutElevation = { ...profile };
  delete withoutElevation.elevationM;
  return withoutElevation;
}

function roadVerticalProfileToJson(profile: RoadVerticalProfile): JsonValue {
  return {
    placement: profile.placement,
    source: profile.source,
    elevationM: Number.isFinite(profile.elevationM) ? profile.elevationM ?? null : null,
    osmLayer: Number.isFinite(profile.osmLayer) ? profile.osmLayer ?? null : null,
  };
}

function roadVerticalProfileFromCityObject(object: CityObject): RoadVerticalProfile | null {
  const attributes = unknownRecord(object.attributes);
  const explicit = readRoadVerticalProfile(attributes?._verticalProfile);
  if (explicit) return explicit;

  const layout = unknownRecord(attributes?._roadLayout);
  const layoutProfile = readRoadVerticalProfile(layout?.vertical);
  if (layoutProfile) return layoutProfile;

  const osmTags = stringRecord(attributes?._osmTags);
  return osmTags ? inferRoadVerticalProfileFromOsmTags(osmTags) : null;
}

export function readEditableRoadDraftFromCityObject(object: CityObject): RoadDraft | null {
  const attributes = unknownRecord(object.attributes);
  const layout = unknownRecord(attributes?._roadLayout);
  if (!layout) return null;
  return readRoadDraft(layout);
}

/**
 * Mirror confirmed joins into editable target Road metadata. Geometry is not
 * regenerated: the source endpoint was already snapped to the target's stored
 * anchor, while both CityJSON objects now carry the reciprocal network link.
 */
export function synchronizeRoadConnectionMetadata(
  doc: CityJsonDocument,
  sourceRoadId: string,
  sourceDraft: RoadDraft
): string[] {
  const changedTargets = new Set<string>();
  for (const sourceSection of sourceDraft.sections) {
    for (const sourceEndpoint of ['start', 'end'] as const) {
      const connection = sourceSection.connections?.[sourceEndpoint];
      if (
        connection?.target !== 'cityjson' ||
        !connection.targetSectionId ||
        (connection.targetEndpoint !== 'start' && connection.targetEndpoint !== 'end') ||
        connection.targetId === sourceRoadId
      ) {
        continue;
      }
      const targetObject = doc.CityObjects[connection.targetId];
      if (!targetObject || targetObject.type !== 'Road') continue;
      const targetDraft = readEditableRoadDraftFromCityObject(targetObject);
      if (!targetDraft) continue;
      const targetSection = targetDraft.sections.find(
        (section) => section.id === connection.targetSectionId
      );
      if (!targetSection) continue;
      targetSection.connections = {
        ...targetSection.connections,
        [connection.targetEndpoint]: {
          target: 'cityjson',
          targetId: sourceRoadId,
          targetSectionId: sourceSection.id,
          targetEndpoint: sourceEndpoint,
          positionWgs84: [...connection.positionWgs84],
          confirmed: true,
        },
      };
      targetObject.attributes = {
        ...(targetObject.attributes ?? {}),
        _roadLayout: roadDraftToJson(targetDraft),
        _updatedAt: new Date().toISOString(),
      };
      changedTargets.add(connection.targetId);
    }
  }
  return [...changedTargets];
}

export interface StaleReciprocalRoadConnection {
  roadId: string;
  sectionId: string;
  endpoint: 'start' | 'end';
}

/**
 * Find editable roads that still point at a source endpoint which no longer
 * points back. This happens when a user drags a confirmed endpoint away or
 * reconnects it to a different road.
 */
export function findStaleReciprocalRoadConnections(
  doc: CityJsonDocument,
  sourceRoadId: string,
  sourceDraft: RoadDraft
): StaleReciprocalRoadConnection[] {
  const stale: StaleReciprocalRoadConnection[] = [];
  for (const [candidateId, candidate] of Object.entries(doc.CityObjects)) {
    if (candidateId === sourceRoadId || candidate.type !== 'Road') continue;
    const candidateDraft = readEditableRoadDraftFromCityObject(candidate);
    if (!candidateDraft) continue;

    for (const candidateSection of candidateDraft.sections) {
      for (const candidateEndpoint of ['start', 'end'] as const) {
        const inbound = candidateSection.connections?.[candidateEndpoint];
        if (
          inbound?.target !== 'cityjson' ||
          inbound.targetId !== sourceRoadId ||
          !inbound.targetSectionId ||
          (inbound.targetEndpoint !== 'start' && inbound.targetEndpoint !== 'end')
        ) {
          continue;
        }

        const sourceSection = sourceDraft.sections.find(
          (section) => section.id === inbound.targetSectionId
        );
        const reciprocal = sourceSection?.connections?.[inbound.targetEndpoint];
        const stillReciprocal =
          reciprocal?.target === 'cityjson' &&
          reciprocal.targetId === candidateId &&
          reciprocal.targetSectionId === candidateSection.id &&
          reciprocal.targetEndpoint === candidateEndpoint;
        if (!stillReciprocal) {
          stale.push({
            roadId: candidateId,
            sectionId: candidateSection.id,
            endpoint: candidateEndpoint,
          });
        }
      }
    }
  }
  return stale;
}

/** Clear stale peer metadata after the user explicitly accepts disconnection. */
export function clearStaleReciprocalRoadConnections(
  doc: CityJsonDocument,
  sourceRoadId: string,
  sourceDraft: RoadDraft
): { disconnectedRoadIds: string[]; disconnectedConnectionCount: number } {
  const stale = findStaleReciprocalRoadConnections(doc, sourceRoadId, sourceDraft);
  const staleByRoad = new Map<string, StaleReciprocalRoadConnection[]>();
  for (const connection of stale) {
    const entries = staleByRoad.get(connection.roadId) ?? [];
    entries.push(connection);
    staleByRoad.set(connection.roadId, entries);
  }

  for (const [roadId, connections] of staleByRoad) {
    const object = doc.CityObjects[roadId];
    const draft = object ? readEditableRoadDraftFromCityObject(object) : null;
    if (!object || !draft) continue;
    for (const connection of connections) {
      const section = draft.sections.find((candidate) => candidate.id === connection.sectionId);
      if (!section?.connections) continue;
      delete section.connections[connection.endpoint];
      if (!section.connections.start && !section.connections.end) {
        delete section.connections;
      }
    }
    object.attributes = {
      ...(object.attributes ?? {}),
      _roadLayout: roadDraftToJson(draft),
      _updatedAt: new Date().toISOString(),
    };
  }

  return {
    disconnectedRoadIds: [...staleByRoad.keys()],
    disconnectedConnectionCount: stale.length,
  };
}

/**
 * Delete one CityJSON Road and remove endpoint links to it from every
 * surviving editable Road. The caller can then compact the orphaned geometry
 * vertices as part of the same guarded editor mutation.
 */
export function deleteRoadFromCityJson(
  doc: CityJsonDocument,
  roadId: string
): { deleted: boolean; disconnectedRoadIds: string[] } {
  const road = doc.CityObjects[roadId];
  if (!road || road.type !== 'Road') {
    return { deleted: false, disconnectedRoadIds: [] };
  }

  const disconnectedRoadIds = new Set<string>();
  for (const [candidateId, candidate] of Object.entries(doc.CityObjects)) {
    if (candidateId === roadId || candidate.type !== 'Road') continue;
    const draft = readEditableRoadDraftFromCityObject(candidate);
    if (!draft) continue;

    let changed = false;
    for (const section of draft.sections) {
      if (!section.connections) continue;
      for (const endpoint of ['start', 'end'] as const) {
        const connection = section.connections[endpoint];
        if (connection?.target === 'cityjson' && connection.targetId === roadId) {
          delete section.connections[endpoint];
          changed = true;
        }
      }
      if (!section.connections.start && !section.connections.end) {
        delete section.connections;
      }
    }

    if (!changed) continue;
    candidate.attributes = {
      ...(candidate.attributes ?? {}),
      _roadLayout: roadDraftToJson(draft),
      _updatedAt: new Date().toISOString(),
    };
    disconnectedRoadIds.add(candidateId);
  }

  for (const candidate of Object.values(doc.CityObjects)) {
    if (candidate.children) {
      candidate.children = candidate.children.filter((id) => id !== roadId);
    }
    if (candidate.parents) {
      candidate.parents = candidate.parents.filter((id) => id !== roadId);
    }
  }
  delete doc.CityObjects[roadId];

  return { deleted: true, disconnectedRoadIds: [...disconnectedRoadIds] };
}

function readRoadDraft(value: unknown): RoadDraft | null {
  const record = unknownRecord(value);
  if (!record) return null;

  const source =
    record.source === 'osm' || record.source === 'manual' || record.source === 'opendrive'
      ? record.source
      : null;
  if (!source || !Array.isArray(record.sections)) return null;

  const sections: RoadSectionDraft[] = [];
  for (const sectionValue of record.sections) {
    const section = readRoadSectionDraft(sectionValue);
    if (!section) return null;
    sections.push(section);
  }
  if (sections.length === 0) return null;

  const vertical = readRoadVerticalProfile(record.vertical);
  const osmTags = stringRecord(record.osmTags);
  const draft: RoadDraft = {
    source,
    sections,
  };
  if (typeof record.id === 'string' && record.id.length > 0) draft.id = record.id;
  if (typeof record.name === 'string' && record.name.length > 0) draft.name = record.name;
  if (
    typeof record.sourceOsmWayId === 'string' ||
    (typeof record.sourceOsmWayId === 'number' && Number.isFinite(record.sourceOsmWayId))
  ) {
    draft.sourceOsmWayId = record.sourceOsmWayId;
  }
  if (osmTags) draft.osmTags = osmTags;
  if (vertical) draft.vertical = vertical;
  if (typeof record.userVerified === 'boolean') draft.userVerified = record.userVerified;
  return draft;
}

function readRoadSectionDraft(value: unknown): RoadSectionDraft | null {
  const record = unknownRecord(value);
  if (!record || typeof record.id !== 'string' || record.id.length === 0) return null;
  const centerlineWgs84 = readWgs84Line(record.centerlineWgs84);
  if (!centerlineWgs84 || !Array.isArray(record.bands)) return null;

  const bands: RoadBand[] = [];
  for (const bandValue of record.bands) {
    const band = readRoadBand(bandValue);
    if (!band) return null;
    bands.push(band);
  }
  if (bands.length === 0) return null;

  const section: RoadSectionDraft = {
    id: record.id,
    centerlineWgs84,
    bands,
  };
  const curve = readRoadCurve(record.curve);
  if (curve) section.curve = curve;
  const connections = readRoadConnections(record.connections);
  if (connections) section.connections = connections;
  if (typeof record.maxspeedKmh === 'number' && Number.isFinite(record.maxspeedKmh)) {
    section.maxspeedKmh = record.maxspeedKmh;
  } else if (record.maxspeedKmh === null) {
    section.maxspeedKmh = null;
  }
  return section;
}

function readRoadCurve(value: unknown): RoadCurveSettings | null {
  const record = unknownRecord(value);
  if (!record) return null;
  if (record.mode !== 'smooth' && record.mode !== 'straight') return null;
  const strength =
    typeof record.strength === 'number' && Number.isFinite(record.strength)
      ? Math.max(0, Math.min(1, record.strength))
      : DEFAULT_ROAD_CURVE.strength;
  return { mode: record.mode, strength };
}

function readRoadConnections(
  value: unknown
): RoadSectionDraft['connections'] | null {
  const record = unknownRecord(value);
  if (!record) return null;
  const start = readRoadEndpointConnection(record.start);
  const end = readRoadEndpointConnection(record.end);
  return start || end ? { ...(start ? { start } : {}), ...(end ? { end } : {}) } : null;
}

function readRoadEndpointConnection(value: unknown): RoadEndpointConnection | null {
  const record = unknownRecord(value);
  if (!record) return null;
  const targets: RoadConnectionTarget[] = ['draft', 'cityjson', 'osm'];
  if (!targets.includes(record.target as RoadConnectionTarget)) return null;
  if (typeof record.targetId !== 'string' || !record.targetId) return null;
  const rawPosition = record.positionWgs84;
  if (
    !Array.isArray(rawPosition) ||
    typeof rawPosition[0] !== 'number' ||
    typeof rawPosition[1] !== 'number' ||
    !Number.isFinite(rawPosition[0]) ||
    !Number.isFinite(rawPosition[1])
  ) {
    return null;
  }
  const positionWgs84: [number, number] = [rawPosition[0], rawPosition[1]];
  const endpoints: RoadEndpointConnection['targetEndpoint'][] = ['start', 'end', 'node'];
  return {
    target: record.target as RoadConnectionTarget,
    targetId: record.targetId,
    ...(typeof record.targetSectionId === 'string' && record.targetSectionId
      ? { targetSectionId: record.targetSectionId }
      : {}),
    ...(endpoints.includes(record.targetEndpoint as RoadEndpointConnection['targetEndpoint'])
      ? { targetEndpoint: record.targetEndpoint as RoadEndpointConnection['targetEndpoint'] }
      : {}),
    positionWgs84,
    confirmed: true,
  };
}

function readRoadBand(value: unknown): RoadBand | null {
  const record = unknownRecord(value);
  if (!record) return null;
  const kinds: RoadBandKind[] = ['car_lane', 'bike_lane', 'sidewalk', 'median', 'green', 'parking'];
  const directions: RoadDirection[] = ['forward', 'backward', 'both', 'none'];
  const kind = kinds.includes(record.kind as RoadBandKind) ? (record.kind as RoadBandKind) : null;
  const widthM =
    typeof record.widthM === 'number' && Number.isFinite(record.widthM) && record.widthM > 0
      ? record.widthM
      : null;
  if (!kind || widthM === null) return null;

  const band: RoadBand = { kind, widthM };
  if (typeof record.id === 'string' && record.id.length > 0) band.id = record.id;
  if (typeof record.sourceType === 'string' && record.sourceType.length > 0) {
    band.sourceType = record.sourceType;
  }
  if (directions.includes(record.direction as RoadDirection)) {
    band.direction = record.direction as RoadDirection;
  }
  if (typeof record.surface === 'string' && record.surface.length > 0) {
    band.surface = record.surface;
  }
  if (Array.isArray(record.allowedModes)) {
    const allowedModes = record.allowedModes.filter(
      (mode): mode is string => typeof mode === 'string' && mode.length > 0
    );
    if (allowedModes.length > 0) band.allowedModes = allowedModes;
  }
  if (typeof record.maxspeedKmh === 'number' && Number.isFinite(record.maxspeedKmh)) {
    band.maxspeedKmh = record.maxspeedKmh;
  } else if (record.maxspeedKmh === null) {
    band.maxspeedKmh = null;
  }
  return band;
}

function readWgs84Line(value: unknown): [number, number][] | null {
  if (!Array.isArray(value)) return null;
  const line: [number, number][] = [];
  for (const point of value) {
    if (
      Array.isArray(point) &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
    ) {
      line.push([point[0], point[1]]);
    } else {
      return null;
    }
  }
  const normalized = normaliseWgs84Line(line);
  return normalized.length >= 2 ? normalized : null;
}

function readRoadVerticalProfile(value: unknown): RoadVerticalProfile | null {
  const record = unknownRecord(value);
  if (!record) return null;
  const placements: RoadVerticalPlacement[] = ['surface', 'underground', 'elevated', 'unknown'];
  const sources: RoadVerticalProfile['source'][] = [
    'manual',
    'osm_tags',
    'opendrive',
    'cityjson_geometry',
    'user',
    'unspecified',
  ];
  const placement = placements.includes(record.placement as RoadVerticalPlacement)
    ? (record.placement as RoadVerticalPlacement)
    : null;
  if (!placement) return null;
  const source = sources.includes(record.source as RoadVerticalProfile['source'])
    ? (record.source as RoadVerticalProfile['source'])
    : 'unspecified';
  return {
    placement,
    source,
    ...(typeof record.elevationM === 'number' && Number.isFinite(record.elevationM)
      ? { elevationM: record.elevationM }
      : {}),
    ...(typeof record.osmLayer === 'number' && Number.isFinite(record.osmLayer)
      ? { osmLayer: record.osmLayer }
      : {}),
  };
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringRecord(value: unknown): Record<string, string> | null {
  const record = unknownRecord(value);
  if (!record) return null;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string') result[key] = entry;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function closeLngLatRing(ring: [number, number][]): void {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) return;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
}

function readFace(face: unknown): number[][] {
  if (!Array.isArray(face)) return [];
  return face.filter(
    (ring): ring is number[] =>
      Array.isArray(ring) && ring.every((idx) => typeof idx === 'number')
  );
}

function jsonObject(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;
}

function uniqueRoadId(doc: CityJsonDocument): string {
  let id = makeStableId('road');
  while (doc.CityObjects[id]) id = makeStableId('road');
  return id;
}

function makeStableId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
