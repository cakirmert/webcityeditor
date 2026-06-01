import type { CityJsonDocument, CityObject } from '../types';
import { extractFootprints } from './footprints';
import { detectCrs } from './projection';
import { generateBuilding, insertBuilding, type RoofType } from './generator';

/**
 * Result of trying to infer parametric inputs from an imported building's
 * geometry. `ok: true` means the rest of the editor's regenerate/footprint-
 * edit/openings toolchain can run on this building; `ok: false` explains
 * what stopped us (no footprint, no CRS, etc.).
 */
export type ParametriseResult =
  | { ok: true; params: InferredParams }
  | { ok: false; reason: string };

export interface InferredParams {
  roofType: RoofType;
  baseElevation: number;
  /** Top of the walls — in metres above the doc's CRS Z=0 datum. */
  eaveHeight: number;
  /** Top of the roof / ridge — same datum. */
  ridgeHeight: number;
  storeys: number;
  footprintWgs84: [number, number][];
}

/**
 * Infer the parametric inputs (roof type, eave/ridge heights, storeys) from
 * an imported building's geometry + attributes, WITHOUT mutating the doc.
 * Used by `parametriseBuilding` to convert imported buildings into ones the
 * editor can fully regenerate.
 *
 * Heuristics, in priority order:
 *   - `roofType` attribute (string OR CityGML/3DBAG integer code) → normalised
 *   - `measuredHeight` attribute → ridgeHeight = baseZ + measuredHeight
 *   - WallSurface vertex top → eaveHeight (walks geometry semantics)
 *   - falls back to a flat-roof shape with the geometry's full max-Z as both
 *     eave and ridge if no roof analysis is possible
 *   - `storeysAboveGround` attribute → storeys; else round((eave-base)/3)
 */
export function inferParametricAttrs(
  doc: CityJsonDocument,
  buildingId: string
): ParametriseResult {
  const obj = doc.CityObjects[buildingId];
  if (!obj) return { ok: false, reason: `Object "${buildingId}" not found` };

  const fps = extractFootprints(doc);
  const fp = fps.find((f) => f.id === buildingId);
  if (!fp || fp.polygon.length < 3) {
    return {
      ok: false,
      reason: 'No extractable footprint — building has no GroundSurface or its outer ring is degenerate.',
    };
  }

  const crs = detectCrs(doc);
  if (!crs.supported) {
    return { ok: false, reason: `Unsupported CRS: ${crs.code}` };
  }

  const attrs = obj.attributes ?? {};
  const holders = collectGeometryHolders(doc, obj);
  const inheritedAttr = (key: string): unknown => {
    for (const holder of holders) {
      const value = holder.attributes?.[key];
      if (value !== undefined && value !== null) return value;
    }
    return undefined;
  };

  // ── Roof type ────────────────────────────────────────────────────────────
  const roofType = normaliseRoofType(inheritedAttr('roofType'));

  // ── Z analysis ───────────────────────────────────────────────────────────
  // Walk the building's geometry, classifying each vertex it touches by the
  // semantic surface it sits on. We need:
  //   baseZ:  ground level (min Z of GroundSurface vertices, fallback: min Z)
  //   eaveZ:  top of walls (max Z of WallSurface vertices, fallback: heuristic)
  //   ridgeZ: top of roof (max Z of RoofSurface vertices, fallback: max Z)
  const z = analyseGeometryHeights(doc, obj);
  const baseZ = z.baseZ;

  // Prefer attribute-derived heights when present — many CityGML/3DBAG
  // datasets carry these and they're more reliable than vertex analysis on
  // partial/mesh-only imports (e.g. IFC).
  const measuredHeight =
    typeof inheritedAttr('measuredHeight') === 'number'
      ? (inheritedAttr('measuredHeight') as number)
      : typeof inheritedAttr('h_max') === 'number'
      ? (inheritedAttr('h_max') as number)
      : null;

  let ridgeHeight: number;
  let eaveHeight: number;

  if (measuredHeight !== null && measuredHeight > 0) {
    ridgeHeight = baseZ + measuredHeight;
    // If walls were detected, trust the geometry's eave; otherwise heuristic.
    eaveHeight =
      z.eaveZ !== null
        ? z.eaveZ
        : roofType === 'flat'
        ? ridgeHeight
        : baseZ + measuredHeight * 0.75;
  } else if (z.ridgeZ !== null) {
    ridgeHeight = z.ridgeZ;
    eaveHeight =
      z.eaveZ !== null
        ? z.eaveZ
        : roofType === 'flat'
        ? ridgeHeight
        : baseZ + (ridgeHeight - baseZ) * 0.75;
  } else {
    return {
      ok: false,
      reason: 'Could not determine building height — no geometry vertices found.',
    };
  }

  if (eaveHeight > ridgeHeight) eaveHeight = ridgeHeight;
  if (eaveHeight < baseZ) eaveHeight = baseZ;

  // For flat roofs the eave + ridge must coincide (generator enforces this).
  if (roofType === 'flat') eaveHeight = ridgeHeight;

  // ── Storey count ────────────────────────────────────────────────────────
  const storeysAttr =
    typeof inheritedAttr('storeysAboveGround') === 'number'
      ? Math.round(inheritedAttr('storeysAboveGround') as number)
      : null;
  const wallH = Math.max(0.1, eaveHeight - baseZ);
  const storeys = storeysAttr
    ? Math.max(1, Math.min(60, storeysAttr))
    : Math.max(1, Math.min(60, Math.round(wallH / 3)));

  return {
    ok: true,
    params: {
      roofType,
      baseElevation: baseZ,
      eaveHeight: eaveHeight - baseZ, // generator expects heights RELATIVE to baseElevation
      ridgeHeight: ridgeHeight - baseZ,
      storeys,
      footprintWgs84: fp.polygon,
    },
  };
}

