import {
  createReadStream,
  createWriteStream,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
import { createGzip, constants as zlibConstants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  findReadyHamburgRoadCatalog,
  HAMBURG_ROAD_CATALOG_TYPE,
} from './hamburg-road-catalog-path.mjs';

const args = parseArgs(process.argv.slice(2));
const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const preferredInput = resolvePath(
  args['input-dir'] ??
    'Data/hamburg-roads-osm2streets/cityjsonseq'
);
const outputDirectory = resolvePath(
  args['output-dir'] ?? 'public/data/hamburg/roads'
);
const cellSizeMeters = positiveNumber(args['cell-size'] ?? 1000, '--cell-size');
const gzipLevel = integerInRange(args['gzip-level'] ?? 6, 0, 9, '--gzip-level');
const generatedAt =
  typeof args['generated-at'] === 'string'
    ? args['generated-at']
    : undefined;

assertSafeOutputDirectory(outputDirectory);
const ready = findReadyHamburgRoadCatalog(preferredInput, {
  scanSiblings: args['input-dir'] === undefined,
});
if (!ready) {
  throw new Error(
    `No complete ${HAMBURG_ROAD_CATALOG_TYPE} was found at ${preferredInput}`
  );
}

const sourceCatalog = ready.catalog;
const timestamp = generatedAt ?? sourceCatalog.generatedAt ?? new Date().toISOString();
const outputParent = dirname(outputDirectory);
mkdirSync(outputParent, { recursive: true });
const stagingDirectory = mkdtempSync(
  join(outputParent, `${basename(outputDirectory)}-staging-`)
);
const stagingTilesDirectory = join(stagingDirectory, 'tiles');
mkdirSync(stagingTilesDirectory, { recursive: true });

const groups = new Map();
let totalFeatures = 0;
let totalCityObjects = 0;
let totalRoads = 0;
let totalIntersections = 0;
let totalSurfaces = 0;
let totalVertices = 0;
const sourceSeamEndpointsByOsmWayId = new Map();
const MAX_SOURCE_SEAM_REFERENCE_DISTANCE_M = 0.5;
const MAX_SOURCE_SEAM_INWARD_DOT = -0.8;
const SOURCE_SEAM_AMBIGUITY_DISTANCE_M = 0.05;

try {
  for (const [sourceIndex, sourceTile] of sourceCatalog.tiles.entries()) {
    const sourcePath = resolve(ready.directory, sourceTile.file);
    await consumeSourceTile(sourcePath, sourceTile.id);
    console.log(
      `Retiled source ${sourceIndex + 1}/${sourceCatalog.tiles.length}: ` +
      `${sourceTile.id} (${totalFeatures.toLocaleString()} features total)`
    );
  }
  const sourceSeams = linkSourceSeamTileDependencies();

  for (const group of groups.values()) group.gzip.end();
  await Promise.all([...groups.values()].map((group) => group.completion));

  const tiles = [...groups.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((group) => {
      const compressedBytes = statSync(group.path).size;
      const revision = sha256File(group.path);
      return {
        id: group.id,
        file: `tiles/${group.file}`,
        url: `tiles/${group.file}`,
        revision,
        extent: group.extent,
        features: group.features,
        cityObjects: group.cityObjects,
        roads: group.roads,
        intersections: group.intersections,
        surfaces: group.surfaces,
        vertices: group.vertices,
        syntheticRootsAdded: 0,
        ...(group.dependencies.size > 0
          ? { dependencies: [...group.dependencies].sort() }
          : {}),
        uncompressedBytes: group.uncompressedBytes,
        compressedBytes,
      };
    });

  const compressedBytes = tiles.reduce(
    (sum, tile) => sum + tile.compressedBytes,
    0
  );
  const uncompressedBytes = tiles.reduce(
    (sum, tile) => sum + tile.uncompressedBytes,
    0
  );
  const catalog = {
    type: HAMBURG_ROAD_CATALOG_TYPE,
    generatedAt: timestamp,
    crs: sourceCatalog.crs,
    source: {
      type: sourceCatalog.type,
      generatedAt: sourceCatalog.generatedAt,
      sourceTiles: sourceCatalog.summary.tiles,
      sourceFeatures: sourceCatalog.summary.features,
    },
    packaging: {
      tileAssignment: 'feature-extent-centroid',
      cellSizeMeters,
      compression: 'gzip',
      gzipLevel,
      transformScale: [0.001, 0.001, 0.001],
      sourceSeams,
    },
    summary: {
      tiles: tiles.length,
      empty: 0,
      failed: 0,
      features: totalFeatures,
      cityObjects: totalCityObjects,
      roads: totalRoads,
      intersections: totalIntersections,
      surfaces: totalSurfaces,
      vertices: totalVertices,
      uncompressedBytes,
      compressedBytes,
    },
    tiles,
  };
  writeFileSync(
    join(stagingDirectory, 'catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`,
    'utf8'
  );
  publishStagingDirectory(stagingDirectory, outputDirectory);
  console.log(`Pages road catalog: ${join(outputDirectory, 'catalog.json')}`);
  console.log(JSON.stringify(catalog.summary, null, 2));
} catch (error) {
  if (existsSync(stagingDirectory)) rmSync(stagingDirectory, { recursive: true });
  throw error;
}

async function consumeSourceTile(sourcePath, sourceTileId) {
  const input = createReadStream(sourcePath, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header;
  let lineNumber = 0;

  for await (const line of lines) {
    lineNumber++;
    if (!line.trim()) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `${sourcePath}:${lineNumber}: invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    if (!header) {
      header = validateHeader(value, sourcePath);
      continue;
    }
    if (
      value?.type !== 'CityJSONFeature' ||
      typeof value.id !== 'string' ||
      !value.CityObjects ||
      typeof value.CityObjects !== 'object' ||
      !Array.isArray(value.vertices)
    ) {
      throw new Error(
        `${sourcePath}:${lineNumber}: expected a CityJSONFeature with local vertices`
      );
    }

    const extent = readFeatureExtent(value, header.transform);
    const centroidX = (extent[0] + extent[3]) / 2;
    const centroidY = (extent[1] + extent[4]) / 2;
    const cellX = Math.floor(centroidX / cellSizeMeters);
    const cellY = Math.floor(centroidY / cellSizeMeters);
    const group = createGroup(cellX, cellY);
    collectSourceSeamEndpoints(value, group.id);
    value.vertices = reencodeVertices(
      value.vertices,
      header.transform,
      group.transform,
      `${sourceTileId}:${value.id}`
    );
    value.geographicalExtent = extent;

    const cityObjects = Object.values(value.CityObjects);
    const intersectionCount = cityObjects.filter(
      (object) => object?.attributes?._transportationKind === 'intersection'
    ).length;
    const surfaceCount = cityObjects.reduce(
      (sum, object) => sum + countObjectSurfaces(object),
      0
    );
    const serialized = `${JSON.stringify(value)}\n`;
    if (!group.gzip.write(serialized)) await once(group.gzip, 'drain');

    includeExtent(group.extent, extent);
    group.features++;
    group.cityObjects += cityObjects.length;
    group.roads += cityObjects.length - intersectionCount;
    group.intersections += intersectionCount;
    group.surfaces += surfaceCount;
    group.vertices += value.vertices.length;
    group.uncompressedBytes += Buffer.byteLength(serialized);
    totalFeatures++;
    totalCityObjects += cityObjects.length;
    totalRoads += cityObjects.length - intersectionCount;
    totalIntersections += intersectionCount;
    totalSurfaces += surfaceCount;
    totalVertices += value.vertices.length;
  }

  if (!header) throw new Error(`${sourcePath}: missing CityJSON header`);
}

function createGroup(cellX, cellY) {
  const key = `${cellX}:${cellY}`;
  const existing = groups.get(key);
  if (existing) return existing;

  const id = `hh-road-e${signedToken(cellX)}-n${signedToken(cellY)}`;
  const file = `${id}.city.jsonl.gz`;
  const path = join(stagingTilesDirectory, file);
  const transform = {
    scale: [0.001, 0.001, 0.001],
    translate: [cellX * cellSizeMeters, cellY * cellSizeMeters, 0],
  };
  const header = {
    type: 'CityJSON',
    version: '2.0',
    CityObjects: {},
    vertices: [],
    transform,
    metadata: {
      referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
      title: 'Hamburg osm2streets roads — static viewport tile',
      source:
        'Complete Hamburg osm2streets CityJSONSeq catalog, retiled for GitHub Pages',
      generatedAt: timestamp,
    },
  };
  const gzip = createGzip({
    level: gzipLevel,
    strategy: zlibConstants.Z_DEFAULT_STRATEGY,
  });
  const completion = pipeline(gzip, createWriteStream(path));
  const headerLine = `${JSON.stringify(header)}\n`;
  gzip.write(headerLine);
  const group = {
    id,
    file,
    path,
    transform,
    gzip,
    completion,
    extent: emptyExtent(),
    features: 0,
    cityObjects: 0,
    roads: 0,
    intersections: 0,
    surfaces: 0,
    vertices: 0,
    dependencies: new Set(),
    uncompressedBytes: Buffer.byteLength(headerLine),
  };
  groups.set(key, group);
  return group;
}

function collectSourceSeamEndpoints(feature, tileId) {
  for (const [roadId, object] of Object.entries(feature.CityObjects ?? {})) {
    const attributes = object?.attributes;
    if (!attributes || typeof attributes !== 'object') continue;
    const sourceNamespace = generatedOsm2StreetsRoadNamespace(roadId);
    const centerline = readWgs84Line(attributes._sourceCenterlineWgs84);
    const mapEdgeEndpoints = readSourceMapEdgeEndpoints(
      attributes._sourceMapEdgeEndpointsWgs84
    );
    const osmWayIds = normalizeIds(attributes._osmWayIds);
    if (
      !sourceNamespace ||
      !centerline ||
      mapEdgeEndpoints.length === 0 ||
      osmWayIds.length === 0
    ) {
      continue;
    }
    for (const mapEdge of mapEdgeEndpoints) {
      const inwardTangent = sourceSeamInwardTangent(
        centerline,
        mapEdge.endpoint
      );
      if (!inwardTangent) continue;
      const endpoint = {
        ref: `${roadId}#${mapEdge.endpoint}`,
        roadId,
        sourceNamespace,
        endpoint: mapEdge.endpoint,
        position: mapEdge.position,
        inwardTangent,
        tileId,
      };
      for (const osmWayId of osmWayIds) {
        const group = sourceSeamEndpointsByOsmWayId.get(osmWayId) ?? [];
        group.push(endpoint);
        sourceSeamEndpointsByOsmWayId.set(osmWayId, group);
      }
    }
  }
}

function linkSourceSeamTileDependencies() {
  const candidatesByKey = new Map();
  for (const [osmWayId, endpoints] of sourceSeamEndpointsByOsmWayId) {
    for (let leftIndex = 0; leftIndex < endpoints.length; leftIndex++) {
      const left = endpoints[leftIndex];
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < endpoints.length;
        rightIndex++
      ) {
        const right = endpoints[rightIndex];
        if (
          left.roadId === right.roadId ||
          left.sourceNamespace === right.sourceNamespace
        ) {
          continue;
        }
        const distanceM = approximateDistanceMeters(
          left.position,
          right.position
        );
        if (distanceM > MAX_SOURCE_SEAM_REFERENCE_DISTANCE_M) continue;
        const inwardDot =
          left.inwardTangent[0] * right.inwardTangent[0] +
          left.inwardTangent[1] * right.inwardTangent[1];
        if (inwardDot > MAX_SOURCE_SEAM_INWARD_DOT) continue;
        const key =
          left.ref < right.ref
            ? `${left.ref}|${right.ref}`
            : `${right.ref}|${left.ref}`;
        const current = candidatesByKey.get(key);
        if (current) {
          current.osmWayIds.add(osmWayId);
        } else {
          candidatesByKey.set(key, {
            key,
            left,
            right,
            distanceM,
            osmWayIds: new Set([osmWayId]),
          });
        }
      }
    }
  }

  const candidatesByEndpoint = new Map();
  for (const candidate of candidatesByKey.values()) {
    for (const endpointRef of [candidate.left.ref, candidate.right.ref]) {
      const endpointCandidates = candidatesByEndpoint.get(endpointRef) ?? [];
      endpointCandidates.push(candidate);
      candidatesByEndpoint.set(endpointRef, endpointCandidates);
    }
  }
  for (const endpointCandidates of candidatesByEndpoint.values()) {
    endpointCandidates.sort(
      (left, right) =>
        left.distanceM - right.distanceM || left.key.localeCompare(right.key)
    );
  }

  let junctions = 0;
  let crossTileJunctions = 0;
  const dependencyLinks = new Set();
  for (const candidate of candidatesByKey.values()) {
    const leftCandidates = candidatesByEndpoint.get(candidate.left.ref) ?? [];
    const rightCandidates = candidatesByEndpoint.get(candidate.right.ref) ?? [];
    if (
      leftCandidates[0] !== candidate ||
      rightCandidates[0] !== candidate ||
      sourceSeamBestCandidateIsAmbiguous(leftCandidates) ||
      sourceSeamBestCandidateIsAmbiguous(rightCandidates)
    ) {
      continue;
    }
    junctions++;
    if (candidate.left.tileId === candidate.right.tileId) continue;
    const leftGroup = groupById(candidate.left.tileId);
    const rightGroup = groupById(candidate.right.tileId);
    if (!leftGroup || !rightGroup) {
      throw new Error(
        `Source seam references missing Pages tiles ${candidate.left.tileId} and ${candidate.right.tileId}`
      );
    }
    leftGroup.dependencies.add(rightGroup.id);
    rightGroup.dependencies.add(leftGroup.id);
    crossTileJunctions++;
    dependencyLinks.add(
      leftGroup.id < rightGroup.id
        ? `${leftGroup.id}|${rightGroup.id}`
        : `${rightGroup.id}|${leftGroup.id}`
    );
  }

  return {
    junctions,
    crossTileJunctions,
    dependencyLinks: dependencyLinks.size,
    maxReferenceDistanceM: MAX_SOURCE_SEAM_REFERENCE_DISTANCE_M,
    maxInwardDot: MAX_SOURCE_SEAM_INWARD_DOT,
  };
}

function groupById(id) {
  for (const group of groups.values()) {
    if (group.id === id) return group;
  }
  return null;
}

function sourceSeamBestCandidateIsAmbiguous(candidates) {
  return (
    candidates.length > 1 &&
    candidates[1].distanceM - candidates[0].distanceM <=
      SOURCE_SEAM_AMBIGUITY_DISTANCE_M
  );
}

function generatedOsm2StreetsRoadNamespace(roadId) {
  const marker = 'osm2streets-road-';
  const markerIndex = roadId.lastIndexOf(marker);
  return markerIndex >= 0 ? roadId.slice(0, markerIndex) : null;
}

function readSourceMapEdgeEndpoints(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const result = [];
  for (const endpoint of ['start', 'end']) {
    const position = readWgs84Point(value[endpoint]);
    if (position) result.push({ endpoint, position });
  }
  return result;
}

function readWgs84Line(value) {
  if (!Array.isArray(value)) return null;
  const line = value.map(readWgs84Point).filter(Boolean);
  return line.length === value.length && line.length >= 2 ? line : null;
}

function readWgs84Point(value) {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return null;
  }
  return [value[0], value[1]];
}

