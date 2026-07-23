import { QuantizedMeshLoader } from '@loaders.gl/terrain';
import { localMapMetersFromLngLat } from './cityjson-map-mesh';

export const HAMBURG_TERRAIN_BASE_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/Gelaende';
export const HAMBURG_TERRAIN_VERSION = '1.1745499285499914';
// Terrain is imperceptible in the overview, while decoding and sampling it can
// monopolise the main thread. Start it with source building detail instead.
export const HAMBURG_TERRAIN_MIN_MAP_ZOOM = 15;
export const HAMBURG_TERRAIN_MAX_LEVEL = 16;

export const HAMBURG_TERRAIN_BOUNDS: readonly [number, number, number, number] = [
  9.71466064453125,
  53.39080810546875,
  10.3326416015625,
  53.74786376953125,
];

export interface HamburgTerrainTileDescriptor {
  key: string;
  level: number;
  x: number;
  y: number;
  bounds: [number, number, number, number];
  url: string;
}

export interface HamburgTerrainTile {
  descriptor: HamburgTerrainTileDescriptor;
  anchorLngLat: [number, number];
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  minElevation: number;
  maxElevation: number;
}

const MAX_VIEW_TILES = 28;
const terrainTileCache = new Map<string, Promise<HamburgTerrainTile>>();
const terrainSpatialIndexCache = new WeakMap<HamburgTerrainTile, TerrainSpatialIndex>();
let latestTerrainTiles: HamburgTerrainTile[] = [];

interface TerrainSpatialIndex {
  gridSize: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  triangleBuckets: Uint32Array[];
  sampleCache: Map<string, number | null>;
}

export function hamburgTerrainLevelForMapZoom(zoom: number): number | null {
  if (!Number.isFinite(zoom) || zoom < HAMBURG_TERRAIN_MIN_MAP_ZOOM) return null;
  return Math.max(0, Math.min(HAMBURG_TERRAIN_MAX_LEVEL, Math.floor(zoom) - 1));
}

/**
 * Resolve the Cesium geographic/TMS terrain tiles covering a WGS84 view.
 * Hamburg's terrain pyramid has two level-zero columns and one row, unlike
 * the Web Mercator XYZ raster pyramid used by the basemap.
 */
export function hamburgTerrainTilesForView(
  view: readonly [number, number, number, number] | null,
  mapZoom: number,
  maxTiles = MAX_VIEW_TILES
): HamburgTerrainTileDescriptor[] {
  const preferredLevel = hamburgTerrainLevelForMapZoom(mapZoom);
  if (!view || preferredLevel === null) return [];
  const clipped = intersectBboxes(view, HAMBURG_TERRAIN_BOUNDS);
  if (!clipped) return [];

  let level = preferredLevel;
  let range = geographicTileRange(clipped, level);
  while (level > 0 && range.count > maxTiles) {
    level--;
    range = geographicTileRange(clipped, level);
  }

  const descriptors: HamburgTerrainTileDescriptor[] = [];
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      const bounds = geographicTileBounds(level, x, y);
      const key = `${level}/${x}/${y}`;
      descriptors.push({
        key,
        level,
        x,
        y,
        bounds,
        url: `${HAMBURG_TERRAIN_BASE_URL}/${key}.terrain?v=${HAMBURG_TERRAIN_VERSION}`,
      });
    }
  }
  return descriptors;
}

export function geographicTileBounds(
  level: number,
  x: number,
  y: number
): [number, number, number, number] {
  const rows = 2 ** level;
  const columns = rows * 2;
  return [
    (x / columns) * 360 - 180,
    (y / rows) * 180 - 90,
    ((x + 1) / columns) * 360 - 180,
    ((y + 1) / rows) * 180 - 90,
  ];
}

export async function loadHamburgTerrainTile(
  descriptor: HamburgTerrainTileDescriptor
): Promise<HamburgTerrainTile> {
  let pending = terrainTileCache.get(descriptor.key);
  if (!pending) {
    pending = fetchAndDecodeTerrainTile(descriptor).catch((error) => {
      terrainTileCache.delete(descriptor.key);
      throw error;
    });
    terrainTileCache.set(descriptor.key, pending);
  }
  return pending;
}

export function rememberHamburgTerrainTiles(tiles: HamburgTerrainTile[]): void {
  latestTerrainTiles = tiles;
}

export function sampleCachedHamburgTerrainElevation(
  lngLat: readonly [number, number]
): number | null {
  return sampleHamburgTerrainElevation(latestTerrainTiles, lngLat);
}

