import proj4 from 'proj4';
import type { CityJsonDocument } from '../types';
import {
  appendCityJsonSeqFeature,
  createCityJsonSeqDocument,
  type CityJsonSeqFeatureValue,
} from './cityjson';
import { checkIntegrity } from './integrity';
import { mergeCityJson } from './merge';
import './projection';

export type Bbox = [number, number, number, number];

export const DEFAULT_HAMBURG_CATALOG_URL = 'http://127.0.0.1:8787';
export const DEFAULT_HAMBURG_VIEWPORT_BBOX: Bbox = [565000, 5936000, 566000, 5937000];
export const MAX_CATALOG_TILES_PER_VIEWPORT = 25;
const CATALOG_TILE_FETCH_CONCURRENCY = 4;

export interface CityJsonSeqCatalogTile {
  id: string;
  file: string;
  url: string;
  revision?: string;
  extent: [number, number, number, number, number, number];
  features: number;
  cityObjects: number;
  vertices: number;
  syntheticRootsAdded: number;
}

export interface CityJsonSeqFeatureTemplate {
  id: string;
  objectIds: string[];
  value: Record<string, unknown>;
}

export interface CityJsonSeqLoadedTile {
  catalog: CityJsonSeqCatalogTile;
  header: Record<string, unknown>;
  features: CityJsonSeqFeatureTemplate[];
}

interface CityJsonSeqTileQuery {
  crs: string;
  count: number;
  tiles: CityJsonSeqCatalogTile[];
}

export interface CityJsonSeqViewportLoad {
  doc: CityJsonDocument | null;
  crs: string;
  queriedTileCount: number;
  intersectingTileIds: string[];
  tileIds: string[];
  tiles: CityJsonSeqLoadedTile[];
  features: number;
}

export async function fetchCityJsonSeqViewport(
  catalogUrl: string,
  bbox: Bbox,
  loadedTileIds: ReadonlySet<string> = new Set(),
  fetchImpl: typeof fetch = fetch,
  maxTiles = MAX_CATALOG_TILES_PER_VIEWPORT
): Promise<CityJsonSeqViewportLoad> {
  const baseUrl = normalizeCatalogBaseUrl(catalogUrl);
  const queryUrl = new URL('api/hamburg/tiles', baseUrl);
  queryUrl.searchParams.set('bbox', bbox.join(','));
  const response = await fetchImpl(queryUrl);
  if (!response.ok) {
    throw new Error(`Catalog query failed: HTTP ${response.status} ${response.statusText}`);
  }
  const query = validateTileQuery(await response.json());
  return fetchCityJsonSeqTiles(baseUrl, query, loadedTileIds, fetchImpl, maxTiles, (count) =>
    `Viewport matches ${count} unloaded tiles. Zoom in before loading ` +
    `(maximum ${maxTiles} tiles per request).`
  );
}

export async function fetchCityJsonSeqCatalog(
  catalogUrl: string,
  loadedTileIds: ReadonlySet<string> = new Set(),
  fetchImpl: typeof fetch = fetch,
  maxTiles = Infinity
): Promise<CityJsonSeqViewportLoad> {
  const baseUrl = normalizeCatalogBaseUrl(catalogUrl);
  const queryUrl = new URL('api/hamburg/tiles', baseUrl);
  const response = await fetchImpl(queryUrl);
  if (!response.ok) {
    throw new Error(`Catalog query failed: HTTP ${response.status} ${response.statusText}`);
  }
  const query = validateTileQuery(await response.json());
  return fetchCityJsonSeqTiles(baseUrl, query, loadedTileIds, fetchImpl, maxTiles, (count) =>
    `Catalog contains ${count} unloaded tiles. Increase the startup tile limit or use viewport loading.`
  );
}

async function fetchCityJsonSeqTiles(
  baseUrl: URL,
  query: CityJsonSeqTileQuery,
  loadedTileIds: ReadonlySet<string>,
  fetchImpl: typeof fetch,
  maxTiles: number,
  tooManyMessage: (count: number) => string
): Promise<CityJsonSeqViewportLoad> {
  const tiles = query.tiles.filter((tile) => !loadedTileIds.has(tile.id));
  if (tiles.length > maxTiles) {
    throw new Error(tooManyMessage(tiles.length));
  }

  const fetched: Array<{ doc: CityJsonDocument; tile: CityJsonSeqLoadedTile }> = [];
  for (let index = 0; index < tiles.length; index += CATALOG_TILE_FETCH_CONCURRENCY) {
    const batch = tiles.slice(index, index + CATALOG_TILE_FETCH_CONCURRENCY);
    fetched.push(
      ...(await Promise.all(
        batch.map(async (tile) => {
          const tileResponse = await fetchImpl(new URL(tile.url, baseUrl));
          if (!tileResponse.ok) {
            throw new Error(`Tile ${tile.id} failed: HTTP ${tileResponse.status} ${tileResponse.statusText}`);
          }
          const text = await tileResponse.text();
          return parseCityJsonSeqTileStrict(text, tile);
        })
      ))
    );
    if (index + CATALOG_TILE_FETCH_CONCURRENCY < tiles.length) {
      await yieldToBrowser();
    }
  }

  const docs = fetched.map(({ doc }) => doc);
  const doc = docs.shift() ?? null;
  if (doc) {
    for (const [index, incoming] of docs.entries()) {
      const merged = mergeCityJson(doc, incoming);
      if (!merged.ok) {
        throw new Error(`Could not merge catalog tile: ${merged.reason}`);
      }
      if (index % 8 === 7) {
        await yieldToBrowser();
      }
    }
  }
  return {
    doc,
    crs: query.crs,
    queriedTileCount: query.count,
    intersectingTileIds: query.tiles.map((tile) => tile.id),
    tileIds: tiles.map((tile) => tile.id),
    tiles: fetched.map(({ tile }) => tile),
    features: tiles.reduce((sum, tile) => sum + tile.features, 0),
  };
}