/**
 * "Make editable" — replaces the imported building's geometry with a
 * parametric regeneration using `inferParametricAttrs`, then stashes the
 * `_*` private attributes the rest of the editor needs (regenerate.ts,
 * AttributePanel's footprint-edit gate, etc.).
 *
 * After this returns ok, the building behaves like one the editor created:
 *   - "Edit footprint" works
 *   - roof type / eave height / overhangs can be changed via regenerate
 *   - openings can be added (the regenerated geometry has the right semantics)
 *
 * Caveats the caller should surface to the user:
 *   - Original geometry detail is replaced — irregular roofs become regular
 *     parametric ones in the same roof family.
 *   - Original child BuildingParts (LoD2 split into BodyParts etc.) are NOT
 *     preserved; this is a single-building conversion.
 */
export function parametriseBuilding(
  doc: CityJsonDocument,
  buildingId: string,
  overrides?: Partial<InferredParams>
): ParametriseResult {
  const inference = inferParametricAttrs(doc, buildingId);
  if (!inference.ok) return inference;

  const params = { ...inference.params, ...(overrides ?? {}) };
  // If the override changes roofType from flat to pitched, eave and ridge
  // must differ — the inference's flat-roof clamping (eave := ridge) leaves
  // them equal and the generator would reject. Drop the eave by a sensible
  // default (2.5 m or 25 % of total, whichever is smaller).
  if (params.roofType !== 'flat' && params.eaveHeight >= params.ridgeHeight) {
    const slack = Math.min(2.5, params.ridgeHeight * 0.25);
    params.eaveHeight = Math.max(0.5, params.ridgeHeight - slack);
  }
  // Conversely, flat requires ridge === eave.
  if (params.roofType === 'flat') {
    params.eaveHeight = params.ridgeHeight;
  }
  const obj = doc.CityObjects[buildingId];
  const oldAttrs = obj.attributes ?? {};

  // Preserve all user-visible attributes from the imported building. The
  // generator's attribute-merging in `generateBuilding` is what stamps the
  // `_*` privates we need for regeneration.
  const preservedAttrs: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(oldAttrs)) {
    if (k.startsWith('_')) continue; // strip private markers from the source
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      preservedAttrs[k] = v;
    }
  }

  const crs = detectCrs(doc);
  if (!crs.supported) {
    return { ok: false, reason: `Unsupported CRS: ${crs.code}` };
  }

  // Generate replacement geometry and graft it onto the existing CityObject
  // id. `generateBuilding` only describes the new vertices; unlike
  // `insertBuilding`, it does not append them to the document itself.
  let result;
  try {
    result = generateBuilding(doc, {
      targetCrs: crs.code,
      footprintWgs84: params.footprintWgs84,
      storeys: params.storeys,
      eaveHeight: params.eaveHeight,
      ridgeHeight: params.ridgeHeight,
      roofType: params.roofType,
      baseElevation: params.baseElevation,
      attributes: preservedAttrs,
    });
  } catch (e) {
    return {
      ok: false,
      reason: `Regeneration failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (result.vertexOffset !== doc.vertices.length) {
    return {
      ok: false,
      reason: `Vertex offset mismatch: expected ${doc.vertices.length}, got ${result.vertexOffset}`,
    };
  }
  doc.vertices.push(...result.newVertices);

  // Imported LoD2 roots often delegate all geometry to BuildingPart children.
  // Promotion replaces that source detail with one editable parametric solid,
  // so consume the old descendants and clear the root linkage.
  consumeReplacedDescendants(doc, buildingId);

  // Replace the original CityObject's geometry + attributes in place.
  // Keep its existing parents/children linkage so the rest of the doc
  // (e.g. CityObjectGroups, BuildingParts) still references this id.
  const generated = result.cityObject;
  obj.geometry = generated.geometry;
  obj.attributes = generated.attributes;

  return { ok: true, params };
}

/**
 * Map roofType attribute values — strings OR CityGML/3DBAG integer codes —
 * to our internal `RoofType` enum. Unrecognised values fall back to 'flat'.
 * Mirrors the mapping in `footprint-tint.ts`.
 */
export function normaliseRoofType(raw: unknown): RoofType {
  if (typeof raw === 'string') {
    const k = raw.toLowerCase();
    if (k === 'flat' || k === 'gable' || k === 'hip' || k === 'pyramid') return k;
    if (k === 'pyramidal') return 'pyramid';
  }
  if (typeof raw === 'number') {
    if (raw === 1000) return 'flat';
    if (raw === 3100) return 'gable';
    if (raw === 3200) return 'hip';
    if (raw === 3400) return 'pyramid';
  }
  return 'flat';
}

interface HeightAnalysis {
  baseZ: number;
  /** Max Z among vertices tagged as WallSurface, or null if no walls found. */
  eaveZ: number | null;
  /** Max Z among vertices tagged as RoofSurface, or null if no roofs found. */
  ridgeZ: number | null;
}

/**
 * Walk the building's geometry, decoding each vertex through the doc's
 * transform, and classify by semantic surface. Returns the Z range we need
 * to seed the parametric inputs. Falls back to "all vertices" mins/maxes
 * when semantics aren't present (e.g. IFC LoD3 mesh imports).
 */
function analyseGeometryHeights(
  doc: CityJsonDocument,
  obj: CityObject
): HeightAnalysis {
  const t = doc.transform ?? { scale: [1, 1, 1], translate: [0, 0, 0] };
  const decodeZ = (idx: number) => {
    const v = doc.vertices[idx];
    if (!v) return null;
    return v[2] * t.scale[2] + t.translate[2];
  };
  let minZ = Infinity;
  let maxZ = -Infinity;
  let wallMaxZ = -Infinity;
  let roofMaxZ = -Infinity;
  let groundMinZ = Infinity;
  let sawAnyVertex = false;
  let sawWall = false;
  let sawRoof = false;
  let sawGround = false;

  for (const holder of collectGeometryHolders(doc, obj)) {
    for (const gRaw of (holder.geometry ?? []) as Array<{
      type?: string;
      boundaries?: unknown;
      semantics?: { surfaces?: Array<{ type?: string }>; values?: unknown };
    }>) {
      const surfaces = gRaw.semantics?.surfaces ?? [];
      const values = gRaw.semantics?.values;
      visitFaces(gRaw.boundaries, values, (faceVerts, semIdx) => {
        const surfType =
          typeof semIdx === 'number' && surfaces[semIdx]
            ? surfaces[semIdx].type
            : null;
        for (const idx of faceVerts) {
          const z = decodeZ(idx);
          if (z === null || !Number.isFinite(z)) continue;
          sawAnyVertex = true;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
          if (surfType === 'WallSurface') {
            sawWall = true;
            if (z > wallMaxZ) wallMaxZ = z;
          } else if (surfType === 'RoofSurface') {
            sawRoof = true;
            if (z > roofMaxZ) roofMaxZ = z;
          } else if (surfType === 'GroundSurface') {
            sawGround = true;
            if (z < groundMinZ) groundMinZ = z;
          }
        }
      });
    }
  }

  return {
    baseZ: sawGround ? groundMinZ : sawAnyVertex ? minZ : 0,
    eaveZ: sawWall ? wallMaxZ : null,
    ridgeZ: sawRoof ? roofMaxZ : sawAnyVertex ? maxZ : null,
  };
}

function collectGeometryHolders(doc: CityJsonDocument, obj: CityObject): CityObject[] {
  const out = [obj];
  for (const childId of obj.children ?? []) {
    const child = doc.CityObjects[childId];
    if (child) out.push(...collectGeometryHolders(doc, child));
  }
  return out;
}

function consumeReplacedDescendants(doc: CityJsonDocument, rootId: string): void {
  const root = doc.CityObjects[rootId];
  if (!root?.children?.length) return;
  const descendants = new Set<string>();
  const visit = (id: string) => {
    if (descendants.has(id)) return;
    descendants.add(id);
    for (const childId of doc.CityObjects[id]?.children ?? []) visit(childId);
  };
  for (const childId of root.children) visit(childId);

  // Retain unusually shared descendants that still belong to an external
  // parent, along with their nested subtree.
  const keep = new Set<string>();
  for (const id of descendants) {
    if ((doc.CityObjects[id]?.parents ?? []).some((p) => p !== rootId && !descendants.has(p))) {
      keep.add(id);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of descendants) {
      if (keep.has(id)) continue;
      if ((doc.CityObjects[id]?.parents ?? []).some((p) => keep.has(p))) {
        keep.add(id);
        changed = true;
      }
    }
  }

  const removed = new Set([...descendants].filter((id) => !keep.has(id)));
  for (const id of removed) delete doc.CityObjects[id];
  delete root.children;

  for (const [id, obj] of Object.entries(doc.CityObjects)) {
    if (obj.children) {
      obj.children = obj.children.filter((childId) => !removed.has(childId));
      if (obj.children.length === 0) delete obj.children;
    }
    if (obj.parents) {
      obj.parents = obj.parents.filter(
        (parentId) => !removed.has(parentId) && !(descendants.has(id) && parentId === rootId)
      );
      if (obj.parents.length === 0) delete obj.parents;
    }
  }
}

/**
 * Walk a CityJSON `boundaries` tree calling `cb(faceVertexIndices, semIdx)`
 * for every face. Handles Solid (one extra shell-nesting) and MultiSurface
 * shapes. `values` is the parallel `semantics.values` array — for Solid it's
 * `number[][]` (per-shell), for MultiSurface it's `number[]` (per-face).
 */
function visitFaces(
  boundaries: unknown,
  values: unknown,
  cb: (faceVerts: number[], semIdx: number | null) => void
): void {
  if (!Array.isArray(boundaries) || boundaries.length === 0) return;
  // Try to detect nesting depth: Solid has 4 levels (shell→face→ring→idx),
  // MultiSurface has 3 (face→ring→idx).
  const first = boundaries[0];
  if (!Array.isArray(first)) return;
  const second = first[0];
  const looksLikeSolid = Array.isArray(second) && Array.isArray(second[0]);

  if (looksLikeSolid) {
    const shells = boundaries as number[][][][];
    const shellSem = (Array.isArray(values) ? values : []) as number[][];
    for (let s = 0; s < shells.length; s++) {
      const semForShell = shellSem[s] ?? [];
      const faces = shells[s];
      for (let f = 0; f < faces.length; f++) {
        const outerRing = faces[f]?.[0] ?? [];
        cb(outerRing, typeof semForShell[f] === 'number' ? semForShell[f] : null);
      }
    }
  } else {
    const faces = boundaries as number[][][];
    const faceSem = (Array.isArray(values) ? values : []) as number[];
    for (let f = 0; f < faces.length; f++) {
      const outerRing = faces[f]?.[0] ?? [];
      cb(outerRing, typeof faceSem[f] === 'number' ? faceSem[f] : null);
    }
  }
}

// Re-export the `insertBuilding` helper so callers of this module can use
// it without a separate import — keeps the public surface tighter.
export { insertBuilding };