export function sampleHamburgTerrainElevation(
  tiles: readonly HamburgTerrainTile[],
  lngLat: readonly [number, number]
): number | null {
  for (const tile of tiles) {
    if (!pointInsideBounds(lngLat, tile.descriptor.bounds)) continue;
    const [east, north] = localMapMetersFromLngLat(tile.anchorLngLat, lngLat);
    const spatialIndex = terrainSpatialIndexFor(tile);
    const cacheKey = `${Math.round(east * 10)}:${Math.round(north * 10)}`;
    if (spatialIndex.sampleCache.has(cacheKey)) {
      const cached = spatialIndex.sampleCache.get(cacheKey) ?? null;
      if (cached !== null) return cached;
      continue;
    }
    const elevation = sampleTerrainTile(tile, spatialIndex, east, north);
    spatialIndex.sampleCache.set(cacheKey, elevation);
    if (elevation !== null) return elevation;
  }
  return null;
}

function sampleTerrainTile(
  tile: HamburgTerrainTile,
  spatialIndex: TerrainSpatialIndex,
  east: number,
  north: number
): number | null {
  const { positions, indices } = tile;
  const column = terrainGridCoordinate(
    east,
    spatialIndex.minX,
    spatialIndex.maxX,
    spatialIndex.gridSize
  );
  const row = terrainGridCoordinate(
    north,
    spatialIndex.minY,
    spatialIndex.maxY,
    spatialIndex.gridSize
  );
  const triangleOffsets = spatialIndex.triangleBuckets[
    row * spatialIndex.gridSize + column
  ] ?? new Uint32Array();

  for (const triangleOffset of triangleOffsets) {
    const a = indices[triangleOffset] * 3;
    const b = indices[triangleOffset + 1] * 3;
    const c = indices[triangleOffset + 2] * 3;
    const elevation = triangleElevationAt(
      east,
      north,
      positions[a],
      positions[a + 1],
      positions[a + 2],
      positions[b],
      positions[b + 1],
      positions[b + 2],
      positions[c],
      positions[c + 1],
      positions[c + 2]
    );
    if (elevation !== null) return elevation;
  }

  // Quantized tile edges and degenerate triangles can miss the barycentric
  // test. Search vertices from the local bucket first; a full-tile scan is the
  // rare final fallback rather than the normal cost of every sample.
  let nearestElevation: number | null = null;
  let nearestDistance = Infinity;
  for (const triangleOffset of triangleOffsets) {
    for (let corner = 0; corner < 3; corner++) {
      const positionIndex = indices[triangleOffset + corner] * 3;
      const dx = positions[positionIndex] - east;
      const dy = positions[positionIndex + 1] - north;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestElevation = positions[positionIndex + 2];
      }
    }
  }
  if (nearestElevation !== null) return nearestElevation;

  for (let positionIndex = 0; positionIndex < positions.length; positionIndex += 3) {
    const dx = positions[positionIndex] - east;
    const dy = positions[positionIndex + 1] - north;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestElevation = positions[positionIndex + 2];
    }
  }
  return nearestElevation;
}

function terrainSpatialIndexFor(tile: HamburgTerrainTile): TerrainSpatialIndex {
  const cached = terrainSpatialIndexCache.get(tile);
  if (cached) return cached;

  const { positions, indices } = tile;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let positionIndex = 0; positionIndex < positions.length; positionIndex += 3) {
    minX = Math.min(minX, positions[positionIndex]);
    minY = Math.min(minY, positions[positionIndex + 1]);
    maxX = Math.max(maxX, positions[positionIndex]);
    maxY = Math.max(maxY, positions[positionIndex + 1]);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    minX = minY = maxX = maxY = 0;
  }

  const triangleCount = Math.floor(indices.length / 3);
  const gridSize = Math.max(1, Math.min(64, Math.ceil(Math.sqrt(triangleCount / 8))));
  const mutableBuckets = Array.from(
    { length: gridSize * gridSize },
    () => [] as number[]
  );
  for (let triangleOffset = 0; triangleOffset + 2 < indices.length; triangleOffset += 3) {
    const a = indices[triangleOffset] * 3;
    const b = indices[triangleOffset + 1] * 3;
    const c = indices[triangleOffset + 2] * 3;
    const triangleMinX = Math.min(positions[a], positions[b], positions[c]);
    const triangleMaxX = Math.max(positions[a], positions[b], positions[c]);
    const triangleMinY = Math.min(positions[a + 1], positions[b + 1], positions[c + 1]);
    const triangleMaxY = Math.max(positions[a + 1], positions[b + 1], positions[c + 1]);
    const minColumn = terrainGridCoordinate(triangleMinX, minX, maxX, gridSize);
    const maxColumn = terrainGridCoordinate(triangleMaxX, minX, maxX, gridSize);
    const minRow = terrainGridCoordinate(triangleMinY, minY, maxY, gridSize);
    const maxRow = terrainGridCoordinate(triangleMaxY, minY, maxY, gridSize);
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        mutableBuckets[row * gridSize + column].push(triangleOffset);
      }
    }
  }

  const spatialIndex: TerrainSpatialIndex = {
    gridSize,
    minX,
    minY,
    maxX,
    maxY,
    triangleBuckets: mutableBuckets.map((bucket) => Uint32Array.from(bucket)),
    sampleCache: new Map(),
  };
  terrainSpatialIndexCache.set(tile, spatialIndex);
  return spatialIndex;
}

