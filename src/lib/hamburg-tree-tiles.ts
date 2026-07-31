import type { HamburgCityTree } from './hamburg-trees';

export const HAMBURG_TREE_TILESET_URL =
  'https://daten-hamburg.de/gdi3d/datasource-data/Strassenbaumkataster_Sommerbaeume/tileset.json';

const TREE_TILE_CACHE_LIMIT = 192;
const TILE_DOWNLOAD_CONCURRENCY = 10;

type Wgs84Bbox = [number, number, number, number];

interface TilesetContent {
  uri?: string;
  url?: string;
}

interface TilesetTile {
  boundingVolume?: { region?: number[] };
  content?: TilesetContent;
  children?: TilesetTile[];
}

interface Tileset {
  root: TilesetTile;
}

export interface HamburgTreeViewportResult {
  trees: HamburgCityTree[];
  tileCount: number;
  failedTileCount: number;
}

const jsonCache = new Map<string, Promise<Tileset>>();
const treeTileCache = new Map<string, Promise<HamburgCityTree[]>>();

/**
 * Streams official Hamburg street-tree instances for one WGS84 viewport.
 * The remote hierarchy and binary tiles are cached independently so panning
 * revisits already decoded trees without retaining the entire city in memory.
 */
export async function loadHamburgTreesForBbox(
  bbox: Wgs84Bbox
): Promise<HamburgTreeViewportResult> {
  const bboxRadians = bbox.map(degreesToRadians) as Wgs84Bbox;
  const rootTileset = await fetchTileset(HAMBURG_TREE_TILESET_URL);
  const externalTilesets = collectIntersectingContentUrls(
    rootTileset.root,
    HAMBURG_TREE_TILESET_URL,
    bboxRadians,
    true
  );

  const leafUrlSets = await Promise.all(
    externalTilesets.map(async (url) => {
      const tileset = await fetchTileset(url);
      return collectHighestResolutionContentUrls(
        tileset.root,
        url,
        bboxRadians
      );
    })
  );
  const tileUrls = [...new Set(leafUrlSets.flat())];
  const settled = await mapWithConcurrency(
    tileUrls,
    TILE_DOWNLOAD_CONCURRENCY,
    async (url) => {
      try {
        return { trees: await fetchTreeTile(url), failed: false };
      } catch {
        return { trees: [] as HamburgCityTree[], failed: true };
      }
    }
  );

  const treesById = new Map<string, HamburgCityTree>();
  let failedTileCount = 0;
  for (const result of settled) {
    if (result.failed) {
      failedTileCount++;
      continue;
    }
    for (const tree of result.trees) {
      if (
        tree.position[0] >= bbox[0] &&
        tree.position[0] <= bbox[2] &&
        tree.position[1] >= bbox[1] &&
        tree.position[1] <= bbox[3]
      ) {
        treesById.set(tree.id, tree);
      }
    }
  }

  if (tileUrls.length > 0 && failedTileCount === tileUrls.length) {
    throw new Error('All official Hamburg street-tree tiles failed to load.');
  }

  return {
    trees: [...treesById.values()],
    tileCount: tileUrls.length - failedTileCount,
    failedTileCount,
  };
}

export function parseHamburgTreeTile(
  input: ArrayBuffer,
  sourceId = 'tile'
): HamburgCityTree[] {
  const bytes = new Uint8Array(input);
  return readTreeTile(bytes, 0, sourceId);
}

function fetchTileset(url: string): Promise<Tileset> {
  const cached = jsonCache.get(url);
  if (cached) return cached;
  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Tree tileset failed: HTTP ${response.status} ${url}`);
      }
      return response.json() as Promise<Tileset>;
    })
    .catch((error) => {
      jsonCache.delete(url);
      throw error;
    });
  jsonCache.set(url, request);
  return request;
}

function fetchTreeTile(url: string): Promise<HamburgCityTree[]> {
  const cached = treeTileCache.get(url);
  if (cached) {
    treeTileCache.delete(url);
    treeTileCache.set(url, cached);
    return cached;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Tree tile failed: HTTP ${response.status} ${url}`);
      }
      return parseHamburgTreeTile(await response.arrayBuffer(), url);
    })
    .catch((error) => {
      treeTileCache.delete(url);
      throw error;
    });
  treeTileCache.set(url, request);
  trimTreeTileCache();
  return request;
}

function trimTreeTileCache(): void {
  while (treeTileCache.size > TREE_TILE_CACHE_LIMIT) {
    const oldest = treeTileCache.keys().next().value;
    if (typeof oldest !== 'string') return;
    treeTileCache.delete(oldest);
  }
}

