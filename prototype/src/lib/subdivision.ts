import type { CityJsonDocument, CityObject } from '../types';
import { extractFootprints } from './footprints';
import {
  generateBuilding,
  insertBuilding,
  type NewBuildingParams,
  type RoofType,
} from './generator';

export const MIN_STOREY_HEIGHT = 2.4; // metres, residential habitable minimum
export const MIN_SIDE_WIDTH = 3.0; // metres, minimum side-part width

export interface SplitResult {
  /** IDs of the BuildingParts that were created. */
  partIds: string[];
}

/**
 * Subdivision works on any Building whose footprint and vertical range we can
 * extract from its geometry. Attributes (measuredHeight, storeysAboveGround,
 * roofType) are used when available; otherwise we infer sensible defaults from
 * the geometry. Imported data without these attributes still works.
 */
export function canSplitBuilding(doc: CityJsonDocument, id: string): {
  ok: boolean;
  reason?: string;
  params?: {
    footprintWgs84: [number, number][];
    totalHeight: number;
    eaveHeight: number;
    roofType: RoofType;
    storeys: number;
    baseElevation: number;
    targetCrs: string;
  };
} {
  const obj = doc.CityObjects[id];
  if (!obj) return { ok: false, reason: 'Building not found' };
  if (obj.type !== 'Building') return { ok: false, reason: 'Only Buildings can be split' };
  if (obj.children && obj.children.length > 0) {
    return { ok: false, reason: 'Already split into parts' };
  }

  const footprintWgs84 = readFootprintWgs84(doc, id);
  if (!footprintWgs84) {
    return { ok: false, reason: 'Could not extract footprint from geometry' };
  }

  const { baseZ, eaveZ, maxZ } = readVerticalRanges(doc, id);
  if (!Number.isFinite(baseZ) || !Number.isFinite(maxZ) || maxZ <= baseZ) {
    return { ok: false, reason: 'Could not determine vertical extent' };
  }

  // Attribute-driven values with geometry-based fallbacks
  const attrHeight = Number(obj.attributes?.measuredHeight ?? NaN);
  const totalHeight = Number.isFinite(attrHeight) ? attrHeight : maxZ - baseZ;

  const attrStoreys = Number(obj.attributes?.storeysAboveGround ?? NaN);
  // Heuristic fallback: assume 3 m per storey
  const storeys =
    Number.isFinite(attrStoreys) && attrStoreys >= 1
      ? attrStoreys
      : Math.max(1, Math.round((eaveZ - baseZ) / 3));

  const attrRoofType = obj.attributes?.roofType as RoofType | undefined;
  const roofType: RoofType = attrRoofType ?? (eaveZ < maxZ ? 'pyramid' : 'flat');
  //  ^ Geometric guess: if the highest vertex sits above the eave, there's a
  //    pitched roof; absent more info, assume pyramid (works for any convex
  //    footprint). If you want a different shape on regeneration, change the
  //    roofType in the building's attributes before splitting.

  const eaveHeight = Math.max(0.1, eaveZ - baseZ);

  const crs =
    (doc.metadata?.referenceSystem as string | undefined)?.match(
      /EPSG\/\d+\/(\d+)|EPSG:(\d+)/
    );
  if (!crs) return { ok: false, reason: 'Document CRS unknown' };
  const targetCrs = `EPSG:${crs[1] ?? crs[2]}`;

  return {
    ok: true,
    params: {
      footprintWgs84,
      totalHeight,
      eaveHeight,
      roofType,
      storeys,
      baseElevation: baseZ,
      targetCrs,
    },
  };
}

/**
 * Split a building into N BuildingParts stacked vertically, one per storey.
 * Lower parts become flat boxes; the topmost keeps the original roof type.
 * Heights are uniform — for custom per-floor heights use
 * `splitBuildingByFloorHeights`.
 *
 * Preconditions: canSplitBuilding returns ok. Minimum storey height enforced.
 */
export function splitBuildingByFloor(
  doc: CityJsonDocument,
  buildingId: string,
  floorCount: number
): SplitResult {
  if (floorCount < 2) throw new Error('Floor count must be at least 2');
  const gate = canSplitBuilding(doc, buildingId);
  if (!gate.ok || !gate.params) throw new Error(gate.reason ?? 'Cannot split');
  const perFloorWallH = gate.params.eaveHeight / floorCount;
  const heights = new Array(floorCount).fill(perFloorWallH) as number[];
  return splitBuildingByFloorHeights(doc, buildingId, heights);
}

/**
 * Split a building into BuildingParts using a custom per-floor wall-height
 * array (in metres). The number of parts is `heights.length`. The topmost
 * part keeps the original roof type; lower parts are flat boxes.
 *
 * The sum of `heights` must equal the source building's eaveHeight (within
 * 1 cm tolerance). Each individual height must be ≥ MIN_STOREY_HEIGHT.
 *
 * This is the workhorse the visual division editor uses. The legacy
 * `splitBuildingByFloor(doc, id, n)` delegates here with a uniform array.
 */
