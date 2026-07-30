import type { CityJsonDocument } from '../types';
import {
  appendCityJsonSeqFeature,
  createCityJsonSeqDocument,
  type CityJsonSeqFeatureValue,
} from './cityjson';
import { checkIntegrity } from './integrity';
import { mergeCityJson } from './merge';
import { projectWgs84BboxToCrs as projectWgs84BboxToCrsBase } from './projection';

export type Bbox = [number, number, number, number];

export const DEFAULT_HAMBURG_CATALOG_URL = 'http://127.0.0.1:8787';
export const DEFAULT_HAMBURG_VIEWPORT_BBOX: Bbox = [565000, 5936000, 566000, 5937000];
export const HAMBURG_ROAD_CATALOG_TYPE =
  'HamburgOsm2StreetsRoadCityJSONSeqCatalog';
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
  dependencies?: string[];
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
  catalogType?: string;
  readOnly?: boolean;
}

export interface CityJsonSeqViewportLoad {
  doc: CityJsonDocument | null;
  crs: string;
  queriedTileCount: number;
  intersectingTileIds: string[];
  tileIds: string[];
  tiles: CityJsonSeqLoadedTile[];
  features: number;
  catalogType?: string;
  readOnly?: boolean;
}

interface StaticCityJsonSeqCatalog {
  type?: string;
  crs: string;
  tiles: CityJsonSeqCatalogTile[];
  tileSizeMeters?: number;
}

const staticCatalogCache = new Map<string, Promise<StaticCityJsonSeqCatalog>>();

export async function fetchCityJsonSeqViewport(
  catalogUrl: string,
  bbox: Bbox,
  loadedTileIds: ReadonlySet<string> = new Set(),
  fetchImpl: typeof fetch = fetch,
  maxTiles = MAX_CATALOG_TILES_PER_VIEWPORT
): Promise<CityJsonSeqViewportLoad> {
  const { baseUrl, query } = await queryCatalogTiles(
    catalogUrl,
    bbox,
    fetchImpl,
    maxTiles
  );
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
  const { baseUrl, query } = await queryCatalogTiles(catalogUrl, null, fetchImpl);
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
          const text = await readTileResponseText(tileResponse, tile);
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
    catalogType: query.catalogType,
    readOnly: query.readOnly,
  };
}

export function projectWgs84BboxToCrs(bbox: Bbox, crs: string): Bbox {
  return projectWgs84BboxToCrsBase(bbox, crs);
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
  const url = resolveCatalogUrl(value);
  if (isStaticCatalogUrl(url)) {
    url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    url.search = '';
    url.hash = '';
    return url;
  }
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
    catalogType: typeof value.catalogType === 'string' ? value.catalogType : undefined,
    readOnly: value.readOnly === true,
  };
}

async function queryCatalogTiles(
  catalogUrl: string,
  bbox: Bbox | null,
  fetchImpl: typeof fetch,
  maxTiles = Infinity
): Promise<{ baseUrl: URL; query: CityJsonSeqTileQuery }> {
  const resolvedUrl = resolveCatalogUrl(catalogUrl);
  if (isStaticCatalogUrl(resolvedUrl)) {
    const catalog = await fetchStaticCatalog(resolvedUrl, fetchImpl);
    const tiles = bbox
      ? selectStaticCatalogViewportTiles(catalog, bbox, maxTiles)
      : catalog.tiles;
    return {
      baseUrl: new URL('.', resolvedUrl),
      query: {
        crs: catalog.crs,
        count: tiles.length,
        tiles,
        catalogType: catalog.type,
        readOnly: true,
      },
    };
  }

  const baseUrl = normalizeCatalogBaseUrl(catalogUrl);
  const queryUrl = new URL('api/hamburg/tiles', baseUrl);
  if (bbox) queryUrl.searchParams.set('bbox', bbox.join(','));
  const response = await fetchImpl(queryUrl);
  if (!response.ok) {
    throw new Error(`Catalog query failed: HTTP ${response.status} ${response.statusText}`);
  }
  return { baseUrl, query: validateTileQuery(await response.json()) };
}