function collectIntersectingContentUrls(
  tile: TilesetTile,
  baseUrl: string,
  bboxRadians: Wgs84Bbox,
  jsonOnly: boolean
): string[] {
  const urls: string[] = [];
  visitTiles(tile, (candidate) => {
    const uri = contentUri(candidate.content);
    if (!uri || !regionIntersects(candidate.boundingVolume?.region, bboxRadians)) return;
    const url = new URL(uri, baseUrl).href;
    if (!jsonOnly || /\.json(?:$|\?)/i.test(url)) urls.push(url);
  });
  return [...new Set(urls)];
}

function collectHighestResolutionContentUrls(
  tile: TilesetTile,
  baseUrl: string,
  bboxRadians: Wgs84Bbox
): string[] {
  if (!regionIntersects(tile.boundingVolume?.region, bboxRadians)) return [];
  const children = (tile.children ?? []).filter((child) =>
    regionIntersects(child.boundingVolume?.region, bboxRadians)
  );
  if (children.length > 0) {
    return children.flatMap((child) =>
      collectHighestResolutionContentUrls(child, baseUrl, bboxRadians)
    );
  }
  const uri = contentUri(tile.content);
  return uri ? [new URL(uri, baseUrl).href] : [];
}

function contentUri(content: TilesetContent | undefined): string | null {
  return content?.uri ?? content?.url ?? null;
}

function visitTiles(tile: TilesetTile, callback: (tile: TilesetTile) => void): void {
  callback(tile);
  for (const child of tile.children ?? []) visitTiles(child, callback);
}

function regionIntersects(region: number[] | undefined, bbox: Wgs84Bbox): boolean {
  return (
    Array.isArray(region) &&
    region.length >= 4 &&
    region[0] <= bbox[2] &&
    region[2] >= bbox[0] &&
    region[1] <= bbox[3] &&
    region[3] >= bbox[1]
  );
}

function readTreeTile(
  bytes: Uint8Array,
  start: number,
  sourceId: string
): HamburgCityTree[] {
  const magic = ascii(bytes, start, 4);
  if (magic === 'i3dm') return readI3dm(bytes, start, sourceId);
  if (magic !== 'cmpt') throw new Error(`Unsupported Hamburg tree tile: ${magic}`);

  const view = dataView(bytes);
  const tilesLength = view.getUint32(start + 12, true);
  const trees: HamburgCityTree[] = [];
  let offset = start + 16;
  for (let index = 0; index < tilesLength; index++) {
    const byteLength = view.getUint32(offset + 8, true);
    if (byteLength < 12 || offset + byteLength > bytes.byteLength) {
      throw new Error('Hamburg composite tree tile has an invalid inner length.');
    }
    trees.push(...readTreeTile(bytes, offset, `${sourceId}-${index}`));
    offset += byteLength;
  }
  return trees;
}

function readI3dm(
  bytes: Uint8Array,
  start: number,
  sourceId: string
): HamburgCityTree[] {
  const view = dataView(bytes);
  const byteLength = view.getUint32(start + 8, true);
  const featureJsonLength = view.getUint32(start + 12, true);
  const featureBinaryLength = view.getUint32(start + 16, true);
  const batchJsonLength = view.getUint32(start + 20, true);
  if (byteLength < 32 || start + byteLength > bytes.byteLength) {
    throw new Error('Hamburg I3DM tree tile has an invalid length.');
  }

  let offset = start + 32;
  const featureTable = readPaddedJson(bytes, offset, featureJsonLength);
  offset += featureJsonLength;
  const featureBinary = bytes.subarray(offset, offset + featureBinaryLength);
  offset += featureBinaryLength;
  const batchTable = readPaddedJson(bytes, offset, batchJsonLength);

  const length = Number(featureTable.INSTANCES_LENGTH ?? 0);
  const attributes = Array.isArray(batchTable.attributes)
    ? batchTable.attributes
    : [];
  const ids = Array.isArray(batchTable.id) ? batchTable.id : [];
  const trees: HamburgCityTree[] = [];
  for (let index = 0; index < length; index++) {
    const batchId = readBatchId(featureTable.BATCH_ID, featureBinary, index);
    const attribute = asRecord(attributes[batchId] ?? attributes[index]) ?? {};
    const ecef = readPosition(featureTable, featureBinary, index);
    if (!ecef) continue;
    const position = ecefToWgs84(ecef);
    const height = finitePositive(attribute.Hoehe_aus_ALS, 7);
    const crownDiameter = finitePositive(
      attribute.Kronendurchmesser,
      Math.max(3, height * 0.45)
    );
    const circumferenceCm = finitePositive(attribute.Stammumfang, 60);
    trees.push({
      id: String(ids[batchId] ?? ids[index] ?? `${sourceId}-${index}`),
      position: position.map((value) => round(value, 7)) as [
        number,
        number,
        number,
      ],
      height: round(height, 1),
      crownDiameter: round(crownDiameter, 1),
      trunkRadius: round(
        clamp(circumferenceCm / 100 / (2 * Math.PI), 0.1, 0.65),
        2
      ),
      species: String(attribute.Baumart ?? ''),
      genus: String(attribute.Gattung ?? ''),
      plantingYear: Number.isFinite(Number(attribute.Pflanzjahr))
        ? Number(attribute.Pflanzjahr)
        : null,
      street: String(
        attribute['Straße'] ??
          attribute.Strasse ??
          attribute['StraÃŸe'] ??
          ''
      ),
    });
  }
  return trees;
}

