import proj4 from 'proj4';
import type { CityJsonDocument, CityObject } from '../types';
import './projection';

type NumericArray = { length: number; [index: number]: number };
type TileAttribute = { value?: NumericArray };
type TilePrimitive = {
  mode?: number;
  attributes?: Record<string, TileAttribute | undefined>;
  indices?: TileAttribute;
};
type TileMesh = { primitives?: TilePrimitive[] };
type TileNode = {
  matrix?: NumericArray;
  translation?: NumericArray;
  rotation?: NumericArray;
  scale?: NumericArray;
  mesh?: TileMesh | number;
  children?: Array<TileNode | number>;
};
type TileScene = { nodes?: Array<TileNode | number> };
type TileContent = {
  batchTableJson?: {
    id?: unknown[];
    attributes?: unknown[];
  };
  cartesianModelMatrix?: NumericArray;
  modelMatrix?: NumericArray;
  gltf?: {
    scene?: TileScene | number;
    scenes?: TileScene[];
    nodes?: TileNode[];
    meshes?: TileMesh[];
  };
};
export type HamburgTile = {
  id?: string;
  url?: string;
  contentUrl?: string;
  content?: TileContent;
};

interface ProjectedVertex {
  projected: [number, number, number];
  wgs84: [number, number, number];
}

interface FeatureTriangle {
  vertices: [ProjectedVertex, ProjectedVertex, ProjectedVertex];
}

interface ExtractedFeature {
  batchId: number;
  sourceId: string;
  attributes: Record<string, unknown>;
  triangles: FeatureTriangle[];
}

export interface HamburgBuildingHandoff {
  document: CityJsonDocument;
  objectId: string;
  sourceFeatureId: string;
  sourceTileUrl: string;
  batchId: number;
  sourceLod: HamburgBuildingSourceLod;
  texturesAvailable: boolean;
}

export type HamburgBuildingSourceLod = 1 | 2 | 3;

export const HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE =
  '_hamburgTileSelectionProxy';
export const HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE =
  '_hamburgTileGeometryOverride';
export const HAMBURG_TILE_TEXTURES_AVAILABLE_ATTRIBUTE =
  '_hamburgTileTexturesAvailable';

/**
 * Turn an on-demand selection copy into the authoritative local geometry.
 * Child edits resolve to the Hamburg building root through CityJSON parents.
 */
export function promoteHamburgTileSelectionProxy(
  document: CityJsonDocument,
  objectId: string
): string | null {
  const pending = [objectId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidateId = pending.shift()!;
    if (visited.has(candidateId)) continue;
    visited.add(candidateId);
    const object = document.CityObjects[candidateId];
    if (!object) continue;
    if (typeof object.attributes?._hamburgTileFeatureId === 'string') {
      object.attributes = {
        ...(object.attributes ?? {}),
        [HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE]: false,
        [HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE]: true,
      };
      return candidateId;
    }
    for (const parentId of object.parents ?? []) pending.push(parentId);
  }
  return null;
}

/**
 * Keep a passive proxy's coarser source geometries when a higher-detail tile
 * replaces it. If LoD3 was selected before its LoD2 fallback arrived, retain a
 * semantic LoD2 copy so a later local move cannot make the building disappear
 * when the map zooms back out.
 */
export function ensureHamburgEditableLodFallback(
  replacement: CityObject,
  existing: CityObject | undefined,
  incomingLod: HamburgBuildingSourceLod
): void {
  const replacementGeometry = replacement.geometry ?? [];
  if (
    replacementGeometry.some(
      (geometry) => geometryLod(geometry) < incomingLod
    )
  ) {
    return;
  }

  const lowerGeometry = (existing?.geometry ?? []).filter(
    (geometry) => geometryLod(geometry) < incomingLod
  );
  if (lowerGeometry.length > 0) {
    replacement.geometry = [
      ...structuredClone(lowerGeometry),
      ...replacementGeometry,
    ];
    return;
  }

  if (incomingLod !== 3) return;
  const lod3Geometry = replacementGeometry.find(
    (geometry) => geometryLod(geometry) >= 3
  );
  if (!lod3Geometry || typeof lod3Geometry !== 'object') return;
  const lod2Fallback = structuredClone(lod3Geometry) as Record<string, unknown>;
  lod2Fallback.lod = '2';
  replacement.geometry = [lod2Fallback, ...replacementGeometry];
}

