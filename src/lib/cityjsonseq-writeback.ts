import type { CityJsonDocument, CityJsonTransform, CityObject } from '../types';
import {
  describeCityJsonSeqTileStrict,
  normalizeCatalogBaseUrl,
  type CityJsonSeqCatalogTile,
  type CityJsonSeqLoadedTile,
} from './cityjsonseq-catalog';
import { compactVertices } from './compact';

export interface CatalogWritebackPlan {
  dirtyTileIds: Set<string>;
  featureTileIds: Map<string, string>;
  objectFeatureIds: Map<string, string>;
}

export interface CatalogWritebackResult {
  persistedTileIds: string[];
  tiles: Map<string, CityJsonSeqLoadedTile>;
}

export class CatalogWritebackError extends Error {
  readonly result: CatalogWritebackResult;

  constructor(message: string, result: CatalogWritebackResult) {
    super(message);
    this.name = 'CatalogWritebackError';
    this.result = result;
  }
}

/**
 * Rebuild edited viewport objects into their source CityJSONSeq feature lines.
 * The renderer uses one combined vertex array; write-back deliberately emits
 * each tile in its original local integer grid again.
 */
export function serializeCityJsonSeqTile(
  doc: CityJsonDocument,
  tile: CityJsonSeqLoadedTile,
  featureTileIds: ReadonlyMap<string, string>
): string {
  const header = clone(tile.header);
  header.CityObjects = {};
  header.vertices = [];
  const targetTransform = readTransform(header.transform, `${tile.catalog.id} header`);
  const sourceTransform = doc.transform;
  const templates = new Map(tile.features.map((feature) => [feature.id, feature.value]));
  const featureIds = [...featureTileIds.entries()]
    .filter(([, tileId]) => tileId === tile.catalog.id)
    .map(([featureId]) => featureId)
    .sort((left, right) => {
      const leftIndex = tile.features.findIndex((feature) => feature.id === left);
      const rightIndex = tile.features.findIndex((feature) => feature.id === right);
      if (leftIndex < 0 && rightIndex < 0) return left.localeCompare(right);
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      return leftIndex - rightIndex;
    });

  const values: Record<string, unknown>[] = [];
  const extent = emptyExtent();
  for (const featureId of featureIds) {
    if (!doc.CityObjects[featureId]) continue; // Deleted feature.
    const value = serializeFeature(
      doc,
      featureId,
      templates.get(featureId),
      sourceTransform,
      targetTransform
    );
    includeExtent(extent, value.geographicalExtent as number[]);
    values.push(value);
  }
  if (header.metadata && isObject(header.metadata) && hasFiniteExtent(extent)) {
    header.metadata = { ...header.metadata, geographicalExtent: extent };
  }
  return [header, ...values].map((value) => JSON.stringify(value)).join('\n') + '\n';
}

export function planCatalogWriteback(
  doc: CityJsonDocument,
  tiles: ReadonlyMap<string, CityJsonSeqLoadedTile>,
  dirtyObjectIds: ReadonlySet<string>
): CatalogWritebackPlan {
  const featureTileIds = new Map<string, string>();
  const objectFeatureIds = new Map<string, string>();
  for (const [tileId, tile] of tiles) {
    for (const feature of tile.features) {
      featureTileIds.set(feature.id, tileId);
      for (const objectId of feature.objectIds) objectFeatureIds.set(objectId, feature.id);
    }
  }

  // Freshly drawn, pasted, or IFC-imported roots do not have source
  // provenance yet. Assign them to the loaded tile containing their centroid.
  for (const rootId of rootObjectIds(doc)) {
    if (featureTileIds.has(rootId)) continue;
    const owner = nearestTileId(doc, rootId, tiles);
    if (owner) featureTileIds.set(rootId, owner);
  }

  for (const featureId of featureTileIds.keys()) {
    if (!doc.CityObjects[featureId]) continue;
    for (const objectId of collectFeatureObjectIds(doc, featureId)) {
      objectFeatureIds.set(objectId, featureId);
    }
  }

  const dirtyTileIds = new Set<string>();
  for (const objectId of dirtyObjectIds) {
    const featureId =
      objectFeatureIds.get(objectId) ??
      findOwningFeatureId(doc, objectId, objectFeatureIds, featureTileIds);
    const tileId = featureId ? featureTileIds.get(featureId) : undefined;
    // A freshly drawn, pasted, or imported root can be deleted before its
    // first checkpoint. It never reached a source tile, so its tombstone is a
    // no-op rather than a write-back error.
    if (!tileId && !doc.CityObjects[objectId]) continue;
    if (!tileId) {
      throw new Error(`Cannot assign edited CityObject "${objectId}" to a loaded sequence tile`);
    }
    dirtyTileIds.add(tileId);
  }
  return { dirtyTileIds, featureTileIds, objectFeatureIds };
}

