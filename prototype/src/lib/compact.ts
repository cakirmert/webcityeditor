import type { CityJsonDocument } from '../types';

export interface CompactResult {
  /** Number of vertices in the doc before compaction. */
  before: number;
  /** Number of vertices in the doc after compaction. */
  after: number;
  /** How many orphaned vertices were reclaimed (== before - after). */
  reclaimed: number;
  /** True iff the doc was modified. False if there was nothing to reclaim. */
  changed: boolean;
}

/**
 * Reclaim orphaned vertices from a CityJsonDocument.
 *
 * Walks every CityObject's geometry, collects every referenced vertex index,
 * builds a contiguous remap table, rewrites every index, and compacts
 * `doc.vertices` to only the referenced entries (preserving order). All in
 * place — the doc identity is preserved so external selection state etc.
 * stays valid.
 *
 * Useful after one or more `regenerateBuilding` edits, which leave the old
 * vertex range orphaned by design (the new geometry sits at the end of the
 * vertex array). Without periodic compaction, a session of footprint edits
 * grows the file linearly with each edit; one call here reclaims it all.
 *
 * Compaction is O(V + F) where V = vertices and F = total face vertex
 * references. For Hamburg-tile-scale (~30k vertices, ~100k face refs) this
 * runs in single-digit ms.
 *
 * Returns a summary so the caller can surface "X vertices reclaimed" in the
 * UI and decide whether to mark the doc dirty.
 */
export function compactVertices(doc: CityJsonDocument): CompactResult {
  const before = doc.vertices.length;
  if (before === 0) {
    return { before, after: 0, reclaimed: 0, changed: false };
  }

  // Pass 1: collect every referenced vertex index.
  const referenced = new Set<number>();
  for (const obj of Object.values(doc.CityObjects)) {
    if (!obj.geometry) continue;
    for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
      if (g.boundaries) collectIndices(g.boundaries, referenced);
    }
  }

  // Early-exit: no orphans (every vertex in [0, before) is referenced).
  if (referenced.size === before) {
    return { before, after: before, reclaimed: 0, changed: false };
  }

  // Pass 2: build a remap (oldIndex → newIndex). Walk old indices in order so
  // the surviving vertex order is preserved.
  const remap = new Map<number, number>();
  const newVertices: typeof doc.vertices = [];
  for (let i = 0; i < before; i++) {
    if (referenced.has(i)) {
      remap.set(i, newVertices.length);
      newVertices.push(doc.vertices[i]);
    }
  }

  // Pass 3: rewrite every geometry's vertex indices using the remap.
  for (const obj of Object.values(doc.CityObjects)) {
    if (!obj.geometry) continue;
    for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
      if (g.boundaries) g.boundaries = remapIndices(g.boundaries, remap);
    }
  }

  // Pass 4: install the compacted array. In-place mutation so external
  // references to doc.vertices keep pointing at the new contents.
  doc.vertices.length = 0;
  doc.vertices.push(...newVertices);

  return {
    before,
    after: doc.vertices.length,
    reclaimed: before - doc.vertices.length,
    changed: true,
  };
}

/** Recursive walk that collects every leaf integer into the given set. */
function collectIndices(node: unknown, out: Set<number>): void {
  if (typeof node === 'number') {
    if (Number.isFinite(node) && node >= 0) out.add(node);
  } else if (Array.isArray(node)) {
    for (const child of node) collectIndices(child, out);
  }
}

/** Recursive walk that rebuilds the structure with remapped leaf integers.
 *  Returns a new tree (immutable on input) — geometry boundaries get freshly
 *  allocated arrays at every level. */
function remapIndices(node: unknown, remap: Map<number, number>): unknown {
  if (typeof node === 'number') {
    return remap.get(node) ?? node;
  }
  if (Array.isArray(node)) {
    return node.map((child) => remapIndices(child, remap));
  }
  return node;
}