export interface HamburgTileConversionOptions {
  sourceLod?: HamburgBuildingSourceLod;
  texturesAvailable?: boolean;
}

export interface HamburgTransientBuilding {
  objectId: string;
  sourceFeatureId: string;
  batchId: number;
}

export interface HamburgTransientTile {
  key: string;
  sourceLod: HamburgBuildingSourceLod;
  sourceTileUrl: string;
  document: CityJsonDocument;
  buildings: HamburgTransientBuilding[];
}

export interface HamburgTilePick {
  x: number;
  y: number;
  viewport: {
    project: (coordinates: number[]) => number[];
  };
}

export interface HamburgTilePickCandidate {
  tile: HamburgTile;
  sourceLod: HamburgBuildingSourceLod;
  texturesAvailable?: boolean;
}

export interface HamburgBuildingTilePickResult
  extends HamburgBuildingHandoff {
  screenDistance: number;
}

const featureCache = new WeakMap<object, Map<number, ExtractedFeature>>();
const transientTileCache = new WeakMap<
  object,
  Map<HamburgBuildingSourceLod, HamburgTransientTile>
>();

/**
 * Resolve the batch feature under a deck.gl click and convert only that
 * building to an ordinary, local EPSG:25832 CityJSON object.
 */
export function pickHamburgBuildingForEditing(
  tile: HamburgTile,
  pick: HamburgTilePick,
  options: HamburgTileConversionOptions = {}
): HamburgBuildingHandoff | null {
  const best = findHamburgFeatureForPick(tile, pick);
  return best ? featureToCityJson(tile, best.feature, options) : null;
}

/**
 * CPU fallback for native Tile3DLayer picking. It searches only the loaded
 * tiles supplied by the caller and converts the single nearest batch feature
 * after a hit has been established.
 */
export function pickHamburgBuildingFromTilesForEditing(
  candidates: Iterable<HamburgTilePickCandidate>,
  pick: HamburgTilePick,
  maxScreenDistance = 6
): HamburgBuildingTilePickResult | null {
  let best:
    | {
        tile: HamburgTile;
        sourceLod: HamburgBuildingSourceLod;
        texturesAvailable: boolean;
        feature: ExtractedFeature;
        distance: number;
        depth: number;
      }
    | undefined;

  for (const candidate of candidates) {
    const picked = findHamburgFeatureForPick(candidate.tile, pick);
    if (
      !picked ||
      picked.distance > maxScreenDistance ||
      (best &&
        !isCloserPick(
          picked.distance,
          picked.depth,
          best.distance,
          best.depth
        ))
    ) {
      continue;
    }
    best = {
      tile: candidate.tile,
      sourceLod: candidate.sourceLod,
      texturesAvailable: candidate.texturesAvailable ?? false,
      ...picked,
    };
  }

  if (!best) return null;
  const handoff = featureToCityJson(best.tile, best.feature, {
    sourceLod: best.sourceLod,
    texturesAvailable: best.texturesAvailable,
  });
  return handoff
    ? { ...handoff, screenDistance: best.distance }
    : null;
}

function findHamburgFeatureForPick(
  tile: HamburgTile,
  pick: HamburgTilePick
): { feature: ExtractedFeature; distance: number; depth: number } | null {
  const features = extractTileFeatures(tile);
  let best:
    | { feature: ExtractedFeature; distance: number; depth: number }
    | undefined;

  for (const feature of features.values()) {
    let featureDistance = Infinity;
    let featureDepth = Infinity;
    for (const triangle of feature.triangles) {
      const screen = triangle.vertices.map((vertex) =>
        pick.viewport.project(vertex.wgs84)
      );
      if (screen.some((point) => point.length < 2)) continue;
      const distance = pointTriangleDistance(
        [pick.x, pick.y],
        [screen[0][0], screen[0][1]],
        [screen[1][0], screen[1][1]],
        [screen[2][0], screen[2][1]]
      );
      if (distance < featureDistance) {
        featureDistance = distance;
        featureDepth =
          (Number(screen[0][2] ?? 0) +
            Number(screen[1][2] ?? 0) +
            Number(screen[2][2] ?? 0)) /
          3;
      }
      if (featureDistance === 0) break;
    }
    if (
      !best ||
      isCloserPick(
        featureDistance,
        featureDepth,
        best.distance,
        best.depth
      )
    ) {
      best = {
        feature,
        distance: featureDistance,
        depth: featureDepth,
      };
    }
  }

  return best && Number.isFinite(best.distance) ? best : null;
}

