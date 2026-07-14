import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import proj4 from 'proj4';

proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

const args = parseArgs(process.argv.slice(2));
if (!args.lanes || !args.output) {
  throw new Error(usage());
}

const lanesPath = resolve(String(args.lanes));
const outputPath = resolve(String(args.output));
const seqOutputPath = args['seq-output'] ? resolve(String(args['seq-output'])) : null;
const generatedAt = String(args['generated-at'] ?? new Date().toISOString());
const sourceLabel = String(args.source ?? 'osm2streets lane-polygons.geojson');
const idPrefix = String(args['id-prefix'] ?? '');
const cityjson = convertLanePolygonsToCityJson(
  JSON.parse(await readFile(lanesPath, 'utf8')),
  {
    generatedAt,
    sourceLabel,
    idPrefix,
  }
);

mkdirSync(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(cityjson.doc)}\n`, 'utf8');

if (seqOutputPath) {
  mkdirSync(dirname(seqOutputPath), { recursive: true });
  await writeFile(seqOutputPath, cityjsonSeqText(cityjson), 'utf8');
}

console.log(
  `Converted ${cityjson.summary.roads} osm2streets road(s), ` +
    `${cityjson.summary.surfaces} surface(s), ${cityjson.summary.vertices} vertices`
);
console.log(`CityJSON: ${outputPath}`);
if (seqOutputPath) console.log(`CityJSONSeq: ${seqOutputPath}`);

function convertLanePolygonsToCityJson(geojson, options) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error('Expected an osm2streets lane FeatureCollection.');
  }

  const groups = groupLaneFeatures(geojson.features);
  if (groups.length === 0) {
    throw new Error('No polygon lane features were found.');
  }

  const projectedGroups = groups
    .map((group) => projectRoadGroup(group, options.idPrefix))
    .filter((group) => group.surfaces.length > 0);
  if (projectedGroups.length === 0) {
    throw new Error('No convertible polygon lane features were found.');
  }

  const bbox = computeProjectedBbox(projectedGroups);
  const transform = {
    scale: [0.001, 0.001, 0.001],
    translate: [round3(Math.floor(bbox[0])), round3(Math.floor(bbox[1])), 0],
  };
  const metadata = {
    referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
    geographicalExtent: [round3(bbox[0]), round3(bbox[1]), 0, round3(bbox[3]), round3(bbox[4]), 0],
    title: 'osm2streets lane polygons converted to CityJSON Transportation Roads',
    source: options.sourceLabel,
    generatedAt: options.generatedAt,
  };

  const doc = {
    type: 'CityJSON',
    version: '2.0',
    transform,
    metadata,
    CityObjects: {},
    vertices: [],
  };
  const sequenceFeatures = [];
  let surfaceCount = 0;

  for (const group of projectedGroups) {
    const featureVertices = [];
    const { object, localVertexCount, surfaces } = roadObjectFromProjectedGroup(
      group,
      transform,
      featureVertices,
      options.generatedAt
    );
    const offset = doc.vertices.length;
    doc.vertices.push(...featureVertices);
    doc.CityObjects[group.cityObjectId] = reindexRoadObject(object, offset);
    sequenceFeatures.push({
      type: 'CityJSONFeature',
      id: group.cityObjectId,
      CityObjects: {
        [group.cityObjectId]: object,
      },
      vertices: featureVertices,
    });
    surfaceCount += surfaces;
    if (localVertexCount !== featureVertices.length) {
      throw new Error(`Internal vertex count mismatch for ${group.cityObjectId}`);
    }
  }

  return {
    doc,
    sequenceHeader: {
      type: 'CityJSON',
      version: '2.0',
      CityObjects: {},
      vertices: [],
      transform,
      metadata,
    },
    sequenceFeatures,
    summary: {
      roads: projectedGroups.length,
      surfaces: surfaceCount,
      vertices: doc.vertices.length,
    },
  };
}

function groupLaneFeatures(features) {
  const groups = new Map();
  features.forEach((feature, index) => {
    if (!feature || feature.type !== 'Feature' || !feature.geometry) return;
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') return;
    const props = isObject(feature.properties) ? feature.properties : {};
    const roadId = props.road ?? props.road_id ?? props.roadId ?? `ungrouped-${index}`;
    const key = String(roadId);
    if (!groups.has(key)) {
      groups.set(key, {
        roadId,
        features: [],
      });
    }
    groups.get(key).features.push({ feature, index });
  });
  return [...groups.values()].sort((a, b) => String(a.roadId).localeCompare(String(b.roadId)));
}

function projectRoadGroup(group, idPrefix) {
  const cityObjectId = cityObjectIdForRoad(group.roadId, idPrefix);
  const sourceOsmWayIds = uniqueValues(group.features.flatMap(({ feature }) => osmWayIds(feature)));
  const surfaces = [];

  for (const { feature, index } of group.features) {
    const props = isObject(feature.properties) ? feature.properties : {};
    const polygons = polygonsFromGeometry(feature.geometry);
    polygons.forEach((polygon, polygonIndex) => {
      const rings = polygon
        .map((ring) => cleanRing(ring))
        .filter((ring) => ring.length >= 3)
        .map((ring, ringIndex) => {
          const projected = ring.map(([lng, lat]) => {
            const [x, y] = proj4('EPSG:4326', 'EPSG:25832', [lng, lat]);
            return [x, y, 0];
          });
          const area = signedArea(projected);
          if ((ringIndex === 0 && area < 0) || (ringIndex > 0 && area > 0)) {
            projected.reverse();
          }
          return projected;
        });
      if (!rings[0]) return;
      surfaces.push({
        sourceIndex: index,
        polygonIndex,
        rings,
        properties: jsonRecord(props),
        osmWayIds: osmWayIds(feature),
      });
    });
  }

  return {
    roadId: group.roadId,
    cityObjectId,
    sourceOsmWayIds,
    surfaces,
  };
}

function roadObjectFromProjectedGroup(group, transform, vertices, generatedAt) {
  const boundaries = [];
  const semanticSurfaces = [];
  const values = [];
  const sourceOsmWayIds = group.sourceOsmWayIds.map(String);

  group.surfaces.forEach((surface, surfaceIndex) => {
    const face = surface.rings.map((ring) =>
      ring.map(([x, y, z]) => {
        vertices.push(toCityVertex([x, y, z], transform));
        return vertices.length - 1;
      })
    );
    const semantics = surfaceSemantics(surface, group, surfaceIndex);
    boundaries.push(face);
    semanticSurfaces.push(semantics);
    values.push(surfaceIndex);
  });

  const object = {
    type: 'Road',
    attributes: {
      class: 'transportation',
      function: 'road',
      name: roadName(group),
      _createdBy: 'city-editor-prototype',
      _createdAt: generatedAt,
      _source: 'osm2streets',
      _osm2streetsRoadId: String(group.roadId),
      _osmWayIds: sourceOsmWayIds,
      _osm2streetsLaneCount: group.surfaces.length,
    },
    geometry: [
      {
        type: 'MultiSurface',
        lod: '2',
        boundaries,
        semantics: {
          surfaces: semanticSurfaces,
          values,
        },
      },
    ],
  };

  return {
    object,
    localVertexCount: vertices.length,
    surfaces: boundaries.length,
  };
}

function surfaceSemantics(surface, group, surfaceIndex) {
  const laneType = String(surface.properties.type ?? '');
  const kind = roadBandKindFromLaneType(laneType);
  const functionName = functionForBand(kind);
  const result = {
    type: kind === 'median' || kind === 'green' ? 'AuxiliaryTrafficArea' : 'TrafficArea',
    function: functionName,
    sectionId: `${group.cityObjectId}-section-1`,
    bandId: `osm2streets-${kind}-${surface.sourceIndex}-${surface.polygonIndex}`,
    trafficDirection: directionFromLaneDirection(String(surface.properties.direction ?? '')),
    transportationUsage: kind,
    surfaceMaterial: kind === 'green' ? 'grass' : 'asphalt',
    maxspeed: parseSpeedKmh(surface.properties.speed_limit),
    source: 'osm2streets',
    sourceType: laneType,
    sourceSurfaceIndex: surfaceIndex,
    osm2streetsRoadId: String(group.roadId),
    osm2streetsLaneIndex: numberValue(surface.properties.index, surface.sourceIndex),
    osmWayIds: surface.osmWayIds.map(String),
    osm2streetsPropertiesJson: JSON.stringify(surface.properties),
  };
  const modes = allowedModesForLaneType(laneType);
  if (modes.length > 0) result.allowedModes = modes;
  return result;
}

function reindexRoadObject(object, offset) {
  return {
    ...object,
    geometry: object.geometry.map((geometry) => ({
      ...geometry,
      boundaries: geometry.boundaries.map((face) =>
        face.map((ring) => ring.map((index) => index + offset))
      ),
    })),
  };
}

function cityjsonSeqText(cityjson) {
  return [
    JSON.stringify(cityjson.sequenceHeader),
    ...cityjson.sequenceFeatures.map((feature) => JSON.stringify(feature)),
    '',
  ].join('\n');
}

function polygonsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return Array.isArray(geometry.coordinates) ? [geometry.coordinates] : [];
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  }
  return [];
}

function cleanRing(ring) {
  if (!Array.isArray(ring)) return [];
  const result = [];
  for (const point of ring) {
    if (
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1])
    ) {
      const prev = result[result.length - 1];
      if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) {
        result.push([point[0], point[1]]);
      }
    }
  }
  const first = result[0];
  const last = result[result.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) result.pop();
  return result;
}

function toCityVertex([x, y, z], transform) {
  return [
    Math.round((x - transform.translate[0]) / transform.scale[0]),
    Math.round((y - transform.translate[1]) / transform.scale[1]),
    Math.round((z - transform.translate[2]) / transform.scale[2]),
  ];
}

function computeProjectedBbox(groups) {
  const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const group of groups) {
    for (const surface of group.surfaces) {
      for (const ring of surface.rings) {
        for (const [x, y, z] of ring) {
          bbox[0] = Math.min(bbox[0], x);
          bbox[1] = Math.min(bbox[1], y);
          bbox[2] = Math.min(bbox[2], z);
          bbox[3] = Math.max(bbox[3], x);
          bbox[4] = Math.max(bbox[4], y);
          bbox[5] = Math.max(bbox[5], z);
        }
      }
    }
  }
  if (!bbox.every(Number.isFinite)) throw new Error('Could not compute projected extent.');
  return bbox;
}

function cityObjectIdForRoad(roadId, prefix = '') {
  const slug = String(roadId).replace(/[^A-Za-z0-9_.-]/g, '-');
  const normalizedPrefix = prefix ? `${String(prefix).replace(/[^A-Za-z0-9_.-]/g, '-')}` : '';
  return `${normalizedPrefix}osm2streets-road-${slug || 'unknown'}`;
}

function roadName(group) {
  for (const surface of group.surfaces) {
    const name = surface.properties.name ?? surface.properties.road_name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return `osm2streets road ${group.roadId}`;
}

function osmWayIds(feature) {
  const props = isObject(feature.properties) ? feature.properties : {};
  const raw = props.osm_way_ids ?? props.osmWayIds ?? props.osm_way_id;
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  return uniqueValues(values);
}

function roadBandKindFromLaneType(type) {
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
  if (key.includes('green') || key.includes('planter')) return 'green';
  return 'road_surface';
}

function functionForBand(kind) {
  if (kind === 'car_lane') return 'driving_lane';
  if (kind === 'bike_lane') return 'bike_lane';
  if (kind === 'sidewalk') return 'sidewalk';
  if (kind === 'parking') return 'parking_lane';
  if (kind === 'green') return 'green_verge';
  if (kind === 'median') return 'median';
  return 'road_surface';
}

function allowedModesForLaneType(type) {
  const key = normalizeType(type);
  if (key === 'biking' || key === 'bike' || key === 'cycleway') return ['bicycle'];
  if (key === 'sidewalk' || key === 'footway' || key === 'shoulder') return ['pedestrian'];
  if (key === 'shareduse') return ['pedestrian', 'bicycle'];
  if (key === 'bus') return ['bus'];
  if (key.includes('parking')) return ['car'];
  if (key === 'driving' || key === 'lightrail' || key === 'construction') return ['car'];
  return [];
}

function directionFromLaneDirection(direction) {
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

function parseSpeedKmh(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.toLowerCase() === 'none') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function numberValue(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function normalizeType(type) {
  return type.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function uniqueValues(values) {
  return [...new Map(values.map((value) => [String(value), value])).values()];
}

function jsonRecord(record) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = toJsonValue(value);
  }
  return result;
}

function toJsonValue(value) {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === 'object') return jsonRecord(value);
  return String(value);
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      i++;
    }
  }
  return result;
}

function usage() {
  return [
    'Usage: node scripts/osm2streets-lanes-to-cityjson.mjs --lanes lane-polygons.geojson --output roads.city.json [--seq-output roads.city.jsonl] [--id-prefix tile-001-]',
    '',
    'Converts osm2streets lane polygons into CityJSON 2.0 Road MultiSurfaces in EPSG:25832.',
  ].join('\n');
}
