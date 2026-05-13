import type { CityJsonDocument } from '../types';
import {
  generateBuilding,
  insertBuilding,
  type NewBuildingParams,
  type RoofType,
} from './generator';
import { detectCrs } from './projection';

export type RegenerateError = string;

export interface RegenerateResult {
  /** True if the regeneration succeeded; false means the doc is unmodified. */
  ok: boolean;
  /** Error reason if `ok === false`. */
  reason?: RegenerateError;
  /** Index range of the orphaned vertices (the ones the OLD geometry used).
   *  Useful for a future "compact" pass; right now we just leave them in place. */
  orphanedVertexRange?: { start: number; end: number };
}

/**
 * Re-run the parametric generator on an editor-created building with a new
 * footprint, preserving every other parameter (height, roof type, storeys,
 * openings, eave overhang, attributes).
 *
 * The old geometry is replaced in-place — we keep the building's CityObject
 * id and pass-through attributes, but its `geometry` is rebuilt from scratch
 * using the new footprint.
 *
 * Vertex compaction is intentionally skipped: the old vertex range becomes
 * orphaned (nothing references it after the swap), and is reported via
 * `orphanedVertexRange` so a separate pass can reclaim it later if memory
 * pressure becomes a concern. For typical interactive editing with a handful
 * of regenerations, the bloat is acceptable.
 *
 * Preconditions:
 *  - The building exists and was created by the editor (we recognise it via
 *    `attributes._createdBy === 'city-editor-prototype'` plus the stashed
 *    parametric attributes `_eaveHeight`, `_ridgeHeight`, etc.).
 *  - The new footprint has at least 3 vertices.
 *  - The doc has a recognisable CRS.
 *
 * On any precondition failure the doc is NOT modified and `ok: false` is
 * returned with a reason string suitable for surfacing in the UI.
 */
/**
 * Optional parametric overrides for `regenerateBuilding`. When any of these
 * are present, they win over the building's stashed `_*` attributes — useful
 * for "change roof type" / "raise the ridge" inline edits without having to
 * push the user through the full new-building flow. The new values are also
 * persisted back as `_*` attributes so a follow-up footprint-edit still picks
 * them up.
 */
export interface RegenerateOverrides {
  roofType?: RoofType;
  eaveHeight?: number;
  ridgeHeight?: number;
  eaveOverhang?: number;
  rakeOverhang?: number;
  addWindows?: boolean;
  addDoor?: boolean;
  storeys?: number;
}