function terrainGridCoordinate(
  value: number,
  min: number,
  max: number,
  gridSize: number
): number {
  if (gridSize <= 1 || max - min < 1e-9) return 0;
  return clampInteger(Math.floor(((value - min) / (max - min)) * gridSize), 0, gridSize - 1);
}

function triangleElevationAt(
  x: number,
  y: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number | null {
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < 1e-9) return null;
  const aWeight = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / denominator;
  const bWeight = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / denominator;
  const cWeight = 1 - aWeight - bWeight;
  const epsilon = 1e-6;
  if (aWeight < -epsilon || bWeight < -epsilon || cWeight < -epsilon) return null;
  return aWeight * az + bWeight * bz + cWeight * cz;
}

async function fetchAndDecodeTerrainTile(
  descriptor: HamburgTerrainTileDescriptor
): Promise<HamburgTerrainTile> {
  const response = await fetch(descriptor.url, {
    headers: {
      Accept: 'application/vnd.quantized-mesh, application/octet-stream;q=0.9, */*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`Hamburg terrain tile returned HTTP ${response.status}.`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const parsed = QuantizedMeshLoader.parseSync(arrayBuffer, {
    // Adjacent tiles are loaded together. Textured skirts create visible
    // vertical map-image walls at their boundaries, especially over water.
    'quantized-mesh': { bounds: [0, 0, 1, 1], skirtHeight: null },
  }) as {
    attributes?: {
      POSITION?: { value?: Float32Array };
    };
    indices?: { value?: Uint16Array | Uint32Array };
  };
  const sourcePositions = parsed.attributes?.POSITION?.value;
  const indices = parsed.indices?.value;
  if (!sourcePositions || !indices) {
    throw new Error('Hamburg terrain tile did not contain a decodable triangle mesh.');
  }

  const [west, south, east, north] = descriptor.bounds;
  const anchorLngLat: [number, number] = [(west + east) / 2, (south + north) / 2];
  const positions = new Float32Array(sourcePositions.length);
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  for (let index = 0; index < sourcePositions.length; index += 3) {
    const lng = west + sourcePositions[index] * (east - west);
    const lat = south + sourcePositions[index + 1] * (north - south);
    const elevation = sourcePositions[index + 2];
    const [eastM, northM] = localMapMetersFromLngLat(anchorLngLat, [lng, lat]);
    positions[index] = eastM;
    positions[index + 1] = northM;
    positions[index + 2] = elevation;
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);
  }

  return {
    descriptor,
    anchorLngLat,
    positions,
    indices,
    minElevation,
    maxElevation,
  };
}

function geographicTileRange(
  bbox: readonly [number, number, number, number],
  level: number
): { minX: number; maxX: number; minY: number; maxY: number; count: number } {
  const rows = 2 ** level;
  const columns = rows * 2;
  const epsilon = 1e-10;
  const minX = clampInteger(Math.floor(((bbox[0] + 180) / 360) * columns), 0, columns - 1);
  const maxX = clampInteger(
    Math.floor((((bbox[2] - epsilon) + 180) / 360) * columns),
    0,
    columns - 1
  );
  const minY = clampInteger(Math.floor(((bbox[1] + 90) / 180) * rows), 0, rows - 1);
  const maxY = clampInteger(
    Math.floor((((bbox[3] - epsilon) + 90) / 180) * rows),
    0,
    rows - 1
  );
  return {
    minX,
    maxX,
    minY,
    maxY,
    count: (maxX - minX + 1) * (maxY - minY + 1),
  };
}

function intersectBboxes(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number]
): [number, number, number, number] | null {
  const result: [number, number, number, number] = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.min(a[2], b[2]),
    Math.min(a[3], b[3]),
  ];
  return result[0] < result[2] && result[1] < result[3] ? result : null;
}

function pointInsideBounds(
  point: readonly [number, number],
  bounds: readonly [number, number, number, number]
): boolean {
  return point[0] >= bounds[0] && point[0] <= bounds[2] &&
    point[1] >= bounds[1] && point[1] <= bounds[3];
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
