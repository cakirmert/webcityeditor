import type { CityJsonDocument, CityObject } from '../types';
import {
  applyVertexTransform,
  detectCrs,
  projectToWgs84,
} from './projection';

export interface Footprint {
  /** Stable CityObject id */
  id: string;
  /** Display type ("Building", "Bridge", …) */
  type: string;
  /** Polygon ring as [lng, lat] pairs, closed (first = last) */
  polygon: [number, number][];
  /** Height in meters (from attributes.measuredHeight, else computed) */
  height: number;
  /** Ground elevation in meters (min Z of building vertices) */
  baseElevation: number;
  /** Pass-through CityObject attributes for tooltip */
  attributes: Record<string, unknown>;
}

/**
 * Extract footprints + heights for every top-level building in a CityJSON doc,
 * projecting vertices to WGS84 lng/lat so deck.gl can render them directly.
 *
 * For each building:
 *  - Include BuildingPart children when looking for a GroundSurface.
 *  - Prefer the polygon whose semantic type is GroundSurface.
 *  - Fall back to the lowest polygon in the highest-LoD Solid.
 *  - Height: attributes.measuredHeight if set, else (maxZ - minZ).
 *
 * Returns an empty array if the CRS is not projectable (caller should surface a warning).
 */
export function extractFootprints(doc: CityJsonDocument): Footprint[] {
  const crs = detectCrs(doc);
  if (!crs.supported) return [];

  const toLngLat = (x: number, y: number, z = 0): [number, number] =>
    projectToWgs84(crs.code, { x, y, z });

  const result: Footprint[] = [];

  // Find root-level buildings (no parents)
  const rootIds = Object.keys(doc.CityObjects).filter((id) => {
    const o = doc.CityObjects[id];
    return (
      (o.type === 'Building' ||
        o.type === 'Bridge' ||
        o.type === 'Tunnel' ||
        o.type === 'CityObjectGroup') &&
      !o.parents
    );
  });

  for (const rootId of rootIds) {
    const fp = buildFootprint(doc, rootId, toLngLat);
    if (fp) result.push(fp);
  }
  return result;
}