function normalizeIds(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry) =>
        typeof entry === 'string' || typeof entry === 'number'
      ).map(String))]
    : [];
}

function sourceSeamInwardTangent(centerline, endpoint) {
  const endpointPosition =
    endpoint === 'start' ? centerline[0] : centerline.at(-1);
  for (let offset = 1; offset < centerline.length; offset++) {
    const innerPosition =
      endpoint === 'start'
        ? centerline[offset]
        : centerline[centerline.length - 1 - offset];
    const vector = localVectorMeters(endpointPosition, innerPosition);
    const length = Math.hypot(vector[0], vector[1]);
    if (length > 1e-6) {
      return [vector[0] / length, vector[1] / length];
    }
  }
  return null;
}

function approximateDistanceMeters(left, right) {
  const vector = localVectorMeters(left, right);
  return Math.hypot(vector[0], vector[1]);
}

function localVectorMeters(left, right) {
  const latitude = ((left[1] + right[1]) / 2) * (Math.PI / 180);
  return [
    (right[0] - left[0]) *
      111_320 *
      Math.max(0.2, Math.cos(latitude)),
    (right[1] - left[1]) * 110_540,
  ];
}

function validateHeader(value, sourcePath) {
  if (
    value?.type !== 'CityJSON' ||
    value.version !== '2.0' ||
    !isTransform(value.transform)
  ) {
    throw new Error(`${sourcePath}: invalid CityJSON 2.0 sequence header`);
  }
  return value;
}