function isCloserPick(
  distance: number,
  depth: number,
  bestDistance: number,
  bestDepth: number
): boolean {
  return (
    distance < bestDistance - 0.01 ||
    (Math.abs(distance - bestDistance) <= 0.01 && depth < bestDepth)
  );
}

export function convertHamburgTileBatchToCityJson(
  tile: HamburgTile,
  batchId: number,
  options: HamburgTileConversionOptions = {}
): HamburgBuildingHandoff | null {
  const feature = extractTileFeatures(tile).get(batchId);
  return feature ? featureToCityJson(tile, feature, options) : null;
}

export function convertHamburgTileFeatureToCityJson(
  tile: HamburgTile,
  sourceFeatureId: string,
  options: HamburgTileConversionOptions = {}
): HamburgBuildingHandoff | null {
  const content = tile.content;
  if (!content) return null;
  for (let batchId = 0; batchId < featureCount(content); batchId++) {
    if (readSourceFeatureId(content, batchId) !== sourceFeatureId) continue;
    return convertHamburgTileBatchToCityJson(tile, batchId, options);
  }
  return null;
}

/**
 * Convert every batch feature in one loaded Hamburg b3dm tile into a transient
 * CityJSON document. The document is never merged into editor/export state; it
 * exists only so the citywide stream can use the exact same semantic mesh and
 * footprint pipeline as local CityJSON.
 */
export function convertHamburgTileToCityJson(
  tile: HamburgTile,
  options: HamburgTileConversionOptions = {}
): HamburgTransientTile | null {
  const sourceLod = options.sourceLod ?? 2;
  const content = tile.content;
  if (!content) return null;
  const cachedByLod = transientTileCache.get(content);
  const cached = cachedByLod?.get(sourceLod);
  if (cached) return cached;

  const features = [...extractTileFeatures(tile).values()];
  const built = buildFeatureDocument(tile, features, sourceLod, true);
  if (!built) return null;
  const result: HamburgTransientTile = {
    key: hamburgTransientTileKey(tile, sourceLod),
    sourceLod,
    sourceTileUrl: built.sourceTileUrl,
    document: built.document,
    buildings: built.buildings,
  };
  const nextByLod =
    cachedByLod ?? new Map<HamburgBuildingSourceLod, HamburgTransientTile>();
  nextByLod.set(sourceLod, result);
  if (!cachedByLod) transientTileCache.set(content, nextByLod);
  return result;
}

export function hamburgTransientTileKey(
  tile: HamburgTile,
  sourceLod: HamburgBuildingSourceLod
): string {
  const sourceTileUrl = String(tile.contentUrl ?? tile.url ?? tile.id ?? 'unknown-tile');
  return `${sourceLod}:${sourceTileUrl}`;
}

/**
 * Collapse selected batch geometry to a point before deck.gl uploads it.
 * This removes the remote duplicate after its editable local copy is created.
 */
export function hideHamburgTileBuildings(
  tile: HamburgTile,
  sourceFeatureIds: ReadonlySet<string>
): number {
  const content = tile.content;
  if (!content || sourceFeatureIds.size === 0) return 0;
  const hiddenBatchIds = new Set<number>();
  for (let batchId = 0; batchId < featureCount(content); batchId++) {
    if (sourceFeatureIds.has(readSourceFeatureId(content, batchId))) {
      hiddenBatchIds.add(batchId);
    }
  }
  if (hiddenBatchIds.size === 0) return 0;

  let collapsedVertices = 0;
  forEachPrimitive(content, (_nodeMatrix, primitive) => {
    const positions = primitive.attributes?.POSITION?.value;
    const batchIds = readBatchIds(primitive);
    if (!positions || !batchIds) return;
    const anchors = new Map<number, [number, number, number]>();
    const count = Math.min(Math.floor(positions.length / 3), batchIds.length);
    for (let vertex = 0; vertex < count; vertex++) {
      const batchId = Math.round(Number(batchIds[vertex]));
      if (!hiddenBatchIds.has(batchId)) continue;
      const anchor =
        anchors.get(batchId) ??
        [
          Number(positions[vertex * 3]),
          Number(positions[vertex * 3 + 1]),
          Number(positions[vertex * 3 + 2]),
        ];
      anchors.set(batchId, anchor);
      positions[vertex * 3] = anchor[0];
      positions[vertex * 3 + 1] = anchor[1];
      positions[vertex * 3 + 2] = anchor[2];
      collapsedVertices++;
    }
  });
  return collapsedVertices;
}

