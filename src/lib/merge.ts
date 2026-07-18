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
 *  - Compatible coordinate transforms are normalised into the base
 *    document's integer grid. Adjacent CityJSONSeq tiles commonly have the
 *    same CRS and millimetre scale but different local translations. The
 *    merge decodes and re-encodes those vertices exactly; it refuses if a
 *    coordinate cannot be represented on the base grid without precision
 *    loss.
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
  if (baseCrs && incCrs && !sameCrsReference(baseCrs, incCrs)) {
    return {
      ok: false,
      reason: `CRS mismatch — base is ${baseCrs}, incoming is ${incCrs}. Convert one before merging.`,
    };
  }

  // Transform check — if the base has no transform and incoming does, adopt
  // incoming's. If both have transforms, re-encode the incoming vertices onto
  // the base grid when needed. A transformed base cannot safely absorb an
  // untransformed incoming document because the latter's coordinate units are
  // ambiguous.
  let incomingVertices = incoming.vertices.map((vertex) => [...vertex] as [number, number, number]);
  if (base.transform && incoming.transform) {
    const normalised = reencodeVertices(incomingVertices, incoming.transform, base.transform);
    if (!normalised.ok) {
      return {
        ok: false,
        reason: normalised.reason,
      };
    }
    incomingVertices = normalised.vertices;
  } else if (!base.transform && incoming.transform) {
    base.transform = incoming.transform;
  } else if (base.transform && !incoming.transform) {
    return {
      ok: false,
      reason:
        'Transform mismatch — base is integer-encoded but incoming has no transform. ' +
        'Cannot infer incoming coordinate units safely.',
    };
  }

  if (!baseCrs && incCrs && base.metadata) base.metadata.referenceSystem = incCrs;
  else if (!base.metadata && incoming.metadata) base.metadata = { ...incoming.metadata };
  mergeGeographicalExtent(base, incoming);

  // ── Vertex merge ────────────────────────────────────────────────────────
  const vertexOffset = base.vertices.length;
  for (const v of incomingVertices) base.vertices.push(v);

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

function sameCrsReference(left: string, right: string): boolean {
  if (left === right) return true;
  const epsgCode = (value: string) =>
    value.match(/EPSG\/\d+\/(\d+)|EPSG:(\d+)/i)?.slice(1).find(Boolean) ?? null;
  const leftCode = epsgCode(left);
  const rightCode = epsgCode(right);
  return leftCode !== null && leftCode === rightCode;
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

function reencodeVertices(
  vertices: [number, number, number][],
  incoming: NonNullable<CityJsonDocument['transform']>,
  base: NonNullable<CityJsonDocument['transform']>
): { ok: true; vertices: [number, number, number][] } | { ok: false; reason: string } {
  if (!isUsableTransform(incoming) || !isUsableTransform(base)) {
    return {
      ok: false,
      reason: 'Transform mismatch — scale and translate values must be finite and scale cannot be zero.',
    };
  }

  const same =
    incoming.scale.every((value, index) => value === base.scale[index]) &&
    incoming.translate.every((value, index) => value === base.translate[index]);
  if (same) return { ok: true, vertices };

  const encoded: [number, number, number][] = [];
  for (const vertex of vertices) {
    const next: [number, number, number] = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const decoded = vertex[axis] * incoming.scale[axis] + incoming.translate[axis];
      const raw = (decoded - base.translate[axis]) / base.scale[axis];
      const rounded = Math.round(raw);
      if (!Number.isFinite(raw) || Math.abs(raw - rounded) > 1e-5) {
        return {
          ok: false,
          reason:
            'Transform mismatch — incoming coordinates cannot be represented exactly ' +
            'on the base document grid without precision loss.',
        };
      }
      next[axis] = rounded;
    }
    encoded.push(next);
  }
  return { ok: true, vertices: encoded };
}

function isUsableTransform(transform: NonNullable<CityJsonDocument['transform']>): boolean {
  return (
    transform.scale.every((value) => Number.isFinite(value) && value !== 0) &&
    transform.translate.every(Number.isFinite)
  );
}

function mergeGeographicalExtent(base: CityJsonDocument, incoming: CityJsonDocument): void {
  const left = base.metadata?.geographicalExtent;
  const right = incoming.metadata?.geographicalExtent;
  if (!Array.isArray(right) || right.length < 6) return;
  if (!base.metadata) base.metadata = {};
  if (!Array.isArray(left) || left.length < 6) {
    base.metadata.geographicalExtent = right.slice(0, 6);
    return;
  }
  base.metadata.geographicalExtent = [
    Math.min(left[0], right[0]),
    Math.min(left[1], right[1]),
    Math.min(left[2], right[2]),
    Math.max(left[3], right[3]),
    Math.max(left[4], right[4]),
    Math.max(left[5], right[5]),
  ];
}