export function splitBuildingByFloorHeights(
  doc: CityJsonDocument,
  buildingId: string,
  heights: number[]
): SplitResult {
  const gate = canSplitBuilding(doc, buildingId);
  if (!gate.ok || !gate.params) throw new Error(gate.reason ?? 'Cannot split');
  const p = gate.params;

  if (heights.length < 2) throw new Error('Need at least 2 floor heights');
  for (const h of heights) {
    if (!Number.isFinite(h) || h <= 0) {
      throw new Error('Each floor height must be a positive number');
    }
    if (h < MIN_STOREY_HEIGHT) {
      throw new Error(
        `Floor height ${h.toFixed(2)} m is below the ${MIN_STOREY_HEIGHT} m minimum.`
      );
    }
  }
  const sum = heights.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - p.eaveHeight) > 0.01) {
    throw new Error(
      `Floor heights sum to ${sum.toFixed(2)} m but the building's eave height is ${p.eaveHeight.toFixed(2)} m. ` +
        `Each split must conserve total height.`
    );
  }

  const partIds: string[] = [];
  let cumulative = 0;
  for (let i = 0; i < heights.length; i++) {
    const isTop = i === heights.length - 1;
    const wallH = heights[i];
    const floorBase = p.baseElevation + cumulative;
    const thisEave = floorBase + wallH;
    const thisRidge = isTop ? p.baseElevation + p.totalHeight : thisEave;
    const thisRoofType: RoofType = isTop ? p.roofType : 'flat';

    const partParams: NewBuildingParams = {
      targetCrs: p.targetCrs,
      footprintWgs84: p.footprintWgs84,
      storeys: 1,
      eaveHeight: thisEave - floorBase,
      ridgeHeight: thisRidge - floorBase,
      roofType: thisRoofType,
      baseElevation: floorBase,
      attributes: {
        function: String(doc.CityObjects[buildingId].attributes?.function ?? 'residential'),
        _splitOrigin: buildingId,
        _floorIndex: i,
      },
    };
    const result = generateBuilding(doc, partParams);
    result.cityObject.type = 'BuildingPart';
    result.cityObject.parents = [buildingId];
    const id = insertBuilding(doc, result);
    partIds.push(id);
    cumulative += wallH;
  }

  const parent = doc.CityObjects[buildingId];
  parent.geometry = [];
  parent.children = [...(parent.children ?? []), ...partIds];
  return { partIds };
}

/**
 * Split a rectangular building into N BuildingParts side-by-side along its
 * longer axis. Each part keeps the parent's roof type.
 *
 * Preconditions: 4-vertex rectangular footprint, each resulting part ≥ MIN_SIDE_WIDTH.
 */
/**
 * Which axis to lay the side-split parts along.
 *   'auto' (default) — pick the longer axis (matches pre-axis behaviour).
 *   'longer'         — explicitly pick the longer axis.
 *   'shorter'        — force the shorter axis. Useful when the user wants
 *                      the cuts to run with the long side rather than across
 *                      it (e.g. for a row of narrow attached houses sitting
 *                      on a wide footprint).
 */
export type SplitAxis = 'auto' | 'longer' | 'shorter';

