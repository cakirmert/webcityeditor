import type { CityJsonDocument, CityObject } from '../types';

/**
 * Geometric transforms on an existing building (+ its BuildingPart children).
 *
 * Implementation strategy: every transform creates NEW vertices in the document's
 * vertex array at the transformed positions, and rewrites the building's geometry
 * boundaries to reference those new indices. The old vertices are left in place
 * (orphaned, but harmless). This keeps the transform safe even when the original
 * vertices are shared with unrelated buildings — we never rewrite a vertex that
 * some other object might depend on.
 */

export interface TransformResult {
  /** Building id that was transformed (same as input). */
  buildingId: string;
  /** How many vertex entries the doc grew by. */
  verticesAdded: number;
  /** How many CityObjects had their geometry rewritten. */
  objectsUpdated: number;
}

/** Translate a building by (dx, dy, dz) in CRS meters. */
export function moveBuilding(
  doc: CityJsonDocument,
  buildingId: string,
  dx: number,
  dy: number,
  dz = 0
): TransformResult {
  assertFiniteTransform([dx, dy, dz]);
  return rewriteVertices(doc, buildingId, ([x, y, z]) => [x + dx, y + dy, z + dz]);
}

/**
 * Rotate a building around its footprint centroid (in the XY plane) by
 * `angleDegrees`. Positive angles rotate counter-clockwise (standard
 * mathematical convention; MapLibre bearings are clockwise but this API stays
 * standard — the UI can negate if needed).
 */
export function rotateBuilding(
  doc: CityJsonDocument,
  buildingId: string,
  angleDegrees: number
): TransformResult {
  assertFiniteTransform([angleDegrees]);
  const centroid = computeBuildingCentroid(doc, buildingId);
  if (!centroid) throw new Error('Could not compute building centroid for rotation');
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [cx, cy] = centroid;

  return rewriteVertices(doc, buildingId, ([x, y, z]) => {
    const rx = x - cx;
    const ry = y - cy;
    return [cx + rx * cos - ry * sin, cy + rx * sin + ry * cos, z];
  });
}

// ---------- helpers ----------

/**
 * Walk a Building's own geometry + every BuildingPart child's geometry, collect
 * every unique vertex index referenced, and produce a (newIdx − oldIdx) mapping
 * after transforming each into a fresh entry in doc.vertices.
 *
 * Then rewrite boundaries to point at the new indices.
 */
function rewriteVertices(
  doc: CityJsonDocument,
  buildingId: string,
  transformMeters: (coord: [number, number, number]) => [number, number, number]
): TransformResult {
  const obj = doc.CityObjects[buildingId];
  if (!obj) throw new Error(`Building ${buildingId} not found`);

  const objectsToRewrite = collectGeometryHolders(doc, obj);

  // 1. Collect the unique set of vertex indices referenced by these objects
  const referenced = new Set<number>();
  for (const o of objectsToRewrite) visitBoundaries(o, (idx) => referenced.add(idx));

  if (referenced.size === 0) {
    return { buildingId, verticesAdded: 0, objectsUpdated: 0 };
  }

  // 2. Create new vertex entries at transformed positions, remember the mapping
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  assertUsableTransform(t);
  const decode = (raw: [number, number, number]): [number, number, number] => [
    raw[0] * t.scale[0] + t.translate[0],
    raw[1] * t.scale[1] + t.translate[1],
    raw[2] * t.scale[2] + t.translate[2],
  ];
  const encode = doc.transform
    ? (real: [number, number, number]): [number, number, number] => [
        Math.round((real[0] - t.translate[0]) / t.scale[0]),
        Math.round((real[1] - t.translate[1]) / t.scale[1]),
        Math.round((real[2] - t.translate[2]) / t.scale[2]),
      ]
    : (real: [number, number, number]): [number, number, number] => [...real];

  const oldToNew = new Map<number, number>();
  for (const oldIdx of referenced) {
    const raw = doc.vertices[oldIdx];
    if (!raw) continue;
    const realCoord = decode(raw as [number, number, number]);
    const transformed = transformMeters(realCoord);
    const newRaw = encode(transformed);
    const newIdx = doc.vertices.length;
    doc.vertices.push(newRaw);
    oldToNew.set(oldIdx, newIdx);
  }

  // 3. Rewrite every boundary in every affected object
  let objectsUpdated = 0;
  for (const o of objectsToRewrite) {
    const changed = rewriteObjectBoundaries(o, oldToNew);
    if (changed) objectsUpdated++;
  }
  refreshStoredExtents(doc, objectsToRewrite);

  return {
    buildingId,
    verticesAdded: oldToNew.size,
    objectsUpdated,
  };
}

