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
  centerlineWgs84: [number, number][];
  bands: RoadBand[];
  maxspeedKmh?: number | null;
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
  editableDraft?: RoadDraft;
  attributes: Record<string, JsonValue>;
}

export interface InsertRoadResult {
  id: string;
  areas: RoadArea[];
  vertexCount: number;
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

const DEFAULT_WIDTHS: Record<RoadBandKind, number> = {
  car_lane: 3.25,
  bike_lane: 1.75,
  sidewalk: 2,
  median: 1,
  green: 1,
  parking: 2.1,
};

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
    ');',
    '(._;>;);',
    'out body;',
  ].join('\n');
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
  const split = splitLineAtFraction(section.centerlineWgs84, fraction);
  const sections = draft.sections.slice();
  sections.splice(
    sectionIndex,
    1,
    {
      ...section,
      id: `${section.id}-a`,
      centerlineWgs84: split[0],
      bands: cloneBands(section.bands),
    },
    {
      ...section,
      id: `${section.id}-b`,
      centerlineWgs84: split[1],
      bands: cloneBands(section.bands),
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

export function extractTransportationAreas(doc: CityJsonDocument): RoadArea[] {
  const crs = detectCrs(doc);
  if (!crs.supported) return [];
  const areas: RoadArea[] = [];
  for (const [roadId, object] of Object.entries(doc.CityObjects)) {
    if (object.type !== 'Road') continue;
    const objectVertical = roadVerticalProfileFromCityObject(object);
    const editableDraft = readEditableRoadDraftFromCityObject(object);
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
            osm2streetsLaneIndex: (surface.osm2streetsLaneIndex ?? null) as JsonValue,
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
      const centerlineWgs84 = deriveCenterlineFromImportedAreas(sectionAreas);
      const maxspeedKmh = bands.find((band) => Number.isFinite(band.maxspeedKmh))
        ?.maxspeedKmh;
      return {
        id: sectionId,
        centerlineWgs84,
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
    const centerline = normaliseProjectedLine(
      section.centerlineWgs84.map(([lng, lat]) => {
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
  if (typeof record.maxspeedKmh === 'number' && Number.isFinite(record.maxspeedKmh)) {
    section.maxspeedKmh = record.maxspeedKmh;
  } else if (record.maxspeedKmh === null) {
    section.maxspeedKmh = null;
  }
  return section;
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