function extractTileFeatures(tile: HamburgTile): Map<number, ExtractedFeature> {
  const content = tile.content;
  if (!content?.gltf) return new Map();
  const cached = featureCache.get(content);
  if (cached) return cached;

  const features = new Map<number, ExtractedFeature>();
  const tileMatrix = matrixArray(
    content.cartesianModelMatrix ?? content.modelMatrix
  );
  if (!tileMatrix) return features;

  forEachPrimitive(content, (nodeMatrix, primitive) => {
    if (primitive.mode !== undefined && primitive.mode !== 4) return;
    const positions = primitive.attributes?.POSITION?.value;
    const batchIds = readBatchIds(primitive);
    if (!positions || !batchIds) return;
    const indices = primitive.indices?.value;
    const vertexCount = Math.min(
      Math.floor(positions.length / 3),
      batchIds.length
    );
    const worldMatrix = multiplyMatrices(tileMatrix, nodeMatrix);
    const transformed = new Map<number, ProjectedVertex>();
    const readVertex = (index: number): ProjectedVertex | null => {
      if (index < 0 || index >= vertexCount) return null;
      const existing = transformed.get(index);
      if (existing) return existing;
      const ecef = transformPoint(worldMatrix, [
        Number(positions[index * 3]),
        Number(positions[index * 3 + 1]),
        Number(positions[index * 3 + 2]),
      ]);
      const projectedRaw = proj4('EPSG:4978', 'EPSG:25832', ecef);
      const wgs84Raw = proj4('EPSG:4978', 'EPSG:4326', ecef);
      if (
        projectedRaw.length < 3 ||
        wgs84Raw.length < 3 ||
        !projectedRaw.every(Number.isFinite) ||
        !wgs84Raw.every(Number.isFinite)
      ) {
        return null;
      }
      const value: ProjectedVertex = {
        projected: [
          Number(projectedRaw[0]),
          Number(projectedRaw[1]),
          Number(projectedRaw[2]),
        ],
        wgs84: [
          Number(wgs84Raw[0]),
          Number(wgs84Raw[1]),
          Number(wgs84Raw[2]),
        ],
      };
      transformed.set(index, value);
      return value;
    };

    const indexCount = indices?.length ?? vertexCount;
    for (let offset = 0; offset + 2 < indexCount; offset += 3) {
      const a = Math.round(Number(indices ? indices[offset] : offset));
      const b = Math.round(Number(indices ? indices[offset + 1] : offset + 1));
      const c = Math.round(Number(indices ? indices[offset + 2] : offset + 2));
      const batchId = Math.round(Number(batchIds[a]));
      if (
        !Number.isFinite(batchId) ||
        Math.round(Number(batchIds[b])) !== batchId ||
        Math.round(Number(batchIds[c])) !== batchId
      ) {
        continue;
      }
      const vertices = [readVertex(a), readVertex(b), readVertex(c)] as const;
      if (!vertices[0] || !vertices[1] || !vertices[2]) continue;
      let feature = features.get(batchId);
      if (!feature) {
        feature = {
          batchId,
          sourceId: readSourceFeatureId(content, batchId),
          attributes: readFeatureAttributes(content, batchId),
          triangles: [],
        };
        features.set(batchId, feature);
      }
      feature.triangles.push({
        vertices: [vertices[0], vertices[1], vertices[2]],
      });
    }
  });

  featureCache.set(content, features);
  return features;
}

interface PreparedFeature {
  feature: ExtractedFeature;
  vertices: [number, number, number][];
  boundaries: number[][][];
  semanticValues: number[];
  extent: [number, number, number, number, number, number];
}