async function fetchStaticCatalog(
  url: URL,
  fetchImpl: typeof fetch
): Promise<StaticCityJsonSeqCatalog> {
  const key = url.toString();
  const load = async () => {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Static catalog failed: HTTP ${response.status} ${response.statusText}`);
    }
    const value = await response.json();
    if (!isObject(value) || typeof value.crs !== 'string' || !Array.isArray(value.tiles)) {
      throw new Error('Static catalog returned an invalid response');
    }
    return {
      type: typeof value.type === 'string' ? value.type : undefined,
      crs: value.crs,
      tiles: value.tiles.map((tile, index) => validateTile(tile, index)),
      tileSizeMeters: staticCatalogTileSizeMeters(value),
    };
  };

  // The production catalog is immutable for the lifetime of the page. Custom
  // fetch functions are primarily tests and should not share cache state.
  if (fetchImpl !== fetch) return load();
  const cached = staticCatalogCache.get(key);
  if (cached) return cached;
  const pending = load().catch((error) => {
    staticCatalogCache.delete(key);
    throw error;
  });
  staticCatalogCache.set(key, pending);
  return pending;
}

async function readTileResponseText(
  response: Response,
  tile: CityJsonSeqCatalogTile
): Promise<string> {
  if (!/\.gz(?:$|[?#])/i.test(tile.url)) return response.text();
  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    // Some CDNs transparently decode gzip while retaining the source suffix.
    return new TextDecoder().decode(bytes);
  }
  if (typeof DecompressionStream !== 'function') {
    throw new Error(`Tile ${tile.id} is gzip-compressed, but this browser cannot decompress it`);
  }
  const compressedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const stream = compressedStream.pipeThrough(
    new DecompressionStream('gzip') as unknown as TransformStream<
      Uint8Array,
      Uint8Array
    >
  );
  return new Response(stream).text();
}

function resolveCatalogUrl(value: string): URL {
  const fallbackBase =
    typeof document !== 'undefined' && document.baseURI
      ? document.baseURI
      : 'http://127.0.0.1/';
  return new URL(value.trim(), fallbackBase);
}

function isStaticCatalogUrl(url: URL): boolean {
  return /\.json$/i.test(url.pathname);
}

function tileIntersectsBbox(
  extent: CityJsonSeqCatalogTile['extent'],
  bbox: Bbox
): boolean {
  const [minX, minY, , maxX, maxY] = extent;
  return !(maxX < bbox[0] || minX > bbox[2] || maxY < bbox[1] || minY > bbox[3]);
}

function selectStaticCatalogViewportTiles(
  catalog: StaticCityJsonSeqCatalog,
  bbox: Bbox,
  maxTiles: number
): CityJsonSeqCatalogTile[] {
  const visible = catalog.tiles.filter((tile) => tileIntersectsBbox(tile.extent, bbox));
  if (
    catalog.type !== HAMBURG_ROAD_CATALOG_TYPE ||
    !catalog.tileSizeMeters ||
    catalog.tileSizeMeters <= 0
  ) {
    return visible;
  }

  const tileCap = Number.isFinite(maxTiles)
    ? Math.max(0, Math.floor(maxTiles))
    : Infinity;
  if (visible.length >= tileCap) return visible;

  const selectedIds = new Set(visible.map((tile) => tile.id));
  const tileById = new Map(catalog.tiles.map((tile) => [tile.id, tile]));
  const dependencies = visible
    .flatMap((tile) => tile.dependencies ?? [])
    .filter((id, index, ids) => !selectedIds.has(id) && ids.indexOf(id) === index)
    .map((id) => tileById.get(id))
    .filter((tile): tile is CityJsonSeqCatalogTile => !!tile)
    .sort((left, right) => {
      const distance =
        tileDistanceToBboxSquared(left.extent, bbox) -
        tileDistanceToBboxSquared(right.extent, bbox);
      return distance || left.id.localeCompare(right.id);
    });
  const dependencyCapacity = Number.isFinite(tileCap)
    ? Math.max(0, tileCap - visible.length)
    : dependencies.length;
  const selectedDependencies = dependencies.slice(0, dependencyCapacity);
  for (const dependency of selectedDependencies) selectedIds.add(dependency.id);

  const haloBbox: Bbox = [
    bbox[0] - catalog.tileSizeMeters,
    bbox[1] - catalog.tileSizeMeters,
    bbox[2] + catalog.tileSizeMeters,
    bbox[3] + catalog.tileSizeMeters,
  ];
  const halo = catalog.tiles
    .filter(
      (tile) =>
        !selectedIds.has(tile.id) &&
        tileIntersectsBbox(tile.extent, haloBbox)
    )
    .sort((left, right) => {
      const distance =
        tileDistanceToBboxSquared(left.extent, bbox) -
        tileDistanceToBboxSquared(right.extent, bbox);
      return distance || left.id.localeCompare(right.id);
    });
  const remaining = Number.isFinite(tileCap)
    ? Math.max(0, tileCap - visible.length - selectedDependencies.length)
    : halo.length;
  return [...visible, ...selectedDependencies, ...halo.slice(0, remaining)];
}

function tileDistanceToBboxSquared(
  extent: CityJsonSeqCatalogTile['extent'],
  bbox: Bbox
): number {
  const dx =
    extent[3] < bbox[0]
      ? bbox[0] - extent[3]
      : extent[0] > bbox[2]
        ? extent[0] - bbox[2]
        : 0;
  const dy =
    extent[4] < bbox[1]
      ? bbox[1] - extent[4]
      : extent[1] > bbox[3]
        ? extent[1] - bbox[3]
        : 0;
  return dx * dx + dy * dy;
}

function staticCatalogTileSizeMeters(
  value: Record<string, unknown>
): number | undefined {
  const packaging = isObject(value.packaging) ? value.packaging : null;
  const cellSizeMeters = packaging?.cellSizeMeters;
  return typeof cellSizeMeters === 'number' &&
    Number.isFinite(cellSizeMeters) &&
    cellSizeMeters > 0
    ? cellSizeMeters
    : undefined;
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
    dependencies: Array.isArray(value.dependencies)
      ? value.dependencies.filter(
          (dependency): dependency is string => typeof dependency === 'string'
        )
      : undefined,
  };
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
