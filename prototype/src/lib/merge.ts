import type { CityJsonDocument, CityObject } from '../types';

export interface MergeOutcome {
  /** True iff merge succeeded; the base doc has been mutated in place. */
  ok: boolean;
  /** Friendly reason if `ok === false`. */
  reason?: string;
  /** Number of CityObjects added from `incoming`. */
  added?: number;
  /** Number of CityObject ids that collided and were renamed (e.g.
   *  "Building_A" → "Building_A__merge2"). */
  renamed?: number;
  /** Map of old → new ids for any conflicts that were resolved. */
  renameMap?: Record<string, string>;
}

/**
 * Merge `incoming` into `base` in place.
 *
 * Behaviours:
 *  - Both docs must declare the same CRS (or one of them must be missing,
 *    in which case the present one wins). Refuses to mix mismatched CRSs
 *    silently — that would scatter incoming buildings across the map.
 *  - Vertex indices in `incoming` are shifted by `base.vertices.length` so
 *    every reference still resolves after the merge.
 *  - CityObject id conflicts get a unique suffix (`__merge2`, `__merge3`, …)
 *    and the renames are reported. If a child references a renamed parent,
 *    the parents/children arrays are rewritten to use the new id.
 *  - Coordinate transforms must match exactly. Mismatched scale/translate
 *    means the integer-encoded vertices can't be merged in place; we'd need
 *    to decode-and-re-encode, which loses precision. Refuses with a friendly
 *    reason.
 *
 * Useful for stitching together adjacent Hamburg tiles, or for layering an
 * "edits" file on top of an imported base. The result is a single, editable
 * CityJsonDocument that can be saved + exported normally.
 */
export function mergeCityJson(
  base: CityJsonDocument,
  incoming: CityJsonDocument
): MergeOutcome {
  if (base.type !== 'CityJSON' || incoming.type !== 'CityJSON') {
    return { ok: false, reason: 'Both inputs must be CityJSON documents' };
  }

  // CRS check — accept matching, accept missing on one side (most likely
  // user error but recoverable), reject mismatch.
  const baseCrs = base.metadata?.referenceSystem;
  const incCrs = incoming.metadata?.referenceSystem;
  if (baseCrs && incCrs && baseCrs !== incCrs) {
    return {
      ok: false,
      reason: `CRS mismatch — base is ${baseCrs}, incoming is ${incCrs}. Convert one before merging.`,
    };
  }

  // Transform check — scale + translate must match. If the base has no
  // transform and incoming does, adopt incoming's. Same for incoming-no-base.
  if (base.transform && incoming.transform) {
    const sBase = base.transform.scale;
    const sInc = incoming.transform.scale;
    const tBase = base.transform.translate;
    const tInc = incoming.transform.translate;
    const sameScale = sBase[0] === sInc[0] && sBase[1] === sInc[1] && sBase[2] === sInc[2];
    const sameTranslate =
      tBase[0] === tInc[0] && tBase[1] === tInc[1] && tBase[2] === tInc[2];
    if (!sameScale || !sameTranslate) {
      return {
        ok: false,
        reason:
          'Transform mismatch — scale/translate differ between docs. ' +
          'Vertex re-encoding would lose precision; not yet supported.',
      };
    }
  } else if (!base.transform && incoming.transform) {
    base.transform = incoming.transform;
  }

  if (!baseCrs && incCrs && base.metadata) base.metadata.referenceSystem = incCrs;
  else if (!base.metadata && incoming.metadata) base.metadata = { ...incoming.metadata };

  // ── Vertex merge ────────────────────────────────────────────────────────
  const vertexOffset = base.vertices.length;
  for (const v of incoming.vertices) base.vertices.push(v);

  // ── Id conflict resolution ──────────────────────────────────────────────
  const renameMap: Record<string, string> = {};
  const baseIds = new Set(Object.keys(base.CityObjects));
  for (const id of Object.keys(incoming.CityObjects)) {
    if (baseIds.has(id)) {
      let n = 2;
      let candidate = `${id}__merge${n}`;
      while (baseIds.has(candidate)) {
        n++;
        candidate = `${id}__merge${n}`;
      }
      renameMap[id] = candidate;
      baseIds.add(candidate);
    } else {
      baseIds.add(id);
    }
  }

  // ── CityObject merge — rewrite vertex indices + parent/child references ─
  let added = 0;
  for (const [oldId, raw] of Object.entries(incoming.CityObjects)) {
    const newId = renameMap[oldId] ?? oldId;
    const obj: CityObject = cloneAndShift(raw, vertexOffset);
    if (obj.parents) obj.parents = obj.parents.map((p) => renameMap[p] ?? p);
    if (obj.children) obj.children = obj.children.map((c) => renameMap[c] ?? c);
    base.CityObjects[newId] = obj;
    added++;
  }

  return {
    ok: true,
    added,
    renamed: Object.keys(renameMap).length,
    renameMap: Object.keys(renameMap).length > 0 ? renameMap : undefined,
  };
}

/** Deep-clone a CityObject and add `offset` to every vertex index in its
 *  geometry. Does not mutate the input. */
function cloneAndShift(obj: CityObject, offset: number): CityObject {
  const cloned = JSON.parse(JSON.stringify(obj)) as CityObject;
  if (cloned.geometry) {
    for (const g of cloned.geometry as Array<{ boundaries?: unknown }>) {
      if (g.boundaries) g.boundaries = shiftIndices(g.boundaries, offset);
    }
  }
  return cloned;
}

function shiftIndices(node: unknown, offset: number): unknown {
  if (typeof node === 'number') return node + offset;
  if (Array.isArray(node)) return node.map((c) => shiftIndices(c, offset));
  return node;
}