function featureToCityJson(
  tile: HamburgTile,
  feature: ExtractedFeature,
  options: HamburgTileConversionOptions
): HamburgBuildingHandoff | null {
  const sourceLod = options.sourceLod ?? 2;
  const built = buildFeatureDocument(tile, [feature], sourceLod, false);
  if (!built) return null;
  const building = built.buildings[0];
  const texturesAvailable = options.texturesAvailable ?? false;
  const cityObject = built.document.CityObjects[building.objectId];
  if (cityObject) {
    cityObject.attributes = {
      ...(cityObject.attributes ?? {}),
      [HAMBURG_TILE_TEXTURES_AVAILABLE_ATTRIBUTE]: texturesAvailable,
    };
  }
  return {
    document: built.document,
    objectId: building.objectId,
    sourceFeatureId: building.sourceFeatureId,
    sourceTileUrl: built.sourceTileUrl,
    batchId: building.batchId,
    sourceLod,
    texturesAvailable,
  };
}

function geometryLod(geometry: unknown): number {
  if (!geometry || typeof geometry !== 'object') return Infinity;
  const value = Number.parseFloat(
    String((geometry as { lod?: unknown }).lod ?? '')
  );
  return Number.isFinite(value) ? value : Infinity;
}

function prepareFeature(feature: ExtractedFeature): PreparedFeature | null {
  if (feature.triangles.length === 0) return null;
  const rawVertices: [number, number, number][] = [];
  for (const triangle of feature.triangles) {
    for (const vertex of triangle.vertices) rawVertices.push(vertex.projected);
  }
  const minimumZ = Math.min(...rawVertices.map((vertex) => vertex[2]));
  const normalizedTriangles = feature.triangles.map((triangle) =>
    triangle.vertices.map(
      (vertex) =>
        [
          vertex.projected[0],
          vertex.projected[1],
          vertex.projected[2] - minimumZ,
        ] as [number, number, number]
    ) as [[number, number, number], [number, number, number], [number, number, number]]
  );

  const vertices: [number, number, number][] = [];
  const vertexIndex = new Map<string, number>();
  const triangleIndices: [number, number, number][] = [];
  const indexOf = (vertex: [number, number, number]) => {
    const key = vertex.map((coordinate) => Math.round(coordinate * 1000)).join(':');
    const existing = vertexIndex.get(key);
    if (existing !== undefined) return existing;
    const index = vertices.length;
    vertices.push(vertex);
    vertexIndex.set(key, index);
    return index;
  };
  for (const triangle of normalizedTriangles) {
    const indices = triangle.map(indexOf) as [number, number, number];
    if (new Set(indices).size === 3) triangleIndices.push(indices);
  }
  if (triangleIndices.length === 0) return null;

  const footprint = buildingFootprint(vertices, triangleIndices);
  if (footprint.length < 3) return null;
  const groundTriangles = new Set(
    triangleIndices
      .map((triangle, index) => ({ triangle, index }))
      .filter(({ triangle }) =>
        triangle.every((index) => vertices[index][2] <= 0.15)
      )
      .map(({ index }) => index)
  );

  const boundaries: number[][][] = [[footprint]];
  const semanticValues: number[] = [0];
  for (const [index, triangle] of triangleIndices.entries()) {
    if (groundTriangles.has(index)) continue;
    boundaries.push([triangle]);
    semanticValues.push(isRoofTriangle(vertices, triangle) ? 1 : 2);
  }

  const minX = Math.min(...vertices.map((vertex) => vertex[0]));
  const minY = Math.min(...vertices.map((vertex) => vertex[1]));
  const maxX = Math.max(...vertices.map((vertex) => vertex[0]));
  const maxY = Math.max(...vertices.map((vertex) => vertex[1]));
  const maxZ = Math.max(...vertices.map((vertex) => vertex[2]));
  return {
    feature,
    vertices,
    boundaries,
    semanticValues,
    extent: [minX, minY, 0, maxX, maxY, maxZ],
  };
}