export async function persistDirtyCityJsonSeqTiles(
  catalogUrl: string,
  doc: CityJsonDocument,
  tiles: ReadonlyMap<string, CityJsonSeqLoadedTile>,
  dirtyObjectIds: ReadonlySet<string>,
  fetchImpl: typeof fetch = fetch
): Promise<CatalogWritebackResult> {
  const plan = planCatalogWriteback(doc, tiles, dirtyObjectIds);
  const next = new Map(tiles);
  const baseUrl = normalizeCatalogBaseUrl(catalogUrl);
  const persistedTileIds: string[] = [];

  for (const tileId of [...plan.dirtyTileIds].sort()) {
    try {
      const tile = next.get(tileId);
      if (!tile) throw new Error(`Loaded tile "${tileId}" disappeared before write-back`);
      const text = serializeCityJsonSeqTile(doc, tile, plan.featureTileIds);
      const endpoint = new URL(`api/hamburg/tiles/${encodeURIComponent(tileId)}`, baseUrl);
      const headers: Record<string, string> = {
        'Content-Type': 'application/city+json-seq; charset=utf-8',
      };
      if (!tile.catalog.revision) {
        throw new Error(`Tile ${tileId} has no revision; reload the catalog before saving`);
      }
      headers['If-Match'] = `"${tile.catalog.revision}"`;
      const deleted = text.trim().split('\n').length === 1;
      const response = await fetchImpl(endpoint, {
        method: deleted ? 'DELETE' : 'PUT',
        headers,
        body: deleted ? undefined : text,
      });
      if (!response.ok) {
        throw new Error(`Tile ${tileId} write-back failed: HTTP ${response.status} ${await response.text()}`);
      }
      const payload = (await response.json()) as { tile?: unknown };
      if (deleted) {
        next.delete(tileId);
        persistedTileIds.push(tileId);
        continue;
      }
      const catalog = readCatalogTile(payload.tile, tile.catalog);
      next.set(tileId, describeCityJsonSeqTileStrict(text, catalog));
      persistedTileIds.push(tileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const completed =
        persistedTileIds.length > 0
          ? ` ${persistedTileIds.length} earlier tile(s) were saved and can be retried safely.`
          : '';
      throw new CatalogWritebackError(`${message}${completed}`, {
        persistedTileIds: [...persistedTileIds],
        tiles: next,
      });
    }
  }
  return { persistedTileIds, tiles: next };
}

/**
 * Remove clean source tiles outside the current viewport. Dirty tile IDs are
 * retained so map panning never discards an unsaved edit.
 */
export function evictCleanCityJsonSeqTiles(
  doc: CityJsonDocument,
  tiles: ReadonlyMap<string, CityJsonSeqLoadedTile>,
  retainedTileIds: ReadonlySet<string>,
  dirtyObjectIds: ReadonlySet<string>
): { evictedTileIds: string[]; tiles: Map<string, CityJsonSeqLoadedTile> } {
  const plan = planCatalogWriteback(doc, tiles, dirtyObjectIds);
  const evictedTileIds = [...tiles.keys()].filter(
    (tileId) => !retainedTileIds.has(tileId) && !plan.dirtyTileIds.has(tileId)
  );
  if (evictedTileIds.length === 0) return { evictedTileIds, tiles: new Map(tiles) };

  const evicted = new Set(evictedTileIds);
  for (const [objectId, featureId] of plan.objectFeatureIds) {
    const tileId = plan.featureTileIds.get(featureId);
    if (tileId && evicted.has(tileId)) delete doc.CityObjects[objectId];
  }
  compactVertices(doc);
  const next = new Map(tiles);
  for (const tileId of evictedTileIds) next.delete(tileId);
  return { evictedTileIds, tiles: next };
}

function serializeFeature(
  doc: CityJsonDocument,
  featureId: string,
  template: Record<string, unknown> | undefined,
  sourceTransform: CityJsonDocument['transform'],
  targetTransform: CityJsonTransform
): Record<string, unknown> {
  const ids = collectFeatureObjectIds(doc, featureId);
  const objects: Record<string, CityObject> = {};
  const used = new Set<number>();
  for (const id of ids) {
    const object = clone(doc.CityObjects[id]);
    objects[id] = object;
    for (const geometry of (object.geometry ?? []) as { boundaries?: unknown }[]) {
      collectIndices(geometry.boundaries, used, doc.vertices.length, id);
    }
  }
  const indices = [...used].sort((left, right) => left - right);
  const localIndex = new Map(indices.map((index, next) => [index, next]));
  for (const object of Object.values(objects)) {
    for (const geometry of (object.geometry ?? []) as { boundaries?: unknown }[]) {
      geometry.boundaries = remapIndices(geometry.boundaries, localIndex);
    }
  }
  const vertices = indices.map((index) =>
    reencodeVertex(doc.vertices[index], sourceTransform, targetTransform)
  );
  const geographicalExtent = vertexExtent(vertices, targetTransform);
  return {
    ...(template ? clone(template) : {}),
    type: 'CityJSONFeature',
    id: featureId,
    CityObjects: objects,
    vertices,
    geographicalExtent,
  };
}

function collectFeatureObjectIds(doc: CityJsonDocument, featureId: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [featureId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const object = doc.CityObjects[id];
    if (!object) continue;
    ids.push(id);
    for (const child of object.children ?? []) queue.push(child);
  }
  return ids;
}

function findOwningFeatureId(
  doc: CityJsonDocument,
  objectId: string,
  objectFeatureIds: ReadonlyMap<string, string>,
  featureTileIds: ReadonlyMap<string, string>
): string | undefined {
  const seen = new Set<string>();
  const queue = [objectId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const known = objectFeatureIds.get(id);
    if (known) return known;
    if (featureTileIds.has(id)) return id;
    for (const parent of doc.CityObjects[id]?.parents ?? []) queue.push(parent);
  }
  return undefined;
}

function rootObjectIds(doc: CityJsonDocument): string[] {
  return Object.entries(doc.CityObjects)
    .filter(([, object]) => !object.parents || object.parents.length === 0)
    .map(([id]) => id);
}

function nearestTileId(
  doc: CityJsonDocument,
  rootId: string,
  tiles: ReadonlyMap<string, CityJsonSeqLoadedTile>
): string | undefined {
  const extent = objectGraphExtent(doc, rootId);
  if (!extent) return tiles.keys().next().value;
  const x = (extent[0] + extent[3]) / 2;
  const y = (extent[1] + extent[4]) / 2;
  let best: { id: string; distance: number } | undefined;
  for (const [id, tile] of tiles) {
    const [minX, minY, , maxX, maxY] = tile.catalog.extent;
    const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
    const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
    const distance = dx * dx + dy * dy;
    if (!best || distance < best.distance) best = { id, distance };
  }
  return best?.id;
}

function objectGraphExtent(doc: CityJsonDocument, rootId: string): number[] | null {
  const extent = emptyExtent();
  for (const id of collectFeatureObjectIds(doc, rootId)) {
    for (const geometry of (doc.CityObjects[id].geometry ?? []) as { boundaries?: unknown }[]) {
      collectIndices(geometry.boundaries, new Set(), doc.vertices.length, id, (index) => {
        includeVertex(extent, decodeVertex(doc.vertices[index], doc.transform));
      });
    }
  }
  return hasFiniteExtent(extent) ? extent : null;
}

function collectIndices(
  node: unknown,
  out: Set<number>,
  vertexCount: number,
  objectId: string,
  visit?: (index: number) => void
): void {
  if (typeof node === 'number') {
    if (!Number.isInteger(node) || node < 0 || node >= vertexCount) {
      throw new Error(`CityObject "${objectId}" references invalid vertex ${node}`);
    }
    out.add(node);
    visit?.(node);
  } else if (Array.isArray(node)) {
    for (const child of node) collectIndices(child, out, vertexCount, objectId, visit);
  }
}

function remapIndices(node: unknown, indices: ReadonlyMap<number, number>): unknown {
  if (typeof node === 'number') {
    const mapped = indices.get(node);
    if (mapped === undefined) throw new Error(`Missing local vertex mapping for ${node}`);
    return mapped;
  }
  return Array.isArray(node) ? node.map((child) => remapIndices(child, indices)) : node;
}

function reencodeVertex(
  vertex: [number, number, number],
  source: CityJsonDocument['transform'],
  target: CityJsonTransform
): [number, number, number] {
  const decoded = decodeVertex(vertex, source);
  return decoded.map((value, axis) => {
    const raw = (value - target.translate[axis]) / target.scale[axis];
    const rounded = Math.round(raw);
    if (!Number.isFinite(raw) || Math.abs(raw - rounded) > 1e-5) {
      throw new Error('Edited coordinates cannot be represented exactly on the source tile grid');
    }
    return rounded;
  }) as [number, number, number];
}

function decodeVertex(
  vertex: [number, number, number],
  transform: CityJsonDocument['transform']
): [number, number, number] {
  if (!transform) return [...vertex];
  return vertex.map(
    (value, axis) => value * transform.scale[axis] + transform.translate[axis]
  ) as [number, number, number];
}

function readTransform(value: unknown, label: string): CityJsonTransform {
  if (
    !isObject(value) ||
    !isTriple(value.scale) ||
    !value.scale.every((item) => item !== 0) ||
    !isTriple(value.translate)
  ) {
    throw new Error(`${label} requires a finite non-zero transform`);
  }
  return value as unknown as CityJsonTransform;
}

function vertexExtent(vertices: [number, number, number][], transform: CityJsonTransform): number[] {
  const extent = emptyExtent();
  for (const vertex of vertices) includeVertex(extent, decodeVertex(vertex, transform));
  return extent;
}

function emptyExtent(): number[] {
  return [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
}

function includeExtent(target: number[], source: number[]): void {
  if (!Array.isArray(source) || source.length < 6) return;
  for (let axis = 0; axis < 3; axis++) {
    if (source[axis] < target[axis]) target[axis] = source[axis];
    if (source[axis + 3] > target[axis + 3]) target[axis + 3] = source[axis + 3];
  }
}

function includeVertex(extent: number[], vertex: [number, number, number]): void {
  for (let axis = 0; axis < 3; axis++) {
    if (vertex[axis] < extent[axis]) extent[axis] = vertex[axis];
    if (vertex[axis] > extent[axis + 3]) extent[axis + 3] = vertex[axis];
  }
}

function hasFiniteExtent(extent: number[]): boolean {
  return extent.length >= 6 && extent.every(Number.isFinite);
}

function readCatalogTile(value: unknown, fallback: CityJsonSeqCatalogTile): CityJsonSeqCatalogTile {
  if (!isObject(value) || value.id !== fallback.id) {
    throw new Error(`Tile ${fallback.id} write-back returned an invalid catalog entry`);
  }
  return {
    ...fallback,
    ...value,
    id: fallback.id,
    file: typeof value.file === 'string' ? value.file : fallback.file,
    url: typeof value.url === 'string' ? value.url : fallback.url,
    revision: typeof value.revision === 'string' ? value.revision : fallback.revision,
    extent: isExtent(value.extent) ? value.extent : fallback.extent,
    features: numeric(value.features, fallback.features),
    cityObjects: numeric(value.cityObjects, fallback.cityObjects),
    vertices: numeric(value.vertices, fallback.vertices),
    syntheticRootsAdded: numeric(value.syntheticRootsAdded, fallback.syntheticRootsAdded),
  };
}

function numeric(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isExtent(value: unknown): value is [number, number, number, number, number, number] {
  return Array.isArray(value) && value.length === 6 && value.every(Number.isFinite);
}

function isTriple(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