export function splitBuildingBySide(
  doc: CityJsonDocument,
  buildingId: string,
  partCount: number,
  axis: SplitAxis = 'auto'
): SplitResult {
  const gate = canSplitBuilding(doc, buildingId);
  if (!gate.ok || !gate.params) throw new Error(gate.reason ?? 'Cannot split');
  const p = gate.params;

  if (partCount < 2) throw new Error('Part count must be at least 2');
  if (p.footprintWgs84.length !== 4 && p.footprintWgs84.length !== 5) {
    throw new Error(
      'Side-split currently requires a 4-vertex (rectangular) footprint.'
    );
  }

  // Strip closing vertex if present
  const ring = p.footprintWgs84.slice();
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] === l[0] && f[1] === l[1]) ring.pop();
  if (ring.length !== 4) {
    throw new Error('Side-split requires exactly 4 corners.');
  }

  // Identify the longer axis. WGS84 distances approximated with a small
  // equirectangular projection (good enough for building-scale splits).
  const latRef = (ring[0][1] + ring[2][1]) / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((latRef * Math.PI) / 180);
  const toMeters = (a: [number, number], b: [number, number]) => {
    const dx = (a[0] - b[0]) * mPerDegLng;
    const dy = (a[1] - b[1]) * mPerDegLat;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const len0 = toMeters(ring[0], ring[1]);
  const len1 = toMeters(ring[1], ring[2]);
  // Resolve the requested axis to an "is the split along edge e0?" boolean.
  // 'auto' and 'longer' both pick the longer edge; 'shorter' inverts.
  const naturalLongOnE0 = len0 >= len1;
  const longAxisOnE0 = axis === 'shorter' ? !naturalLongOnE0 : naturalLongOnE0;
  const cutAxisLen = longAxisOnE0 ? len0 : len1;
  if (cutAxisLen / partCount < MIN_SIDE_WIDTH) {
    throw new Error(
      `Per-part width ${(cutAxisLen / partCount).toFixed(2)} m is below the ${MIN_SIDE_WIDTH} m minimum. ` +
        `Reduce part count, switch axis, or extend the footprint.`
    );
  }

  // Linearly interpolate along the long edge to get partCount+1 cut points on each
  // of the two long sides, then pair them up into rectangles.
  const lerp = (
    a: [number, number],
    b: [number, number],
    t: number
  ): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const cuts: [[number, number], [number, number]][] = [];
  for (let i = 0; i <= partCount; i++) {
    const t = i / partCount;
    if (longAxisOnE0) {
      // Long edges: (v0→v1) and (v2→v3). Short edges parallel across.
      cuts.push([lerp(ring[0], ring[1], t), lerp(ring[3], ring[2], t)]);
    } else {
      // Long edges: (v1→v2) and (v0→v3).
      cuts.push([lerp(ring[0], ring[3], t), lerp(ring[1], ring[2], t)]);
    }
  }

  const partIds: string[] = [];
  for (let i = 0; i < partCount; i++) {
    const [a1, a2] = cuts[i];
    const [b1, b2] = cuts[i + 1];
    const subFootprint: [number, number][] = longAxisOnE0
      ? [a1, b1, b2, a2]
      : [a1, a2, b2, b1];

    const partParams: NewBuildingParams = {
      targetCrs: p.targetCrs,
      footprintWgs84: subFootprint,
      storeys: p.storeys,
      eaveHeight: p.eaveHeight,
      ridgeHeight: p.totalHeight,
      roofType: p.roofType === 'gable' || p.roofType === 'hip' ? 'flat' : p.roofType,
      // ^ pitched roofs on sub-rectangles lose their original ridge orientation
      //   and can produce ugly joins. Prototype degrades to flat until the
      //   generator supports a shared-ridge mode.
      baseElevation: p.baseElevation,
      attributes: {
        function: String(doc.CityObjects[buildingId].attributes?.function ?? 'residential'),
        _splitOrigin: buildingId,
        _sideIndex: i,
      },
    };
    const result = generateBuilding(doc, partParams);
    result.cityObject.type = 'BuildingPart';
    result.cityObject.parents = [buildingId];
    const id = insertBuilding(doc, result);
    partIds.push(id);
  }

  const parent = doc.CityObjects[buildingId];
  parent.geometry = [];
  parent.children = [...(parent.children ?? []), ...partIds];
  return { partIds };
}

// ---------- helpers ----------

/** Read a building's footprint (first-child-inclusive) in WGS84 via extractFootprints. */
function readFootprintWgs84(
  doc: CityJsonDocument,
  id: string
): [number, number][] | null {
  const fps = extractFootprints(doc);
  const found = fps.find((f) => f.id === id);
  return found ? found.polygon : null;
}

/** Walk a building's vertex range to figure out base Z, eave Z, and max Z in CRS meters. */
function readVerticalRanges(
  doc: CityJsonDocument,
  id: string
): { baseZ: number; eaveZ: number; maxZ: number } {
  const obj = doc.CityObjects[id];
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const toZ = (int: number) => int * t.scale[2] + t.translate[2];

  let minZ = Infinity;
  let maxZ = -Infinity;
  const levels = new Set<number>();
  const walkGeom = (o: CityObject) => {
    if (!o.geometry) return;
    for (const g of o.geometry as unknown as Array<{
      boundaries?: unknown;
    }>) {
      const b = g.boundaries;
      visit(b);
    }
  };
  const visit = (b: unknown) => {
    if (!Array.isArray(b)) return;
    for (const item of b) {
      if (typeof item === 'number') {
        const z = toZ(doc.vertices[item]?.[2] ?? 0);
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        levels.add(+z.toFixed(3));
      } else {
        visit(item);
      }
    }
  };
  walkGeom(obj);
  for (const childId of obj.children ?? []) {
    const child = doc.CityObjects[childId];
    if (child) walkGeom(child);
  }
  // For flat roofs we only have 2 Z levels (ground + top), and eave = top.
  // For pitched roofs we have ≥3 Z levels (ground, eave, ridge apex), and eave
  // is the second-highest unique level.
  const sorted = Array.from(levels).sort((a, b) => a - b);
  const eaveZ = sorted.length >= 3 ? sorted[sorted.length - 2] : maxZ;
  return {
    baseZ: isFinite(minZ) ? minZ : 0,
    eaveZ: isFinite(eaveZ) ? eaveZ : 0,
    maxZ: isFinite(maxZ) ? maxZ : 0,
  };
}