function readFeatureExtent(feature, transform) {
  if (
    Array.isArray(feature.geographicalExtent) &&
    feature.geographicalExtent.length === 6 &&
    feature.geographicalExtent.every(Number.isFinite)
  ) {
    return [...feature.geographicalExtent];
  }
  const extent = emptyExtent();
  for (const vertex of feature.vertices) {
    if (!Array.isArray(vertex) || vertex.length !== 3) {
      throw new Error(`${feature.id}: invalid CityJSONFeature vertex`);
    }
    const decoded = vertex.map(
      (coordinate, axis) =>
        Number(coordinate) * transform.scale[axis] + transform.translate[axis]
    );
    includeVertex(extent, decoded);
  }
  if (!hasFiniteExtent(extent)) {
    throw new Error(`${feature.id}: cannot determine feature extent`);
  }
  return extent;
}

function reencodeVertices(vertices, sourceTransform, targetTransform, featureId) {
  return vertices.map((vertex, vertexIndex) =>
    vertex.map((coordinate, axis) => {
      const decoded =
        Number(coordinate) * sourceTransform.scale[axis] +
        sourceTransform.translate[axis];
      const raw =
        (decoded - targetTransform.translate[axis]) /
        targetTransform.scale[axis];
      const encoded = Math.round(raw);
      if (!Number.isFinite(raw) || Math.abs(raw - encoded) > 1e-5) {
        throw new Error(
          `${featureId}: vertex ${vertexIndex} cannot be represented exactly on the millimetre output grid`
        );
      }
      return encoded;
    })
  );
}

