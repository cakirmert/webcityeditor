import type { CityJsonDocument, CityObject, JsonValue } from '../types';
import {
  buildOsm2StreetsRoadAssets,
  type Osm2StreetsRoadLaneAsset,
  type Osm2StreetsRoadAssets,
} from './osm2streets-draft';
import type { Osm2StreetsResult, Osm2StreetsSelection } from './osm2streets';
import { computeBbox, detectCrs } from './projection';
import { estimateTerrainElevationAtPoint } from './terrain';
import {
  inferRoadVerticalProfileFromOsmTags,
  type InsertRoadResult,
  type OsmRoadFeature,
  type RoadArea,
  type RoadVerticalProfile,
} from './transportation';

export function insertOsm2StreetsRoadIntoCityJson(
  doc: CityJsonDocument,
  selection: Osm2StreetsSelection,
  result: Osm2StreetsResult,
  osmRoads: OsmRoadFeature[],
  options: { id?: string; baseElevation?: number } = {}
): InsertRoadResult {
  if (!selection) {
    throw new Error('Select an osm2streets lane before editing it.');
  }
  const crs = detectCrs(doc);
  if (!crs.supported) {
    throw new Error(`Cannot create osm2streets road: CRS ${crs.code} is not supported by proj4.`);
  }
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  if (
    !t.scale.every((value) => Number.isFinite(value) && value !== 0) ||
    !t.translate.every((value) => Number.isFinite(value))
  ) {
    throw new Error('Cannot create osm2streets road: CityJSON transform is invalid.');
  }

  const referencePoint = featureReferencePoint(selection.feature.geometry?.coordinates);
  const baseElevation =
    options.baseElevation ??
    (referencePoint
      ? estimateTerrainElevationAtPoint(doc, referencePoint)
      : computeBbox(doc).min.z);
  const assets = buildOsm2StreetsRoadAssets(selection, result, osmRoads, {
    crsCode: crs.code,
    elevationM: baseElevation,
  });
  const id = options.id ?? uniqueRoadId(doc, `osm2streets-road-${assets.roadId}`);
  const verticalHintTags = verticalTagsForAssets(assets);
  const inferredVertical = inferRoadVerticalProfileFromOsmTags(verticalHintTags);
  const vertical: RoadVerticalProfile = {
    ...inferredVertical,
    ...(inferredVertical.placement === 'surface' || Number.isFinite(options.baseElevation)
      ? { elevationM: baseElevation }
      : {}),
  };
  const boundaries: number[][][] = [];
  const surfaces: Array<Record<string, JsonValue>> = [];
  const roadAreas: RoadArea[] = [];
  const newVertices: [number, number, number][] = [];

  const toCityVertex = (point: [number, number, number]): [number, number, number] => [
    Math.round((point[0] - t.translate[0]) / t.scale[0]),
    Math.round((point[1] - t.translate[1]) / t.scale[1]),
    Math.round((point[2] - t.translate[2]) / t.scale[2]),
  ];

  for (const lane of assets.lanes) {
    const metricRings = [lane.surfacePolygon, ...(lane.surfaceHoles ?? [])];
    const face = metricRings.map((ring) => {
      const indices: number[] = [];
      for (const point of openMetricRing(ring)) {
        indices.push(doc.vertices.length + newVertices.length);
        newVertices.push(toCityVertex(point));
      }
      return indices;
    });
    if (!face[0] || face[0].length < 3) continue;

    const surfaceIndex = surfaces.length;
    boundaries.push(face);
    surfaces.push(surfaceFromLane(lane, surfaceIndex, vertical));
    roadAreas.push({
      id: `${id}-surface-${surfaceIndex}`,
      roadId: id,
      sectionId: lane.sectionId,
      bandId: lane.trafficAreaId,
      surfaceIndex,
      surfaceType:
        lane.band.kind === 'median' || lane.band.kind === 'green'
          ? 'AuxiliaryTrafficArea'
          : 'TrafficArea',
      function: lane.functionCode,
      polygon: closeRing(lane.ringsWgs84[0] ?? []),
      vertical,
      attributes: {
        function: lane.functionCode,
        functionLabel: lane.functionLabel,
        transportationUsage: lane.usageCode,
        usageLabel: lane.usageLabel,
        trafficDirection: lane.band.direction ?? null,
        allowedModes: lane.band.allowedModes ?? [],
        source: lane.source,
        sourceType: lane.laneType,
        osm2streetsRoadId: lane.osm2streetsRoadId ?? null,
        osm2streetsLaneIndex: lane.osm2streetsLaneIndex ?? null,
        osmWayIds: lane.osmWayIds ?? [],
        osm2streetsPropertiesJson: JSON.stringify(lane.properties),
        maxspeed: lane.band.maxspeedKmh ?? null,
      },
    });
  }

  if (boundaries.length === 0) {
    throw new Error('Selected osm2streets road did not produce any CityJSON surfaces.');
  }

  const cityObject: CityObject = {
    type: 'Road',
    attributes: {
      class: 'transportation',
      function: 'road',
      name: assets.matchedOsmRoad?.tags.name ?? `osm2streets road ${assets.roadId}`,
      _createdBy: 'webcityeditor',
      _createdAt: new Date().toISOString(),
      _source: 'osm2streets',
      _osm2streetsRoadId: String(assets.roadId),
      _osmWayIds: assets.sourceOsmWayIds.map((wayId) => String(wayId)),
      _osmTags: assets.matchedOsmRoad?.tags ? jsonRecord(assets.matchedOsmRoad.tags) : null,
      _verticalProfile: verticalProfileToJson(vertical),
      _roadGeometryMode: 'exact',
      _osm2streetsLaneCount: assets.lanes.length,
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

  doc.vertices.push(...newVertices);
  doc.CityObjects[id] = cityObject;

  return {
    id,
    areas: roadAreas,
    vertexCount: newVertices.length,
  };
}

function surfaceFromLane(
  lane: Osm2StreetsRoadLaneAsset,
  surfaceIndex: number,
  vertical: RoadVerticalProfile
): Record<string, JsonValue> {
  const surfaceType =
    lane.band.kind === 'median' || lane.band.kind === 'green'
      ? 'AuxiliaryTrafficArea'
      : 'TrafficArea';
  const surface: Record<string, JsonValue> = {
    type: surfaceType,
    function: lane.functionCode,
    functionLabel: lane.functionLabel,
    usageLabel: lane.usageLabel,
    sectionId: lane.sectionId,
    bandId: lane.trafficAreaId,
    trafficDirection: lane.band.direction ?? null,
    transportationUsage: lane.usageCode,
    surfaceMaterial: sourceSurfaceMaterial(lane),
    maxspeed: lane.band.maxspeedKmh ?? null,
    source: 'osm2streets',
    sourceSurfaceIndex: surfaceIndex,
    osm2streetsRoadId: String(lane.roadId),
    osm2streetsLaneIndex: lane.laneIndex,
    osmWayIds: lane.osmWayIds ?? [],
    osm2streetsProperties: lane.properties,
    verticalPlacement: vertical.placement,
    roadElevation: vertical.elevationM ?? null,
  };
  if (lane.band.allowedModes && lane.band.allowedModes.length > 0) {
    surface.allowedModes = lane.band.allowedModes;
  }
  return surface;
}

function defaultSurfaceForBand(kind: string): string {
  if (kind === 'green') return 'grass';
  return 'asphalt';
}

function sourceSurfaceMaterial(lane: Osm2StreetsRoadLaneAsset): string {
  const muv = lane.properties.muv;
  if (muv && typeof muv === 'object') {
    const surface = (muv as { surface?: unknown }).surface;
    if (surface && typeof surface === 'object') {
      const kind = (surface as { kind?: unknown }).kind;
      if (typeof kind === 'string' && kind.trim()) {
        return kind
          .trim()
          .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
          .toLowerCase();
      }
    }
  }
  return defaultSurfaceForBand(lane.band.kind);
}

function featureReferencePoint(value: unknown): [number, number] | null {
  let lng = 0;
  let lat = 0;
  let count = 0;
  const visit = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (
      node.length >= 2 &&
      typeof node[0] === 'number' &&
      typeof node[1] === 'number' &&
      Number.isFinite(node[0]) &&
      Number.isFinite(node[1])
    ) {
      lng += node[0];
      lat += node[1];
      count += 1;
      return;
    }
    for (const child of node) visit(child);
  };
  visit(value);
  return count > 0 ? [lng / count, lat / count] : null;
}

function closeRing(ring: [number, number][]): [number, number][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first) return [];
  if (last && first[0] === last[0] && first[1] === last[1]) return ring.map((point) => [...point]);
  return [...ring.map((point) => [...point] as [number, number]), [first[0], first[1]]];
}