export function regenerateBuilding(
  doc: CityJsonDocument,
  buildingId: string,
  newFootprintWgs84: [number, number][],
  overrides?: RegenerateOverrides
): RegenerateResult {
  const obj = doc.CityObjects[buildingId];
  if (!obj) return { ok: false, reason: 'Building not found' };
  if (obj.type !== 'Building') {
    return { ok: false, reason: 'Only top-level Buildings can have their footprint edited' };
  }
  if (obj.children && obj.children.length > 0) {
    return {
      ok: false,
      reason: 'Cannot edit footprint of a split building — combine its parts first',
    };
  }
  const a = obj.attributes ?? {};
  if (a._createdBy !== 'city-editor-prototype') {
    return {
      ok: false,
      reason:
        'Footprint editing is only available for buildings created in the editor — imported buildings keep their original geometry',
    };
  }
  const eaveHeightStored = Number(a._eaveHeight);
  const ridgeHeightStored = Number(a._ridgeHeight);
  const baseElevation = Number(a._baseElevation ?? 0);
  const roofTypeStored = a.roofType as RoofType | undefined;
  const storeysStored = Number(a.storeysAboveGround);
  // Resolve effective parameters: overrides win, else stashed values.
  const roofType = overrides?.roofType ?? roofTypeStored;
  let eaveHeight = overrides?.eaveHeight ?? eaveHeightStored;
  let ridgeHeight = overrides?.ridgeHeight ?? ridgeHeightStored;
  const storeys = overrides?.storeys ?? storeysStored;
  // Constraint-fix the resolved heights given the (possibly new) roofType.
  if (roofType === 'flat') {
    eaveHeight = ridgeHeight;
  } else if (Number.isFinite(eaveHeight) && Number.isFinite(ridgeHeight) && eaveHeight >= ridgeHeight) {
    const slack = Math.min(2.5, ridgeHeight * 0.25);
    eaveHeight = Math.max(0.5, ridgeHeight - slack);
  }
  if (!Number.isFinite(eaveHeight) || eaveHeight <= 0) {
    return { ok: false, reason: 'Building is missing parametric data (_eaveHeight)' };
  }
  if (!Number.isFinite(ridgeHeight) || ridgeHeight < eaveHeight) {
    return { ok: false, reason: 'Building is missing parametric data (_ridgeHeight)' };
  }
  if (!roofType || !['flat', 'pyramid', 'gable', 'hip'].includes(roofType)) {
    return { ok: false, reason: 'Building is missing parametric data (roofType)' };
  }
  if (!Number.isFinite(storeys) || storeys < 1) {
    return { ok: false, reason: 'Building is missing parametric data (storeysAboveGround)' };
  }

  if (!newFootprintWgs84 || newFootprintWgs84.length < 3) {
    return { ok: false, reason: 'New footprint must have at least 3 vertices' };
  }

  const crs = detectCrs(doc);
  if (!crs.supported) {
    return { ok: false, reason: `Cannot project — CRS ${crs.code} not supported` };
  }

  // Geometry-shape constraints on roof type (gable/hip require 4 verts).
  // Drop closing vertex if present before checking.
  const open = newFootprintWgs84.slice();
  const [first, last] = [open[0], open[open.length - 1]];
  if (first[0] === last[0] && first[1] === last[1]) open.pop();
  if ((roofType === 'gable' || roofType === 'hip') && open.length !== 4) {
    return {
      ok: false,
      reason: `${roofType} roofs require a 4-vertex (rectangular) footprint`,
    };
  }

  // Capture the original vertex range — everything the old geometry referenced.
  // Walk geometry boundaries to compute min/max indices used by THIS building.
  const oldRange = vertexRange(obj);

  const params: NewBuildingParams = {
    targetCrs: crs.code,
    footprintWgs84: open,
    storeys,
    eaveHeight,
    ridgeHeight,
    roofType,
    baseElevation,
    eaveOverhang: overrides?.eaveOverhang ?? Number(a._eaveOverhang ?? 0),
    rakeOverhang: overrides?.rakeOverhang ?? Number(a._rakeOverhang ?? 0),
    openings: (() => {
      const w = overrides?.addWindows ?? Boolean(a._addWindows);
      const d = overrides?.addDoor ?? Boolean(a._addDoor);
      return w || d ? { windows: w, door: d } : undefined;
    })(),
    // Pass through user-facing attributes (function, year, etc.). We strip the
    // private parametric ones because generator.ts will re-derive and write
    // them itself.
    attributes: stripPrivateAttrs(a),
  };

  let newResult;
  try {
    newResult = generateBuilding(doc, params);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }

  // Append the new vertices and graft the new geometry onto the existing id —
  // preserving the building's CityObject identity (so external references in
  // BuildingPart.parents still match, attribute history is kept, etc.).
  const newVertexOffset = doc.vertices.length;
  for (const v of newResult.newVertices) doc.vertices.push(v);
  obj.geometry = newResult.cityObject.geometry;
  // Attribute merge: keep external attrs, refresh stored parametric ones.
  obj.attributes = newResult.cityObject.attributes;

  return {
    ok: true,
    orphanedVertexRange: oldRange
      ? { start: oldRange.min, end: oldRange.max }
      : undefined,
    // Communicate where the new vertices live so callers can highlight or
    // re-pick the building if needed.
    ...({ newVertexOffset } as object),
  };
}

/** Strip the private `_eaveHeight` / `_addWindows` / etc. attributes. */
function stripPrivateAttrs(a: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const skip = new Set([
    '_eaveHeight',
    '_ridgeHeight',
    '_baseElevation',
    '_eaveOverhang',
    '_rakeOverhang',
    '_addWindows',
    '_addDoor',
    '_createdBy',
    '_createdAt',
    'measuredHeight',
    'storeysAboveGround',
    'roofType',
  ]);
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(a)) {
    if (skip.has(k)) continue;
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out[k] = v as string | number | boolean | null;
    }
  }
  return out;
}

/** Compute the [min, max] vertex index range referenced by a CityObject's
 *  geometry. Used by regenerateBuilding to report the orphaned range. */
function vertexRange(
  obj: CityJsonDocument['CityObjects'][string]
): { min: number; max: number } | null {
  if (!obj.geometry || (obj.geometry as unknown[]).length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  const walk = (node: unknown) => {
    if (typeof node === 'number') {
      if (node < min) min = node;
      if (node > max) max = node;
    } else if (Array.isArray(node)) {
      for (const child of node) walk(child);
    }
  };
  for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
    if (g.boundaries) walk(g.boundaries);
  }
  if (min === Infinity) return null;
  return { min, max };
}