/** Collect the selected object and every descendant geometry holder. */
function collectGeometryHolders(
  doc: CityJsonDocument,
  obj: CityObject
): CityObject[] {
  const out: CityObject[] = [obj];
  for (const cid of obj.children ?? []) {
    const child = doc.CityObjects[cid];
    if (child) {
      out.push(...collectGeometryHolders(doc, child));
    }
  }
  return out;
}

/** Depth-first walk of a CityObject's geometry boundaries, emitting each leaf vertex index. */
function visitBoundaries(obj: CityObject, emit: (idx: number) => void): void {
  if (!obj.geometry) return;
  for (const g of obj.geometry as unknown as Array<{ boundaries?: unknown }>) {
    walk(g.boundaries);
  }
  function walk(node: unknown) {
    if (!Array.isArray(node)) return;
    for (const item of node) {
      if (typeof item === 'number') emit(item);
      else walk(item);
    }
  }
}

/** Rewrite the boundaries in place, replacing old vertex indices with new ones via the map. */
function rewriteObjectBoundaries(
  obj: CityObject,
  mapping: Map<number, number>
): boolean {
  if (!obj.geometry) return false;
  let any = false;
  for (const g of obj.geometry as unknown as Array<{ boundaries?: unknown }>) {
    if (g.boundaries) {
      g.boundaries = rewriteNode(g.boundaries);
    }
  }
  return any;

  function rewriteNode(node: unknown): unknown {
    if (!Array.isArray(node)) return node;
    return node.map((item) => {
      if (typeof item === 'number') {
        const replacement = mapping.get(item);
        if (replacement != null && replacement !== item) {
          any = true;
          return replacement;
        }
        return item;
      }
      return rewriteNode(item);
    });
  }
}

/**
 * Compute a building's centroid in CRS metres. Uses the footprint's bounding
 * box centre via the full vertex set — simple and stable for rotation.
 */
function computeBuildingCentroid(
  doc: CityJsonDocument,
  buildingId: string
): [number, number] | null {
  const obj = doc.CityObjects[buildingId];
  if (!obj) return null;
  const referenced = new Set<number>();
  const visit = (o: CityObject) => visitBoundaries(o, (i) => referenced.add(i));
  for (const holder of collectGeometryHolders(doc, obj)) visit(holder);
  if (referenced.size === 0) return null;
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const idx of referenced) {
    const v = doc.vertices[idx];
    if (!v) continue;
    const x = v[0] * t.scale[0] + t.translate[0];
    const y = v[1] * t.scale[1] + t.translate[1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return null;
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function assertFiniteTransform(values: number[]): void {
  if (!values.every(Number.isFinite)) {
    throw new Error('Transform values must be finite numbers');
  }
}

function assertUsableTransform(t: {
  scale: [number, number, number];
  translate: [number, number, number];
}): void {
  if (
    !t.scale.every((v) => Number.isFinite(v) && v !== 0) ||
    !t.translate.every(Number.isFinite)
  ) {
    throw new Error('Document transform must contain finite, non-zero scale values');
  }
}

/** Keep optional source extents coherent after moving geometry. */
function refreshStoredExtents(doc: CityJsonDocument, affected: CityObject[]): void {
  for (const obj of affected) {
    if (Array.isArray(obj.geographicalExtent)) {
      const extent = extentForObjects(doc, collectGeometryHolders(doc, obj));
      if (extent) obj.geographicalExtent = extent;
    }
  }
  if (Array.isArray(doc.metadata?.geographicalExtent)) {
    const extent = extentForObjects(doc, Object.values(doc.CityObjects));
    if (extent) doc.metadata!.geographicalExtent = extent;
  }
}

function extentForObjects(
  doc: CityJsonDocument,
  objects: CityObject[]
): [number, number, number, number, number, number] | null {
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const obj of objects) {
    visitBoundaries(obj, (idx) => {
      const raw = doc.vertices[idx];
      if (!raw) return;
      const x = raw[0] * t.scale[0] + t.translate[0];
      const y = raw[1] * t.scale[1] + t.translate[1];
      const z = raw[2] * t.scale[2] + t.translate[2];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    });
  }
  return Number.isFinite(minX) ? [minX, minY, minZ, maxX, maxY, maxZ] : null;
}