function readPosition(
  table: Record<string, any>,
  binary: Uint8Array,
  index: number
): [number, number, number] | null {
  const view = dataView(binary);
  const quantized = asRecord(table.POSITION_QUANTIZED);
  if (
    quantized &&
    Array.isArray(table.QUANTIZED_VOLUME_OFFSET) &&
    Array.isArray(table.QUANTIZED_VOLUME_SCALE)
  ) {
    const offset = Number(quantized.byteOffset ?? 0) + index * 6;
    return [0, 1, 2].map(
      (axis) =>
        Number(table.QUANTIZED_VOLUME_OFFSET[axis]) +
        (view.getUint16(offset + axis * 2, true) / 65535) *
          Number(table.QUANTIZED_VOLUME_SCALE[axis])
    ) as [number, number, number];
  }
  const position = asRecord(table.POSITION);
  if (position) {
    const offset = Number(position.byteOffset ?? 0) + index * 12;
    return [0, 1, 2].map((axis) =>
      view.getFloat32(offset + axis * 4, true)
    ) as [number, number, number];
  }
  return null;
}

function readBatchId(
  definitionValue: unknown,
  binary: Uint8Array,
  index: number
): number {
  const definition = asRecord(definitionValue);
  if (!definition) return index;
  const view = dataView(binary);
  const offset = Number(definition.byteOffset ?? 0);
  const componentType = definition.componentType;
  if (componentType === 'UNSIGNED_BYTE' || componentType === 5121) {
    return view.getUint8(offset + index);
  }
  if (componentType === 'UNSIGNED_INT' || componentType === 5125) {
    return view.getUint32(offset + index * 4, true);
  }
  return view.getUint16(offset + index * 2, true);
}

function readPaddedJson(
  bytes: Uint8Array,
  offset: number,
  length: number
): Record<string, any> {
  if (!length) return {};
  const text = new TextDecoder()
    .decode(bytes.subarray(offset, offset + length))
    .replace(/\0+$/g, '')
    .trim();
  return text ? JSON.parse(text) as Record<string, any> : {};
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function ecefToWgs84([x, y, z]: [number, number, number]): [
  number,
  number,
  number,
] {
  const semiMajor = 6378137;
  const flattening = 1 / 298.257223563;
  const eccentricitySquared = flattening * (2 - flattening);
  const semiMinor = semiMajor * (1 - flattening);
  const secondEccentricitySquared =
    (semiMajor ** 2 - semiMinor ** 2) / semiMinor ** 2;
  const longitude = Math.atan2(y, x);
  const planar = Math.hypot(x, y);
  const theta = Math.atan2(semiMajor * z, semiMinor * planar);
  const latitude = Math.atan2(
    z + secondEccentricitySquared * semiMinor * Math.sin(theta) ** 3,
    planar - eccentricitySquared * semiMajor * Math.cos(theta) ** 3
  );
  const normal =
    semiMajor /
    Math.sqrt(1 - eccentricitySquared * Math.sin(latitude) ** 2);
  const elevation = planar / Math.cos(latitude) - normal;
  return [
    radiansToDegrees(longitude),
    radiansToDegrees(latitude),
    elevation,
  ];
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      async () => {
        while (cursor < values.length) {
          const index = cursor++;
          output[index] = await callback(values[index]);
        }
      }
    )
  );
  return output;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function finitePositive(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