function buildFeatureDocument(
  tile: HamburgTile,
  features: ExtractedFeature[],
  sourceLod: HamburgBuildingSourceLod,
  transient: boolean
): {
  document: CityJsonDocument;
  sourceTileUrl: string;
  buildings: HamburgTransientBuilding[];
} | null {
  const prepared = features
    .map(prepareFeature)
    .filter((feature): feature is PreparedFeature => feature !== null);
  if (prepared.length === 0) return null;

  const minX = Math.min(...prepared.map((feature) => feature.extent[0]));
  const minY = Math.min(...prepared.map((feature) => feature.extent[1]));
  const maxX = Math.max(...prepared.map((feature) => feature.extent[3]));
  const maxY = Math.max(...prepared.map((feature) => feature.extent[4]));
  const maxZ = Math.max(...prepared.map((feature) => feature.extent[5]));
  const translate: [number, number, number] = [Math.floor(minX), Math.floor(minY), 0];
  const sourceTileUrl = String(tile.contentUrl ?? tile.url ?? tile.id ?? '');
  const tileHash = stableStringHash(hamburgTransientTileKey(tile, sourceLod));
  const vertices: [number, number, number][] = [];
  const CityObjects: CityJsonDocument['CityObjects'] = {};
  const buildings: HamburgTransientBuilding[] = [];
  const usedObjectIds = new Set<string>();

  for (const preparedFeature of prepared) {
    const { feature } = preparedFeature;
    const objectId = transient
      ? uniqueTransientObjectId(tileHash, feature.batchId, usedObjectIds)
      : feature.sourceId;
    usedObjectIds.add(objectId);
    const vertexOffset = vertices.length;
    for (const vertex of preparedFeature.vertices) {
      vertices.push([
        Math.round((vertex[0] - translate[0]) * 1000),
        Math.round((vertex[1] - translate[1]) * 1000),
        Math.round(vertex[2] * 1000),
      ]);
    }
    const boundaries = preparedFeature.boundaries.map((face) =>
      face.map((ring) => ring.map((index) => index + vertexOffset))
    );
    const measuredHeight =
      typeof feature.attributes.measuredHeight === 'number'
        ? feature.attributes.measuredHeight
        : preparedFeature.extent[5];
    CityObjects[objectId] = {
      type: 'Building',
      attributes: {
        ...feature.attributes,
        measuredHeight,
        _createdBy: transient
          ? 'hamburg-3d-tiles-stream'
          : 'hamburg-3d-tiles-handoff',
        _source: `Hamburg official LoD${sourceLod} 3D Tiles`,
        _hamburgTileFeatureId: feature.sourceId,
        _hamburgTileBatchId: feature.batchId,
        _hamburgTileUrl: sourceTileUrl,
        _hamburgTileLod: sourceLod,
        ...(transient
          ? {}
          : {
              [HAMBURG_TILE_SELECTION_PROXY_ATTRIBUTE]: true,
              [HAMBURG_TILE_GEOMETRY_OVERRIDE_ATTRIBUTE]: false,
            }),
      },
      geographicalExtent: preparedFeature.extent,
      geometry: [
        {
          type: 'MultiSurface',
          lod: String(sourceLod),
          boundaries,
          semantics: {
            surfaces: [
              { type: 'GroundSurface' },
              { type: 'RoofSurface' },
              { type: 'WallSurface' },
            ],
            values: preparedFeature.semanticValues,
          },
        },
      ],
    };
    buildings.push({
      objectId,
      sourceFeatureId: feature.sourceId,
      batchId: feature.batchId,
    });
  }

  const document: CityJsonDocument = {
    type: 'CityJSON',
    version: '2.0',
    transform: {
      scale: [0.001, 0.001, 0.001],
      translate,
    },
    metadata: {
      referenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/25832',
      geographicalExtent: [minX, minY, 0, maxX, maxY, maxZ],
      title: transient
        ? `Transient Hamburg LoD${sourceLod} tile ${sourceTileUrl}`
        : `Editable local copy of Hamburg streamed building ${buildings[0].objectId}`,
    },
    CityObjects,
    vertices,
  };
  return {
    document,
    sourceTileUrl,
    buildings,
  };
}

