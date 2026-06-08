import type { CityJsonDocument, CityObject } from '../types';
import { extractFootprints, footprintPolygonToWgs84 } from './footprints';
import {
  generateBuilding,
  insertBuilding,
  type NewBuildingParams,
  type RoofType,
} from './generator';

export const MIN_STOREY_HEIGHT = 2.4; // metres, residential habitable minimum
export const MIN_SIDE_WIDTH = 3.0; // metres, minimum side-part width

/**
 * Which axis to lay footprint sections along.
 *   'auto' (default) — pick the longer axis.
 *   'longer'         — explicitly pick the longer axis.
 *   'shorter'        — force the shorter axis.
 */
export type SplitAxis = 'auto' | 'longer' | 'shorter';

/** One floor's footprint plan. Cut fractions are measured from 0 to 1 along
 * the selected axis; omitted fractions produce equal-width sections. */
export interface FloorPlanDivision {
  partCount: number;
  axis: SplitAxis;
  cutFractions?: number[];
}

export interface SplitResult {
  /** IDs of the BuildingParts that were created. */
  partIds: string[];
}

export interface FloorPlanSplitResult extends SplitResult {
  /** Created BuildingPart IDs grouped by floor, ground floor first. */
  floorPartIds: string[][];
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
  return splitBuildingByFloorPlans(
    doc,
    buildingId,
    heights,
    heights.map(() => ({ partCount: 1, axis: 'auto' }))
  );
}

/**
 * Divide a building vertically and by footprint in one operation. Every floor
 * receives its own plan, so a ground floor can have three sections while an
 * upper floor stays open, or callers can pass the same plan for every floor.
 *
 * Each generated section is an ordinary BuildingPart with `_floorIndex` and
 * `_footprintSectionIndex` attributes for downstream editing and reporting.
 */
export function splitBuildingByFloorPlans(
  doc: CityJsonDocument,
  buildingId: string,
  heights: number[],
  floorPlans: FloorPlanDivision[]
): FloorPlanSplitResult {
  const gate = canSplitBuilding(doc, buildingId);
  if (!gate.ok || !gate.params) throw new Error(gate.reason ?? 'Cannot split');
  const p = gate.params;

  validateFloorHeights(heights, p.eaveHeight);
  if (floorPlans.length !== heights.length) {
    throw new Error('Each floor must have exactly one footprint plan');
  }

  // Validate and prepare every footprint before appending any geometry. A bad
  // cut must leave the source document untouched.
  const footprintsByFloor = floorPlans.map((plan) =>
    plan.partCount === 1
      ? [openFootprint(p.footprintWgs84)]
      : splitFootprintBySide(p.footprintWgs84, plan)
  );

  const partIds: string[] = [];
  const floorPartIds: string[][] = [];
  let cumulative = 0;
  for (let floorIndex = 0; floorIndex < heights.length; floorIndex++) {
    const isTop = floorIndex === heights.length - 1;
    const wallH = heights[floorIndex];
    const floorBase = p.baseElevation + cumulative;
    const thisEave = floorBase + wallH;
    const sectionFootprints = footprintsByFloor[floorIndex];
    const idsForFloor: string[] = [];

    for (let sectionIndex = 0; sectionIndex < sectionFootprints.length; sectionIndex++) {
      const subFootprint = sectionFootprints[sectionIndex];
      const keepPitchedRoof = isTop && sectionFootprints.length === 1;
      const thisRidge = keepPitchedRoof ? p.baseElevation + p.totalHeight : thisEave;
      const thisRoofType: RoofType = keepPitchedRoof ? p.roofType : 'flat';

      const partParams: NewBuildingParams = {
        targetCrs: p.targetCrs,
        footprintWgs84: subFootprint,
        storeys: 1,
        eaveHeight: thisEave - floorBase,
        ridgeHeight: thisRidge - floorBase,
        roofType: thisRoofType,
        baseElevation: floorBase,
        attributes: {
          function: String(doc.CityObjects[buildingId].attributes?.function ?? 'residential'),
          _splitOrigin: buildingId,
          _floorIndex: floorIndex,
          _footprintSectionIndex: sectionIndex,
          _footprintSectionCount: sectionFootprints.length,
        },
      };
      const result = generateBuilding(doc, partParams);
      result.cityObject.type = 'BuildingPart';
      result.cityObject.parents = [buildingId];
      const id = insertBuilding(doc, result);
      partIds.push(id);
      idsForFloor.push(id);
    }
    floorPartIds.push(idsForFloor);
    cumulative += wallH;
  }

  const parent = doc.CityObjects[buildingId];
  parent.geometry = [];
  parent.children = [...(parent.children ?? []), ...partIds];
  return { partIds, floorPartIds };
}

