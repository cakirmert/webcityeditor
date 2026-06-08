import type { CityJsonDocument, CityObject } from '../types';
import {
  applyVertexTransform,
  detectCrs,
  projectToWgs84,
} from './projection';

export type FootprintPolygon = [number, number, number][];

export interface Footprint {
  /** Stable CityObject id */
  id: string;
  /** Parent ID if this is a child BuildingPart */
  parentId?: string;
  /** Display type ("Building", "Bridge", …) */
  type: string;
  /** Polygon ring as [lng, lat, elevation] triples, closed (first = last) */
  polygon: FootprintPolygon;
  /** Height in meters (from attributes.measuredHeight, else computed) */
  height: number;
  /** Ground elevation in meters (min Z of building vertices) */
  baseElevation: number;
  /** Pass-through CityObject attributes for tooltip */
  attributes: Record<string, unknown>;
}

export function footprintPolygonToWgs84(polygon: FootprintPolygon): [number, number][] {
  return polygon.map(([lng, lat]) => [lng, lat]);
}

/**
 * Extract footprints + heights for every top-level building in a CityJSON doc,
 * projecting vertices to WGS84 lng/lat so deck.gl can render them directly.
 *
 * For each building:
 *  - If it has child BuildingParts, extract separate footprints for each part
 *    and record the parent ID.
 *  - Otherwise, extract a single footprint for the root building.
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
    const root = doc.CityObjects[rootId];
    const partIds =
      root?.children?.filter((childId) => doc.CityObjects[childId]?.type === 'BuildingPart') ??
      [];
    if (partIds.length > 0) {
      for (const childId of partIds) {
        const fp = buildFootprintForObject(doc, childId, toLngLat, {
          parentId: rootId,
        });
        if (fp) {
          result.push(fp);
        }
      }
    } else {
      const fp = buildFootprintForObject(doc, rootId, toLngLat);
      if (fp) result.push(fp);
    }
  }
  return result;
}

function buildFootprintForObject(
  doc: CityJsonDocument,
  id: string,
  toLngLat: (x: number, y: number, z?: number) => [number, number],
  options: { parentId?: string; includeBuildingPartChildren?: boolean } = {}
): Footprint | null {
  const obj = doc.CityObjects[id];
  if (!obj) return null;

  const all = collectFootprintObjects(doc, id, options.includeBuildingPartChildren ?? false);

  // Walk geometries, pick the best ground polygon among all.
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

  for (const o of all) {
    if (!o.geometry) continue;
    const geometries = o.geometry as Array<{
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

  const baseElevation = isFinite(minZ) ? minZ : 0;
  const polygon: FootprintPolygon = [];
  for (const idx of bestGroundRing) {
    const c = vertexCrs(idx);
    if (!c) continue;
    const [lng, lat] = toLngLat(c.x, c.y, c.z);
    polygon.push([lng, lat, baseElevation]);
  }
  if (polygon.length < 3) return null;

  // Close the ring if not already closed
  const [firstLng, firstLat, firstZ] = polygon[0];
  const [lastLng, lastLat, lastZ] = polygon[polygon.length - 1];
  if (firstLng !== lastLng || firstLat !== lastLat || firstZ !== lastZ) {
    polygon.push([firstLng, firstLat, firstZ]);
  }

  const attrs = (obj.attributes ?? {}) as Record<string, unknown>;
  const attrHeight =
    typeof attrs.measuredHeight === 'number' ? attrs.measuredHeight : null;
  const computedHeight = isFinite(minZ) && isFinite(maxZ) ? maxZ - minZ : 10;
  const height = attrHeight ?? computedHeight;

  return {
    id,
    parentId: options.parentId,
    type: obj.type,
    polygon,
    height,
    baseElevation,
    attributes: attrs,
  };
}

function collectFootprintObjects(
  doc: CityJsonDocument,
  id: string,
  includeBuildingPartChildren: boolean
): CityObject[] {
  const out: CityObject[] = [];
  const queue = [id];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const nextId = queue.shift()!;
    if (seen.has(nextId)) continue;
    seen.add(nextId);
    const obj = doc.CityObjects[nextId];
    if (!obj) continue;

    if (obj.type === 'BuildingPart' && nextId !== id && !includeBuildingPartChildren) {
      continue;
    }

    out.push(obj);
    for (const childId of obj.children ?? []) {
      queue.push(childId);
    }
  }

  return out;
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
  const filtered = {
    ...doc,
    CityObjects: filteredObjects,
  };
  // cityjson-threejs-loader mutates parts of its input while preparing meshes.
  // Keep this detail-view document isolated so preview rendering cannot corrupt
  // the live editor document used for validation and export.
  return JSON.parse(JSON.stringify(filtered)) as CityJsonDocument;
}

/**
 * Extract a single combined footprint for a specific building/object ID,
 * collecting the object + all its children (meaning the old behavior of buildFootprint).
 * Used by parametriseBuilding to find the ground footprint of a building before it is editable.
 */
export function extractFootprintForId(doc: CityJsonDocument, id: string): Footprint | null {
  const crs = detectCrs(doc);
  if (!crs.supported) return null;

  const toLngLat = (x: number, y: number, z = 0): [number, number] =>
    projectToWgs84(crs.code, { x, y, z });

  return buildFootprintForObject(doc, id, toLngLat, {
    includeBuildingPartChildren: true,
  });
}