function uniqueTransientObjectId(
  tileHash: string,
  batchId: number,
  used: ReadonlySet<string>
): string {
  const base = `hamburg-stream:${tileHash}:${batchId}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}:${suffix}`)) suffix++;
  return `${base}:${suffix}`;
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function buildingFootprint(
  vertices: [number, number, number][],
  triangles: [number, number, number][]
): number[] {
  const ground = triangles.filter((triangle) =>
    triangle.every((index) => vertices[index][2] <= 0.15)
  );
  const edges = new Map<string, { count: number; from: number; to: number }>();
  for (const triangle of ground) {
    for (const [from, to] of [
      [triangle[0], triangle[1]],
      [triangle[1], triangle[2]],
      [triangle[2], triangle[0]],
    ]) {
      const key = from < to ? `${from}:${to}` : `${to}:${from}`;
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { count: 1, from, to });
    }
  }
  const adjacency = new Map<number, number[]>();
  for (const edge of edges.values()) {
    if (edge.count !== 1) continue;
    addNeighbor(adjacency, edge.from, edge.to);
    addNeighbor(adjacency, edge.to, edge.from);
  }
  const loops: number[][] = [];
  const visitedEdges = new Set<string>();
  for (const start of adjacency.keys()) {
    for (const firstNext of adjacency.get(start) ?? []) {
      const firstEdge = edgeKey(start, firstNext);
      if (visitedEdges.has(firstEdge)) continue;
      const loop = [start];
      let previous = start;
      let current = firstNext;
      visitedEdges.add(firstEdge);
      for (let guard = 0; guard < adjacency.size * 3; guard++) {
        if (current === start) break;
        loop.push(current);
        const next = (adjacency.get(current) ?? []).find(
          (candidate) =>
            candidate !== previous &&
            !visitedEdges.has(edgeKey(current, candidate))
        );
        if (next === undefined) break;
        visitedEdges.add(edgeKey(current, next));
        previous = current;
        current = next;
      }
      if (current === start && loop.length >= 3) loops.push(loop);
    }
  }
  if (loops.length > 0) {
    return loops.sort(
      (left, right) =>
        Math.abs(polygonArea(vertices, right)) -
        Math.abs(polygonArea(vertices, left))
    )[0];
  }

  const lowest = [
    ...new Set(
      vertices
        .map((vertex, index) => ({ vertex, index }))
        .filter(({ vertex }) => vertex[2] <= 0.15)
        .map(({ index }) => index)
    ),
  ];
  return convexHull(vertices, lowest);
}

function isRoofTriangle(
  vertices: [number, number, number][],
  triangle: [number, number, number]
): boolean {
  const [a, b, c] = triangle.map((index) => vertices[index]);
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0],
  ];
  const length = Math.hypot(normal[0], normal[1], normal[2]);
  return length > 0 && Math.abs(normal[2]) / length > 0.3;
}

function forEachPrimitive(
  content: TileContent,
  visit: (nodeMatrix: number[], primitive: TilePrimitive) => void
): void {
  const gltf = content.gltf;
  if (!gltf) return;
  const scene =
    typeof gltf.scene === 'object'
      ? gltf.scene
      : gltf.scenes?.[typeof gltf.scene === 'number' ? gltf.scene : 0];
  const roots = scene?.nodes ?? gltf.nodes ?? [];
  const walk = (nodeValue: TileNode | number, parentMatrix: number[]) => {
    const node =
      typeof nodeValue === 'number' ? gltf.nodes?.[nodeValue] : nodeValue;
    if (!node) return;
    const matrix = multiplyMatrices(parentMatrix, nodeMatrix(node));
    const mesh =
      typeof node.mesh === 'number' ? gltf.meshes?.[node.mesh] : node.mesh;
    for (const primitive of mesh?.primitives ?? []) visit(matrix, primitive);
    for (const child of node.children ?? []) walk(child, matrix);
  };
  for (const root of roots) walk(root, identityMatrix());
}

function readBatchIds(primitive: TilePrimitive): NumericArray | null {
  return (
    primitive.attributes?._BATCHID?.value ??
    primitive.attributes?.BATCHID?.value ??
    primitive.attributes?._FEATURE_ID_0?.value ??
    null
  );
}

function featureCount(content: TileContent): number {
  return Math.max(
    content.batchTableJson?.id?.length ?? 0,
    content.batchTableJson?.attributes?.length ?? 0
  );
}

function readSourceFeatureId(content: TileContent, batchId: number): string {
  const topLevel = content.batchTableJson?.id?.[batchId];
  const attributes = readFeatureAttributes(content, batchId);
  const external = attributes['externalReference externalObjectName'];
  const candidate =
    typeof topLevel === 'string' && topLevel.trim()
      ? topLevel
      : typeof external === 'string' && external.trim()
        ? external
        : `hamburg-streamed-building-${batchId}`;
  return candidate.trim();
}

