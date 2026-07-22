import { QuantizedMeshLoader } from '@loaders.gl/terrain';
import type { BasemapMode } from './basemap';
import { localMapMetersFromLngLat } from './cityjson-map-mesh';

export const HAMBURG_TERRAIN_BASE_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/Gelaende';
export const HAMBURG_TERRAIN_VERSION = '1.1745499285499914';
export const HAMBURG_TERRAIN_MIN_MAP_ZOOM = 10;
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
  texCoords: Float32Array;
  minElevation: number;
  maxElevation: number;
}

export interface HamburgTerrainSurfaceSelection {
  basemap: BasemapMode;
  opacity: number;
}

const MAX_VIEW_TILES = 28;
const terrainTileCache = new Map<string, Promise<HamburgTerrainTile>>();
let latestTerrainTiles: HamburgTerrainTile[] = [];

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
  const containing = tiles.filter((tile) => pointInsideBounds(lngLat, tile.descriptor.bounds));
  if (containing.length === 0) return null;
  let bestElevation: number | null = null;
  let bestDistance = Infinity;

  for (const tile of containing) {
    const [east, north] = localMapMetersFromLngLat(tile.anchorLngLat, lngLat);
    const positions = tile.positions;
    const indices = tile.indices;
    for (let index = 0; index + 2 < indices.length; index += 3) {
      const a = indices[index] * 3;
      const b = indices[index + 1] * 3;
      const c = indices[index + 2] * 3;
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

    // Degenerate skirt triangles or a point directly on a quantized edge can
    // miss the barycentric test. The nearest vertex in the containing tile is
    // a safe local fallback; never borrow elevation from a non-covering tile.
    for (let index = 0; index < positions.length; index += 3) {
      const dx = positions[index] - east;
      const dy = positions[index + 1] - north;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestElevation = positions[index + 2];
      }
    }
  }
  return bestElevation;
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

export function hamburgTerrainSurfaceUrl(
  descriptor: HamburgTerrainTileDescriptor,
  basemap: BasemapMode
): string {
  const [west, south, east, north] = descriptor.bounds;
  if (basemap === 'satellite') {
    const params = new URLSearchParams({
      bbox: `${west},${south},${east},${north}`,
      bboxSR: '4326',
      imageSR: '4326',
      size: '512,512',
      format: 'png32',
      transparent: 'false',
      f: 'image',
    });
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${params}`;
  }

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: 'web',
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'false',
    CRS: 'EPSG:4326',
    // WMS 1.3 uses latitude/longitude axis order for EPSG:4326.
    BBOX: `${south},${west},${north},${east}`,
    WIDTH: '512',
    HEIGHT: '512',
  });
  return `https://sgx.geodatenzentrum.de/wms_topplus_open?${params}`;
}

/** One selected basemap owns the terrain mesh; never stack stale TopPlus below satellite. */
export function hamburgTerrainSurfaceSelection(
  basemap: BasemapMode,
  satelliteOpacity: number
): HamburgTerrainSurfaceSelection {
  return {
    basemap,
    opacity: basemap === 'satellite'
      ? Math.max(0, Math.min(1, satelliteOpacity))
      : 1,
  };
}

/**
 * Quantized-mesh V coordinates increase from south to north. Browser image
 * rows increase from north to south, so deck.gl otherwise projects every map
 * texture upside down. Return a copy because the decoder-owned array may be
 * shared by its mesh cache.
 */
export function terrainTextureCoordinates(source: Float32Array): Float32Array {
  const textureCoordinates = new Float32Array(source.length);
  for (let index = 0; index + 1 < source.length; index += 2) {
    textureCoordinates[index] = source[index];
    textureCoordinates[index + 1] = 1 - source[index + 1];
  }
  return textureCoordinates;
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
      TEXCOORD_0?: { value?: Float32Array };
    };
    indices?: { value?: Uint16Array | Uint32Array };
  };
  const sourcePositions = parsed.attributes?.POSITION?.value;
  const sourceTexCoords = parsed.attributes?.TEXCOORD_0?.value;
  const indices = parsed.indices?.value;
  if (!sourcePositions || !sourceTexCoords || !indices) {
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
    texCoords: terrainTextureCoordinates(sourceTexCoords),
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
