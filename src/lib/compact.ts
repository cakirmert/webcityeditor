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

  // A Set<number> plus Map<number, number> costs tens of bytes per entry in
  // V8. Hamburg road working sets routinely contain hundreds of thousands of
  // vertices, so use one bounded 4-byte-per-vertex table as both the reference
  // marker and the final remap.
  const remap = new Int32Array(before);
  remap.fill(-1);
  let referencedCount = 0;
  for (const obj of Object.values(doc.CityObjects)) {
    if (!obj.geometry) continue;
    for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
      if (g.boundaries) {
        referencedCount += markReferencedIndices(g.boundaries, remap);
      }
    }
  }

  // Early-exit: no orphans (every vertex in [0, before) is referenced).
  if (referencedCount === before) {
    return { before, after: before, reclaimed: 0, changed: false };
  }

  // Compact the original array in place. This preserves its identity and
  // avoids retaining the old and new Hamburg vertex arrays simultaneously.
  let writeIndex = 0;
  for (let sourceIndex = 0; sourceIndex < before; sourceIndex++) {
    if (remap[sourceIndex] === -2) {
      remap[sourceIndex] = writeIndex;
      if (writeIndex !== sourceIndex) {
        doc.vertices[writeIndex] = doc.vertices[sourceIndex];
      }
      writeIndex++;
    }
  }
  doc.vertices.length = writeIndex;

  // Rewrite existing boundary arrays in place rather than allocating a second
  // complete nested boundary tree during viewport-tile eviction.
  for (const obj of Object.values(doc.CityObjects)) {
    if (!obj.geometry) continue;
    for (const g of obj.geometry as Array<{ boundaries?: unknown }>) {
      if (g.boundaries) remapIndicesInPlace(g.boundaries, remap);
    }
  }

  return {
    before,
    after: doc.vertices.length,
    reclaimed: before - doc.vertices.length,
    changed: true,
  };
}

/** Mark each valid source index once and report how many were newly marked. */
function markReferencedIndices(node: unknown, remap: Int32Array): number {
  if (typeof node === 'number') {
    if (
      Number.isInteger(node) &&
      node >= 0 &&
      node < remap.length &&
      remap[node] === -1
    ) {
      remap[node] = -2;
      return 1;
    }
    return 0;
  }
  if (!Array.isArray(node)) return 0;
  let count = 0;
  for (const child of node) count += markReferencedIndices(child, remap);
  return count;
}

/** Rewrite numeric leaves without cloning their containing arrays. */
function remapIndicesInPlace(node: unknown, remap: Int32Array): void {
  if (!Array.isArray(node)) return;
  for (let index = 0; index < node.length; index++) {
    const child = node[index];
    if (typeof child === 'number') {
      if (
        Number.isInteger(child) &&
        child >= 0 &&
        child < remap.length &&
        remap[child] >= 0
      ) {
        node[index] = remap[child];
      }
    } else {
      remapIndicesInPlace(child, remap);
    }
  }
}