function readFeatureAttributes(
  content: TileContent,
  batchId: number
): Record<string, unknown> {
  const value = content.batchTableJson?.attributes?.[batchId];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? structuredClone(value as Record<string, unknown>)
    : {};
}

function nodeMatrix(node: TileNode): number[] {
  const explicit = matrixArray(node.matrix);
  if (explicit) return explicit;
  const translation = node.translation ?? [0, 0, 0];
  const scale = node.scale ?? [1, 1, 1];
  const rotation = node.rotation ?? [0, 0, 0, 1];
  const [x, y, z, w] = [
    Number(rotation[0] ?? 0),
    Number(rotation[1] ?? 0),
    Number(rotation[2] ?? 0),
    Number(rotation[3] ?? 1),
  ];
  const [sx, sy, sz] = [
    Number(scale[0] ?? 1),
    Number(scale[1] ?? 1),
    Number(scale[2] ?? 1),
  ];
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    Number(translation[0] ?? 0),
    Number(translation[1] ?? 0),
    Number(translation[2] ?? 0),
    1,
  ];
}

function identityMatrix(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function matrixArray(value: NumericArray | undefined): number[] | null {
  if (!value || value.length !== 16) return null;
  const matrix = Array.from({ length: 16 }, (_, index) => Number(value[index]));
  return matrix.every(Number.isFinite) ? matrix : null;
}

function multiplyMatrices(left: number[], right: number[]): number[] {
  const result = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let index = 0; index < 4; index++) {
        result[column * 4 + row] +=
          left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return result;
}

function transformPoint(
  matrix: number[],
  point: [number, number, number]
): [number, number, number] {
  const [x, y, z] = point;
  const w =
    matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const divisor = w && w !== 1 ? w : 1;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) /
      divisor,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) /
      divisor,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) /
      divisor,
  ];
}

function pointTriangleDistance(
  point: [number, number],
  a: [number, number],
  b: [number, number],
  c: [number, number]
): number {
  const denominator =
    (b[1] - c[1]) * (a[0] - c[0]) +
    (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(denominator) > 1e-9) {
    const alpha =
      ((b[1] - c[1]) * (point[0] - c[0]) +
        (c[0] - b[0]) * (point[1] - c[1])) /
      denominator;
    const beta =
      ((c[1] - a[1]) * (point[0] - c[0]) +
        (a[0] - c[0]) * (point[1] - c[1])) /
      denominator;
    const gamma = 1 - alpha - beta;
    if (alpha >= -0.01 && beta >= -0.01 && gamma >= -0.01) return 0;
  }
  return Math.min(
    pointSegmentDistance(point, a, b),
    pointSegmentDistance(point, b, c),
    pointSegmentDistance(point, c, a)
  );
}

function pointSegmentDistance(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        lengthSquared
    )
  );
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy)
  );
}

function addNeighbor(
  adjacency: Map<number, number[]>,
  from: number,
  to: number
): void {
  const neighbors = adjacency.get(from) ?? [];
  if (!neighbors.includes(to)) neighbors.push(to);
  adjacency.set(from, neighbors);
}

function edgeKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function polygonArea(
  vertices: [number, number, number][],
  polygon: number[]
): number {
  let area = 0;
  for (let index = 0; index < polygon.length; index++) {
    const current = vertices[polygon[index]];
    const next = vertices[polygon[(index + 1) % polygon.length]];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

function convexHull(
  vertices: [number, number, number][],
  indices: number[]
): number[] {
  const points = [...indices].sort((left, right) => {
    const dx = vertices[left][0] - vertices[right][0];
    return dx || vertices[left][1] - vertices[right][1];
  });
  if (points.length <= 3) return points;
  const cross = (a: number, b: number, c: number) =>
    (vertices[b][0] - vertices[a][0]) *
      (vertices[c][1] - vertices[a][1]) -
    (vertices[b][1] - vertices[a][1]) *
      (vertices[c][0] - vertices[a][0]);
  const lower: number[] = [];
  for (const point of points) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }
  const upper: number[] = [];
  for (const point of [...points].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
