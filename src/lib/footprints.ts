import type { CityJsonDocument, CityObject } from '../types';
import {
  applyVertexTransform,
  detectCrs,
  projectCityJsonVertexToWgs84,
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

/**
 * Return display copies whose root object groups touch the flat map plane.
 *
 * Source elevations remain available through `baseElevation`. BuildingParts
 * keep their height relative to the lowest part in their root group, so a
 * subdivided building remains vertically stacked instead of collapsing into
 * one storey at z=0.
 */
export function groundFootprintsForFlatMap(footprints: Footprint[]): Footprint[] {
  const groupGrounds = new Map<string, number>();
  for (const footprint of footprints) {
    if (!Number.isFinite(footprint.baseElevation)) continue;
    const groupId = footprint.parentId ?? footprint.id;
    groupGrounds.set(
      groupId,
      Math.min(groupGrounds.get(groupId) ?? Infinity, footprint.baseElevation)
    );
  }

  return footprints.map((footprint) => {
    const groupGround = groupGrounds.get(footprint.parentId ?? footprint.id);
    const displayElevation =
      groupGround === undefined ? 0 : footprint.baseElevation - groupGround;
    return {
      ...footprint,
      polygon: footprint.polygon.map(
        ([lng, lat]) => [lng, lat, displayElevation] as [number, number, number]
      ),
    };
  });
}

/**
 * Clamp each logical building group to a sampled terrain elevation while
 * preserving the vertical offsets between stacked BuildingParts. If terrain
 * is not available at a group centre, its surveyed/source ground is retained.
 */
export function clampFootprintsToTerrain(
  footprints: Footprint[],
  elevationAt: (lngLat: [number, number]) => number | null
): Footprint[] {
  const groups = new Map<
    string,
    { sourceGround: number; longitudeSum: number; latitudeSum: number; pointCount: number }
  >();
  for (const footprint of footprints) {
    const groupId = footprint.parentId ?? footprint.id;
    const group = groups.get(groupId) ?? {
      sourceGround: Infinity,
      longitudeSum: 0,
      latitudeSum: 0,
      pointCount: 0,
    };
    if (Number.isFinite(footprint.baseElevation)) {
      group.sourceGround = Math.min(group.sourceGround, footprint.baseElevation);
    }
    const ring = openFootprintRing(footprint.polygon);
    for (const [lng, lat] of ring) {
      group.longitudeSum += lng;
      group.latitudeSum += lat;
      group.pointCount++;
    }
    groups.set(groupId, group);
  }

  const targetGrounds = new Map<string, number>();
  for (const [groupId, group] of groups) {
    const sourceGround = Number.isFinite(group.sourceGround) ? group.sourceGround : 0;
    const center: [number, number] = group.pointCount > 0
      ? [group.longitudeSum / group.pointCount, group.latitudeSum / group.pointCount]
      : [0, 0];
    targetGrounds.set(groupId, elevationAt(center) ?? sourceGround);
  }

  return footprints.map((footprint) => {
    const groupId = footprint.parentId ?? footprint.id;
    const sourceGround = groups.get(groupId)?.sourceGround;
    const targetGround = targetGrounds.get(groupId);
    const offset = Number.isFinite(sourceGround) && targetGround !== undefined
      ? targetGround - (sourceGround as number)
      : 0;
    return {
      ...footprint,
      polygon: footprint.polygon.map(
        ([lng, lat, z]) => [lng, lat, z + offset] as [number, number, number]
      ),
      baseElevation: footprint.baseElevation + offset,
    };
  });
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
        const fp = buildFootprintForObject(doc, childId, crs.code, {
          parentId: rootId,
        });
        if (fp) {
          result.push(fp);
        }
      }
    } else {
      const fp = buildFootprintForObject(doc, rootId, crs.code);
      if (fp) result.push(fp);
    }
  }
  return result;
}

function buildFootprintForObject(
  doc: CityJsonDocument,
  id: string,
  crsCode: string,
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
    const vertex = doc.vertices[idx] as [number, number, number] | undefined;
    return vertex ? applyVertexTransform(vertex, doc) : null;
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

  const groundElevations = bestGroundRing
    .map((index) => vertexCrs(index)?.z)
    .filter((z): z is number => typeof z === 'number' && Number.isFinite(z));
  const baseElevation = groundElevations.length > 0
    ? Math.min(...groundElevations)
    : isFinite(minZ)
      ? minZ
      : 0;
  const polygon: FootprintPolygon = [];
  for (const idx of bestGroundRing) {
    const c = projectCityJsonVertexToWgs84(doc, idx, crsCode);
    if (!c) continue;
    polygon.push([c.lng, c.lat, baseElevation]);
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
  const computedHeight = isFinite(maxZ) ? Math.max(0, maxZ - baseElevation) : 10;
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

function openFootprintRing(polygon: FootprintPolygon): FootprintPolygon {
  if (polygon.length < 2) return polygon;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  return first[0] === last[0] && first[1] === last[1]
    ? polygon.slice(0, -1)
    : polygon;
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

  return buildFootprintForObject(doc, id, crs.code, {
    includeBuildingPartChildren: true,
  });
}