function openMetricRing(
  ring: [number, number, number][]
): [number, number, number][] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    first &&
    last &&
    first[0] === last[0] &&
    first[1] === last[1] &&
    first[2] === last[2]
  ) {
    return ring.slice(0, -1);
  }
  return ring;
}

function uniqueRoadId(doc: CityJsonDocument, preferred: string): string {
  let id = preferred;
  let suffix = 1;
  while (doc.CityObjects[id]) {
    suffix += 1;
    id = `${preferred}-${suffix}`;
  }
  return id;
}

function jsonRecord(record: Record<string, string>): JsonValue {
  return { ...record } as JsonValue;
}

function verticalTagsForAssets(assets: Osm2StreetsRoadAssets): Record<string, string> {
  const tags = { ...(assets.matchedOsmRoad?.tags ?? {}) };
  for (const key of ['tunnel', 'covered', 'bridge', 'location', 'layer']) {
    if (tags[key] !== undefined) continue;
    const value = assets.lanes.find((lane) => lane.properties[key] !== undefined)?.properties[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      tags[key] = String(value);
    }
  }
  return tags;
}

function verticalProfileToJson(profile: RoadVerticalProfile): JsonValue {
  return {
    placement: profile.placement,
    source: profile.source,
    elevationM: profile.elevationM ?? null,
    osmLayer: profile.osmLayer ?? null,
  };
}