function countObjectSurfaces(object) {
  if (!object || !Array.isArray(object.geometry)) return 0;
  return object.geometry.reduce((sum, geometry) => {
    if (!Array.isArray(geometry?.boundaries)) return sum;
    if (
      geometry.type === 'MultiSurface' ||
      geometry.type === 'CompositeSurface'
    ) {
      return sum + geometry.boundaries.length;
    }
    if (geometry.type === 'Solid') {
      return (
        sum +
        geometry.boundaries.reduce(
          (shellSum, shell) =>
            shellSum + (Array.isArray(shell) ? shell.length : 0),
          0
        )
      );
    }
    return sum;
  }, 0);
}

function publishStagingDirectory(staging, target) {
  if (!existsSync(target)) {
    moveDirectory(staging, target);
    return;
  }
  const backup = `${target}-backup-${process.pid}-${Date.now()}`;
  assertSafeOutputDirectory(backup);
  renameWithRetry(target, backup);
  try {
    moveDirectory(staging, target);
    rmSync(backup, { recursive: true });
  } catch (error) {
    if (existsSync(target)) rmSync(target, { recursive: true });
    moveDirectory(backup, target);
    throw error;
  }
}

function moveDirectory(source, target) {
  try {
    renameWithRetry(source, target);
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)) throw error;
    cpSync(source, target, { recursive: true, errorOnExist: true });
    rmSync(source, { recursive: true, maxRetries: 10, retryDelay: 100 });
  }
}