function validateFloorHeights(heights: number[], eaveHeight: number): void {
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
  if (Math.abs(sum - eaveHeight) > 0.01) {
    throw new Error(
      `Floor heights sum to ${sum.toFixed(2)} m but the building's eave height is ${eaveHeight.toFixed(2)} m. ` +
        `Each split must conserve total height.`
    );
  }
}

/**
 * Split a rectangular building into N BuildingParts side-by-side along its
 * longer axis. Each part keeps the parent's roof type.
 *
 * Preconditions: 4-vertex rectangular footprint, each resulting part ≥ MIN_SIDE_WIDTH.
 */
export function splitBuildingBySide(
  doc: CityJsonDocument,
  buildingId: string,
  partCount: number,
  axis: SplitAxis = 'auto'
): SplitResult {
  const gate = canSplitBuilding(doc, buildingId);
  if (!gate.ok || !gate.params) throw new Error(gate.reason ?? 'Cannot split');
  const p = gate.params;

  const subFootprints = splitFootprintBySide(p.footprintWgs84, { partCount, axis });
  const partIds: string[] = [];
  for (let i = 0; i < subFootprints.length; i++) {
    const subFootprint = subFootprints[i];
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

/** Resolve one rectangular footprint plan into section polygons. */
export function splitFootprintBySide(
  footprintWgs84: [number, number][],
  plan: FloorPlanDivision
): [number, number][][] {
  const ring = openFootprint(footprintWgs84);
  if (plan.partCount < 2) throw new Error('Part count must be at least 2');
  if (ring.length !== 4) {
    throw new Error('Side-split currently requires a 4-vertex (rectangular) footprint.');
  }

  const latRef = (ring[0][1] + ring[2][1]) / 2;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((latRef * Math.PI) / 180);
  const toMeters = (a: [number, number], b: [number, number]) => {
    const dx = (a[0] - b[0]) * mPerDegLng;
    const dy = (a[1] - b[1]) * mPerDegLat;
    return Math.hypot(dx, dy);
  };
  const len0 = toMeters(ring[0], ring[1]);
  const len1 = toMeters(ring[1], ring[2]);
  const naturalLongOnE0 = len0 >= len1;
  const splitOnE0 = plan.axis === 'shorter' ? !naturalLongOnE0 : naturalLongOnE0;
  const cutAxisLen = splitOnE0 ? len0 : len1;
  const fractions = normaliseCutFractions(plan.partCount, plan.cutFractions);
  const stops = [0, ...fractions, 1];
  for (let i = 0; i < stops.length - 1; i++) {
    const width = (stops[i + 1] - stops[i]) * cutAxisLen;
    if (width < MIN_SIDE_WIDTH) {
      throw new Error(
        `Section ${i + 1} width ${width.toFixed(2)} m is below the ${MIN_SIDE_WIDTH} m minimum. ` +
          `Move a cut, reduce part count, switch axis, or extend the footprint.`
      );
    }
  }

  const lerp = (
    a: [number, number],
    b: [number, number],
    t: number
  ): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  const cuts: [[number, number], [number, number]][] = stops.map((t) =>
    splitOnE0
      ? [lerp(ring[0], ring[1], t), lerp(ring[3], ring[2], t)]
      : [lerp(ring[0], ring[3], t), lerp(ring[1], ring[2], t)]
  );

  return cuts.slice(0, -1).map(([a1, a2], i) => {
    const [b1, b2] = cuts[i + 1];
    return splitOnE0 ? [a1, b1, b2, a2] : [a1, a2, b2, b1];
  });
}

function normaliseCutFractions(partCount: number, cuts?: number[]): number[] {
  const fractions =
    cuts ?? new Array(partCount - 1).fill(0).map((_, i) => (i + 1) / partCount);
  if (fractions.length !== partCount - 1) {
    throw new Error(`Expected ${partCount - 1} footprint cuts, got ${fractions.length}`);
  }
  let previous = 0;
  for (const cut of fractions) {
    if (!Number.isFinite(cut) || cut <= previous || cut >= 1) {
      throw new Error('Footprint cuts must be increasing percentages between 0 and 100');
    }
    previous = cut;
  }
  return fractions;
}

function openFootprint(footprint: [number, number][]): [number, number][] {
  const ring = footprint.slice();
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring;
}

/** Read a building's footprint (first-child-inclusive) in WGS84 via extractFootprints. */
function readFootprintWgs84(
  doc: CityJsonDocument,
  id: string
): [number, number][] | null {
  const fps = extractFootprints(doc);
  const found = fps.find((f) => f.id === id);
  return found ? footprintPolygonToWgs84(found.polygon) : null;
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