function buildFootprint(
  doc: CityJsonDocument,
  rootId: string,
  toLngLat: (x: number, y: number, z?: number) => [number, number]
): Footprint | null {
  const root = doc.CityObjects[rootId];
  if (!root) return null;

  // Collect this building + its children
  const all: CityObject[] = [root];
  for (const childId of root.children ?? []) {
    const child = doc.CityObjects[childId];
    if (child) all.push(child);
  }

  // Walk geometries, pick the best ground polygon among all.
  // Explicit type so closure assignments don't get narrowed to `never`.
  let bestGroundRing: number[] | null = null as number[] | null;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Helper to read a vertex in CRS coords
  const vertexCrs = (idx: number) => {
    const v = doc.vertices[idx] as [number, number, number] | undefined;
    if (!v) return null;
    return applyVertexTransform(v, doc);
  };

  const recordZ = (ring: number[]) => {
    for (const idx of ring) {
      const c = vertexCrs(idx);
      if (!c) continue;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
  };

  // Candidate collector with preference for semantic GroundSurface
  let hasSemanticGround = false;

  for (const obj of all) {
    if (!obj.geometry) continue;
    // Prefer LoD 2, then LoD 1
    const geometries = obj.geometry as Array<{
      type: string;
      lod?: string | number;
      boundaries?: unknown;
      semantics?: { surfaces: Array<{ type: string }>; values: unknown };
    }>;
    const chosen =
      geometries.find((g) => String(g.lod).startsWith('2')) ??
      geometries.find((g) => String(g.lod).startsWith('1')) ??
      geometries[0];
    if (!chosen) continue;

    walkSolidFaces(chosen, (outerRing, surfaceType) => {
      recordZ(outerRing);
      if (!hasSemanticGround && surfaceType === 'GroundSurface') {
        hasSemanticGround = true;
        bestGroundRing = outerRing;
      } else if (!hasSemanticGround) {
        // No semantic yet — keep the lowest-z ring as a running fallback
        if (!bestGroundRing) {
          bestGroundRing = outerRing;
        } else {
          const avgZ = avgRingZ(outerRing, vertexCrs);
          const curZ = avgRingZ(bestGroundRing, vertexCrs);
          if (avgZ < curZ) bestGroundRing = outerRing;
        }
      }
    });
  }

  if (!bestGroundRing) return null;

  const polygon: [number, number][] = [];
  for (const idx of bestGroundRing) {
    const c = vertexCrs(idx);
    if (!c) continue;
    polygon.push(toLngLat(c.x, c.y, c.z));
  }
  if (polygon.length < 3) return null;
  // Close the ring if not already closed
  const [firstLng, firstLat] = polygon[0];
  const [lastLng, lastLat] = polygon[polygon.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat) polygon.push([firstLng, firstLat]);

  const attrs = (root.attributes ?? {}) as Record<string, unknown>;
  const attrHeight =
    typeof attrs.measuredHeight === 'number' ? attrs.measuredHeight : null;
  const computedHeight = isFinite(minZ) && isFinite(maxZ) ? maxZ - minZ : 10;
  const height = attrHeight ?? computedHeight;

  return {
    id: rootId,
    type: root.type,
    polygon,
    height,
    baseElevation: isFinite(minZ) ? minZ : 0,
    attributes: attrs,
  };
}

function avgRingZ(
  ring: number[],
  getter: (idx: number) => { z: number } | null
): number {
  let sum = 0,
    n = 0;
  for (const idx of ring) {
    const c = getter(idx);
    if (c) {
      sum += c.z;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * Visit every outer ring in a CityJSON geometry (Solid/MultiSolid/MultiSurface),
 * yielding (ring, surfaceType). Holes are ignored (the extrusion renderer can't
 * use them directly — hole support is a future enhancement).
 */
function walkSolidFaces(
  geom: {
    type: string;
    boundaries?: unknown;
    semantics?: { surfaces: Array<{ type: string }>; values: unknown };
  },
  emit: (outerRing: number[], surfaceType: string | null) => void
) {
  const b = geom.boundaries as unknown;
  const surfaces = geom.semantics?.surfaces ?? [];
  const values = geom.semantics?.values as unknown;

  const getType = (...path: number[]): string | null => {
    let cur: unknown = values;
    for (const p of path) {
      if (!Array.isArray(cur)) return null;
      cur = cur[p];
    }
    if (typeof cur !== 'number') return null;
    return surfaces[cur]?.type ?? null;
  };

  if (!Array.isArray(b)) return;

  if (geom.type === 'MultiSurface' || geom.type === 'CompositeSurface') {
    for (let fi = 0; fi < b.length; fi++) {
      const face = (b as unknown[][])[fi];
      const outer = (face[0] as unknown) as number[];
      emit(outer, getType(fi));
    }
  } else if (geom.type === 'Solid') {
    const shell = (b as unknown[][])[0];
    for (let fi = 0; fi < shell.length; fi++) {
      const face = (shell[fi] as unknown) as unknown[][];
      const outer = face[0] as unknown as number[];
      emit(outer, getType(0, fi));
    }
  } else if (geom.type === 'MultiSolid' || geom.type === 'CompositeSolid') {
    for (let si = 0; si < b.length; si++) {
      const solid = (b as unknown[][])[si];
      const shell = (solid[0] as unknown) as unknown[][];
      for (let fi = 0; fi < shell.length; fi++) {
        const face = (shell[fi] as unknown) as unknown[][];
        const outer = face[0] as unknown as number[];
        emit(outer, getType(si, 0, fi));
      }
    }
  }
}

/**
 * Given a doc and a selected building id, return a new CityJSON doc that contains
 * ONLY that building + its BuildingParts + all vertices. Used to feed the detail
 * Three.js editor without bloating it with the whole city.
 */
export function filterToBuilding(
  doc: CityJsonDocument,
  buildingId: string
): CityJsonDocument {
  const keep = new Set<string>([buildingId]);
  const root = doc.CityObjects[buildingId];
  if (root?.children) {
    for (const c of root.children) keep.add(c);
  }
  // Also include descendants recursively (BuildingParts may have InstallationParts)
  const queue = [...keep];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const obj = doc.CityObjects[id];
    if (obj?.children) {
      for (const c of obj.children) {
        if (!keep.has(c)) {
          keep.add(c);
          queue.push(c);
        }
      }
    }
  }
  const filteredObjects: Record<string, CityObject> = {};
  for (const id of keep) {
    const o = doc.CityObjects[id];
    if (o) filteredObjects[id] = o;
  }
  return {
    ...doc,
    CityObjects: filteredObjects,
  };
}