function renameWithRetry(source, target) {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      renameSync(source, target);
      return;
    } catch (error) {
      lastError = error;
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
    }
  }
  throw lastError;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function emptyExtent() {
  return [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
}

function includeExtent(target, source) {
  target[0] = Math.min(target[0], source[0]);
  target[1] = Math.min(target[1], source[1]);
  target[2] = Math.min(target[2], source[2]);
  target[3] = Math.max(target[3], source[3]);
  target[4] = Math.max(target[4], source[4]);
  target[5] = Math.max(target[5], source[5]);
}

function includeVertex(target, vertex) {
  includeExtent(target, [
    vertex[0],
    vertex[1],
    vertex[2],
    vertex[0],
    vertex[1],
    vertex[2],
  ]);
}

function hasFiniteExtent(extent) {
  return extent.length === 6 && extent.every(Number.isFinite);
}

function isTransform(value) {
  return (
    value &&
    Array.isArray(value.scale) &&
    value.scale.length === 3 &&
    value.scale.every((coordinate) => Number.isFinite(coordinate) && coordinate !== 0) &&
    Array.isArray(value.translate) &&
    value.translate.length === 3 &&
    value.translate.every(Number.isFinite)
  );
}

function signedToken(value) {
  return value < 0 ? `m${Math.abs(value)}` : String(value);
}

function assertSafeOutputDirectory(path) {
  const resolved = resolve(path);
  const root = parse(resolved).root;
  if (
    resolved === root ||
    resolved === resolve(projectRoot) ||
    resolved === resolve(homedir()) ||
    basename(resolved).length < 3
  ) {
    throw new Error(`Refusing unsafe output directory: ${resolved}`);
  }
  const rel = relative(dirname(resolved), resolved);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`Refusing unresolved output directory: ${resolved}`);
  }
}

function resolvePath(value) {
  const text = String(value);
  return isAbsolute(text) ? resolve(text) : resolve(projectRoot, text);
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} must be a positive number`);
  }
  return number;
}

function integerInRange(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return number;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) throw new Error(`Unexpected argument: ${raw}`);
    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = next;
      index++;
    }
  }
  return result;
}