export function projectWgs84BboxToCrs(bbox: Bbox, crs: string): Bbox {
  const [west, south, east, north] = bbox;
  const corners: [number, number][] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const [x, y] = proj4('EPSG:4326', crs, corner) as [number, number];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    throw new Error(`Could not project viewport into ${crs}`);
  }
  return [minX, minY, maxX, maxY];
}

export function parseCityJsonSeqStrict(text: string, name = 'CityJSONSeq input'): CityJsonDocument {
  return parseCityJsonSeqStrictValues(text, name).doc;
}

export function describeCityJsonSeqTileStrict(
  text: string,
  catalog: CityJsonSeqCatalogTile
): CityJsonSeqLoadedTile {
  const parsed = parseCityJsonSeqStrictValues(text, catalog.file);
  return { catalog, header: parsed.header, features: parsed.features };
}

function parseCityJsonSeqTileStrict(
  text: string,
  catalog: CityJsonSeqCatalogTile
): { doc: CityJsonDocument; tile: CityJsonSeqLoadedTile } {
  const parsed = parseCityJsonSeqStrictValues(text, catalog.file);
  return {
    doc: parsed.doc,
    tile: { catalog, header: parsed.header, features: parsed.features },
  };
}

function parseCityJsonSeqStrictValues(
  text: string,
  name: string
): {
  doc: CityJsonDocument;
  header: Record<string, unknown>;
  features: CityJsonSeqFeatureTemplate[];
} {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error(`${name}: expected a header and at least one feature`);
  const header = parseStrictJsonLine(lines[0], name, 1);
  if (!isObject(header) || header.type !== 'CityJSON') {
    throw new Error(`${name}:1: expected CityJSON`);
  }
  const doc = createCityJsonSeqDocument(header as unknown as CityJsonDocument);
  const features: CityJsonSeqFeatureTemplate[] = [];

  for (let index = 1; index < lines.length; index++) {
    const value = parseStrictJsonLine(lines[index], name, index + 1);
    if (
      !isObject(value) ||
      value.type !== 'CityJSONFeature' ||
      typeof value.id !== 'string' ||
      !isObject(value.CityObjects)
    ) {
      throw new Error(`${name}:${index + 1}: expected CityJSONFeature`);
    }
    features.push({
      id: value.id,
      objectIds: Object.keys(value.CityObjects),
      value,
    });
    if (!appendCityJsonSeqFeature(doc, value as unknown as CityJsonSeqFeatureValue)) {
      throw new Error(`${name}:${index + 1}: could not append CityJSONFeature`);
    }
  }

  const integrity = checkIntegrity(doc);
  if (!integrity.ok) {
    const first = integrity.issues.find((issue) => issue.severity === 'error');
    throw new Error(`${name}: structural integrity failed: ${first?.message ?? 'unknown error'}`);
  }

  return { doc, header, features };
}

function parseStrictJsonLine(line: string, name: string, lineNumber: number): Record<string, unknown> {
  try {
    const value = JSON.parse(line) as unknown;
    if (!isObject(value)) {
      throw new Error('line is not a JSON object');
    }
    return value;
  } catch (error) {
    throw new Error(
      `${name}:${lineNumber}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function normalizeCatalogBaseUrl(value: string): URL {
  const url = new URL(value.trim());
  url.pathname = url.pathname.replace(/\/api\/hamburg\/(?:catalog|tiles)\/?$/, '/');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = '';
  return url;
}

function validateTileQuery(value: unknown): CityJsonSeqTileQuery {
  if (!isObject(value) || typeof value.crs !== 'string' || !Array.isArray(value.tiles)) {
    throw new Error('Catalog query returned an invalid response');
  }
  const tiles = value.tiles.map((tile, index) => validateTile(tile, index));
  return {
    crs: value.crs,
    count: typeof value.count === 'number' ? value.count : tiles.length,
    tiles,
  };
}

function validateTile(value: unknown, index: number): CityJsonSeqCatalogTile {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.file !== 'string' ||
    typeof value.url !== 'string' ||
    !Array.isArray(value.extent) ||
    value.extent.length !== 6 ||
    !value.extent.every(Number.isFinite)
  ) {
    throw new Error(`Catalog query returned an invalid tile at index ${index}`);
  }
  return {
    id: value.id,
    file: value.file,
    url: value.url,
    revision: typeof value.revision === 'string' ? value.revision : undefined,
    extent: value.extent as CityJsonSeqCatalogTile['extent'],
    features: numeric(value.features),
    cityObjects: numeric(value.cityObjects),
    vertices: numeric(value.vertices),
    syntheticRootsAdded: numeric(value.syntheticRootsAdded),
  };
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
